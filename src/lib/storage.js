const STORAGE_ERROR_MAP = {
  QUOTA: 'ERR_STORAGE_QUOTA',
  UNAVAILABLE: 'ERR_STORAGE_UNAVAILABLE',
  UNKNOWN: 'ERR_STORAGE_UNKNOWN',
};

function mapStorageError(err) {
  if (!err) return STORAGE_ERROR_MAP.UNKNOWN;
  if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
    return STORAGE_ERROR_MAP.QUOTA;
  }
  if (err.name === 'SecurityError' || err.name === 'InvalidStateError') {
    return STORAGE_ERROR_MAP.UNAVAILABLE;
  }
  return STORAGE_ERROR_MAP.UNKNOWN;
}

function hasWindowStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function storageSet(key, value) {
  try {
    if (!hasWindowStorage()) {
      return { ok: false, code: STORAGE_ERROR_MAP.UNAVAILABLE, error: null };
    }
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: mapStorageError(error), error };
  }
}

export function storageGet(key) {
  try {
    if (!hasWindowStorage()) {
      return { ok: false, code: STORAGE_ERROR_MAP.UNAVAILABLE, value: null, error: null };
    }
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch (error) {
    return { ok: false, code: mapStorageError(error), value: null, error };
  }
}

export function storageRemove(key) {
  try {
    if (!hasWindowStorage()) {
      return { ok: false, code: STORAGE_ERROR_MAP.UNAVAILABLE, error: null };
    }
    window.localStorage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: mapStorageError(error), error };
  }
}

export function storageClear() {
  try {
    if (!hasWindowStorage()) {
      return { ok: false, code: STORAGE_ERROR_MAP.UNAVAILABLE, error: null };
    }
    window.localStorage.clear();
    return { ok: true };
  } catch (error) {
    return { ok: false, code: mapStorageError(error), error };
  }
}

export { STORAGE_ERROR_MAP };
