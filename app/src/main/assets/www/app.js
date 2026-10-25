/* 🏢 بُنيان — UI. Native bridge = window.Bn (Kotlin). Falls back to localStorage in a normal browser. */
(function () {
  'use strict';
  const L = window.BL;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = L.fmt;
  const N = window.Bn || {
    load: () => localStorage.getItem('bonian') || '', save: s => localStorage.setItem('bonian', s),
    version: () => '1.0.dev', versionCode: () => 0, checkUpdate: () => App.onUpdate(''), installUpdate: () => {},
    listen: () => App.onSpeechErr('الميكروفون متاح في تطبيق الموبايل فقط'), share: t => navigator.share ? navigator.share({ text: t }) : alert(t),
    whatsapp: (p, t) => window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(t)), call: p => location.href = 'tel:' + p,
    shareFile: (n, c) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c])); a.download = n; a.click(); },
    importBackup: () => {}, getPref: (k, d) => localStorage.getItem('p_' + k) ?? d, setPref: (k, v) => localStorage.setItem('p_' + k, v),
    openUrl: u => window.open(u), theme: () => {}
  };

  let S;                       // whole state
  const B = () => S.buildings.find(b => b.id === S.current);
  let mode = 'm';              // m = month, y = year
  let cursor = L.ymOf(new Date());
  const key = () => mode === 'm' ? cursor : cursor.slice(0, 4);
  const today = () => L.todayStr();

  function load() {
    let raw = ''; try { raw = N.load(); } catch (e) {}
    try { S = L.migrate(raw ? JSON.parse(raw) : null); } catch (e) { S = L.newState(); }
  }
  function save() { try { N.save(JSON.stringify(S)); } catch (e) { toast('⚠️ تعذّر الحفظ'); } render(); }
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 2200); }

  // ---------- sheets ----------
  function sheet(title, html) {
    $('sheet').innerHTML = `<div class="grab"></div><h2><span>${title}</span><button class="x" onclick="App.close()">✕</button></h2>${html}`;
    $('sheetBg').classList.add('show');
  }
  function close() { $('sheetBg').classList.remove('show'); }
  function pop(html) { $('pop').innerHTML = html; $('popBg').classList.add('show'); }
  function unpop() { $('popBg').classList.remove('show'); }
  const val = id => ($(id) || {}).value;
  const num = id => Number(L.normDigits(val(id))) || 0;
  const unitLabel = u => u ? `شقة ${esc(u.num)}${u.name ? ' — ' + esc(u.name) : ''}` : '—';
  const unitOptions = sel => B().units.slice().sort(byNum).map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${unitLabel(u)}</option>`).join('');
  const byNum = (a, c) => (parseInt(a.num) || 0) - (parseInt(c.num) || 0) || String(a.num).localeCompare(String(c.num));
  const phoneIntl = p => { p = L.normDigits(p || '').replace(/\D/g, ''); if (p.startsWith('00')) p = p.slice(2); if (p.startsWith('0')) p = '20' + p.slice(1); return p; };

  // ---------- render ----------
  function render() {
    const b = B();
    $('bName').textContent = b.name;
    $('today').textContent = L.dayLabel();
    const label = mode === 'm' ? L.monthLabel(cursor) : 'سنة ' + cursor.slice(0, 4);
    $('pLabel').textContent = label; $('rLabel').textContent = label;
    for (const p of ['', 'r']) { $(p + 'segM').classList.toggle('on', mode === 'm'); $(p + 'segY').classList.toggle('on', mode === 'y'); }
    const t = L.periodTotals(b, key());
    $('sInc').textContent = fmt(t.income); $('sExp').textContent = fmt(t.expense);
    $('sFund').textContent = fmt(L.fundBalance(b));
    const od = L.overdue(b, today());
    $('sLate').textContent = od.count; $('sLateAmt').textContent = fmt(od.amount) + ' جنيه';
    const al = L.alertsFor(b, today()).filter(a => a.go !== 'notify').length + (App._upd ? 1 : 0);
    $('bellDot').hidden = !al; $('bellDot').textContent = al;
    $('lockBtn').textContent = !hasPw() ? '🔓' : (isAdmin() ? '🔓' : '🔒');
    $('lockBtn').classList.toggle('locked', hasPw() && !isAdmin());
    renderReports(); renderMore();
  }

  function renderReports() {
    const b = B(), k = key(), t = L.periodTotals(b, k);
    const yr = cursor.slice(0, 4), series = L.yearSeries(b, yr);
    const max = Math.max(1, ...series.map(s => Math.max(s.income, s.expense)));
    const bars = series.map((s, i) => `<div class="m"><div class="duo"><i class="inc" style="height:${s.income / max * 100}%"></i><i class="exp" style="height:${s.expense / max * 100}%"></i></div><span class="lb">${i + 1}</span></div>`).join('');
    const cats = L.byCategory(b, k);
    const ctot = L.sum(cats, c => c.amount) || 1;
    const rate = mode === 'm' ? L.collectionRate(b, cursor, today()) : null;
    const tx = [...b.payments.filter(p => (p.date || '').startsWith(k)).map(p => ({ ...p, kind: 'p' })),
                ...b.expenses.filter(e => (e.date || '').startsWith(k)).map(e => ({ ...e, kind: 'e' }))]
      .sort((a, c) => a.date < c.date ? 1 : -1);
    $('rBody').innerHTML = `
      <div class="grid2" style="margin-bottom:12px">
        <div class="stat" style="min-height:90px"><div><div class="lbl">💵 الإيرادات</div><div class="val" style="color:var(--green);font-size:24px">${fmt(t.income)}</div></div></div>
        <div class="stat" style="min-height:90px"><div><div class="lbl">🧾 المصروفات</div><div class="val" style="color:var(--red);font-size:24px">${fmt(t.expense)}</div></div></div>
      </div>
      <div class="card"><b>📈 سنة ${yr}</b> <span class="muted" style="font-size:13px">🟩 إيراد 🟥 مصروف</span><div class="bars">${bars}</div></div>
      ${rate != null ? `<div class="card"><div class="row" style="border:0"><b>✅ نسبة التحصيل</b><b>${rate}%</b></div><div class="meter"><i style="width:${rate}%"></i></div></div>` : ''}
      <div class="card"><b>🗂️ المصروفات حسب البند</b>${cats.length ? cats.map(c => `<div class="row"><span>${esc(c.cat)}</span><span class="amt-out">${fmt(c.amount)}</span></div><div class="meter" style="height:6px"><i style="width:${c.amount / ctot * 100}%;background:var(--red)"></i></div>`).join('') : '<div class="empty">لا يوجد مصروفات</div>'}</div>
      <div class="grid2" style="margin-bottom:12px">
        <button class="btn" onclick="App.shareReport()">📤 مشاركة التقرير</button>
        <button class="btn ghost" onclick="App.exportCSV()">📑 تصدير Excel</button>
      </div>
      <button class="btn ghost" style="margin-bottom:12px" onclick="App.statements()">🧾 كشف حساب الشقق</button>
      <div class="card"><b>🔁 الحركات (${tx.length})</b>${tx.length ? tx.slice(0, 80).map(x => txRow(x)).join('') : '<div class="empty">لا يوجد حركات في هذه الفترة</div>'}</div>`;
  }
  function txRow(x) {
    const b = B();
    if (x.kind === 'p') { const u = b.units.find(u => u.id === x.unitId);
      return `<div class="row"><div>💰 ${u ? unitLabel(u) : 'إيراد آخر'}<div class="sub">${esc(x.date)} ${x.note ? '• ' + esc(x.note) : ''}</div></div><div style="text-align:left"><div class="amt-in">+${fmt(x.amount)}</div><button class="sub" onclick="App.delTx('p','${x.id}')">🗑️</button></div></div>`; }
    return `<div class="row"><div>${esc(x.cat || '📦 أخرى')}<div class="sub">${esc(x.date)} ${x.note ? '• ' + esc(x.note) : ''}</div></div><div style="text-align:left"><div class="amt-out">-${fmt(x.amount)}</div><button class="sub" onclick="App.delTx('e','${x.id}')">🗑️</button></div></div>`;
  }

  function renderMore() {
    const b = B();
    const auto = String(N.getPref('auto', 'true')) === 'true', wifi = String(N.getPref('wifi', 'true')) === 'true';
    const dark = String(N.getPref('dark', 'false')) === 'true';
    const adm = isAdmin();
    $('mBody').innerHTML = (adm ? '' : `<div class="card" style="text-align:center"><div class="big" style="font-size:44px">🔒</div><b>إعدادات الإدارة مقفولة</b>
        <p class="muted" style="font-size:14px;margin:6px 0 12px">بيانات العمارة، النسخ الاحتياطي والتعديلات محتاجة كلمة السر.</p>
        <button class="btn" onclick="App.toggleLock()">🔑 دخول الإدارة</button></div>`) + (!adm ? '' : `
      <div class="card"><b>🏢 بيانات العمارة</b>
        <div class="field" style="margin-top:10px"><label>اسم العمارة</label><input id="mName" value="${esc(b.name)}"></div>
        <div class="field"><label>العنوان</label><input id="mAddr" value="${esc(b.address)}"></div>
        <div class="grid2"><div class="field"><label>يوم استحقاق الشهرية</label><input id="mDue" type="number" min="1" max="28" value="${b.dueDay}"></div>
        <div class="field"><label>رصيد افتتاحي للصندوق</label><input id="mOpen" type="number" inputmode="decimal" value="${b.opening}"></div></div>
        <div class="field"><label>بداية الحساب (شهر)</label><input id="mStart" type="month" value="${b.startMonth}"></div>
        <button class="btn" onclick="App.saveBuilding()">💾 حفظ</button>
      </div>`) + `
      <div class="card">
        <div class="row"><span>🏘️ العمارات (${S.buildings.length})</span><button class="btn ghost sm" onclick="App.pickBuilding()">إدارة</button></div>
        <div class="row"><span>📞 أرقام وخدمات</span><button class="btn ghost sm" onclick="App.contacts()">فتح</button></div>
        <div class="row"><span>🌙 الوضع الليلي</span><label class="switch"><input type="checkbox" ${dark ? 'checked' : ''} onchange="App.setDark(this.checked)"><span></span></label></div>
      </div>
      ${!adm ? '' : `<div class="card"><b>🔐 كلمة سر الإدارة</b>
        <p class="muted" style="font-size:14px;margin:6px 0 10px">${hasPw() ? '✅ مفعّلة — أي تعديل محتاج كلمة السر. بتتقفل لوحدها بعد 5 دقايق من غير استخدام، أو لما تسيب التطبيق أكتر من دقيقة.' : '⚠️ مش مفعّلة — أي حد يمسك الموبايل يقدر يعدّل.'}</p>
        <div class="grid2"><button class="btn" onclick="App.pwForm()">${hasPw() ? '✏️ تغيير' : '🔐 تفعيل'}</button>${hasPw() ? '<button class="btn ghost" onclick="App.lock(true)">🔒 اقفل دلوقتي</button>' : ''}</div>
      </div>
      <div class="card"><b>💾 نسخة احتياطية</b>
        <p class="muted" style="font-size:14px;margin:6px 0 10px">كل البيانات على موبايلك. احفظ نسخة على Drive أو واتساب عشان متضيعش.</p>
        <div class="grid2"><button class="btn" onclick="App.backup()">📤 حفظ نسخة</button><button class="btn ghost" onclick="App.restore()">📥 استرجاع</button></div>
      </div>`}
      <div class="card"><b>⚙️ الإعدادات</b>
        <div class="row"><span>🤫 تحديث تلقائي صامت (مرة يومياً)</span><label class="switch"><input type="checkbox" ${auto ? 'checked' : ''} onchange="App.pref('auto',this.checked)"><span></span></label></div>
        <div class="row"><span>📶 التحديث على الواي فاي فقط</span><label class="switch"><input type="checkbox" ${wifi ? 'checked' : ''} onchange="App.pref('wifi',this.checked)"><span></span></label></div>
        <div class="row"><span>🔍 البحث عن تحديث</span><button class="btn ghost sm" onclick="App.checkNow()">افحص الآن</button></div>
        <div class="row"><span>ℹ️ الإصدار</span><b style="direction:ltr">${esc(N.version())}</b></div>
        <div class="row"><span>🐙 GitHub</span><button class="btn ghost sm" onclick="Bn.openUrl('https://github.com/MuhammadToffaha/bonian')">فتح</button></div>
      </div>
      <div class="credit">Designed by Muhammad Toffaha</div>`;
  }

  // ---------- navigation ----------
  function go(v) {
    for (const x of ['home', 'reports', 'smart', 'more']) { $('v-' + x).classList.toggle('on', x === v); $('n-' + x).classList.toggle('on', x === v); }
    window.scrollTo(0, 0);
  }
  function setMode(m) { mode = m; render(); }
  function shift(d) { cursor = mode === 'm' ? L.addMonths(cursor, d) : (Number(cursor.slice(0, 4)) + d) + cursor.slice(4); render(); }

  // ---------- 💰 payment ----------
  function payForm(unitId, amount) {
    const b = B();
    if (!b.units.length) { toast('🚪 أضف الشقق الأول'); return units(); }
    const u0 = unitId || b.units.slice().sort(byNum)[0].id;
    sheet('💰 تسجيل تحصيل', `
      <div class="field"><label>الشقة</label><select id="pUnit" onchange="App.payHint()">${unitOptions(u0)}<option value="">➕ إيراد آخر (بدون شقة)</option></select></div>
      <div id="pHint" class="muted" style="font-size:14px;margin:-4px 4px 10px"></div>
      <div class="field"><label>المبلغ (جنيه)</label><input id="pAmt" type="number" inputmode="decimal" value="${amount || ''}"></div>
      <div class="chips" id="pQuick" style="margin-bottom:12px"></div>
      <div class="field"><label>التاريخ</label><input id="pDate" type="date" value="${today()}"></div>
      <div class="field"><label>ملاحظة</label><input id="pNote" placeholder="شهرية أكتوبر / نقدي / إنستاباي"></div>
      <label class="row" style="border:0"><span>📲 ابعت إيصال واتساب للساكن</span><label class="switch"><input type="checkbox" id="pRcpt" checked><span></span></label></label>
      <button class="btn green" onclick="App.savePay()">✅ حفظ التحصيل</button>`);
    payHint();
  }
  function payHint() {
    const b = B(), u = b.units.find(x => x.id === val('pUnit'));
    if (!u) { $('pHint').textContent = ''; $('pQuick').innerHTML = ''; return; }
    const st = L.unitStatus(b, u, today()), fee = L.feeFor(b, u, L.ymOf(new Date()));
    $('pHint').innerHTML = st.balance ? `⏰ عليه ${fmt(st.balance)} جنيه (${st.lateMonths.length} شهر)` : (st.credit ? `✅ مقدّم ${fmt(st.credit)} جنيه` : '✅ مسدد');
    const opts = [...new Set([fee, st.balance, fee * 3, fee * 6, fee * 12].filter(x => x > 0))].slice(0, 5);
    $('pQuick').innerHTML = opts.map(o => `<button onclick="document.getElementById('pAmt').value=${o}">${fmt(o)}${o === st.balance && o !== fee ? ' (كل المتأخر)' : ''}</button>`).join('');
  }
  function savePay() {
    const amt = num('pAmt'); if (amt <= 0) return toast('✍️ اكتب المبلغ');
    const b = B(), p = { id: L.uid(), unitId: val('pUnit') || null, amount: amt, date: val('pDate') || today(), note: val('pNote').trim() };
    b.payments.push(p); save(); close(); toast('✅ تم تسجيل ' + fmt(amt) + ' جنيه');
    const u = b.units.find(x => x.id === p.unitId);
    if ($('pRcpt') && $('pRcpt').checked && u && u.phone) N.whatsapp(phoneIntl(u.phone), L.receiptText(b, u, p));
  }

  // ---------- 🧾 expense ----------
  let expCat = '⚡ كهرباء';
  function expForm(amount, cat, note) {
    if (cat) expCat = cat;
    const cats = L.CATS.map(c => c[0]).concat(['📦 أخرى']);
    sheet('🧾 تسجيل مصروف', `
      <div class="field"><label>البند</label><div class="chips">${cats.map(c => `<button class="${c === expCat ? 'on' : ''}" onclick="App.pickCat(this,'${c}')">${c}</button>`).join('')}</div></div>
      <div class="field"><label>المبلغ (جنيه)</label><input id="eAmt" type="number" inputmode="decimal" value="${amount || ''}"></div>
      <div class="field"><label>التاريخ</label><input id="eDate" type="date" value="${today()}"></div>
      <div class="field"><label>ملاحظة</label><input id="eNote" value="${esc(note || '')}" placeholder="فاتورة / اسم الفني"></div>
      <button class="btn red" onclick="App.saveExp()">✅ حفظ المصروف</button>`);
  }
  function pickCat(el, c) { expCat = c; el.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === el)); }
  function saveExp() {
    const amt = num('eAmt'); if (amt <= 0) return toast('✍️ اكتب المبلغ');
    B().expenses.push({ id: L.uid(), amount: amt, date: val('eDate') || today(), cat: expCat, note: val('eNote').trim() });
    save(); close(); toast('✅ تم تسجيل مصروف ' + fmt(amt));
  }
  function delTx(kind, id) {
    pop(`<div class="big">🗑️</div><p><b>تمسح الحركة دي؟</b></p><div class="grid2"><button class="btn red" onclick="App.doDel('${kind}','${id}')">مسح</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`);
  }
  function doDel(kind, id) { const b = B(); const k = kind === 'p' ? 'payments' : 'expenses'; b[k] = b[k].filter(x => x.id !== id); unpop(); save(); toast('🗑️ اتمسحت'); }
  function openList(kind) {
    const b = B(), k = key();
    const tx = (kind === 'payment' ? b.payments.map(p => ({ ...p, kind: 'p' })) : b.expenses.map(e => ({ ...e, kind: 'e' })))
      .filter(x => (x.date || '').startsWith(k)).sort((a, c) => a.date < c.date ? 1 : -1);
    sheet(kind === 'payment' ? '💵 الإيرادات — ' + $('pLabel').textContent : '🧾 المصروفات — ' + $('pLabel').textContent,
      `<div class="card">${tx.length ? tx.map(txRow).join('') : '<div class="empty">لا يوجد</div>'}</div>
       <button class="btn ${kind === 'payment' ? 'green' : 'red'}" onclick="App.${kind === 'payment' ? 'payForm' : 'expForm'}()">➕ إضافة</button>`);
  }

  // ---------- 🏢 fee ----------
  function feeForm() {
    const b = B(), cur = L.buildingFee(b, L.ymOf(new Date()));
    const hist = b.fees.slice().sort((a, c) => a.from < c.from ? 1 : -1).map(f => `<div class="row"><span>من ${L.monthLabel(f.from)}</span><b>${fmt(f.amount)} جنيه</b></div>`).join('');
    sheet('🏢 ضبط شهرية العمارة', `
      <div class="card" style="text-align:center"><div class="muted">الشهرية الحالية</div><div style="font-size:34px;font-weight:800;color:var(--blue)">${fmt(cur)} <small style="font-size:16px">جنيه</small></div></div>
      <div class="field"><label>الشهرية الجديدة (لكل شقة)</label><input id="fAmt" type="number" inputmode="decimal" value="${cur}"></div>
      <div class="field"><label>تبدأ من شهر</label><input id="fFrom" type="month" value="${L.ymOf(new Date())}"></div>
      <div class="field"><label>يوم الاستحقاق كل شهر</label><input id="fDay" type="number" min="1" max="28" value="${b.dueDay}"></div>
      <p class="muted" style="font-size:13px">💡 الشهور القديمة بتفضل على السعر القديم. ولو شقة ليها شهرية مختلفة، عدّلها من صفحة الشقق.</p>
      <button class="btn" onclick="App.saveFee()">💾 حفظ</button>
      <div class="card" style="margin-top:14px"><b>📜 سجل الشهرية</b>${hist}</div>`);
  }
  function saveFee() {
    const b = B(), amt = num('fAmt'), from = val('fFrom') || L.ymOf(new Date());
    b.fees = b.fees.filter(f => f.from !== from); b.fees.push({ from, amount: amt });
    if (from < b.startMonth) b.startMonth = from;
    b.dueDay = Math.min(28, Math.max(1, num('fDay') || 10));
    save(); close(); toast('✅ الشهرية بقت ' + fmt(amt));
  }

  // ---------- 🚪 units ----------
  function units() {
    const b = B();
    const list = b.units.slice().sort(byNum).map(u => {
      const st = L.unitStatus(b, u, today());
      const tag = u.exempt ? '<span class="tag wait">معفاة</span>' : st.balance ? `<span class="tag bad">${fmt(st.balance)}</span>` : '<span class="tag ok">مسدد ✓</span>';
      return `<div class="row" onclick="App.unitForm('${u.id}')"><div>🚪 <b>شقة ${esc(u.num)}</b> ${u.floor ? '<span class="sub">دور ' + esc(u.floor) + '</span>' : ''}<div class="sub">${esc(u.name || 'بدون ساكن')} ${u.phone ? '• ' + esc(u.phone) : ''}</div></div>${tag}</div>`;
    }).join('');
    sheet(`🚪 الشقق (${b.units.length})`, `
      <div class="grid2" style="margin-bottom:12px"><button class="btn" onclick="App.unitForm()">➕ شقة</button><button class="btn ghost" onclick="App.bulkUnits()">⚡ إضافة سريعة</button></div>
      <div class="card">${list || '<div class="empty">لسه مفيش شقق. ابدأ بالإضافة السريعة ⚡</div>'}</div>`);
  }
  function bulkUnits() {
    sheet('⚡ إضافة شقق سريعة', `
      <div class="grid2"><div class="field"><label>عدد الأدوار</label><input id="bFloors" type="number" value="5"></div>
      <div class="field"><label>شقق في الدور</label><input id="bPer" type="number" value="2"></div></div>
      <div class="field"><label>يبدأ الترقيم من</label><input id="bStart" type="number" value="1"></div>
      <button class="btn" onclick="App.doBulk()">✅ أضف</button>`);
  }
  function doBulk() {
    const b = B(), f = num('bFloors'), per = num('bPer'); let n = num('bStart') || 1;
    if (f * per > 400 || f * per <= 0) return toast('⚠️ رقم مش منطقي');
    for (let i = 1; i <= f; i++) for (let j = 0; j < per; j++, n++)
      if (!b.units.some(u => String(u.num) === String(n))) b.units.push({ id: L.uid(), num: String(n), floor: String(i), name: '', phone: '', role: 'مالك' });
    save(); toast('✅ تمت الإضافة'); units();
  }
  function unitForm(id) {
    const b = B(), u = b.units.find(x => x.id === id) || { num: '', floor: '', name: '', phone: '', role: 'مالك', fee: '', start: '', exempt: false };
    const st = id ? L.unitStatus(b, u, today()) : null;
    sheet(id ? `🚪 شقة ${esc(u.num)}` : '➕ شقة جديدة', `
      ${st ? `<div class="grid2" style="margin-bottom:12px">
        <div class="card" style="margin:0;text-align:center"><div class="muted">متأخرات</div><b style="color:var(--red);font-size:22px">${fmt(st.balance)}</b></div>
        <div class="card" style="margin:0;text-align:center"><div class="muted">إجمالي المدفوع</div><b style="color:var(--green);font-size:22px">${fmt(st.paid)}</b></div></div>
        <div class="grid2" style="margin-bottom:12px"><button class="btn green" onclick="App.payForm('${u.id}',${st.balance || ''})">💰 تحصيل</button>
        <button class="btn ghost" onclick="App.statement('${u.id}')">🧾 كشف حساب</button></div>
        ${st.balance && u.phone ? `<button class="btn ghost" style="margin-bottom:12px" onclick="App.remind('${u.id}')">📲 تذكير واتساب</button>` : ''}` : ''}
      <div class="grid2"><div class="field"><label>رقم الشقة</label><input id="uNum" value="${esc(u.num)}"></div>
      <div class="field"><label>الدور</label><input id="uFloor" value="${esc(u.floor)}"></div></div>
      <div class="field"><label>اسم الساكن</label><input id="uName" value="${esc(u.name)}"></div>
      <div class="field"><label>الموبايل</label><input id="uPhone" type="tel" value="${esc(u.phone)}" placeholder="01xxxxxxxxx"></div>
      <div class="field"><label>الصفة</label><select id="uRole">${['مالك', 'مستأجر', 'فاضية'].map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label>شهرية خاصة (اختياري)</label><input id="uFee" type="number" value="${u.fee ?? ''}" placeholder="${L.buildingFee(b, L.ymOf(new Date()))}"></div>
      <div class="field"><label>بداية الحساب</label><input id="uStart" type="month" value="${u.start || ''}"></div></div>
      <label class="row" style="border:0"><span>🆓 معفاة من الشهرية</span><label class="switch"><input type="checkbox" id="uEx" ${u.exempt ? 'checked' : ''}><span></span></label></label>
      <button class="btn" onclick="App.saveUnit('${id || ''}')">💾 حفظ</button>
      ${id ? `<button class="btn ghost" style="margin-top:10px;color:var(--red)" onclick="App.delUnit('${id}')">🗑️ حذف الشقة</button>` : ''}`);
  }
  function saveUnit(id) {
    const b = B(); const numv = L.normDigits(val('uNum')).trim(); if (!numv) return toast('✍️ اكتب رقم الشقة');
    if (b.units.some(u => u.id !== id && String(u.num) === numv)) return toast('⚠️ الرقم ده موجود');
    let u = b.units.find(x => x.id === id); if (!u) { u = { id: L.uid() }; b.units.push(u); }
    Object.assign(u, { num: numv, floor: val('uFloor').trim(), name: val('uName').trim(), phone: L.normDigits(val('uPhone')).trim(), role: val('uRole'),
      fee: val('uFee') === '' ? null : num('uFee'), start: val('uStart') || null, exempt: $('uEx').checked });
    save(); toast('✅ اتحفظت'); units();
  }
  function delUnit(id) {
    pop(`<div class="big">⚠️</div><p><b>حذف الشقة؟</b><br><span class="muted">مدفوعاتها هتتحول لإيراد عام.</span></p><div class="grid2"><button class="btn red" onclick="App.doDelUnit('${id}')">حذف</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`);
  }
  function doDelUnit(id) { const b = B(); b.units = b.units.filter(u => u.id !== id); b.payments.forEach(p => { if (p.unitId === id) p.unitId = null; }); unpop(); save(); units(); }
  function statement(id) {
    const b = B(), u = b.units.find(x => x.id === id), st = L.unitStatus(b, u, today());
    const months = L.dueMonths(b, u, today()).map(m => `<div class="row"><span>${L.monthLabel(m)}</span><span>${fmt(L.feeFor(b, u, m))} ${st.lateMonths.includes(m) ? '<span class="tag bad">متأخر</span>' : '<span class="tag ok">✓</span>'}</span></div>`).reverse().join('');
    const pays = b.payments.filter(p => p.unitId === id).sort((a, c) => a.date < c.date ? 1 : -1).map(p => `<div class="row"><span>${esc(p.date)} ${p.note ? '<span class="sub">' + esc(p.note) + '</span>' : ''}</span><span class="amt-in">${fmt(p.amount)}</span></div>`).join('');
    const text = `🧾 كشف حساب شقة ${u.num} — ${b.name}\nالمستحق: ${fmt(st.due)}\nالمدفوع: ${fmt(st.paid)}\nالمتبقي: ${fmt(st.balance)} جنيه` + (st.lateMonths.length ? `\nشهور متأخرة: ${st.lateMonths.map(L.monthLabel).join('، ')}` : '');
    App._stmt = text;
    sheet(`🧾 كشف حساب شقة ${esc(u.num)}`, `
      <div class="card"><div class="row"><span>المستحق</span><b>${fmt(st.due)}</b></div><div class="row"><span>المدفوع</span><b class="amt-in">${fmt(st.paid)}</b></div><div class="row"><span>المتبقي</span><b class="amt-out">${fmt(st.balance)}</b></div></div>
      <button class="btn" style="margin-bottom:12px" onclick="Bn&&Bn.share?Bn.share(App._stmt):null">📤 مشاركة الكشف</button>
      <div class="card"><b>📅 الشهور</b>${months || '<div class="empty">—</div>'}</div>
      <div class="card"><b>💰 المدفوعات</b>${pays || '<div class="empty">لا يوجد</div>'}</div>`);
  }
  function statements() {
    const b = B();
    sheet('🧾 كشف حساب الشقق', `<div class="card">${b.units.slice().sort(byNum).map(u => { const st = L.unitStatus(b, u, today());
      return `<div class="row" onclick="App.statement('${u.id}')"><span>🚪 شقة ${esc(u.num)} <span class="sub">${esc(u.name)}</span></span><span>${st.balance ? `<span class="tag bad">${fmt(st.balance)}</span>` : '<span class="tag ok">✓</span>'}</span></div>`; }).join('') || '<div class="empty">لا يوجد شقق</div>'}</div>`);
  }

  // ---------- ⏰ overdue & 📣 notify ----------
  function openOverdue() {
    const b = B(), od = L.overdue(b, today());
    sheet(`⏰ المتأخرات (${od.count})`, `
      <div class="card" style="text-align:center"><div class="muted">الإجمالي</div><div style="font-size:30px;font-weight:800;color:var(--amber)">${fmt(od.amount)} جنيه</div></div>
      ${od.count ? `<button class="btn" style="margin-bottom:12px" onclick="App.remindAll()">📲 تذكير الكل واتساب</button>` : ''}
      <div class="card">${od.list.map(x => `<div class="row"><div onclick="App.unitForm('${x.unit.id}')">🚪 <b>شقة ${esc(x.unit.num)}</b> <span class="sub">${esc(x.unit.name)}</span><div class="sub">${x.st.lateMonths.length} شهر • ${x.st.lateMonths.slice(0, 3).map(L.monthLabel).join('، ')}</div></div>
        <div style="text-align:left"><b class="amt-out">${fmt(x.st.balance)}</b><br>${x.unit.phone ? `<button class="btn ghost sm" onclick="App.remind('${x.unit.id}')">📲</button>` : ''}</div></div>`).join('') || '<div class="empty">🎉 مفيش متأخرات</div>'}</div>`);
  }
  function remind(id) {
    const b = B(), u = b.units.find(x => x.id === id); if (!u || !u.phone) return toast('📵 مفيش رقم موبايل');
    N.whatsapp(phoneIntl(u.phone), L.reminderText(b, u, L.unitStatus(b, u, today())));
  }
  let queue = [];
  function remindAll() {
    queue = L.overdue(B(), today()).list.filter(x => x.unit.phone).map(x => x.unit.id);
    if (!queue.length) return toast('📵 مفيش أرقام موبايل للمتأخرين');
    nextRemind();
  }
  function nextRemind() {
    if (!queue.length) { unpop(); return toast('✅ خلصنا التذكيرات'); }
    const id = queue.shift(), u = B().units.find(x => x.id === id);
    pop(`<div class="big">📲</div><p>تذكير <b>شقة ${esc(u.num)}</b> ${esc(u.name)}<br><span class="muted">باقي ${queue.length}</span></p>
      <div class="grid2"><button class="btn" onclick="App.remind('${id}');App.nextRemind()">ابعت</button><button class="btn ghost" onclick="App.nextRemind()">تخطي</button></div>
      <button class="btn ghost" style="margin-top:8px" onclick="App.unpop()">إيقاف</button>`);
  }
  function notify() {
    const b = B(), m = L.monthLabel(L.ymOf(new Date())), fee = fmt(L.buildingFee(b, L.ymOf(new Date())));
    const tpl = [
      ['📅 موعد الشهرية', `السلام عليكم 🌷\nنذكّر السادة السكان بسداد شهرية ${m} (${fee} جنيه) قبل يوم ${b.dueDay}.\nإدارة ${b.name} 🏢`],
      ['💧 قطع مياه', `السلام عليكم 🌷\nسيتم قطع المياه يوم ... من الساعة ... إلى ... للصيانة.\nنعتذر عن الإزعاج 🙏 — إدارة ${b.name}`],
      ['🛗 صيانة المصعد', `السلام عليكم 🌷\nالمصعد متوقف للصيانة يوم ... . نعتذر عن الإزعاج 🙏 — إدارة ${b.name}`],
      ['🧹 نظافة', `السلام عليكم 🌷\nبرجاء الحفاظ على نظافة السلم ووضع القمامة في المكان المخصص. شكراً لتعاونكم 🙏`],
      ['🤝 اجتماع', `السلام عليكم 🌷\nندعوكم لاجتماع السكان يوم ... الساعة ... بمدخل العمارة لمناقشة ... .\nإدارة ${b.name} 🏢`]
    ];
    App._tpl = tpl;
    sheet('📣 إرسال إشعار', `
      <div class="field"><label>قوالب جاهزة</label><div class="chips">${tpl.map((t, i) => `<button onclick="document.getElementById('nTxt').value=App._tpl[${i}][1]">${t[0]}</button>`).join('')}</div></div>
      <div class="field"><label>نص الإشعار</label><textarea id="nTxt" rows="6">${esc(tpl[0][1])}</textarea></div>
      <button class="btn" onclick="App.sendNotice()">📤 مشاركة (جروب واتساب / أي تطبيق)</button>
      <button class="btn ghost" style="margin-top:10px" onclick="App.sendEach()">📲 لكل ساكن واتساب لوحده</button>
      ${L.overdue(b, today()).count ? `<button class="btn ghost" style="margin-top:10px" onclick="App.remindAll()">⏰ تذكير المتأخرين بس</button>` : ''}`);
  }
  function logAlert(text) { B().alerts.push({ id: L.uid(), date: today(), text: text.split('\n').find(l => l.trim() && !l.includes('السلام')) || text.slice(0, 60) }); B().alerts = B().alerts.slice(-30); }
  function sendNotice() { const t = val('nTxt'); if (!t.trim()) return; logAlert(t); save(); N.share(t); }
  function sendEach() {
    const t = val('nTxt'); App._each = t; logAlert(t); save();
    queue = B().units.filter(u => u.phone).map(u => u.id);
    if (!queue.length) return toast('📵 مفيش أرقام موبايل');
    const step = () => {
      if (!queue.length) { unpop(); return toast('✅ اتبعت للكل'); }
      const id = queue.shift(), u = B().units.find(x => x.id === id);
      pop(`<div class="big">📲</div><p>إرسال لـ <b>شقة ${esc(u.num)}</b> ${esc(u.name)}<br><span class="muted">باقي ${queue.length}</span></p>
        <div class="grid2"><button class="btn" onclick="Bn.whatsapp('${phoneIntl(u.phone)}',App._each);App._step()">ابعت</button><button class="btn ghost" onclick="App._step()">تخطي</button></div>
        <button class="btn ghost" style="margin-top:8px" onclick="App.unpop()">إيقاف</button>`);
    };
    App._step = step; step();
  }

  // ---------- 👥 residents & join requests ----------
  function residents() {
    const b = B(), pend = b.requests.filter(r => r.status === 'pending');
    const people = b.units.filter(u => u.name).slice().sort(byNum);
    sheet('👥 السكان وطلبات الانضمام', `
      <div class="card"><div class="row" style="border:0"><b>🙋 طلبات الانضمام (${pend.length})</b><button class="btn ghost sm" onclick="App.reqForm()">➕ طلب</button></div>
        ${pend.map(r => `<div class="row"><div><b>${esc(r.name)}</b> <span class="sub">${esc(r.role || '')}</span><div class="sub">شقة ${esc(r.unit)} • ${esc(r.phone)} • ${esc(r.date)}</div></div>
          <div><button class="btn green sm" onclick="App.accept('${r.id}')">✓</button> <button class="btn red sm" onclick="App.reject('${r.id}')">✕</button></div></div>`).join('') || '<div class="empty" style="padding:10px">لا يوجد طلبات</div>'}
        <button class="btn ghost" style="margin-top:8px" onclick="App.inviteLink()">🔗 ابعت رسالة انضمام لساكن جديد</button>
      </div>
      <div class="card"><b>🏠 السكان (${people.length})</b>
        ${people.map(u => `<div class="row"><div onclick="App.unitForm('${u.id}')">👤 <b>${esc(u.name)}</b> <span class="tag ${u.role === 'مستأجر' ? 'wait' : 'ok'}">${esc(u.role || 'مالك')}</span><div class="sub">شقة ${esc(u.num)} ${u.phone ? '• ' + esc(u.phone) : ''}</div></div>
          ${u.phone ? `<div><button class="btn ghost sm" onclick="Bn.call('${esc(u.phone)}')">📞</button> <button class="btn ghost sm" onclick="Bn.whatsapp('${phoneIntl(u.phone)}','')">💬</button></div>` : ''}</div>`).join('') || '<div class="empty">ضيف أسماء السكان من صفحة الشقق 🚪</div>'}
      </div>`);
  }
  function reqForm() {
    sheet('🙋 طلب انضمام', `
      <div class="field"><label>الاسم</label><input id="rName"></div>
      <div class="field"><label>الموبايل</label><input id="rPhone" type="tel"></div>
      <div class="grid2"><div class="field"><label>رقم الشقة</label><input id="rUnit"></div>
      <div class="field"><label>الصفة</label><select id="rRole"><option>مالك</option><option>مستأجر</option></select></div></div>
      <div class="field"><label>أو الصق رسالة الطلب من واتساب</label><textarea id="rPaste" rows="3" placeholder="الاسم: ...&#10;الشقة: ...&#10;الموبايل: ..." oninput="App.pasteReq()"></textarea></div>
      <button class="btn" onclick="App.saveReq()">💾 حفظ</button>`);
  }
  function pasteReq() {
    const t = L.normDigits(val('rPaste'));
    const g = re => ((t.match(re) || [])[1] || '').trim();
    const n = g(/الاسم\s*[:：]\s*(.+)/), u = g(/الشق[ةه]\s*[:：]\s*(\S+)/), p = g(/(?:الموبايل|التليفون|الهاتف)\s*[:：]\s*([\d+ ]+)/), r = g(/الصف[ةه]\s*[:：]\s*(\S+)/);
    if (n) $('rName').value = n; if (u) $('rUnit').value = u; if (p) $('rPhone').value = p.replace(/\s/g, ''); if (r && /مستأجر|ايجار|إيجار/.test(r)) $('rRole').value = 'مستأجر';
  }
  function saveReq() {
    if (!val('rName').trim()) return toast('✍️ اكتب الاسم');
    B().requests.push({ id: L.uid(), name: val('rName').trim(), phone: L.normDigits(val('rPhone')).trim(), unit: L.normDigits(val('rUnit')).trim(), role: val('rRole'), date: today(), status: 'pending' });
    save(); residents();
  }
  function accept(id) {
    const b = B(), r = b.requests.find(x => x.id === id); r.status = 'accepted';
    let u = b.units.find(x => String(x.num) === String(r.unit));
    if (!u) { u = { id: L.uid(), num: r.unit || String(b.units.length + 1), floor: '' }; b.units.push(u); }
    Object.assign(u, { name: r.name, phone: r.phone, role: r.role });
    save(); toast('✅ ' + r.name + ' انضم لشقة ' + u.num);
    if (r.phone) N.whatsapp(phoneIntl(r.phone), `أهلاً ${r.name} 🌷\nتم تسجيلك في ${b.name} — شقة ${u.num} ✅\nالشهرية: ${fmt(L.feeFor(b, u, L.ymOf(new Date())))} جنيه، تُسدد قبل يوم ${b.dueDay} من كل شهر.\nإدارة العمارة 🏢`);
    residents();
  }
  function reject(id) { const r = B().requests.find(x => x.id === id); r.status = 'rejected'; save(); residents(); }
  function inviteLink() {
    const b = B();
    N.share(`أهلاً بيك في ${b.name} 🏢🌷\nعشان نسجلك في نظام العمارة، ابعتلنا الرسالة دي بعد ما تملاها:\n\nالاسم: \nالشقة: \nالموبايل: \nالصفة: مالك / مستأجر`);
  }

  // ---------- 📞 contacts ----------
  function contacts() {
    const b = B();
    sheet('📞 أرقام وخدمات تهمك', `
      <div class="card">${b.contacts.map(c => `<div class="row"><div><b>${esc(c.name)}</b><div class="sub">${esc(c.cat || '')} • <span style="direction:ltr">${esc(c.phone)}</span></div></div>
        <div><button class="btn green sm" onclick="Bn.call('${esc(c.phone)}')">📞</button> <button class="btn ghost sm" onclick="App.delContact('${c.id}')">🗑️</button></div></div>`).join('') || '<div class="empty">لا يوجد</div>'}</div>
      <div class="card"><b>➕ إضافة رقم (سباك، كهربائي، بواب...)</b>
        <div class="field" style="margin-top:10px"><input id="cName" placeholder="الاسم"></div>
        <div class="grid2"><div class="field"><input id="cPhone" type="tel" placeholder="الرقم"></div>
        <div class="field"><select id="cCat">${['🔧 سباك', '⚡ كهربائي', '🛗 مصعد', '🧍 بواب', '🧹 نظافة', '🏪 خدمات', '📞 أخرى'].map(c => `<option>${c}</option>`).join('')}</select></div></div>
        <button class="btn" onclick="App.saveContact()">💾 حفظ</button></div>`);
  }
  function saveContact() {
    if (!val('cName').trim() || !val('cPhone').trim()) return toast('✍️ الاسم والرقم');
    B().contacts.push({ id: L.uid(), name: val('cName').trim(), phone: L.normDigits(val('cPhone')).trim(), cat: val('cCat') }); save(); contacts();
  }
  function delContact(id) { B().contacts = B().contacts.filter(c => c.id !== id); save(); contacts(); }

  // ---------- 🏘️ buildings ----------
  function pickBuilding() {
    sheet('🏘️ العمارات', `<div class="card">${S.buildings.map(b => `<div class="row"><button style="text-align:right;flex:1" onclick="App.switchB('${b.id}')">🏢 <b>${esc(b.name)}</b> ${b.id === S.current ? '<span class="tag ok">الحالية</span>' : ''}<div class="sub">${b.units.length} شقة</div></button>
      ${S.buildings.length > 1 ? `<button class="btn ghost sm" onclick="App.delB('${b.id}')">🗑️</button>` : ''}</div>`).join('')}</div>
      <div class="field"><input id="nbName" placeholder="اسم عمارة جديدة"></div><button class="btn" onclick="App.addB()">➕ إضافة عمارة</button>`);
  }
  function switchB(id) { S.current = id; save(); close(); toast('🏢 ' + B().name); }
  function addB() { const b = L.newBuilding(val('nbName').trim() || 'عمارة ' + (S.buildings.length + 1)); S.buildings.push(b); S.current = b.id; save(); close(); toast('✅ اتضافت'); }
  function delB(id) {
    pop(`<div class="big">⚠️</div><p><b>حذف العمارة وكل بياناتها؟</b></p><div class="grid2"><button class="btn red" onclick="App.doDelB('${id}')">حذف</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`);
  }
  function doDelB(id) { S.buildings = S.buildings.filter(b => b.id !== id); if (S.current === id) S.current = S.buildings[0].id; unpop(); save(); pickBuilding(); }
  function saveBuilding() {
    const b = B(); b.name = val('mName').trim() || b.name; b.address = val('mAddr').trim();
    b.dueDay = Math.min(28, Math.max(1, num('mDue') || 10)); b.opening = num('mOpen'); b.startMonth = val('mStart') || b.startMonth;
    save(); toast('✅ اتحفظت');
  }

  // ---------- 🔔 alerts ----------
  function openAlerts() {
    const al = L.alertsFor(B(), today());
    const upd = App._upd ? `<div class="row" onclick="App.showUpdate(true)"><span>🎁 تحديث جديد ${esc(App._upd.name)}</span><span class="tag ok">حدّث</span></div>` : '';
    sheet('🔔 التنبيهات', `<div class="card">${upd}${al.map(a => `<div class="row" ${a.go ? `onclick="App.alertGo('${a.go}')"` : ''}><span>${a.icon} ${esc(a.text)}</span>${a.go ? '<span class="muted">‹</span>' : ''}</div>`).join('') || (upd ? '' : '<div class="empty">🎉 كله تمام</div>')}</div>`);
  }
  function alertGo(g) { close(); ({ overdue: openOverdue, residents: () => App.residents(), notify: () => App.notify(), reports: () => go('reports') })[g](); }

  // ---------- 📊 export ----------
  function shareReport() { N.share(L.monthReport(B(), key())); }
  function exportCSV() { N.shareFile('bonian-' + B().name + '-' + today() + '.csv', L.toCSV(B()), 'text/csv'); }
  function backup() { N.shareFile('bonian-backup-' + today() + '.json', JSON.stringify(S, null, 1), 'application/json'); }
  function restore() { N.importBackup(); }
  function onImport(text) {
    try {
      const s = JSON.parse(text); if (!s || !Array.isArray(s.buildings)) throw 0;
      App._imp = s;
      pop(`<div class="big">📥</div><p><b>استرجاع النسخة؟</b><br><span class="muted">${s.buildings.length} عمارة. البيانات الحالية هتتبدل.</span></p><div class="grid2"><button class="btn" onclick="App.doImport()">استرجاع</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`);
    } catch (e) { toast('⚠️ الملف مش نسخة بُنيان'); }
  }
  function doImport() { S = L.migrate(App._imp); unpop(); save(); toast('✅ تم الاسترجاع'); }

  // ---------- 🎤 smart ----------
  let parsed = null;
  function listen() { $('micBtn').classList.add('listen'); try { N.listen(); } catch (e) { onSpeechErr(e.message); } }
  function onSpeech(text) { $('micBtn').classList.remove('listen'); $('smartTxt').value = text; parse(); }
  function onSpeechErr(msg) { $('micBtn').classList.remove('listen'); if (msg) toast('🎙️ ' + msg); }
  function ex(el) { $('smartTxt').value = el.textContent; parse(); }
  function parse() {
    const t = val('smartTxt').trim(), out = $('smartOut');
    if (!t) { out.innerHTML = ''; parsed = null; return; }
    parsed = L.parseSmart(t, B());
    const p = parsed;
    if (!p.type) { out.innerHTML = '<div class="muted">🤔 مش فاهم… قول مثلاً "حصلت 300 من شقة 5" أو "صرفت 200 كهرباء"</div>'; return; }
    if (p.type === 'payment') {
      out.innerHTML = `<div class="row"><span>النوع</span><b style="color:var(--green)">💰 تحصيل</b></div>
        <div class="row"><span>الشقة</span><b>${p.unit ? unitLabel(p.unit) : (p.unitNum ? `⚠️ شقة ${esc(p.unitNum)} مش موجودة` : '⚠️ قول رقم الشقة')}</b></div>
        <div class="row"><span>المبلغ</span><b>${p.amount ? fmt(p.amount) + ' جنيه' : '⚠️ قول المبلغ'}</b></div>
        ${p.ok ? '<button class="btn green" style="margin-top:10px" onclick="App.confirmSmart()">✅ تأكيد وحفظ</button>' : `<button class="btn ghost" style="margin-top:10px" onclick="App.payForm(${p.unit ? `'${p.unit.id}'` : 'null'},${p.amount || ''})">✏️ أكمل يدوي</button>`}`;
    } else {
      out.innerHTML = `<div class="row"><span>النوع</span><b style="color:var(--red)">🧾 مصروف</b></div>
        <div class="row"><span>البند</span><b>${esc(p.cat)}</b></div>
        <div class="row"><span>المبلغ</span><b>${p.amount ? fmt(p.amount) + ' جنيه' : '⚠️ قول المبلغ'}</b></div>
        ${p.ok ? '<button class="btn red" style="margin-top:10px" onclick="App.confirmSmart()">✅ تأكيد وحفظ</button>' : `<button class="btn ghost" style="margin-top:10px" onclick="App.expForm(${p.amount || ''},'${p.cat}')">✏️ أكمل يدوي</button>`}`;
    }
  }
  function confirmSmart() {
    const p = parsed; if (!p || !p.ok) return;
    const b = B();
    if (p.type === 'payment') {
      const pay = { id: L.uid(), unitId: p.unit.id, amount: p.amount, date: today(), note: '🎤 ' + p.note };
      b.payments.push(pay); save(); toast(`✅ ${fmt(p.amount)} من شقة ${p.unit.num}`);
      if (p.unit.phone) pop(`<div class="big">🧾</div><p>تبعت إيصال واتساب لشقة ${esc(p.unit.num)}؟</p><div class="grid2"><button class="btn" onclick="App.unpop();Bn.whatsapp('${phoneIntl(p.unit.phone)}',App._rc)">ابعت</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`), App._rc = L.receiptText(b, p.unit, pay);
    } else { b.expenses.push({ id: L.uid(), amount: p.amount, date: today(), cat: p.cat, note: '🎤 ' + p.note }); save(); toast(`✅ مصروف ${fmt(p.amount)} — ${p.cat}`); }
    $('smartTxt').value = ''; parse();
  }

  // ---------- 🎁 updates ----------
  function pref(k, v) { N.setPref(k, String(v)); }
  function setDark(on) { pref('dark', on); document.documentElement.dataset.theme = on ? 'dark' : 'light'; try { N.theme(on); } catch (e) {} }
  function checkNow() { App._manual = true; toast('🔍 بندوّر…'); N.checkUpdate(); }
  function onUpdate(json) {
    let u = null; try { u = json ? JSON.parse(json) : null; } catch (e) {}
    App._upd = u && u.code > Number(N.versionCode()) ? u : null;
    render();
    if (App._upd) {
      const seen = String(N.getPref('seen', ''));
      if (App._manual || seen !== String(App._upd.code)) showUpdate(false);
    } else if (App._manual) toast('✅ عندك أحدث نسخة ' + N.version());
    App._manual = false;
  }
  function showUpdate() {
    const u = App._upd; if (!u) return;
    N.setPref('seen', String(u.code)); close();
    pop(`<div class="big">🎁</div><h3 style="margin:6px 0">تحديث جديد!</h3><p class="muted" dir="ltr">${esc(N.version())} → <b>${esc(u.name.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1'))}</b></p>
      ${u.notes ? `<p style="font-size:14px;text-align:right;white-space:pre-line;max-height:140px;overflow:auto">${esc(u.notes.slice(0, 400))}</p>` : ''}
      <div class="prog" id="uProg" hidden><i></i></div>
      <div class="grid2" id="uBtns"><button class="btn" onclick="App.doUpdate()">⬇️ حدّث الآن</button><button class="btn ghost" onclick="App.unpop()">بعدين</button></div>`);
  }
  function doUpdate() { $('uProg').hidden = false; $('uBtns').innerHTML = '<span class="muted">⏳ بينزّل…</span>'; N.installUpdate(App._upd.url); }
  function onProgress(p) { const i = document.querySelector('#uProg i'); if (i) i.style.width = Math.round(p * 100) + '%'; }
  function onInstallMsg(m) { toast(m); if (/فشل|⚠️/.test(m)) unpop(); }

  // ---------- 🔐 admin password ----------
  const ADMIN_MIN = 5;                       // auto-lock after 5 minutes without touches
  let unlockedUntil = 0, fails = 0, blockedUntil = 0;
  const hasPw = () => !!String(N.getPref('pw', '') || '');
  const isAdmin = () => !hasPw() || Date.now() < unlockedUntil;
  function hashPw(p) {
    const s = 'bonian|' + L.normDigits(p).trim();
    try { if (N.hash) return N.hash(s); } catch (e) {}
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;                     // browser preview only
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16));
  }
  function touch() { if (hasPw() && Date.now() < unlockedUntil) unlockedUntil = Date.now() + ADMIN_MIN * 60000; }
  function lock(manual) {
    if (!hasPw() || !unlockedUntil) return;
    unlockedUntil = 0; close(); unpop(); render(); if (manual) toast('🔒 اتقفل وضع الإدارة');
  }
  /** run fn only for the admin; asks for the password when locked */
  function guard(fn, args) {
    if (isAdmin()) { touch(); return fn.apply(null, args); }
    App._after = () => fn.apply(null, args);
    askPw();
  }
  function askPw(msg) {
    const hint = String(N.getPref('pwHint', '') || '');
    pop(`<div class="big">🔐</div><h3 style="margin:4px 0 8px">وضع الإدارة</h3><p class="muted" style="margin:0 0 12px">${msg || 'اكتب كلمة السر عشان تعدّل'}</p>
      <div class="field"><input id="pwIn" type="password" autocomplete="off" style="text-align:center;font-size:20px;letter-spacing:4px" onkeydown="if(event.key==='Enter')App.tryPw()"></div>
      <div class="grid2"><button class="btn" onclick="App.tryPw()">🔓 دخول</button><button class="btn ghost" onclick="App._after=null;App.unpop();App.render()">إلغاء</button></div>
      ${hint ? `<button class="muted" style="margin-top:12px;font-size:14px" onclick="App.toast('💡 ' + ${esc(JSON.stringify(hint))})">نسيت؟ 💡 التلميح</button>` : ''}`);
    setTimeout(() => { const i = $('pwIn'); if (i) i.focus(); }, 150);
  }
  function tryPw() {
    if (Date.now() < blockedUntil) return toast('⏳ استنى ' + Math.ceil((blockedUntil - Date.now()) / 1000) + ' ثانية');
    if (hashPw(val('pwIn') || '') !== String(N.getPref('pw', ''))) {
      fails++; if (fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; }
      $('pwIn').value = ''; return toast('❌ كلمة السر غلط');
    }
    fails = 0; unlockedUntil = Date.now() + ADMIN_MIN * 60000; unpop(); render();
    const f = App._after; App._after = null; if (f) f(); else toast('🔓 أهلاً يا أدمن');
  }
  function toggleLock() { if (!hasPw()) return App.pwForm(); if (isAdmin()) lock(true); else { App._after = null; askPw(); } }
  function pwForm() {
    sheet('🔐 كلمة سر الإدارة', `
      <p class="muted" style="font-size:14px;margin-top:0">الكل يقدر يشوف الأرقام والتقارير، لكن التسجيل والتعديل والإعدادات بكلمة السر بس.</p>
      <div class="field"><label>كلمة السر الجديدة (4 حروف/أرقام على الأقل)</label><input id="pw1" type="password" autocomplete="new-password"></div>
      <div class="field"><label>تأكيد كلمة السر</label><input id="pw2" type="password" autocomplete="new-password"></div>
      <div class="field"><label>تلميح يفكرك بيها (اختياري — متكتبش كلمة السر نفسها)</label><input id="pwH" value="${esc(N.getPref('pwHint', '') || '')}"></div>
      <button class="btn" onclick="App.savePw()">💾 حفظ</button>
      ${hasPw() ? '<button class="btn ghost" style="margin-top:10px;color:var(--red)" onclick="App.removePw()">🗑️ إلغاء كلمة السر</button>' : ''}
      <p class="muted" style="font-size:13px">⚠️ لو نسيتها ومفيش تلميح، مش هتقدر تعدّل. احفظها في مكان آمن.</p>`);
  }
  function savePw() {
    const a = L.normDigits(val('pw1') || '').trim(), c = L.normDigits(val('pw2') || '').trim();
    if (a.length < 4) return toast('✍️ 4 حروف/أرقام على الأقل');
    if (a !== c) return toast('❌ التأكيد مش زي كلمة السر');
    const h = val('pwH').trim(); if (h && h === a) return toast('⚠️ التلميح ميبقاش هو كلمة السر');
    N.setPref('pw', hashPw(a)); N.setPref('pwHint', h);
    unlockedUntil = Date.now() + ADMIN_MIN * 60000; close(); render(); toast('🔐 كلمة السر اتفعّلت');
  }
  function removePw() {
    pop(`<div class="big">⚠️</div><p><b>تلغي كلمة السر؟</b><br><span class="muted">أي حد هيقدر يعدّل.</span></p><div class="grid2"><button class="btn red" onclick="App.doRemovePw()">إلغاء</button><button class="btn ghost" onclick="App.unpop()">لا</button></div>`);
  }
  function doRemovePw() { N.setPref('pw', ''); N.setPref('pwHint', ''); unlockedUntil = 0; unpop(); close(); render(); toast('🔓 كلمة السر اتلغت'); }
  document.addEventListener('click', touch, true);

  window.App = {
    go, setMode, shift, close, unpop, payForm, payHint, savePay, expForm, pickCat, saveExp, delTx, doDel, openList,
    feeForm, saveFee, units, bulkUnits, doBulk, unitForm, saveUnit, delUnit, doDelUnit, statement, statements,
    openOverdue, remind, remindAll, nextRemind, notify, sendNotice, sendEach, residents, reqForm, pasteReq, saveReq, accept, reject, inviteLink,
    contacts, saveContact, delContact, pickBuilding, switchB, addB, delB, doDelB, saveBuilding, openAlerts, alertGo,
    shareReport, exportCSV, backup, restore, onImport, doImport, listen, onSpeech, onSpeechErr, ex, parse, confirmSmart,
    pref, setDark, checkNow, onUpdate, showUpdate, doUpdate, onProgress, onInstallMsg,
    toast, render, lock, tryPw, toggleLock, pwForm, savePw, removePw, doRemovePw, isAdmin,
    back() { if ($('popBg').classList.contains('show')) { unpop(); return true; } if ($('sheetBg').classList.contains('show')) { close(); return true; }
      if (!$('v-home').classList.contains('on')) { go('home'); return true; } return false; }
  };
  if (!window.Bn) window.Bn = N;
  // 🔐 everything that changes data or opens admin screens needs the password (when one is set)
  ['payForm', 'expForm', 'delTx', 'feeForm', 'units', 'bulkUnits', 'unitForm', 'residents', 'notify', 'remind', 'remindAll',
   'pickBuilding', 'saveBuilding', 'backup', 'restore', 'saveContact', 'delContact', 'confirmSmart', 'pref', 'pwForm', 'removePw']
    .forEach(k => { const f = App[k]; App[k] = (...a) => guard(f, a); });

  // ---------- start ----------
  if (String(N.getPref('dark', 'false')) === 'true') setDark(true); else document.documentElement.dataset.theme = 'light';
  load(); render();
  if (!B().units.length) setTimeout(() => pop(`<div class="big">🏢</div><h3 style="margin:6px 0">أهلاً في بُنيان 👋</h3><p class="muted">إدارة حسابات العمارة: الشهرية، المصروفات، المتأخرات والتقارير.</p>
    <div class="field"><input id="wName" placeholder="اسم العمارة" value="${esc(B().name)}"></div>
    <div class="grid2"><div class="field"><input id="wFee" type="number" placeholder="الشهرية" value="${L.buildingFee(B(), L.ymOf(new Date()))}"></div><div class="field"><input id="wUnits" type="number" placeholder="عدد الشقق" value="10"></div></div>
    <button class="btn" onclick="App._welcome()">🚀 يلا نبدأ</button>`), 300);
  App._welcome = () => {
    const b = B(); b.name = val('wName').trim() || b.name; b.fees = [{ from: b.startMonth, amount: num('wFee') }];
    const n = Math.min(300, num('wUnits'));
    for (let i = 1; i <= n; i++) b.units.push({ id: L.uid(), num: String(i), floor: String(Math.ceil(i / 2)), name: '', phone: '', role: 'مالك' });
    unpop(); save(); toast('✅ جاهز! ضيف أسماء السكان من 🚪 الشقق');
  };
  setTimeout(() => { try { N.checkUpdate(); } catch (e) {} }, 1200);
  setInterval(() => { if (L.todayStr() !== render._d) { render._d = L.todayStr(); render(); } }, 60000);
})();
