/**
 * Ooru - Shared TypeScript Types
 *
 * Shaped as future API response interfaces so they can serve as
 * drop-in replacements when the platform moves to a D1 backend.
 */

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/** A crowdfunding campaign for an open-source STEAM project. */
export interface Campaign {
  /** URL-safe identifier, e.g. "solar-pi-cluster". */
  slug: string;

  /** Display title shown on cards and the detail page. */
  title: string;

  /** One-liner pitch displayed beneath the title. */
  tagline: string;

  /** Phosphor icon class for the category glyph, e.g. "ph-bold ph-drop". */
  icon: string;

  /** Human-readable maker / creator name. */
  makerName: string;

  /** Slug of the maker profile, used to build the maker link. */
  makerSlug: string;

  /** Free-text location string, e.g. "Bengaluru, India". */
  location: string;

  /** Hex colour for the avatar circle, e.g. "#FF5900". */
  avatarColor: string;

  /** Campaign category label, e.g. "Hardware", "Biology". */
  category: string;

  /** Current lifecycle status of the campaign. */
  status: "live" | "funded" | "coming";

  /** Funding progress as an integer percentage (0-100+). */
  percent: number;

  /** Funding goal in INR (paise-free integer). */
  goalINR: number;

  /** Formatted goal string with currency symbol, e.g. "₹2,50,000". */
  goalFormatted: string;

  /** Formatted amount raised so far, e.g. "₹1,87,500". */
  raisedFormatted: string;

  /** Total number of unique backers. */
  backers: number;

  /** Days remaining in the campaign; omitted for funded/coming campaigns. */
  daysLeft?: number;

  /** SPDX-style license identifier, e.g. "CERN-OHL-S-2.0". */
  license: string;

  /** Slug of the community request this campaign was born from, if any. */
  bornFromRequest?: string;

  /** Slug of the rich project folio for this campaign, if one exists. */
  projectSlug?: string;

  /** Path or URL to the campaign cover image. */
  image?: string;

  /** Array of gallery image paths for the campaign detail page. */
  gallery?: string[];

  /** Embeddable video URL (e.g. YouTube embed link). */
  videoUrl?: string;

  /** Path or URL to a 3D model file (.glb) for model-viewer. */
  modelUrl?: string;

  /** URL for an embedded PCB viewer (e.g. KiCanvas). */
  pcbViewerUrl?: string;

  /** Extended project description with full technical details. */
  richDescription?: string;

  /** When true, the campaign URL renders the bespoke rich landing page
   *  instead of the generic template (generic moves to /…/classic). */
  richLayout?: boolean;

  /** Backing tiers; when present they replace the page's generic fallback. */
  tiers?: CampaignTier[];
}

/** A backing / reward tier for a campaign. */
export interface CampaignTier {
  name: string;
  /** Formatted price with symbol, e.g. "₹4,500". */
  price: string;
  blurb: string;
  perks: string[];
  /** Estimated delivery window, e.g. "Oct 2026". */
  delivery: string;
  /** Shipping note, e.g. "Worldwide" or "Digital - no shipping". */
  ships: string;
  backers: number;
  claimed: number;
  /** Capacity; null = unlimited. */
  total: number | null;
}

// ---------------------------------------------------------------------------
// Makers
// ---------------------------------------------------------------------------

/** A maker / creator profile on the platform. */
export interface Maker {
  /** URL-safe identifier, e.g. "priya-patel". */
  slug: string;

  /** Display name. */
  name: string;

  /** Professional title or one-liner, e.g. "Embedded Systems Hacker". */
  title: string;

  /** Free-text location string. */
  location: string;

  /** Hex colour for the avatar circle. */
  avatarColor: string;

  /** Path or URL to the maker's profile image. */
  avatar?: string;

  /** Path or URL to a wide banner/cover image (e.g. a photo of their lab). */
  cover?: string;

  /** List of skill/tag labels, e.g. ["PCB Design", "Rust", "KiCad"]. */
  skills: string[];

  /** Number of projects (campaigns) the maker has launched. */
  projects: number;

  /** Cumulative backer count across all campaigns. */
  backers: number;

  /** Short specialty descriptor shown on cards, e.g. "Hardware". */
  specialty: string;

  /** Longer biography for the detail page. */
  bio?: string;

  /** Optional external profile links. */
  links?: {
    github?: string;
    website?: string;
    twitter?: string;
  };

  /**
   * Real, curated chronological timeline. When present, the profile page
   * renders this instead of the generic derived activity feed.
   */
  timeline?: MakerTimelineEntry[];

  /** Slug of the maker's flagship project folio, surfaced on the profile. */
  featuredProjectSlug?: string;

  /** Slug of the maker's flagship campaign, surfaced on the profile. */
  featuredCampaignSlug?: string;
}

