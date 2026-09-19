'use strict';

const vscode = require('vscode');
const os = require('os');
const path = require('path');

const STORAGE_KEY = 'latexFormatPalette.presets.v2';
const SCHEME_KEY = 'latexFormatPalette.documentScheme.v2';
const TOC_SETTINGS_KEY = 'latexFormatPalette.tocSettings.v2';
const PAGE_SETTINGS_KEY = 'latexFormatPalette.pageSettings.v2';
const FORMULA_STYLES_KEY = 'latexFormatPalette.formulaStyles.v2';
const SAVED_FORMULAS_KEY = 'latexFormatPalette.savedFormulas.v2';
const VARIABLES_KEY = 'latexFormatPalette.variables.v2';
const DOCUMENT_TEMPLATE_KEY = 'latexFormatPalette.documentTemplate.v2';
const CHECK_ON_SAVE_KEY = 'latexFormatPalette.checkOnSave.v2';
const FORMAT_FILE_VERSION = 5;

const DEFAULT_DOCUMENT_TEMPLATE = {
  name: '默认论文文档',
  documentClass: 'ctexart',
  paperSize: 'a4paper',
  baseFontSize: '12pt',
  titleEnabled: true,
  title: '论文标题',
  subtitle: '',
  authorEnabled: true,
  author: '作者姓名',
  institution: '',
  major: '',
  advisor: '',
  dateMode: 'automatic',
  date: '',
  includeTitlePage: true,
  includeAbstract: true,
  abstractText: '请在此输入摘要。',
  keywords: '关键词一；关键词二；关键词三',
  includeToc: false,
  includePageSettings: false,
  includeCommonPackages: true
};

const DEFAULT_FORMULA_STYLE = {
  id: 'formula-style-default',
  name: '论文公式',
  fontSize: 12,
  mathStyle: 'default',
  displayMode: 'numbered',
  alignment: 'center',
  numberPosition: 'right',
  numberMode: 'automatic',
  numberingScope: 'section',
  numberSeparator: '-',
  numberFormat: 'parentheses',
  numberFontSize: 10.5,
  numberBold: false,
  beforeMode: 'lines', beforeValue: 0.5,
  afterMode: 'lines', afterValue: 0.5,
  pageBreakBefore: false,
  keepWithNext: false
};

const DEFAULT_VARIABLES = [
  { id: 'variable-mass', symbol: 'm', name: '质量', unit: 'kg', description: '物体的质量', category: '常用变量', favorite: true },
  { id: 'variable-velocity', symbol: 'v', name: '速度', unit: 'm/s', description: '物体的运动速度', category: '常用变量', favorite: true },
  { id: 'variable-time', symbol: 't', name: '时间', unit: 's', description: '时间变量', category: '常用变量', favorite: false }
];

const DEFAULT_PRESETS = [
  {
    id: 'default-body',
    name: '正文（小四）',
    category: '段落',
    icon: '¶',
    kind: 'paragraph',
    description: '12pt、1.5 倍行距、首行缩进 2 字符',
    settings: {
      fontFamily: 'inherit',
      fontSize: 12,
      lineSpacingMode: 'multiple', lineSpacingValue: 1.5,
      beforeMode: 'lines', beforeValue: 0,
      afterMode: 'lines', afterValue: 0,
      leftIndent: 0, rightIndent: 0, indentMode: 'first', indentValue: 2,
      alignment: 'justify',
      bold: false,
      italic: false,
      pageBreakBefore: false,
      keepWithNext: false,
      avoidWidowOrphan: false
    }
  },
  {
    id: 'default-section',
    name: '一级标题',
    category: '标题',
    icon: 'H1',
    kind: 'custom',
    description: '插入 section 标题',
    template: '\\section{${TM_SELECTED_TEXT:标题}}'
  },
  {
    id: 'default-subsection',
    name: '二级标题',
    category: '标题',
    icon: 'H2',
    kind: 'custom',
    description: '插入 subsection 标题',
    template: '\\subsection{${TM_SELECTED_TEXT:标题}}'
  },
  {
    id: 'default-figure',
    name: '居中图片',
    category: '图表',
    icon: '图',
    kind: 'image',
    description: '按正文宽度 80% 缩放、居中、图注在下方',
    settings: {
      sizeMode: 'percent',
      scalePercent: 80,
      customPixels: 800,
      imageAlignment: 'center',
      placement: 'htbp',
      hasCaption: true,
      captionPosition: 'bottom',
      captionFontFamily: 'inherit',
      captionFontSize: 10.5,
      captionLineSpacing: 1.2,
      captionBold: false,
      captionItalic: false,
      captionCentered: true,
      numberMode: 'automatic',
      pageBreakBefore: false
    }
  },
  {
    id: 'default-table',
    name: '论文三线表',
    category: '图表',
    icon: '表',
    kind: 'table',
    description: '点击后选择行列数；首行为表头',
    settings: {
      hasHeader: true,
      bodyFontFamily: 'inherit',
      bodyFontSize: 10.5,
      bodyLineSpacing: 1.2,
      bodyBold: false,
      bodyItalic: false,
      bodyAlignment: 'center',
      headerFontFamily: 'heiti',
      headerFontSize: 10.5,
      headerLineSpacing: 1.2,
      headerBold: true,
      headerItalic: false,
      headerAlignment: 'center',
      tableAlignment: 'center',
      columnWidthMode: 'auto',
      tableWidthPercent: 100,
      borderStyle: 'threeLine',
      placement: 'htbp',
      captionPosition: 'top',
      captionCentered: true,
      tableCaptionFontFamily: 'inherit',
      tableCaptionFontSize: 10.5,
      tableCaptionLineSpacing: 1.2,
      tableCaptionBold: false,
      tableCaptionItalic: false,
      pageBreakBefore: false
    }
  },
  {
    id: 'default-equation',
    name: '带编号公式',
    category: '公式',
    icon: 'Σ',
    kind: 'custom',
    description: '打开独立可视化公式工具',
    template: [
      '\\begin{equation}',
      '    ${1:公式}',
      '    \\label{eq:${2:标签}}',
      '\\end{equation}'
    ].join('\n')
  }
];

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

const CHINESE_FONT_SIZES = [5, 5.5, 6.5, 7.5, 9, 10.5, 12, 14, 15, 16, 18, 22, 24, 26, 36, 42];
const COMMON_LINE_SPACINGS = [1, 1.15, 1.2, 1.25, 1.5, 2];
const PARAGRAPH_GAPS = [0, 0.5, 1, 1.5, 2, 3];

function closestOption(value, fallback, options) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return options.reduce((closest, option) => (
    Math.abs(option - number) < Math.abs(closest - number) ? option : closest
  ), fallback);
}

function paragraphGap(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  // 0.5.0 及更早版本使用 pt；大于 3 的旧值按 12 pt 约等于一行迁移。
  const lines = number > 3 ? number / 12 : number;
  return closestOption(lines, 0, PARAGRAPH_GAPS);
}

function sanitizeSettings(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  const lineMode = ['single', 'onehalf', 'double', 'multiple', 'fixed', 'atleast'].includes(raw.lineSpacingMode) ? raw.lineSpacingMode : 'multiple';
  return {
    styleId: String(raw.styleId || '').slice(0, 120),
    fontFamily: fontFamilies.includes(raw.fontFamily) ? raw.fontFamily : 'inherit',
    fontSize: clampNumber(raw.fontSize, 12, 5, 72),
    lineSpacingMode: lineMode,
    lineSpacingValue: lineMode === 'fixed' || lineMode === 'atleast'
      ? clampNumber(raw.lineSpacingValue, 18, 5, 100)
      : clampNumber(raw.lineSpacingValue, lineMode === 'onehalf' ? 1.5 : lineMode === 'double' ? 2 : 1.5, 0.5, 5),
    beforeMode: raw.beforeMode === 'pt' ? 'pt' : 'lines',
    beforeValue: clampNumber(raw.beforeValue, 0, 0, 200),
    afterMode: raw.afterMode === 'pt' ? 'pt' : 'lines',
    afterValue: clampNumber(raw.afterValue, 0, 0, 200),
    leftIndent: clampNumber(raw.leftIndent, 0, 0, 20),
    rightIndent: clampNumber(raw.rightIndent, 0, 0, 20),
    indentMode: ['none', 'first', 'hanging'].includes(raw.indentMode) ? raw.indentMode : 'first',
    indentValue: clampNumber(raw.indentValue, 2, 0, 20),
    alignment: ['left', 'center', 'right', 'justify'].includes(raw.alignment) ? raw.alignment : 'justify',
    bold: Boolean(raw.bold),
    italic: Boolean(raw.italic),
    pageBreakBefore: Boolean(raw.pageBreakBefore),
    keepWithNext: Boolean(raw.keepWithNext),
    avoidWidowOrphan: Boolean(raw.avoidWidowOrphan)
  };
}

function sanitizeTableSettings(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  const alignments = ['left', 'center', 'right'];
  return {
    styleId: String(raw.styleId || '').slice(0, 120),
    hasHeader: raw.hasHeader !== false,
    bodyFontFamily: fontFamilies.includes(raw.bodyFontFamily) ? raw.bodyFontFamily : 'inherit',
    bodyFontSize: closestOption(raw.bodyFontSize, 10.5, CHINESE_FONT_SIZES),
    bodyLineSpacing: closestOption(raw.bodyLineSpacing, 1.2, COMMON_LINE_SPACINGS),
    bodyBold: Boolean(raw.bodyBold),
    bodyItalic: Boolean(raw.bodyItalic),
    bodyAlignment: alignments.includes(raw.bodyAlignment) ? raw.bodyAlignment : 'center',
    headerFontFamily: fontFamilies.includes(raw.headerFontFamily) ? raw.headerFontFamily : 'heiti',
    headerFontSize: closestOption(raw.headerFontSize, 10.5, CHINESE_FONT_SIZES),
    headerLineSpacing: closestOption(raw.headerLineSpacing, 1.2, COMMON_LINE_SPACINGS),
    headerBold: raw.headerBold !== false,
    headerItalic: Boolean(raw.headerItalic),
    headerAlignment: alignments.includes(raw.headerAlignment) ? raw.headerAlignment : 'center',
    tableAlignment: alignments.includes(raw.tableAlignment) ? raw.tableAlignment : 'center',
    columnWidthMode: raw.columnWidthMode === 'equal' ? 'equal' : 'auto',
    tableWidthPercent: closestOption(raw.tableWidthPercent, 100, [60, 70, 80, 90, 100]),
    borderStyle: ['threeLine', 'grid', 'none'].includes(raw.borderStyle) ? raw.borderStyle : 'threeLine',
    placement: ['htbp', 'tbp', 'H'].includes(raw.placement) ? raw.placement : 'htbp',
    captionPosition: ['top', 'bottom'].includes(raw.captionPosition) ? raw.captionPosition : 'top',
    captionCentered: raw.captionCentered !== false,
    tableCaptionFontFamily: fontFamilies.includes(raw.tableCaptionFontFamily) ? raw.tableCaptionFontFamily : 'inherit',
    tableCaptionFontSize: closestOption(raw.tableCaptionFontSize, 10.5, CHINESE_FONT_SIZES),
    tableCaptionLineSpacing: closestOption(raw.tableCaptionLineSpacing, 1.2, COMMON_LINE_SPACINGS),
    tableCaptionBold: Boolean(raw.tableCaptionBold),
    tableCaptionItalic: Boolean(raw.tableCaptionItalic),
    pageBreakBefore: Boolean(raw.pageBreakBefore),
    verticalAlignment: ['top', 'middle', 'bottom'].includes(raw.verticalAlignment) ? raw.verticalAlignment : 'middle',
    repeatHeader: Boolean(raw.repeatHeader),
    allowRowBreak: raw.allowRowBreak !== false,
    columnWidths: Array.isArray(raw.columnWidths) ? raw.columnWidths.slice(0, 12).map((value) => clampNumber(value, 0, 0, 100)) : []
  };
}

function sanitizeImageSettings(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  const alignments = ['left', 'center', 'right'];
  return {
    styleId: String(raw.styleId || '').slice(0, 120),
    sizeMode: ['original', 'percent', 'pixels'].includes(raw.sizeMode) ? raw.sizeMode : 'percent',
    scalePercent: clampNumber(raw.scalePercent ?? raw.imageWidth, 80, 10, 100),
    customPixels: Math.round(clampNumber(raw.customPixels, 800, 50, 5000)),
    imageAlignment: alignments.includes(raw.imageAlignment) ? raw.imageAlignment : 'center',
    placement: ['htbp', 'tbp', 'H'].includes(raw.placement) ? raw.placement : 'htbp',
    hasCaption: raw.hasCaption !== false,
    captionPosition: ['top', 'bottom'].includes(raw.captionPosition) ? raw.captionPosition : 'bottom',
    captionFontFamily: fontFamilies.includes(raw.captionFontFamily) ? raw.captionFontFamily : 'inherit',
    captionFontSize: closestOption(raw.captionFontSize, 10.5, CHINESE_FONT_SIZES),
    captionLineSpacing: closestOption(raw.captionLineSpacing, 1.2, COMMON_LINE_SPACINGS),
    captionBold: Boolean(raw.captionBold),
    captionItalic: Boolean(raw.captionItalic),
    captionCentered: raw.captionCentered !== false,
    numberMode: raw.numberMode === 'manual' ? 'manual' : 'automatic',
    pageBreakBefore: Boolean(raw.pageBreakBefore),
    lockAspectRatio: raw.lockAspectRatio !== false,
    rotation: clampNumber(raw.rotation, 0, -180, 180),
    trimLeft: clampNumber(raw.trimLeft, 0, 0, 1000), trimRight: clampNumber(raw.trimRight, 0, 0, 1000),
    trimTop: clampNumber(raw.trimTop, 0, 0, 1000), trimBottom: clampNumber(raw.trimBottom, 0, 0, 1000),
    keepWithCaption: raw.keepWithCaption !== false
  };
}

function sanitizeDocumentScheme(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  return {
    name: String(raw.name || '我的论文格式').slice(0, 40),
    bodyFontFamily: fontFamilies.includes(raw.bodyFontFamily) ? raw.bodyFontFamily : 'songti',
    bodyFontSize: closestOption(raw.bodyFontSize, 12, CHINESE_FONT_SIZES),
    bodyLineSpacing: closestOption(raw.bodyLineSpacing, 1.5, COMMON_LINE_SPACINGS),
    headingFontFamily: fontFamilies.includes(raw.headingFontFamily) ? raw.headingFontFamily : 'heiti',
    heading1FontSize: closestOption(raw.heading1FontSize, 16, CHINESE_FONT_SIZES),
    heading2FontSize: closestOption(raw.heading2FontSize, 14, CHINESE_FONT_SIZES),
    captionFontFamily: fontFamilies.includes(raw.captionFontFamily) ? raw.captionFontFamily : 'songti',
    captionFontSize: closestOption(raw.captionFontSize, 10.5, CHINESE_FONT_SIZES),
    tableFontSize: closestOption(raw.tableFontSize, 10.5, CHINESE_FONT_SIZES),
    heading1PageBreakBefore: Boolean(raw.heading1PageBreakBefore),
    avoidWidowOrphan: raw.avoidWidowOrphan !== false
  };
}

function sanitizeTocSettings(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  return {
    title: String(raw.title || '目录').slice(0, 80),
    depth: Math.round(clampNumber(raw.depth, 3, 1, 3)),
    titleFontFamily: fontFamilies.includes(raw.titleFontFamily) ? raw.titleFontFamily : 'heiti',
    titleFontSize: closestOption(raw.titleFontSize, 16, CHINESE_FONT_SIZES),
    titleBold: raw.titleBold !== false,
    titleAlignment: ['left', 'center', 'right'].includes(raw.titleAlignment) ? raw.titleAlignment : 'center',
    showPageNumbers: raw.showPageNumbers !== false,
    leaderStyle: raw.leaderStyle === 'blank' ? 'blank' : 'dots',
    pageBreakBefore: raw.pageBreakBefore !== false,
    pageBreakAfter: raw.pageBreakAfter !== false,
    levelStyles: [0, 1, 2].map((index) => {
      const value = Array.isArray(raw.levelStyles) ? raw.levelStyles[index] || {} : {};
      return {
        fontFamily: fontFamilies.includes(value.fontFamily) ? value.fontFamily : 'inherit',
        fontSize: clampNumber(value.fontSize, index === 0 ? 12 : 10.5, 5, 42),
        indent: clampNumber(value.indent, index, 0, 10),
        lineSpacing: clampNumber(value.lineSpacing, 1.2, 0.8, 3),
        bold: Boolean(value.bold)
      };
    })
  };
}

function sanitizePageSettings(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  const contentModes = ['fixed', 'chapter', 'section', 'title'];
  const alignments = ['left', 'center', 'right'];
  return {
    preset: ['custom', 'normal', 'thesis', 'book'].includes(raw.preset) ? raw.preset : 'custom',
    headerEnabled: raw.headerEnabled !== false,
    headerContentMode: contentModes.includes(raw.headerContentMode) ? raw.headerContentMode : 'fixed',
    headerText: String(raw.headerText || '').slice(0, 160),
    headerFontFamily: fontFamilies.includes(raw.headerFontFamily) ? raw.headerFontFamily : 'songti',
    headerFontSize: closestOption(raw.headerFontSize, 10.5, CHINESE_FONT_SIZES),
    headerBold: Boolean(raw.headerBold),
    headerItalic: Boolean(raw.headerItalic),
    headerAlignment: alignments.includes(raw.headerAlignment) ? raw.headerAlignment : 'center',
    headerDistance: clampNumber(raw.headerDistance, 8, 0, 50),
    headerEdgeDistance: clampNumber(raw.headerEdgeDistance, 15, 0, 50),
    headerLine: raw.headerLine !== false,
    footerEnabled: Boolean(raw.footerEnabled),
    footerContentMode: contentModes.includes(raw.footerContentMode) ? raw.footerContentMode : 'fixed',
    footerText: String(raw.footerText || '').slice(0, 160),
    footerFontFamily: fontFamilies.includes(raw.footerFontFamily) ? raw.footerFontFamily : 'songti',
    footerFontSize: closestOption(raw.footerFontSize, 10.5, CHINESE_FONT_SIZES),
    footerBold: Boolean(raw.footerBold),
    footerItalic: Boolean(raw.footerItalic),
    footerAlignment: alignments.includes(raw.footerAlignment) ? raw.footerAlignment : 'center',
    footerDistance: clampNumber(raw.footerDistance, 10, 0, 50),
    footerEdgeDistance: clampNumber(raw.footerEdgeDistance, 15, 0, 50),
    footerLine: Boolean(raw.footerLine),
    pageNumberEnabled: raw.pageNumberEnabled !== false,
    pageNumberArea: raw.pageNumberArea === 'header' ? 'header' : 'footer',
    pageNumberPosition: ['left', 'center', 'right', 'outer'].includes(raw.pageNumberPosition) ? raw.pageNumberPosition : 'center',
    pageNumberFormat: ['arabic', 'roman', 'Roman'].includes(raw.pageNumberFormat) ? raw.pageNumberFormat : 'arabic',
    startNumber: Math.round(clampNumber(raw.startNumber, 1, 1, 9999)),
    startAt: raw.startAt === 'current' ? 'current' : 'document',
    firstPageMode: ['same', 'hidden', 'separate'].includes(raw.firstPageMode) ? raw.firstPageMode : 'hidden',
    firstHeaderText: String(raw.firstHeaderText || '').slice(0, 160),
    firstFooterText: String(raw.firstFooterText || '').slice(0, 160),
    firstShowPageNumber: Boolean(raw.firstShowPageNumber),
    firstHeaderAlignment: alignments.includes(raw.firstHeaderAlignment) ? raw.firstHeaderAlignment : 'center',
    firstFooterAlignment: alignments.includes(raw.firstFooterAlignment) ? raw.firstFooterAlignment : 'center',
    differentOddEven: Boolean(raw.differentOddEven),
    oddHeaderText: String(raw.oddHeaderText || '').slice(0, 160), evenHeaderText: String(raw.evenHeaderText || '').slice(0, 160),
    oddFooterText: String(raw.oddFooterText || '').slice(0, 160), evenFooterText: String(raw.evenFooterText || '').slice(0, 160),
    paperSize: ['a4paper', 'letterpaper'].includes(raw.paperSize) ? raw.paperSize : 'a4paper',
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginTop: clampNumber(raw.marginTop, 25, 5, 80), marginBottom: clampNumber(raw.marginBottom, 25, 5, 80),
    marginLeft: clampNumber(raw.marginLeft, 25, 5, 80), marginRight: clampNumber(raw.marginRight, 25, 5, 80),
    bindingOffset: clampNumber(raw.bindingOffset, 0, 0, 30),
    mirroredMargins: Boolean(raw.mirroredMargins),
    columns: Math.round(clampNumber(raw.columns, 1, 1, 3))
  };
}

function sanitizeDocumentTemplate(raw = {}) {
  const documentClasses = ['ctexart', 'ctexrep', 'ctexbook', 'article', 'report', 'book'];
  const dateModes = ['automatic', 'manual', 'hidden'];
  return {
    name: String(raw.name || DEFAULT_DOCUMENT_TEMPLATE.name).slice(0, 60),
    documentClass: documentClasses.includes(raw.documentClass) ? raw.documentClass : DEFAULT_DOCUMENT_TEMPLATE.documentClass,
    paperSize: ['a4paper', 'letterpaper'].includes(raw.paperSize) ? raw.paperSize : 'a4paper',
    baseFontSize: ['10pt', '11pt', '12pt'].includes(raw.baseFontSize) ? raw.baseFontSize : '12pt',
    titleEnabled: raw.titleEnabled !== false,
    title: String(raw.title || '').slice(0, 300),
    subtitle: String(raw.subtitle || '').slice(0, 300),
    authorEnabled: raw.authorEnabled !== false,
    author: String(raw.author || '').slice(0, 160),
    institution: String(raw.institution || '').slice(0, 200),
    major: String(raw.major || '').slice(0, 160),
    advisor: String(raw.advisor || '').slice(0, 160),
    dateMode: dateModes.includes(raw.dateMode) ? raw.dateMode : 'automatic',
    date: String(raw.date || '').slice(0, 80),
    includeTitlePage: raw.includeTitlePage !== false,
    includeAbstract: raw.includeAbstract !== false,
    abstractText: String(raw.abstractText || DEFAULT_DOCUMENT_TEMPLATE.abstractText).slice(0, 5000),
    keywords: String(raw.keywords || '').slice(0, 500),
    includeToc: Boolean(raw.includeToc),
    includePageSettings: Boolean(raw.includePageSettings),
    includeCommonPackages: raw.includeCommonPackages !== false
  };
}

function buildNewDocument(rawTemplate, options = {}) {
  const template = sanitizeDocumentTemplate(rawTemplate);
  const scheme = sanitizeDocumentScheme(options.scheme || {});
  const pageSettings = sanitizePageSettings(options.pageSettings || {});
  const classOptions = [template.paperSize, template.baseFontSize];
  if (template.documentClass.startsWith('ctex')) classOptions.unshift('UTF8');
  const packages = [];
  if (template.includeCommonPackages) packages.push('amsmath', 'amssymb', 'graphicx', 'booktabs', 'float');
  if (template.includeToc) packages.push('tocloft');
  if (template.includePageSettings) packages.push('fancyhdr', 'multicol');
  const lines = [
    `% 由 LaTeX 格式面板创建：${escapeLatexText(template.name)}`,
    `\\documentclass[${classOptions.join(',')}]{${template.documentClass}}`
  ];
  if (!template.documentClass.startsWith('ctex')) lines.push('\\usepackage[UTF8]{ctex}');
  if (packages.length) lines.push(`\\usepackage{${[...new Set(packages)].join(',')}}`);
  lines.push(
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage[hidelinks]{hyperref}',
    '',
    `% LFP:document:start ${encodeMetadata(template)}`
  );
  lines.push(template.titleEnabled
    ? `\\title{${escapeLatexText(template.title || '论文标题')}${template.subtitle ? `\\\\[0.8em]{\\large ${escapeLatexText(template.subtitle)}}` : ''}}`
    : '\\title{}');
  lines.push(template.authorEnabled ? `\\author{${escapeLatexText(template.author || '作者姓名')}}` : '\\author{}');
  if (template.dateMode === 'automatic') lines.push('\\date{\\today}');
  else if (template.dateMode === 'manual') lines.push(`\\date{${escapeLatexText(template.date)}}`);
  else lines.push('\\date{}');
  const familyCommands = { songti: '\\songti', heiti: '\\heiti', kaishu: '\\kaishu', fangsong: '\\fangsong' };
  const bodyFamily = familyCommands[scheme.bodyFontFamily] || '';
  const bodyBaseline = Number((scheme.bodyFontSize * scheme.bodyLineSpacing).toFixed(2));
  lines.push(`\\AtBeginDocument{${bodyFamily}\\fontsize{${scheme.bodyFontSize}pt}{${bodyBaseline}pt}\\selectfont}`);
  if (template.includePageSettings) lines.push(buildPageStyleBlock(pageSettings));
  lines.push('% LFP:document:end', '', '\\begin{document}', '');
  if (template.includeTitlePage) {
    lines.push('\\maketitle');
    const details = [];
    if (template.institution) details.push(`单位：${escapeLatexText(template.institution)}`);
    if (template.major) details.push(`专业：${escapeLatexText(template.major)}`);
    if (template.advisor) details.push(`指导教师：${escapeLatexText(template.advisor)}`);
    if (details.length) lines.push('\\begin{center}', details.join('\\\\[0.5em]'), '\\end{center}');
    lines.push('');
  }
  if (template.includeAbstract) {
    const bookClass = template.documentClass === 'book' || template.documentClass === 'ctexbook';
    if (bookClass) lines.push('\\chapter*{摘要}', escapeLatexText(template.abstractText), '');
    else lines.push('\\begin{abstract}', escapeLatexText(template.abstractText), '');
    if (template.keywords) lines.push(`\\noindent\\textbf{关键词：}${escapeLatexText(template.keywords)}`);
    if (!bookClass) lines.push('\\end{abstract}');
    lines.push('');
  }
  if (template.includeToc) lines.push(buildTocBlock(options.tocSettings || {}), '');
  lines.push('\\section{引言}', '请在此开始撰写正文。', '', '\\end{document}', '');
  return lines.join('\n');
}

function lineNumberAt(text, offset) {
  return text.slice(0, Math.max(0, offset)).split('\n').length;
}

function stripLatexComments(text) {
  let result = '';
  let inComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\n' || character === '\r') {
      inComment = false;
      result += character;
      continue;
    }
    if (!inComment && character === '%') {
      let slashes = 0;
      for (let before = index - 1; before >= 0 && text[before] === '\\'; before -= 1) slashes += 1;
      if (slashes % 2 === 0) inComment = true;
    }
    result += inComment ? ' ' : character;
  }
  return result;
}

