'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useShift } from '@/context/ShiftContext';
import { parseShiftValue, getShiftTimeDisplay, formatDuration, isWorkingAt, checkOvernightFromPrevDay } from '@/lib/shiftUtils';
import { EmployeeAvatar, checkIsWorkingNow } from '@/components/ShiftTable';
import { X, Clock, UserCheck, TableProperties, Copy, Check, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { useState } from 'react';

// Vardiya tipi renk ve label haritası
const SHIFT_TYPE_META = {
  MORNING: { label: 'Sabah', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  EVENING: { label: 'Akşam', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  NIGHT: { label: 'Gece', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  MIXED: { label: 'Karma', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
};

const SWIPE_CLOSE_THRESHOLD_PX = 96;
const PRIORITY_SOON_THRESHOLD_MINUTES = 90;

/**
 * EmployeeProfileCard — Çizelgedeki bir çalışana tıklandığında açılan profil kartı.
 *
 * Kullanım:
 *   - Herhangi bir üst bileşene yerleştirin (genellikle page.js root seviyesinde)
 *   - Tetiklemek için context'ten setPeekEmployee(empObj) çağrısı yeterli
 *   - Otomatik ESC ve dışarı tıklama desteği
 *
 * Özellikler:
 *   - Canlı çalışma durumu (yeşil dot + animasyon)
 *   - Bugünün vardiyası detayı
 *   - 7 günlük haftalık mini takvim
 *   - Vardiya tipi dağılım çubuğu
 *   - İstatistik chip'leri (çalışma günü, toplam saat, izin)
 *   - Sonraki vardiya banner'ı
 *   - "Çizelgede Göster" → departmana git + satıra scroll
 *   - "Benim Profilim Yap" → saveMyName
 *   - "Kopyala" → panoya haftalık program
 *   - Mobil: alt drawer (bottom sheet), Desktop: ortalanmış modal
 */
export default function EmployeeProfileCard() {
  const {
    peekEmployee, setPeekEmployee,
    activeData,
    effectiveDayIdx, effectiveMinutes,
    queryDayIdx, queryTime,
    saveMyName, myName,
    setSelectedDept, setMobileTab,
    addToast, getPrevWeekSundayShift, prevWeekMissing, handleFile,
  } = useShift();

  const [copied, setCopied] = useState(false);
  const backdropRef = useRef(null);
  const cardBodyRef = useRef(null);
  const touchStateRef = useRef({
    tracking: false,
    canDismiss: false,
    startX: 0,
    startY: 0,
    deltaY: 0,
  });

  // ── Hook'ların tümü erken return'dan ÖNCE olmalı ──

  // ESC tuşu
  useEffect(() => {
    if (!peekEmployee) return;
    const handler = (e) => { if (e.key === 'Escape') setPeekEmployee(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [peekEmployee, setPeekEmployee]);

  // Body scroll kilidi (mobil)
  useEffect(() => {
    if (peekEmployee) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [peekEmployee]);

  // ── Çizelgede Göster ──
  const handleGoToSchedule = useCallback(() => {
    if (!peekEmployee) return;
    setSelectedDept(peekEmployee.department);
    setMobileTab('table');
    setPeekEmployee(null);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const row = document.querySelector(`[data-emp-id="${peekEmployee.id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('emp-highlight-row');
          setTimeout(() => row.classList.remove('emp-highlight-row'), 2600);
        }
      }, 150);
    });
  }, [peekEmployee, setSelectedDept, setMobileTab, setPeekEmployee]);

  // ── Benim Profilim Yap ──
  const handleSetAsMe = useCallback(() => {
    if (!peekEmployee) return;
    saveMyName(peekEmployee.name);
    addToast(`${peekEmployee.name} profiliniz olarak ayarlandı`, 'success');
    setPeekEmployee(null);
  }, [peekEmployee, saveMyName, addToast, setPeekEmployee]);

  // ── Panoya Kopyala ──
  const handleCopy = useCallback(async () => {
    if (!peekEmployee || !activeData) return;
    const lines = activeData.rawDates.map((d, i) => {
      const shift = parseShiftValue(peekEmployee.shifts[i]);
      const label = shift
        ? (shift.isStatusCode ? shift.label : getShiftTimeDisplay(shift))
        : '—';
      return `${d.formatted.dayName.substring(0, 3)}: ${label}`;
    });
    const text = `${peekEmployee.name}\n${peekEmployee.departmentName || peekEmployee.department}\n${'─'.repeat(20)}\n${lines.join('\n')}\nToplam: ${peekEmployee.totalHours || '—'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast('Program panoya kopyalandı', 'success', 2500);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('Kopyalama başarısız', 'error');
    }
  }, [peekEmployee, activeData, addToast]);

  const handleCardTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const target = e.target;
    const startedInsideScrollableBody = cardBodyRef.current?.contains(target);
    const bodyScrollTop = cardBodyRef.current?.scrollTop || 0;

    touchStateRef.current = {
      tracking: true,
      canDismiss: !startedInsideScrollableBody || bodyScrollTop <= 0,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaY: 0,
    };
  }, []);

  const handleCardTouchMove = useCallback((e) => {
    if (!touchStateRef.current.tracking) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;

    if (deltaY <= 0) return;
    if (Math.abs(deltaY) <= Math.abs(deltaX) * 1.1) return;

    touchStateRef.current.deltaY = deltaY;
  }, []);

  const handleCardTouchEnd = useCallback(() => {
    const { tracking, canDismiss, deltaY } = touchStateRef.current;
    touchStateRef.current.tracking = false;

    if (tracking && canDismiss && deltaY >= SWIPE_CLOSE_THRESHOLD_PX) {
      setPeekEmployee(null);
    }
  }, [setPeekEmployee]);

  // ── Erken return (tüm hook'lar yukarıda tamamlandı) ──
  if (!peekEmployee || !activeData) return null;

  const emp = peekEmployee;
  const liveDayIdx = effectiveDayIdx;
  const liveNowMinutes = effectiveMinutes;
  const isOverrideActive = queryDayIdx !== null || Boolean(queryTime);
  const prevWeekShift = liveDayIdx === 0 ? getPrevWeekSundayShift(emp.name) : undefined;
  const isWorkingNow = checkIsWorkingNow(emp, liveDayIdx, liveNowMinutes, prevWeekShift);
  const todayShift = liveDayIdx >= 0 ? parseShiftValue(emp.shifts[liveDayIdx]) : null;
  const todayDate = liveDayIdx >= 0 ? activeData.rawDates[liveDayIdx] : null;
  const isMe = myName === emp.name;
  const overrideStatusPrefix = (() => {
    if (!isOverrideActive) return '';

    const dayObj = activeData?.rawDates?.[liveDayIdx];
    const hh = String(Math.floor(Math.max(0, liveNowMinutes) / 60)).padStart(2, '0');
    const mm = String(Math.max(0, liveNowMinutes) % 60).padStart(2, '0');

    if (!dayObj) return `${hh}:${mm} de`;

    const dayShort = dayObj.formatted.dayNameShort || dayObj.formatted.dayName.substring(0, 3);
    return `${dayObj.formatted.dayNum} ${dayObj.formatted.month} ${dayShort} ${hh}:${mm} de`;
  })();
  const liveStatusText = isWorkingNow
    ? (isOverrideActive ? `${overrideStatusPrefix} çalışıyor` : 'Şu an çalışıyor')
    : prevWeekMissing
      ? (isOverrideActive ? `${overrideStatusPrefix} durum bilinmiyor` : 'Durum Bilinmiyor')
      : (isOverrideActive ? `${overrideStatusPrefix} çalışmıyor` : 'Şu an çalışmıyor');
  const liveCarryover = liveDayIdx >= 0
    ? checkOvernightFromPrevDay(emp.shifts, liveDayIdx, liveNowMinutes, prevWeekShift)
    : { isCarryover: false, prevShift: null };

  // ── Haftalık istatistikler ──
  let workDays = 0, offDays = 0, restDays = 0;
  const typeCounts = {};
  emp.shifts.forEach((shiftStr) => {
    if (!shiftStr) { restDays++; return; }
    const shift = parseShiftValue(shiftStr);
    if (!shift) { restDays++; return; }
    if (shift.isStatusCode) {
      offDays++;
    } else {
      workDays++;
      typeCounts[shift.type] = (typeCounts[shift.type] || 0) + 1;
    }
  });

  const totalShiftType = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1;

  // ── Sonraki vardiya ──
  const nextShiftInfo = (() => {
    if (liveDayIdx < 0) return null;
    for (let i = liveDayIdx + 1; i < emp.shifts.length; i++) {
      const shift = parseShiftValue(emp.shifts[i]);
      if (shift && !shift.isStatusCode) {
        const diff = i - liveDayIdx;
        const dayLabel = diff === 1 ? 'Yarın' : `${diff} gün sonra`;
        return { dayLabel, dayIdx: i, shift, dateObj: activeData.rawDates[i] };
      }
    }
    return null;
  })();

  const carryoverShiftInfo = (() => {
    if (liveDayIdx < 0 || !activeData) return null;

    const prevShiftStr = liveDayIdx === 0
      ? getPrevWeekSundayShift(emp.name)
      : emp.shifts[liveDayIdx - 1];

    if (!prevShiftStr) return null;
    const shift = parseShiftValue(prevShiftStr);
    if (!shift || shift.isStatusCode || shift.endMinutes > shift.startMinutes) return null;

    // Sarkan vardiya sadece aktifken kartta gösterilir.
    if (!liveCarryover.isCarryover) return null;

    let dateText = 'Dün';
    if (liveDayIdx === 0) {
      const firstDayDate = activeData.rawDates?.[0]?.date ? new Date(activeData.rawDates[0].date) : null;
      if (firstDayDate) {
        const prevSundayDate = new Date(firstDayDate);
        prevSundayDate.setDate(prevSundayDate.getDate() - 1);
        dateText = `${prevSundayDate.getDate()} ${prevSundayDate.toLocaleString('tr-TR', { month: 'long' })} Pazar`;
      } else {
        dateText = 'Önceki Pazar';
      }
    } else {
      const prevDateObj = activeData.rawDates?.[liveDayIdx - 1];
      if (prevDateObj) {
        dateText = `${prevDateObj.formatted.dayNum} ${prevDateObj.formatted.month} ${prevDateObj.formatted.dayName}`;
      }
    }

    const isActiveNow = true;
    const remainingMinutes = isActiveNow ? Math.max(0, shift.endMinutes - liveNowMinutes) : 0;

    return { shift, dateText, isActiveNow, remainingMinutes };
  })();

  const getNextShiftDateText = (info) => {
    if (!info?.dateObj) return info?.dayLabel || '';
    const fullDateText = `${info.dateObj.formatted.dayNum} ${info.dateObj.formatted.month} ${info.dateObj.formatted.dayName}`;
    return info.dayLabel === 'Yarın' ? `Yarın · ${fullDateText}` : fullDateText;
  };

  const isTodayShiftCompletedLive = Boolean(
    todayShift &&
    !todayShift.isStatusCode &&
    todayShift.endMinutes > todayShift.startMinutes &&
    liveNowMinutes >= todayShift.endMinutes
  );

  const isTodayShiftActive = Boolean(
    todayShift &&
    !todayShift.isStatusCode &&
    isWorkingAt(todayShift, liveNowMinutes)
  );

  const todayStartsInMinutes = (
    todayShift &&
    !todayShift.isStatusCode &&
    liveNowMinutes < todayShift.startMinutes
  )
    ? (todayShift.startMinutes - liveNowMinutes)
    : null;

  const isTodayStartingSoon = Boolean(
    todayStartsInMinutes != null && todayStartsInMinutes <= PRIORITY_SOON_THRESHOLD_MINUTES
  );

  const nextShiftRemainingMinutes = (() => {
    if (!nextShiftInfo || liveDayIdx < 0) return null;
    const nowAbs = (liveDayIdx * 1440) + liveNowMinutes;
    const nextStartAbs = (nextShiftInfo.dayIdx * 1440) + nextShiftInfo.shift.startMinutes;
    const diff = nextStartAbs - nowAbs;
    return diff > 0 ? diff : null;
  })();

  const isNextStartingSoon = Boolean(
    nextShiftRemainingMinutes != null && nextShiftRemainingMinutes <= PRIORITY_SOON_THRESHOLD_MINUTES
  );

  const cardPriority = {
    carryover: carryoverShiftInfo
      ? (carryoverShiftInfo.isActiveNow ? 100 : 30)
      : -1,
    today: todayShift
      ? (todayShift.isStatusCode
          ? 45
          : isTodayShiftActive
            ? 95
            : isTodayStartingSoon
              ? 85
              : isTodayShiftCompletedLive
                ? 35
                : 65)
      : -1,
    next: nextShiftInfo
      ? (isNextStartingSoon ? 75 : 50)
      : -1,
  };

  const primaryCardKey = carryoverShiftInfo?.isActiveNow
    ? 'carryover'
    : ['carryover', 'today', 'next'].reduce((best, key) => {
    if (!best) return key;
    return cardPriority[key] > cardPriority[best] ? key : best;
  }, null);

  const shouldShowPrimaryNextShift = Boolean(
    nextShiftInfo && (isTodayShiftCompletedLive || !todayShift || todayShift.isStatusCode)
  );

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="emp-card-backdrop"
        onClick={() => setPeekEmployee(null)}
        aria-hidden="true"
      />

      {/* Kart */}
      <div
        className="emp-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${emp.name} profil kartı`}
        onTouchStart={handleCardTouchStart}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onTouchCancel={handleCardTouchEnd}
      >
        {/* Mobil drag handle */}
        <div className="emp-card-handle" />

        {/* ── Hero Bölümü ── */}
        <div className="emp-card-hero">
          <EmployeeAvatar emp={emp} isWorkingNow={isWorkingNow} size={56} />
          <div className="emp-card-hero-info">
            <div className="emp-card-name">{emp.name}</div>
            <div className="emp-card-dept">
              {emp.departmentName || emp.department}
              {emp.group ? ` · ${emp.group}` : ''}
            </div>
            <div className={`emp-card-status ${isWorkingNow ? 'working' : (prevWeekMissing ? 'unknown' : 'offline')}`}>
              {isWorkingNow ? (
                <span className="emp-card-status-dot" />
              ) : prevWeekMissing ? (
                <AlertTriangle size={10} style={{ marginRight: 2, marginTop: -1 }} />
              ) : (
                <span className="emp-card-status-dot" />
              )}
              {liveStatusText}
            </div>
          </div>
          <button
            className="emp-card-close-btn"
            onClick={() => setPeekEmployee(null)}
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable gövde */}
        <div className="emp-card-body" ref={cardBodyRef}>

          {/* Eksik Hafta Uyarısı */}
          {prevWeekMissing && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', marginBottom: 16,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12, lineHeight: 1.5,
              color: '#f59e0b', margin: '20px 20px 16px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Pazar gününden sarkan vardiyalar gösterilemiyor</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  Pazar gecesinden bugün sabah saatlerine sarkan vardiyalar kontrol edilemiyor. Doğru sonuç için önceki haftayı yükleyin.
                </div>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 8, padding: '5px 12px',
                  background: 'rgba(245, 158, 11, 0.18)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  color: '#f59e0b',
                }}>
                  <Upload size={12} />
                  Önceki haftayı yükle
                  <input type="file" style={{ display: 'none' }} accept=".xlsx,.xls" onChange={(e) => {
                    if (e.target.files?.length) handleFile(e.target.files, true);
                  }} />
                </label>
              </div>
            </div>
          )}

          {/* ── Bugünkü Vardiya ── */}
          {!isOverrideActive && (
          <div className="emp-card-section">
            <div className="shift-card-stack">
              {carryoverShiftInfo && (
                <div className={`next-shift-primary-card shift-card-item carryover-card ${primaryCardKey === 'carryover' ? 'is-primary' : 'is-secondary'} ${carryoverShiftInfo.isActiveNow ? 'active-now' : ''}`}>
                  <div className="next-shift-primary-body">
                    <div
                      className="emp-today-shift-icon next-shift-icon"
                      style={{ background: carryoverShiftInfo.shift.bg, color: carryoverShiftInfo.shift.color }}
                    >
                      <Clock size={20} />
                    </div>
                    <div className="next-shift-primary-content">
                      <div className="shift-card-title">Sarkan vardiya</div>
                      <div className="shift-card-meta-row">
                        <span className="shift-card-date">{carryoverShiftInfo.dateText} gecesinden</span>
                        <div
                          className="emp-week-shift-chip shift-time-chip"
                          style={{ background: carryoverShiftInfo.shift.bg, color: carryoverShiftInfo.shift.color }}
                        >
                          {getShiftTimeDisplay(carryoverShiftInfo.shift, '–')}
                        </div>
                      </div>
                      <div className="shift-duration-text">Vardiya süresi: {formatDuration(carryoverShiftInfo.shift.duration)}</div>
                    </div>
                  </div>
                </div>
              )}

              {todayShift ? (
                <>
                  <div className={`emp-today-shift shift-card-item ${primaryCardKey === 'today' ? 'is-primary' : 'is-secondary'} ${isTodayShiftActive ? 'active-now' : ''} ${shouldShowPrimaryNextShift && primaryCardKey !== 'today' ? 'reduced' : ''}`}>
                  <div
                    className="emp-today-shift-icon"
                    style={
                      isTodayShiftCompletedLive
                        ? { background: 'rgba(16, 185, 129, 0.14)', color: 'var(--accent-success)' }
                        : { background: todayShift.bg, color: todayShift.color }
                    }
                  >
                    {isTodayShiftCompletedLive
                      ? <CheckCircle2 size={20} />
                      : todayShift.isStatusCode
                        ? todayShift.icon
                        : <Clock size={20} />}
                  </div>
                  <div>
                    <div className="shift-card-title">Bugünkü vardiya</div>
                    <div className="shift-card-meta-row">
                      {todayDate && (
                        <span className="shift-card-date">
                          {todayDate.formatted.dayNum} {todayDate.formatted.month} {todayDate.formatted.dayName}
                        </span>
                      )}
                      <div
                        className="emp-week-shift-chip shift-time-chip"
                        style={{ background: todayShift.bg, color: todayShift.color }}
                      >
                        {getShiftTimeDisplay(todayShift, '–')}
                      </div>
                    </div>
                    <div className="shift-duration-text">
                      {todayShift.isStatusCode
                        ? todayShift.label
                        : `Vardiya süresi: ${formatDuration(todayShift.duration)}`}
                    </div>

                    {shouldShowPrimaryNextShift && !todayShift.isStatusCode && (
                      <div className="today-shift-completed-note">Bugünkü vardiya tamamlandı</div>
                    )}
                  </div>
                </div>

                  {nextShiftInfo && (
                    <div className={`next-shift-primary-card shift-card-item ${primaryCardKey === 'next' ? 'is-primary' : 'is-secondary'} ${shouldShowPrimaryNextShift ? '' : 'secondary'}`}>
                    <div className="next-shift-primary-body">
                      <div className="emp-today-shift-icon next-shift-icon">
                        <Clock size={20} />
                      </div>
                      <div className="next-shift-primary-content">
                        <div className="shift-card-title">Sonraki vardiya</div>
                        <div className="shift-card-meta-row">
                          <span className="shift-card-date">{getNextShiftDateText(nextShiftInfo)}</span>
                          <div
                            className="emp-week-shift-chip shift-time-chip"
                            style={{ background: nextShiftInfo.shift.bg, color: nextShiftInfo.shift.color }}
                          >
                            {getShiftTimeDisplay(nextShiftInfo.shift, '–')}
                          </div>
                        </div>
                        <div className="shift-duration-text">
                          Vardiya süresi: {formatDuration(nextShiftInfo.shift.duration)}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                </>
              ) : (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Bugün için vardiya bilgisi yok
                  </div>
                  {nextShiftInfo && (
                    <div className={`next-shift-primary-card shift-card-item ${primaryCardKey === 'next' ? 'is-primary' : 'is-secondary'}`}>
                    <div className="next-shift-primary-body">
                      <div className="emp-today-shift-icon next-shift-icon">
                        <Clock size={20} />
                      </div>
                      <div className="next-shift-primary-content">
                        <div className="shift-card-title">Sonraki vardiya</div>
                        <div className="shift-card-meta-row">
                          <span className="shift-card-date">{getNextShiftDateText(nextShiftInfo)}</span>
                          <div
                            className="emp-week-shift-chip shift-time-chip"
                            style={{ background: nextShiftInfo.shift.bg, color: nextShiftInfo.shift.color }}
                          >
                            {getShiftTimeDisplay(nextShiftInfo.shift, '–')}
                          </div>
                        </div>
                        <div className="shift-duration-text">
                          Vardiya süresi: {formatDuration(nextShiftInfo.shift.duration)}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </>
              )}
            </div>
          </div>
          )}

          {/* ── Haftalık Takvim ── */}
          <div className="emp-card-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="emp-card-section-title" style={{ margin: 0 }}>Bu Hafta</div>
              <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 500 }}>
                {emp.totalHours || '00:00'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {activeData.rawDates.map((dateObj, i) => {
                const shift = parseShiftValue(emp.shifts[i]);
                const isToday = i === liveDayIdx;
                return (
                  <div key={i} className={`emp-week-row ${isToday ? 'today-row' : ''}`}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)', minWidth: 110 }}>
                      {dateObj.formatted.dayNum} {dateObj.formatted.month} {dateObj.formatted.dayName}
                    </span>
                    {shift ? (
                      <span
                        className="emp-week-shift-chip"
                        style={{ background: shift.bg, color: shift.color }}
                      >
                        {getShiftTimeDisplay(shift)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                    {shift && !shift.isStatusCode && (
                      <span className="emp-week-duration">
                        {Math.floor(shift.duration / 60)}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── İstatistikler ── */}
          <div className="emp-card-section">
            <div className="emp-card-section-title">Haftalık Özet</div>

            <div className="emp-stats-grid">
              <div className="emp-stat-chip">
                <div className="emp-stat-number" style={{ color: 'var(--accent-primary)' }}>
                  {workDays}
                </div>
                <div className="emp-stat-label">Çalışma</div>
              </div>
              <div className="emp-stat-chip">
                <div className="emp-stat-number">
                  {emp.totalHours || '—'}
                </div>
                <div className="emp-stat-label">Toplam</div>
              </div>
              <div className="emp-stat-chip">
                <div className="emp-stat-number" style={{ color: 'var(--accent-warning)' }}>
                  {offDays}
                </div>
                <div className="emp-stat-label">İzin/Off</div>
              </div>
            </div>

            {/* Vardiya Tipi Dağılım Çubuğu */}
            {Object.keys(typeCounts).length > 0 && (
              <div className="emp-type-bar-wrap">
                <div className="emp-type-bar">
                  {Object.entries(typeCounts).map(([type, count]) => {
                    const pct = (count / totalShiftType) * 100;
                    const meta = SHIFT_TYPE_META[type];
                    return (
                      <div
                        key={type}
                        className="emp-type-bar-segment"
                        style={{ width: `${pct}%`, background: meta?.color || '#64748b' }}
                      />
                    );
                  })}
                </div>
                <div className="emp-type-legend">
                  {Object.entries(typeCounts).map(([type, count]) => {
                    const meta = SHIFT_TYPE_META[type];
                    const pct = Math.round((count / totalShiftType) * 100);
                    return (
                      <div key={type} className="emp-type-legend-item">
                        <span className="emp-type-legend-dot" style={{ background: meta?.color || '#64748b' }} />
                        {meta?.label || type} %{pct}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>{/* /emp-card-body */}

        {/* ── Aksiyon Butonları ── */}
        <div className="emp-card-actions">
          {/* Ana buton: Çizelgede Göster */}
          <button className="emp-action-btn primary" onClick={handleGoToSchedule}>
            <TableProperties size={16} />
            Çizelgede Göster
          </button>

          {/* İkincil butonlar: yan yana */}
          <div className="emp-action-row">
            <button
              className={`emp-action-btn ${isMe ? 'already-me' : ''}`}
              onClick={handleSetAsMe}
              disabled={isMe}
            >
              <UserCheck size={15} />
              {isMe ? 'Zaten Profilim' : 'Benim Profilim Yap'}
            </button>
            <button className="emp-action-btn" onClick={handleCopy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>

      </div>{/* /emp-card */}
    </>
  );
}
