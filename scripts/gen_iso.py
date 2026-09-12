#!/usr/bin/env python3
"""Generate the isometric layer diagrams used in the case studies.

The look follows the "WEB Diagram" Spline scene: chips built from a translucent
glass tray, a machined slab and a top plate, scattered on a dark isometric grid
with amber wires running between them.

Isometric projection keeps one very useful property: raising a plate in Z is a
pure screen-space Y translation, so every layer-lift animation in the CSS is a
plain translateY and the geometry never has to be recomputed.

    sx = (x - y) * cos30
    sy = (x + y) * sin30 - z

Run:  python3 scripts/gen_iso.py            # writes the SVG partials
"""
import math
from pathlib import Path

COS30 = math.cos(math.radians(30))
SIN30 = 0.5

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "out"


def P(x, y, z=0.0):
    return ((x - y) * COS30, (x + y) * SIN30 - z)


def pts(seq):
    return " ".join("%.2f,%.2f" % p for p in seq)


def top_face_matrix(x, y, z):
    """SVG matrix mapping flat (u,v) drawing space onto the top face at z."""
    ox, oy = P(x, y, z)
    return "matrix(%.4f,%.4f,%.4f,%.4f,%.3f,%.3f)" % (COS30, SIN30, -COS30, SIN30, ox, oy)


def box(x, y, w, d, z0, h, cls):
    """One extruded slab: top face plus the two walls the camera can see."""
    zt = z0 + h
    top = [P(x, y, zt), P(x + w, y, zt), P(x + w, y + d, zt), P(x, y + d, zt)]
    right = [P(x + w, y, zt), P(x + w, y + d, zt), P(x + w, y + d, z0), P(x + w, y, z0)]
    left = [P(x, y + d, zt), P(x + w, y + d, zt), P(x + w, y + d, z0), P(x, y + d, z0)]
    return (
        '<polygon class="iso-face iso-face--left %s" points="%s" />'
        '<polygon class="iso-face iso-face--right %s" points="%s" />'
        '<polygon class="iso-face iso-face--top %s" points="%s" />'
    ) % (cls, pts(left), cls, pts(right), cls, pts(top))


def plate(x, y, w, d, z0, h, cls):
    return box(x, y, w, d, z0, h, cls)


# --------------------------------------------------------------------------
# Chips
# --------------------------------------------------------------------------

TRAY_H = 5.0     # translucent glass tray
SLAB_H = 22.0    # machined body
CAP_H = 9.0      # top plate carrying the glyph
LIFT = 9.0       # resting gap the CSS animates open


def chip(node, tile):
    """One layered chip. Plates are separate <g>s so CSS can lift them."""
    gx, gy = node["t"] * tile, node["m"] * tile
    w = node.get("w", 1.0) * tile * 0.62
    d = node.get("d", 1.0) * tile * 0.62
    cx, cy = gx + w / 2, gy + d / 2

    inset1, inset2 = w * 0.10, w * 0.20
    tone = node.get("tone", "core")

    # Ground shadow, then tray, slab, cap — painter's order is bottom-up.
    sh = [P(gx - 2, gy - 2), P(gx + w + 2, gy - 2), P(gx + w + 2, gy + d + 2), P(gx - 2, gy + d + 2)]
    parts = ['<polygon class="iso-shadow" points="%s" />' % pts(sh)]

    parts.append('<g class="iso-plate iso-plate--tray">%s</g>'
                 % box(gx, gy, w, d, 0, TRAY_H, "iso-tray"))

    z1 = TRAY_H + LIFT
    parts.append('<g class="iso-plate iso-plate--slab">%s</g>'
                 % box(gx + inset1, gy + inset1, w - 2 * inset1, d - 2 * inset1,
                       z1, SLAB_H, "iso-slab iso-slab--" + tone))

    z2 = z1 + SLAB_H + LIFT
    cap = box(gx + inset2, gy + inset2, w - 2 * inset2, d - 2 * inset2, z2, CAP_H,
              "iso-cap iso-cap--" + tone)
    glyph = node.get("glyph")
    if glyph:
        m = top_face_matrix(gx + inset2, gy + inset2, z2 + CAP_H)
        side = w - 2 * inset2
        cap += '<g class="iso-glyph" transform="%s">%s</g>' % (m, GLYPHS[glyph](side))
    parts.append('<g class="iso-plate iso-plate--cap">%s</g>' % cap)

    # Upright label above the chip, in plain screen space so it stays legible.
    # The cap projects to a diamond whose top corner sits this far above the
    # centre, so clear it before stacking the three label lines.
    lx, ly = P(cx, cy, z2 + CAP_H)
    clear = (w + d) * 0.25 + 26
    label = ['<g class="iso-label" transform="translate(%.2f,%.2f)">' % (lx, ly)]
    label.append('<text class="iso-kicker" x="0" y="%.1f">%s</text>'
                 % (-clear - 44, esc(node["kicker"])))
    label.append('<text class="iso-title" x="0" y="%.1f">%s</text>'
                 % (-clear - 22, esc(node["title"])))
    if node.get("sub"):
        label.append('<text class="iso-sub" x="0" y="%.1f">%s</text>'
                     % (-clear, esc(node["sub"])))
    # A short tick down to the cap's top corner, so a label can never be read
    # as belonging to the chip diagonally behind it.
    label.append('<line class="iso-leader" x1="0" y1="%.1f" x2="0" y2="%.1f" />'
                 % (-clear + 8, -(w + d) * 0.25 - 2))
    label.append("</g>")

    delay = node.get("delay", 0.0)
    return ('<g class="iso-chip iso-chip--%s" style="--d:%.2fs">%s%s</g>'
            % (tone, delay, "".join(parts), "".join(label)))


