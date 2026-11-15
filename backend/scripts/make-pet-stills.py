"""펫 GIF의 첫 장면을 정지 썸네일(PNG)로 만든다.

목록처럼 한 화면에 여러 마리가 보이는 곳은 움직이는 GIF 대신 이 썸네일을 쓴다.
사용: python backend/scripts/make-pet-stills.py
  image/<이름>_1.gif(아기), <이름>_2.gif(성체) → image/still/<이름>_1.png, <이름>_2.png (256x256)
이어서 `node scripts/upload-pet-stills.mjs`로 R2에 올린다.
"""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "image")
DST = os.path.join(SRC, "still")
SIZE = 256

os.makedirs(DST, exist_ok=True)
count = 0
for name in sorted(os.listdir(SRC)):
    if not name.endswith(".gif"):
        continue
    im = Image.open(os.path.join(SRC, name))
    im.seek(0)
    rgba = im.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    bg.alpha_composite(rgba)
    rgb = bg.convert("RGB")
    scale = min(SIZE / rgb.width, SIZE / rgb.height)
    w, h = max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))
    rgb = rgb.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
    canvas.paste(rgb, ((SIZE - w) // 2, (SIZE - h) // 2))
    canvas.save(os.path.join(DST, name[:-4] + ".png"), optimize=True)
    count += 1
print(f"정지 썸네일 {count}개 -> {DST}")
