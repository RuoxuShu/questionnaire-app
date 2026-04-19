import { useState } from 'react';
import data from './data.json';

function App() {
  const [step, setStep] = useState(1);
  const [childAge, setChildAge] = useState('');
  const [parentAnswers, setParentAnswers] = useState({});
  const [childAnswers, setChildAnswers] = useState({});

  const handleParentChange = (questionId, value) => setParentAnswers({ ...parentAnswers, [questionId]: value });
  const handleChildChange = (questionId, value) => setChildAnswers({ ...childAnswers, [questionId]: value });

  const handleNextStepParent = () => {
    if (!childAge) { alert("请先填写孩子的年龄哦！"); return; }
    if (parseInt(childAge) > 12) setStep(2); else setStep(3);
  };

  const handleNextStepChild = () => setStep(3);

  const calculateResult = (answers, versionData) => {
    let totalScore = 0;
    let dimensionScores = { "厌学情绪": 0, "厌学行为": 0, "躯体敏感性": 0, "同伴关系与霸凌": 0, "师生关系与学校环境适应": 0, "家庭厌学风险": 0 };
    versionData.forEach(item => {
      const score = answers[item.id] || 0;
      totalScore += score;
      if (dimensionScores[item.dimension] !== undefined) dimensionScores[item.dimension] += score;
    });

    let suggestion = "";
    let riskLevel = ""; // 用于控制颜色主题
    if (totalScore <= 7) { suggestion = "整体状态良好，继续保持正向引导。"; riskLevel = "low"; }
    else if (totalScore <= 15) { suggestion = "存在轻度厌学倾向，建议开始关注并改善亲子沟通模式。"; riskLevel = "medium"; }
    else if (totalScore <= 23) { suggestion = "存在中度厌学问题，建议尽快介入，必要时寻求专业心理辅导。"; riskLevel = "high"; }
    else { suggestion = "存在重度厌学风险！强烈建议立即寻求专业心理咨询或干预。"; riskLevel = "severe"; }

    return { totalScore, dimensionScores, suggestion, riskLevel };
  };

  // 小组件：精美进度条
  const ProgressBar = ({ label, score }) => {
    const percentage = (score / 5) * 100;
    // 分数越高越危险：≥4分红色，2-3分橙色，0-1分绿色
    const color = score >= 4 ? '#ff4d4f' : score >= 2 ? '#faad14' : '#52c41a';
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
          <span style={{ fontWeight: score >= 4 ? '600' : '400', color: '#333' }}>{label}</span>
          <span style={{ fontWeight: 'bold', color }}>{score} / 5 分</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, transition: 'width 1s ease-in-out', borderRadius: '4px' }}></div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '650px', margin: '40px auto', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#333' }}>
      
      {/* 顶部标题区始终保留 */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#1a365d', margin: '0 0 10px 0', fontSize: '28px' }}>多维厌学风险评估系统</h1>
        <p style={{ color: '#718096', fontSize: '15px', margin: 0 }}>基于心理学量表的专业筛查工具</p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', padding: '30px', border: '1px solid #edf2f7' }}>
        
        {step === 1 && (
          <div>
            <div style={{ backgroundColor: '#ebf8ff', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #3182ce' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2b6cb0', display: 'flex', alignItems: 'center' }}>📝 第一阶段：父母视角评估</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>请家长根据孩子近一个月的真实情况，凭第一直觉选择“是”或“否”。</p>
            </div>
            {data.parentVersion.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', transition: 'all 0.2s' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '500', color: '#2d3748' }}>
                  <span style={{ color: '#cbd5e0', marginRight: '8px' }}>{index + 1}.</span>
                  {item.question}
                </p>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <input type="radio" name={item.id} value={1} onChange={() => handleParentChange(item.id, 1)} style={{ width: '18px', height: '18px', accentColor: '#3182ce' }} /> 是
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <input type="radio" name={item.id} value={0} onChange={() => handleParentChange(item.id, 0)} style={{ width: '18px', height: '18px', accentColor: '#3182ce' }} /> 否
                  </label>
                </div>
              </div>
            ))}
            <div style={{ marginTop: '30px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px dashed #cbd5e0' }}>
              <label style={{ fontSize: '16px', fontWeight: '600', color: '#2d3748' }}>
                为生成精准报告，请填写孩子年龄：
                <input type="number" value={childAge} onChange={(e) => setChildAge(e.target.value)} style={{ marginLeft: '12px', padding: '10px', width: '80px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', outline: 'none' }} placeholder="如: 13" />
              </label>
            </div>
            <button onClick={handleNextStepParent} style={{ marginTop: '25px', width: '100%', padding: '16px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(49, 130, 206, 0.3)' }}>生成评估报告</button>
          </div>
        )}

        {step === 2 && (
          <div>
             <div style={{ backgroundColor: '#f0fff4', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #38a169' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#276749', display: 'flex', alignItems: 'center' }}>👦👧 第二阶段：孩子自评视角</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>请把手机交给孩子。请你根据近一个月的真实感受独立填写。</p>
            </div>
            {data.childVersion.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '500', color: '#2d3748' }}>
                  <span style={{ color: '#cbd5e0', marginRight: '8px' }}>{index + 1}.</span>{item.question}
                </p>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <input type="radio" name={item.id} value={1} onChange={() => handleChildChange(item.id, 1)} style={{ width: '18px', height: '18px', accentColor: '#38a169' }} /> 是
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <input type="radio" name={item.id} value={0} onChange={() => handleChildChange(item.id, 0)} style={{ width: '18px', height: '18px', accentColor: '#38a169' }} /> 否
                  </label>
                </div>
              </div>
            ))}
            <button onClick={handleNextStepChild} style={{ marginTop: '25px', width: '100%', padding: '16px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(56, 161, 105, 0.3)' }}>提交并查看最终报告</button>
          </div>
        )}

        {step === 3 && (() => {
          const parentResult = calculateResult(parentAnswers, data.parentVersion);
          const childResult = parseInt(childAge) > 12 ? calculateResult(childAnswers, data.childVersion) : null;

          return (
            <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#ebf8ff', color: '#3182ce', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', marginBottom: '16px' }}>评估已完成</div>
                <h2 style={{ margin: '0 0 10px 0', color: '#1a202c', fontSize: '24px' }}>综合测评结果分析</h2>
              </div>

              {/* 核心结论卡片 */}
              <div style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)', borderRadius: '16px', padding: '24px', marginBottom: '30px', boxShadow: '0 4px 10px rgba(254, 215, 215, 0.5)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#c53030', fontSize: '18px', display: 'flex', alignItems: 'center' }}>⚠️ 核心结论与建议</h3>
                <p style={{ margin: 0, fontSize: '16px', color: '#742a2a', lineHeight: '1.6', fontWeight: '500' }}>{parentResult.suggestion}</p>
                {parentResult.dimensionScores["家庭厌学风险"] >= 3 && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px', fontSize: '14px', color: '#9b2c2c' }}>
                    <strong>系统检测到：</strong>“家庭厌学风险”维度偏高，建议优先调整家庭沟通与教养方式。
                  </div>
                )}
              </div>

              {/* 家长版雷达明细 */}
              <div style={{ marginBottom: childResult ? '30px' : '40px' }}>
                <h3 style={{ fontSize: '16px', color: '#4a5568', borderBottom: '2px solid #edf2f7', paddingBottom: '10px', marginBottom: '20px' }}>📊 家长视角维度分析 (得分越高风险越大)</h3>
                <div style={{ padding: '0 10px' }}>
                  {Object.entries(parentResult.dimensionScores).map(([dim, score]) => (
                    <ProgressBar key={`p_${dim}`} label={dim} score={score} />
                  ))}
                </div>
              </div>

              {/* 孩子版雷达明细 */}
              {childResult && (
                <div style={{ marginBottom: '40px' }}>
                  <h3 style={{ fontSize: '16px', color: '#4a5568', borderBottom: '2px solid #edf2f7', paddingBottom: '10px', marginBottom: '20px' }}>📊 孩子视角维度分析 (对照组)</h3>
                  <div style={{ padding: '0 10px' }}>
                    {Object.entries(childResult.dimensionScores).map(([dim, score]) => (
                      <ProgressBar key={`c_${dim}`} label={dim} score={score} />
                    ))}
                  </div>
                </div>
              )}

              {/* 强转化引流区 */}
              <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                <h2 style={{ margin: '0 0 12px 0', color: '#2b6cb0', fontSize: '20px' }}>获取专家深度解读 ＆ 定制干预方案</h2>
                <p style={{ margin: '0 auto 20px auto', color: '#718096', fontSize: '14px', lineHeight: '1.6', maxWidth: '400px' }}>
                  仅靠自测无法替代专业诊断。截图保存此报告，添加专属指导老师微信，免费获取**1对1结果分析**与**家庭改善计划**。
                </p>
                
                {/* 替换这里的网络图片链接为你的实际二维码 */}
                <div style={{ margin: '0 auto', padding: '10px', background: '#fff', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=这里之后换成你的微信号或二维码链接" 
                    alt="扫码添加专家微信" 
                    style={{ width: '160px', height: '160px', display: 'block', borderRadius: '8px' }}
                  />
                </div>
                <p style={{ margin: '15px 0 0 0', fontWeight: 'bold', color: '#e53e3e', fontSize: '15px', animation: 'pulse 2s infinite' }}>长按识别二维码，获取深度干预支持 ↑</p>
              </div>

            </div>
          );
        })()}

      </div>
    </div>
  );
}

export default App;