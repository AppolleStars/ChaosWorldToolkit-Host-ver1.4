// team.js - 队伍管理核心逻辑 + 背包系统
const TEAMS_STORAGE_KEY = 'teams_data';
const ITEM_STORAGE_KEY = 'item_encyclopedia_data';

// ========== 基础函数 ==========
function getAllTeams() {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveAllTeams(teams) {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

function createEmptyTeam(name = '新队伍') {
    return {
        id: generateId(),
        name: name,
        members: []
    };
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

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// 从物品图鉴获取所有物品
function getAllItemsFromEncyclopedia() {
    const stored = localStorage.getItem(ITEM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// ========== 数据迁移：为已有队员添加 inventory 字段 ==========
function migrateAddInventoryToMembers() {
    const teams = getAllTeams();
    let modified = false;
    teams.forEach(team => {
        team.members.forEach(member => {
            if (member.inventory === undefined) {
                member.inventory = [];
                modified = true;
            }
        });
    });
    if (modified) saveAllTeams(teams);
}

// ========== 背包相关全局变量 ==========
let currentInventoryTeamId = null;
let currentInventoryMemberId = null;
let isTeamInventoryMode = false;
let currentTeamForInventory = null;
let currentPickerTeamId = null, currentPickerMemberId = null;

// ========== 打开队员背包 ==========
function openMemberInventory(teamId, memberId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member) return;
    currentInventoryTeamId = teamId;
    currentInventoryMemberId = memberId;
    isTeamInventoryMode = false;
    currentTeamForInventory = null;
    renderInventoryModal(team, member);
    document.getElementById('inventoryModal').style.display = 'flex';
}

// ========== 打开队伍背包（只读汇总） ==========
function openTeamInventory(teamId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    currentTeamForInventory = team;
    isTeamInventoryMode = true;
    currentInventoryTeamId = null;
    currentInventoryMemberId = null;
    renderTeamInventoryModal(team);
    document.getElementById('inventoryModal').style.display = 'flex';
}

// ========== 渲染队员背包（可编辑） ==========
function renderInventoryModal(team, member) {
    const titleElem = document.getElementById('inventoryModalTitle');
    titleElem.innerText = `🎒 ${member.roleName}（${member.playerName}）的背包`;

    const body = document.getElementById('inventoryModalBody');
    const inventory = member.inventory || [];
    const allItems = getAllItemsFromEncyclopedia();

    let html = `
        <div class="inventory-actions">
            <button id="addFromEncyBtn" class="btn-primary" style="padding:0.3rem 1rem;">📚 从图鉴添加</button>
            <button id="exportInventoryBtn" class="btn-secondary" style="padding:0.3rem 1rem;">📤 导出背包</button>
            <button id="importInventoryBtn" class="btn-secondary" style="padding:0.3rem 1rem;">📥 导入背包</button>
        </div>
        <table class="inventory-table">
            <thead>
                <tr><th>物品名称</th><th>类别</th><th style="text-align:center">数量</th><th style="text-align:center">操作</th></tr>
            </thead>
            <tbody>
    `;

    inventory.forEach((invItem, idx) => {
        const itemInfo = allItems.find(i => i.id === invItem.itemId) || { name: invItem.itemName || '未知物品', category: invItem.category || '' };
        html += `
            <tr>
                <td><strong>${escapeHtml(itemInfo.name)}</strong><br><small style="color:#7f8c9a;">${escapeHtml(invItem.description || '')}</small></td>
                <td>${escapeHtml(itemInfo.category || invItem.category || '')}</td>
                <td style="text-align:center">
                    <button class="qty-down" data-idx="${idx}" style="background:#eef2fa; border:none; width:28px; border-radius:1rem;">-</button>
                    <input type="number" class="qty-input" data-idx="${idx}" value="${invItem.quantity}" style="width:60px; text-align:center; margin:0 5px;">
                    <button class="qty-up" data-idx="${idx}" style="background:#eef2fa; border:none; width:28px; border-radius:1rem;">+</button>
                </td>
                <td style="text-align:center">
                    <button class="remove-item" data-idx="${idx}" style="background:#fee2e2; border:none; border-radius:1rem; padding:4px 10px;">删除</button>
                </td>
            </tr>
            <tr>
                <td colspan="4"><button class="view-detail" data-item-id="${invItem.itemId}" class="view-detail-btn">📖 查看图鉴详情</button></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    if (inventory.length === 0) html = '<div class="empty-msg" style="padding:1rem;">背包空空如也，点击上方“从图鉴添加”</div>' + html;

    body.innerHTML = html;

    // 绑定事件
    body.querySelectorAll('.qty-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            updateItemQuantity(currentInventoryTeamId, currentInventoryMemberId, idx, -1);
        });
    });
    body.querySelectorAll('.qty-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            updateItemQuantity(currentInventoryTeamId, currentInventoryMemberId, idx, 1);
        });
    });
    body.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(input.dataset.idx);
            let newVal = parseInt(input.value);
            if (isNaN(newVal)) newVal = 0;
            setItemQuantityDirect(currentInventoryTeamId, currentInventoryMemberId, idx, newVal);
        });
    });
    body.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            removeInventoryItem(currentInventoryTeamId, currentInventoryMemberId, idx);
        });
    });
    body.querySelectorAll('.view-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = btn.dataset.itemId;
            showItemDetailFromEncyclopedia(itemId);
        });
    });

    document.getElementById('addFromEncyBtn').onclick = () => openItemPicker(currentInventoryTeamId, currentInventoryMemberId);
    document.getElementById('exportInventoryBtn').onclick = () => exportMemberInventory(currentInventoryTeamId, currentInventoryMemberId);
    document.getElementById('importInventoryBtn').onclick = () => importMemberInventory(currentInventoryTeamId, currentInventoryMemberId);
}

// ========== 渲染队伍背包（只读汇总） ==========
function renderTeamInventoryModal(team) {
    const titleElem = document.getElementById('inventoryModalTitle');
    titleElem.innerText = `📦 队伍背包汇总 - ${team.name}`;

    const body = document.getElementById('inventoryModalBody');
    const allItems = getAllItemsFromEncyclopedia();
    const aggregate = new Map(); // key: itemId, value: { name, category, totalQty, description }

    team.members.forEach(member => {
        (member.inventory || []).forEach(invItem => {
            const itemInfo = allItems.find(i => i.id === invItem.itemId) || { name: invItem.itemName || '未知', category: invItem.category || '', description: invItem.description || '' };
            const key = invItem.itemId;
            if (aggregate.has(key)) {
                aggregate.get(key).totalQty += invItem.quantity;
            } else {
                aggregate.set(key, {
                    itemId: invItem.itemId,
                    name: itemInfo.name,
                    category: itemInfo.category,
                    description: itemInfo.description,
                    totalQty: invItem.quantity
                });
            }
        });
    });

    let html = `<table class="inventory-table"><thead><tr><th>物品名称</th><th>类别</th><th style="text-align:center">总数量</th></tr></thead><tbody>`;
    for (const [itemId, data] of aggregate.entries()) {
        html += `
            <tr>
                <td><strong>${escapeHtml(data.name)}</strong><br><small>${escapeHtml(data.description)}</small></td>
                <td>${escapeHtml(data.category)}</td>
                <td style="text-align:center">${data.totalQty}</td>
            </tr>
            <tr><td colspan="3"><button class="view-detail-team" data-item-id="${itemId}" class="view-detail-btn">📖 查看图鉴详情</button></td></tr>
        `;
    }
    html += `</tbody></table>`;
    if (aggregate.size === 0) html = '<div class="empty-msg">暂无任何队员拥有物品</div>';

    body.innerHTML = html;

    body.querySelectorAll('.view-detail-team').forEach(btn => {
        btn.addEventListener('click', () => {
            showItemDetailFromEncyclopedia(btn.dataset.itemId);
        });
    });
}

// ========== 物品数量修改 ==========
function updateItemQuantity(teamId, memberId, idx, delta) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member || idx >= member.inventory.length) return;
    const newQty = member.inventory[idx].quantity + delta;
    if (newQty <= 0) {
        member.inventory.splice(idx, 1);
    } else {
        member.inventory[idx].quantity = newQty;
    }
    saveAllTeams(teams);
    openMemberInventory(teamId, memberId);
}

function setItemQuantityDirect(teamId, memberId, idx, newQty) {
    if (newQty <= 0) {
        removeInventoryItem(teamId, memberId, idx);
        return;
    }
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member || idx >= member.inventory.length) return;
    member.inventory[idx].quantity = newQty;
    saveAllTeams(teams);
    openMemberInventory(teamId, memberId);
}

function removeInventoryItem(teamId, memberId, idx) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member || idx >= member.inventory.length) return;
    member.inventory.splice(idx, 1);
    saveAllTeams(teams);
    openMemberInventory(teamId, memberId);
}

// ========== 从图鉴选择物品添加 ==========
function openItemPicker(teamId, memberId) {
    currentPickerTeamId = teamId;
    currentPickerMemberId = memberId;
    const modal = document.getElementById('itemPickerModal');
    const searchInput = document.getElementById('pickerSearchInput');
    const listDiv = document.getElementById('pickerItemsList');

    function renderPickerItems(keyword = '') {
        let items = getAllItemsFromEncyclopedia();
        if (keyword) {
            items = items.filter(i => i.name.toLowerCase().includes(keyword.toLowerCase()));
        }
        listDiv.innerHTML = items.map(item => `
            <div class="picker-item" data-item-id="${item.id}" style="padding:8px; border-bottom:1px solid #e2edf7; cursor:pointer;">
                <strong>${escapeHtml(item.name)}</strong> <span style="color:#7f8c9a;">(${escapeHtml(item.category || '未分类')})</span><br>
                <small>${escapeHtml((item.description || '').substring(0, 60))}...</small>
            </div>
        `).join('');
        document.querySelectorAll('.picker-item').forEach(div => {
            div.addEventListener('click', () => {
                const itemId = div.dataset.itemId;
                addItemToInventory(teamId, memberId, itemId);
                modal.style.display = 'none';
            });
        });
    }

    renderPickerItems('');
    searchInput.oninput = (e) => renderPickerItems(e.target.value);
    modal.style.display = 'flex';
    document.getElementById('pickerCancelBtn').onclick = () => modal.style.display = 'none';
}

function addItemToInventory(teamId, memberId, itemId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member) return;
    const allItems = getAllItemsFromEncyclopedia();
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    const existing = member.inventory.find(i => i.itemId === itemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        member.inventory.push({
            itemId: item.id,
            itemName: item.name,
            category: item.category || '',
            description: item.description || '',
            quantity: 1
        });
    }
    saveAllTeams(teams);
    openMemberInventory(teamId, memberId);
}

// ========== 查看图鉴详情（弹窗） ==========
function showItemDetailFromEncyclopedia(itemId) {
    const items = getAllItemsFromEncyclopedia();
    const item = items.find(i => i.id === itemId);
    if (!item) {
        alert('未在图鉴中找到该物品的详细信息');
        return;
    }
    let extra = '';
    if (item.extraFields && item.extraFields.length) {
        extra = item.extraFields.map(f => `• ${f.fieldName}: ${f.fieldValue}`).join('\n');
    }
    alert(`【${item.name}】\n类别：${item.category || '无'}\n描述：${item.description}\n${extra ? '其他信息：\n' + extra : ''}`);
}

// ========== 导入导出队员背包 ==========
function exportMemberInventory(teamId, memberId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member) return;
    const exportData = {
        exportDate: new Date().toISOString(),
        memberName: member.roleName,
        playerName: member.playerName,
        inventory: member.inventory
    };
    downloadJson(exportData, `背包_${member.roleName}_${Date.now()}.json`);
}

function importMemberInventory(teamId, memberId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!imported.inventory || !Array.isArray(imported.inventory)) {
                    alert('无效的背包文件');
                    return;
                }
                const mode = confirm('点击“确定”合并导入，点击“取消”覆盖当前背包');
                const teams = getAllTeams();
                const team = teams.find(t => t.id === teamId);
                const member = team?.members.find(m => m.id === memberId);
                if (!member) return;
                if (mode) {
                    // 合并：按 itemId 合并数量
                    imported.inventory.forEach(impItem => {
                        const existing = member.inventory.find(i => i.itemId === impItem.itemId);
                        if (existing) {
                            existing.quantity += impItem.quantity;
                        } else {
                            member.inventory.push(impItem);
                        }
                    });
                } else {
                    member.inventory = imported.inventory;
                }
                saveAllTeams(teams);
                openMemberInventory(teamId, memberId);
                alert('导入成功');
            } catch (err) {
                alert('解析失败');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ========== 队伍管理原有渲染函数（增加背包按钮） ==========
function renderTeams() {
    const container = document.getElementById('teamsContainer');
    const teams = getAllTeams();
    if (!teams.length) {
        container.innerHTML = '<div class="empty-msg">📭 暂无队伍，点击“新建队伍”开始创建你的冒险团队~</div>';
        return;
    }

    container.innerHTML = teams.map(team => `
        <div class="team-card" data-team-id="${team.id}">
            <div class="team-header">
                <span class="team-name">👥 ${escapeHtml(team.name)}</span>
                <div class="team-actions">
                    <button class="btn-icon edit-team-name" data-id="${team.id}" title="重命名队伍">✏️</button>
                    <button class="btn-icon delete-team" data-id="${team.id}" title="删除队伍">🗑️</button>
                </div>
            </div>
            <div class="member-list">
                ${team.members.length === 0 ? '<div class="empty-msg" style="padding:0.5rem 0;">暂无队员，点击下方按钮添加</div>' : ''}
                ${team.members.map(member => `
                    <div class="member-item" data-member-id="${member.id}">
                        <div class="member-header">
                            <div>
                                <span class="member-role">🎭 ${escapeHtml(member.roleName)}</span>
                                <span class="member-player">（${escapeHtml(member.playerName)}）</span>
                            </div>
                            <div>
                                <button class="btn-icon edit-member" data-team-id="${team.id}" data-member-id="${member.id}" title="编辑队员">✏️</button>
                                <button class="btn-icon delete-member" data-team-id="${team.id}" data-member-id="${member.id}" title="删除队员">🗑️</button>
                                <button class="btn-icon inventory-btn" data-team-id="${team.id}" data-member-id="${member.id}" title="背包">🎒</button>
                            </div>
                        </div>
                        <div class="blessing">
                            <div class="blessing-toggle" data-team-id="${team.id}" data-member-id="${member.id}">
                                📜 祝福 <span class="toggle-icon">▼</span>
                            </div>
                            <div class="blessing-content" id="blessing-${team.id}-${member.id}">
                                ${escapeHtml(member.blessing).replace(/\n/g, '<br>') || '（无）'}
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <div class="add-member-form">
                    <h4 style="font-size:0.9rem; margin-bottom:0.5rem;">➕ 添加新队员</h4>
                    <div class="inline-form">
                        <input type="text" class="member-player-name" placeholder="玩家名" autocomplete="off">
                        <input type="text" class="member-role-name" placeholder="角色名" autocomplete="off">
                        <textarea class="member-blessing" rows="2" placeholder="祝福（支持多行）"></textarea>
                        <button class="btn-add-member" data-team-id="${team.id}">添加</button>
                    </div>
                </div>
            </div>
            <div style="padding: 0.5rem 1.5rem 1rem; text-align: right;">
                <button class="team-inventory-btn" data-team-id="${team.id}">📦 队伍背包（汇总）</button>
            </div>
        </div>
    `).join('');

    // 绑定事件
    document.querySelectorAll('.edit-team-name').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editTeamName(btn.getAttribute('data-id'));
        });
    });
    document.querySelectorAll('.delete-team').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定要删除整个队伍吗？队伍下的所有文档将变为“未归档队伍”的文档？')) {
                deleteTeam(btn.getAttribute('data-id'));
            }
        });
    });
    document.querySelectorAll('.edit-member').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editMember(btn.getAttribute('data-team-id'), btn.getAttribute('data-member-id'));
        });
    });
    document.querySelectorAll('.delete-member').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定要删除该队员吗？')) {
                deleteMember(btn.getAttribute('data-team-id'), btn.getAttribute('data-member-id'));
            }
        });
    });
    document.querySelectorAll('.btn-add-member').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const teamId = btn.getAttribute('data-team-id');
            const formDiv = btn.closest('.add-member-form');
            const playerName = formDiv.querySelector('.member-player-name').value.trim();
            const roleName = formDiv.querySelector('.member-role-name').value.trim();
            const blessing = formDiv.querySelector('.member-blessing').value;
            if (!playerName || !roleName) {
                alert('玩家名和角色名不能为空');
                return;
            }
            addMemberToTeam(teamId, playerName, roleName, blessing);
            formDiv.querySelector('.member-player-name').value = '';
            formDiv.querySelector('.member-role-name').value = '';
            formDiv.querySelector('.member-blessing').value = '';
        });
    });
    document.querySelectorAll('.blessing-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const teamId = toggle.getAttribute('data-team-id');
            const memberId = toggle.getAttribute('data-member-id');
            const contentDiv = document.getElementById(`blessing-${teamId}-${memberId}`);
            if (contentDiv) {
                contentDiv.classList.toggle('expanded');
                const icon = toggle.querySelector('.toggle-icon');
                if (icon) icon.textContent = contentDiv.classList.contains('expanded') ? '▲' : '▼';
            }
        });
    });
    // 队员背包按钮
    document.querySelectorAll('.inventory-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openMemberInventory(btn.getAttribute('data-team-id'), btn.getAttribute('data-member-id'));
        });
    });
    // 队伍背包按钮
    document.querySelectorAll('.team-inventory-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTeamInventory(btn.getAttribute('data-team-id'));
        });
    });
}

