import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Plus, Trash2, Edit2, Maximize2, Minimize2, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function TransactionList({ currentMonth, setCurrentMonth, currentUser, startDay }) {
  const [incomes, setIncomes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  // 팝업 입력 모달용 및 메모 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [memo, setMemo] = useState('');
  const [txType, setTxType] = useState('expense'); // expense, income, wallet_charge
  const [category, setCategory] = useState('생활비');
  const [method, setMethod] = useState('카드결제');
  const [targetWalletId, setTargetWalletId] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 💬 결제 알림 문자/톡 파서 상태 변수
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [parsedSms, setParsedSms] = useState({ cardName: '우리카드', date: '', amount: '', name: '', category: '생활비' });
  const [isDuplicate, setIsDuplicate] = useState(false);

  // 1열 확대 토글 ('fixed', 'living', 'joint', 'kids', null)
  const [expandedCategory, setExpandedCategory] = useState(null);

  // 수정 모달 상태
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [editCategory, setEditCategory] = useState('생활비');
  const [editMethod, setEditMethod] = useState('카드결제');
  const [editType, setEditType] = useState('expense');

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [incs, txs, wts, fetchedFixed] = await Promise.all([
        dbService.fetchIncomes(currentMonth, startDay),
        dbService.fetchTransactions(currentMonth, startDay),
        dbService.fetchWallets(),
        dbService.fetchFixedExpenses()
      ]);

      // ⚡ 고정 입출금 자동화 스케줄러 비동기 실행 (신규 건 자동 등록 후 재조회)
      const { runFixedExpensesAutomation } = await import('../utils/automation');
      const automated = await runFixedExpensesAutomation(currentMonth, fetchedFixed, txs, incs);

      if (automated.length > 0) {
        const [nextIncs, nextTxs] = await Promise.all([
          dbService.fetchIncomes(currentMonth, startDay),
          dbService.fetchTransactions(currentMonth, startDay)
        ]);
        setIncomes(nextIncs);
        setTransactions(nextTxs);
      } else {
        setIncomes(incs);
        setTransactions(txs);
      }

      setWallets(wts);
      if (wts.length > 0 && !targetWalletId) {
        setTargetWalletId(wts[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 오늘 날짜 세팅
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
  }, [currentMonth, startDay]);

  const handleTypeChange = (type) => {
    setTxType(type);
    if (type === 'income') {
      setCategory('고정수입');
      setMethod('계좌이체');
    } else if (type === 'wallet_charge') {
      setCategory('지갑충전');
      setMethod('계좌이체');
    } else {
      setCategory('생활비');
      setMethod('우리카드');
    }
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleEditAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setEditAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const numericAmount = parseInt(amount.replace(/,/g, ''), 10);
    if (!name || isNaN(numericAmount) || numericAmount <= 0) {
      alert('올바른 명칭과 금액을 입력하세요.');
      return;
    }

    try {
      if (txType === 'income') {
        const newIncome = {
          name,
          amount: numericAmount,
          date,
          memo
        };
        await dbService.addIncome(newIncome);
      } else {
        const newTx = {
          name,
          amount: numericAmount,
          date,
          memo,
          category: txType === 'wallet_charge' ? '지갑충전' : category,
          method: txType === 'wallet_charge' ? '계좌이체' : method,
          type: txType,
          walletId: txType === 'wallet_charge' ? targetWalletId : null
        };

        // 할부 등록 처리
        if (txType === 'expense' && installmentMonths >= 2) {
          await dbService.addInstallmentTransactions(newTx, installmentMonths);
        } else {
          await dbService.addTransaction(newTx);
        }

        // 페이 및 지갑 결제수단일 경우 실시간 지갑 차감/충전 반영
        if (txType === 'wallet_charge' && targetWalletId) {
          const wallet = wallets.find(w => w.id === targetWalletId);
          if (wallet) {
            await dbService.updateWalletBalance(targetWalletId, wallet.balance + numericAmount);
          }
        } else if (txType === 'expense' && (method.includes('상품권') || method.includes('페이'))) {
          const matchedWallet = wallets.find(w => method.includes(w.name.substring(0, 4)) || w.name.includes(method));
          if (matchedWallet) {
            await dbService.updateWalletBalance(matchedWallet.id, Math.max(0, matchedWallet.balance - numericAmount));
          }
        }
      }

      setName('');
      setAmount('');
      setMemo('');
      setInstallmentMonths(1);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('등록에 실패했습니다.');
    }
  };

  const handleOpenEdit = (item, type) => {
    setEditingItem({ ...item, type: type || 'expense' });
    setEditName(item.name);
    setEditAmount(item.amount.toLocaleString('ko-KR'));
    setEditDate(item.date);
    setEditMemo(item.memo || '');
    setEditCategory(item.category || '생활비');
    setEditMethod(item.method || '카드결제');
    setEditType(type || 'expense');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const newAmt = parseInt(editAmount.replace(/,/g, ''), 10);
    if (!editName || isNaN(newAmt) || newAmt <= 0) {
      alert('올바른 명칭과 금액을 입력하세요.');
      return;
    }

    try {
      const diff = newAmt - editingItem.amount;

      if (editingItem.type === 'income') {
        const payload = {
          name: editName,
          amount: newAmt,
          date: editDate,
          memo: editMemo
        };
        await dbService.updateIncome(editingItem.id, payload);
      } else {
        const payload = {
          name: editName,
          amount: newAmt,
          date: editDate,
          memo: editMemo,
          category: editCategory,
          method: editMethod,
          type: editingItem.type || 'expense'
        };
        await dbService.updateTransaction(editingItem.id, payload);

        if (diff !== 0) {
          if (editingItem.type === 'wallet_charge' && editingItem.walletId) {
            const wallet = wallets.find(w => w.id === editingItem.walletId);
            if (wallet) {
              await dbService.updateWalletBalance(editingItem.walletId, Math.max(0, wallet.balance + diff));
            }
          } else if (editMethod.includes('상품권') || editMethod.includes('페이')) {
            const matchedWallet = wallets.find(w => editMethod.includes(w.name.substring(0, 4)) || w.name.includes(editMethod));
            if (matchedWallet) {
              await dbService.updateWalletBalance(matchedWallet.id, Math.max(0, matchedWallet.balance - diff));
            }
          }
        }
      }

      setEditingItem(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('수정 중 에러가 발생했습니다.');
    }
  };

  const handleDelete = async (item, type) => {
    if (!confirm(`'${item.name}' 내역을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      if (type === 'income') {
        await dbService.deleteIncome(item.id);
      } else {
        await dbService.deleteTransaction(item.id);

        if (item.type === 'wallet_charge' && item.walletId) {
          const wallet = wallets.find(w => w.id === item.walletId);
          if (wallet) {
            await dbService.updateWalletBalance(item.walletId, Math.max(0, wallet.balance - item.amount));
          }
        }
        if (item.type === 'expense' && (item.method.includes('상품권') || item.method.includes('페이'))) {
          const matchedWallet = wallets.find(w => item.method.includes(w.name.substring(0, 4)) || w.name.includes(item.method));
          if (matchedWallet) {
            await dbService.updateWalletBalance(matchedWallet.id, matchedWallet.balance + item.amount);
          }
        }
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- 💬 한국어 신용카드 결제 알림 문자 파서 (Gemma 기반 로직 정교화) ---
  const parseCardSMS = (text) => {
    if (!text) return null;
    
    // 1. 카드사 식별
    let cardName = '우리카드';
    if (text.includes('현대')) cardName = '현대카드';
    else if (text.includes('삼성')) cardName = '삼성카드';
    else if (text.includes('우리')) cardName = '우리카드';
    else if (text.includes('국민') || text.includes('KB')) cardName = 'KB국민카드';
    else if (text.includes('신한')) cardName = '신한카드';
    else if (text.includes('하나')) cardName = '하나카드';
    
    // 2. 결제 금액 추출
    let amount = '';
    const amtMatch = text.match(/([0-9,]+)\s*원/);
    if (amtMatch) {
      amount = amtMatch[1].replace(/,/g, '');
    } else {
      const commaMatch = text.match(/\b([1-9][0-9,]{2,})\b/);
      if (commaMatch) {
        amount = commaMatch[1].replace(/,/g, '');
      }
    }

    // 3. 결제 날짜 추출 (MM/DD 또는 MM-DD 등)
    let dateStr = '';
    const dateMatch = text.match(/\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/);
    if (dateMatch) {
      const today = new Date();
      const year = today.getFullYear();
      const month = dateMatch[1].padStart(2, '0');
      const day = dateMatch[2].padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      const today = new Date();
      dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    // 4. 가맹점명(상점명) 추출 및 휴리스틱 정제
    let name = '';
    const timeMatch = text.match(/([0-9]{2}:[0-9]{2})/);
    if (timeMatch) {
      const idx = text.indexOf(timeMatch[0]);
      if (idx !== -1) {
        const afterTime = text.substring(idx + timeMatch[0].length).trim();
        let line = afterTime.split('\n')[0].trim();
        line = line.replace(/일시불/g, '').replace(/할부/g, '').replace(/[0-9,]+원?/g, '').trim();
        if (line && line.length >= 2) name = line;
      }
    }

    if (!name && dateMatch) {
      const idx = text.indexOf(dateMatch[0]);
      if (idx !== -1) {
        const afterDate = text.substring(idx + dateMatch[0].length).trim();
        let line = afterDate.split('\n')[0].trim();
        line = line.replace(/^[0-9]{2}:[0-9]{2}/, '').trim();
        line = line.replace(/일시불/g, '').replace(/할부/g, '').replace(/[0-9,]+원?/g, '').trim();
        if (line && line.length >= 2) name = line;
      }
    }

    const merchantMatch = text.match(/(?:가맹점|사용처|결제처|상호명|이용처)\s*:?\s*([^\s\n]+)/);
    if (merchantMatch) {
      name = merchantMatch[1].trim();
    }

    if (name) {
      name = name.replace(/\(일시불\)/g, '').replace(/\(할부\)/g, '').replace(/[\(\)]/g, '').trim();
    }

    return { cardName, date: dateStr, amount, name: name || '카드 결제' };
  };

  const handleSmsChange = (text) => {
    setSmsText(text);
    const parsed = parseCardSMS(text);
    if (parsed) {
      setParsedSms(prev => {
        const next = {
          ...prev,
          cardName: parsed.cardName,
          date: parsed.date,
          amount: parsed.amount ? Number(parsed.amount).toLocaleString('ko-KR') : '',
          name: parsed.name
        };
        // 금액 포맷팅을 푼 실제 숫자로 중복검사 수행
        checkDuplicate(parsed.date, parseInt(parsed.amount, 10));
        return next;
      });
    }
  };

  const checkDuplicate = (targetDate, targetAmount) => {
    if (!targetDate || !targetAmount || isNaN(targetAmount)) {
      setIsDuplicate(false);
      return;
    }
    const hasDup = transactions.some(t => 
      t.date === targetDate && 
      t.amount === targetAmount && 
      t.type !== 'wallet_charge'
    );
    setIsDuplicate(hasDup);
  };

  const handleSmsSubmit = async (e) => {
    e.preventDefault();
    const cleanAmt = parseInt(parsedSms.amount.replace(/,/g, ''), 10);
    if (!parsedSms.name || isNaN(cleanAmt) || cleanAmt <= 0 || !parsedSms.date) {
      alert('파싱된 내역의 날짜, 가맹점, 금액을 확인해 주세요.');
      return;
    }

    if (isDuplicate) {
      if (!confirm('⚠️ 동일한 날짜와 금액의 지출 내역이 이미 가계부에 존재합니다. 정말로 중복 등록하시겠습니까?')) {
        return;
      }
    }

    try {
      const newTx = {
        name: parsedSms.name,
        amount: cleanAmt,
        date: parsedSms.date,
        memo: '문자 붙여넣기 자동 등록',
        category: parsedSms.category,
        method: parsedSms.cardName,
        type: 'expense',
        walletId: null
      };

      await dbService.addTransaction(newTx);
      
      // 상품권이나 페이일 경우 차감 연동
      if (parsedSms.cardName.includes('상품권') || parsedSms.cardName.includes('페이')) {
        const matchedWallet = wallets.find(w => parsedSms.cardName.includes(w.name.substring(0, 4)) || w.name.includes(parsedSms.cardName));
        if (matchedWallet) {
          await dbService.updateWalletBalance(matchedWallet.id, Math.max(0, matchedWallet.balance - cleanAmt));
        }
      }

      alert('성공적으로 가계부 내역에 등록되었습니다.');
      setShowSmsModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('지출 등록에 실패했습니다.');
    }
  };

  const formatWon = (num) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
  };

  // 검색 필터 적용 함수
  const matchesSearch = (item) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(kw)) ||
      (item.method && item.method.toLowerCase().includes(kw)) ||
      (item.memo && item.memo.toLowerCase().includes(kw)) ||
      (item.date && item.date.includes(kw)) ||
      (item.amount && item.amount.toString().includes(kw))
    );
  };

  const getCategorizedData = (catName) => {
    const list = transactions
      .filter(t => {
        if (catName === '열매 & 번성 & 킹콩') {
          return (t.category === '열매 & 번성 & 킹콩' || t.category === '열매 & 킹콩') && t.type !== 'wallet_charge';
        }
        return t.category === catName && t.type !== 'wallet_charge';
      })
      .filter(matchesSearch)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    let runningTotal = 0;
    return list.map(item => {
      runningTotal += item.amount;
      return { ...item, runningTotal };
    });
  };

  const openAddModal = (catName, type) => {
    setTxType(type || 'expense');
    setCategory(catName === 'income' ? '고정수입' : catName);
    
    if (type === 'income') {
      setMethod('계좌이체');
    } else if (type === 'wallet_charge') {
      setMethod('계좌이체');
    } else {
      setMethod('우리카드');
    }
    
    setName('');
    setAmount('');
    setMemo('');
    setInstallmentMonths(1);
    
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
    
    setShowAddModal(true);
  };

  // 카테고리별 색상 매핑
  const catColors = {
    fixed: { color: 'var(--cat-fixed-color)', light: 'var(--cat-fixed-light)' },
    living: { color: 'var(--cat-living-color)', light: 'var(--cat-living-light)' },
    joint: { color: 'var(--cat-joint-color)', light: 'var(--cat-joint-light)' },
    kids: { color: 'var(--cat-kids-color)', light: 'var(--cat-kids-light)' },
  };

  const fixedExpensesData = getCategorizedData('공과금 및 고정지출');
  const livingExpensesData = getCategorizedData('생활비');
  const jointExpensesData = getCategorizedData('공동');
  const kidsExpensesData = getCategorizedData('열매 & 번성 & 킹콩');
  const filteredIncomes = incomes.filter(matchesSearch);

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);

  // ⚡ 지갑 충전(wallet_charge)만 예산 계산에서 제외하며, 지역화폐 결제사용은 총 지출에 정상 합산
  const totalExpense = transactions
    .filter(t => t.type !== 'wallet_charge')
    .reduce((sum, t) => sum + t.amount, 0);

  const renderTable = (title, dataList, catKey) => {
    const isExpanded = expandedCategory === catKey;
    const cc = catColors[catKey] || catColors.living;

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${cc.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: cc.light, borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '13.5px', fontWeight: '800', color: cc.color }}>{title} ({dataList.length}건)</span>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
              style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title={isExpanded ? "축소하기" : "확대하기"}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button 
              onClick={() => openAddModal(title === '열매 & 번성 & 킹콩' ? '열매 & 번성 & 킹콩' : catKey === 'fixed' ? '공과금 및 고정지출' : catKey === 'living' ? '생활비' : '공동', 'expense')}
              style={{ 
                backgroundColor: 'var(--accent-color)', 
                color: '#ffffff', 
                border: 'none', 
                borderRadius: 'var(--radius-sm)', 
                padding: '4px 10px', 
                fontSize: '11px', 
                fontWeight: '700', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
              onMouseOut={(e) => e.currentTarget.style.opacity = 1}
            >
              <Plus size={12} /> 추가
            </button>
          </div>
        </div>

        <div className="table-responsive" style={{ overflowX: 'auto', height: isExpanded ? '480px' : '290px', overflowY: 'auto' }}>
          <table className="excel-table expanded" style={{ width: '100%', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ width: '105px', textAlign: 'center' }}>날짜</th>
                <th style={{ minWidth: '140px' }}>항목명</th>
                <th style={{ width: '105px' }}>결제수단</th>
                <th style={{ width: '115px', textAlign: 'right' }}>금액</th>
                <th style={{ width: '115px', textAlign: 'right' }}>누계</th>
                <th style={{ width: '55px', textAlign: 'center' }}>동작</th>
              </tr>
            </thead>
            <tbody>
              {dataList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', height: isExpanded ? '410px' : '220px', verticalAlign: 'middle', color: 'var(--text-tertiary)' }}>
                    작성된 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                dataList.map(item => (
                  <tr 
                    key={item.id} 
                    className="list-item-hover"
                    onClick={() => handleOpenEdit(item, 'expense')}
                    style={{ cursor: 'pointer' }}
                    title="클릭하여 수정"
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{item.date}</td>
                    
                    <td 
                      className={item.memo ? "memo-indicator-cell" : ""} 
                      title={item.memo ? `메모: ${item.memo}` : "클릭하여 수정"}
                      style={{ fontWeight: '700' }}
                    >
                      {item.name}
                      {item.isAuto && (
                        <span style={{ fontSize: '8px', color: 'var(--income-color)', marginLeft: '4px', backgroundColor: 'var(--income-light)', padding: '1px 3px', borderRadius: '3px' }}>AUTO</span>
                      )}
                      {item.memo && <div className="memo-corner-triangle" />}
                    </td>
                    
                    <td>
                      <span className="badge" style={{ fontSize: '9px', padding: '1px 4px' }}>
                        {item.method}
                      </span>
                    </td>
                    
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--expense-color)' }}>
                      {formatWon(item.amount)}
                    </td>
                    
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      {formatWon(item.runningTotal)}
                    </td>

                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleOpenEdit(item, 'expense')}
                          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item, 'expense')}
                          style={{ color: 'var(--expense-color)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderGrids = () => {
    if (expandedCategory) {
      switch (expandedCategory) {
        case 'fixed': return renderTable('공과금 및 고정지출', fixedExpensesData, 'fixed');
        case 'living': return renderTable('생활비', livingExpensesData, 'living');
        case 'joint': return renderTable('공동', jointExpensesData, 'joint');
        case 'kids': return renderTable('열매 & 번성 & 킹콩', kidsExpensesData, 'kids');
        default: return null;
      }
    }

    return (
      <div className="transactions-grid-4">
        {renderTable('공과금 및 고정지출', fixedExpensesData, 'fixed')}
        {renderTable('생활비', livingExpensesData, 'living')}
        {renderTable('공동', jointExpensesData, 'joint')}
        {renderTable('열매 & 번성 & 킹콩', kidsExpensesData, 'kids')}
      </div>
    );
  };

  const renderIncomeTable = () => {
    if (expandedCategory) return null;
    const incomeList = filteredIncomes;

    return (
      <div className="card" style={{ overflow: 'hidden', padding: '16px 20px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontWeight: '800', fontSize: '14.5px', color: 'var(--income-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💰 이번 달 수입 세부 명세서 ({incomeList.length}건)
          </span>
          
          <button 
            onClick={() => openAddModal('income', 'income')}
            style={{ 
              backgroundColor: 'var(--income-color)', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: 'var(--radius-sm)', 
              padding: '4px 10px', 
              fontSize: '11px', 
              fontWeight: '700', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
            onMouseOut={(e) => e.currentTarget.style.opacity = 1}
          >
            <Plus size={12} /> 추가
          </button>
        </div>
        <div style={{ overflowX: 'auto', height: '290px', overflowY: 'auto' }} className="table-responsive">
          <table className="excel-table expanded" style={{ width: '100%', minWidth: '520px' }}>
            <thead>
              <tr>
                <th style={{ width: '105px', textAlign: 'center' }}>날짜</th>
                <th style={{ minWidth: '190px' }}>수입 항목명</th>
                <th style={{ width: '130px', textAlign: 'right' }}>금액</th>
                <th style={{ width: '55px', textAlign: 'center' }}>동작</th>
              </tr>
            </thead>
            <tbody>
              {incomeList.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', height: '220px', verticalAlign: 'middle', color: 'var(--text-tertiary)' }}>등록된 수입 내역이 없습니다.</td>
                </tr>
              ) : (
                incomeList.map(item => (
                  <tr key={item.id} className="list-item-hover" onClick={() => handleOpenEdit(item, 'income')} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{item.date}</td>
                    <td 
                      className={item.memo ? "memo-indicator-cell" : ""} 
                      title={item.memo ? `메모: ${item.memo}` : "클릭하여 수정"}
                      style={{ fontWeight: '700' }}
                    >
                      {item.name}
                      {item.memo && <div className="memo-corner-triangle" />}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--income-color)' }}>{formatWon(item.amount)}</td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleDelete(item, 'income')}
                        style={{ color: 'var(--expense-color)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 📅 월 선택 꺽쇠 컨트롤러 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px' }}>
            <button onClick={handlePrevMonth} className="theme-toggle" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'Outfit', minWidth: '90px', textAlign: 'center', color: 'var(--text-primary)' }}>
              {currentMonth.split('-')[0]}년 {parseInt(currentMonth.split('-')[1])}월
            </span>
            <button onClick={handleNextMonth} className="theme-toggle" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>가계부 지출 명세서 (스프레드시트 뷰)</h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--income-light)', border: '1px solid var(--income-color)', borderRadius: 'var(--radius-md)', padding: '6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: 'var(--income-color)', fontWeight: '600' }}>이번 달 총 수입</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--income-color)' }}>
              {formatWon(totalIncome)}
            </span>
          </div>
          <div style={{ backgroundColor: 'var(--expense-light)', border: '1px solid var(--expense-color)', borderRadius: 'var(--radius-md)', padding: '6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: 'var(--expense-color)', fontWeight: '600' }}>이번 달 총 지출</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--expense-color)' }}>
              {formatWon(totalExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* 🔍 검색바 및 결제문자 파서 연동 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="form-input"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="항목명, 금액, 결제수단, 메모로 검색..."
            style={{ paddingLeft: '34px', paddingRight: searchKeyword ? '32px' : '12px', height: '36px', fontSize: '13px', marginBottom: 0 }}
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setSmsText('');
            // 오늘 날짜로 기본 세팅
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            setParsedSms({ cardName: '우리카드', date: `${y}-${m}-${d}`, amount: '', name: '', category: '생활비' });
            setIsDuplicate(false);
            setShowSmsModal(true);
          }}
          className="btn btn-primary"
          style={{ height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800' }}
        >
          <FileText size={15} /> 결제 문자/알림톡 붙여넣기 등록
        </button>
      </div>

      {/* 테이블이 와이드하게 넓게 배치되도록 sidebar 구조를 걷어냄 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {renderGrids()}
        {renderIncomeTable()}
      </div>

      {/* 팝업 등록 모달창 (Modal) */}
      {showAddModal && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet" style={{ width: '420px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>
                가계부 {txType === 'income' ? '수입' : txType === 'wallet_charge' ? '지갑 충전' : '지출'} 내역 등록
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                <button 
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  style={{
                    flex: 1, padding: '6px 2px', fontSize: '11px', fontWeight: '700', borderRadius: '4px',
                    backgroundColor: txType === 'expense' ? 'var(--bg-secondary)' : 'transparent',
                    color: txType === 'expense' ? 'var(--expense-color)' : 'var(--text-tertiary)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  지출 (-)
                </button>
                <button 
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  style={{
                    flex: 1, padding: '6px 2px', fontSize: '11px', fontWeight: '700', borderRadius: '4px',
                    backgroundColor: txType === 'income' ? 'var(--bg-secondary)' : 'transparent',
                    color: txType === 'income' ? 'var(--income-color)' : 'var(--text-tertiary)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  수입 (+)
                </button>
                <button 
                  type="button"
                  onClick={() => handleTypeChange('wallet_charge')}
                  style={{
                    flex: 1, padding: '6px 2px', fontSize: '11px', fontWeight: '700', borderRadius: '4px',
                    backgroundColor: txType === 'wallet_charge' ? 'var(--bg-secondary)' : 'transparent',
                    color: txType === 'wallet_charge' ? 'var(--accent-color)' : 'var(--text-tertiary)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  충전
                </button>
              </div>

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
                <label className="form-label">항목명 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="예: 마트 장보기"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">금액 (원) *</label>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">메모</label>
                <textarea 
                  className="form-input" 
                  value={memo} 
                  onChange={(e) => setMemo(e.target.value)} 
                  placeholder="추가 설명이나 메모 입력"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              {txType === 'expense' && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">카테고리</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="생활비">생활비</option>
                      <option value="공과금 및 고정지출">공과금 및 고정지출</option>
                      <option value="공동">공동</option>
                      <option value="열매 & 번성 & 킹콩">열매 & 번성 & 킹콩</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">결제 수단</label>
                    <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="우리카드">우리카드</option>
                      <option value="현대카드">현대카드</option>
                      <option value="삼성카드">삼성카드</option>
                      <option value="계좌이체">계좌이체 / 체크카드</option>
                      {wallets.filter(w => w.name !== '광진사랑상품권').map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* 할부 개월 입력 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">할부 개월 수</label>
                    <select className="form-select" value={installmentMonths} onChange={(e) => setInstallmentMonths(Number(e.target.value))}>
                      <option value={1}>일시불</option>
                      <option value={2}>2개월</option>
                      <option value={3}>3개월</option>
                      <option value={4}>4개월</option>
                      <option value={5}>5개월</option>
                      <option value={6}>6개월</option>
                      <option value={7}>7개월</option>
                      <option value={8}>8개월</option>
                      <option value={9}>9개월</option>
                      <option value={10}>10개월</option>
                      <option value={11}>11개월</option>
                      <option value={12}>12개월</option>
                    </select>
                    {installmentMonths >= 2 && (
                      <p style={{ fontSize: '10px', color: 'var(--accent-color)', marginTop: '4px' }}>
                        → {installmentMonths}회 분할: 회당 약 {Math.round(parseInt((amount || '0').replace(/,/g, ''), 10) / installmentMonths).toLocaleString()}원
                      </p>
                    )}
                  </div>
                </>
              )}

              {txType === 'wallet_charge' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">충전할 지갑</label>
                  <select className="form-select" value={targetWalletId} onChange={(e) => setTargetWalletId(e.target.value)}>
                    {wallets.filter(w => w.name !== '광진사랑상품권').map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                내역 등록
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달창 (Modal) */}
      {editingItem && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet" style={{ width: '420px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>
                내역 오타 수정
              </h3>
              <button onClick={() => setEditingItem(null)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">날짜 *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={editDate} 
                  onChange={(e) => setEditDate(e.target.value)} 
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">항목명 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">금액 *</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="form-input" 
                  value={editAmount} 
                  onChange={handleEditAmountChange} 
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">메모</label>
                <textarea 
                  className="form-input" 
                  value={editMemo} 
                  onChange={(e) => setEditMemo(e.target.value)} 
                  placeholder="메모 입력"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              {editType === 'expense' && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">카테고리</label>
                    <select className="form-select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      <option value="생활비">생활비</option>
                      <option value="공과금 및 고정지출">공과금 및 고정지출</option>
                      <option value="공동">공동</option>
                      <option value="열매 & 번성 & 킹콩">열매 & 번성 & 킹콩</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">결제 수단</label>
                    <select className="form-select" value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
                      <option value="우리카드">우리카드</option>
                      <option value="현대카드">현대카드</option>
                      <option value="삼성카드">삼성카드</option>
                      <option value="계좌이체">계좌이체 / 체크카드</option>
                      {wallets.filter(w => w.name !== '광진사랑상품권').map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  수정 완료
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(editingItem, editingItem.type || 'expense');
                    setEditingItem(null);
                  }}
                  style={{ flex: 'none', padding: '8px 16px', backgroundColor: 'var(--expense-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💬 결제 문자 붙여넣기 파싱 모달 팝업 */}
      {showSmsModal && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet" style={{ width: '680px', maxWidth: '95vw', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={18} style={{ color: 'var(--accent-color)' }} /> 카드 결제 문자/알림톡 복사 등록
              </h3>
              <button onClick={() => setShowSmsModal(false)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {/* 왼쪽: 붙여넣기 영역 */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                <label className="form-label" style={{ fontWeight: '800' }}>결제 문자/톡 내용 붙여넣기</label>
                <textarea
                  className="form-input"
                  value={smsText}
                  onChange={(e) => handleSmsChange(e.target.value)}
                  placeholder="[Web발신]&#10;우리카드 승인&#10;07/16 13:20 15,000원&#10;네이버페이&#10;&#10;여기에 복사한 내용을 붙여넣으세요."
                  style={{ minHeight: '260px', width: '100%', resize: 'none', fontSize: '13px', lineHeight: '1.5' }}
                />
              </div>

              {/* 오른쪽: 분석결과 확인 및 수동 보정 */}
              <form onSubmit={handleSmsSubmit} style={{ flex: 1.1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="form-label" style={{ fontWeight: '800', color: 'var(--text-secondary)' }}>실시간 파싱 결과 (보정 가능)</label>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">결제일 *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={parsedSms.date}
                    onChange={(e) => {
                      setParsedSms(prev => ({ ...prev, date: e.target.value }));
                      checkDuplicate(e.target.value, parseInt(parsedSms.amount.replace(/,/g, ''), 10));
                    }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">가맹점명(상점) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={parsedSms.name}
                    onChange={(e) => setParsedSms(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="상점명 입력"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">결제 금액(원) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={parsedSms.amount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      const formatted = raw ? Number(raw).toLocaleString('ko-KR') : '';
                      setParsedSms(prev => ({ ...prev, amount: formatted }));
                      checkDuplicate(parsedSms.date, parseInt(raw, 10));
                    }}
                    placeholder="숫자 입력"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">결제 수단</label>
                  <select
                    className="form-select"
                    value={parsedSms.cardName}
                    onChange={(e) => setParsedSms(prev => ({ ...prev, cardName: e.target.value }))}
                  >
                    <option value="우리카드">우리카드</option>
                    <option value="현대카드">현대카드</option>
                    <option value="삼성카드">삼성카드</option>
                    <option value="계좌이체">계좌이체 / 체크카드</option>
                    {wallets.filter(w => w.name !== '광진사랑상품권').map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">카테고리 지정</label>
                  <select
                    className="form-select"
                    value={parsedSms.category}
                    onChange={(e) => setParsedSms(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="생활비">생활비</option>
                    <option value="공과금 및 고정지출">공과금 및 고정지출</option>
                    <option value="공동">공동</option>
                    <option value="열매 & 번성 & 킹콩">열매 & 번성 & 킹콩</option>
                  </select>
                </div>

                {/* ⚠️ 중복 경고창 */}
                {isDuplicate && (
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--expense-light)', border: '1px solid var(--expense-color)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--expense-color)', fontWeight: '800' }}>
                    ⚠️ 가계부에 동일한 날짜와 금액의 지출이 이미 등록되어 있습니다. (중복 주의)
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px', padding: '10px', fontWeight: '800' }}>
                  등록 완료
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
