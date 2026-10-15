'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useShift } from '@/context/ShiftContext';

const STATUS_OPTIONS = [
  { id: 'working', label: 'Şu an çalışıyor' },
  { id: 'carryover', label: 'Dünden sarkan' },
  { id: 'starting', label: 'Başlayacak' },
  { id: 'finished', label: 'Bitti' },
  { id: 'onLeave', label: 'İzinli' },
];

const SHIFT_TYPE_OPTIONS = [
  { id: 'NIGHT', label: 'Gece', color: '#5aa5e8' },
  { id: 'MORNING', label: 'Sabah', color: '#22d3ee' },
  { id: 'EVENING', label: 'Akşam', color: '#f59e0b' },
  { id: 'MIXED', label: 'Uzun', color: '#a78bfa' },
];

export default function ScheduleFilterSheet() {
  const {
    isScheduleFilterOpen, setIsScheduleFilterOpen,
    scheduleFilter, setScheduleFilter, resetScheduleFilter,
    activeData, myDeptFullName,
  } = useShift();

  // Sheet icerisinde local draft — Uygula deyince commit.
  // Acilis aninda context filtresinden seed et (render sirasinda adjust pattern).
  const [draft, setDraft] = useState(scheduleFilter);
  const [prevOpen, setPrevOpen] = useState(isScheduleFilterOpen);
  if (prevOpen !== isScheduleFilterOpen) {
    setPrevOpen(isScheduleFilterOpen);
    if (isScheduleFilterOpen) setDraft(scheduleFilter);
  }

  // ESC ile kapat
  useEffect(() => {
    if (!isScheduleFilterOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsScheduleFilterOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isScheduleFilterOpen, setIsScheduleFilterOpen]);

  const close = useCallback(() => setIsScheduleFilterOpen(false), [setIsScheduleFilterOpen]);
  const apply = useCallback(() => {
    setScheduleFilter(draft);
    close();
  }, [draft, setScheduleFilter, close]);
  const reset = useCallback(() => {
    resetScheduleFilter();
    close();
  }, [resetScheduleFilter, close]);

  if (!isScheduleFilterOpen) return null;

  const toggle = (key, id) => {
    setDraft((prev) => {
      const cur = prev[key] || [];
      return cur.includes(id)
        ? { ...prev, [key]: cur.filter((x) => x !== id) }
        : { ...prev, [key]: [...cur, id] };
    });
  };

  const toggleDept = (fullName) => toggle('departments', fullName);
  const toggleStatus = (id) => toggle('statuses', id);
  const toggleType = (id) => toggle('shiftTypes', id);

  const onTimeChange = (idx, val) => {
    const m = parseTimeInput(val);
    if (m === null) return;
    setDraft((prev) => {
      const range = prev.timeRange ? [...prev.timeRange] : [0, 1440];
      range[idx] = m;
      // Basit tutarlilik
      if (range[0] > range[1]) range[0] = range[1];
      return { ...prev, timeRange: range };
    });
  };

  const clearTimeRange = () => setDraft((prev) => ({ ...prev, timeRange: null }));

  const timeRange = draft.timeRange || null;

  return (
    <>
      <div className="schedule-filter-backdrop" onClick={close} />
      <div className="schedule-filter-panel" role="dialog" aria-label="Gelişmiş filtre">
        <div className="schedule-filter-handle" />
        <div className="schedule-filter-head">
          <div className="schedule-filter-title">Gelişmiş Filtre</div>
          <button type="button" className="schedule-filter-close" onClick={close} aria-label="Kapat">
            <X />
          </button>
        </div>

        <div className="schedule-filter-body">
          {/* Durum */}
          <section className="schedule-filter-section">
            <div className="schedule-filter-section-title">Durum</div>
            <div className="schedule-filter-options">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`schedule-filter-option ${draft.statuses.includes(o.id) ? 'selected' : ''}`}
                  onClick={() => toggleStatus(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Vardiya tipi */}
          <section className="schedule-filter-section">
            <div className="schedule-filter-section-title">Vardiya Tipi</div>
            <div className="schedule-filter-options">
              {SHIFT_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`schedule-filter-option ${draft.shiftTypes.includes(o.id) ? 'selected' : ''}`}
                  onClick={() => toggleType(o.id)}
                  style={draft.shiftTypes.includes(o.id)
                    ? { borderColor: o.color + '70', color: o.color }
                    : undefined
                  }
                >
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: 999, background: o.color,
                      display: 'inline-block',
                    }}
                  />
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Ekibim toggle */}
          <section className="schedule-filter-section">
            <div className="schedule-filter-toggle-row">
              <div>
                <div className="schedule-filter-toggle-label">Sadece kendi ekibim</div>
                {myDeptFullName ? (
                  <div className="schedule-filter-toggle-sub">{myDeptFullName}</div>
                ) : (
                  <div className="schedule-filter-toggle-sub">Önce profilde adını seç</div>
                )}
              </div>
              <button
                type="button"
                className={`schedule-filter-switch ${draft.myDeptOnly ? 'on' : ''}`}
                onClick={() => setDraft((p) => ({ ...p, myDeptOnly: !p.myDeptOnly }))}
                aria-label="Sadece kendi ekibim"
                disabled={!myDeptFullName}
              />
            </div>
          </section>

          {/* Departman */}
          {!draft.myDeptOnly && activeData?.departments?.length > 0 && (
            <section className="schedule-filter-section">
              <div className="schedule-filter-section-title">Departman</div>
              <div className="schedule-filter-options">
                {activeData.departments.map((d) => (
                  <button
                    key={d.fullName}
                    type="button"
                    className={`schedule-filter-option ${draft.departments.includes(d.fullName) ? 'selected' : ''}`}
                    onClick={() => toggleDept(d.fullName)}
                    title={d.fullName}
                  >
                    {d.name || d.fullName}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Saat araligi */}
          <section className="schedule-filter-section">
            <div className="schedule-filter-section-title">
              Saat Aralığı {timeRange && (
                <button
                  type="button"
                  className="schedule-reset-all"
                  onClick={clearTimeRange}
                  style={{ fontSize: 10, padding: '2px 6px' }}
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="schedule-filter-time">
              <input
                type="time"
                className="schedule-filter-time-input"
                value={timeRange ? formatMin(timeRange[0]) : '08:00'}
                onChange={(e) => onTimeChange(0, e.target.value)}
              />
              <span className="schedule-filter-time-sep">—</span>
              <input
                type="time"
                className="schedule-filter-time-input"
                value={timeRange ? formatMin(timeRange[1]) : '14:00'}
                onChange={(e) => onTimeChange(1, e.target.value)}
              />
            </div>
          </section>
        </div>

        <div className="schedule-filter-footer">
          <button type="button" className="schedule-filter-footer-reset" onClick={reset}>
            Sıfırla
          </button>
          <button type="button" className="schedule-filter-footer-apply" onClick={apply}>
            Uygula
          </button>
        </div>
      </div>
    </>
  );
}

function parseTimeInput(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mins)) return null;
  return Math.max(0, Math.min(1440, h * 60 + mins));
}

function formatMin(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
