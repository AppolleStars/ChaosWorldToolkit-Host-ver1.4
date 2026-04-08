// item_encyclopedia.js - 物品图鉴核心逻辑（含类别字段）
const ITEM_STORAGE_KEY = 'item_encyclopedia_data';

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

function createEmptyItem(name = '') {
    return {
        id: generateId(),
        name: name.trim() || '未命名物品',
        category: '',
        description: '',
        extraFields: []
    };
}

function getAllItems() {
    const stored = localStorage.getItem(ITEM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveAllItems(items) {
    localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(items));
}

function saveItem(item) {
    let items = getAllItems();
    const existingIndex = items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) items[existingIndex] = item;
    else items.push(item);
    saveAllItems(items);
    return item;
}

function deleteItemById(id) {
    let items = getAllItems();
    items = items.filter(i => i.id !== id);
    saveAllItems(items);
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

function formatWithBreaks(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// 渲染列表
let currentFilterKeyword = '';
function renderItems() {
    const container = document.getElementById('itemsGridContainer');
    let items = getAllItems();
    const keyword = currentFilterKeyword.trim().toLowerCase();
    if (keyword) items = items.filter(item => item.name.toLowerCase().includes(keyword));
    if (!items.length) {
        container.innerHTML = `<div class="empty-ency">📭 没有找到物品，试试添加新物品或清空搜索~</div>`;
        return;
    }
    container.innerHTML = items.map(item => {
        const extraHtml = item.extraFields?.length ? `
            <div class="extra-fields">
                ${item.extraFields.map(ef => `
                    <div class="extra-item">
                        <span class="extra-key">📎 ${escapeHtml(ef.fieldName)}：</span>
                        <span class="extra-value">${formatWithBreaks(ef.fieldValue)}</span>
                    </div>
                `).join('')}
            </div>` : '';
        return `
            <div class="item-card" data-item-id="${item.id}">
                <div class="item-name">📦 ${escapeHtml(item.name)}</div>
                <div class="item-category" style="font-size:0.75rem; color:#7f8c9a; margin-bottom:0.3rem;">🏷️ ${escapeHtml(item.category) || '未分类'}</div>
                <div class="item-desc">📖 ${formatWithBreaks(item.description) || '<em style="color:#9aaebf;">暂无描述</em>'}</div>
                ${extraHtml}
                <div class="item-actions">
                    <button class="edit-item" data-id="${item.id}">✏️ 编辑</button>
                    <button class="delete-item" data-id="${item.id}">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.edit-item').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
    });
    document.querySelectorAll('.delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('确定删除该物品？')) {
                deleteItemById(btn.getAttribute('data-id'));
                renderItems();
            }
        });
    });
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.addEventListener('input', (e) => { currentFilterKeyword = e.target.value; renderItems(); });
    if (clearBtn) clearBtn.addEventListener('click', () => { if(searchInput) searchInput.value = ''; currentFilterKeyword = ''; renderItems(); });
}

// 模态框动态字段
let currentEditingItem = null;
let dynamicFields = [];

function renderDynamicFieldsUI() {
    const container = document.getElementById('extraFieldsContainer');
    if (!container) return;
    if (dynamicFields.length === 0) {
        container.innerHTML = '<div style="color:#9aaebf; padding:0.5rem;">暂无自定义文本项，点击下方按钮添加</div>';
        return;
    }
    container.innerHTML = dynamicFields.map((field, idx) => `
        <div class="dynamic-item" data-field-index="${idx}">
            <input type="text" class="dynamic-field-name" placeholder="字段名" value="${escapeHtml(field.fieldName)}">
            <textarea class="dynamic-field-value" rows="2" placeholder="文本内容">${escapeHtml(field.fieldValue)}</textarea>
            <button type="button" class="remove-field-btn" data-idx="${idx}">✖ 删除</button>
        </div>
    `).join('');
    document.querySelectorAll('.remove-field-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            dynamicFields.splice(idx, 1);
            renderDynamicFieldsUI();
        });
    });
    document.querySelectorAll('.dynamic-field-name').forEach((input, idx) => {
        input.addEventListener('input', (e) => { if(dynamicFields[idx]) dynamicFields[idx].fieldName = e.target.value; });
    });
    document.querySelectorAll('.dynamic-field-value').forEach((textarea, idx) => {
        textarea.addEventListener('input', (e) => { if(dynamicFields[idx]) dynamicFields[idx].fieldValue = e.target.value; });
    });
}

function openAddModal() {
    currentEditingItem = null;
    document.getElementById('modalTitle').innerText = '✨ 新增物品';
    document.getElementById('itemNameInput').value = '';
    document.getElementById('itemCategoryInput').value = '';
    document.getElementById('itemDescInput').value = '';
    dynamicFields = [];
    renderDynamicFieldsUI();
    document.getElementById('itemModal').style.display = 'flex';
}

function openEditModal(id) {
    const items = getAllItems();
    const item = items.find(i => i.id === id);
    if (!item) return;
    currentEditingItem = item;
    document.getElementById('modalTitle').innerText = '✏️ 编辑物品';
    document.getElementById('itemNameInput').value = item.name;
    document.getElementById('itemCategoryInput').value = item.category || '';
    document.getElementById('itemDescInput').value = item.description || '';
    dynamicFields = item.extraFields ? [...item.extraFields] : [];
    renderDynamicFieldsUI();
    document.getElementById('itemModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    currentEditingItem = null;
}

function collectFormItem() {
    const name = document.getElementById('itemNameInput').value.trim();
    if (!name) { alert('物品名称不能为空'); return null; }
    const category = document.getElementById('itemCategoryInput').value.trim();
    const description = document.getElementById('itemDescInput').value;
    const cleanedExtra = dynamicFields.filter(f => f.fieldName && f.fieldName.trim() !== '');
    const extraFields = cleanedExtra.map(f => ({ fieldName: f.fieldName.trim(), fieldValue: f.fieldValue || '' }));
    return { name, category, description, extraFields };
}

function saveFromModal() {
    const formData = collectFormItem();
    if (!formData) return;
    let items = getAllItems();
    const conflictItem = items.find(i => i.name === formData.name && (currentEditingItem ? i.id !== currentEditingItem.id : true));
    if (conflictItem) {
        if (!confirm(`物品“${formData.name}”已存在，是否覆盖？\n确定覆盖 / 取消放弃`)) return;
        items = items.filter(i => i.id !== conflictItem.id);
        saveAllItems(items);
    }
    if (currentEditingItem) {
        currentEditingItem.name = formData.name;
        currentEditingItem.category = formData.category;
        currentEditingItem.description = formData.description;
        currentEditingItem.extraFields = formData.extraFields;
        saveItem(currentEditingItem);
    } else {
        const newItem = createEmptyItem(formData.name);
        newItem.category = formData.category;
        newItem.description = formData.description;
        newItem.extraFields = formData.extraFields;
        saveItem(newItem);
    }
    closeModal();
    renderItems();
}

// 导入导出
function exportItemsToJson() {
    const items = getAllItems();
    if (!items.length) { alert('没有物品可导出'); return; }
    downloadJson({ exportDate: new Date().toISOString(), items: items }, `物品图鉴_${Date.now()}.json`);
}

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function resolveConflictSync(itemName, existingNamesSet) {
    const overwrite = confirm(`物品“${itemName}”已存在，是否覆盖？\n确定 → 覆盖 / 取消 → 跳过`);
    if (overwrite) return { action: 'overwrite' };
    const rename = confirm(`跳过导入？点“确定”跳过，点“取消”重命名导入`);
    if (!rename) {
        let newName = prompt(`请输入新名称`, itemName + "(复本)");
        if (newName && newName.trim()) {
            newName = newName.trim();
            if (existingNamesSet.has(newName)) { alert(`名称冲突，跳过`); return { action: 'skip' }; }
            return { action: 'rename', newName: newName };
        }
    }
    return { action: 'skip' };
}

function importItemsFromJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            let itemsToImport = imported.items && Array.isArray(imported.items) ? imported.items : (Array.isArray(imported) ? imported : null);
            if (!itemsToImport) throw new Error();
            let currentItems = getAllItems();
            let existingNames = new Set(currentItems.map(i => i.name));
            let importedCount = 0, overwrittenCount = 0, skippedCount = 0;
            for (const raw of itemsToImport) {
                if (!raw.name) continue;
                let targetName = raw.name.trim();
                if (!targetName) continue;
                const newItem = {
                    id: generateId(),
                    name: targetName,
                    category: raw.category || '',
                    description: raw.description || '',
                    extraFields: Array.isArray(raw.extraFields) ? raw.extraFields.filter(ef => ef.fieldName).map(ef => ({ fieldName: ef.fieldName, fieldValue: ef.fieldValue || '' })) : []
                };
                if (existingNames.has(targetName)) {
                    const resolution = resolveConflictSync(targetName, existingNames);
                    if (resolution.action === 'overwrite') {
                        currentItems = currentItems.filter(i => i.name !== targetName);
                        currentItems.push(newItem);
                        existingNames.delete(targetName);
                        existingNames.add(targetName);
                        overwrittenCount++;
                        importedCount++;
                    } else if (resolution.action === 'rename') {
                        newItem.name = resolution.newName;
                        currentItems.push(newItem);
                        existingNames.add(resolution.newName);
                        importedCount++;
                    } else skippedCount++;
                } else {
                    currentItems.push(newItem);
                    existingNames.add(targetName);
                    importedCount++;
                }
            }
            saveAllItems(currentItems);
            renderItems();
            alert(`导入完成\n成功：${importedCount} 件（覆盖${overwrittenCount}）\n跳过：${skippedCount} 件`);
        } catch(err) { alert('解析JSON失败'); }
    };
    reader.readAsText(file);
}

// 数据迁移：为旧物品添加category字段
function migrateAddCategoryField() {
    let items = getAllItems();
    let modified = false;
    items.forEach(item => {
        if (item.category === undefined) {
            item.category = '';
            modified = true;
        }
    });
    if (modified) saveAllItems(items);
}

function initDefaultItems() {
    const items = getAllItems();
    if (items.length === 0) {
        const defaultItems = [
            { id: generateId(), name: '精灵尘', category: '材料', description: '月光下闪烁的微尘，可缓慢治愈。', extraFields: [{ fieldName: '稀有度', fieldValue: '普通' }] },
            { id: generateId(), name: '龙鳞护符', category: '饰品', description: '古代龙鳞制成的护符，抵御火焰。', extraFields: [{ fieldName: '效果', fieldValue: '火抗+15%' }] },
            { id: generateId(), name: '记忆水晶', category: '奇物', description: '储存一段往事的透明晶体。', extraFields: [] }
        ];
        saveAllItems(defaultItems);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    migrateAddCategoryField();
    initDefaultItems();
    renderItems();
    initSearch();

    document.getElementById('backToEncyBtn')?.addEventListener('click', () => { window.location.href = 'encyclopedia.html'; });
    document.getElementById('addItemBtn')?.addEventListener('click', openAddModal);
    document.getElementById('exportItemsBtn')?.addEventListener('click', exportItemsToJson);

    const importBtn = document.getElementById('importItemsBtn');
    if (importBtn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => { if(fileInput.files[0]) importItemsFromJson(fileInput.files[0]); fileInput.value = ''; });
    }

    const modal = document.getElementById('itemModal');
    document.getElementById('modalCancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalConfirmBtn')?.addEventListener('click', saveFromModal);
    document.getElementById('addExtraFieldBtn')?.addEventListener('click', () => { dynamicFields.push({ fieldName: '', fieldValue: '' }); renderDynamicFieldsUI(); });
    modal?.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
});