'use client';

import { memo, useMemo, useEffect, useRef, useState } from 'react';
import { useShift } from '@/context/ShiftContext';
import { DepartmentSection } from '@/components/ShiftTable';

const INITIAL_BATCH = 50;
const BATCH_INCREMENT = 40;

function WeekViewInner({ onPeek }) {
  const {
    scheduleEmployees,
    activeData,
    todayIdx,
    effectiveDayIdx,
    effectiveMinutes,
    myName,
    getPrevWeekSundayShift,
  } = useShift();

  const columnCount = 10; // personel | servis | 7 gun | toplam

  // Flatten + slice (dept header + emp satirlari, infinite scroll)
  const totalEmp = useMemo(
    () => scheduleEmployees.reduce((sum, d) => sum + d.employees.length, 0),
    [scheduleEmployees],
  );

  // Liste degisirse sayaci render sirasinda sifirla.
  const [limit, setLimit] = useState(INITIAL_BATCH);
  const [prevTotalEmp, setPrevTotalEmp] = useState(totalEmp);
  if (prevTotalEmp !== totalEmp) {
    setPrevTotalEmp(totalEmp);
    setLimit(INITIAL_BATCH);
  }

  const sliced = useMemo(() => {
    const out = [];
    let seen = 0;
    for (const dept of scheduleEmployees) {
      if (seen >= limit) break;
      const remaining = limit - seen;
      const take = Math.min(remaining, dept.employees.length);
      out.push({ ...dept, employees: dept.employees.slice(0, take) });
      seen += take;
    }
    return out;
  }, [scheduleEmployees, limit]);

  const hasMore = totalEmp > limit;
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((v) => v + BATCH_INCREMENT);
      },
      { rootMargin: '300px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, sliced.length]);

  if (!activeData || totalEmp === 0) return null;

  return (
    <div className="shift-table-container">
      <table className="shift-table">
        <thead>
          <tr>
            <th>Personel</th>
            <th>Servis</th>
            {activeData.rawDates.slice(0, 7).map((d, idx) => (
              <th key={idx} className={idx === todayIdx ? 'today' : ''}>
                {d.formatted?.dayNameShort || ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][idx]}
                <span className="th-date">{d.formatted?.dayNum}</span>
              </th>
            ))}
            <th>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {sliced.map((dept) => (
            <DepartmentSection
              key={dept.fullName}
              dept={dept}
              todayIdx={todayIdx}
              showHeader={true}
              effectiveDayIdx={effectiveDayIdx}
              effectiveMinutes={effectiveMinutes}
              columnCount={columnCount}
              myName={myName}
              onPeek={onPeek}
              getPrevWeekSundayShift={getPrevWeekSundayShift}
            />
          ))}
          {hasMore && (
            <tr>
              <td colSpan={columnCount}>
                <div ref={sentinelRef} className="infinite-scroll-sentinel">
                  <span className="infinite-scroll-spinner">◐</span>
                  <span className="infinite-scroll-text">{limit}/{totalEmp} yükleniyor…</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(WeekViewInner);
