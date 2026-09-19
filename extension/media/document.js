'use strict';

const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
let latestIssues = [];

function collectTemplate() {
  return {
    name: $('templateName').value.trim(),
    documentClass: $('documentClass').value,
    paperSize: $('paperSize').value,
    baseFontSize: $('baseFontSize').value,
    titleEnabled: $('titleEnabled').checked,
    title: $('documentTitle').value.trim(),
    subtitle: $('subtitle').value.trim(),
    authorEnabled: $('authorEnabled').checked,
    author: $('author').value.trim(),
    institution: $('institution').value.trim(),
    major: $('major').value.trim(),
    advisor: $('advisor').value.trim(),
    dateMode: $('dateMode').value,
    date: $('manualDate').value.trim(),
    includeTitlePage: $('includeTitlePage').checked,
    includeAbstract: $('includeAbstract').checked,
    abstractText: $('abstractText').value.trim(),
    keywords: $('keywords').value.trim(),
    includeToc: $('includeToc').checked,
    includePageSettings: $('includePageSettings').checked,
    includeCommonPackages: $('includeCommonPackages').checked
  };
}

function setTemplate(template) {
  const value = template || {};
  $('templateName').value = value.name || '默认论文文档';
  $('documentClass').value = value.documentClass || 'ctexart';
  $('baseFontSize').value = value.baseFontSize || '12pt';
  $('paperSize').value = value.paperSize || 'a4paper';
  $('titleEnabled').checked = value.titleEnabled !== false;
  $('documentTitle').value = value.title || '';
  $('subtitle').value = value.subtitle || '';
  $('authorEnabled').checked = value.authorEnabled !== false;
  $('author').value = value.author || '';
  $('institution').value = value.institution || '';
  $('major').value = value.major || '';
  $('advisor').value = value.advisor || '';
  $('dateMode').value = value.dateMode || 'automatic';
  $('manualDate').value = value.date || '';
  $('includeTitlePage').checked = value.includeTitlePage !== false;
  $('includeAbstract').checked = value.includeAbstract !== false;
  $('abstractText').value = value.abstractText || '';
  $('keywords').value = value.keywords || '';
  $('includeToc').checked = Boolean(value.includeToc);
  $('includePageSettings').checked = Boolean(value.includePageSettings);
  $('includeCommonPackages').checked = value.includeCommonPackages !== false;
  updatePreview();
}

function updatePreview() {
  const value = collectTemplate();
  $('manualDateWrap').hidden = value.dateMode !== 'manual';
  $('previewTitle').textContent = value.titleEnabled ? (value.title || '论文标题') : '（不显示标题）';
  $('previewSubtitle').textContent = value.titleEnabled ? value.subtitle : '';
  const meta = [];
  if (value.authorEnabled) meta.push(value.author || '作者姓名');
  if (value.institution) meta.push(value.institution);
  if (value.major) meta.push(`专业：${value.major}`);
  if (value.advisor) meta.push(`指导教师：${value.advisor}`);
  if (value.dateMode === 'automatic') meta.push('当天日期');
  if (value.dateMode === 'manual' && value.date) meta.push(value.date);
  $('previewMeta').textContent = meta.join('　·　');
  $('previewAbstract').textContent = value.includeAbstract ? `摘要　${value.abstractText || '请在此输入摘要。'}` : '';
  $('previewKeywords').textContent = value.includeAbstract && value.keywords ? `关键词：${value.keywords}` : '';
}

function switchTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  $('createPanel').hidden = name !== 'create';
  $('checkPanel').hidden = name !== 'check';
}

function selectedFixIds(onlySafe = false) {
  if (onlySafe) return latestIssues.filter((issue) => issue.fixable && issue.safety === 'safe').map((issue) => issue.id);
  return [...document.querySelectorAll('.issue input[type="checkbox"]:checked')].map((input) => input.dataset.issueId);
}

