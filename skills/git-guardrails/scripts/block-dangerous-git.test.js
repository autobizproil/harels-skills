// node block-dangerous-git.test.js
const assert = require('assert');
const { check } = require('./block-dangerous-git');

const blocked = [
  'git push', 'git push origin main', 'git push --force', 'cd x && git push',
  'git -C /tmp/r push', 'echo hi; git push -f', 'git reset --hard HEAD~1', 'git reset HEAD --hard',
  'git clean -fd', 'git clean -f', 'git clean -xfd', 'git clean --force', 'git branch -D feature',
  'git checkout .', 'git checkout -- .', 'git restore .', 'sudo git push',
];
const allowed = [
  'git status', 'git log --oneline', 'git diff', 'git commit -m "push the button"', 'git pull',
  'git reset HEAD file.txt', 'git branch -d merged', 'git checkout main', 'git checkout -b new',
  'git restore file.txt', 'git clean -n', 'echo "git push"', 'npm run push', 'git stash',
];
for (const c of blocked) assert.ok(check(c), 'should block: ' + c);
for (const c of allowed) assert.strictEqual(check(c), null, 'should allow: ' + c);
console.log('ok', blocked.length + allowed.length);
