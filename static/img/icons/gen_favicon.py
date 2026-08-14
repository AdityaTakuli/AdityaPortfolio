#!/usr/bin/env python3
"""Generate the AT favicon set.

The mark is a pixel-block monogram so it matches the "Press Start 2P" wordmark
on the TrialMatch case study, sitting on a near-black tile with a faint graph
grid — the site's two visual signatures in one 16px square.

Every output is derived from the same LETTERS bitmap, so the SVG and the PNGs
can never drift apart. Run from the repo root:

    python3 static/img/icons/gen_favicon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent

# Matches the site's dark theme --paper / --ink / --brand.
TILE = (12, 12, 12, 255)
INK = (236, 236, 232, 255)
BRAND = (111, 159, 255, 255)
GRID = (236, 236, 232, 20)

# 5x7 pixel glyphs. "A" carries the ink colour, "T" the brand blue, echoing the
# TRIAL / MATCH split in the case-study banner.
LETTERS = [
    (
        [
            ".###.",
            "#...#",
            "#...#",
            "#####",
            "#...#",
            "#...#",
            "#...#",
        ],
        INK,
    ),
    (
        [
            "#####",
            "..#..",
            "..#..",
            "..#..",
            "..#..",
            "..#..",
            "..#..",
        ],
        BRAND,
    ),
]

GAP = 1          # blocks between the two glyphs
COLS = 5 + GAP + 5   # 11 blocks wide
ROWS = 7             # 7 blocks tall


def blocks():
    """Yield (col, row, colour) for every lit pixel of the monogram."""
    x0 = 0
    for grid, colour in LETTERS:
        for row, line in enumerate(grid):
            for col, ch in enumerate(line):
                if ch == "#":
                    yield x0 + col, row, colour
        x0 += 5 + GAP


# Fraction of the tile the monogram spans. The rest is breathing room, which a
# 16px icon needs as much as a 512px one.
FILL_RATIO = 0.78


def render_png(size, path, grid=False, radius_ratio=0.0):
    """Draw the mark at `size` px, snapping blocks to whole pixels."""
    block = max(1, int(size * FILL_RATIO) // COLS)
    w, h = COLS * block, ROWS * block
    ox, oy = (size - w) // 2, (size - h) // 2

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if radius_ratio:
        d.rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=TILE
        )
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=TILE)

    # The grid has to go on its own layer and be composited: ImageDraw writes
    # raw values, so drawing a low-alpha colour straight onto the tile would
    # punch transparent holes through it instead of tinting it.
    if grid:
        step = max(4, size // 8)
        overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        for p in range(step, size, step):
            od.line([(p, 0), (p, size)], fill=GRID)
            od.line([(0, p), (size, p)], fill=GRID)
        img.alpha_composite(overlay)

    for col, row, colour in blocks():
        x, y = ox + col * block, oy + row * block
        d.rectangle([x, y, x + block - 1, y + block - 1], fill=colour)

    img.save(path)
    return img


def rgba_css(c):
    return f"rgb({c[0]} {c[1]} {c[2]})"


def render_svg(path):
    """32-unit viewBox with 2-unit blocks, matching favicon-32.png exactly."""
    block = 2
    ox = (32 - COLS * block) // 2
    oy = (32 - ROWS * block) // 2

    rects = []
    for step in range(4, 32, 4):
        rects.append(
            f'  <path d="M{step} 0V32M0 {step}H32" stroke="{rgba_css(INK)}" '
            f'stroke-opacity="0.08" stroke-width="0.5"/>'
        )
    for col, row, colour in blocks():
        x, y = ox + col * block, oy + row * block
        rects.append(
            f'  <rect x="{x}" y="{y}" width="{block}" height="{block}" '
            f'fill="{rgba_css(colour)}"/>'
        )

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" '
        'width="32" height="32" role="img" aria-label="AT">\n'
        f'  <rect width="32" height="32" rx="5" fill="{rgba_css(TILE)}"/>\n'
        + "\n".join(rects)
        + "\n</svg>\n"
    )
    path.write_text(svg)


def main():
    render_png(16, OUT / "favicon-16.png")
    render_png(32, OUT / "favicon-32.png")
    render_png(180, OUT / "apple-touch-icon.png", grid=True)
    render_png(512, OUT / "icon-512.png", grid=True)
    render_svg(OUT / "favicon.svg")

    # Legacy .ico bundles the small raster sizes.
    ico = render_png(64, OUT / "_tmp_ico.png")
    ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    (OUT / "_tmp_ico.png").unlink()

    print("wrote:", ", ".join(sorted(p.name for p in OUT.glob("favicon*"))))
    print("       apple-touch-icon.png, icon-512.png")


if __name__ == "__main__":
    main()