function renderIssues(issues) {
  latestIssues = issues || [];
  const list = $('issueList');
  list.innerHTML = '';
  const errors = latestIssues.filter((issue) => issue.severity === 'error').length;
  const warnings = latestIssues.filter((issue) => issue.severity === 'warning').length;
  $('checkSummary').textContent = latestIssues.length
    ? `发现 ${latestIssues.length} 个问题：${errors} 个错误，${warnings} 个提醒。带复选框的项目可以预览修复。`
    : '没有发现明显的 LaTeX 结构问题。';
  latestIssues.forEach((issue) => {
    const row = document.createElement('div');
    row.className = `issue ${issue.severity}`;
    const select = document.createElement('div');
    if (issue.fixable) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.issueId = issue.id;
      checkbox.checked = issue.safety === 'safe';
      checkbox.title = issue.safety === 'safe' ? '安全修复，默认选中' : '需要确认，查看预览后再应用';
      select.appendChild(checkbox);
    }
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = issue.title;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = issue.category;
    title.appendChild(badge);
    if (issue.fixable) {
      const safety = document.createElement('span');
      safety.className = 'badge';
      safety.textContent = issue.safety === 'safe' ? '安全修复' : '确认后修复';
      title.appendChild(safety);
    }
    const detail = document.createElement('p');
    detail.textContent = `第 ${issue.line} 行　${issue.detail}`;
    content.append(title, detail);
    const navigate = document.createElement('button');
    navigate.className = 'secondary';
    navigate.textContent = '转到位置';
    navigate.addEventListener('click', () => vscode.postMessage({ type: 'navigateIssue', line: issue.line }));
    row.append(select, content, navigate);
    list.appendChild(row);
  });
}

document.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
document.querySelectorAll('#documentForm input, #documentForm select, #documentForm textarea').forEach((control) => {
  control.addEventListener('input', updatePreview);
  control.addEventListener('change', updatePreview);
});
$('documentForm').addEventListener('submit', (event) => {
  event.preventDefault();
  vscode.postMessage({ type: 'createDocument', template: collectTemplate() });
});
$('quickCreate').addEventListener('click', () => vscode.postMessage({ type: 'quickCreate' }));
$('saveDefault').addEventListener('click', () => vscode.postMessage({ type: 'saveDefault', template: collectTemplate() }));
$('exportTemplate').addEventListener('click', () => vscode.postMessage({ type: 'exportTemplate', template: collectTemplate() }));
$('checkNow').addEventListener('click', () => vscode.postMessage({ type: 'checkDocument' }));
$('checkOnSave').addEventListener('change', () => vscode.postMessage({ type: 'toggleCheckOnSave', enabled: $('checkOnSave').checked }));
$('previewSafe').addEventListener('click', () => vscode.postMessage({ type: 'previewFixes', ids: selectedFixIds(true) }));
$('previewSelected').addEventListener('click', () => vscode.postMessage({ type: 'previewFixes', ids: selectedFixIds(false) }));
$('explainLog').addEventListener('click', () => vscode.postMessage({ type: 'explainLog' }));
$('closeRepair').addEventListener('click', () => $('repairDialog').close());
$('cancelRepair').addEventListener('click', () => $('repairDialog').close());
$('applyRepair').addEventListener('click', () => { vscode.postMessage({ type: 'applyPrepared' }); $('repairDialog').close(); });

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'state' || message.type === 'checkResult') {
    if (message.template) setTemplate(message.template);
    if (typeof message.checkOnSave === 'boolean') $('checkOnSave').checked = message.checkOnSave;
    if (message.currentFile !== undefined) $('currentFile').textContent = message.currentFile || '尚未选择文档';
    if (message.issues) renderIssues(message.issues);
  }
  if (message.type === 'repairPreview') {
    $('repairCount').textContent = `准备应用 ${message.count} 项修复。请重点检查高亮范围附近的代码。`;
    $('beforeRepair').textContent = message.before;
    $('afterRepair').textContent = message.after;
    $('repairDialog').showModal();
  }
  if (message.type === 'logExplanation') {
    $('logList').innerHTML = '';
    (message.explanations || []).forEach((explanation) => {
      const item = document.createElement('li');
      item.textContent = explanation;
      $('logList').appendChild(item);
    });
    $('logCard').hidden = false;
  }
});

vscode.postMessage({ type: 'ready' });
