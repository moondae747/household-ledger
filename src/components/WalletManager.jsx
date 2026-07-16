import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Wallet, HelpCircle, Edit2, Check, X } from 'lucide-react';

export default function WalletManager() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingWalletId, setEditingWalletId] = useState(null);
  const [editBalance, setEditBalance] = useState('');

  const loadWallets = async () => {
    setLoading(true);
    try {
      const data = await dbService.fetchWallets();
      setWallets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleStartEdit = (wallet) => {
    setEditingWalletId(wallet.id);
    setEditBalance(wallet.balance.toLocaleString('ko-KR'));
  };

  const handleEditBalanceChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setEditBalance(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleCancelEdit = () => {
    setEditingWalletId(null);
  };

  const handleSaveEdit = async (walletId) => {
    const num = parseInt(editBalance.replace(/,/g, ''), 10);
    if (isNaN(num) || num < 0) {
      alert('올바른 잔액을 입력하세요.');
      return;
    }

    try {
      await dbService.updateWalletBalance(walletId, num);
      setEditingWalletId(null);
      loadWallets();
    } catch (e) {
      console.error(e);
      alert('지갑 잔액 수정에 실패했습니다.');
    }
  };

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>지갑 정보를 불러오는 중...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>지갑 관리</h2>
      
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        서울사랑상품권, 땡겨요 페이 등의 상품권/페이 선충전 금액 잔고를 개별 관리합니다. 
        가계부 지출 작성 시 결제 수단을 해당 상품권/페이로 선택하면, 이 지갑 잔액에서 결제금액이 자동으로 차감됩니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {wallets.filter(w => w.name !== '광진사랑상품권').map(w => {
          const isEditing = editingWalletId === w.id;
          return (
            <div key={w.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={16} style={{ color: 'var(--accent-color)' }} />
                  {w.name}
                </span>
                
                {!isEditing && (
                  <button 
                    onClick={() => handleStartEdit(w)}
                    style={{ color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                    className="list-item-hover"
                  >
                    <Edit2 size={11} /> 잔액 강제 보정
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    className="form-input" 
                    style={{ flex: 1, padding: '6px 10px', fontSize: '14px', marginBottom: 0 }}
                    value={editBalance}
                    onChange={handleEditBalanceChange}
                    placeholder="새 잔액 입력"
                    required
                  />
                  <button 
                    onClick={() => handleSaveEdit(w.id)}
                    style={{ padding: '6px 10px', backgroundColor: 'var(--income-color)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Check size={14} />
                  </button>
                  <button 
                    onClick={handleCancelEdit}
                    style={{ padding: '6px 10px', backgroundColor: 'var(--expense-color)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '4px 0 0 0' }}>
                  {formatWon(w.balance)}
                </h1>
              )}

              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                * 지갑 충전(금액 추가)은 가계부 내역 탭에서 '충전' 구분을 선택하여 등록하시면 충전 내역 기록과 함께 잔고가 늘어납니다.
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '10px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <HelpCircle size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <strong>지역화폐 및 페이 비즈니스 규칙:</strong><br />
          1. 가계부 지출 등록 시 결제 수단으로 지역화폐를 사용하면 지갑 잔액이 자동으로 차감됩니다.<br />
          2. 지역화폐 충전 내역(`type = wallet_charge`)은 충전 행위일 뿐이므로 가계부의 총 지출/수입 계산에서는 자동 필터링되어 제외됩니다.
        </div>
      </div>

    </div>
  );
}
