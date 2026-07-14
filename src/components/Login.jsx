import React, { useState, useEffect } from 'react';
import { initFirebase, googleProvider, signInWithPopup } from '../firebase';
import { LogIn, Key, WifiOff, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Login({ onLoginSuccess, onStartLocalMode }) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [authDomain, setAuthDomain] = useState('');

  const checkFirebaseStatus = async () => {
    setChecking(true);
    try {
      const { auth } = await initFirebase();
      setFirebaseReady(!!auth);
    } catch (e) {
      console.error(e);
      setFirebaseReady(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkFirebaseStatus();
  }, []);

  const handleGoogleLogin = async () => {
    setChecking(true);
    try {
      const { auth } = await initFirebase();
      if (!auth) {
        setShowConfigModal(true);
        setChecking(false);
        return;
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      onLoginSuccess(user, false); 
    } catch (err) {
      console.error(err);
      alert('구글 로그인에 실패했습니다. Firebase 콘솔에서 Google 로그인이 켜져 있는지 확인해 주세요.');
    } finally {
      setChecking(false);
    }
  };

  const handleSaveManualConfig = async (e) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      alert('API Key와 Project ID는 필수입니다.');
      return;
    }

    const manualConfig = {
      apiKey,
      projectId,
      authDomain: authDomain || `${projectId}.firebaseapp.com`
    };

    localStorage.setItem('firebase_config', JSON.stringify(manualConfig));
    setShowConfigModal(false);
    
    await checkFirebaseStatus();
    alert('Firebase 설정이 저장되었습니다. 이제 다시 로그인 버튼을 눌러주세요.');
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>로그인 보안 세션을 준비하고 있습니다...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '36px 28px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
        
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <ShieldCheck size={32} />
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>우리집 가계부</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: '32px' }}>
          실시간 연동 및 동기화를 위한 보안 로그인 관문입니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleGoogleLogin}
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '14px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: '#4285F4',
              color: '#ffffff',
              border: 'none'
            }}
          >
            <LogIn size={18} />
            구글 계정으로 로그인 시작
          </button>

          <button 
            onClick={onStartLocalMode}
            className="btn btn-secondary"
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '14px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <WifiOff size={16} />
            로그인 없이 로컬 오프라인 사용
          </button>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px' }}>
          {firebaseReady ? (
            <>
              <CheckCircle2 size={13} style={{ color: 'var(--income-color)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>클라우드 엔진 동기화 준비 완료</span>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} style={{ color: 'var(--warning-color)' }} />
                로컬 환경: 구글 로그인을 위해 설정이 필요할 수 있습니다.
              </span>
              <button 
                onClick={() => setShowConfigModal(true)}
                style={{ color: 'var(--accent-color)', fontWeight: '700', textDecoration: 'underline', background: 'none', cursor: 'pointer', fontSize: '11px' }}
              >
                수동으로 설정 입력하기
              </button>
            </div>
          )}
        </div>

      </div>

      {showConfigModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '400px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={16} style={{ color: 'var(--accent-color)' }} />
                로컬 수동 Firebase 설정
              </h3>
              <button onClick={() => setShowConfigModal(false)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              배포된 서버(Hosting)가 아닌 로컬 개발 환경(localhost)에서 구글 로그인을 테스트하시려면 Firebase Config 정보를 1회 기입해주셔야 합니다.
            </p>

            <form onSubmit={handleSaveManualConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">API Key *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="AIzaSy..."
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Project ID *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={projectId} 
                  onChange={(e) => setProjectId(e.target.value)} 
                  placeholder="gagyeboo-32df9"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Auth Domain</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={authDomain} 
                  onChange={(e) => setAuthDomain(e.target.value)} 
                  placeholder="gagyeboo-32df9.firebaseapp.com"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                설정 적용 후 로그인 재시도
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
