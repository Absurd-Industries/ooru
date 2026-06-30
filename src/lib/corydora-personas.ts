/**
 * CoryDora personas - each seed becomes a believable owner+firmware somewhere in the
 * world: a city, a craft, a switch feel, and 4 realistic keymap layers (no names - the
 * lore is place + craft + firmware). Pure data (mulberry32), so it costs nothing on the
 * GPU; a clicked unit's profile renders on the floor (frame-5 style).
 */
import { mulberry32 } from "./corydora-screens";

export interface Layer {
  app: string;
  keys: string[]; // exactly 9, row-major (0-2, 3-5, 6-8)
  enc: string;
}
export interface Persona {
  city: string;
  country: string;
  role: string;
  switchType: string;
  accent: string;
  layers: Layer[]; // 4
}

const CITIES: [string, string][] = [
  ["Tokyo", "JP"], ["Berlin", "DE"], ["Cairo", "EG"], ["São Paulo", "BR"], ["Mumbai", "IN"],
  ["New York", "US"], ["Seoul", "KR"], ["Lagos", "NG"], ["Lima", "PE"], ["Oslo", "NO"],
  ["Bengaluru", "IN"], ["Toronto", "CA"], ["Amsterdam", "NL"], ["Bangkok", "TH"], ["Mexico City", "MX"],
  ["Nairobi", "KE"], ["Istanbul", "TR"], ["Warsaw", "PL"], ["Taipei", "TW"], ["Melbourne", "AU"],
];
const SWITCHES = ["Cherry MX Red", "Cherry MX Brown", "Cherry MX Blue", "Gateron Yellow", "Gateron Brown", "Cherry MX Black"];

