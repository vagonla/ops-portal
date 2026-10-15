'use client';

import { useCallback } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useShift } from '@/context/ShiftContext';

export default function ScheduleToolbar() {
  const {
    scheduleFilter, updateScheduleFilter, resetScheduleFilter,
    scheduleActiveFilterCount,
    setIsScheduleFilterOpen,
  } = useShift();

  const onSearch = useCallback((e) => {
    updateScheduleFilter({ search: e.target.value });
  }, [updateScheduleFilter]);

  const clearSearch = useCallback(() => {
    updateScheduleFilter({ search: '' });
  }, [updateScheduleFilter]);

  return (
    <div className="schedule-toolbar">
      <div className="schedule-toolbar-row">
        <div className="schedule-search-wrap">
          <Search className="schedule-search-icon" />
          <input
            type="text"
            className="schedule-search-input"
            placeholder="İsim ara..."
            value={scheduleFilter.search}
            onChange={onSearch}
            autoComplete="off"
          />
          {scheduleFilter.search && (
            <button
              type="button"
              className="schedule-search-clear-btn"
              onClick={clearSearch}
              aria-label="Aramayı temizle"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={`schedule-filter-trigger ${scheduleActiveFilterCount > 0 ? 'has-active' : ''}`}
          onClick={() => setIsScheduleFilterOpen(true)}
        >
          <SlidersHorizontal />
          <span className="label">Filtre</span>
          {scheduleActiveFilterCount > 0 && (
            <span className="schedule-filter-count">{scheduleActiveFilterCount}</span>
          )}
        </button>
      </div>

      <ActiveFilterChips
        filter={scheduleFilter}
        onUpdate={updateScheduleFilter}
        onResetAll={resetScheduleFilter}
        activeCount={scheduleActiveFilterCount}
      />
    </div>
  );
}

function ActiveFilterChips({ filter, onUpdate, onResetAll, activeCount }) {
  if (activeCount === 0) return null;

  const removeStatus = (s) => onUpdate({ statuses: filter.statuses.filter((x) => x !== s) });
  const removeType = (t) => onUpdate({ shiftTypes: filter.shiftTypes.filter((x) => x !== t) });
  const removeDept = (d) => onUpdate({ departments: filter.departments.filter((x) => x !== d) });

  const statusLabels = {
    working: 'Şu an çalışıyor',
    onLeave: 'İzinli',
    carryover: 'Dünden sarkan',
    starting: 'Başlayacak',
    finished: 'Bitti',
  };
  const typeLabels = { NIGHT: 'Gece', MORNING: 'Sabah', EVENING: 'Akşam', MIXED: 'Karma' };

  return (
    <div className="schedule-active-filters">
      {filter.statuses.map((s) => (
        <span key={`st-${s}`} className="schedule-active-chip">
          {statusLabels[s] || s}
          <button
            type="button"
            className="schedule-active-chip-remove"
            onClick={() => removeStatus(s)}
            aria-label="Kaldır"
          >
            <X />
          </button>
        </span>
      ))}
      {filter.shiftTypes.map((t) => (
        <span key={`ty-${t}`} className="schedule-active-chip">
          {typeLabels[t] || t}
          <button
            type="button"
            className="schedule-active-chip-remove"
            onClick={() => removeType(t)}
            aria-label="Kaldır"
          >
            <X />
          </button>
        </span>
      ))}
      {filter.departments.map((d) => (
        <span key={`dp-${d}`} className="schedule-active-chip" title={d}>
          {d.length > 22 ? d.slice(0, 20) + '…' : d}
          <button
            type="button"
            className="schedule-active-chip-remove"
            onClick={() => removeDept(d)}
            aria-label="Kaldır"
          >
            <X />
          </button>
        </span>
      ))}
      {filter.myDeptOnly && (
        <span className="schedule-active-chip">
          Kendi ekibim
          <button
            type="button"
            className="schedule-active-chip-remove"
            onClick={() => onUpdate({ myDeptOnly: false })}
            aria-label="Kaldır"
          >
            <X />
          </button>
        </span>
      )}
      {filter.timeRange && (
        <span className="schedule-active-chip">
          {minToTime(filter.timeRange[0])} – {minToTime(filter.timeRange[1])}
          <button
            type="button"
            className="schedule-active-chip-remove"
            onClick={() => onUpdate({ timeRange: null })}
            aria-label="Kaldır"
          >
            <X />
          </button>
        </span>
      )}
      <button type="button" className="schedule-reset-all" onClick={onResetAll}>
        Tümünü sıfırla
      </button>
    </div>
  );
}

function minToTime(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
