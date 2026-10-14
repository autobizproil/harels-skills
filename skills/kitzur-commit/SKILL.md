---
name: kitzur-commit
description: >
  כתיבת הודעת commit בפורמט Conventional Commits, מקוצרת לכוונה בלבד.
  להפעלה עם "תכתוב commit", "הודעת commit", /commit או /kitzur-commit.
---

כתוב הודעות commit קצרות ומדויקות. פורמט Conventional Commits. בלי קישוטים. למה חשוב יותר מ-מה.

## כללים

**שורת נושא:**
- `<type>(<scope>): <סיכום בציווי>`. ה-`<scope>` אופציונלי.
- סוגים: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`
- ציווי: "הוסף", "תקן", "הסר". לא "הוספתי", "מוסיף".
- עד 50 תווים כשאפשר, תקרה קשיחה 72
- בלי נקודה בסוף
- שפת הנושא: כמו שאר ההיסטוריה בפרויקט (עברית או אנגלית). לא מערבבים בתוך הודעה אחת.

**גוף (רק אם צריך):**
- לדלג לגמרי כשהנושא מובן מעצמו
- גוף רק עבור: ה"למה" שלא ברור, שינויים שוברים, הערות מיגרציה, issues מקושרים
- שורות עד 72 תווים
- נקודות `-` ולא `*`
- הפניות לבסוף: `Closes #42`, `Refs #17`

**מה אף פעם לא נכנס:**
- "ה-commit הזה עושה X", "אני", "אנחנו", "עכשיו", "כרגע". ה-diff אומר מה.
- "לבקשת..." — השתמש ב-trailer מסוג Co-authored-by
- "Generated with Claude Code" או כל ייחוס AI, אלא אם כלל של המשתמש דורש trailer מסוג `Assisted-by`. אז מוסיפים אותו כ-trailer.
- אימוג'י (אלא אם מוסכמת הפרויקט דורשת)
- שם הקובץ כשה-scope כבר אומר אותו

## דוגמאות

Diff: endpoint חדש לפרופיל משתמש עם גוף שמסביר למה
- ❌ "feat: add a new endpoint to get user profile information from the database"
- ✅
  ```
  feat(api): add GET /users/:id/profile

  Mobile client needs profile data without the full user payload
  to reduce LTE bandwidth on cold-launch screens.

  Closes #128
  ```

Diff: שינוי API שובר
- ✅
  ```
  feat(api)!: rename /v1/orders to /v1/checkout

  BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
  before 2026-06-01. Old route returns 410 after that date.
  ```

## בהירות אוטומטית

תמיד לכלול גוף עבור: שינויים שוברים, תיקוני אבטחה, מיגרציות נתונים, וכל דבר שמבטל commit קודם. לעולם לא לדחוס אותם לנושא בלבד: מי שיחקור את זה בעתיד צריך את ההקשר. הודעת commit נשמרת מחוץ לצ'אט, לכן היא תמיד נכתבת במשפטים תקינים ולא בקיצורי סגנון.

## גבולות

רק מייצר את הודעת ה-commit. לא מריץ `git commit`, לא מוסיף קבצים ל-stage, לא עושה amend. מוציא את ההודעה כבלוק קוד מוכן להדבקה. "עצור קיצור" או "מצב רגיל": חוזר לסגנון commit מפורט.
