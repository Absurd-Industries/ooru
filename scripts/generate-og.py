#!/usr/bin/env python3
"""
Generate the site's Open Graph / social images (1200x630).

macOS-only: rasterizes SVG via QuickLook (`qlmanage`) and resizes with
`sips`. Renders at 2x then downscales for crisp text + photos.

Run from the repo root:  python3 scripts/generate-og.py
Re-run whenever campaigns change, or the branding/banners are updated.

Outputs (all production JPGs, kept under ~300 KB):
  public/og/default.jpg                 - site default (campaign-photo collage)
  public/og/{campaigns,makers,requests,events,faq}.jpg  - section banners
  public/og/campaigns/<slug>.jpg        - per-campaign "polaroid card"
"""
import base64, html, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "og")
WORK = "/tmp/ogwork"
os.makedirs(os.path.join(OUT, "campaigns"), exist_ok=True)
os.makedirs(WORK, exist_ok=True)

KRAFT = "#D4B896"; INK = "#1A1A1A"; PAPER = "#FAF3E8"; STAMP = "#FF5900"
STENCIL = "#6B5B4A"; KRAFTLT = "#E7D8BD"
WORD = 'font-family="Montserrat, &apos;Arial Black&apos;, sans-serif" font-weight="900"'
SERIF = 'font-family="Fraunces, Georgia, serif" font-weight="700"'
SANS = 'font-family="&apos;DM Sans&apos;, Helvetica, sans-serif"'
# soft drop shadow so cream polaroids lift off the cardboard
SHADOW = ('<filter id="psh" x="-30%" y="-30%" width="160%" height="160%">'
          '<feDropShadow dx="0" dy="7" stdDeviation="11" flood-color="#1A1A1A" '
          'flood-opacity="0.22"/></filter>')
# Real kraft-paper texture - the exact JPG the site tiles as its <body>
# background. Tiled as an SVG pattern at native size so it stays crisp when
# the whole banner is rendered at 2x. KRAFT_TEX is filled in below b64().
KRAFT_TEX = None  # set after b64() is defined

def kraft_defs():
    return (f'<pattern id="kraft" patternUnits="userSpaceOnUse" width="539" height="360">'
            f'<rect width="539" height="360" fill="{KRAFT}"/>'
            f'<image xlink:href="data:image/jpeg;base64,{KRAFT_TEX}" width="539" height="360"/>'
            f'</pattern>')

def kraft_bg(w=1200, h=630):
    """Full-canvas kraft paper background (tiled real texture)."""
    return f'<rect width="{w}" height="{h}" fill="url(#kraft)"/>'

_uid = [0]
def uid():
    _uid[0] += 1
    return f"c{_uid[0]}"

def esc(s):
    return html.escape(str(s), quote=True)

