/**
 * Lazy application manifest for every simulator exposed by the shared UI.
 *
 * Registry entries contain only presentation metadata and explicit dynamic
 * import functions. Reading this module therefore does not eagerly load any
 * profession implementation. Every profession is bootstrapped through the
 * shared profession app adapter.
 */

import type { Gw2AppAdapter, ProfessionAppContract } from "./types.js";

/** Armor classes, ordered as navigation surfaces group professions. */
export const ARMOR_WEIGHTS = Object.freeze([
  "light",
  "medium",
  "heavy",
] as const);

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];

/** Display labels for each armor class group. */
export const ARMOR_WEIGHT_LABELS: Readonly<Record<ArmorWeight, string>> =
  Object.freeze({
    light: "Light Armor",
    medium: "Medium Armor",
    heavy: "Heavy Armor",
  });

export interface ProfessionRegistryEntry {
  /** Stable lowercase identifier used by builds and pages. */
  readonly id: string;
  /** Armor class used to group professions in navigation surfaces. */
  readonly armorWeight: ArmorWeight;
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
  /** Lazy shared-shell adapter loader. */
  readonly loadAppAdapter: () => Promise<Gw2AppAdapter>;
}

// Entries are ordered by armor class so navigation surfaces group
// professions Light → Medium → Heavy: the shared UI (landing card grid and
// simulator header select) renders in registry order.
const entries: ProfessionRegistryEntry[] = [
  // Light armor: Elementalist, Mesmer, Necromancer.
  {
    id: "elementalist",
    armorWeight: "light",
    name: "Elementalist",
    icon: "https://render.guildwars2.com/file/BBED46EB20C80D0DDE0F99402493C7E6FFAE1530/156629.png",
    route: "elementalist.html",
    themeClass: "elementalist-theme",
    specializationSummary: "Core · Tempest · Weaver · Catalyst · Evoker",
    loadProfession: async () => {
      const module =
        await import("../../professions/elementalist/definition.js");
      return module.elementalistProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/elementalist/app/app-definition.js");
      return module.elementalistAppAdapter;
    },
  },
  {
    id: "mesmer",
    armorWeight: "light",
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
    id: "necromancer",
    armorWeight: "light",
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
  // Medium armor: Ranger, Thief, Engineer.
  {
    id: "ranger",
    armorWeight: "medium",
    name: "Ranger",
    icon: "https://render.guildwars2.com/file/49B10316B424F4E20139EB5E51ADCF24A8724E9B/156640.png",
    route: "ranger.html",
    themeClass: "ranger-theme",
    specializationSummary: "Core · Druid · Soulbeast · Untamed · Galeshot",
    loadProfession: async () => {
      const module = await import("../../professions/ranger/definition.js");
      return module.rangerProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/ranger/app/app-definition.js");
      return module.rangerAppAdapter;
    },
  },
  {
    id: "thief",
    armorWeight: "medium",
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
  {
    id: "engineer",
    armorWeight: "medium",
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
  // Heavy armor: Guardian, Warrior, Revenant.
  {
    id: "guardian",
    armorWeight: "heavy",
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
    id: "warrior",
    armorWeight: "heavy",
    name: "Warrior",
    icon: "https://render.guildwars2.com/file/0A97E13F29B3597A447EEC04A09BE5BD699A2250/156643.png",
    route: "warrior.html",
    themeClass: "warrior-theme",
    specializationSummary:
      "Core · Berserker · Spellbreaker · Bladesworn · Paragon",
    loadProfession: async () => {
      const module = await import("../../professions/warrior/definition.js");
      return module.warriorProfession;
    },
    loadAppAdapter: async () => {
      const module =
        await import("../../professions/warrior/app/app-definition.js");
      return module.warriorAppAdapter;
    },
  },
  {
    id: "revenant",
    armorWeight: "heavy",
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
  if (!ARMOR_WEIGHTS.includes(entry.armorWeight)) {
    throw new TypeError(`${entry.id} has an invalid armor weight.`);
  }
  if (typeof entry.loadAppAdapter !== "function") {
    throw new TypeError(`${entry.id} requires an adapter loader.`);
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

export interface ProfessionArmorGroup {
  readonly weight: ArmorWeight;
  readonly label: string;
  readonly entries: readonly ProfessionRegistryEntry[];
}

/**
 * Registry entries partitioned by armor class in `ARMOR_WEIGHTS` order, for
 * navigation surfaces that render grouped headers. Empty groups are omitted.
 */
export const professionGroups: readonly ProfessionArmorGroup[] = Object.freeze(
  ARMOR_WEIGHTS.map((weight) =>
    Object.freeze({
      weight,
      label: ARMOR_WEIGHT_LABELS[weight],
      entries: Object.freeze(
        professionRegistry.filter((entry) => entry.armorWeight === weight),
      ),
    }),
  ).filter((group) => group.entries.length > 0),
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
 * Lazily loads a profession's shared-shell adapter, or `null` for an unknown ID.
 */
export async function loadProfessionAppAdapter(
  professionId: string,
): Promise<Gw2AppAdapter | null> {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadAppAdapter() : null;
}
