import { useState } from 'react';
import data from './data.json';
import cloudbase from '@cloudbase/js-sdk'; // 新增：引入腾讯云工具包

const CLOUD_ENV_ID = 'yanxue-app-d5gg8yx759d5e6070';
const DEFAULT_ROUTE_CODE = 'a7';
const qrMap = {
  a7: 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=%E5%AE%A2%E6%9C%8D1%E4%BA%8C%E7%BB%B4%E7%A0%81',
  m3: 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=%E5%AE%A2%E6%9C%8D2%E4%BA%8C%E7%BB%B4%E7%A0%81',
  x9: 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=%E5%AE%A2%E6%9C%8D3%E4%BA%8C%E7%BB%B4%E7%A0%81',
};

const getRouteCode = () => {
  const code = new URLSearchParams(window.location.search).get('r');
  return Object.hasOwn(qrMap, code) ? code : DEFAULT_ROUTE_CODE;
};

const normalizePhone = phone => phone.replace(/\D/g, '');
const isValidMainlandMobile = phone => /^1[3-9]\d{9}$/.test(normalizePhone(phone));

const SCORE_DIMENSIONS = ['厌学情绪', '厌学行为', '躯体敏感', '同伴关系', '学校适应', '家庭环境'];
const COMPANY_NAME = '金合网络科技有限公司';

const answerValue = value => (Number(value) === 1 ? 1 : 0);

const calculateScoreSummary = record => {
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

  return {
    parentTotal,
    childTotal,
    hasChildAnswers,
    parentDimensionScores,
    childDimensionScores,
  };
};

const buildResultRow = (record, scoreSummary) => {
  const userInfo = record?.userInfo || {};
  const row = {
    孩子姓名: userInfo.childName || '',
    手机号: record?.contactPhone || userInfo.contactPhone || '',
    提取码: record?.extractionCode || '',
    渠道: record?.routeCode || '',
    年龄: userInfo.childAge || '',
    性别: userInfo.childGender || '',
    家长身份: userInfo.role || '',
    家长总分: scoreSummary?.parentTotal ?? '',
    孩子总分: scoreSummary?.childTotal ?? '',
  };

  SCORE_DIMENSIONS.forEach((dimension, index) => {
    row['家长_' + dimension] = scoreSummary?.parentDimensionScores?.[index] ?? '';
    row['孩子_' + dimension] = scoreSummary?.childDimensionScores?.[index] ?? '';
  });

  return row;
};

const csvEscape = value => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};


const toCsv = row => {
  const headers = Object.keys(row);
  return [headers.join(','), headers.map(header => csvEscape(row[header])).join(',')].join('\n');
};

const htmlEscape = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const displayValue = value => {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};

const formatSubmitTime = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return displayValue(value);
  return date.toLocaleString('zh-CN', { hour12: false });
};

const getTotalRiskLabel = total => {
  if (total === '-' || total === undefined || total === null) return '未填写';
  const score = Number(total);
  if (score >= 20) return '高关注';
  if (score >= 10) return '中等关注';
  return '低关注';
};

const getDimensionRiskLabel = score => {
  if (score === '-' || score === undefined || score === null) return '未填写';
  const value = Number(score);
  if (value >= 4) return '高';
  if (value >= 2) return '中';
  return '低';
};

