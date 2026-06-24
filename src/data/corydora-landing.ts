/**
 * CoryDora - bespoke flagship landing content.
 *
 * Feature-first: what the macropad does and who it's for leads; the fact that
 * it's fully open source is framed as a bonus, not the pitch. Edit freely - the
 * rich page (`CoryDoraLanding.astro` / `CoryDoraExperience.vue`) renders from
 * this, and the classic campaign page reuses `tiers`.
 */
import type { ProductLanding } from "../types";

export const corydoraLanding: ProductLanding = {
  projectSlug: "corydora",
  campaignSlug: "corydora",

  hero: {
    eyebrow: "Open macropad - made in Bengaluru",
    headline: "Nine keys that do exactly what you want.",
    subhead:
      "CoryDora is a palm-sized 3x3 macropad with a rotary encoder and an OLED. Remap it without code, swap switches without solder, and grow it as far as you like.",
    chips: ["9 hot-swap keys", "Rotary encoder", "0.91\" OLED", "USB-C", "QMK + VIA", "Up to 4 layers"],
    ctaLabel: "Customize & back it",
  },

  whatItDoes: [
    { icon: "ph-bold ph-sliders-horizontal", title: "Media & volume", body: "Spin the encoder for volume, scrub a timeline, or zoom a canvas. Tap to mute, play, or skip." },
    { icon: "ph-bold ph-lightning", title: "Shortcuts & macros", body: "One key for that 5-step shortcut. Build text snippets, launch apps, or fire whole macros." },
    { icon: "ph-bold ph-code", title: "Coding combos", body: "Bind build, run, format, and your worst git incantations to keys you'll actually remember." },
    { icon: "ph-bold ph-pen-nib", title: "Design & editing", body: "Brush size, undo/redo, scrubbing, and tool switches under your off-hand while you work." },
    { icon: "ph-bold ph-game-controller", title: "Layers for everything", body: "Hold a key to flip to a whole new set. One pad, four contexts - work, edit, game, play." },
    { icon: "ph-bold ph-monitor", title: "Glanceable OLED", body: "Show the active layer, WPM, a logo, or any 128x32 graphic you like." },
  ],

  audiences: [
    {
      key: "newbie",
      label: "New to keyboards",
      icon: "ph-bold ph-sparkle",
      blurb: "You don't need to know what QMK means to love this.",
      points: [
        "Order it fully assembled - plug in and it just works",
        "Remap any key with VIA in your browser, no code, no reflash",
        "Switches pop in and out by hand - try clicky, tactile, or silent",
        "If you want to learn to solder, the kit is a friendly first build",
      ],
    },
    {
      key: "veteran",
      label: "For keyboard veterans",
      icon: "ph-bold ph-wrench",
      blurb: "Everything's open, so nothing's off-limits.",
      points: [
        "Full QMK firmware - layers, combos, tap-dance, macros, encoder maps",
        "Hot-swap MX sockets and a standard 5-pin/3-pin footprint",
        "KiCad PCB, STEP and Fusion case files - fork and remix the hardware",
        "RP2040 Zero brain - fast, cheap to replace, easy to flash over USB",
      ],
    },
  ],

  canDo: [
    "Remap every key live in VIA - no recompiling, no reflashing",
    "Swap switches by hand thanks to hot-swap sockets",
    "Stack up to four layers for work / edit / game / play",
    "Drive media, macros, shortcuts, and an encoder dial",
    "Show layer, WPM, or custom art on the OLED",
    "Be fully rebuilt from open KiCad / STEP / STL files",
  ],
  cantDo: [
    "It's wired USB-C - no wireless or Bluetooth",
    "Nine keys plus one encoder - it's a macropad, not a full board",
    "A single rotary encoder (one dial, not three)",
    "Not in the upstream QMK repo yet - flash from the maker's fork",
  ],

  features: [
    { icon: "ph-bold ph-swap", title: "Hot-swap sockets", body: "Change switches in seconds. No soldering iron, no commitment." },
    { icon: "ph-bold ph-cpu", title: "RP2040 Zero", body: "A capable, dirt-cheap brain. Drag-and-drop UF2 flashing over USB-C." },
    { icon: "ph-bold ph-arrows-clockwise", title: "VIA remapping", body: "Point-and-click key layout editor in the browser. Changes stick instantly." },
    { icon: "ph-bold ph-dial-high", title: "Rotary encoder", body: "Alps EC11 dial with push - volume, scroll, zoom, or anything you map." },
    { icon: "ph-bold ph-cube", title: "Printable case", body: "PETG/PLA case in three parts. STLs included - print spares and remixes." },
    { icon: "ph-bold ph-graduation-cap", title: "Great first solder", body: "Through-hole only. A forgiving, satisfying intro to building hardware." },
  ],

  openSource: {
    headline: "And yes - it's completely open.",
    body:
      "You don't have to care about that to enjoy CoryDora. But if you do, every layer is yours: schematic, PCB, case, firmware, and bill of materials, all public.",
    points: [
      "KiCad schematic + PCB and a full BOM with buy links",
      "STEP, Fusion 360, and printable STL case files",
      "QMK firmware and a VIA layout definition",
      "GPL-3.0 - learn from it, fork it, sell your own",
    ],
  },

  // Narrative "journey" - each scene moves the camera / isolates parts / shifts
  // the render mode while an overlay surfaces the matching open files.
  journey: [
    {
      id: "meet",
      script: "Meet CoryDora",
      bigType: "PALM-\nSIZED",
      title: "Palm-sized, fully yours",
      body: "Nine keys, a rotary dial, and a tiny OLED in a 109 x 79 mm footprint that lives right next to your keyboard.",
      spec: true,
      mode: "Studio",
      oled: "hello",
      isolate: [],
      cam: { pos: [-43.7, 362.2, -26.8], target: [1.8, 8.9, -35.2] },
      camMobile: { pos: [-197.4, 575.7, 27.7], target: [51.7, 29.3, -22] },
      panelMobile: { x: 0, z: 65 },
    },
    {
      id: "open",
      script: "Open core",
      bigType: "RP2040",
      title: "Open to the core",
      body: "Everything ghosts away to the open-source PCB - RP2040, OLED header, encoder, and nine hot-swap sockets. The full KiCad design is public.",
      mode: "X-Ray",
      oled: "boot",
      isolate: ["pcb"],
      cam: { pos: [-162, 243.9, -73.6], target: [-3.9, 4.3, -26.3] },
      camMobile: { pos: [-236, 381.3, -92.8], target: [7.2, 12.8, -20] },
      panelMobile: { x: 0, z: 75 },
      files: ["CoryDora.kicad_pcb", "CoryDora.kicad_sch", "CoryDora Schematic.pdf"],
    },
    {
      id: "hotswap",
      script: "Click, clack, yours",
      bigType: "HOT SWAP\nFREELY",
      title: "Hot-swap heart",
      body: "Drop switches straight into the sockets - clicky, tactile, or silent - and change your mind any time. No soldering iron required.",
      mode: "Studio",
      oled: "swap",
      isolate: ["pcb", "switches"],
      cam: { pos: [-249.2, 204.2, 60.8], target: [-22.2, 38.8, -12.5] }, // az -72.1°, polar 55.3°, dist 290 - framed for the hover sphere

      camMobile: { pos: [-241.9, 313.6, 157.7], target: [-19.4, 34.9, 3.1] },
      panelMobile: { x: 0, z: 75 },
    },
    {
      id: "case",
      script: "the case",
      bigType: "PRINT,\nREMIX",
      title: "The case is yours to print",
      body: "A three-part PETG/PLA case with a snap-in trim ring. Print spares, tweak the colours, or remix it entirely.",
      mode: "Exploded",
      oled: "off",
      isolate: [],
      cam: { pos: [-201.1, 178.5, -224.4], target: [-3.4, 42, -8.6] }, // az -137.5°, polar 65°, dist 323
      camMobile: { pos: [-275.2, 361.8, -181.2], target: [2.6, 55.5, -10.4] },
      panelMobile: { x: 0, z: 75 },
      files: ["Case_top.stl", "Case_Bottom.stl", "Case_trim.stl", "CoryDora_Fully_Assembled_v1.2.step"],
    },
    {
      id: "type",
      eyebrow: "Map it, no code",
      script: "Type your way",
      bigType: "VIA",
      title: "Make every key yours",
      body: "Cap it, remap it in VIA from your browser, and go. Stack layers for work, editing, gaming - whatever your nine keys need to be today.",
      mode: "Studio",
      oled: "via",
      isolate: [],
      cam: { pos: [-26.4, 263.2, -35], target: [5.1, 19.3, -28.6] },
      camMobile: { pos: [-75.7, 543.2, -45.3], target: [-5.5, 14.2, 22.6] },
      panelMobile: { x: 0, z: 75 },
      files: ["CoryDora BOM.csv", "CoryDora_v1.2.zip"],
    },
  ],

  // phone-only camera for the customizer view
  customizeCamMobile: { pos: [-251.1, 312.1, 133.1], target: [-2.6, 15.1, 3.2] },

  tiers: [
    {
      name: "Source Supporter",
      price: "₹500",
      blurb: "Back the project and grab every open file.",
      perks: ["All source files (PCB, case, firmware)", "Your name in the credits", "Backer-only build updates"],
      delivery: "Available now",
      ships: "Digital - no shipping",
      backers: 24,
      claimed: 24,
      total: null,
    },
    {
      name: "Maker Kit",
      price: "₹3,900",
      blurb: "Solder it yourself - a friendly first hardware build.",
      perks: ["Full kit: PCB, RP2040, OLED, encoder, sockets", "Printed step-by-step build guide", "Choose your switch + keycap colours", "Name on the silkscreen"],
      delivery: "Ships in 2 weeks",
      ships: "Worldwide from Bengaluru",
      backers: 38,
      claimed: 38,
      total: 120,
    },
    {
      name: "Assembled CoryDora",
      price: "₹4,949",
      blurb: "Built, flashed, and tested - plug in and type.",
      perks: ["Fully assembled unit, pre-flashed", "Your chosen colourway", "VIA-ready out of the box", "All source files included"],
      delivery: "Ships now",
      ships: "Worldwide from Bengaluru",
      backers: 60,
      claimed: 60,
      total: 100,
    },
  ],
};
