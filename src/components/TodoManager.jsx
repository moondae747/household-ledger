import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  CalendarDays, 
  CheckSquare,
  GripVertical
} from 'lucide-react';

export default function TodoManager({ currentMonth, startDay, currentUser }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 선택된 날짜 (기본값: 오늘 날짜 YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState('');
  
  // 입력 폼 상태
  const [newTodoText, setNewTodoText] = useState('');
  
  // 인라인 수정용 상태
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // 현재 년/월 파싱
  const [year, month] = currentMonth.split('-').map(Number);

  const loadTodos = async () => {
    setLoading(true);
    try {
      const data = await dbService.fetchTodos(currentMonth);
      setTodos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, [currentMonth]);

  // 오늘 날짜로 초기 선택일자 지정
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    
    // 만약 currentMonth 가 오늘 년월과 일치하면 오늘 날짜 선택, 다르면 해당 월의 1일 선택
    if (currentMonth === `${y}-${m}`) {
      setSelectedDate(`${y}-${m}-${d}`);
    } else {
      setSelectedDate(`${currentMonth}-01`);
    }
  }, [currentMonth]);

  // 1. 할 일 추가
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTodo = {
      name: newTodoText.trim(),
      completed: false,
      date: selectedDate,
      user: currentUser || '공동'
    };

    try {
      const created = await dbService.addTodo(newTodo);
      if (created) {
        setTodos(prev => [...prev, created]);
        setNewTodoText('');
      }
    } catch (e) {
      console.error(e);
      alert('할 일 추가에 실패했습니다.');
    }
  };

  // 2. 체크 토글
  const handleToggleTodo = async (todo) => {
    try {
      const updated = await dbService.updateTodo(todo.id, {
        ...todo,
        completed: !todo.completed
      });
      if (updated) {
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. 수정 모드 시작
  const handleStartEdit = (todo) => {
    setEditingTodoId(todo.id);
    setEditingText(todo.name);
  };

  // 4. 수정 완료 저장
  const handleSaveEdit = async (todo) => {
    if (!editingText.trim()) return;
    try {
      const updated = await dbService.updateTodo(todo.id, {
        ...todo,
        name: editingText.trim()
      });
      if (updated) {
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
        setEditingTodoId(null);
      }
    } catch (e) {
      console.error(e);
      alert('수정에 실패했습니다.');
    }
  };

  // 5. 할 일 삭제
  const handleDeleteTodo = async (id) => {
    if (!confirm('이 할 일을 정말 삭제하시겠습니까?')) return;
    try {
      const success = await dbService.deleteTodo(id);
      if (success) {
        setTodos(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 6. 드래그 앤 드롭 순서 변경 (우선순위)
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [touchStartIdx, setTouchStartIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedIdx(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;

    const dayTodos = todos.filter(t => t.date === selectedDate);
    const list = [...dayTodos];
    const draggedItem = list[draggedIdx];
    list.splice(draggedIdx, 1);
    list.splice(index, 0, draggedItem);

    // 임시 순서 적용
    const nextTodos = todos.map(t => {
      if (t.date !== selectedDate) return t;
      const dayIdx = list.findIndex(item => item.id === t.id);
      return { ...t, tempIdx: dayIdx };
    });

    nextTodos.sort((a, b) => {
      if (a.date === selectedDate && b.date === selectedDate) {
        return a.tempIdx - b.tempIdx;
      }
      return 0;
    });

    setTodos(nextTodos);
    setDraggedIdx(index);
  };

  const handleDropFinal = async () => {
    const dayTodos = todos.filter(t => t.date === selectedDate);
    try {
      setLoading(true);
      for (let i = 0; i < dayTodos.length; i++) {
        const item = dayTodos[i];
        await dbService.updateTodo(item.id, { ...item, order: i });
      }
      await loadTodos();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    await handleDropFinal();
  };

  // 모바일 터치 드래그 앤 드롭 핸들러
  const handleTouchStart = (index) => {
    setTouchStartIdx(index);
  };

  const handleTouchMove = (e) => {
    if (touchStartIdx === null) return;
    const touchY = e.touches[0].clientY;
    const elements = document.querySelectorAll('.todo-item');
    
    let targetIndex = null;
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom) {
        targetIndex = index;
      }
    });

    if (targetIndex !== null && targetIndex !== touchStartIdx) {
      const dayTodos = todos.filter(t => t.date === selectedDate);
      const list = [...dayTodos];
      const draggedItem = list[touchStartIdx];
      list.splice(touchStartIdx, 1);
      list.splice(targetIndex, 0, draggedItem);

      const nextTodos = todos.map(t => {
        if (t.date !== selectedDate) return t;
        const dayIdx = list.findIndex(item => item.id === t.id);
        return { ...t, tempIdx: dayIdx };
      });

      nextTodos.sort((a, b) => {
        if (a.date === selectedDate && b.date === selectedDate) {
          return a.tempIdx - b.tempIdx;
        }
        return 0;
      });

      setTodos(nextTodos);
      setTouchStartIdx(targetIndex);
    }
  };

  const handleTouchEnd = async () => {
    setTouchStartIdx(null);
    await handleDropFinal();
  };

  // --- 📅 캘린더 드로잉에 필요한 변수 연산 ---
  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const getFirstDayOfWeek = (y, m) => new Date(y, m - 1, 1).getDay(); // 0(일)~6(토)

  const totalDays = getDaysInMonth(year, month);
  const startDayOfWeek = getFirstDayOfWeek(year, month);

  // 달력 배열 빌드 (빈 칸 포함)
  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({ empty: true });
  }
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTodos = todos.filter(t => t.date === dateStr);
    calendarCells.push({
      empty: false,
      dayNum: d,
      dateStr,
      todos: dayTodos
    });
  }

  // 선택된 날짜의 할 일 목록
  const selectedDateTodos = todos.filter(t => t.date === selectedDate);
  const selectedDayNum = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{currentUser} 일별 할일</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            날짜를 클릭하고 할 일을 확인하거나 새로 등록할 수 있습니다. 부부 계정에 실시간 동기화됩니다.
          </p>
        </div>
      </div>

      <div className="todo-layout">
        
        {/* 달력 카드 구역 */}
        <div className="card calendar-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <CalendarDays size={16} style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {year}년 {month}월 달력
            </span>
          </div>

          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}
            
            {loading ? (
              <div style={{ gridColumn: 'span 7', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                일별 할 일 동기화 중...
              </div>
            ) : (
              calendarCells.map((cell, idx) => {
                if (cell.empty) {
                  return <div key={`empty-${idx}`} className="calendar-day empty" />;
                }

                const isSelected = cell.dateStr === selectedDate;
                const isToday = (() => {
                  const today = new Date();
                  return today.getFullYear() === year &&
                         (today.getMonth() + 1) === month &&
                         today.getDate() === cell.dayNum;
                })();

                return (
                  <div 
                    key={cell.dateStr} 
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setSelectedDate(cell.dateStr)}
                  >
                    <span className="calendar-day-num">{cell.dayNum}</span>
                    <div className="calendar-todo-dots">
                      {cell.todos.slice(0, 3).map((_, dotIdx) => (
                        <div key={dotIdx} className="calendar-todo-dot" />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 할 일 상세 리스트 구역 */}
        <div className="card todo-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckSquare size={16} style={{ color: 'var(--income-color)' }} />
              {month}월 {selectedDayNum}일 할 일 목록 ({selectedDateTodos.length}건)
            </span>
            <span className="badge joint" style={{ fontSize: '10px' }}>오늘의 할 일</span>
          </div>

          {/* 할 일 추가 폼 */}
          <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="form-input"
              style={{ flex: 1, padding: '10px', fontSize: '13px', marginBottom: 0 }}
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="여기에 오늘 할 일 추가..."
              required
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={16} /> 추가
            </button>
          </form>

          {/* 할 일 렌더러 */}
          <div className="todo-list">
            {selectedDateTodos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                선택된 날짜에 등록된 할 일이 없습니다.<br />위의 칸에 적어서 새로 추가해 보세요!
              </div>
            ) : (
              selectedDateTodos.map((todo, idx) => {
                const isEditing = editingTodoId === todo.id;
                return (
                  <div 
                    key={todo.id} 
                    className="todo-item"
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onTouchStart={() => handleTouchStart(idx)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="todo-item-left">
                      {!isEditing && (
                        <div className="todo-drag-handle" style={{ marginRight: '6px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', cursor: 'grab' }}>
                          <GripVertical size={14} />
                        </div>
                      )}
                      
                      {!isEditing && (
                        <div 
                          className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                          onClick={() => handleToggleTodo(todo)}
                        />
                      )}
                      
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <input 
                            type="text"
                            className="form-input"
                            style={{ flex: 1, padding: '6px 10px', fontSize: '13px', marginBottom: 0 }}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            required
                          />
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ padding: '6px 10px', backgroundColor: 'var(--income-color)' }}
                            onClick={() => handleSaveEdit(todo)}
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px' }}
                            onClick={() => setEditingTodoId(null)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span 
                          className={`todo-text ${todo.completed ? 'completed' : ''}`}
                          onDoubleClick={() => handleStartEdit(todo)}
                        >
                          {todo.name}
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="todo-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button 
                          onClick={() => handleStartEdit(todo)}
                          style={{ color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', padding: '2px' }}
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTodo(todo.id)}
                          style={{ color: 'var(--expense-color)', background: 'none', cursor: 'pointer', padding: '2px' }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