const buildReportRadarSvg = scoreSummary => {
  if (!scoreSummary) return '';
  const size = 460;
  const center = size / 2;
  const radius = 150;
  const maxScore = 5;
  const angleForIndex = index => (Math.PI * 2 * index) / SCORE_DIMENSIONS.length - Math.PI / 2;
  const pointFor = (score, index, pointRadius = radius) => {
    const angle = angleForIndex(index);
    const numericScore = Number(score) || 0;
    const valueRadius = (numericScore / maxScore) * pointRadius;
    return {
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
    };
  };
  const polygonPoints = scores => scores.map((score, index) => {
    const point = pointFor(score, index);
    return point.x.toFixed(1) + ',' + point.y.toFixed(1);
  }).join(' ');
  const gridPolygon = level => SCORE_DIMENSIONS.map((_, index) => {
    const point = pointFor(maxScore, index, (radius * level) / maxScore);
    return point.x.toFixed(1) + ',' + point.y.toFixed(1);
  }).join(' ');
  const axisLines = SCORE_DIMENSIONS.map((_, index) => {
    const point = pointFor(maxScore, index);
    return '<line x1="' + center + '" y1="' + center + '" x2="' + point.x.toFixed(1) + '" y2="' + point.y.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1" />';
  }).join('');
  const labels = SCORE_DIMENSIONS.map((dimension, index) => {
    const point = pointFor(maxScore, index, radius + 42);
    return '<text x="' + point.x.toFixed(1) + '" y="' + point.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#243b53">' + htmlEscape(dimension) + '</text>';
  }).join('');
  const parentDots = scoreSummary.parentDimensionScores.map((score, index) => {
    const point = pointFor(score, index);
    return '<circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="4" fill="#3182ce" />';
  }).join('');
  const childDots = scoreSummary.hasChildAnswers ? scoreSummary.childDimensionScores.map((score, index) => {
    const point = pointFor(score, index);
    return '<circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="4" fill="#dd6b20" />';
  }).join('') : '';
  const childLine = scoreSummary.hasChildAnswers
    ? '<polygon points="' + polygonPoints(scoreSummary.childDimensionScores) + '" fill="none" stroke="#dd6b20" stroke-width="3" stroke-linejoin="round" />'
    : '';

  return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="六维风险雷达图">'
    + [1, 2, 3, 4, 5].map(level => '<polygon points="' + gridPolygon(level) + '" fill="none" stroke="#d9e2ec" stroke-width="1" />').join('')
    + axisLines
    + '<polygon points="' + polygonPoints(scoreSummary.parentDimensionScores) + '" fill="none" stroke="#3182ce" stroke-width="3" stroke-linejoin="round" />'
    + childLine
    + parentDots
    + childDots
    + labels
    + '</svg>';
};

