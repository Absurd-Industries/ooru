/**
 * CoryDora customizable parts - shared between the 3D viewer (ModelExperience),
 * the rich customizer UI (CoryDoraExperience), and the opening field hero.
 * A part can drive several meshes (the case = both plates).
 *
 * The printed parts (case / trim / keycaps / knob) use the real Numakers PLA
 * filament catalogue - the colours CoryDora actually ships in. Switches stay as
 * mechanical (Cherry/Gateron) options.
 */
export interface PartOpt {
  label: string;
  color: string;
  /** Optional detail shown as a tooltip + caption (e.g. for switches). */
  desc?: string;
}
export interface PartCfg {
  id: string;
  label: string;
  meshes: string[];
  options: PartOpt[];
}

// Numakers PLA filament colours (name + hex, from their store). One catalogue
// shared by every printed part.
export const NUMAKERS: PartOpt[] = [
  { label: "Pitch Black", color: "#0E0E10" },
  { label: "Pure White", color: "#F1ECE1" },
  { label: "Lemon Yellow", color: "#F9A800" },
  { label: "Mauve Purple", color: "#844C82" },
  { label: "Nuclear Red", color: "#BB1E10" },
  { label: "Imperial Red", color: "#6E0B05" },
  { label: "Outrageous Orange", color: "#E25303" },
  { label: "Atomic Pink", color: "#D8A0A6" },
  { label: "Royal Blue", color: "#00387B" },
  { label: "Light Gray", color: "#8C969D" },
  { label: "Light Blue", color: "#007CB0" },
  { label: "Grass Green", color: "#61993B" },
  { label: "Beige Brown", color: "#986E52" },
  { label: "Teal Blue", color: "#7EBAB5" },
  { label: "Army Green", color: "#50533C" },
  { label: "Dark Gray", color: "#3A3B3C" },
  { label: "Ivory White", color: "#E6D2B5" },
  { label: "Rust Copper", color: "#8D4931" },
  { label: "Apricot", color: "#E6BAA8" },
  { label: "Lagoon Blue", color: "#048B8C" },
  { label: "Forest Green", color: "#008351" },
  { label: "Fluorescent Orange", color: "#FF4D08" },
  { label: "Fluorescent Green", color: "#00B51B" },
  { label: "Transparent", color: "#F5F5F5" },
  { label: "Bahama Yellow", color: "#FFCC33" },
  { label: "Chocolate Brown", color: "#4C2B20" },
  { label: "Fluorescent Yellow", color: "#FFF600" },
  { label: "Lavender Violet", color: "#76689A" },
  { label: "Magenta", color: "#CC3366" },
  { label: "Military Khaki", color: "#755F3E" },
  { label: "Ryobix Green", color: "#CCDA46" },
  { label: "Simply Silver", color: "#8B97A3" },
  { label: "Midnight Gray", color: "#383F44" },
  { label: "Thanos Purple", color: "#6843B4" },
  { label: "Bone White", color: "#ACA79D" },
  { label: "Terracotta Orange", color: "#D67842" },
  { label: "Water Blue", color: "#1A7585" },
  { label: "Light Beige", color: "#D7CAAB" },
];
// the same catalogue, reordered so a chosen colour leads (= a part's default)
function leadWith(color: string): PartOpt[] {
  const i = NUMAKERS.findIndex((o) => o.color.toLowerCase() === color.toLowerCase());
  return i <= 0 ? NUMAKERS.slice() : [NUMAKERS[i], ...NUMAKERS.slice(0, i), ...NUMAKERS.slice(i + 1)];
}

export const PARTS: PartCfg[] = [
  { id: "body", label: "Body / case", meshes: ["frontplate", "backplate"], options: leadWith("#0E0E10") },
  { id: "trim", label: "Trim / gasket", meshes: ["trim"], options: leadWith("#E25303") },
  { id: "keycaps", label: "Keycaps", meshes: ["keycaps"], options: leadWith("#F1ECE1") },
  {
    id: "switches", label: "Switches", meshes: ["switches"], options: [
      { label: "Cherry MX Red", color: "#C0392B", desc: "Linear · 45g · smooth and quiet. The easy all-rounder, great for gaming." },
      { label: "Cherry MX Brown", color: "#6B4A2B", desc: "Tactile · 45g · a soft bump you can feel. The classic do-everything switch." },
      { label: "Cherry MX Blue", color: "#2F6FB0", desc: "Clicky · 50g · loud, crisp click. Satisfying for typing, not for offices." },
      { label: "Cherry MX Black", color: "#1C1C1E", desc: "Linear · 60g · heavier and deliberate. No accidental presses." },
      { label: "Gateron Yellow", color: "#E0B83A", desc: "Linear · 50g · buttery smooth and budget-loved. The enthusiast favourite." },
      { label: "Gateron Brown", color: "#7A5230", desc: "Tactile · 45g · smoother than MX Brown, lighter bump." },
    ],
  },
  { id: "knob", label: "Knob", meshes: ["knob"], options: leadWith("#E25303") },
];
