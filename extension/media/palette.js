'use strict';

const vscode = acquireVsCodeApi();
let presets = [];
let documentScheme = {};
let tocSettings = {};
let pageSettings = {};
let editingId = null;
let alignment = 'left';
let bold = false;
let italic = false;
let pendingTablePreset = null;
let pendingTableEdit = false;
let pendingTableMerges = [];
let pendingImagePreset = null;
let selectedImageLatexPath = '';
let editingInsertedTable = false;
let tocPreviewOnSubmit = false;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const dialog = byId('editorDialog');
const tableSizeDialog = byId('tableSizeDialog');
const imageInsertDialog = byId('imageInsertDialog');
const schemeDialog = byId('schemeDialog');
const outlineDialog = byId('outlineDialog');
const tocDialog = byId('tocDialog');
const pageDialog = byId('pageDialog');

function setNumberChoice(id, value) {
  const select = byId(id);
  if (!select) return;
  const textValue = String(value);
  if (![...select.options].some((option) => option.value === textValue)) {
    const option = document.createElement('option'); option.value = textValue; option.textContent = `自定义（${textValue} pt）`; select.insertBefore(option, select.lastElementChild?.value === '__custom__' ? select.lastElementChild : null);
  }
  select.value = textValue;
}

function enableCustomNumberChoice(id, min = 5, max = 72) {
  const select = byId(id); if (!select || [...select.options].some((option) => option.value === '__custom__')) return;
  const option = document.createElement('option'); option.value = '__custom__'; option.textContent = '自定义…'; select.append(option);
  select.addEventListener('change', () => {
    if (select.value !== '__custom__') return;
    const raw = prompt(`请输入 ${min} 到 ${max} 之间的字号（pt）`, '12');
    const value = Number(raw);
    if (Number.isFinite(value) && value >= min && value <= max) { setNumberChoice(id, value); select.dispatchEvent(new Event('input')); }
    else setNumberChoice(id, 12);
  });
}

const defaultTocSettings = () => ({
  title: '目录', depth: 3, titleFontFamily: 'heiti', titleFontSize: 16,
  titleBold: true, titleAlignment: 'center', showPageNumbers: true,
  leaderStyle: 'dots', pageBreakBefore: true, pageBreakAfter: true,
  levelStyles: [
    { fontFamily: 'inherit', fontSize: 12, indent: 0, lineSpacing: 1.2, bold: true },
    { fontFamily: 'inherit', fontSize: 10.5, indent: 1, lineSpacing: 1.2, bold: false },
    { fontFamily: 'inherit', fontSize: 10.5, indent: 2, lineSpacing: 1.2, bold: false }
  ]
});

const defaultPageSettings = () => ({
  preset: 'custom', headerEnabled: true, headerContentMode: 'fixed', headerText: '',
  headerFontFamily: 'songti', headerFontSize: 10.5, headerBold: false, headerItalic: false,
  headerAlignment: 'center', headerDistance: 8, headerLine: true,
  footerEnabled: false, footerContentMode: 'fixed', footerText: '', footerFontFamily: 'songti',
  footerFontSize: 10.5, footerBold: false, footerItalic: false, footerAlignment: 'center',
  footerDistance: 10, footerLine: false, pageNumberEnabled: true, pageNumberArea: 'footer',
  pageNumberPosition: 'center', pageNumberFormat: 'arabic', startNumber: 1,
  startAt: 'document', firstPageMode: 'hidden', firstHeaderText: '', firstFooterText: '',
  firstShowPageNumber: false, firstHeaderAlignment: 'center', firstFooterAlignment: 'center',
  headerEdgeDistance: 15, footerEdgeDistance: 15, differentOddEven: false,
  oddHeaderText: '', evenHeaderText: '', oddFooterText: '', evenFooterText: '',
  paperSize: 'a4paper', orientation: 'portrait', marginTop: 25, marginBottom: 25,
  marginLeft: 25, marginRight: 25, bindingOffset: 0, mirroredMargins: false, columns: 1
});

function openTocSettings(settings = tocSettings) {
  const value = { ...defaultTocSettings(), ...(settings || {}) };
  byId('tocTitle').value = value.title;
  byId('tocDepth').value = value.depth;
  byId('tocFontFamily').value = value.titleFontFamily;
  setNumberChoice('tocFontSize', value.titleFontSize);
  byId('tocTitleBold').checked = value.titleBold !== false;
  byId('tocAlignment').value = value.titleAlignment;
  byId('tocShowPageNumbers').checked = value.showPageNumbers !== false;
  byId('tocLeaderStyle').value = value.leaderStyle;
  byId('tocPageBreakBefore').checked = value.pageBreakBefore !== false;
  byId('tocPageBreakAfter').checked = value.pageBreakAfter !== false;
  const levels = Array.isArray(value.levelStyles) ? value.levelStyles : defaultTocSettings().levelStyles;
  levels.forEach((level, index) => {
    byId(`tocLevel${index + 1}Size`).value = level.fontSize;
    byId(`tocLevel${index + 1}Indent`).value = level.indent;
    byId(`tocLevel${index + 1}Spacing`).value = level.lineSpacing;
  });
  updateTocPreview();
  tocDialog.showModal();
}

function collectTocSettings() {
  return {
    title: byId('tocTitle').value.trim() || '目录',
    depth: Number(byId('tocDepth').value),
    titleFontFamily: byId('tocFontFamily').value,
    titleFontSize: Number(byId('tocFontSize').value),
    titleBold: byId('tocTitleBold').checked,
    titleAlignment: byId('tocAlignment').value,
    showPageNumbers: byId('tocShowPageNumbers').checked,
    leaderStyle: byId('tocLeaderStyle').value,
    pageBreakBefore: byId('tocPageBreakBefore').checked,
    pageBreakAfter: byId('tocPageBreakAfter').checked,
    levelStyles: [1, 2, 3].map((index) => ({
      fontFamily: 'inherit', fontSize: Number(byId(`tocLevel${index}Size`).value),
      indent: Number(byId(`tocLevel${index}Indent`).value), lineSpacing: Number(byId(`tocLevel${index}Spacing`).value),
      bold: index === 1
    }))
  };
}

function updateTocPreview() {
  const value = collectTocSettings();
  const title = byId('tocPreviewTitle');
  title.textContent = value.title;
  title.style.textAlign = value.titleAlignment;
  title.style.fontWeight = value.titleBold ? '700' : '400';
  title.style.fontSize = `${Math.max(13, value.titleFontSize)}px`;
  [...byId('tocPreview').querySelectorAll(':scope > div')].forEach((row, index) => {
    row.hidden = index + 1 > value.depth;
    row.lastElementChild.hidden = !value.showPageNumbers;
    row.querySelector('.toc-dots').style.borderBottomStyle = value.leaderStyle === 'dots' ? 'dotted' : 'none';
  });
}

function pagePresetValue(name) {
  const base = defaultPageSettings();
  if (name === 'normal') return { ...base, preset: 'normal', headerEnabled: false, firstPageMode: 'same' };
  if (name === 'thesis') return { ...base, preset: 'thesis', headerEnabled: true, headerContentMode: 'title', firstPageMode: 'hidden' };
  if (name === 'book') return { ...base, preset: 'book', headerEnabled: true, headerContentMode: 'chapter', headerAlignment: 'center', pageNumberPosition: 'outer', firstPageMode: 'hidden' };
  return base;
}