const buildSimpleReportHtml = (record, scoreSummary) => {
  const userInfo = record?.userInfo || {};
  const childName = displayValue(userInfo.childName || '未知孩子');
  const phone = displayValue(record?.contactPhone || userInfo.contactPhone);
  const submitTime = formatSubmitTime(record?.submitTime);
  const dimensionRows = SCORE_DIMENSIONS.map((dimension, index) => {
    const parentScore = scoreSummary.parentDimensionScores[index];
    const childScore = scoreSummary.childDimensionScores[index];
    return '<tr>'
      + '<td>' + htmlEscape(dimension) + '</td>'
      + '<td class="num parent">' + htmlEscape(parentScore) + '</td>'
      + '<td>' + htmlEscape(getDimensionRiskLabel(parentScore)) + '</td>'
      + '<td class="num child">' + htmlEscape(childScore) + '</td>'
      + '<td>' + htmlEscape(getDimensionRiskLabel(childScore)) + '</td>'
      + '</tr>';
  }).join('');
  const dimensionHighlights = SCORE_DIMENSIONS.map((dimension, index) => ({
    dimension,
    score: Math.max(Number(scoreSummary.parentDimensionScores[index]) || 0, scoreSummary.hasChildAnswers ? Number(scoreSummary.childDimensionScores[index]) || 0 : 0),
  }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const focusText = dimensionHighlights.length
    ? '本次测评中相对需要优先关注的维度为：' + dimensionHighlights.map(item => item.dimension).join('、') + '。建议客服在后续沟通中围绕这些维度追问近期具体事件、持续时间和对上学行为的影响。'
    : '本次测评暂未显示特别突出的单一风险维度。建议客服结合家长描述，继续了解孩子近期上学意愿、情绪状态和家庭沟通情况。';
  const childNote = scoreSummary.hasChildAnswers
    ? '本报告同时包含家长评估与孩子自评，可重点观察双方评分差异较大的维度。'
    : '本次没有孩子自评数据，报告主要基于家长填写信息生成。';
  const fileTitle = childName + ' 厌学风险评估简版报告';

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />'
    + '<title>' + htmlEscape(fileTitle) + '</title>'
    + '<style>'
    + 'body{margin:0;background:#eef4f8;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;}main{width:min(920px,calc(100% - 40px));margin:28px auto 48px;background:white;border-radius:14px;box-shadow:0 18px 45px rgba(31,45,61,.12);overflow:hidden}.cover{position:relative;padding:48px 56px 38px;background:linear-gradient(135deg,#f7fbff,#e7f2fb)}.company{position:absolute;right:28px;top:20px;color:#52657a;font-size:13px;letter-spacing:.5px}.kicker{color:#3182ce;font-weight:700;margin-bottom:10px}.title{font-size:34px;line-height:1.2;color:#14345f;font-weight:800;margin:0 0 12px}.subtitle{color:#5f7189;margin:0}.section{padding:28px 56px;border-top:1px solid #e6edf3}.section h2{font-size:21px;color:#14345f;margin:0 0 16px}.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}.info-item{background:#f7fafc;border:1px solid #e3ebf3;border-radius:10px;padding:12px 14px}.label{color:#64748b;font-size:13px}.value{font-weight:700;margin-top:4px}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.card{border-radius:12px;padding:16px;border:1px solid #d9e8f7;background:#f7fbff}.card.orange{background:#fffaf0;border-color:#f8dfb6}.card.gray{background:#f8fafc;border-color:#e2e8f0}.score{font-size:30px;font-weight:800;margin-top:6px}.parent{color:#3182ce}.child{color:#dd6b20}.risk{color:#14345f}.note{background:#f7fafc;border-left:4px solid #3182ce;border-radius:8px;padding:14px 16px;color:#34495e}table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf2f7;text-align:left}th{background:#f7fafc;color:#34495e;font-size:13px}.num{text-align:center;font-weight:800}.radar-wrap{display:grid;grid-template-columns:1fr 230px;gap:22px;align-items:center}.radar-wrap svg{width:100%;max-width:520px;display:block;margin:auto}.legend{display:flex;gap:14px;flex-wrap:wrap;color:#4a5568}.legend span:before{content:"";display:inline-block;width:22px;height:3px;margin-right:7px;vertical-align:middle}.legend .p:before{background:#3182ce}.legend .c:before{background:#dd6b20}.suggestions{margin:0;padding-left:20px}.suggestions li{margin:8px 0}.footer{padding:18px 56px 30px;color:#718096;font-size:12px}@media print{body{background:white}main{box-shadow:none;width:100%;margin:0}.section,.cover{padding-left:36px;padding-right:36px}.radar-wrap{grid-template-columns:1fr}}'
    + '</style></head><body><main>'
    + '<section class="cover"><div class="company">' + htmlEscape(COMPANY_NAME) + '</div><div class="kicker">内部参考版本</div><h1 class="title">青少年厌学风险多维评估简版报告</h1><p class="subtitle">根据线上问卷自动生成，仅供客服内部沟通和后续咨询参考，不作为临床诊断结论。</p></section>'
    + '<section class="section"><h2>基础信息表</h2><div class="info-grid">'
    + '<div class="info-item"><div class="label">孩子姓名/昵称</div><div class="value">' + htmlEscape(childName) + '</div></div>'
    + '<div class="info-item"><div class="label">联系电话</div><div class="value">' + htmlEscape(phone) + '</div></div>'
    + '<div class="info-item"><div class="label">年龄</div><div class="value">' + htmlEscape(displayValue(userInfo.childAge)) + '</div></div>'
    + '<div class="info-item"><div class="label">性别</div><div class="value">' + htmlEscape(displayValue(userInfo.childGender)) + '</div></div>'
    + '<div class="info-item"><div class="label">家长身份</div><div class="value">' + htmlEscape(displayValue(userInfo.role)) + '</div></div>'
    + '<div class="info-item"><div class="label">渠道</div><div class="value">' + htmlEscape(displayValue(record?.routeCode)) + '</div></div>'
    + '<div class="info-item"><div class="label">提取码</div><div class="value">' + htmlEscape(displayValue(record?.extractionCode)) + '</div></div>'
    + '<div class="info-item"><div class="label">提交时间</div><div class="value">' + htmlEscape(submitTime) + '</div></div>'
    + '</div></section>'
    + '<section class="section"><h2>总分摘要</h2><div class="summary">'
    + '<div class="card"><div class="label">家长总分</div><div class="score parent">' + htmlEscape(scoreSummary.parentTotal) + '</div><div>' + htmlEscape(getTotalRiskLabel(scoreSummary.parentTotal)) + '</div></div>'
    + '<div class="card orange"><div class="label">孩子总分</div><div class="score child">' + htmlEscape(scoreSummary.childTotal) + '</div><div>' + htmlEscape(getTotalRiskLabel(scoreSummary.childTotal)) + '</div></div>'
    + '<div class="card gray"><div class="label">报告提示</div><div class="score risk">筛查</div><div>需结合访谈进一步判断</div></div>'
    + '</div></section>'
    + '<section class="section"><h2>六维风险表</h2><table><thead><tr><th>维度</th><th>家长评分</th><th>家长风险</th><th>孩子评分</th><th>孩子风险</th></tr></thead><tbody>' + dimensionRows + '</tbody></table></section>'
    + '<section class="section"><h2>雷达图</h2><div class="radar-wrap"><div>' + buildReportRadarSvg(scoreSummary) + '<div class="legend"><span class="p">家长评分</span>' + (scoreSummary.hasChildAnswers ? '<span class="c">孩子评分</span>' : '') + '</div></div><div class="note">雷达图展示六个维度的相对高低。线条越靠外，说明该维度在问卷中被勾选的风险项越多。</div></div></section>'
    + '<section class="section"><h2>简短解释文字</h2><p class="note">' + htmlEscape(focusText + childNote) + '</p></section>'
    + '<section class="section"><h2>后续建议</h2><ul class="suggestions"><li>优先围绕高分维度了解最近 1-3 个月的具体事件、发生频率和持续时间。</li><li>如果躯体敏感得分较高，进一步确认身体不适是否集中出现在上学、考试或特定课程前后。</li><li>如果同伴关系或学校适应得分较高，重点了解同伴冲突、师生互动、课堂压力和校园环境变化。</li><li>如果家庭环境得分较高，沟通时先降低指责和催促强度，再讨论学习安排。</li><li>如出现持续拒学、自伤表达、严重睡眠/饮食问题或明显躯体反应，建议尽快转介线下专业评估。</li></ul></section>'
    + '<div class="footer">' + htmlEscape(COMPANY_NAME) + ' · 简版报告自动生成</div>'
    + '</main></body></html>';
};
function RadarChart({ scoreSummary }) {
  if (!scoreSummary) return null;

  const size = 360;
  const center = size / 2;
  const radius = 116;
  const maxScore = 5;
  const angleForIndex = index => (Math.PI * 2 * index) / SCORE_DIMENSIONS.length - Math.PI / 2;
  const pointFor = (score, index, pointRadius = radius) => {
    const angle = angleForIndex(index);
    const valueRadius = (Number(score) / maxScore) * pointRadius;
    return {
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
    };
  };
  const polygonPoints = scores => scores.map((score, index) => {
    const point = pointFor(score, index);
    return point.x + ',' + point.y;
  }).join(' ');
  const gridPolygon = level => SCORE_DIMENSIONS.map((_, index) => {
    const point = pointFor(maxScore, index, (radius * level) / maxScore);
    return point.x + ',' + point.y;
  }).join(' ');

  return (
    <div style={{ marginBottom: '18px' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', color: '#1a365d' }}>六维雷达图</h3>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
        <svg viewBox={'0 0 ' + size + ' ' + size} role="img" aria-label="厌学风险六维雷达图" style={{ width: '100%', maxWidth: '430px', display: 'block', margin: '0 auto' }}>
          {[1, 2, 3, 4, 5].map(level => (
            <polygon key={level} points={gridPolygon(level)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {SCORE_DIMENSIONS.map((_, index) => {
            const point = pointFor(maxScore, index);
            return <line key={index} x1={center} y1={center} x2={point.x} y2={point.y} stroke="#edf2f7" strokeWidth="1" />;
          })}
          <polygon points={polygonPoints(scoreSummary.parentDimensionScores)} fill="none" stroke="#3182ce" strokeWidth="3" strokeLinejoin="round" />
          {scoreSummary.hasChildAnswers && (
            <polygon points={polygonPoints(scoreSummary.childDimensionScores)} fill="none" stroke="#dd6b20" strokeWidth="3" strokeLinejoin="round" />
          )}
          {scoreSummary.parentDimensionScores.map((score, index) => {
            const point = pointFor(score, index);
            return <circle key={'p' + index} cx={point.x} cy={point.y} r="4" fill="#3182ce" />;
          })}
          {scoreSummary.hasChildAnswers && scoreSummary.childDimensionScores.map((score, index) => {
            const point = pointFor(score, index);
            return <circle key={'c' + index} cx={point.x} cy={point.y} r="4" fill="#dd6b20" />;
          })}
          {SCORE_DIMENSIONS.map((dimension, index) => {
            const labelPoint = pointFor(maxScore, index, radius + 32);
            return (
              <text key={dimension} x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="#2d3748">
                {dimension}
              </text>
            );
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '8px', fontSize: '14px', color: '#4a5568' }}>
          <span><span style={{ display: 'inline-block', width: '18px', height: '3px', background: '#3182ce', verticalAlign: 'middle', marginRight: '6px' }} />家长评分</span>
          {scoreSummary.hasChildAnswers && <span><span style={{ display: 'inline-block', width: '18px', height: '3px', background: '#dd6b20', verticalAlign: 'middle', marginRight: '6px' }} />孩子评分</span>}
        </div>
      </div>
    </div>
  );
}

function QuestionnaireApp() {
  const [step, setStep] = useState(0); 
  
  // 基础信息收集（已删除微信号收集，保护隐私）
  const [userInfo, setUserInfo] = useState({
    role: '',
    childName: '',
    childGender: '',
    childAge: ''
  });

  

  const [parentAnswers, setParentAnswers] = useState({});
  const [childAnswers, setChildAnswers] = useState({});
  const [childConsent, setChildConsent] = useState(null); 
  const [extractionCode, setExtractionCode] = useState(''); 
  const [routeCode] = useState(getRouteCode); 
  const [contactPhone, setContactPhone] = useState(''); 

  const handleUserInfoChange = (field, value) => setUserInfo({ ...userInfo, [field]: value });
  const handleParentChange = (questionId, value) => setParentAnswers({ ...parentAnswers, [questionId]: value });
  const handleChildChange = (questionId, value) => setChildAnswers({ ...childAnswers, [questionId]: value });

  // 生成 6 位随机提取码
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 🌟 核心修改：异步提交数据到腾讯云数据库
  const submitForm = async () => {
    const code = generateCode();
    setExtractionCode(code);
    
    // 准备要打包上传的所有数据
    const finalData = {
      userInfo: {
        ...userInfo,
        contactPhone: normalizePhone(contactPhone)
      },
      contactPhone: normalizePhone(contactPhone),
      parentAnswers,
      childAnswers: childConsent ? childAnswers : '未填写',
      extractionCode: code,
      routeCode,
      submitTime: new Date() // 记录精准提交时间
    };

    try {
      // 1. 呼叫腾讯云环境 (这里已经填好你的环境ID)
      const app = cloudbase.init({
        env: CLOUD_ENV_ID 
      });

      // 2. 执行匿名授权登录 (敲门砖)
      const auth = app.auth();
      await auth.anonymousAuthProvider().signIn();

      // 3. 连接数据库，写入 survey_results 集合
      const db = app.database();
      await db.collection('survey_results').add(finalData);
      
      console.log("太棒了！数据已成功写入腾讯云数据库！");
      
      // 4. 数据安全落库后，再跳转到成功页
      setStep(4); 
    } catch (error) {
      console.error("数据写入失败:", error);
      alert("网络好像有点开小差，请重新点击提交试试哦！");
    }
  };

  const goFromInfoToParent = () => {
    if (!userInfo.role || !userInfo.childName || !userInfo.childGender || !userInfo.childAge) {
      alert("请完整填写所有基本信息，以便为您生成专属报告哦！");
      return;
    }
    setStep(1);
  };

  const goFromParentToNext = () => {
    if (Object.keys(parentAnswers).length < data.parentQuestions.length) {
      alert("请回答完所有的题目再继续哦！");
      return;
    }
    if (parseInt(userInfo.childAge) >= 12) {
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const goFromChildToNext = () => {
    if (childConsent === true && Object.keys(childAnswers).length < data.childQuestions.length) {
      alert("请回答完所有的题目再提交哦！");
      return;
    }
    setStep(3);
  };

  const submitContactInfo = () => {
    const phone = normalizePhone(contactPhone);
    if (!phone) {
      alert("请填写手机号，方便顾问为您发送完整分析结果。");
      return;
    }
    if (!isValidMainlandMobile(contactPhone)) {
      alert("请填写 11 位有效手机号。");
      return;
    }
    submitForm();
  };

  return (
    <div style={{ maxWidth: '650px', margin: '40px auto', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#333' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#1a365d', margin: '0 0 10px 0', fontSize: '28px' }}>青少年厌学风险多维自检</h1>
        <p style={{ color: '#718096', fontSize: '15px', margin: 0 }}>专业筛查工具 · 私密安全 · 专属分析</p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', padding: '30px', border: '1px solid #edf2f7' }}>
        
        {step === 0 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ backgroundColor: '#ebf8ff', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #3182ce' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2b6cb0' }}>🛡️ 测评建档与隐私保护</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>
                完成自检后，您将获得专属的风险评估报告。请填写以下基础信息，我们将对您的隐私严格保密。
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>1. 您的身份是？</label>
                <select value={userInfo.role} onChange={e => handleUserInfoChange('role', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px' }}>
                  <option value="">请选择...</option>
                  <option value="母亲">母亲</option>
                  <option value="父亲">父亲</option>
                  <option value="其他照顾者">其他照顾者</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>2. 孩子的姓名或昵称（仅用于报告称呼）</label>
                <input type="text" value={userInfo.childName} onChange={e => handleUserInfoChange('childName', e.target.value)} placeholder="如：豆豆" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>3. 孩子性别</label>
                  <select value={userInfo.childGender} onChange={e => handleUserInfoChange('childGender', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px' }}>
                    <option value="">请选择</option>
                    <option value="男">男孩</option>
                    <option value="女">女孩</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>4. 孩子年龄</label>
                  <input type="number" value={userInfo.childAge} onChange={e => handleUserInfoChange('childAge', e.target.value)} placeholder="如：13" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <button onClick={goFromInfoToParent} style={{ marginTop: '30px', width: '100%', padding: '16px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(49, 130, 206, 0.3)' }}>开始测评</button>
          </div>
        )}

        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ backgroundColor: '#ebf8ff', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #3182ce' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2b6cb0' }}>第一部分：家长视角评估</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>请根据{userInfo.childName}最近3个月的实际情况作答。</p>
            </div>
            {data.parentQuestions.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '500', color: '#2d3748' }}>
                  <span style={{ color: '#cbd5e0', marginRight: '8px' }}>{index + 1}.</span>{item.text}
                </p>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name={item.id} value={1} checked={parentAnswers[item.id] === 1} onChange={() => handleParentChange(item.id, 1)} style={{ width: '18px', height: '18px' }} /> 是
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name={item.id} value={0} checked={parentAnswers[item.id] === 0} onChange={() => handleParentChange(item.id, 0)} style={{ width: '18px', height: '18px' }} /> 否
                  </label>
                </div>
              </div>
            ))}
            <button onClick={goFromParentToNext} style={{ marginTop: '25px', width: '100%', padding: '16px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>下一步</button>
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
             <div style={{ backgroundColor: '#f0fff4', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #38a169' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#276749' }}>第二部分：孩子自评视角</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>请把手机交给{userInfo.childName}。如果孩子不愿意填写，可直接选择“否”并提交问卷。</p>
            </div>

            <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#fff', border: '2px dashed #cbd5e0', borderRadius: '10px' }}>
              <p style={{ margin: '0 0 15px 0', fontWeight: 'bold', textAlign: 'center' }}>{userInfo.childName}，你愿意花两分钟填写一下自己的真实感受吗？</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <input type="radio" name="consent" onChange={() => setChildConsent(true)} style={{ width: '20px', height: '20px' }} /> 愿意
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <input type="radio" name="consent" onChange={() => setChildConsent(false)} style={{ width: '20px', height: '20px' }} /> 不愿意
                </label>
              </div>
            </div>

            {childConsent === true && data.childQuestions.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '500', color: '#2d3748' }}>
                  <span style={{ color: '#cbd5e0', marginRight: '8px' }}>{index + 1}.</span>{item.text}
                </p>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name={item.id} value={1} checked={childAnswers[item.id] === 1} onChange={() => handleChildChange(item.id, 1)} style={{ width: '18px', height: '18px' }} /> 是
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name={item.id} value={0} checked={childAnswers[item.id] === 0} onChange={() => handleChildChange(item.id, 0)} style={{ width: '18px', height: '18px' }} /> 否
                  </label>
                </div>
              </div>
            ))}
            
            {childConsent !== null && (
              <button onClick={goFromChildToNext} style={{ marginTop: '25px', width: '100%', padding: '16px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>下一步</button>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ backgroundColor: '#ebf8ff', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #3182ce' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2b6cb0' }}>最后一步：留下联系电话</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>
                请留下一个可联系的手机号，顾问会根据提取码为您发送完整分析结果。
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>手机号<span style={{ color: '#e53e3e' }}> *</span></label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="请输入 11 位手机号"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>

            <button onClick={submitContactInfo} style={{ marginTop: '10px', width: '100%', padding: '16px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>提交测评，生成报告</button>
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.5s ease-in', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', backgroundColor: '#e6fffa', color: '#319795', padding: '8px 20px', borderRadius: '20px', fontSize: '15px', fontWeight: 'bold', marginBottom: '20px' }}>✅ 测评已成功提交</div>
            <h2 style={{ margin: '0 0 15px 0', color: '#1a202c', fontSize: '24px' }}>{userInfo.childName}的专属报告已生成</h2>
            
            <div style={{ backgroundColor: '#fffaf0', border: '1px solid #feebc8', borderRadius: '12px', padding: '20px', marginBottom: '30px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 10px 0', color: '#dd6b20', fontWeight: 'bold', fontSize: '16px' }}>⚠️ 隐私保护提示：</p>
              <p style={{ margin: 0, color: '#7b341e', fontSize: '14px', lineHeight: '1.6' }}>
                为保护{userInfo.childName}的心理健康隐私，报告详细结果已被系统加密保存。仅支持家长点对点私密提取。
              </p>
            </div>

            <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #ebf8ff 100%)', border: '1px solid #bee3f8', borderRadius: '16px', padding: '35px 20px', boxShadow: '0 10px 25px rgba(49, 130, 206, 0.1)' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#2b6cb0', fontSize: '18px' }}>第一步：截图保存提取码</h3>
              
              <div style={{ margin: '15px auto 25px auto', padding: '15px', background: '#fff', border: '2px dashed #3182ce', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: '#2b6cb0', letterSpacing: '4px' }}>{extractionCode}</span>
              </div>

              <h3 style={{ margin: '0 0 15px 0', color: '#2b6cb0', fontSize: '18px' }}>第二步：扫码添加专属顾问</h3>
              <p style={{ margin: '0 auto 20px auto', color: '#4a5568', fontSize: '14px', lineHeight: '1.6', maxWidth: '400px' }}>
                发送暗号：<strong>“我是{userInfo.childName}的家长，提取码 {extractionCode}”</strong><br/>
                即可获取包含多维雷达图的深度定制分析方案。
              </p>
              
              <div style={{ margin: '0 auto', padding: '10px', background: '#fff', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                {/* 别忘了这里替换真实的二维码链接 */}
                <img 
                  src={qrMap[routeCode]} 
                  alt="扫码添加顾问微信" 
                  style={{ width: '160px', height: '160px', display: 'block', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


function AdminPanel() {
  const [password, setPassword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const queryResult = async () => {
    const trimmedKeyword = keyword.trim();
    if (!password) {
      alert('请输入后台密码');
      return;
    }
    if (!trimmedKeyword) {
      alert('请输入提取码或手机号');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const app = cloudbase.init({ env: CLOUD_ENV_ID });
      await app.auth().anonymousAuthProvider().signIn();
      const response = await app.callFunction({
        name: 'querySurveyResult',
        data: { password, keyword: trimmedKeyword },
        parse: true,
      });
      const payload = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
      setResult(payload);
      if (!payload.ok) {
        setMessage(payload.message || '查询失败');
      } else if (!payload.count) {
        setMessage('没有查到匹配记录');
      }
    } catch (error) {
      console.error('查询失败:', error);
      setMessage('查询失败，请检查密码、关键词或稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const firstRecord = result?.data?.[0] || null;
  const scoreSummary = firstRecord ? calculateScoreSummary(firstRecord) : null;
  const resultRow = firstRecord ? buildResultRow(firstRecord, scoreSummary) : null;
  const copyTable = async () => {
    if (!resultRow) return;
    const headers = Object.keys(resultRow);
    const tableText = [headers.join('\t'), headers.map(header => resultRow[header]).join('\t')].join('\n');
    await navigator.clipboard.writeText(tableText);
    setMessage('已复制表格，可直接粘贴到 Excel');
  };

  const downloadCsv = () => {
    if (!resultRow) return;
    const csv = '\ufeff' + toCsv(resultRow);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const code = firstRecord.extractionCode || keyword.trim() || 'survey-result';
    link.href = url;
    link.download = code + '-scores.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    if (!firstRecord || !scoreSummary) return;
    const html = buildSimpleReportHtml(firstRecord, scoreSummary);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const code = firstRecord.extractionCode || keyword.trim() || 'survey-result';
    link.href = url;
    link.download = code + '-简版报告.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <div style={{ maxWidth: '980px', margin: '40px auto', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a202c', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', color: '#1a365d', fontSize: '28px' }}>测评结果查询后台</h1>
        <p style={{ margin: 0, color: '#718096', fontSize: '14px' }}>输入后台密码和用户提取码或手机号，只读查询测评记录。</p>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>后台密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入后台密码"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>提取码或手机号</label>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="如 48L8P6 或 13812345678"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={queryResult} disabled={loading} style={{ padding: '13px 22px', backgroundColor: loading ? '#a0aec0' : '#3182ce', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '查询中' : '查询'}
          </button>
        </div>
        {message && <p style={{ margin: '16px 0 0 0', color: result?.ok ? '#2f855a' : '#c53030', fontSize: '14px' }}>{message}</p>}
      </div>

      {firstRecord && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#1a365d' }}>{firstRecord.userInfo?.childName || '未知孩子'} 的测评记录</h2>
              <p style={{ margin: 0, color: '#718096', fontSize: '14px' }}>提取码：{firstRecord.extractionCode || '-'} · 手机号：{firstRecord.contactPhone || firstRecord.userInfo?.contactPhone || '-'}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={downloadReport} style={{ padding: '10px 14px', border: '1px solid #3182ce', background: '#3182ce', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>下载简易报告</button>
              <button onClick={copyTable} style={{ padding: '10px 14px', border: '1px solid #cbd5e0', background: '#fff', borderRadius: '8px', cursor: 'pointer' }}>复制表格</button>
              <button onClick={downloadCsv} style={{ padding: '10px 14px', border: '1px solid #cbd5e0', background: '#fff', borderRadius: '8px', cursor: 'pointer' }}>下载 CSV</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>年龄</strong><br />{firstRecord.userInfo?.childAge || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>性别</strong><br />{firstRecord.userInfo?.childGender || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>家长身份</strong><br />{firstRecord.userInfo?.role || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>渠道</strong><br />{firstRecord.routeCode || '-'}</div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', color: '#1a365d' }}>自动计分结果</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={{ background: '#ebf8ff', padding: '14px', borderRadius: '8px', border: '1px solid #bee3f8' }}><strong>家长总分</strong><br /><span style={{ fontSize: '24px', color: '#2b6cb0', fontWeight: 'bold' }}>{scoreSummary.parentTotal}</span></div>
              <div style={{ background: '#fffaf0', padding: '14px', borderRadius: '8px', border: '1px solid #feebc8' }}><strong>孩子总分</strong><br /><span style={{ fontSize: '24px', color: '#c05621', fontWeight: 'bold' }}>{scoreSummary.childTotal}</span></div>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '620px' }}>
                <thead>
                  <tr style={{ background: '#f7fafc' }}>
                    <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>维度</th>
                    <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>家长评分</th>
                    <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>孩子评分</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORE_DIMENSIONS.map((dimension, index) => (
                    <tr key={dimension}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #edf2f7', fontWeight: 'bold' }}>{dimension}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #edf2f7', textAlign: 'center' }}>{scoreSummary.parentDimensionScores[index]}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #edf2f7', textAlign: 'center' }}>{scoreSummary.childDimensionScores[index]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <RadarChart scoreSummary={scoreSummary} />
        </div>
      )}
    </div>
  );
}

function App() {
  return new URLSearchParams(window.location.search).get('admin') === '1'
    ? <AdminPanel />
    : <QuestionnaireApp />;
}

export default App;