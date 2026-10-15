const XLS_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_SIGNATURE = [0x50, 0x4b]; // .xlsx is a zip container

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // common fallback in some browsers
  '',
];

function hasAllowedExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function hasAllowedMime(file) {
  if (!file) return false;
  return ALLOWED_MIME_TYPES.includes((file.type || '').toLowerCase());
}

function hasXlsSignature(bytes) {
  if (!bytes || bytes.length < XLS_SIGNATURE.length) return false;
  for (let i = 0; i < XLS_SIGNATURE.length; i++) {
    if (bytes[i] !== XLS_SIGNATURE[i]) return false;
  }
  return true;
}

function hasXlsxSignature(bytes) {
  if (!bytes || bytes.length < ZIP_SIGNATURE.length) return false;
  return bytes[0] === ZIP_SIGNATURE[0] && bytes[1] === ZIP_SIGNATURE[1];
}

function validateSignature(fileName, bytes) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xls')) return hasXlsSignature(bytes);
  if (lower.endsWith('.xlsx')) return hasXlsxSignature(bytes);
  return false;
}

export async function getValidatedExcelBuffer(file) {
  if (!file) {
    return {
      ok: false,
      code: 'ERR_FILE_EMPTY',
      message: 'Dosya bulunamadi.',
    };
  }

  if (!hasAllowedExtension(file.name)) {
    return {
      ok: false,
      code: 'ERR_FILE_TYPE_INVALID',
      message: 'Gecersiz dosya turu. Lutfen .xlsx veya .xls dosyasi yukleyin.',
    };
  }

  if (!hasAllowedMime(file)) {
    return {
      ok: false,
      code: 'ERR_FILE_MIME_INVALID',
      message: 'Dosya turu dogrulanamadi. Lutfen gecerli bir Excel dosyasi secin.',
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_EXCEL_BYTES) {
    return {
      ok: false,
      code: 'ERR_FILE_SIZE_INVALID',
      message: 'Excel dosyasi bos veya 10 MB sinirini asiyor.',
    };
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 16));

  if (!validateSignature(file.name, bytes)) {
    return {
      ok: false,
      code: 'ERR_FILE_SIGNATURE_INVALID',
      message: 'Dosya icerigi Excel formatiyla uyusmuyor. Lutfen gecerli .xlsx/.xls dosyasi secin.',
    };
  }

  return { ok: true, buffer };
}