function setPageFields(raw) {
  const value = { ...defaultPageSettings(), ...(raw || {}) };
  const map = {
    pagePreset: value.preset, pageHeaderMode: value.headerContentMode, pageHeaderText: value.headerText,
    pageHeaderFont: value.headerFontFamily, pageHeaderSize: value.headerFontSize, pageHeaderAlignment: value.headerAlignment,
    pageHeaderDistance: value.headerDistance, pageFooterMode: value.footerContentMode, pageFooterText: value.footerText,
    pageFooterFont: value.footerFontFamily, pageFooterSize: value.footerFontSize, pageFooterAlignment: value.footerAlignment,
    pageFooterDistance: value.footerDistance, pageNumberArea: value.pageNumberArea, pageNumberPosition: value.pageNumberPosition,
    pageNumberFormat: value.pageNumberFormat, pageStartNumber: value.startNumber, pageStartAt: value.startAt,
    pageFirstMode: value.firstPageMode, pageFirstHeaderText: value.firstHeaderText, pageFirstFooterText: value.firstFooterText
    , pageFirstHeaderAlignment: value.firstHeaderAlignment, pageFirstFooterAlignment: value.firstFooterAlignment,
    pageHeaderEdgeDistance: value.headerEdgeDistance, pageFooterEdgeDistance: value.footerEdgeDistance,
    pagePaper: value.paperSize, pageOrientation: value.orientation, pageColumns: value.columns,
    pageMarginTop: value.marginTop, pageMarginBottom: value.marginBottom, pageMarginLeft: value.marginLeft,
    pageMarginRight: value.marginRight, pageBindingOffset: value.bindingOffset,
    pageOddHeaderText: value.oddHeaderText, pageEvenHeaderText: value.evenHeaderText,
    pageOddFooterText: value.oddFooterText, pageEvenFooterText: value.evenFooterText
  };
  Object.entries(map).forEach(([id, fieldValue]) => {
    if (['pageHeaderSize', 'pageFooterSize'].includes(id)) setNumberChoice(id, fieldValue);
    else byId(id).value = fieldValue;
  });
  const checks = {
    pageHeaderEnabled: value.headerEnabled, pageHeaderBold: value.headerBold, pageHeaderItalic: value.headerItalic,
    pageHeaderLine: value.headerLine, pageFooterEnabled: value.footerEnabled, pageFooterBold: value.footerBold,
    pageFooterItalic: value.footerItalic, pageFooterLine: value.footerLine, pageNumberEnabled: value.pageNumberEnabled,
    pageFirstShowNumber: value.firstShowPageNumber, pageMirroredMargins: value.mirroredMargins,
    pageDifferentOddEven: value.differentOddEven
  };
  Object.entries(checks).forEach(([id, checked]) => { byId(id).checked = Boolean(checked); });
  updatePagePreview();
}

function openPageSettings(settings = pageSettings) {
  setPageFields(settings);
  pageDialog.showModal();
}

function collectPageSettings() {
  return {
    preset: byId('pagePreset').value,
    headerEnabled: byId('pageHeaderEnabled').checked,
    headerContentMode: byId('pageHeaderMode').value, headerText: byId('pageHeaderText').value.trim(),
    headerFontFamily: byId('pageHeaderFont').value, headerFontSize: Number(byId('pageHeaderSize').value),
    headerBold: byId('pageHeaderBold').checked, headerItalic: byId('pageHeaderItalic').checked,
    headerAlignment: byId('pageHeaderAlignment').value, headerDistance: Number(byId('pageHeaderDistance').value),
    headerLine: byId('pageHeaderLine').checked, footerEnabled: byId('pageFooterEnabled').checked,
    footerContentMode: byId('pageFooterMode').value, footerText: byId('pageFooterText').value.trim(),
    footerFontFamily: byId('pageFooterFont').value, footerFontSize: Number(byId('pageFooterSize').value),
    footerBold: byId('pageFooterBold').checked, footerItalic: byId('pageFooterItalic').checked,
    footerAlignment: byId('pageFooterAlignment').value, footerDistance: Number(byId('pageFooterDistance').value),
    footerLine: byId('pageFooterLine').checked, pageNumberEnabled: byId('pageNumberEnabled').checked,
    pageNumberArea: byId('pageNumberArea').value, pageNumberPosition: byId('pageNumberPosition').value,
    pageNumberFormat: byId('pageNumberFormat').value, startNumber: Number(byId('pageStartNumber').value),
    startAt: byId('pageStartAt').value, firstPageMode: byId('pageFirstMode').value,
    firstHeaderText: byId('pageFirstHeaderText').value.trim(), firstFooterText: byId('pageFirstFooterText').value.trim(),
    firstShowPageNumber: byId('pageFirstShowNumber').checked,
    firstHeaderAlignment: byId('pageFirstHeaderAlignment').value, firstFooterAlignment: byId('pageFirstFooterAlignment').value,
    headerEdgeDistance: Number(byId('pageHeaderEdgeDistance').value), footerEdgeDistance: Number(byId('pageFooterEdgeDistance').value),
    differentOddEven: byId('pageDifferentOddEven').checked,
    oddHeaderText: byId('pageOddHeaderText').value.trim(), evenHeaderText: byId('pageEvenHeaderText').value.trim(),
    oddFooterText: byId('pageOddFooterText').value.trim(), evenFooterText: byId('pageEvenFooterText').value.trim(),
    paperSize: byId('pagePaper').value, orientation: byId('pageOrientation').value,
    marginTop: Number(byId('pageMarginTop').value), marginBottom: Number(byId('pageMarginBottom').value),
    marginLeft: Number(byId('pageMarginLeft').value), marginRight: Number(byId('pageMarginRight').value),
    bindingOffset: Number(byId('pageBindingOffset').value), mirroredMargins: byId('pageMirroredMargins').checked,
    columns: Number(byId('pageColumns').value)
  };
}

function pageContentPreview(mode, fixedText) {
  if (mode === 'chapter') return '第 1 章　绪论';
  if (mode === 'section') return '1.1　研究背景';
  if (mode === 'title') return '论文标题';
  return fixedText || '页眉预览';
}

function updatePagePreview() {
  const value = collectPageSettings();
  const header = byId('pagePreviewHeader');
  const footer = byId('pagePreviewFooter');
  const number = byId('pagePreviewNumber');
  byId('firstPageFields').hidden = value.firstPageMode !== 'separate';
  header.textContent = value.headerEnabled ? pageContentPreview(value.headerContentMode, value.headerText) : '';
  header.style.textAlign = value.headerAlignment;
  header.style.borderBottomStyle = value.headerEnabled && value.headerLine ? 'solid' : 'none';
  header.style.fontWeight = value.headerBold ? '700' : '400';
  header.style.fontStyle = value.headerItalic ? 'italic' : 'normal';
  footer.textContent = value.footerEnabled ? pageContentPreview(value.footerContentMode, value.footerText) : '';
  footer.style.textAlign = value.footerAlignment;
  number.textContent = value.pageNumberEnabled ? (value.pageNumberFormat === 'roman' ? 'i' : value.pageNumberFormat === 'Roman' ? 'I' : String(value.startNumber)) : '';
  const positions = { left: 'start', center: 'center', right: 'end', outer: 'end' };
  number.style.justifySelf = positions[value.pageNumberPosition];
  number.style.gridColumn = value.pageNumberPosition === 'left' ? '1' : value.pageNumberPosition === 'center' ? '2' : '3';
  if (value.pageNumberArea === 'header' && value.pageNumberEnabled) header.textContent += `    ${number.textContent}`;
  number.style.visibility = value.pageNumberArea === 'header' ? 'hidden' : 'visible';
}

function openSchemeEditor() {
  const scheme = documentScheme || {};
  byId('schemeName').value = scheme.name || '我的论文格式';
  byId('schemeBodyFont').value = scheme.bodyFontFamily || 'songti';
  byId('schemeBodySize').value = scheme.bodyFontSize || 12;
  byId('schemeBodySpacing').value = scheme.bodyLineSpacing || 1.5;
  byId('schemeAvoidWidow').checked = scheme.avoidWidowOrphan !== false;
  byId('schemeHeadingFont').value = scheme.headingFontFamily || 'heiti';
  byId('schemeHeading1Size').value = scheme.heading1FontSize || 16;
  byId('schemeHeading2Size').value = scheme.heading2FontSize || 14;
  byId('schemeHeading1PageBreak').checked = Boolean(scheme.heading1PageBreakBefore);
  byId('schemeCaptionFont').value = scheme.captionFontFamily || 'songti';
  byId('schemeCaptionSize').value = scheme.captionFontSize || 10.5;
  byId('schemeTableSize').value = scheme.tableFontSize || 10.5;
  schemeDialog.showModal();
}

