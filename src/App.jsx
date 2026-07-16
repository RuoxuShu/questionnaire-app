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
  const displayJson = firstRecord ? JSON.stringify(firstRecord, null, 2) : '';

  const copyJson = async () => {
    if (!displayJson) return;
    await navigator.clipboard.writeText(displayJson);
    setMessage('已复制查询结果');
  };

  const downloadJson = () => {
    if (!displayJson) return;
    const blob = new Blob([displayJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const code = firstRecord.extractionCode || keyword.trim() || 'survey-result';
    link.href = url;
    link.download = code + '.json';
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={copyJson} style={{ padding: '10px 14px', border: '1px solid #cbd5e0', background: '#fff', borderRadius: '8px', cursor: 'pointer' }}>复制 JSON</button>
              <button onClick={downloadJson} style={{ padding: '10px 14px', border: '1px solid #cbd5e0', background: '#fff', borderRadius: '8px', cursor: 'pointer' }}>下载 JSON</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>年龄</strong><br />{firstRecord.userInfo?.childAge || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>性别</strong><br />{firstRecord.userInfo?.childGender || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>家长身份</strong><br />{firstRecord.userInfo?.role || '-'}</div>
            <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}><strong>渠道</strong><br />{firstRecord.routeCode || '-'}</div>
          </div>

          <pre style={{ margin: 0, padding: '16px', background: '#1a202c', color: '#e2e8f0', borderRadius: '8px', overflowX: 'auto', fontSize: '13px', lineHeight: '1.5' }}>{displayJson}</pre>
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