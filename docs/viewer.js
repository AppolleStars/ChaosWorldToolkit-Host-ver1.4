// viewer.js - 只读浏览文档，不支持任何修改
const STORAGE_KEY = 'adventure_logs_docs';

let currentDoc = null;
let currentDocId = null;

// 获取URL参数
function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
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
    return true;
}

// 辅助函数：转义HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// 将换行符转换为<br>标签
function formatWithBreaks(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
}

// 渲染文档内容（只读模式）
function renderViewer() {
    if (!currentDoc) return;

    // 显示文档标题和统计信息
    const titleSpan = document.getElementById('docTitleDisplay');
    const statsSpan = document.getElementById('docStats');
    if (titleSpan) {
        titleSpan.textContent = escapeHtml(currentDoc.name);
    }
    const recordCount = currentDoc.records ? currentDoc.records.length : 0;
    if (statsSpan) {
        statsSpan.textContent = `📅 ${new Date(currentDoc.lastModified).toLocaleString()}  ·  📝 ${recordCount} 条记录`;
    }

    // 渲染记录列表
    const container = document.getElementById('recordsContainer');
    if (!currentDoc.records || currentDoc.records.length === 0) {
        container.innerHTML = '<div class="empty-msg-view">📭 暂无聊天记录，去编辑页面添加吧~</div>';
        return;
    }

    container.innerHTML = currentDoc.records.map((record, idx) => {
        // 显示反馈（如果有）
        const hasFeedback = record.feedback && record.feedback.trim() !== '';
        const feedbackHtml = hasFeedback
            ? `<div class="feedback-text-view"><strong>🎭 主持人反馈：</strong> ${formatWithBreaks(record.feedback)}</div>`
            : '';

        return `
            <div class="record-item-view" data-record-index="${idx}">
                <div class="record-header-view">
                    <span class="sender-badge-view">📢 ${escapeHtml(record.sender) || '匿名角色'}</span>
                    <span class="record-index">#${idx + 1}</span>
                </div>
                <div class="record-content-view">
                    <p><strong>💬 内容：</strong> ${formatWithBreaks(record.content) || '<span style="color:#aaa;">(无内容)</span>'}</p>
                    ${feedbackHtml}
                </div>
            </div>
        `;
    }).join('');
}

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    if (!loadDocument()) return;
    renderViewer();

    // 返回文档库按钮
    const backToDocsBtn = document.getElementById('backToDocsBtn');
    if (backToDocsBtn) {
        backToDocsBtn.addEventListener('click', () => {
            window.location.href = 'docs.html';
        });
    }

    // 返回主界面按钮
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});