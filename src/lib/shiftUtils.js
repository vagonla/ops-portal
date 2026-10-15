import { SHIFT_TYPES, STATUS_CODES, DAY_NAMES_JS, DAY_NAMES_JS_SHORT, MONTH_NAMES } from './constants';

/**
 * Saat string'ini (HHMM) dakika cinsine dönüştürür
 */
export function timeToMinutes(timeStr) {
  const h = parseInt(timeStr.substring(0, 2), 10);
  const m = parseInt(timeStr.substring(2, 4), 10);
  return h * 60 + m;
}

/**
 * Dakikayı HH:MM formatına dönüştürür
 */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Vardiya string'ini parse eder (ör: "0830-1700")
 * Returns: { start, end, startMinutes, endMinutes, duration, type } veya null (izin kodu ise)
 * 
 * Performans: Aynı string tekrar geldiğinde cache'ten döndürülür.
 * Bir render döngüsünde 200+ kişi × 7 gün = 1400+ çağrı cache sayesinde O(1) olur.
 */
const _parseCache = new Map();

/**
 * Parse cache'ini temizler — yeni dosya yüklendiğinde çağrılır.
 * Eski verilerin bellekte birikmesini (memory leak) önler.
 */
export function clearParseCache() {
  _parseCache.clear();
}

export function parseShiftValue(value) {
  if (!value || typeof value !== 'string') return null;

  const originalTrimmed = value.trim();
  if (!originalTrimmed) return null;

  // Cache kontrol
  if (_parseCache.has(originalTrimmed)) return _parseCache.get(originalTrimmed);

  let trimmed = originalTrimmed;

  // Eğitim vardiyalarını standart mesai olarak kabul et (İzin olarak sayılmaması için)
  const uppercase = trimmed.toUpperCase();
  const isTraining = uppercase === 'TRN' || uppercase === 'TRN_F';
  if (isTraining) {
    trimmed = '0830-1700';
  }

  // Tek veya parçalı HHMM-HHMM formatı kontrolü
  // Örnek parçalı vardiya: 1300-1430/1800-0000
  const segmentMatches = trimmed.split('/').map(part => part.trim().match(/^(\d{4})-(\d{4})$/));
  const hasValidSegments = segmentMatches.length > 0 && segmentMatches.every(Boolean);
  if (!hasValidSegments) {
    // Durum kodu olabilir
    const code = trimmed.toUpperCase();
    if (STATUS_CODES[code] || STATUS_CODES[trimmed]) {
      const result = { isStatusCode: true, code: trimmed, ...(STATUS_CODES[code] || STATUS_CODES[trimmed]) };
      _parseCache.set(originalTrimmed, result);
      return result;
    }
    const result = { isStatusCode: true, code: trimmed, label: trimmed, color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: '📋' };
    _parseCache.set(originalTrimmed, result);
    return result;
  }

  const segments = segmentMatches.map(match => {
    const startStr = match[1];
    const endStr = match[2];
    const startMinutes = timeToMinutes(startStr);
    const endMinutes = timeToMinutes(endStr);
    const duration = endMinutes <= startMinutes
      ? (1440 - startMinutes) + endMinutes
      : endMinutes - startMinutes;
    return {
      start: `${startStr.substring(0, 2)}:${startStr.substring(2, 4)}`,
      end: `${endStr.substring(0, 2)}:${endStr.substring(2, 4)}`,
      startMinutes,
      endMinutes,
      duration,
    };
  });
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const duration = segments.reduce((total, segment) => total + segment.duration, 0);
  const type = segments.length > 1 ? 'MIXED' : getShiftType(firstSegment.startMinutes, firstSegment.endMinutes);

  const result = {
    isStatusCode: false,
    start: firstSegment.start,
    end: lastSegment.end,
    startMinutes: firstSegment.startMinutes,
    endMinutes: lastSegment.endMinutes,
    duration,
    type,
    segments,
    isSplit: segments.length > 1,
    ...SHIFT_TYPES[type],
    isTraining,
    trainingCode: isTraining ? uppercase : undefined,
  };
  _parseCache.set(originalTrimmed, result);
  return result;
}

