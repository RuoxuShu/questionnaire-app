const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const cloudbase = require('@cloudbase/node-sdk');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const COLLECTION_NAME = 'survey_results';
const SCORE_DIMENSIONS = ['厌学情绪', '厌学行为', '躯体敏感性', '同伴关系', '学校适应', '家庭环境'];
const TEMPLATE_PATH = path.join(__dirname, 'report-template.docx');

const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const answerValue = value => (Number(value) === 1 ? 1 : 0);

function calculateScoreSummary(record) {
  const parentAnswers = record?.parentAnswers || {};
  const rawChildAnswers = record?.childAnswers;
  const hasChildAnswers = rawChildAnswers && typeof rawChildAnswers === 'object' && rawChildAnswers !== '未填写';
  const childAnswers = hasChildAnswers ? rawChildAnswers : {};
  const parentDimensionScores = Array(SCORE_DIMENSIONS.length).fill(0);
  const childDimensionScores = hasChildAnswers ? Array(SCORE_DIMENSIONS.length).fill(0) : Array(SCORE_DIMENSIONS.length).fill('-');
  let parentTotal = 0;
  let childTotal = hasChildAnswers ? 0 : '-';

  for (let i = 1; i <= 30; i += 1) {
    const dimensionIndex = (i - 1) % SCORE_DIMENSIONS.length;
    const parentScore = answerValue(parentAnswers['p' + i]);
    parentTotal += parentScore;
    parentDimensionScores[dimensionIndex] += parentScore;

    if (hasChildAnswers) {
      const childScore = answerValue(childAnswers['c' + i]);
      childTotal += childScore;
      childDimensionScores[dimensionIndex] += childScore;
    }
  }

  return { parentTotal, childTotal, hasChildAnswers, parentDimensionScores, childDimensionScores };
}

function makeRadarSvg(scoreSummary) {
  const width = 760;
  const height = 520;
  const centerX = 380;
  const centerY = 250;
  const radius = 160;
  const maxScore = 5;
  const labelRadius = radius + 48;

  const pointFor = (score, index, pointRadius = radius) => {
    const angle = (Math.PI * 2 * index) / SCORE_DIMENSIONS.length - Math.PI / 2;
    const numericScore = Number(score) || 0;
    const valueRadius = (numericScore / maxScore) * pointRadius;
    return {
      x: centerX + Math.cos(angle) * valueRadius,
      y: centerY + Math.sin(angle) * valueRadius,
    };
  };

  const points = scores => scores.map((score, index) => {
    const point = pointFor(score, index);
    return point.x.toFixed(1) + ',' + point.y.toFixed(1);
  }).join(' ');

  const grid = [1, 2, 3, 4, 5].map(level => {
    const gridPoints = SCORE_DIMENSIONS.map((_, index) => {
      const point = pointFor(maxScore, index, (radius * level) / maxScore);
      return point.x.toFixed(1) + ',' + point.y.toFixed(1);
    }).join(' ');
    return '<polygon points="' + gridPoints + '" fill="none" stroke="#a9a9a9" stroke-width="1.4" stroke-dasharray="7 7" />';
  }).join('');

  const axes = SCORE_DIMENSIONS.map((_, index) => {
    const point = pointFor(maxScore, index);
    return '<line x1="' + centerX + '" y1="' + centerY + '" x2="' + point.x.toFixed(1) + '" y2="' + point.y.toFixed(1) + '" stroke="#8db9e8" stroke-width="1" />';
  }).join('');

  const labels = SCORE_DIMENSIONS.map((dimension, index) => {
    const point = pointFor(maxScore, index, labelRadius);
    return '<text x="' + point.x.toFixed(1) + '" y="' + point.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-family="Microsoft YaHei, SimSun, Arial" font-size="26" fill="#000000">' + escapeXml(dimension) + '</text>';
  }).join('');

  const scaleLabels = [0, 1, 2, 3, 4, 5].map(level => {
    const y = centerY - (radius * level) / maxScore + 8;
    return '<text x="' + (centerX - 16) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-family="Arial" font-size="22" fill="#000000">' + level + '</text>';
  }).join('');

  const childLine = scoreSummary.hasChildAnswers
    ? '<polygon points="' + points(scoreSummary.childDimensionScores) + '" fill="none" stroke="#ed7d31" stroke-width="6" stroke-linejoin="round" />'
    : '';

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">'
    + '<rect width="100%" height="100%" fill="#ffffff" />'
    + grid + axes + scaleLabels
    + '<polygon points="' + points(scoreSummary.parentDimensionScores) + '" fill="none" stroke="#2e75b6" stroke-width="6" stroke-linejoin="round" />'
    + childLine
    + labels
    + '</svg>';
}