function openOutline() {
  byId('outlineList').innerHTML = '<div class="hint">正在读取当前论文……</div>';
  outlineDialog.showModal();
  vscode.postMessage({ type: 'getOutline' });
}

function renderOutline(message) {
  const list = byId('outlineList');
  list.innerHTML = '';
  if (message.error) {
    list.textContent = message.error;
    return;
  }
  const items = message.items || [];
  if (!items.length) {
    list.textContent = '当前文件中还没有找到章节、图片或表格。';
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = `outline-item level-${item.level || 1}`;
    const main = document.createElement('div');
    main.className = 'outline-main';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const kind = document.createElement('span');
    kind.className = 'outline-kind';
    kind.textContent = item.kind === 'section'
      ? `${item.level} 级标题`
      : `${item.kind === 'figure' ? '图' : item.kind === 'table' ? '表' : '式'} ${item.number || ''}`.trim();
    main.append(title, kind);
    main.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigateOutline', offset: item.offset });
      outlineDialog.close();
    });
    row.appendChild(main);
    if (item.label && item.kind !== 'section') {
      const reference = document.createElement('button');
      reference.type = 'button';
      reference.textContent = `引用${item.kind === 'figure' ? '图' : item.kind === 'table' ? '表' : '式'} ${item.number || ''}`.trim();
      reference.addEventListener('click', () => {
        vscode.postMessage({ type: 'insertReference', label: item.label, kind: item.kind });
        outlineDialog.close();
      });
      row.appendChild(reference);
    }
    list.appendChild(row);
  }
}

function render() {
  const list = byId('presetList');
  list.innerHTML = '';
  byId('empty').hidden = presets.length !== 0;
  if (!presets.length) return;

  const categories = [];
  for (const preset of presets) {
    if (!categories.includes(preset.category)) categories.push(preset.category);
  }

  for (const category of categories) {
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = category;
    list.appendChild(title);

    for (const preset of presets.filter((item) => item.category === category)) {
      const card = document.createElement('div');
      card.className = 'preset-card';
      const insertTitle = preset.kind === 'table' ? '点击后选择行列数' : '点击插入到光标位置';
      card.innerHTML = [
        '<div class="preset-icon" data-action="insert" title="' + insertTitle + '">' + escapeHtml(preset.icon) + '</div>',
        '<div class="preset-main" data-action="insert" title="' + insertTitle + '">',
        '  <div class="preset-name">' + escapeHtml(preset.name) + '</div>',
        '  <div class="preset-description">' + escapeHtml(preset.description || '点击即可插入') + '</div>',
        '</div>',
        '<div class="card-menu">',
        '  <button class="menu-button" data-action="menu" title="更多操作">⋯</button>',
        '  <div class="menu">',
        '    <button data-action="edit">编辑</button>',
        '    <button data-action="duplicate">复制</button>',
        '    <button data-action="up">上移</button>',
        '    <button data-action="down">下移</button>',
        '    <button data-action="delete">删除</button>',
        '  </div>',
        '</div>'
      ].join('');
      card.addEventListener('click', (event) => handleCardAction(event, preset));
      list.appendChild(card);
    }
  }
}

function handleCardAction(event, preset) {
  const actionTarget = event.target.closest('[data-action]');
  const action = actionTarget && actionTarget.dataset.action;
  if (!action) return;

  if (action === 'insert') vscode.postMessage({ type: 'insertPreset', id: preset.id });
  if (action === 'menu') {
    document.querySelectorAll('.menu.open').forEach((menu) => {
      if (menu !== actionTarget.nextElementSibling) menu.classList.remove('open');
    });
    actionTarget.nextElementSibling.classList.toggle('open');
  }
  if (action === 'edit') openEditor(preset);
  if (action === 'duplicate') openEditor({ ...preset, id: '', name: preset.name + '（副本）' });
  if (action === 'up' || action === 'down') {
    vscode.postMessage({ type: 'movePreset', id: preset.id, direction: action });
  }
  if (action === 'delete') vscode.postMessage({ type: 'deletePreset', id: preset.id });
}

function defaultItem() {
  return {
    id: '', name: '', category: '段落', icon: '¶', description: '', kind: 'paragraph',
    settings: {
      fontFamily: 'inherit', fontSize: 12, lineSpacingMode: 'multiple', lineSpacingValue: 1.5,
      beforeMode: 'lines', beforeValue: 0, afterMode: 'lines', afterValue: 0,
      leftIndent: 0, rightIndent: 0, indentMode: 'first', indentValue: 2,
      alignment: 'justify', bold: false, italic: false,
      pageBreakBefore: false, keepWithNext: false, avoidWidowOrphan: false
    }
  };
}

