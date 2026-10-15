'use client';

import Image from 'next/image';
import { useShift } from '@/context/ShiftContext';
import { DAY_NAMES_SHORT } from '@/lib/constants';
import { Upload, FileSpreadsheet, X, Calendar, Clock, MapPin, UserCircle } from 'lucide-react';
import { TrackedEmployeesLauncher } from '@/components/TrackedEmployeesSheet';

export function Header() {
  const {
    files, activeFileIdx, setActiveFileIdx, activeData,
    handleFile, removeFile,
    setSelectedDept, setMobileTab,
    timeStr, dateStr,
    todayIdx, effectiveDayIdx,
    queryDayIdx, queryTime, setQueryTime, setQueryDayIdx, resetTimeOverride,
    setIsProfileOpen, isProfileOpen, myName
  } = useShift();

  return (
    <header className={`global-header ${(queryTime || queryDayIdx !== null) ? 'override-active' : ''}`}>
      {/* 1. Logo & Branding */}
      <div className="header-logo">
        <Image className="header-logo-image" src="/logo.png" alt="Logo" width={42} height={42} priority unoptimized />
      </div>

      {/* 2. Orta: Dosya Sekmeleri */}
      <div className="header-files">
        {files.length > 0 && (
          <div className="header-file-tabs">
            {files.map((f, i) => (
              <div
                key={f.name}
                className={`header-file-tab ${i === activeFileIdx ? 'active' : ''}`}
                onClick={() => { setActiveFileIdx(i); setSelectedDept(null); setMobileTab('table'); }}
              >
                <FileSpreadsheet size={16} />
                <span className="file-name">{f.name.replace('.xlsx', '').replace('.xls', '')}</span>
                <span className="file-meta">({f.data.employees.length})</span>
                <button
                  className="file-remove"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  title="Dosyayı kaldır"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="header-upload-btn" title="Yeni Dosya Ekle">
          <Upload size={16} />
          <span className="hide-mobile">Yükle</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files)}
          />
        </label>
      </div>

      {/* 3. Sağ: Zaman Kontrolü */}
      <div className="header-time-controls">
        <div className={`header-actions ${(queryTime || queryDayIdx !== null) ? 'has-override' : ''}`}>
          {activeData && (
            <div className="header-day-query header-query-field">
              <span className="header-query-icon" aria-hidden="true">
                <Calendar size={14} />
              </span>
              <select
                className={`time-input premium-time-input ${queryDayIdx !== null ? 'active-filter' : ''}`}
                value={queryDayIdx !== null ? queryDayIdx : todayIdx}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setQueryDayIdx(val === todayIdx && !queryTime ? null : val);
                }}
                title="Gün filtrele"
              >
                {activeData.rawDates.map((d, i) => (
                  <option key={i} value={i}>
                    {i === todayIdx ? 'Bugün: ' : ''}{d.formatted.dayNum} {d.formatted.month} {d.formatted.dayNameShort || d.formatted.dayName.substring(0, 3)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="header-time-query header-query-field">
            <span className="header-query-icon" aria-hidden="true">
              {queryTime ? <MapPin size={14} /> : <Clock size={14} />}
            </span>
            <input
              className={`time-input premium-time-input ${queryTime ? 'active-filter' : ''}`}
              type="time"
              value={queryTime || timeStr.substring(0, 5)}
              onChange={(e) => setQueryTime(e.target.value)}
              title="Özel saat filtrele"
            />
            { (queryTime || queryDayIdx !== null) && (
              <button
                className="time-reset-btn"
                onClick={() => resetTimeOverride()}
                title="Canlı zamana dön"
              >
                Canlı
              </button>
            )}
          </div>

          <div className="hide-mobile"><TrackedEmployeesLauncher compact /></div>

          <button
            className={`header-profile-btn hide-mobile ${isProfileOpen ? 'active' : ''}`}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            title={isProfileOpen ? 'Profili Kapat' : 'Profilim'}
          >
            <UserCircle size={20} />
            <span>Ben</span>
            {!myName && <span className="profile-dot"></span>}
          </button>
        </div>
      </div>
    </header>
  );
}
