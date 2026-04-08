// docs.js - 管理所有文档，与 localStorage 交互，支持队伍分组
const STORAGE_KEY = 'adventure_logs_docs';
const TEAMS_STORAGE_KEY = 'teams_data';

function getAllDocs() {
    const stored = localStorage.getItem(STORAGE_KEY);
    let docs = stored ? JSON.parse(stored) : [];
    docs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    return docs;
}

function saveAllDocs(docs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function getAllTeams() {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

function createEmptyDocument(name = '未命名冒险', teamId = null) {
    return {
        id: generateId(),
        name: name,
        teamId: teamId,
        lastModified: new Date().toISOString(),
        records: []
    };
}

function renderDocList() {
    const container = document.getElementById('docsListContainer');
    const docs = getAllDocs();
    const teams = getAllTeams();

    if (!docs.length) {
        container.innerHTML = '<div class="empty-msg">📭 暂无文档，点击“新建文档”开始记录冒险~</div>';
        return;
    }

    const teamMap = {};
    teams.forEach(team => { teamMap[team.id] = team.name; });
    const UNCATEGORIZED_TEAM_ID = '__uncategorized__';
    teamMap[UNCATEGORIZED_TEAM_ID] = '未归类文档';

    const grouped = {};
    docs.forEach(doc => {
        const tid = doc.teamId && teamMap[doc.teamId] ? doc.teamId : UNCATEGORIZED_TEAM_ID;
        if (!grouped[tid]) grouped[tid] = [];
        grouped[tid].push(doc);
    });

    let html = '';
    for (const [tid, teamDocs] of Object.entries(grouped)) {
        const teamName = teamMap[tid];
        teamDocs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        html += `
            <div class="team-group" data-team-id="${tid}">
                <div class="team-group-header">
                    <span>📁 ${escapeHtml(teamName)} (${teamDocs.length})</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="team-group-docs">
                    <div class="new-doc-for-team">
                        <button class="new-doc-in-team" data-team-id="${tid}">+ 新建文档到此队伍</button>
                    </div>
                    ${teamDocs.map(doc => `
                        <div class="doc-item" data-doc-id="${doc.id}">
                            <div class="doc-info">
                                <div class="doc-name">📄 ${escapeHtml(doc.name)}</div>
                                <div class="doc-meta">📅 最后编辑: ${new Date(doc.lastModified).toLocaleString()} &nbsp;| 📝 共 ${doc.records.length} 条记录</div>
                            </div>
                            <div class="doc-actions">
                                <button class="view-doc" title="浏览文档" data-id="${doc.id}">👁️ 浏览</button>
                                <button class="edit-doc" title="编辑文档" data-id="${doc.id}">✏️ 编辑</button>
                                <button class="export-doc" title="导出为JSON文件" data-id="${doc.id}">💾 导出</button>
                                <button class="delete-doc" title="删除文档" data-id="${doc.id}">🗑️ 删除</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    document.querySelectorAll('.team-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const groupDiv = header.closest('.team-group');
            const docsDiv = groupDiv.querySelector('.team-group-docs');
            docsDiv.classList.toggle('expanded');
            const icon = header.querySelector('.toggle-icon');
            if (icon) icon.textContent = docsDiv.classList.contains('expanded') ? '▲' : '▼';
        });
        const groupDiv = header.closest('.team-group');
        const docsDiv = groupDiv.querySelector('.team-group-docs');
        if (groupDiv === document.querySelector('.team-group')) {
            docsDiv.classList.add('expanded');
            header.querySelector('.toggle-icon').textContent = '▲';
        }
    });

    document.querySelectorAll('.new-doc-in-team').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const teamId = btn.getAttribute('data-team-id');
            const teamName = teamMap[teamId] || '未归类';
            const docName = prompt('请输入文档名称', `冒险记录_${new Date().toLocaleDateString()}`);
            if (docName) {
                const newDoc = createEmptyDocument(docName, teamId === '__uncategorized__' ? null : teamId);
                const docs = getAllDocs();
                docs.unshift(newDoc);
                saveAllDocs(docs);
                renderDocList();
                window.location.href = `editor.html?id=${newDoc.id}`;
            }
        });
    });

    document.querySelectorAll('.view-doc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            window.open(`viewer.html?id=${id}`, '_blank');
        });
    });
    document.querySelectorAll('.edit-doc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            window.open(`editor.html?id=${id}`, '_blank');
        });
    });
    document.querySelectorAll('.delete-doc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (confirm('确定要永久删除这个文档吗？')) {
                let docs = getAllDocs();
                docs = docs.filter(d => d.id !== id);
                saveAllDocs(docs);
                renderDocList();
            }
        });
    });
    document.querySelectorAll('.export-doc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const docs = getAllDocs();
            const doc = docs.find(d => d.id === id);
            if (doc) {
                downloadJson(doc, `${doc.name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
            }
        });
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

function importDocFromJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.name || !imported.records || !Array.isArray(imported.records)) {
                alert('无效的文档格式，需要包含 name, records 字段');
                return;
            }
            const docs = getAllDocs();
            const newDoc = {
                id: generateId(),
                name: imported.name + (docs.some(d => d.name === imported.name) ? ' (导入)' : ''),
                teamId: imported.teamId || null,
                lastModified: new Date().toISOString(),
                records: imported.records.map(r => ({
                    sender: r.sender || '',
                    content: r.content || '',
                    feedback: r.feedback || ''
                }))
            };
            docs.unshift(newDoc);
            saveAllDocs(docs);
            renderDocList();
            alert(`✅ 成功导入文档：“${newDoc.name}”`);
        } catch (err) {
            alert('解析JSON失败，请确保文件格式正确。');
        }
    };
    reader.readAsText(file);
}

function exportAllDocs() {
    const docs = getAllDocs();
    if (!docs.length) {
        alert('没有可导出的文档');
        return;
    }
    const exportData = {
        exportDate: new Date().toISOString(),
        documents: docs
    };
    downloadJson(exportData, `all_adventure_docs_${Date.now()}.json`);
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

function migrateOldDocs() {
    const docs = getAllDocs();
    let modified = false;
    docs.forEach(doc => {
        if (doc.teamId === undefined) {
            doc.teamId = null;
            modified = true;
        }
    });
    if (modified) {
        saveAllDocs(docs);
        console.log('已为旧文档添加 teamId 字段');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    migrateOldDocs();
    renderDocList();

    document.getElementById('backHomeBtn')?.addEventListener('click', () => {
        window.location.href = '../index.html';  // 修改：返回根目录主界面
    });

    document.getElementById('createDocBtn')?.addEventListener('click', () => {
        const newDoc = createEmptyDocument(`冒险记录_${new Date().toLocaleDateString()}`, null);
        const docs = getAllDocs();
        docs.unshift(newDoc);
        saveAllDocs(docs);
        window.location.href = `editor.html?id=${newDoc.id}`;
    });

    const importBtn = document.getElementById('importDocBtn');
    if (importBtn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            if (fileInput.files && fileInput.files[0]) {
                importDocFromJson(fileInput.files[0]);
            }
            fileInput.value = '';
        });
    }

    document.getElementById('exportAllBtn')?.addEventListener('click', exportAllDocs);
});

window.updateDocsList = renderDocList;