function openEditor(preset, insertedTable = false) {
  const item = preset || defaultItem();
  editingInsertedTable = insertedTable;
  editingId = item.id || null;
  byId('dialogTitle').textContent = editingId ? '编辑格式' : '新建格式';
  byId('presetId').value = item.id || '';
  byId('name').value = item.name || '';
  byId('category').value = item.category || '其他';
  byId('description').value = item.description || '';
  byId('icon').value = item.icon || '✦';
  byId('kind').value = item.kind || 'paragraph';
  byId('template').value = item.template || '\\textbf{${TM_SELECTED_TEXT:在此输入内容}}';

  const settings = item.settings || {};
  byId('fontFamily').value = settings.fontFamily || 'inherit';
  setNumberChoice('fontSize', settings.fontSize ?? 12);
  byId('lineSpacingMode').value = settings.lineSpacingMode || 'multiple';
  byId('lineSpacingValue').value = settings.lineSpacingValue ?? 1.5;
  byId('beforeMode').value = settings.beforeMode || 'lines';
  byId('beforeValue').value = settings.beforeValue ?? 0;
  byId('afterMode').value = settings.afterMode || 'lines';
  byId('afterValue').value = settings.afterValue ?? 0;
  byId('leftIndent').value = settings.leftIndent ?? 0;
  byId('rightIndent').value = settings.rightIndent ?? 0;
  byId('indentMode').value = settings.indentMode || 'first';
  byId('indentValue').value = settings.indentValue ?? 2;
  byId('pageBreakBefore').checked = Boolean(settings.pageBreakBefore);
  byId('keepWithNext').checked = Boolean(settings.keepWithNext);
  byId('avoidWidowOrphan').checked = Boolean(settings.avoidWidowOrphan);
  alignment = settings.alignment || 'justify';
  bold = Boolean(settings.bold);
  italic = Boolean(settings.italic);

  byId('imageSizeMode').value = settings.sizeMode || 'percent';
  byId('imageScalePercent').value = String(settings.scalePercent ?? settings.imageWidth ?? 80);
  byId('imageCustomPixels').value = settings.customPixels ?? 800;
  byId('imageAlignment').value = settings.imageAlignment || 'center';
  byId('imagePlacement').value = settings.placement || 'htbp';
  byId('imagePageBreakBefore').checked = Boolean(settings.pageBreakBefore);
  byId('imageHasCaption').checked = settings.hasCaption !== false;
  byId('imageCaptionPosition').value = settings.captionPosition || 'bottom';
  byId('captionFontFamily').value = settings.captionFontFamily || 'inherit';
  setNumberChoice('captionFontSize', settings.captionFontSize ?? 10.5);
  byId('captionLineSpacing').value = settings.captionLineSpacing ?? 1.2;
  byId('captionBold').checked = Boolean(settings.captionBold);
  byId('captionItalic').checked = Boolean(settings.captionItalic);
  byId('imageCaptionCentered').checked = settings.captionCentered !== false;
  byId('imageNumberMode').value = settings.numberMode || 'automatic';
  byId('imageLockAspect').checked = settings.lockAspectRatio !== false;
  byId('imageRotation').value = String(settings.rotation || 0);
  byId('imageTrimLeft').value = settings.trimLeft || 0; byId('imageTrimRight').value = settings.trimRight || 0;
  byId('imageTrimTop').value = settings.trimTop || 0; byId('imageTrimBottom').value = settings.trimBottom || 0;

  byId('tableHasHeader').checked = settings.hasHeader !== false;
  byId('tableAlignment').value = settings.tableAlignment || 'center';
  byId('columnWidthMode').value = settings.columnWidthMode || 'auto';
  byId('tableWidthPercent').value = settings.tableWidthPercent || 100;
  byId('borderStyle').value = settings.borderStyle || 'threeLine';
  byId('captionPosition').value = settings.captionPosition || 'top';
  byId('tableCaptionCentered').checked = settings.captionCentered !== false;
  byId('tableCaptionFontFamily').value = settings.tableCaptionFontFamily || 'inherit';
  setNumberChoice('tableCaptionFontSize', settings.tableCaptionFontSize ?? 10.5);
  byId('tableCaptionLineSpacing').value = settings.tableCaptionLineSpacing ?? 1.2;
  byId('tableCaptionBold').checked = Boolean(settings.tableCaptionBold);
  byId('tableCaptionItalic').checked = Boolean(settings.tableCaptionItalic);
  byId('tablePlacement').value = settings.placement || 'htbp';
  byId('tablePageBreakBefore').checked = Boolean(settings.pageBreakBefore);
  byId('tableRepeatHeader').checked = Boolean(settings.repeatHeader);
  byId('tableAllowRowBreak').checked = settings.allowRowBreak !== false;
  byId('tableColumnWidths').value = Array.isArray(settings.columnWidths) ? settings.columnWidths.filter(Boolean).join(',') : '';
  byId('tableVerticalAlignment').value = settings.verticalAlignment || 'middle';
  byId('bodyFontFamily').value = settings.bodyFontFamily || 'inherit';
  setNumberChoice('bodyFontSize', settings.bodyFontSize ?? 10.5);
  byId('bodyLineSpacing').value = settings.bodyLineSpacing ?? 1.2;
  byId('bodyAlignment').value = settings.bodyAlignment || 'center';
  byId('bodyBold').checked = Boolean(settings.bodyBold);
  byId('bodyItalic').checked = Boolean(settings.bodyItalic);
  byId('headerFontFamily').value = settings.headerFontFamily || 'heiti';
  setNumberChoice('headerFontSize', settings.headerFontSize ?? 10.5);
  byId('headerLineSpacing').value = settings.headerLineSpacing ?? 1.2;
  byId('headerAlignment').value = settings.headerAlignment || 'center';
  byId('headerBold').checked = settings.headerBold !== false;
  byId('headerItalic').checked = Boolean(settings.headerItalic);

  updateKind();
  updateParagraphPreview();
  updateImagePreview();
  updateTablePreview();
  dialog.showModal();
  setTimeout(() => byId('name').focus(), 0);
}

function updateKind() {
  const kind = byId('kind').value;
  byId('paragraphFields').hidden = kind !== 'paragraph';
  byId('imageFields').hidden = kind !== 'image';
  byId('tableFields').hidden = kind !== 'table';
  byId('customFields').hidden = kind !== 'custom';

  if (!editingId && kind === 'table') {
    if (!byId('name').value.trim()) byId('name').value = '我的表格样式';
    if (byId('category').value === '段落' || !byId('category').value.trim()) byId('category').value = '图表';
    if (byId('icon').value === '¶' || !byId('icon').value.trim()) byId('icon').value = '表';
    if (!byId('description').value.trim()) byId('description').value = '点击后选择行列数';
  }
  if (!editingId && kind === 'image') {
    if (!byId('name').value.trim()) byId('name').value = '我的图片样式';
    if (byId('category').value === '段落' || !byId('category').value.trim()) byId('category').value = '图表';
    if (byId('icon').value === '¶' || !byId('icon').value.trim()) byId('icon').value = '图';
    if (!byId('description').value.trim()) byId('description').value = '缩放 80%，图注在下方';
  }
}

function updateParagraphPreview() {
  document.querySelectorAll('.align').forEach((button) => {
    button.classList.toggle('active', button.dataset.align === alignment);
  });
  byId('boldButton').classList.toggle('active', bold);
  byId('italicButton').classList.toggle('active', italic);
  const preview = byId('visualPreview');
  preview.style.fontFamily = previewFontFamily(byId('fontFamily').value);
  preview.style.fontSize = Math.min(28, Number(byId('fontSize').value || 12)) + 'px';
  const lineMode = byId('lineSpacingMode').value;
  const lineValue = Number(byId('lineSpacingValue').value || 1.5);
  byId('lineSpacingUnit').textContent = lineMode === 'fixed' || lineMode === 'atleast' ? '磅（pt）' : '倍';
  preview.style.lineHeight = String(lineMode === 'single' ? 1.2 : lineMode === 'onehalf' ? 1.5 : lineMode === 'double' ? 2 : lineMode === 'fixed' || lineMode === 'atleast' ? Math.max(1, lineValue / Number(byId('fontSize').value || 12)) : lineValue);
  preview.style.textIndent = byId('indentMode').value === 'first' ? `${Number(byId('indentValue').value || 0)}em` : '0';
  preview.style.paddingLeft = `${Number(byId('leftIndent').value || 0)}em`;
  preview.style.paddingRight = `${Number(byId('rightIndent').value || 0)}em`;
  preview.style.textAlign = alignment;
  preview.style.fontWeight = bold ? '700' : '400';
  preview.style.fontStyle = italic ? 'italic' : 'normal';
  preview.style.paddingTop = (14 + Number(byId('beforeValue').value || 0) * (byId('beforeMode').value === 'pt' ? 1.33 : 12)) + 'px';
  preview.style.paddingBottom = (14 + Number(byId('afterValue').value || 0) * (byId('afterMode').value === 'pt' ? 1.33 : 12)) + 'px';
}

function previewFontFamily(value) {
  return {
    songti: 'SimSun, serif', heiti: 'SimHei, sans-serif',
    kaishu: 'KaiTi, serif', fangsong: 'FangSong, serif'
  }[value] || 'inherit';
}

function updateImagePreview() {
  const sizeMode = byId('imageSizeMode').value;
  const scalePercent = Number(byId('imageScalePercent').value || 80);
  const customPixels = Number(byId('imageCustomPixels').value || 800);
  const previewWidth = sizeMode === 'original'
    ? 70
    : sizeMode === 'pixels' ? Math.max(10, Math.min(100, customPixels / 10)) : scalePercent;
  const alignmentValue = byId('imageAlignment').value;
  const hasCaption = byId('imageHasCaption').checked;
  const captionPosition = byId('imageCaptionPosition').value;
  const preview = byId('imageVisualPreview');
  const image = preview.querySelector('.image-placeholder');
  const caption = byId('captionPreview');

  byId('imagePercentSetting').hidden = sizeMode !== 'percent';
  byId('imagePixelsSetting').hidden = sizeMode !== 'pixels';
  byId('imageCaptionSettings').hidden = !hasCaption;
  image.textContent = sizeMode === 'original'
    ? '原图大小'
    : sizeMode === 'pixels' ? `自定义 ${customPixels} 像素` : `正文宽度的 ${scalePercent}%`;
  image.style.width = `${previewWidth}%`;
  image.style.marginLeft = alignmentValue === 'center' ? 'auto' : alignmentValue === 'right' ? `${100 - previewWidth}%` : '0';
  image.style.marginRight = alignmentValue === 'center' ? 'auto' : '0';
  caption.hidden = !hasCaption;
  caption.style.fontFamily = previewFontFamily(byId('captionFontFamily').value);
  caption.style.fontSize = Math.min(22, Number(byId('captionFontSize').value || 10.5)) + 'px';
  caption.style.lineHeight = String(byId('captionLineSpacing').value || 1.2);
  caption.style.fontWeight = byId('captionBold').checked ? '700' : '400';
  caption.style.fontStyle = byId('captionItalic').checked ? 'italic' : 'normal';
  caption.style.textAlign = byId('imageCaptionCentered').checked ? 'center' : 'left';
  caption.textContent = byId('imageNumberMode').value === 'manual'
    ? '图 1-1：图片说明文字'
    : '图 1：图片说明文字';
  if (hasCaption) {
    if (captionPosition === 'top') preview.insertBefore(caption, image);
    else preview.appendChild(caption);
  }
}

