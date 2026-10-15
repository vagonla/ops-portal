'use client';

import { memo, useMemo } from 'react';
import {
  parseShiftValue,
  isWorkingAt,
  isOvernightCarryover,
  checkOvernightFromPrevDay,
  getShiftSegments,
} from '@/lib/shiftUtils';

// ─── Avatar ─────────────────────────────────────────────────────────

export const EmployeeAvatar = memo(function EmployeeAvatar({ emp, isWorkingNow, size = 32 }) {
  const initials = emp.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <div className="employee-avatar-wrapper" style={{ width: size, height: size }}>
      <div
        className="employee-avatar"
        style={{ width: size, height: size, fontSize: size * 0.35 + 'px' }}
      >
        {initials}
      </div>
      {isWorkingNow && <div className="avatar-online-dot" />}
    </div>
  );
});

// ─── Working-now kontrolu ──────────────────────────────────────────

export function checkIsWorkingNow(emp, effectiveDayIdx, effectiveMinutes, prevWeekLastDayShiftStr) {
  if (!emp || effectiveDayIdx < 0 || effectiveDayIdx > 6) return false;
  const shift = parseShiftValue(emp.shifts[effectiveDayIdx]);
  if (shift && !shift.isStatusCode && isWorkingAt(shift, effectiveMinutes)) return true;
  const { isCarryover } = checkOvernightFromPrevDay(
    emp.shifts,
    effectiveDayIdx,
    effectiveMinutes,
    prevWeekLastDayShiftStr,
  );
  return isCarryover;
}

// ─── WeekView cellActiveMap hook ────────────────────────────────────
// EmployeeRow icin her hucrenin "aktif" durumunu hesaplar.
// Sadece shifts referansi, day/minute degistiginde yeniden hesaplar.

export function useCellActiveMap(shifts, effectiveDayIdx, effectiveMinutes) {
  const prevDayOfEffective = effectiveDayIdx === 0 ? -1 : effectiveDayIdx - 1;
  return useMemo(() => {
    return shifts.map((shiftStr, dayIdx) => {
      const shift = parseShiftValue(shiftStr);
      if (!shift || shift.isStatusCode) return false;
      if (dayIdx === effectiveDayIdx && isWorkingAt(shift, effectiveMinutes)) return true;
      if (
        prevDayOfEffective >= 0 &&
        dayIdx === prevDayOfEffective &&
        isOvernightCarryover(shift, effectiveMinutes)
      ) return true;
      return false;
    });
  }, [shifts, effectiveDayIdx, effectiveMinutes, prevDayOfEffective]);
}

// ─── DayView icin vardiya fazi ──────────────────────────────────────
// Dondurulen deger:
//   'status'     → izin kodu (shift.isStatusCode)
//   'carryover'  → onceki gunden sarkiyor, su an aktif (yalniz dayIdx=selected gunde)
//   'before'     → bugun baslamadi
//   'active'     → bugun su an aktif
//   'after'      → bugun bitti
//   'none'       → vardiya yok

export function getShiftPhase({ shift, isSelectedDay, currentMinutes, carryoverFromPrev }) {
  if (!shift) {
    if (carryoverFromPrev) return 'carryover';
    return 'none';
  }
  if (shift.isStatusCode) return 'status';
  if (!isSelectedDay) return 'before';

  if (isWorkingAt(shift, currentMinutes)) return 'active';
  if (getShiftSegments(shift).some(segment => currentMinutes < segment.startMinutes)) return 'before';
  return 'after';
}

// ─── DayView icin durum metni (Turkce kisa) ─────────────────────────

export function formatPhaseLabel({
  phase,
  shift,
  currentMinutes,
  selectedDayIsToday,
}) {
  if (phase === 'carryover') return 'dünden devam ediyor';
  if (phase === 'status') return null; // izin kodu zaten chip'te gorunur
  if (!shift || !selectedDayIsToday) return null;

  if (phase === 'before') {
    const nextSegment = getShiftSegments(shift).find(segment => currentMinutes < segment.startMinutes);
    const mins = nextSegment ? nextSegment.startMinutes - currentMinutes : 0;
    if (mins <= 0) return null;
    return `${formatMinShort(mins)} sonra başlar`;
  }
  if (phase === 'active') {
    const activeSegment = getShiftSegments(shift).find(segment => (
      segment.endMinutes > segment.startMinutes
        ? currentMinutes >= segment.startMinutes && currentMinutes < segment.endMinutes
        : currentMinutes >= segment.startMinutes
    ));
    if (!activeSegment) return null;
    const { endMinutes, startMinutes } = activeSegment;
    const overnight = endMinutes <= startMinutes;
    const remaining = overnight
      ? (1440 - currentMinutes) + endMinutes
      : endMinutes - currentMinutes;
    return `${formatMinShort(remaining)} kaldı`;
  }
  if (phase === 'after') return 'bitti';
  return null;
}

function formatMinShort(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}dk`;
  if (m <= 0) return `${h}sa`;
  return `${h}sa ${m}dk`;
}

// ─── Turkce normalize ───────────────────────────────────────────────

export function normalizeTr(str) {
  if (!str) return '';
  return String(str).toLocaleLowerCase('tr-TR');
}