/** A single entry in a maker's real timeline. */
export interface MakerTimelineEntry {
  /** Human date label, e.g. "Sep 2024". */
  date: string;
  /** Short headline. */
  title: string;
  /** Optional detail sentence. */
  body?: string;
  /** Phosphor icon name without the prefix, e.g. "rocket-launch". */
  icon?: string;
  /** Optional internal link this entry points at. */
  href?: string;
  /** Emphasise this entry (accent dot + icon). */
  highlight?: boolean;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** A community event - meetup, workshop, hackathon, talk, or conference. */
export interface AbsurdEvent {
  /** URL-safe identifier, e.g. "soldering-101-blr". */
  slug: string;

  /** Display title of the event. */
  title: string;

  /** ISO-8601 date string, e.g. "2026-07-12". */
  date: string;

  /** Human-readable time string, e.g. "2:00 PM - 5:00 PM IST". */
  time: string;

  /** Full address or short location, e.g. "Bengaluru, India". */
  location: string;

  /** Venue name, e.g. "Workbench Projects". */
  venue: string;

  /** City name for filtering, e.g. "Bengaluru". */
  city: string;

  /** Event format / category. */
  category: "meetup" | "workshop" | "hackathon" | "talk" | "conference";

  /** Multi-line event description (may contain markdown). */
  description: string;

  /** Name of the event host or organiser. */
  hostName: string;

  /** Path or URL to the host's avatar image. */
  hostAvatar?: string;

  /** Current number of registered attendees. */
  attendees: number;

  /** Capacity cap; omitted when unlimited. */
  maxAttendees?: number;

  /** Ticket price in INR; 0 means the event is free. */
  priceINR: number;

  /** Descriptive tags, e.g. ["soldering", "beginner", "hardware"]. */
  tags: string[];

  /** Path or URL to a cover/banner image. */
  image?: string;

  /** External registration link (e.g. Luma, Eventbrite). */
  registrationUrl?: string;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** A community request for a product or project that doesn't exist yet. */
export interface Request {
  /** URL-safe identifier, e.g. "affordable-reflow-oven". */
  slug: string;

  /** Short request title. */
  title: string;

  /** Longer explanation of what is being requested and why. */
  description: string;

  /** Category label, e.g. "Hardware", "Software". */
  category: string;

  /** Current workflow status of the request. */
  status: "open" | "claimed" | "in-progress" | "fulfilled";

  /** Community upvote count. */
  upvotes: number;

  /** Number of discussion comments on the request. */
  commentCount: number;

  /** Display name of the person who submitted the request. */
  authorName: string;

  /** Slug of the author's maker profile. */
  authorSlug: string;

  /** ISO-8601 datetime when the request was created. */
  createdAt: string;

  /** Descriptive tags for filtering, e.g. ["pcb", "beginner"]. */
  tags: string[];

  /** Maker slug of whoever claimed this request. */
  claimedBy?: string;

  /** Slug of the campaign that fulfilled this request. */
  campaignSlug?: string;
}

// ---------------------------------------------------------------------------
// Friends / Partners
// ---------------------------------------------------------------------------

/** An Ooru partner or friend organisation. */
export interface Friend {
  /** Organisation or partner name. */
  name: string;

  /** External URL to the partner's site. */
  url: string;

  /** Logo image path relative to /images/partners/. */
  logo: string;