function replaceFirstCellText(cellXml, value) {
  let replaced = false;
  return cellXml.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (match, open, text, close) => {
    if (!replaced) {
      replaced = true;
      return open + escapeXml(value) + close;
    }
    return open + close;
  });
}

function replaceScoreCells(rowXml, parentValue, childValue) {
  const cellRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  const cells = rowXml.match(cellRegex);
  if (!cells || cells.length < 4) return rowXml;
  cells[2] = replaceFirstCellText(cells[2], parentValue);
  cells[3] = replaceFirstCellText(cells[3], childValue);
  let index = 0;
  return rowXml.replace(cellRegex, () => cells[index++]);
}

function replaceProfileLine(documentXml, record) {
  const userInfo = record?.userInfo || {};
  const childName = userInfo.childName || '未知';
  const childAge = userInfo.childAge || '未知';
  const replacement = '孩子 ：' + childName + '       年龄 ：' + childAge;
  return documentXml.replace(/(<w:t(?:\s[^>]*)?>)孩子 ：[\s\S]*?年龄 ：[\s\S]*?(<\/w:t>)/, '$1' + escapeXml(replacement) + '$2');
}

function replaceScoresInTable(documentXml, scoreSummary) {
  const values = [
    ...scoreSummary.parentDimensionScores.map((parentScore, index) => [parentScore, scoreSummary.childDimensionScores[index]]),
    [scoreSummary.parentTotal, scoreSummary.childTotal],
  ];
  let rowIndex = -1;
  return documentXml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, rowXml => {
    rowIndex += 1;
    if (rowIndex === 0 || rowIndex > values.length) return rowXml;
    const [parentValue, childValue] = values[rowIndex - 1];
    return replaceScoreCells(rowXml, parentValue, childValue);
  });
}

async function buildReportDocx(record) {
  const scoreSummary = calculateScoreSummary(record);
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  let documentXml = await zip.file('word/document.xml').async('string');
  documentXml = replaceProfileLine(documentXml, record);
  documentXml = replaceScoresInTable(documentXml, scoreSummary);
  zip.file('word/document.xml', documentXml);

  const radarSvg = makeRadarSvg(scoreSummary);
  zip.file('word/media/image1.svg', radarSvg);
  zip.remove('word/media/image1.png');

  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  relsXml = relsXml.replace('Target="media/image1.png"', 'Target="media/image1.svg"');
  zip.file('word/_rels/document.xml.rels', relsXml);

  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypesXml.includes('Extension="svg"')) {
    contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="svg" ContentType="image/svg+xml"/></Types>');
  }
  zip.file('[Content_Types].xml', contentTypesXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function safeFilename(value) {
  return String(value || '测评报告').replace(/[\\/:*?"<>|]/g, '_');
}

async function findRecordByKeyword(keyword) {
  const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
  const db = app.database();
  const fields = ['extractionCode', 'contactPhone', 'userInfo.contactPhone'];
  for (const field of fields) {
    const condition = { [field]: keyword };
    const result = await db.collection(COLLECTION_NAME).where(condition).limit(1).get();
    if (result.data && result.data.length) return result.data[0];
  }
  return null;
}

exports.main = async (event = {}) => {
  try {
    const password = String(event.password || '');
    const keyword = String(event.keyword || '').trim();
    if (password !== ADMIN_PASSWORD) {
      return { ok: false, message: '后台密码错误' };
    }
    if (!keyword) {
      return { ok: false, message: '请输入提取码或手机号' };
    }

    const record = await findRecordByKeyword(keyword);
    if (!record) {
      return { ok: false, message: '没有查到匹配记录' };
    }

    const buffer = await buildReportDocx(record);
    const childName = record?.userInfo?.childName || '未知孩子';
    const code = record?.extractionCode || keyword;
    return {
      ok: true,
      filename: safeFilename(childName + '-' + code + '-厌学风险评估报告.docx'),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileBase64: buffer.toString('base64'),
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: error.message || '生成报告失败' };
  }
};

exports._private = { buildReportDocx, calculateScoreSummary, makeRadarSvg };
