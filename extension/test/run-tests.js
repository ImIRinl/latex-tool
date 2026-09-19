'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const vscodeStub = {};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') return vscodeStub;
  return originalLoad.call(this, request, parent, isMain);
};

const {
  buildImageSnippet,
  activate,
  buildNewDocument,
  buildFormulaBlock,
  buildFormulaExpression,
  buildParagraphSnippet,
  buildPageNumberStartBlock,
  buildPageStyleBlock,
  buildSchemeHeadingTemplate,
  buildTableSnippet,
  buildTocBlock,
  decodeMetadata,
  findFigureBlockInText,
  findManagedBlockInText,
  getMissingPackages,
  estimateFormulaNumberContext,
  analyzeLatexDocument,
  applyLatexFixes,
  normalizePreset,
  parseFigureProperties,
  sanitizeSettings,
  sanitizeFormulaData,
  sanitizeFormulaStyle,
  sanitizeDocumentScheme,
  sanitizeDocumentTemplate,
  sanitizePageSettings,
  sanitizeTableSettings,
  sanitizeTocSettings,
  scanDocumentOutline,
  updateFigureBlock
} = require('../extension');

const settings = sanitizeSettings({ fontFamily: 'songti', fontSize: 12, lineSpacingMode: 'multiple', lineSpacingValue: 1.5, indentMode: 'first', indentValue: 2, alignment: 'center', bold: true, beforeMode: 'lines', beforeValue: 1, afterMode: 'lines', afterValue: 0.5 });
assert.strictEqual(settings.fontSize, 12);
assert.strictEqual(settings.lineSpacingValue, 1.5);
assert.strictEqual(settings.alignment, 'center');
assert.strictEqual(settings.bold, true);
assert.strictEqual(settings.fontFamily, 'songti');

const snippet = buildParagraphSnippet(settings);
assert(snippet.includes('\\fontsize{12pt}{18pt}\\selectfont'));
assert(snippet.includes('\\songti'));
assert(snippet.includes('\\vspace{1\\baselineskip}'));
assert(snippet.includes('\\vspace{0.5\\baselineskip}'));
assert(snippet.includes('\\begin{center}'));
assert(snippet.includes('\\textbf{'));
assert(snippet.includes('% LFP:paragraph:content:start'));
assert(snippet.includes('${TM_SELECTED_TEXT:在此输入内容}'));
assert(snippet.includes('% LFP:paragraph:end'));
const paginatedParagraph = buildParagraphSnippet({
  fontFamily: 'heiti', pageBreakBefore: true, keepWithNext: true, avoidWidowOrphan: true
}, '测试内容');
assert(paginatedParagraph.includes('\\clearpage'));
assert(paginatedParagraph.includes('\\nopagebreak[4]'));
assert(paginatedParagraph.includes('\\widowpenalty=10000'));
const managedParagraph = findManagedBlockInText(paginatedParagraph, paginatedParagraph.indexOf('测试内容'), 'paragraph');
assert(managedParagraph);
assert.strictEqual(decodeMetadata(managedParagraph.text.match(/% LFP:paragraph:start ([^\r\n]+)/)[1]).fontFamily, 'heiti');
const wordParagraph = buildParagraphSnippet({
  lineSpacingMode: 'fixed', lineSpacingValue: 20, beforeMode: 'pt', beforeValue: 6,
  afterMode: 'lines', afterValue: 0.5, leftIndent: 1, rightIndent: 1.5,
  indentMode: 'hanging', indentValue: 2, alignment: 'justify'
}, '悬挂缩进测试');
assert(wordParagraph.includes('\\fontsize{12pt}{20pt}'));
assert(wordParagraph.includes('\\vspace{6pt}'));
assert(wordParagraph.includes('\\setlength{\\hangindent}{2em}'));

const unsafe = sanitizeSettings({ fontSize: 1000, lineSpacingMode: 'multiple', lineSpacingValue: -1, alignment: 'unknown' });
assert.strictEqual(unsafe.fontSize, 72);
assert.strictEqual(unsafe.lineSpacingValue, 0.5);

