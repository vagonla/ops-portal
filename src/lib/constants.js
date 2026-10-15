// Vardiya tipi renk tanımları
export const SHIFT_TYPES = {
  NIGHT: {
    label: 'Gece',
    color: '#005CB9',
    bg: 'rgba(0, 92, 185, 0.15)',
    border: 'rgba(0, 92, 185, 0.3)',
  },
  MORNING: {
    label: 'Sabah',
    color: '#22d3ee',
    bg: 'rgba(34, 211, 238, 0.15)',
    border: 'rgba(34, 211, 238, 0.3)',
  },
  EVENING: {
    label: 'Akşam',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  MIXED: {
    label: 'Uzun',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.15)',
    border: 'rgba(167, 139, 250, 0.3)',
  },
};

// İzin / durum kodları
export const STATUS_CODES = {
  DO: { label: 'Dinlenme', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: '😴' },
  VA: { label: 'Yıllık İzin', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '🏖️' },
  SI: { label: 'Hastalık İzni', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '🏥' },
  TRN: { label: 'Eğitim', color: '#00A3C5', bg: 'rgba(0, 163, 197, 0.15)', icon: '📚' },
  TRN_F: { label: 'Eğitim', color: '#00A3C5', bg: 'rgba(0, 163, 197, 0.15)', icon: '📚' },
  DTO: { label: 'DTO', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: '📋' },
  DTY: { label: 'DTY', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: '📋' },
  MLK: { label: 'MLK', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', icon: '📝' },
  ABS: { label: 'Devamsızlık', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.18)', icon: '⚠️' },
  BIRTHDAY: { label: 'Doğum Günü', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)', icon: '🎂' },
  HOL: { label: 'Tatil', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', icon: '🎉' },
  PAID_LEAVE: { label: 'Ücretli İzin', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '🌿' },
  MEDICAL_REPORT: { label: 'Rapor', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '🏥' },
  UNPAID_LEAVE: { label: 'Ücretsiz İzin', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', icon: '📋' },
  MATERNITY_LEAVE: { label: 'Doğum İzni', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', icon: '🍼' },
  MARRIAGE_LEAVE: { label: 'Evlenme İzni', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)', icon: '💍' },
  BEREAVEMENT_LEAVE: { label: 'Ölüm İzni', color: '#78716c', bg: 'rgba(120, 113, 108, 0.15)', icon: '🕊️' },
  DUTY_TRAINING: { label: 'Görev / Eğitim', color: '#00A3C5', bg: 'rgba(0, 163, 197, 0.15)', icon: '📚' },
  HOLIDAY_LEAVE: { label: 'Bayram İzni', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', icon: '🌙' },
  HOLIDAY_WORK: { label: 'Bayram Çalışması', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '⭐' },
  JOB_SEARCH_LEAVE: { label: 'İş Arama İzni', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: '🔎' },
  HOM: { label: 'HOM', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', icon: '🏠' },
  MVT: { label: 'MVT', color: '#78716c', bg: 'rgba(120, 113, 108, 0.15)', icon: '📋' },
  UPD: { label: 'UPD', color: '#78716c', bg: 'rgba(120, 113, 108, 0.15)', icon: '🔄' },
  '-': { label: '-', color: '#475569', bg: 'rgba(71, 85, 105, 0.1)', icon: '—' },
};

// Gün isimleri (Pazartesi=0, tablo/vardiya kullanımı)
export const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DAY_NAMES_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Gün isimleri (JS Date sırası: Pazar=0, formatDate kullanımı)
export const DAY_NAMES_JS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const DAY_NAMES_JS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// Ay isimleri
export const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// EOF
