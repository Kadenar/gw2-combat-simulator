/**
 * Lazy application manifest for every simulator exposed by the shared UI.
 *
 * Registry entries contain only presentation metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. The full registry includes standalone legacy
 * applications; `nativeProfessionRegistry` contains only applications that
 * can be bootstrapped through the shared profession app adapter.
 */

import type { Gw2AppAdapter, ProfessionAppContract } from "./types.js";

export const PROFESSION_APPLICATION_KINDS = Object.freeze({
  NATIVE: "native",
  STANDALONE: "standalone",
} as const);

export type ProfessionApplicationKind =
  (typeof PROFESSION_APPLICATION_KINDS)[keyof typeof PROFESSION_APPLICATION_KINDS];

export interface ProfessionRegistryEntry {
  /** Stable lowercase identifier used by builds and pages. */
  readonly id: string;
  /** Whether the route uses the shared app boundary or a legacy application. */
  readonly applicationKind: ProfessionApplicationKind;
  /** Human-readable profession name. */
  readonly name: string;
  /** Official base-profession icon used by navigation surfaces. */
  readonly icon?: string;
  /** Browser route for the profession application. */
  readonly route: string;
  /** Optional class applied to the document body. */
  readonly themeClass: string;
  /** Landing-card summary. */
  readonly specializationSummary: string;
  /** Lazy profession loader. */
  readonly loadProfession: () => Promise<ProfessionAppContract>;
  /** Lazy shared-shell adapter loader, or `null` for a standalone application. */
  readonly loadAppAdapter: (() => Promise<Gw2AppAdapter>) | null;
}

const entries: ProfessionRegistryEntry[] = [
  {
    id: "mesmer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Mesmer",
    icon: "https://render.guildwars2.com/file/AF61567E16A83F145D6FB35D63BF01074A3A5AB9/156635.png",
    route: "mesmer.html",
    themeClass: "mesmer-theme",
    specializationSummary:
      "Core · Chronomancer · Mirage · Virtuoso · Troubadour",
    loadProfession: async () => {
      const module = await import("../../professions/mesmer/definition.js");
      return module.mesmerProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/mesmer/app/app-definition.js");
      return module.mesmerAppAdapter;
    },
  },
  {
    id: "elementalist",
    applicationKind: PROFESSION_APPLICATION_KINDS.STANDALONE,
    name: "Elementalist",
    icon: "https://render.guildwars2.com/file/BBED46EB20C80D0DDE0F99402493C7E6FFAE1530/156629.png",
    route: "elementalist.html",
    themeClass: "",
    specializationSummary: "Core · Tempest · Weaver · Catalyst · Evoker",
    loadProfession: async () => {
      const module =
        await import("../../professions/elementalist/definition.js");
      return module.elementalistProfession;
    },
    // Elementalist remains a standalone legacy application.
    loadAppAdapter: null,
  },
  {
    id: "guardian",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Guardian",
    icon: "https://render.guildwars2.com/file/6E0D0AC6E0CE5C0C29B3D736ABEA070F4A58540E/156633.png",
    route: "guardian.html",
    themeClass: "guardian-theme",
    specializationSummary:
      "Core · Dragonhunter · Firebrand · Willbender · Luminary",
    loadProfession: async () => {
      const module = await import("../../professions/guardian/definition.js");
      return module.guardianProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/guardian/app/app-definition.js");
      return module.guardianAppAdapter;
    },
  },
  {
    id: "necromancer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Necromancer",
    icon: "https://render.guildwars2.com/file/CA5A4E96080FCF057C9DA0ED35C693477580421C/156637.png",
    route: "necromancer.html",
    themeClass: "necromancer-theme",
    specializationSummary: "Core · Reaper · Scourge · Harbinger · Ritualist",
    loadProfession: async () => {
      const module =
        await import("../../professions/necromancer/definition.js");
      return module.necromancerProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/necromancer/app/app-definition.js");
      return module.necromancerAppAdapter;
    },
  },
  {
    id: "engineer",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Engineer",
    icon: "https://render.guildwars2.com/file/A94D00911BD47CDE39A104F90C7D07DE623554ED/156631.png",
    route: "engineer.html",
    themeClass: "engineer-theme",
    specializationSummary: "Core · Scrapper · Holosmith · Mechanist · Amalgam",
    loadProfession: async () => {
      const module = await import("../../professions/engineer/definition.js");
      return module.engineerProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/engineer/app/app-definition.js");
      return module.engineerAppAdapter;
    },
  },
  {
    id: "revenant",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Revenant",
    icon: "https://render.guildwars2.com/file/696A48DD61EE01FD1F4FBBBDB82D74611E04EA39/965717.png",
    route: "revenant.html",
    themeClass: "revenant-theme",
    specializationSummary: "Core · Herald · Renegade · Vindicator · Conduit",
    loadProfession: async () => {
      const module = await import("../../professions/revenant/definition.js");
      return module.revenantProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/revenant/app/app-definition.js");
      return module.revenantAppAdapter;
    },
  },
  {
    id: "thief",
    applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
    name: "Thief",
    icon: "https://render.guildwars2.com/file/13A2C0EF23F23FF2084875629465279DDA807E3D/103581.png",
    route: "thief.html",
    themeClass: "thief-theme",
    specializationSummary: "Core · Daredevil · Deadeye · Specter · Antiquary",
    loadProfession: async () => {
      const module = await import("../../professions/thief/definition.js");
      return module.thiefProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/thief/app/app-definition.js");
      return module.thiefAppAdapter;
    },
  },
];