const scheme = sanitizeDocumentScheme({ name: '学校论文', bodyFontFamily: 'songti', headingFontFamily: 'heiti' });
const headingTemplate = buildSchemeHeadingTemplate('section', scheme, 16, true);
assert(headingTemplate.includes('\\clearpage'));
assert(headingTemplate.includes('\\section'));
assert(headingTemplate.includes('${TM_SELECTED_TEXT:标题}'));
assert(headingTemplate.includes('\\nopagebreak[4]'));
assert.strictEqual(unsafe.alignment, 'justify');

const tocSettings = sanitizeTocSettings({
  title: '目　录', depth: 2, titleFontFamily: 'heiti', titleFontSize: 16,
  titleAlignment: 'center', showPageNumbers: false, leaderStyle: 'blank'
});
const tocBlock = buildTocBlock(tocSettings);
assert(tocBlock.includes('% LFP:toc:start '));
assert(tocBlock.includes('\\setcounter{tocdepth}{2}'));
assert(tocBlock.includes('\\renewcommand{\\contentsname}{目　录}'));
assert(tocBlock.includes('\\cftpagenumbersoff{section}'));
assert(tocBlock.includes('\\renewcommand{\\cftsecleader}{\\hfill}'));
assert(tocBlock.includes('\\tableofcontents'));
assert(findManagedBlockInText(tocBlock, tocBlock.indexOf('tableofcontents'), 'toc'));

const pageSettings = sanitizePageSettings({
  headerEnabled: true, headerContentMode: 'title', headerFontFamily: 'songti',
  footerEnabled: true, footerText: '某某大学', pageNumberEnabled: true,
  pageNumberArea: 'footer', pageNumberPosition: 'right', pageNumberFormat: 'roman',
  startNumber: 3, startAt: 'current', firstPageMode: 'separate',
  firstHeaderText: '封面', firstFooterText: '学位论文', firstShowPageNumber: false
});
const pageBlock = buildPageStyleBlock(pageSettings);
assert(pageBlock.includes('% LFP:page:start '));
assert(pageBlock.includes('\\fancyhead[C]'));
assert(pageBlock.includes('\\@title'));
assert(pageBlock.includes('\\fancyfoot[R]{\\thepage}'));
assert(pageBlock.includes('\\fancypagestyle{lfpfirstpage}'));
assert(!pageBlock.includes('\\AtBeginDocument{\\pagenumbering{roman}'));
const pageNumberStart = buildPageNumberStartBlock(pageSettings);
assert(pageNumberStart.includes('\\pagenumbering{roman}'));
assert(pageNumberStart.includes('\\setcounter{page}{3}'));
assert(findManagedBlockInText(pageNumberStart, pageNumberStart.indexOf('pagenumbering'), 'page-number'));

const documentPageBlock = buildPageStyleBlock({ ...pageSettings, startAt: 'document' });
assert(documentPageBlock.includes('\\AtBeginDocument{\\pagenumbering{roman}\\setcounter{page}{3}}'));
const advancedPageBlock = buildPageStyleBlock({
  orientation: 'landscape', marginTop: 20, marginBottom: 22, marginLeft: 28, marginRight: 18,
  bindingOffset: 8, mirroredMargins: true, columns: 2, differentOddEven: true,
  oddHeaderText: '奇数页', evenHeaderText: '偶数页'
});
assert(advancedPageBlock.includes('\\geometry{a4paper,landscape'));
assert(advancedPageBlock.includes('bindingoffset=8mm'));
assert(advancedPageBlock.includes('\\fancyhead[LO]'));
assert(advancedPageBlock.includes('\\begin{multicols}{2}'));

const preset = normalizePreset({ name: '测试', kind: 'custom', template: '\\textbf{${1:内容}}' });
assert.strictEqual(preset.name, '测试');
assert.strictEqual(preset.kind, 'custom');
assert(preset.id);

