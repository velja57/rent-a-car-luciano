"""
Izvlaci 12fps JPEG frejm-sekvencu iz mp4 klipa za CarStage (vidi README_HERO.md).
Klip mora poceti parkiran (frame 0 = parkirana poza).

Upotreba:
    python -I extract_sequence.py <id> <putanja-do-videa.mp4> [--bez-watermarka]

--bez-watermarka uklanja DomoAI watermark (besplatni tier) iz svakog frejma,
vidi watermark.py.

Primer:
    python -I extract_sequence.py bmw "C:\\Users\\Velja\\Desktop\\rent_a_car_luciano\\Cars\\bmw.mp4"

Rezultat ide u public/frames/<id>/0000.jpg, 0001.jpg, ... — ispisuje broj
frejmova koji treba upisati u frameCount polje za taj auto u src/data/cars.js.
"""

import sys
import os
import cv2

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)  # python -I ne dodaje folder skripte u path
from watermark import remove_domoai_watermark  # noqa: E402

PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
SAMPLE_STEP = 2  # uzmi svaki 2. frejm od 24fps izvora -> 12fps izlaz
JPEG_QUALITY = 82


def main():
    args = [a for a in sys.argv[1:] if a != "--bez-watermarka"]
    remove_watermark = "--bez-watermarka" in sys.argv[1:]
    if len(args) != 2:
        print("Upotreba: python -I extract_sequence.py <id> <putanja-do-videa.mp4> [--bez-watermarka]")
        sys.exit(1)

    car_id, video_path = args
    if not os.path.isfile(video_path):
        print(f"Fajl ne postoji: {video_path}")
        sys.exit(1)

    out_dir = os.path.join(PROJECT_ROOT, "public", "frames", car_id)
    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    src_fps = cap.get(cv2.CAP_PROP_FPS)
    idx = 0
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % SAMPLE_STEP == 0:
            frames.append(frame)
        idx += 1
    cap.release()

    if remove_watermark:
        print("Uklanjam DomoAI watermark...")
        frames = remove_domoai_watermark(frames)

    for saved, frame in enumerate(frames):
        fname = os.path.join(out_dir, f"{saved:04d}.jpg")
        cv2.imwrite(fname, frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    saved = len(frames)

    out_fps = src_fps / SAMPLE_STEP if src_fps else 0
    print(f"{car_id}: izvor={idx} frejmova @ {src_fps:.1f}fps -> sacuvano {saved} @ {out_fps:.1f}fps")
    print(f"Upisano u: {out_dir}")
    print(f"U src/data/cars.js postavi: frameCount: {saved}")


if __name__ == "__main__":
    main()