function maskLatexLiteralEnvironments(text) {
  const pattern = /\\begin\{(verbatim\*?|lstlisting|minted)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g;
  return text.replace(pattern, (full, name, body) => full.replace(body, body.replace(/[^\r\n]/g, ' ')));
}

function countTabularColumns(specification) {
  let expanded = String(specification || '');
  expanded = expanded.replace(/\*\{(\d+)\}\{([^{}]*)\}/g, (_, count, inner) => inner.repeat(Math.min(50, Number(count) || 0)));
  expanded = expanded.replace(/[@><!]\{[^{}]*\}/g, '');
  return (expanded.match(/[lcrX]|[pmb]\s*\{/g) || []).length;
}

function analyzeLatexDocument(text, filePath = '') {
  const source = String(text || '');
  const clean = maskLatexLiteralEnvironments(stripLatexComments(source));
  const issues = [];
  let sequence = 0;
  const add = (issue) => issues.push({
    id: `issue-${sequence++}`,
    severity: issue.severity || 'warning',
    line: issue.line || 1,
    title: issue.title,
    detail: issue.detail || '',
    fixable: Boolean(issue.fix),
    safety: issue.safety || 'none',
    fix: issue.fix || null,
    category: issue.category || '结构'
  });
  const beginDocument = clean.indexOf('\\begin{document}');
  const endDocument = clean.lastIndexOf('\\end{document}');
  const beginDocumentCount = (clean.match(/\\begin\{document\}/g) || []).length;
  const endDocumentCount = (clean.match(/\\end\{document\}/g) || []).length;
  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(clean)) {
    add({ severity: 'error', title: '缺少文档类型', detail: '完整 LaTeX 文档需要 documentclass。', category: '文档开头', safety: 'confirm', fix: { start: 0, end: 0, replacement: '\\documentclass[UTF8,12pt,a4paper]{ctexart}\n' } });
  }
  if (beginDocument < 0) {
    add({ severity: 'error', title: '缺少正文开始标记', detail: '没有找到 \\begin{document}。位置无法可靠判断，因此不会自动修复。', category: '文档结构' });
  }
  if (beginDocumentCount > 1) add({ severity: 'error', line: lineNumberAt(source, beginDocument), title: '正文开始标记重复', detail: `检测到 ${beginDocumentCount} 个 \\begin{document}，请保留一个。`, category: '文档结构' });
  if (endDocumentCount > 1) add({ severity: 'error', line: lineNumberAt(source, endDocument), title: '正文结束标记重复', detail: `检测到 ${endDocumentCount} 个 \\end{document}，请保留一个。`, category: '文档结构' });
  if (endDocument < 0 && beginDocument >= 0) {
    add({ severity: 'error', line: lineNumberAt(source, source.length), title: '缺少正文结束标记', detail: '可在文件末尾安全补上 \\end{document}。', category: '文档结构', safety: 'safe', fix: { start: source.length, end: source.length, order: -1, replacement: `${source.endsWith('\n') ? '' : '\n'}\\end{document}\n` } });
  }
  if (endDocument >= 0 && source.slice(endDocument + '\\end{document}'.length).trim()) {
    add({ severity: 'warning', line: lineNumberAt(source, endDocument), title: '文档结束后仍有内容', detail: '\\end{document} 后面的内容不会进入论文，请手动确认是否误放。', category: '文档结构' });
  }

  const braceStack = [];
  for (let index = 0; index < clean.length; index += 1) {
    if ((clean[index] === '{' || clean[index] === '}') && clean[index - 1] !== '\\') {
      if (clean[index] === '{') braceStack.push(index);
      else if (braceStack.length) braceStack.pop();
      else add({ severity: 'error', line: lineNumberAt(source, index), title: '多余的右大括号', detail: '这里出现了没有对应左大括号的 }，请手动检查。', category: '括号' });
    }
  }
  if (braceStack.length) {
    const insertAt = endDocument >= 0 ? endDocument : source.length;
    add({ severity: 'error', line: lineNumberAt(source, braceStack[braceStack.length - 1]), title: `有 ${braceStack.length} 个左大括号未闭合`, detail: '可在正文结束前补齐，但建议先查看预览，确认遗漏位置。', category: '括号', safety: 'confirm', fix: { start: insertAt, end: insertAt, order: 2, replacement: `${'}'.repeat(braceStack.length)}\n` } });
  }

  const environmentStack = [];
  const environmentPattern = /\\(begin|end)\{([^}]+)\}/g;
  let environmentMatch;
  while ((environmentMatch = environmentPattern.exec(clean))) {
    const [, action, name] = environmentMatch;
    if (action === 'begin') {
      if (/^(?:table|figure)\*?$/.test(name)) {
        const outerFloat = [...environmentStack].reverse().find((item) => /^(?:table|figure)\*?$/.test(item.name));
        if (outerFloat) {
          add({
            severity: 'error',
            line: lineNumberAt(source, environmentMatch.index),
            title: `浮动对象发生嵌套：${name}`,
            detail: `当前 ${name} 被放进了 ${outerFloat.name} 内部。请先结束外层图片或表格，再插入新的图片、表格或公式。`,
            category: '图片与表格'
          });
        }
      }
      environmentStack.push({ name, offset: environmentMatch.index });
    }
    else if (environmentStack.length && environmentStack[environmentStack.length - 1].name === name) environmentStack.pop();
    else add({ severity: 'error', line: lineNumberAt(source, environmentMatch.index), title: `环境结束位置异常：${name}`, detail: `没有找到与 \\end{${name}} 正确配对的开始位置。`, category: '环境' });
  }
  const unclosedEnvironments = environmentStack.filter((item) => item.name !== 'document');
  if (unclosedEnvironments.length) {
    const insertAt = endDocument >= 0 ? endDocument : source.length;
    const closings = [...unclosedEnvironments].reverse().map((item) => `\\end{${item.name}}`).join('\n');
    add({ severity: 'error', line: lineNumberAt(source, unclosedEnvironments[0].offset), title: `有 ${unclosedEnvironments.length} 个环境未结束`, detail: `未闭合：${unclosedEnvironments.map((item) => item.name).join('、')}。可在正文结束前补齐，请先查看预览。`, category: '环境', safety: 'confirm', fix: { start: insertAt, end: insertAt, order: 1, replacement: `${closings}\n` } });
  }

  const dollars = [...clean.matchAll(/(?<!\\)\$/g)];
  if (dollars.length % 2 !== 0) add({ severity: 'error', line: lineNumberAt(source, dollars[dollars.length - 1].index), title: '数学公式符号没有成对', detail: '检测到单独的 $，请检查公式开始和结束位置。', category: '公式' });

  const requiredPackages = [];
  if (/\\includegraphics\b/.test(clean)) requiredPackages.push('graphicx');
  if (/\\(?:toprule|midrule|bottomrule)\b/.test(clean)) requiredPackages.push('booktabs');
  if (/\\begin\{(?:equation\*?|align\*?|gather\*?|cases|bmatrix|pmatrix)\}/.test(clean)) requiredPackages.push('amsmath');
  if (/\\(?:mathbb|boldsymbol)\b/.test(clean)) requiredPackages.push('amssymb');
  if (/\\(?:pagestyle\{fancy\}|fancyhead|fancyfoot)\b/.test(clean)) requiredPackages.push('fancyhdr');
  const missingPackages = getMissingPackages(clean, [...new Set(requiredPackages)]);
  if (missingPackages.length) {
    const insertion = missingPackages.map((name) => `\\usepackage{${name}}`).join('\n') + '\n';
    const insertAt = beginDocument >= 0 ? beginDocument : 0;
    add({
      severity: 'error', line: lineNumberAt(source, insertAt), title: `缺少宏包：${missingPackages.join('、')}`,
      detail: beginDocument >= 0 ? '当前文档使用了相关命令，但导言区没有加载对应宏包。' : '请先补全文档结构，再把宏包放到正文开始标记之前。', category: '宏包',
      safety: beginDocument >= 0 ? 'safe' : 'none', fix: beginDocument >= 0 ? { start: insertAt, end: insertAt, replacement: insertion } : null
    });
  }

  const labels = [...clean.matchAll(/\\label\{([^}]+)\}/g)];
  const labelCounts = new Map();
  labels.forEach((match) => labelCounts.set(match[1], (labelCounts.get(match[1]) || 0) + 1));
  for (const [label, count] of labelCounts) if (count > 1) add({ severity: 'warning', title: `引用名称重复：${label}`, detail: `同一名称出现 ${count} 次，引用时可能跳到错误位置。`, category: '引用' });
  for (const match of clean.matchAll(/\\(?:ref|eqref|pageref)\{([^}]+)\}/g)) {
    if (!labelCounts.has(match[1])) add({ severity: 'warning', line: lineNumberAt(source, match.index), title: `找不到引用目标：${match[1]}`, detail: '这个引用名称没有对应的 label。', category: '引用' });
  }

  for (const match of clean.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
    const imagePath = match[1];
    if (!filePath || /[\\{}#]/.test(imagePath)) continue;
    const absolute = path.resolve(path.dirname(filePath), imagePath.replace(/\//g, path.sep));
    const candidates = path.extname(absolute) ? [absolute] : ['.png', '.jpg', '.jpeg', '.pdf', '.eps'].map((extension) => absolute + extension);
    if (!candidates.some((candidate) => require('fs').existsSync(candidate))) add({ severity: 'warning', line: lineNumberAt(source, match.index), title: `图片文件不存在：${imagePath}`, detail: '请确认图片路径和文件名，软件不会自动替换路径。', category: '图片' });
  }

  for (const match of clean.matchAll(/\\begin\{tabular\}(?:\[[^\]]*\])?\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/g)) {
    const expected = countTabularColumns(match[1]);
    const rows = match[2].split(/\\\\/);
    rows.forEach((row, index) => {
      const withoutRules = row.replace(/\\(?:hline|toprule|midrule|bottomrule)\b/g, '').trim();
      if (!withoutRules || /\\multicolumn/.test(withoutRules)) return;
      const actual = (withoutRules.match(/(?<!\\)&/g) || []).length + 1;
      if (expected && actual !== expected) add({ severity: 'error', line: lineNumberAt(source, match.index), title: `表格第 ${index + 1} 行列数不一致`, detail: `列格式是 ${expected} 列，但这一行检测到 ${actual} 列。请检查 & 的数量。`, category: '表格' });
    });
  }

  const markerPattern = /^\s*%\s*LFP:([a-z-]+):(start|end)\b/gm;
  const markerStacks = new Map();
  let marker;
  while ((marker = markerPattern.exec(source))) {
    const [, kind, side] = marker;
    const stack = markerStacks.get(kind) || [];
    if (side === 'start') stack.push(marker.index);
    else if (stack.length) stack.pop();
    else add({ severity: 'warning', line: lineNumberAt(source, marker.index), title: `插件对象标记不完整：${kind}`, detail: '检测到结束标记但没有开始标记。为保护正文，不会自动删除。', category: '插件对象' });
    markerStacks.set(kind, stack);
  }
  for (const [kind, stack] of markerStacks) if (stack.length) {
    const insertAt = endDocument >= 0 ? endDocument : source.length;
    add({
      severity: 'warning', line: lineNumberAt(source, stack[0]), title: `插件对象缺少结束标记：${kind}`,
      detail: `有 ${stack.length} 个对象可能因误删而不完整。可以补回识别标记，但请先通过预览确认范围。`, category: '插件对象', safety: 'confirm',
      fix: { start: insertAt, end: insertAt, order: 0, replacement: `${Array.from({ length: stack.length }, () => `% LFP:${kind}:end`).join('\n')}\n` }
    });
  }

  const severityOrder = { error: 0, warning: 1, info: 2 };
  return issues.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);
}

function applyLatexFixes(text, issues, selectedIds) {
  const selected = new Set(selectedIds || []);
  const fixes = issues.filter((issue) => selected.has(issue.id) && issue.fix).map((issue) => issue.fix).sort((left, right) => (
    right.start - left.start || (Number(left.order) || 0) - (Number(right.order) || 0)
  ));
  let result = String(text);
  let lastStart = Number.POSITIVE_INFINITY;
  for (const fix of fixes) {
    if (fix.end > lastStart) continue;
    result = result.slice(0, fix.start) + fix.replacement + result.slice(fix.end);
    lastStart = fix.start;
  }
  return result;
}

function sanitizeFormulaStyle(raw = {}) {
  const fontFamilies = ['inherit', 'songti', 'heiti', 'kaishu', 'fangsong'];
  return {
    id: String(raw.id || `formula-style-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 120),
    name: String(raw.name || '未命名公式样式').slice(0, 60),
    fontSize: closestOption(raw.fontSize, 12, CHINESE_FONT_SIZES),
    mathStyle: ['default', 'upright', 'bold'].includes(raw.mathStyle) ? raw.mathStyle : 'default',
    displayMode: ['inline', 'display', 'numbered'].includes(raw.displayMode) ? raw.displayMode : 'numbered',
    alignment: ['left', 'center', 'right'].includes(raw.alignment) ? raw.alignment : 'center',
    numberPosition: raw.numberPosition === 'left' ? 'left' : 'right',
    numberMode: ['none', 'automatic', 'manual'].includes(raw.numberMode) ? raw.numberMode : 'automatic',
    numberingScope: ['continuous', 'section', 'chapter'].includes(raw.numberingScope) ? raw.numberingScope : 'section',
    numberSeparator: ['-', '.', '–'].includes(raw.numberSeparator) ? raw.numberSeparator : '-',
    numberFormat: ['parentheses', 'brackets', 'plain', 'prefix'].includes(raw.numberFormat) ? raw.numberFormat : 'parentheses',
    numberFontSize: closestOption(raw.numberFontSize, 10.5, CHINESE_FONT_SIZES),
    numberFontFamily: fontFamilies.includes(raw.numberFontFamily) ? raw.numberFontFamily : 'inherit',
    numberBold: Boolean(raw.numberBold),
    beforeMode: raw.beforeMode === 'pt' ? 'pt' : 'lines',
    beforeValue: clampNumber(raw.beforeValue, 0.5, 0, 100),
    afterMode: raw.afterMode === 'pt' ? 'pt' : 'lines',
    afterValue: clampNumber(raw.afterValue, 0.5, 0, 100),
    pageBreakBefore: Boolean(raw.pageBreakBefore),
    keepWithNext: Boolean(raw.keepWithNext)
  };
}

function sanitizeVariable(raw = {}) {
  return {
    id: String(raw.id || `variable-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 120),
    symbol: String(raw.symbol || 'x').replace(/[\r\n]/g, '').slice(0, 80),
    name: String(raw.name || '未命名变量').slice(0, 60),
    unit: String(raw.unit || '').slice(0, 40),
    description: String(raw.description || '').slice(0, 240),
    category: String(raw.category || '其他变量').slice(0, 40),
    favorite: Boolean(raw.favorite),
    lastUsedAt: Number(raw.lastUsedAt) || 0
  };
}

function normalizeFormulaTree(node) {
  if (!node || typeof node !== 'object') return node;
  const normalized = { ...node };
  if (Array.isArray(node.children)) normalized.children = node.children.map(normalizeFormulaTree);
  if (Array.isArray(node.rows)) normalized.rows = node.rows.map((row) => (
    Array.isArray(row) ? row.map(normalizeFormulaTree) : []
  ));
  if ((normalized.type === 'sup' || normalized.type === 'sub') && normalized.children?.[1]?.type === 'cases') {
    return { id: normalized.id, type: 'row', children: [normalized.children[0], normalized.children[1]] };
  }
  return normalized;
}

function sanitizeFormulaData(raw = {}) {
  const allowedKinds = ['basic', 'fraction', 'power', 'subscript', 'root', 'sum', 'product', 'integral', 'limit', 'matrix', 'cases', 'custom'];
  const values = {};
  if (raw.values && typeof raw.values === 'object') {
    for (const [key, value] of Object.entries(raw.values)) {
      const safeKey = String(key).slice(0, 40);
      if (safeKey === 'visualTree' && value && typeof value === 'object') {
        try {
          const serialized = JSON.stringify(value);
          if (serialized.length <= 50000) values[safeKey] = normalizeFormulaTree(JSON.parse(serialized));
        } catch { /* 损坏的可视公式树会被忽略，避免阻塞插件启动。 */ }
      } else values[safeKey] = String(value ?? '').slice(0, 20000);
    }
  }
  return {
    id: String(raw.id || `formula-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 120),
    name: String(raw.name || '未命名公式').slice(0, 80),
    description: String(raw.description || '').slice(0, 240),
    category: String(raw.category || '我的公式').slice(0, 40),
    kind: allowedKinds.includes(raw.kind) ? raw.kind : 'basic',
    values,
    customLatex: String(raw.customLatex || '').slice(0, 20000),
    style: sanitizeFormulaStyle(raw.style || DEFAULT_FORMULA_STYLE),
    manualNumber: sanitizeFigureNumber(raw.manualNumber),
    label: sanitizeLabel(raw.label, `formula-${Date.now()}`),
    favorite: Boolean(raw.favorite),
    lastUsedAt: Number(raw.lastUsedAt) || 0
  };
}

function mathValue(value, fallback = '') {
  const text = String(value ?? '').trim().replace(/[\r\n]+/g, ' ');
  return (text || fallback).replace(/>=/g, '\\ge ').replace(/<=/g, '\\le ').replace(/!=/g, '\\ne ').replace(/->/g, '\\to ');
}

function buildFormulaExpression(raw) {
  const formula = sanitizeFormulaData(raw);
  const value = (key, fallback = '') => mathValue(formula.values[key], fallback);
  let expression;
  if (formula.values.visualTree && typeof formula.values.visualTree === 'object') {
    expression = formulaTreeToLatex(formula.values.visualTree);
  }
  if (!expression) switch (formula.kind) {
    case 'fraction': expression = `\\frac{${value('numerator', 'a')}}{${value('denominator', 'b')}}`; break;
    case 'power': expression = `{${value('base', 'x')}}^{${value('exponent', '2')}}`; break;
    case 'subscript': expression = `{${value('base', 'x')}}_{${value('subscript', 'i')}}`; break;
    case 'root': {
      const index = value('index');
      expression = index ? `\\sqrt[${index}]{${value('radicand', 'x')}}` : `\\sqrt{${value('radicand', 'x')}}`;
      break;
    }
    case 'sum': expression = `\\sum_{${value('lower', 'i=1')}}^{${value('upper', 'n')}} ${value('expression', 'x_i')}`; break;
    case 'product': expression = `\\prod_{${value('lower', 'i=1')}}^{${value('upper', 'n')}} ${value('expression', 'x_i')}`; break;
    case 'integral': expression = `\\int_{${value('lower', 'a')}}^{${value('upper', 'b')}} ${value('expression', 'f(x)')}\\,\\mathrm{d}${value('variable', 'x')}`; break;
    case 'limit': expression = `\\lim_{${value('variable', 'x')} \\to ${value('target', '0')}} ${value('expression', 'f(x)')}`; break;
    case 'matrix': {
      const rows = String(formula.values.matrix || 'a,b;c,d').split(/[;\n]+/).map((row) => row.split(',').map((cell) => mathValue(cell, '0')).join(' & '));
      expression = `\\begin{bmatrix}${rows.join(' \\\\ ')}\\end{bmatrix}`;
      break;
    }
    case 'cases': {
      const rows = String(formula.values.cases || 'x|x\\ge 0;-x|x<0').split(/[;\n]+/).map((row) => {
        const [result, condition] = row.split('|');
        return `${mathValue(result, '0')} & ${mathValue(condition, '\\text{其他}')}`;
      });
      expression = `\\begin{cases}${rows.join(' \\\\ ')}\\end{cases}`;
      break;
    }
    case 'custom': expression = mathValue(formula.customLatex, 'x'); break;
    default: expression = value('expression', 'E=mc^2'); break;
  }
  if (formula.style.mathStyle === 'upright') expression = `\\mathrm{${expression}}`;
  if (formula.style.mathStyle === 'bold') expression = `\\boldsymbol{${expression}}`;
  return expression;
}

function formulaTreeToLatex(node) {
  if (!node || typeof node !== 'object') return '';
  const child = (value) => formulaTreeToLatex(value);
  const children = Array.isArray(node.children) ? node.children.map(child) : [];
  const text = mathValue(node.value, '');
  switch (node.type) {
    case 'row': return children.join(' ');
    case 'text': return text;
    case 'fraction': return `\\frac{${children[0] || 'a'}}{${children[1] || 'b'}}`;
    case 'sup': return `{${children[0] || 'x'}}^{${children[1] || '2'}}`;
    case 'sub': return `{${children[0] || 'x'}}_{${children[1] || 'i'}}`;
    case 'subsup': return `{${children[0] || 'x'}}_{${children[1] || 'i'}}^{${children[2] || '2'}}`;
    case 'sqrt': return `\\sqrt{${children[0] || 'x'}}`;
    case 'root': return `\\sqrt[${children[0] || 'n'}]{${children[1] || 'x'}}`;
    case 'sum': return `\\sum_{${children[0] || 'i=1'}}^{${children[1] || 'n'}} ${children[2] || 'x_i'}`;
    case 'product': return `\\prod_{${children[0] || 'i=1'}}^{${children[1] || 'n'}} ${children[2] || 'x_i'}`;
    case 'integral': return `\\int_{${children[0] || 'a'}}^{${children[1] || 'b'}} ${children[2] || 'f(x)'}\\,\\mathrm{d}${children[3] || 'x'}`;
    case 'limit': return `\\lim_{${children[0] || 'x'} \\to ${children[1] || '0'}} ${children[2] || 'f(x)'}`;
    case 'matrix': return `\\begin{bmatrix}${(node.rows || []).map((row) => row.map(child).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
    case 'cases': return `\\begin{cases}${(node.rows || []).map((row) => `${child(row[0])} & ${child(row[1])}`).join(' \\\\ ')}\\end{cases}`;
    case 'upright': return `\\mathrm{${children[0] || text || 'x'}}`;
    case 'bold': return `\\boldsymbol{${children[0] || text || 'x'}}`;
    default: return text || children.join(' ');
  }
}

function latexVerticalSpace(mode, value) {
  if (!(Number(value) > 0)) return '';
  return mode === 'pt' ? `${Number(value)}pt` : `${Number(value)}\\baselineskip`;
}

function formatFormulaNumber(numberText, style) {
  if (style.numberFormat === 'brackets') return `[${numberText}]`;
  if (style.numberFormat === 'plain') return numberText;
  if (style.numberFormat === 'prefix') return `\\text{式（}${numberText}\\text{）}`;
  return `(${numberText})`;
}

function buildFormulaBlock(raw) {
  const formula = sanitizeFormulaData(raw);
  const style = formula.style;
  const expression = buildFormulaExpression(formula);
  const baseline = Number((style.fontSize * 1.2).toFixed(2));
  const sizedExpression = `{\\fontsize{${style.fontSize}pt}{${baseline}pt}\\selectfont ${expression}}`;
  const lines = [`% LFP:formula:start ${encodeMetadata(formula)}`];
  if (style.displayMode === 'inline') {
    lines.push(`\\(${sizedExpression}\\)% LFP:formula:end`);
    return lines.join('\n');
  }
  if (style.pageBreakBefore) lines.push('\\clearpage');
  const beforeSpace = latexVerticalSpace(style.beforeMode, style.beforeValue);
  const afterSpace = latexVerticalSpace(style.afterMode, style.afterValue);
  if (style.displayMode !== 'inline' && beforeSpace) lines.push(`\\vspace{${beforeSpace}}`);

  if (style.displayMode === 'numbered' && style.numberMode !== 'none') {
    const automatic = style.numberMode === 'automatic';
    if (automatic && style.numberingScope !== 'continuous') {
      const scope = style.numberingScope === 'chapter' ? 'chapter' : 'section';
      lines.push(`\\numberwithin{equation}{${scope}}`, `\\renewcommand{\\theequation}{\\the${scope}${escapeLatexText(style.numberSeparator)}\\arabic{equation}}`);
    }
    if (automatic) lines.push('\\refstepcounter{equation}');
    const number = automatic ? '\\theequation' : escapeLatexText(formula.manualNumber || '1-1');
    const numberCommands = latexFontCommands(style.numberFontFamily, style.numberFontSize, style.numberBold, false);
    const body = style.alignment === 'left' ? `\\makebox[0pt][l]{${sizedExpression}}\\hfill` : style.alignment === 'right' ? `\\hfill ${sizedExpression}` : sizedExpression;
    if (style.numberPosition === 'left') lines.push('\\makeatletter', '\\tagsleft@true', '\\makeatother');
    lines.push(
      '\\begin{equation*}',
      `  ${body}`,
      `  \\tag*{{${numberCommands} ${formatFormulaNumber(number, style)}}}`,
      `  \\label{eq:${formula.label}}`,
      '\\end{equation*}'
    );
  } else if (style.alignment === 'left' || style.alignment === 'right') {
    lines.push(`\\begin{flush${style.alignment}}`, `\\(${sizedExpression}\\)`, `\\end{flush${style.alignment}}`);
  } else {
    lines.push('\\[', sizedExpression, '\\]');
  }
  if (style.displayMode !== 'inline' && afterSpace) lines.push(`\\vspace{${afterSpace}}`);
  if (style.keepWithNext) lines.push('\\nopagebreak[4]');
  lines.push('% LFP:formula:end');
  return lines.join('\n');
}

function latexFontCommands(family, size, bold = false, italic = false) {
  const families = { songti: '\\songti', heiti: '\\heiti', kaishu: '\\kaishu', fangsong: '\\fangsong' };
  const commands = [];
  if (families[family]) commands.push(families[family]);
  const baseline = Number((Number(size) * 1.2).toFixed(2));
  commands.push(`\\fontsize{${size}pt}{${baseline}pt}\\selectfont`);
  if (bold) commands.push('\\bfseries');
  if (italic) commands.push('\\itshape');
  return commands.join(' ');
}

function buildTocBlock(rawSettings) {
  const settings = sanitizeTocSettings(rawSettings);
  const titleCommands = latexFontCommands(settings.titleFontFamily, settings.titleFontSize, settings.titleBold, false);
  const before = settings.titleAlignment === 'center' || settings.titleAlignment === 'right' ? '\\hfill ' : '';
  const after = settings.titleAlignment === 'center' ? ' \\hfill' : '';
  const lines = [`% LFP:toc:start ${encodeMetadata(settings)}`];
  if (settings.pageBreakBefore) lines.push('\\clearpage');
  lines.push(
    '\\begingroup',
    `\\setcounter{tocdepth}{${settings.depth}}`,
    `\\renewcommand{\\contentsname}{${escapeLatexText(settings.title)}}`,
    `\\renewcommand{\\cfttoctitlefont}{${before}${titleCommands} }`,
    `\\renewcommand{\\cftaftertoctitle}{${after}}`
  );
  const levels = ['section', 'subsection', 'subsubsection'];
  if (!settings.showPageNumbers) {
    lines.push('\\ifcsname cftchappagefont\\endcsname\\cftpagenumbersoff{chapter}\\fi');
  }
  for (const [index, level] of levels.entries()) {
    if (!settings.showPageNumbers) lines.push(`\\cftpagenumbersoff{${level}}`);
    const levelStyle = settings.levelStyles[index];
    const levelCommands = latexFontCommands(levelStyle.fontFamily, levelStyle.fontSize, levelStyle.bold, false);
    lines.push(
      `\\renewcommand{\\cft${level}font}{${levelCommands} }`,
      `\\renewcommand{\\cft${level}pagefont}{${levelCommands} }`,
      `\\setlength{\\cft${level}indent}{${levelStyle.indent}em}`,
      `\\setlength{\\cftbefore${level}skip}{${Number(((levelStyle.lineSpacing - 1) * levelStyle.fontSize).toFixed(2))}pt}`
    );
  }
  const leader = settings.leaderStyle === 'dots' ? '\\cftdotfill{\\cftdotsep}' : '\\hfill';
  lines.push(
    `\\renewcommand{\\cftsecleader}{${leader}}`,
    `\\renewcommand{\\cftsubsecleader}{${leader}}`,
    `\\renewcommand{\\cftsubsubsecleader}{${leader}}`,
    '\\tableofcontents',
    '\\endgroup'
  );
  if (settings.pageBreakAfter) lines.push('\\clearpage');
  lines.push('% LFP:toc:end');
  return lines.join('\n');
}

function pageContentValue(mode, fixedText) {
  if (mode === 'chapter') return '\\leftmark';
  if (mode === 'section') return '\\rightmark';
  if (mode === 'title') return '\\@title';
  return escapeLatexText(fixedText);
}

function formatPageText(value, family, size, bold, italic) {
  if (!value) return '';
  return `{${latexFontCommands(family, size, bold, italic)} ${value}}`;
}

function addFancySlot(slots, area, position, value) {
  if (!value) return;
  const key = `${area === 'header' ? 'H' : 'F'}${position === 'left' ? 'L' : position === 'right' ? 'R' : 'C'}`;
  if (!slots[key]) slots[key] = [];
  slots[key].push(value);
}

function buildPageStyleBlock(rawSettings) {
  const settings = sanitizePageSettings(rawSettings);
  const slots = {};
  if (settings.headerEnabled) {
    addFancySlot(slots, 'header', settings.headerAlignment, formatPageText(
      pageContentValue(settings.headerContentMode, settings.headerText),
      settings.headerFontFamily, settings.headerFontSize, settings.headerBold, settings.headerItalic
    ));
  }
  if (settings.footerEnabled) {
    addFancySlot(slots, 'footer', settings.footerAlignment, formatPageText(
      pageContentValue(settings.footerContentMode, settings.footerText),
      settings.footerFontFamily, settings.footerFontSize, settings.footerBold, settings.footerItalic
    ));
  }
  if (settings.pageNumberEnabled && settings.pageNumberPosition !== 'outer') {
    addFancySlot(slots, settings.pageNumberArea, settings.pageNumberPosition, '\\thepage');
  }
  const effectiveTop = Math.max(settings.marginTop, settings.headerEdgeDistance + settings.headerDistance);
  const effectiveBottom = Math.max(settings.marginBottom, settings.footerEdgeDistance + settings.footerDistance);
  const geometry = [
    settings.paperSize, settings.orientation,
    `top=${effectiveTop}mm`, `bottom=${effectiveBottom}mm`,
    `left=${settings.marginLeft}mm`, `right=${settings.marginRight}mm`,
    `bindingoffset=${settings.bindingOffset}mm`,
    `headsep=${settings.headerDistance}mm`, `footskip=${settings.footerDistance}mm`, 'includeheadfoot'
  ];
  if (settings.mirroredMargins || settings.differentOddEven || settings.pageNumberPosition === 'outer') geometry.push('twoside');
  const lines = [
    `% LFP:page:start ${encodeMetadata(settings)}`,
    '\\makeatletter',
    `\\geometry{${geometry.join(',')}}`,
    '\\setlength{\\headheight}{15pt}',
    '\\pagestyle{fancy}',
    '\\fancyhf{}'
  ];
  for (const [slot, values] of Object.entries(slots)) {
    lines.push(`\\fancy${slot[0] === 'H' ? 'head' : 'foot'}[${slot[1]}]{${values.join('\\quad ')}}`);
  }
  if (settings.pageNumberEnabled && settings.pageNumberPosition === 'outer') {
    lines.push(`\\fancy${settings.pageNumberArea === 'header' ? 'head' : 'foot'}[LE,RO]{\\thepage}`);
  }
  if (settings.differentOddEven) {
    if (settings.headerEnabled) {
      lines.push(`\\fancyhead[LO]{${formatPageText(escapeLatexText(settings.oddHeaderText), settings.headerFontFamily, settings.headerFontSize, settings.headerBold, settings.headerItalic)}}`);
      lines.push(`\\fancyhead[RE]{${formatPageText(escapeLatexText(settings.evenHeaderText), settings.headerFontFamily, settings.headerFontSize, settings.headerBold, settings.headerItalic)}}`);
    }
    if (settings.footerEnabled) {
      lines.push(`\\fancyfoot[LO]{${formatPageText(escapeLatexText(settings.oddFooterText), settings.footerFontFamily, settings.footerFontSize, settings.footerBold, settings.footerItalic)}}`);
      lines.push(`\\fancyfoot[RE]{${formatPageText(escapeLatexText(settings.evenFooterText), settings.footerFontFamily, settings.footerFontSize, settings.footerBold, settings.footerItalic)}}`);
    }
  }
  lines.push(
    `\\renewcommand{\\headrulewidth}{${settings.headerEnabled && settings.headerLine ? '0.4pt' : '0pt'}}`,
    `\\renewcommand{\\footrulewidth}{${settings.footerEnabled && settings.footerLine ? '0.4pt' : '0pt'}}`
  );
  if (!settings.headerEnabled && !settings.footerEnabled && !settings.pageNumberEnabled) {
    lines.push('\\AtBeginDocument{\\pagestyle{empty}}');
  } else {
    lines.push('\\AtBeginDocument{\\pagestyle{fancy}}');
  }
  if (settings.firstPageMode === 'hidden') {
    lines.push(
      '\\AtBeginDocument{\\thispagestyle{empty}}',
      '\\AddToHook{cmd/maketitle/after}{\\thispagestyle{empty}}'
    );
  } else if (settings.firstPageMode === 'separate') {
    lines.push(
      '\\fancypagestyle{lfpfirstpage}{%',
      '  \\fancyhf{}',
      `  \\fancyhead[${settings.firstHeaderAlignment === 'left' ? 'L' : settings.firstHeaderAlignment === 'right' ? 'R' : 'C'}]{${formatPageText(escapeLatexText(settings.firstHeaderText), settings.headerFontFamily, settings.headerFontSize, settings.headerBold, settings.headerItalic)}}`,
      `  \\fancyfoot[${settings.firstFooterAlignment === 'left' ? 'L' : settings.firstFooterAlignment === 'right' ? 'R' : 'C'}]{${formatPageText(escapeLatexText(settings.firstFooterText), settings.footerFontFamily, settings.footerFontSize, settings.footerBold, settings.footerItalic)}${settings.firstShowPageNumber ? '\\quad \\thepage' : ''}}`,
      '  \\renewcommand{\\headrulewidth}{0pt}',
      '  \\renewcommand{\\footrulewidth}{0pt}',
      '}',
      '\\AtBeginDocument{\\thispagestyle{lfpfirstpage}}',
      '\\AddToHook{cmd/maketitle/after}{\\thispagestyle{lfpfirstpage}}'
    );
  }
  if (settings.startAt === 'document') {
    lines.push(`\\AtBeginDocument{\\pagenumbering{${settings.pageNumberFormat}}\\setcounter{page}{${settings.startNumber}}}`);
  }
  if (settings.columns > 1) lines.push(`\\AtBeginDocument{\\begin{multicols}{${settings.columns}}}`, '\\AtEndDocument{\\end{multicols}}');
  lines.push('\\makeatother', '% LFP:page:end');
  return lines.join('\n');
}

function buildPageNumberStartBlock(rawSettings) {
  const settings = sanitizePageSettings(rawSettings);
  return [
    `% LFP:page-number:start ${encodeMetadata(settings)}`,
    `\\pagenumbering{${settings.pageNumberFormat}}`,
    `\\setcounter{page}{${settings.startNumber}}`,
    '% LFP:page-number:end'
  ].join('\n');
}

function buildSchemeHeadingTemplate(command, scheme, size, pageBreakBefore = false) {
  const familyCommands = { songti: '\\songti', heiti: '\\heiti', kaishu: '\\kaishu', fangsong: '\\fangsong' };
  const family = familyCommands[scheme.headingFontFamily] || '';
  const baseline = Number((size * 1.2).toFixed(2));
  return [
    pageBreakBefore ? '\\clearpage' : '',
    `\\${command}{{${family} \\fontsize{${size}pt}{${baseline}pt}\\selectfont \${TM_SELECTED_TEXT:标题}}}`,
    '\\nopagebreak[4]'
  ].filter(Boolean).join('\n');
}

function formatImageCaption(placeholder, settings) {
  const familyCommands = {
    songti: '\\songti', heiti: '\\heiti',
    kaishu: '\\kaishu', fangsong: '\\fangsong'
  };
  const commands = [];
  if (familyCommands[settings.captionFontFamily]) commands.push(familyCommands[settings.captionFontFamily]);
  const baseline = Number((settings.captionFontSize * settings.captionLineSpacing).toFixed(2));
  commands.push(`\\fontsize{${settings.captionFontSize}pt}{${baseline}pt}\\selectfont`);
  if (settings.captionBold) commands.push('\\bfseries');
  if (settings.captionItalic) commands.push('\\itshape');
  return `{${commands.join(' ')} ${placeholder}}`;
}

function escapeSnippetText(value) {
  return String(value).replace(/[$}\\]/g, '\\$&');
}

function escapeLatexText(value) {
  return String(value || '').replace(/[\\{}$&#_%~^]/g, (character) => ({
    '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
    '#': '\\#', '_': '\\_', '%': '\\%', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'
  }[character]));
}

function sanitizeLabel(value, fallback = 'item') {
  const cleaned = String(value || '').trim().replace(/[^0-9A-Za-z:._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function sanitizeFigureNumber(value) {
  return String(value || '')
    .trim()
    .replace(/[^0-9A-Za-z\u3400-\u9fff.\-_–—]/g, '')
    .slice(0, 40);
}

function buildImageSnippet(rawSettings, selectedImagePath, customFigureNumber = '', insertedContent = {}) {
  const settings = sanitizeImageSettings(rawSettings);
  const imagePosition = settings.imageAlignment === 'left'
    ? '\\raggedright'
    : settings.imageAlignment === 'right' ? '\\raggedleft' : '\\centering';
  const options = [];
  if (settings.sizeMode === 'percent') {
    const width = Number((settings.scalePercent / 100).toFixed(2));
    options.push(`width=${width}\\textwidth`);
  } else if (settings.sizeMode === 'pixels') {
    const widthInBigPoints = Number((settings.customPixels * 0.75).toFixed(2));
    options.push(`width=${widthInBigPoints}bp`);
  }
  if (settings.lockAspectRatio && options.length) options.push('keepaspectratio');
  if (settings.rotation) options.push(`angle=${settings.rotation}`);
  if ([settings.trimLeft, settings.trimBottom, settings.trimRight, settings.trimTop].some(Number)) {
    options.push(`trim=${settings.trimLeft}bp ${settings.trimBottom}bp ${settings.trimRight}bp ${settings.trimTop}bp`, 'clip');
  }
  const sizeOption = options.length ? `[${options.join(',')}]` : '';
  const captionPlaceholder = insertedContent.captionText
    ? escapeLatexText(insertedContent.captionText)
    : '${2:请输入图片说明文字}';
  const labelValue = insertedContent.label
    ? sanitizeLabel(insertedContent.label, 'image')
    : '${3:请输入图片标签}';
  const caption = formatImageCaption(captionPlaceholder, settings);
  const centeredCaption = formatImageCaption(insertedContent.captionText ? captionPlaceholder : '$2', settings);
  const captionLine = settings.captionCentered
    ? `    \\caption[${captionPlaceholder}]{\\protect\\centering ${centeredCaption}}`
    : `    \\caption{${caption}}`;
  const lines = [`% LFP:image:start ${encodeMetadata({ settings, path: selectedImagePath, customFigureNumber, insertedContent })}`];
  if (settings.pageBreakBefore) lines.push('\\clearpage');
  lines.push(`\\begin{figure}[${settings.placement}]`);
  const figureNumber = settings.numberMode === 'manual' ? sanitizeFigureNumber(customFigureNumber) : '';
  if (figureNumber) lines.push(`    \\renewcommand{\\thefigure}{${figureNumber}}`);
  if (settings.hasCaption && settings.captionPosition === 'top') {
    lines.push(captionLine, `    \\label{fig:${labelValue}}`);
  }
  lines.push(
    '    {',
    `    ${imagePosition}`,
    `    \\includegraphics${sizeOption}{\\detokenize{${selectedImagePath ? escapeSnippetText(selectedImagePath) : '${1:请选择图片文件}'}}}`,
    '    \\par}'
  );
  if (settings.hasCaption && settings.captionPosition === 'bottom') {
    lines.push(captionLine, `    \\label{fig:${labelValue}}`);
  }
  lines.push('\\end{figure}', '% LFP:image:end');
  return lines.join('\n');
}

function findFigureBlockInText(text, offset) {
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, text.length));
  const start = text.lastIndexOf('\\begin{figure}', safeOffset);
  if (start < 0) return null;
  const previousEnd = text.lastIndexOf('\\end{figure}', safeOffset);
  if (previousEnd > start) return null;
  const endMarker = '\\end{figure}';
  const endStart = text.indexOf(endMarker, safeOffset);
  if (endStart < 0) return null;
  const end = endStart + endMarker.length;
  const blockText = text.slice(start, end);
  if (!blockText.includes('\\includegraphics')) return null;
  return { start, end, text: blockText };
}

function parseFigureProperties(blockText) {
  const placementMatch = blockText.match(/\\begin\{figure\}(?:\[([^\]]+)\])?/);
  const graphicsMatch = blockText.match(/\\includegraphics(?:\[([^\]]*)\])?/);
  const options = graphicsMatch?.[1] || '';
  const textWidthMatch = options.match(/width\s*=\s*([0-9.]+)\\textwidth/);
  const bigPointMatch = options.match(/width\s*=\s*([0-9.]+)bp/);
  let sizeMode = 'original';
  let scalePercent = 80;
  let customPixels = 800;
  if (textWidthMatch) {
    sizeMode = 'percent';
    scalePercent = Math.round(Number(textWidthMatch[1]) * 100);
  } else if (bigPointMatch) {
    sizeMode = 'pixels';
    customPixels = Math.round(Number(bigPointMatch[1]) / 0.75);
  }
  const alignmentLine = blockText.match(/^\s*\\(centering|raggedright|raggedleft)\s*$/m)?.[1];
  const numberMatch = blockText.match(/\\renewcommand\{\\thefigure\}\{([^{}\r\n]*)\}/);
  const angleMatch = options.match(/angle\s*=\s*(-?[0-9.]+)/);
  const trimMatch = options.match(/trim\s*=\s*([0-9.]+)bp\s+([0-9.]+)bp\s+([0-9.]+)bp\s+([0-9.]+)bp/);
  return {
    sizeMode,
    scalePercent,
    customPixels,
    imageAlignment: alignmentLine === 'raggedright' ? 'left' : alignmentLine === 'raggedleft' ? 'right' : 'center',
    placement: placementMatch?.[1] || 'htbp',
    numberMode: numberMatch ? 'manual' : 'automatic',
    customFigureNumber: numberMatch?.[1] || '',
    lockAspectRatio: /keepaspectratio/.test(options), rotation: Number(angleMatch?.[1] || 0),
    trimLeft: Number(trimMatch?.[1] || 0), trimBottom: Number(trimMatch?.[2] || 0),
    trimRight: Number(trimMatch?.[3] || 0), trimTop: Number(trimMatch?.[4] || 0)
  };
}

function updateFigureBlock(blockText, rawProperties) {
  const properties = {
    sizeMode: ['original', 'percent', 'pixels'].includes(rawProperties.sizeMode) ? rawProperties.sizeMode : 'percent',
    scalePercent: clampNumber(rawProperties.scalePercent, 80, 10, 100),
    customPixels: Math.round(clampNumber(rawProperties.customPixels, 800, 50, 5000)),
    imageAlignment: ['left', 'center', 'right'].includes(rawProperties.imageAlignment) ? rawProperties.imageAlignment : 'center',
    placement: ['htbp', 'tbp', 'H'].includes(rawProperties.placement) ? rawProperties.placement : 'htbp',
    numberMode: rawProperties.numberMode === 'manual' ? 'manual' : 'automatic',
    customFigureNumber: sanitizeFigureNumber(rawProperties.customFigureNumber),
    lockAspectRatio: rawProperties.lockAspectRatio !== false,
    rotation: clampNumber(rawProperties.rotation, 0, -180, 180),
    trimLeft: clampNumber(rawProperties.trimLeft, 0, 0, 1000), trimRight: clampNumber(rawProperties.trimRight, 0, 0, 1000),
    trimTop: clampNumber(rawProperties.trimTop, 0, 0, 1000), trimBottom: clampNumber(rawProperties.trimBottom, 0, 0, 1000)
  };
  const options = [];
  if (properties.sizeMode === 'percent') {
    options.push(`width=${Number((properties.scalePercent / 100).toFixed(2))}\\textwidth`);
  } else if (properties.sizeMode === 'pixels') {
    options.push(`width=${Number((properties.customPixels * 0.75).toFixed(2))}bp`);
  }
  if (properties.lockAspectRatio && options.length) options.push('keepaspectratio');
  if (properties.rotation) options.push(`angle=${properties.rotation}`);
  if ([properties.trimLeft, properties.trimBottom, properties.trimRight, properties.trimTop].some(Number)) options.push(`trim=${properties.trimLeft}bp ${properties.trimBottom}bp ${properties.trimRight}bp ${properties.trimTop}bp`, 'clip');
  const sizeOption = options.length ? `[${options.join(',')}]` : '';
  let updated = blockText.replace(
    /\\begin\{figure\}(?:\[[^\]]*\])?/,
    `\\begin{figure}[${properties.placement}]`
  );
  updated = updated.replace(/\\includegraphics(?:\[[^\]]*\])?/, `\\includegraphics${sizeOption}`);
  const alignmentCommand = properties.imageAlignment === 'left'
    ? '\\raggedright'
    : properties.imageAlignment === 'right' ? '\\raggedleft' : '\\centering';
  if (/^\s*\\(?:centering|raggedright|raggedleft)\s*$/m.test(updated)) {
    updated = updated.replace(/^(\s*)\\(?:centering|raggedright|raggedleft)\s*$/m, `$1${alignmentCommand}`);
  } else {
    updated = updated.replace(/^(\s*)\\includegraphics/m, `$1${alignmentCommand}\n$&`);
  }
  updated = updated.replace(/^\s*\\renewcommand\{\\thefigure\}\{[^{}\r\n]*\}\s*\r?\n?/m, '');
  if (properties.numberMode === 'manual' && properties.customFigureNumber) {
    const newline = updated.includes('\r\n') ? '\r\n' : '\n';
    updated = updated.replace(
      /(\\begin\{figure\}(?:\[[^\]]*\])?\s*\r?\n)/,
      `$1    \\renewcommand{\\thefigure}{${properties.customFigureNumber}}${newline}`
    );
  }
  return updated;
}