def stack_chip(node, tile):
    """A column of plates, one per field — the shared state drawn as what it
    actually is: a stack of layers that the pipeline fills in order."""
    gx, gy = node["t"] * tile, node["m"] * tile
    w = node.get("w", 1.0) * tile * 0.62
    d = node.get("d", 1.0) * tile * 0.62
    fields = node["fields"]
    ph, gap = 15.0, 11.0

    sh = [P(gx - 2, gy - 2), P(gx + w + 2, gy - 2), P(gx + w + 2, gy + d + 2), P(gx - 2, gy + d + 2)]
    parts = ['<polygon class="iso-shadow" points="%s" />' % pts(sh)]
    parts.append('<g class="iso-plate iso-plate--tray">%s</g>'
                 % box(gx, gy, w, d, 0, TRAY_H, "iso-tray"))

    labels = []
    for i, f in enumerate(fields):
        z = TRAY_H + LIFT + i * (ph + gap)
        parts.append('<g class="iso-plate iso-plate--field" style="--i:%d">%s</g>'
                     % (i, box(gx, gy, w, d, z, ph, "iso-slab iso-slab--data")))
        # Field name pinned to the plate's right corner, upright.
        ex, ey = P(gx + w, gy, z + ph)
        labels.append('<text class="iso-field" x="%.1f" y="%.1f">%s</text>'
                      % (ex + 14, ey + 4, esc(f)))

    top_z = TRAY_H + LIFT + len(fields) * (ph + gap)
    cx, cy = gx + w / 2, gy + d / 2
    lx, ly = P(cx, cy, top_z)
    clear = (w + d) * 0.25 + 20
    head = ['<g class="iso-label" transform="translate(%.2f,%.2f)">' % (lx, ly)]
    head.append('<text class="iso-kicker" x="0" y="%.1f">%s</text>' % (-clear - 22, esc(node["kicker"])))
    head.append('<text class="iso-title" x="0" y="%.1f">%s</text>' % (-clear, esc(node["title"])))
    head.append("</g>")

    return ('<g class="iso-chip iso-chip--stack" style="--d:%.2fs">%s<g class="iso-fields">%s</g>%s</g>'
            % (node.get("delay", 0.0), "".join(parts), "".join(labels), "".join(head)))


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# --------------------------------------------------------------------------
# Glyphs — drawn flat, then mapped onto the top face by top_face_matrix.
# --------------------------------------------------------------------------

def _g_window(s):
    p = s * 0.22
    return ('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" />'
            '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />'
            % (p, p, s - 2 * p, s - 2 * p, p, p + (s - 2 * p) * 0.28,
               s - p, p + (s - 2 * p) * 0.28))


def _g_bars(s):
    p, n = s * 0.24, 3
    gap = (s - 2 * p) / (2 * n - 1)
    out = []
    for i in range(n):
        x = p + i * 2 * gap
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="1.5" />'
                   % (x, p + (s - 2 * p) * (0.45 - 0.15 * i), gap, (s - 2 * p) * (0.55 + 0.15 * i)))
    return "".join(out)