// role → primary craft + 4 layers, each { app, keys[9], enc }
const ROLES: { role: string; layers: Layer[] }[] = [
  { role: "Developer", layers: [
    { app: "VS Code", keys: ["Run", "Debug", "Format", "Find", "Cmd-P", "Term", "Git", "Comment", "Save"], enc: "Scroll" },
    { app: "Terminal", keys: ["ls", "cd", "grep", "git", "make", "ssh", "top", "clear", "exit"], enc: "Scroll" },
    { app: "Browser", keys: ["Back", "Fwd", "Reload", "New Tab", "Close", "Reopen", "Find", "Top", "Bottom"], enc: "Scroll" },
    { app: "Debug", keys: ["Step", "Over", "Out", "Cont", "Break", "Watch", "Eval", "Stack", "Restart"], enc: "Frame" },
  ] },
  { role: "Music Producer", layers: [
    { app: "Session", keys: ["Play", "Stop", "Rec", "Loop", "Metro", "Tap", "Undo", "Quant", "Arm"], enc: "Tempo" },
    { app: "Mixer", keys: ["Mute", "Solo", "Vol +", "Vol -", "Pan", "Send", "FX", "Bus", "Master"], enc: "Volume" },
    { app: "Devices", keys: ["EQ", "Comp", "Reverb", "Delay", "Filter", "Synth", "Macro", "Map", "Save"], enc: "Macro" },
    { app: "Transport", keys: ["<<", ">>", "Cue", "Mark", "In", "Out", "Crop", "Split", "Fade"], enc: "Scrub" },
  ] },
  { role: "Designer", layers: [
    { app: "Figma", keys: ["Frame", "Pen", "Text", "Group", "Align", "Mask", "Zoom", "Undo", "Export"], enc: "Zoom" },
    { app: "Vector", keys: ["Pen", "Bend", "Join", "Bool", "Outline", "Flatten", "Mirror", "Smooth", "Anchor"], enc: "Zoom" },
    { app: "Layout", keys: ["Grid", "Auto", "Pad", "Gap", "Stack", "Wrap", "Snap", "Distrib", "Lock"], enc: "Nudge" },
    { app: "Proto", keys: ["Link", "Flow", "Anim", "Delay", "Trigger", "Overlay", "Scroll", "Preview", "Reset"], enc: "Frame" },
  ] },
  { role: "Video Editor", layers: [
    { app: "Edit", keys: ["Cut", "Trim", "Ripple", "Roll", "Slip", "Slide", "Razor", "Snap", "Mark"], enc: "Scrub" },
    { app: "Color", keys: ["Lift", "Gamma", "Gain", "Sat", "Hue", "Curve", "Node", "Key", "Grab"], enc: "Wheel" },
    { app: "Audio", keys: ["Mute", "Solo", "Gain", "Fade", "Sync", "Norm", "Mark", "Mix", "Mon"], enc: "Volume" },
    { app: "Deliver", keys: ["In", "Out", "Render", "Preset", "Format", "Codec", "Queue", "Add", "Go"], enc: "Scrub" },
  ] },
  { role: "Gamer", layers: [
    { app: "Combat", keys: ["Atk", "Block", "Dodge", "Skill 1", "Skill 2", "Ult", "Heal", "Swap", "Lock"], enc: "Zoom" },
    { app: "Macros", keys: ["M1", "M2", "M3", "M4", "M5", "M6", "Combo", "Rotate", "Burst"], enc: "Sens" },
    { app: "Comms", keys: ["Push", "Mute", "Ping", "Mark", "Team", "All", "Mic", "Deafen", "Wheel"], enc: "Volume" },
    { app: "Stream", keys: ["Scene", "Cam", "Clip", "Pause", "Marker", "Chat", "Alert", "Mute", "Rec"], enc: "Volume" },
  ] },
  { role: "Streamer", layers: [
    { app: "Scenes", keys: ["Cam", "Game", "BRB", "Start", "End", "Chat", "Clip", "Mute", "Cut"], enc: "Volume" },
    { app: "Audio", keys: ["Mic", "Desk", "Music", "Mute", "Duck", "Mon", "Filter", "Push", "Solo"], enc: "Volume" },
    { app: "Sources", keys: ["Show", "Hide", "Move", "Resize", "Filter", "Order", "Lock", "Group", "Reset"], enc: "Nudge" },
    { app: "Alerts", keys: ["Follow", "Sub", "Tip", "Raid", "Host", "Clip", "Poll", "Timer", "Skip"], enc: "Volume" },
  ] },
  { role: "Writer", layers: [
    { app: "Format", keys: ["Bold", "Italic", "Under", "H1", "H2", "List", "Quote", "Link", "Code"], enc: "Scroll" },
    { app: "Navigate", keys: ["Top", "End", "Find", "Next", "Prev", "Outline", "Page", "Back", "Fwd"], enc: "Scroll" },
    { app: "Edit", keys: ["Cut", "Copy", "Paste", "Undo", "Redo", "Dup", "Del", "Select", "All"], enc: "Scroll" },
    { app: "Notes", keys: ["New", "Tag", "Pin", "Link", "Search", "Today", "Archive", "Move", "Sync"], enc: "Scroll" },
  ] },
  { role: "3D Artist", layers: [
    { app: "Model", keys: ["Extrude", "Bevel", "Loop", "Knife", "Merge", "Subdiv", "Mirror", "Solid", "Shade"], enc: "Zoom" },
    { app: "Sculpt", keys: ["Draw", "Grab", "Smooth", "Inflate", "Pinch", "Crease", "Mask", "Sym", "Size"], enc: "Strength" },
    { app: "Shade", keys: ["Node", "Mix", "Tex", "UV", "Bake", "Preview", "Render", "Mat", "Assign"], enc: "Value" },
    { app: "Anim", keys: ["Key", "Frame", "Play", "Loop", "Onion", "Graph", "Bone", "IK", "Bake"], enc: "Frame" },
  ] },
  { role: "Photographer", layers: [
    { app: "Develop", keys: ["Exp", "Contrast", "High", "Shadow", "White", "Black", "Clarity", "Vib", "Sat"], enc: "Slider" },
    { app: "Tone", keys: ["Curve", "HSL", "Split", "Grade", "Calib", "Profile", "Auto", "Reset", "Sync"], enc: "Slider" },
    { app: "Local", keys: ["Brush", "Grad", "Radial", "Heal", "Mask", "Range", "Invert", "Erase", "Done"], enc: "Size" },
    { app: "Library", keys: ["Pick", "Reject", "Flag", "Star", "Color", "Sort", "Filter", "Export", "Compare"], enc: "Scroll" },
  ] },
  { role: "Sysadmin", layers: [
    { app: "Shell", keys: ["ls", "cd", "grep", "tail", "ps", "kill", "sudo", "clear", "hist"], enc: "Scroll" },
    { app: "K8s", keys: ["get", "desc", "logs", "exec", "apply", "del", "scale", "ctx", "ns"], enc: "Scroll" },
    { app: "Monitor", keys: ["top", "htop", "df", "free", "net", "io", "watch", "alert", "ack"], enc: "Scroll" },
    { app: "Deploy", keys: ["build", "push", "pull", "up", "down", "restart", "roll", "status", "diff"], enc: "Scroll" },
  ] },
];

