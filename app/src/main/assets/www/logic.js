/* 🏢 بُنيان — pure logic (no DOM). Tested by tests/logic.test.js with node. */
(function (root) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  const ymOf = d => (typeof d === 'string' ? d.slice(0, 7) : d.getFullYear() + '-' + pad(d.getMonth() + 1));
  const todayStr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const sum = (arr, f = x => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function addMonths(ym, k) {
    let [y, m] = ym.split('-').map(Number);
    m += k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
    return y + '-' + pad(m);
  }
  function monthsBetween(a, b) { // inclusive, a<=b
    const out = []; if (!a || !b || a > b) return out;
    for (let m = a; m <= b && out.length < 600; m = addMonths(m, 1)) out.push(m);
    return out;
  }

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const monthLabel = ym => MONTHS_AR[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  const dayLabel = (d = new Date()) => DAYS_AR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_AR[d.getMonth()] + ' ' + d.getFullYear();

  function newBuilding(name) {
    const start = ymOf(new Date());
    return {
      id: uid(), name: name || 'عمارتي', address: '', dueDay: 10, startMonth: start, opening: 0,
      fees: [{ from: start, amount: 200 }],
      units: [], requests: [], payments: [], expenses: [], contacts: defaultContacts(), alerts: []
    };
  }
  function defaultContacts() {
    return [
      { id: uid(), name: 'الإسعاف', phone: '123', cat: '🚑 طوارئ' },
      { id: uid(), name: 'الشرطة', phone: '122', cat: '🚓 طوارئ' },
      { id: uid(), name: 'المطافي', phone: '180', cat: '🚒 طوارئ' },
      { id: uid(), name: 'طوارئ الغاز', phone: '129', cat: '🔥 غاز' },
      { id: uid(), name: 'طوارئ الكهرباء', phone: '121', cat: '⚡ كهرباء' },
      { id: uid(), name: 'شكاوى المياه', phone: '125', cat: '💧 مياه' }
    ];
  }
  function newState() { const b = newBuilding(); return { v: 1, current: b.id, buildings: [b] }; }

  function migrate(s) {
    if (!s || !Array.isArray(s.buildings) || !s.buildings.length) return newState();
    for (const b of s.buildings) {
      for (const k of ['units', 'requests', 'payments', 'expenses', 'contacts', 'alerts']) if (!Array.isArray(b[k])) b[k] = [];
      if (!Array.isArray(b.fees) || !b.fees.length) b.fees = [{ from: b.startMonth || ymOf(new Date()), amount: 0 }];
      if (!b.startMonth) b.startMonth = b.fees[0].from;
      if (!b.dueDay) b.dueDay = 10;
      b.opening = Number(b.opening) || 0;
    }
    if (!s.buildings.some(b => b.id === s.current)) s.current = s.buildings[0].id;
    return s;
  }

  /** building monthly fee valid in month ym (latest change whose "from" <= ym) */
  function buildingFee(b, ym) {
    const list = [...b.fees].sort((x, y) => x.from < y.from ? -1 : 1);
    let fee = list.length ? Number(list[0].amount) : 0;
    for (const f of list) if (f.from <= ym) fee = Number(f.amount);
    return fee || 0;
  }
  const feeFor = (b, u, ym) => u.exempt ? 0 : (u.fee != null && u.fee !== '' ? Number(u.fee) : buildingFee(b, ym));

  /** months that are already due for this unit as of "today" */
  function dueMonths(b, u, today) {
    const t = today || todayStr();
    const cur = t.slice(0, 7), day = Number(t.slice(8, 10));
    const last = day >= (Number(b.dueDay) || 1) ? cur : addMonths(cur, -1);
    return monthsBetween(u.start || b.startMonth, last);
  }

  /** what this unit owes: payments fill the oldest months first */
  function unitStatus(b, u, today) {
    const months = dueMonths(b, u, today);
    const due = sum(months, m => feeFor(b, u, m));
    const paid = sum(b.payments.filter(p => p.unitId === u.id), p => p.amount);
    let left = paid; const late = [];
    for (const m of months) {
      const f = feeFor(b, u, m);
      if (left >= f) left -= f; else { late.push(m); left = 0; }
    }
    return { due, paid, balance: Math.max(0, due - paid), credit: Math.max(0, paid - due), lateMonths: late };
  }

  function overdue(b, today) {
    const list = b.units.map(u => ({ unit: u, st: unitStatus(b, u, today) })).filter(x => x.st.balance > 0);
    return { count: list.length, amount: sum(list, x => x.st.balance), list: list.sort((a, c) => c.st.balance - a.st.balance) };
  }

  /** key: 'YYYY-MM' (month) or 'YYYY' (year) */
  const inPeriod = (date, key) => (date || '').startsWith(key);
  function periodTotals(b, key) {
    const income = sum(b.payments.filter(p => inPeriod(p.date, key)), p => p.amount);
    const expense = sum(b.expenses.filter(e => inPeriod(e.date, key)), e => e.amount);
    return { income, expense, net: income - expense };
  }
  const fundBalance = b => (Number(b.opening) || 0) + sum(b.payments, p => p.amount) - sum(b.expenses, e => e.amount);

  function byCategory(b, key) {
    const map = {};
    for (const e of b.expenses.filter(e => inPeriod(e.date, key))) map[e.cat || 'أخرى'] = (map[e.cat || 'أخرى'] || 0) + Number(e.amount);
    return Object.entries(map).map(([cat, amount]) => ({ cat, amount })).sort((a, c) => c.amount - a.amount);
  }
  function yearSeries(b, year) {
    return MONTHS_AR.map((name, i) => {
      const t = periodTotals(b, year + '-' + pad(i + 1));
      return { name, income: t.income, expense: t.expense };
    });
  }
  /** collection rate for a month: units that paid >= fee for that month by now */
  function collectionRate(b, ym, today) {
    const units = b.units.filter(u => !u.exempt && feeFor(b, u, ym) > 0 && (u.start || b.startMonth) <= ym);
    if (!units.length) return 0;
    const ok = units.filter(u => !unitStatus(b, u, today).lateMonths.includes(ym)).length;
    return Math.round(ok * 100 / units.length);
  }

  // ---------- 🎤 smart entry ----------
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function normDigits(t) {
    return String(t || '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d));
  }
  const WORD_NUMS = [
    [/(?:ألفين|الفين)/g, 2000], [/(?:ألف|الف)\s*و?\s*(?:خمسمية|خمسمائة|خمسميه)/g, 1500], [/(?:ألف|الف)/g, 1000],
    [/(?:تسعمية|تسعمائة)/g, 900], [/(?:تمنمية|ثمانمائة)/g, 800], [/(?:سبعمية|سبعمائة)/g, 700], [/(?:ستمية|ستمائة)/g, 600],
    [/(?:خمسمية|خمسمائة|خمسميه)/g, 500], [/(?:ربعمية|أربعمائة|اربعمية|اربعمائة)/g, 400], [/(?:تلتمية|ثلاثمائة|تلاتمية)/g, 300],
    [/(?:ميتين|مئتين|مائتين|ميتان)/g, 200], [/(?:مية|مائة|ميه)/g, 100], [/(?:خمسين)/g, 50]
  ];
  const UNIT_WORDS = { 'الأولى': 1, 'الاولى': 1, 'واحد': 1, 'اتنين': 2, 'اثنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'تلاته': 3, 'اربعة': 4, 'أربعة': 4, 'اربعه': 4, 'خمسة': 5, 'خمسه': 5, 'ستة': 6, 'سته': 6, 'سبعة': 7, 'سبعه': 7, 'تمانية': 8, 'ثمانية': 8, 'تسعة': 9, 'تسعه': 9, 'عشرة': 10, 'عشره': 10 };
  const CATS = [
    ['⚡ كهرباء', /كهرب|نور|عداد/],
    ['💧 مياه', /مي[اه]ه?|موتور|طلمب|مضخ|خزان/],
    ['🛗 مصعد', /اسانسير|أسانسير|مصعد|اسنسير/],
    ['🧹 نظافة', /نظاف|زبال|قمام|تنظيف|منظفات/],
    ['🧍 بواب', /بواب|حارس|أمن/],
    ['🔧 صيانة', /صيان|سباك|كهربائي|نجار|دهان|تصليح|اصلاح|إصلاح|لمب/],
    ['🌿 حديقة', /زرع|حديق|جنين/]
  ];
  const EXP_VERB = /(صرف|صرفت|مصروف|فاتور|اشتري|اشتريت|شريت|دفعت\s+(?:لل|ل|فاتورة))/;
  const INC_VERB = /(حصل|حصلت|تحصيل|استلم|استلمت|دفع|دفعت|سدد|سددت|شهري|اشتراك)/;

  function parseSmart(text, b) {
    let t = normDigits(text).replace(/[،,]/g, ' ').trim();
    const raw = t;
    for (const [re, n] of WORD_NUMS) t = t.replace(re, ' ' + n + ' ');
    let unitNum = null;
    const um = t.match(/(?:شق[ةه]|الشق[ةه]|وحد[ةه]|رقم)\s*(?:رقم\s*)?(\d+|[^\s\d]+)/);
    if (um) unitNum = /^\d+$/.test(um[1]) ? um[1] : (UNIT_WORDS[um[1]] != null ? String(UNIT_WORDS[um[1]]) : null);
    const numsAll = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    let rest = numsAll.slice();
    if (unitNum != null) { const i = rest.indexOf(Number(unitNum)); if (i >= 0) rest.splice(i, 1); }
    const amount = rest.length ? Math.max(...rest) : null;
    let cat = null;
    for (const [c, re] of CATS) if (re.test(raw)) { cat = c; break; }
    let type = null;
    if (cat && !unitNum) type = 'expense';
    else if (EXP_VERB.test(raw) && !unitNum) type = 'expense';
    else if (unitNum) type = 'payment';
    else if (INC_VERB.test(raw)) type = 'payment';
    let unit = null;
    if (b && unitNum != null) unit = b.units.find(u => String(u.num).trim() === unitNum) || null;
    if (type === 'expense' && !cat) cat = '📦 أخرى';
    const ok = !!type && amount > 0 && (type === 'expense' || !!unit);
    return { type, amount, unitNum, unit, cat, note: raw, ok };
  }

  // ---------- 📣 messages ----------
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  function reminderText(b, u, st) {
    const months = st.lateMonths.map(monthLabel).join('، ');
    return `السلام عليكم ${u.name || ''} 🌷\nتذكير من إدارة ${b.name} 🏢\nشقة ${u.num}: متأخرات ${fmt(st.balance)} جنيه` +
      (months ? ` (${months})` : '') + `.\nبرجاء السداد في أقرب وقت. شكراً لتعاونكم 🙏`;
  }
  function receiptText(b, u, p) {
    return `🧾 إيصال تحصيل — ${b.name}\nشقة ${u ? u.num : '-'} ${u && u.name ? '(' + u.name + ')' : ''}\nالمبلغ: ${fmt(p.amount)} جنيه\nالتاريخ: ${p.date}` +
      (p.note ? `\nملاحظة: ${p.note}` : '') + `\nشكراً لكم 🌷`;
  }
  function monthReport(b, key) {
    const t = periodTotals(b, key), od = overdue(b);
    const cats = byCategory(b, key).map(c => `  • ${c.cat}: ${fmt(c.amount)}`).join('\n');
    return `📊 تقرير ${key.length === 7 ? monthLabel(key) : 'سنة ' + key} — ${b.name}\n` +
      `💰 الإيرادات: ${fmt(t.income)} جنيه\n🧾 المصروفات: ${fmt(t.expense)} جنيه\n` + (cats ? cats + '\n' : '') +
      `🏦 رصيد الصندوق: ${fmt(fundBalance(b))} جنيه\n⏰ المتأخرات: ${od.count} شقة / ${fmt(od.amount)} جنيه`;
  }
  function toCSV(b) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const unitNum = id => (b.units.find(u => u.id === id) || {}).num || '';
    const rows = [['النوع', 'التاريخ', 'المبلغ', 'شقة', 'البند', 'ملاحظة']];
    for (const p of b.payments) rows.push(['تحصيل', p.date, p.amount, unitNum(p.unitId), '', p.note || '']);
    for (const e of b.expenses) rows.push(['مصروف', e.date, e.amount, '', e.cat || '', e.note || '']);
    rows.sort((a, c) => a[1] < c[1] ? -1 : 1);
    return '﻿' + rows.map(r => r.map(q).join(',')).join('\n');
  }

  /** in-app bell: things that need attention */
  function alertsFor(b, today) {
    const t = today || todayStr(), out = [];
    const od = overdue(b, t);
    if (od.count) out.push({ icon: '⏰', text: `${od.count} شقة متأخرة بإجمالي ${fmt(od.amount)} جنيه`, go: 'overdue' });
    const pend = b.requests.filter(r => r.status === 'pending').length;
    if (pend) out.push({ icon: '🙋', text: `${pend} طلب انضمام في الانتظار`, go: 'residents' });
    const day = Number(t.slice(8, 10));
    if (day <= (Number(b.dueDay) || 10)) out.push({ icon: '📅', text: `موعد تحصيل شهرية ${monthLabel(t.slice(0, 7))} يوم ${b.dueDay}`, go: 'notify' });
    if (fundBalance(b) < 0) out.push({ icon: '⚠️', text: 'رصيد الصندوق بالسالب', go: 'reports' });
    for (const a of b.alerts.slice(-5).reverse()) out.push({ icon: '📣', text: a.text, go: null });
    return out;
  }

  const api = {
    pad, ymOf, todayStr, sum, uid, addMonths, monthsBetween, monthLabel, dayLabel, MONTHS_AR,
    newBuilding, newState, migrate, buildingFee, feeFor, dueMonths, unitStatus, overdue,
    periodTotals, fundBalance, byCategory, yearSeries, collectionRate,
    normDigits, parseSmart, CATS, reminderText, receiptText, monthReport, toCSV, alertsFor, fmt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BL = api;
})(this);
