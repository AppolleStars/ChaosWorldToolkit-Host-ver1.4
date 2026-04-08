// map.js - 地图交互：预设24种高对比颜色，按队伍分配
const TEAMS_STORAGE_KEY = 'teams_data';
const POSITIONS_STORAGE_KEY = 'map_member_positions';

let currentSelectedMemberId = null;
let positionsMap = {};
let mapImage = null;
let mapContainer = null;
let markersLayer = null;

// ---------- 预设24种高对比颜色 ----------
const COLOR_PALETTE = Array.from({ length: 24 }, (_, i) => {
    const hue = i * 15; // 0,15,30,...,345
    return `hsl(${hue}, 70%, 55%)`;
});

let teamColorCache = new Map();

// 刷新队伍颜色映射（按队伍ID排序分配）
function refreshTeamColors() {
    const teams = getAllTeams();
    const sortedTeams = [...teams].sort((a, b) => a.id.localeCompare(b.id));
    teamColorCache.clear();
    sortedTeams.forEach((team, idx) => {
        teamColorCache.set(team.id, COLOR_PALETTE[idx % COLOR_PALETTE.length]);
    });
}

function getTeamColor(teamId) {
    if (!teamColorCache.has(teamId)) {
        refreshTeamColors();
    }
    return teamColorCache.get(teamId) || '#888888';
}

// ---------- 原有函数（保持不变，但内部调用 getTeamColor） ----------
function getAllTeams() {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function getAllMembersFlat() {
    const teams = getAllTeams();
    const members = [];
    teams.forEach(team => {
        (team.members || []).forEach(member => {
            members.push({
                teamId: team.id,
                teamName: team.name,
                member: member
            });
        });
    });
    return members;
}

function loadPositions() {
    const stored = localStorage.getItem(POSITIONS_STORAGE_KEY);
    positionsMap = stored ? JSON.parse(stored) : {};
}

function savePositions() {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positionsMap));
}

function getMemberPosition(memberId) {
    if (positionsMap[memberId]) return positionsMap[memberId];
    let hash = 0;
    for (let i = 0; i < memberId.length; i++) {
        hash = ((hash << 5) - hash) + memberId.charCodeAt(i);
        hash |= 0;
    }
    const x = 0.2 + (Math.abs(hash % 60)) / 100;
    const y = 0.2 + (Math.abs((hash >> 8) % 60)) / 100;
    return { x, y };
}

function setMemberPosition(memberId, x, y) {
    positionsMap[memberId] = { x, y };
    savePositions();
    renderMarkers();
}

function renderTeamList() {
    const container = document.getElementById('teamListContainer');
    if (!container) return;
    refreshTeamColors(); // 刷新颜色映射
    const teams = getAllTeams();
    if (!teams.length) {
        container.innerHTML = '<div class="empty-msg">暂无队伍，请先在“队伍管理”中创建队伍和队员。</div>';
        return;
    }
    let html = '';
    teams.forEach(team => {
        if (!team.members || team.members.length === 0) return;
        const teamColor = getTeamColor(team.id);
        html += `<div class="team-group" style="margin-bottom: 1rem;">`;
        html += `<div class="team-group-header" style="background:#f8fafd; padding:0.5rem 1rem; font-weight:bold;">👥 ${escapeHtml(team.name)}</div>`;
        html += `<div class="member-list-inline" style="display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.5rem;">`;
        team.members.forEach(member => {
            const isSelected = (currentSelectedMemberId === member.id);
            html += `
                <div class="member-select-item ${isSelected ? 'selected' : ''}" data-member-id="${member.id}" data-team-id="${team.id}" style="display: inline-flex; align-items: center; gap: 6px;">
                    <span class="team-color-dot" style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${teamColor};"></span>
                    <strong>${escapeHtml(member.roleName)}</strong> (${escapeHtml(member.playerName)})
                </div>
            `;
        });
        html += `</div></div>`;
    });
    if (html === '') {
        container.innerHTML = '<div class="empty-msg">暂无队员，请先在“队伍管理”中添加队员。</div>';
    } else {
        container.innerHTML = html;
    }

    document.querySelectorAll('.member-select-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const memberId = el.getAttribute('data-member-id');
            if (currentSelectedMemberId === memberId) {
                clearSelection();
            } else {
                setSelectedMember(memberId);
            }
        });
    });
}

