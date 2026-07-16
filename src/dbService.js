import { getDb } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc
} from 'firebase/firestore';

// 헬퍼: 브라우저 로컬 저장소 모의 DB 연동 (Firebase 비활성화 시 Fallback)
const mockDb = {
  get: (key, defaultValue = []) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  },
  set: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// 모의 가계부 데이터 구조 초기 뼈대 세팅
const initMockData = () => {
  if (!localStorage.getItem('ledger_incomes')) {
    mockDb.set('ledger_incomes', []);
  }
  if (!localStorage.getItem('ledger_transactions')) {
    mockDb.set('ledger_transactions', []);
  }
  if (!localStorage.getItem('ledger_fixed_expenses')) {
    mockDb.set('ledger_fixed_expenses', []);
  }
  if (!localStorage.getItem('ledger_pocket_money_transactions')) {
    mockDb.set('ledger_pocket_money_transactions', []);
  }
  if (!localStorage.getItem('ledger_todos')) {
    mockDb.set('ledger_todos', []);
  }
  if (!localStorage.getItem('ledger_wallets')) {
    mockDb.set('ledger_wallets', [
      { id: 'w_seoul', name: '서울사랑상품권', balance: 0 },
      { id: 'w_ddangyo', name: '땡겨요 페이', balance: 0 },
      { id: 'w_biple', name: '비플페이', balance: 0 }
    ]);
  }
  if (!localStorage.getItem('ledger_card_bills')) {
    mockDb.set('ledger_card_bills', []);
  }
};

initMockData();

// Firebase 활성화 상태 판정
const isFirebaseEnabled = () => {
  const db = getDb();
  return db !== undefined && db !== null;
};

// ⚡ Firebase 2초 타임아웃 래퍼
const withTimeout = (promise, ms = 2000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase network timeout')), ms))
  ]);
};

/**
 * 📅 지정된 시작일(S)을 기준으로 회계 월(YYYY-MM)의 날짜 시작/종료 범위 획득 (윤달/말일 완벽 대응)
 */
export const getMonthRange = (currentYearMonthStr, startDay) => {
  const [y, m] = currentYearMonthStr.split('-').map(Number);
  const S = parseInt(startDay, 10) || 1;
  
  if (S === 1) {
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${y}-${String(m).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    };
  } else {
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    
    const prevMaxDay = new Date(prevY, prevM, 0).getDate();
    const actualStartDay = Math.min(S, prevMaxDay);
    
    const currMaxDay = new Date(y, m, 0).getDate();
    const actualEndDay = Math.min(S - 1, currMaxDay);
    
    return {
      startDate: `${prevY}-${String(prevM).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`,
      endDate: `${y}-${String(m).padStart(2, '0')}-${String(actualEndDay).padStart(2, '0')}`
    };
  }
};

/**
 * 🔒 구글 이메일을 조합한 본인 단독 ID 및 부부 공동 ID 쿼리 후보 배열 획득 (데이터 유실 원천 방지)
 */
export const getQueryGroupIds = () => {
  const savedUser = localStorage.getItem('login_user');
  if (!savedUser) return [];
  
  try {
    const user = JSON.parse(savedUser);
    const email = user.email.toLowerCase();
    const partner = (localStorage.getItem('partner_email') || '').trim().toLowerCase();
    
    const ids = [email];
    if (partner) {
      const sorted = [email, partner].sort();
      const combined = `${sorted[0]}__${sorted[1]}`;
      if (combined !== email) {
        ids.push(combined);
      }
    }
    return ids;
  } catch (e) {
    console.error('Error parsing login user for groupIds:', e);
    return [];
  }
};

/**
 * 쓰기(Write) 시 사용할 대표 groupId 획득
 */
export const getGroupId = () => {
  const ids = getQueryGroupIds();
  if (ids.length === 0) return null;
  return ids.length > 1 ? ids[1] : ids[0];
};