const tableSettings = sanitizeTableSettings({
  hasHeader: true,
  bodyFontSize: 10.5,
  headerFontFamily: 'heiti',
  headerBold: true,
  tableCaptionFontFamily: 'songti',
  tableCaptionBold: true,
  borderStyle: 'threeLine',
  tableAlignment: 'center'
});
const tableSnippet = buildTableSnippet(tableSettings, 4, 3);
assert(tableSnippet.includes('\\begin{tabular}{ccc}'));
assert(tableSnippet.includes('\\toprule'));
assert(tableSnippet.includes('\\midrule'));
assert(tableSnippet.includes('\\bottomrule'));
assert(tableSnippet.includes('\\heiti'));
assert(tableSnippet.includes('\\caption['));
assert(tableSnippet.includes('\\songti'));
assert(tableSnippet.includes('\\protect\\centering'));
assert(tableSnippet.includes('$1'));
assert.strictEqual((tableSnippet.match(/表头/g) || []).length, 3);
assert.strictEqual((tableSnippet.match(/内容/g) || []).length, 9);
assert(tableSnippet.includes('${3:第1行第1列表头}'));
assert(tableSnippet.includes('第4行第3列内容'));
const generatedRow = tableSnippet.split('\n').find((line) => line.includes('${3:第1行第1列表头}'));
assert.strictEqual(generatedRow.slice(-4), '\\\\\\\\', 'snippet source must keep four row-ending backslashes');
const insertedRowEnding = generatedRow.slice(-4).replace(/\\\\/g, '\\');
assert.strictEqual(insertedRowEnding, '\\\\', 'VS Code snippet decoding must leave two LaTeX row-ending backslashes');

const gridSnippet = buildTableSnippet({ hasHeader: false, borderStyle: 'grid', bodyAlignment: 'left' }, 2, 4);
assert(gridSnippet.includes('\\begin{tabular}{|l|l|l|l|}'));
assert(!gridSnippet.includes('\\toprule'));
assert.strictEqual((gridSnippet.match(/内容/g) || []).length, 8);
const equalWidthTable = buildTableSnippet({ columnWidthMode: 'equal', tableWidthPercent: 80 }, 2, 3);
assert(equalWidthTable.includes('\\begin{tabular*}{0.8\\textwidth}'));
assert(equalWidthTable.includes('\\extracolsep{\\fill}'));
const repeatingTable = buildTableSnippet({ hasHeader: true, repeatHeader: true, borderStyle: 'threeLine' }, 3, 2);
assert(repeatingTable.includes('\\begin{longtable}{cc}'));
assert(repeatingTable.includes('\\endfirsthead'));
assert(repeatingTable.includes('\\endhead'));

const filledTable = buildTableSnippet(tableSettings, 2, 2, {
  title: '结果与分析', label: 'results',
  cells: [['项目', '数值'], ['A&B', '95%']]
});
assert(filledTable.includes('% LFP:table:start '));
assert(filledTable.includes('结果与分析'));
assert(filledTable.includes('A\\&B'));
assert(filledTable.includes('95\\%'));
assert(!filledTable.includes('请输入表格标题'));
const managedTable = findManagedBlockInText(filledTable, filledTable.indexOf('A\\&B'), 'table');
assert(managedTable);
assert.strictEqual(managedTable.data.cells[1][0], 'A&B');

const imageSnippet = buildImageSnippet({
  sizeMode: 'percent',
  scalePercent: 65,
  imageAlignment: 'right',
  hasCaption: true,
  captionPosition: 'top',
  captionFontFamily: 'songti',
  captionBold: true
});
assert(imageSnippet.includes('\\includegraphics[width=0.65\\textwidth,keepaspectratio]{\\detokenize{${1:请选择图片文件}}}'));
assert(imageSnippet.includes('${2:请输入图片说明文字}'));
assert(imageSnippet.includes('${3:请输入图片标签}'));
assert(imageSnippet.includes('\\songti'));
assert(imageSnippet.includes('\\bfseries'));
assert(imageSnippet.includes('\\protect\\centering'));
assert(imageSnippet.indexOf('\\caption') < imageSnippet.indexOf('\\includegraphics'));