/**
 * Vardiya tipini belirler
 * 
 * Sınıflandırma mantığı:
 *   NIGHT   → 20:00+ başlangıç, ertesi güne sarkan (ör: 2200-0600)
 *   MORNING → 12:00 öncesi başlangıç, 16:00 öncesi bitiş, aynı gün (ör: 0600-1400)
 *   EVENING → 14:00+ başlangıç, aynı gün bitiş (ör: 1400-2200)
 *   MIXED   → 10+ saat süren veya gece geçişli ama gece olmayan (ör: 0800-2000, 1400-0100)
 */
function getShiftType(startMinutes, endMinutes) {
  const isOvernight = endMinutes <= startMinutes; // Gece geçişli (bitiş ≤ başlangıç)

  // ─── Gece geçişli vardiyalar ───
  if (isOvernight) {
    // 20:00 (1200dk) ve sonrası → klasik gece vardiyası
    if (startMinutes >= 1200) return 'NIGHT';
    // 14:00-20:00 arası başlayıp ertesi güne sarkan → uzun/karma vardiya
    if (startMinutes >= 840) return 'MIXED';
    // Gece yarısı öncesi (00:00-06:00) başlayıp ertesi güne sarkan → nadir ama gece
    return 'NIGHT';
  }

  // ─── Aynı gün içinde biten vardiyalar ───
  const duration = endMinutes - startMinutes;

  // 10+ saat süren vardiyalar → ne olursa olsun uzun/karma
  if (duration >= 600) return 'MIXED';

  // Sabah vardiyaları: 12:00 (720dk) öncesi başlayan ve 17:00 (1020dk) öncesi biten
  if (startMinutes < 720 && endMinutes <= 1020) return 'MORNING';

  // Akşam vardiyaları: 14:00 (840dk) ve sonrası başlayan
  if (startMinutes >= 840) return 'EVENING';

  // Arada kalanlar: sabah başlayıp akşama uzanan
  if (startMinutes < 720 && endMinutes > 1020) return 'MIXED';

  // Öğlen civarı başlayan kısa vardiyalar
  if (startMinutes >= 720) return 'EVENING';

  return 'MORNING';
}

/**
 * Verilen anda çalışan mı kontrol eder (aynı gün)
 * Gece geçişli vardiyalarda SADECE başlangıçtan gece yarısına kadar kontrol eder.
 * Ertesi güne sarkan kısım isOvernightCarryover ile kontrol edilir.
 * 
 * Örnek: Per 14:00-01:00 → Per 00:15'te FALSE (henüz başlamadı), Per 15:00'da TRUE
 * @param {Object} shift - parseShiftValue sonucu
 * @param {number} currentMinutes - şu anki dakika (0-1440)
 * @returns {boolean}
 */
export function isWorkingAt(shift, currentMinutes) {
  if (!shift || shift.isStatusCode) return false;
  return getShiftSegments(shift).some(segment => (
    segment.endMinutes > segment.startMinutes
      ? currentMinutes >= segment.startMinutes && currentMinutes < segment.endMinutes
      : currentMinutes >= segment.startMinutes
  ));
}

/**
 * Önceki günün gece vardiyasının bugüne sarkıp sarkmadığını kontrol eder
 * Örn: Çarşamba 14:00-01:00 → Perşembe 00:00-01:00 arası hâlâ çalışıyor
 * @param {Object} shift - önceki günün parseShiftValue sonucu
 * @param {number} currentMinutes - şu anki dakika (0-1440)
 * @returns {boolean}
 */
export function isOvernightCarryover(shift, currentMinutes) {
  if (!shift || shift.isStatusCode) return false;
  return getShiftSegments(shift).some(segment => (
    segment.endMinutes <= segment.startMinutes && currentMinutes < segment.endMinutes
  ));
}

export function getShiftSegments(shift) {
  if (!shift || shift.isStatusCode) return [];
  return Array.isArray(shift.segments) && shift.segments.length
    ? shift.segments
    : [{
        start: shift.start,
        end: shift.end,
        startMinutes: shift.startMinutes,
        endMinutes: shift.endMinutes,
        duration: shift.duration,
      }];
}

/**
 * Excel serial date'i JS Date'e dönüştürür.
 * 
 * Not: Excel'in meşhur 1900 leap year bug'ı — Excel 29 Şubat 1900'ü var sayar
 * ama bu tarih gerçekte yoktur. Serial ≤ 60 için 1 gün düzeltmesi uygulanır.
 * Modern vardiya tarihleri (serial ~46000+) bu durumdan etkilenmez.
 */