function collectImageSettings() {
  return {
    sizeMode: byId('imageSizeMode').value,
    scalePercent: Number(byId('imageScalePercent').value),
    customPixels: Number(byId('imageCustomPixels').value),
    imageAlignment: byId('imageAlignment').value,
    placement: byId('imagePlacement').value,
    pageBreakBefore: byId('imagePageBreakBefore').checked,
    hasCaption: byId('imageHasCaption').checked,
    captionPosition: byId('imageCaptionPosition').value,
    captionFontFamily: byId('captionFontFamily').value,
    captionFontSize: Number(byId('captionFontSize').value),
    captionLineSpacing: Number(byId('captionLineSpacing').value),
    captionBold: byId('captionBold').checked,
    captionItalic: byId('captionItalic').checked,
    captionCentered: byId('imageCaptionCentered').checked,
    numberMode: byId('imageNumberMode').value
    , lockAspectRatio: byId('imageLockAspect').checked, rotation: Number(byId('imageRotation').value),
    trimLeft: Number(byId('imageTrimLeft').value), trimRight: Number(byId('imageTrimRight').value),
    trimTop: Number(byId('imageTrimTop').value), trimBottom: Number(byId('imageTrimBottom').value)
  };
}

function updateTablePreview() {
  const hasHeader = byId('tableHasHeader').checked;
  byId('headerSettings').hidden = !hasHeader;
  const preview = byId('tableVisualPreview');
  const table = preview.querySelector('table');
  const thead = preview.querySelector('thead');
  const tableCaption = byId('tableCaptionPreview');
  const borderStyle = byId('borderStyle').value;
  thead.hidden = !hasHeader;
  tableCaption.style.textAlign = byId('tableCaptionCentered').checked ? 'center' : 'left';
  tableCaption.style.fontFamily = previewFontFamily(byId('tableCaptionFontFamily').value);
  tableCaption.style.fontSize = Math.min(22, Number(byId('tableCaptionFontSize').value || 10.5)) + 'px';
  tableCaption.style.lineHeight = String(byId('tableCaptionLineSpacing').value || 1.2);
  tableCaption.style.fontWeight = byId('tableCaptionBold').checked ? '700' : '400';
  tableCaption.style.fontStyle = byId('tableCaptionItalic').checked ? 'italic' : 'normal';
  if (byId('captionPosition').value === 'top') preview.insertBefore(tableCaption, table);
  else preview.appendChild(tableCaption);

  table.style.marginLeft = byId('tableAlignment').value === 'center' ? 'auto' : '0';
  table.style.marginRight = byId('tableAlignment').value === 'right' ? '0' : 'auto';
  table.style.width = byId('columnWidthMode').value === 'equal'
    ? `${byId('tableWidthPercent').value}%`
    : 'auto';
  preview.querySelectorAll('td').forEach((cell) => {
    cell.style.fontFamily = previewFontFamily(byId('bodyFontFamily').value);
    cell.style.fontSize = Math.min(22, Number(byId('bodyFontSize').value || 10.5)) + 'px';
    cell.style.fontWeight = byId('bodyBold').checked ? '700' : '400';
    cell.style.fontStyle = byId('bodyItalic').checked ? 'italic' : 'normal';
    cell.style.textAlign = byId('bodyAlignment').value;
  });
  preview.querySelectorAll('th').forEach((cell) => {
    cell.style.fontFamily = previewFontFamily(byId('headerFontFamily').value);
    cell.style.fontSize = Math.min(22, Number(byId('headerFontSize').value || 10.5)) + 'px';
    cell.style.fontWeight = byId('headerBold').checked ? '700' : '400';
    cell.style.fontStyle = byId('headerItalic').checked ? 'italic' : 'normal';
    cell.style.textAlign = byId('headerAlignment').value;
  });
  preview.querySelectorAll('th,td').forEach((cell) => {
    cell.style.border = borderStyle === 'grid' ? '1px solid var(--vscode-panel-border)' : 'none';
  });
  table.style.borderTop = borderStyle === 'threeLine' ? '2px solid var(--vscode-foreground)' : 'none';
  table.style.borderBottom = borderStyle === 'threeLine' ? '2px solid var(--vscode-foreground)' : 'none';
  thead.style.borderBottom = borderStyle === 'threeLine' && hasHeader ? '1px solid var(--vscode-foreground)' : 'none';
}

function collectTableSettings() {
  return {
    hasHeader: byId('tableHasHeader').checked,
    tableAlignment: byId('tableAlignment').value,
    columnWidthMode: byId('columnWidthMode').value,
    tableWidthPercent: Number(byId('tableWidthPercent').value),
    borderStyle: byId('borderStyle').value,
    captionPosition: byId('captionPosition').value,
    captionCentered: byId('tableCaptionCentered').checked,
    tableCaptionFontFamily: byId('tableCaptionFontFamily').value,
    tableCaptionFontSize: Number(byId('tableCaptionFontSize').value),
    tableCaptionLineSpacing: Number(byId('tableCaptionLineSpacing').value),
    tableCaptionBold: byId('tableCaptionBold').checked,
    tableCaptionItalic: byId('tableCaptionItalic').checked,
    placement: byId('tablePlacement').value,
    pageBreakBefore: byId('tablePageBreakBefore').checked,
    bodyFontFamily: byId('bodyFontFamily').value,
    bodyFontSize: Number(byId('bodyFontSize').value),
    bodyLineSpacing: Number(byId('bodyLineSpacing').value),
    bodyAlignment: byId('bodyAlignment').value,
    bodyBold: byId('bodyBold').checked,
    bodyItalic: byId('bodyItalic').checked,
    headerFontFamily: byId('headerFontFamily').value,
    headerFontSize: Number(byId('headerFontSize').value),
    headerLineSpacing: Number(byId('headerLineSpacing').value),
    headerAlignment: byId('headerAlignment').value,
    headerBold: byId('headerBold').checked,
    headerItalic: byId('headerItalic').checked,
    repeatHeader: byId('tableRepeatHeader').checked,
    allowRowBreak: byId('tableAllowRowBreak').checked,
    columnWidths: byId('tableColumnWidths').value.split(/[,，]/).map(Number).filter((value) => Number.isFinite(value) && value > 0),
    verticalAlignment: byId('tableVerticalAlignment').value
  };
}

function updateGridSelection(rows, columns) {
  const safeRows = Math.max(1, Math.min(30, Number(rows) || 1));
  const safeColumns = Math.max(1, Math.min(12, Number(columns) || 1));
  byId('tableRows').value = safeRows;
  byId('tableColumns').value = safeColumns;
  byId('tableSizeSummary').textContent = `${safeColumns} 列 × ${safeRows} 行`;
  byId('tableGrid').querySelectorAll('button').forEach((cell) => {
    cell.classList.toggle('selected', Number(cell.dataset.row) <= safeRows && Number(cell.dataset.column) <= safeColumns);
  });
  renderTableContentGrid(safeRows, safeColumns);
}

