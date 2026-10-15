'use client';

import { useMemo } from 'react';
import { parseShiftValue, isWorkingAt, checkOvernightFromPrevDay, getShiftTimeDisplay } from '@/lib/shiftUtils';
import { normalizeRouteCode } from '@/lib/routeUtils';
import { UserCircle, X, MapPin, Bus, Clock, AlertCircle, Trash2, AlertTriangle, Upload } from 'lucide-react';
import { useShift } from '@/context/ShiftContext';
import { EmployeeAvatar, checkIsWorkingNow } from './ShiftTable';

// ─── Şu An Çalışanlar Paneli ───

export function NowWorkingPanel() {
  const {
    nowWorkingData, effectiveDayIdx,
    setSelectedDept, setMobileTab, setPeekEmployee,
    activeData, todayIdx,
    prevWeekMissing, handleFile,
  } = useShift();

  const groupedWorking = nowWorkingData.working.reduce((acc, emp) => {
    if (!acc[emp.department]) acc[emp.department] = [];
    acc[emp.department].push(emp);
    return acc;
  }, {});

  const sortedGroups = Object.keys(groupedWorking).sort().map(dept => ({
    dept,
    employees: groupedWorking[dept]
  }));

  return (
    <div className="fade-in">


      {/* Önceki hafta yüklü değil uyarısı — Pazartesi 09:00'a kadar */}
      {prevWeekMissing && (
        <div className="panel-alert panel-alert-warning">
          <AlertTriangle size={18} className="panel-alert-icon panel-alert-icon-warning" />
          <div>
            <div className="panel-alert-title">Pazar gününden sarkan vardiyalar gösterilemiyor</div>
            <div className="panel-alert-text">
              Dünden (Pazar) sarkan gece vardiyaları gösterilemiyor.
              Doğru sonuç için önceki haftanın Excel dosyasını da yükleyin.
            </div>
            <label className="panel-upload-inline-btn">
              <Upload size={12} />
              Önceki haftayı yükle
              <input type="file" className="panel-hidden-input" accept=".xlsx,.xls" onChange={(e) => {
                if (e.target.files?.length) handleFile(e.target.files, true);
              }} />
            </label>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="now-working-stats">
        <div className="stat-card">
          <div className="stat-card-value success">{nowWorkingData.working.length}</div>
          <div className="stat-card-label">Çalışan</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value primary">{nowWorkingData.total}</div>
          <div className="stat-card-label">Toplam</div>
        </div>
      </div>





      {/* Working list */}
      {effectiveDayIdx >= 0 && (
        <div className="now-working-section">
          <h4>
            <span className="dot"></span>
            Çalışanlar ({nowWorkingData.working.length})
          </h4>
          <div className="now-working-list">
            {nowWorkingData.working.length === 0 && (
              <div className="empty-state empty-state-compact">
                <p className="empty-state-small-text">Bu saatte çalışan bulunamadı</p>
              </div>
            )}
            {sortedGroups.map(group => (
              <div key={group.dept} className="now-working-group">
                <div className="now-working-group-header">
                  <span>{group.dept}</span>
                  <span className="now-working-group-count">{group.employees.length} kişi</span>
                </div>
                <div className="now-working-group-list">
                  {group.employees.map((emp) => (
                    <div key={emp.id} className="now-working-item" onClick={() => setPeekEmployee(emp)}>
                      <EmployeeAvatar emp={emp} isWorkingNow={true} size={28} />
                      <span className="now-working-item-name now-working-item-name-spaced">
                        {emp.name}
                        {emp.serviceRoute && <span className="now-working-item-route">({emp.serviceRoute})</span>}
                      </span>
                      <span className="now-working-item-shift" style={{ color: emp.shiftInfo.color, background: emp.shiftInfo.bg }}>
                        {getShiftTimeDisplay(emp.shiftInfo)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kişi Arama Paneli ───

export function SearchPanel() {
  const {
    personSearch, setPersonSearch, personResults,
    todayIdx, effectiveDayIdx, effectiveMinutes,
    setSelectedDept, setMobileTab, setPeekEmployee,
    getPrevWeekSundayShift,
  } = useShift();

  return (
    <div className="fade-in">
      <input
        className="person-search-input"
        type="text"
        placeholder="Personel adı ile ara..."
        value={personSearch}
        onChange={(e) => setPersonSearch(e.target.value)}
      />

      <div className="person-search-results">
        {personSearch.length >= 2 && personResults.length === 0 && (
          <div className="empty-state empty-state-compact">
            <AlertCircle size={24} />
            <p>Sonuç bulunamadı</p>
          </div>
        )}
        {personResults.map((emp) => {
          const todayShift = todayIdx >= 0 ? parseShiftValue(emp.shifts[todayIdx]) : null;
          const prevWeekShift = effectiveDayIdx === 0 ? getPrevWeekSundayShift(emp.name) : undefined;
          const isWorkingNow = checkIsWorkingNow(emp, effectiveDayIdx, effectiveMinutes, prevWeekShift);

          return (
            <div
              key={emp.id}
              className="person-search-result"
              onClick={() => setPeekEmployee(emp)}
            >
              <div className="person-search-result-top">
                <EmployeeAvatar emp={emp} isWorkingNow={isWorkingNow} size={32} />
                <div className="person-search-result-info">
                  <div className="person-search-result-name">
                    {emp.name}
                    {emp.serviceRoute && <span className="employee-route">{emp.serviceRoute}</span>}
                  </div>
                  <div className="person-search-result-dept">
                    {emp.departmentName || emp.department}
                  </div>
                </div>
              </div>
              {todayShift && (
                <div className="person-search-shift-wrap">
                  <span className={`shift-cell ${todayShift.isStatusCode ? 'shift-cell-status' : ''}`} style={{
                    color: todayShift.color, background: todayShift.bg,
                  }}>
                    {todayShift.isStatusCode ? '' : 'Bugün: '}{getShiftTimeDisplay(todayShift)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── Profil (Ben) Paneli ───

export function MyProfilePanel() {
  const {
    myName, saveMyName, myEmployeeData,
    personSearch, setPersonSearch, personResults,
    activeData, todayIdx, effectiveDayIdx, effectiveMinutes,
    routeData, handleRouteFile, removeRouteFile,
    myStop, saveMyStop, clearAllData, clearConfirmPending,
    getPrevWeekSundayShift,
  } = useShift();

  if (!myName || !myEmployeeData) {
    return (
      <div className="fade-in my-profile-panel-root">
        <div className="my-profile-panel-empty-head">
          <div className="my-profile-panel-empty-icon-wrap">
            <UserCircle size={32} />
          </div>
          <h3 className="my-profile-panel-empty-title">Profilinizi Kaydedin</h3>
          <p className="my-profile-panel-empty-text">
            Kendi vardiyalarınızı daha hızlı takip etmek için lütfen listeden adınızı bulup seçin.
          </p>
        </div>

        <input
          className="person-search-input"
          type="text"
          placeholder="Adınızı arayın..."
          value={personSearch}
          onChange={(e) => setPersonSearch(e.target.value)}
        />

        {personSearch.length >= 2 && (
          <div className="person-search-results my-profile-search-results">
            {personResults.map((emp) => (
              <div
                key={emp.id}
                className="person-search-result"
                onClick={() => {
                  saveMyName(emp.name);
                  setPersonSearch('');
                }}
              >
                <div className="person-search-result-top">
                  <EmployeeAvatar emp={emp} isWorkingNow={false} size={32} />
                  <div className="person-search-result-info">
                    <div className="person-search-result-name">{emp.name}</div>
                    <div className="person-search-result-dept">{emp.departmentName || emp.department}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Profil atanmış ve data var
  const todayShift = todayIdx >= 0 ? parseShiftValue(myEmployeeData.shifts[todayIdx]) : null;
  const prevWeekShift = effectiveDayIdx === 0 ? getPrevWeekSundayShift(myEmployeeData.name) : undefined;
  const isWorkingNow = checkIsWorkingNow(myEmployeeData, effectiveDayIdx, effectiveMinutes, prevWeekShift);

  return (
    <div className="fade-in my-profile-panel-root">
      {/* Hero Kart */}
      <div className="my-profile-panel-hero">
        <button
          onClick={() => { saveMyName(''); setPersonSearch(''); }}
          className="my-profile-panel-change-btn"
          title="Profili Değiştir"
        >
          <X size={16} />
        </button>
        <div className="my-profile-panel-avatar-wrap">
          <EmployeeAvatar emp={myEmployeeData} isWorkingNow={isWorkingNow} size={72} />
        </div>
        <h2 className="my-profile-panel-name">
          {myEmployeeData.name}
        </h2>
        <div className="my-profile-panel-dept">
          {myEmployeeData.departmentName || myEmployeeData.department}
        </div>
        {myEmployeeData.serviceRoute && (
          <div className="my-profile-panel-route-badge">
            🚌 {myEmployeeData.serviceRoute}
          </div>
        )}
      </div>

      {/* Servis ve Durak Section */}
      <div className="my-profile-panel-service-wrap">
        {!routeData ? (
          <div className="my-profile-service-card my-profile-service-card-upload">
            <MapPin size={24} className="my-profile-service-map-icon" />
            <h4 className="my-profile-service-title">Akıllı Servis Takibi</h4>
            <p className="my-profile-service-text">İsteğe bağlı güncel güzergah Excel&apos;ini yükleyerek servisinizin tam biniş saatini görebilirsiniz.</p>
            <label className="my-profile-service-upload-btn">
              Dosya Seç
              <input type="file" className="panel-hidden-input" accept=".xlsx, .xls" onChange={(e) => {
                if (e.target.files?.length) handleRouteFile(e.target.files[0]);
              }} />
            </label>
          </div>
        ) : (
          <div className="my-profile-service-card my-profile-service-card-select">
            <button onClick={removeRouteFile} className="my-profile-service-remove-btn" title="Servis Dosyasını Kaldır"><X size={14} /></button>
            <div className="my-profile-service-header">
              <MapPin size={18} className="my-profile-service-header-icon" />
              <span className="my-profile-service-header-title">Servis Durağınız</span>
            </div>

            {(() => {
              if (!myEmployeeData.serviceRoute) {
                return <p className="my-profile-service-msg my-profile-service-msg-default">Vardiyada güzergahınız belirtilmemiş.</p>;
              }

              const normalizedRoute = normalizeRouteCode(myEmployeeData.serviceRoute);

              if (normalizedRoute === 'KENDİ GELİYOR') {
                return <p className="my-profile-service-msg my-profile-service-msg-default">Servis kullanmıyorsunuz (KG statüsü).</p>;
              }

              const routeInfo = routeData[normalizedRoute];

              if (!routeInfo) {
                return <p className="my-profile-service-msg my-profile-service-msg-warning">Vardiyadaki &quot;{myEmployeeData.serviceRoute}&quot; ({normalizedRoute}) güzergahı dosyada bulunamadı.</p>;
              }

              return (
                <select
                  className="my-profile-service-select"
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
                  <option value="">Lütfen durağınızı seçin...</option>
                  {routeInfo.stops.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bugünün Vardiyası */}
      <h4 className="my-profile-day-title">
        BUGÜNKÜ VARDİYANIZ
        {todayIdx >= 0 && activeData?.rawDates[todayIdx] && (
          <span className="my-profile-day-title-date">
            · {activeData.rawDates[todayIdx].formatted.dayNum} {activeData.rawDates[todayIdx].formatted.month}
          </span>
        )}
      </h4>
      <div className="my-profile-day-card">
        <div className="my-profile-day-icon" style={{
          width: 48, height: 48, borderRadius: 'var(--radius-sm)',
          background: todayShift ? todayShift.bg : 'var(--bg-card)',
          color: todayShift ? todayShift.color : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 20
        }}>
          {todayShift ? (todayShift.isStatusCode ? todayShift.icon : <Clock size={24} />) : <Clock size={24} />}
        </div>
        <div className="my-profile-day-content">
          <div className="my-profile-day-main">
            {todayShift ? (todayShift.isStatusCode ? todayShift.code : getShiftTimeDisplay(todayShift, ' - ')) : '-'}
          </div>
          <div className="my-profile-day-sub">
            {todayShift ? (todayShift.isStatusCode ? todayShift.label : `${Math.floor(todayShift.duration / 60)} saat ${todayShift.duration % 60} dk`) : 'Belirsiz'}
          </div>
          {myStop && todayShift && !todayShift.isStatusCode && (
            <div className="my-profile-boarding-chip">
              <Bus size={14} className="my-profile-boarding-chip-icon" />
              <span className="my-profile-boarding-chip-text">
                {myStop.times?.[todayShift.start] ? `Biniş: ${myStop.times[todayShift.start]}` : 'Bu saate servis yok'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Haftalık Özet */}
      <div className="my-profile-weekly-head">
        <h4 className="my-profile-weekly-title">
          HAFTALIK ÖZET
        </h4>
        <span className="my-profile-weekly-total">
          {myEmployeeData.totalHours || '00:00'}
        </span>
      </div>

      <div className="my-profile-weekly-list">
        {activeData && activeData.rawDates.map((dateObj, i) => {
          const shift = parseShiftValue(myEmployeeData.shifts[i]);
          const isToday = i === todayIdx;
          return (
            <div key={i} className={`my-profile-weekly-row ${isToday ? 'today' : ''}`}>
              <div className={`my-profile-weekly-date ${isToday ? 'today' : ''}`}>
                {`${dateObj.formatted.dayNum} ${dateObj.formatted.month} ${dateObj.formatted.dayName}`}
              </div>
              <div className="my-profile-weekly-shift-wrap">
                {shift ? (
                  <span className="my-profile-weekly-shift" style={{ background: shift.bg, color: shift.color }}>
                    {shift.isStatusCode ? `${shift.icon} ${shift.label}` : getShiftTimeDisplay(shift, ' - ')}
                  </span>
                ) : (
                  <span className="my-profile-weekly-empty">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="my-profile-danger-zone">
        <button
          onClick={clearAllData}
          className={`delete-data-btn ${clearConfirmPending ? 'confirm-pending' : ''}`}
        >
          <Trash2 size={16} />
          {clearConfirmPending ? 'Emin misiniz? Silmek için tekrar tıklayın' : 'Tüm Verileri Sil'}
        </button>
        <p className="my-profile-danger-note">
          Bu işlem yüklü olan tüm dosyaları ve yerel<br /> ayarlarınızı kalıcı olarak temizler.
        </p>
      </div>
    </div>
  );
}
