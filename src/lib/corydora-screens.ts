/**
 * Generative CoryDora OLED screens (128×32, cyan-on-dark like the real screen).
 *
 * Each `seed` renders a different person's macropad somewhere in the world - a
 * different script, app, layer, art doodle, symbol set or game. Used by the footer
 * "sea" (a unique seed per unit) and by the story's first frame (cycling seeds).
 *
 * `drawScreen(ctx, W, H, seed, t)` is deterministic per seed; `t` (seconds) drives
 * the little bit of life (a blinking cursor, a moving ball, a ticking clock).
 */
export const OLED_CYAN = "#5fdcff";
export const OLED_BG = "#02070d";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── content banks (the "who's using it") ──
const GREETINGS = ["Hello", "こんにちは", "你好", "안녕", "Привет", "مرحبا", "नमस्ते", "Bonjour", "Hola", "Olá", "Ciao", "Hallo", "สวัสดี", "Γειά", "שלום", "Merhaba", "Xin chào", "Salam"];
const USES = [
  { word: "CODE", icon: "</>" }, { word: "コード", icon: "λ" }, { word: "MUSIC", icon: "♪" },
  { word: "演奏", icon: "♬" }, { word: "ART", icon: "✦" }, { word: "فن", icon: "✺" },
  { word: "GAME", icon: "✚" }, { word: "EDIT", icon: "✂" }, { word: "ФОТО", icon: "◉" },
  { word: "디자인", icon: "◇" }, { word: "WRITE", icon: "✎" }, { word: "STREAM", icon: "▶" },
  { word: "3D", icon: "◈" }, { word: "MIX", icon: "▥" },
];
const APPS = ["VS Code", "Figma", "Blender", "Ableton", "DaVinci", "Notion", "OBS", "Krita", "Logic", "Unity", "Godot", "Terminal", "Photoshop", "Premiere", "Reaper"];
const CITIES = [["Tokyo", "09:24"], ["Berlin", "02:24"], ["Cairo", "03:24"], ["São Paulo", "22:24"], ["Mumbai", "06:54"], ["NYC", "20:24"], ["Seoul", "10:24"], ["Lagos", "02:24"], ["Lima", "20:24"], ["Oslo", "02:24"]];
const TRACKS = ["夜に駆ける", "Strobe", "Midnight City", "Тает лёд", "Solar", "Bangarang", "Redbone", "Teardrop", "Aérea", "Levels"];
const CMDS = ["git push", "make run", "npm dev", "ssh prod", "vim .", "docker up", "cargo b", "k apply"];
const SYMBOLS = "★✦✕◆⬡→λ♪♬∑∆∞≈π§☼✺❄♔∂∇⊕⌘⏎⇧⌥".split("");

function pick<T>(r: () => number, a: T[]): T { return a[(r() * a.length) | 0]; }

