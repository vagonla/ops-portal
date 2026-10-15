'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { parseExcelFile } from '@/lib/parseExcel';
import { parseShiftValue, isWorkingAt, checkOvernightFromPrevDay, getCurrentMinutes, clearParseCache, getShiftSegments } from '@/lib/shiftUtils';
import { parseRouteData } from '@/lib/routeUtils';
import { getValidatedExcelBuffer } from '@/lib/fileValidation';
import { storageGet, storageSet, storageRemove, storageClear, STORAGE_ERROR_MAP } from '@/lib/storage';

// ─── Schedule view default & filter ──────────────────────────────
const DEFAULT_SCHEDULE_FILTER = {
  statuses: [],      // 'working' | 'onLeave' | 'carryover' | 'starting' | 'finished'
  shiftTypes: [],    // 'NIGHT' | 'MORNING' | 'EVENING' | 'MIXED'
  departments: [],   // fullName list
  myDeptOnly: false,
  timeRange: null,   // [startMin, endMin] | null
  search: '',
};

function normalizeTr(str) {
  if (!str) return '';
  return String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

// ─── Context ───
const ShiftContext = createContext(null);
let _toastIdCounter = 0;
const MAX_SCHEDULE_FILES = 2;

/**
 * Aktif dosyanın hemen öncesindeki haftanın dosyasını bulur.
 * 
 * Kriter: diğer dosyaların son gününün tarihi (Pazar),
 * aktif dosyanın ilk gününden (Pazartesi) tam 1 gün önce olmalı.
 * Böylece doğru hafta eşleşmesi garanti edilir.
 * 
 * @param {Array} files - Yüklü tüm dosyalar
 * @param {number} activeFileIdx - Aktif dosyanın indeksi
 * @returns {Object|null} Önceki haftanın parse edilmiş verisi veya null
 */
function findPrevWeekData(files, activeFileIdx) {
  const activeFile = files[activeFileIdx];
  if (!activeFile?.data?.rawDates?.length) return null;

  const activeFirstDate = activeFile.data.rawDates[0]?.date;
  if (!activeFirstDate) return null;

  // Aktif dosyanın Pazartesi'sinden 1 gün önceki tarihi hesapla
  const prevDay = new Date(activeFirstDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const pad = n => String(n).padStart(2, '0');
  const prevDayISO = `${prevDay.getFullYear()}-${pad(prevDay.getMonth() + 1)}-${pad(prevDay.getDate())}`;

  // Diğer dosyalarda bu tarihi son gün olarak ara
  for (let i = 0; i < files.length; i++) {
    if (i === activeFileIdx) continue;
    const fileData = files[i]?.data;
    if (!fileData?.rawDates?.length) continue;

    const lastDate = fileData.rawDates[fileData.rawDates.length - 1];
    if (lastDate?.formatted?.iso === prevDayISO) {
      return fileData; // Bu dosyanın son günü = aktif dosyanın önceki günü ✓
    }
  }
  return null;
}

/**
 * Shift Context Provider — tüm uygulama state'ini merkezi yönetir.
 * 
 * Sorun 5.2 (Prop drilling) çözümü: Her alt bileşen ihtiyacı olan state'e
 * doğrudan useShift() hook'u ile erişir. 12 prop'luk prop drilling kaldırıldı.
 * 
 * Sorun 5.3 (Kalıcılık) çözümü: Dosya verileri sessionStorage'da saklanır.
 * Sayfa yenilendiğinde veriler korunur.
 */
export function ShiftProvider({ children }) {
  // ─── Temel State ───
  const [myName, setMyName] = useState('');
  const [myStop, setMyStop] = useState(null);
  const [files, setFiles] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [selectedDept, setSelectedDept] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rightPanelTab, setRightPanelTab] = useState('now');
  const [mobileTab, setMobileTab] = useState('panel');
  const [personSearch, setPersonSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [queryDayIdx, setQueryDayIdx] = useState(null);
  const [queryTime, setQueryTime] = useState('');
  const [dragging, setDragging] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTrackedOpen, setIsTrackedOpen] = useState(false);
  const [clearConfirmPending, setClearConfirmPending] = useState(false);
  const [peekEmployee, setPeekEmployee] = useState(null); // Profil kartı için seçilen çalışan
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(null);

  // ─── Schedule (Çizelge) State ───
  const [scheduleFilter, setScheduleFilter] = useState(DEFAULT_SCHEDULE_FILTER);
  const [isScheduleFilterOpen, setIsScheduleFilterOpen] = useState(false);

  // ─── Toast State ───
  const [toasts, setToasts] = useState([]);

  // ─── Toast Fonksiyonları (5.4) ───
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notifyStorageError = useCallback((actionLabel, code) => {
    if (code === STORAGE_ERROR_MAP.QUOTA) {
      addToast(`[${code}] Depolama alani dolu. ${actionLabel} islemi tamamlanamadi.`, 'error', 7000);
      return;
    }
    if (code === STORAGE_ERROR_MAP.UNAVAILABLE) {
      addToast(`[${code}] Tarayici depolama alani kullanilamiyor. ${actionLabel} islemi yapilamadi.`, 'error', 7000);
      return;
    }
    addToast(`[${code || STORAGE_ERROR_MAP.UNKNOWN}] Depolama hatasi. ${actionLabel} islemi yapilamadi.`, 'error', 7000);
  }, [addToast]);

  const clearAllData = useCallback(() => {
    if (!clearConfirmPending) {
      setClearConfirmPending(true);
      addToast('Tüm verileri silmek için butona tekrar tıklayın', 'warning', 5000);
      setTimeout(() => setClearConfirmPending(false), 5000);
      return;
    }
    // İkinci tıklama — verileri sil
    setClearConfirmPending(false);
    const clearResult = storageClear();
    if (!clearResult.ok) {
      notifyStorageError('Tum veriyi temizleme', clearResult.code);
      return;
    }
    if (typeof window !== 'undefined') window.location.reload();
  }, [clearConfirmPending, addToast, notifyStorageError]);

  // ─── LocalStorage Kalıcılık (5.3) ───
  // Sayfa yüklendiğinde önceki oturum verilerini geri yükle
  useEffect(() => {
    let startupStorageErrorShown = false;
    const notifyStartupStorageError = (actionLabel, code) => {
      if (startupStorageErrorShown) return;
      startupStorageErrorShown = true;
      notifyStorageError(actionLabel, code);
    };

    const saved = storageGet('vardiya-app-state');
    if (saved.ok && saved.value) {
      try {
        const parsed = JSON.parse(saved.value);
        if (parsed.files?.length > 0) {
          setFiles(parsed.files);
          setActiveFileIdx(parsed.activeFileIdx || 0);
          addToast(`${parsed.files.length} vardiya dosyası geri yüklendi`, 'success');
        }
      } catch (e) {
        console.warn('[VardiyaApp] Kayitli uygulama durumu parse edilemedi:', e);
        const cleanup = storageRemove('vardiya-app-state');
        if (!cleanup.ok) {
          notifyStartupStorageError('Bozuk kayitli veriyi temizleme', cleanup.code);
        } else {
          addToast('Kayitli uygulama verisi bozuk oldugu icin sifirlandi.', 'warning', 6000);
        }
      }
    } else if (!saved.ok) {
      console.warn('[VardiyaApp] localStorage erişim hatası:', saved.error || saved.code);
      notifyStartupStorageError('Kayitli veriyi geri yukleme', saved.code);
    }

    const savedName = storageGet('vardiya-my-name');
    if (savedName.ok && savedName.value) {
      setMyName(savedName.value);
    } else if (!savedName.ok) {
      notifyStartupStorageError('Profil bilgilerini yukleme', savedName.code);
    }

    const savedRoute = storageGet('vardiya-route-data');
    if (savedRoute.ok && savedRoute.value) {
      try {
        setRouteData(JSON.parse(savedRoute.value));
      } catch (e) {
        console.warn('[VardiyaApp] Guzergah verisi parse edilemedi:', e);
      }
    }

    const savedStop = storageGet('vardiya-my-stop');
    if (savedStop.ok && savedStop.value) {
      try {
        setMyStop(JSON.parse(savedStop.value));
      } catch (e) {
        console.warn('[VardiyaApp] Durak verisi parse edilemedi:', e);
      }
    }

    const disclaimerState = storageGet('vardiya-disclaimer-accepted');
    if (disclaimerState.ok) {
      setHasAcceptedDisclaimer(disclaimerState.value === 'true');
    } else {
      setHasAcceptedDisclaimer(false);
      notifyStartupStorageError('Onay bilgisini yukleme', disclaimerState.code);
    }

    const savedScheduleFilter = storageGet('vardiya-schedule-filter');
    if (savedScheduleFilter.ok && savedScheduleFilter.value) {
      try {
        const parsed = JSON.parse(savedScheduleFilter.value);
        if (parsed && typeof parsed === 'object') {
          setScheduleFilter({ ...DEFAULT_SCHEDULE_FILTER, ...parsed });
        }
      } catch (e) {
        console.warn('[VardiyaApp] Cizelge filtresi parse edilemedi:', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptDisclaimer = useCallback(() => {
    const saveResult = storageSet('vardiya-disclaimer-accepted', 'true');
    if (!saveResult.ok) {
      notifyStorageError('Sorumluluk onayini kaydetme', saveResult.code);
      }
    setHasAcceptedDisclaimer(true);
  }, [notifyStorageError]);

  const saveMyName = useCallback((name) => {
    setMyName(name);
    // İsim değiştiğinde veya silindiğinde durağı sıfırla (önceki kişinin durağı geçersiz)
    setMyStop(null);
    const stopRemove = storageRemove('vardiya-my-stop');
    if (!stopRemove.ok) {
      notifyStorageError('Durak bilgisini sifirlama', stopRemove.code);
    }

    if (name) {
      const saveName = storageSet('vardiya-my-name', name);
      if (!saveName.ok) notifyStorageError('Isim kaydetme', saveName.code);
    } else {
      const removeName = storageRemove('vardiya-my-name');
      if (!removeName.ok) notifyStorageError('Isim temizleme', removeName.code);
    }
  }, [notifyStorageError]);

  const saveMyStop = useCallback((stopObj) => {
    setMyStop(stopObj);
    if (stopObj) {
      const saveStop = storageSet('vardiya-my-stop', JSON.stringify(stopObj));
      if (!saveStop.ok) notifyStorageError('Durak kaydetme', saveStop.code);
      return;
    }
    const removeStop = storageRemove('vardiya-my-stop');
    if (!removeStop.ok) notifyStorageError('Durak temizleme', removeStop.code);
  }, [notifyStorageError]);

  // ─── localStorage Debounce yazma (P3 performans düzeltmesi) ───
  // Büyük veri her files değişiminde anında yazılmıyordu; 1sn debounce ile
  // birden fazla hızlı değişim tek bir yazma işlemine indirgeniyor.
  const _lsTimerRef = useRef(null);
  useEffect(() => {
    if (_lsTimerRef.current) clearTimeout(_lsTimerRef.current);

    _lsTimerRef.current = setTimeout(() => {
      if (files.length === 0) {
        const removeResult = storageRemove('vardiya-app-state');
        if (!removeResult.ok) notifyStorageError('Uygulama durumunu temizleme', removeResult.code);
        return;
      }
      const stateToSave = { files, activeFileIdx };
      const saveResult = storageSet('vardiya-app-state', JSON.stringify(stateToSave));
      if (!saveResult.ok) {
        notifyStorageError('Vardiya verilerini kaydetme', saveResult.code);
      }
    }, 1000);

    return () => {
      if (_lsTimerRef.current) clearTimeout(_lsTimerRef.current);
    };
  }, [files, activeFileIdx, notifyStorageError]);

  // ─── Schedule tercihleri debounce persist ───
  const _schedLsTimerRef = useRef(null);
  useEffect(() => {
    if (_schedLsTimerRef.current) clearTimeout(_schedLsTimerRef.current);
    _schedLsTimerRef.current = setTimeout(() => {
      const save = storageSet('vardiya-schedule-filter', JSON.stringify(scheduleFilter));
      if (!save.ok) notifyStorageError('Cizelge filtresini kaydetme', save.code);
    }, 400);
    return () => {
      if (_schedLsTimerRef.current) clearTimeout(_schedLsTimerRef.current);
    };
  }, [scheduleFilter, notifyStorageError]);

  // ─── Saat Timer (15sn aralıkla — performans optimizasyonu) ───
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // ─── Aktif Dosya Verisi ───
  const activeData = files[activeFileIdx]?.data || null;

  // ─── Dosya Yükleme ───
  const handleFile = useCallback(async (fileList, keepActive = false) => {
    const incomingFiles = Array.from(fileList || []);
    if (incomingFiles.length === 0) return;

    const existingNames = new Set(files.map(f => f.name));
    const newFiles = incomingFiles.filter(file => !existingNames.has(file.name));
    const replaceFiles = incomingFiles.filter(file => existingNames.has(file.name));
    const availableSlots = Math.max(0, MAX_SCHEDULE_FILES - files.length);

    if (newFiles.length > availableSlots) {
      addToast(`En fazla ${MAX_SCHEDULE_FILES} vardiya dosyasi yukleyebilirsiniz.`, 'warning', 6000);
    }

    const acceptedNewFiles = newFiles.slice(0, availableSlots);
    const filesToProcess = [...replaceFiles, ...acceptedNewFiles];
    if (filesToProcess.length === 0) return;

    for (const file of filesToProcess) {
      try {
        const validated = await getValidatedExcelBuffer(file);
        if (!validated.ok) {
          addToast(`[${validated.code}] ${validated.message} (${file.name})`, 'error', 7000);
          continue;
        }

        const buffer = validated.buffer;
        const data = parseExcelFile(buffer);
        
        // Yeni veri yüklendiğinde eski parse cache'ini temizle (memory leak önleme)
        clearParseCache();

        // Not: React 19'da async bağlamda setState updater'ı senkron çalışır,
        // dolayısıyla wasUpdate değişkeni aşağıda güvenle okunabilir.
        let wasUpdate = false;
        setFiles(prev => {
          const exists = prev.findIndex(f => f.name === file.name);
          if (exists >= 0) {
            wasUpdate = true;
            const updated = [...prev];
            updated[exists] = { name: file.name, data };
            if (!keepActive) setActiveFileIdx(exists);
            return updated;
          }
          if (!keepActive) setActiveFileIdx(prev.length);
          return [...prev, { name: file.name, data }];
        });

        addToast(
          wasUpdate
            ? `"${file.name}" güncellendi`
            : `"${file.name}" yüklendi — ${data.employees.length} personel`,
          'success'
        );
      } catch (err) {
        console.error('Excel parse hatası:', err);
        addToast(`"${file.name}" okunamadi: ${err.message}`, 'error', 6000);
      }
    }
  }, [addToast, files]);

  const handleRouteFile = useCallback(async (file) => {
    try {
      const validated = await getValidatedExcelBuffer(file);
      if (!validated.ok) {
        addToast(`[${validated.code}] ${validated.message} (${file?.name || 'Dosya'})`, 'error', 7000);
        return;
      }
      const buffer = validated.buffer;
      const data = parseRouteData(buffer);
      setRouteData(data);
      const saveResult = storageSet('vardiya-route-data', JSON.stringify(data));
      if (!saveResult.ok) notifyStorageError('Servis guzergahini kaydetme', saveResult.code);
      addToast('Servis güzergahı yüklendi', 'success');
    } catch (err) {
      console.error(err);
      addToast('Servis dosyası okunamadı veya hatalı', 'error');
    }
  }, [addToast, notifyStorageError]);

  const removeRouteFile = useCallback(() => {
    setRouteData(null);
    setMyStop(null);
    const routeRemove = storageRemove('vardiya-route-data');
    if (!routeRemove.ok) notifyStorageError('Servis guzergahini silme', routeRemove.code);
    const stopRemove = storageRemove('vardiya-my-stop');
    if (!stopRemove.ok) notifyStorageError('Durak bilgisini silme', stopRemove.code);
    addToast('Servis güzergahı kaldırıldı', 'info');
  }, [addToast, notifyStorageError]);

  // ─── Dosya Silme ─── 
  const removeFile = useCallback((idx) => {
    const fileName = files[idx]?.name;
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length === 0) {
        const removeResult = storageRemove('vardiya-app-state');
        if (!removeResult.ok) notifyStorageError('Uygulama durumunu silme', removeResult.code);
      }
      return updated;
    });
    setActiveFileIdx(prev => {
      if (prev === idx) return Math.max(0, idx - 1);
      if (prev > idx) return prev - 1;
      return prev;
    });
    if (fileName) addToast(`"${fileName}" kaldırıldı`, 'info');
  }, [files, addToast, notifyStorageError]);

  // ─── Drag & Drop ───
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files);
  }, [handleFile]);

  // ─── Filtrelenmiş Departmanlar ───
  const filteredDepartments = useMemo(() => {
    if (!activeData) return [];
    if (!searchQuery) return activeData.departments;
    const q = searchQuery.toLowerCase();
    return activeData.departments.filter(d =>
      d.fullName.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  }, [activeData, searchQuery]);

  // ─── Görüntülenecek Çalışanlar ───
  const displayedEmployees = useMemo(() => {
    if (!activeData) return [];
    if (selectedDept === null) return activeData.departments;
    const dept = activeData.departments.find(d => d.fullName === selectedDept);
    return dept ? [dept] : [];
  }, [activeData, selectedDept]);

  // ─── Kişi Arama ───
  const personResults = useMemo(() => {
    if (!activeData || !personSearch || personSearch.length < 2) return [];
    
    // Türkçe karakter normalizasyonu: İ→i, I→ı gibi tüm Türkçe büyük/küçük harf
    // dönüşümlerini doğru yapmak için toLocaleLowerCase('tr-TR') kullanılıyor
    const normalize = (str) => {
      if (!str) return '';
      return str
        .replace(/İ/g, 'i')  // JS toLowerCase() bu dönüşümü yapmaz
        .replace(/I/g, 'ı')  // JS toLowerCase() büyük I'yi 'i' yapar (yanlış)
        .toLocaleLowerCase('tr-TR');
    };
    const q = normalize(personSearch);
    
    return activeData.employees.filter(e =>
      normalize(e.name).includes(q)
    ).slice(0, 15);
  }, [activeData, personSearch]);

  // ─── Profil (Ben) Datası ───
  const myEmployeeData = useMemo(() => {
    if (!activeData || !myName) return null;
    const target = normalizeTr(myName.trim());
    return activeData.employees.find(e => normalizeTr(e.name.trim()) === target) || null;
  }, [activeData, myName]);

  // ─── Bugün Tespiti ───
  const todayDateKey = currentTime.toLocaleDateString('tr-TR');
  const todayIdx = useMemo(() => {
    if (!activeData) return -1;
    // Yerel tarih bileşenlerinden ISO string üret (UTC kaymasını önler)
    const pad = n => String(n).padStart(2, '0');
    const localISO = `${currentTime.getFullYear()}-${pad(currentTime.getMonth() + 1)}-${pad(currentTime.getDate())}`;
    return activeData.rawDates.findIndex(d => d.formatted.iso === localISO);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeData, todayDateKey]);

  // ─── Efektif Gün/Dakika ───
  const effectiveDayIdx = queryDayIdx !== null ? queryDayIdx : todayIdx;
  const currentMinuteKey = Math.floor(currentTime.getTime() / 60000);
  const effectiveMinutes = useMemo(() => {
    if (queryTime) {
      const [h, m] = queryTime.split(':').map(Number);
      return h * 60 + m;
    }
    return getCurrentMinutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTime, currentMinuteKey]);

  // ─── Şu An Çalışanlar ───
  // ─── Önceki Hafta Verisi (hafta sınırı geçişi için) ───
  const prevWeekData = useMemo(() => {
    if (effectiveDayIdx !== 0) return null; // Sadece Pazartesi'de lazım
    return findPrevWeekData(files, activeFileIdx);
  }, [files, activeFileIdx, effectiveDayIdx]);

  /**
   * Çalışan isminden önceki haftanın Pazar vardiyasını bulur.
   * Sadece effectiveDayIdx === 0 (Pazartesi) için kullanılır.
   * @returns {string|null} Vardiya string'i veya null (önceki hafta/çalışan bulunamadı)
   */
  const getPrevWeekSundayShift = useCallback((empName) => {
    if (!prevWeekData) return null;
    const prevEmp = prevWeekData.employees.find(e => e.name === empName);
    if (!prevEmp) return null;
    return prevEmp.shifts[6]; // Pazar (hafta sonu, dayIdx=6)
  }, [prevWeekData]);

  // Pazartesi 09:00'a kadar önceki hafta yoksa uyarı göster
  // (sarkan vardiyalar genelde max 01:00'e kadar, ama güvenlik marjı olarak 09:00)
  const prevWeekMissing = useMemo(() => {
    return effectiveDayIdx === 0 && effectiveMinutes < 540 && !prevWeekData;
  }, [effectiveDayIdx, effectiveMinutes, prevWeekData]);

  const nowWorkingData = useMemo(() => {
    if (!activeData || effectiveDayIdx < 0 || effectiveDayIdx > 6) {
      return { working: [], onLeave: [], off: [], upcoming: [], total: 0 };
    }

    const working = [];
    const onLeave = [];
    const off = [];
    const upcoming = [];
    const alreadyWorking = new Set();

    const depts = activeData.departments;

    for (const dept of depts) {
      for (const emp of dept.employees) {
        const shiftStr = emp.shifts[effectiveDayIdx];
        const shift = parseShiftValue(shiftStr);

        if (shift && !shift.isStatusCode && isWorkingAt(shift, effectiveMinutes)) {
          working.push({ ...emp, shiftInfo: shift });
          alreadyWorking.add(emp.name);
          continue;
        }

        if (!alreadyWorking.has(emp.name)) {
          // Hafta sınırı (dayIdx=0): önceki haftanın Pazar verisini geçir
          const prevWeekShift = effectiveDayIdx === 0 ? getPrevWeekSundayShift(emp.name) : undefined;
          const { isCarryover, prevShift } = checkOvernightFromPrevDay(emp.shifts, effectiveDayIdx, effectiveMinutes, prevWeekShift);
          if (isCarryover) {
            working.push({ ...emp, shiftInfo: { ...prevShift, isCarryover: true, label: prevShift.label + ' (dünden)' } });
            alreadyWorking.add(emp.name);
            continue;
          }
        }

        if (shift) {
          if (shift.isStatusCode) {
            if (shift.code === 'DO') {
              off.push({ ...emp, shiftInfo: shift });
            } else {
              onLeave.push({ ...emp, shiftInfo: shift });
            }
          } else {
            upcoming.push({ ...emp, shiftInfo: shift });
          }
        }
      }
    }

    return {
      working,
      onLeave,
      off,
      upcoming,
      total: depts.reduce((sum, d) => sum + d.employees.length, 0),
    };
  }, [activeData, effectiveDayIdx, effectiveMinutes, getPrevWeekSundayShift]);

  // ─── Çizelge (Schedule) Selectors & Actions ───
  // Kendi departmanim (myDeptOnly filtresi icin)
  const myDeptFullName = useMemo(() => {
    if (!activeData || !myName) return null;
    for (const dept of activeData.departments) {
      if (dept.employees.some(e => e.name === myName)) return dept.fullName;
    }
    return null;
  }, [activeData, myName]);

  const scheduleEmployees = useMemo(() => {
    if (!activeData) return [];

    const filter = scheduleFilter;
    const hasStatusFilter = filter.statuses.length > 0;
    const hasTypeFilter = filter.shiftTypes.length > 0;
    const hasDeptFilter = filter.departments.length > 0 || filter.myDeptOnly;
    const hasTimeRange = Array.isArray(filter.timeRange) && filter.timeRange.length === 2;
    const hasSearch = filter.search && filter.search.trim().length > 0;
    const searchNorm = hasSearch ? normalizeTr(filter.search.trim()) : '';

    const dayIdx = effectiveDayIdx;
    const prevDayIdx = dayIdx === 0 ? -1 : dayIdx - 1;

    const result = [];

    for (const dept of activeData.departments) {
      // Departman filtresi
      if (filter.myDeptOnly) {
        if (!myDeptFullName || dept.fullName !== myDeptFullName) continue;
      } else if (hasDeptFilter && !filter.departments.includes(dept.fullName)) {
        continue;
      }

      const filteredEmps = [];
      for (const emp of dept.employees) {
        if (hasSearch && !normalizeTr(emp.name).includes(searchNorm)) continue;

        const shiftStr = dayIdx >= 0 && dayIdx <= 6 ? emp.shifts[dayIdx] : null;
        const shift = shiftStr ? parseShiftValue(shiftStr) : null;

        // Durum tespiti
        let status = null; // 'working' | 'carryover' | 'starting' | 'finished' | 'onLeave' | 'none'
        let carryoverActive = false;

        if (shift && shift.isStatusCode) {
          status = 'onLeave';
        } else if (shift) {
          if (isWorkingAt(shift, effectiveMinutes)) {
            status = 'working';
          } else if (getShiftSegments(shift).some(segment => effectiveMinutes < segment.startMinutes)) {
            status = 'starting';
          } else {
            status = 'finished';
          }
        } else {
          status = 'none';
        }

        // Onceki gunden sarkma (dayIdx icin — bu gunun baglaminda)
        if (dayIdx >= 0) {
          const prevWeekShift = dayIdx === 0 ? (prevWeekData ? (prevWeekData.employees.find(e => e.name === emp.name)?.shifts[6] ?? null) : null) : undefined;
          const { isCarryover } = checkOvernightFromPrevDay(emp.shifts, dayIdx, effectiveMinutes, prevWeekShift);
          if (isCarryover) carryoverActive = true;
        }

        // Durum filtresi
        if (hasStatusFilter) {
          const match = filter.statuses.some(s => {
            if (s === 'working') return status === 'working';
            if (s === 'onLeave') return status === 'onLeave';
            if (s === 'starting') return status === 'starting';
            if (s === 'finished') return status === 'finished';
            if (s === 'carryover') return carryoverActive;
            return false;
          });
          if (!match) continue;
        }

        // Vardiya tipi filtresi
        if (hasTypeFilter) {
          if (!shift || shift.isStatusCode || !filter.shiftTypes.includes(shift.type)) continue;
        }

        // Saat araligi filtresi (seciligun icin)
        if (hasTimeRange) {
          if (!shift || shift.isStatusCode) continue;
          const [fStart, fEnd] = filter.timeRange;
          const overlaps = getShiftSegments(shift).some(segment => (
            segment.endMinutes > segment.startMinutes
              ? (segment.startMinutes < fEnd && segment.endMinutes > fStart)
              : (segment.startMinutes < fEnd || segment.endMinutes > fStart)
          ));
          if (!overlaps) continue;
        }

        filteredEmps.push(emp);
      }

      if (filteredEmps.length > 0) {
        result.push({ ...dept, employees: filteredEmps });
      }
    }
    return result;
  }, [activeData, scheduleFilter, effectiveDayIdx, effectiveMinutes, myDeptFullName, prevWeekData]);

  // Efektif filtre aktiflik sayisi (toolbar trigger icin)
  const scheduleActiveFilterCount = useMemo(() => {
    const f = scheduleFilter;
    let n = 0;
    if (f.statuses.length) n += f.statuses.length;
    if (f.shiftTypes.length) n += f.shiftTypes.length;
    if (f.departments.length) n += f.departments.length;
    if (f.myDeptOnly) n += 1;
    if (f.timeRange) n += 1;
    if (f.search?.trim()) n += 1;
    return n;
  }, [scheduleFilter]);

  const resetScheduleFilter = useCallback(() => {
    setScheduleFilter(DEFAULT_SCHEDULE_FILTER);
  }, []);

  const updateScheduleFilter = useCallback((patch) => {
    setScheduleFilter(prev => ({ ...prev, ...patch }));
  }, []);

  // Zaman override sifirlama — Header tarafindan kullanilir
  const resetTimeOverride = useCallback(() => {
    setQueryTime('');
    setQueryDayIdx(null);
  }, []);

  // ─── Zaman Stringleri (P1 performans düzeltmesi) ───
  // useMemo ile stabilize: timeStr yalnızca dakika değişince, dateStr yalnızca gün
  // değişince yeniden hesaplanır. 15sn timer'da aynı dakika/gündeyse string değişmez
  // → tüm consumer bileşenler gereksiz re-render ALMAZ.
  const timeStr = useMemo(
    () => currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMinuteKey]  // Dakika değişince yeniden hesapla (currentTime'a değil dakikaya bağlı)
  );
  const dateStr = useMemo(
    () => currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayDateKey]  // Gün değişince yeniden hesapla
  );

  // ─── Context Değeri ───
  const value = useMemo(() => ({
    // Dosya yönetimi
    files, activeFileIdx, setActiveFileIdx, activeData,
    routeData,
    handleFile, removeFile, handleRouteFile, removeRouteFile,
    // Drag & Drop
    dragging, onDragOver, onDragLeave, onDrop,
    // Departman & navigasyon
    selectedDept, setSelectedDept,
    searchQuery, setSearchQuery,
    filteredDepartments, displayedEmployees,
    // Paneller
    rightPanelTab, setRightPanelTab,
    mobileTab, setMobileTab,
    // Kişi arama ve Profil
    personSearch, setPersonSearch, personResults,
    myName, saveMyName, myEmployeeData,
    myStop, saveMyStop,
    // Zaman
    currentTime, timeStr, dateStr,
    todayIdx, effectiveDayIdx, effectiveMinutes,
    queryDayIdx, setQueryDayIdx,
    queryTime, setQueryTime,
    // Çalışan verileri
    nowWorkingData, prevWeekMissing, prevWeekData, getPrevWeekSundayShift,
    // Çizelge
    scheduleFilter, setScheduleFilter, updateScheduleFilter, resetScheduleFilter,
    scheduleActiveFilterCount,
    scheduleEmployees,
    isScheduleFilterOpen, setIsScheduleFilterOpen,
    myDeptFullName,
    resetTimeOverride,
    // Profil Kartı (EmployeeProfileCard)
    peekEmployee, setPeekEmployee,
    // Profil Çekmecesi
    isProfileOpen, setIsProfileOpen,
    isTrackedOpen, setIsTrackedOpen,
    // Veri Yönetimi
    clearAllData, clearConfirmPending,
    // Toast
    toasts, addToast, removeToast,
    // Disclaimer
    hasAcceptedDisclaimer, acceptDisclaimer,
  }), [
    files, activeFileIdx, activeData, routeData,
    handleFile, removeFile, handleRouteFile, removeRouteFile,
    dragging, onDragOver, onDragLeave, onDrop,
    selectedDept, searchQuery, filteredDepartments, displayedEmployees,
    rightPanelTab, mobileTab,
    personSearch, personResults,
    myName, saveMyName, myEmployeeData, myStop, saveMyStop,
    currentTime, timeStr, dateStr,
    todayIdx, effectiveDayIdx, effectiveMinutes,
    queryDayIdx, queryTime,
    nowWorkingData, prevWeekMissing, prevWeekData, getPrevWeekSundayShift,
    scheduleFilter, updateScheduleFilter, resetScheduleFilter,
    scheduleActiveFilterCount, scheduleEmployees,
    isScheduleFilterOpen, myDeptFullName, resetTimeOverride,
    isProfileOpen, isTrackedOpen,
    peekEmployee,
    clearAllData, clearConfirmPending,
    toasts, addToast, removeToast,
    hasAcceptedDisclaimer, acceptDisclaimer,
  ]);

  return (
    <ShiftContext.Provider value={value}>
      {children}
    </ShiftContext.Provider>
  );
}

/**
 * Custom hook — tüm bileşenlerde kullanılır.
 * Prop drilling yerine doğrudan context'e erişim sağlar.
 */
export function useShift() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
}