function validateEntry(
  entry: ProfessionRegistryEntry,
  ids: Set<string>,
  routes: Set<string>,
): void {
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

export function validateProfessionRegistryEntries(
  candidateEntries: readonly ProfessionRegistryEntry[],
): boolean {
  if (!Array.isArray(candidateEntries)) {
    throw new TypeError("Profession registry entries must be an array.");
  }
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const entry of candidateEntries) validateEntry(entry, ids, routes);
  return true;
}

validateProfessionRegistryEntries(entries);

export const professionRegistry: readonly ProfessionRegistryEntry[] =
  Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

/**
 * Registry subset that can run in the shared profession application shell.
 */
export const nativeProfessionRegistry: readonly ProfessionRegistryEntry[] =
  Object.freeze(
    professionRegistry.filter(
      (entry) => entry.applicationKind === PROFESSION_APPLICATION_KINDS.NATIVE,
    ),
  );

export const standaloneProfessionRegistry: readonly ProfessionRegistryEntry[] =
  Object.freeze(
    professionRegistry.filter(
      (entry) =>
        entry.applicationKind === PROFESSION_APPLICATION_KINDS.STANDALONE,
    ),
  );

const byId = new Map<string, ProfessionRegistryEntry>(
  professionRegistry.map((entry) => [entry.id, entry]),
);

export interface ProfessionOption {
  readonly id: string;
  readonly name: string;
}

export const professionOptions: readonly ProfessionOption[] = Object.freeze(
  professionRegistry.map(({ id, name }) => Object.freeze({ id, name })),
);

export const PROFESSION_ROUTES: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(professionRegistry.map(({ id, route }) => [id, route])),
  );

/**
 * Returns the registered entry for a profession ID, or `null` for an unknown ID.
 */
export function getProfessionEntry(
  professionId: string,
): ProfessionRegistryEntry | null {
  return byId.get(professionId) || null;
}

/**
 * Resolves a profession ID to its page, falling back to the landing page.
 */
export function professionRoute(professionId: string): string {
  return getProfessionEntry(professionId)?.route || "index.html";
}

/**
 * Lazily loads a profession contract, or `null` for an unknown ID.
 */
export async function loadProfession(
  professionId: string,
): Promise<ProfessionAppContract | null> {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadProfession() : null;
}

/**
 * Lazily loads a shared-shell adapter when the profession provides one.
 * Returns `null` for unknown or standalone entries.
 */
export async function loadProfessionAppAdapter(
  professionId: string,
): Promise<Gw2AppAdapter | null> {
  const entry = getProfessionEntry(professionId);
  if (entry?.applicationKind !== PROFESSION_APPLICATION_KINDS.NATIVE) {
    return null;
  }
  const load = entry.loadAppAdapter;
  return typeof load === "function" ? load() : null;
}
