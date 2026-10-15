'use client';

import { memo } from 'react';
import { parseShiftValue, getShiftTimeDisplay, getShiftTooltipLabel } from '@/lib/shiftUtils';
import { STATUS_CODES } from '@/lib/constants';
import { Building2 } from 'lucide-react';
import { EmployeeAvatar, checkIsWorkingNow, useCellActiveMap } from './schedule/shared';

// Geriye donuk uyumluluk icin re-export
export { EmployeeAvatar, checkIsWorkingNow };

// ─── Vardiya Hücresi ───
// P2 optimizasyonu: effectiveMinutes/effectiveDayIdx artık bu bileşene gelmiyor.
// Bunun yerine EmployeeRow'da bir kez hesaplanan isActiveDayIdx ve per-cell isActive
// boolean'ı alınıyor. effectiveMinutes değişince sadece EmployeeRow re-render alır;
// ShiftCellRenderer isActive değeri değişmediği sürece re-render ALMAZ.

export const ShiftCellRenderer = memo(function ShiftCellRenderer({ shift, isToday, isActive }) {
  if (!shift) return <span className="shift-cell" style={{ opacity: 0.3 }}>—</span>;

  if (shift.isStatusCode) {
    const info = STATUS_CODES[shift.code] || shift;
    return (
      <div className="tooltip-wrap">
        <span
          className="shift-cell shift-cell-status"
          style={{
            color: info.color,
            background: info.bg,
            borderColor: info.color + '30',
          }}
        >
          <span className="status-icon">{info.icon}</span>
          {shift.code}
        </span>
        <div className="tooltip">{info.label}</div>
      </div>
    );
  }

  return (
    <div className="tooltip-wrap">
      <span
        className={`shift-cell ${isActive ? 'working' : ''}`}
        style={{
          color: shift.color,
          background: shift.bg,
          borderColor: isActive ? shift.color : shift.border,
        }}
      >
        {getShiftTimeDisplay(shift)}
      </span>
      <div className="tooltip">
        {getShiftTooltipLabel(shift)} · {Math.floor(shift.duration / 60)}s {shift.duration % 60}dk
        {isActive && ' · 🟢 Çalışıyor'}
      </div>
    </div>
  );
});

// ─── Çalışan Satırı ───
// P2: isActive hesapları burada (satır başına bir kez) yürütülür.
// Her gün için isActive boolean'ı hesaplanır, ShiftCellRenderer'a geçilir.

export const EmployeeRow = memo(function EmployeeRow({ emp, todayIdx, effectiveDayIdx, effectiveMinutes, isMe, onPeek, prevWeekLastDayShiftStr, zebraParity }) {
  const isWorkingNow = checkIsWorkingNow(emp, effectiveDayIdx, effectiveMinutes, prevWeekLastDayShiftStr);
  const cellActiveMap = useCellActiveMap(emp.shifts, effectiveDayIdx, effectiveMinutes);

  return (
    <tr
      data-emp-id={emp.id}
      data-zebra={zebraParity}
      className={isMe ? 'my-profile-row' : ''}
      style={{ cursor: 'pointer' }}
    >
      <td onClick={() => onPeek?.(emp)} style={{ cursor: 'pointer' }}>
        <div className="employee-cell">
          <EmployeeAvatar emp={emp} isWorkingNow={isWorkingNow} />
          <span className="employee-name">{emp.name}</span>
        </div>
      </td>
      <td onClick={() => onPeek?.(emp)} style={{ cursor: 'pointer' }}>
        {emp.serviceRoute && (
          <span className="employee-route">{emp.serviceRoute}</span>
        )}
      </td>
      {emp.shifts.map((shiftStr, dayIdx) => {
        const shift = parseShiftValue(shiftStr);
        const isToday = dayIdx === todayIdx;
        return (
          <td key={dayIdx} className={isToday ? 'today-col' : ''}>
            <ShiftCellRenderer
              shift={shift}
              isToday={isToday}
              isActive={cellActiveMap[dayIdx]}
            />
          </td>
        );
      })}
      <td>
        <span className="total-cell">{emp.totalHours}</span>
      </td>
    </tr>
  );
});

// ─── Departman Bölümü ───

export const DepartmentSection = memo(function DepartmentSection({ dept, todayIdx, showHeader, effectiveDayIdx, effectiveMinutes, columnCount = 10, myName, onPeek, getPrevWeekSundayShift }) {
  return (
    <>
      {showHeader && (
        <tr className="dept-header-row" role="row">
          <td colSpan={columnCount} role="cell">
            <div className="dept-header-label">
              <Building2 size={16} />
              {dept.name || dept.fullName}
              <span className="dept-count">{dept.employees.length} kişi</span>
            </div>
          </td>
        </tr>
      )}
      {dept.employees.map((emp, idx) => (
        <EmployeeRow
          key={emp.id}
          emp={emp}
          todayIdx={todayIdx}
          effectiveDayIdx={effectiveDayIdx}
          effectiveMinutes={effectiveMinutes}
          isMe={myName === emp.name}
          onPeek={onPeek}
          prevWeekLastDayShiftStr={effectiveDayIdx === 0 && getPrevWeekSundayShift ? getPrevWeekSundayShift(emp.name) : undefined}
          zebraParity={idx % 2 === 0 ? 'even' : 'odd'}
        />
      ))}
    </>
  );
});
