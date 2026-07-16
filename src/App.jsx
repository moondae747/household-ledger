import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import FixedExpenseManager from './components/FixedExpenseManager';
import WalletManager from './components/WalletManager';
import PocketMoneyManager from './components/PocketMoneyManager';
import TodoManager from './components/TodoManager';
import Settings from './components/Settings';
import Login from './components/Login';
import CardValueManager from './components/CardValueManager';
import FloatingCalculator from './components/FloatingCalculator';
import { initFirebase, signOut } from './firebase';
import { dbService } from './dbService';
import { 
  LayoutDashboard, 
  FileText, 
  CalendarDays, 
  Wallet, 
  Settings as SettingsIcon, 
  Sun, 
  Moon,
  Smartphone,
  Monitor,
  Database,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState('');
  const [currentUser, setCurrentUser] = useState('영민');
  const [theme, setTheme] = useState('light');
  
  // 구글 로그인 보안 유저 객체 상태
  const [loginUser, setLoginUser] = useState(null);
  // 오프라인 로컬 모드로 시작했는지 여부
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [startDay, setStartDay] = useState(1);

  // 모바일 / PC 레이아웃 모드 상태 ('pc'가 기본)
  const [layoutMode, setLayoutMode] = useState('pc');

  // 대시보드에서 용돈 상세 기입장으로 전환 시 포커싱될 대상 ('영민' 또는 '아정')
  const [pocketMoneyTargetUser, setPocketMoneyTargetUser] = useState('영민');

  // ⚡ 로컬 데이터 마이그레이션 팝업 관련 상태
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationCount, setMigrationCount] = useState(0);
  const [migrating, setMigrating] = useState(false);

  // 현재 날짜 기준의 YYYY-MM 초기화
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${month}`);
  }, []);

  // 오프라인 모드 데이터 스캔
  const checkForLocalData = () => {
    try {
      const txs = JSON.parse(localStorage.getItem('ledger_transactions') || '[]');
      const incomes = JSON.parse(localStorage.getItem('ledger_incomes') || '[]');
      const fixed = JSON.parse(localStorage.getItem('ledger_fixed_expenses') || '[]');
      const pocket = JSON.parse(localStorage.getItem('ledger_pocket_money_transactions') || '[]');
      const todos = JSON.parse(localStorage.getItem('ledger_todos') || '[]');
      
      const totalCount = txs.length + incomes.length + fixed.length + pocket.length + todos.length;
      if (totalCount > 0) {
        setMigrationCount(totalCount);
        setShowMigrationModal(true);
      }
    } catch (e) {
      console.error('Error scanning local data:', e);
    }
  };

  // ⚡ Firebase Auth State 자동 로그인 세션 리스너 부착
  useEffect(() => {
    let unsubscribe = null;

    const setupAuth = async () => {
      setLoadingSession(true);
      
      // 1. 테마/레이아웃 로드
      const savedTheme = localStorage.getItem('app_theme') || 'light';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);

      const savedLayout = localStorage.getItem('app_layout_mode') || 'pc';
      setLayoutMode(savedLayout);

      // 2. 기본 기록 주체 정보 로드
      const savedUser = localStorage.getItem('current_user') || '영민';
      setCurrentUser(savedUser);

      // 3. Firebase Auth 리스너 바인딩
      const { auth } = await initFirebase();
      
      if (auth) {
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            const sessionData = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            };
            setLoginUser(sessionData);
            setIsLocalMode(false);
            localStorage.setItem('login_user', JSON.stringify(sessionData));
            localStorage.removeItem('local_mode_active');

            // 로그인 주체 이메일에 따라 영민/아정 및 상대방 이메일 상호 매핑 보정
            const email = user.email ? user.email.toLowerCase() : '';
            if (email === 'dlsrks4410@gmail.com') {
              setCurrentUser('영민');
              localStorage.setItem('current_user', '영민');
              localStorage.setItem('partner_email', 'sgcaj19@gmail.com');
            } else if (email === 'sgcaj19@gmail.com') {
              setCurrentUser('아정');
              localStorage.setItem('current_user', '아정');
              localStorage.setItem('partner_email', 'dlsrks4410@gmail.com');
            }

            // 구글 세션 연동 성공 직후 로컬 백업할 예전 모의 데이터가 남아있는지 스캔
            checkForLocalData();
            
            // ⚡ 세팅값 로드
            dbService.fetchSettings().then(settings => {
              setStartDay(settings.startDay || 1);
              setLoadingSession(false);
            });
          } else {
            const savedLocalFlag = localStorage.getItem('local_mode_active');
            if (savedLocalFlag === 'true') {
              setIsLocalMode(true);
            } else {
              setLoginUser(null);
              setIsLocalMode(false);
              localStorage.removeItem('login_user');
            }
            
            dbService.fetchSettings().then(settings => {
              setStartDay(settings.startDay || 1);
              setLoadingSession(false);
            });
          }
        });
      } else {
        const savedLocalFlag = localStorage.getItem('local_mode_active');
        if (savedLocalFlag === 'true') {
          setIsLocalMode(true);
        }
        setLoadingSession(false);
      }
    };

    setupAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const toggleLayoutMode = () => {
    const nextLayout = layoutMode === 'pc' ? 'mobile' : 'pc';
    setLayoutMode(nextLayout);
    localStorage.setItem('app_layout_mode', nextLayout);
  };

  const handleSetCurrentUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', user);
  };

  // 구글 로그인 성공 콜백
  const handleLoginSuccess = (user) => {
    const email = user.email ? user.email.toLowerCase() : '';
    let mappedUser = currentUser;
    
    if (email === 'dlsrks4410@gmail.com') {
      mappedUser = '영민';
      localStorage.setItem('partner_email', 'sgcaj19@gmail.com');
    } else if (email === 'sgcaj19@gmail.com') {
      mappedUser = '아정';
      localStorage.setItem('partner_email', 'dlsrks4410@gmail.com');
    }
    
    setCurrentUser(mappedUser);
    localStorage.setItem('current_user', mappedUser);

    const sessionData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
    setLoginUser(sessionData);
    setIsLocalMode(false);
    localStorage.setItem('login_user', JSON.stringify(sessionData));
    localStorage.removeItem('local_mode_active');
    
    // 로컬 데이터 감지 작동
    checkForLocalData();
    setActiveNav('dashboard');
  };

  // 로컬 오프라인 시작 분기
  const handleStartLocalMode = () => {
    setIsLocalMode(true);
    setLoginUser(null);
    localStorage.setItem('local_mode_active', 'true');
    localStorage.removeItem('login_user');
    setActiveNav('dashboard');
  };

  // 구글 로그아웃 처리
  const handleLogout = async () => {
    if (confirm('구글 보안 세션을 로그아웃하고 첫 화면으로 돌아가시겠습니까?')) {
      try {
        const { auth } = await initFirebase();
        if (auth) {
          await signOut(auth);
        }
      } catch (e) {
        console.error('Error during firebase signout:', e);
      }
      setLoginUser(null);
      setIsLocalMode(false);
      localStorage.removeItem('login_user');
      localStorage.removeItem('local_mode_active');
      window.location.reload();
    }
  };

  // ⚡ 로컬 데이터 마이그레이션 실행 함수
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const email = loginUser.email.toLowerCase();
      const partner = (localStorage.getItem('partner_email') || '').trim().toLowerCase();
      const sorted = partner ? [email, partner].sort() : [email];
      const gId = sorted.length > 1 ? `${sorted[0]}__${sorted[1]}` : email;

      const success = await dbService.migrateLocalDataToCloud(gId);
      if (success) {
        alert(`기존 로컬 작성 내역 총 ${migrationCount}건이 구글 클라우드로 안전하게 이전 완료되었습니다!`);
        setShowMigrationModal(false);
        window.location.reload();
      } else {
        alert('데이터베이스 연결 실패로 인해 병합이 중단되었습니다. Firebase 콘솔에서 Firestore Database가 개설(생성)되어 있는지 확인해 주십시오. (이전 데이터는 유실되지 않고 기기 브라우저에 100% 그대로 안전하게 보관되어 있습니다.)');
      }
    } catch (e) {
      console.error(e);
      alert('데이터 병합 중 오류가 발생했습니다. 구글 Firebase Console에서 Firestore Database가 개설(생성)되어 활성화되어 있는지 꼭 확인해 주십시오. (이전 데이터는 손상되지 않고 기기 브라우저에 안전하게 보관되어 있습니다.)');
    } finally {
      setMigrating(false);
    }
  };

  // 홈에서 특정 유저의 용돈 기입장으로 점프하는 함수
  const navigateToPocketMoney = (targetUser) => {
    setPocketMoneyTargetUser(targetUser);
    setActiveNav('pocket-money');
  };

  // 컴포넌트 렌더러
  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <Dashboard 
            currentMonth={currentMonth} 
            setCurrentMonth={setCurrentMonth} 
            currentUser={currentUser}
            onNavigatePocketMoney={navigateToPocketMoney}
            startDay={startDay}
          />
        );
      case 'transactions':
        return (
          <TransactionList 
            currentMonth={currentMonth} 
            setCurrentMonth={setCurrentMonth}
            currentUser={currentUser} 
            startDay={startDay}
          />
        );
      case 'fixed-expenses':
        return (
          <FixedExpenseManager 
            currentUser={currentUser} 
          />
        );
      case 'wallets':
        return (
          <WalletManager />
        );
      case 'card-bills':
        return (
          <CardValueManager 
            currentMonth={currentMonth}
            startDay={startDay}
          />
        );
      case 'pocket-money':
        return (
          <PocketMoneyManager 
            currentMonth={currentMonth}
            initialTargetUser={pocketMoneyTargetUser}
            startDay={startDay}
          />
        );
      case 'settings':
        return (
          <Settings 
            theme={theme} 
            toggleTheme={toggleTheme} 
            currentUser={currentUser} 
            setCurrentUser={handleSetCurrentUser} 
            loginUser={loginUser}
            onLogout={handleLogout}
            startDay={startDay}
            setStartDay={setStartDay}
          />
        );
      case 'todos':
        return (
          <TodoManager 
            currentMonth={currentMonth}
            startDay={startDay}
            currentUser={currentUser}
          />
        );
      default:
        return (
          <Dashboard 
            currentMonth={currentMonth} 
            setCurrentMonth={setCurrentMonth} 
            currentUser={currentUser} 
            onNavigatePocketMoney={navigateToPocketMoney} 
            startDay={startDay}
          />
        );
    }
  };

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>가계부 구글 자동 로그인 복구 중...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!loginUser && !isLocalMode) {
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess}
        onStartLocalMode={handleStartLocalMode}
      />
    );
  }

  return (
    <div className={`app-container ${layoutMode === 'mobile' ? 'mobile-mode' : ''}`}>
      <header className="app-header">
        <h1 className="app-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          🏡 우리집 가계부
          <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-secondary)' }}>
            기록자: {currentUser}
          </span>
          {loginUser && (
            <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 10px', backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent-color)', borderRadius: '20px', color: 'var(--accent-color)' }}>
              연동됨
            </span>
          )}
        </h1>
        
        <div className="header-right">
          <nav className="header-nav">
            <div 
              className={`nav-tab-item ${activeNav === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveNav('dashboard')}
            >
              홈
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveNav('transactions')}
            >
              가계부 내역
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'pocket-money' ? 'active' : ''}`}
              onClick={() => {
                setPocketMoneyTargetUser(currentUser === '공동' ? '영민' : currentUser);
                setActiveNav('pocket-money');
              }}
            >
              용돈 관리
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'fixed-expenses' ? 'active' : ''}`}
              onClick={() => setActiveNav('fixed-expenses')}
            >
              고정비 설정
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'wallets' ? 'active' : ''}`}
              onClick={() => setActiveNav('wallets')}
            >
              지갑 관리
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'card-bills' ? 'active' : ''}`}
              onClick={() => setActiveNav('card-bills')}
            >
              카드값 관리
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'todos' ? 'active' : ''}`}
              onClick={() => setActiveNav('todos')}
            >
              일별 할일
            </div>
            <div 
              className={`nav-tab-item ${activeNav === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveNav('settings')}
            >
              설정
            </div>
          </nav>

          <div className="header-controls" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button 
              className="theme-toggle refresh-btn-mobile" 
              onClick={() => window.location.reload()} 
              title="가계부 새로고침"
              style={{ padding: '0 10px', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={15} style={{ marginRight: '4px' }} />
              <span style={{ fontSize: '11px', fontWeight: '700' }}>새로고침</span>
            </button>

            <button 
              className="theme-toggle" 
              onClick={toggleLayoutMode} 
              title={layoutMode === 'pc' ? '모바일 레이아웃으로 보기' : 'PC 레이아웃으로 보기'}
              style={{ gap: '4px', padding: '0 8px', width: 'auto', fontSize: '11px', fontWeight: '600' }}
            >
              {layoutMode === 'pc' ? (
                <>
                  <Smartphone size={14} /> 모바일 뷰
                </>
              ) : (
                <>
                  <Monitor size={14} /> PC 뷰
                </>
              )}
            </button>

            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {currentMonth ? renderContent() : <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>}
      </main>

      {/* ⚡ 로컬 데이터 구글 클라우드 병합 모달 팝업 */}
      {showMigrationModal && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet" style={{ width: '460px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Database size={28} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>이전 작성 데이터 병합 알림</h3>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
              로그인하기 전 브라우저(오프라인 모드)에 작성해 두셨던 소중한 가계부 내역 **총 {migrationCount}건**이 로컬 저장소에서 발견되었습니다.<br />
              이 데이터를 새로 로그인하신 구글 공동 가계부 계정으로 병합하시겠습니까?
            </p>

            {migrating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-color)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>구글 클라우드로 데이터를 전송하고 있습니다...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  onClick={handleMigrate}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                >
                  예, 구글 계정으로 데이터 병합하기
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => {
                      if (confirm('오프라인 데이터를 업로드하지 않고 삭제하시겠습니까? 이 작업은 복구할 수 없습니다.')) {
                        localStorage.removeItem('ledger_transactions');
                        localStorage.removeItem('ledger_incomes');
                        localStorage.removeItem('ledger_fixed_expenses');
                        localStorage.removeItem('ledger_pocket_money_transactions');
                        setShowMigrationModal(false);
                        alert('로컬 데이터가 완전히 지워졌습니다.');
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, color: 'var(--expense-color)', borderColor: 'var(--expense-color)', padding: '10px', fontSize: '12px' }}
                  >
                    로컬 데이터 삭제하기
                  </button>
                  <button 
                    onClick={() => setShowMigrationModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                  >
                    그냥 닫기
                  </button>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: '6px', textAlign: 'left' }}>
              <AlertTriangle size={14} style={{ color: 'var(--warning-color)', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                주의: 병합을 위해서는 구글 Firebase 콘솔에서 **Firestore Database가 생성(활성화)**되어 있어야 정상 동작합니다. 생성되지 않았다면 오류 팝업이 발생할 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 계산기 */}
      <FloatingCalculator />

    </div>
  );
}
