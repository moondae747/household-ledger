import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { ChevronLeft, ChevronRight, CreditCard, Check, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function CardValueManager({ currentMonth, startDay }) {
  const [billMonth, setBillMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState([]);
  const [cardBills, setCardBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // 수기 이용 내역 입력 상태
  const [manualInput, setManualInput] = useState({
    '우리카드': { name: '', amount: '' },
    '현대카드': { name: '', amount: '' },
    '삼성카드': { name: '', amount: '' }
  });

  // 단기현금서비스 입력 상태
  const [cashServiceInput, setCashServiceInput] = useState({
    '우리카드': { name: '', amount: '' },
    '현대카드': { name: '', amount: '' },
    '삼성카드': { name: '', amount: '' }
  });

  const loadCardData = async () => {
    setLoading(true);
    try {
      const [y, m] = billMonth.split('-').map(Number);
      const d0 = new Date(y, m - 1, 1);
      const d1 = new Date(y, m - 2, 1);
      const d2 = new Date(y, m - 3, 1);
      const formatYM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const [txs0, txs1, txs2, bills] = await Promise.all([
        dbService.fetchTransactions(formatYM(d0), startDay),
        dbService.fetchTransactions(formatYM(d1), startDay),
        dbService.fetchTransactions(formatYM(d2), startDay),
        dbService.fetchCardBills(billMonth)
      ]);

      const mergedTxs = [];
      const txIds = new Set();
      [...txs0, ...txs1, ...txs2].forEach(t => {
        if (!txIds.has(t.id)) { txIds.add(t.id); mergedTxs.push(t); }
      });

      setTransactions(mergedTxs);
      setCardBills(bills);
    } catch (e) {
      console.error('카드값 로드 중 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCardData(); }, [billMonth, startDay]);

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

  const getCardPeriod = (cardName) => {
    const [y, m] = billMonth.split('-').map(Number);
    if (cardName === '삼성카드') {
      const dPrev2 = new Date(y, m - 3, 1);
      const dPrev = new Date(y, m - 2, 1);
      const prev2YM = `${dPrev2.getFullYear()}-${String(dPrev2.getMonth() + 1).padStart(2, '0')}`;
      const prevYM = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}`;
      return { startDate: `${prev2YM}-30`, endDate: `${prevYM}-29`, paymentDate: `${y}-${String(m).padStart(2, '0')}-13` };
    } else {
      const dPrev = new Date(y, m - 2, 1);
      const prevYM = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}`;
      const currentYM = `${y}-${String(m).padStart(2, '0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      return { startDate: `${prevYM}-17`, endDate: `${currentYM}-16`, paymentDate: `${currentYM}-${lastDay}` };
    }
  };

  const getCardDetails = (cardName) => {
    const period = getCardPeriod(cardName);
    const details = transactions.filter(t =>
      t.method === cardName && t.date >= period.startDate && t.date <= period.endDate && t.type !== 'wallet_charge'
    ).sort((a, b) => a.date.localeCompare(b.date));
    const totalUsed = details.reduce((sum, t) => sum + t.amount, 0);

    const billRecord = cardBills.find(b => b.cardName === cardName) || {};
    const isPaid = billRecord.isPaid || false;
    const manualEntries = billRecord.manualEntries || [];
    const cashServices = billRecord.cashServices || [];
    const manualTotal = manualEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const cashServiceTotal = cashServices.reduce((sum, e) => sum + (e.amount || 0), 0);
    const finalAmount = totalUsed + manualTotal + cashServiceTotal;

    return { details, totalUsed, manualEntries, cashServices, manualTotal, cashServiceTotal, finalAmount, isPaid, period };
  };

  const handleTogglePaid = async (cardName, currentStatus) => {
    try {
      setLoading(true);
      await dbService.updateCardBillStatus(cardName, billMonth, !currentStatus);
      await loadCardData();
    } catch (e) { console.error(e); alert('정산 처리에 실패했습니다.'); }
    finally { setLoading(false); }
  };

  // 공통 cardBills 필드 저장 헬퍼
  const saveBillField = async (cardName, fieldName, fieldValue) => {
    const billRecord = cardBills.find(b => b.cardName === cardName) || {};
    const isPaid = billRecord.isPaid || false;
    const payload = { cardName, billMonth, isPaid, [fieldName]: fieldValue, updatedAt: new Date().toISOString() };
    const representativeGroupId = dbService.getGroupId();
    const db = dbService.getDb();

    if (dbService.isFirebaseEnabled() && representativeGroupId && db) {
      const { query, collection, where, getDocs, updateDoc, doc, addDoc } = await import('firebase/firestore');
      const q = query(collection(db, 'cardBills'), where('groupId', '==', representativeGroupId), where('cardName', '==', cardName), where('billMonth', '==', billMonth));
      const snapshot = await getDocs(q);
      const fullPayload = { ...payload, groupId: representativeGroupId };
      if (!snapshot.empty) {
        await updateDoc(doc(db, 'cardBills', snapshot.docs[0].id), fullPayload);
      } else {
        await addDoc(collection(db, 'cardBills'), fullPayload);
      }
    } else {
      const list = dbService.mockDb.get('ledger_card_bills') || [];
      const idx = list.findIndex(bill => bill.cardName === cardName && bill.billMonth === billMonth);
      if (idx !== -1) { list[idx] = { ...list[idx], ...payload }; }
      else { list.push({ id: 'bill_' + Date.now(), ...payload }); }
      dbService.mockDb.set('ledger_card_bills', list);
    }
  };

  // 수기 내역 추가
  const handleAddManualEntry = async (cardName) => {
    const input = manualInput[cardName];
    const numVal = parseInt((input.amount || '').replace(/[^0-9-]/g, ''), 10);
    if (!input.name.trim() || isNaN(numVal) || numVal === 0) { alert('항목명과 금액을 올바르게 입력해 주세요.'); return; }
    try {
      setLoading(true);
      const billRecord = cardBills.find(b => b.cardName === cardName) || {};
      const newEntries = [...(billRecord.manualEntries || []), { name: input.name.trim(), amount: numVal, id: Date.now().toString() }];
      await saveBillField(cardName, 'manualEntries', newEntries);
      setManualInput(prev => ({ ...prev, [cardName]: { name: '', amount: '' } }));
      await loadCardData();
    } catch (e) { console.error(e); alert('수기 내역 추가에 실패했습니다.'); }
    finally { setLoading(false); }
  };

  const handleDeleteManualEntry = async (cardName, entryId) => {
    try {
      setLoading(true);
      const billRecord = cardBills.find(b => b.cardName === cardName) || {};
      const newEntries = (billRecord.manualEntries || []).filter(e => e.id !== entryId);
      await saveBillField(cardName, 'manualEntries', newEntries);
      await loadCardData();
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 단기현금서비스 추가
  const handleAddCashService = async (cardName) => {
    const input = cashServiceInput[cardName];
    const numVal = parseInt((input.amount || '').replace(/[^0-9-]/g, ''), 10);
    if (!input.name.trim() || isNaN(numVal) || numVal === 0) { alert('항목명과 금액을 올바르게 입력해 주세요.'); return; }
    try {
      setLoading(true);
      const billRecord = cardBills.find(b => b.cardName === cardName) || {};
      const newServices = [...(billRecord.cashServices || []), { name: input.name.trim(), amount: numVal, id: Date.now().toString() }];
      await saveBillField(cardName, 'cashServices', newServices);
      setCashServiceInput(prev => ({ ...prev, [cardName]: { name: '', amount: '' } }));
      await loadCardData();
    } catch (e) { console.error(e); alert('현금서비스 추가에 실패했습니다.'); }
    finally { setLoading(false); }
  };

  const handleDeleteCashService = async (cardName, entryId) => {
    try {
      setLoading(true);
      const billRecord = cardBills.find(b => b.cardName === cardName) || {};
      const newServices = (billRecord.cashServices || []).filter(e => e.id !== entryId);
      await saveBillField(cardName, 'cashServices', newServices);
      await loadCardData();
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const formatWon = (num) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);

  const cardsList = ['우리카드', '현대카드', '삼성카드'];
  const cardSummary = cardsList.map(c => ({ name: c, ...getCardDetails(c) }));
  const grandTotal = cardSummary.reduce((sum, item) => sum + item.finalAmount, 0);
  const paidTotal = cardSummary.filter(item => item.isPaid).reduce((sum, item) => sum + item.finalAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

        <button onClick={loadCardData} className="theme-toggle" title="새로고침" style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* 📊 총 카드값 대시보드 */}
      <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)', borderLeft: '4px solid var(--accent-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase' }}>이번 달 청구 총 합산액</span>
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px' }}>{formatWon(grandTotal)}</h1>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: 'var(--income-color)', fontWeight: '700' }}>정산 완료 금액</span>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--income-color)', marginTop: '2px' }}>{formatWon(paidTotal)}</p>
            </div>
            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <span style={{ fontSize: '10px', color: 'var(--expense-color)', fontWeight: '700' }}>정산 대기 금액</span>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--expense-color)', marginTop: '2px' }}>{formatWon(grandTotal - paidTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3대 카드사별 세부 구역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cardSummary.map(card => (
          <div key={card.name} className="card" style={{ padding: 0, opacity: card.isPaid ? 0.75 : 1, border: card.isPaid ? '1px solid var(--income-color)' : '1px solid var(--border-color)', transition: 'opacity 0.2s, border-color 0.2s' }}>
            
            {/* 카드사 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: card.name === '삼성카드' ? '#2b509d' : card.name === '우리카드' ? '#007bc3' : '#1d1d1f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <span onClick={() => handleTogglePaid(card.name, card.isPaid)} style={{ backgroundColor: 'var(--income-light)', color: 'var(--income-color)', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} /> 정산 완료 (클릭 취소)
                  </span>
                ) : (
                  <button onClick={() => handleTogglePaid(card.name, card.isPaid)} style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                    정산 대기 (완료 체크)
                  </button>
                )}
              </div>
            </div>

            {/* 금액 정보 요약 바 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>자동 집계 금액</span>
                <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{formatWon(card.totalUsed)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>수기 내역 합계</span>
                <p style={{ fontSize: '14px', fontWeight: '700', color: card.manualTotal !== 0 ? 'var(--expense-color)' : 'var(--text-tertiary)', marginTop: '2px' }}>{formatWon(card.manualTotal)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>단기현금서비스</span>
                <p style={{ fontSize: '14px', fontWeight: '700', color: card.cashServiceTotal !== 0 ? '#E65100' : 'var(--text-tertiary)', marginTop: '2px' }}>{formatWon(card.cashServiceTotal)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: 'var(--accent-color)', fontWeight: '700' }}>최종 청구 예정액</span>
                <p style={{ fontSize: '17px', fontWeight: '850', color: 'var(--accent-color)', marginTop: '2px' }}>{formatWon(card.finalAmount)}</p>
              </div>
            </div>

            {/* 📝 수기 이용 내역 추가 영역 */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>📝 수기 이용 내역 추가</span>
              {card.manualEntries.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {card.manualEntries.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ fontWeight: '600' }}>{entry.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--expense-color)' }}>{formatWon(entry.amount)}</span>
                        <button onClick={() => handleDeleteManualEntry(card.name, entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px' }}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" className="form-input" value={manualInput[card.name].name} onChange={(e) => setManualInput(prev => ({ ...prev, [card.name]: { ...prev[card.name], name: e.target.value } }))} placeholder="항목명 (예: 연회비)" style={{ flex: 2, padding: '4px 8px', fontSize: '12px', height: '30px', marginBottom: 0 }} />
                <input type="text" className="form-input" value={manualInput[card.name].amount} onChange={(e) => { const val = e.target.value.replace(/[^0-9-]/g, ''); setManualInput(prev => ({ ...prev, [card.name]: { ...prev[card.name], amount: val } })); }} placeholder="금액" style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '30px', marginBottom: 0 }} />
                <button onClick={() => handleAddManualEntry(card.name)} style={{ height: '30px', padding: '0 10px', fontSize: '11px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}><Plus size={12} /> 추가</button>
              </div>
            </div>

            {/* 💵 단기현금서비스 영역 */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#E65100', display: 'block', marginBottom: '8px' }}>💵 단기현금서비스</span>
              {card.cashServices.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {card.cashServices.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', backgroundColor: 'rgba(230, 81, 0, 0.06)', borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ fontWeight: '600' }}>{entry.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', color: '#E65100' }}>{formatWon(entry.amount)}</span>
                        <button onClick={() => handleDeleteCashService(card.name, entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px' }}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" className="form-input" value={cashServiceInput[card.name].name} onChange={(e) => setCashServiceInput(prev => ({ ...prev, [card.name]: { ...prev[card.name], name: e.target.value } }))} placeholder="항목명 (예: 단기현금서비스)" style={{ flex: 2, padding: '4px 8px', fontSize: '12px', height: '30px', marginBottom: 0 }} />
                <input type="text" className="form-input" value={cashServiceInput[card.name].amount} onChange={(e) => { const val = e.target.value.replace(/[^0-9-]/g, ''); setCashServiceInput(prev => ({ ...prev, [card.name]: { ...prev[card.name], amount: val } })); }} placeholder="금액" style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '30px', marginBottom: 0 }} />
                <button onClick={() => handleAddCashService(card.name)} style={{ height: '30px', padding: '0 10px', fontSize: '11px', backgroundColor: '#E65100', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}><Plus size={12} /> 추가</button>
              </div>
            </div>

            {/* 지출 내역 명세표 */}
            <div style={{ padding: '0px 18px 18px 18px', marginTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>이용 기간 청구 집계 내역 ({card.details.length}건)</span>
              <div style={{ overflowX: 'auto', marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <table className="excel-table expanded" style={{ width: '100%', minWidth: '520px', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '105px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>날짜</th>
                      <th style={{ minWidth: '150px', backgroundColor: 'var(--bg-tertiary)' }}>항목명</th>
                      <th style={{ width: '110px', backgroundColor: 'var(--bg-tertiary)' }}>결제수단</th>
                      <th style={{ width: '120px', textAlign: 'right', backgroundColor: 'var(--bg-tertiary)' }}>금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.details.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>해당 결제 기간에 사용된 카드 결제 내역이 없습니다.</td></tr>
                    ) : (
                      card.details.map(t => (
                        <tr key={t.id}>
                          <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.date}</td>
                          <td className={t.memo ? "memo-indicator-cell" : ""} title={t.memo ? `메모: ${t.memo}` : undefined} style={{ fontWeight: '700' }}>
                            {t.name}
                            {t.isAuto && (<span style={{ fontSize: '8px', color: 'var(--income-color)', marginLeft: '4px', backgroundColor: 'var(--income-light)', padding: '1px 3px', borderRadius: '3px' }}>AUTO</span>)}
                            {t.memo && <div className="memo-corner-triangle" />}
                          </td>
                          <td><span className="badge" style={{ fontSize: '9px', padding: '1px 4px' }}>{t.method}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--expense-color)' }}>{formatWon(t.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
