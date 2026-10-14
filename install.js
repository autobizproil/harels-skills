#!/usr/bin/env node
// התקנת קיצור (Kitzur) ל-Claude Code בלי plugin: מעתיק hooks וסקילים, ומוסיף רישום ל-settings.json.
// שימוש: node install.js [--dry-run] [--uninstall] [--no-statusline]
// בטוח להרצה חוזרת. לפני כל שינוי ב-settings.json נשמר גיבוי settings.json.kitzur-backup.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = new Set(process.argv.slice(2));
const dry = args.has('--dry-run');
const uninstall = args.has('--uninstall');
const cfgDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const hooksDir = path.join(cfgDir, 'hooks');
const skillsDir = path.join(cfgDir, 'skills');
const settingsPath = path.join(cfgDir, 'settings.json');
const srcHooks = path.join(__dirname, 'src', 'hooks');
const srcSkills = path.join(__dirname, 'skills');
const node = process.execPath;

const HOOK_FILES = fs.readdirSync(srcHooks).filter((f) => /^kitzur-.*\.(js|sh|ps1)$/.test(f));
const SKILLS = fs.readdirSync(srcSkills).filter((d) => fs.statSync(path.join(srcSkills, d)).isDirectory());
const EVENTS = [
  ['SessionStart', 'kitzur-activate.js', '', 30, 'טוען מצב קיצור...'],
  ['SubagentStart', 'kitzur-activate.js', ' --subagent', 30, 'טוען מצב קיצור לסוכן משנה...'],
  ['UserPromptSubmit', 'kitzur-mode-tracker.js', '', 30, 'מעקב מצב קיצור...'],
  ['SessionEnd', 'kitzur-stats.js', ' --record', 5, 'רישום סטטיסטיקות קיצור...'],
];

function log(msg) { console.log((dry ? '[dry-run] ' : '') + msg); }
function isOurs(h) { return h && typeof h.command === 'string' && /kitzur-(activate|mode-tracker|stats|statusline)/.test(h.command); }

function readSettings() {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, 'utf8');
  try { return JSON.parse(raw); } catch (e) {
    console.error('settings.json אינו JSON תקין (' + e.message + '). לא נוגע בו. תקן ידנית והרץ שוב.');
    process.exit(1);
  }
}

function writeSettings(s) {
  if (dry) return;
  if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, settingsPath + '.kitzur-backup');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
}

function stripOurs(settings) {
  for (const ev of Object.keys(settings.hooks || {})) {
    settings.hooks[ev] = settings.hooks[ev]
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    if (!settings.hooks[ev].length) delete settings.hooks[ev];
  }
  if (settings.statusLine && isOurs(settings.statusLine)) delete settings.statusLine;
}

const settings = readSettings();
stripOurs(settings); // idempotent: always rebuild our entries from scratch

if (uninstall) {
  for (const f of HOOK_FILES) { log('מסיר ' + path.join(hooksDir, f)); if (!dry) fs.rmSync(path.join(hooksDir, f), { force: true }); }
  for (const s of SKILLS) { log('מסיר ' + path.join(skillsDir, s)); if (!dry) fs.rmSync(path.join(skillsDir, s), { recursive: true, force: true }); }
  writeSettings(settings);
  log('הוסר. פתח סשן חדש.');
  process.exit(0);
}

for (const f of HOOK_FILES) {
  log('מעתיק ' + f + ' → ' + hooksDir);
  if (!dry) { fs.mkdirSync(hooksDir, { recursive: true }); fs.copyFileSync(path.join(srcHooks, f), path.join(hooksDir, f)); }
}
for (const s of SKILLS) {
  log('מעתיק סקיל ' + s + ' → ' + skillsDir);
  if (!dry) fs.cpSync(path.join(srcSkills, s), path.join(skillsDir, s), { recursive: true });
}

settings.hooks = settings.hooks || {};
for (const [ev, file, extra, timeout, msg] of EVENTS) {
  settings.hooks[ev] = settings.hooks[ev] || [];
  settings.hooks[ev].push({
    hooks: [{ type: 'command', command: '"' + node + '" "' + path.join(hooksDir, file) + '"' + extra, timeout, statusMessage: msg }],
  });
  log('רושם hook: ' + ev);
}

if (!args.has('--no-statusline')) {
  if (settings.statusLine) {
    log('statusLine כבר מוגדר אצלך, לא משנה. תג המצב לא יוצג (אפשר להוסיף ידנית מ-kitzur-statusline).');
  } else {
    const win = process.platform === 'win32';
    const script = path.join(hooksDir, win ? 'kitzur-statusline.ps1' : 'kitzur-statusline.sh');
    settings.statusLine = {
      type: 'command',
      command: win ? 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + script + '"' : 'bash "' + script + '"',
    };
    log('מגדיר statusLine (תג מצב)');
  }
}

writeSettings(settings);
log('הותקן. פתח סשן חדש של Claude Code. בדיקה: כתוב "מצב קצר".');
