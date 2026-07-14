import { dbService } from '../dbService';

/**
 * 이번 달의 고정 지출 및 고정 수입 자동 등록 기능 수행 (초고속 인메모리 방식)
 */
export const runFixedExpensesAutomation = async (monthStr, fixedMasters, currentTransactions, currentIncomes) => {
  try {
    const masters = fixedMasters || await dbService.fetchFixedExpenses();
    const txs = currentTransactions || await dbService.fetchTransactions(monthStr);
    const incs = currentIncomes || await dbService.fetchIncomes(monthStr);
    
    // 현재 날짜 정보
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayDay = today.getDate();
    
    // 타겟 달이 미래인 경우 자동화 안 함
    if (monthStr > currentYearMonth) {
      return [];
    }

    const isCurrentMonth = monthStr === currentYearMonth;
    const addedItems = [];

    for (const master of masters) {
      if (isCurrentMonth && todayDay < master.day) {
        continue;
      }

      const isIncomeType = master.type === 'income';

      if (isIncomeType) {
        const isAlreadyRegistered = incs.some(inc => 
          inc.name === master.name && 
          inc.amount === master.amount
        );

        if (!isAlreadyRegistered) {
          const dateDay = String(master.day).padStart(2, '0');
          const incomeDate = `${monthStr}-${dateDay}`;

          const newIncome = {
            name: master.name,
            amount: master.amount,
            date: incomeDate,
            user: master.user || '공동',
            method: master.method || '계좌이체',
            isAuto: true
          };

          const savedIncome = await dbService.addIncome(newIncome);
          addedItems.push({ ...savedIncome, autoType: 'income' });

          // ⚡ 정기 수입의 수령 방법(method)이 등록된 지갑 이름일 경우, 지갑 잔액 충전(+) 연동
          const wallets = await dbService.fetchWallets();
          const targetWallet = wallets.find(w => w.name === master.method);
          if (targetWallet) {
            await dbService.updateWalletBalance(targetWallet.id, targetWallet.balance + master.amount);
          }
        }
      } else {
        const isAlreadyRegistered = txs.some(t => 
          t.name === master.name && 
          t.amount === master.amount && 
          t.category === master.category
        );

        if (!isAlreadyRegistered) {
          const dateDay = String(master.day).padStart(2, '0');
          const txDate = `${monthStr}-${dateDay}`;

          const newTx = {
            name: master.name,
            amount: master.amount,
            date: txDate,
            category: master.category,
            user: master.user || '공동',
            method: master.method || '계좌이체',
            type: 'expense',
            isAuto: true
          };

          const savedTx = await dbService.addTransaction(newTx);
          addedItems.push({ ...savedTx, autoType: 'expense' });

          // 특정 지역화폐/페이 결제일 경우 지갑 차감 연동
          if (master.method && master.method.includes('카드결제') && master.method.includes('사랑')) {
            const wallets = await dbService.fetchWallets();
            let targetWallet = null;
            if (master.name.includes('서울사랑') || master.method.includes('서울')) {
              targetWallet = wallets.find(w => w.name.includes('서울사랑'));
            } else if (master.name.includes('광진사랑') || master.method.includes('광진')) {
              targetWallet = wallets.find(w => w.name.includes('광진사랑'));
            }
            
            if (targetWallet && targetWallet.balance >= master.amount) {
              await dbService.updateWalletBalance(targetWallet.id, targetWallet.balance - master.amount);
            }
          }
        }
      }
    }

    return addedItems;
  } catch (error) {
    console.error('Fixed expenses/incomes automation error:', error);
    return [];
  }
};
