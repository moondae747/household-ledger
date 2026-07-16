import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, Trash2, RotateCcw } from 'lucide-react';

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [formula, setFormula] = useState('');
  const [history, setHistory] = useState([]);
  
  // 드래그 가능한 플로팅 버튼 위치 상태 (기본값: 우측 하단)
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const buttonStartPos = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const popupRef = useRef(null);

  // 로컬스토리지에서 계산 기록 로드
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('calculator_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Failed to load calculator history:', e);
    }
  }, []);

  // 화면 크기 변경 시 버튼 위치가 화면 밖으로 나가지 않도록 조정
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const maxX = window.innerWidth - 70;
        const maxY = window.innerHeight - 70;
        return {
          x: Math.max(16, Math.min(prev.x, maxX)),
          y: Math.max(16, Math.min(prev.y, maxY))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 계산기 활성화 시 첫 버튼 자동 포커싱으로 키보드 모드 진입 유도
  useEffect(() => {
    if (isOpen && popupRef.current) {
      const firstBtn = popupRef.current.querySelector('.calc-btn');
      if (firstBtn) firstBtn.focus();
    }
  }, [isOpen]);

  // 계산 기록 로컬스토리지 저장
  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem('calculator_history', JSON.stringify(newHistory));
  };

  // --- 키보드 입력 감지 및 전역/다른 요소 동작 차단 ---
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // 포커스가 외부 일반 input/textarea에 있다면 키보드 계산기 차단 (검색창, 내역 수정창 등 배려)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        if (!popupRef.current || !popupRef.current.contains(activeEl)) {
          return;
        }
      }

      const key = e.key;

      // 숫자
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        e.stopPropagation();
        handleNum(Number(key));
      }
      // 연산자
      else if (['+', '-', '*', '/'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        handleOperator(key);
      }
      else if (key === 'x' || key === 'X') {
        e.preventDefault();
        e.stopPropagation();
        handleOperator('*');
      }
      // 소수점
      else if (key === '.') {
        e.preventDefault();
        e.stopPropagation();
        handleDot();
      }
      // 계산 실행 (Enter, =)
      else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        e.stopPropagation();
        handleEqual();
      }
      // 백스페이스
      else if (key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleBackspace();
      }
      // 초기화 및 ESC 닫기
      else if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
      else if (key === 'c' || key === 'C' || key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        handleClear();
      }
      // 계산기 내부 탭 포커스 트랩 (키보드 탭 이동 시 외부 이탈 방지)
      else if (key === 'Tab' && popupRef.current) {
        const focusableEls = popupRef.current.querySelectorAll('button, input, [tabindex="0"]');
        if (focusableEls.length > 0) {
          const firstEl = focusableEls[0];
          const lastEl = focusableEls[focusableEls.length - 1];
          if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstEl) {
              lastEl.focus();
              e.preventDefault();
            }
          } else { // Tab
            if (document.activeElement === lastEl) {
              firstEl.focus();
              e.preventDefault();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // 캡처링 단계에서 포착하여 타 요소 단축키 차단
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, formula, display, history]);

  // --- 드래그앤드롭 이벤트 핸들러 ---
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    buttonStartPos.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    
    setPosition({
      x: Math.max(16, Math.min(buttonStartPos.current.x + dx, maxX)),
      y: Math.max(16, Math.min(buttonStartPos.current.y + dy, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    buttonStartPos.current = { x: position.x, y: position.y };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartPos.current.x;
    const dy = e.touches[0].clientY - dragStartPos.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;

    setPosition({
      x: Math.max(16, Math.min(buttonStartPos.current.x + dx, maxX)),
      y: Math.max(16, Math.min(buttonStartPos.current.y + dy, maxY))
    });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const handleButtonClick = () => {
    if (!hasMovedRef.current) {
      setIsOpen(!isOpen);
    }
  };

  // --- 계산기 기능 로직 ---
  const handleNum = (num) => {
    setDisplay(prev => {
      if (prev === '0' || prev === 'Error') return num.toString();
      return prev + num;
    });
  };

  const handleOperator = (op) => {
    if (display === 'Error') return;
    setFormula(prev => {
      const lastChar = prev.trim().slice(-1);
      if (['+', '-', '*', '/'].includes(lastChar) && display === '0') {
        return prev.trim().slice(0, -1) + ' ' + op + ' ';
      }
      return prev + display + ' ' + op + ' ';
    });
    setDisplay('0');
  };

  const handleDot = () => {
    if (display.includes('.')) return;
    setDisplay(prev => prev + '.');
  };

  const handleClear = () => {
    setDisplay('0');
    setFormula('');
  };

  const handleBackspace = () => {
    setDisplay(prev => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  };

  const handleToggleSign = () => {
    if (display === '0' || display === 'Error') return;
    setDisplay(prev => {
      if (prev.startsWith('-')) return prev.slice(1);
      return '-' + prev;
    });
  };

  const handleEqual = () => {
    if (display === 'Error') return;
    const fullExpression = formula + display;
    if (!fullExpression.trim()) return;

    let cleaned = fullExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
    if (/^[0-9+\-*/().\s]+$/.test(cleaned)) {
      try {
        const result = new Function(`return (${cleaned})`)();
        if (isFinite(result)) {
          const finalResult = parseFloat(result.toFixed(10)).toString();
          setDisplay(finalResult);
          setFormula('');

          const record = {
            id: Date.now().toString(),
            expr: fullExpression,
            result: finalResult
          };
          saveHistory([record, ...history].slice(0, 50));
        } else {
          setDisplay('Error');
        }
      } catch (e) {
        setDisplay('Error');
      }
    } else {
      setDisplay('Error');
    }
  };

  const handleSelectHistory = (result) => {
    setDisplay(result);
  };

  const handleClearHistory = () => {
    if (confirm('계산 기록을 모두 삭제하시겠습니까?')) {
      saveHistory([]);
    }
  };

  const formatComma = (val) => {
    if (val === 'Error') return val;
    const [integer, decimal] = val.split('.');
    const formattedInteger = Number(integer).toLocaleString('ko-KR');
    return decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger;
  };


  return (
    <div style={{ zIndex: 9999, position: 'relative' }}>
      {/* 둥근 플로팅 버튼 */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleButtonClick}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: isOpen ? 'var(--expense-color)' : 'var(--accent-color)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
          transition: isDragging ? 'none' : 'background-color 0.2s, transform 0.2s',
          userSelect: 'none',
          touchAction: 'none'
        }}
        className="floating-calc-btn"
        title="드래그로 이동 가능 / 클릭 시 계산기"
      >
        {isOpen ? <X size={24} /> : <Calculator size={24} />}
      </div>

      {/* 계산기 팝업 창 */}
      {isOpen && (
        <div
          ref={popupRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: `${Math.min(position.x - 340, window.innerWidth - 640)}px`,
            top: `${Math.max(20, Math.min(position.y - 380, window.innerHeight - 440))}px`,
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            width: '600px',
            maxWidth: '90vw',
            animation: 'scaleUp 0.15s ease-out',
            outline: 'none'
          }}
          className="calc-popup-container"
        >
          {/* 스타일 주입 */}
          <style>{`
            @keyframes scaleUp {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .calc-btn {
              border: none;
              background-color: var(--bg-tertiary);
              color: var(--text-primary);
              font-size: 15px;
              font-weight: 700;
              border-radius: var(--radius-sm);
              cursor: pointer;
              transition: background-color 0.1s;
              padding: 12px;
              display: flex;
              alignItems: center;
              justifyContent: center;
            }
            .calc-btn:hover {
              background-color: var(--border-color);
            }
            .calc-btn.op-btn {
              background-color: var(--accent-light);
              color: var(--accent-color);
            }
            .calc-btn.op-btn:hover {
              background-color: var(--accent-color);
              color: #ffffff;
            }
            .calc-btn.eq-btn {
              background-color: var(--accent-color);
              color: #ffffff;
            }
            .calc-btn.eq-btn:hover {
              filter: brightness(1.1);
            }
            .calc-btn.clear-btn {
              background-color: var(--expense-light);
              color: var(--expense-color);
            }
            .calc-btn.clear-btn:hover {
              background-color: var(--expense-color);
              color: #ffffff;
            }
            @media (max-width: 640px) {
              .calc-popup-container {
                flex-direction: column;
                width: 320px;
                left: 5vw !important;
                top: 10vh !important;
              }
              .calc-history-panel {
                border-left: none !important;
                border-top: 1px solid var(--border-color);
                max-height: 120px;
              }
            }
          `}</style>

          {/* 계산기 본체 */}
          <div style={{ flex: 1.1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                <Calculator size={13} /> 미니 계산기
              </span>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* 디스플레이 화면 */}
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                textAlign: 'right',
                minHeight: '76px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                wordBreak: 'break-all'
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', minHeight: '16px', marginBottom: '2px' }}>
                {formula}
              </div>
              <div style={{ fontSize: display.length > 12 ? '18px' : '22px', fontWeight: '850', color: 'var(--text-primary)' }}>
                {formatComma(display)}
              </div>
            </div>

            {/* 키패드 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <button onClick={handleClear} className="calc-btn clear-btn">C</button>
              <button onClick={handleToggleSign} className="calc-btn op-btn">+/-</button>
              <button onClick={handleBackspace} className="calc-btn op-btn">←</button>
              <button onClick={() => handleOperator('/')} className="calc-btn op-btn">÷</button>

              <button onClick={() => handleNum(7)} className="calc-btn">7</button>
              <button onClick={() => handleNum(8)} className="calc-btn">8</button>
              <button onClick={() => handleNum(9)} className="calc-btn">9</button>
              <button onClick={() => handleOperator('*')} className="calc-btn op-btn">×</button>

              <button onClick={() => handleNum(4)} className="calc-btn">4</button>
              <button onClick={() => handleNum(5)} className="calc-btn">5</button>
              <button onClick={() => handleNum(6)} className="calc-btn">6</button>
              <button onClick={() => handleOperator('-')} className="calc-btn op-btn">-</button>

              <button onClick={() => handleNum(1)} className="calc-btn">1</button>
              <button onClick={() => handleNum(2)} className="calc-btn">2</button>
              <button onClick={() => handleNum(3)} className="calc-btn">3</button>
              <button onClick={() => handleOperator('+')} className="calc-btn op-btn">+</button>

              <button onClick={() => handleNum(0)} className="calc-btn" style={{ gridColumn: 'span 2' }}>0</button>
              <button onClick={handleDot} className="calc-btn">.</button>
              <button onClick={handleEqual} className="calc-btn eq-btn">=</button>
            </div>
          </div>

          {/* 계산 기록 패널 */}
          <div
            className="calc-history-panel"
            style={{
              flex: 0.9,
              borderLeft: '1px solid var(--border-color)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-tertiary)',
              maxWidth: '300px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-secondary)' }}>계산 기록</span>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  style={{ background: 'none', border: 'none', color: 'var(--expense-color)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <Trash2 size={12} /> 비우기
                </button>
              )}
            </div>

            {/* 기록 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', paddingRight: '4px' }}>
              {history.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: '8px', fontSize: '11.5px', padding: '24px 0' }}>
                  <RotateCcw size={16} />
                  <span>기록이 없습니다.</span>
                </div>
              ) : (
                history.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectHistory(item.result)}
                    style={{
                      padding: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      textAlign: 'right',
                      transition: 'border-color 0.1s'
                    }}
                    className="list-item-hover"
                    title="클릭 시 결과값을 계산기에 입력"
                  >
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '10.5px', marginBottom: '2px', wordBreak: 'break-all' }}>
                      {item.expr} =
                    </div>
                    <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                      {formatComma(item.result)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
