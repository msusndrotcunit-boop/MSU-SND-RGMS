const { parseFileAsync, summarize } = require('../utils/rotcmisParser');
const ExcelJS = require('exceljs');

function makeCSV(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => r[h]).join(','));
  }
  return lines.join('\n');
}

function makeJSON(records) {
  return JSON.stringify({ records });
}

async function makeXLSX(records) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  const headers = Object.keys(records[0] || {});
  ws.addRow(headers);
  records.forEach(r => {
    ws.addRow(headers.map(h => r[h]));
  });
  return wb.xlsx.writeBuffer();
}

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function run() {
  // Basic mixed formats with duplicates
  const base = [
    { student_id: 'C-1001', name: 'Alpha Cadet', date: '2026-02-15', status: 'present' },
    { student_id: 'C-1002', name: 'Bravo Cadet', date: '02/15/2026', status: 'late' },
    { student_id: 'C-1003', name: 'Charlie Cadet', date: '2026-02-15 07:30', status: 'excused' },
    { student_id: 'C-1001', name: 'Alpha Cadet', date: '2026-02-15', status: 'present' } // duplicate in batch
  ];
  const csv = makeCSV(base);
  const recsCSV = await parseFileAsync(Buffer.from(csv, 'utf8'), 'rotcmis.csv');
  const sumCSV = summarize(recsCSV);
  console.log('CSV Summary:', sumCSV);
  assert(sumCSV.total === 4, 'CSV total should be 4');
  assert(sumCSV.valid >= 3, 'CSV should have at least 3 valid');

  const json = makeJSON(base);
  const recsJSON = await parseFileAsync(Buffer.from(json, 'utf8'), 'rotcmis.json');
  const sumJSON = summarize(recsJSON);
  console.log('JSON Summary:', sumJSON);
  assert(sumJSON.total === 4, 'JSON total should be 4');

  const xbuf = await makeXLSX(base);
  const recsX = await parseFileAsync(Buffer.from(xbuf), 'rotcmis.xlsx');
  const sumX = summarize(recsX);
  console.log('XLSX Summary:', sumX);
  assert(sumX.total === 4, 'XLSX total should be 4');

  // Large batch test
  const big = [];
  for (let i = 0; i < 1000; i++) {
    big.push({ student_id: `C-${10000 + i}`, name: `Cadet ${i}`, date: '2026-02-15', status: i % 10 === 0 ? 'late' : 'present' });
  }
  const recsBig = await parseFileAsync(Buffer.from(makeCSV(big), 'utf8'), 'rotcmis.csv');
  const sumBig = summarize(recsBig);
  console.log('Large Batch Summary:', sumBig);
  assert(sumBig.total === 1000, 'Large batch should have 1000 records');
  assert(sumBig.valid >= 900, 'Large batch valid should be high');

  console.log('All ROTCMIS parser tests passed');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
