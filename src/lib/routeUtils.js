import * as xlsx from 'xlsx';

export function excelFractionToTime(fraction) {
  if (typeof fraction !== 'number' || isNaN(fraction)) return null;
  // Günde 24 saat * 60 dakika
  const totalMinutes = Math.round(fraction * 24 * 60);
  const m = ((totalMinutes % 1440) + 1440) % 1440; // Negatif veya fazlalıkları temizler
  const hour = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

export function normalizeRouteCode(shortCode) {
  if (!shortCode) return null;
  // Türkçe locale ile büyük harfe çevir: 'i'→'İ', 'ı'→'I' (JS toUpperCase() bunu yapmaz)
  let code = String(shortCode).toLocaleUpperCase('tr-TR').trim();

  // B harfi (Bayan servis anlamına geliyor) çoğunlukla kodların sonundadır: UNB, AKB, Ç1B
  if (code.endsWith('B') && code.length >= 3) {
    code = code.slice(0, -1);
  }

  // Kısa kod → tam güzergah adı eşleştirmesi
  // Not: Tüm anahtarlar Türkçe locale büyük harfle yazılmış (toLocaleUpperCase ile eşleşir)
  const map = {
    'UN':  'UNCALI',
    'AK':  'AKSU',
    'LR':  'LARA',
    'Ç1':  'ÇEVRE-1',
    'C1':  'ÇEVRE-1',
    'DD':  'DÜDEN',
    'LM':  'LİMAN',
    'DL':  'LİMAN',
    'Lİ':  'LİMAN',   // Türkçe İ ile
    'LI':  'LİMAN',   // Latin I ile (yedek)
    'KG':  'KENDİ GELİYOR',
  };

  return map[code] || code;
}

export function parseRouteData(arrayBuffer) {
  const wb = xlsx.read(arrayBuffer, { type: 'array' });
  const parsedRoutes = {};

  wb.SheetNames.forEach(sheetName => {
    const normalizedRouteName = sheetName.trim().toUpperCase();

    // Tabloyu düz 2 boyutlu array olarak oku
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });

    if (data.length < 4) return;

    // Servis tablolarında 4. satır (index 3) genel olarak vardiya saatleridir
    const shiftRow = data[3];
    if (!shiftRow) return;

    const shiftCols = {}; // { colIndex: "04:30" }
    shiftRow.forEach((cell, idx) => {
      // Değerler küçük kesirli sayılarsa (0.166 vb.) Excel saatidir
      if (typeof cell === 'number' && cell >= -0.1 && cell <= 1.1) {
        const timeStr = excelFractionToTime(cell);
        if (timeStr) {
          shiftCols[idx] = timeStr;
        }
      }
    });

    const definedShifts = Object.values(shiftCols);
    if (definedShifts.length === 0) return;

    const stops = [];
    // 5. satırdan (index 4) itibaren duraklar yer alır
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      let stopName = '';
      let stopId = row[0];

      // 2. sütunda (index 1) isim olur genelde, ama bazen boşluklu olabiliyor
      if (typeof row[1] === 'string' && row[1].trim() !== '') {
        stopName = row[1].trim();
      } else if (typeof row[2] === 'string' && row[2].trim() !== '') {
        stopName = row[2].trim();
      }

      if (!stopName || stopName === 'null' || stopName.toLowerCase().includes('sola dön')) continue;

      if (!isNaN(parseFloat(stopId)) && stopName !== '') {
        const stopTimes = {};

        Object.keys(shiftCols).forEach(colIdx => {
          const shiftTime = shiftCols[colIdx];
          const cellVal = row[colIdx];
          if (typeof cellVal === 'number') {
            stopTimes[shiftTime] = excelFractionToTime(cellVal);
          }
        });

        stops.push({
          id: stopId,
          name: stopName,
          times: stopTimes
        });
      }
    }

    if (stops.length > 0) {
      parsedRoutes[normalizedRouteName] = {
        name: normalizedRouteName,
        shifts: definedShifts,
        stops
      };
    }
  });

  return parsedRoutes;
}
