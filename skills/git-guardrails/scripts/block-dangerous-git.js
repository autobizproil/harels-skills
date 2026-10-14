#!/usr/bin/env node
// PreToolUse hook (matcher: Bash). קורא JSON מ-stdin וחוסם פקודות git הרסניות.
// יציאה 2 + הודעה ב-stderr = Claude Code חוסם את הפקודה ומראה ל-Claude את ההודעה.
'use strict';

// "git" כפקודה (בתחילת הפקודה או אחרי ; & | ( ) ואחרי אפשרויות גלובליות כמו -C path)
const G = String.raw`(?:^|[;&|(\n]\s*)(?:sudo\s+)?git(?:\s+-[cC]\s+\S+|\s+--\S+)*\s+`;
const RULES = [
  [new RegExp(G + String.raw`push\b`), 'git push'],
  [new RegExp(G + String.raw`reset\b[^;&|\n]*--hard\b`), 'git reset --hard'],
  [new RegExp(G + String.raw`clean\b[^;&|\n]*\s-[a-zA-Z]*f`), 'git clean -f'],
  [new RegExp(G + String.raw`clean\b[^;&|\n]*--force\b`), 'git clean --force'],
  [new RegExp(G + String.raw`branch\b[^;&|\n]*\s-D\b`), 'git branch -D'],
  [new RegExp(G + String.raw`checkout\s+(?:--\s+)?\.(?:\s|$)`), 'git checkout .'],
  [new RegExp(G + String.raw`restore\s+(?:--\S+\s+)*\.(?:\s|$)`), 'git restore .'],
];

function check(command) {
  for (const [re, name] of RULES) if (re.test(command)) return name;
  return null;
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    let command = '';
    try { command = (JSON.parse(raw).tool_input || {}).command || ''; } catch (e) { process.exit(0); }
    const hit = check(command);
    if (hit) {
      console.error('נחסם: ' + hit + '. אין לך הרשאה להריץ את הפקודה הזאת. תסביר למשתמש מה רצית לעשות ותבקש ממנו להריץ בעצמו.');
      process.exit(2);
    }
    process.exit(0);
  });
}

module.exports = { check };
