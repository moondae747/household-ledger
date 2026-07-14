import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { ChevronLeft, ChevronRight, CreditCard, Check, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export default function CardValueManager({ currentMonth, startDay }) {
  const [billMonth, setBillMonth] = useState(currentMonth); // 청구년월 (YYYY-MM)
  const [transactions, setTransactions] = useState([]);
  const [cardBills, setCardBills] = useState([]); // DB에 기록된 결제 완료 및 조정 금액 정보
  const [loading, setLoading] = useState(true);

  // 수동 조정 금액 상태 (카드사명 -> 조정금액 입력값)
  const [adjustments, setAdjustments] = useState({
    '우리카드': '',
    '현대카드': '',
    '삼성카드': ''
  });

  const loadCardData = async () => {
    setLoading(true);
    try {
      // 1. 전체 기간 지출 조회를 위해 충분히 넓은 범위로 트랜잭션을 로드 (전전월 ~ 당월)
      // fetchTransactions가 특정 한달치만 가져오므로, 청구월 기준 전전월(m-2)부터 당월(m)까지의 데이터를 모두 모으기 위해
      // 청구년월 기준 전전월, 전월, 당월의 지출 내역을 함께 fetch하여 병합합니다.
      const [y, m] = billMonth.split('-').map(Number);
      
      const d0 = new Date(y, m - 1, 1); // 당월
      const d1 = new Date(y, m - 2, 1); // 전월
      const d2 = new Date(y, m - 3, 1); // 전전월

      const formatYM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const [txs0, txs1, txs2, bills] = await Promise.all([
        dbService.fetchTransactions(formatYM(d0), startDay),
        dbService.fetchTransactions(formatYM(d1), startDay),
        dbService.fetchTransactions(formatYM(d2), startDay),
        dbService.fetchCardBills(billMonth)
      ]);

      // 중복 방지 병합
      const mergedTxs = [];
      const txIds = new Set();
      [...txs0, ...txs1, ...txs2].forEach(t => {
        if (!txIds.has(t.id)) {
          txIds.add(t.id);
          mergedTxs.push(t);
        }
      });

      setTransactions(mergedTxs);
      setCardBills(bills);

      // DB 저장된 조정 금액 필드를 input 창에 반영
      const newAdjusts = { '우리카드': '', '현대카드': '', '삼성카드': '' };
      bills.forEach(b => {
        if (b.adjustment !== undefined) {
          newAdjusts[b.cardName] = b.adjustment === 0 ? '' : b.adjustment.toString();
        }
      });
      setAdjustments(newAdjusts);

    } catch (e) {
      console.error('카드값 로드 중 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCardData();
  }, [billMonth, startDay]);

  const handlePrevMonth = () => {
    const [y, m] = billMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setBillMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = billMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setBillMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // --- 📅 카드사별 이용 기간 계산 헬퍼 ---
  const getCardPeriod = (cardName) => {
    const [y, m] = billMonth.split('-').map(Number);
    
    if (cardName === '삼성카드') {
      // 13일 결제일: 전전월 30일 ~ 전월 29일
      const dPrev2 = new Date(y, m - 3, 1);
      const dPrev = new Date(y, m - 2, 1);
      
      const prev2YM = `${dPrev2.getFullYear()}-${String(dPrev2.getMonth() + 1).padStart(2, '0')}`;
      const prevYM = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}`;
      
      return {
        startDate: `${prev2YM}-30`,
        endDate: `${prevYM}-29`,
        paymentDate: `${y}-${String(m).padStart(2, '0')}-13`
      };
    } else {
      // 우리카드 / 현대카드 (말일 결제): 전월 17일 ~ 당월 16일
      const dPrev = new Date(y, m - 2, 1);
      const prevYM = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}`;
      const currentYM = `${y}-${String(m).padStart(2, '0')}`;
      
      // 결제 예정일 (말일 계산)
      const lastDay = new Date(y, m, 0).getDate();
      
      return {
        startDate: `${prevYM}-17`,
        endDate: `${currentYM}-16`,
        paymentDate: `${currentYM}-${lastDay}`
      };
    }
  };

  // --- 💰 카드사별 내역 필터링 및 합계 집계 ---
  const getCardDetails = (cardName) => {
    const period = getCardPeriod(cardName);
    
    // 결제수단명이 카드사명과 일치하고 날짜가 이용기간 범위 내에 있는 거래 필터
    const details = transactions.filter(t => {
      return t.method === cardName && 
             t.date >= period.startDate && 
             t.date <= period.endDate && 
             t.type !== 'wallet_charge';
    }).sort((a, b) => a.date.localeCompare(b.date));

    const totalUsed = details.reduce((sum, t) => sum + t.amount, 0);

    // DB에 기록된 조정 금액 및 결제 완료 여부 매핑
    const billRecord = cardBills.find(b => b.cardName === cardName) || {};
    const isPaid = billRecord.isPaid || false;
    const adjustment = billRecord.adjustment || 0;
    
    const finalAmount = totalUsed + adjustment;

    return {
      details,
      totalUsed,
      adjustment,
      finalAmount,
      isPaid,
      period
    };
  };

  // --- ⚡ 정산 완료 토글 기능 ---
  const handleTogglePaid = async (cardName, currentStatus) => {
    try {
      setLoading(true);
      const targetRecord = cardBills.find(b => b.cardName === cardName) || {};
      const newPaid = !currentStatus;
      
      // 조정 금액도 함께 보존하여 전달
      const curAdjust = adjustments[cardName] ? parseInt(adjustments[cardName].replace(/,/g, ''), 10) : 0;

      await dbService.updateCardBillStatus(cardName, billMonth, newPaid);
      // DB 직접 업데이트 후 재로딩
      await loadCardData();
    } catch (e) {
      console.error(e);
      alert('정산 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- ✏️ 수동 조정 금액 저장 기능 ---
  const handleSaveAdjustment = async (cardName) => {
    const rawVal = adjustments[cardName].replace(/,/g, '');
    const numVal = rawVal === '' ? 0 : parseInt(rawVal, 10);
    
    if (isNaN(numVal)) {
      alert('올바른 금액 숫자를 입력해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const billRecord = cardBills.find(b => b.cardName === cardName) || {};
      const isPaid = billRecord.isPaid || false;

      // dbService를 확장하여 조정금액 필드도 함께 받도록 처리
      // updateCardBillStatus API 에 adjustment 필드도 함께 전달해 줍니다. (dbService에서 updateDoc payload 합본 처리됨)
      const representativeGroupId = dbService.getGroupId();
      const db = dbService.getDb();
      
      const payload = {
        cardName,
        billMonth,
        isPaid,
        adjustment: numVal,
        updatedAt: new Date().toISOString()
      };

      if (dbService.isFirebaseEnabled() && representativeGroupId && db) {
        const { query, collection, where, getDocs, updateDoc, doc, addDoc } = await import('firebase/firestore');
        const q = query(
          collection(db, 'cardBills'),
          where('groupId', '==', representativeGroupId),
          where('cardName', '==', cardName),
          where('billMonth', '==', billMonth)
        );
        const snapshot = await getDocs(q);
        const fullPayload = { ...payload, groupId: representativeGroupId };

        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          await updateDoc(doc(db, 'cardBills', docId), fullPayload);
        } else {
          await addDoc(collection(db, 'cardBills'), fullPayload);
        }
      } else {
        // Fallback
        const list = dbService.mockDb.get('ledger_card_bills') || [];
        const idx = list.findIndex(bill => bill.cardName === cardName && bill.billMonth === billMonth);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...payload };
        } else {
          list.push({ id: 'bill_' + Date.now(), ...payload });
        }
        dbService.mockDb.set('ledger_card_bills', list);
      }

      await loadCardData();
      alert(`'${cardName}' 조정 금액(${numVal.toLocaleString()}원)이 저장되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('조정 금액 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  const cardsList = ['우리카드', '현대카드', '삼성카드'];
  const cardSummary = cardsList.map(c => ({ name: c, ...getCardDetails(c) }));
  
  const grandTotal = cardSummary.reduce((sum, item) => sum + item.finalAmount, 0);
  const paidTotal = cardSummary.filter(item => item.isPaid).reduce((sum, item) => sum + item.finalAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 📅 청구월 선택 꺽쇠 컨트롤러 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px' }}>
            <button onClick={handlePrevMonth} className="theme-toggle" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'Outfit', minWidth: '90px', textAlign: 'center', color: 'var(--text-primary)' }}>
              {billMonth.split('-')[0]}년 {parseInt(billMonth.split('-')[1])}월
            </span>
            <button onClick={handleNextMonth} className="theme-toggle" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>신용카드 청구값 명세서 (연동 관리판)</h2>
          </div>
        </div>

        <button 
          onClick={loadCardData}
          className="theme-toggle" 
          title="새로고침"
          style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* 📊 총 카드값 대시보드 카드 */}
      <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)', borderLeft: '4px solid var(--accent-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase' }}>이번 달 청구 총 합산액</span>
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px' }}>
              {formatWon(grandTotal)}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: 'var(--income-color)', fontWeight: '700' }}>정산 완료 금액</span>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--income-color)', marginTop: '2px' }}>
                {formatWon(paidTotal)}
              </p>
            </div>
            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <span style={{ fontSize: '10px', color: 'var(--expense-color)', fontWeight: '700' }}>정산 대기 금액</span>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--expense-color)', marginTop: '2px' }}>
                {formatWon(grandTotal - paidTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3대 카드사별 세부 구역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cardSummary.map(card => {
          return (
            <div 
              key={card.name} 
              className="card" 
              style={{ 
                padding: 0, 
                opacity: card.isPaid ? 0.75 : 1, 
                border: card.isPaid ? '1px solid var(--income-color)' : '1px solid var(--border-color)',
                transition: 'opacity 0.2s, border-color 0.2s'
              }}
            >
              {/* 카드사 헤더 */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '14px 18px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderBottom: '1px solid var(--border-color)' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: 'var(--radius-sm)', 
                    backgroundColor: card.name === '삼성카드' ? '#2b509d' : card.name === '우리카드' ? '#007bc3' : '#1d1d1f',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{card.name}</h3>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      📅 이용 기간: {card.period.startDate} ~ {card.period.endDate} (결제예정일: 매월 {card.name === '삼성카드' ? '13일' : '말일'})
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {card.isPaid ? (
                    <span 
                      onClick={() => handleTogglePaid(card.name, card.isPaid)}
                      style={{ 
                        backgroundColor: 'var(--income-light)', 
                        color: 'var(--income-color)', 
                        fontSize: '11px', 
                        fontWeight: '800', 
                        padding: '4px 10px', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check size={12} /> 정산 완료 (클릭 취소)
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTogglePaid(card.name, card.isPaid)}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      정산 대기 (완료 체크)
                    </button>
                  )}
                </div>
              </div>

              {/* 금액 정보 요약 바 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>자동 집계 금액</span>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{formatWon(card.totalUsed)}</p>
                </div>
                
                {/* 수동 조정 금액 인풋 */}
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    수동 조정 금액
                  </span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={adjustments[card.name]} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9-]/g, ''); // 음수 수수료 대응
                        setAdjustments(prev => ({ ...prev, [card.name]: val }));
                      }}
                      placeholder="예: 50,000"
                      style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '28px', marginBottom: 0 }}
                    />
                    <button 
                      onClick={() => handleSaveAdjustment(card.name)}
                      style={{ 
                        height: '28px', 
                        padding: '0 8px', 
                        fontSize: '11px', 
                        backgroundColor: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                      }}
                    >
                      적용
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--accent-color)', fontWeight: '700' }}>최종 청구 예정액</span>
                  <p style={{ fontSize: '17px', fontWeight: '850', color: 'var(--accent-color)', marginTop: '2px' }}>
                    {formatWon(card.finalAmount)}
                  </p>
                </div>
              </div>

              {/* 지출 내역 명세표 */}
              <div style={{ padding: '0px 18px 18px 18px', marginTop: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>이용 기간 청구 집계 내역 ({card.details.length}건)</span>
                
                <div style={{ overflowX: 'auto', marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <table className="excel-table expanded" style={{ width: '100%', minWidth: '800px', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>날짜</th>
                        <th style={{ minWidth: '180px', backgroundColor: 'var(--bg-tertiary)' }}>항목명</th>
                        <th style={{ width: '120px', backgroundColor: 'var(--bg-tertiary)' }}>결제수단</th>
                        <th style={{ width: '120px', textAlign: 'right', backgroundColor: 'var(--bg-tertiary)' }}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.details.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                            해당 결제 기간에 사용된 카드 결제 내역이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        card.details.map(t => (
                          <tr key={t.id}>
                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.date}</td>
                            <td 
                              className={t.memo ? "memo-indicator-cell" : ""} 
                              title={t.memo ? `메모: ${t.memo}` : undefined}
                              style={{ fontWeight: '700' }}
                            >
                              {t.name}
                              {t.isAuto && (
                                <span style={{ fontSize: '8px', color: 'var(--income-color)', marginLeft: '4px', backgroundColor: 'var(--income-light)', padding: '1px 3px', borderRadius: '3px' }}>AUTO</span>
                              )}
                              {t.memo && <div className="memo-corner-triangle" />}
                            </td>
                            <td>
                              <span className="badge" style={{ fontSize: '9px', padding: '1px 4px' }}>
                                {t.method}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--expense-color)' }}>
                              {formatWon(t.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
