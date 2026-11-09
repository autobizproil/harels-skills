"""שלב 4: מסדר את התמונות בתיקיות. מעתיק בלבד: המקור לא זז, לא משתנה ולא נמחק.

  python scripts/organize.py --run RUN                       # תוכנית: כמה ייכנסו לכל תיקייה, בלי לגעת בכלום
  python scripts/organize.py --run RUN --dest "~/Pictures/מסדר הגלריה" --apply

התוצאה:
  <dest>/טיולים/...  <dest>/משפחה/...  <dest>/קבלות ומסמכים/...
  <dest>/לבדיקה לפני מחיקה/כפולות/...   <dest>/לבדיקה לפני מחיקה/מטושטשות/...
המחיקה עצמה, אם בכלל, נעשית ביד בטלפון או בגלריה, אחרי שעוברים על תיקיית הבדיקה.
"""
import argparse
import json
import shutil
from collections import Counter
from pathlib import Path

from common import REVIEW_FOLDER, album_name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--dest", default=str(Path.home() / "Pictures" / "מסדר הגלריה"))
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    run, dest = Path(args.run).expanduser(), Path(args.dest).expanduser()
    meta = json.loads((run / "sorted.json").read_text(encoding="utf-8"))

    def folder(m):
        if m["album"] in ("dupes", "blurry"):
            return Path(REVIEW_FOLDER) / album_name(m["album"])
        return Path(album_name(m["album"]))

    plan = Counter(str(folder(m)) for m in meta)
    print(f"{'ייכנסו' if not args.apply else 'מעתיק'} {len(meta)} תמונות אל {dest}:")
    for k, v in sorted(plan.items(), key=lambda kv: (kv[0].startswith(REVIEW_FOLDER), -kv[1])):
        print(f"  {v:6d}  {k}")
    if not args.apply:
        print("\nזו תוכנית בלבד. להעתקה בפועל: אותה פקודה עם --apply")
        return

    copied = 0
    for m in meta:
        src = Path(m["src"])
        if not src.exists():
            print("missing", src)
            continue
        d = dest / folder(m)
        d.mkdir(parents=True, exist_ok=True)
        target = d / (m.get("filename") or src.name)
        k = 1
        while target.exists():  # שמות זהים מתיקיות שונות: מוסיפים מספר, לא דורסים
            target = d / f"{Path(m.get('filename') or src.name).stem} ({k}){src.suffix}"
            k += 1
        shutil.copy2(src, target)
        copied += 1
        if copied % 200 == 0:
            print(f"  {copied}/{len(meta)}", flush=True)
    (run / "organized.json").write_text(json.dumps({"dest": str(dest), "copied": copied}, ensure_ascii=False))
    print(f"\nהועתקו {copied} תמונות אל {dest}. המקור לא נגע.")


if __name__ == "__main__":
    main()