def b64(path, w=None):
    src = path
    if w:
        dst = os.path.join(WORK, f"{os.path.basename(path)}.{w}.jpg")
        subprocess.run(["sips", "--resampleWidth", str(w), path, "--out", dst],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(dst):
            src = dst
    with open(src, "rb") as f:
        return base64.b64encode(f.read()).decode()

def wrap(text, maxchars):
    out, cur = [], ""
    for w in text.split():
        if len(cur) + len(w) + 1 <= maxchars:
            cur = (cur + " " + w).strip()
        else:
            out.append(cur); cur = w
    if cur:
        out.append(cur)
    return out

def render(svg, outpath, jpg=False, q=82):
    """Render an 1200x630 SVG at 2x then downscale for crispness."""
    svgp = os.path.join(WORK, os.path.basename(outpath) + ".svg")
    with open(svgp, "w") as f:
        f.write(svg)
    subprocess.run(["qlmanage", "-t", "-s", "2400", svgp, "-o", WORK],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sq = svgp + ".png"
    if not os.path.exists(sq):
        print("FAILED", outpath); return
    crop = os.path.join(WORK, "crop.png")
    subprocess.run(["sips", "-c", "1260", "2400", sq, "--out", crop],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if jpg:
        tmp = os.path.join(WORK, "small.png")
        subprocess.run(["sips", "--resampleWidth", "1200", crop, "--out", tmp],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(q),
                        tmp, "--out", outpath],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.run(["sips", "--resampleWidth", "1200", crop, "--out", outpath],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("ok", os.path.relpath(outpath, ROOT))

def wordmark(x, y, size, light=False, anchor="start"):
    col = PAPER if light else INK
    return (f'<text x="{x}" y="{y}" {WORD} font-size="{size}" fill="{col}" '
            f'text-anchor="{anchor}" letter-spacing="-2">'
            f'ooru<tspan fill="{STAMP}">.</tspan>build</text>')

def octagon(cx, cy, s):
    h = s / 2; i = s * 0.22
    pts = [(cx-h+i, cy-h), (cx+h-i, cy-h), (cx+h, cy-h+i), (cx+h, cy+h-i),
           (cx+h-i, cy+h), (cx-h+i, cy+h), (cx-h, cy+h-i), (cx-h, cy-h+i)]
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)

def avatar_octagon(cx, cy, s, avatar_b64=None, initials="", color="#000"):
    """Octagonal avatar: real photo clipped into the octagon, or initials."""
    pts = octagon(cx, cy, s)
    if avatar_b64:
        cid = uid()
        return (f'<clipPath id="{cid}"><polygon points="{pts}"/></clipPath>'
                f'<polygon points="{pts}" fill="{esc(color)}"/>'
                f'<image xlink:href="data:image/jpeg;base64,{avatar_b64}" '
                f'x="{cx-s/2:.1f}" y="{cy-s/2:.1f}" width="{s:.1f}" height="{s:.1f}" '
                f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{cid})"/>')
    return (f'<polygon points="{pts}" fill="{esc(color)}"/>'
            f'<text x="{cx}" y="{cy + s*0.16:.0f}" {SERIF} font-size="{s*0.43:.0f}" '
            f'fill="{PAPER}" text-anchor="middle">{esc(initials)}</text>')

def find_avatar(slug):
    """Return a path to a maker's avatar image if one exists, else None."""
    if not slug:
        return None
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = os.path.join(ROOT, "public/images/makers", slug + ext)
        if os.path.exists(p):
            return p
    return None

def polaroid(b64data, x, y, w, rot, caption=None):
    """A cream polaroid: photo on top, optional project-name caption below."""
    # Fatter cream frame so the photo never bleeds to the card edge.
    border = max(16, round(w * 0.055))
    photo = w - border * 2
    cap_h = round(border * 1.4)
    cap = ""
    if caption:
        # wrap to at most 2 lines, clamped to the photo width
        maxc = max(10, int(photo / 11))
        lines = wrap(caption, maxc)[:2]
        fsize = 21 if len(lines) == 1 else 18
        line_h = fsize + 5
        cap_h = round(border * 0.7) + len(lines) * line_h + round(border * 0.5)
        cap_y = y + border + photo + round(border * 0.7) + fsize
        spans = "".join(
            f'<tspan x="{x + w/2:.0f}" dy="{0 if i==0 else line_h}">{esc(l)}</tspan>'
            for i, l in enumerate(lines))
        cap = (f'<text x="{x + w/2:.0f}" y="{cap_y:.0f}" {SERIF} '
               f'font-size="{fsize}" fill="{INK}" text-anchor="middle">{spans}</text>')
    total = photo + border * 2 + cap_h
    cx, cy = x + w / 2, y + total / 2
    cid = uid()
    return f'''<g transform="rotate({rot} {cx:.0f} {cy:.0f})">
    <rect x="{x}" y="{y}" width="{w}" height="{total}" rx="12" fill="{PAPER}" filter="url(#psh)"/>
    <clipPath id="{cid}"><rect x="{x+border}" y="{y+border}" width="{photo}" height="{photo}" rx="7"/></clipPath>
    <image xlink:href="data:image/jpeg;base64,{b64data}" x="{x+border}" y="{y+border}" width="{photo}" height="{photo}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{cid})"/>
    {cap}
  </g>'''

# ── parse campaigns ─────────────────────────────────────────────────
data = open(os.path.join(ROOT, "src/data/campaigns.ts")).read()
def field(block, key):
    m = re.search(key + r':\s*"([^"]*)"', block)
    return m.group(1) if m else ""
campaigns = []
for b in re.split(r"\n\s*\{", data):
    slug = field(b, "slug"); img = field(b, "image")
    if not slug or not img:
        continue
    p = os.path.join(ROOT, "public" + img)
    if not os.path.exists(p):
        continue
    campaigns.append(dict(slug=slug, title=field(b, "title"), tagline=field(b, "tagline"),
                          maker=field(b, "makerName"), makerSlug=field(b, "makerSlug"),
                          loc=field(b, "location"),
                          color=field(b, "avatarColor") or "#B74803", path=p))

TOOLS = b64(os.path.join(ROOT, "public/images/graphics/tools-circle.png"))
KRAFT_TEX = b64(os.path.join(ROOT, "public/images/kraft-paper.jpg"))

# ── campaign "polaroid card" banners ────────────────────────────────
for c in campaigns:
    initials = "".join(w[0] for w in c["maker"].split()[:2]).upper()
    photo = b64(c["path"], 760)
    avatar_path = find_avatar(c["makerSlug"])
    avatar_b64 = b64(avatar_path, 180) if avatar_path else None
    tl = wrap(c["title"], 17)[:3]
    tsize = 66 if len(tl) <= 2 else 54
    title_spans = "".join(
        f'<tspan x="92" dy="{0 if i==0 else tsize+4}">{esc(l)}</tspan>'
        for i, l in enumerate(tl))
    title_y = 312
    blurb = wrap(c["tagline"], 42)[:2]
    blurb_y = title_y + (len(tl) - 1) * (tsize + 4) + 56
    blurb_spans = "".join(
        f'<tspan x="92" dy="{0 if i==0 else 34}">{esc(l)}</tspan>'
        for i, l in enumerate(blurb))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630">
  <defs>{SHADOW}{kraft_defs()}</defs>
  {kraft_bg()}
  {polaroid(photo, 726, 112, 386, 4, caption=c["title"])}
  {avatar_octagon(122, 124, 60, avatar_b64, initials, c['color'])}
  <text x="170" y="116" {SANS} font-weight="700" font-size="28" fill="{INK}">{esc(c['maker'])}</text>
  <text x="170" y="146" {SANS} font-size="21" fill="{STENCIL}">{esc(c['loc'])}</text>
  <text x="92" y="{title_y}" {SERIF} font-size="{tsize}" fill="{INK}">{title_spans}</text>
  <text x="92" y="{blurb_y}" {SANS} font-size="27" fill="{STENCIL}">{blurb_spans}</text>
  {wordmark(1108, 598, 34, light=False, anchor="end")}
</svg>'''
    render(svg, os.path.join(OUT, "campaigns", c["slug"] + ".jpg"), jpg=True)

# ── default banner: crisp campaign-photo polaroid collage ───────────
collage = campaigns[:3]
photos = [b64(c["path"], 520) for c in collage]
# diagonal fan of cream polaroids on the right half; each captioned
scatter = [(648, 26, 232, -7), (892, 104, 224, 6), (726, 318, 232, 3)]
poladefs = "".join(
    polaroid(photos[i], *scatter[i], caption=collage[i]["title"])
    for i in range(min(len(photos), len(scatter)))
)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630">
  <defs>{SHADOW}{kraft_defs()}</defs>
  {kraft_bg()}
  {poladefs}
  {wordmark(80, 258, 92)}
  <text x="84" y="336" {SERIF} font-size="38" fill="{INK}">Your community for</text>
  <text x="84" y="386" {SERIF} font-size="38" fill="{INK}">open-source hardware</text>
  <text x="84" y="452" {SANS} font-weight="500" font-size="27" fill="{STENCIL}">Back real projects. Get every file.</text>
</svg>'''
render(svg, os.path.join(OUT, "default.jpg"), jpg=True)

# ── section banners: kraft + ink accent panel ──────────────────────
sections = {
  "campaigns": ("Campaigns", "Back open hardware that ships with everything you need to build, fix, or improve it."),
  "makers": ("Makers", "Meet the people who build real things and share exactly how they're made."),
  "requests": ("Requests", "Suggest something that should exist. The community shapes it and a maker builds it."),
  "events": ("Events", "Meetups, workshops, and talks for curious people - starting in Bengaluru."),
  "faq": ("FAQ", "Everything you need to know about Ooru and how it works."),
}
for slug, (title, tagline) in sections.items():
    tag_spans = "".join(f'<tspan x="92" dy="{0 if i==0 else 38}">{esc(l)}</tspan>'
                        for i, l in enumerate(wrap(tagline, 48)))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630">
  <defs>{kraft_defs()}</defs>
  {kraft_bg()}
  <image xlink:href="data:image/png;base64,{TOOLS}" x="772" y="158" width="452" height="452" opacity="0.95"/>
  {wordmark(92, 150, 44, light=False)}
  <text x="92" y="330" {SERIF} font-size="104" fill="{INK}">{esc(title)}</text>
  <text x="92" y="410" {SANS} font-size="30" fill="{STENCIL}">{tag_spans}</text>
</svg>'''
    render(svg, os.path.join(OUT, slug + ".jpg"), jpg=True)

print(f"\nDone: {len(campaigns)} campaign cards + default + {len(sections)} sections")
