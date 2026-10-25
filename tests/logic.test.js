// 🧪 node tests/logic.test.js
const assert = require('assert');
const L = require('../app/src/main/assets/www/logic.js');

let n = 0; const t = (name, f) => { f(); n++; console.log('✅', name); };

function sample() {
  const b = L.newBuilding('برج النور');
  b.startMonth = '2026-08'; b.fees = [{ from: '2026-08', amount: 200 }, { from: '2026-10', amount: 300 }];
  b.dueDay = 10; b.opening = 1000;
  b.units = [1, 2, 3].map(i => ({ id: 'u' + i, num: String(i), name: 'ساكن ' + i }));
  b.units.push({ id: 'u4', num: '4', exempt: true });
  b.payments = [
    { id: 'p1', unitId: 'u1', amount: 700, date: '2026-10-02' },
    { id: 'p2', unitId: 'u2', amount: 200, date: '2026-08-05' },
  ];
  b.expenses = [{ id: 'e1', amount: 150, date: '2026-10-03', cat: '⚡ كهرباء' }, { id: 'e2', amount: 50, date: '2026-09-03', cat: '🧹 نظافة' }];
  return b;
}

t('months math', () => {
  assert.strictEqual(L.addMonths('2026-12', 1), '2027-01');
  assert.strictEqual(L.addMonths('2026-01', -1), '2025-12');
  assert.deepStrictEqual(L.monthsBetween('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01']);
});

t('fee history', () => {
  const b = sample();
  assert.strictEqual(L.buildingFee(b, '2026-09'), 200);
  assert.strictEqual(L.buildingFee(b, '2026-11'), 300);
  assert.strictEqual(L.feeFor(b, b.units[3], '2026-11'), 0);
});

t('due months respect due day', () => {
  const b = sample();
  assert.strictEqual(L.dueMonths(b, b.units[0], '2026-10-05').length, 2); // Aug, Sep
  assert.strictEqual(L.dueMonths(b, b.units[0], '2026-10-10').length, 3); // + Oct
});

t('unit status allocates to oldest months', () => {
  const b = sample();
  const s1 = L.unitStatus(b, b.units[0], '2026-10-19'); // due 200+200+300=700, paid 700
  assert.strictEqual(s1.balance, 0);
  const s2 = L.unitStatus(b, b.units[1], '2026-10-19'); // paid Aug only
  assert.strictEqual(s2.balance, 500);
  assert.deepStrictEqual(s2.lateMonths, ['2026-09', '2026-10']);
});

t('overdue totals', () => {
  const od = L.overdue(sample(), '2026-10-19');
  assert.strictEqual(od.count, 2);          // u2 + u3 (u4 exempt)
  assert.strictEqual(od.amount, 500 + 700);
});

t('period totals & fund', () => {
  const b = sample();
  assert.deepStrictEqual(L.periodTotals(b, '2026-10'), { income: 700, expense: 150, net: 550 });
  assert.strictEqual(L.periodTotals(b, '2026').income, 900);
  assert.strictEqual(L.fundBalance(b), 1000 + 900 - 200);
  assert.strictEqual(L.byCategory(b, '2026')[0].cat, '⚡ كهرباء');
  assert.strictEqual(L.yearSeries(b, '2026')[9].income, 700);
});

t('smart entry: collection', () => {
  const b = sample();
  let r = L.parseSmart('حصلت ٣٠٠ جنيه من شقة ٣', b);
  assert.strictEqual(r.type, 'payment'); assert.strictEqual(r.amount, 300); assert.strictEqual(r.unit.id, 'u3'); assert.ok(r.ok);
  r = L.parseSmart('شقة 2 دفعت تلتمية', b);
  assert.strictEqual(r.type, 'payment'); assert.strictEqual(r.amount, 300); assert.strictEqual(r.unit.id, 'u2');
  r = L.parseSmart('الشقة خمسة دفعت 200', b);
  assert.strictEqual(r.unitNum, '5'); assert.strictEqual(r.ok, false); // no unit 5
});

t('smart entry: expense', () => {
  const b = sample();
  let r = L.parseSmart('صرفت 250 على فاتورة الكهرباء', b);
  assert.strictEqual(r.type, 'expense'); assert.strictEqual(r.amount, 250); assert.strictEqual(r.cat, '⚡ كهرباء'); assert.ok(r.ok);
  r = L.parseSmart('دفعت للسباك ميتين', b);
  assert.strictEqual(r.type, 'expense'); assert.strictEqual(r.amount, 200); assert.strictEqual(r.cat, '🔧 صيانة');
  r = L.parseSmart('اشتريت منظفات ب 75', b);
  assert.strictEqual(r.cat, '🧹 نظافة'); assert.strictEqual(r.amount, 75);
  r = L.parseSmart('صيانة الاسانسير 1500', b);
  assert.strictEqual(r.cat, '🛗 مصعد'); assert.strictEqual(r.amount, 1500);
});

t('messages & csv', () => {
  const b = sample(); const st = L.unitStatus(b, b.units[1], '2026-10-19');
  assert.ok(L.reminderText(b, b.units[1], st).includes('500'));
  assert.ok(L.monthReport(b, '2026-10').includes('700'));
  assert.strictEqual(L.toCSV(b).split('\n').length, 5);
  assert.ok(L.alertsFor(b, '2026-10-05').some(a => a.go === 'overdue'));
});

t('migrate fills gaps', () => {
  const s = L.migrate({ buildings: [{ id: 'x', name: 'a' }] });
  assert.strictEqual(s.current, 'x'); assert.ok(Array.isArray(s.buildings[0].units));
  assert.ok(L.migrate(null).buildings.length === 1);
});

console.log(`\n🎉 ${n} tests passed`);