function readTableCells() {
  const rows = Number(byId('tableRows').value) || 1;
  const columns = Number(byId('tableColumns').value) || 1;
  return Array.from({ length: rows }, (_, rowIndex) => (
    Array.from({ length: columns }, (_, columnIndex) => (
      byId('tableContentGrid').querySelector(`[data-row="${rowIndex}"][data-column="${columnIndex}"]`)?.value || ''
    ))
  ));
}

function renderTableContentGrid(rows, columns, suppliedValues) {
  const previous = suppliedValues || readTableCells();
  const table = byId('tableContentGrid');
  table.innerHTML = '';
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement('tr');
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cell = document.createElement('td');
      cell.dataset.row = rowIndex;
      cell.dataset.column = columnIndex;
      cell.addEventListener('click', (event) => { if (event.target === cell || event.ctrlKey) cell.classList.toggle('selected-cell'); });
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.row = rowIndex;
      input.dataset.column = columnIndex;
      const header = pendingTablePreset?.hasHeader && rowIndex === 0;
      input.placeholder = `第${rowIndex + 1}行第${columnIndex + 1}列${header ? '表头' : '内容'}`;
      input.value = suppliedValues?.[rowIndex]?.[columnIndex] || previous?.[rowIndex]?.[columnIndex] || '';
      cell.appendChild(input);
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  for (const merge of pendingTableMerges) {
    const start = table.querySelector(`td[data-row="${merge.row}"][data-column="${merge.column}"]`);
    if (!start || merge.colspan < 2) continue;
    start.colSpan = merge.colspan;
    for (let offset = 1; offset < merge.colspan; offset += 1) table.querySelector(`td[data-row="${merge.row}"][data-column="${merge.column + offset}"]`)?.setAttribute('hidden', '');
  }
}

function createTableGrid() {
  const grid = byId('tableGrid');
  for (let row = 1; row <= 10; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.row = row;
      cell.dataset.column = column;
      cell.title = `${column} 列 × ${row} 行`;
      cell.addEventListener('click', () => updateGridSelection(row, column));
      grid.appendChild(cell);
    }
  }
}

function openTableSizeChooser(preset) {
  pendingTablePreset = preset;
  pendingTableEdit = false;
  pendingTableMerges = [];
  byId('tableSizeTitle').textContent = `插入“${preset.name}”`;
  byId('tableRowHint').textContent = preset.hasHeader ? '总行数包含第一行表头。' : '这个样式没有表头，全部行都使用内容格式。';
  byId('tableInsertTitle').value = '';
  byId('tableInsertLabel').value = `table-${Date.now()}`;
  byId('confirmTableButton').textContent = '插入表格';
  byId('tableContentGrid').innerHTML = '';
  updateGridSelection(preset.hasHeader ? 3 : 2, 3);
  tableSizeDialog.showModal();
}

function openExistingTable(data) {
  pendingTablePreset = { id: '', name: '当前表格', hasHeader: data.settings?.hasHeader !== false };
  pendingTableEdit = true;
  pendingTableMerges = Array.isArray(data.merges) ? data.merges : [];
  byId('tableSizeTitle').textContent = '修改表格内容';
  byId('tableRowHint').textContent = pendingTablePreset.hasHeader ? '总行数包含第一行表头。' : '当前表格没有表头。';
  byId('tableInsertTitle').value = data.title || '';
  byId('tableInsertLabel').value = data.label || `table-${Date.now()}`;
  byId('confirmTableButton').textContent = '应用修改';
  byId('tableContentGrid').innerHTML = '';
  updateGridSelection(data.rows || 3, data.columns || 3);
  renderTableContentGrid(data.rows || 3, data.columns || 3, data.cells || []);
  tableSizeDialog.showModal();
}

function submitTableSize(rows, columns) {
  if (!pendingTablePreset) return;
  vscode.postMessage({
    type: pendingTableEdit ? 'updateTableContent' : 'insertTable', id: pendingTablePreset.id,
    rows: Number(rows), columns: Number(columns),
    title: byId('tableInsertTitle').value.trim(),
    label: byId('tableInsertLabel').value.trim(),
    cells: readTableCells(), merges: pendingTableMerges
  });
  tableSizeDialog.close();
  pendingTablePreset = null;
  pendingTableEdit = false;
  pendingTableMerges = [];
}

function resizeTable(deltaRows, deltaColumns) {
  const rows = Math.max(1, Math.min(30, Number(byId('tableRows').value) + deltaRows));
  const columns = Math.max(1, Math.min(12, Number(byId('tableColumns').value) + deltaColumns));
  pendingTableMerges = pendingTableMerges.filter((item) => item.row < rows && item.column + item.colspan <= columns);
  updateGridSelection(rows, columns);
}

function mergeSelectedTableCells() {
  const selected = [...byId('tableContentGrid').querySelectorAll('td.selected-cell')];
  if (selected.length < 2) return;
  const rows = new Set(selected.map((cell) => Number(cell.dataset.row)));
  if (rows.size !== 1) return;
  const row = Number(selected[0].dataset.row);
  const columns = selected.map((cell) => Number(cell.dataset.column)).sort((a, b) => a - b);
  if (columns.some((value, index) => index && value !== columns[index - 1] + 1)) return;
  pendingTableMerges.push({ row, column: columns[0], colspan: columns.length });
  renderTableContentGrid(Number(byId('tableRows').value), Number(byId('tableColumns').value));
}

function splitSelectedTableCells() {
  const selected = [...byId('tableContentGrid').querySelectorAll('td.selected-cell')];
  if (!selected.length) { pendingTableMerges = []; }
  else {
    const keys = new Set(selected.map((cell) => `${cell.dataset.row}:${cell.dataset.column}`));
    pendingTableMerges = pendingTableMerges.filter((item) => !keys.has(`${item.row}:${item.column}`));
  }
  renderTableContentGrid(Number(byId('tableRows').value), Number(byId('tableColumns').value));
}

function openImageChooser(preset) {
  pendingImagePreset = preset;
  selectedImageLatexPath = '';
  byId('imageInsertTitle').textContent = `插入“${preset.name}”`;
  byId('selectedImage').hidden = true;
  byId('selectedImageName').textContent = '';
  byId('selectedImagePreview').hidden = true;
  byId('selectedImagePreview').removeAttribute('src');
  byId('customFigureNumber').value = '';
  byId('imageInsertNumberSetting').hidden = preset.numberMode !== 'manual';
  byId('imageCaptionText').value = '';
  byId('imageLabel').value = '';
  byId('imageInsertCaptionFields').hidden = preset.hasCaption === false;
  updateImageInsertButton();
  imageInsertDialog.showModal();
}

function updateImageInsertButton() {
  const needsNumber = pendingImagePreset?.numberMode === 'manual';
  const hasNumber = byId('customFigureNumber').value.trim().length > 0;
  const needsCaption = pendingImagePreset?.hasCaption !== false;
  const hasCaption = byId('imageCaptionText').value.trim().length > 0;
  byId('confirmImageInsertButton').disabled = !selectedImageLatexPath || (needsNumber && !hasNumber) || (needsCaption && !hasCaption);
}

function setSelectedImage(message) {
  if (!pendingImagePreset || message.presetId !== pendingImagePreset.id) return;
  selectedImageLatexPath = message.latexPath;
  byId('selectedImageName').textContent = message.fileName;
  byId('selectedImage').hidden = false;
  const preview = byId('selectedImagePreview');
  if (message.previewDataUrl) { preview.src = message.previewDataUrl; preview.hidden = false; }
  else { preview.hidden = true; preview.removeAttribute('src'); }
  if (!byId('imageLabel').value.trim()) {
    const baseName = message.fileName.replace(/\.[^.]+$/, '').replace(/[^0-9A-Za-z_-]+/g, '-').replace(/^-+|-+$/g, '');
    byId('imageLabel').value = baseName || `image-${Date.now()}`;
  }
  updateImageInsertButton();
}

