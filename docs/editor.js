// editor.js - 单文档编辑，支持队伍选择与发言者智能补全，支持行内编辑记录
const STORAGE_KEY = 'adventure_logs_docs';
const TEAMS_STORAGE_KEY = 'teams_data';

let currentDoc = null;
let currentDocId = null;
let currentTeamId = null;

// 获取URL参数
function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// 获取所有队伍
function getAllTeams() {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// 加载文档
function loadDocument() {
    const id = getUrlParam('id');
    if (!id) {
        alert('无效的文档ID，返回文档库');
        window.location.href = 'docs.html';
        return false;
    }
    const docs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const doc = docs.find(d => d.id === id);
    if (!doc) {
        alert('文档不存在，可能已被删除');
        window.location.href = 'docs.html';
        return false;
    }
    currentDoc = doc;
    currentDocId = id;
    currentTeamId = doc.teamId || null;
    return true;
}

// 渲染队伍下拉框
function renderTeamSelector() {
    const select = document.getElementById('teamSelect');
    if (!select) return;
    const teams = getAllTeams();
    let options = '<option value="">— 无队伍 —</option>';
    teams.forEach(team => {
        options += `<option value="${team.id}" ${currentTeamId === team.id ? 'selected' : ''}>${escapeHtml(team.name)}</option>`;
    });
    select.innerHTML = options;
    select.addEventListener('change', () => {
        const newTeamId = select.value === '' ? null : select.value;
        if (newTeamId !== currentTeamId) {
            currentTeamId = newTeamId;
            currentDoc.teamId = currentTeamId;
            updateLastModified();
            updateSenderSuggestions();
        }
    });
}

// 更新发言者建议列表（根据当前文档所属队伍）
function updateSenderSuggestions() {
    const datalist = document.getElementById('senderSuggestions');
    if (!datalist) return;
    let suggestions = ['主持人'];
    if (currentTeamId) {
        const teams = getAllTeams();
        const team = teams.find(t => t.id === currentTeamId);
        if (team && team.members) {
            team.members.forEach(member => {
                if (member.roleName) suggestions.push(member.roleName);
            });
        }
    }
    suggestions = [...new Set(suggestions)];
    datalist.innerHTML = suggestions.map(s => `<option value="${escapeHtml(s)}">`).join('');
}

// 辅助函数：转义HTML并将换行符转换为<br>
function formatWithBreaks(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
}

// 进入行内编辑模式
function enterEditMode(recordIndex) {
    const record = currentDoc.records[recordIndex];
    if (!record) return;

    const container = document.getElementById('recordsContainer');
    const recordDiv = container.querySelector(`.record-item[data-record-index="${recordIndex}"]`);
    if (!recordDiv) return;

    const editFormHtml = `
        <div class="edit-record-form" data-record-index="${recordIndex}">
            <div class="form-group" style="margin-bottom: 0.8rem;">
                <input type="text" id="edit-sender-${recordIndex}" class="edit-sender" placeholder="发言者" value="${escapeHtml(record.sender)}" list="senderSuggestions">
            </div>
            <div class="form-group" style="margin-bottom: 0.8rem;">
                <textarea id="edit-content-${recordIndex}" class="edit-content" rows="2" placeholder="信息内容 ...">${escapeHtml(record.content)}</textarea>
            </div>
            <div class="form-group" style="margin-bottom: 0.8rem;">
                <textarea id="edit-feedback-${recordIndex}" class="edit-feedback" rows="2" placeholder="主持人如是说">${escapeHtml(record.feedback)}</textarea>
            </div>
            <div class="edit-actions">
                <button class="save-edit-btn" data-index="${recordIndex}">💾 保存</button>
                <button class="cancel-edit-btn" data-index="${recordIndex}">❌ 取消</button>
            </div>
        </div>
    `;
    recordDiv.innerHTML = editFormHtml;

    const saveBtn = recordDiv.querySelector('.save-edit-btn');
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newSender = recordDiv.querySelector(`#edit-sender-${recordIndex}`).value;
        const newContent = recordDiv.querySelector(`#edit-content-${recordIndex}`).value;
        const newFeedback = recordDiv.querySelector(`#edit-feedback-${recordIndex}`).value;
        currentDoc.records[recordIndex] = {
            sender: newSender.trim() || '未知角色',
            content: newContent.trim() || '(无内容)',
            feedback: newFeedback.trim() || ''
        };
        updateLastModified();
        renderEditor();
    });

    const cancelBtn = recordDiv.querySelector('.cancel-edit-btn');
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderEditor();
    });
}