function tableAlignmentLetter(value) {
  return value === 'left' ? 'l' : value === 'right' ? 'r' : 'c';
}

function formatTableCell(placeholder, settings, header, columnIndex = 0) {
  const prefix = header ? 'header' : 'body';
  const family = settings[`${prefix}FontFamily`];
  const fontSize = settings[`${prefix}FontSize`];
  const baseline = Number((fontSize * settings[`${prefix}LineSpacing`]).toFixed(2));
  const commands = [];
  const familyCommands = {
    songti: '\\songti',
    heiti: '\\heiti',
    kaishu: '\\kaishu',
    fangsong: '\\fangsong'
  };
  if (familyCommands[family]) commands.push(familyCommands[family]);
  commands.push(`\\fontsize{${fontSize}pt}{${baseline}pt}\\selectfont`);
  if (settings[`${prefix}Bold`]) commands.push('\\bfseries');
  if (settings[`${prefix}Italic`]) commands.push('\\itshape');
  const formatted = `{${commands.join(' ')} ${placeholder}}`;
  const alignment = tableAlignmentLetter(settings[`${prefix}Alignment`]);
  const headerColumn = settings.borderStyle === 'grid'
    ? `${columnIndex === 0 ? '|' : ''}${alignment}|`
    : alignment;
  return header ? `\\multicolumn{1}{${headerColumn}}{${formatted}}` : formatted;
}

function formatTableCaption(placeholder, settings) {
  const familyCommands = {
    songti: '\\songti', heiti: '\\heiti',
    kaishu: '\\kaishu', fangsong: '\\fangsong'
  };
  const commands = [];
  if (familyCommands[settings.tableCaptionFontFamily]) commands.push(familyCommands[settings.tableCaptionFontFamily]);
  const baseline = Number((settings.tableCaptionFontSize * settings.tableCaptionLineSpacing).toFixed(2));
  commands.push(`\\fontsize{${settings.tableCaptionFontSize}pt}{${baseline}pt}\\selectfont`);
  if (settings.tableCaptionBold) commands.push('\\bfseries');
  if (settings.tableCaptionItalic) commands.push('\\itshape');
  return `{${commands.join(' ')} ${placeholder}}`;
}

function buildTableSnippet(rawSettings, rawRows, rawColumns, tableContent = {}) {
  const settings = sanitizeTableSettings(rawSettings);
  const rows = Math.round(clampNumber(rawRows, settings.hasHeader ? 3 : 2, 1, 30));
  const columns = Math.round(clampNumber(rawColumns, 3, 1, 12));
  const directContent = Array.isArray(tableContent.cells);
  const merges = Array.isArray(tableContent.merges) ? tableContent.merges.map((item) => ({
    row: Math.round(clampNumber(item.row, 0, 0, rows - 1)), column: Math.round(clampNumber(item.column, 0, 0, columns - 1)),
    colspan: Math.round(clampNumber(item.colspan, 1, 1, columns))
  })).filter((item) => item.column + item.colspan <= columns && item.colspan > 1) : [];
  const rawCells = Array.from({ length: rows }, (_, rowIndex) => (
    Array.from({ length: columns }, (_, columnIndex) => String(tableContent.cells?.[rowIndex]?.[columnIndex] || ''))
  ));
  const bodyAlignment = tableAlignmentLetter(settings.bodyAlignment);
  const verticalType = settings.verticalAlignment === 'top' ? 'p' : settings.verticalAlignment === 'bottom' ? 'b' : 'm';
  const hasCustomWidths = settings.columnWidths.length === columns && settings.columnWidths.some(Number);
  const widthTotal = settings.columnWidths.reduce((sum, value) => sum + value, 0) || 100;
  const baseFormats = hasCustomWidths
    ? settings.columnWidths.map((value) => `${verticalType}{${Number((value / widthTotal * settings.tableWidthPercent / 100).toFixed(3))}\\textwidth}`)
    : Array(columns).fill(bodyAlignment);
  const columnFormat = settings.borderStyle === 'grid' ? `|${baseFormats.join('|')}|` : baseFormats.join('');
  const tablePosition = settings.tableAlignment === 'left'
    ? '\\raggedright'
    : settings.tableAlignment === 'right' ? '\\raggedleft' : '\\centering';
  const tableWidth = Number((settings.tableWidthPercent / 100).toFixed(2));
  const useLongTable = settings.repeatHeader && settings.hasHeader;
  const tabularBegin = useLongTable
    ? `\\begin{longtable}{${columnFormat}}`
    : settings.columnWidthMode === 'equal'
    ? `\\begin{tabular*}{${tableWidth}\\textwidth}{@{\\extracolsep{\\fill}}${columnFormat}}`
    : `\\begin{tabular}{${columnFormat}}`;
  const tabularEnd = useLongTable ? '\\end{longtable}' : settings.columnWidthMode === 'equal' ? '\\end{tabular*}' : '\\end{tabular}';
  const rawTitle = String(tableContent.title || '');
  const rawLabel = String(tableContent.label || '');
  const captionPlaceholder = directContent ? escapeLatexText(rawTitle || '表格标题') : '${1:请输入表格标题}';
  const formattedCaption = formatTableCaption(captionPlaceholder, settings);
  const formattedCaptionMirror = formatTableCaption(directContent ? captionPlaceholder : '$1', settings);
  const captionLine = settings.captionCentered
    ? `    \\caption[${captionPlaceholder}]{\\protect\\centering ${formattedCaptionMirror}}`
    : `    \\caption{${formattedCaption}}`;
  const tableLabel = directContent ? sanitizeLabel(rawLabel, `table-${Date.now()}`) : '${2:请输入表格标签}';

  let tabStop = 3;
  const makeRow = (rowIndex) => {
    const header = settings.hasHeader && rowIndex === 0;
    const cells = [];
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const covering = merges.find((item) => item.row === rowIndex && columnIndex > item.column && columnIndex < item.column + item.colspan);
      if (covering) continue;
      const merge = merges.find((item) => item.row === rowIndex && item.column === columnIndex);
      const label = header
        ? `第${rowIndex + 1}行第${columnIndex + 1}列表头`
        : `第${rowIndex + 1}行第${columnIndex + 1}列内容`;
      const placeholder = directContent
        ? escapeLatexText(rawCells[rowIndex][columnIndex])
        : '${' + tabStop + ':' + label + '}';
      if (!directContent) tabStop += 1;
      let formatted = formatTableCell(placeholder, settings, header, columnIndex);
      if (merge) {
        const alignment = tableAlignmentLetter(settings[`${header ? 'header' : 'body'}Alignment`]);
        const inner = formatted.replace(/^\\multicolumn\{1\}\{[^}]*\}\{/, '').replace(/\}$/, '');
        formatted = `\\multicolumn{${merge.colspan}}{${settings.borderStyle === 'grid' ? `|${alignment}|` : alignment}}{${inner}}`;
      }
      cells.push(formatted);
    }
    // SnippetString consumes one level of escaping for a literal backslash.
    // LaTeX needs two backslashes at the end of a row, so the snippet source
    // must contain four.
    return `        ${cells.join(' & ')} ${'\\'.repeat(4)}`;
  };

  const metadata = { settings, rows, columns, title: rawTitle, label: rawLabel, cells: rawCells, merges };
  const lines = [`% LFP:table:start ${encodeMetadata(metadata)}`];
  if (settings.pageBreakBefore) lines.push('\\clearpage');
  if (!useLongTable) lines.push(`\\begin{table}[${settings.placement}]`);
  if (!useLongTable && settings.captionPosition === 'top') lines.push(captionLine, `    \\label{tab:${tableLabel}}`);
  lines.push('    {', `    ${tablePosition}`, `    ${tabularBegin}`);
  if (useLongTable && settings.captionPosition === 'top') lines.push(`${captionLine}\\label{tab:${tableLabel}} ${'\\'.repeat(4)}`);
  if (settings.borderStyle === 'threeLine') lines.push('        \\toprule');
  if (settings.borderStyle === 'grid') lines.push('        \\hline');
  const generatedRows = Array.from({ length: rows }, (_, rowIndex) => makeRow(rowIndex));
  if (useLongTable) {
    lines.push(generatedRows[0]);
    if (settings.borderStyle === 'threeLine') lines.push('        \\midrule');
    if (settings.borderStyle === 'grid') lines.push('        \\hline');
    lines.push('        \\endfirsthead');
    if (settings.borderStyle === 'threeLine') lines.push('        \\toprule');
    if (settings.borderStyle === 'grid') lines.push('        \\hline');
    lines.push(generatedRows[0]);
    if (settings.borderStyle === 'threeLine') lines.push('        \\midrule');
    if (settings.borderStyle === 'grid') lines.push('        \\hline');
    lines.push('        \\endhead');
  }
  for (let rowIndex = useLongTable ? 1 : 0; rowIndex < rows; rowIndex += 1) {
    lines.push(generatedRows[rowIndex]);
    if (useLongTable && !settings.allowRowBreak && rowIndex < rows - 1) lines.push('        \\nopagebreak[4]');
    if (settings.borderStyle === 'grid') lines.push('        \\hline');
    if (!useLongTable && settings.borderStyle === 'threeLine' && settings.hasHeader && rowIndex === 0 && rows > 1) {
      lines.push('        \\midrule');
    }
  }
  if (settings.borderStyle === 'threeLine') lines.push('        \\bottomrule');
  if (useLongTable && settings.captionPosition === 'bottom') lines.push(`${captionLine}\\label{tab:${tableLabel}} ${'\\'.repeat(4)}`);
  lines.push(`    ${tabularEnd}`, '    \\par}');
  if (!useLongTable && settings.captionPosition === 'bottom') {
    lines.push(captionLine, `    \\label{tab:${tableLabel}}`);
  }
  if (!useLongTable) lines.push('\\end{table}');
  lines.push('% LFP:table:end');
  return lines.join('\n');
}

function encodeMetadata(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function decodeMetadata(value) {
  try {
    return JSON.parse(Buffer.from(String(value), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function findManagedBlockInText(text, offset, kind) {
  const startMarker = `% LFP:${kind}:start `;
  const endMarker = `% LFP:${kind}:end`;
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, text.length));
  const start = text.lastIndexOf(startMarker, safeOffset);
  if (start < 0) return null;
  const previousEnd = text.lastIndexOf(endMarker, safeOffset);
  if (previousEnd > start) return null;
  const endStart = text.indexOf(endMarker, safeOffset);
  if (endStart < 0) return null;
  const lineEnd = text.indexOf('\n', endStart);
  const end = lineEnd < 0 ? text.length : lineEnd;
  const firstLineEnd = text.indexOf('\n', start);
  const metadataText = text.slice(start + startMarker.length, firstLineEnd < 0 ? endStart : firstLineEnd).trim();
  const data = decodeMetadata(metadataText);
  if (!data) return null;
  return { start, end, text: text.slice(start, end), data };
}

function findFirstManagedBlockInText(text, kind) {
  const startMarker = `% LFP:${kind}:start `;
  const start = text.indexOf(startMarker);
  if (start < 0) return null;
  return findManagedBlockInText(text, start + startMarker.length, kind);
}

function extractManagedParagraphContent(blockText) {
  const startMarker = '% LFP:paragraph:content:start';
  const endMarker = '% LFP:paragraph:content:end';
  const start = blockText.indexOf(startMarker);
  const end = blockText.indexOf(endMarker);
  if (start < 0 || end < start) return '';
  return blockText.slice(start + startMarker.length, end).replace(/^\r?\n|\r?\n$/g, '');
}

function buildParagraphSnippet(settings, content = '${TM_SELECTED_TEXT:在此输入内容}') {
  const value = sanitizeSettings(settings);
  const lineFactors = { single: 1.2, onehalf: 1.5, double: 2 };
  const baseline = value.lineSpacingMode === 'fixed' || value.lineSpacingMode === 'atleast'
    ? value.lineSpacingValue
    : Number((value.fontSize * (lineFactors[value.lineSpacingMode] || value.lineSpacingValue)).toFixed(2));
  const familyCommands = {
    songti: '\\songti', heiti: '\\heiti', kaishu: '\\kaishu', fangsong: '\\fangsong'
  };
  const lines = [`% LFP:paragraph:start ${encodeMetadata(value)}`];
  if (value.pageBreakBefore) lines.push('\\clearpage');
  lines.push('{');
  if (value.avoidWidowOrphan) lines.push('\\widowpenalty=10000', '\\clubpenalty=10000');
  const beforeSpace = latexVerticalSpace(value.beforeMode, value.beforeValue);
  const afterSpace = latexVerticalSpace(value.afterMode, value.afterValue);
  if (beforeSpace) lines.push(`\\vspace{${beforeSpace}}`);
  if (familyCommands[value.fontFamily]) lines.push(familyCommands[value.fontFamily]);
  lines.push(`\\fontsize{${value.fontSize}pt}{${baseline}pt}\\selectfont`);
  lines.push(`\\setlength{\\leftskip}{${value.leftIndent}em}`, `\\setlength{\\rightskip}{${value.rightIndent}em}`);
  if (value.indentMode === 'hanging') lines.push(`\\setlength{\\parindent}{-${value.indentValue}em}`, `\\setlength{\\hangindent}{${value.indentValue}em}`, '\\hangafter=1');
  else lines.push(`\\setlength{\\parindent}{${value.indentMode === 'first' ? value.indentValue : 0}em}`);

  if (value.alignment === 'center') lines.push('\\begin{center}');
  if (value.alignment === 'right') lines.push('\\begin{flushright}');
  if (value.bold) lines.push('\\textbf{');
  if (value.italic) lines.push('\\textit{');
  lines.push('% LFP:paragraph:content:start', content, '% LFP:paragraph:content:end');
  if (value.italic) lines.push('}');
  if (value.bold) lines.push('}');
  if (value.alignment === 'center') lines.push('\\end{center}');
  if (value.alignment === 'right') lines.push('\\end{flushright}');
  lines.push('\\par');
  if (afterSpace) lines.push(`\\vspace{${afterSpace}}`);
  lines.push('}');
  if (value.keepWithNext) lines.push('\\nopagebreak[4]');
  lines.push('% LFP:paragraph:end');
  return lines.join('\n');
}

function normalizePreset(raw) {
  const allowedKinds = ['paragraph', 'image', 'table', 'custom'];
  const kind = raw && allowedKinds.includes(raw.kind) ? raw.kind : 'custom';
  const preset = {
    id: String(raw && raw.id ? raw.id : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: String(raw && raw.name ? raw.name : '未命名格式').slice(0, 60),
    category: String(raw && raw.category ? raw.category : '其他').slice(0, 30),
    icon: String(raw && raw.icon ? raw.icon : '✦').slice(0, 4),
    kind,
    description: String(raw && raw.description ? raw.description : '').slice(0, 160)
  };

  if (kind === 'paragraph') {
    preset.settings = sanitizeSettings(raw.settings);
  } else if (kind === 'image') {
    preset.settings = sanitizeImageSettings(raw.settings);
  } else if (kind === 'table') {
    preset.settings = sanitizeTableSettings(raw.settings);
  } else {
    preset.template = String(raw && raw.template ? raw.template : '${TM_SELECTED_TEXT:在此输入内容}').slice(0, 30000);
  }
  return preset;
}

function getSnippet(preset) {
  if (preset.kind === 'paragraph') return buildParagraphSnippet({ ...preset.settings, styleId: preset.id });
  if (preset.kind === 'image') return buildImageSnippet({ ...preset.settings, styleId: preset.id });
  return preset.template;
}

function getMissingPackages(text, requiredPackages) {
  const loaded = new Set();
  const packagePattern = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let match;
  while ((match = packagePattern.exec(text))) {
    match[1].split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => loaded.add(name));
  }
  return [...new Set(requiredPackages)].filter((name) => !loaded.has(name));
}

async function ensurePackages(editor, requiredPackages) {
  const document = editor.document;
  const text = document.getText();
  const missing = getMissingPackages(text, requiredPackages);
  if (!missing.length) return true;

  const documentStart = text.indexOf('\\begin{document}');
  if (documentStart < 0) {
    vscode.window.showErrorMessage(`无法自动添加宏包 ${missing.join('、')}：没有找到 \\begin{document}。`);
    return false;
  }
  const insertion = missing.map((name) => `\\usepackage{${name}}`).join('\n') + '\n\n';
  const selectionOffsets = editor.selections.map((selection) => ({
    anchor: document.offsetAt(selection.anchor),
    active: document.offsetAt(selection.active)
  }));
  const success = await editor.edit((editBuilder) => {
    editBuilder.insert(document.positionAt(documentStart), insertion);
  });
  if (success) {
    editor.selections = selectionOffsets.map((selection) => {
      const anchorOffset = selection.anchor >= documentStart ? selection.anchor + insertion.length : selection.anchor;
      const activeOffset = selection.active >= documentStart ? selection.active + insertion.length : selection.active;
      return new vscode.Selection(document.positionAt(anchorOffset), document.positionAt(activeOffset));
    });
  }
  return success;
}

function imageSizeDescription(properties) {
  if (properties.sizeMode === 'original') return '保持原图大小';
  if (properties.sizeMode === 'pixels') return `${properties.customPixels} 像素宽`;
  return `正文宽度的 ${properties.scalePercent}%`;
}

async function chooseImageSize(properties) {
  const picked = await vscode.window.showQuickPick([
    { label: '保持原图大小', value: 'original' },
    ...[25, 33, 50, 66, 75, 80, 90, 100].map((value) => ({
      label: `正文宽度的 ${value}%`, value: `percent:${value}`
    })),
    { label: '自定义百分比…', value: 'custom-percent' },
    { label: '自定义像素宽度…', value: 'pixels' }
  ], { title: '修改图片大小', placeHolder: `当前：${imageSizeDescription(properties)}` });
  if (!picked) return false;
  if (picked.value === 'original') properties.sizeMode = 'original';
  if (picked.value.startsWith('percent:')) {
    properties.sizeMode = 'percent';
    properties.scalePercent = Number(picked.value.split(':')[1]);
  }
  if (picked.value === 'custom-percent') {
    const value = await vscode.window.showInputBox({
      title: '自定义图片缩放比例',
      prompt: '请输入正文宽度百分比（10—100）',
      value: String(properties.scalePercent),
      validateInput: (input) => {
        const number = Number(input);
        return Number.isFinite(number) && number >= 10 && number <= 100 ? undefined : '请输入 10 到 100 之间的数字';
      }
    });
    if (value === undefined) return false;
    properties.sizeMode = 'percent';
    properties.scalePercent = Number(value);
  }
  if (picked.value === 'pixels') {
    const value = await vscode.window.showInputBox({
      title: '自定义图片像素宽度',
      prompt: '请输入 50—5000 之间的像素宽度，图片比例保持不变',
      value: String(properties.customPixels),
      validateInput: (input) => {
        const number = Number(input);
        return Number.isFinite(number) && number >= 50 && number <= 5000 ? undefined : '请输入 50 到 5000 之间的数字';
      }
    });
    if (value === undefined) return false;
    properties.sizeMode = 'pixels';
    properties.customPixels = Math.round(Number(value));
  }
  return true;
}

async function chooseFigureNumber(properties) {
  const picked = await vscode.window.showQuickPick([
    { label: '自动编号', description: '按照图 1、图 2、图 3……排列', value: 'automatic' },
    { label: '手动指定编号', description: '例如 1-1，最终显示为“图 1-1”', value: 'manual' }
  ], { title: '修改图片编号方式' });
  if (!picked) return false;
  if (picked.value === 'automatic') {
    properties.numberMode = 'automatic';
    properties.customFigureNumber = '';
    return true;
  }
  const value = await vscode.window.showInputBox({
    title: '输入图片编号',
    prompt: '只填写编号部分，例如：1-1',
    value: properties.customFigureNumber || '1-1',
    validateInput: (input) => sanitizeFigureNumber(input) ? undefined : '请输入图片编号，例如 1-1'
  });
  if (value === undefined) return false;
  properties.numberMode = 'manual';
  properties.customFigureNumber = sanitizeFigureNumber(value);
  return true;
}

async function editImageProperties() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'latex') {
    vscode.window.showInformationMessage('请先打开 LaTeX 文件，并把光标放在图片代码块中。');
    return;
  }
  const original = findFigureBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active));
  if (!original) {
    vscode.window.showInformationMessage('没有找到图片。请把光标放在从 \\begin{figure} 到 \\end{figure} 之间，再右键修改。');
    return;
  }
  const properties = parseFigureProperties(original.text);
  let changed = false;
  while (true) {
    const alignmentText = { left: '左侧', center: '居中', right: '右侧' }[properties.imageAlignment];
    const placementText = { htbp: '自动选择', tbp: '页顶、页底或浮动页', H: '固定在当前位置' }[properties.placement];
    const numberText = properties.numberMode === 'manual' ? `图 ${properties.customFigureNumber}` : '自动编号';
    const choice = await vscode.window.showQuickPick([
      { label: '$(screen-full) 图片大小', description: imageSizeDescription(properties), value: 'size' },
      { label: '$(layout) 左右位置', description: alignmentText, value: 'alignment' },
      { label: '$(move) 页面浮动位置', description: placementText, value: 'placement' },
      { label: '$(sync) 旋转与比例', description: `${properties.rotation || 0}°；${properties.lockAspectRatio ? '锁定比例' : '不锁定比例'}`, value: 'transform' },
      { label: '$(crop) 裁剪', description: `左${properties.trimLeft || 0} 右${properties.trimRight || 0} 上${properties.trimTop || 0} 下${properties.trimBottom || 0}`, value: 'crop' },
      { label: '$(symbol-number) 图片编号', description: numberText, value: 'number' },
      { label: '$(check) 应用修改', description: '保存以上属性并原地更新图片', value: 'apply' },
      { label: '$(close) 取消修改', value: 'cancel' }
    ], {
      title: '修改图片属性',
      placeHolder: '选择要修改的属性；可以连续修改多项，最后点击“应用修改”'
    });
    if (!choice || choice.value === 'cancel') return;
    if (choice.value === 'apply') break;
    if (choice.value === 'size') changed = await chooseImageSize(properties) || changed;
    if (choice.value === 'alignment') {
      const picked = await vscode.window.showQuickPick([
        { label: '左侧', value: 'left' }, { label: '居中', value: 'center' }, { label: '右侧', value: 'right' }
      ], { title: '修改图片左右位置' });
      if (picked) { properties.imageAlignment = picked.value; changed = true; }
    }
    if (choice.value === 'placement') {
      const picked = await vscode.window.showQuickPick([
        { label: '自动选择（推荐）', description: '由 LaTeX 在当前位置附近自动排版', value: 'htbp' },
        { label: '页顶、页底或浮动页', value: 'tbp' },
        { label: '固定在当前位置', description: '图片较大时可能造成较多留白', value: 'H' }
      ], { title: '修改页面浮动位置' });
      if (picked) { properties.placement = picked.value; changed = true; }
    }
    if (choice.value === 'transform') {
      const picked = await vscode.window.showQuickPick([
        { label: '不旋转', value: 0 }, { label: '顺时针 90°', value: 90 }, { label: '逆时针 90°', value: -90 }, { label: '旋转 180°', value: 180 }
      ], { title: '旋转图片' });
      if (picked) { properties.rotation = picked.value; properties.lockAspectRatio = true; changed = true; }
    }
    if (choice.value === 'crop') {
      const value = await vscode.window.showInputBox({ title: '裁剪图片', prompt: '依次填写左、下、右、上裁剪量（像素），用逗号分隔', value: `${properties.trimLeft || 0},${properties.trimBottom || 0},${properties.trimRight || 0},${properties.trimTop || 0}` });
      if (value !== undefined) {
        const parts = value.split(/[,， ]+/).map(Number);
        if (parts.length === 4 && parts.every((item) => Number.isFinite(item) && item >= 0)) {
          [properties.trimLeft, properties.trimBottom, properties.trimRight, properties.trimTop] = parts;
          changed = true;
        } else vscode.window.showWarningMessage('请输入四个非负数字，例如：0,0,20,0。');
      }
    }
    if (choice.value === 'number') changed = await chooseFigureNumber(properties) || changed;
  }
  if (!changed) return;
  const packages = ['graphicx'];
  if (properties.placement === 'H') packages.push('float');
  if (!await ensurePackages(editor, packages)) return;
  const current = findFigureBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active));
  if (!current) {
    vscode.window.showErrorMessage('图片位置已经发生变化，请重新把光标放入图片代码块后再修改。');
    return;
  }
  const replacement = updateFigureBlock(current.text, properties);
  const range = new vscode.Range(editor.document.positionAt(current.start), editor.document.positionAt(current.end));
  const success = await editor.edit((editBuilder) => editBuilder.replace(range, replacement));
  if (success) vscode.window.showInformationMessage('图片属性已更新，可以重新编译查看效果。');
}