function extractDroppedImage(event) {
  const uriList = event.dataTransfer.getData('text/uri-list');
  if (uriList) {
    const uri = uriList.split(/\r?\n/).find((line) => line && !line.startsWith('#'));
    if (uri) return { uri };
  }

  const codeFiles = event.dataTransfer.getData('CodeFiles');
  if (codeFiles) {
    try {
      const files = JSON.parse(codeFiles);
      if (Array.isArray(files) && files[0]) return { path: files[0] };
    } catch {}
  }

  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file && file.path) return { path: file.path };
  return null;
}

function submitImage() {
  if (!pendingImagePreset || !selectedImageLatexPath) return;
  vscode.postMessage({
    type: 'insertImage',
    id: pendingImagePreset.id,
    latexPath: selectedImageLatexPath,
    customFigureNumber: byId('customFigureNumber').value.trim(),
    captionText: byId('imageCaptionText').value.trim(),
    label: byId('imageLabel').value.trim()
  });
  imageInsertDialog.close();
  pendingImagePreset = null;
  selectedImageLatexPath = '';
}

byId('presetForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const kind = byId('kind').value;
  const preset = {
    id: editingId || 'preset-' + Date.now() + '-' + Math.random().toString(16).slice(2),
    name: byId('name').value.trim() || '未命名格式',
    category: byId('category').value.trim() || '其他',
    icon: byId('icon').value.trim() || '✦',
    description: byId('description').value.trim(),
    kind
  };

  if (kind === 'paragraph') {
    preset.settings = {
      fontFamily: byId('fontFamily').value,
      fontSize: Number(byId('fontSize').value), lineSpacingMode: byId('lineSpacingMode').value,
      lineSpacingValue: Number(byId('lineSpacingValue').value), beforeMode: byId('beforeMode').value,
      beforeValue: Number(byId('beforeValue').value), afterMode: byId('afterMode').value,
      afterValue: Number(byId('afterValue').value), leftIndent: Number(byId('leftIndent').value),
      rightIndent: Number(byId('rightIndent').value), indentMode: byId('indentMode').value,
      indentValue: Number(byId('indentValue').value), alignment, bold, italic,
      pageBreakBefore: byId('pageBreakBefore').checked,
      keepWithNext: byId('keepWithNext').checked,
      avoidWidowOrphan: byId('avoidWidowOrphan').checked
    };
  } else if (kind === 'image') {
    preset.settings = collectImageSettings();
  } else if (kind === 'table') {
    preset.settings = collectTableSettings();
  } else {
    preset.template = byId('template').value || '${TM_SELECTED_TEXT:在此输入内容}';
  }

  if (editingInsertedTable && kind === 'table') {
    vscode.postMessage({ type: 'updateTableStyle', settings: preset.settings });
    editingInsertedTable = false;
  } else {
    vscode.postMessage({ type: 'savePreset', preset });
  }
  dialog.close();
});

byId('tableSizeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitTableSize(byId('tableRows').value, byId('tableColumns').value);
});
byId('kind').addEventListener('change', updateKind);
['fontFamily', 'fontSize', 'lineSpacingMode', 'lineSpacingValue', 'beforeMode', 'beforeValue', 'afterMode', 'afterValue', 'leftIndent', 'rightIndent', 'indentMode', 'indentValue', 'pageBreakBefore', 'keepWithNext', 'avoidWidowOrphan'].forEach((id) => {
  byId(id).addEventListener('input', updateParagraphPreview);
});
byId('boldButton').addEventListener('click', () => { bold = !bold; updateParagraphPreview(); });
byId('italicButton').addEventListener('click', () => { italic = !italic; updateParagraphPreview(); });
document.querySelectorAll('.align').forEach((button) => {
  button.addEventListener('click', () => { alignment = button.dataset.align; updateParagraphPreview(); });
});

[
  'imageSizeMode', 'imageScalePercent', 'imageCustomPixels', 'imageAlignment', 'imagePlacement', 'imagePageBreakBefore', 'imageHasCaption', 'imageCaptionPosition',
  'captionFontFamily', 'captionFontSize', 'captionLineSpacing', 'captionBold', 'captionItalic', 'imageCaptionCentered', 'imageNumberMode',
  'imageLockAspect', 'imageRotation', 'imageTrimLeft', 'imageTrimRight', 'imageTrimTop', 'imageTrimBottom'
].forEach((id) => {
  byId(id).addEventListener('input', updateImagePreview);
  byId(id).addEventListener('change', updateImagePreview);
});

[
  'tableHasHeader', 'tableAlignment', 'columnWidthMode', 'tableWidthPercent', 'borderStyle', 'captionPosition', 'tablePlacement', 'tablePageBreakBefore', 'tableCaptionCentered',
  'tableCaptionFontFamily', 'tableCaptionFontSize', 'tableCaptionLineSpacing', 'tableCaptionBold', 'tableCaptionItalic',
  'bodyFontFamily', 'bodyFontSize', 'bodyLineSpacing', 'bodyAlignment', 'bodyBold', 'bodyItalic',
  'headerFontFamily', 'headerFontSize', 'headerLineSpacing', 'headerAlignment', 'headerBold', 'headerItalic',
  'tableRepeatHeader', 'tableAllowRowBreak', 'tableColumnWidths', 'tableVerticalAlignment'
].forEach((id) => {
  byId(id).addEventListener('input', updateTablePreview);
  byId(id).addEventListener('change', updateTablePreview);
});

