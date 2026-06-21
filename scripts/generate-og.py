#!/usr/bin/env python3
"""
Generate the site's Open Graph / social images (1200x630).

macOS-only: rasterizes SVG via QuickLook (`qlmanage`) and resizes with
`sips`. Renders at 2x then downscales for crisp text + photos.

Run from the repo root:  python3 scripts/generate-og.py
Re-run whenever campaigns change, or the branding/banners are updated.

Outputs:
  public/og/default.png                 - site default (campaign-photo collage)
  public/og/{campaigns,makers,requests,events,faq}.png  - section banners
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

def polaroid(b64data, x, y, w, rot, caption=None):
    """A cream polaroid: photo on top, optional project-name caption below."""
    photo = w - 24
    cap_h = 52 if caption else 26
    total = photo + 24 + cap_h
    cx, cy = x + w / 2, y + total / 2
    cid = uid()
    cap = ""
    if caption:
        maxc = max(10, int(w / 12))
        txt = caption if len(caption) <= maxc else caption[: maxc - 1].rstrip() + "…"
        cap = (f'<text x="{x + w/2:.0f}" y="{y + photo + 12 + 33:.0f}" {SERIF} '
               f'font-size="23" fill="{INK}" text-anchor="middle">{esc(txt)}</text>')
    return f'''<g transform="rotate({rot} {cx:.0f} {cy:.0f})">
    <rect x="{x}" y="{y}" width="{w}" height="{total}" rx="12" fill="{PAPER}" filter="url(#psh)"/>
    <clipPath id="{cid}"><rect x="{x+12}" y="{y+12}" width="{photo}" height="{photo}" rx="7"/></clipPath>
    <image xlink:href="data:image/jpeg;base64,{b64data}" x="{x+12}" y="{y+12}" width="{photo}" height="{photo}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{cid})"/>
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
                          maker=field(b, "makerName"), loc=field(b, "location"),
                          color=field(b, "avatarColor") or "#B74803", path=p))

TOOLS = b64(os.path.join(ROOT, "public/images/graphics/tools-circle.png"))

# ── campaign "polaroid card" banners ────────────────────────────────
for c in campaigns:
    initials = "".join(w[0] for w in c["maker"].split()[:2]).upper()
    photo = b64(c["path"], 760)
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
  <defs>{SHADOW}</defs>
  <rect width="1200" height="630" fill="{KRAFT}"/>
  {polaroid(photo, 726, 112, 386, 4, caption=c["title"])}
  <polygon points="{octagon(122, 124, 60)}" fill="{esc(c['color'])}"/>
  <text x="122" y="134" {SERIF} font-size="26" fill="{PAPER}" text-anchor="middle">{esc(initials)}</text>
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
  <defs>{SHADOW}</defs>
  <rect width="1200" height="630" fill="{KRAFT}"/>
  {poladefs}
  {wordmark(80, 258, 92)}
  <text x="84" y="336" {SERIF} font-size="38" fill="{INK}">Your community for</text>
  <text x="84" y="386" {SERIF} font-size="38" fill="{INK}">open-source hardware</text>
  <text x="84" y="452" {SANS} font-weight="500" font-size="27" fill="{STENCIL}">Back real projects. Get every file.</text>
</svg>'''
render(svg, os.path.join(OUT, "default.png"))

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
  <rect width="1200" height="630" fill="{KRAFT}"/>
  <image xlink:href="data:image/png;base64,{TOOLS}" x="772" y="158" width="452" height="452" opacity="0.95"/>
  {wordmark(92, 150, 44, light=False)}
  <text x="92" y="330" {SERIF} font-size="104" fill="{INK}">{esc(title)}</text>
  <text x="92" y="410" {SANS} font-size="30" fill="{STENCIL}">{tag_spans}</text>
</svg>'''
    render(svg, os.path.join(OUT, slug + ".png"))

print(f"\nDone: {len(campaigns)} campaign cards + default + {len(sections)} sections")
