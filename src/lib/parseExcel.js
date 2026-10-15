import * as XLSX from 'xlsx';
import { serialToDate, formatDate } from './shiftUtils';

/**
 * Excel dosyasını parse eder ve yapılandırılmış veri döndürür
 * @param {ArrayBuffer} buffer - Excel dosya verisi
 * @returns {{ weekInfo, departments, employees, rawDates }}
 */
export function parseExcelFile(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (!data || data.length === 0) {
    throw new Error('Excel dosyası boş veya okunamadı.');
  }

  // Başlık satırından tarih bilgilerini çıkar
  const headerRow = data[0];
  if (!headerRow || headerRow.length < 9) {
    throw new Error('Excel baslik satiri gecersiz. 7 gunluk vardiya kolonlari bulunamadi.');
  }

  const dates = [];
  for (let c = 2; c < 9; c++) {
    const val = headerRow[c];
    if (typeof val === 'number') {
      const date = serialToDate(val);
      dates.push({
        serial: val,
        date,
        formatted: formatDate(date),
      });
    }
  }

  if (dates.length !== 7) {
    throw new Error('Excel tarih kolonlari gecersiz. Lutfen 7 gunluk vardiya formatini kontrol edin.');
  }

  // Hafta bilgisi oluştur
  const weekInfo = {
    startDate: dates[0]?.formatted?.full || '',
    endDate: dates[dates.length - 1]?.formatted?.full || '',
    dates,
    title: headerRow[0] || 'Vardiya Programı',
  };

  // Personel ve departman verilerini parse et
  const departments = {};
  const employees = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

    if (row.length < 9) {
      throw new Error(`${r + 1}. satir eksik kolon iceriyor. Vardiya kolonlari okunamadi.`);
    }

    const nameField = row[0];
    const teamField = row[1];

    if (!nameField || !teamField || typeof nameField !== 'string' || typeof teamField !== 'string') continue;
    if (!teamField.includes('Team:')) continue;

    // İsim ve servis güzergahı kısaltmasını ayır
    let name = nameField.trim();
    let serviceRoute = '';
    const dashIdx = name.lastIndexOf(' - ');
    if (dashIdx !== -1) {
      serviceRoute = name.substring(dashIdx + 3).trim();
      name = name.substring(0, dashIdx).trim();
    }

    // Departman bilgisi
    const teamMatch = teamField.match(/Team:\s*(.+)/);
    const groupMatch = teamField.match(/Group:\s*(\S+)/);
    const teamName = teamMatch ? teamMatch[1].trim() : 'Bilinmeyen';
    const groupName = groupMatch ? groupMatch[1].trim() : '';

    // Departman numarası ve adı ayır
    const teamParts = teamName.match(/^([\d.,]+\s*-?\s*)(.*)/);
    const deptCode = teamParts ? teamParts[1].trim().replace(/\s*-\s*$/, '') : teamName;
    const deptName = teamParts ? teamParts[2].trim() : teamName;

    // 7 günlük vardiya verileri
    const shifts = [];
    for (let c = 2; c < 9; c++) {
      const val = row[c];
      shifts.push(val ? String(val).trim() : '');
    }

    // Toplam saat
    const totalHours = row[9] ? String(row[9]).trim() : '';

    const employee = {
      id: `${name}-${serviceRoute}-${r}`,
      name,
      serviceRoute,
      department: teamName,
      departmentCode: deptCode,
      departmentName: deptName,
      group: groupName,
      shifts,
      totalHours,
      rowIndex: r,
    };

    employees.push(employee);

    // Departman gruplama
    if (!departments[teamName]) {
      departments[teamName] = {
        code: deptCode,
        name: deptName,
        fullName: teamName,
        group: groupName,
        employees: [],
      };
    }
    departments[teamName].employees.push(employee);
  }

  // Departmanları sırala
  const sortedDepartments = Object.values(departments).sort((a, b) => {
    const numA = parseFloat(a.code.replace(',', '.')) || 999;
    const numB = parseFloat(b.code.replace(',', '.')) || 999;
    return numA - numB;
  });

  return {
    weekInfo,
    departments: sortedDepartments,
    employees,
    rawDates: dates,
  };
}