// 渲染界面
function renderEditor() {
    if (!currentDoc) return;

    const nameInput = document.getElementById('docNameInput');
    nameInput.value = currentDoc.name;

    const container = document.getElementById('recordsContainer');
    if (!currentDoc.records || currentDoc.records.length === 0) {
        container.innerHTML = '<div class="empty-msg">✨ 暂无记录，使用上方表单添加你的第一段对话~</div>';
        return;
    }

    container.innerHTML = currentDoc.records.map((record, idx) => {
        const isHost = record.sender && record.sender.trim() === '主持人';
        const feedbackHtml = isHost ? '' : `<div class="feedback-text"><strong>🎭 主持人反馈：</strong> ${formatWithBreaks(record.feedback) || '（无）'}</div>`;
        return `
            <div class="record-item" data-record-index="${idx}">
                <div class="record-header">
                    <span class="sender-badge">📢 ${escapeHtml(record.sender) || '匿名'}</span>
                    <div class="record-actions">
                        <button class="edit-record" data-index="${idx}">✏️ 编辑</button>
                        <button class="delete-record" data-index="${idx}">🗑️ 删除</button>
                    </div>
                </div>
                <div class="record-content">
                    <p><strong>💬 内容：</strong> ${formatWithBreaks(record.content) || '—'}</p>
                    ${feedbackHtml}
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-record').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.getAttribute('data-index'));
            enterEditMode(index);
        });
    });
    document.querySelectorAll('.delete-record').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.getAttribute('data-index'));
            if (confirm('删除这条记录吗？')) {
                currentDoc.records.splice(index, 1);
                updateLastModified();
                renderEditor();
            }
        });
    });
}

// 添加新记录
function addRecord(sender, content, feedback) {
    if (!sender.trim() && !content.trim()) {
        alert('请至少填写发出者或内容');
        return false;
    }
    const newRecord = {
        sender: sender.trim() || '未知角色',
        content: content.trim() || '(无内容)',
        feedback: feedback.trim() || ''
    };
    currentDoc.records.push(newRecord);
    updateLastModified();
    renderEditor();
    document.getElementById('senderInput').value = '';
    document.getElementById('contentInput').value = '';
    document.getElementById('feedbackInput').value = '';
    return true;
}

// 更新最后修改时间 + 保存到 localStorage
function updateLastModified() {
    currentDoc.lastModified = new Date().toISOString();
    saveCurrentDoc();
}

function saveCurrentDoc() {
    const allDocs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = allDocs.findIndex(d => d.id === currentDocId);
    if (index !== -1) {
        allDocs[index] = currentDoc;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allDocs));
    } else {
        allDocs.push(currentDoc);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allDocs));
    }
}

// 手动保存按钮
function saveDocAndName() {
    const newName = document.getElementById('docNameInput').value.trim();
    if (newName) {
        currentDoc.name = newName;
    } else {
        currentDoc.name = '未命名文档';
    }
    updateLastModified();
    alert('✅ 文档已保存');
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

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    if (!loadDocument()) return;
    renderTeamSelector();
    renderEditor();
    updateSenderSuggestions();

    document.getElementById('saveDocBtn')?.addEventListener('click', saveDocAndName);
    document.getElementById('backToListBtn')?.addEventListener('click', () => {
        if (confirm('返回前是否保存？未保存的修改将丢失。')) {
            const shouldSave = confirm('是否保存当前文档？');
            if (shouldSave) saveDocAndName();
        }
        window.location.href = 'docs.html';
    });

    document.getElementById('addRecordBtn')?.addEventListener('click', () => {
        const sender = document.getElementById('senderInput').value;
        const content = document.getElementById('contentInput').value;
        const feedback = document.getElementById('feedbackInput').value;
        addRecord(sender, content, feedback);
    });

    document.getElementById('teamSelect')?.addEventListener('change', updateSenderSuggestions);

    // 新增：返回顶部按钮逻辑
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});