'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useShift } from '@/context/ShiftContext';
import { parseShiftValue, getShiftTimeDisplay, formatDuration, isWorkingAt, checkOvernightFromPrevDay, getLiveShiftProgress } from '@/lib/shiftUtils';
import { normalizeRouteCode } from '@/lib/routeUtils';
import { EmployeeAvatar, checkIsWorkingNow } from '@/components/ShiftTable';
import {
  X, Clock, Trash2, Bus, MapPin,
  UserCircle, RefreshCw, Upload, Check, CheckCircle2, ChevronDown, AlertTriangle, Copy
} from 'lucide-react';

const SHIFT_TYPE_META = {
  MORNING: { label: 'Sabah', color: '#f59e0b' },
  EVENING: { label: 'Akşam', color: '#8b5cf6' },
  NIGHT: { label: 'Gece', color: '#06b6d4' },
  MIXED: { label: 'Karma', color: '#10b981' },
};

const UPCOMING_COUNTER_LIMIT_MINUTES = 8 * 60;
const SWIPE_CLOSE_THRESHOLD_PX = 96;
const PRIORITY_SOON_THRESHOLD_MINUTES = 90;

/**
 * MyProfileSheet — "Ben" profil sayfası bottom-sheet bileşeni.
 *
 * - Mobil ve Desktop'ta aynı bottom-sheet stili (EmployeeProfileCard ile tutarlı)
 * - Genişletilmiş özellikler: ad değiştirme, servis takibi, istatistikler
 * - ESC ve backdrop tıklama ile kapanma
 */
