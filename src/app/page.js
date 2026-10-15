'use client';

import { useMemo } from 'react';
import { useShift } from '@/context/ShiftContext';

import { NowWorkingPanel, SearchPanel } from '@/components/Panels';
import { Header } from '@/components/Header';
import ToastContainer from '@/components/ToastContainer';
import EmployeeProfileCard from '@/components/EmployeeProfileCard';
import MyProfileSheet from '@/components/MyProfileSheet';
import DisclaimerModal from '@/components/DisclaimerModal';
import Schedule from '@/components/schedule/Schedule';
import TrackedEmployeesSheet, { TrackedEmployeesLauncher } from '@/components/TrackedEmployeesSheet';
import { Upload, FileSpreadsheet, Search, Clock, CalendarDays, Building2, Layers, UserCircle, Users } from 'lucide-react';

/**
 * Ana sayfa bileşeni.
 *
 * Çizelge bölümü `src/components/schedule/Schedule.js` içerisinde yönetilir.
 * Eski tablo/infinite-scroll logic'i oraya taşındı; page.js sadece kabuk, panelleri
 * ve modalları yerleştirir.
 */
export default function Home() {
  const {
    files, activeData, isTrackedOpen, setIsTrackedOpen,
    handleFile,
    dragging, onDragOver, onDragLeave, onDrop,
    searchQuery, setSearchQuery,
    filteredDepartments,
    rightPanelTab, setRightPanelTab,
    mobileTab, setMobileTab,
    effectiveDayIdx, effectiveMinutes,
    queryDayIdx, queryTime, resetTimeOverride,
    myName, isProfileOpen, setIsProfileOpen,
    hasAcceptedDisclaimer, acceptDisclaimer,
    scheduleFilter, updateScheduleFilter,
  } = useShift();

  const sidebarSelectedDept = scheduleFilter.departments.length === 1 && !scheduleFilter.myDeptOnly
    ? scheduleFilter.departments[0]
    : null;
  const sidebarAllActive = scheduleFilter.departments.length === 0 && !scheduleFilter.myDeptOnly;

  const pickSidebarDept = (fullName) => {
    updateScheduleFilter({
      departments: fullName ? [fullName] : [],
      myDeptOnly: false,
    });
    setMobileTab('table');
  };

  const isOverrideActive = queryDayIdx !== null || Boolean(queryTime);

  const overrideWarningText = useMemo(() => {
    if (!isOverrideActive) return '';

    const dayObj = activeData?.rawDates?.[effectiveDayIdx];
    const safeMinutes = Number.isFinite(effectiveMinutes) ? effectiveMinutes : 0;
    const hh = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
    const mm = String(safeMinutes % 60).padStart(2, '0');

    if (!dayObj) {
      return `Şu an ${hh}:${mm} simülasyon verilerine bakıyorsunuz.`;
    }

    const dateText = `${dayObj.formatted.dayNum} ${dayObj.formatted.month} ${dayObj.formatted.dayName}`;
    return `Şu an ${dateText} ${hh}:${mm} verilerine bakıyorsunuz.`;
  }, [activeData, effectiveDayIdx, effectiveMinutes, isOverrideActive]);

  const activeNavIndex = useMemo(() => {
    if (isProfileOpen) return 4;
    if (isTrackedOpen) return 3;
    if (mobileTab === 'departments') return 1;
    if (mobileTab === 'table') return 2;
    return 0;
  }, [isProfileOpen, isTrackedOpen, mobileTab]);

  // Henüz localStorage'tan durum çekilmediyse boş renderla (hydration flash'ını önlemek için)
  if (hasAcceptedDisclaimer === null) return null;

  // Sorumluluk reddi onaylanmamışsa hiçbir şeye izin verme, sadece modalı göster
  if (hasAcceptedDisclaimer === false) {
    return <DisclaimerModal onAccept={acceptDisclaimer} />;
  }

  // ─── Upload ekranı ───
  if (files.length === 0) {
    return (
      <>
        <div className="app-container">
          <div className="upload-social-launcher"><TrackedEmployeesLauncher /></div>
          <div className="upload-screen" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <div className="upload-container fade-in">
            <div className="upload-icon-wrap">
              <FileSpreadsheet />
            </div>
            <h2>Vardiya Programı Görüntüleyici</h2>
            <p>
              Haftalık vardiya programı Excel dosyanızı yükleyin.<br />
              Departman bazında görüntüleme, anlık çalışan sorgulama ve detaylı istatistikler.
            </p>
            <div
              className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => document.getElementById('file-input').click()}
            >
              <div className="upload-dropzone-content">
                <Upload />
                <p>Excel dosyanızı sürükleyin veya <span>dosya seçin</span></p>
                <small>.xlsx formatındaki haftalık vardiya programları</small>
              </div>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={(e) => handleFile(e.target.files)}
              />
            </div>
          </div>
        </div>
          <ToastContainer />
        </div>
        <TrackedEmployeesSheet />
      </>
    );
  }

  // ─── Ana uygulama ───
  return (
    <>
      <Header />
      {isOverrideActive && (
        <div className="global-override-warning" role="status" aria-live="polite">
          <span className="global-override-warning-text">{overrideWarningText}</span>
          <button
            type="button"
            className="global-override-reset-btn"
            onClick={() => resetTimeOverride()}
          >
            Canlıya dön
          </button>
        </div>
      )}
      <div className={`app-container mobile-tab-${mobileTab} ${isOverrideActive ? 'with-override-warning' : ''}`}>
      {/* RIGHT PANEL (Left on desktop) */}
      <aside className="right-panel">
        <div className="right-panel-header">
          <div className="panel-tabs">
            <button className={`panel-tab ${rightPanelTab === 'now' ? 'active' : ''}`} onClick={() => setRightPanelTab('now')}>
              <Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> Şu An
            </button>
            <button className={`panel-tab ${rightPanelTab === 'search' ? 'active' : ''}`} onClick={() => setRightPanelTab('search')}>
              <Search size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> Kişi Ara
            </button>

          </div>
        </div>

        <div className="right-panel-content">
          {rightPanelTab === 'now' && <NowWorkingPanel />}
          {rightPanelTab === 'search' && <SearchPanel />}
        </div>
      </aside>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ paddingBottom: 0 }}>
          {/* Department search */}
          <div className="sidebar-search">
          <Search className="sidebar-search-icon" />
          <input
            type="text"
            placeholder="Departman ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-departments">
        <button
          className={`sidebar-all-btn ${sidebarAllActive ? 'active' : ''}`}
          onClick={() => pickSidebarDept(null)}
        >
          <Layers size={16} />
          Tüm Departmanlar
          <span className="dept-item-badge" style={{ marginLeft: 'auto' }}>
            {activeData?.employees.length || 0}
          </span>
        </button>

        {filteredDepartments.map((dept) => (
          <div
            key={dept.fullName}
            className={`dept-item ${sidebarSelectedDept === dept.fullName ? 'active' : ''}`}
            onClick={() => pickSidebarDept(dept.fullName)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickSidebarDept(dept.fullName); } }}
            role="button"
            tabIndex={0}
            aria-label={`${dept.name || dept.fullName} departmanını seç (${dept.employees.length} kişi)`}
          >
            <div className="dept-item-icon"><Building2 size={14} /></div>
            <div className="dept-item-info">
              <div className="dept-item-name">{dept.name || dept.fullName}</div>
              <div className="dept-item-count">{dept.code}</div>
            </div>
            <span className="dept-item-badge">{dept.employees.length}</span>
          </div>
        ))}
      </div>
    </aside>

      {/* MAIN CONTENT — Çizelge modülü */}
      <main className="main-content">
        <Schedule />
      </main>


      {/* MOBILE BOTTOM NAVIGATION */}
      <nav
        className="mobile-bottom-nav"
        style={{ '--active-index': activeNavIndex, '--nav-item-count': 5 }}
      >
        <button className={`mobile-nav-item ${mobileTab === 'panel' ? 'active' : ''}`} onClick={() => setMobileTab('panel')}>
          <Clock size={24} /><span>Panel</span>
        </button>
        <button className={`mobile-nav-item ${mobileTab === 'departments' ? 'active' : ''}`} onClick={() => setMobileTab('departments')}>
          <Building2 size={24} /><span>Birimler</span>
        </button>
        <button className={`mobile-nav-item ${mobileTab === 'table' ? 'active' : ''}`} onClick={() => setMobileTab('table')}>
          <CalendarDays size={24} /><span>Çizelge</span>
        </button>
        <button className={`mobile-nav-item ${isTrackedOpen ? 'active' : ''}`} onClick={() => { setIsProfileOpen(false); setIsTrackedOpen(true); }}>
          <Users size={24} /><span>Takip</span>
        </button>
        <button className={`mobile-nav-item ${isProfileOpen ? 'active' : ''}`} onClick={() => { setIsTrackedOpen(false); setIsProfileOpen(true); }} style={{ position: 'relative' }}>
          <UserCircle size={24} /><span>Ben</span>
          {!myName && (
            <span style={{ position: 'absolute', top: 4, right: '25%', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-danger)' }}></span>
          )}
        </button>
      </nav>

        <ToastContainer />
      </div>

      {/* Çalışan Profil Kartı — Tüm sayfa üzerinde float ediyor */}
      <EmployeeProfileCard />

      {/* Benim Profilim Sheet — Tüm sayfa üzerinde float ediyor */}
      <MyProfileSheet />
      <TrackedEmployeesSheet />
    </>
  );
}