const imageWithoutCaption = buildImageSnippet({ hasCaption: false });
assert(!imageWithoutCaption.includes('\\caption'));
assert(!imageWithoutCaption.includes('\\label'));

const originalImage = buildImageSnippet({ sizeMode: 'original' }, 'figures/example.png');
assert(originalImage.includes('\\includegraphics{\\detokenize{figures/example.png}}'));
assert(!originalImage.includes('\\includegraphics['));

const pixelImage = buildImageSnippet({ sizeMode: 'pixels', customPixels: 800 }, 'figure.png');
assert(pixelImage.includes('\\includegraphics[width=600bp,keepaspectratio]{\\detokenize{figure.png}}'));

const manuallyNumberedImage = buildImageSnippet(
  { sizeMode: 'percent', scalePercent: 80, numberMode: 'manual' },
  'figure.png',
  '1-1'
);
assert(manuallyNumberedImage.includes('\\renewcommand{\\thefigure}{1-1}'));

const completedImage = buildImageSnippet(
  { sizeMode: 'percent', scalePercent: 70, hasCaption: true },
  'figure.png', '', { captionText: '系统结构', label: 'system-structure' }
);
assert(completedImage.includes('系统结构'));
assert(completedImage.includes('\\label{fig:system-structure}'));
assert(!completedImage.includes('请输入图片说明文字'));
const transformedImage = buildImageSnippet({ sizeMode: 'percent', scalePercent: 50, rotation: 90, trimLeft: 2, trimRight: 4, trimTop: 6, trimBottom: 8 }, 'figure.png');
assert(transformedImage.includes('angle=90'));
assert(transformedImage.includes('trim=2bp 8bp 4bp 6bp,clip'));

const sourceWithFigure = `正文\n${manuallyNumberedImage}\n后文`;
const locatedFigure = findFigureBlockInText(sourceWithFigure, sourceWithFigure.indexOf('includegraphics'));
assert(locatedFigure);
assert(locatedFigure.text.startsWith('\\begin{figure}'));
const parsedFigure = parseFigureProperties(locatedFigure.text);
assert.strictEqual(parsedFigure.sizeMode, 'percent');
assert.strictEqual(parsedFigure.scalePercent, 80);
assert.strictEqual(parsedFigure.numberMode, 'manual');
assert.strictEqual(parsedFigure.customFigureNumber, '1-1');

const resizedFigure = updateFigureBlock(locatedFigure.text, {
  ...parsedFigure,
  sizeMode: 'percent',
  scalePercent: 50,
  imageAlignment: 'left',
  placement: 'H',
  numberMode: 'manual',
  customFigureNumber: '2-3'
});
assert(resizedFigure.includes('\\begin{figure}[H]'));
assert(resizedFigure.includes('\\includegraphics[width=0.5\\textwidth,keepaspectratio]'));
assert(resizedFigure.includes('\\raggedright'));
assert(resizedFigure.includes('\\renewcommand{\\thefigure}{2-3}'));
assert(!resizedFigure.includes('\\renewcommand{\\thefigure}{1-1}'));

const automaticFigure = updateFigureBlock(resizedFigure, {
  ...parsedFigure,
  numberMode: 'automatic',
  customFigureNumber: ''
});
assert(!automaticFigure.includes('\\renewcommand{\\thefigure}'));