export function drawScreen(c: CanvasRenderingContext2D, W: number, H: number, seed: number, t = 0) {
  const r = mulberry32(seed);
  c.fillStyle = OLED_BG; c.fillRect(0, 0, W, H);
  c.fillStyle = OLED_CYAN; c.strokeStyle = OLED_CYAN; c.globalAlpha = 1; c.lineWidth = 1;
  const kind = (r() * 11) | 0;

  if (kind === 0) {                                   // greeting in a random script
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = '700 16px "DM Sans", system-ui, sans-serif';
    c.fillText(pick(r, GREETINGS), W / 2, H / 2 + 1);
  } else if (kind === 1) {                            // app + use + icon
    const u = pick(r, USES);
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.globalAlpha = 0.7; c.font = '400 8px monospace'; c.fillText(pick(r, APPS), 4, 9); c.globalAlpha = 1;
    c.font = '800 16px "DM Sans", system-ui, sans-serif'; c.fillText(u.word, 4, H - 5);
    c.textAlign = "right"; c.font = '700 16px monospace'; c.fillText(u.icon, W - 5, H - 6);
  } else if (kind === 2) {                            // now playing
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.font = '700 11px monospace'; c.fillText("♪", 4, 12);
    const track = pick(r, TRACKS); c.font = '400 9px "DM Sans", system-ui, sans-serif';
    const tw = c.measureText(track).width;
    const sx = tw > W - 18 ? -((t * 14) % (tw + 20)) + 18 : 18;
    c.save(); c.beginPath(); c.rect(16, 2, W - 18, 14); c.clip(); c.fillText(track, sx, 12); c.restore();
    const p = (t * 0.06) % 1; c.globalAlpha = 0.4; c.fillRect(4, H - 5, W - 8, 2); c.globalAlpha = 1; c.fillRect(4, H - 5, (W - 8) * p, 2);
  } else if (kind === 3) {                            // world clock
    const [city, time] = pick(r, CITIES);
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    const blink = Math.floor(t * 2) % 2 ? ":" : " ";
    c.font = '700 17px monospace'; c.fillText(time.replace(":", blink), 4, H - 9);
    c.globalAlpha = 0.7; c.font = '400 8px "DM Sans", system-ui, sans-serif'; c.fillText(city, 4, H - 2); c.globalAlpha = 1;
  } else if (kind === 4) {                            // symbol grid
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = '12px monospace';
    const cols = 8, rows = 2;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      c.globalAlpha = r() < 0.85 ? 1 : 0.3;
      c.fillText(pick(r, SYMBOLS), (x + 0.5) * (W / cols), (y + 0.5) * (H / rows) + 1);
    }
    c.globalAlpha = 1;
  } else if (kind === 5) {                            // layer 3×3 + label
    const u = pick(r, USES); const active = (Math.floor(t) + ((r() * 9) | 0)) % 9;
    c.textAlign = "left"; c.textBaseline = "middle"; c.font = '800 13px "DM Sans", system-ui, sans-serif';
    c.fillText(u.word, 4, H / 2);
    const gx = W - 30, cell = 9;
    for (let i = 0; i < 9; i++) { const px = gx + (i % 3) * cell, py = 3 + ((i / 3) | 0) * cell;
      if (i === active) c.fillRect(px, py, cell - 2, cell - 2); else { c.globalAlpha = 0.5; c.strokeRect(px + 0.5, py + 0.5, cell - 3, cell - 3); c.globalAlpha = 1; } }
  } else if (kind === 6) {                            // terminal
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.font = '400 9px monospace';
    c.globalAlpha = 0.7; c.fillText("user@cory:~$", 4, 11); c.globalAlpha = 1;
    const cmd = pick(r, CMDS); c.fillText(cmd, 4, 24);
    if (Math.floor(t * 2) % 2) c.fillRect(4 + c.measureText(cmd).width + 1, 17, 5, 8);
  } else if (kind === 7) {                            // generative art (rotating motif)
    const cx = W / 2, cy = H / 2, rot = t * 0.6 + r() * 6, n = 3 + ((r() * 4) | 0);
    c.lineWidth = 1; c.globalAlpha = 0.9;
    for (let k = 0; k < n; k++) {
      const rad = 4 + k * 4.5, a0 = rot + k * 0.5;
      c.beginPath();
      for (let s = 0; s <= 6; s++) { const a = a0 + (s / 6) * Math.PI * 2; const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.85; s === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.closePath(); c.stroke();
    }
    c.globalAlpha = 1;
  } else if (kind === 8) {                            // sparkline + stat
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.globalAlpha = 0.7; c.font = '400 8px monospace';
    c.fillText(pick(r, ["CPM", "APM", "WPM", "FPS", "BPM"]), 4, 9); c.globalAlpha = 1;
    c.font = '700 12px monospace'; c.fillText(String(40 + ((r() * 160) | 0)), 4, H - 4);
    c.beginPath(); const base = r() * 6;
    for (let x = 0; x <= W - 40; x++) { const y = H / 2 + Math.sin(x * 0.3 + base + t) * 6 * Math.sin(x * 0.05 + base) ; x === 0 ? c.moveTo(40 + x, y) : c.lineTo(40 + x, y); }
    c.stroke();
  } else if (kind === 9) {                            // pong
    const by = 5 + tri(t * 0.4 + r()) * (H - 10), bx = 5 + tri(t * 0.55 + r()) * (W - 10);
    c.globalAlpha = 0.35; for (let y = 2; y < H; y += 5) c.fillRect(W / 2 - 0.5, y, 1, 2); c.globalAlpha = 1;
    c.fillRect(2, by - 5, 2, 10); c.fillRect(W - 4, by - 5, 2, 10); c.fillRect(bx - 1, by - 1, 2, 2);
  } else {                                            // matrix rain
    c.font = "8px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    const cols = 16, cw = W / cols, off = (r() * 100) | 0;
    for (let i = 0; i < cols; i++) {
      const head = ((t * (7 + ((i * 5) % 4) * 4) + i * 13 + off) % (H + 16)) - 8;
      for (let k = 0; k < 3; k++) { const y = head - k * 9; if (y < 0 || y > H) continue; c.globalAlpha = 1 - k * 0.35;
        c.fillText(String.fromCharCode(33 + ((Math.floor(t * 8) + i * 3 + k * 7 + off) % 60)), i * cw + cw / 2, y); }
    }
    c.globalAlpha = 1;
  }
}

function tri(x: number): number { const f = x - Math.floor(x); return f < 0.5 ? f * 2 : 2 - f * 2; }
