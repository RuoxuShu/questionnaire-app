import { useState } from 'react';
import data from './data.json';
import cloudbase from '@cloudbase/js-sdk'; // 新增：引入腾讯云工具包

function App() {
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
      userInfo,
      parentAnswers,
      childAnswers: childConsent ? childAnswers : '未填写',
      extractionCode: code,
      submitTime: new Date() // 记录精准提交时间
    };

    try {
      // 1. 呼叫腾讯云环境 (这里已经填好你的环境ID)
      const app = cloudbase.init({
        env: 'yanxue-app-d5gg8yx759d5e6070' 
      });

      // 2. 执行匿名授权登录 (敲门砖)
      const auth = app.auth();
      await auth.anonymousAuthProvider().signIn();

      // 3. 连接数据库，写入 survey_results 集合
      const db = app.database();
      await db.collection('survey_results').add(finalData);
      
      console.log("太棒了！数据已成功写入腾讯云数据库！");
      
      // 4. 数据安全落库后，再跳转到成功页
      setStep(3); 
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
      submitForm();
    }
  };

  const goFromChildToNext = () => {
    if (childConsent === true && Object.keys(childAnswers).length < data.childQuestions.length) {
      alert("请回答完所有的题目再提交哦！");
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
              <button onClick={goFromChildToNext} style={{ marginTop: '25px', width: '100%', padding: '16px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>提交测评，生成报告</button>
            )}
          </div>
        )}

        {step === 3 && (
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
                  src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=此处替换二维码" 
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

export default App;