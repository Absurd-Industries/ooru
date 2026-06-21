/**
 * English UI strings - the SINGLE SOURCE for every user-facing chrome string.
 *
 * IMPORTANT (see README "Localization"): when you add, change, or remove a key
 * here, mirror it in `kn.ts` (Kannada) and `te.ts` (Telugu). English is the
 * fallback - a missing key in another language falls back to this file, then
 * to the raw key. Only UI chrome lives here; dynamic data (campaign/maker/
 * event content) is NOT translated.
 *
 * Interpolation: use `{name}` placeholders, filled via t(key, locale, { name }).
 */
export const en: Record<string, string> = {
  // ── Accessibility / brand ──────────────────────────────────────────
  "a11y.ooruHome": "Ooru home",
  "a11y.toggleMenu": "Toggle menu",
  "a11y.language": "Language",

  // ── Navigation ─────────────────────────────────────────────────────
  "nav.campaigns": "Campaigns",
  "nav.makers": "Makers",
  "nav.requests": "Requests",
  "nav.events": "Events",
  "nav.faq": "FAQ",
  "nav.discord": "Discord",
  "nav.contact": "Contact",
  "nav.home": "Home",
  "nav.more": "More",

  // ── Hero ───────────────────────────────────────────────────────────
  "hero.titleA": "Built open.",
  "hero.titleB": "Backed by you.",
  "hero.desc":
    "Back projects that are repairable, come with blueprints and be a part of thriving community of makers!",
  "hero.exploreCampaigns": "Explore Campaigns",
  "hero.requestSomething": "Request Something",

  // ── Homepage sections ──────────────────────────────────────────────
  "home.campaigns.all": "All campaigns",
  "home.campaigns.desc":
    "Back gadgets that come with their blueprints - so you can build, fix, or improve them yourself.",
  "home.requests.all": "All requests",
  "home.requests.desc":
    "Suggest something that should exist. The community shapes the idea, and a maker brings it to life.",
  "home.votes": "{n} votes",
  "home.makers.all": "All makers",
  "home.makers.desc":
    "Meet the people who actually build things - and share exactly how they did it.",
  "home.events.all": "All events",
  "home.events.desc":
    "Meetups, workshops, and talks for curious people - starting in Bengaluru.",
  "home.guild.title": "Join the Guild",
  "home.guild.desc":
    "Chat with makers, get build help, share your projects, and stay in the loop on new campaigns and events.",
  "home.guild.cta": "Join Discord",
  "home.faq.all": "All questions",
  "home.friends.title": "Friends of Ooru",
  "home.friends.desc":
    "Communities and companies building open hardware alongside us.",

  // ── Shared section titles ──────────────────────────────────────────
  "section.campaigns": "Campaigns",
  "section.requests": "Requests",
  "section.makers": "Makers",
  "section.events": "Events",
  "section.faq": "FAQ",

  // ── Footer ─────────────────────────────────────────────────────────
  "footer.tagline":
    "A warm community of makers who believe collaboration beats competition!",
  "footer.platform": "Platform",
  "footer.community": "Community",
  "footer.more": "More",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.sitemap": "Sitemap",
  "footer.copyright": "Copyleft 2023-2026 · Made with curiosity in Bengaluru",
  "footer.reset": "Reset my data",
  "footer.resetConfirm":
    "Reset your local Ooru data - reactions, comments, pledges, and language? This can't be undone.",

  // ── Page headers ───────────────────────────────────────────────────
  "page.campaigns.desc":
    "Back open-source, repairable indie hardware. Every project ships with full source files.",
  "page.makers.desc": "Hardware rebels with workshops, not just followers.",
  "page.makers.becomeTitle": "Become a Maker",
  "page.makers.becomeDesc":
    "Got a workshop and an unreasonable urge to build things? Create your maker profile, share your skills, and join a community that ships real hardware.",
  "page.makers.becomeCta": "Join the Guild",
  "page.requests.desc":
    "The world needs things that don't exist yet. Describe what you need, refine specs together, and let makers bring it to life.",
  "page.events.desc":
    "Bengaluru-first STEAM (Science, Technology, Engineering, Art & Math) events for makers, scientists, artists, engineers, and the endlessly curious. Find your people.",
  "page.faq.desc":
    "Got questions? We have answers. If you don't find what you're looking for, drop by our Discord and ask away.",
  "page.contact.desc":
    "Have a question, idea, or just want to say hello? Here's how to reach us.",

  // ── Contact page ───────────────────────────────────────────────────
  "contact.discord.title": "Discord",
  "contact.discord.desc":
    "The fastest way to reach us. Ask questions, share ideas, or just hang out with the community.",
  "contact.discord.cta": "Join our Discord",
  "contact.email.title": "Email",
  "contact.email.desc":
    "For partnerships, press, or anything that needs a longer conversation.",
  "contact.elsewhere": "Find us elsewhere",
  "contact.based": "Based in Bengaluru, India · Building for the world",

  // ── FAQ (shared by homepage teaser + FAQ page) ─────────────────────
  "faq.q1": "What is Ooru?",
  "faq.a1":
    "Ooru is an open-source STEAM platform built by Absurd Industries, based in Bengaluru, India. 'Ooru' means village in Kannada and Telugu - we're building a digital community where makers, tinkerers, engineers, artists, and the endlessly curious come together to build hardware and software in the open. Everything we make ships with full source files.",
  "faq.q2": "How do campaigns work?",
  "faq.a2":
    "Makers launch crowdfunding campaigns for open-source hardware projects. Each campaign includes a bill of materials, schematics, firmware, and CAD files. You back a project you believe in, the maker builds it, and you get both the product and the knowledge to build it yourself.",
  "faq.q3": "How do requests work?",
  "faq.a3":
    "Anyone can describe something that should exist but doesn't. The community upvotes, discusses, and refines the spec. When a maker picks up a request, it becomes a campaign. Your idea could become a real product backed by the community.",
  "faq.q4": "What open-source licenses do projects use?",
  "faq.a4":
    "Hardware designs use the CERN Open Hardware Licence (CERN-OHL). Software components typically use MIT, GPL, or Apache 2.0. You are free to study, modify, manufacture, and redistribute any project on the platform.",
  "faq.q5": "How do I become a maker?",
  "faq.a5":
    "Join the Discord community and introduce yourself. Start by contributing to existing projects or community requests. Share your skills, help refine specs, and when you are ready, launch your own campaign. No gatekeeping. Everyone starts somewhere.",
  "faq.q6": "How do I request something?",
  "faq.a6":
    "Head to the Requests page and describe what the world is missing. Be specific about the problem you want solved. The community will upvote, add context, and help refine your idea into a buildable spec.",
  "faq.q7": "Is this only in Bengaluru?",
  "faq.a7":
    "Our roots are in Bengaluru, and most of our in-person events happen here. But the platform is global. Makers and backers from anywhere in the world can launch campaigns, submit requests, and join the community online.",
  "faq.q8": "How is this funded?",
  "faq.a8":
    "Ooru takes a small platform fee on funded campaigns to cover infrastructure costs. We do not run ads or sell data. The goal is to sustain the platform while keeping everything open and accessible.",

  // ── Listings: search, counts, empty states ─────────────────────────
  "listing.searchCampaigns": "Search campaigns...",
  "listing.searchMakers": "Search makers by name, title, or skills...",
  "listing.searchRequests": "Search requests...",
  "listing.searchEvents": "Search events, venues, tags...",
  "listing.noCampaigns": "No campaigns found",
  "listing.noCampaignsHint": "Try a different search term or category filter.",
  "listing.noMakers": "No makers found",
  "listing.noMakersHint":
    "Try adjusting your search or filter to find what you're looking for.",
  "listing.noRequests": "No requests found",
  "listing.noRequestsHint": "Try a different category or search term.",
  "listing.noEvents": "No events found",
  "listing.noEventsHint": "Try a different city or search term.",
  "listing.eventsIn": "{n} events in {city}",
  "listing.hostedBy": "Hosted by",
  "listing.free": "Free",
  "listing.spotsLeft": "{n} spots left",
  "listing.attending": "{n} attending",

  // ── Campaign card / status ─────────────────────────────────────────
  "status.live": "Live",
  "status.funded": "Funded",
  "status.comingSoon": "Coming Soon",
  "card.bornFromRequest": "Born from community request",
  "card.backers": "{n} backers",
  "card.funded": "{n}% funded",

  // ── Discussion island ──────────────────────────────────────────────
  "discussion.title": "Discussion",
  "discussion.wall": "Wall",
  "discussion.placeholder":
    "Share your thoughts or ask the maker a question...",
  "discussion.orDiscord": "Or chat on Discord",
  "discussion.post": "Post Comment",
  "discussion.you": "You",
  "discussion.reply": "Reply",
  "discussion.cancel": "Cancel",
  "discussion.replyPlaceholder": "Write a reply...",

  // ── Rewards island ─────────────────────────────────────────────────
  "rewards.select": "Select a reward",
  "rewards.reserveNote": "Reserve for 25% now, pay the rest when it ships.",
  "rewards.reserved": "You reserved the {tier}",
  "rewards.depositNote":
    "{amount} deposit taken now · {rest} charged when it ships.",
  "rewards.cancel": "Cancel pledge & refund deposit",
  "rewards.soldOut": "Sold out",
  "rewards.left": "{n} of {total} left",
  "rewards.includes": "Includes",
  "rewards.allOrNothing":
    "All-or-nothing. Cancel any time before shipment for a full refund.",

  // ── File preview island ────────────────────────────────────────────
  "file.noPreview":
    "Preview isn't available for this format. Download it to open in your tools.",
  "file.download": "Download",
  "file.close": "Close",

  // ── Cheer button ───────────────────────────────────────────────────
  "cheer.cheer": "Cheer",
  "cheer.cheered": "Cheered",

  // ── Campaign detail page (static section labels) ───────────────────
  "campaign.about": "About This Project",
  "campaign.files": "Open Source Files",
  "campaign.bom": "Bill of Materials",
  "campaign.bomComponent": "Component",
  "campaign.bomSource": "Source",
  "campaign.bomTotal": "Total",
  "campaign.mfgStatus": "Manufacturing Status",
  "campaign.inProgress": "In Progress",
  "campaign.complete": "Complete",
  "campaign.faqTitle": "Frequently Asked Questions",
  "campaign.askMaker": "Ask the maker on Discord",
  "campaign.updates": "Updates",
  "campaign.creator": "Creator",
  "campaign.projectsBacked": "projects backed",
  "campaign.profile": "Profile",
  "campaign.back": "Back This Project",
  "campaign.fullyFunded": "Fully funded",
  "campaign.statFunded": "funded",
  "campaign.statBackers": "backers",
  "campaign.statDaysLeft": "days left",
};