// ========== 队伍管理原有函数 ==========
function addMemberToTeam(teamId, playerName, roleName, blessing) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newMember = {
        id: generateId(),
        playerName: playerName,
        roleName: roleName,
        blessing: blessing || '',
        inventory: []
    };
    team.members.push(newMember);
    saveAllTeams(teams);
    renderTeams();
    if (window.updateDocsList) window.updateDocsList();
}

function editTeamName(teamId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newName = prompt('请输入新队伍名称', team.name);
    if (newName && newName.trim()) {
        team.name = newName.trim();
        saveAllTeams(teams);
        renderTeams();
        if (window.updateDocsList) window.updateDocsList();
    }
}

function deleteTeam(teamId) {
    let teams = getAllTeams();
    const teamToDelete = teams.find(t => t.id === teamId);
    if (!teamToDelete) return;

    const docsKey = 'adventure_logs_docs';
    const storedDocs = localStorage.getItem(docsKey);
    let docs = storedDocs ? JSON.parse(storedDocs) : [];
    let defaultTeam = teams.find(t => t.name === '未归档队伍');
    let defaultTeamId;
    if (!defaultTeam) {
        defaultTeam = createEmptyTeam('未归档队伍');
        teams.push(defaultTeam);
        defaultTeamId = defaultTeam.id;
    } else {
        defaultTeamId = defaultTeam.id;
    }
    docs.forEach(doc => {
        if (doc.teamId === teamId) doc.teamId = defaultTeamId;
    });
    localStorage.setItem(docsKey, JSON.stringify(docs));

    teams = teams.filter(t => t.id !== teamId);
    saveAllTeams(teams);
    renderTeams();
    if (window.updateDocsList) window.updateDocsList();
}

