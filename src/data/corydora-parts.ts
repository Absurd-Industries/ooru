/**
 * CoryDora customizable parts - shared between the 3D viewer (ModelExperience)
 * and the rich customizer UI (CoryDoraExperience) so both speak the same config.
 * A part can drive several meshes (the case = both plates).
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

export const PARTS: PartCfg[] = [
  {
    id: "body", label: "Body / case", meshes: ["frontplate", "backplate"], options: [
      { label: "Cream", color: "#E7DCC2" }, { label: "White", color: "#F2EEE6" },
      { label: "Black", color: "#1D1D1F" }, { label: "Blue", color: "#1F8FD6" }, { label: "Mint", color: "#7AD6B0" },
    ],
  },
  {
    id: "trim", label: "Trim / gasket", meshes: ["trim"], options: [
      { label: "Orange", color: "#F2851F" }, { label: "Purple", color: "#6B4DB3" },
      { label: "Lime", color: "#B6D641" }, { label: "Pink", color: "#E7779E" }, { label: "Black", color: "#1D1D1F" },
    ],
  },
  {
    id: "keycaps", label: "Keycaps", meshes: ["keycaps"], options: [
      { label: "Black", color: "#222226", desc: "PBT black - the everyday classic, legends never fade." },
      { label: "White", color: "#ECEAE3", desc: "Crisp PBT white. Clean, bright, goes with anything." },
      { label: "Beige", color: "#E7DCC2", desc: "Retro beige PBT - that vintage terminal look." },
      { label: "Grey", color: "#8A8D91", desc: "Neutral dolch-style grey. Understated and sharp." },
      { label: "Navy", color: "#2A3550", desc: "Deep navy PBT - moody and premium." },
      { label: "Lavender", color: "#B9A3E3", desc: "Soft pastel lavender. A SP Road favourite." },
      { label: "Pink", color: "#E7A6C6", desc: "Bubblegum pink PBT - make it pop." },
      { label: "Mint", color: "#9FD8BE", desc: "Fresh mint pastel. Calm and clean." },
      { label: "Purple", color: "#6B4DB3", desc: "Bold purple - the CoryDora signature." },
    ],
  },
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
  {
    id: "knob", label: "Knob", meshes: ["knob"], options: [
      { label: "Orange", color: "#F58A21" }, { label: "Black", color: "#1D1D1F" },
      { label: "Purple", color: "#6B4DB3" }, { label: "Cream", color: "#E7DCC2" },
    ],
  },
];