def _g_disc(s):
    c, r = s / 2, s * 0.2
    return ('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" />'
            '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" />'
            % (c, c - r * 0.45, r, r * 0.45, c, c + r * 0.45, r, r * 0.45))


def _g_grid(s):
    p = s * 0.26
    out = []
    for i in range(3):
        for j in range(3):
            out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="1" />'
                       % (p + i * (s - 2 * p) / 3, p + j * (s - 2 * p) / 3,
                          (s - 2 * p) / 3 * 0.62, (s - 2 * p) / 3 * 0.62))
    return "".join(out)


def _g_node(s):
    c, r = s / 2, s * 0.20
    out = ['<circle cx="%.1f" cy="%.1f" r="%.1f" />' % (c, c, r * 0.42)]
    for a in (0, 120, 240):
        ax = c + r * math.cos(math.radians(a))
        ay = c + r * math.sin(math.radians(a))
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" />' % (ax, ay, r * 0.26))
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (c, c, ax, ay))
    return "".join(out)


def _g_bolt(s):
    c = s / 2
    k = s * 0.20
    return ('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" />'
            % (c + k * 0.2, c - k, c - k * 0.7, c + k * 0.15, c - k * 0.05, c + k * 0.15,
               c - k * 0.2, c + k, c + k * 0.7, c - k * 0.15, c + k * 0.05, c - k * 0.15))


GLYPHS = {"window": _g_window, "bars": _g_bars, "disc": _g_disc,
          "grid": _g_grid, "node": _g_node, "bolt": _g_bolt}


# --------------------------------------------------------------------------
# Wires — routed as right-angle traces in world space, which project to clean
# isometric runs, then measured so the CSS dash can travel their exact length.
# --------------------------------------------------------------------------

WIRE_Z = TRAY_H + 1.0


def wire_points(a, b, tile):
    w = 0.62 * tile
    ax, ay = a["t"] * tile + w / 2, a["m"] * tile + w / 2
    bx, by = b["t"] * tile + w / 2, b["m"] * tile + w / 2
    xm = (ax + bx) / 2
    world = [(ax, ay), (xm, ay), (xm, by), (bx, by)]
    return [P(x, y, WIRE_Z) for x, y in world]


def polylen(ps):
    return sum(math.dist(ps[i], ps[i + 1]) for i in range(len(ps) - 1))


def wire(a, b, tile, delay, cycle):
    ps = wire_points(a, b, tile)
    d = "M " + " L ".join("%.2f %.2f" % p for p in ps)
    L = polylen(ps)
    return (
        '<path class="iso-wire" d="%s" />'
        '<path class="iso-pulse" d="%s" style="--len:%.1f; animation-delay:%.2fs" />'
        % (d, d, L, delay)
    ), L


# --------------------------------------------------------------------------
# Assembly
# --------------------------------------------------------------------------

