import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { runFixedExpensesAutomation } from '../utils/automation';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Users, User, Heart, Sparkles, CalendarDays, ExternalLink } from 'lucide-react';

export default function Dashboard({ currentMonth, setCurrentMonth, currentUser, onNavigatePocketMoney, startDay }) {
  const [incomes, setIncomes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [youngminPmSpent, setYoungminPmSpent] = useState(0);
  const [ajeongPmSpent, setAjeongPmSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoMessage, setAutoMessage] = useState('');

  // 용돈 한도
  const budgetLimits = {
    '영민': 300000,
    '아정': 400000
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. 단 하나의 병렬 Promise.all로 필요한 가계부 기초 데이터 일괄 초고속 렌더링 준비
      const [
        fetchedIncomes, 
        fetchedTransactions, 
        fetchedWallets, 
        fetchedFixed,
        ymPmTx,
        ajPmTx
      ] = await Promise.all([
        dbService.fetchIncomes(currentMonth, startDay),
        dbService.fetchTransactions(currentMonth, startDay),
        dbService.fetchWallets(),
        dbService.fetchFixedExpenses(),
        dbService.fetchPocketMoneyTransactions(currentMonth, '영민', startDay),
        dbService.fetchPocketMoneyTransactions(currentMonth, '아정', startDay)
      ]);

      // 화면에 데이터를 빠르게 렌더링하기 위해 1차 세팅 진행
      setIncomes(fetchedIncomes);
      setTransactions(fetchedTransactions);
      setWallets(fetchedWallets);
      setFixedExpenses(fetchedFixed);
      setYoungminPmSpent(ymPmTx.reduce((sum, t) => sum + t.amount, 0));
      setAjeongPmSpent(ajPmTx.reduce((sum, t) => sum + t.amount, 0));
      setLoading(false); // 가계부 로딩창 즉시 종료

      // 2. 렌더링이 완료된 후, 백그라운드 비동기로 고정 입출금 자동화 스케줄러 실행
      const automated = await runFixedExpensesAutomation(
        currentMonth, 
        fetchedFixed, 
        fetchedTransactions, 
        fetchedIncomes
      );

      if (automated.length > 0) {
        setAutoMessage(`고정 지출 및 수입 ${automated.length}건이 이번 달 내역에 자동 등록되었습니다.`);
        
        // 새로 추가된 고정 항목이 있다면 장부 상태만 조용히 갱신
        const [nextTxs, nextIncs] = await Promise.all([
          dbService.fetchTransactions(currentMonth, startDay),
          dbService.fetchIncomes(currentMonth, startDay)
        ]);
        setTransactions(nextTxs);
        setIncomes(nextIncs);
        
        setTimeout(() => setAutoMessage(''), 5000);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonth, startDay]);

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  // 1. 총 수입 계산
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);

  // 2. 총 지출 계산 (단순 지갑 충전(wallet_charge)거래만 전체 예산 계산에서 필터 제외하며, 지역화폐 결제사용은 총 지출에 정상 합산)
  const totalExpense = transactions
    .filter(t => t.type !== 'wallet_charge')
    .reduce((sum, t) => sum + t.amount, 0);

  // 3. 순수 잔액
  const balance = totalIncome - totalExpense;

  // 4. 공과금 고정지출 합계 (지갑충전을 제외한 순수 고정 지출 합산)
  const fixedExpenseTotal = transactions
    .filter(t => t.category === '공과금 및 고정지출' && t.type !== 'wallet_charge')
    .reduce((sum, t) => sum + t.amount, 0);

  // 월 이동
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setCurrentMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setCurrentMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const [year, month] = currentMonth.split('-');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>가계부 불러오는 중...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 대시보드 상단 컨트롤러 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handlePrevMonth} className="theme-toggle" style={{ width: '32px', height: '32px' }}>
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>{year}년 {parseInt(month)}월 가계 현황</h2>
          <button onClick={handleNextMonth} className="theme-toggle" style={{ width: '32px', height: '32px' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {autoMessage && (
          <div style={{
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent-color)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={14} /> {autoMessage}
          </div>
        )}
      </div>

      {/* PC 친화적 좌우 분할 2단 대시보드 그리드 */}
      <div className="dashboard-grid">
        
        {/* 왼쪽 컬럼: 금액 요약 및 지갑 정보 */}
        <div className="dashboard-column">
          
          {/* 수입/지출/잔액 한눈에 보기 카드 */}
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)', 
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>이번 달 남은 잔액</span>
              <h1 style={{ fontSize: '38px', fontWeight: '800', marginTop: '6px', letterSpacing: '-0.8px', color: balance >= 0 ? 'var(--text-primary)' : 'var(--expense-color)' }}>
                {formatWon(balance)}
              </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  <TrendingUp size={15} style={{ color: 'var(--income-color)' }} /> 수입 합계
                </span>
                <span className="amount income" style={{ fontSize: '20px', fontWeight: '700', display: 'block', marginTop: '6px' }}>
                  {formatWon(totalIncome)}
                </span>
              </div>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  <TrendingDown size={15} style={{ color: 'var(--expense-color)' }} /> 지출 합계
                </span>
                <span className="amount expense" style={{ fontSize: '20px', fontWeight: '700', display: 'block', marginTop: '6px' }}>
                  {formatWon(totalExpense)}
                </span>
              </div>
            </div>
            
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '-8px' }}>
              * 용돈 세부 지출 및 단순 지갑 충전액은 총 지출에서 자동 제외됩니다.
            </span>
          </div>

          {/* 지역화폐 및 페이 실시간 잔액 카드 */}
          <div className="card">
            <div className="card-title">
              <span><Wallet size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />지역화폐 & 페이 잔고</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '8px' }}>
              {wallets.map(w => (
                <div key={w.id} style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{w.name}</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {formatWon(w.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 오른쪽 컬럼: 용돈 게이지 및 공과금 정보 */}
        <div className="dashboard-column">
          
          {/* 부부 개별 용돈 카드 */}
          <div className="card">
            <div className="card-title">
              <span><Users size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />개인 용돈 사용 현황 (클릭 시 기입장으로 이동)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '6px' }}>
              {/* 영민 용돈 */}
              <div 
                onClick={() => onNavigatePocketMoney('영민')}
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)'
                }}
                className="list-item-hover"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={16} /> 영민 용돈
                  </span>
                  <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {formatWon(youngminPmSpent)} / <span style={{ color: 'var(--text-secondary)' }}>{formatWon(budgetLimits['영민'])}</span>
                    <ExternalLink size={12} style={{ marginLeft: '4px', color: 'var(--text-tertiary)' }} />
                  </span>
                </div>
                <div className="progress-bar-container" style={{ height: '8px' }}>
                  <div 
                    className="progress-bar" 
                    style={{ 
                      width: `${Math.min((youngminPmSpent / budgetLimits['영민']) * 100, 100)}%`,
                      backgroundColor: youngminPmSpent > budgetLimits['영민'] ? 'var(--expense-color)' : 'var(--accent-color)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  <span>사용율: {((youngminPmSpent / budgetLimits['영민']) * 100).toFixed(0)}%</span>
                  {youngminPmSpent > budgetLimits['영민'] ? (
                    <span style={{ color: 'var(--expense-color)', fontWeight: '600' }}>한도 초과: -{formatWon(youngminPmSpent - budgetLimits['영민'])}</span>
                  ) : (
                    <span>남은 용돈: {formatWon(budgetLimits['영민'] - youngminPmSpent)}</span>
                  )}
                </div>
              </div>

              {/* 아정 용돈 */}
              <div 
                onClick={() => onNavigatePocketMoney('아정')}
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)'
                }}
                className="list-item-hover"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Heart size={16} style={{ color: 'var(--expense-color)' }} /> 아정 용돈
                  </span>
                  <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {formatWon(ajeongPmSpent)} / <span style={{ color: 'var(--text-secondary)' }}>{formatWon(budgetLimits['아정'])}</span>
                    <ExternalLink size={12} style={{ marginLeft: '4px', color: 'var(--text-tertiary)' }} />
                  </span>
                </div>
                <div className="progress-bar-container" style={{ height: '8px' }}>
                  <div 
                    className="progress-bar" 
                    style={{ 
                      width: `${Math.min((ajeongPmSpent / budgetLimits['아정']) * 100, 100)}%`,
                      backgroundColor: ajeongPmSpent > budgetLimits['아정'] ? 'var(--expense-color)' : 'var(--accent-color)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  <span>사용율: {((ajeongPmSpent / budgetLimits['아정']) * 100).toFixed(0)}%</span>
                  {ajeongPmSpent > budgetLimits['아정'] ? (
                    <span style={{ color: 'var(--expense-color)', fontWeight: '600' }}>한도 초과: -{formatWon(ajeongPmSpent - budgetLimits['아정'])}</span>
                  ) : (
                    <span>남은 용돈: {formatWon(budgetLimits['아정'] - ajeongPmSpent)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 고정 지출 납부 현황 */}
          <div className="card">
            <div className="card-title">
              <span><CalendarDays size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-color)' }} />이번 달 고정 지출 납부 요약</span>
              <span className="badge expense" style={{ fontSize: '11px' }}>
                Refreshed
              </span>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              공과금, 렌탈료, 주택 대출 등 매달 반복되는 고정비입니다. 
              등록된 고정비 목록 총 {fixedExpenses.length}개 중 이체일이 도래한 항목들이 안전하게 자동 반영되었습니다. 자세한 예정일은 고정비 캘린더를 참조하세요.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
