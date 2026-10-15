// Output-token eval: plain vs "ענה בקצרה" control vs kitzur vs ultrakitzur, on 10 Hebrew prompts.
// Runs in an isolated CLAUDE_CONFIG_DIR (no user hooks / CLAUDE.md / skills) so the baseline is not already terse.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const here = __dirname;
const cfg = path.join(here, 'cfg');
const skills = 'D:/harels-skills/skills';
const body = (name) => fs.readFileSync(path.join(skills, name, 'SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\s*/, '');

const sys = {
  plain: null,
  control: 'ענה בקצרה.',
  kitzur: 'מצב קיצור פעיל — mode: kitzur\n\n' + body('kitzur'),
  ultrakitzur: 'מצב קיצור פעיל — mode: ultrakitzur\n\n' + body('ultrakitzur'),
};
for (const [k, v] of Object.entries(sys)) if (v) fs.writeFileSync(path.join(here, k + '.txt'), v);

const prompts = [
  'מה ההבדל בין git merge ל-git rebase, ומתי כדאי להשתמש בכל אחד?',
  'למה קומפוננטת React שלי מתרנדרת מחדש בכל פעם שה-parent משתנה, גם כשה-props לא השתנו?',
  'איך אני כותב שאילתת SQL שמחזירה את 3 הלקוחות עם הסכום הגבוה ביותר בחודש האחרון?',
  'קיבלתי שגיאה "Cannot read properties of undefined (reading map)" בקוד JavaScript. מה זה אומר ואיך מתקנים?',
  'כתוב לי מייל קצר ללקוח שמבקש הנחה על הצעת מחיר של 12,000 שקל.',
  'מה היתרונות והחסרונות של לעבוד עם פרילנסרים לעומת להעסיק עובד קבוע בעסק קטן?',
  'איך מגדירים cron job בלינוקס שרץ כל יום ב-3 בלילה ושומר גיבוי של תיקייה?',
  'הסבר לי מה זה אינדקס במסד נתונים ולמה הוא מאיץ שאילתות.',
  'האתר שלי נטען לאט בנייד. מה הדברים הראשונים שכדאי לבדוק?',
  'מה ההבדל בין עוסק פטור לעוסק מורשה בישראל, ומתי כדאי לעבור?',
];

function run(cond, i) {
  return new Promise((resolve) => {
    const args = ['-p', prompts[i], '--model', 'sonnet', '--tools', '', '--output-format', 'json', '--no-session-persistence'];
    if (sys[cond]) args.push('--append-system-prompt-file', path.join(here, cond + '.txt'));
    const p = spawn('C:/Users/test0/.local/bin/claude.exe', args, { env: { ...process.env, CLAUDE_CONFIG_DIR: cfg }, cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      try {
        const j = JSON.parse(out);
        resolve({ cond, i, out: j.usage.output_tokens, cost: j.total_cost_usd, result: j.result, stop: j.terminal_reason });
      } catch (e) {
        resolve({ cond, i, error: (out + err).slice(0, 300) });
      }
    });
  });
}

(async () => {
  const jobs = [];
  for (let i = 0; i < prompts.length; i++) for (const c of Object.keys(sys)) jobs.push([c, i]);
  const results = [];
  const limit = 4;
  let idx = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (idx < jobs.length) {
      const [c, i] = jobs[idx++];
      const r = await run(c, i);
      results.push(r);
      console.log(c, i, r.out ?? 'ERR', r.error ? r.error.slice(0, 100) : '');
    }
  }));
  fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(results, null, 1));
  const med = (a) => { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const by = {};
  for (const r of results) if (r.out != null) (by[r.cond] ||= {})[r.i] = r.out;
  for (const c of Object.keys(sys)) {
    const v = Object.values(by[c] || {});
    console.log(c, 'n=' + v.length, 'median=' + med(v), 'sum=' + v.reduce((a, b) => a + b, 0), 'cost=$' + results.filter(r => r.cond === c).reduce((a, r) => a + (r.cost || 0), 0).toFixed(2));
  }
})();