def build(spec):
    tile = spec["tile"]
    nodes = {n["id"]: n for n in spec["nodes"]}
    cycle = spec.get("cycle", 9.0)

    body = []

    # Ground grid, drawn as world-space lines so it sits under everything.
    tmin = min(n["t"] for n in spec["nodes"]) - 1
    tmax = max(n["t"] for n in spec["nodes"]) + 2
    mmin = min(n["m"] for n in spec["nodes"]) - 1
    mmax = max(n["m"] for n in spec["nodes"]) + 2
    g = []
    for i in range(tmin, tmax + 1):
        p1, p2 = P(i * tile, mmin * tile), P(i * tile, mmax * tile)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (p1[0], p1[1], p2[0], p2[1]))
    for j in range(mmin, mmax + 1):
        p1, p2 = P(tmin * tile, j * tile), P(tmax * tile, j * tile)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (p1[0], p1[1], p2[0], p2[1]))
    body.append('<g class="iso-grid">%s</g>' % "".join(g))

    # Wires under the chips.
    wires = []
    step = cycle / max(len(spec["wires"]), 1)
    for i, (src, dst) in enumerate(spec["wires"]):
        svg, _ = wire(nodes[src], nodes[dst], tile, i * step * 0.55, cycle)
        wires.append(svg)
    body.append('<g class="iso-wires">%s</g>' % "".join(wires))

    # Chips, painted back-to-front so nearer ones overlap correctly.
    order = sorted(spec["nodes"], key=lambda n: (n["t"] + n["m"]))
    for i, n in enumerate(order):
        n = dict(n)
        n["delay"] = i * 0.08
        body.append(stack_chip(n, tile) if n.get("fields") else chip(n, tile))

    # Fit the viewBox to everything that was drawn.
    xs, ys = [], []
    for n in spec["nodes"]:
        w = 0.62 * tile
        if n.get("fields"):
            ztop = TRAY_H + LIFT + len(n["fields"]) * (15.0 + 11.0)
        else:
            ztop = TRAY_H + LIFT + SLAB_H + LIFT + CAP_H
        for dx, dy in ((0, 0), (w, 0), (0, w), (w, w)):
            for z in (0, ztop):
                px, py = P(n["t"] * tile + dx, n["m"] * tile + dy, z)
                xs.append(px); ys.append(py)
        # The label stack rises above the chip; include it so the viewBox is
        # tight instead of padded by guesswork.
        cx, cy = n["t"] * tile + w / 2, n["m"] * tile + w / 2
        lx, ly = P(cx, cy, ztop)
        clear = (w + w) * 0.25 + 26
        ys.append(ly - clear - 44 - 14)
        xs.append(lx - len(n["title"]) * 5.6)
        xs.append(lx + len(n["title"]) * 5.6)
        # Field names run off the right edge of a stack.
        for f in n.get("fields", []):
            ex, _ = P(n["t"] * tile + w, n["m"] * tile, 0)
            xs.append(ex + 18 + len(f) * 8.0)
    pad_x, pad_top, pad_bot = 60, 34, 52
    x0, x1 = min(xs) - pad_x, max(xs) + pad_x
    y0, y1 = min(ys) - pad_top, max(ys) + pad_bot
    vb = "%.1f %.1f %.1f %.1f" % (x0, y0, x1 - x0, y1 - y0)

    return (
        '<svg class="nd-svg iso-svg" viewBox="%s" role="img" aria-label="%s" '
        'preserveAspectRatio="xMidYMid meet" style="--cycle: %.1fs">'
        '<title>%s</title>%s</svg>'
    ) % (vb, esc(spec["label"]), cycle, esc(spec["label"]), "".join(body))


# --------------------------------------------------------------------------
# Diagram specs
# --------------------------------------------------------------------------

GOODBOOKIES = dict(
    name="goodbookies-system",
    tile=330,
    cycle=9.0,
    label="Good Bookies system architecture: a React client talks to a Node "
          "application host, which owns Postgres, MySQL media stores and Razorpay",
    nodes=[
        dict(id="client", t=0, m=1, kicker="client", title="React 19 + TanStack Start",
             sub="SSR · routing · TanStack Query", glyph="window", tone="edge"),
        dict(id="host", t=1, m=1, kicker="application host", title="Hostinger Node.js",
             sub="typed server fns · mobile API · media", glyph="bolt", tone="core"),
        dict(id="pg", t=2, m=0, kicker="transactional truth", title="Supabase PostgreSQL",
             sub="users · venues · bookings · lobbies", glyph="disc", tone="data"),
        dict(id="mysql", t=2, m=1, kicker="binary media", title="Hostinger MySQL",
             sub="avatar and venue-media blobs", glyph="grid", tone="data"),
        dict(id="pay", t=2, m=2, kicker="payments", title="Razorpay",
             sub="orders · signatures · refunds", glyph="bars", tone="ext"),
    ],
    wires=[("client", "host"), ("host", "pg"), ("host", "mysql"), ("host", "pay")],
)