function setSelectedMember(memberId) {
    currentSelectedMemberId = memberId;
    document.querySelectorAll('.member-select-item').forEach(el => {
        const id = el.getAttribute('data-member-id');
        if (id === memberId) {
            el.classList.add('selected');
            el.style.opacity = '1';
        } else {
            el.classList.remove('selected');
            el.style.opacity = '0.5';
        }
    });
    updateMarkersOpacity();
}

function clearSelection() {
    currentSelectedMemberId = null;
    document.querySelectorAll('.member-select-item').forEach(el => {
        el.classList.remove('selected');
        el.style.opacity = '1';
    });
    updateMarkersOpacity();
}

function updateMarkersOpacity() {
    const markers = document.querySelectorAll('.map-marker');
    markers.forEach(marker => {
        const memberId = marker.getAttribute('data-member-id');
        if (currentSelectedMemberId && memberId !== currentSelectedMemberId) {
            marker.style.opacity = '0.4';
        } else {
            marker.style.opacity = '1';
        }
    });
}

function renderMarkers() {
    if (!markersLayer) return;
    markersLayer.innerHTML = '';
    refreshTeamColors(); // 确保颜色最新
    const membersFlat = getAllMembersFlat();
    if (membersFlat.length === 0) return;

    const img = mapImage;
    if (!img || !img.complete || img.naturalWidth === 0) {
        setTimeout(() => renderMarkers(), 100);
        return;
    }

    membersFlat.forEach(({ teamId, member }) => {
        const pos = getMemberPosition(member.id);
        const teamColor = getTeamColor(teamId);
        const marker = document.createElement('div');
        marker.className = 'map-marker';
        marker.setAttribute('data-member-id', member.id);
        marker.style.position = 'absolute';
        marker.style.left = `calc(${pos.x * 100}% - 12px)`;
        marker.style.top = `calc(${pos.y * 100}% - 12px)`;
        marker.style.width = '24px';
        marker.style.height = '24px';
        marker.style.backgroundColor = teamColor;
        marker.style.borderRadius = '50%';
        marker.style.border = '2px solid white';
        marker.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        marker.style.display = 'flex';
        marker.style.alignItems = 'center';
        marker.style.justifyContent = 'center';
        marker.style.fontSize = '12px';
        marker.style.fontWeight = 'bold';
        marker.style.color = 'white';
        marker.style.cursor = 'pointer';
        marker.style.transition = 'opacity 0.2s';
        marker.textContent = member.roleName.charAt(0);
        marker.title = `${member.roleName} (${member.playerName})`;
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedMember(member.id);
        });
        markersLayer.appendChild(marker);
    });
    updateMarkersOpacity();
}

function onMapClick(e) {
    if (!currentSelectedMemberId) {
        alert('请先在下方的队伍列表中选中一名队员');
        return;
    }
    const img = mapImage;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;
    const xRatio = clickX / rect.width;
    const yRatio = clickY / rect.height;
    const clampedX = Math.min(1, Math.max(0, xRatio));
    const clampedY = Math.min(1, Math.max(0, yRatio));
    setMemberPosition(currentSelectedMemberId, clampedX, clampedY);
}

function initMap() {
    mapContainer = document.getElementById('mapContainer');
    mapImage = document.getElementById('worldMapImage');
    if (!mapImage || !mapContainer) return;

    markersLayer = document.createElement('div');
    markersLayer.id = 'mapMarkersLayer';
    markersLayer.style.position = 'absolute';
    markersLayer.style.top = '0';
    markersLayer.style.left = '0';
    markersLayer.style.width = '100%';
    markersLayer.style.height = '100%';
    markersLayer.style.pointerEvents = 'none';
    mapContainer.style.position = 'relative';
    mapContainer.appendChild(markersLayer);

    mapImage.addEventListener('click', onMapClick);

    if (mapImage.complete) {
        renderMarkers();
    } else {
        mapImage.addEventListener('load', () => {
            renderMarkers();
            renderTeamList();
        });
    }
}

function bindClearButton() {
    const clearBtn = document.getElementById('clearSelectionBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSelection);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function refreshData() {
    loadPositions();
    renderTeamList();
    renderMarkers();
}

document.addEventListener('DOMContentLoaded', () => {
    loadPositions();
    initMap();
    bindClearButton();
    renderTeamList();

    window.addEventListener('storage', (e) => {
        if (e.key === TEAMS_STORAGE_KEY) {
            refreshData();
        } else if (e.key === POSITIONS_STORAGE_KEY) {
            loadPositions();
            renderMarkers();
        }
    });
});