const formulaStyle = sanitizeFormulaStyle({
  name: '章节公式', displayMode: 'numbered', numberMode: 'manual', numberFormat: 'prefix',
  fontSize: 12, numberFontSize: 10.5, beforeMode: 'lines', beforeValue: 0.5, afterMode: 'lines', afterValue: 0.5
});
const formulaData = sanitizeFormulaData({
  name: '动能公式', kind: 'fraction', values: { numerator: 'mv^2', denominator: '2' },
  style: formulaStyle, manualNumber: '1-1', label: 'kinetic-energy'
});
assert.strictEqual(buildFormulaExpression(formulaData), '\\frac{mv^2}{2}');
const formulaBlock = buildFormulaBlock(formulaData);
assert(formulaBlock.includes('% LFP:formula:start '));
assert(formulaBlock.includes('\\begin{equation*}'));
assert(formulaBlock.includes('\\tag*'));
assert(formulaBlock.includes('\\text{式（}1-1\\text{）}'));
assert(formulaBlock.includes('\\label{eq:kinetic-energy}'));
assert(findManagedBlockInText(formulaBlock, formulaBlock.indexOf('kinetic-energy'), 'formula'));
const automaticFormula = buildFormulaBlock({
  name: '质能方程', kind: 'basic', values: { expression: 'E=mc^2' },
  style: { displayMode: 'numbered', numberMode: 'automatic', numberFormat: 'parentheses' }, label: 'energy'
});
assert(automaticFormula.includes('\\refstepcounter{equation}'));
assert(automaticFormula.includes('(\\theequation)'));
const sectionFormula = buildFormulaBlock({
  name: '分节编号公式', kind: 'basic', values: { expression: 'x' },
  style: { displayMode: 'numbered', numberMode: 'automatic', numberingScope: 'section' }
});
assert(sectionFormula.indexOf('\\numberwithin{equation}{section}') < sectionFormula.indexOf('\\refstepcounter{equation}'));
const inlineFormula = buildFormulaBlock({
  name: '行内变量', kind: 'basic', values: { expression: 'm' }, style: { displayMode: 'inline', numberMode: 'none' }
});
assert(inlineFormula.includes('\\('));
assert(!inlineFormula.includes('\\begin{equation'));
assert(buildFormulaExpression({ kind: 'root', values: { radicand: 'x', index: '3' } }).includes('\\sqrt[3]{x}'));
assert(buildFormulaExpression({ kind: 'matrix', values: { matrix: 'a,b;c,d' } }).includes('a & b \\\\ c & d'));
const visualFormula = buildFormulaExpression({
  kind: 'custom', values: { visualTree: { type: 'fraction', children: [
    { type: 'text', value: 'a_i' }, { type: 'sqrt', children: [{ type: 'text', value: 'b' }] }
  ] } }
});
assert.strictEqual(visualFormula, '\\frac{a_i}{\\sqrt{b}}');
const repairedCasesFormula = buildFormulaExpression({
  kind: 'custom', values: { visualTree: { type: 'sup', children: [
    { type: 'text', value: 'E=mc^2\\Delta\\pi' },
    { type: 'cases', rows: [[{ type: 'text', value: '2' }, { type: 'text', value: 'x>=0' }], [{ type: 'text', value: '-x' }, { type: 'text', value: 'x<0' }]] }
  ] } }
});
assert(repairedCasesFormula.includes('E=mc^2\\Delta\\pi \\begin{cases}'));
assert(!repairedCasesFormula.includes('}^{\\begin{cases}'));
const leftNumberFormula = buildFormulaBlock({ kind: 'basic', values: { expression: 'x' }, style: { displayMode: 'numbered', numberMode: 'automatic', numberPosition: 'left' } });
assert(leftNumberFormula.includes('\\tagsleft@true'));

