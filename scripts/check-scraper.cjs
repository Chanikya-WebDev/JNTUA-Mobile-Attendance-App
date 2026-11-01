const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual injected scripts in Chrome's HTML parser, including malformed
// table forms. No portal credentials or network requests are used.
const compiled = ts.transpileModule(readFileSync(path.resolve('utils/automationScripts.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { exports: {} };
// Hermes does not return JS source for functions. Ensure injection still works
// when source serialization is unavailable in the app's runtime.
vm.runInNewContext("Function.prototype.toString = function() { return 'function () { [native code] }'; };", sandbox);
vm.runInNewContext(compiled, sandbox);
const scripts = sandbox.exports;
for (const [page, stage] of [
  ['studenthome.php', 'home'], ['studentsubjects.php', 'subjects'],
  ['studentsubatt.php', 'attendance'], ['studentcourseatt.php', 'attendance'], ['index.php', null],
  ['studentsubjectatt.php', 'attendance'],
]) {
  const messages = [];
  const context = {
    window: { location: { pathname: '/' + page }, ReactNativeWebView: { postMessage: data => messages.push(JSON.parse(data)) } },
    setInterval: () => 1,
  };
  vm.runInNewContext(scripts.getPortalPageScript(0), context);
  vm.runInNewContext(scripts.getPortalPageScript(0), context);
  assert.deepEqual(messages, stage ? [{ type: 'SCRAPING_STARTED', stage }] : []);
}
const profile = mkdtempSync(path.join(tmpdir(), 'attendance-scraper-'));
const browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });

async function main() {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
    browser.once('error', reject);
    browser.stderr.on('data', data => {
      output += data.toString();
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    const handler = pending.get(result.id);
    if (handler) {
      pending.delete(result.id);
      if (result.error) handler.reject(new Error(result.error.message));
      else handler.resolve(result.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chrome command timed out: ${method}`)), 10000);
    pending.set(++id, {
      resolve: result => { clearTimeout(timeout); resolve(result); },
      reject: error => { clearTimeout(timeout); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, timeout: 3000 }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const run = async (html, script, repeat = false) => {
      await evaluate(`document.open(); document.write(${JSON.stringify('<base href="https://portal.test/">' + html)}); document.close();
        delete window.attendanceScraperStarted;
        window.messages = []; window.submissions = []; window.intervals = new Map(); window.timerId = 0;
        window.ReactNativeWebView = { postMessage: data => messages.push(JSON.parse(data)) };
        window.setInterval = callback => { intervals.set(++timerId, callback); return timerId; };
        window.clearInterval = id => intervals.delete(id);
        window.setTimeout = () => 0;
        HTMLFormElement.prototype.submit = function() {
          submissions.push({ action: this.action, target: this.target, data: Object.fromEntries(new FormData(this)) });
        };
        document.addEventListener('click', event => event.preventDefault(), { once: true });`);
      await evaluate(script);
      if (repeat) await evaluate(script);
      const result = await evaluate(`for (let i = 0; i < 50 && intervals.size; i++) {
        for (const callback of Array.from(intervals.values())) callback();
      }
      ({ messages, submissions })`);
      assert.equal(result.messages.filter(message => message.type === 'SCRAPING_STARTED').length, 1);
      result.messages = result.messages.filter(message => message.type !== 'SCRAPING_STARTED' && message.type !== 'SCRAPING_DIAGNOSTIC');
      return result;
    };

    const home = await run(`<ul><li class="list-group-item"><strong>Username:</strong> <span>12345</span></li>
      <li class="list-group-item"><strong>Name:</strong> <span>Test Student</span></li></ul>
      <form action="./studentsubjects.php?semester=1"><input name="classname" value="CSE II"></form>`, scripts.autoSubmitFirstSemesterScript, true);
    assert.deepEqual(home.messages, [{ type: 'STUDENT_INFO', data: { name: 'Test Student', admissionNo: '12345', className: 'CSE II' } }]);
    assert.equal(home.submissions.length, 1);

    for (const markup of [
      '<li class="list-group-item"><strong>Name:</strong><span>Test Student</span></li>',
      '<li class="list-group-item"><strong>Name</strong><span>Test Student</span></li>',
      '<li class="list-group-item">Student Name：Test Student</li>',
      '<li class="list-group-item">Full Name:<span>Test Student</span></li>',
      '<li class="list-group-item"><strong>Name:</strong><br>Test Student</li>',
      '<table><tr><th>Name</th><td>Test Student</td></tr></table>',
    ]) {
      const result = await run(`${markup}<li class="list-group-item">Username:12345</li>
        <form action="studentsubjects.php"><input name="classname" value="CSE II"></form>`, scripts.autoSubmitFirstSemesterScript);
      assert.deepEqual(result.messages[0].data, { name: 'Test Student', admissionNo: '12345', className: 'CSE II' });
    }
    const homeLink = await run('<a href="./studentsubjects.php?semester=1">View subjects</a>', scripts.autoSubmitFirstSemesterScript);
    assert.equal(homeLink.messages[0].type, 'STUDENT_INFO');

    const subjects = await run(`<table><tr onclick="document.getElementById('subject1').submit()">
      <td>Maths<form id="subject1" target="_blank" action="/studentcourseatt.php"></form>
      <input type="hidden" name="subject" value="M101"><input type="hidden" name="classname" value="CSE II"></td></tr>
      <tr><td><form action="studentsubatt.php"><input name="subject" value="P102"></form></td></tr></table>`, scripts.selectSubjectByIndexScript(0), true);
    assert.deepEqual(subjects.messages, [{ type: 'SUBJECT_COUNT', count: 2 }]);
    assert.deepEqual(subjects.submissions[0].data, { subject: 'M101', classname: 'CSE II' });
    assert.equal(subjects.submissions[0].target, '');

    const currentPortalFields = {
      _csrf: 'fixture-token', subject_id: '1', subcode: 'M101', sub_fullname: 'Mathematics',
      student_id: 'fixture-student', class_id: '2', classname: 'CSE II', acad_year: '2026',
    };
    const currentPortal = await run(`<table><tr><td><form action="./studentsubjectatt.php" method="post">${
      Object.entries(currentPortalFields).map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`).join('')
    }</form></td></tr></table>`, scripts.selectSubjectByIndexScript(0));
    assert.deepEqual(currentPortal.messages, [{ type: 'SUBJECT_COUNT', count: 1 }]);
    assert.equal(currentPortal.submissions[0].action, 'https://portal.test/studentsubjectatt.php');
    assert.deepEqual(currentPortal.submissions[0].data, currentPortalFields);

    const currentLink = await run('<table><tr><td><a href="studentsubjectatt.php?id=1">Maths</a></td></tr></table>', scripts.selectSubjectByIndexScript(0));
    assert.deepEqual(currentLink.messages, [{ type: 'SUBJECT_COUNT', count: 1 }]);

    const links = await run('<table><tr><td><a href="studentcourseatt.php?id=1">Maths</a></td></tr></table>', scripts.selectSubjectByIndexScript(0));
    assert.deepEqual(links.messages, [{ type: 'SUBJECT_COUNT', count: 1 }]);
    const done = await run('<table><tr class="clickable-row"><td>Maths</td></tr></table>', scripts.selectSubjectByIndexScript(1));
    assert.equal(done.messages[1].type, 'SCRAPING_COMPLETE');

    for (const extraColumn of [false, true]) {
      const result = await run(`<div class="card-header">CSE II</div><div class="card-header">M101<br>Mathematics</div>
        <table><tr>${extraColumn ? '<th>S.No</th>' : ''}<th>Date</th><th>Time</th><th>Attendance</th></tr>
        <tr>${extraColumn ? '<td>1</td>' : ''}<td>24-10-2026</td><td>09:00</td><td>${extraColumn ? 'P' : '<span class="badge">Present</span>'}</td></tr>
        <tr>${extraColumn ? '<td>2</td>' : ''}<td>25-10-2026</td><td>10:00</td><td>Absent</td></tr></table>`, scripts.parseDetailedAttendanceAndGoHomeScript(2), true);
      assert.equal(result.messages.length, 1);
      assert.equal(result.messages[0].index, 2);
      assert.equal(result.messages[0].data.subjectName, 'Mathematics');
      assert.equal(result.messages[0].data.total, 2);
      assert.equal(result.messages[0].data.percentage, '50.00');
    }

    const empty = await run('<table><tr><th>Date</th><th>Status</th></tr><tr><td colspan="2">No records found</td></tr></table>', scripts.parseDetailedAttendanceAndGoHomeScript(0));
    assert.equal(empty.messages[0].data.total, 0);
    const unknown = await run('<table><tr><th>Date</th><th>Status</th></tr><tr><td>24-10-2026</td><td>Changed value</td></tr></table>', scripts.parseDetailedAttendanceAndGoHomeScript(0));
    assert.equal(unknown.messages[0].type, 'SCRAPING_ERROR');
    for (const script of [scripts.autoSubmitFirstSemesterScript, scripts.selectSubjectByIndexScript(0), scripts.parseDetailedAttendanceAndGoHomeScript(0)]) {
      const missing = await run('<p>Unexpected portal structure</p>', script);
      assert.equal(missing.messages.length, 1);
      assert.equal(missing.messages[0].type, 'SCRAPING_ERROR');
    }
    console.log('Passed: studentsubjectatt.php routing, current portal form fields, semester form, malformed subject forms, links, completion, 3/4-column attendance, empty records, unknown status, duplicate injection, and timeout errors.');
  } finally {
    socket.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser.exitCode === null) {
    browser.kill();
    await new Promise(resolve => browser.once('exit', resolve));
  }
  // Only this test's unique temporary browser profile is removed.
  assert.equal(path.dirname(profile), path.resolve(tmpdir()));
  assert.ok(path.basename(profile).startsWith('attendance-scraper-'));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
