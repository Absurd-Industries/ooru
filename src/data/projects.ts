import type { Project } from "../types/index";

export const projects: Project[] = [
  {
    slug: "corydora",
    title: "CoryDora",
    tagline:
      "A fully open-source 3x3 QMK macropad with hotswap switches and USB-C. Made in Bengaluru.",
    makerSlug: "balub",
    campaignSlug: "corydora",
    status: "shipping",
    license: "Open source hardware",
    category: "Electronics",
    icon: "ph-bold ph-keyboard",
    repoUrl: "https://github.com/balub/CoryDora",
    shopUrl: "https://shop.absurd.industries/products/cory-dora",
    priceFormatted: "₹4,949",
    heroImages: [
      "/images/projects/cory-dora/repo-1-corydora-front.webp",
      "/images/projects/cory-dora/repo-2-corydora.webp",
      "/images/projects/cory-dora/repo-3-corydora-real.webp",
      "/images/projects/cory-dora/repo-4-cory-dora-deku-shopabsurdindustries-519762.webp",
      "/images/projects/cory-dora/repo-5-cory-dora-deku-shopabsurdindustries-534888.webp",
      "/images/projects/cory-dora/repo-6-qmk-badge-dark.webp",
    ],
    specs: [
      { label: "MCU", value: "RP2040 Zero" },
      { label: "Layout", value: "3x3 + rotary encoder" },
      { label: "Switches", value: "MX hotswap (9 slots)" },
      { label: "Display", value: "0.91\" OLED 128x32" },
      { label: "Interface", value: "USB-C" },
      { label: "Firmware", value: "QMK + VIA" },
      { label: "Case", value: "3D printed (PETG / PLA)" },
      { label: "PCB", value: "KiCad, open hardware" },
    ],
    features: [
      "Fully open source - schematics, PCB, and case files on GitHub",
      "Hotswap MX sockets - swap switches without soldering",
      "QMK firmware with VIA remapping - no reflash needed to remap keys",
      "Rotary encoder for volume, scroll, or any analog input",
      "OLED display shows layer, WPM, or custom graphics",
      "USB-C connector",
      "3D printable case (STLs included)",
      "Great first soldering project - through-hole components only",
      "Designed and made in Bengaluru",
    ],
    bom: [
      {
        part: "Diode 1N4148",
        qty: 9,
        ref: "D1-D9",
        buyUrl: "https://stackskb.com",
        buyLabel: "stackskb",
      },
      {
        part: "RP2040 Zero",
        qty: 1,
        ref: "U1",
        buyUrl: "https://robu.in",
        buyLabel: "robu.in",
      },
      {
        part: "OLED 128x32 I2C",
        qty: 1,
        ref: "J1",
        buyUrl: "https://robu.in",
        buyLabel: "robu.in",
      },
      {
        part: "MX hotswap socket",
        qty: 9,
        ref: "S1-S9",
        buyUrl: "https://stackskb.com",
        buyLabel: "stackskb",
      },
      {
        part: "Rotary encoder Alps EC11E",
        qty: 1,
        ref: "SW1",
        buyUrl: "https://robu.in",
        buyLabel: "robu.in",
      },
      {
        part: "M2 screws",
        qty: 8,
        ref: "H1-H4",
      },
      {
        part: "M2.5 screws",
        qty: 8,
      },
    ],
    files: [
      {
        name: "CoryDora.kicad_pcb",
        format: "KiCad PCB",
        icon: "ph-bold ph-circuit-board",
        url: "https://github.com/balub/CoryDora/raw/main/CoryDora.kicad_pcb",
      },
      {
        name: "CoryDora.kicad_sch",
        format: "KiCad Schematic",
        icon: "ph-bold ph-git-branch",
        url: "https://github.com/balub/CoryDora/raw/main/CoryDora.kicad_sch",
      },
      {
        name: "CoryDora Schematic.pdf",
        format: "PDF",
        icon: "ph-bold ph-file-pdf",
        url: "https://github.com/balub/CoryDora/raw/main/CoryDora%20Schematic.pdf",
      },
      {
        name: "CoryDora_Fully_Assembled_v1.2.step",
        format: "STEP",
        icon: "ph-bold ph-cube",
        url: "https://github.com/balub/CoryDora/raw/main/Case/v1.2/CoryDora_Fully_Assembled_v1.2.step",
      },
      {
        name: "CoryDora_Fully_Assembled_v1.2.f3z",
        format: "Fusion 360",
        icon: "ph-bold ph-cube",
        url: "https://github.com/balub/CoryDora/raw/main/Case/v1.2/CoryDora_Fully_Assembled_v1.2.f3z",
      },
      {
        name: "Case_Bottom.stl",
        format: "STL",
        icon: "ph-bold ph-cube",
        url: "https://github.com/balub/CoryDora/raw/main/Case/v1.2/STLs/Case_Bottom.stl",
      },
      {
        name: "Case_top.stl",
        format: "STL",
        icon: "ph-bold ph-cube",
        url: "https://github.com/balub/CoryDora/raw/main/Case/v1.2/STLs/Case_top.stl",
      },
      {
        name: "Case_trim.stl",
        format: "STL",
        icon: "ph-bold ph-cube",
        url: "https://github.com/balub/CoryDora/raw/main/Case/v1.2/STLs/Case_trim.stl",
      },
      {
        name: "CoryDora_v1.2.zip",
        format: "Gerbers",
        icon: "ph-bold ph-file-zip",
        url: "https://github.com/balub/CoryDora/raw/main/Fab/CoryDora_v1.2.zip",
      },
      {
        name: "CoryDora BOM.csv",
        format: "CSV",
        icon: "ph-bold ph-table",
        url: "https://github.com/balub/CoryDora/raw/main/BOM/CoryDora%20BOM.csv",
      },
    ],
    modelUrl: "/models/cory-dora.glb",
    pcbViewerUrl:
      "https://kicanvas.org/?github=https%3A%2F%2Fgithub.com%2Fbalub%2FCoryDora%2Fblob%2Fmain%2FCoryDora.kicad_pcb",
    firmwareUrl:
      "https://github.com/qmk/qmk_firmware/tree/master/keyboards/handwired/corydora",
    buildGuide: {
      intro:
        "A great first soldering project. Every component is through-hole - no surface-mount work required. Set aside a couple of hours, gather the parts from the inventory list, and follow the steps in order.",
      steps: [
        {
          title: "Tools and pre-requisites",
          body: "You will need: a soldering iron, solder (flux-core recommended), a screwdriver, tweezers, and a pair of pliers. A breadboard is also useful for Step 2.",
          images: ["/images/projects/cory-dora/guide-1.webp"],
        },
        {
          title: "Inventory check",
          body: "Before starting, lay out all parts: the CoryDora PCB, 9 diodes, RP2040 Zero, rotary encoder, OLED display, 8x M2 and 8x M2.5 screws, and 3D-printed case parts (bottom, top, trim).",
        },
        {
          title: "PCB overview",
          body: "Familiarise yourself with the PCB before soldering. The top side holds the display, encoder, and switch sockets. The bottom side holds the diodes and microcontroller.",
          images: [
            "/images/projects/cory-dora/guide-2.webp",
            "/images/projects/cory-dora/guide-3.webp",
          ],
        },
        {
          title: "Step 1 - Solder the diodes",
          body: "Bend each diode leg at 90 degrees. Every diode has a black stripe on one end - align that stripe with the marking on the PCB silkscreen. Insert all 9, then solder from the top side. Trim the excess leads with pliers.",
          images: [
            "/images/projects/cory-dora/guide-4.webp",
            "/images/projects/cory-dora/guide-5.webp",
            "/images/projects/cory-dora/guide-6.webp",
            "/images/projects/cory-dora/guide-7.webp",
            "/images/projects/cory-dora/guide-8.webp",
          ],
          note: "Diode direction matters. The black stripe must align with the PCB marking or the keys will not register.",
        },
        {
          title: "Step 2 - Solder the RP2040 Zero",
          body: "Insert header pins through the RP2040 and hold them upright using a breadboard. Solder the corner pins first to lock the angle, then solder the rest. Remove from the breadboard, insert the RP2040 into the PCB footprint on the bottom side, and solder from the top. Trim any protruding pins.",
          images: [
            "/images/projects/cory-dora/guide-9.webp",
            "/images/projects/cory-dora/guide-10.webp",
            "/images/projects/cory-dora/guide-11.webp",
            "/images/projects/cory-dora/guide-12.webp",
            "/images/projects/cory-dora/guide-13.webp",
            "/images/projects/cory-dora/guide-14.webp",
            "/images/projects/cory-dora/guide-15.webp",
            "/images/projects/cory-dora/guide-16.webp",
          ],
          note: "Use a breadboard to keep the header pins perfectly straight while soldering. The solder side is the bottom of the PCB.",
        },
        {
          title: "Step 3 - OLED display",
          body: "Insert the I2C OLED display into the header on the top side of the PCB. Check the orientation matches the silkscreen, then solder from the bottom. Trim the pin stubs with pliers.",
          images: [
            "/images/projects/cory-dora/guide-17.webp",
            "/images/projects/cory-dora/guide-18.webp",
          ],
          note: "The OLED has a specific orientation - confirm it matches the PCB marking before soldering.",
        },
        {
          title: "Step 4 - Rotary encoder",
          body: "Insert the rotary encoder into the PCB in the correct orientation and solder from the bottom side.",
          images: [
            "/images/projects/cory-dora/guide-19.webp",
            "/images/projects/cory-dora/guide-20.webp",
            "/images/projects/cory-dora/guide-21.webp",
            "/images/projects/cory-dora/guide-22.webp",
          ],
        },
        {
          title: "Flash firmware",
          body: "Before assembling the case, flash QMK firmware. Hold the BOOT button on the RP2040, connect USB-C, then release. The board appears as a USB drive - drag the compiled .uf2 firmware file onto it. Alternatively, compile with QMK and use qmk flash.",
          note: "Flash before closing the case - once assembled it is harder to reach the BOOT button.",
        },
        {
          title: "Final assembly - mount the PCB",
          body: "Take the 3D-printed base piece. Insert the PCB with the USB-C port facing out through the cutout.",
          images: ["/images/projects/cory-dora/guide-23.webp"],
        },
        {
          title: "Final assembly - secure with small screws",
          body: "Align the PCB holes with the standoffs in the base and fasten with the M2 (small) screws.",
          images: ["/images/projects/cory-dora/guide-24.webp"],
        },
        {
          title: "Final assembly - attach the trim ring",
          body: "Snap the trim piece around the PCB edge.",
          images: [
            "/images/projects/cory-dora/guide-25.webp",
            "/images/projects/cory-dora/guide-26.webp",
          ],
        },
        {
          title: "Final assembly - insert switches and top case",
          body: "Place switches pin-side down into each hotswap socket - do not force them. Then set the top case piece on top and secure with the M2.5 (larger) screws.",
          images: [
            "/images/projects/cory-dora/guide-27.webp",
            "/images/projects/cory-dora/guide-28.webp",
          ],
          note: "Do not overtighten the screws on the 3D-printed case - snug is enough.",
        },
      ],
    },
    onboarding: {
      intro:
        "Your CoryDora ships pre-flashed and ready. This guide covers inserting switches, attaching keycaps, and remapping keys with VIA.",
      steps: [
        {
          title: "Unbox",
          body: "Your package contains an unpopulated CoryDora (PCB assembled, no switches), a bag of mechanical switches, and keycaps. Remove the board from its packaging.",
          images: ["/images/projects/cory-dora/onboard-1.webp"],
        },
        {
          title: "Insert the switches",
          body: "Align each switch so its two pins point down into the hotswap sockets. Press firmly and evenly until it clicks. If a pin gets bent, straighten it with tweezers before reinserting.",
          images: [
            "/images/projects/cory-dora/onboard-2.webp",
            "/images/projects/cory-dora/onboard-3.webp",
            "/images/projects/cory-dora/onboard-4.webp",
            "/images/projects/cory-dora/onboard-5.webp",
          ],
          note: "Insert gently - forcing a bent pin through a hotswap socket damages the socket.",
        },
        {
          title: "Attach keycaps",
          body: "Press each keycap down onto its switch stem until it seats. Insert all switches first, then cap them all.",
        },
        {
          title: "Remap with VIA",
          body: "Plug CoryDora in, then visit usevia.app. Click Authorize Device and select CoryDora from the browser popup.",
          images: [
            "/images/projects/cory-dora/onboard-6.webp",
            "/images/projects/cory-dora/onboard-7.webp",
          ],
        },
        {
          title: "Load the VIA definition",
          body: "Clone the qmk_firmware repo and find keyboards/handwired/corydora/via.json. In VIA, open the Settings menu, enable Show Design Tab, then use the Load button in the Design tab to load that via.json file.",
          images: [
            "/images/projects/cory-dora/onboard-8.webp",
            "/images/projects/cory-dora/onboard-9.webp",
            "/images/projects/cory-dora/onboard-10.webp",
            "/images/projects/cory-dora/onboard-11.webp",
            "/images/projects/cory-dora/onboard-12.webp",
          ],
        },
        {
          title: "Remap your keys",
          body: "Once the definition loads, navigate to the Configure tab to drag-and-drop new keycodes onto any key. Changes apply instantly - no reflash needed.",
          images: [
            "/images/projects/cory-dora/onboard-13.webp",
            "/images/projects/cory-dora/onboard-14.webp",
          ],
          note: "The CoryDora firmware is not yet in the official QMK repo - clone the fork linked in the GitHub README.",
        },
      ],
    },
    faqs: [
      {
        q: "Do I need to solder to build one from the kit?",
        a: "Yes - the kit comes with unsoldered components. All parts are through-hole, making it a good first soldering project. If you buy the assembled version from the shop, it ships with switches pre-soldered.",
      },
      {
        q: "Which switches are compatible?",
        a: "Any MX-compatible switch with the standard 5-pin or 3-pin footprint. The hotswap sockets let you swap them without soldering.",
      },
      {
        q: "Can I remap the keys without reflashing?",
        a: "Yes. The firmware supports VIA. Use usevia.app to remap keys live - no build toolchain needed. See the onboarding guide above for the setup steps.",
      },
      {
        q: "Is the firmware in the official QMK repo?",
        a: "Not yet. The firmware lives in a fork linked from the GitHub README. Follow the onboarding guide for the exact clone URL and path.",
      },
      {
        q: "What license is this under?",
        a: "The hardware files (KiCad, STEP, STLs) are open source hardware. GitHub reports no SPDX license file in the repo - check the README for the current licensing intent.",
      },
    ],
  },
];