async function pickSimpleValue(title, currentDescription, items) {
  return vscode.window.showQuickPick(items, { title, placeHolder: `当前：${currentDescription}` });
}

async function editManagedParagraph(editor, originalBlock) {
  const properties = sanitizeSettings(originalBlock.data);
  const content = extractManagedParagraphContent(originalBlock.text);
  let changed = false;
  const fontNames = { inherit: '沿用论文设置', songti: '宋体', heiti: '黑体', kaishu: '楷体', fangsong: '仿宋' };
  const sizeNames = {
    5: '八号', 5.5: '七号', 6.5: '小六', 7.5: '六号', 9: '小五', 10.5: '五号',
    12: '小四', 14: '四号', 15: '小三', 16: '三号', 18: '小二', 22: '二号',
    24: '小一', 26: '一号', 36: '小初', 42: '初号'
  };
  while (true) {
    const alignmentName = { left: '左对齐', center: '居中', right: '右对齐', justify: '两端对齐' }[properties.alignment];
    const choice = await vscode.window.showQuickPick([
      { label: '$(symbol-text) 字体', description: fontNames[properties.fontFamily], value: 'font' },
      { label: '$(text-size) 字号', description: `${sizeNames[properties.fontSize]}（${properties.fontSize} pt）`, value: 'size' },
      { label: '$(list-selection) 行距', description: `${properties.lineSpacingMode} · ${properties.lineSpacingValue}`, value: 'lineSpacing' },
      { label: '$(layout) 对齐方式', description: alignmentName, value: 'alignment' },
      { label: '$(indent) 缩进', description: `${properties.indentMode} ${properties.indentValue} 字符；左右 ${properties.leftIndent}/${properties.rightIndent}`, value: 'indent' },
      { label: '$(arrow-down) 段前间距', description: `${properties.beforeValue} ${properties.beforeMode === 'pt' ? 'pt' : '行'}`, value: 'before' },
      { label: '$(arrow-up) 段后间距', description: `${properties.afterValue} ${properties.afterMode === 'pt' ? 'pt' : '行'}`, value: 'after' },
      { label: `$(bold) 粗体${properties.bold ? '（已启用）' : ''}`, value: 'bold' },
      { label: `$(italic) 斜体${properties.italic ? '（已启用）' : ''}`, value: 'italic' },
      { label: '$(files) 分页控制', description: `${properties.pageBreakBefore ? '段前分页；' : ''}${properties.keepWithNext ? '与下段同页；' : ''}${properties.avoidWidowOrphan ? '避免孤行' : ''}` || '未启用', value: 'pagination' },
      { label: '$(check) 应用修改', value: 'apply' },
      { label: '$(close) 取消修改', value: 'cancel' }
    ], { title: '修改段落属性', placeHolder: '可以连续修改多项，最后点击“应用修改”' });
    if (!choice || choice.value === 'cancel') return;
    if (choice.value === 'apply') break;
    if (choice.value === 'bold' || choice.value === 'italic') {
      properties[choice.value] = !properties[choice.value];
      changed = true;
      continue;
    }
    if (choice.value === 'font') {
      const picked = await pickSimpleValue('选择字体', fontNames[properties.fontFamily], Object.entries(fontNames).map(([value, label]) => ({ label, value })));
      if (picked) { properties.fontFamily = picked.value; changed = true; }
    }
    if (choice.value === 'size') {
      const picked = await pickSimpleValue('选择中文字号', sizeNames[properties.fontSize], CHINESE_FONT_SIZES.map((value) => ({ label: `${sizeNames[value]}（${value} pt）`, value })));
      if (picked) { properties.fontSize = picked.value; changed = true; }
    }
    if (choice.value === 'lineSpacing') {
      const picked = await pickSimpleValue('选择行距', `${properties.lineSpacingValue}`, [
        { label: '单倍行距', mode: 'single', value: 1 }, { label: '1.5 倍行距', mode: 'onehalf', value: 1.5 },
        { label: '双倍行距', mode: 'double', value: 2 }, { label: '自定义多倍行距', mode: 'multiple', value: 1.5 },
        { label: '固定值（18 pt）', mode: 'fixed', value: 18 }, { label: '最小值（18 pt）', mode: 'atleast', value: 18 }
      ]);
      if (picked) { properties.lineSpacingMode = picked.mode; properties.lineSpacingValue = picked.value; changed = true; }
    }
    if (choice.value === 'alignment') {
      const picked = await pickSimpleValue('选择对齐方式', alignmentName, [
        { label: '左对齐', value: 'left' }, { label: '居中', value: 'center' }, { label: '右对齐', value: 'right' }, { label: '两端对齐', value: 'justify' }
      ]);
      if (picked) { properties.alignment = picked.value; changed = true; }
    }
    if (choice.value === 'indent') {
      const picked = await pickSimpleValue('选择特殊缩进', `${properties.indentValue} 个字符`, [
        { label: '不缩进', mode: 'none', value: 0 }, { label: '首行缩进 2 字符', mode: 'first', value: 2 }, { label: '悬挂缩进 2 字符', mode: 'hanging', value: 2 }
      ]);
      if (picked) { properties.indentMode = picked.mode; properties.indentValue = picked.value; changed = true; }
    }
    if (choice.value === 'before' || choice.value === 'after') {
      const picked = await pickSimpleValue(choice.value === 'before' ? '选择段前间距' : '选择段后间距', '可按行或磅设置', [
        ...PARAGRAPH_GAPS.map((value) => ({ label: `${value} 行`, mode: 'lines', value })),
        ...[6, 12, 18, 24].map((value) => ({ label: `${value} pt`, mode: 'pt', value }))
      ]);
      if (picked) { properties[`${choice.value}Mode`] = picked.mode; properties[`${choice.value}Value`] = picked.value; changed = true; }
    }
    if (choice.value === 'pagination') {
      const picked = await vscode.window.showQuickPick([
        { label: `${properties.pageBreakBefore ? '$(check)' : '$(circle-large-outline)'} 段前另起一页`, value: 'pageBreakBefore' },
        { label: `${properties.keepWithNext ? '$(check)' : '$(circle-large-outline)'} 与下一段保持同页`, value: 'keepWithNext' },
        { label: `${properties.avoidWidowOrphan ? '$(check)' : '$(circle-large-outline)'} 避免页首页尾孤行`, value: 'avoidWidowOrphan' }
      ], { title: '分页控制', placeHolder: '选择一项以切换开关' });
      if (picked) { properties[picked.value] = !properties[picked.value]; changed = true; }
    }
  }
  if (!changed) return;
  const current = findManagedBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active), 'paragraph');
  if (!current) {
    vscode.window.showErrorMessage('段落位置已经变化，请重新右键编辑。');
    return;
  }
  const replacement = buildParagraphSnippet(properties, content);
  const range = new vscode.Range(editor.document.positionAt(current.start), editor.document.positionAt(current.end));
  await editor.edit((editBuilder) => editBuilder.replace(range, replacement));
  vscode.window.showInformationMessage('段落属性已更新。');
}

async function editCurrentObjectProperties(provider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'latex') {
    vscode.window.showInformationMessage('请先打开 LaTeX 文件，并把光标放在段落、图片或表格中。');
    return;
  }
  const text = editor.document.getText();
  const offset = editor.document.offsetAt(editor.selection.active);
  const formulaBlock = findManagedBlockInText(text, offset, 'formula');
  if (formulaBlock) {
    await provider.openFormulaEditor(editor, formulaBlock);
    return;
  }
  const tocBlock = findManagedBlockInText(text, offset, 'toc');
  if (tocBlock) {
    await provider.openTocSettings(tocBlock.data);
    return;
  }
  const pageBlock = findManagedBlockInText(text, offset, 'page') || findManagedBlockInText(text, offset, 'page-number');
  if (pageBlock) {
    await provider.openPageSettings(pageBlock.data);
    return;
  }
  const tableBlock = findManagedBlockInText(text, offset, 'table');
  if (tableBlock) {
    const action = await vscode.window.showQuickPick([
      { label: '$(edit) 编辑表格内容', description: '修改行列、单元格、表格名称和引用名称', value: 'content' },
      { label: '$(settings-gear) 修改表格样式', description: '修改边框、表头、字体、位置和表格名称样式', value: 'style' }
    ], { title: '修改表格' });
    if (action) await provider.beginTableEdit(editor, tableBlock, action.value);
    return;
  }
  const paragraphBlock = findManagedBlockInText(text, offset, 'paragraph');
  if (paragraphBlock) {
    await editManagedParagraph(editor, paragraphBlock);
    return;
  }
  if (findFigureBlockInText(text, offset)) {
    await editImageProperties();
    return;
  }
  vscode.window.showInformationMessage('没有找到可修改的对象。请把光标放在由格式面板插入的段落、公式、图片、表格、目录或页面设置中。');
}

async function previewCurrentPdf() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'latex') {
    vscode.window.showInformationMessage('请先打开需要预览的 LaTeX 文件。');
    return;
  }
  if (editor.document.isDirty) await editor.document.save();
  try {
    await vscode.commands.executeCommand('latex-workshop.build');
    await vscode.commands.executeCommand('latex-workshop.view');
  } catch {
    vscode.window.showErrorMessage('无法打开真实 PDF 预览。请确认已安装并启用 LaTeX Workshop。');
  }
}

async function refreshTocPdf() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'latex') return;
  if (editor.document.isDirty) await editor.document.save();
  try {
    await vscode.commands.executeCommand('latex-workshop.build');
    await vscode.commands.executeCommand('latex-workshop.build');
    await vscode.commands.executeCommand('latex-workshop.view');
  } catch {
    vscode.window.showErrorMessage('无法更新目录预览。请确认已安装并启用 LaTeX Workshop。');
  }
}

function readBalancedBraces(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '{' && text[index - 1] !== '\\') depth += 1;
    if (text[index] === '}' && text[index - 1] !== '\\') {
      depth -= 1;
      if (depth === 0) return { value: text.slice(openIndex + 1, index), end: index + 1 };
    }
  }
  return null;
}

function plainLatexTitle(value) {
  return String(value || '')
    .replace(/\\fontsize\{[^}]*\}\{[^}]*\}\\selectfont/g, '')
    .replace(/\\(?:songti|heiti|kaishu|fangsong|bfseries|itshape|protect|centering)\b/g, '')
    .replace(/\\[A-Za-z@]+\*?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '未命名项目';
}

function scanDocumentOutline(text) {
  const items = [];
  const counters = { figure: 0, table: 0, equation: 0 };
  const sectionPattern = /\\(section|subsection|subsubsection)\*?\s*\{/g;
  let match;
  while ((match = sectionPattern.exec(text))) {
    const argument = readBalancedBraces(text, sectionPattern.lastIndex - 1);
    if (!argument) continue;
    const level = match[1] === 'section' ? 1 : match[1] === 'subsection' ? 2 : 3;
    items.push({ kind: 'section', level, title: plainLatexTitle(argument.value), offset: match.index });
    sectionPattern.lastIndex = argument.end;
  }
  for (const kind of ['figure', 'table']) {
    const begin = `\\begin{${kind}}`;
    const end = `\\end{${kind}}`;
    let cursor = 0;
    while ((cursor = text.indexOf(begin, cursor)) >= 0) {
      const endIndex = text.indexOf(end, cursor);
      if (endIndex < 0) break;
      const block = text.slice(cursor, endIndex + end.length);
      const caption = block.match(/\\caption\[([^\]]*)\]/)?.[1] || (kind === 'figure' ? '未命名图片' : '未命名表格');
      const label = block.match(/\\label\{([^}]+)\}/)?.[1] || '';
      counters[kind] += 1;
      const customNumber = kind === 'figure' ? block.match(/\\renewcommand\{\\thefigure\}\{([^{}]+)\}/)?.[1] : '';
      items.push({ kind, level: 1, title: plainLatexTitle(caption), label, number: customNumber || String(counters[kind]), offset: cursor });
      cursor = endIndex + end.length;
    }
  }
  let formulaCursor = 0;
  const formulaMarker = '% LFP:formula:start ';
  while ((formulaCursor = text.indexOf(formulaMarker, formulaCursor)) >= 0) {
    const block = findManagedBlockInText(text, formulaCursor + formulaMarker.length, 'formula');
    if (!block) break;
    const data = sanitizeFormulaData(block.data);
    if (data.style.displayMode === 'numbered' && data.style.numberMode !== 'none') counters.equation += 1;
    items.push({
      kind: 'equation', level: 1, title: data.name || '未命名公式',
      label: data.style.displayMode === 'numbered' && data.style.numberMode !== 'none' ? `eq:${data.label}` : '',
      number: data.style.numberMode === 'manual' ? data.manualNumber : String(counters.equation || ''),
      offset: block.start
    });
    formulaCursor = block.end;
  }
  return items.sort((a, b) => a.offset - b.offset);
}

function parseAuxLabelNumbers(text) {
  const result = new Map();
  const pattern = /\\newlabel\{([^}]+)\}\{\{([^}]*)\}/g;
  let match;
  while ((match = pattern.exec(text))) result.set(match[1], match[2]);
  return result;
}

function estimateFormulaNumberContext(text, rawOffset) {
  const source = String(text || '');
  const offset = Math.max(0, Math.min(Number(rawOffset) || 0, source.length));
  const before = stripLatexComments(source.slice(0, offset));
  const sectionMatches = [...before.matchAll(/\\section(?!\*)\s*\{/g)];
  const chapterMatches = [...before.matchAll(/\\chapter(?!\*)\s*\{/g)];
  const equationMatches = [...before.matchAll(/\\refstepcounter\{equation\}/g)];
  const lastSection = sectionMatches.length ? sectionMatches[sectionMatches.length - 1].index : -1;
  const lastChapter = chapterMatches.length ? chapterMatches[chapterMatches.length - 1].index : -1;
  return {
    section: sectionMatches.length,
    chapter: chapterMatches.length,
    continuous: equationMatches.length + 1,
    withinSection: equationMatches.filter((match) => match.index > lastSection).length + 1,
    withinChapter: equationMatches.filter((match) => match.index > lastChapter).length + 1
  };
}

class FormulaTool {
  constructor(context) {
    this.context = context;
    this.panel = undefined;
    this.lastTarget = undefined;
    this.editing = undefined;
  }

  rememberEditor(editor) {
    if (!editor || editor.document.languageId !== 'latex') return;
    this.lastTarget = {
      uri: editor.document.uri.toString(),
      offset: editor.document.offsetAt(editor.selection.active),
      viewColumn: editor.viewColumn,
      name: path.basename(editor.document.fileName),
      line: editor.selection.active.line + 1
    };
    this.sendTarget();
  }

  getStyles() {
    const stored = this.context.globalState.get(FORMULA_STYLES_KEY);
    const source = Array.isArray(stored) && stored.length ? stored : [DEFAULT_FORMULA_STYLE];
    return source.map(sanitizeFormulaStyle);
  }

  getSavedFormulas() {
    const stored = this.context.globalState.get(SAVED_FORMULAS_KEY);
    return Array.isArray(stored) ? stored.map(sanitizeFormulaData) : [];
  }

  getVariables() {
    const stored = this.context.globalState.get(VARIABLES_KEY);
    const source = Array.isArray(stored) ? stored : DEFAULT_VARIABLES;
    return source.map(sanitizeVariable);
  }

  async saveStyles(items) {
    const styles = Array.isArray(items) && items.length ? items.map(sanitizeFormulaStyle) : [sanitizeFormulaStyle(DEFAULT_FORMULA_STYLE)];
    await this.context.globalState.update(FORMULA_STYLES_KEY, styles);
    this.sendState();
  }

  async saveFormulas(items) {
    await this.context.globalState.update(SAVED_FORMULAS_KEY, Array.isArray(items) ? items.map(sanitizeFormulaData) : []);
    this.sendState();
  }

  async saveVariables(items) {
    await this.context.globalState.update(VARIABLES_KEY, Array.isArray(items) ? items.map(sanitizeVariable) : []);
    this.sendState();
  }

  state() {
    return { styles: this.getStyles(), formulas: this.getSavedFormulas(), variables: this.getVariables() };
  }

  async open(editor, block) {
    if (editor) this.rememberEditor(editor);
    this.editing = block ? {
      uri: editor.document.uri.toString(), start: block.start, end: block.end, data: sanitizeFormulaData(block.data)
    } : undefined;
    if (!this.panel) {
      const panel = vscode.window.createWebviewPanel(
        'latexFormatPalette.formula', '公式工具', vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] }
      );
      this.attachPanel(panel);
      setTimeout(async () => {
        if (!this.panel) return;
        try {
          this.panel.reveal(undefined, false);
          await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
        } catch {
          // 旧版 VS Code 会保留为可拖出的编辑器标签。
        }
      }, 250);
    } else {
      this.panel.reveal(undefined, false);
    }
    this.sendState();
    this.sendTarget();
    if (this.editing) this.panel.webview.postMessage({ type: 'editFormula', formula: this.editing.data });
  }

  attachPanel(panel) {
    this.panel = panel;
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'activity-icon.svg');
    panel.webview.html = getFormulaHtml(panel.webview, this.context.extensionUri);
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = undefined; this.editing = undefined; });
    panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
  }

  sendState() {
    if (this.panel) this.panel.webview.postMessage({ type: 'state', ...this.state() });
  }

  sendTarget() {
    if (!this.panel) return;
    let numberContext = null;
    if (this.lastTarget) {
      const document = (vscode.workspace.textDocuments || []).find((item) => item.uri.toString() === this.lastTarget.uri);
      if (document) numberContext = estimateFormulaNumberContext(document.getText(), this.editing?.start ?? this.lastTarget.offset);
    }
    this.panel.webview.postMessage({
      type: 'target',
      target: this.lastTarget ? { name: this.lastTarget.name, line: this.lastTarget.line } : null,
      editing: Boolean(this.editing),
      numberContext
    });
  }

  async handleMessage(message) {
    try {
      switch (message.type) {
        case 'ready':
          this.sendState();
          this.sendTarget();
          if (this.editing && this.panel) this.panel.webview.postMessage({ type: 'editFormula', formula: this.editing.data });
          break;
        case 'refreshTarget': this.sendTarget(); break;
        case 'moveToWindow': await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow'); break;
        case 'saveStyles': await this.saveStyles(message.items); break;
        case 'saveFormulas': await this.saveFormulas(message.items); break;
        case 'saveVariables': await this.saveVariables(message.items); break;
        case 'insertFormula': await this.insertFormula(message.formula); break;
        case 'insertVariable': await this.insertVariable(message.variable); break;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`公式工具：${error.message || error}`);
    }
  }

  async ensureDocumentPackages(document, requiredPackages, tracked) {
    const text = document.getText();
    const missing = getMissingPackages(text, requiredPackages);
    if (!missing.length) return tracked;
    const documentStart = text.indexOf('\\begin{document}');
    if (documentStart < 0) throw new Error('当前文档没有找到 \\begin{document}。');
    const insertion = missing.map((name) => `\\usepackage{${name}}`).join('\n') + '\n\n';
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(documentStart), insertion);
    await vscode.workspace.applyEdit(edit);
    const adjust = (value) => value >= documentStart ? value + insertion.length : value;
    if (typeof tracked === 'number') return adjust(tracked);
    return { start: adjust(tracked.start), end: adjust(tracked.end) };
  }

  async insertFormula(rawFormula) {
    if (!this.lastTarget) throw new Error('请先在主窗口的 .tex 文件中放置光标。');
    const formula = sanitizeFormulaData(rawFormula);
    const wasEditing = Boolean(this.editing);
    const targetUri = vscode.Uri.parse(this.editing?.uri || this.lastTarget.uri);
    let document = await vscode.workspace.openTextDocument(targetUri);
    let tracked = this.editing ? { start: this.editing.start, end: this.editing.end } : this.lastTarget.offset;
    tracked = await this.ensureDocumentPackages(document, ['amsmath', 'amssymb'], tracked);
    document = await vscode.workspace.openTextDocument(targetUri);
    const blockText = buildFormulaBlock(formula);
    const edit = new vscode.WorkspaceEdit();
    if (this.editing) {
      const current = findManagedBlockInText(document.getText(), Math.min(tracked.start + 25, document.getText().length), 'formula');
      if (!current) throw new Error('原公式位置已变化，请在公式代码中重新右键修改。');
      edit.replace(document.uri, new vscode.Range(document.positionAt(current.start), document.positionAt(current.end)), blockText);
      this.lastTarget = { ...this.lastTarget, uri: document.uri.toString(), name: path.basename(document.fileName), offset: current.start + blockText.length, line: document.positionAt(current.start).line + 1 };
    } else {
      const offset = Math.max(0, Math.min(Number(tracked) || 0, document.getText().length));
      const insertion = `${blockText}\n`;
      edit.insert(document.uri, document.positionAt(offset), insertion);
      this.lastTarget = { ...this.lastTarget, offset: offset + insertion.length, line: document.positionAt(offset).line + 1 };
    }
    await vscode.workspace.applyEdit(edit);
    this.editing = undefined;
    this.sendTarget();
    if (this.panel) this.panel.webview.postMessage({ type: 'inserted', name: formula.name });
    vscode.window.showInformationMessage(`公式“${formula.name}”已${wasEditing ? '更新' : '插入'}。`);
  }

  async insertVariable(rawVariable) {
    const variable = sanitizeVariable(rawVariable);
    const style = sanitizeFormulaStyle({ ...DEFAULT_FORMULA_STYLE, displayMode: 'inline', numberMode: 'none', before: 0, after: 0 });
    this.editing = undefined;
    await this.insertFormula({
      name: variable.name, description: variable.description, kind: 'basic',
      values: { expression: variable.symbol }, style, label: `variable-${variable.id}`
    });
    const variables = this.getVariables();
    const index = variables.findIndex((item) => item.id === variable.id);
    if (index >= 0) variables[index].lastUsedAt = Date.now();
    await this.saveVariables(variables);
  }
}

class DocumentTool {
  constructor(context) {
    this.context = context;
    this.panel = undefined;
    this.lastEditorUri = undefined;
    this.lastIssues = [];
    this.pendingRepair = undefined;
    this.diagnostics = vscode.languages.createDiagnosticCollection('latexFormatPalette');
    context.subscriptions.push(this.diagnostics);
  }

  getTemplate() {
    return sanitizeDocumentTemplate(this.context.globalState.get(DOCUMENT_TEMPLATE_KEY) || DEFAULT_DOCUMENT_TEMPLATE);
  }

  getCheckOnSave() {
    return Boolean(this.context.globalState.get(CHECK_ON_SAVE_KEY));
  }

  rememberEditor(editor) {
    if (editor?.document?.languageId === 'latex') this.lastEditorUri = editor.document.uri.toString();
  }

