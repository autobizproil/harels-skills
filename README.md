# harels-skills

הסקילים של הראל ל-Claude Code.

## kitzur (קיצור)

גרסה עברית של [Caveman](https://github.com/JuliusBrussee/caveman): תשובות קצרות וחדות, כל עובדה טכנית נשמרת, בלי "בשמחה!", סיכומים והסברים שלא ביקשת.

**מצבים**

| מצב | הפעלה | מה משתנה |
|-----|-------|----------|
| kitzur | `/kitzur` או "מצב קצר" | התשובה קודם, בלי טקס. ברירת מחדל. |
| ultrakitzur | `/ultrakitzur` | בלי דקדוק: חלקי משפט, כל עובדה פעם אחת. |
| megakitzur | `/megakitzur` | לשון חז"ל. ניסיוני. |

כיבוי: "עצור קיצור" או "מצב רגיל". סטטוס: `/kitzur status`.

**מה יש**

- `hooks`: הפעלה אוטומטית בתחילת כל סשן, זיהוי "מצב קצר" / "תדבר קצר" / "פחות טוקנים" / "עצור קיצור" / "מצב רגיל" בשפה רגילה, תזכורת בכל הודעה, וגם לסוכני משנה.
- `skills`: `kitzur`, `ultrakitzur`, `megakitzur`, `kitzur-commit`, `kitzur-review`, `kitzur-stats`, `kitzur-help`.
- סטטוסליין עם תג המצב (`[KITZUR]`).

## התקנה

הדרך הכי פשוטה: שלח ל-Claude את הקישור לריפו וכתוב "תתקין את זה". הוא יקרא את [INSTALL.md](INSTALL.md), יסביר מה הוא עומד לשנות, ויבקש אישור.

ידנית:
```bash
git clone https://github.com/autobizproil/harels-skills.git
cd harels-skills
node install.js
```

או כ-plugin:
```
/plugin marketplace add autobizproil/harels-skills
/plugin install kitzur@harels-skills
```

דורש Node.js. הסרה: `node install.js --uninstall`.

## כמה טוקנים זה חוסך?

לא נמדד בעברית. הפרויקט המקורי מדד באנגלית (עשר שאלות, הרצה אחת): מצב רגיל חסך בערך 3% לעומת הוראה פשוטה "Answer concisely" (בתוך הרעש), ואולטרה בערך 35%. החיסכון הוא רק בטוקני **פלט** ולא בקלט. אל תבטיח ללקוחות מספר.

## קרדיט ורישיון

מבוסס על [Caveman](https://github.com/JuliusBrussee/caveman) מאת Julius Brussee, רישיון Apache-2.0 (ראה `LICENSE`, `NOTICE`, `LICENSE-MIT`). הקוד שונה: שמות, טקסטים וטריגרים תורגמו לעברית ונוספו זיהויי עברית ל-hook. הפרויקט הזה אינו קשור ל-Caveman ואינו מאושר על ידי היוצר; "Caveman" הוא סימן מסחרי של Julius Brussee.