byId('tableRows').addEventListener('input', () => updateGridSelection(byId('tableRows').value, byId('tableColumns').value));
byId('tableColumns').addEventListener('input', () => updateGridSelection(byId('tableRows').value, byId('tableColumns').value));
byId('addTableRow').addEventListener('click', () => resizeTable(1, 0));
byId('removeTableRow').addEventListener('click', () => resizeTable(-1, 0));
byId('addTableColumn').addEventListener('click', () => resizeTable(0, 1));
byId('removeTableColumn').addEventListener('click', () => resizeTable(0, -1));
byId('mergeTableCells').addEventListener('click', mergeSelectedTableCells);
byId('splitTableCells').addEventListener('click', splitSelectedTableCells);
byId('newButton').addEventListener('click', () => openEditor());
byId('emptyNewButton').addEventListener('click', () => openEditor());
byId('schemeButton').addEventListener('click', openSchemeEditor);
byId('tocButton').addEventListener('click', () => openTocSettings());
byId('pageButton').addEventListener('click', () => openPageSettings());
byId('documentButton').addEventListener('click', () => vscode.postMessage({ type: 'openDocumentTool' }));
byId('formulaButton').addEventListener('click', () => vscode.postMessage({ type: 'openFormula' }));
byId('previewButton').addEventListener('click', () => vscode.postMessage({ type: 'previewPdf' }));
byId('outlineButton').addEventListener('click', openOutline);
byId('closeOutlineButton').addEventListener('click', () => outlineDialog.close());
byId('refreshOutlineButton').addEventListener('click', () => vscode.postMessage({ type: 'getOutline' }));
byId('closeSchemeButton').addEventListener('click', () => schemeDialog.close());
byId('cancelSchemeButton').addEventListener('click', () => schemeDialog.close());
byId('closeTocButton').addEventListener('click', () => tocDialog.close());
byId('cancelTocButton').addEventListener('click', () => tocDialog.close());
byId('saveTocButton').addEventListener('click', () => { tocPreviewOnSubmit = false; });
byId('refreshTocButton').addEventListener('click', () => { tocPreviewOnSubmit = true; });
byId('tocForm').addEventListener('submit', (event) => {
  event.preventDefault();
  vscode.postMessage({ type: 'applyToc', settings: collectTocSettings(), preview: tocPreviewOnSubmit });
  tocDialog.close();
});
byId('deleteTocButton').addEventListener('click', () => {
  vscode.postMessage({ type: 'deleteToc' });
  tocDialog.close();
});
['tocTitle', 'tocDepth', 'tocFontFamily', 'tocFontSize', 'tocTitleBold', 'tocAlignment', 'tocShowPageNumbers', 'tocLeaderStyle',
  'tocLevel1Size', 'tocLevel1Indent', 'tocLevel1Spacing', 'tocLevel2Size', 'tocLevel2Indent', 'tocLevel2Spacing', 'tocLevel3Size', 'tocLevel3Indent', 'tocLevel3Spacing'].forEach((id) => {
  byId(id).addEventListener('input', updateTocPreview);
  byId(id).addEventListener('change', updateTocPreview);
});
byId('closePageButton').addEventListener('click', () => pageDialog.close());
byId('cancelPageButton').addEventListener('click', () => pageDialog.close());
byId('pageForm').addEventListener('submit', (event) => {
  event.preventDefault();
  vscode.postMessage({ type: 'applyPageSettings', settings: collectPageSettings() });
  pageDialog.close();
});
byId('deletePageButton').addEventListener('click', () => {
  vscode.postMessage({ type: 'deletePageSettings' });
  pageDialog.close();
});
byId('resetPageButton').addEventListener('click', () => setPageFields(defaultPageSettings()));
byId('pagePreset').addEventListener('change', () => setPageFields(pagePresetValue(byId('pagePreset').value)));
[
  'pageHeaderEnabled', 'pageHeaderMode', 'pageHeaderText', 'pageHeaderFont', 'pageHeaderSize', 'pageHeaderBold', 'pageHeaderItalic', 'pageHeaderAlignment', 'pageHeaderDistance', 'pageHeaderLine',
  'pageFooterEnabled', 'pageFooterMode', 'pageFooterText', 'pageFooterFont', 'pageFooterSize', 'pageFooterBold', 'pageFooterItalic', 'pageFooterAlignment', 'pageFooterDistance', 'pageFooterLine',
  'pageNumberEnabled', 'pageNumberArea', 'pageNumberPosition', 'pageNumberFormat', 'pageStartNumber', 'pageStartAt',
  'pageFirstMode', 'pageFirstHeaderText', 'pageFirstFooterText', 'pageFirstShowNumber', 'pageFirstHeaderAlignment', 'pageFirstFooterAlignment',
  'pageHeaderEdgeDistance', 'pageFooterEdgeDistance', 'pageDifferentOddEven', 'pageOddHeaderText', 'pageEvenHeaderText', 'pageOddFooterText', 'pageEvenFooterText',
  'pagePaper', 'pageOrientation', 'pageColumns', 'pageMarginTop', 'pageMarginBottom', 'pageMarginLeft', 'pageMarginRight', 'pageBindingOffset', 'pageMirroredMargins'
].forEach((id) => {
  byId(id).addEventListener('input', () => { byId('pagePreset').value = 'custom'; updatePagePreview(); });
  byId(id).addEventListener('change', () => { byId('pagePreset').value = 'custom'; updatePagePreview(); });
});
byId('schemeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  vscode.postMessage({
    type: 'saveDocumentScheme',
    scheme: {
      name: byId('schemeName').value.trim(),
      bodyFontFamily: byId('schemeBodyFont').value,
      bodyFontSize: Number(byId('schemeBodySize').value),
      bodyLineSpacing: Number(byId('schemeBodySpacing').value),
      avoidWidowOrphan: byId('schemeAvoidWidow').checked,
      headingFontFamily: byId('schemeHeadingFont').value,
      heading1FontSize: Number(byId('schemeHeading1Size').value),
      heading2FontSize: Number(byId('schemeHeading2Size').value),
      heading1PageBreakBefore: byId('schemeHeading1PageBreak').checked,
      captionFontFamily: byId('schemeCaptionFont').value,
      captionFontSize: Number(byId('schemeCaptionSize').value),
      tableFontSize: Number(byId('schemeTableSize').value)
    }
  });
  schemeDialog.close();
});
byId('closeButton').addEventListener('click', () => dialog.close());
byId('cancelButton').addEventListener('click', () => dialog.close());
byId('closeTableSizeButton').addEventListener('click', () => tableSizeDialog.close());
byId('cancelTableSizeButton').addEventListener('click', () => tableSizeDialog.close());
byId('imageInsertForm').addEventListener('submit', (event) => { event.preventDefault(); submitImage(); });
byId('closeImageInsertButton').addEventListener('click', () => imageInsertDialog.close());
byId('cancelImageInsertButton').addEventListener('click', () => imageInsertDialog.close());
byId('browseImageButton').addEventListener('click', () => {
  if (pendingImagePreset) vscode.postMessage({ type: 'browseImage', id: pendingImagePreset.id });
});
byId('customFigureNumber').addEventListener('input', updateImageInsertButton);
byId('imageCaptionText').addEventListener('input', updateImageInsertButton);

const imageDropZone = byId('imageDropZone');
imageDropZone.addEventListener('dragenter', (event) => { event.preventDefault(); imageDropZone.classList.add('dragging'); });
imageDropZone.addEventListener('dragover', (event) => { event.preventDefault(); imageDropZone.classList.add('dragging'); });
imageDropZone.addEventListener('dragleave', () => imageDropZone.classList.remove('dragging'));
imageDropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  imageDropZone.classList.remove('dragging');
  if (!pendingImagePreset) return;
  const dropped = extractDroppedImage(event);
  if (dropped) vscode.postMessage({ type: 'droppedImage', id: pendingImagePreset.id, ...dropped });
  else vscode.postMessage({ type: 'browseImage', id: pendingImagePreset.id });
});
byId('helpButton').addEventListener('click', () => vscode.postMessage({ type: 'openHelp' }));
byId('importButton').addEventListener('click', () => vscode.postMessage({ type: 'importPresets' }));
byId('exportButton').addEventListener('click', () => vscode.postMessage({ type: 'exportPresets' }));
byId('resetButton').addEventListener('click', () => vscode.postMessage({ type: 'resetDefaults' }));

window.addEventListener('message', (event) => {
  if (event.data.type === 'state') {
    presets = event.data.presets || [];
    documentScheme = event.data.documentScheme || {};
    tocSettings = event.data.tocSettings || {};
    pageSettings = event.data.pageSettings || {};
    render();
  }
  if (event.data.type === 'chooseTableSize') openTableSizeChooser(event.data.preset);
  if (event.data.type === 'editTableContent') openExistingTable(event.data.table);
  if (event.data.type === 'editInsertedTableStyle') {
    openEditor({
      id: '', name: '当前表格', category: '图表', icon: '表', description: '修改已插入表格',
      kind: 'table', settings: event.data.table.settings
    }, true);
    byId('dialogTitle').textContent = '修改已插入表格样式';
  }
  if (event.data.type === 'chooseImage') openImageChooser(event.data.preset);
  if (event.data.type === 'imageSelected') setSelectedImage(event.data);
  if (event.data.type === 'outlineData') renderOutline(event.data);
  if (event.data.type === 'editTocSettings') openTocSettings(event.data.settings);
  if (event.data.type === 'editPageSettings') openPageSettings(event.data.settings);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.card-menu')) {
    document.querySelectorAll('.menu.open').forEach((menu) => menu.classList.remove('open'));
  }
});

createTableGrid();
['fontSize', 'captionFontSize', 'tableCaptionFontSize', 'bodyFontSize', 'headerFontSize', 'tocFontSize', 'pageHeaderSize', 'pageFooterSize', 'schemeBodySize', 'schemeHeading1Size', 'schemeHeading2Size', 'schemeCaptionSize', 'schemeTableSize'].forEach((id) => enableCustomNumberChoice(id));
vscode.postMessage({ type: 'ready' });