export function personaForSeed(seed: number): Persona {
  const r = mulberry32(seed >>> 0);
  const [city, country] = CITIES[(r() * CITIES.length) | 0];
  const role = ROLES[(r() * ROLES.length) | 0];
  return {
    city, country,
    role: role.role,
    switchType: SWITCHES[(r() * SWITCHES.length) | 0],
    accent: "#5fdcff",
    layers: role.layers,
  };
}

// ── frame-5 on the floor: persona header + active layer (app / encoder / 3x3 grid) ──
const CYAN = "#5fdcff";
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** A transparent, glowing HUD (512x560) that hovers flat OVER the keys: persona
 *  header + the active layer's app/encoder + a 3x3 keymap aligned over the keys. */
export function drawProfileHover(c: CanvasRenderingContext2D, W: number, H: number, p: Persona, layerIdx: number) {
  const L = p.layers[layerIdx];
  c.clearRect(0, 0, W, H); // transparent - only the glowing marks show over the keys
  c.shadowColor = CYAN; c.shadowBlur = 12; // neon glow
  c.textAlign = "left"; c.textBaseline = "top";
  // header
  c.fillStyle = "#ff9a5c"; c.font = '800 24px "DM Sans", sans-serif';
  c.fillText(`${p.city.toUpperCase()} · ${p.country} · ${p.role.toUpperCase()}`, 30, 18);
  c.fillStyle = CYAN; c.font = '800 46px "Fraunces", serif';
  c.fillText(L.app, 30, 50);
  c.fillStyle = "rgba(95,220,255,0.8)"; c.font = '600 22px "DM Sans", sans-serif';
  c.fillText(`layer ${layerIdx + 1} / ${p.layers.length}  ·  ${p.switchType}`, 30, 106);
  // encoder, top-right (over the knob)
  c.textAlign = "right"; c.fillStyle = "#ff9a5c"; c.font = '700 24px "DM Sans", sans-serif';
  c.fillText(`↻ ${L.enc}`, W - 30, 22);
  c.textAlign = "left";
  // 3x3 glowing keymap, aligned over the 9 keys
  const gs = 360, gx = (W - gs) / 2, gy = 170, cell = gs / 3;
  c.strokeStyle = CYAN; c.lineWidth = 2.5;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const x = gx + col * cell, y = gy + row * cell;
    c.globalAlpha = 0.45; rr(c, x + 8, y + 8, cell - 16, cell - 16, 14); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = CYAN; c.font = '700 26px "DM Sans", sans-serif';
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(L.keys[row * 3 + col], x + cell / 2, y + cell / 2);
    c.textAlign = "left"; c.textBaseline = "top";
  }
  c.shadowBlur = 0;
}
/** Focused unit's OLED: 4 layer tabs (active highlighted), like the "via" screen. */
export function drawProfileOled(c: CanvasRenderingContext2D, W: number, H: number, active: number, n = 4) {
  c.fillStyle = "#02070d"; c.fillRect(0, 0, W, H);
  c.strokeStyle = CYAN; c.fillStyle = CYAN;
  const pad = W * 0.07, slot = (W - pad * 2) / n, sq = Math.min(slot * 0.72, H * 0.66);
  c.textAlign = "center"; c.textBaseline = "middle"; c.font = `700 ${Math.round(sq * 0.5)}px "DM Sans", sans-serif`;
  for (let i = 0; i < n; i++) {
    const cx = pad + slot * i + slot / 2, cy = H / 2;
    c.lineWidth = Math.max(2, sq * 0.09);
    rr(c, cx - sq / 2, cy - sq / 2, sq, sq, sq * 0.24);
    if (i === active) { c.fillStyle = CYAN; c.fill(); c.fillStyle = "#02070d"; c.fillText(String(i + 1), cx, cy + 1); c.fillStyle = CYAN; }
    else { c.globalAlpha = 0.55; c.stroke(); c.fillText(String(i + 1), cx, cy + 1); c.globalAlpha = 1; }
  }
}
