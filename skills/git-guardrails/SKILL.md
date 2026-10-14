---
name: git-guardrails
description: >
  התקנת מגן שחוסם ל-Claude פקודות git הרסניות (push, reset --hard, clean -f,
  branch -D, checkout ., restore .) לפני שהן רצות. להפעלה עם "תגן על ה-git שלי",
  "שלא ידחוף בלי לשאול", "תחסום פקודות מסוכנות", "git guardrails".
---

# מגן git

מתקין hook מסוג PreToolUse שבודק כל פקודת Bash לפני שהיא רצה, וחוסם פקודות git שאי אפשר להחזיר.

## מה נחסם

- `git push` (כל הצורות, כולל `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd` / `--force`
- `git branch -D`
- `git checkout .` / `git restore .`

כש-Claude מנסה אחת מהן, הוא מקבל הודעה שאין לו הרשאה, ומתבקש להסביר למשתמש מה רצה לעשות. המשתמש יכול להריץ את הפקודה בעצמו.

## צעדים

1. **שאל את המשתמש**: להתקין לפרויקט הזה בלבד (`.claude/settings.json`) או לכל הפרויקטים (`~/.claude/settings.json`). הסבר במשפט אחד שזה עורך קובץ הגדרות, וקבל אישור.
2. **ודא ש-Node.js מותקן** (`node --version`). אם לא, עצור והפנה ל-nodejs.org.
3. **העתק את הסקריפט** `scripts/block-dangerous-git.js` (שנמצא ליד הקובץ הזה) ליעד:
   - פרויקט: `.claude/hooks/block-dangerous-git.js`
   - כללי: `~/.claude/hooks/block-dangerous-git.js`
4. **הוסף ל-settings.json** (בלי למחוק הגדרות קיימות; אם יש כבר `hooks.PreToolUse`, הוסף למערך). השתמש בנתיב מוחלט לסקריפט. דוגמה:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             { "type": "command", "command": "node \"/נתיב/מוחלט/block-dangerous-git.js\"" }
           ]
         }
       ]
     }
   }
   ```
   שמור גיבוי של הקובץ לפני העריכה.
5. **שאל אם להוסיף או להסיר דפוסים** מהרשימה (הם ב-`RULES` בראש הסקריפט), ועדכן לפי הצורך.
6. **בדוק**:
   ```bash
   echo '{"tool_input":{"command":"git push origin main"}}' | node <נתיב-לסקריפט>
   ```
   צריך לצאת בקוד 2 ולהדפיס הודעת "נחסם". ואז:
   ```bash
   echo '{"tool_input":{"command":"git status"}}' | node <נתיב-לסקריפט>
   ```
   צריך לצאת בקוד 0 בלי פלט.
7. אמור למשתמש לפתוח סשן חדש כדי שההגדרה תיטען.

## הגבלות (אמור אותן למשתמש)

- המגן בודק את טקסט הפקודה. פקודה שנבנית דרך סקריפט או משתנה (`sh deploy.sh` שמריץ push בפנים) לא תיתפס.
- הוא חוסם רק את Claude, לא אותך בטרמינל.
