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
 * @property {"native" | "standalone"} applicationKind Whether the route uses
 *   the shared application/engine boundary or owns a legacy application.
 * @property {() => Promise<Object>} loadProfession Lazy profession loader.
 * @property {(() => Promise<Object>) | null} loadAppAdapter Lazy shared-shell
 *   adapter loader, or `null` for a standalone application.
 */

export const PROFESSION_APPLICATION_KINDS = Object.freeze({
  NATIVE: "native",
  STANDALONE: "standalone",
});

const entries = [
  {
    id: "mesmer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Mesmer",
    route: "mesmer.html",
    themeClass: "mesmer-theme",
    specializationSummary:
      "Core · Chronomancer · Mirage · Virtuoso · Troubadour",
    loadProfession: async () => {
      const module = await import("../../professions/mesmer/definition.js");
      return module.mesmerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/mesmer/app/app-definition.js"
      );
      return module.mesmerAppAdapter;
    },
  },
  {
    id: "elementalist",
    applicationKind: PROFESSION_APPLICATION_KINDS.STANDALONE,
    name: "Elementalist",
    route: "elementalist.html",
    themeClass: "",
    specializationSummary: "Core · Tempest · Weaver · Catalyst · Evoker",
    loadProfession: async () => {
      const module = await import("../../professions/elementalist/definition.js");
      return module.elementalistProfession;
    },
    // Elementalist remains a standalone legacy application.
    loadAppAdapter: null,
  },
  {
    id: "guardian",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Guardian",
    route: "guardian.html",
    themeClass: "guardian-theme",
    specializationSummary:
      "Core · Dragonhunter · Firebrand · Willbender · Luminary",
    loadProfession: async () => {
      const module = await import("../../professions/guardian/definition.js");
      return module.guardianProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/guardian/app/app-definition.js"
      );
      return module.guardianAppAdapter;
    },
  },
  {
    id: "necromancer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Necromancer",
    route: "necromancer.html",
    themeClass: "necromancer-theme",
    specializationSummary: "Core · Reaper · Scourge · Harbinger · Ritualist",
    loadProfession: async () => {
      const module = await import("../../professions/necromancer/definition.js");
      return module.necromancerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/necromancer/app/app-definition.js"
      );
      return module.necromancerAppAdapter;
    },
  },
  {
    id: "engineer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Engineer",
    route: "engineer.html",
    themeClass: "engineer-theme",
    specializationSummary: "Core · Scrapper · Holosmith · Mechanist · Amalgam",
    loadProfession: async () => {
      const module = await import("../../professions/engineer/definition.js");
      return module.engineerProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/engineer/app/app-definition.js"
      );
      return module.engineerAppAdapter;
    },
  },
  {
    id: "revenant",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Revenant",
    route: "revenant.html",
    themeClass: "revenant-theme",
    specializationSummary: "Core · Herald · Renegade · Vindicator · Conduit",
    loadProfession: async () => {
      const module = await import("../../professions/revenant/definition.js");
      return module.revenantProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/revenant/app/app-definition.js"
      );
      return module.revenantAppAdapter;
    },
  },
  {
    id: "thief",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Thief",
    route: "thief.html",
    themeClass: "thief-theme",
    specializationSummary: "Core · Daredevil · Deadeye · Specter · Antiquary",
    loadProfession: async () => {
      const module = await import("../../professions/thief/definition.js");
      return module.thiefProfession;
    },
    loadAppAdapter: async () => {
      const module = await import(
        "../../professions/thief/app/app-definition.js"
      );
      return module.thiefAppAdapter;
    },
  },
];

function validateEntry(entry, ids, routes) {
  if (!/^[a-z][a-z0-9-]*$/.test(String(entry.id || ""))) {
    throw new TypeError(
      "Profession registry ids must be stable and lowercase.",
    );
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
    !Object.values(PROFESSION_APPLICATION_KINDS).includes(entry.applicationKind)
  ) {
    throw new TypeError(`${entry.id} has an invalid application kind.`);
  }
  if (
    entry.applicationKind === PROFESSION_APPLICATION_KINDS.NATIVE &&
    typeof entry.loadAppAdapter !== "function"
  ) {
    throw new TypeError(`${entry.id} native applications require an adapter.`);
  }
  if (
    entry.applicationKind === PROFESSION_APPLICATION_KINDS.STANDALONE &&
    entry.loadAppAdapter !== null
  ) {
    throw new TypeError(
      `${entry.id} standalone applications cannot register an adapter.`,
    );
  }
  ids.add(entry.id);
  routes.add(entry.route);
}

export function validateProfessionRegistryEntries(candidateEntries) {
  if (!Array.isArray(candidateEntries)) {
    throw new TypeError("Profession registry entries must be an array.");
  }
  const ids = new Set();
  const routes = new Set();
  for (const entry of candidateEntries) validateEntry(entry, ids, routes);
  return true;
}

validateProfessionRegistryEntries(entries);

export const professionRegistry = Object.freeze(
  entries.map((entry) => Object.freeze({ ...entry })),
);

/**
 * Registry subset that can run in the shared profession application shell.
 */
export const nativeProfessionRegistry = Object.freeze(
  professionRegistry.filter(
    (entry) => entry.applicationKind === PROFESSION_APPLICATION_KINDS.NATIVE,
  ),
);

export const standaloneProfessionRegistry = Object.freeze(
  professionRegistry.filter(
    (entry) =>
      entry.applicationKind === PROFESSION_APPLICATION_KINDS.STANDALONE,
  ),
);

const byId = new Map(professionRegistry.map((entry) => [entry.id, entry]));

export const professionOptions = Object.freeze(
  professionRegistry.map(({ id, name }) => Object.freeze({ id, name })),
);

export const PROFESSION_ROUTES = Object.freeze(
  Object.fromEntries(professionRegistry.map(({ id, route }) => [id, route])),
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
  const entry = getProfessionEntry(professionId);
  if (entry?.applicationKind !== PROFESSION_APPLICATION_KINDS.NATIVE) {
    return null;
  }
  const load = entry.loadAppAdapter;
  return typeof load === "function" ? load() : null;
}
