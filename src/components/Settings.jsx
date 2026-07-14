import React, { useState, useEffect } from 'react';
import { clearFirebaseConfig } from '../firebase';
import { dbService } from '../dbService';
import { Shield, Database, User, Moon, Sun, Trash2, LogOut, CheckCircle2, UserPlus, HelpCircle } from 'lucide-react';

export default function Settings({ 
  theme, 
  toggleTheme, 
  currentUser, 
  setCurrentUser, 
  loginUser, 
  onLogout,
  startDay,
  setStartDay
}) {
  const [partnerEmail, setPartnerEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  useEffect(() => {
    const savedPartner = localStorage.getItem('partner_email') || '';
    setPartnerEmail(savedPartner);

    const loadSettings = async () => {
      setLoadingSettings(true);
      try {
        const settings = await dbService.fetchSettings();
        setStartDay(settings.startDay || 1);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  const handleSavePartnerEmail = (e) => {
    e.preventDefault();
    localStorage.setItem('partner_email', partnerEmail.trim().toLowerCase());
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      alert('상대방 이메일 연동 정보가 저장되었습니다! 동기화 채널이 자동 갱신됩니다.');
      window.location.reload();
    }, 1000);
  };

  const handleSaveStartDay = async (dayVal) => {
    const S = parseInt(dayVal, 10);
    setStartDay(S);
    try {
      await dbService.updateSettings({ startDay: S });
      alert(`가계부 시작일이 매월 ${S}일로 변경되었습니다! 이에 맞춰 모든 장부의 집계 및 마감 누계가 실시간 적용됩니다.`);
    } catch (e) {
      console.error(e);
      alert('시작일 저장에 실패했습니다.');
    }
  };

  const handleClearLocalData = () => {
    if (confirm('경고! 로컬에 저장된 모든 모의 가계부 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('ledger_incomes');
      localStorage.removeItem('ledger_transactions');
      localStorage.removeItem('ledger_fixed_expenses');
      localStorage.removeItem('ledger_wallets');
      localStorage.removeItem('ledger_pocket_money_transactions');
      alert('데이터가 초기화되었습니다. 새로고침합니다.');
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>설정</h2>

      {loginUser ? (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
          <div className="card-title">
            <span><Shield size={18} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />구글 로그인 보안 세션</span>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--expense-color)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onLogout}>
              <LogOut size={12} /> 로그아웃
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontSize: '14px', fontWeight: '700' }}>{loginUser.displayName || '구글 사용자'}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>이메일: {loginUser.email}</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderLeft: '4px solid var(--warning-color)' }}>
          <div className="card-title">
            <span><Shield size={18} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--warning-color)' }} />가계부 세션 정보</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            현재 오프라인 로컬 모드로 작동 중입니다. 데이터 동기화를 원하시면 구글 계정으로 로그인해주세요.
          </p>
        </div>
      )}

      {loginUser && (
        <div className="card">
          <div className="card-title">
            <span><UserPlus size={18} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />부부 공동 동기화 연동</span>
            <span className="badge income" style={{ fontSize: '10px' }}>실시간 연동 패널</span>
          </div>
          
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
            부부가 각자의 구글 계정으로 로그인한 상태에서 데이터를 실시간으로 완벽하게 연동하기 위해 **상대방의 구글 이메일 주소**를 기입해 주십시오. 
            (양쪽 기기에서 서로의 이메일을 동일하게 지목하면 암호화된 가계부 채널이 자동 공유됩니다.)
          </p>

          <form onSubmit={handleSavePartnerEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">상대방 구글 이메일 주소</label>
              <input 
                type="email" 
                className="form-input" 
                value={partnerEmail} 
                onChange={(e) => setPartnerEmail(e.target.value)} 
                placeholder="예: ajeong@gmail.com"
                required
              />
            </div>

            {saveSuccess && (
              <div style={{ color: 'var(--income-color)', fontSize: '12px', textAlign: 'center', fontWeight: '600' }}>
                동기화 채널을 갱신 중입니다...
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
              공동 채널 연동 및 저장
            </button>
          </form>

          <div style={{ marginTop: '16px', backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <HelpCircle size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>작동 원리:</strong> 본인의 이메일 `{loginUser.email}`과 입력하신 상대방 이메일 `{partnerEmail || '(미지정)'}`을 오름차순 결합하여 두 분만의 고유 보안 ID를 구성합니다. 이 정보에 기반해 타인에게 보이지 않는 독립 장부가 개설됩니다.
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span><Database size={18} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />가계부 시작일 설정</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
          매월 지정된 일자가 되면 이전 한 달의 장부를 마감(초기화)하고 0원부터 깨끗하게 새 회계 월(Billing Month) 지출/수입 누계를 시작합니다. (예: 급여일 25일 설정 시, 25일부터 다음 달 24일까지 한 달로 집계)
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>매월 시작일 선택</label>
          <select 
            className="form-select" 
            value={startDay} 
            onChange={(e) => handleSaveStartDay(e.target.value)}
            disabled={loadingSettings}
            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><User size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />기본 기록자 설정</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          내역 입력 시 기본 작성자로 기입될 사용자입니다. 클릭하여 전환하세요.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${currentUser === '영민' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => setCurrentUser('영민')}
          >
            영민
          </button>
          <button 
            className={`btn ${currentUser === '아정' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => setCurrentUser('아정')}
          >
            아정
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>{theme === 'dark' ? <Moon size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> : <Sun size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}화면 테마 설정</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>현재 모드: {theme === 'dark' ? '다크 모드' : '라이트 모드'}</span>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            테마 전환
          </button>
        </div>
      </div>

      {!loginUser && (
        <div className="card">
          <div className="card-title">
            <span><Trash2 size={18} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--expense-color)' }} />로컬 가계부 데이터 초기화</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            로컬 모드에서 사용된 데이터를 모두 초기화하고 초기 상태로 되돌립니다.
          </p>
          <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--expense-color)', borderColor: 'var(--expense-color)' }} onClick={handleClearLocalData}>
            로컬 데이터 완전 삭제
          </button>
        </div>
      )}
    </div>
  );
}
