import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Plus, Trash2, Smartphone, DollarSign } from 'lucide-react';

export default function PocketMoneyManager({ currentMonth, initialTargetUser }) {
  const [targetUser, setTargetUser] = useState(initialTargetUser || '영민');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // 폼 필드
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

  // 용돈 한도 정보
  const budgetLimits = {
    '영민': 300000,
    '아정': 400000
  };

  useEffect(() => {
    if (initialTargetUser) {
      setTargetUser(initialTargetUser);
    }
  }, [initialTargetUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dbService.fetchPocketMoneyTransactions(currentMonth, targetUser);
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 날짜 기본값 세팅
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
  }, [currentMonth, targetUser]);

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmt = parseInt(amount.replace(/,/g, ''), 10);
    if (!name || isNaN(numAmt) || numAmt <= 0) {
      alert('올바른 명칭과 금액을 기입하세요.');
      return;
    }

    try {
      const newTx = {
        name,
        amount: numAmt,
        date,
        user: targetUser
      };
      await dbService.addPocketMoneyTransaction(newTx);
      setName('');
      setAmount('');
      loadData();
    } catch (e) {
      console.error(e);
      alert('등록에 실패했습니다.');
    }
  };

  const handleDelete = async (id, txName) => {
    if (!confirm(`'${txName}' 용돈 지출 내역을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await dbService.deletePocketMoneyTransaction(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const limit = budgetLimits[targetUser];
  const balance = limit - totalSpent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 타이틀 및 영민/아정 전환 탭 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>용돈 기입장 ({currentMonth})</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            가계부 전체 공용 예산과 완전히 격리되어 부부 각자 자유롭게 사용하는 전용 용돈 명세서입니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button 
            className={`btn ${targetUser === '영민' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 16px', fontSize: '12px' }}
            onClick={() => setTargetUser('영민')}
          >
            영민
          </button>
          <button 
            className={`btn ${targetUser === '아정' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 16px', fontSize: '12px' }}
            onClick={() => setTargetUser('아정')}
          >
            아정
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>한도 한 달 용돈</span>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px' }}>{formatWon(limit)}</h3>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>이번 달 사용 금액</span>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', color: 'var(--expense-color)' }}>{formatWon(totalSpent)}</h3>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>남은 용돈 잔액</span>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', color: balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)' }}>
            {formatWon(balance)}
          </h3>
        </div>
      </div>

      {/* 리스트 및 입력 폼 좌우 분할 */}
      <div className="layout-with-sidebar" style={{ gridTemplateColumns: '1fr 300px' }}>
        
        {/* 왼쪽: 용돈 지출 내역 리스트 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>날짜</th>
                  <th>사용처 (지출 항목명)</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>금액</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>불러오는 중...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>이번 달 작성된 용돈 지출 내역이 없습니다.</td>
                  </tr>
                ) : (
                  transactions.map(item => (
                    <tr key={item.id} className="list-item-hover">
                      <td>{item.date}</td>
                      <td style={{ fontWeight: '600' }}>{item.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--expense-color)' }}>
                        {formatWon(item.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDelete(item.id, item.name)}
                          style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', padding: '4px' }}
                          className="list-item-hover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 용돈 입력 폼 */}
        <div className="card" style={{ padding: '16px', height: 'fit-content' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>
            <span><Plus size={15} style={{ marginRight: '6px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />용돈 지출 추가</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">날짜 *</label>
              <input 
                type="date" 
                className="form-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">사용처 항목명 *</label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="예: 편의점 커피, 친구 선물"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">지출 금액 *</label>
              <input 
                type="text" 
                inputMode="numeric"
                className="form-input" 
                value={amount} 
                onChange={handleAmountChange} 
                placeholder="숫자 입력"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
              용돈 지출 기록
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