function editMember(teamId, memberId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const member = team.members.find(m => m.id === memberId);
    if (!member) return;
    const newPlayerName = prompt('编辑玩家名', member.playerName);
    if (newPlayerName === null) return;
    const newRoleName = prompt('编辑角色名', member.roleName);
    if (newRoleName === null) return;
    const newBlessing = prompt('编辑祝福（支持多行）', member.blessing);
    if (newBlessing === null) return;
    member.playerName = newPlayerName.trim() || member.playerName;
    member.roleName = newRoleName.trim() || member.roleName;
    member.blessing = newBlessing.trim();
    saveAllTeams(teams);
    renderTeams();
    if (window.updateDocsList) window.updateDocsList();
}

function deleteMember(teamId, memberId) {
    const teams = getAllTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    team.members = team.members.filter(m => m.id !== memberId);
    saveAllTeams(teams);
    renderTeams();
    if (window.updateDocsList) window.updateDocsList();
}

function exportTeams() {
    const teams = getAllTeams();
    if (!teams.length) {
        alert('没有队伍数据可导出');
        return;
    }
    const exportData = { exportDate: new Date().toISOString(), teams: teams };
    downloadJson(exportData, `teams_export_${Date.now()}.json`);
}

function importTeams(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.teams || !Array.isArray(imported.teams)) {
                alert('无效的队伍数据文件，缺少 teams 字段');
                return;
            }
            const validTeams = imported.teams.filter(t => t.id && t.name && Array.isArray(t.members));
            if (validTeams.length === 0) {
                alert('没有有效的队伍数据');
                return;
            }
            saveAllTeams(validTeams);
            renderTeams();
            if (window.updateDocsList) window.updateDocsList();
            alert(`成功导入 ${validTeams.length} 个队伍`);
        } catch (err) {
            alert('解析JSON失败，请确保文件格式正确。');
        }
    };
    reader.readAsText(file);
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    migrateAddInventoryToMembers();
    let teams = getAllTeams();
    if (!teams.length) {
        const defaultTeam = createEmptyTeam('未归档队伍');
        teams.push(defaultTeam);
        saveAllTeams(teams);
    }
    renderTeams();

    document.getElementById('backToHomeBtn').addEventListener('click', () => {
        window.location.href = '../index.html';
    });
    document.getElementById('addTeamBtn').addEventListener('click', () => {
        const newTeam = createEmptyTeam(`队伍_${new Date().toLocaleDateString()}`);
        const teams = getAllTeams();
        teams.push(newTeam);
        saveAllTeams(teams);
        renderTeams();
        if (window.updateDocsList) window.updateDocsList();
    });
    document.getElementById('exportTeamBtn').addEventListener('click', exportTeams);

    const importBtn = document.getElementById('importTeamBtn');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files && fileInput.files[0]) importTeams(fileInput.files[0]);
        fileInput.value = '';
    });

    // 关闭背包模态框
    document.getElementById('inventoryModalClose').addEventListener('click', () => {
        document.getElementById('inventoryModal').style.display = 'none';
    });
    document.getElementById('itemPickerModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('itemPickerModal')) {
            document.getElementById('itemPickerModal').style.display = 'none';
        }
    });
});

window.updateDocsList = renderTeams;