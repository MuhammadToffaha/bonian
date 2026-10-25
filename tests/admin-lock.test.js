// 🔐 Admin password UI test (headless Chromium): npm i playwright && npx playwright install chromium && node tests/admin-lock.test.js
const { chromium } = require('playwright');
const fs = require('fs');
const ok = (c, m) => { if (!c) { console.log('❌', m); process.exitCode = 1; } else console.log('✅', m); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '../app/src/main/assets/www/index.html'));
  await p.waitForTimeout(500);
  await p.click('text=يلا نبدأ');
  const sheetOpen = () => p.evaluate(() => document.getElementById('sheetBg').classList.contains('show'));
  const popOpen = () => p.evaluate(() => document.getElementById('popBg').classList.contains('show'));
  const pays = () => p.evaluate(() => JSON.parse(localStorage.bonian).buildings[0].payments.length);

  // no password: open
  await p.evaluate(() => App.payForm()); ok(await sheetOpen(), 'no password → payment form opens');
  await p.evaluate(() => App.close());
  // set password
  await p.evaluate(() => App.pwForm());
  await p.fill('#pw1', '١٢٣٤'); await p.fill('#pw2', '1234'); await p.fill('#pwH', 'سنة الميلاد');
  await p.click('#sheet >> text=💾 حفظ');
  ok(await p.evaluate(() => localStorage.p_pw && localStorage.p_pw !== '1234'), 'only hash stored');
  ok(await p.evaluate(() => App.isAdmin()), 'still admin right after setting');
  await p.evaluate(() => App.lock(true));
  ok(!(await p.evaluate(() => App.isAdmin())), 'locked');
  ok((await p.textContent('#lockBtn')) === '🔒', 'lock icon shows 🔒');
  ok((await p.textContent('#mBody')).includes('مقفولة'), 'More tab hides admin settings');
  // blocked actions
  for (const f of ['payForm', 'expForm', 'units', 'feeForm', 'residents', 'notify', 'backup', 'pickBuilding']) {
    await p.evaluate(f => App[f](), f);
    ok(!(await sheetOpen()) && await popOpen(), `${f} asks password`);
    await p.evaluate(() => { App._after = null; App.unpop(); });
  }
  // alert shortcut can't bypass
  await p.evaluate(() => App.alertGo('residents')); ok(await popOpen() && !(await sheetOpen()), 'bell shortcut also asks');
  await p.evaluate(() => App.unpop());
  // smart confirm blocked
  await p.evaluate(() => App.go('smart')); await p.fill('#smartTxt', 'حصلت 300 من شقة 3'); await p.dispatchEvent('#smartTxt', 'input');
  await p.click('text=تأكيد وحفظ'); ok(await popOpen() && (await pays()) === 0, 'smart save asks, nothing saved');
  // wrong then right
  await p.fill('#pwIn', '9999'); await p.click('text=🔓 دخول'); ok(await popOpen() && (await pays()) === 0, 'wrong password rejected');
  await p.fill('#pwIn', '1234'); await p.click('text=🔓 دخول'); await p.waitForTimeout(100);
  ok((await pays()) === 1, 'right password → pending action runs');
  ok(await p.evaluate(() => App.isAdmin()), 'unlocked');
  await p.evaluate(() => App.payForm()); ok(await sheetOpen(), 'unlocked → forms open directly');
  await p.evaluate(() => App.close());
  // remove password
  await p.evaluate(() => App.removePw()); await p.click('text=إلغاء >> nth=0').catch(() => {});
  await p.evaluate(() => App.doRemovePw());
  await p.evaluate(() => App.lock(true)); await p.evaluate(() => App.units()); ok(await sheetOpen(), 'password removed → open again');
  if (errs.length) process.exitCode = 1; console.log(errs.length ? 'JS ERRORS: ' + errs.join(' | ') : 'no JS errors');
  await b.close();
})();
