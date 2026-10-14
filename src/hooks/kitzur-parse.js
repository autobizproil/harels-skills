#!/usr/bin/env node
// kitzur — shared mode-change parser (#602)
//
// Single source of truth for interpreting a user prompt as a kitzur mode
// change. Extracted from kitzur-mode-tracker.js so the Claude Code hook and
// the opencode plugin can't drift out of sync with each other. The tracker's
// regexes are the reference behavior — every pattern below is copied from it
// verbatim; don't tighten or loosen a match here without a matching change
// (and test) on the tracker side.
//
// parseModeChange(prompt, { getDefaultMode, skipNaturalLanguage, expandedTpl, unwrapQuotes })
//   → { action: 'set', mode }  — caller should activate `mode`
//   → { action: 'clear' }      — caller should deactivate (delete the flag)
//   → { action: 'status' }     — report the current mode without changing state
//   → null                     — prompt does not change state
//
// Options:
//   getDefaultMode      — required; () => resolved default mode string.
//                          Injected rather than required directly so the
//                          caller controls resolution (cwd, env, etc.).
//   skipNaturalLanguage — when true, skip deactivation/activation/brevity
//                          phrase matching entirely. Set this for prompt text
//                          that isn't the user's own words (e.g. a foreign
//                          slash-command envelope's <command-args>), so
//                          another command's arguments can't misfire our
//                          triggers.
//   expandedTpl         — when true, also recognize opencode's expanded
//                          command-template bodies (a typed "/ultrakitzur"
//                          gets replaced by the command file's prose before
//                          this parser ever sees it). Claude Code prompts
//                          never take this shape, so Claude Code callers
//                          should leave this off.
//   unwrapQuotes        — when true, strip a single layer of matching quote
//                          characters wrapping the whole prompt (opencode's
//                          non-interactive `run` path delivers messages this
//                          way).

// Sibling require that tolerates the opencode install layout, where this
// file is copied next to a renamed `kitzur-config.cjs` (the plugin dir is
// "type": "module", so a bare `.js` sibling would load as ESM). A plain
// `require('./kitzur-config')` only auto-resolves the `.js` extension, so
// try that first (dev tree, standalone hook install) and fall back to the
// explicit `.cjs` name.
let kitzurConfig;
try {
  kitzurConfig = require('./kitzur-config');
} catch (e) {
  kitzurConfig = require('./kitzur-config.cjs');
}
const { VALID_MODES } = kitzurConfig;
// Maps the legacy level names (`/kitzur ultra`, `/kitzur wenyan-lite`, ...)
// onto the three skills. The stand-in covers a config module from before the
// three-skill model (#848 plugin-cache drift): current ids only.
const canonicalMode = kitzurConfig.canonicalMode
  || ((m) => (VALID_MODES.includes(m) ? m : null));

// Each prose mode has its own command, bare or plugin-namespaced.
const MODE_COMMANDS = {
  '/ultrakitzur': 'ultrakitzur', '/kitzur:ultrakitzur': 'ultrakitzur',
  '/megakitzur': 'megakitzur', '/kitzur:megakitzur': 'megakitzur',
};

// Modes handled by their own slash commands (/kitzur-commit, etc.) — not
// selectable via /kitzur <arg>.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

