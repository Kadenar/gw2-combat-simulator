/**
 * Lazy application manifest for every simulator exposed by the shared UI.
 *
 * Registry entries contain only presentation metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. The full registry includes standalone legacy
 * applications; `nativeProfessionRegistry` contains only applications that
 * can be bootstrapped through the shared profession app adapter.
 *
 * @typedef {Object} ProfessionRegistryEntry
 * @property {string} id Stable lowercase identifier used by builds and pages.
 * @property {string} name Human-readable profession name.
 * @property {string} route Browser route for the profession application.
 * @property {string} themeClass Optional class applied to the document body.
 * @property {string} specializationSummary Landing-card summary.
 * @property {() => Promise<Object>} loadProfession Lazy profession loader.
 * @property {(() => Promise<Object>) | null} loadAppAdapter Lazy shared-shell
 *   adapter loader, or `null` for a standalone application.
 */

const entries = [
  {
    id: "mesmer",
    name: "Mesmer",
    route: "mesmer.html",
    themeClass: "mesmer-theme",
    specializationSummary:
      "Core · Chronomancer · Mirage · Virtuoso · Troubadour",
    loadProfession: async () => {
      const module = await import("../professions/mesmer/definition.js");
      return module.mesmerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import("../professions/mesmer/app/adapter.js");
      return module.mesmerAppAdapter;
    },
  },
  {
    id: "elementalist",
    name: "Elementalist",
    route: "elementalist.html",
    themeClass: "",
    specializationSummary: "Core · Tempest · Weaver · Catalyst · Evoker",
    loadProfession: async () => {
      const module = await import("../professions/elementalist/definition.js");
      return module.elementalistProfession;
    },
    // Elementalist remains a standalone legacy application.
    loadAppAdapter: null,
  },
  {
    id: "guardian",
    name: "Guardian",
    route: "guardian.html",
    themeClass: "guardian-theme",
    specializationSummary:
      "Core · Dragonhunter · Firebrand · Willbender · Luminary",
    loadProfession: async () => {
      const module = await import("../professions/guardian/definition.js");
      return module.guardianProfession;
    },
    loadAppAdapter: async () => {
      const module = await import("../professions/guardian/app/adapter.js");
      return module.guardianAppAdapter;
    },
  },
  {
    id: "necromancer",
    name: "Necromancer",
    route: "necromancer.html",
    themeClass: "necromancer-theme",
    specializationSummary:
      "Core · Reaper · Scourge · Harbinger · Ritualist",
    loadProfession: async () => {
      const module = await import("../professions/necromancer/definition.js");
      return module.necromancerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import("../professions/necromancer/app/adapter.js");
      return module.necromancerAppAdapter;
    },
  },
];

function validateEntry(entry, ids, routes) {
  if (!/^[a-z][a-z0-9-]*$/.test(String(entry.id || ""))) {
    throw new TypeError("Profession registry ids must be stable and lowercase.");
  }
  if (ids.has(entry.id)) {
    throw new TypeError(`Duplicate profession registry id: ${entry.id}.`);
  }
  if (!String(entry.name || "").trim() || !String(entry.route || "").trim()) {
    throw new TypeError(`${entry.id} requires a name and route.`);
  }
  if (routes.has(entry.route)) {
    throw new TypeError(`Duplicate profession route: ${entry.route}.`);
  }
  if (typeof entry.loadProfession !== "function") {
    throw new TypeError(`${entry.id} requires a profession loader.`);
  }
  if (
    entry.loadAppAdapter !== null
    && typeof entry.loadAppAdapter !== "function"
  ) {
    throw new TypeError(`${entry.id} has an invalid app-adapter loader.`);
  }
  ids.add(entry.id);
  routes.add(entry.route);
}

const ids = new Set();
const routes = new Set();
for (const entry of entries) validateEntry(entry, ids, routes);

export const professionRegistry = Object.freeze(
  entries.map(entry => Object.freeze({ ...entry })),
);

/**
 * Registry subset that can run in the shared profession application shell.
 */
export const nativeProfessionRegistry = Object.freeze(
  professionRegistry.filter(entry =>
    typeof entry.loadAppAdapter === "function"),
);

const byId = new Map(professionRegistry.map(entry => [entry.id, entry]));

export const professionOptions = Object.freeze(
  professionRegistry.map(({ id, name }) => Object.freeze({ id, name })),
);

export const PROFESSION_ROUTES = Object.freeze(
  Object.fromEntries(
    professionRegistry.map(({ id, route }) => [id, route]),
  ),
);

/**
 * Returns the registered entry for a profession ID.
 *
 * @param {string} professionId
 * @returns {ProfessionRegistryEntry | null} `null` for an unknown ID.
 */
export function getProfessionEntry(professionId) {
  return byId.get(professionId) || null;
}

/**
 * Resolves a profession ID to its page, falling back to the landing page.
 *
 * @param {string} professionId
 * @returns {string}
 */
export function professionRoute(professionId) {
  return getProfessionEntry(professionId)?.route || "index.html";
}

/**
 * Lazily loads a profession contract.
 *
 * @param {string} professionId
 * @returns {Promise<Object | null>} `null` for an unknown ID.
 */
export async function loadProfession(professionId) {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadProfession() : null;
}

/**
 * Lazily loads a shared-shell adapter when the profession provides one.
 *
 * @param {string} professionId
 * @returns {Promise<Object | null>} `null` for unknown or standalone entries.
 */
export async function loadProfessionAppAdapter(professionId) {
  const load = getProfessionEntry(professionId)?.loadAppAdapter;
  return typeof load === "function" ? load() : null;
}
