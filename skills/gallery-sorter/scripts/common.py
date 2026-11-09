"""כלים משותפים: תיקיית הבית של הכלי, מפתח Gemini, ושמות האלבומים."""
import os
import sys
from pathlib import Path

# ווינדוס: כשהפלט עובר בצינור (כמו אצל Claude Code) הקידוד הוא של האזור ולא UTF-8, והדפסה בעברית קורסת
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HOME = Path(os.environ.get("GALLERY_SORTER_HOME", Path.home() / ".gallery-sorter"))
ENV_FILE = HOME / ".env"

ALBUM_NAMES = {
    "trip": "טיולים",
    "family": "משפחה",
    "friends": "חברים ואירועים",
    "food": "אוכל",
    "pets": "חיות מחמד",
    "work": "עבודה",
    "receipt": "קבלות ומסמכים",
    "docs": "קבלות ומסמכים",
    "saved": "דברים ששמרתי",
    "screens": "צילומי מסך",
    "memes": "ממים",
    "shopping": "קניות",
    "nature": "נוף וטבע",
    "other": "שונות",
    "dupes": "כפולות",
    "blurry": "מטושטשות",
}
REVIEW_FOLDER = "לבדיקה לפני מחיקה"
HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]


def album_name(album_id):
    if album_id.startswith("trip:"):
        return "טיול · " + album_id[5:]
    return ALBUM_NAMES.get(album_id, album_id)


def read_env():
    """מפתחות ממשתני סביבה או מ-~/.gallery-sorter/.env (שורות KEY=value)."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k].strip()
    return env


def provider():
    """Gemini אם יש מפתח (הכי זול), אחרת OpenAI. מחזיר (שם, מפתח)."""
    env = read_env()
    if env.get("GEMINI_API_KEY"):
        return "gemini", env["GEMINI_API_KEY"]
    if env.get("OPENAI_API_KEY"):
        return "openai", env["OPENAI_API_KEY"]
    raise SystemExit(f"חסר מפתח. שמרו בקובץ {ENV_FILE} שורה אחת: GEMINI_API_KEY=המפתח (או OPENAI_API_KEY=המפתח)")