export function serialToDate(serial) {
  // Excel'in 1900 hata düzeltmesi: serial 60 (29 Şubat 1900 — var olmayan gün) ve
  // öncesinde 1 fazla sayıyor, bu nedenle o aralık için 1 gün çıkar
  const corrected = serial > 60 ? serial : serial - 1;
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + corrected * 86400000);
}

/**
 * Date'i güzel formata dönüştürür
 * Gün/ay isimleri constants.js'ten alınır (merkezi yönetim)
 * 
 * NOT: ISO tarih string'i yerel zaman bileşenlerinden üretilir.
 * toISOString() UTC döndürdüğü için UTC+ zaman dilimlerinde gün kaymasına yol açar.
 */
export function formatDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return {
    dayName: DAY_NAMES_JS[date.getDay()],
    dayNameShort: DAY_NAMES_JS_SHORT[date.getDay()],
    dayNum: date.getDate(),
    month: MONTH_NAMES[date.getMonth()],
    year: date.getFullYear(),
    full: `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()} ${DAY_NAMES_JS[date.getDay()]}`,
    short: `${date.getDate()} ${MONTH_NAMES[date.getMonth()].substring(0, 3)}`,
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  };
}

/**
 * Vardiya süresini saat:dakika formatına çevirir
 */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}dk`;
  if (m <= 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

/**
 * Aktif vardiya icin canli ilerleme metriklerini hesaplar.
 *
 * @param {Object} shift - parseShiftValue sonucu (isStatusCode olmamali)
 * @param {number} currentMinutes - su anki dakika (0-1439)
 * @param {Object} options
 * @param {boolean} options.isCarryover - Vardiya onceki gunden bugune sarkiyorsa true
 * @returns {{ remainingMinutes: number, elapsedMinutes: number, totalMinutes: number, progress: number } | null}
 */
export function getLiveShiftProgress(shift, currentMinutes, options = {}) {
  if (!shift || shift.isStatusCode) return null;

  const isCarryover = options.isCarryover === true;
  const segments = getShiftSegments(shift);

  // Onceki gunden sarkan parcada sadece 00:00-end araliginda aktif olabilir.
  if (isCarryover) {
    const segment = segments.find(candidate => candidate.endMinutes <= candidate.startMinutes && currentMinutes < candidate.endMinutes);
    if (!segment) return null;
    const { startMinutes, endMinutes } = segment;

    const totalMinutes = (1440 - startMinutes) + endMinutes;
    const elapsedMinutes = (1440 - startMinutes) + currentMinutes;
    const remainingMinutes = endMinutes - currentMinutes;
    const progress = totalMinutes > 0 ? Math.max(0, Math.min(1, elapsedMinutes / totalMinutes)) : 0;

    return { remainingMinutes, elapsedMinutes, totalMinutes, progress };
  }

  const activeSegment = segments.find(segment => (
    segment.endMinutes > segment.startMinutes
      ? currentMinutes >= segment.startMinutes && currentMinutes < segment.endMinutes
      : currentMinutes >= segment.startMinutes
  ));
  if (!activeSegment) return null;
  const { startMinutes, endMinutes } = activeSegment;

  // Ayni gun vardiya parçası
  if (endMinutes > startMinutes) {

    const totalMinutes = endMinutes - startMinutes;
    const elapsedMinutes = currentMinutes - startMinutes;
    const remainingMinutes = endMinutes - currentMinutes;
    const progress = totalMinutes > 0 ? Math.max(0, Math.min(1, elapsedMinutes / totalMinutes)) : 0;

    return { remainingMinutes, elapsedMinutes, totalMinutes, progress };
  }

  // Geceye sarkan vardiyanin bugun baslayan parcasi: start-24:00
  if (currentMinutes < startMinutes) return null;

  const totalMinutes = (1440 - startMinutes) + endMinutes;
  const elapsedMinutes = currentMinutes - startMinutes;
  const remainingMinutes = (1440 - currentMinutes) + endMinutes;
  const progress = totalMinutes > 0 ? Math.max(0, Math.min(1, elapsedMinutes / totalMinutes)) : 0;

  return { remainingMinutes, elapsedMinutes, totalMinutes, progress };
}

/**
 * Bugün haftanın kaçıncı günü (0=Pazartesi, 6=Pazar)
 */
export function getTodayWeekdayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1; // JS: 0=Pazar, bizde: 0=Pazartesi
}

/**
 * Şu anki saati dakika cinsinde döndürür
 */
export function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Önceki günün gece vardiyasının bugüne sarkıp sarkmadığını merkezi olarak kontrol eder.
 * 
 * ⚠️ Hafta sınırı (dayIdx=0, Pazartesi): shifts[6] wrap-around YAPILMAZ!
 * shifts[6] aynı haftanın Pazar'ıdır (gelecek), dünkü Pazar DEĞİL.
 * Doğru kontrol için önceki haftanın Pazar vardiyası prevWeekLastDayShiftStr ile geçirilmelidir.
 * 
 * @param {Array} shifts - 7 günlük vardiya dizisi (aktif hafta)
 * @param {number} dayIdx - kontrol edilecek gün indeksi (0-6)
 * @param {number} currentMinutes - şu anki dakika (0-1440)
 * @param {string|null|undefined} prevWeekLastDayShiftStr - Sadece dayIdx=0 için: önceki haftanın
 *   Pazar (dayIdx=6) vardiya string'i. null = önceki hafta yok/çalışan bulunamadı, undefined = eski davranış.
 * @returns {{ isCarryover: boolean, prevShift: Object|null }}
 */
export function checkOvernightFromPrevDay(shifts, dayIdx, currentMinutes, prevWeekLastDayShiftStr) {
  // ─── Hafta sınırı: dayIdx === 0 (Pazartesi) ───
  if (dayIdx === 0) {
    // Önceki haftanın Pazar vardiyası geçilmiş mi?
    if (prevWeekLastDayShiftStr !== undefined && prevWeekLastDayShiftStr !== null) {
      // Önceki haftanın Pazar verisini kullan
      const prevShift = parseShiftValue(prevWeekLastDayShiftStr);
      if (prevShift && !prevShift.isStatusCode && isOvernightCarryover(prevShift, currentMinutes)) {
        return { isCarryover: true, prevShift };
      }
    }
    // null veya undefined → önceki hafta verisi yok, wrap-around YAPMA
    return { isCarryover: false, prevShift: null };
  }

  // ─── Hafta içi: dayIdx 1-6 → önceki gün aynı hafta içinde ───
  const prevDayIdx = dayIdx - 1;
  const prevShiftStr = shifts[prevDayIdx];
  const prevShift = parseShiftValue(prevShiftStr);

  if (prevShift && !prevShift.isStatusCode && isOvernightCarryover(prevShift, currentMinutes)) {
    return { isCarryover: true, prevShift };
  }

  return { isCarryover: false, prevShift: null };
}

// ─── UI Helper Fonksiyonları ───

/**
 * Vardiyanın arayüzde gösterileceği saat formatını (veya kodunu) döndürür.
 * @param {Object} shift - parseShiftValue'dan dönen vardiya objesi
 * @param {string} separator - Saatler arasındaki ayraç (varsayılan: '–')
 * @returns {string} Ekrana basılacak metin
 */
export function getShiftTimeDisplay(shift, separator = '–') {
  if (!shift) return '—';
  
  if (shift.isStatusCode) {
    return `${shift.icon ? shift.icon + ' ' : ''}${shift.code}`;
  }
  
  if (shift.isTraining) {
    const icon = STATUS_CODES && STATUS_CODES[shift.trainingCode] ? STATUS_CODES[shift.trainingCode].icon : '📚';
    return `${icon} ${shift.trainingCode}`;
  }
  
  return getShiftSegments(shift)
    .map(segment => `${segment.start}${separator}${segment.end}`)
    .join(' / ');
}

/**
 * Vardiya hücrelerinin tooltip'inde (üzerine gelince) çıkacak açıklamayı formatlar.
 * @param {Object} shift - parseShiftValue'dan dönen vardiya objesi
 * @returns {string} Açıklama metni
 */
export function getShiftTooltipLabel(shift) {
  if (!shift) return '';
  
  if (shift.isStatusCode) return shift.label;
  
  if (shift.isTraining) {
    const icon = STATUS_CODES && STATUS_CODES[shift.trainingCode] ? STATUS_CODES[shift.trainingCode].icon : '📚';
    return `${icon} ${shift.trainingCode} Eğitimi`;
  }
  
  return shift.isSplit ? 'Parçalı vardiya' : `${shift.label} vardiyası`;
}