const paletteSource = fs.readFileSync(path.join(__dirname, '..', 'media', 'palette.js'), 'utf8');
const formulaSource = fs.readFileSync(path.join(__dirname, '..', 'media', 'formula.js'), 'utf8');
const documentSource = fs.readFileSync(path.join(__dirname, '..', 'media', 'document.js'), 'utf8');
const extensionSource = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
assert(!extensionSource.includes('context.paletteProvider ='), 'activation must not mutate VS Code ExtensionContext');
const referencedIds = [...paletteSource.matchAll(/byId\('([^']+)'\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds)].filter((id) => !extensionSource.includes(`id="${id}"`));
assert.deepStrictEqual(missingIds, [], `webview references missing elements: ${missingIds.join(', ')}`);
const formulaReferencedIds = [...formulaSource.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
const missingFormulaIds = [...new Set(formulaReferencedIds)].filter((id) => !extensionSource.includes(`id="${id}"`));
assert.deepStrictEqual(missingFormulaIds, [], `formula webview references missing elements: ${missingFormulaIds.join(', ')}`);
const documentReferencedIds = [...documentSource.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
const missingDocumentIds = [...new Set(documentReferencedIds)].filter((id) => !extensionSource.includes(`id="${id}"`));
assert.deepStrictEqual(missingDocumentIds, [], `document webview references missing elements: ${missingDocumentIds.join(', ')}`);

[
  'fontSize', 'lineSpacingMode', 'indentMode', 'beforeMode', 'afterMode',
  'captionFontSize', 'captionLineSpacing',
  'tableCaptionFontSize', 'tableCaptionLineSpacing',
  'bodyFontSize', 'bodyLineSpacing', 'headerFontSize', 'headerLineSpacing'
].forEach((id) => {
  assert(extensionSource.includes(`<select id="${id}"`), `${id} should use a non-technical dropdown`);
});
assert(extensionSource.includes('<select id="fontFamily">'), 'paragraph font family selector is required');
assert(extensionSource.includes('表格名称（表格注释）格式'));

assert.deepStrictEqual(
  getMissingPackages('\\usepackage{graphicx,float}\n\\begin{document}', ['graphicx', 'booktabs', 'float']),
  ['booktabs']
);
assert.deepStrictEqual(getMissingPackages('\\begin{document}', ['graphicx']), ['graphicx']);

const outline = scanDocumentOutline(`
\\section{引言}
\\begin{figure}[htbp]
\\caption[系统结构]{系统结构}
\\label{fig:system}
\\end{figure}
\\subsection{实验}
\\begin{table}[htbp]
\\caption[实验结果]{实验结果}
\\label{tab:results}
\\end{table}`);
assert.deepStrictEqual(outline.map((item) => item.kind), ['section', 'figure', 'section', 'table']);
assert.strictEqual(outline[1].label, 'fig:system');
const outlineWithFormula = scanDocumentOutline(`\\section{公式}\n${formulaBlock}`);
assert.strictEqual(outlineWithFormula[1].kind, 'equation');
assert.strictEqual(outlineWithFormula[1].label, 'eq:kinetic-energy');
assert.strictEqual(outlineWithFormula[1].number, '1-1');

const documentTemplate = sanitizeDocumentTemplate({
  name: '毕业论文', title: '可视化 LaTeX 写作', author: '测试作者',
  dateMode: 'manual', date: '2026 年 9 月', includeToc: true, includePageSettings: true
});
const newDocument = buildNewDocument(documentTemplate, {
  scheme: { bodyFontFamily: 'songti', bodyFontSize: 12, bodyLineSpacing: 1.5 },
  pageSettings: { headerEnabled: true, headerText: '测试页眉' },
  tocSettings: { title: '目录', depth: 2 }
});
assert(newDocument.includes('\\documentclass[UTF8,a4paper,12pt]{ctexart}'));
assert(newDocument.includes('\\title{可视化 LaTeX 写作}'));
assert(newDocument.includes('\\date{2026 年 9 月}'));
assert(newDocument.includes('% LFP:toc:start'));
assert(newDocument.includes('% LFP:page:start'));
assert.strictEqual(analyzeLatexDocument(newDocument).filter((issue) => issue.severity === 'error').length, 0);
const hiddenTitleDocument = buildNewDocument({ titleEnabled: false, authorEnabled: false, dateMode: 'hidden' });
assert(hiddenTitleDocument.includes('\\title{}'));
assert(hiddenTitleDocument.includes('\\author{}'));
assert(hiddenTitleDocument.includes('\\date{}'));

const brokenDocument = '\\documentclass{ctexart}\n\\begin{document}\n\\includegraphics{missing.png}\n正文';
const brokenIssues = analyzeLatexDocument(brokenDocument);
assert(brokenIssues.some((issue) => issue.title.includes('缺少正文结束标记')));
assert(brokenIssues.some((issue) => issue.title.includes('缺少宏包')));
const safeIds = brokenIssues.filter((issue) => issue.safety === 'safe').map((issue) => issue.id);
const repairedDocument = applyLatexFixes(brokenDocument, brokenIssues, safeIds);
assert(repairedDocument.includes('\\usepackage{graphicx}'));
assert(repairedDocument.includes('\\end{document}'));
const crlfDocument = '\\documentclass{ctexart}\r\n\\begin{document}\r\n\\includegraphics{x.png}\r\n\\end{document}\r\n';
const crlfIssues = analyzeLatexDocument(crlfDocument);
const crlfRepaired = applyLatexFixes(crlfDocument, crlfIssues, crlfIssues.filter((issue) => issue.safety === 'safe').map((issue) => issue.id));
assert(crlfRepaired.indexOf('\\usepackage{graphicx}') < crlfRepaired.indexOf('\\begin{document}'));

const tableIssues = analyzeLatexDocument('\\documentclass{ctexart}\n\\begin{document}\n\\begin{tabular}{ccc}a & b \\\\ c & d & e \\\\ \\end{tabular}\n\\end{document}');
assert(tableIssues.some((issue) => issue.title.includes('列数不一致')));
const paragraphColumnTable = analyzeLatexDocument('\\documentclass{ctexart}\n\\begin{document}\n\\begin{tabular}{p{3cm}c}a & b \\\\ \\end{tabular}\n\\end{document}');
assert(!paragraphColumnTable.some((issue) => issue.title.includes('列数不一致')));
const nestedFloatIssues = analyzeLatexDocument('\\documentclass{ctexart}\n\\begin{document}\n\\begin{table}\n\\begin{figure}\n\\end{figure}\n\\end{table}\n\\end{document}');
assert(nestedFloatIssues.some((issue) => issue.title.includes('浮动对象发生嵌套')));
const numberContext = estimateFormulaNumberContext('\\section{一}\n\\refstepcounter{equation}\n\\refstepcounter{equation}\n', 200);
assert.deepStrictEqual(numberContext, { section: 1, chapter: 0, continuous: 3, withinSection: 3, withinChapter: 3 });

assert(extensionSource.includes('`${getSnippet(preset)}\\n$0`'), 'preset insertion must leave the cursor outside the inserted object');
assert(extensionSource.includes('`${snippet}\\n$0`'), 'table insertion must leave the cursor outside the inserted table');
assert(formulaSource.includes('window.katex.renderToString'), 'formula preview must use the bundled math renderer');
assert(fs.existsSync(path.join(__dirname, '..', 'media', 'katex', 'katex.min.js')), 'bundled KaTeX script is missing');
assert(fs.existsSync(path.join(__dirname, '..', 'media', 'katex', 'fonts', 'KaTeX_Main-Regular.woff2')), 'bundled KaTeX fonts are missing');
const katex = require('../media/katex/katex.min.js');
const renderedCases = katex.renderToString('E=mc^2\\Delta\\pi \\begin{cases}2 & x\\ge 0 \\\\ -x & x<0\\end{cases}', { throwOnError: false, strict: 'ignore' });
assert(renderedCases.includes('class="katex"') && !renderedCases.includes('katex-error'), 'KaTeX must render the combined piecewise formula');

const disposable = () => ({ dispose() {} });
Object.assign(vscodeStub, {
  languages: { createDiagnosticCollection: () => ({ set() {}, dispose() {} }) },
  window: {
    activeTextEditor: undefined,
    registerWebviewViewProvider: disposable,
    onDidChangeActiveTextEditor: disposable,
    onDidChangeTextEditorSelection: disposable,
    registerWebviewPanelSerializer: disposable
  },
  workspace: { onDidSaveTextDocument: disposable },
  commands: { registerCommand: disposable },
  Uri: { joinPath: (...parts) => parts.join('/') }
});
const frozenContext = Object.preventExtensions({
  extensionUri: 'extension-root',
  subscriptions: [],
  globalState: { get: () => undefined, update: async () => undefined }
});
assert.doesNotThrow(() => activate(frozenContext), 'extension should activate with a non-extensible VS Code context');
assert(frozenContext.subscriptions.length > 5);

console.log('All tests passed.');
