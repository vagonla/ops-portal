'use client';

import { useCallback } from 'react';
import { SlidersHorizontal, Users } from 'lucide-react';
import { useShift } from '@/context/ShiftContext';
import ScheduleToolbar from './ScheduleToolbar';
import ScheduleFilterSheet from './ScheduleFilterSheet';
import WeekView from './WeekView';

export default function Schedule() {
  const {
    scheduleEmployees,
    scheduleActiveFilterCount,
    resetScheduleFilter,
    setPeekEmployee,
    activeData,
    prevWeekMissing,
  } = useShift();

  const onPeek = useCallback((emp) => setPeekEmployee(emp), [setPeekEmployee]);

  const isEmpty = scheduleEmployees.length === 0;

  return (
    <div className="schedule-shell">
      <ScheduleToolbar />

      {prevWeekMissing && (
        <div className="schedule-prev-week-warning" role="status">
          Önceki haftanın verisi yüklü değil — gece sarkmaları eksik görünebilir.
        </div>
      )}

      {!activeData ? (
        <EmptyNoData />
      ) : isEmpty ? (
        <EmptyFiltered onReset={resetScheduleFilter} hasFilter={scheduleActiveFilterCount > 0} />
      ) : (
        <WeekView onPeek={onPeek} />
      )}

      <ScheduleFilterSheet />
    </div>
  );
}

function EmptyNoData() {
  return (
    <div className="schedule-empty">
      <Users className="schedule-empty-icon" />
      <div className="schedule-empty-title">Henüz veri yok</div>
      <div className="schedule-empty-hint">
        Üst menüden bir vardiya Excel&apos;i yükleyerek çizelgeyi görüntüleyin.
      </div>
    </div>
  );
}

function EmptyFiltered({ onReset, hasFilter }) {
  return (
    <div className="schedule-empty">
      <SlidersHorizontal className="schedule-empty-icon" />
      <div className="schedule-empty-title">
        {hasFilter ? 'Bu filtrelere uyan çalışan yok' : 'Sonuç yok'}
      </div>
      <div className="schedule-empty-hint">
        Filtreyi gevşeterek daha fazla sonuç görebilirsiniz.
      </div>
      {hasFilter && (
        <button type="button" className="schedule-empty-reset" onClick={onReset}>
          Filtreyi sıfırla
        </button>
      )}
    </div>
  );
}
