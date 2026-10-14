# הוראות התקנה (ל-Claude)

אם המשתמש שלח לך קישור לריפו הזה וביקש "תתקין", בצע את הצעדים האלה לפי הסדר.

## לפני שמתחילים: אישור

ההתקנה מעתיקה קבצים ל-`~/.claude/hooks/` ו-`~/.claude/skills/` ומוסיפה רישום hooks ל-`~/.claude/settings.json` (נשמר גיבוי `settings.json.kitzur-backup`). אלה קבצים שרצים אוטומטית בכל סשן. **הסבר למשתמש את זה במשפט אחד וקבל אישור מפורש לפני שאתה מריץ.**

## צעדים

1. ודא ש-Node.js מותקן: `node --version`. אם לא, עצור ותגיד למשתמש להתקין Node מ-nodejs.org.
2. שכפל לתיקייה חדשה וריקה (לא לתוך פרויקט של המשתמש):
   ```bash
   git clone --branch v0.1.0 --depth 1 https://github.com/autobizproil/harels-skills.git ~/harels-skills
   ```
3. תצוגה מקדימה, בלי שינוי:
   ```bash
   cd ~/harels-skills && node install.js --dry-run
   ```
4. התקנה:
   ```bash
   node install.js
   ```
5. בקש מהמשתמש לפתוח סשן חדש של Claude Code ולכתוב "מצב קצר". תג `[KITZUR]` אמור להופיע בשורת הסטטוס.

אם `statusLine` כבר מוגדר אצל המשתמש, ההתקנה לא נוגעת בו (התג לא יוצג, שאר הדברים עובדים).

## אם המשתמש מעדיף plugin

בלי להריץ סקריפט: המשתמש מקליד בסשן את שתי הפקודות:
```
/plugin marketplace add autobizproil/harels-skills
/plugin install harels-skills@harels-skills
```

## הסרה

```bash
cd ~/harels-skills && node install.js --uninstall
```

## הערה: אם מותקן גם Caveman

שני המנגנונים יזריקו הוראות במקביל. מומלץ להסיר אחד מהם.

**נעילת גרסה:** ההתקנה מושכת את התג `v0.1.0` ולא את `main`, כדי ששינויים עתידיים בריפו לא ירוצו אצל לקוחות בלי שבחרת בכך. לשדרוג: להחליף לתג חדש.