  /** Optional one-liner about the partner. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Projects (rich "folio" pages - the magazine-style showcase for a build)
// ---------------------------------------------------------------------------

/** A single labelled spec, e.g. { label: "MCU", value: "RP2040" }. */
export interface ProjectSpec {
  label: string;
  value: string;
}

/** One line of a bill of materials, with an optional buy link. */
export interface ProjectBomItem {
  /** Component name, e.g. "Hot-swap socket". */
  part: string;
  /** Quantity required. */
  qty: number;
  /** Reference designators from the schematic, e.g. "D1-D9". */
  ref?: string;
  /** Where to buy one, if a public link exists. */
  buyUrl?: string;
  /** Vendor label for the buy link, e.g. "stackskb". */
  buyLabel?: string;
}

/** A downloadable source file. */
export interface ProjectFile {
  /** File name, e.g. "CoryDora.kicad_pcb". */
  name: string;
  /** Short format label, e.g. "KiCad", "STEP", "STL". */
  format: string;
  /** Phosphor icon class. */
  icon: string;
  /** Download URL (typically a GitHub raw/blob link). */
  url: string;
}

/** A single step in a build guide or onboarding flow. */
export interface ProjectStep {
  /** Step heading, e.g. "Solder the diodes". */
  title: string;
  /** Step prose; may contain multiple sentences. */
  body?: string;
  /** Local image paths illustrating the step. */
  images?: string[];
  /** Embeddable video URL (e.g. YouTube embed). */
  videoUrl?: string;
  /** A highlighted caution/tip rendered as a callout. */
  note?: string;
}

/** An ordered, illustrated guide (build or onboarding). */
export interface ProjectGuide {
  /** Optional intro paragraph above the steps. */
  intro?: string;
  steps: ProjectStep[];
}

/**
 * A project folio - the richest page we render for a single build. Most
 * sections are optional so this doubles as a reusable template: populate what
 * a given project has and the page renders only those sections.
 */
export interface Project {
  /** URL-safe identifier, e.g. "cory-dora". */
  slug: string;
  /** Display title. */
  title: string;
  /** One-liner pitch. */
  tagline: string;
  /** Slug of the maker who built it. */
  makerSlug: string;
  /** Slug of the funding campaign for this project, if any. */
  campaignSlug?: string;
  /** Lifecycle: shipping (buy now), prototype, or concept. */
  status: "shipping" | "prototype" | "concept";
  /** Human license label, e.g. "Open source hardware". */
  license: string;
  /** Category label, e.g. "Electronics". */
  category: string;
  /** Phosphor icon class for the category glyph. */
  icon: string;
  /** Public source repository. */
  repoUrl?: string;
  /** Buy/shop URL for shipping projects. */
  shopUrl?: string;
  /** Formatted price, e.g. "₹4,949". */
  priceFormatted?: string;
  /** Lead images for the hero gallery. */
  heroImages: string[];
  /** Additional gallery images. */
  gallery?: string[];
  /** Spec strip entries. */
  specs?: ProjectSpec[];
  /** Bullet feature list. */
  features?: string[];
  /** Visual bill of materials. */
  bom?: ProjectBomItem[];
  /** Downloadable source files. */
  files?: ProjectFile[];
  /** Web 3D model path (.glb) for model-viewer. */
  modelUrl?: string;
  /** Real-world size of the model in millimetres, for the scale overlay. */
  modelDimensions?: { w: number; d: number; h: number };
  /** Embedded PCB viewer URL (e.g. KiCanvas). */
  pcbViewerUrl?: string;
  /** Firmware repository or flashing entry point. */
  firmwareUrl?: string;
  /** Step-by-step build guide. */
  buildGuide?: ProjectGuide;
  /** Post-purchase onboarding / setup flow. */
  onboarding?: ProjectGuide;
  /** Project-specific FAQ. */
  faqs?: { q: string; a: string }[];
}

// ---------------------------------------------------------------------------
// Rich flagship landing (bespoke, feature-first campaign page)
// ---------------------------------------------------------------------------

/** A use-case / capability card ("what it does"). */
export interface LandingUseCase {
  icon: string;   // Phosphor class
  title: string;
  body: string;
}

/** One audience track (e.g. newcomers vs veterans). */
export interface LandingAudience {
  key: string;
  label: string;       // "New to keyboards"
  icon: string;
  blurb: string;
  points: string[];
}

/** A scene in the narrative "journey" through the model + open files. */
export interface LandingScene {
  id: string;
  title: string;
  body: string;
  /** Small-caps eyebrow above the heading. */
  eyebrow?: string;
  /** Script-style accent line. */
  script?: string;
  /** Big bold display word/name set beside the model. */
  bigType?: string;
  /** Show the "Nutrition Facts"-style spec card this chapter. */
  spec?: boolean;
  /** Magic render mode label to switch to, e.g. "X-Ray". */
  mode?: string;
  /** OLED program to run this chapter (e.g. "logo", "layer", "wpm"). */
  oled?: string;
  /** Mesh names to isolate (ghost the rest). Empty = show all. */
  isolate?: string[];
  /** Camera frame, same shape the viewer's tour uses. */
  cam?: { pos: [number, number, number]; target: [number, number, number] };
  /** Per-chapter nudge for the floor text panel (world mm) when the camera angle
   *  pushes it off-position. dx = +X, dz = +Z. */
  panel?: { dx?: number; dz?: number };
  /** A supporting image path. */
  media?: string;
  /** A supporting video URL (embed). */
  video?: string;
  /** Open-source file names to surface as chips (matched against project.files). */
  files?: string[];
}

/** The complete bespoke landing content for a flagship product. */
export interface ProductLanding {
  /** Project slug this landing belongs to. */
  projectSlug: string;
  /** Campaign slug for the backing flow. */
  campaignSlug: string;
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    /** Short stat chips, e.g. "9 keys", "rotary encoder". */
    chips: string[];
    ctaLabel: string;
  };
  whatItDoes: LandingUseCase[];
  audiences: LandingAudience[];
  canDo: string[];
  cantDo: string[];
  /** Feature deck cards. */
  features: { icon: string; title: string; body: string }[];
  /** Secondary "open source is a bonus" section. */
  openSource: { headline: string; body: string; points: string[] };
  /** Narrative journey scenes for the visualizer. */
  journey: LandingScene[];
  /** Backing tiers (also mirrored on the campaign for the classic page). */
  tiers: CampaignTier[];
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** A single item in the bottom-bar or mega-menu navigation. */
export interface NavItem {
  /** Visible link text, e.g. "Campaigns". */
  label: string;

  /** Destination path or URL. */
  href: string;

  /** Phosphor icon class, e.g. "ph-bold ph-rocket-launch". */
  icon: string;

  /** When true the link opens in a new tab (external site). */
  isExternal?: boolean;
}