export default function MyProfileSheet() {
  const {
    isProfileOpen, setIsProfileOpen,
    myName, saveMyName,
    myEmployeeData, myStop, saveMyStop,
    activeData, effectiveDayIdx, effectiveMinutes,
    queryDayIdx, queryTime,
    routeData, handleRouteFile, removeRouteFile,
    clearAllData, clearConfirmPending,
    personSearch, setPersonSearch, personResults,
    addToast, getPrevWeekSundayShift, prevWeekMissing, handleFile,
  } = useShift();

  const [editingName, setEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const sheetBodyRef = useRef(null);
  const touchStateRef = useRef({
    tracking: false,
    canDismiss: false,
    startX: 0,
    startY: 0,
    deltaY: 0,
  });

  const isShiftCompleted = useCallback((shift, dayIdx) => {
    if (!shift || shift.isStatusCode) return false;
    if (effectiveDayIdx < 0 || effectiveDayIdx > 6) return false;

    const refAbs = (effectiveDayIdx * 1440) + effectiveMinutes;
    const shiftStartAbs = (dayIdx * 1440) + shift.startMinutes;

    let shiftEndAbs = (dayIdx * 1440) + shift.endMinutes;
    // Geceye sarkan vardiyalarda bitiş bir sonraki güne taşınır.
    if (shift.endMinutes <= shift.startMinutes) {
      shiftEndAbs += 1440;
    }

    return refAbs >= shiftEndAbs;
  }, [effectiveDayIdx, effectiveMinutes]);

  // Body scroll kilidi
  useEffect(() => {
    if (isProfileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setEditingName(false);
      setPersonSearch('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isProfileOpen, setPersonSearch]);

  // ESC tuşu
  useEffect(() => {
    if (!isProfileOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setIsProfileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isProfileOpen, setIsProfileOpen]);

  // Profil seçimi
  const handleSelectName = useCallback((emp) => {
    saveMyName(emp.name);
    setPersonSearch('');
    setEditingName(false);
    addToast(`${emp.name} profiliniz olarak ayarlandı`, 'success');
  }, [saveMyName, setPersonSearch, addToast]);

  const handleSheetTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const target = e.target;
    const startedInsideScrollableBody = sheetBodyRef.current?.contains(target);
    const bodyScrollTop = sheetBodyRef.current?.scrollTop || 0;

    touchStateRef.current = {
      tracking: true,
      canDismiss: !startedInsideScrollableBody || bodyScrollTop <= 0,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaY: 0,
    };
  }, []);

  const handleSheetTouchMove = useCallback((e) => {
    if (!touchStateRef.current.tracking) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;

    if (deltaY <= 0) return;
    if (Math.abs(deltaY) <= Math.abs(deltaX) * 1.1) return;

    touchStateRef.current.deltaY = deltaY;
  }, []);

  const handleSheetTouchEnd = useCallback(() => {
    const { tracking, canDismiss, deltaY } = touchStateRef.current;
    touchStateRef.current.tracking = false;

    if (tracking && canDismiss && deltaY >= SWIPE_CLOSE_THRESHOLD_PX) {
      setIsProfileOpen(false);
    }
  }, [setIsProfileOpen]);

  if (!isProfileOpen) return null;

  // ── Profil yok → sadece isim seçici ──
  if (!myName || !myEmployeeData) {
    return (
      <>
        <div className="my-profile-sheet-backdrop my-profile-sheet-backdrop-glass" onClick={() => setIsProfileOpen(false)} aria-hidden="true" />
        <div
          className="my-profile-sheet my-profile-sheet-glass"
          role="dialog"
          aria-modal="true"
          aria-label="Profil Sayfası"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
        >
          <div className="emp-card-handle" />
          <div className="emp-card-hero" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '24px 20px 20px' }}>
            <button className="emp-card-close-btn" onClick={() => setIsProfileOpen(false)} aria-label="Kapat">
              <X size={16} />
            </button>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', marginTop: 8 }}>
              <UserCircle size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>Profilinizi Ayarlayın</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Kendi vardiyalarınızı daha hızlı takip etmek için adınızı seçin.
              </p>
            </div>
          </div>
          <div className="my-profile-sheet-body" ref={sheetBodyRef}>
            <div className="emp-card-section">
              <div className="profile-name-search-wrap">
                <input
                  className="profile-name-search-input"
                  type="text"
                  placeholder="Adınızı arayın..."
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  autoFocus
                />
                <div className="profile-name-results">
                  {personSearch.length < 2 ? (
                    <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Listelemek için adınızı yazın...
                    </div>
                  ) : personResults.length === 0 ? (
                    <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Sonuç bulunamadı
                    </div>
                  ) : (
                    personResults.map((emp) => (
                      <div key={emp.id} className="profile-name-result-item" onClick={() => handleSelectName(emp)}>
                        <EmployeeAvatar emp={emp} isWorkingNow={false} size={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.departmentName || emp.department}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Panoya Kopyala ──
  const handleCopy = () => {
    if (!myEmployeeData || !activeData) return;
    const lines = activeData.rawDates.map((d, i) => {
      const shift = parseShiftValue(myEmployeeData.shifts[i]);
      const label = shift
        ? (shift.isStatusCode ? shift.label : getShiftTimeDisplay(shift))
        : '—';
      return `${d.formatted.dayName.substring(0, 3)}: ${label}`;
    });
    const text = `${myEmployeeData.name}\n${myEmployeeData.departmentName || myEmployeeData.department}\n${'─'.repeat(20)}\n${lines.join('\n')}\nToplam: ${myEmployeeData.totalHours || '—'}`;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      addToast('Program panoya kopyalandı', 'success', 2500);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('Kopyalama başarısız', 'error');
    }
  };

  // ── Profil var ──
  const emp = myEmployeeData;
  const isOverrideActive = queryDayIdx !== null || Boolean(queryTime);
  const liveDayIdx = effectiveDayIdx;
  const liveNowMinutes = effectiveMinutes;
  const prevWeekShift = liveDayIdx === 0 ? getPrevWeekSundayShift(emp.name) : undefined;
  const isWorkingNow = checkIsWorkingNow(emp, liveDayIdx, liveNowMinutes, prevWeekShift);
  const todayShift = liveDayIdx >= 0 ? parseShiftValue(emp.shifts[liveDayIdx]) : null;
  const todayDate = liveDayIdx >= 0 && activeData?.rawDates[liveDayIdx];
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

  const liveTodayShift = liveDayIdx >= 0 ? parseShiftValue(emp.shifts[liveDayIdx]) : null;
  const livePrevWeekShift = liveDayIdx === 0 ? getPrevWeekSundayShift(emp.name) : undefined;
  const liveCarryover = liveDayIdx >= 0
    ? checkOvernightFromPrevDay(emp.shifts, liveDayIdx, liveNowMinutes, livePrevWeekShift)
    : { isCarryover: false, prevShift: null };

  const liveNowAbs = liveDayIdx >= 0 ? (liveDayIdx * 1440) + liveNowMinutes : -1;
  const liveNextShiftInfo = (() => {
    if (liveDayIdx < 0 || liveNowAbs < 0) return null;

    for (let day = liveDayIdx; day < emp.shifts.length; day++) {
      const nextShift = parseShiftValue(emp.shifts[day]);
      if (!nextShift || nextShift.isStatusCode) continue;

      const startAbs = (day * 1440) + nextShift.startMinutes;
      if (startAbs <= liveNowAbs) continue;

      return {
        shift: nextShift,
        dayIdx: day,
        dayOffset: day - liveDayIdx,
        remainingMinutes: startAbs - liveNowAbs,
      };
    }
    return null;
  })();

  const isTodayShiftCompletedLive = Boolean(
    liveTodayShift &&
    !liveTodayShift.isStatusCode &&
    liveTodayShift.endMinutes > liveTodayShift.startMinutes &&
    liveNowMinutes >= liveTodayShift.endMinutes
  );

  let liveCounterState = null;
  if (liveTodayShift && !liveTodayShift.isStatusCode && isWorkingAt(liveTodayShift, liveNowMinutes)) {
    const progress = getLiveShiftProgress(liveTodayShift, liveNowMinutes, { isCarryover: false });
    if (progress) {
      liveCounterState = {
        source: 'today',
        mode: 'active',
        shift: liveTodayShift,
        ...progress,
      };
    }
  } else if (liveCarryover.isCarryover && liveCarryover.prevShift) {
    const progress = getLiveShiftProgress(liveCarryover.prevShift, liveNowMinutes, { isCarryover: true });
    if (progress) {
      liveCounterState = {
        source: 'carryover',
        mode: 'active',
        shift: liveCarryover.prevShift,
        ...progress,
      };
    }
  } else if (liveNextShiftInfo && liveNextShiftInfo.remainingMinutes <= UPCOMING_COUNTER_LIMIT_MINUTES) {
    liveCounterState = {
      source: 'next',
      mode: 'upcoming',
      shift: liveNextShiftInfo.shift,
      targetDayIdx: liveNextShiftInfo.dayIdx,
      dayOffset: liveNextShiftInfo.dayOffset,
      remainingMinutes: liveNextShiftInfo.remainingMinutes,
      progress: 0,
    };
  } else if (isTodayShiftCompletedLive) {
    liveCounterState = {
      source: 'today',
      mode: 'completed',
      shift: liveTodayShift,
      progress: 1,
    };
  }

  const canShowPrimaryBlock = isTodayShiftCompletedLive || !liveTodayShift || liveTodayShift.isStatusCode;
  const shouldShowPrimaryNextShift = Boolean(
    canShowPrimaryBlock && liveNextShiftInfo
  );

  const isTodayShiftActive = Boolean(
    liveTodayShift &&
    !liveTodayShift.isStatusCode &&
    isWorkingAt(liveTodayShift, liveNowMinutes)
  );

  const todayStartsInMinutes = (
    liveTodayShift &&
    !liveTodayShift.isStatusCode &&
    liveNowMinutes < liveTodayShift.startMinutes
  )
    ? (liveTodayShift.startMinutes - liveNowMinutes)
    : null;

  const isTodayStartingSoon = Boolean(
    todayStartsInMinutes != null && todayStartsInMinutes <= PRIORITY_SOON_THRESHOLD_MINUTES
  );

  const isNextStartingSoon = Boolean(
    liveNextShiftInfo?.remainingMinutes != null &&
    liveNextShiftInfo.remainingMinutes <= PRIORITY_SOON_THRESHOLD_MINUTES
  );

  const primaryCardShift = liveNextShiftInfo?.shift;
  const primaryCardDayIdx = liveNextShiftInfo?.dayIdx;

  const nextShiftBoardingTime = shouldShowPrimaryNextShift && myStop && primaryCardShift
    ? myStop.times?.[primaryCardShift.start]
    : null;

  const getUpcomingCounterMainText = (state) => {
    if (!state) return '';
    if (state.dayOffset === 0) return `Vardiyanın başlamasına ${formatDuration(state.remainingMinutes)} kaldı`;
    if (state.dayOffset === 1) return `Sonraki vardiyaya ${formatDuration(state.remainingMinutes)} kaldı`;
    return `${state.dayOffset} gün sonraki vardiyaya ${formatDuration(state.remainingMinutes)} kaldı`;
  };

  const getUpcomingCounterSubText = (state) => {
    if (!state || state.targetDayIdx == null) return '';
    const targetDate = activeData?.rawDates?.[state.targetDayIdx];
    if (!targetDate) return `Sonraki vardiya: ${getShiftTimeDisplay(state.shift)}`;

    const dayText = `${targetDate.formatted.dayNum} ${targetDate.formatted.month} ${targetDate.formatted.dayName}`;
    return `Sonraki vardiya: ${dayText} · ${getShiftTimeDisplay(state.shift)}`;
  };

  const getDayTextByIdx = (dayIdx) => {
    const dateObj = activeData?.rawDates?.[dayIdx];
    if (!dateObj) return '';
    return `${dateObj.formatted.dayNum} ${dateObj.formatted.month} ${dateObj.formatted.dayName}`;
  };

  const getPrimaryCardDateText = () => {
    if (primaryCardDayIdx == null) return '';
    const fullDateText = getDayTextByIdx(primaryCardDayIdx);
    if (primaryCardDayIdx === liveDayIdx + 1) {
      return `Yarın · ${fullDateText}`;
    }
    return fullDateText;
  };

  const getMinutesUntilOnDay = (dayOffset, timeText) => {
    if (liveDayIdx < 0 || liveNowAbs < 0 || typeof timeText !== 'string') return null;
    const [hourStr, minuteStr] = timeText.split(':');
    const h = Number(hourStr);
    const m = Number(minuteStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

    const targetDayIdx = liveDayIdx + dayOffset;
    const targetAbs = (targetDayIdx * 1440) + (h * 60) + m;
    const diff = targetAbs - liveNowAbs;
    return diff > 0 ? diff : null;
  };

  const parseClockToMinutes = (timeText) => {
    if (typeof timeText !== 'string') return null;
    const [hourStr, minuteStr] = timeText.split(':');
    const h = Number(hourStr);
    const m = Number(minuteStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return (h * 60) + m;
  };

  const nextShiftStartCountdownText = liveNextShiftInfo
    ? `Vardiya başlangıcına ${formatDuration(liveNextShiftInfo.remainingMinutes)} kaldı`
    : '';

  const nextShiftBoardingCountdownText = (() => {
    if (!liveNextShiftInfo || !nextShiftBoardingTime) return '';

    // Geceyi gecen vardiyalarda biniş saati (23:xx) bir onceki takvim gunune ait olabilir.
    const boardingMinutes = parseClockToMinutes(nextShiftBoardingTime);
    const shiftStartMinutes = liveNextShiftInfo.shift?.startMinutes;
    const rawBoardingDayOffset = (
      boardingMinutes != null &&
      Number.isFinite(shiftStartMinutes) &&
      boardingMinutes > shiftStartMinutes
    )
      ? liveNextShiftInfo.dayOffset - 1
      : liveNextShiftInfo.dayOffset;

    const boardingDayOffset = Math.max(0, rawBoardingDayOffset);
    const boardingRemaining = getMinutesUntilOnDay(boardingDayOffset, nextShiftBoardingTime);
    if (boardingRemaining == null) return '';
    return `Servis binişine ${formatDuration(boardingRemaining)} kaldı`;
  })();

  const todayBoardingTime = (!todayShift?.isStatusCode && myStop && todayShift)
    ? myStop.times?.[todayShift.start]
    : null;

  const todayBoardingCountdownText = (() => {
    if (!todayBoardingTime) return '';
    const boardingRemaining = getMinutesUntilOnDay(0, todayBoardingTime);
    if (boardingRemaining == null) return '';
    return `Servis binişine ${formatDuration(boardingRemaining)} kaldı`;
  })();

  const getTodayCounterMainText = (state) => {
    if (!state) return '';
    if (state.mode === 'active') return `Vardiya bitimine ${formatDuration(state.remainingMinutes)} kaldı`;
    if (state.mode === 'upcoming') return `Vardiya başlangıcına ${formatDuration(state.remainingMinutes)} kaldı`;
    return 'Bugünkü vardiya tamamlandı';
  };

  const getTodayCounterSubText = (state) => {
    if (!state) return '';
    if (state.mode === 'active') {
      return `${formatDuration(state.elapsedMinutes)} geçti · %${Math.round((state.progress || 0) * 100)} tamamlandı`;
    }
    if (state.mode === 'upcoming') return '';
    return '';
  };

  const getSecondaryCardDateText = (info) => {
    if (!info?.dateObj) return info?.dayLabel || '';
    const fullDateText = `${info.dateObj.formatted.dayNum} ${info.dateObj.formatted.month} ${info.dateObj.formatted.dayName}`;
    if (info.dayLabel === 'Yarın') {
      return `Yarın · ${fullDateText}`;
    }
    return fullDateText;
  };

  // İstatistikler
  let workDays = 0, offDays = 0;
  const typeCounts = {};
  emp.shifts.forEach((shiftStr) => {
    if (!shiftStr) return;
    const shift = parseShiftValue(shiftStr);
    if (!shift) return;
    if (shift.isStatusCode) { offDays++; }
    else {
      workDays++;
      typeCounts[shift.type] = (typeCounts[shift.type] || 0) + 1;
    }
  });
  const totalShiftType = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1;

  // Sonraki vardiya (status code'lar atlanir; TRN/TRN_F vardiya olarak dahil edilir)
  const nextShiftInfo = (() => {
    if (liveDayIdx < 0 || !activeData) return null;
    for (let i = liveDayIdx + 1; i < emp.shifts.length; i++) {
      const shift = parseShiftValue(emp.shifts[i]);
      if (shift && !shift.isStatusCode) {
        const diff = i - liveDayIdx;
        return { dayLabel: diff === 1 ? 'Yarın' : `${diff} gün sonra`, shift, dayIdx: i, dateObj: activeData.rawDates[i] };
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

  // Servis bilgisi
  const normalizedRoute = emp.serviceRoute ? normalizeRouteCode(emp.serviceRoute) : null;
  const isOwnCar = normalizedRoute === 'KENDİ GELİYOR';
  const routeInfo = normalizedRoute && !isOwnCar ? routeData?.[normalizedRoute] : null;

  return (
    <>
      <div className="my-profile-sheet-backdrop my-profile-sheet-backdrop-glass" onClick={() => setIsProfileOpen(false)} aria-hidden="true" />
      <div
        className="my-profile-sheet my-profile-sheet-glass"
        role="dialog"
        aria-modal="true"
        aria-label="Profilim"
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        onTouchCancel={handleSheetTouchEnd}
      >
        <div className="emp-card-handle" />

        {/* ── Hero ── */}
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
          <button className="emp-card-close-btn" onClick={() => setIsProfileOpen(false)} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="my-profile-sheet-body" ref={sheetBodyRef}>

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
                      {carryoverShiftInfo.isActiveNow && (
                        <div className="next-shift-countdowns">
                          <div
                            className="next-shift-primary-main next-shift-countdown-chip shift"
                            style={{
                              '--shift-countdown-bg': carryoverShiftInfo.shift.bg,
                              '--shift-countdown-border': carryoverShiftInfo.shift.border || carryoverShiftInfo.shift.color,
                              '--shift-countdown-color': carryoverShiftInfo.shift.color,
                            }}
                          >
                            Sarkan vardiya bitimine {formatDuration(carryoverShiftInfo.remainingMinutes)} kaldı
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {todayShift ? (
                <>
                <div
                  className={`emp-today-shift shift-card-item ${primaryCardKey === 'today' ? 'is-primary' : 'is-secondary'} ${isTodayShiftActive ? 'active-now' : ''} ${shouldShowPrimaryNextShift && primaryCardKey !== 'today' ? 'reduced' : ''}`}
                >
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
                    <div className="emp-today-shift-label">
                      {todayShift.isStatusCode
                        ? todayShift.label
                        : `Vardiya süresi: ${formatDuration(todayShift.duration)}`}
                    </div>

                    {shouldShowPrimaryNextShift && !todayShift.isStatusCode && (
                      <div className="today-shift-completed-note">Bugünkü vardiya tamamlandı</div>
                    )}

                    {!todayShift.isStatusCode && liveCounterState && liveCounterState.source !== 'carryover' && !shouldShowPrimaryNextShift && (
                      <>
                        {todayBoardingTime && (
                          <div className="boarding-badge" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}>
                            <Bus size={13} />
                            Biniş: {todayBoardingTime}
                          </div>
                        )}

                        {liveCounterState.mode === 'active' ? (
                          <div className="live-shift-counter active">
                            <div className="live-shift-counter-main">
                              Vardiya bitimine {formatDuration(liveCounterState.remainingMinutes)} kaldı
                            </div>
                            <div className="live-shift-counter-sub">
                              {formatDuration(liveCounterState.elapsedMinutes)} geçti · %{Math.round((liveCounterState.progress || 0) * 100)} tamamlandı
                            </div>
                            <div className="live-shift-counter-bar">
                              <div className="live-shift-counter-fill" style={{ width: `${Math.round((liveCounterState.progress || 0) * 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="next-shift-countdowns">
                            {todayBoardingCountdownText && (
                              <div className="next-shift-primary-main next-shift-countdown-chip service">
                                {todayBoardingCountdownText}
                              </div>
                            )}
                            <div
                              className="next-shift-primary-main next-shift-countdown-chip shift"
                              style={{
                                '--shift-countdown-bg': liveCounterState.shift?.bg,
                                '--shift-countdown-border': liveCounterState.shift?.border || liveCounterState.shift?.color,
                                '--shift-countdown-color': liveCounterState.shift?.color,
                              }}
                            >
                              {getTodayCounterMainText(liveCounterState)}
                            </div>
                            {getTodayCounterSubText(liveCounterState) && (
                              <div className="next-shift-primary-main next-shift-countdown-chip info">
                                {getTodayCounterSubText(liveCounterState)}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Servis biniş saati (bugün için) */}
                    {todayBoardingTime && (!liveCounterState || shouldShowPrimaryNextShift) && (
                      <div className="boarding-badge" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}>
                        <Bus size={13} />
                        Biniş: {todayBoardingTime}
                      </div>
                    )}
                  </div>
                </div>

                {shouldShowPrimaryNextShift && (
                  <div className={`next-shift-primary-card shift-card-item ${primaryCardKey === 'next' ? 'is-primary' : 'is-secondary'}`}>
                    <div className="next-shift-primary-body">
                      <div className="emp-today-shift-icon next-shift-icon">
                        <Clock size={20} />
                      </div>
                      <div className="next-shift-primary-content">
                        <div className="shift-card-title">Sonraki vardiya</div>
                        <div className="shift-card-meta-row">
                          <span className="shift-card-date">{getPrimaryCardDateText()}</span>
                          <div
                            className="emp-week-shift-chip shift-time-chip"
                            style={{ background: primaryCardShift?.bg, color: primaryCardShift?.color }}
                          >
                            {getShiftTimeDisplay(primaryCardShift, '–')}
                          </div>
                        </div>
                        <div className="shift-duration-text">
                          Vardiya süresi: {formatDuration(primaryCardShift.duration)}
                        </div>
                        {nextShiftBoardingTime && (
                          <div className="boarding-badge" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}>
                            <Bus size={12} />
                            Biniş: {nextShiftBoardingTime}
                          </div>
                        )}
                        <div className="next-shift-countdowns">
                          {nextShiftBoardingCountdownText && (
                            <div className="next-shift-primary-main next-shift-countdown-chip service">
                              {nextShiftBoardingCountdownText}
                            </div>
                          )}
                          <div
                            className="next-shift-primary-main next-shift-countdown-chip shift"
                            style={{
                              '--shift-countdown-bg': primaryCardShift?.bg,
                              '--shift-countdown-border': primaryCardShift?.border || primaryCardShift?.color,
                              '--shift-countdown-color': primaryCardShift?.color,
                            }}
                          >
                            {nextShiftStartCountdownText}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!shouldShowPrimaryNextShift && nextShiftInfo && (
                  <div className={`next-shift-primary-card shift-card-item ${primaryCardKey === 'next' ? 'is-primary' : 'is-secondary'}`}>
                    <div className="next-shift-primary-body">
                      <div
                        className="emp-today-shift-icon next-shift-icon"
                        style={{ background: nextShiftInfo.shift.bg, color: nextShiftInfo.shift.color }}
                      >
                        <Clock size={20} />
                      </div>
                      <div className="next-shift-primary-content">
                        <div className="shift-card-title">Sonraki vardiya</div>
                        <div className="shift-card-meta-row">
                          <span className="shift-card-date">{getSecondaryCardDateText(nextShiftInfo)}</span>
                          <div
                            className="emp-week-shift-chip shift-time-chip"
                            style={{ background: nextShiftInfo.shift.bg, color: nextShiftInfo.shift.color }}
                          >
                            {getShiftTimeDisplay(nextShiftInfo.shift, '–')}
                          </div>
                        </div>
                        <div className="shift-duration-text">Vardiya süresi: {formatDuration(nextShiftInfo.shift.duration)}</div>
                        {myStop && myStop.times?.[nextShiftInfo.shift.start] && (
                          <div className="boarding-badge" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}>
                            <Bus size={12} />
                            Biniş: {myStop.times[nextShiftInfo.shift.start]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                </>
              ) : (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Bugün için vardiya bilgisi yok</div>
                  {shouldShowPrimaryNextShift && (
                    <div className={`next-shift-primary-card shift-card-item ${primaryCardKey === 'next' ? 'is-primary' : 'is-secondary'}`}>
                    <div className="next-shift-primary-body">
                      <div className="emp-today-shift-icon next-shift-icon">
                        <Clock size={20} />
                      </div>
                      <div className="next-shift-primary-content">
                        <div className="shift-card-title">Sonraki vardiya</div>
                        <div className="shift-card-meta-row">
                          <span className="shift-card-date">{getPrimaryCardDateText()}</span>
                          <div
                            className="emp-week-shift-chip shift-time-chip"
                            style={{ background: primaryCardShift?.bg, color: primaryCardShift?.color }}
                          >
                            {getShiftTimeDisplay(primaryCardShift, '–')}
                          </div>
                        </div>
                        <div className="shift-duration-text">
                          Vardiya süresi: {formatDuration(primaryCardShift.duration)}
                        </div>
                        {nextShiftBoardingTime && (
                          <div className="boarding-badge" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}>
                            <Bus size={12} />
                            Biniş: {nextShiftBoardingTime}
                          </div>
                        )}
                        <div className="next-shift-countdowns">
                          {nextShiftBoardingCountdownText && (
                            <div className="next-shift-primary-main next-shift-countdown-chip service">
                              {nextShiftBoardingCountdownText}
                            </div>
                          )}
                          <div
                            className="next-shift-primary-main next-shift-countdown-chip shift"
                            style={{
                              '--shift-countdown-bg': primaryCardShift?.bg,
                              '--shift-countdown-border': primaryCardShift?.border || primaryCardShift?.color,
                              '--shift-countdown-color': primaryCardShift?.color,
                            }}
                          >
                            {nextShiftStartCountdownText}
                          </div>
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

          {/* ── Bu Hafta ── */}
          {activeData && (
            <div className="emp-card-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="emp-card-section-title" style={{ margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>Bu Hafta</div>
                <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 500 }}>
                  {(emp.totalHours || '00:00').replace(/\s*h$/i, 's')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {activeData.rawDates.map((dateObj, i) => {
                  const shift = parseShiftValue(emp.shifts[i]);
                  const isToday = i === liveDayIdx;
                  const boardingTime = shift && !shift.isStatusCode ? myStop?.times?.[shift.start] : null;
                  const isPastDay = liveDayIdx >= 0 && i < liveDayIdx;
                  const isCompleted = isPastDay || isShiftCompleted(shift, i);
                  return (
                    <div key={i} className={`emp-week-row ${isToday ? 'today-row' : ''} ${isCompleted ? 'week-row-completed' : ''}`}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)', minWidth: 110 }}>
                        {dateObj.formatted.dayNum} {dateObj.formatted.month} {dateObj.formatted.dayName.slice(0, 3)}
                      </span>
                      {shift ? (
                        <span className="emp-week-shift-chip" style={{ background: shift.bg, color: shift.color }}>
                          {getShiftTimeDisplay(shift)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                      {boardingTime && (
                        <span className="boarding-badge" style={{ marginTop: 0, marginLeft: 8, padding: '2px 8px', fontSize: 11 }}>
                          <Bus size={11} />
                          {boardingTime}
                        </span>
                      )}
                      {shift && !shift.isStatusCode && (
                        <span className="emp-week-duration" style={{ marginLeft: 'auto' }}>
                          {formatDuration(shift.duration)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Haftalık Özet + Dağılım ── */}
          <div className="emp-card-section">
            <div className="emp-card-section-title">Haftalık Özet</div>
            <div className="emp-stats-grid">
              <div className="emp-stat-chip">
                <div className="emp-stat-number" style={{ color: 'var(--accent-primary)' }}>{workDays}</div>
                <div className="emp-stat-label">Çalışma</div>
              </div>
              <div className="emp-stat-chip">
                <div className="emp-stat-number">{emp.totalHours || '—'}</div>
                <div className="emp-stat-label">Toplam</div>
              </div>
              <div className="emp-stat-chip">
                <div className="emp-stat-number" style={{ color: 'var(--accent-warning)' }}>{offDays}</div>
                <div className="emp-stat-label">İzin/Off</div>
              </div>
            </div>
            {Object.keys(typeCounts).length > 0 && (
              <div className="emp-type-bar-wrap">
                <div className="emp-type-bar">
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <div key={type} className="emp-type-bar-segment"
                      style={{ width: `${(count / totalShiftType) * 100}%`, background: SHIFT_TYPE_META[type]?.color || '#64748b' }} />
                  ))}
                </div>
                <div className="emp-type-legend">
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <div key={type} className="emp-type-legend-item">
                      <span className="emp-type-legend-dot" style={{ background: SHIFT_TYPE_META[type]?.color || '#64748b' }} />
                      {SHIFT_TYPE_META[type]?.label || type} %{Math.round((count / totalShiftType) * 100)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Servis Takibi ── */}
          {emp.serviceRoute && (
            <div className="emp-card-section">
              <div className="emp-card-section-title">Servis Güzergahı</div>
              <div className="service-card">
                {/* Remove button */}
                {routeData && (
                  <button onClick={removeRouteFile} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} title="Servis dosyasını kaldır">
                    <X size={14} />
                  </button>
                )}
                <div className="service-card-header">
                  <div className="service-card-icon">
                    <Bus size={18} />
                  </div>
                  <div>
                    <div className="service-card-title">
                      {isOwnCar ? 'Kendi Aracım' : (routeInfo ? routeInfo.stops ? `${emp.serviceRoute} Güzergahı` : emp.serviceRoute : emp.serviceRoute)}
                    </div>
                    <div className="service-card-subtitle">
                      {isOwnCar ? 'Servise binmiyorsunuz' : routeData ? 'Güzergah dosyası yüklendi' : 'Güzergah dosyası yüklenmedi'}
                    </div>
                  </div>
                </div>

                {isOwnCar ? (
                  <div className="no-service-badge"><MapPin size={13} /> Servis kullanmıyorsunuz</div>
                ) : !routeData ? (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                      Güzergah Excel dosyasını yükleyerek servisin her sabah biniş saatini görün.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      <Upload size={14} />
                      Güzergah Dosyası Seç
                      <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".xlsx,.xls" onChange={(e) => { if (e.target.files?.length) handleRouteFile(e.target.files[0]); }} />
                    </label>
                  </div>
                ) : !routeInfo ? (
                  <div className="no-service-badge" style={{ color: 'var(--accent-warning)' }}>
                    <MapPin size={13} />
                    &quot;{emp.serviceRoute}&quot; güzergahı dosyada bulunamadı
                  </div>
                ) : (
                  <>
                    <select
                      className="service-stop-select"
                      value={myStop?.id || ''}
                      onChange={(e) => {
                        const sid = e.target.value;
                        if (!sid) saveMyStop(null);
                        else {
                          const st = routeInfo.stops.find(s => String(s.id) === String(sid));
                          if (st) saveMyStop(st);
                        }
                      }}
                    >
                      <option value="">Durağınızı seçin...</option>
                      {routeInfo.stops.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Profil Değiştir ── */}
          <div className="emp-card-section">
            <div className="emp-card-section-title">Profil Ayarları</div>

            {editingName ? (
              <div className="profile-name-search-wrap">
                <input
                  className="profile-name-search-input"
                  type="text"
                  placeholder="Yeni adınızı arayın..."
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  autoFocus
                />
                {personSearch.length >= 2 && personResults.length > 0 && (
                  <div className="profile-name-results">
                    {personResults.map((e) => (
                      <div key={e.id} className="profile-name-result-item" onClick={() => handleSelectName(e)}>
                        <EmployeeAvatar emp={e} isWorkingNow={false} size={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.departmentName || e.department}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setEditingName(false); setPersonSearch(''); }}
                  style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                >
                  İptal
                </button>
              </div>
            ) : (
              <div className="emp-action-row">
                <button
                  className="emp-action-btn"
                  onClick={() => setEditingName(true)}
                  style={{ marginBottom: 0 }}
                >
                  <RefreshCw size={15} />
                  Profili Değiştir
                </button>
                <button className="emp-action-btn" onClick={handleCopy} style={{ marginBottom: 0 }}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            )}
          </div>

          {/* ── Tehlike Bölgesi ── */}
          <div className="emp-card-section" style={{ borderBottom: 'none' }}>
            <button
              className={`danger-btn ${clearConfirmPending ? 'confirm-pending' : ''}`}
              onClick={clearAllData}
            >
              <Trash2 size={16} />
              {clearConfirmPending ? 'Emin misiniz? Tekrar tıklayın' : 'Tüm Verileri Sil'}
            </button>
            <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
              Bu işlem yüklü tüm dosyaları ve ayarları kalıcı olarak siler.
            </p>
          </div>

          {/* Sayfa sonu boşluk (safe-area) */}
          <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
        </div>{/* /my-profile-sheet-body */}

      </div>{/* /my-profile-sheet */}
    </>
  );
}