  async open(editor) {
    this.rememberEditor(editor);
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One, false);
      await this.sendState();
      return;
    }
    const panel = vscode.window.createWebviewPanel('latexFormatPalette.document', 'LaTeX 文档工具', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    });
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'activity-icon.svg');
    this.attachPanel(panel);
  }

  attachPanel(panel) {
    this.panel = panel;
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    panel.webview.html = getDocumentToolHtml(panel.webview, this.context.extensionUri);
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = undefined; });
    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case 'ready': await this.sendState(); break;
          case 'saveDefault':
            await this.context.globalState.update(DOCUMENT_TEMPLATE_KEY, sanitizeDocumentTemplate(message.template));
            await this.sendState();
            vscode.window.showInformationMessage('默认新建文档方案已保存。');
            break;
          case 'quickCreate': await this.createDocument(this.getTemplate(), '新建默认论文文档'); break;
          case 'createDocument': await this.createDocument(message.template, '新建自定义论文文档'); break;
          case 'exportTemplate': await this.createDocument(message.template || this.getTemplate(), '导出可直接使用的论文模板'); break;
          case 'checkDocument': await this.checkCurrentDocument(true); break;
          case 'previewFixes': await this.previewFixes(message.ids || []); break;
          case 'applyPrepared': await this.applyPreparedRepair(); break;
          case 'toggleCheckOnSave':
            await this.context.globalState.update(CHECK_ON_SAVE_KEY, Boolean(message.enabled));
            await this.sendState();
            break;
          case 'navigateIssue': await this.navigateIssue(message.line); break;
          case 'explainLog': await this.explainCompileLog(); break;
        }
      } catch (error) {
        vscode.window.showErrorMessage(`LaTeX 文档工具：${error.message || error}`);
      }
    });
  }

  async resolveEditor() {
    const active = vscode.window.activeTextEditor;
    if (active?.document?.languageId === 'latex') return active;
    if (this.lastEditorUri) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.lastEditorUri));
      return vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
    }
    return undefined;
  }

  async sendState(extra = {}) {
    if (!this.panel) return;
    const editor = await this.resolveEditor().catch(() => undefined);
    this.panel.webview.postMessage({
      type: 'state',
      template: this.getTemplate(),
      checkOnSave: this.getCheckOnSave(),
      currentFile: editor ? path.basename(editor.document.fileName) : '',
      issues: this.lastIssues.map(({ fix, ...issue }) => issue),
      ...extra
    });
  }

  async createDocument(rawTemplate, title) {
    const template = sanitizeDocumentTemplate(rawTemplate);
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
    const target = await vscode.window.showSaveDialog({
      title,
      filters: { 'LaTeX 文档': ['tex'] },
      defaultUri: vscode.Uri.file(path.join(folder, '我的论文.tex'))
    });
    if (!target) return;
    const provider = this.paletteProvider;
    const content = buildNewDocument(template, {
      scheme: provider?.getDocumentScheme?.() || {},
      pageSettings: provider?.getPageSettings?.() || {},
      tocSettings: provider?.getTocSettings?.() || {}
    });
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    const document = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(document, { preview: false });
    this.lastEditorUri = document.uri.toString();
    vscode.window.showInformationMessage(`已创建“${path.basename(target.fsPath)}”，可以直接开始写作。`);
    await this.checkDocument(document, false);
  }

  setDiagnostics(document, issues) {
    const diagnostics = issues.map((issue) => {
      const line = Math.max(0, Math.min(document.lineCount - 1, (issue.line || 1) - 1));
      const range = document.lineAt(line).range;
      const severity = issue.severity === 'error' ? vscode.DiagnosticSeverity.Error
        : issue.severity === 'info' ? vscode.DiagnosticSeverity.Information : vscode.DiagnosticSeverity.Warning;
      const diagnostic = new vscode.Diagnostic(range, `${issue.title}${issue.detail ? `：${issue.detail}` : ''}`, severity);
      diagnostic.source = 'LaTeX 格式面板';
      diagnostic.code = issue.category;
      return diagnostic;
    });
    this.diagnostics.set(document.uri, diagnostics);
  }

  async checkDocument(document, revealResult = false) {
    const issues = analyzeLatexDocument(document.getText(), document.uri.scheme === 'file' ? document.uri.fsPath : '');
    this.lastIssues = issues;
    this.lastEditorUri = document.uri.toString();
    this.pendingRepair = undefined;
    this.setDiagnostics(document, issues);
    if (this.panel) await this.sendState({ type: 'checkResult', issues: issues.map(({ fix, ...issue }) => issue) });
    if (revealResult) {
      const errors = issues.filter((issue) => issue.severity === 'error').length;
      if (!issues.length) vscode.window.showInformationMessage('检查完成：没有发现明显的 LaTeX 结构问题。');
      else vscode.window.showInformationMessage(`检查完成：发现 ${issues.length} 个问题，其中 ${errors} 个错误。请在文档工具中查看。`);
    }
    return issues;
  }

  async checkCurrentDocument(revealResult = false) {
    const editor = await this.resolveEditor();
    if (!editor || editor.document.languageId !== 'latex') {
      vscode.window.showInformationMessage('请先打开需要检查的 .tex 文件。');
      return [];
    }
    return this.checkDocument(editor.document, revealResult);
  }

  changePreview(before, after) {
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
    let beforeSuffix = before.length;
    let afterSuffix = after.length;
    while (beforeSuffix > prefix && afterSuffix > prefix && before[beforeSuffix - 1] === after[afterSuffix - 1]) {
      beforeSuffix -= 1;
      afterSuffix -= 1;
    }
    const contextStart = Math.max(0, prefix - 500);
    const beforeEnd = Math.min(before.length, beforeSuffix + 500);
    const afterEnd = Math.min(after.length, afterSuffix + 500);
    return {
      before: `${contextStart ? '…\n' : ''}${before.slice(contextStart, beforeEnd)}${beforeEnd < before.length ? '\n…' : ''}`,
      after: `${contextStart ? '…\n' : ''}${after.slice(contextStart, afterEnd)}${afterEnd < after.length ? '\n…' : ''}`
    };
  }

  async previewFixes(ids) {
    const editor = await this.resolveEditor();
    if (!editor) return;
    const issues = analyzeLatexDocument(editor.document.getText(), editor.document.uri.scheme === 'file' ? editor.document.uri.fsPath : '');
    const allowedIds = new Set(issues.filter((issue) => issue.fixable).map((issue) => issue.id));
    const selected = ids.filter((id) => allowedIds.has(id));
    if (!selected.length) {
      vscode.window.showInformationMessage('请先勾选至少一个可修复问题。');
      return;
    }
    const before = editor.document.getText();
    const after = applyLatexFixes(before, issues, selected);
    this.pendingRepair = { uri: editor.document.uri.toString(), version: editor.document.version, after };
    this.panel?.webview.postMessage({ type: 'repairPreview', ...this.changePreview(before, after), count: selected.length });
  }

  async applyPreparedRepair() {
    const pending = this.pendingRepair;
    if (!pending) return;
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(pending.uri));
    if (document.version !== pending.version) {
      this.pendingRepair = undefined;
      vscode.window.showWarningMessage('文档在预览后发生了变化，请重新检查并预览。');
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, pending.after);
    if (!await vscode.workspace.applyEdit(edit)) throw new Error('无法应用修复。');
    this.pendingRepair = undefined;
    await this.checkDocument(document, false);
    vscode.window.showInformationMessage('修复已应用；如需撤销，请按一次 Ctrl+Z。');
  }

  async navigateIssue(rawLine) {
    const editor = await this.resolveEditor();
    if (!editor) return;
    const line = Math.max(0, Math.min(editor.document.lineCount - 1, Number(rawLine || 1) - 1));
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    await vscode.window.showTextDocument(editor.document, { preview: false, preserveFocus: false });
  }

  async explainCompileLog() {
    const editor = await this.resolveEditor();
    if (!editor || editor.document.uri.scheme !== 'file') return;
    const parsed = path.parse(editor.document.uri.fsPath);
    const logUri = vscode.Uri.file(path.join(parsed.dir, `${parsed.name}.log`));
    let log;
    try { log = Buffer.from(await vscode.workspace.fs.readFile(logUri)).toString('utf8'); }
    catch { vscode.window.showInformationMessage('没有找到当前文档的编译日志，请先使用 PDF 预览编译一次。'); return; }
    const rules = [
      [/Undefined control sequence[\s\S]{0,180}/i, '使用了未识别的命令：通常是命令拼写错误，或缺少对应宏包。'],
      [/File `[^']+' not found/i, '找不到文件：请检查图片、子文件或宏包名称与路径。'],
      [/Extra alignment tab has been changed to \\cr/i, '表格某一行的 & 太多，列数超过了表格设置。'],
      [/Misplaced \\noalign/i, '表格换行或横线位置有误，常见原因是行末缺少 \\\\。'],
      [/Runaway argument/i, '某个命令参数没有结束，常见原因是缺少右大括号。'],
      [/Missing \} inserted/i, '缺少右大括号，编译器尝试自动补齐。'],
      [/Emergency stop/i, '编译被迫停止，请优先处理日志中它之前出现的第一个错误。']
    ];
    const explanations = rules.filter(([pattern]) => pattern.test(log)).map(([, explanation]) => explanation);
    this.panel?.webview.postMessage({ type: 'logExplanation', explanations: explanations.length ? explanations : ['没有识别到常见错误。请先处理“检查当前文档”列出的结构问题，再查看编译日志中的第一个感叹号错误。'] });
  }

  async onDidSave(document) {
    if (!this.getCheckOnSave() || document.languageId !== 'latex') return;
    const issues = await this.checkDocument(document, false);
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    if (errors) vscode.window.setStatusBarMessage(`$(warning) LaTeX 文档检查：${errors} 个错误`, 5000);
  }
}

class FormatPaletteProvider {
  constructor(context, formulaTool, documentTool) {
    this.context = context;
    this.formulaTool = formulaTool;
    this.documentTool = documentTool;
    this.view = undefined;
    this.pendingTableEdit = undefined;
  }

  getPresets() {
    const stored = this.context.globalState.get(STORAGE_KEY);
    const source = Array.isArray(stored) ? stored : DEFAULT_PRESETS;
    const defaultTable = DEFAULT_PRESETS.find((preset) => preset.id === 'default-table');
    const defaultFigure = DEFAULT_PRESETS.find((preset) => preset.id === 'default-figure');
    return source.map((preset) => {
      // Upgrade the fixed-size table shipped in 0.1.x to the new dynamic table style.
      if (preset && preset.id === 'default-table' && preset.kind !== 'table') return normalizePreset(defaultTable);
      // Upgrade the fixed image template to the visual image style.
      if (preset && preset.id === 'default-figure' && preset.kind !== 'image') return normalizePreset(defaultFigure);
      return normalizePreset(preset);
    });
  }

  getDocumentScheme() {
    return sanitizeDocumentScheme(this.context.globalState.get(SCHEME_KEY) || {});
  }

  getTocSettings() {
    return sanitizeTocSettings(this.context.globalState.get(TOC_SETTINGS_KEY) || {});
  }

  getPageSettings() {
    return sanitizePageSettings(this.context.globalState.get(PAGE_SETTINGS_KEY) || {});
  }

  async savePresets(presets) {
    const normalized = presets.map(normalizePreset);
    await this.context.globalState.update(STORAGE_KEY, normalized);
    this.sendState();
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    webview.html = getPaletteHtml(webview, this.context.extensionUri);

    webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case 'ready':
            this.sendState();
            break;
          case 'insertPreset':
            await this.insertPreset(message.id);
            break;
          case 'insertTable':
            await this.insertTable(message.id, message.rows, message.columns, {
              title: message.title, label: message.label, cells: message.cells, merges: message.merges
            });
            break;
          case 'updateTableContent':
            await this.updateTableContent(message);
            break;
          case 'updateTableStyle':
            await this.updateTableStyle(message.settings);
            break;
          case 'browseImage':
            await this.browseImage(message.id);
            break;
          case 'droppedImage':
            await this.acceptImageFile(message.id, message.uri || message.path);
            break;
          case 'insertImage':
            await this.insertImage(message.id, message.latexPath, message.customFigureNumber, {
              captionText: message.captionText,
              label: message.label
            });
            break;
          case 'savePreset':
            await this.upsertPreset(message.preset);
            break;
          case 'deletePreset':
            await this.deletePreset(message.id);
            break;
          case 'movePreset':
            await this.movePreset(message.id, message.direction);
            break;
          case 'openHelp':
            showHelp(this.context);
            break;
          case 'openFormula':
            await this.formulaTool.open(vscode.window.activeTextEditor);
            break;
          case 'openDocumentTool':
            await this.documentTool.open(vscode.window.activeTextEditor);
            break;
          case 'importPresets':
            await importPresets(this.context, this);
            break;
          case 'exportPresets':
            await exportPresets(this.context, this);
            break;
          case 'resetDefaults':
            await this.resetDefaults();
            break;
          case 'saveDocumentScheme':
            await this.saveDocumentScheme(message.scheme);
            break;
          case 'applyToc':
            await this.applyToc(message.settings, Boolean(message.preview));
            break;
          case 'deleteToc':
            await this.deleteManagedDocumentPart('toc', '目录');
            break;
          case 'applyPageSettings':
            await this.applyPageSettings(message.settings);
            break;
          case 'deletePageSettings':
            await this.deletePageSettings();
            break;
          case 'previewPdf':
            await previewCurrentPdf();
            break;
          case 'getOutline':
            await this.sendOutline();
            break;
          case 'navigateOutline':
            await this.navigateOutline(message.offset);
            break;
          case 'insertReference':
            await this.insertReference(message.label, message.kind);
            break;
        }
      } catch (error) {
        vscode.window.showErrorMessage(`LaTeX 格式面板：${error.message || error}`);
      }
    });
  }

  sendState() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'state',
      presets: this.getPresets(),
      documentScheme: this.getDocumentScheme(),
      tocSettings: this.getTocSettings(),
      pageSettings: this.getPageSettings()
    });
  }

  async revealPanel(message) {
    if (this.view?.show) this.view.show(true);
    await vscode.commands.executeCommand('workbench.view.extension.latexFormatPalette');
    if (this.view) this.view.webview.postMessage(message);
  }

  async openTocSettings(settings) {
    await this.revealPanel({ type: 'editTocSettings', settings: sanitizeTocSettings(settings) });
  }

  async openPageSettings(settings) {
    await this.revealPanel({ type: 'editPageSettings', settings: sanitizePageSettings(settings) });
  }

  async openFormulaEditor(editor, block) {
    await this.formulaTool.open(editor, block);
  }

  getLatexEditor(message = '请先把光标放到一个 LaTeX（.tex）文件中。') {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'latex') {
      vscode.window.showInformationMessage(message);
      return null;
    }
    return editor;
  }

  async applyToc(rawSettings, preview = false) {
    const editor = this.getLatexEditor();
    if (!editor) return;
    const settings = sanitizeTocSettings(rawSettings);
    await this.context.globalState.update(TOC_SETTINGS_KEY, settings);
    if (!await ensurePackages(editor, ['tocloft'])) return;
    const text = editor.document.getText();
    const existing = findFirstManagedBlockInText(text, 'toc');
    const block = buildTocBlock(settings);
    if (existing) {
      const range = new vscode.Range(editor.document.positionAt(existing.start), editor.document.positionAt(existing.end));
      await editor.edit((builder) => builder.replace(range, block));
      vscode.window.showInformationMessage('已更新现有目录，没有重复插入。');
    } else {
      await editor.edit((builder) => builder.insert(editor.selection.active, block));
      vscode.window.showInformationMessage('目录已插入。');
    }
    this.sendState();
    if (preview) await refreshTocPdf();
  }

  async deleteManagedDocumentPart(kind, displayName) {
    const editor = this.getLatexEditor();
    if (!editor) return;
    const existing = findFirstManagedBlockInText(editor.document.getText(), kind);
    if (!existing) {
      vscode.window.showInformationMessage(`当前文档中没有由格式面板生成的${displayName}。`);
      return;
    }
    const answer = await vscode.window.showWarningMessage(`确定删除由格式面板生成的${displayName}吗？`, { modal: true }, '删除');
    if (answer !== '删除') return;
    const range = new vscode.Range(editor.document.positionAt(existing.start), editor.document.positionAt(existing.end));
    await editor.edit((builder) => builder.delete(range));
    vscode.window.showInformationMessage(`${displayName}已删除。`);
  }

  async applyPageSettings(rawSettings) {
    const editor = this.getLatexEditor();
    if (!editor) return;
    const settings = sanitizePageSettings(rawSettings);
    const originalText = editor.document.getText();
    const existingNumberBlock = findFirstManagedBlockInText(originalText, 'page-number');
    const documentStart = originalText.indexOf('\\begin{document}');
    if (settings.startAt === 'current' && !existingNumberBlock && (
      documentStart < 0 || editor.document.offsetAt(editor.selection.active) <= documentStart + '\\begin{document}'.length
    )) {
      vscode.window.showWarningMessage('请先把光标放在正文需要开始编号的位置，再应用页面设置。');
      return;
    }
    await this.context.globalState.update(PAGE_SETTINGS_KEY, settings);
    const pagePackages = ['fancyhdr', 'geometry'];
    if (settings.columns > 1) pagePackages.push('multicol');
    if (!await ensurePackages(editor, pagePackages)) return;

    let text = editor.document.getText();
    let existing = findFirstManagedBlockInText(text, 'page');
    const styleBlock = buildPageStyleBlock(settings);
    let targetOffset = editor.document.offsetAt(editor.selection.active);
    let targetOffsetDelta = 0;
    if (existing) {
      const range = new vscode.Range(editor.document.positionAt(existing.start), editor.document.positionAt(existing.end));
      if (existing.end <= targetOffset) targetOffsetDelta = styleBlock.length - (existing.end - existing.start);
      await editor.edit((builder) => builder.replace(range, styleBlock));
    } else {
      const begin = editor.document.getText().indexOf('\\begin{document}');
      const position = begin >= 0 ? editor.document.positionAt(begin) : new vscode.Position(0, 0);
      if ((begin >= 0 ? begin : 0) <= targetOffset) targetOffsetDelta = styleBlock.length + 2;
      await editor.edit((builder) => builder.insert(position, `${styleBlock}\n\n`));
    }
    if (settings.startAt === 'current' && !existingNumberBlock) {
      targetOffset = Math.max(0, targetOffset + targetOffsetDelta);
      const position = editor.document.positionAt(targetOffset);
      editor.selection = new vscode.Selection(position, position);
    }

    text = editor.document.getText();
    existing = findFirstManagedBlockInText(text, 'page-number');
    if (settings.startAt === 'current') {
      const numberBlock = buildPageNumberStartBlock(settings);
      if (existing) {
        const range = new vscode.Range(editor.document.positionAt(existing.start), editor.document.positionAt(existing.end));
        await editor.edit((builder) => builder.replace(range, numberBlock));
      } else {
        await editor.edit((builder) => builder.insert(editor.selection.active, `${numberBlock}\n`));
      }
    } else if (existing) {
      const range = new vscode.Range(editor.document.positionAt(existing.start), editor.document.positionAt(existing.end));
      await editor.edit((builder) => builder.delete(range));
    }
    this.sendState();
    vscode.window.showInformationMessage('页面设置已应用，再次保存会更新原设置。');
  }

  async deletePageSettings() {
    const editor = this.getLatexEditor();
    if (!editor) return;
    const answer = await vscode.window.showWarningMessage('确定删除由格式面板生成的页眉、页脚和页码设置吗？', { modal: true }, '删除');
    if (answer !== '删除') return;
    const text = editor.document.getText();
    const blocks = ['page', 'page-number']
      .map((kind) => findFirstManagedBlockInText(text, kind))
      .filter(Boolean)
      .sort((a, b) => b.start - a.start);
    if (!blocks.length) {
      vscode.window.showInformationMessage('当前文档中没有由格式面板生成的页面设置。');
      return;
    }
    await editor.edit((builder) => {
      for (const block of blocks) {
        builder.delete(new vscode.Range(editor.document.positionAt(block.start), editor.document.positionAt(block.end)));
      }
    });
    vscode.window.showInformationMessage('页面设置已删除，fancyhdr 宏包保留不会影响正文。');
  }

  async saveDocumentScheme(rawScheme) {
    const scheme = sanitizeDocumentScheme(rawScheme);
    await this.context.globalState.update(SCHEME_KEY, scheme);
    const category = `论文方案 · ${scheme.name}`;
    const defaultImage = DEFAULT_PRESETS.find((item) => item.id === 'default-figure');
    const defaultTable = DEFAULT_PRESETS.find((item) => item.id === 'default-table');
    const coordinated = [
      {
        id: 'scheme-body', name: `${scheme.name}·正文`, category, icon: '¶', kind: 'paragraph',
        description: '论文方案生成的正文样式',
        settings: {
          fontFamily: scheme.bodyFontFamily, fontSize: scheme.bodyFontSize,
          lineSpacingMode: 'multiple', lineSpacingValue: scheme.bodyLineSpacing,
          beforeMode: 'lines', beforeValue: 0, afterMode: 'lines', afterValue: 0,
          leftIndent: 0, rightIndent: 0, indentMode: 'first', indentValue: 2,
          alignment: 'justify', bold: false, italic: false,
          pageBreakBefore: false, keepWithNext: false, avoidWidowOrphan: scheme.avoidWidowOrphan
        }
      },
      {
        id: 'scheme-heading1', name: `${scheme.name}·一级标题`, category, icon: 'H1', kind: 'custom',
        description: '论文方案生成的一级标题',
        template: buildSchemeHeadingTemplate('section', scheme, scheme.heading1FontSize, scheme.heading1PageBreakBefore)
      },
      {
        id: 'scheme-heading2', name: `${scheme.name}·二级标题`, category, icon: 'H2', kind: 'custom',
        description: '论文方案生成的二级标题',
        template: buildSchemeHeadingTemplate('subsection', scheme, scheme.heading2FontSize, false)
      },
      {
        id: 'scheme-image', name: `${scheme.name}·图片`, category, icon: '图', kind: 'image',
        description: '论文方案生成的图片样式',
        settings: {
          ...defaultImage.settings,
          captionFontFamily: scheme.captionFontFamily,
          captionFontSize: scheme.captionFontSize
        }
      },
      {
        id: 'scheme-table', name: `${scheme.name}·表格`, category, icon: '表', kind: 'table',
        description: '论文方案生成的表格样式',
        settings: {
          ...defaultTable.settings,
          bodyFontFamily: scheme.bodyFontFamily,
          bodyFontSize: scheme.tableFontSize,
          headerFontFamily: scheme.headingFontFamily,
          headerFontSize: scheme.tableFontSize,
          tableCaptionFontFamily: scheme.captionFontFamily,
          tableCaptionFontSize: scheme.captionFontSize
        }
      }
    ].map(normalizePreset);
    const ids = new Set(coordinated.map((item) => item.id));
    const presets = this.getPresets().filter((item) => !ids.has(item.id));
    await this.savePresets([...coordinated, ...presets]);
    vscode.window.showInformationMessage(`论文格式方案“${scheme.name}”已生成。`);
  }

  async sendOutline() {
    const editor = vscode.window.activeTextEditor || vscode.window.visibleTextEditors.find((item) => item.document.languageId === 'latex');
    if (!editor || editor.document.languageId !== 'latex') {
      if (this.view) this.view.webview.postMessage({ type: 'outlineData', items: [], error: '请先打开一个 LaTeX 文件。' });
      return;
    }
    this.outlineDocumentUri = editor.document.uri.toString();
    const items = scanDocumentOutline(editor.document.getText());
    if (editor.document.uri.scheme === 'file') {
      try {
        const parsed = path.parse(editor.document.uri.fsPath);
        const auxUri = vscode.Uri.file(path.join(parsed.dir, `${parsed.name}.aux`));
        const auxText = Buffer.from(await vscode.workspace.fs.readFile(auxUri)).toString('utf8');
        const numbers = parseAuxLabelNumbers(auxText);
        items.forEach((item) => {
          if (item.label && numbers.has(item.label)) item.number = numbers.get(item.label);
        });
      } catch {
        // 尚未编译时继续显示按源码顺序估算的编号。
      }
    }
    if (this.view) this.view.webview.postMessage({
      type: 'outlineData',
      items,
      documentName: path.basename(editor.document.fileName)
    });
  }

  async getOutlineEditor() {
    if (!this.outlineDocumentUri) return vscode.window.activeTextEditor;
    let editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === this.outlineDocumentUri);
    if (editor) return editor;
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.outlineDocumentUri));
    editor = await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
    return editor;
  }

  async navigateOutline(rawOffset) {
    const editor = await this.getOutlineEditor();
    if (!editor) return;
    const offset = Math.max(0, Math.min(Number(rawOffset) || 0, editor.document.getText().length));
    const position = editor.document.positionAt(offset);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  async insertReference(rawLabel, kind) {
    const label = String(rawLabel || '').trim();
    if (!label) {
      vscode.window.showInformationMessage('这个项目没有引用名称，无法插入引用。');
      return;
    }
    const editor = await this.getOutlineEditor();
    if (!editor) return;
    const prefix = kind === 'figure' ? '图' : kind === 'table' ? '表' : kind === 'equation' ? '式' : '';
    await editor.insertSnippet(new vscode.SnippetString(`${prefix}~\\ref{${escapeSnippetText(label)}}`));
  }

  async insertPreset(id) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'latex') {
      vscode.window.showInformationMessage('请先把光标放到一个 LaTeX（.tex）文件中。');
      return;
    }
    const preset = this.getPresets().find((item) => item.id === id);
    if (!preset) return;
    if (preset.id === 'default-equation') {
      await this.formulaTool.open(editor);
      return;
    }
    if (preset.kind === 'image') {
      if (this.view) {
        this.view.webview.postMessage({
          type: 'chooseImage',
          preset: {
            id: preset.id,
            name: preset.name,
            numberMode: preset.settings.numberMode || 'automatic',
            hasCaption: preset.settings.hasCaption !== false
          }
        });
      }
      return;
    }
    if (preset.kind === 'table') {
      if (this.view) {
        this.view.webview.postMessage({
          type: 'chooseTableSize',
          preset: {
            id: preset.id,
            name: preset.name,
            hasHeader: preset.settings.hasHeader
          }
        });
      }
      return;
    }
    await editor.insertSnippet(new vscode.SnippetString(`${getSnippet(preset)}\n$0`));
  }

  async browseImage(id) {
    const selected = await vscode.window.showOpenDialog({
      title: '选择要插入的图片',
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: '选择这张图片',
      filters: {
        'LaTeX 常用图片': ['png', 'jpg', 'jpeg', 'pdf']
      }
    });
    if (selected && selected[0]) await this.acceptImageFile(id, selected[0].toString());
  }

  async acceptImageFile(id, uriOrPath) {
    const preset = this.getPresets().find((item) => item.id === id && item.kind === 'image');
    if (!preset || !uriOrPath) return;
    let uri;
    try {
      uri = String(uriOrPath).startsWith('file:') ? vscode.Uri.parse(String(uriOrPath)) : vscode.Uri.file(String(uriOrPath));
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File) throw new Error('请选择一个图片文件。');
    } catch {
      vscode.window.showErrorMessage('无法读取拖入的图片，请点击“打开文件资源管理器”重新选择。');
      return;
    }

    const extension = path.extname(uri.fsPath).toLowerCase();
    const supported = ['.png', '.jpg', '.jpeg', '.pdf'];
    if (!supported.includes(extension)) {
      vscode.window.showErrorMessage('请选择 PNG、JPG、JPEG 或 PDF 图片。');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    let latexPath = uri.fsPath.replace(/\\/g, '/');
    if (editor && editor.document.uri.scheme === 'file') {
      latexPath = path.relative(path.dirname(editor.document.uri.fsPath), uri.fsPath).replace(/\\/g, '/');
    }
    if (this.view) {
      let previewDataUrl = '';
      if (['.png', '.jpg', '.jpeg'].includes(extension)) {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (bytes.length <= 8 * 1024 * 1024) previewDataUrl = `data:${extension === '.png' ? 'image/png' : 'image/jpeg'};base64,${Buffer.from(bytes).toString('base64')}`;
        } catch { /* 文件名仍可正常显示。 */ }
      }
      this.view.webview.postMessage({
        type: 'imageSelected',
        presetId: id,
        fileName: path.basename(uri.fsPath),
        latexPath,
        previewDataUrl
      });
    }
  }

  async insertImage(id, latexPath, customFigureNumber = '', insertedContent = {}) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'latex') {
      vscode.window.showInformationMessage('请先把光标放到一个 LaTeX（.tex）文件中。');
      return;
    }
    const preset = this.getPresets().find((item) => item.id === id && item.kind === 'image');
    if (!preset || !latexPath) return;
    const packages = ['graphicx'];
    if (preset.settings.placement === 'H') packages.push('float');
    if (!await ensurePackages(editor, packages)) return;
    await editor.insertSnippet(new vscode.SnippetString(`${buildImageSnippet(
      { ...preset.settings, styleId: preset.id },
      String(latexPath),
      customFigureNumber,
      insertedContent
    )}\n$0`));
  }

  async insertTable(id, rows, columns, tableContent = {}) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'latex') {
      vscode.window.showInformationMessage('请先把光标放到一个 LaTeX（.tex）文件中。');
      return;
    }
    const preset = this.getPresets().find((item) => item.id === id && item.kind === 'table');
    if (!preset) return;
    const packages = [];
    if (preset.settings.borderStyle === 'threeLine') packages.push('booktabs');
    if (preset.settings.placement === 'H') packages.push('float');
    if (preset.settings.columnWidths?.length) packages.push('array');
    if (preset.settings.repeatHeader) packages.push('longtable');
    if (!await ensurePackages(editor, packages)) return;
    const snippet = buildTableSnippet({ ...preset.settings, styleId: preset.id }, rows, columns, tableContent);
    await editor.insertSnippet(new vscode.SnippetString(`${snippet}\n$0`));
  }

  async updateTableContent(message) {
    const pending = this.pendingTableEdit;
    const editor = vscode.window.activeTextEditor;
    if (!pending || !editor || editor.document.uri.toString() !== pending.uri) {
      vscode.window.showErrorMessage('找不到原表格，请重新把光标放入表格后再试。');
      return;
    }
    const current = findManagedBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active), 'table');
    if (!current) {
      vscode.window.showErrorMessage('表格位置已经变化，请重新右键编辑。');
      return;
    }
    const content = {
      title: message.title,
      label: message.label,
      cells: Array.isArray(message.cells) ? message.cells : [],
      merges: Array.isArray(message.merges) ? message.merges : []
    };
    const replacement = buildTableSnippet(pending.data.settings, message.rows, message.columns, content);
    const packages = [];
    if (pending.data.settings.borderStyle === 'threeLine') packages.push('booktabs');
    if (pending.data.settings.placement === 'H') packages.push('float');
    if (pending.data.settings.columnWidths?.length) packages.push('array');
    if (pending.data.settings.repeatHeader) packages.push('longtable');
    if (!await ensurePackages(editor, packages)) return;
    const refreshed = findManagedBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active), 'table');
    if (!refreshed) return;
    const range = new vscode.Range(editor.document.positionAt(refreshed.start), editor.document.positionAt(refreshed.end));
    await editor.insertSnippet(new vscode.SnippetString(`${replacement}\n$0`), range);
    this.pendingTableEdit = undefined;
    vscode.window.showInformationMessage('表格内容已更新。');
  }

  async beginTableEdit(editor, block, mode) {
    this.pendingTableEdit = {
      uri: editor.document.uri.toString(),
      data: block.data
    };
    if (this.view?.show) this.view.show(true);
    await vscode.commands.executeCommand('workbench.view.extension.latexFormatPalette');
    const message = mode === 'style'
      ? { type: 'editInsertedTableStyle', table: block.data }
      : { type: 'editTableContent', table: block.data };
    if (this.view) this.view.webview.postMessage(message);
  }

  async updateTableStyle(rawSettings) {
    const pending = this.pendingTableEdit;
    const editor = vscode.window.activeTextEditor;
    if (!pending || !editor || editor.document.uri.toString() !== pending.uri) {
      vscode.window.showErrorMessage('找不到原表格，请重新右键编辑。');
      return;
    }
    const settings = sanitizeTableSettings(rawSettings);
    const packages = [];
    if (settings.borderStyle === 'threeLine') packages.push('booktabs');
    if (settings.placement === 'H') packages.push('float');
    if (settings.columnWidths?.length) packages.push('array');
    if (settings.repeatHeader) packages.push('longtable');
    if (!await ensurePackages(editor, packages)) return;
    const current = findManagedBlockInText(editor.document.getText(), editor.document.offsetAt(editor.selection.active), 'table');
    if (!current) return;
    const data = pending.data;
    const replacement = buildTableSnippet(settings, data.rows, data.columns, {
      title: data.title, label: data.label, cells: data.cells, merges: data.merges
    });
    const range = new vscode.Range(editor.document.positionAt(current.start), editor.document.positionAt(current.end));
    await editor.insertSnippet(new vscode.SnippetString(`${replacement}\n$0`), range);
    this.pendingTableEdit = undefined;
    vscode.window.showInformationMessage('表格样式已更新。');
  }

  async upsertPreset(raw) {
    const preset = normalizePreset(raw);
    const presets = this.getPresets();
    const index = presets.findIndex((item) => item.id === preset.id);
    if (index >= 0) presets[index] = preset;
    else presets.push(preset);
    await this.savePresets(presets);
    if (index >= 0) await this.updatePresetOccurrences(preset);
  }

  async updatePresetOccurrences(preset) {
    const workspaceEdit = new vscode.WorkspaceEdit();
    let updated = 0;
    for (const document of vscode.workspace.textDocuments.filter((item) => item.languageId === 'latex')) {
      const textValue = document.getText();
      const kind = preset.kind === 'paragraph' ? 'paragraph' : preset.kind === 'table' ? 'table' : preset.kind === 'image' ? 'image' : '';
      if (!kind) continue;
      const marker = `% LFP:${kind}:start `;
      let cursor = 0;
      while ((cursor = textValue.indexOf(marker, cursor)) >= 0) {
        const block = findManagedBlockInText(textValue, cursor + marker.length, kind);
        if (!block) break;
        const settings = kind === 'paragraph' ? block.data : block.data.settings;
        if (settings?.styleId === preset.id) {
          let replacement = block.text;
          if (kind === 'paragraph') replacement = buildParagraphSnippet({ ...preset.settings, styleId: preset.id }, extractManagedParagraphContent(block.text));
          if (kind === 'table') replacement = buildTableSnippet({ ...preset.settings, styleId: preset.id }, block.data.rows, block.data.columns, block.data);
          if (kind === 'image') replacement = buildImageSnippet({ ...preset.settings, styleId: preset.id }, block.data.path, block.data.customFigureNumber, block.data.insertedContent);
          workspaceEdit.replace(document.uri, new vscode.Range(document.positionAt(block.start), document.positionAt(block.end)), replacement);
          updated += 1;
        }
        cursor = block.end;
      }
    }
    if (updated) {
      await vscode.workspace.applyEdit(workspaceEdit);
      vscode.window.showInformationMessage(`已将“${preset.name}”同步到当前打开文档中的 ${updated} 处内容。`);
    }
  }

  async deletePreset(id) {
    const presets = this.getPresets();
    const target = presets.find((item) => item.id === id);
    if (!target) return;
    const answer = await vscode.window.showWarningMessage(
      `确定删除“${target.name}”吗？`,
      { modal: true },
      '删除'
    );
    if (answer === '删除') await this.savePresets(presets.filter((item) => item.id !== id));
  }

  async movePreset(id, direction) {
    const presets = this.getPresets();
    const from = presets.findIndex((item) => item.id === id);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= presets.length) return;
    [presets[from], presets[to]] = [presets[to], presets[from]];
    await this.savePresets(presets);
  }

  async resetDefaults() {
    const answer = await vscode.window.showWarningMessage(
      '恢复默认格式会替换当前全部格式。建议先导出备份。',
      { modal: true },
      '恢复默认格式'
    );
    if (answer === '恢复默认格式') {
      await this.context.globalState.update(SCHEME_KEY, undefined);
      await this.savePresets(DEFAULT_PRESETS);
    }
  }
}

async function exportPresets(context, provider) {
  const parts = await vscode.window.showQuickPick([
    { label: '段落、图片和表格格式', value: 'presets', picked: true },
    { label: '公式样式和常用公式', value: 'formulas', picked: true },
    { label: '符号与变量库', value: 'variables', picked: true },
    { label: '默认文档、目录和页面方案', value: 'document', picked: true }
  ], { title: '选择要放入格式包的内容', canPickMany: true });
  if (!parts || !parts.length) return;
  const selectedParts = new Set(parts.map((item) => item.value));
  const target = await vscode.window.showSaveDialog({
    title: '导出 LaTeX 格式包',
    filters: { 'LaTeX 格式包': ['latexstyles'], 'JSON': ['json'] },
    defaultUri: vscode.Uri.file(path.join(os.homedir(), '我的论文格式.latexstyles'))
  });
  if (!target) return;
  const data = {
    type: 'latex-format-palette',
    version: FORMAT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    presets: selectedParts.has('presets') ? provider.getPresets() : [],
    formulaStyles: selectedParts.has('formulas') ? provider.formulaTool.getStyles() : [],
    savedFormulas: selectedParts.has('formulas') ? provider.formulaTool.getSavedFormulas() : [],
    variables: selectedParts.has('variables') ? provider.formulaTool.getVariables() : [],
    documentTemplate: selectedParts.has('document') ? sanitizeDocumentTemplate(context.globalState.get(DOCUMENT_TEMPLATE_KEY) || DEFAULT_DOCUMENT_TEMPLATE) : undefined,
    documentScheme: selectedParts.has('document') ? provider.getDocumentScheme() : undefined,
    tocSettings: selectedParts.has('document') ? provider.getTocSettings() : undefined,
    pageSettings: selectedParts.has('document') ? provider.getPageSettings() : undefined
  };
  await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
  vscode.window.showInformationMessage('格式包已导出，可以直接发给其他人。');
}

async function importPresets(context, provider) {
  const selected = await vscode.window.showOpenDialog({
    title: '导入 LaTeX 格式包',
    canSelectMany: false,
    filters: { 'LaTeX 格式包': ['latexstyles', 'json'] }
  });
  if (!selected || !selected[0]) return;
  const bytes = await vscode.workspace.fs.readFile(selected[0]);
  let data;
  try {
    data = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new Error('无法读取这个格式包，请确认文件没有损坏。');
  }
  if (!data || data.type !== 'latex-format-palette' || !Array.isArray(data.presets)) {
    throw new Error('这不是有效的 LaTeX 格式面板文件。');
  }
  if (data.version !== FORMAT_FILE_VERSION) {
    throw new Error('这个格式包来自旧版插件。2.0 使用全新格式，请在新版中重新建立后再分享。');
  }

  const choice = await vscode.window.showQuickPick(
    [
      { label: '合并导入', description: '保留现有格式，同名格式也会一起加入', value: 'merge' },
      { label: '替换全部', description: '删除现有格式，只保留导入内容', value: 'replace' }
    ],
    { title: `发现 ${data.presets.length} 个格式，选择导入方式` }
  );
  if (!choice) return;
  const imported = data.presets.map((preset) => ({ ...preset, id: `imported-${Date.now()}-${Math.random().toString(16).slice(2)}` }));
  await provider.savePresets(choice.value === 'replace' ? imported : [...provider.getPresets(), ...imported]);
  const importStamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const styleIdMap = new Map();
  const importedStyles = Array.isArray(data.formulaStyles) ? data.formulaStyles.map((rawStyle, index) => {
    const style = sanitizeFormulaStyle(rawStyle);
    const newId = `imported-style-${importStamp}-${index}`;
    styleIdMap.set(style.id, newId);
    return { ...style, id: newId };
  }) : [];
  const importedFormulas = Array.isArray(data.savedFormulas) ? data.savedFormulas.map((rawFormula, index) => {
    const formula = sanitizeFormulaData(rawFormula);
    const mappedStyle = formula.style && styleIdMap.has(formula.style.id)
      ? { ...formula.style, id: styleIdMap.get(formula.style.id) }
      : formula.style;
    return { ...formula, id: `imported-formula-${importStamp}-${index}`, style: mappedStyle };
  }) : [];
  const importedVariables = Array.isArray(data.variables) ? data.variables.map((rawVariable, index) => ({
    ...sanitizeVariable(rawVariable), id: `imported-variable-${importStamp}-${index}`
  })) : [];
  if (importedStyles.length) await provider.formulaTool.saveStyles(choice.value === 'replace' ? importedStyles : [...provider.formulaTool.getStyles(), ...importedStyles]);
  if (importedFormulas.length) await provider.formulaTool.saveFormulas(choice.value === 'replace' ? importedFormulas : [...provider.formulaTool.getSavedFormulas(), ...importedFormulas]);
  if (importedVariables.length) await provider.formulaTool.saveVariables(choice.value === 'replace' ? importedVariables : [...provider.formulaTool.getVariables(), ...importedVariables]);
  if (data.documentTemplate) await context.globalState.update(DOCUMENT_TEMPLATE_KEY, sanitizeDocumentTemplate(data.documentTemplate));
  if (data.documentScheme) await context.globalState.update(SCHEME_KEY, sanitizeDocumentScheme(data.documentScheme));
  if (data.tocSettings) await context.globalState.update(TOC_SETTINGS_KEY, sanitizeTocSettings(data.tocSettings));
  if (data.pageSettings) await context.globalState.update(PAGE_SETTINGS_KEY, sanitizePageSettings(data.pageSettings));
  provider.sendState();
  if (provider.documentTool?.panel) await provider.documentTool.sendState();
  vscode.window.showInformationMessage(`已导入 ${imported.length} 个格式、${importedFormulas.length} 个公式、${importedVariables.length} 个变量${data.documentTemplate ? '和文档方案' : ''}。`);
}

function showHelp(context) {
  const panel = vscode.window.createWebviewPanel(
    'latexFormatPalette.help',
    'LaTeX 格式面板 · 使用教程',
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'activity-icon.svg');
  panel.webview.html = getHelpHtml();
}

function nonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) value += chars.charAt(Math.floor(Math.random() * chars.length));
  return value;
}

function getPaletteHtml(webview, extensionUri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'palette.js'));
  const csp = [
    "default-src 'none'",
    "img-src data:",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource}`
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>${PALETTE_CSS}</style>
</head>
<body>
  <header class="topbar">
    <button class="primary" id="newButton">＋ 新建格式</button>
    <details class="tool-group" open><summary>插入</summary><div><button title="在独立窗口中可视化编辑公式" id="formulaButton">公式</button><button title="插入或更新带页码的目录" id="tocButton">目录</button></div></details>
    <details class="tool-group"><summary>文档</summary><div><button title="统一设置正文、标题、图片和表格" id="schemeButton">论文方案</button><button title="设置纸张、页边距、页眉页脚和页码" id="pageButton">页面设置</button><button title="新建、检查和修复 LaTeX 文档" id="documentButton">文档工具</button></div></details>
    <details class="tool-group"><summary>查看</summary><div><button title="查看章节、图片和表格" id="outlineButton">导航引用</button><button title="编译当前论文并预览 PDF" id="previewButton">PDF 预览</button></div></details>
    <details class="tool-group"><summary>分享与帮助</summary><div><button title="导入格式包" id="importButton">导入</button><button title="导出格式包" id="exportButton">导出</button><button title="打开使用教程" id="helpButton">教程</button></div></details>
  </header>

  <div id="empty" class="empty" hidden>
    <div class="empty-icon">✦</div>
    <p>还没有格式</p>
    <button id="emptyNewButton">创建第一个格式</button>
  </div>
  <main id="presetList" aria-live="polite"></main>

  <footer>
    <button class="link-button" id="resetButton">恢复默认格式</button>
  </footer>

  <dialog id="editorDialog">
    <form id="presetForm" method="dialog">
      <div class="dialog-title">
        <strong id="dialogTitle">新建格式</strong>
        <button type="button" class="icon-button" id="closeButton" aria-label="关闭">×</button>
      </div>

      <input type="hidden" id="presetId">
      <div class="row two">
        <label>格式名称<input id="name" maxlength="60" required placeholder="例如：论文正文"></label>
        <label>分组<input id="category" maxlength="30" placeholder="例如：段落"></label>
      </div>
      <div class="row two compact-second">
        <label>说明<input id="description" maxlength="160" placeholder="这个格式的用途"></label>
        <label>图标<input id="icon" maxlength="4" placeholder="¶"></label>
      </div>
      <label>格式类型
        <select id="kind">
          <option value="paragraph">可视化段落格式</option>
          <option value="image">可视化图片样式</option>
          <option value="table">可视化表格样式</option>
          <option value="custom">自定义 LaTeX 模板</option>
        </select>
      </label>

      <section id="paragraphFields">
        <div class="format-toolbar" aria-label="文字样式">
          <button type="button" id="boldButton" title="粗体"><b>B</b></button>
          <button type="button" id="italicButton" title="斜体"><i>I</i></button>
          <button type="button" class="align active" data-align="left" title="左对齐">≡</button>
          <button type="button" class="align" data-align="center" title="居中">≡</button>
          <button type="button" class="align" data-align="right" title="右对齐">≡</button>
          <button type="button" class="align" data-align="justify" title="两端对齐">☰</button>
        </div>
        <div class="row three">
          <label>字体
            <select id="fontFamily">
              <option value="inherit">沿用论文设置</option><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option>
            </select>
          </label>
          <label>字号
            <select id="fontSize">
              <option value="5">八号（5 pt）</option><option value="5.5">七号（5.5 pt）</option><option value="6.5">小六（6.5 pt）</option><option value="7.5">六号（7.5 pt）</option><option value="9">小五（9 pt）</option><option value="10.5">五号（10.5 pt）</option><option value="12" selected>小四（12 pt）</option><option value="14">四号（14 pt）</option><option value="15">小三（15 pt）</option><option value="16">三号（16 pt）</option><option value="18">小二（18 pt）</option><option value="22">二号（22 pt）</option><option value="24">小一（24 pt）</option><option value="26">一号（26 pt）</option><option value="36">小初（36 pt）</option><option value="42">初号（42 pt）</option>
            </select>
          </label>
          <label>行距方式
            <select id="lineSpacingMode"><option value="single">单倍行距</option><option value="onehalf">1.5 倍行距</option><option value="double">双倍行距</option><option value="multiple" selected>多倍行距</option><option value="fixed">固定值（pt）</option><option value="atleast">最小值（pt）</option></select>
          </label>
        </div>
        <div class="row three">
          <label>行距数值<input id="lineSpacingValue" type="number" min="0.5" max="100" step="0.1" value="1.5"><span class="field-note" id="lineSpacingUnit">倍</span>
          </label>
          <label>缩进方式<select id="indentMode"><option value="none">无特殊缩进</option><option value="first" selected>首行缩进</option><option value="hanging">悬挂缩进</option></select>
          </label>
          <label>特殊缩进（字符）<input id="indentValue" type="number" min="0" max="20" step="0.5" value="2">
          </label>
        </div>
        <div class="row two"><label>左侧缩进（字符）<input id="leftIndent" type="number" min="0" max="20" step="0.5" value="0"></label><label>右侧缩进（字符）<input id="rightIndent" type="number" min="0" max="20" step="0.5" value="0"></label></div>
        <div class="row two"><label>段前间距<div class="inline-fields"><input id="beforeValue" type="number" min="0" max="200" step="0.5" value="0"><select id="beforeMode"><option value="lines">行</option><option value="pt">磅（pt）</option></select></div></label><label>段后间距<div class="inline-fields"><input id="afterValue" type="number" min="0" max="200" step="0.5" value="0"><select id="afterMode"><option value="lines">行</option><option value="pt">磅（pt）</option></select></div></label></div>
        <div class="table-settings-group">
          <h3>分页控制</h3>
          <div class="checks">
            <label class="check"><input id="pageBreakBefore" type="checkbox"> 段前另起一页</label>
            <label class="check"><input id="keepWithNext" type="checkbox"> 与下一段保持同页</label>
            <label class="check"><input id="avoidWidowOrphan" type="checkbox"> 避免页首页尾孤行</label>
          </div>
        </div>
        <div class="preview" id="visualPreview">这是格式预览文字</div>
      </section>

      <section id="imageFields" hidden>
        <div class="table-settings-group">
          <h3>图片格式</h3>
          <div class="row two">
            <label>图片大小方式
              <select id="imageSizeMode">
                <option value="original">保持原图大小</option>
                <option value="percent" selected>按正文宽度百分比</option>
                <option value="pixels">自定义像素宽度</option>
              </select>
            </label>
            <label id="imagePercentSetting">缩放比例
              <select id="imageScalePercent">
                <option value="25">25%</option>
                <option value="33">33%</option>
                <option value="50">50%</option>
                <option value="66">66%</option>
                <option value="75">75%</option>
                <option value="80" selected>80%</option>
                <option value="90">90%</option>
                <option value="100">100%</option>
              </select>
            </label>
            <label id="imagePixelsSetting" hidden>自定义宽度（像素）
              <input id="imageCustomPixels" type="number" min="50" max="5000" step="10" value="800">
              <span class="field-note">按 96 DPI 换算，并保持原图比例</span>
            </label>
          </div>
          <div class="row two">
            <label>图片位置
              <select id="imageAlignment">
                <option value="left">左侧</option>
                <option value="center" selected>居中</option>
                <option value="right">右侧</option>
              </select>
            </label>
            <label>浮动位置
              <select id="imagePlacement">
                <option value="htbp">自动选择（推荐）</option>
                <option value="tbp">页顶、页底或浮动页</option>
                <option value="H">固定在当前位置</option>
              </select>
            </label>
          </div>
          <label class="check"><input id="imagePageBreakBefore" type="checkbox"> 插入图片前另起一页</label>
          <details class="advanced"><summary>高级图片调整</summary><div class="row two"><label class="check"><input id="imageLockAspect" type="checkbox" checked> 锁定长宽比例</label><label>旋转角度<select id="imageRotation"><option value="0">不旋转</option><option value="90">顺时针 90°</option><option value="-90">逆时针 90°</option><option value="180">旋转 180°</option></select></label></div><div class="row four"><label>裁剪左<input id="imageTrimLeft" type="number" min="0" value="0"></label><label>裁剪右<input id="imageTrimRight" type="number" min="0" value="0"></label><label>裁剪上<input id="imageTrimTop" type="number" min="0" value="0"></label><label>裁剪下<input id="imageTrimBottom" type="number" min="0" value="0"></label></div></details>
        </div>

        <div class="table-settings-group">
          <h3>图注格式</h3>
          <label class="check"><input id="imageHasCaption" type="checkbox" checked> 插入图注和图片标签</label>
          <div id="imageCaptionSettings">
            <label>图片编号方式
              <select id="imageNumberMode">
                <option value="automatic">自动编号（图 1、图 2、图 3……）</option>
                <option value="manual">每次插入时手动填写（如图 1-1）</option>
              </select>
            </label>
            <label class="check"><input id="imageCaptionCentered" type="checkbox" checked> 图片名称（图注）居中</label>
            <div class="row three">
              <label>图注位置
                <select id="imageCaptionPosition">
                  <option value="top">图片上方</option>
                  <option value="bottom" selected>图片下方</option>
                </select>
              </label>
              <label>字体
                <select id="captionFontFamily">
                  <option value="inherit">沿用论文设置</option>
                  <option value="songti">宋体</option>
                  <option value="heiti">黑体</option>
                  <option value="kaishu">楷体</option>
                  <option value="fangsong">仿宋</option>
                </select>
              </label>
              <label>字号
                <select id="captionFontSize">
                  <option value="5">八号（5 pt）</option><option value="5.5">七号（5.5 pt）</option><option value="6.5">小六（6.5 pt）</option><option value="7.5">六号（7.5 pt）</option><option value="9">小五（9 pt）</option><option value="10.5" selected>五号（10.5 pt）</option><option value="12">小四（12 pt）</option><option value="14">四号（14 pt）</option><option value="15">小三（15 pt）</option><option value="16">三号（16 pt）</option><option value="18">小二（18 pt）</option><option value="22">二号（22 pt）</option><option value="24">小一（24 pt）</option><option value="26">一号（26 pt）</option><option value="36">小初（36 pt）</option><option value="42">初号（42 pt）</option>
                </select>
              </label>
            </div>
            <div class="row two">
              <label>行距
                <select id="captionLineSpacing">
                  <option value="1">单倍</option>
                  <option value="1.15">1.15 倍</option>
                  <option value="1.2" selected>1.2 倍</option>
                  <option value="1.25">1.25 倍</option>
                  <option value="1.5">1.5 倍</option>
                  <option value="2">双倍</option>
                </select>
              </label>
              <div class="checks"><label class="check"><input id="captionBold" type="checkbox"> 粗体</label><label class="check"><input id="captionItalic" type="checkbox"> 斜体</label></div>
            </div>
          </div>
        </div>

        <div class="image-visual-preview" id="imageVisualPreview">
          <div class="image-placeholder">图片预览</div>
          <div class="caption-preview" id="captionPreview">图 1：图片说明文字</div>
        </div>
        <p class="hint">点击该样式时会打开图片选择窗口。插入后按 Tab 填写“图片说明文字”和“图片标签”。所需的 graphicx 和 float 宏包会自动添加。</p>
      </section>

      <section id="tableFields" hidden>
        <div class="table-settings-group">
          <h3>表格整体</h3>
          <label class="check"><input id="tableHasHeader" type="checkbox" checked> 第一行作为表头</label>
          <div class="row three">
            <label>表格位置
              <select id="tableAlignment">
                <option value="left">左侧</option>
                <option value="center" selected>居中</option>
                <option value="right">右侧</option>
              </select>
            </label>
            <label>边框样式
              <select id="borderStyle">
                <option value="threeLine">三线表</option>
                <option value="grid">全边框</option>
                <option value="none">无边框</option>
              </select>
            </label>
            <label>图注位置
              <select id="captionPosition">
                <option value="top">表格上方</option>
                <option value="bottom">表格下方</option>
              </select>
            </label>
          </div>
          <label>浮动位置
            <select id="tablePlacement">
              <option value="htbp">自动选择（推荐）</option>
              <option value="tbp">页顶、页底或浮动页</option>
              <option value="H">固定在当前位置</option>
            </select>
          </label>
          <div class="row two">
            <label>列宽方式
              <select id="columnWidthMode"><option value="auto">根据内容自动调整</option><option value="equal">平均分配到指定宽度</option></select>
            </label>
            <label>表格总宽度
              <select id="tableWidthPercent"><option value="60">正文宽度 60%</option><option value="70">正文宽度 70%</option><option value="80">正文宽度 80%</option><option value="90">正文宽度 90%</option><option value="100" selected>正文宽度 100%</option></select>
            </label>
          </div>
          <label class="check"><input id="tablePageBreakBefore" type="checkbox"> 插入表格前另起一页</label>
          <div class="checks"><label class="check"><input id="tableRepeatHeader" type="checkbox"> 跨页时重复表头</label><label class="check"><input id="tableAllowRowBreak" type="checkbox" checked> 允许在行与行之间自动换页</label></div>
          <label>单列宽度（百分比，逗号分隔）<input id="tableColumnWidths" placeholder="例如：20,40,40；留空自动分配"></label>
        </div>

        <div class="table-settings-group">
          <h3>表格名称（表格注释）格式</h3>
          <label class="check"><input id="tableCaptionCentered" type="checkbox" checked> 居中显示</label>
          <div class="row three">
            <label>字体
              <select id="tableCaptionFontFamily">
                <option value="inherit">沿用论文设置</option>
                <option value="songti">宋体</option>
                <option value="heiti">黑体</option>
                <option value="kaishu">楷体</option>
                <option value="fangsong">仿宋</option>
              </select>
            </label>
            <label>字号
              <select id="tableCaptionFontSize">
                <option value="5">八号（5 pt）</option><option value="5.5">七号（5.5 pt）</option><option value="6.5">小六（6.5 pt）</option><option value="7.5">六号（7.5 pt）</option><option value="9">小五（9 pt）</option><option value="10.5" selected>五号（10.5 pt）</option><option value="12">小四（12 pt）</option><option value="14">四号（14 pt）</option><option value="15">小三（15 pt）</option><option value="16">三号（16 pt）</option><option value="18">小二（18 pt）</option><option value="22">二号（22 pt）</option><option value="24">小一（24 pt）</option><option value="26">一号（26 pt）</option><option value="36">小初（36 pt）</option><option value="42">初号（42 pt）</option>
              </select>
            </label>
            <label>行距
              <select id="tableCaptionLineSpacing">
                <option value="1">单倍</option>
                <option value="1.15">1.15 倍</option>
                <option value="1.2" selected>1.2 倍</option>
                <option value="1.25">1.25 倍</option>
                <option value="1.5">1.5 倍</option>
                <option value="2">双倍</option>
              </select>
            </label>
          </div>
          <div class="checks"><label class="check"><input id="tableCaptionBold" type="checkbox"> 粗体</label><label class="check"><input id="tableCaptionItalic" type="checkbox"> 斜体</label></div>
        </div>

        <div class="table-settings-group">
          <h3>表格内容格式</h3>
          <div class="row three">
            <label>字体
              <select id="bodyFontFamily">
                <option value="inherit">沿用论文设置</option>
                <option value="songti">宋体</option>
                <option value="heiti">黑体</option>
                <option value="kaishu">楷体</option>
                <option value="fangsong">仿宋</option>
              </select>
            </label>
            <label>字号
              <select id="bodyFontSize"><option value="5">八号（5 pt）</option><option value="5.5">七号（5.5 pt）</option><option value="6.5">小六（6.5 pt）</option><option value="7.5">六号（7.5 pt）</option><option value="9">小五（9 pt）</option><option value="10.5" selected>五号（10.5 pt）</option><option value="12">小四（12 pt）</option><option value="14">四号（14 pt）</option><option value="15">小三（15 pt）</option><option value="16">三号（16 pt）</option><option value="18">小二（18 pt）</option><option value="22">二号（22 pt）</option><option value="24">小一（24 pt）</option><option value="26">一号（26 pt）</option><option value="36">小初（36 pt）</option><option value="42">初号（42 pt）</option></select>
            </label>
            <label>行距
              <select id="bodyLineSpacing"><option value="1">单倍</option><option value="1.15">1.15 倍</option><option value="1.2" selected>1.2 倍</option><option value="1.25">1.25 倍</option><option value="1.5">1.5 倍</option><option value="2">双倍</option></select>
            </label>
          </div>
          <div class="row two">
            <label>文字对齐
              <select id="bodyAlignment">
                <option value="left">左对齐</option>
                <option value="center" selected>居中</option>
                <option value="right">右对齐</option>
              </select>
            </label>
          <div class="checks"><label class="check"><input id="bodyBold" type="checkbox"> 粗体</label><label class="check"><input id="bodyItalic" type="checkbox"> 斜体</label></div>
          <label>单元格垂直对齐<select id="tableVerticalAlignment"><option value="top">顶部</option><option value="middle" selected>居中</option><option value="bottom">底部</option></select></label>
          </div>
        </div>

        <div class="table-settings-group" id="headerSettings">
          <h3>表头格式</h3>
          <div class="row three">
            <label>字体
              <select id="headerFontFamily">
                <option value="inherit">沿用论文设置</option>
                <option value="songti">宋体</option>
                <option value="heiti" selected>黑体</option>
                <option value="kaishu">楷体</option>
                <option value="fangsong">仿宋</option>
              </select>
            </label>
            <label>字号
              <select id="headerFontSize"><option value="5">八号（5 pt）</option><option value="5.5">七号（5.5 pt）</option><option value="6.5">小六（6.5 pt）</option><option value="7.5">六号（7.5 pt）</option><option value="9">小五（9 pt）</option><option value="10.5" selected>五号（10.5 pt）</option><option value="12">小四（12 pt）</option><option value="14">四号（14 pt）</option><option value="15">小三（15 pt）</option><option value="16">三号（16 pt）</option><option value="18">小二（18 pt）</option><option value="22">二号（22 pt）</option><option value="24">小一（24 pt）</option><option value="26">一号（26 pt）</option><option value="36">小初（36 pt）</option><option value="42">初号（42 pt）</option></select>
            </label>
            <label>行距
              <select id="headerLineSpacing"><option value="1">单倍</option><option value="1.15">1.15 倍</option><option value="1.2" selected>1.2 倍</option><option value="1.25">1.25 倍</option><option value="1.5">1.5 倍</option><option value="2">双倍</option></select>
            </label>
          </div>
          <div class="row two">
            <label>文字对齐
              <select id="headerAlignment">
                <option value="left">左对齐</option>
                <option value="center" selected>居中</option>
                <option value="right">右对齐</option>
              </select>
            </label>
            <div class="checks"><label class="check"><input id="headerBold" type="checkbox" checked> 粗体</label><label class="check"><input id="headerItalic" type="checkbox"> 斜体</label></div>
          </div>
        </div>

        <div class="table-visual-preview" id="tableVisualPreview">
          <div class="caption-preview" id="tableCaptionPreview">表 1：表格标题</div>
          <table><thead><tr><th>表头一</th><th>表头二</th><th>表头三</th></tr></thead><tbody><tr><td>内容</td><td>内容</td><td>内容</td></tr><tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table>
        </div>
        <p class="hint">选择宋体、黑体、楷体或仿宋时，论文需要使用 ctex；三线表需要 booktabs；固定位置需要 float 宏包。</p>
      </section>

      <section id="customFields" hidden>
        <label>LaTeX 模板
          <textarea id="template" rows="11" spellcheck="false" placeholder="输入要插入的 LaTeX 代码"></textarea>
        </label>
        <p class="hint"><code>\${TM_SELECTED_TEXT:内容}</code> 会使用选中的文字；<code>\${1:提示}</code>、<code>\${2:提示}</code> 是按 Tab 跳转的填写位置。</p>
      </section>

      <div class="dialog-actions">
        <button type="button" id="cancelButton">取消</button>
        <button type="submit" class="primary">保存格式</button>
      </div>
    </form>
  </dialog>

  <dialog id="tocDialog">
    <form id="tocForm" method="dialog">
      <div class="dialog-title">
        <strong>目录设置</strong>
        <button type="button" class="icon-button" id="closeTocButton" aria-label="关闭">×</button>
      </div>
      <label>目录标题<input id="tocTitle" maxlength="80" value="目录"></label>
      <div class="row three">
        <label>显示层级<select id="tocDepth"><option value="1">只显示一级标题</option><option value="2">显示到二级标题</option><option value="3" selected>显示到三级标题</option></select></label>
        <label>标题字体<select id="tocFontFamily"><option value="inherit">沿用论文</option><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label>
        <label>标题字号<select id="tocFontSize"><option value="10.5">五号</option><option value="12">小四</option><option value="14">四号</option><option value="16" selected>三号</option><option value="18">小二</option><option value="22">二号</option></select></label>
      </div>
      <div class="row two">
        <label>标题对齐<select id="tocAlignment"><option value="left">左对齐</option><option value="center" selected>居中</option><option value="right">右对齐</option></select></label>
        <label>标题与页码之间<select id="tocLeaderStyle"><option value="dots">点线连接</option><option value="blank">留白</option></select></label>
      </div>
      <div class="checks wrap-checks">
        <label class="check"><input id="tocTitleBold" type="checkbox" checked> 标题加粗</label>
        <label class="check"><input id="tocShowPageNumbers" type="checkbox" checked> 显示页码</label>
        <label class="check"><input id="tocPageBreakBefore" type="checkbox" checked> 目录前换页</label>
        <label class="check"><input id="tocPageBreakAfter" type="checkbox" checked> 目录后换页</label>
      </div>
      <details class="advanced"><summary>各级目录文字格式</summary><div class="row three">
        <label>一级字号<input id="tocLevel1Size" type="number" min="5" max="42" step="0.5" value="12"></label><label>一级缩进<input id="tocLevel1Indent" type="number" min="0" step="0.5" value="0"></label><label>一级行距<input id="tocLevel1Spacing" type="number" min="0.8" step="0.1" value="1.2"></label>
        <label>二级字号<input id="tocLevel2Size" type="number" min="5" max="42" step="0.5" value="10.5"></label><label>二级缩进<input id="tocLevel2Indent" type="number" min="0" step="0.5" value="1"></label><label>二级行距<input id="tocLevel2Spacing" type="number" min="0.8" step="0.1" value="1.2"></label>
        <label>三级字号<input id="tocLevel3Size" type="number" min="5" max="42" step="0.5" value="10.5"></label><label>三级缩进<input id="tocLevel3Indent" type="number" min="0" step="0.5" value="2"></label><label>三级行距<input id="tocLevel3Spacing" type="number" min="0.8" step="0.1" value="1.2"></label>
      </div></details>
      <div class="toc-preview" id="tocPreview">
        <strong id="tocPreviewTitle">目录</strong>
        <div><span>1　引言</span><span class="toc-dots"></span><span>1</span></div>
        <div><span>1.1　研究背景</span><span class="toc-dots"></span><span>2</span></div>
        <div><span>1.1.1　研究问题</span><span class="toc-dots"></span><span>3</span></div>
      </div>
      <p class="hint">“插入”与“更新”是同一个按钮：已有目录时会更新原目录，不会重复添加。</p>
      <div class="dialog-actions split-actions">
        <button type="button" class="danger-button" id="deleteTocButton">删除目录</button>
        <span></span>
        <button type="button" id="cancelTocButton">取消</button>
        <button type="submit" id="saveTocButton">插入/更新</button>
        <button type="submit" class="primary" id="refreshTocButton">更新并预览</button>
      </div>
    </form>
  </dialog>

  <dialog id="pageDialog">
    <form id="pageForm" method="dialog">
      <div class="dialog-title">
        <strong>页面设置</strong>
        <button type="button" class="icon-button" id="closePageButton" aria-label="关闭">×</button>
      </div>
      <label>常用方案<select id="pagePreset"><option value="custom">自定义</option><option value="normal">普通论文：页脚居中页码</option><option value="thesis">学位论文：首页隐藏，正文页脚居中</option><option value="book">书籍排版：章节页眉，页码在外侧</option></select></label>

      <div class="table-settings-group"><h3>纸张与页边距</h3><div class="row three"><label>纸张<select id="pagePaper"><option value="a4paper">A4</option><option value="letterpaper">Letter</option></select></label><label>方向<select id="pageOrientation"><option value="portrait">纵向</option><option value="landscape">横向</option></select></label><label>分栏<select id="pageColumns"><option value="1">单栏</option><option value="2">两栏</option><option value="3">三栏</option></select></label></div><div class="row four"><label>上边距<input id="pageMarginTop" type="number" value="25"></label><label>下边距<input id="pageMarginBottom" type="number" value="25"></label><label>左边距<input id="pageMarginLeft" type="number" value="25"></label><label>右边距<input id="pageMarginRight" type="number" value="25"></label></div><div class="row two"><label>装订线（mm）<input id="pageBindingOffset" type="number" min="0" value="0"></label><label class="check"><input id="pageMirroredMargins" type="checkbox"> 双面打印镜像页边距</label></div></div>

      <div class="table-settings-group">
        <h3>页眉</h3>
        <label class="check"><input id="pageHeaderEnabled" type="checkbox" checked> 启用页眉</label>
        <div class="row two">
          <label>页眉内容<select id="pageHeaderMode"><option value="fixed">固定文字</option><option value="chapter">当前章节名称</option><option value="section">当前小节名称</option><option value="title">论文标题</option></select></label>
          <label>固定文字<input id="pageHeaderText" maxlength="160" placeholder="例如：某某大学硕士学位论文"></label>
        </div>
        <div class="row three">
          <label>字体<select id="pageHeaderFont"><option value="inherit">沿用论文</option><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label>
          <label>字号<select id="pageHeaderSize"><option value="9">小五</option><option value="10.5" selected>五号</option><option value="12">小四</option></select></label>
          <label>对齐<select id="pageHeaderAlignment"><option value="left">左对齐</option><option value="center" selected>居中</option><option value="right">右对齐</option></select></label>
        </div>
        <div class="row three">
          <label>与正文距离<select id="pageHeaderDistance"><option value="4">4 mm</option><option value="6">6 mm</option><option value="8" selected>8 mm</option><option value="10">10 mm</option><option value="12">12 mm</option></select></label>
          <label>与纸张上边距离<input id="pageHeaderEdgeDistance" type="number" min="0" value="15"></label>
          <div class="checks"><label class="check"><input id="pageHeaderBold" type="checkbox"> 加粗</label><label class="check"><input id="pageHeaderItalic" type="checkbox"> 斜体</label><label class="check"><input id="pageHeaderLine" type="checkbox" checked> 横线</label></div>
        </div>
      </div>

      <div class="table-settings-group">
        <h3>页脚</h3>
        <label class="check"><input id="pageFooterEnabled" type="checkbox"> 启用页脚文字</label>
        <div class="row two">
          <label>页脚内容<select id="pageFooterMode"><option value="fixed">固定文字</option><option value="chapter">当前章节名称</option><option value="section">当前小节名称</option><option value="title">论文标题</option></select></label>
          <label>固定文字<input id="pageFooterText" maxlength="160" placeholder="例如：学校名称"></label>
        </div>
        <div class="row three">
          <label>字体<select id="pageFooterFont"><option value="inherit">沿用论文</option><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label>
          <label>字号<select id="pageFooterSize"><option value="9">小五</option><option value="10.5" selected>五号</option><option value="12">小四</option></select></label>
          <label>对齐<select id="pageFooterAlignment"><option value="left">左对齐</option><option value="center" selected>居中</option><option value="right">右对齐</option></select></label>
        </div>
        <div class="row three">
          <label>与正文距离<select id="pageFooterDistance"><option value="6">6 mm</option><option value="8">8 mm</option><option value="10" selected>10 mm</option><option value="12">12 mm</option><option value="15">15 mm</option></select></label>
          <label>与纸张下边距离<input id="pageFooterEdgeDistance" type="number" min="0" value="15"></label>
          <div class="checks"><label class="check"><input id="pageFooterBold" type="checkbox"> 加粗</label><label class="check"><input id="pageFooterItalic" type="checkbox"> 斜体</label><label class="check"><input id="pageFooterLine" type="checkbox"> 横线</label></div>
        </div>
      </div>

      <div class="table-settings-group">
        <h3>页码</h3>
        <label class="check"><input id="pageNumberEnabled" type="checkbox" checked> 显示页码</label>
        <div class="row three">
          <label>位于<select id="pageNumberArea"><option value="footer">页脚</option><option value="header">页眉</option></select></label>
          <label>位置<select id="pageNumberPosition"><option value="left">左侧</option><option value="center" selected>居中</option><option value="right">右侧</option><option value="outer">双面打印：外侧</option></select></label>
          <label>编号格式<select id="pageNumberFormat"><option value="arabic">1、2、3</option><option value="roman">i、ii、iii</option><option value="Roman">I、II、III</option></select></label>
        </div>
        <div class="row two">
          <label>起始页码<select id="pageStartNumber"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="10">10</option></select></label>
          <label>从哪里开始<select id="pageStartAt"><option value="document">从文档第一页</option><option value="current">从正文/当前光标处</option></select></label>
        </div>
      </div>

      <div class="table-settings-group">
        <h3>首页</h3>
        <label>首页规则<select id="pageFirstMode"><option value="same">与其他页相同</option><option value="hidden" selected>隐藏首页页眉页脚和页码</option><option value="separate">使用单独内容</option></select></label>
        <div id="firstPageFields" hidden>
          <div class="row two"><label>首页页眉<input id="pageFirstHeaderText" maxlength="160"></label><label>首页页脚<input id="pageFirstFooterText" maxlength="160"></label></div>
          <div class="row two"><label>首页页眉位置<select id="pageFirstHeaderAlignment"><option value="left">左</option><option value="center" selected>中</option><option value="right">右</option></select></label><label>首页页脚位置<select id="pageFirstFooterAlignment"><option value="left">左</option><option value="center" selected>中</option><option value="right">右</option></select></label></div>
          <label class="check"><input id="pageFirstShowNumber" type="checkbox"> 首页显示页码</label>
        </div>
      </div>

      <div class="table-settings-group"><h3>奇偶页</h3><label class="check"><input id="pageDifferentOddEven" type="checkbox"> 奇数页和偶数页使用不同内容</label><div class="row two"><label>奇数页页眉<input id="pageOddHeaderText"></label><label>偶数页页眉<input id="pageEvenHeaderText"></label><label>奇数页页脚<input id="pageOddFooterText"></label><label>偶数页页脚<input id="pageEvenFooterText"></label></div></div>

      <div class="page-sheet-preview" id="pagePreview">
        <div class="page-preview-header" id="pagePreviewHeader">页眉预览</div>
        <div class="page-preview-body"><span></span><span></span><span></span><span></span></div>
        <div class="page-preview-footer"><span id="pagePreviewFooter"></span><span id="pagePreviewNumber">1</span></div>
      </div>
      <p class="hint">选择“从正文/当前光标处”时，请先把光标放在正文开始处再点“应用设置”。关闭某项只会停止显示，不会清空已填内容。</p>
      <div class="dialog-actions split-actions">
        <button type="button" class="danger-button" id="deletePageButton">删除文档页面设置</button>
        <button type="button" id="resetPageButton">恢复默认</button>
        <span></span>
        <button type="button" id="cancelPageButton">取消</button>
        <button type="submit" class="primary">应用设置</button>
      </div>
    </form>
  </dialog>

  <dialog id="schemeDialog">
    <form id="schemeForm" method="dialog">
      <div class="dialog-title">
        <strong>整篇论文格式方案</strong>
        <button type="button" class="icon-button" id="closeSchemeButton" aria-label="关闭">×</button>
      </div>
      <label>方案名称<input id="schemeName" maxlength="40" placeholder="例如：学校硕士论文"></label>
      <div class="table-settings-group">
        <h3>正文</h3>
        <div class="row three">
          <label>字体<select id="schemeBodyFont"><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option><option value="inherit">沿用论文</option></select></label>
          <label>字号<select id="schemeBodySize"><option value="10.5">五号</option><option value="12" selected>小四</option><option value="14">四号</option></select></label>
          <label>行距<select id="schemeBodySpacing"><option value="1">单倍</option><option value="1.25">1.25 倍</option><option value="1.5" selected>1.5 倍</option><option value="2">双倍</option></select></label>
        </div>
        <label class="check"><input id="schemeAvoidWidow" type="checkbox" checked> 避免页首页尾出现单独一行</label>
      </div>
      <div class="table-settings-group">
        <h3>标题</h3>
        <div class="row three">
          <label>字体<select id="schemeHeadingFont"><option value="heiti">黑体</option><option value="songti">宋体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label>
          <label>一级标题<select id="schemeHeading1Size"><option value="14">四号</option><option value="16" selected>三号</option><option value="18">小二</option><option value="22">二号</option></select></label>
          <label>二级标题<select id="schemeHeading2Size"><option value="12">小四</option><option value="14" selected>四号</option><option value="16">三号</option></select></label>
        </div>
        <label class="check"><input id="schemeHeading1PageBreak" type="checkbox"> 一级标题前另起一页</label>
      </div>
      <div class="table-settings-group">
        <h3>图表</h3>
        <div class="row three">
          <label>图表名称字体<select id="schemeCaptionFont"><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label>
          <label>图表名称字号<select id="schemeCaptionSize"><option value="9">小五</option><option value="10.5" selected>五号</option><option value="12">小四</option></select></label>
          <label>表格内容字号<select id="schemeTableSize"><option value="9">小五</option><option value="10.5" selected>五号</option><option value="12">小四</option></select></label>
        </div>
      </div>
      <p class="hint">保存后会生成协调一致的正文、一级标题、二级标题、图片和表格样式。以后修改方案时，这五个样式会同步更新。</p>
      <div class="dialog-actions"><button type="button" id="cancelSchemeButton">取消</button><button type="submit" class="primary">生成论文方案</button></div>
    </form>
  </dialog>

  <dialog id="outlineDialog">
    <div class="dialog-title">
      <strong>论文导航与交叉引用</strong>
      <button type="button" class="icon-button" id="closeOutlineButton" aria-label="关闭">×</button>
    </div>
    <div class="outline-toolbar"><button type="button" id="refreshOutlineButton">刷新列表</button></div>
    <div id="outlineList" class="outline-list"></div>
    <p class="hint">点击名称可跳转到源码位置；图片和表格可点击“插入引用”，软件会自动生成引用代码。</p>
  </dialog>

  <dialog id="tableSizeDialog">
    <form id="tableSizeForm" method="dialog">
      <div class="dialog-title">
        <strong id="tableSizeTitle">选择表格大小</strong>
        <button type="button" class="icon-button" id="closeTableSizeButton" aria-label="关闭">×</button>
      </div>
      <div class="table-size-summary" id="tableSizeSummary">3 列 × 3 行</div>
      <div class="table-grid" id="tableGrid" aria-label="选择表格行列数"></div>
      <p class="hint" id="tableRowHint">行数包含第一行表头。</p>
      <div class="row two">
        <label>行数<input id="tableRows" type="number" min="1" max="30" value="3"></label>
        <label>列数<input id="tableColumns" type="number" min="1" max="12" value="3"></label>
      </div>
      <div class="row two">
        <label>表格名称（表格注释）<input id="tableInsertTitle" maxlength="300" placeholder="例如：实验结果对比" required></label>
        <label>内部引用名称<input id="tableInsertLabel" maxlength="80" placeholder="自动生成，可直接使用"></label>
      </div>
      <h3>表格内容</h3>
      <div class="table-content-editor"><table id="tableContentGrid"></table></div>
      <div class="table-edit-toolbar"><button type="button" id="addTableRow">＋ 行</button><button type="button" id="removeTableRow">－ 行</button><button type="button" id="addTableColumn">＋ 列</button><button type="button" id="removeTableColumn">－ 列</button><button type="button" id="mergeTableCells">合并选中单元格</button><button type="button" id="splitTableCells">拆分单元格</button></div>
      <p class="hint">直接在格子中填写内容。按住 Ctrl 点击多个同一行的格子，再点“合并选中单元格”；选中合并后的格子可拆分。</p>
      <div class="dialog-actions">
        <button type="button" id="cancelTableSizeButton">取消</button>
        <button type="submit" class="primary" id="confirmTableButton">插入表格</button>
      </div>
    </form>
  </dialog>

  <dialog id="imageInsertDialog">
    <form id="imageInsertForm" method="dialog">
      <div class="dialog-title">
        <strong id="imageInsertTitle">选择图片</strong>
        <button type="button" class="icon-button" id="closeImageInsertButton" aria-label="关闭">×</button>
      </div>
      <div class="image-drop-zone" id="imageDropZone" tabindex="0">
        <div class="drop-icon">⇩</div>
        <strong>按住 Shift，把图片拖到这里</strong>
        <span>支持 PNG、JPG、JPEG 和 PDF</span>
        <span class="drop-or">或者</span>
        <button type="button" id="browseImageButton">打开文件资源管理器</button>
      </div>
      <div class="selected-image" id="selectedImage" hidden>
        <img id="selectedImagePreview" alt="所选图片预览" hidden>
        <span>已选择：</span><strong id="selectedImageName"></strong>
      </div>
      <div class="table-settings-group" id="imageInsertNumberSetting" hidden>
        <label>图片编号
          <input id="customFigureNumber" type="text" maxlength="40" placeholder="例如：1-1">
          <span class="field-note">只填写编号部分，最终显示为“图 1-1”。</span>
        </label>
      </div>
      <div class="table-settings-group" id="imageInsertCaptionFields">
        <h3>图片说明</h3>
        <label>图片说明文字
          <input id="imageCaptionText" type="text" maxlength="300" placeholder="例如：系统总体结构">
        </label>
        <label>内部引用名称
          <input id="imageLabel" type="text" maxlength="80" placeholder="自动生成，可直接使用">
          <span class="field-note">用于在正文中引用这张图片，软件会自动生成，也可以修改。</span>
        </label>
      </div>
      <p class="hint">VS Code 为避免误操作，拖入侧边栏时需要按住 Shift。也可以直接点击按钮选择图片。</p>
      <div class="dialog-actions">
        <button type="button" id="cancelImageInsertButton">取消</button>
        <button type="submit" class="primary" id="confirmImageInsertButton" disabled>插入图片</button>
      </div>
    </form>
  </dialog>

  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function getDocumentToolHtml(webview, extensionUri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'document.js'));
  const csp = ["default-src 'none'", `style-src ${webview.cspSource} 'unsafe-inline'`, `script-src ${webview.cspSource}`].join('; ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 14px/1.5 var(--vscode-font-family); }
    button, input, select, textarea { font: inherit; color: inherit; }
    button { padding: 7px 13px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground); }
    button.link { color: var(--vscode-textLink-foreground); background: transparent; border-color: transparent; }
    header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 15px 22px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); }
    h1 { margin: 0; font-size: 20px; } h2 { margin: 0 0 14px; font-size: 18px; } h3 { margin: 0 0 8px; font-size: 14px; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { color: var(--vscode-foreground); background: transparent; border-color: transparent; }
    .tabs button.active { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    main { max-width: 1120px; margin: auto; padding: 22px; }
    .tab-panel[hidden] { display: none; }
    .hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px; margin-bottom: 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background); }
    .hero p { margin: 5px 0 0; color: var(--vscode-descriptionForeground); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr); gap: 16px; align-items: start; }
    .card { padding: 18px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background); }
    .group { padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--vscode-panel-border); }
    .row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .row.three { grid-template-columns: repeat(3, minmax(0, 1fr)); } .row.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    label { display: grid; gap: 5px; margin-bottom: 10px; }
    label.check { display: flex; align-items: center; gap: 7px; } label.check input, .issue input[type="checkbox"] { width: auto; }
    input, select, textarea { width: 100%; padding: 7px 8px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); }
    textarea { min-height: 86px; resize: vertical; }
    .paper { min-height: 480px; padding: 42px 38px; color: #222; background: #fff; box-shadow: 0 2px 12px #0004; }
    .paper-title { margin-top: 36px; text-align: center; font: 700 24px/1.4 serif; }
    .paper-subtitle, .paper-meta { margin-top: 14px; text-align: center; color: #444; }
    .paper-abstract { margin-top: 58px; font: 14px/1.8 serif; text-align: justify; }
    .paper-keywords { margin-top: 12px; font: 13px/1.6 serif; }
    .muted { color: var(--vscode-descriptionForeground); }
    .checkbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .summary { padding: 12px 14px; margin-bottom: 12px; border-left: 4px solid var(--vscode-button-background); background: var(--vscode-textBlockQuote-background); }
    .issue { display: grid; grid-template-columns: auto 1fr auto; gap: 11px; align-items: start; padding: 12px; margin: 8px 0; border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
    .issue.error { border-left: 4px solid var(--vscode-errorForeground); } .issue.warning { border-left: 4px solid var(--vscode-editorWarning-foreground); }
    .issue strong { display: block; } .issue p { margin: 3px 0 0; color: var(--vscode-descriptionForeground); }
    .badge { display: inline-block; padding: 1px 6px; margin-left: 6px; border-radius: 9px; font-size: 11px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    pre { max-height: 350px; overflow: auto; white-space: pre-wrap; padding: 12px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-textCodeBlock-background); }
    dialog { width: min(1000px, calc(100vw - 32px)); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editor-background); }
    dialog::backdrop { background: #0008; }
    .dialog-head { display: flex; justify-content: space-between; align-items: center; }
    .log-list li { margin: 8px 0; }
    @media (max-width: 760px) { .layout, .preview-grid { grid-template-columns: 1fr; } .row, .row.three, .row.four { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <header>
    <div><h1>LaTeX 文档工具</h1><div class="muted" id="currentFile">尚未选择文档</div></div>
    <nav class="tabs"><button class="active" data-tab="create">新建文档</button><button data-tab="check">检查与修复</button></nav>
  </header>
  <main>
    <section class="tab-panel" id="createPanel">
      <div class="hero"><div><strong>像新建 Word 文档一样开始</strong><p>使用保存好的默认方案，或在下方调整标题页、摘要、目录和页面设置。</p></div><div class="actions"><button id="quickCreate">一键新建默认文档</button><button class="secondary" id="saveDefault">保存为我的默认方案</button></div></div>
      <div class="layout">
        <form class="card" id="documentForm">
          <h2>文档内容与格式</h2>
          <div class="row four">
            <label>方案名称<input id="templateName" placeholder="例如：毕业论文"></label>
            <label>文档类型<select id="documentClass"><option value="ctexart">中文短论文</option><option value="ctexrep">中文长报告</option><option value="ctexbook">中文书籍</option><option value="article">英文短论文</option><option value="report">英文长报告</option><option value="book">英文书籍</option></select></label>
            <label>基础字号<select id="baseFontSize"><option value="10pt">10 pt</option><option value="11pt">11 pt</option><option value="12pt">12 pt</option></select></label>
            <label>纸张大小<select id="paperSize"><option value="a4paper">A4（论文常用）</option><option value="letterpaper">Letter</option></select></label>
          </div>
          <div class="group"><h3>标题页</h3>
            <label class="check"><input id="titleEnabled" type="checkbox"> 使用论文标题</label>
            <div class="row"><label>论文标题<input id="documentTitle" placeholder="请输入论文标题"></label><label>副标题<input id="subtitle" placeholder="可留空"></label></div>
            <label class="check"><input id="authorEnabled" type="checkbox"> 显示作者</label>
            <div class="row"><label>作者<input id="author" placeholder="请输入作者姓名"></label><label>单位/学校<input id="institution" placeholder="可留空"></label><label>专业<input id="major" placeholder="可留空"></label><label>指导教师<input id="advisor" placeholder="可留空"></label></div>
            <div class="row"><label>日期方式<select id="dateMode"><option value="automatic">自动使用当天日期</option><option value="manual">手动填写日期</option><option value="hidden">不显示日期</option></select></label><label id="manualDateWrap">日期<input id="manualDate" placeholder="例如：2026 年 9 月"></label></div>
            <label class="check"><input id="includeTitlePage" type="checkbox"> 新建后生成标题页</label>
          </div>
          <div class="group"><h3>摘要与正文</h3>
            <label class="check"><input id="includeAbstract" type="checkbox"> 生成摘要区域</label>
            <label>摘要默认提示<textarea id="abstractText"></textarea></label>
            <label>关键词<input id="keywords" placeholder="关键词一；关键词二"></label>
          </div>
          <div class="group"><h3>附加内容</h3>
            <label class="check"><input id="includeToc" type="checkbox"> 自动加入目录</label>
            <label class="check"><input id="includePageSettings" type="checkbox"> 使用侧边栏已经保存的页面设置</label>
            <label class="check"><input id="includeCommonPackages" type="checkbox"> 加入常用图片、表格和公式支持（推荐）</label>
          </div>
          <div class="actions"><button type="submit">新建自定义文档</button><button type="button" class="secondary" id="exportTemplate">导出为可分享 .tex 模板</button></div>
        </form>
        <aside class="card"><h2>标题页预览</h2><div class="paper"><div class="paper-title" id="previewTitle"></div><div class="paper-subtitle" id="previewSubtitle"></div><div class="paper-meta" id="previewMeta"></div><div class="paper-abstract" id="previewAbstract"></div><div class="paper-keywords" id="previewKeywords"></div></div></aside>
      </div>
    </section>
    <section class="tab-panel" id="checkPanel" hidden>
      <div class="hero"><div><strong>检查当前 LaTeX 文档</strong><p>只检查当前文件。不会检测 MiKTeX，也不会在未确认时修改内容。</p></div><div class="actions"><button id="checkNow">检查当前文档</button><button class="secondary" id="explainLog">解释最近编译错误</button></div></div>
      <div class="checkbar"><label class="check"><input id="checkOnSave" type="checkbox"> 每次保存时自动检查</label><button id="previewSafe">预览全部安全修复</button><button class="secondary" id="previewSelected">预览勾选的修复</button></div>
      <div class="summary" id="checkSummary">点击“检查当前文档”开始。</div>
      <div id="issueList"></div>
      <div class="card" id="logCard" hidden><h2>编译错误说明</h2><ul class="log-list" id="logList"></ul></div>
    </section>
  </main>
  <dialog id="repairDialog"><div class="dialog-head"><h2>修复前后预览</h2><button class="link" id="closeRepair">关闭</button></div><p id="repairCount"></p><div class="preview-grid"><div><h3>修改前</h3><pre id="beforeRepair"></pre></div><div><h3>修改后</h3><pre id="afterRepair"></pre></div></div><div class="actions"><button id="applyRepair">确认应用修复</button><button class="secondary" id="cancelRepair">取消</button></div><p class="muted">所有修改会作为一步写入，应用后可按一次 Ctrl+Z 撤销。</p></dialog>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function getFormulaHtml(webview, extensionUri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'formula.js'));
  const katexScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'katex', 'katex.min.js'));
  const katexStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'katex', 'katex.min.css'));
  const csp = [
    "default-src 'none'", `style-src ${webview.cspSource} 'unsafe-inline'`, `font-src ${webview.cspSource}`, `script-src ${webview.cspSource}`
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${katexStyleUri}">
<style>
:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;color:var(--vscode-foreground);background:var(--vscode-editor-background);font:13px/1.5 var(--vscode-font-family)}button,input,select,textarea{font:inherit}button{padding:7px 10px;color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground);border:1px solid transparent;border-radius:5px;cursor:pointer}button:hover{background:var(--vscode-button-secondaryHoverBackground)}button.primary{color:var(--vscode-button-foreground);background:var(--vscode-button-background)}input,select,textarea{width:100%;padding:7px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);border-radius:4px}textarea{resize:vertical;font-family:var(--vscode-editor-font-family)}label{display:grid;gap:4px;color:var(--vscode-descriptionForeground);font-size:12px}.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--vscode-sideBar-background);border-bottom:1px solid var(--vscode-panel-border)}.target{flex:1;min-width:0}.target strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.target small{color:var(--vscode-descriptionForeground)}.tabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border)}.tabs button.active{color:var(--vscode-button-foreground);background:var(--vscode-button-background)}.pane{display:none;padding:12px}.pane.active{display:block}.layout{display:grid;grid-template-columns:minmax(240px,360px) minmax(340px,1fr);gap:14px}.card{padding:12px;border:1px solid var(--vscode-panel-border);border-radius:7px;background:var(--vscode-sideBar-background)}h2,h3{margin:0 0 10px}h3{font-size:13px}.templates,.symbols{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:5px}.templates button{min-height:44px}.symbols button{padding:5px;font-family:serif;font-size:16px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.preview{display:grid;place-items:center;min-height:170px;padding:22px;background:#fff;color:#111;border:1px dashed var(--vscode-panel-border);overflow:auto;font-family:'Cambria Math','Times New Roman',serif;font-size:25px}.preview .katex{font-size:1em}.preview-numbered{display:grid;grid-template-columns:1fr auto 1fr;width:100%;align-items:center}.preview-numbered .preview-math{grid-column:2;justify-self:center}.preview-numbered .number{grid-column:3;justify-self:end}.preview-numbered.number-left .number{grid-column:1;grid-row:1;justify-self:start}.hint,.status{color:var(--vscode-descriptionForeground);font-size:11px}.actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;margin-top:12px;position:sticky;bottom:0;padding:8px;background:var(--vscode-sideBar-background)}.check{display:flex;align-items:center;gap:7px}.check input{width:auto}.list{display:grid;gap:7px}.item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--vscode-panel-border);border-radius:6px}.item-main{min-width:0;cursor:pointer}.item-main strong{display:block}.item-main small{color:var(--vscode-descriptionForeground)}.item-actions{display:flex;gap:4px}.empty{padding:35px;text-align:center;color:var(--vscode-descriptionForeground)}.toast{position:fixed;right:16px;bottom:16px;padding:9px 12px;color:var(--vscode-notifications-foreground);background:var(--vscode-notifications-background);border:1px solid var(--vscode-notifications-border);border-radius:5px}.advanced{margin-top:8px}.danger{color:var(--vscode-errorForeground)}.composer-toolbar{display:flex;align-items:center;gap:6px;margin-top:10px}.composer-toolbar span{color:var(--vscode-descriptionForeground);font-size:11px}.visual-editor{min-height:130px;margin-top:8px;padding:18px;background:#fff;color:#111;border:1px solid var(--vscode-panel-border);border-radius:6px;font:italic 23px 'Cambria Math','Times New Roman',serif;overflow:auto}.math-slot{display:inline-block;min-width:28px;min-height:28px;padding:1px 4px;border:1px dashed #77a9d9;border-radius:3px;background:#eef7ff;outline:none;text-align:center}.math-slot:empty:before{content:attr(data-placeholder);color:#789;font:11px sans-serif}.math-slot.active{border:2px solid #1686d9;background:#dff2ff}.math-row{display:inline-flex;align-items:center}.math-gap{width:.18em}.math-frac{display:inline-grid;grid-template-rows:auto auto;align-items:center;text-align:center;vertical-align:middle;margin:0 .15em}.math-frac>span:first-child{border-bottom:1px solid;padding:0 .2em}.math-root>span{border-top:1px solid;padding:.08em .2em}.math-large{display:inline-flex;align-items:center;gap:.2em}.limits{display:inline-grid;grid-template-rows:auto auto auto;place-items:center;vertical-align:middle}.limits b{font-size:1.4em;line-height:.8}.limits sup,.limits sub{font-size:.5em}.math-matrix{display:inline-grid;gap:.2em;padding:.1em}.math-matrix>span{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(30px,auto);gap:.5em}.math-matrix.cases>span{grid-template-columns:auto auto}.math-matrix em{margin-left:.8em;font-style:normal;font-size:.7em}.matrix-bracket{font-size:2.2em;font-style:normal}@media(max-width:760px){.layout{grid-template-columns:1fr}.grid3{grid-template-columns:1fr 1fr}.toolbar{flex-wrap:wrap}}
</style></head><body>
<header class="toolbar"><div class="target"><strong id="targetName">未选择插入位置</strong><small id="targetHint">请在 .tex 文件中放置光标</small></div><button id="refreshTarget">使用最近光标</button><button id="floatButton">独立窗口</button></header>
<nav class="tabs"><button class="active" data-tab="editorPane">编辑公式</button><button data-tab="savedPane">我的公式</button><button data-tab="variablesPane">变量库</button><button data-tab="stylesPane">公式样式</button></nav>

<section class="pane active" id="editorPane"><div class="layout">
<div class="card"><h3>选择公式结构</h3><div class="templates" id="templateButtons">
<button data-kind="basic">普通公式</button><button data-kind="fraction">分数</button><button data-kind="power">上标</button><button data-kind="subscript">下标</button><button data-kind="root">根号</button><button data-kind="sum">求和</button><button data-kind="product">连乘</button><button data-kind="integral">积分</button><button data-kind="limit">极限</button><button data-kind="matrix">矩阵</button><button data-kind="cases">分段函数</button><button data-kind="custom">高级输入</button>
</div><div class="composer-toolbar"><button id="undoFormula" type="button" title="撤销">↶ 撤销</button><button id="redoFormula" type="button" title="重做">↷ 重做</button><span>点击蓝色框输入；按 Tab 移到下一项；分段函数会添加在已有公式右侧</span></div><div class="visual-editor" id="visualEditor" tabindex="0"></div><div class="advanced" id="customArea" hidden><label>高级 LaTeX 输入<textarea id="customLatex" rows="3" placeholder="填写后离开输入框即可转换为可视内容"></textarea></label></div>
<h3 style="margin-top:14px">常用符号</h3><div class="symbols" id="symbolButtons"></div><p class="hint">先点击一个输入框，再点符号即可填入。也可从“变量库”选择。</p></div>
<div><div class="card"><h3>实时预览</h3><div class="preview" id="formulaPreview"></div><p class="status" id="previewDescription"></p></div>
<div class="card" style="margin-top:12px"><div class="grid2"><label>公式名称<input id="formulaName" value="未命名公式"></label><label>分组<input id="formulaCategory" value="我的公式"></label></div><label>用途说明<input id="formulaDescription" placeholder="例如：计算动能"></label><div class="grid2"><label>公式样式<select id="formulaStyle"></select></label><label>内部引用名称<input id="formulaLabel" placeholder="自动生成"></label></div><details class="advanced"><summary>本次公式快速属性</summary><div class="grid2"><label>显示方式<select id="quickDisplay"><option value="inline">行内</option><option value="display">独立</option><option value="numbered">带编号</option></select></label><label>公式位置<select id="quickAlignment"><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label><label>编号位置<select id="quickNumberPosition"><option value="left">左</option><option value="right">右</option></select></label><label>编号方式<select id="quickNumberMode"><option value="none">无编号</option><option value="automatic">自动</option><option value="manual">手动</option></select></label></div></details><label id="manualNumberField">手动编号<input id="manualNumber" placeholder="例如：1-1"></label><div class="actions"><button id="newFormula">新建</button><button id="saveFormula">保存为常用公式</button><button class="primary" id="insertFormula">插入到论文</button></div></div></div>
</div></section>

<section class="pane" id="savedPane"><div class="grid2" style="margin-bottom:10px"><input id="formulaSearch" placeholder="搜索公式名称或说明"><select id="formulaFilter"><option value="all">全部公式</option><option value="favorite">只看收藏</option><option value="recent">最近使用</option></select></div><div class="list" id="savedList"></div></section>

<section class="pane" id="variablesPane"><div class="layout"><div class="card"><h3>新建/编辑变量</h3><input type="hidden" id="variableId"><div class="grid2"><label>符号<input id="variableSymbol" placeholder="m"></label><label>变量名称<input id="variableName" placeholder="质量"></label></div><div class="grid2"><label>单位<input id="variableUnit" placeholder="kg"></label><label>分组<input id="variableCategory" value="常用变量"></label></div><label>说明<textarea id="variableDescription" rows="3" placeholder="物体的质量"></textarea></label><label class="check"><input id="variableFavorite" type="checkbox"> 收藏到常用变量</label><div class="actions"><button id="resetVariable">清空</button><button class="primary" id="saveVariable">保存变量</button></div></div><div><input id="variableSearch" placeholder="搜索符号、名称、单位或说明" style="margin-bottom:9px"><div class="list" id="variableList"></div></div></div></section>

<section class="pane" id="stylesPane"><div class="layout"><div class="card"><h3>新建/编辑公式样式</h3><input type="hidden" id="styleId"><label>样式名称<input id="styleName" value="论文公式"></label><div class="grid3"><label>使用场景<select id="styleDisplay"><option value="inline">行内公式</option><option value="display">独立公式</option><option value="numbered" selected>带编号公式</option></select></label><label>公式字号<select id="styleFontSize"><option value="10.5">五号</option><option value="12" selected>小四</option><option value="14">四号</option><option value="16">三号</option><option value="18">小二</option></select></label><label>数学字形<select id="styleMathStyle"><option value="default">论文默认</option><option value="upright">直立体</option><option value="bold">粗体</option></select></label></div><div class="grid3"><label>公式位置<select id="styleAlignment"><option value="left">左对齐</option><option value="center" selected>居中</option><option value="right">右对齐</option></select></label><label>编号位置<select id="styleNumberPosition"><option value="left">页面左侧</option><option value="right" selected>页面右侧</option></select></label><label>编号方式<select id="styleNumberMode"><option value="none">不编号</option><option value="automatic" selected>自动编号</option><option value="manual">手动编号</option></select></label></div><div class="grid3"><label>自动编号范围<select id="styleNumberingScope"><option value="continuous">全文连续</option><option value="section" selected>随节编号</option><option value="chapter">随章编号</option></select></label><label>编号分隔符<select id="styleNumberSeparator"><option value="-">1-1</option><option value=".">1.1</option><option value="–">1–1</option></select></label><label>编号格式<select id="styleNumberFormat"><option value="parentheses">（1-1）</option><option value="brackets">[1-1]</option><option value="plain">1-1</option><option value="prefix">式（1-1）</option></select></label></div><div class="grid3"><label>编号字体<select id="styleNumberFont"><option value="inherit">沿用论文</option><option value="songti">宋体</option><option value="heiti">黑体</option><option value="kaishu">楷体</option><option value="fangsong">仿宋</option></select></label><label>编号字号<select id="styleNumberSize"><option value="9">小五</option><option value="10.5" selected>五号</option><option value="12">小四</option></select></label><label class="check"><input id="styleNumberBold" type="checkbox"> 编号加粗</label></div><div class="grid2"><label>公式前间距<div class="grid2"><input id="styleBeforeValue" type="number" min="0" step="0.5" value="0.5"><select id="styleBeforeMode"><option value="lines">行</option><option value="pt">pt</option></select></div></label><label>公式后间距<div class="grid2"><input id="styleAfterValue" type="number" min="0" step="0.5" value="0.5"><select id="styleAfterMode"><option value="lines">行</option><option value="pt">pt</option></select></div></label></div><label class="check"><input id="stylePageBreak" type="checkbox"> 公式前另起一页</label><label class="check"><input id="styleKeepNext" type="checkbox"> 与下一段保持同页</label><div class="actions"><button id="resetStyle">新样式</button><button class="primary" id="saveStyle">保存样式</button></div></div><div class="list" id="styleList"></div></div></section>
<div class="toast" id="toast" hidden></div><script src="${katexScriptUri}"></script><script src="${scriptUri}"></script></body></html>`;
}

const PALETTE_CSS = String.raw`
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 10px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font: 13px var(--vscode-font-family); }
  button, input, select, textarea { font: inherit; }
  button { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 1px solid transparent; border-radius: 4px; padding: 6px 9px; cursor: pointer; }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.primary { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  .topbar { display: grid; gap: 5px; position: sticky; top: 0; z-index: 2; padding-bottom: 10px; background: var(--vscode-sideBar-background); }
  .topbar .primary { width:100%; }
  .tool-group { border:1px solid var(--vscode-panel-border); border-radius:5px; background:var(--vscode-editor-background); }
  .tool-group summary { padding:6px 8px; cursor:pointer; color:var(--vscode-descriptionForeground); font-size:11px; font-weight:700; }
  .tool-group>div { display:grid; grid-template-columns:repeat(2,1fr); gap:4px; padding:0 5px 5px; }
  .group-title { margin: 12px 2px 6px; color: var(--vscode-descriptionForeground); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .preset-card { display: grid; grid-template-columns: 32px 1fr auto; gap: 8px; align-items: center; width: 100%; margin: 5px 0; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); }
  .preset-main { min-width: 0; cursor: pointer; }
  .preset-name { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .preset-description { overflow: hidden; margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .preset-icon { display: grid; place-items: center; width: 30px; height: 30px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-radius: 5px; font-weight: 700; cursor: pointer; }
  .card-menu { position: relative; }
  .menu-button { padding: 4px 7px; background: transparent; }
  .menu { display: none; position: absolute; right: 0; top: 26px; z-index: 4; width: 110px; padding: 4px; border: 1px solid var(--vscode-widget-border); border-radius: 5px; background: var(--vscode-menu-background); box-shadow: 0 4px 14px rgba(0,0,0,.25); }
  .menu.open { display: grid; }
  .menu button { text-align: left; background: transparent; }
  .menu button:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
  .empty { padding: 40px 10px; text-align: center; color: var(--vscode-descriptionForeground); }
  .empty-icon { font-size: 34px; }
  footer { padding-top: 14px; text-align: center; }
  .link-button { color: var(--vscode-textLink-foreground); background: transparent; }
  dialog { width: min(540px, calc(100vw - 18px)); max-height: calc(100vh - 20px); padding: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); border-radius: 8px; overflow: auto; }
  dialog::backdrop { background: rgba(0,0,0,.45); }
  form { padding: 14px; }
  .dialog-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; font-size: 16px; }
  .icon-button { padding: 2px 8px; background: transparent; font-size: 20px; }
  label { display: grid; gap: 5px; margin: 9px 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
  input, select, textarea { width: 100%; padding: 7px 8px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px; outline: none; }
  input:focus, select:focus, textarea:focus { border-color: var(--vscode-focusBorder); }
  textarea { resize: vertical; font-family: var(--vscode-editor-font-family); line-height: 1.4; }
  .row { display: grid; gap: 10px; }
  .row.two { grid-template-columns: 1fr 1fr; }
  .row.three { grid-template-columns: repeat(3, 1fr); }
  .row.four { grid-template-columns: repeat(4, 1fr); }
  .inline-fields { display:grid; grid-template-columns:1fr 110px; gap:5px; }
  .compact-second { grid-template-columns: 3fr 1fr !important; }
  .format-toolbar { display: flex; gap: 4px; padding: 8px 0 2px; }
  .format-toolbar button { min-width: 34px; font-size: 15px; }
  .format-toolbar button.active { outline: 2px solid var(--vscode-focusBorder); background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .format-toolbar .align:nth-of-type(4) { text-align: center; }
  .format-toolbar .align:nth-of-type(5) { text-align: right; }
  .preview { min-height: 72px; margin-top: 10px; padding: 14px; border: 1px dashed var(--vscode-panel-border); background: var(--vscode-textBlockQuote-background); overflow: hidden; }
  .table-settings-group { margin: 12px 0; padding: 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
  .table-settings-group h3 { margin: 0 0 8px; font-size: 13px; }
  label.check { display: flex; align-items: center; gap: 7px; color: var(--vscode-foreground); }
  label.check input { width: auto; margin: 0; }
  .checks { display: flex; align-items: center; gap: 14px; padding-top: 20px; }
  .wrap-checks { flex-wrap: wrap; padding: 4px 0; }
  .table-visual-preview { margin-top: 10px; padding: 14px; border: 1px dashed var(--vscode-panel-border); background: var(--vscode-textBlockQuote-background); overflow: auto; }
  .table-visual-preview table { width: 100%; border-collapse: collapse; }
  .table-visual-preview th, .table-visual-preview td { padding: 6px; border: 1px solid var(--vscode-panel-border); }
  .image-visual-preview { display: grid; gap: 8px; margin-top: 10px; padding: 14px; border: 1px dashed var(--vscode-panel-border); background: var(--vscode-textBlockQuote-background); overflow: hidden; }
  .image-placeholder { display: grid; place-items: center; height: 92px; color: var(--vscode-descriptionForeground); background: repeating-linear-gradient(135deg, var(--vscode-input-background), var(--vscode-input-background) 8px, transparent 8px, transparent 16px); border: 1px solid var(--vscode-panel-border); }
  .caption-preview { width: 100%; text-align: center; }
  input[type="range"] { padding-left: 0; padding-right: 0; }
  .image-drop-zone { display: grid; place-items: center; gap: 7px; min-height: 190px; padding: 20px; border: 2px dashed var(--vscode-panel-border); border-radius: 8px; text-align: center; outline: none; }
  .image-drop-zone.dragging { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
  .image-drop-zone span { color: var(--vscode-descriptionForeground); font-size: 11px; }
  .drop-icon { font-size: 34px; color: var(--vscode-button-background); }
  .drop-or { margin-top: 4px; }
  .selected-image { margin-top: 12px; padding: 9px; border-radius: 5px; background: var(--vscode-textBlockQuote-background); word-break: break-all; }
  .selected-image img { display:block; max-width:100%; max-height:220px; margin:0 auto 10px; object-fit:contain; border:1px solid var(--vscode-panel-border); }
  .field-note { color: var(--vscode-descriptionForeground); font-size: 10px; }
  .table-size-summary { margin-bottom: 10px; text-align: center; font-weight: 700; }
  .table-grid { display: grid; grid-template-columns: repeat(8, 22px); justify-content: center; gap: 3px; margin: 10px auto; }
  .table-grid button { width: 22px; height: 22px; padding: 0; border: 1px solid var(--vscode-panel-border); border-radius: 2px; background: var(--vscode-input-background); }
  .table-grid button.selected { border-color: var(--vscode-focusBorder); background: var(--vscode-button-background); }
  .table-content-editor { max-height: 310px; overflow: auto; border: 1px solid var(--vscode-panel-border); }
  .table-content-editor table { border-collapse: collapse; min-width: 100%; }
  .table-content-editor td { padding: 2px; border: 1px solid var(--vscode-panel-border); }
  .table-content-editor input { min-width: 112px; border: 0; }
  .table-content-editor tr:first-child input { font-weight: 700; background: var(--vscode-textBlockQuote-background); }
  .table-content-editor td.selected-cell { outline:2px solid var(--vscode-focusBorder); outline-offset:-2px; }
  .table-edit-toolbar { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
  .outline-toolbar { margin-bottom: 8px; }
  .outline-list { display: grid; gap: 5px; max-height: 65vh; overflow: auto; }
  .outline-item { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; padding: 7px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
  .outline-item.level-2 { margin-left: 12px; }
  .outline-item.level-3 { margin-left: 24px; }
  .outline-main { min-width: 0; cursor: pointer; }
  .outline-main strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .outline-kind { color: var(--vscode-descriptionForeground); font-size: 10px; }
  .toc-preview { display: grid; gap: 7px; margin-top: 12px; padding: 16px; border: 1px dashed var(--vscode-panel-border); background: var(--vscode-textBlockQuote-background); }
  .toc-preview > strong { margin-bottom: 8px; text-align: center; font-size: 16px; }
  .toc-preview > div { display: flex; align-items: baseline; gap: 5px; }
  .toc-preview > div:nth-of-type(2) { padding-left: 12px; }
  .toc-preview > div:nth-of-type(3) { padding-left: 24px; }
  .toc-dots { flex: 1; border-bottom: 1px dotted var(--vscode-descriptionForeground); }
  .page-sheet-preview { display: grid; grid-template-rows: 38px 1fr 38px; width: min(270px, 80%); height: 350px; margin: 16px auto; padding: 14px 18px; color: #303030; background: #fff; border: 1px solid var(--vscode-panel-border); box-shadow: 0 4px 16px rgba(0,0,0,.22); }
  .page-preview-header { padding-bottom: 6px; border-bottom: 1px solid #777; text-align: center; font-size: 10px; }
  .page-preview-body { display: grid; align-content: center; gap: 13px; }
  .page-preview-body span { height: 4px; background: #ddd; border-radius: 2px; }
  .page-preview-body span:nth-child(2) { width: 85%; }
  .page-preview-body span:nth-child(4) { width: 65%; }
  .page-preview-footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; padding-top: 6px; font-size: 10px; }
  .page-preview-footer span:first-child { grid-column: 1; }
  .page-preview-footer span:last-child { grid-column: 2; }
  .danger-button { color: var(--vscode-errorForeground); background: transparent; border-color: var(--vscode-errorForeground); }
  .split-actions { display: grid; grid-template-columns: auto auto 1fr auto auto; align-items: center; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.5; }
  .hint code { color: var(--vscode-textPreformat-foreground); }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; position:sticky; bottom:0; z-index:3; padding:10px 0 2px; background:var(--vscode-editor-background); border-top:1px solid var(--vscode-panel-border); }
  @media (max-width: 390px) { .topbar { grid-template-columns: 1fr 1fr; } .row.two, .row.three { grid-template-columns: 1fr; } }
`;

/* The first prototype kept the webview script inline. It is retained in this
   block only as migration history; the active script is media/palette.js.
const PALETTE_SCRIPT = String.raw`
  const vscode = acquireVsCodeApi();
  let presets = [];
  let editingId = null;
  let alignment = 'left';
  let bold = false;
  let italic = false;

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dialog = byId('editorDialog');

  function render() {
    const list = byId('presetList');
    list.innerHTML = '';
    byId('empty').hidden = presets.length !== 0;
    if (!presets.length) return;
    const categories = [];
    for (const preset of presets) if (!categories.includes(preset.category)) categories.push(preset.category);
    for (const category of categories) {
      const title = document.createElement('div');
      title.className = 'group-title';
      title.textContent = category;
      list.appendChild(title);
      for (const preset of presets.filter((item) => item.category === category)) {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `
          <div class="preset-icon" data-action="insert" title="点击插入">${escapeHtml(preset.icon)}</div>
          <div class="preset-main" data-action="insert" title="点击插入到光标位置">
            <div class="preset-name">${escapeHtml(preset.name)}</div>
            <div class="preset-description">${escapeHtml(preset.description || '点击即可插入')}</div>
          </div>
          <div class="card-menu">
            <button class="menu-button" data-action="menu" title="更多操作">⋯</button>
            <div class="menu">
              <button data-action="edit">编辑</button>
              <button data-action="duplicate">复制</button>
              <button data-action="up">上移</button>
              <button data-action="down">下移</button>
              <button data-action="delete">删除</button>
            </div>
          </div>`;
        card.addEventListener('click', (event) => handleCardAction(event, preset));
        list.appendChild(card);
      }
    }
  }

  function handleCardAction(event, preset) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'insert') vscode.postMessage({ type: 'insertPreset', id: preset.id });
    if (action === 'menu') {
      document.querySelectorAll('.menu.open').forEach((menu) => { if (menu !== event.target.nextElementSibling) menu.classList.remove('open'); });
      event.target.nextElementSibling.classList.toggle('open');
    }
    if (action === 'edit') openEditor(preset);
    if (action === 'duplicate') openEditor({ ...preset, id: '', name: preset.name + '（副本）' });
    if (action === 'up' || action === 'down') vscode.postMessage({ type: 'movePreset', id: preset.id, direction: action });
    if (action === 'delete') vscode.postMessage({ type: 'deletePreset', id: preset.id });
  }

  function openEditor(preset) {
    const item = preset || {
      id: '', name: '', category: '段落', icon: '¶', description: '', kind: 'paragraph',
      settings: { fontSize: 12, lineSpacing: 1.5, before: 0, after: 0, indent: 2, alignment: 'left', bold: false, italic: false }
    };
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
    byId('fontSize').value = settings.fontSize ?? 12;
    byId('lineSpacing').value = settings.lineSpacing ?? 1.5;
    byId('before').value = settings.before ?? 0;
    byId('after').value = settings.after ?? 0;
    byId('indent').value = settings.indent ?? 2;
    alignment = settings.alignment || 'left';
    bold = Boolean(settings.bold);
    italic = Boolean(settings.italic);
    updateKind();
    updatePreview();
    dialog.showModal();
    setTimeout(() => byId('name').focus(), 0);
  }

  function updateKind() {
    const paragraph = byId('kind').value === 'paragraph';
    byId('paragraphFields').hidden = !paragraph;
    byId('customFields').hidden = paragraph;
  }

  function updatePreview() {
    document.querySelectorAll('.align').forEach((button) => button.classList.toggle('active', button.dataset.align === alignment));
    byId('boldButton').classList.toggle('active', bold);
    byId('italicButton').classList.toggle('active', italic);
    const preview = byId('visualPreview');
    preview.style.fontSize = Math.min(28, Number(byId('fontSize').value || 12)) + 'px';
    preview.style.lineHeight = String(byId('lineSpacing').value || 1.5);
    preview.style.textIndent = String(byId('indent').value || 0) + 'em';
    preview.style.textAlign = alignment;
    preview.style.fontWeight = bold ? '700' : '400';
    preview.style.fontStyle = italic ? 'italic' : 'normal';
    preview.style.paddingTop = (14 + Number(byId('before').value || 0) / 2) + 'px';
    preview.style.paddingBottom = (14 + Number(byId('after').value || 0) / 2) + 'px';
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
        fontSize: Number(byId('fontSize').value), lineSpacing: Number(byId('lineSpacing').value),
        before: Number(byId('before').value), after: Number(byId('after').value),
        indent: Number(byId('indent').value), alignment, bold, italic
      };
    } else {
      preset.template = byId('template').value || '${TM_SELECTED_TEXT:在此输入内容}';
    }
    vscode.postMessage({ type: 'savePreset', preset });
    dialog.close();
  });

  byId('kind').addEventListener('change', updateKind);
  ['fontSize','lineSpacing','before','after','indent'].forEach((id) => byId(id).addEventListener('input', updatePreview));
  byId('boldButton').addEventListener('click', () => { bold = !bold; updatePreview(); });
  byId('italicButton').addEventListener('click', () => { italic = !italic; updatePreview(); });
  document.querySelectorAll('.align').forEach((button) => button.addEventListener('click', () => { alignment = button.dataset.align; updatePreview(); }));
  byId('newButton').addEventListener('click', () => openEditor());
  byId('emptyNewButton').addEventListener('click', () => openEditor());
  byId('closeButton').addEventListener('click', () => dialog.close());
  byId('cancelButton').addEventListener('click', () => dialog.close());
  byId('helpButton').addEventListener('click', () => vscode.postMessage({ type: 'openHelp' }));
  byId('importButton').addEventListener('click', () => vscode.postMessage({ type: 'importPresets' }));
  byId('exportButton').addEventListener('click', () => vscode.postMessage({ type: 'exportPresets' }));
  byId('resetButton').addEventListener('click', () => vscode.postMessage({ type: 'resetDefaults' }));
  window.addEventListener('message', (event) => { if (event.data.type === 'state') { presets = event.data.presets || []; render(); } });
  document.addEventListener('click', (event) => { if (!event.target.closest('.card-menu')) document.querySelectorAll('.menu.open').forEach((menu) => menu.classList.remove('open')); });
  vscode.postMessage({ type: 'ready' });
`;
*/

function getHelpHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 15px/1.75 var(--vscode-font-family); }
    .hero { padding: 46px 32px 34px; background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-button-background) 30%, transparent), transparent); border-bottom: 1px solid var(--vscode-panel-border); }
    .hero-inner, main { max-width: 880px; margin: auto; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 { margin-top: 38px; padding-bottom: 7px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 21px; }
    h3 { margin-top: 24px; }
    main { padding: 20px 32px 60px; }
    .lead { color: var(--vscode-descriptionForeground); font-size: 17px; }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 22px 0; }
    .step, .tip { padding: 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background); }
    .number { display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-radius: 50%; font-weight: 700; }
    code { padding: 2px 5px; color: var(--vscode-textPreformat-foreground); background: var(--vscode-textCodeBlock-background); border-radius: 3px; }
    pre { padding: 14px; overflow: auto; background: var(--vscode-textCodeBlock-background); border-radius: 6px; }
    kbd { padding: 2px 7px; border: 1px solid var(--vscode-panel-border); border-bottom-width: 2px; border-radius: 4px; background: var(--vscode-keybindingLabel-background); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px; border-bottom: 1px solid var(--vscode-panel-border); text-align: left; }
    .tip { margin: 18px 0; border-left: 4px solid var(--vscode-button-background); }
    @media (max-width: 680px) { .steps { grid-template-columns: 1fr; } .hero, main { padding-left: 18px; padding-right: 18px; } }
  </style>
</head>
<body>
  <div class="hero"><div class="hero-inner">
    <h1>LaTeX 格式面板使用教程</h1>
    <div class="lead">创建自己的论文格式，写作时点击一下即可插入到光标位置。</div>
  </div></div>
  <main>
    <h2>快速开始</h2>
    <div class="steps">
      <div class="step"><div class="number">1</div><strong>打开面板</strong><br>点击 VS Code 左侧活动栏里的“LaTeX 格式面板”图标。</div>
      <div class="step"><div class="number">2</div><strong>放置光标</strong><br>打开一个 <code>.tex</code> 文件，把光标放在需要插入的位置。</div>
      <div class="step"><div class="number">3</div><strong>点击格式</strong><br>点击格式卡片，代码就会插入；按 <kbd>Tab</kbd> 填写下一项。</div>
    </div>

    <h2>创建段落格式</h2>
    <ol>
      <li>点击面板顶部的“＋ 新建格式”。</li>
      <li>选择“可视化段落格式”。</li>
      <li>填写格式名称和分组，再设置中文字体、字号、行距方式、左右缩进、首行/悬挂缩进、段前段后间距与对齐方式。</li>
      <li>根据需要开启段前另起一页、与下一段同页或避免页首页尾孤行。</li>
      <li>下方预览会同步变化；点击“保存格式”完成。</li>
    </ol>
    <div class="tip"><strong>段落间距：</strong>段前和段后可分别选择“行”或“磅（pt）”；行距可选单倍、1.5 倍、双倍、多倍、固定值或最小值。</div>
    <div class="tip"><strong>选中文字再点击格式：</strong>已有文字会自动放入新格式中。没有选择文字时，会插入提示内容并把光标放到填写位置。</div>
    <div class="tip"><strong>重新修改：</strong>把光标放在新版格式面板插入的段落中，点击右键并选择“修改当前对象属性”。</div>

    <h2>创建和插入表格</h2>
    <ol>
      <li>点击“＋ 新建格式”，选择“可视化表格样式”。</li>
      <li>设置表格内容的字体、字号、对齐、粗体和斜体。</li>
      <li>设置表头格式，也可以关闭“第一行作为表头”。</li>
      <li>选择表格位置和边框，再单独设置表格名称的字体、字号、行距、粗体、斜体、上下位置和是否居中。</li>
      <li>写作时点击保存的表格样式，在方格中选择行列数，然后直接填写表格名称、引用名称和每一个单元格；工具栏可继续增删行列或合并、拆分单元格。</li>
      <li>插入后把光标放入表格并右键，可选择重新编辑内容或修改完整表格样式。</li>
    </ol>
    <div class="tip"><strong>行数规则：</strong>启用表头时，选择的总行数包含第一行表头。例如“3 列 × 4 行”会生成 1 行表头和 3 行内容。每个待填写单元格都会显示“第几行第几列”。</div>

    <h2>创建和插入图片</h2>
    <ol>
      <li>点击“＋ 新建格式”，选择“可视化图片样式”。</li>
      <li>通过下拉框选择保持原图大小、按正文宽度百分比缩放或自定义像素宽度，再设置左中右位置和浮动方式。</li>
      <li>选择图注在图片上方或下方，并设置图注字体、字号、行距、粗体、斜体、是否居中以及编号方式。</li>
      <li>保存后点击图片样式，在窗口中按住 Shift 拖入图片，或点击“打开文件资源管理器”。</li>
      <li>如果选择手动编号，可在插入窗口填写“1-1”等编号；窗口会显示所选图片缩略图，图片说明文字和引用名称也在同一处完成。</li>
      <li>预览后需要调整时，把光标放在该图片从 <code>\\begin{figure}</code> 到 <code>\\end{figure}</code> 的代码内，点击右键并选择“LaTeX 格式面板：修改图片属性”。</li>
    </ol>
    <div class="tip"><strong>右键修改范围：</strong>可以原地修改缩放比例、左右位置、页面浮动位置、旋转、裁剪和图片编号，不需要删除图片重新插入。PDF 预览由 LaTeX Workshop 提供，因此右键入口位于对应的 LaTeX 图片代码块中。</div>
    <div class="tip"><strong>为什么拖入时要按 Shift：</strong>这是 VS Code 对侧边页面的安全限制；不按 Shift 时，VS Code 会直接打开被拖动的图片。</div>

    <h2>新建、检查和修复文档</h2>
    <ol>
      <li>点击侧边栏顶部的“文档工具”，在“新建文档”页面设置标题、作者、日期、单位、专业、指导教师、摘要和关键词。</li>
      <li>右侧会像 Word 一样显示标题页预览。设置完成后可保存为默认方案，以后点击“一键新建默认文档”即可。</li>
      <li>需要发给朋友时，可导出一个直接使用的 <code>.tex</code> 模板；也可以在侧边栏“导出”中把默认文档方案一起放入格式包。</li>
      <li>切换到“检查与修复”，点击“检查当前文档”，软件会按错误和提醒列出当前 <code>.tex</code> 文件中的问题。</li>
      <li>点击“转到位置”可回到问题代码。安全修复会默认勾选，其他项目需要主动勾选。</li>
      <li>点击预览修复后，先比较修改前和修改后，再确认应用。全部修改只占一步，可按一次 <kbd>Ctrl</kbd>+<kbd>Z</kbd> 撤销。</li>
    </ol>
    <div class="tip"><strong>检查范围：</strong>检查文档开始/结束、括号、环境、公式符号、宏包、表格列数、引用、图片路径和插件对象标记。它只分析当前文件，不检查 MiKTeX，也不会擅自删除手写内容。</div>
    <div class="tip"><strong>自动检查与编译说明：</strong>可开启“每次保存时自动检查”。编译失败后点击“解释最近编译错误”，会把常见日志错误转换成中文提示。</div>

    <h2>使用独立公式工具</h2>
    <ol>
      <li>在 <code>.tex</code> 文件中放置光标，点击面板顶部的“公式工具”。</li>
      <li>公式工具会尝试自动移入独立浮动窗口。如果仍显示为标签页，点击“独立窗口”或将标签拖出主窗口。</li>
      <li>点击蓝色槽位输入内容，再点击分数、上下标、根号、积分、求和、矩阵或分段函数即可继续嵌套；按 <kbd>Tab</kbd> 切换槽位。</li>
      <li>编辑错误时可使用“撤销/重做”；常用符号已按类别整理。</li>
      <li>在右侧检查实时预览，选择公式样式，再点击“插入到论文”。</li>
      <li>公式窗口不会自动关闭，可以继续编辑下一个公式。</li>
    </ol>
    <div class="tip"><strong>插入目标：</strong>窗口顶部会显示目标文件和行号。如果在主窗口移动了光标，返回公式窗口后点击“使用最近光标”。</div>
    <div class="tip"><strong>常用公式和变量：</strong>公式可保存、收藏和搜索。变量库可保存符号、中文名称、单位和解释，也可把变量直接插入正文。</div>
    <div class="tip"><strong>右键修改：</strong>把光标放入由公式工具插入的代码中，右键“修改当前对象属性”，即可原位修改内容、样式和编号。</div>

    <h2>插入和更新目录</h2>
    <ol>
      <li>把光标放在希望出现目录的位置，点击面板顶部的“目录”。</li>
      <li>选择显示到几级标题，再设置目录标题、字体、字号、对齐、页码和点线。</li>
      <li>点击“插入/更新”。文档中已有受管目录时，软件会原位更新，不会重复添加。</li>
      <li>点击“更新并预览”会连续更新目录信息并打开 PDF。</li>
    </ol>
    <div class="tip"><strong>重新修改：</strong>把光标放在目录对应的受管代码中，右键选择“修改当前对象属性”。需要删除时使用目录窗口左下角的“删除目录”。</div>

    <h2>设置页眉、页脚和页码</h2>
    <ol>
      <li>点击“页面设置”，可以先选择普通论文、学位论文或书籍排版方案，也可设置纸张方向、四边页距、装订线、镜像页边距和分栏。</li>
      <li>页眉和页脚可选固定文字、当前章节、当前小节或论文标题，并可设置字体、字号、位置、距离和横线。</li>
      <li>页码可选上下位置、左中右或双面外侧，以及阿拉伯数字或罗马数字。</li>
      <li>如果页码要从正文开始，请先把光标放在正文起始处，再选择“从正文/当前光标处”。</li>
      <li>首页可与其他页相同、全部隐藏，或使用单独页眉页脚；奇数页和偶数页也可使用不同内容。</li>
    </ol>
    <div class="tip"><strong>关闭与删除：</strong>取消勾选“启用页眉”、“启用页脚文字”或“显示页码”只会暂停显示，内容仍会保留。“删除文档页面设置”才会移除插件生成的设置。</div>

    <h2>论文方案、真实预览和导航引用</h2>
    <ol>
      <li>点击“论文方案”，统一选择正文、标题、图表名称和表格内容格式；保存后会生成五个协调样式。</li>
      <li>点击“PDF 预览”，软件会保存当前文件，调用 LaTeX Workshop 编译并打开真实 PDF。</li>
      <li>点击“导航引用”，可以查看章节、图片和表格；点击名称跳转到源码，点击“引用图/表”在当前光标处插入交叉引用。</li>
    </ol>
    <div class="tip"><strong>编号显示：</strong>编译后导航面板会优先读取 AUX 文件中的真实图表编号；尚未编译时按源码顺序估算。</div>

    <h2>创建其他模板</h2>
    <p>新建格式时选择“自定义 LaTeX 模板”，把常用代码放入模板框。可以使用下面两类标记：</p>
    <table>
      <thead><tr><th>标记</th><th>作用</th></tr></thead>
      <tbody>
        <tr><td><code>\${TM_SELECTED_TEXT:内容}</code></td><td>优先使用编辑器中选中的文字；没有选中时显示“内容”。</td></tr>
        <tr><td><code>\${1:图片路径}</code></td><td>可填写位置；数字决定按 <kbd>Tab</kbd> 时的跳转顺序。</td></tr>
      </tbody>
    </table>
    <pre>\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{\${1:图片路径}}
    \\caption{\${2:图片标题}}
\\end{figure}</pre>

    <h2>管理和分享格式</h2>
    <ul>
      <li>点击格式右侧的“⋯”，可以编辑、复制、排序或删除。</li>
      <li>点击“导出”会生成一个 <code>.latexstyles</code> 格式包，可以发给朋友。</li>
      <li>朋友点击“导入”，选择格式包，再选择“合并导入”即可。</li>
      <li>格式会自动保存在当前电脑的 VS Code 中，关闭软件不会丢失。</li>
    </ul>

    <h2>默认模板的注意事项</h2>
    <p>插入图片时扩展会自动添加 <code>graphicx</code>；使用三线表时自动添加 <code>booktabs</code>；选择“固定在当前位置”时自动添加 <code>float</code>；目录使用 <code>tocloft</code>；页眉页脚使用 <code>fancyhdr</code>；公式使用 <code>amsmath</code> 和 <code>amssymb</code>。宋体、黑体、楷体和仿宋命令通常由 <code>ctex</code> 提供。扩展不会改变 MiKTeX 或论文编译设置。</p>

    <h2>常见问题</h2>
    <h3>点击格式没有插入</h3>
    <p>请确认当前正在编辑的是扩展名为 <code>.tex</code> 的 LaTeX 文件，并把光标放进编辑区域。</p>
    <h3>插入后出现红色报错</h3>
    <p>通常是论文没有加载模板所需的宏包。查看格式说明，并在论文导言区加载对应宏包。</p>
    <h3>不小心改乱了默认格式</h3>
    <p>先导出需要保留的个人格式，再点击面板底部的“恢复默认格式”。</p>
  </main>
</body>
</html>`;
}

function activate(context) {
  const formulaTool = new FormulaTool(context);
  const documentTool = new DocumentTool(context);
  const provider = new FormatPaletteProvider(context, formulaTool, documentTool);
  documentTool.paletteProvider = provider;
  formulaTool.rememberEditor(vscode.window.activeTextEditor);
  documentTool.rememberEditor(vscode.window.activeTextEditor);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('latexFormatPalette.main', provider),
    vscode.window.onDidChangeActiveTextEditor((editor) => { formulaTool.rememberEditor(editor); documentTool.rememberEditor(editor); }),
    vscode.window.onDidChangeTextEditorSelection((event) => formulaTool.rememberEditor(event.textEditor)),
    vscode.workspace.onDidSaveTextDocument((document) => documentTool.onDidSave(document)),
    vscode.window.registerWebviewPanelSerializer('latexFormatPalette.formula', {
      async deserializeWebviewPanel(panel) { formulaTool.attachPanel(panel); }
    }),
    vscode.window.registerWebviewPanelSerializer('latexFormatPalette.document', {
      async deserializeWebviewPanel(panel) { documentTool.attachPanel(panel); }
    }),
    vscode.commands.registerCommand('latexFormatPalette.focus', () => vscode.commands.executeCommand('workbench.view.extension.latexFormatPalette')),
    vscode.commands.registerCommand('latexFormatPalette.openFormula', () => formulaTool.open(vscode.window.activeTextEditor)),
    vscode.commands.registerCommand('latexFormatPalette.openDocumentTool', () => documentTool.open(vscode.window.activeTextEditor)),
    vscode.commands.registerCommand('latexFormatPalette.checkDocument', () => documentTool.open(vscode.window.activeTextEditor).then(() => documentTool.checkCurrentDocument(true))),
    vscode.commands.registerCommand('latexFormatPalette.showHelp', () => showHelp(context)),
    vscode.commands.registerCommand('latexFormatPalette.importPresets', () => importPresets(context, provider)),
    vscode.commands.registerCommand('latexFormatPalette.exportPresets', () => exportPresets(context, provider)),
    vscode.commands.registerCommand('latexFormatPalette.editImageProperties', () => editImageProperties()),
    vscode.commands.registerCommand('latexFormatPalette.editCurrentProperties', () => editCurrentObjectProperties(provider))
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  buildImageSnippet,
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
  sanitizeImageSettings,
  sanitizeFormulaData,
  sanitizeFormulaStyle,
  sanitizeDocumentScheme,
  sanitizeDocumentTemplate,
  sanitizePageSettings,
  sanitizeSettings,
  sanitizeTableSettings,
  sanitizeTocSettings,
  sanitizeVariable,
  scanDocumentOutline,
  updateFigureBlock
};
