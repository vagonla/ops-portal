'use client';

import { useMemo, useRef, useState } from 'react';
import { useShift } from '@/context/ShiftContext';
import { useDialog } from '@/lib/useDialog';
import { parseShiftValue, isWorkingAt, isOvernightCarryover, getShiftTimeDisplay } from '@/lib/shiftUtils';
import { storageGet, storageSet } from '@/lib/storage';
import { X, Users, Plus, Search, UserCheck, CalendarDays, AlertTriangle } from 'lucide-react';

const TRACKED_FRIENDS_KEY = 'ops-tracked-friends-v1';

function todayIso() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function normalizeText(value) {
  return String(value || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

function formatDay(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { name: 'Gün', number: '' };
  return {
    name: parsed.toLocaleDateString('tr-TR', { weekday: 'short' }).replace('.', ''),
    number: parsed.toLocaleDateString('tr-TR', { day: 'numeric' }),
  };
}

function memberStatus(member, selectedWeekStart = '') {
  const today = todayIso();
  const week = member.shifts?.find(candidate => candidate.weekStart === selectedWeekStart)
    || member.shifts?.find(candidate => candidate.weekStart <= today && candidate.weekEnd >= today)
    || member.shifts?.[0];
  if (!week) return { week: null, working: false, tone: 'empty', text: 'Bu haftanın dosyasında bulunamadı' };

  const dayIndex = week.days.findIndex(day => day.date === today);
  const todayValue = dayIndex >= 0 ? week.days[dayIndex].value : '';
  const shift = parseShiftValue(todayValue);
  let working = Boolean(shift && !shift.isStatusCode && isWorkingAt(shift, currentMinutes()));

  if (!working && dayIndex > 0) {
    const previous = parseShiftValue(week.days[dayIndex - 1].value);
    working = Boolean(previous && !previous.isStatusCode && isOvernightCarryover(previous, currentMinutes()));
  }

  if (working) return { week, working: true, tone: 'working', text: 'Şu an çalışıyor' };
  if (shift?.isStatusCode) return { week, working: false, tone: 'leave', text: shift.label };
  if (shift) return { week, working: false, tone: 'scheduled', text: `Bugün ${getShiftTimeDisplay(shift)}` };
  if (dayIndex < 0 && week.weekStart > today) return { week, working: false, tone: 'scheduled', text: 'Sonraki haftanın vardiyası' };
  return { week, working: false, tone: 'off', text: dayIndex >= 0 ? 'Bugün vardiyası yok' : 'Yüklü haftanın vardiyası' };
}


export function TrackedEmployeesLauncher({ compact = false }) {
  const { setIsTrackedOpen, setIsProfileOpen } = useShift();
  return (
    <button className={`social-launcher ${compact ? 'compact' : ''}`} onClick={() => { setIsProfileOpen(false); setIsTrackedOpen(true); }} type="button" aria-label="Takip ettiğim çalışanlar" title="Takip ettiğim çalışanlar">
      <Users size={18} />
      {!compact && <span>Takip listem</span>}
    </button>
  );
}

export default function TrackedEmployeesSheet() {
  const { activeData, files, activeFileIdx, isTrackedOpen, setIsTrackedOpen } = useShift();
  const [error, setError] = useState('');
  const [trackedNames, setTrackedNames] = useState(() => {
    const stored = storageGet(TRACKED_FRIENDS_KEY);
    if (!stored.ok || !stored.value) return [];
    try {
      const parsed = JSON.parse(stored.value);
      return Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name.trim()).slice(0, 30) : [];
    } catch { return []; }
  });
  const [employeeQuery, setEmployeeQuery] = useState('');
  const dialogRef = useRef(null);
  useDialog(isTrackedOpen, () => setIsTrackedOpen(false), dialogRef);
  const activeFile = files[activeFileIdx] || null;
  const trackedMembers = useMemo(() => trackedNames.map(name => {
    const employee = activeData?.employees.find(candidate => normalizeText(candidate.name.trim()) === normalizeText(name.trim()));
    const week = employee && activeData?.rawDates?.length === 7 ? {
      weekStart: activeData.rawDates[0].formatted.iso,
      weekEnd: activeData.rawDates[6].formatted.iso,
      days: activeData.rawDates.map((date, index) => ({ date: date.formatted.iso, value: employee.shifts[index] || '' })),
      sourceName: activeFile?.name || '',
    } : null;
    return {
      id: `local:${normalizeText(name)}`,
      name: employee?.name || name,
      available: Boolean(employee),
      shifts: week ? [week] : [],
    };
  }), [activeData, activeFile?.name, trackedNames]);

  const employeeCandidates = useMemo(() => {
    const query = normalizeText(employeeQuery.trim());
    if (!activeData || query.length < 2) return [];
    const tracked = new Set(trackedNames.map(normalizeText));
    return activeData.employees
      .filter(employee => !tracked.has(normalizeText(employee.name)) && normalizeText(employee.name).includes(query))
      .slice(0, 8);
  }, [activeData, employeeQuery, trackedNames]);

  const saveTrackedNames = nextNames => {
    const unique = [...new Map(nextNames.map(name => [normalizeText(name), name.trim()])).values()].slice(0, 30);
    const saved = storageSet(TRACKED_FRIENDS_KEY, JSON.stringify(unique));
    if (!saved.ok) {
      setError('Takip listeniz bu cihazda kaydedilemedi. Tarayıcı depolamasını kontrol edin.');
      return false;
    }
    setTrackedNames(unique);
    return true;
  };

  const addTrackedFriend = employee => {
    if (trackedNames.length >= 30) { setError('En fazla 30 çalışan takip edebilirsiniz.'); return; }
    saveTrackedNames([...trackedNames, employee.name]);
    setEmployeeQuery('');
  };

  const removeTrackedFriend = name => {
    saveTrackedNames(trackedNames.filter(candidate => normalizeText(candidate) !== normalizeText(name)));
  };


  if (!isTrackedOpen) return null;
  return (
    <>
      <div className="social-sheet-backdrop" onClick={() => setIsTrackedOpen(false)} aria-hidden="true" />
      <section ref={dialogRef} tabIndex={-1} className="social-sheet" role="dialog" aria-modal="true" aria-labelledby="tracked-title">
        <div className="social-sheet-header">
          <div className="social-sheet-heading">
            <div className="social-sheet-brand"><Users size={14} /> OPS Portal</div>
            <h2 id="tracked-title">Takip listem</h2>
            <p>Seçtiğiniz çalışanların vardiyalarını bu cihazda takip edin.</p>
          </div>
          <button type="button" className="social-icon-btn" onClick={() => setIsTrackedOpen(false)} aria-label="Kapat"><X size={20} /></button>
        </div>
        <div className="social-sheet-body">
          {error && <div className="social-alert error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" aria-label="Hatayı kapat" onClick={() => setError('')}>×</button></div>}
          <section className="social-local-section" aria-labelledby="tracked-friends-title">
            <div className="social-local-heading">
              <div>
                <h3 id="tracked-friends-title">Takip ettiğim çalışanlar</h3>
                <p>Seçimleriniz yalnızca bu cihazda saklanır.</p>
              </div>
              <span>{trackedMembers.length} kişi</span>
            </div>

            {activeData ? (
              <div className="social-employee-picker">
                <label className="social-search">
                  <Search size={16} />
                  <span className="sr-only">Çalışan ara ve ekle</span>
                  <input value={employeeQuery} onChange={event => setEmployeeQuery(event.target.value)} placeholder="Çalışan adı yazın" autoComplete="off" />
                </label>
                {employeeQuery.trim().length >= 2 && (
                  <div className="social-candidate-list">
                    {employeeCandidates.length === 0 ? (
                      <div className="social-candidate-empty">Eklenebilecek çalışan bulunamadı.</div>
                    ) : employeeCandidates.map(employee => (
                      <button type="button" key={employee.id} onClick={() => addTrackedFriend(employee)}>
                        <span><strong>{employee.name}</strong><small>{employee.departmentName || employee.department}</small></span>
                        <span className="social-add-label"><Plus size={15} /> Ekle</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="social-local-hint"><CalendarDays size={17} /><span>Çalışan seçebilmek için önce haftalık Excel dosyasını yükleyin.</span></div>
            )}

            {trackedMembers.length === 0 ? (
              <div className="social-empty compact"><UserCheck size={24} /><p>Takip listeniz boş. Excel’deki bir çalışanı arayıp ekleyin.</p></div>
            ) : (
              <div className="social-local-list">
                {trackedMembers.map(member => {
                  const status = memberStatus(member);
                  const localStatusText = status.text;
                  return (
                    <article className={`social-member social-local-member ${status.tone}`} key={member.id}>
                      <div className="social-member-top">
                        <div className="social-avatar small">{member.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</div>
                        <div className="social-member-name">
                          <div><strong>{member.name}</strong><span className="social-you-badge">Bu cihazda</span></div>
                          <span className={`social-status-pill ${status.tone}`}><span className="social-status-dot" />{member.available ? localStatusText : 'Bu haftanın dosyasında bulunamadı'}</span>
                        </div>
                        <button type="button" className="social-icon-btn subtle" aria-label={`${member.name} adlı çalışanı takipten çıkar`} title="Takipten çıkar" onClick={() => removeTrackedFriend(member.name)}><X size={16} /></button>
                      </div>

                      {status.week ? (
                        <>
                          <div className="social-week-grid" aria-label={`${member.name} haftalık vardiyası`}>
                            {status.week.days.map(day => {
                              const parsed = parseShiftValue(day.value);
                              const label = parsed ? (parsed.isStatusCode ? parsed.label : getShiftTimeDisplay(parsed)) : '—';
                              const dayLabel = formatDay(day.date);
                              return (
                                <div className={day.date === todayIso() ? 'today' : ''} key={day.date} title={day.value || 'Vardiya yok'}>
                                  <span>{dayLabel.name} <small>{dayLabel.number}</small></span>
                                  <strong>{label}</strong>
                                </div>
                              );
                            })}
                          </div>
                          <div className="social-updated"><CalendarDays size={11} /> {status.week.sourceName}</div>
                        </>
                      ) : (
                        <div className="social-no-shift"><CalendarDays size={16} /> Yeni haftanın Excel dosyasını yüklediğinizde vardiyası burada görünecek.</div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </section>
    </>
  );
}