TRIALMATCH_ARCH = dict(
    name="trialmatch-arch",
    tile=300,
    cycle=10.0,
    label="TrialMatch system architecture: the browser talks only to the Next.js "
          "app, which rewrites to FastAPI modules over Postgres, Redis, the "
          "condition corpus, ClinicalTrials.gov and the Groq LLM",
    nodes=[
        dict(id="browser", t=0, m=1, kicker="client", title="Browser",
             sub=":3000 · JWT in localStorage", glyph="window", tone="edge"),
        dict(id="next", t=1, m=1, kicker="next.js 16", title="Next.js app",
             sub="/ · /search · /login · /api/* → :8000", glyph="bolt", tone="core"),
        dict(id="api", t=2, m=1, kicker="entry", title="main.py",
             sub="FastAPI :8000 · routes", glyph="node", tone="core"),
        dict(id="auth", t=3, m=0, kicker="module", title="auth/",
             sub="register · login", glyph="bars", tone="mod"),
        dict(id="users", t=3, m=1, kicker="module", title="users/",
             sub="history · saved", glyph="bars", tone="mod"),
        dict(id="cache", t=3, m=2, kicker="module", title="cache/",
             sub="cache · rate limit", glyph="bars", tone="mod"),
        dict(id="graph", t=3, m=3, kicker="module", title="LangGraph",
             sub="6-agent pipeline", glyph="node", tone="mod"),
        dict(id="pg", t=4, m=0, kicker="store", title="PostgreSQL",
             sub="users · history · saved", glyph="disc", tone="data"),
        dict(id="redis", t=4, m=1, kicker="store", title="Redis",
             sub="cache 1h · 30 req/min", glyph="disc", tone="data"),
        dict(id="corpus", t=4, m=2, kicker="store", title="corpus + embeddings",
             sub="500 conditions", glyph="grid", tone="data"),
        dict(id="ctg", t=4, m=3, kicker="external", title="ClinicalTrials.gov",
             sub="registry search", glyph="grid", tone="ext"),
        dict(id="groq", t=4, m=4, kicker="external", title="Groq LLM",
             sub="extraction · ranking", glyph="bolt", tone="ext"),
    ],
    wires=[("browser", "next"), ("next", "api"),
           ("api", "auth"), ("api", "users"), ("api", "cache"), ("api", "graph"),
           ("auth", "pg"), ("users", "pg"), ("cache", "redis"),
           ("graph", "corpus"), ("graph", "ctg"), ("graph", "groq")],
)

TRIALMATCH_AGENTS = dict(
    name="trialmatch-agents",
    tile=300,
    cycle=11.0,
    label="TrialMatch agent dataflow: six LangGraph agents run in order, each "
          "fed by one input or service, and each writing a single field of the "
          "shared TrialMatchState",
    nodes=[
        dict(id="a1", t=0, m=1, kicker="agent 01", title="extract_query",
             sub="condition · location · age", glyph="node", tone="core"),
        dict(id="a2", t=1, m=1, kicker="agent 02", title="patient_profile",
             sub="structured profile", glyph="node", tone="core"),
        dict(id="a3", t=2, m=1, kicker="agent 03", title="semantic_match",
             sub="condition matches", glyph="node", tone="core"),
        dict(id="a4", t=3, m=1, kicker="agent 04", title="fetch_trials",
             sub="raw trials", glyph="node", tone="core"),
        dict(id="a5", t=4, m=1, kicker="agent 05", title="filter_rank",
             sub="ranked trials", glyph="node", tone="core"),
        dict(id="a6", t=5, m=1, kicker="agent 06", title="explain_eligibility",
             sub="final results", glyph="node", tone="core"),

        dict(id="s1", t=0, m=0, kicker="input", title="patient query",
             sub="plain language", glyph="window", tone="edge"),
        dict(id="s2", t=1, m=0, kicker="external", title="Groq LLM",
             sub="extraction", glyph="bolt", tone="ext"),
        dict(id="s3", t=2, m=0, kicker="local model", title="MiniLM + corpus",
             sub="500 conditions", glyph="grid", tone="mod"),
        dict(id="s4", t=3, m=0, kicker="external API", title="ClinicalTrials.gov",
             sub="registry search", glyph="grid", tone="ext"),
        dict(id="s5", t=4, m=0, kicker="flagged off", title="cross-encoder rerank",
             sub="disabled in prod", glyph="bars", tone="ext"),

        dict(id="state", t=2, m=3, kicker="shared state", title="TrialMatchState",
             fields=["condition · location · age", "patient_profile",
                     "condition_matches", "raw_trials", "ranked_trials",
                     "final_results"]),
    ],
    wires=[("s1", "a1"), ("s2", "a2"), ("s3", "a3"), ("s4", "a4"), ("s5", "a5"),
           ("a1", "a2"), ("a2", "a3"), ("a3", "a4"), ("a4", "a5"), ("a5", "a6"),
           ("a6", "state")],
)

SPECS = [GOODBOOKIES, TRIALMATCH_ARCH, TRIALMATCH_AGENTS]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        svg = build(spec)
        path = OUT / (spec["name"] + ".svg")
        path.write_text(svg, encoding="utf-8")
        print("%-24s %6d bytes  %d nodes  %d wires"
              % (spec["name"], len(svg), len(spec["nodes"]), len(spec["wires"])))


if __name__ == "__main__":
    main()