// Natural-language triggers run over the whole prompt, so any pasted text that
// merely QUOTES them fired them — a bug report quoting the /kitzur-help card's
// own line ("Say \"stop kitzur\" or \"normal mode\".") switched kitzur off
// mid-task (#838). #537's envelope unwrap closed the slash-command path; this
// is the prose path, which needs no envelope.
//
// Blank quoted spans before matching. A prompt-length cap looked like the fix
// and is worse on both sides: it still fires on any short quoted line, and it
// silently breaks the compound instructions people actually type ("turn off
// kitzur and write the release notes for ..."). That failure is the dangerous
// direction — a false activation is a nuisance, but a deactivation that is
// dropped in silence leaves the user unable to escape the mode with no
// feedback explaining why.
//
// Only " and ` count as delimiters. Apostrophes are far too common in ordinary
// English ("don't stop kitzur, it's useful") and pairing on them would blank
// the command itself.
const QUOTED_SPAN_REGEX = /(["`])(?:(?!\1).)*\1/g;

// A mode argument with punctuation glued to it ("/kitzur ultra; still too
// verbose") matched no mode, left the mode untouched, and said nothing. Only
// parts[1] is ever read, so extra WORDS after the mode were already harmless;
// it is the trailing character that broke it. Modes are [a-z-] only, so
// stripping every trailing character outside that class is safe.
// Trailing punctuation only. A leading quote or bracket is stripped too so
// `/kitzur "ultra"` resolves — asymmetric handling would leave a second,
// equally silent failure right next to the one being fixed.
// The span between an activation verb and "kitzur" used to be any 40
// characters (`[^.]{0,40}`), which made ordinary prose an activation command:
// "i want to start building a kitzur-themed game" is `want` … `kitzur` with
// nothing but prose in between (#187). Real activation phrases only ever put
// determiners and particles in that gap ("turn on THE kitzur mode", "switch
// TO kitzur"), so the gap is a whitelist now rather than a length budget.
//
// "a"/"an" are deliberately absent. No genuine activation phrase needs one,
// and admitting them is exactly what makes "start a kitzur fire" read as a
// command — the question guard catches that phrasing only while it happens to
// be spelled as a question.
const ACTIVATION_VERBS = '(?:activate|enable|start|turn on|use|switch to|want|give me)';
const ACTIVATION_GAP = '(?:\\s+(?:the|to|into|on|in|please|now|it|me|my|this|that|mode))*';
const ACTIVATION_VERB_PHRASE = new RegExp(
  '\\b' + ACTIVATION_VERBS + '\\b' + ACTIVATION_GAP + '\\s+kitzur\\b'
);
// "talk like kitzur" / "talk like a kitzur" — same tightening, but this one
// keeps the article: it is the idiomatic form of the phrase.
const ACTIVATION_TALK_LIKE = /\btalk\s+like\s+(?:a\s+|an\s+|the\s+)?kitzur\b/;

// A negated activation is not an activation ("don't activate kitzur"). This
// guard is deliberately ASYMMETRIC — the deactivation side keeps firing on
// "don't stop kitzur", per the committed behavior in #838: a dropped
// deactivation is silent and leaves the user unable to escape the mode, while
// a spurious one costs a single "/kitzur" to undo.
const NEGATOR = /\b(?:don['’]?t|do not|doesn['’]?t|does not|won['’]?t|will not|never|no need to|rather not)\b|(?:^|\s)(?:אל|לא|בלי|אין צורך)(?=\s)/;

// The negator does not reliably sit next to the verb it negates. In "don't
// want you to use kitzur" it attaches to `want`, while the trigger that
// actually matches is the `use` inside the complement clause — so a fixed
// "negator, then up to N words, then the verb" window misses it, and widening
// that window far enough to catch it starts swallowing unrelated text.
//
// Scope the guard to the CLAUSE instead: a trigger is negated when a negator
// appears between the last clause boundary and the trigger itself. That is
// what keeps a later independent command alive — in "don't use vim, activate
// kitzur" the comma ends the negated clause, so the activation still stands.
// Dashes and colons separate clauses the same way a comma does ("never mind
// the linter — turn on kitzur"), so they end a negated clause too.
const CLAUSE_BOUNDARY = /[.;!?,:—–]|\s-+\s|\bbut\b|\bthen\b/g;

function negatedBefore(text, index) {
  CLAUSE_BOUNDARY.lastIndex = 0;
  let clauseStart = 0;
  let m;
  while ((m = CLAUSE_BOUNDARY.exec(text)) !== null) {
    if (m.index >= index) break;
    clauseStart = m.index + m[0].length;
  }
  return NEGATOR.test(text.slice(clauseStart, index));
}

// Every phrasing that means "switch kitzur on". Kept as one list so the
// negation check applies uniformly — a guard on only the verb form would let
// "don't put kitzur mode on" through.
const BREVITY_TRIGGER = /\b(less tokens|fewer tokens|be brief|be terse|shorter answers)\b(?!\s+(in|for|on|about|when|during|with)\b)/;
// Hebrew triggers. JS  only knows ASCII word characters, so Hebrew uses an
// explicit start/end-of-token guard instead.
const HE_BEFORE = '(?:^|[\\s.,!?:;("])';
const HE_AFTER = '(?=$|[\\s.,!?:;)"])';
const HE_BREVITY_TRIGGER = new RegExp(
  HE_BEFORE + '(?:מצב קצר|מצב קיצור|תדבר קצר|תענה קצר|תענה בקצרה|תהיה קצר|פחות טוקנים|תקצר את התשובות|תשובות קצרות)' + HE_AFTER
);
const ACTIVATION_TRIGGERS = [
  HE_BREVITY_TRIGGER,
  ACTIVATION_VERB_PHRASE,
  ACTIVATION_TALK_LIKE,
  /\bkitzur\s+mode\s+(on|please|now)\b/,
  /^kitzur(\s+mode)?\s*[.!]*$/,
  BREVITY_TRIGGER,
].map(re => new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));

// True when any trigger matches outside a negated clause. Every match is
// examined, not just the first: the first may be negated while a later,
// independent one is not.
function wantsActivation(text) {
  for (const re of ACTIVATION_TRIGGERS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!negatedBefore(text, m.index)) return true;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return false;
}

function normalizeModeArg(arg) {
  return (arg || '').replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9-]+$/, '');
}

// Resolve a /kitzur argument to a verdict. An argument that resolves to
// nothing returns 'unresolved' rather than null, so the caller can say so
// instead of failing silently. 'unresolved' is additive: applyModeChange in the
// opencode plugin acts only on 'set'/'clear' and ignores anything else.
function resolveModeArg(rawArg, getDefaultMode) {
  const arg = normalizeModeArg(rawArg);
  if (!arg) {
    // Only a genuinely ABSENT argument means "bare /kitzur → activate at the
    // default". An argument that was present but normalized away is punctuation
    // like `/kitzur ?` — plausibly someone asking for help, who should not be
    // switched into the mode by it.
    if (rawArg) return { action: 'unresolved' };
    const configured = getDefaultMode();
    const mode = configured === 'manual' ? 'kitzur' : configured;
    return mode === 'off' ? { action: 'clear' } : { action: 'set', mode };
  }
  if (arg === 'off' || arg === 'stop' || arg === 'disable') return { action: 'clear' };
  if (arg === 'status') return { action: 'status' };
  // An independent mode IS a real mode, just not reachable this way. Saying
  // "not recognized" would deny a mode the user can see in the docs; name its
  // own command instead. Echoing `arg` here is safe precisely because it
  // matched this fixed whitelist — it is no longer free-form user text.
  if (INDEPENDENT_MODES.has(arg)) return { action: 'unresolved', independentMode: arg };
  // kitzur/ultrakitzur/megakitzur, or a legacy level name mapped onto one.
  const mode = canonicalMode(arg);
  if (mode && mode !== 'off') return { action: 'set', mode };
  // Bogus argument: never silently overwrite with the default (#602). The
  // rejected string is untrusted input and is deliberately NOT echoed back —
  // it would land in model context.
  return { action: 'unresolved' };
}

function parseModeChange(promptRaw, options) {
  options = options || {};
  const getDefaultMode = options.getDefaultMode || kitzurConfig.getDefaultMode;

  let prompt = (promptRaw || '').trim();
  if (options.unwrapQuotes) {
    const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
    if (wrapped) prompt = wrapped[2].trim();
  }
  // Capture the first line before whitespace collapse. The expandedTpl
  // templates (opencode's commands/kitzur.md etc.) put $ARGUMENTS at the end
  // of the first line, followed by a blank line and then fixed boilerplate
  // ("If no argument given, use kitzur. If \"off\", deactivate."). Collapsing
  // all whitespace to single spaces (below) merges an EMPTY argument directly
  // into that boilerplate, so a bare `/kitzur` with no argument looked like
  // the argument was the word "if" and got rejected as bogus. Extract the
  // template argument from this uncollapsed first line instead.
  const firstLine = prompt.toLowerCase().split(/\r?\n/, 1)[0];
  // Collapse whitespace so phrase triggers still match multiline prompts —
  // every regex below expects a single-line prompt (#598).
  prompt = prompt.toLowerCase().replace(/\s+/g, ' ');
  if (!prompt) return null;

  // Deactivation intent — computed FIRST so "turn kitzur mode off" never
  // falls through to the activation patterns (#598), and applied with the
  // highest priority: it's what the tracker's original unconditional
  // end-of-function deactivation check amounted to.
  // Matched against nlPrompt (quoted spans blanked, see QUOTED_SPAN_REGEX) so a
  // prompt that CITES a trigger does not fire it. A prompt that starts with a
  // slash is a command invocation: its own text must not toggle our mode,
  // symmetric with the skipNaturalLanguage a foreign command envelope sets.
  // opencode's expanded /kitzur-help card lists the commands and quotes the
  // triggers; its prose ("Activate kitzur" once the backtick span is blanked)
  // must not switch the mode. Checked before every trigger, deactivation too.
  if (options.expandedTpl && /^show the kitzur quick-reference card\b/.test(prompt)) return null;

  const naturalLanguage = !options.skipNaturalLanguage && !prompt.startsWith('/');
  const nlPrompt = naturalLanguage ? prompt.replace(QUOTED_SPAN_REGEX, ' ') : '';

  const heWantsOff = naturalLanguage && (
    new RegExp(HE_BEFORE + '(?:עצור|תעצור|תפסיק|הפסק|כבה|תכבה|בטל|תבטל) (?:את )?ה?(?:קיצור|מצב קצר)' + HE_AFTER).test(nlPrompt) ||
    new RegExp(HE_BEFORE + '(?:בלי|ללא) קיצור' + HE_AFTER).test(nlPrompt) ||
    new RegExp('^(?:בבקשה )?(?:תחזור |חזור |חזרה )?(?:ל)?מצב רגיל' + HE_AFTER).test(nlPrompt) ||
    (nlPrompt.includes('מצב רגיל') && nlPrompt.includes('קיצור'))
  );
  const wantsOff = heWantsOff || naturalLanguage && (
    /\b(stop|disable|deactivate|quit|exit|kill)\s+(the\s+)?kitzur\b/.test(nlPrompt) ||
    /\bkitzur(\s+mode)?\s+(off|stop|disabled?)\b/.test(nlPrompt) ||
    /\bturn\s+off\s+(the\s+)?kitzur\b/.test(nlPrompt) ||
    // "normal mode" only as a command (prompt-initial, optionally led by a
    // switch-back verb) or with kitzur context — never mid-sentence for
    // e.g. vim's normal mode ("how do I exit vim normal mode").
    /^(please\s+)?(go\s+(back\s+)?(to\s+)?|back\s+to\s+|switch\s+(back\s+)?to\s+|return\s+to\s+)?normal\s+mode\b/.test(nlPrompt) ||
    (/\bnormal\s+mode\b/.test(nlPrompt) && /\bkitzur\b/.test(nlPrompt))
  );
  if (wantsOff) return { action: 'clear' };

  // opencode expands a typed "/kitzur <arg>", "/ultrakitzur", "/megakitzur" (and
  // the independent-mode commands) into the command file's prose before
  // chat.message fires, so the literal slash-command branch below never sees
  // the original text. Recover the mode from each template's fixed prefix
  // instead. This MUST run before the generic NL-activation match below:
  // "Activate kitzur mode: ultra" would otherwise trip the "activate ...
  // kitzur" trigger and swallow the argument, activating at the default
  // instead (#602). Claude Code prompts never take this shape, so gate behind
  // expandedTpl (opencode-only).
  if (options.expandedTpl) {
    if (/^generate a commit message for the current staged changes\b/.test(prompt)) {
      return { action: 'set', mode: 'commit' };
    }
    if (/^review the current diff\b/.test(prompt)) {
      return { action: 'set', mode: 'review' };
    }
    if (/^compress the file at:/.test(prompt)) {
      return { action: 'set', mode: 'compress' };
    }
    const own = /^activate (ultrakitzur|megakitzur) mode\b/.exec(prompt);
    if (own) return { action: 'set', mode: own[1] };
    const tpl = /^activate kitzur mode:[ \t]*(\S*)/.exec(firstLine);
    if (tpl) return resolveModeArg(tpl[1], getDefaultMode);
  }

  if (naturalLanguage) {
    // Questions about kitzur are not activation commands
    // ("what is kitzur mode?", "does kitzur lite drop articles?").
    const isQuestion =
      /^(מה|איך|למה|מתי|איפה|מי|האם|תסביר|ספר לי)(?=\s|$)/.test(nlPrompt) ||
      /^(what|whats|what's|how|why|when|where|who|does|do|did|is|are|can|could|would|should|tell me|explain)\b/.test(nlPrompt);

    // Natural language activation (e.g. "activate kitzur", "turn on kitzur
    // mode", "talk like kitzur"). Also brevity requests ("less tokens",
    // "be brief/terse", "fewer tokens", "shorter answers") — but not when
    // scoped to a single section ("be brief in the summary"), which is a
    // one-off instruction, not a session-wide mode switch.
    if (!isQuestion) {
      if (wantsActivation(nlPrompt)) {
        const configured = getDefaultMode();
        const mode = configured === 'manual' ? 'kitzur' : configured;
        // Mirrors the tracker exactly: a configured-off default makes this a
        // no-op (leave whatever flag state already exists), NOT a clear —
        // that's only what an explicit "/kitzur" bare command does.
        return mode !== 'off' ? { action: 'set', mode } : null;
      }
    }
  }

  // Match /kitzur commands. Marketplace plugin installs surface commands
  // namespaced as /kitzur:kitzur-<name> — accept both forms for every
  // skill (#599: only compress and stats had the namespaced variant).
  const parts = prompt.split(/\s+/);
  const cmd = parts[0]; // /kitzur, /ultrakitzur, /kitzur-commit, etc.
  if (Object.prototype.hasOwnProperty.call(MODE_COMMANDS, cmd)) {
    // Same off/status words /kitzur takes; anything else is just the mode.
    const arg = normalizeModeArg(parts[1]);
    if (arg === 'off' || arg === 'stop' || arg === 'disable') return { action: 'clear' };
    if (arg === 'status') return { action: 'status' };
    return { action: 'set', mode: MODE_COMMANDS[cmd] };
  }
  if (prompt.startsWith('/kitzur')) {
    const arg = parts[1] || '';

    if (cmd === '/kitzur-commit' || cmd === '/kitzur:kitzur-commit') {
      return { action: 'set', mode: 'commit' };
    }
    if (cmd === '/kitzur-review' || cmd === '/kitzur:kitzur-review') {
      return { action: 'set', mode: 'review' };
    }
    if (cmd === '/kitzur-compress' || cmd === '/kitzur:kitzur-compress') {
      return { action: 'set', mode: 'compress' };
    }
    if (cmd === '/kitzur' || cmd === '/kitzur:kitzur') {
      // Bare /kitzur → activate at configured default; otherwise resolve the
      // argument (punctuation-tolerant, bogus values reported not swallowed).
      return resolveModeArg(arg, getDefaultMode);
    }
  }

  return null;
}

module.exports = { parseModeChange, INDEPENDENT_MODES };
