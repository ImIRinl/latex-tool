'use strict';
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clone = (value) => JSON.parse(JSON.stringify(value));
let styles = [], formulas = [], variables = [], formulaId = '', activeId = '', undoStack = [], redoStack = [], quickStyle = {};
let numberContext = { section: 0, chapter: 0, continuous: 1, withinSection: 1, withinChapter: 1 };
let tree = row(text('E=mc^2'));

function uid() { return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
function text(value = '') { return { id: uid(), type: 'text', value }; }
function row(...children) { return { id: uid(), type: 'row', children }; }
function toast(message) { const node = $('toast'); node.textContent = message; node.hidden = false; setTimeout(() => { node.hidden = true; }, 1800); }
function tab(id) { document.querySelectorAll('.tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === id)); document.querySelectorAll('.pane').forEach((pane) => pane.classList.toggle('active', pane.id === id)); }
function style() { const base = styles.find((item) => item.id === $('formulaStyle').value) || styles[0] || { fontSize: 12, displayMode: 'numbered', numberMode: 'automatic', numberPosition: 'right', alignment: 'center' }; return { ...base, ...quickStyle }; }
function syncQuickStyle(value = style()) { $('quickDisplay').value = value.displayMode || 'numbered'; $('quickAlignment').value = value.alignment || 'center'; $('quickNumberPosition').value = value.numberPosition || 'right'; $('quickNumberMode').value = value.numberMode || 'automatic'; }
function snapshot() { undoStack.push(clone(tree)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; updateUndoButtons(); }
function updateUndoButtons() { $('undoFormula').disabled = !undoStack.length; $('redoFormula').disabled = !redoStack.length; }

function walk(node, callback, parent = null, key = null, index = null) {
  if (!node) return false;
  if (callback(node, parent, key, index)) return true;
  for (const [childIndex, child] of (node.children || []).entries()) if (walk(child, callback, node, 'children', childIndex)) return true;
  for (const [rowIndex, cells] of (node.rows || []).entries()) for (const [cellIndex, child] of cells.entries()) if (walk(child, callback, node, `rows:${rowIndex}`, cellIndex)) return true;
  return false;
}
function findNode(id) { let result; walk(tree, (node) => { if (node.id === id) { result = node; return true; } return false; }); return result; }
function replaceNode(id, replacement) {
  if (tree.id === id) { tree = replacement; return; }
  walk(tree, (node, parent, key, index) => {
    if (node.id !== id || !parent) return false;
    if (key === 'children') parent.children[index] = replacement;
    else parent.rows[Number(key.split(':')[1])][index] = replacement;
    return true;
  });
}
function firstTextId(node) { let id = ''; walk(node, (item) => { if (item.type === 'text') { id = item.id; return true; } return false; }); return id; }
function hasFormulaContent(node) { let found = false; walk(node, (item) => { if (item.type === 'text' && String(item.value || '').trim()) { found = true; return true; } return false; }); return found; }
function normalizeFormulaTree(node) {
  if (!node || typeof node !== 'object') return node;
  const normalized = { ...node };
  if (Array.isArray(node.children)) normalized.children = node.children.map(normalizeFormulaTree);
  if (Array.isArray(node.rows)) normalized.rows = node.rows.map((cells) => cells.map(normalizeFormulaTree));
  if ((normalized.type === 'sup' || normalized.type === 'sub') && normalized.children?.[1]?.type === 'cases') {
    return row(normalized.children[0], normalized.children[1]);
  }
  return normalized;
}

function makeStructure(type, current = text('')) {
  const old = current?.type === 'text' && current.value ? current : text('x');
  const structures = {
    fraction: () => ({ id: uid(), type: 'fraction', children: [old, text('b')] }),
    power: () => ({ id: uid(), type: 'sup', children: [old, text('2')] }),
    subscript: () => ({ id: uid(), type: 'sub', children: [old, text('i')] }),
    root: () => ({ id: uid(), type: 'sqrt', children: [old] }),
    sum: () => ({ id: uid(), type: 'sum', children: [text('i=1'), text('n'), old] }),
    product: () => ({ id: uid(), type: 'product', children: [text('i=1'), text('n'), old] }),
    integral: () => ({ id: uid(), type: 'integral', children: [text('a'), text('b'), old, text('x')] }),
    limit: () => ({ id: uid(), type: 'limit', children: [text('x'), text('0'), old] }),
    matrix: () => ({ id: uid(), type: 'matrix', rows: [[old, text('b')], [text('c'), text('d')]] }),
    cases: () => ({ id: uid(), type: 'cases', rows: [[text('2'), text('x>=0')], [text('-x'), text('x<0')]] })
  };
  return structures[type]?.() || old;
}
function insertStructure(type) {
  if (type === 'basic') { snapshot(); tree = row(text('')); activeId = tree.children[0].id; renderEditor(); return; }
  if (type === 'custom') { $('customArea').hidden = !$('customArea').hidden; $('customLatex').focus(); return; }
  const current = findNode(activeId) || tree.children?.find((item) => item.type === 'text') || text('');
  snapshot();
  const replacement = makeStructure(type, clone(current));
  if (type === 'cases' && hasFormulaContent(tree)) {
    tree = normalizeFormulaTree(tree);
    if (tree.type === 'row') tree.children.push(replacement);
    else tree = row(tree, replacement);
    activeId = firstTextId(replacement);
    toast('分段函数已添加到公式右侧');
    renderEditor();
    return;
  }
  replaceNode(current.id, replacement);
  activeId = firstTextId(replacement);
  renderEditor();
}

function mathValue(value) {
  return String(value ?? '').trim().replace(/[\r\n]+/g, ' ')
    .replace(/>=/g, '\\ge ').replace(/<=/g, '\\le ').replace(/!=/g, '\\ne ').replace(/->/g, '\\to ');
}
function treeLatex(node) {
  if (!node || typeof node !== 'object') return '';
  const child = (value) => treeLatex(value);
  const children = Array.isArray(node.children) ? node.children.map(child) : [];
  const value = mathValue(node.value);
  if (node.type === 'row') return children.join(' ');
  if (node.type === 'text') return value;
  if (node.type === 'fraction') return `\\frac{${children[0] || 'a'}}{${children[1] || 'b'}}`;
  if (node.type === 'sup') return `{${children[0] || 'x'}}^{${children[1] || '2'}}`;
  if (node.type === 'sub') return `{${children[0] || 'x'}}_{${children[1] || 'i'}}`;
  if (node.type === 'subsup') return `{${children[0] || 'x'}}_{${children[1] || 'i'}}^{${children[2] || '2'}}`;
  if (node.type === 'sqrt') return `\\sqrt{${children[0] || 'x'}}`;
  if (node.type === 'root') return `\\sqrt[${children[0] || 'n'}]{${children[1] || 'x'}}`;
  if (node.type === 'sum') return `\\sum_{${children[0] || 'i=1'}}^{${children[1] || 'n'}} ${children[2] || 'x_i'}`;
  if (node.type === 'product') return `\\prod_{${children[0] || 'i=1'}}^{${children[1] || 'n'}} ${children[2] || 'x_i'}`;
  if (node.type === 'integral') return `\\int_{${children[0] || 'a'}}^{${children[1] || 'b'}} ${children[2] || 'f(x)'}\\,\\mathrm{d}${children[3] || 'x'}`;
  if (node.type === 'limit') return `\\lim_{${children[0] || 'x'} \\to ${children[1] || '0'}} ${children[2] || 'f(x)'}`;
  if (node.type === 'matrix') return `\\begin{bmatrix}${(node.rows || []).map((cells) => cells.map(child).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
  if (node.type === 'cases') return `\\begin{cases}${(node.rows || []).map((cells) => `${child(cells[0])} & ${child(cells[1])}`).join(' \\\\ ')}\\end{cases}`;
  return value || children.join(' ');
}

function nodeHtml(node, editable = false) {
  if (!node) return '';
  const children = (node.children || []).map((child) => nodeHtml(child, editable));
  if (node.type === 'text') return editable
    ? `<span class="math-slot${node.id === activeId ? ' active' : ''}" contenteditable="true" spellcheck="false" data-node="${node.id}" data-placeholder="单击输入">${esc(node.value)}</span>`
    : `<span class="math-text">${esc(node.value || '□').replace(/\^([\w+-]+)/g, '<sup>$1</sup>').replace(/_([\w+-]+)/g, '<sub>$1</sub>')}</span>`;
  if (node.type === 'row') return `<span class="math-row">${children.join('<span class="math-gap"></span>')}</span>`;
  if (node.type === 'fraction') return `<span class="math-frac"><span>${children[0]}</span><span>${children[1]}</span></span>`;
  if (node.type === 'sup') return `<span>${children[0]}<sup>${children[1]}</sup></span>`;
  if (node.type === 'sub') return `<span>${children[0]}<sub>${children[1]}</sub></span>`;
  if (node.type === 'sqrt') return `<span class="math-root">√<span>${children[0]}</span></span>`;
  if (['sum', 'product'].includes(node.type)) return `<span class="math-large"><span class="limits"><sup>${children[1]}</sup><b>${node.type === 'sum' ? '∑' : '∏'}</b><sub>${children[0]}</sub></span>${children[2]}</span>`;
  if (node.type === 'integral') return `<span class="math-large"><span class="limits"><sup>${children[1]}</sup><b>∫</b><sub>${children[0]}</sub></span>${children[2]} d${children[3]}</span>`;
  if (node.type === 'limit') return `<span class="math-large"><span class="limits"><b>lim</b><sub>${children[0]}→${children[1]}</sub></span>${children[2]}</span>`;
  if (node.type === 'matrix') return `<span class="matrix-bracket">[</span><span class="math-matrix">${(node.rows || []).map((cells) => `<span>${cells.map((cell) => nodeHtml(cell, editable)).join('')}</span>`).join('')}</span><span class="matrix-bracket">]</span>`;
  if (node.type === 'cases') return `<span class="matrix-bracket">{</span><span class="math-matrix cases">${(node.rows || []).map((cells) => `<span>${nodeHtml(cells[0], editable)}<em>${nodeHtml(cells[1], editable)}</em></span>`).join('')}</span>`;
  return children.join('');
}
function renderEditor() {
  $('visualEditor').innerHTML = nodeHtml(tree, true);
  $('visualEditor').querySelectorAll('.math-slot').forEach((slot) => {
    slot.addEventListener('focus', () => { activeId = slot.dataset.node; $('visualEditor').querySelectorAll('.math-slot').forEach((item) => item.classList.toggle('active', item === slot)); });
    slot.addEventListener('beforeinput', () => { if (!slot.dataset.changed) { snapshot(); slot.dataset.changed = '1'; } });
    slot.addEventListener('input', () => { const node = findNode(slot.dataset.node); if (node) node.value = slot.textContent.replace(/\u200b/g, ''); preview(); });
    slot.addEventListener('blur', () => { delete slot.dataset.changed; });
  });
  const target = $('visualEditor').querySelector(`[data-node="${activeId}"]`);
  if (target) setTimeout(() => target.focus(), 0);
  preview(); updateUndoButtons();
}
function undo() { if (!undoStack.length) return; redoStack.push(clone(tree)); tree = undoStack.pop(); activeId = firstTextId(tree); renderEditor(); }
function redo() { if (!redoStack.length) return; undoStack.push(clone(tree)); tree = redoStack.pop(); activeId = firstTextId(tree); renderEditor(); }
function insertText(value) { let node = findNode(activeId); if (!node || node.type !== 'text') { activeId = firstTextId(tree); node = findNode(activeId); } if (!node) return; snapshot(); node.value += value; renderEditor(); }

function number(styleValue) {
  let value = $('manualNumber').value || '1-1';
  if (styleValue.numberMode !== 'manual') {
    if (styleValue.numberingScope === 'continuous') value = String(numberContext.continuous || 1);
    else if (styleValue.numberingScope === 'chapter') value = `${numberContext.chapter || 0}${styleValue.numberSeparator || '-'}${numberContext.withinChapter || 1}`;
    else value = `${numberContext.section || 0}${styleValue.numberSeparator || '-'}${numberContext.withinSection || 1}`;
  }
  return styleValue.numberFormat === 'brackets' ? `[${esc(value)}]` : styleValue.numberFormat === 'plain' ? esc(value) : styleValue.numberFormat === 'prefix' ? `式（${esc(value)}）` : `（${esc(value)}）`;
}
function preview() {
  const styleValue = style();
  let latex = treeLatex(normalizeFormulaTree(tree)) || 'x';
  if (styleValue.mathStyle === 'upright') latex = `\\mathrm{${latex}}`;
  if (styleValue.mathStyle === 'bold') latex = `\\boldsymbol{${latex}}`;
  let rendered = nodeHtml(tree, false);
  if (window.katex) {
    try { rendered = window.katex.renderToString(latex, { throwOnError: false, strict: 'ignore', displayMode: false }); } catch { /* 保留简化预览。 */ }
  }
  const math = `<span class="math" style="font-size:${Math.max(16, +styleValue.fontSize * 1.7)}px">${rendered}</span>`;
  const numbered = styleValue.displayMode === 'numbered' && styleValue.numberMode !== 'none';
  const numberedPreview = styleValue.numberPosition === 'left'
    ? `<span class="number">${number(styleValue)}</span><span class="preview-math">${math}</span>`
    : `<span class="preview-math">${math}</span><span class="number">${number(styleValue)}</span>`;
  $('formulaPreview').innerHTML = numbered ? `<div class="preview-numbered ${styleValue.numberPosition === 'left' ? 'number-left' : ''}">${numberedPreview}</div>` : math;
  $('formulaPreview').style.justifyItems = styleValue.alignment === 'left' ? 'start' : styleValue.alignment === 'right' ? 'end' : 'center';
  $('manualNumberField').hidden = !(numbered && styleValue.numberMode === 'manual');
  const zeroHeading = styleValue.numberMode === 'automatic' && ((styleValue.numberingScope === 'section' && !numberContext.section) || (styleValue.numberingScope === 'chapter' && !numberContext.chapter));
  $('previewDescription').textContent = styleValue.displayMode === 'inline' ? '行内公式' : numbered ? `公式${styleValue.alignment === 'center' ? '居中' : styleValue.alignment === 'left' ? '靠左' : '靠右'}，编号位于${styleValue.numberPosition === 'left' ? '左侧' : '右侧'}${zeroHeading ? '；当前光标位于标题之前，因此编号以 0 开头' : ''}` : '公式单独成行';
}
function collect() { return { id: formulaId || `formula-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: $('formulaName').value.trim() || '未命名公式', description: $('formulaDescription').value.trim(), category: $('formulaCategory').value.trim() || '我的公式', kind: 'custom', values: { visualTree: clone(tree) }, customLatex: $('customLatex').value, style: { ...style() }, manualNumber: $('manualNumber').value.trim(), label: $('formulaLabel').value.trim() || `formula-${Date.now()}`, favorite: false }; }
function load(formula) { formulaId = formula.id || ''; tree = normalizeFormulaTree(formula.values?.visualTree ? clone(formula.values.visualTree) : row(text(formula.customLatex || formula.values?.expression || 'E=mc^2'))); activeId = firstTextId(tree); undoStack = []; redoStack = []; quickStyle = formula.style ? { ...formula.style } : {}; $('formulaName').value = formula.name || '未命名公式'; $('formulaDescription').value = formula.description || ''; $('formulaCategory').value = formula.category || '我的公式'; $('formulaLabel').value = formula.label || ''; $('manualNumber').value = formula.manualNumber || ''; $('customLatex').value = formula.customLatex || ''; if (formula.style && !styles.some((item) => item.id === formula.style.id)) { styles.push(formula.style); renderStyleSelect(); } $('formulaStyle').value = formula.style?.id || styles[0]?.id || ''; syncQuickStyle(formula.style); renderEditor(); tab('editorPane'); }
function resetFormula() { formulaId = ''; tree = row(text('')); activeId = firstTextId(tree); undoStack = []; redoStack = []; quickStyle = {}; $('formulaName').value = '未命名公式'; $('formulaDescription').value = ''; $('formulaCategory').value = '我的公式'; $('formulaLabel').value = ''; $('manualNumber').value = ''; $('customLatex').value = ''; syncQuickStyle(); renderEditor(); }
function renderStyleSelect() { const select = $('formulaStyle'), old = select.value; select.innerHTML = styles.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''); if (styles.some((item) => item.id === old)) select.value = old; }
function renderSaved() { const query = $('formulaSearch').value.toLowerCase(), mode = $('formulaFilter').value; let items = formulas.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query)); if (mode === 'favorite') items = items.filter((item) => item.favorite); if (mode === 'recent') items = [...items].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0)).slice(0, 12); const box = $('savedList'); box.innerHTML = ''; if (!items.length) { box.innerHTML = '<div class="empty">还没有符合条件的常用公式。</div>'; return; } for (const item of items) { const line = document.createElement('div'); line.className = 'item'; line.innerHTML = `<div class="item-main"><strong>${item.favorite ? '★ ' : ''}${esc(item.name)}</strong><small>${esc(item.category)} · ${esc(item.description || '点击编辑')}</small></div><div class="item-actions"><button data-a="insert">插入</button><button data-a="fav">${item.favorite ? '取消收藏' : '收藏'}</button><button class="danger" data-a="del">删除</button></div>`; line.querySelector('.item-main').onclick = () => load(item); line.querySelector('[data-a="insert"]').onclick = () => { item.lastUsedAt = Date.now(); vscode.postMessage({ type: 'saveFormulas', items: formulas }); vscode.postMessage({ type: 'insertFormula', formula: item }); }; line.querySelector('[data-a="fav"]').onclick = () => { item.favorite = !item.favorite; vscode.postMessage({ type: 'saveFormulas', items: formulas }); }; line.querySelector('[data-a="del"]').onclick = () => { if (confirm(`删除公式“${item.name}”？`)) vscode.postMessage({ type: 'saveFormulas', items: formulas.filter((value) => value.id !== item.id) }); }; box.append(line); } }
function fillVariable(item = {}) { $('variableId').value = item.id || ''; $('variableSymbol').value = item.symbol || ''; $('variableName').value = item.name || ''; $('variableUnit').value = item.unit || ''; $('variableCategory').value = item.category || '常用变量'; $('variableDescription').value = item.description || ''; $('variableFavorite').checked = !!item.favorite; }
function renderVariables() { const query = $('variableSearch').value.toLowerCase(), items = [...variables].filter((item) => `${item.symbol} ${item.name} ${item.unit} ${item.description} ${item.category}`.toLowerCase().includes(query)).sort((a, b) => +b.favorite - +a.favorite || (b.lastUsedAt || 0) - (a.lastUsedAt || 0)), box = $('variableList'); box.innerHTML = ''; if (!items.length) { box.innerHTML = '<div class="empty">还没有变量。</div>'; return; } for (const item of items) { const line = document.createElement('div'); line.className = 'item'; line.innerHTML = `<div class="item-main"><strong>${item.favorite ? '★ ' : ''}${esc(item.symbol)}　${esc(item.name)}</strong><small>${esc(item.category)}${item.unit ? ` · ${esc(item.unit)}` : ''}<br>${esc(item.description)}</small></div><div class="item-actions"><button data-a="use">填入公式</button><button data-a="insert">插入正文</button><button data-a="edit">编辑</button><button class="danger" data-a="del">删除</button></div>`; line.querySelector('[data-a="use"]').onclick = () => { insertText(item.symbol); tab('editorPane'); }; line.querySelector('[data-a="insert"]').onclick = () => vscode.postMessage({ type: 'insertVariable', variable: item }); line.querySelector('[data-a="edit"]').onclick = () => fillVariable(item); line.querySelector('[data-a="del"]').onclick = () => { if (confirm(`删除变量“${item.name}”？`)) vscode.postMessage({ type: 'saveVariables', items: variables.filter((value) => value.id !== item.id) }); }; box.append(line); } }
function collectStyle() { return { id: $('styleId').value || `formula-style-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: $('styleName').value.trim() || '未命名公式样式', fontSize: +$('styleFontSize').value, mathStyle: $('styleMathStyle').value, displayMode: $('styleDisplay').value, alignment: $('styleAlignment').value, numberPosition: $('styleNumberPosition').value, numberMode: $('styleNumberMode').value, numberingScope: $('styleNumberingScope').value, numberSeparator: $('styleNumberSeparator').value, numberFormat: $('styleNumberFormat').value, numberFontFamily: $('styleNumberFont').value, numberFontSize: +$('styleNumberSize').value, numberBold: $('styleNumberBold').checked, beforeMode: $('styleBeforeMode').value, beforeValue: +$('styleBeforeValue').value, afterMode: $('styleAfterMode').value, afterValue: +$('styleAfterValue').value, pageBreakBefore: $('stylePageBreak').checked, keepWithNext: $('styleKeepNext').checked }; }
function fillStyle(item = {}) { const value = { name: '论文公式', fontSize: 12, mathStyle: 'default', displayMode: 'numbered', alignment: 'center', numberPosition: 'right', numberMode: 'automatic', numberingScope: 'section', numberSeparator: '-', numberFormat: 'parentheses', numberFontFamily: 'inherit', numberFontSize: 10.5, beforeMode: 'lines', beforeValue: .5, afterMode: 'lines', afterValue: .5, ...item }; for (const [id, property] of [['styleId', 'id'], ['styleName', 'name'], ['styleMathStyle', 'mathStyle'], ['styleDisplay', 'displayMode'], ['styleAlignment', 'alignment'], ['styleNumberPosition', 'numberPosition'], ['styleNumberMode', 'numberMode'], ['styleNumberingScope', 'numberingScope'], ['styleNumberSeparator', 'numberSeparator'], ['styleNumberFormat', 'numberFormat'], ['styleNumberFont', 'numberFontFamily'], ['styleBeforeMode', 'beforeMode'], ['styleBeforeValue', 'beforeValue'], ['styleAfterMode', 'afterMode'], ['styleAfterValue', 'afterValue']]) $(id).value = value[property] ?? ''; setNumberChoice('styleFontSize', value.fontSize); setNumberChoice('styleNumberSize', value.numberFontSize); $('styleNumberBold').checked = !!value.numberBold; $('stylePageBreak').checked = !!value.pageBreakBefore; $('styleKeepNext').checked = !!value.keepWithNext; }
function renderStyles() { const box = $('styleList'); box.innerHTML = ''; for (const item of styles) { const line = document.createElement('div'); line.className = 'item'; line.innerHTML = `<div class="item-main"><strong>${esc(item.name)}</strong><small>${item.displayMode === 'inline' ? '行内' : item.displayMode === 'display' ? '独立' : '带编号'} · ${item.fontSize} pt</small></div><div class="item-actions"><button data-a="edit">编辑</button><button class="danger" data-a="del">删除</button></div>`; line.querySelector('[data-a="edit"]').onclick = () => fillStyle(item); line.querySelector('[data-a="del"]').onclick = () => { if (styles.length > 1 && confirm(`删除样式“${item.name}”？`)) vscode.postMessage({ type: 'saveStyles', items: styles.filter((value) => value.id !== item.id) }); }; box.append(line); } }
function renderAll() { renderStyleSelect(); renderSaved(); renderVariables(); renderStyles(); preview(); }
function setNumberChoice(id, value) { const select = $(id), textValue = String(value); if (![...select.options].some((option) => option.value === textValue)) { const option = document.createElement('option'); option.value = textValue; option.textContent = `自定义（${textValue} pt）`; select.insertBefore(option, select.lastElementChild?.value === '__custom__' ? select.lastElementChild : null); } select.value = textValue; }
function enableCustomNumberChoice(id) { const select = $(id), option = document.createElement('option'); option.value = '__custom__'; option.textContent = '自定义…'; select.append(option); select.addEventListener('change', () => { if (select.value !== '__custom__') return; const raw = prompt('请输入 5 到 72 之间的字号（pt）', '12'), value = Number(raw); setNumberChoice(id, Number.isFinite(value) && value >= 5 && value <= 72 ? value : 12); }); }

document.querySelectorAll('.tabs button').forEach((button) => { button.onclick = () => tab(button.dataset.tab); });
enableCustomNumberChoice('styleFontSize'); enableCustomNumberChoice('styleNumberSize');
document.querySelectorAll('#templateButtons button').forEach((button) => { button.onclick = () => insertStructure(button.dataset.kind); });
const symbolGroups = { '希腊字母': [['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['δ', '\\delta'], ['θ', '\\theta'], ['λ', '\\lambda'], ['μ', '\\mu'], ['π', '\\pi'], ['σ', '\\sigma'], ['φ', '\\phi'], ['Δ', '\\Delta'], ['Ω', '\\Omega']], '运算关系': [['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'], ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\ne'], ['≈', '\\approx'], ['∞', '\\infty']], '微积分': [['∂', '\\partial'], ['∇', '\\nabla'], ['→', '\\to'], ['∈', '\\in'], ['∪', '\\cup'], ['∩', '\\cap']] };
const symbolSelect = document.createElement('select'); symbolSelect.id = 'symbolCategory'; symbolSelect.innerHTML = Object.keys(symbolGroups).map((name) => `<option>${name}</option>`).join(''); $('symbolButtons').before(symbolSelect);
function renderSymbols() { $('symbolButtons').innerHTML = ''; for (const [label, value] of symbolGroups[symbolSelect.value]) { const button = document.createElement('button'); button.textContent = label; button.title = value; button.onclick = () => insertText(value); $('symbolButtons').append(button); } } symbolSelect.onchange = renderSymbols; renderSymbols();
$('visualEditor').addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const slots = [...$('visualEditor').querySelectorAll('.math-slot')]; const current = Math.max(0, slots.indexOf(document.activeElement)); slots[(current + (event.shiftKey ? slots.length - 1 : 1)) % slots.length]?.focus(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); } });
$('undoFormula').onclick = undo; $('redoFormula').onclick = redo; $('customLatex').onchange = () => { if ($('customLatex').value.trim()) { snapshot(); tree = row(text($('customLatex').value.trim())); activeId = firstTextId(tree); renderEditor(); } };
$('formulaStyle').onchange = () => { quickStyle = {}; syncQuickStyle(); preview(); }; $('manualNumber').oninput = preview; $('newFormula').onclick = resetFormula;
[['quickDisplay', 'displayMode'], ['quickAlignment', 'alignment'], ['quickNumberPosition', 'numberPosition'], ['quickNumberMode', 'numberMode']].forEach(([id, property]) => { $(id).onchange = () => { quickStyle[property] = $(id).value; preview(); }; });
$('saveFormula').onclick = () => { const item = collect(), index = formulas.findIndex((value) => value.id === item.id); if (index >= 0) formulas[index] = { ...formulas[index], ...item }; else formulas.push(item); vscode.postMessage({ type: 'saveFormulas', items: formulas }); toast('已保存为常用公式'); };
$('insertFormula').onclick = () => vscode.postMessage({ type: 'insertFormula', formula: collect() }); $('formulaSearch').oninput = renderSaved; $('formulaFilter').onchange = renderSaved; $('variableSearch').oninput = renderVariables; $('resetVariable').onclick = () => fillVariable();
$('saveVariable').onclick = () => { const item = { id: $('variableId').value || `variable-${Date.now()}-${Math.random().toString(16).slice(2)}`, symbol: $('variableSymbol').value.trim(), name: $('variableName').value.trim(), unit: $('variableUnit').value.trim(), category: $('variableCategory').value.trim(), description: $('variableDescription').value.trim(), favorite: $('variableFavorite').checked }; if (!item.symbol || !item.name) { toast('请填写变量符号和名称'); return; } const duplicate = variables.find((value) => value.symbol === item.symbol && value.id !== item.id); if (duplicate && !confirm(`符号 ${item.symbol} 已用于“${duplicate.name}”，仍然保存吗？`)) return; const index = variables.findIndex((value) => value.id === item.id); if (index >= 0) variables[index] = item; else variables.push(item); vscode.postMessage({ type: 'saveVariables', items: variables }); fillVariable(); };
$('resetStyle').onclick = () => fillStyle(); $('saveStyle').onclick = () => { const item = collectStyle(), index = styles.findIndex((value) => value.id === item.id); if (index >= 0) styles[index] = item; else styles.push(item); vscode.postMessage({ type: 'saveStyles', items: styles }); }; $('refreshTarget').onclick = () => vscode.postMessage({ type: 'refreshTarget' }); $('floatButton').onclick = () => vscode.postMessage({ type: 'moveToWindow' });
window.addEventListener('message', (event) => { const message = event.data; if (message.type === 'state') { styles = message.styles || []; formulas = message.formulas || []; variables = message.variables || []; renderAll(); } if (message.type === 'target') { $('targetName').textContent = message.target ? `${message.target.name} · 第 ${message.target.line} 行` : '未选择插入位置'; $('targetHint').textContent = message.editing ? '正在修改已插入公式' : '公式将插入到这个位置'; numberContext = message.numberContext || numberContext; preview(); } if (message.type === 'editFormula') load(message.formula); if (message.type === 'inserted') toast(`“${message.name}”已写入论文`); });
fillVariable(); fillStyle(); activeId = firstTextId(tree); syncQuickStyle(); renderEditor(); vscode.postMessage({ type: 'ready' });