export const dbService = {
  // --- 0. 로컬 데이터를 구글 클라우드로 안전 병합 (Migration) ---
  migrateLocalDataToCloud: async (groupId) => {
    const db = getDb();
    if (!db || !groupId) return false;
    
    try {
      const txs = mockDb.get('ledger_transactions');
      const incomes = mockDb.get('ledger_incomes');
      const fixed = mockDb.get('ledger_fixed_expenses');
      const pocket = mockDb.get('ledger_pocket_money_transactions');
      const todos = mockDb.get('ledger_todos');
      const wallets = mockDb.get('ledger_wallets');

      // 1. 거래 내역 마이그레이션
      for (const t of txs) {
        if (!t.groupId) {
          const cleanTx = { ...t, groupId };
          delete cleanTx.id;
          await addDoc(collection(db, 'transactions'), cleanTx);
        }
      }

      // 2. 수입 내역 마이그레이션
      for (const inc of incomes) {
        if (!inc.groupId) {
          const cleanInc = { ...inc, groupId };
          delete cleanInc.id;
          await addDoc(collection(db, 'incomes'), cleanInc);
        }
      }

      // 3. 고정비 설정 마이그레이션
      for (const f of fixed) {
        if (!f.groupId) {
          const cleanF = { ...f, groupId };
          delete cleanF.id;
          await addDoc(collection(db, 'fixedExpenses'), cleanF);
        }
      }

      // 4. 용돈 지출 마이그레이션
      for (const p of pocket) {
        if (!p.groupId) {
          const cleanP = { ...p, groupId };
          delete cleanP.id;
          await addDoc(collection(db, 'pocketMoney'), cleanP);
        }
      }

      // 5. 할 일(Todos) 마이그레이션
      for (const td of todos) {
        if (!td.groupId) {
          const cleanTd = { ...td, groupId };
          delete cleanTd.id;
          await addDoc(collection(db, 'todos'), cleanTd);
        }
      }

      // 6. 지갑 잔고 업데이트 동기화
      const cloudWallets = await dbService.fetchWallets();
      for (const cw of cloudWallets) {
        const lw = wallets.find(w => w.name === cw.name);
        if (lw && lw.balance > 0) {
          await dbService.updateWalletBalance(cw.id, lw.balance);
        }
      }

      localStorage.removeItem('ledger_transactions');
      localStorage.removeItem('ledger_incomes');
      localStorage.removeItem('ledger_fixed_expenses');
      localStorage.removeItem('ledger_pocket_money_transactions');
      localStorage.removeItem('ledger_todos');
      return true;
    } catch (e) {
      console.error('Migration failed:', e);
      throw e;
    }
  },

  // --- 1. 수입 내역 (Incomes) ---
  fetchIncomes: async (monthStr, startDay = 1) => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const range = getMonthRange(monthStr, startDay);
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'incomes'),
            where('groupId', '==', groupId)
          );
          return getDocs(q);
        });

        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });
        
        return allData
          .filter(inc => inc.date && inc.date >= range.startDate && inc.date <= range.endDate)
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) {
        console.warn('Firebase fetchIncomes failed, falling back to local storage.', e);
      }
    }
    
    // Fallback
    const range = getMonthRange(monthStr, startDay);
    const incomes = mockDb.get('ledger_incomes');
    return incomes
      .filter(inc => inc.date && inc.date >= range.startDate && inc.date <= range.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  addIncome: async (incomeData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...incomeData, groupId };
        const docRef = await withTimeout(addDoc(collection(db, 'incomes'), payload), 2000);
        return { id: docRef.id, ...payload };
      } catch (e) {
        console.warn('Firebase addIncome failed, saving to local storage.', e);
      }
    }
    
    // Fallback
    const incomes = mockDb.get('ledger_incomes');
    const newIncome = { id: 'inc_' + Date.now(), ...incomeData };
    incomes.push(newIncome);
    mockDb.set('ledger_incomes', incomes);
    return newIncome;
  },

  updateIncome: async (id, incomeData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...incomeData, groupId };
        await withTimeout(updateDoc(doc(db, 'incomes', id), payload), 2000);
        return { id, ...payload };
      } catch (e) {
        console.warn('Firebase updateIncome failed, saving to local storage.', e);
      }
    }

    // Fallback
    const incomes = mockDb.get('ledger_incomes');
    const idx = incomes.findIndex(inc => inc.id === id);
    if (idx !== -1) {
      incomes[idx] = { ...incomes[idx], ...incomeData };
      mockDb.set('ledger_incomes', incomes);
      return incomes[idx];
    }
    return null;
  },

  deleteIncome: async (id) => {
    const db = getDb();
    if (isFirebaseEnabled() && getGroupId() && db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'incomes', id)), 2000);
        return true;
      } catch (e) {
        console.warn('Firebase deleteIncome failed, updating local storage.', e);
      }
    }
    
    // Fallback
    let incomes = mockDb.get('ledger_incomes');
    incomes = incomes.filter(inc => inc.id !== id);
    mockDb.set('ledger_incomes', incomes);
    return true;
  },

  // --- 2. 거래 내역 (Transactions) ---
  fetchTransactions: async (monthStr, startDay = 1) => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const range = getMonthRange(monthStr, startDay);
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'transactions'),
            where('groupId', '==', groupId)
          );
          return getDocs(q);
        });

        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });
        
        return allData
          .filter(t => t.date && t.date >= range.startDate && t.date <= range.endDate)
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) {
        console.warn('Firebase fetchTransactions failed, falling-back.', e);
      }
    }
    
    // Fallback
    const range = getMonthRange(monthStr, startDay);
    const transactions = mockDb.get('ledger_transactions');
    return transactions
      .filter(t => t.date && t.date >= range.startDate && t.date <= range.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  addTransaction: async (txData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...txData, groupId };
        const docRef = await withTimeout(addDoc(collection(db, 'transactions'), payload), 2000);
        return { id: docRef.id, ...payload };
      } catch (e) {
        console.warn('Firebase addTransaction failed, saving to local storage.', e);
      }
    }
    
    // Fallback
    const transactions = mockDb.get('ledger_transactions');
    const newTx = { id: 'tx_' + Date.now(), ...txData };
    transactions.push(newTx);
    mockDb.set('ledger_transactions', transactions);
    return newTx;
  },

  updateTransaction: async (id, txData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...txData, groupId };
        await withTimeout(updateDoc(doc(db, 'transactions', id), payload), 2000);
        return { id, ...payload };
      } catch (e) {
        console.warn('Firebase updateTransaction failed, updating local storage.', e);
      }
    }

    // Fallback
    const transactions = mockDb.get('ledger_transactions');
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], ...txData };
      mockDb.set('ledger_transactions', transactions);
      return transactions[idx];
    }
    return null;
  },

  deleteTransaction: async (id) => {
    const db = getDb();
    if (isFirebaseEnabled() && getGroupId() && db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'transactions', id)), 2000);
        return true;
      } catch (e) {
        console.warn('Firebase deleteTransaction failed, deleting from local storage.', e);
      }
    }
    
    // Fallback
    let transactions = mockDb.get('ledger_transactions');
    transactions = transactions.filter(t => t.id !== id);
    mockDb.set('ledger_transactions', transactions);
    return true;
  },

  // 할부 거래 일괄 등록
  async addInstallmentTransactions(txData, months) {
    const results = [];
    const baseAmount = Math.round(txData.amount / months);
    const [baseY, baseM, baseD] = txData.date.split('-').map(Number);
    
    for (let i = 0; i < months; i++) {
      const installDate = new Date(baseY, baseM - 1 + i, baseD);
      // 말일 보정: 원래 날짜의 일(day)이 해당 월의 말일보다 크면 말일로 보정
      if (installDate.getDate() !== baseD) {
        installDate.setDate(0); // 전월 말일로 보정
      }
      const dateStr = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}-${String(installDate.getDate()).padStart(2, '0')}`;
      
      // 마지막 회차는 나머지 금액을 보정하여 총합이 정확히 맞도록 처리
      const installAmount = (i === months - 1) ? txData.amount - baseAmount * (months - 1) : baseAmount;
      
      const installTx = {
        ...txData,
        name: `${txData.name} (${i + 1}/${months})`,
        amount: installAmount,
        date: dateStr,
        memo: txData.memo ? `${txData.memo} [할부 ${i + 1}/${months}]` : `[할부 ${i + 1}/${months}]`
      };
      
      const result = await this.addTransaction(installTx);
      results.push(result);
    }
    return results;
  },

  // --- 3. 고정 지출 (Fixed Expenses Master) ---
  fetchFixedExpenses: async () => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'fixedExpenses'),
            where('groupId', '==', groupId)
          );
          return getDocs(q);
        });

        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });

        return allData.sort((a, b) => a.day - b.day);
      } catch (e) {
        console.warn('Firebase fetchFixedExpenses failed, falling back.', e);
      }
    }
    
    // Fallback
    const fixed = mockDb.get('ledger_fixed_expenses');
    return fixed.sort((a, b) => a.day - b.day);
  },

  addFixedExpense: async (expenseData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...expenseData, groupId };
        const docRef = await withTimeout(addDoc(collection(db, 'fixedExpenses'), payload), 2000);
        return { id: docRef.id, ...payload };
      } catch (e) {
        console.warn(e);
      }
    }
    
    // Fallback
    const expenses = mockDb.get('ledger_fixed_expenses');
    const newFe = { id: 'fe_' + Date.now(), ...expenseData };
    expenses.push(newFe);
    mockDb.set('ledger_fixed_expenses', expenses);
    return newFe;
  },

  updateFixedExpense: async (id, expenseData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...expenseData, groupId };
        await withTimeout(updateDoc(doc(db, 'fixedExpenses', id), payload), 2000);
        return { id, ...payload };
      } catch (e) {
        console.warn(e);
      }
    }
    
    // Fallback
    const expenses = mockDb.get('ledger_fixed_expenses');
    const idx = expenses.findIndex(fe => fe.id === id);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], ...expenseData };
      mockDb.set('ledger_fixed_expenses', expenses);
      return expenses[idx];
    }
    return null;
  },

  deleteFixedExpense: async (id) => {
    const db = getDb();
    if (isFirebaseEnabled() && getGroupId() && db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'fixedExpenses', id)), 2000);
        return true;
      } catch (e) {
        console.warn(e);
      }
    }
    
    // Fallback
    let expenses = mockDb.get('ledger_fixed_expenses');
    expenses = expenses.filter(fe => fe.id !== id);
    mockDb.set('ledger_fixed_expenses', expenses);
    return true;
  },

  // --- 4. 지역화폐 및 페이 지갑 잔액 관리 (Wallets) ---
  fetchWallets: async () => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const representativeGroupId = getGroupId();
        const q = query(
          collection(db, 'wallets'),
          where('groupId', '==', representativeGroupId)
        );
        const snapshot = await withTimeout(getDocs(q), 2000);
        let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const defaultNames = ['서울사랑상품권', '땡겨요 페이', '비플페이'];

        if (data.length === 0) {
          const defaultWallets = defaultNames.map(name => ({
            name,
            balance: 0,
            groupId: representativeGroupId
          }));
          const created = [];
          for (const w of defaultWallets) {
            const docRef = await addDoc(collection(db, 'wallets'), w);
            created.push({ id: docRef.id, ...w });
          }
          return created;
        }

        // 이미 지갑 컬렉션은 있으나 "비플페이" 등 특정 지갑이 빠진 경우 동적 백그라운드 추가
        let hasModified = false;
        const updatedData = [...data];
        for (const name of defaultNames) {
          const exists = data.some(w => w.name === name);
          if (!exists) {
            const newW = { name, balance: 0, groupId: representativeGroupId };
            const docRef = await addDoc(collection(db, 'wallets'), newW);
            updatedData.push({ id: docRef.id, ...newW });
            hasModified = true;
          }
        }
        
        return updatedData;
      } catch (e) {
        console.warn('Firebase fetchWallets failed, falling-back.', e);
      }
    }
    
    // Fallback
    const localWallets = mockDb.get('ledger_wallets');
    const defaultNames = ['서울사랑상품권', '땡겨요 페이', '비플페이'];
    
    let hasModified = false;
    const updatedLocal = [...localWallets];
    for (const name of defaultNames) {
      const exists = localWallets.some(w => w.name === name);
      if (!exists) {
        updatedLocal.push({ id: 'w_' + Date.now() + '_' + Math.random(), name, balance: 0 });
        hasModified = true;
      }
    }
    if (hasModified) {
      mockDb.set('ledger_wallets', updatedLocal);
    }
    return updatedLocal;
  },

  updateWalletBalance: async (id, newBalance) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        await withTimeout(updateDoc(doc(db, 'wallets', id), { balance: newBalance }), 2000);
        return true;
      } catch (e) {
        console.warn(e);
      }
    }
    
    // Fallback
    const wallets = mockDb.get('ledger_wallets');
    const idx = wallets.findIndex(w => w.id === id);
    if (idx !== -1) {
      wallets[idx].balance = newBalance;
      mockDb.set('ledger_wallets', wallets);
      return true;
    }
    return false;
  },

  // --- 5. 독립 용돈 세부 지출 관리 (Pocket Money Transactions) ---
  fetchPocketMoneyTransactions: async (monthStr, user, startDay = 1) => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const range = getMonthRange(monthStr, startDay);
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'pocketMoney'),
            where('groupId', '==', groupId),
            where('user', '==', user)
          );
          return getDocs(q);
        });

        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });

        return allData
          .filter(t => t.date && t.date >= range.startDate && t.date <= range.endDate)
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) {
        console.warn('Firebase fetchPocketMoney failed, falling back.', e);
      }
    }

    // Fallback
    const range = getMonthRange(monthStr, startDay);
    const list = mockDb.get('ledger_pocket_money_transactions');
    return list
      .filter(t => t.user === user && t.date && t.date >= range.startDate && t.date <= range.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  addPocketMoneyTransaction: async (txData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...txData, groupId };
        const docRef = await withTimeout(addDoc(collection(db, 'pocketMoney'), payload), 2000);
        return { id: docRef.id, ...payload };
      } catch (e) {
        console.warn(e);
      }
    }

    // Fallback
    const list = mockDb.get('ledger_pocket_money_transactions');
    const newTx = { id: 'pm_' + Date.now(), ...txData };
    list.push(newTx);
    mockDb.set('ledger_pocket_money_transactions', list);
    return newTx;
  },

  deletePocketMoneyTransaction: async (id) => {
    const db = getDb();
    if (isFirebaseEnabled() && getGroupId() && db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'pocketMoney', id)), 2000);
        return true;
      } catch (e) {
        console.warn(e);
      }
    }

    // Fallback
    let list = mockDb.get('ledger_pocket_money_transactions');
    list = list.filter(t => t.id !== id);
    mockDb.set('ledger_pocket_money_transactions', list);
    return true;
  },

  // --- 6. 사용자 환경설정 (Settings) ---
  fetchSettings: async () => {
    const representativeGroupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && representativeGroupId && db) {
      try {
        const q = query(
          collection(db, 'settings'),
          where('groupId', '==', representativeGroupId)
        );
        const snapshot = await withTimeout(getDocs(q), 2000);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) {
          return data[0];
        }
      } catch (e) {
        console.warn('Firebase fetchSettings failed, using local settings.', e);
      }
    }
    
    // Fallback
    const startDay = localStorage.getItem('ledger_start_day') || '1';
    return { startDay: parseInt(startDay, 10) };
  },

  updateSettings: async (settingsData) => {
    const representativeGroupId = getGroupId();
    const db = getDb();
    if (settingsData.startDay) {
      localStorage.setItem('ledger_start_day', settingsData.startDay.toString());
    }
    
    if (isFirebaseEnabled() && representativeGroupId && db) {
      try {
        const q = query(
          collection(db, 'settings'),
          where('groupId', '==', representativeGroupId)
        );
        const snapshot = await getDocs(q);
        const payload = { ...settingsData, groupId: representativeGroupId };
        
        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          await withTimeout(updateDoc(doc(db, 'settings', docId), payload), 2000);
        } else {
          await withTimeout(addDoc(collection(db, 'settings'), payload), 2000);
        }
        return true;
      } catch (e) {
        console.warn('Firebase updateSettings failed.', e);
      }
    }
    return false;
  },

  // --- 7. 일별 할 일 관리 (Todos) ---
  fetchTodos: async (monthStr) => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'todos'),
            where('groupId', '==', groupId)
          );
          return getDocs(q);
        });

        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });
        
        const filtered = allData.filter(todo => todo.date && todo.date.startsWith(monthStr));
        filtered.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 0;
          const orderB = b.order !== undefined ? b.order : 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.id.localeCompare(b.id);
        });
        return filtered;
      } catch (e) {
        console.warn('Firebase fetchTodos failed, using local storage.', e);
      }
    }
    
    // Fallback
    const list = mockDb.get('ledger_todos');
    const filtered = list.filter(todo => todo.date && todo.date.startsWith(monthStr));
    filtered.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
    return filtered;
  },

  addTodo: async (todoData) => {
    const groupId = getGroupId();
    const db = getDb();
    const payload = { 
      order: Date.now(),
      ...todoData 
    };
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const fullPayload = { ...payload, groupId };
        const docRef = await withTimeout(addDoc(collection(db, 'todos'), fullPayload), 2000);
        return { id: docRef.id, ...fullPayload };
      } catch (e) {
        console.warn('Firebase addTodo failed.', e);
      }
    }
    
    // Fallback
    const list = mockDb.get('ledger_todos');
    const newTodo = { id: 'todo_' + Date.now(), ...payload };
    list.push(newTodo);
    mockDb.set('ledger_todos', list);
    return newTodo;
  },

  updateTodo: async (id, todoData) => {
    const groupId = getGroupId();
    const db = getDb();
    if (isFirebaseEnabled() && groupId && db) {
      try {
        const payload = { ...todoData, groupId };
        await withTimeout(updateDoc(doc(db, 'todos', id), payload), 2000);
        return { id, ...payload };
      } catch (e) {
        console.warn('Firebase updateTodo failed.', e);
      }
    }
    
    // Fallback
    const list = mockDb.get('ledger_todos');
    const idx = list.findIndex(todo => todo.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...todoData };
      mockDb.set('ledger_todos', list);
      return list[idx];
    }
    return null;
  },

  deleteTodo: async (id) => {
    const db = getDb();
    if (isFirebaseEnabled() && getGroupId() && db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'todos', id)), 2000);
        return true;
      } catch (e) {
        console.warn('Firebase deleteTodo failed.', e);
      }
    }
    
    // Fallback
    let list = mockDb.get('ledger_todos');
    list = list.filter(todo => todo.id !== id);
    mockDb.set('ledger_todos', list);
    return true;
  },

  // --- 8. 신용카드 청구/정산 관리 (Card Bills) ---
  fetchCardBills: async (billMonth) => {
    const ids = getQueryGroupIds();
    const db = getDb();
    if (isFirebaseEnabled() && ids.length > 0 && db) {
      try {
        const promises = ids.map(groupId => {
          const q = query(
            collection(db, 'cardBills'),
            where('groupId', '==', groupId),
            where('billMonth', '==', billMonth)
          );
          return getDocs(q);
        });
        const snapshots = await withTimeout(Promise.all(promises), 2000);
        let allData = [];
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allData.push({ id: doc.id, ...doc.data() });
          });
        });
        return allData;
      } catch (e) {
        console.warn('Firebase fetchCardBills failed, using local fallback.', e);
      }
    }

    // Fallback
    const list = mockDb.get('ledger_card_bills') || [];
    return list.filter(bill => bill.billMonth === billMonth);
  },

  updateCardBillStatus: async (cardName, billMonth, isPaid) => {
    const representativeGroupId = getGroupId();
    const db = getDb();
    const payload = {
      cardName,
      billMonth,
      isPaid,
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseEnabled() && representativeGroupId && db) {
      try {
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
          await withTimeout(updateDoc(doc(db, 'cardBills', docId), fullPayload), 2000);
          return { id: docId, ...fullPayload };
        } else {
          const docRef = await withTimeout(addDoc(collection(db, 'cardBills'), fullPayload), 2000);
          return { id: docRef.id, ...fullPayload };
        }
      } catch (e) {
        console.warn('Firebase updateCardBillStatus failed.', e);
      }
    }

    // Fallback
    const list = mockDb.get('ledger_card_bills') || [];
    const idx = list.findIndex(bill => bill.cardName === cardName && bill.billMonth === billMonth);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload };
    } else {
      list.push({ id: 'bill_' + Date.now(), ...payload });
    }
    mockDb.set('ledger_card_bills', list);
    return true;
  }
};
