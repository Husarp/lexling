"""Draws assets/lexling.ico - concept 2b "Caret", black variant, from "WordGuess Icon Ideas.dc.html":
a black squircle with "le" in Barlow Condensed ExtraBold, white, and the orange text caret after it.
("gu" until the rename to Lexling in 0.18.0 - from Word*Gu*ess.)
Needs Pillow.   python tools/make-icon.py
Also writes the two masters the Android build takes its launcher icons and splash screens from:
assets/icon.png (the 1024 icon) and assets/splash.png + splash-dark.png - the icon at a quarter of a
2732 black square, centred, its black corners vanishing into the black (measured against the splash
made by hand in 0.13.2: identical). Then:   npx capacitor-assets generate --android ...

The design tile is 144 px; every number below is that tile's CSS, scaled. Its markup is

    <div style="width:144px;height:144px;border-radius:36px;background:#000;display:grid;
                place-items:center;font:800 106px/1 'Barlow Condensed';letter-spacing:-.03em;color:#fff">
      <span style="white-space:nowrap;position:relative;top:-.15em;margin-right:.15em">gu<span
            style="position:absolute;left:100%;top:.14em;width:.1em;height:.92em;background:#DB5126;
                   margin-left:.05em"></span></span></div>

so the span is a grid item (blockified: height = line-height = 1em, width = the text), centred with its
right margin, nudged up .15em, and the caret hangs off its right edge.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "app" / "fonts" / "BarlowCondensed-ExtraBold.ttf"
ACCENT, WHITE, BLACK = "#DB5126", "#FFFFFF", "#000000"
TEXT = "le"
S = 1024                      # the master size
SIZES = (16, 24, 32, 48, 64, 128, 256)
SUPERSAMPLE = 4               # each icon size is drawn at 4x and reduced: crisper than shrinking from 1024


def draw(size: int) -> Image.Image:
    em = 106 / 144 * size                 # font-size
    radius = 36 / 144 * size              # border-radius
    tracking = -0.03 * em                 # letter-spacing, added after every character (Chromium)
    margin_right, nudge_up = 0.15 * em, 0.15 * em      # margin-right / position:relative; top:-.15em
    caret = dict(left=0.05 * em, top=0.14 * em, width=0.10 * em, height=0.92 * em)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BLACK)

    font = ImageFont.truetype(str(FONT), em)
    ascent, descent = font.getmetrics()
    advances = [font.getlength(c) + tracking for c in TEXT]
    text_w = sum(advances)                       # max-content width, trailing letter-spacing included

    left = (size - (text_w + margin_right)) / 2  # the MARGIN box is what gets centred
    top = (size - em) / 2 - nudge_up             # block height = line-height = 1em
    baseline = top + (em - (ascent + descent)) / 2 + ascent   # half-leading, then the ascent

    x = left
    for char, advance in zip(TEXT, advances):
        d.text((x, baseline), char, font=font, fill=WHITE, anchor="ls")
        x += advance
    caret_x = left + text_w + caret["left"]
    d.rectangle((caret_x, top + caret["top"], caret_x + caret["width"], top + caret["top"] + caret["height"]),
                fill=ACCENT)
    return img


def at(size: int) -> Image.Image:
    return draw(size * SUPERSAMPLE).resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    out = ROOT / "assets"
    out.mkdir(exist_ok=True)
    frames = [at(n) for n in SIZES]
    frames[-1].save(out / "lexling.ico", sizes=[(n, n) for n in SIZES], append_images=frames[:-1])
    at(256).save(out / "lexling.png")
    master = draw(S)
    master.save(out / "lexling-1024.png")      # for stores
    master.save(out / "icon.png")              # @capacitor/assets: the Android launcher icons
    splash = Image.new("RGB", (2732, 2732), BLACK)
    mark = master.resize((683, 683), Image.LANCZOS)
    splash.paste(mark, ((2732 - 683) // 2, (2732 - 683) // 2), mark)
    for name in ("splash.png", "splash-dark.png"):
        splash.save(out / name)
    print("wrote", out / "lexling.ico", "sizes", SIZES, "+ icon.png, splash.png, splash-dark.png")
