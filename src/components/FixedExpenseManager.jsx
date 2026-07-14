import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Plus, Edit2, Trash2, Calendar, DollarSign, X, HelpCircle } from 'lucide-react';

export default function FixedExpenseManager({ currentUser }) {
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(1);
  const [category, setCategory] = useState('공과금 및 고정지출');
  const [method, setMethod] = useState('계좌이체');
  const [feUser, setFeUser] = useState('공동');
  const [type, setType] = useState('expense'); // expense(지출) 또는 income(수입)

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, wts] = await Promise.all([
        dbService.fetchFixedExpenses(),
        dbService.fetchWallets()
      ]);
      setFixedExpenses(data);
      setWallets(wts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setAmount('');
    setDay(1);
    setCategory('공과금 및 고정지출');
    setMethod('계좌이체');
    setFeUser(currentUser === '공동' ? '공동' : currentUser);
    setType('expense');
    setShowAddModal(true);
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setName(item.name);
    setAmount(item.amount.toLocaleString('ko-KR'));
    setDay(item.day);
    setCategory(item.category || '공과금 및 고정지출');
    setMethod(item.method || '계좌이체');
    setFeUser(item.user || '공동');
    setType(item.type || 'expense');
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmt = parseInt(amount.replace(/,/g, ''), 10);
    if (!name || isNaN(numAmt) || numAmt <= 0) {
      alert('올바른 명칭과 금액을 작성하세요.');
      return;
    }

    const payload = {
      name,
      amount: numAmt,
      day: parseInt(day, 10),
      user: feUser,
      type,
      method: type === 'expense' ? method : '계좌이체',
      category: type === 'expense' ? category : '고정수입'
    };

    try {
      if (editingItem) {
        await dbService.updateFixedExpense(editingItem.id, payload);
      } else {
        await dbService.addFixedExpense(payload);
      }
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id, feName) => {
    if (!confirm(`'${feName}' 정기 결제 마스터 설정을 삭제하시겠습니까? (이미 이번 달에 자동 생성 완료된 장부 내역은 지워지지 않습니다)`)) {
      return;
    }
    try {
      await dbService.deleteFixedExpense(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 상단 액션 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>고정비 / 정기 수입 관리</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            매월 특정 일자에 주기적으로 이체되는 고정 지출(공과금, 적금, 렌탈비) 및 고정 수입(월급 등) 마스터 항목들을 관리합니다.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> 고정 항목 추가
        </button>
      </div>

      {/* 캘린더 및 목록 뷰 */}
      <div className="layout-with-sidebar" style={{ gridTemplateColumns: '1fr 380px' }}>
        
        {/* 왼쪽: 고정비 월간 캘린더 */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>
            <span><Calendar size={16} style={{ marginRight: '8px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />고정 입출금 월간 일정표</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
              const dayItems = fixedExpenses.filter(item => item.day === d);
              return (
                <div key={d} style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 4px',
                  minHeight: '68px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>{d}일</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                    {dayItems.map(item => {
                      const isInc = item.type === 'income';
                      return (
                        <div 
                          key={item.id} 
                          title={`${item.name} (${formatWon(item.amount)})`}
                          onClick={() => handleOpenEdit(item)}
                          style={{
                            fontSize: '9px',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            backgroundColor: isInc ? 'var(--income-light)' : 'var(--expense-light)',
                            color: isInc ? 'var(--income-color)' : 'var(--expense-color)',
                            fontWeight: '700',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          {item.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 등록된 리스트 */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title" style={{ marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span>등록된 고정비 목록 ({fixedExpenses.length}개)</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>불러오는 중...</div>
          ) : fixedExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-tertiary)' }}>
              등록된 정기 마스터 항목이 없습니다.<br />상단 [+ 고정 항목 추가] 버튼으로 등록하세요.
            </div>
          ) : (
            <div className="list-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {fixedExpenses.map((item) => {
                const isInc = item.type === 'income';
                return (
                  <div key={item.id} className="list-item" style={{ padding: '12px 14px', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700' }}>{item.name}</span>
                        <span className={`badge ${isInc ? 'income' : 'expense'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                          {isInc ? '수입' : '지출'} | 매월 {item.day}일
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        <span>{item.method || '계좌'}</span>
                        <span>•</span>
                        <span>{item.user || '공동'}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`amount ${isInc ? 'income' : 'expense'}`} style={{ fontSize: '13px' }}>
                        {isInc ? '+' : '-'}{formatWon(item.amount)}
                      </span>
                      
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        style={{ color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', background: 'none' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id, item.name)}
                        style={{ color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', background: 'none' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* 중앙 추가/수정 모달 */}
      {showAddModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowAddModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '450px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>
                {editingItem ? '정기 항목 수정' : '정기 항목 신규 등록'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
                <button 
                  type="button"
                  onClick={() => setType('expense')}
                  style={{
                    flex: 1, padding: '6px 2px', fontSize: '12px', fontWeight: '700', borderRadius: '4px',
                    backgroundColor: type === 'expense' ? 'var(--bg-secondary)' : 'transparent',
                    color: type === 'expense' ? 'var(--expense-color)' : 'var(--text-tertiary)'
                  }}
                >
                  고정 지출 (-)
                </button>
                <button 
                  type="button"
                  onClick={() => setType('income')}
                  style={{
                    flex: 1, padding: '6px 2px', fontSize: '12px', fontWeight: '700', borderRadius: '4px',
                    backgroundColor: type === 'income' ? 'var(--bg-secondary)' : 'transparent',
                    color: type === 'income' ? 'var(--income-color)' : 'var(--text-tertiary)'
                  }}
                >
                  고정 수입 (+)
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">고정 항목 명칭 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="예: 실손보험, 월세, 정기적금, 월급"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">금액 *</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="form-input" 
                  value={amount} 
                  onChange={handleAmountChange} 
                  placeholder="예: 2,500,000"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">매월 이체/입금일 (일) *</label>
                <select className="form-select" value={day} onChange={(e) => setDay(e.target.value)}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">귀속 사용자 (지출/수입 대상)</label>
                <select className="form-select" value={feUser} onChange={(e) => setFeUser(e.target.value)}>
                  <option value="공동">공동</option>
                  <option value="영민">영민</option>
                  <option value="아정">아정</option>
                </select>
              </div>

              {type === 'expense' ? (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">결제 방법</label>
                    <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="계좌이체">계좌이체</option>
                      <option value="카드결제">카드결제</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">카테고리</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="공과금 및 고정지출">공과금 및 고정지출</option>
                      <option value="생활비">생활비</option>
                      <option value="공동">공동</option>
                      <option value="열매 & 번성 & 킹콩">열매 & 번성 & 킹콩</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">수령 방법</label>
                  <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="계좌이체">계좌이체</option>
                    <option value="현금">현금</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                {editingItem ? '수정 완료' : '추가 완료'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
