import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  defineCatalogOwnership,
} from "../../platform/engine/catalog-ownership.js";
import { SKILLS, SPECIALIZATIONS } from "./data/revenant-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import { REVENANT_SUPPLEMENTAL_SKILLS } from "./data/revenant-supplemental-skills.js";
import {
  REVENANT_EXTRA_SKILLS,
  REVENANT_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import { REVENANT_SKILL_IDS as ID } from "./data/ids.js";
import { revenantSkillHandlers } from "./handlers.js";
import type {
  Skill,
  SkillId,
} from "../../platform/engine/types.js";

const generatedSource = SKILLS.filter(
  (skill) => skill.name !== "Duelist's Preparation",
).map((skill) => ({
  ...skill,
}));
const allDeclared: readonly Skill[] = [
  ...generatedSource,
  ...REVENANT_SUPPLEMENTAL_SKILLS,
];
const byId = new Map<SkillId, Skill>(
  allDeclared.map((skill) => [skill.id, skill]),
);
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allDeclared) {
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    byId.has(skill.flipSkillId)
  )
    flipParentById.set(skill.flipSkillId, skill.id);
}
const normalize = (skill: Skill): Skill => ({
  ...skill,
  simulatorExcluded: false,
  ...(skill.recharge == null && skill.ammoRecharge == null
    ? {}
    : {
        cooldown:
          Number(skill.ammo) > 0
            ? skill.ammoRecharge || skill.recharge
            : skill.recharge,
      }),
  flipParentId: flipParentById.get(skill.id) ?? skill.flipParentId ?? null,
});
const generated = generatedSource.map((skill) => ({
  ...normalize(skill),
  implemented: false,
  effects: [],
}));
const supplemental = REVENANT_SUPPLEMENTAL_SKILLS.map(normalize);

export const revenantCatalog = createCanonicalCatalog({
  generated,
  mechanics: REVENANT_SKILL_MECHANICS,
  extraSkills: [...supplemental, ...REVENANT_EXTRA_SKILLS],
  skillHandlers: revenantSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Greatsword",
    "Hammer",
    "Mace",
    "Scepter",
    "Shield",
    "Shortbow",
    "Spear",
    "Staff",
    "Sword",
  ],
  weaponHands: {
    Axe: "oh",
    Greatsword: "2h",
    Hammer: "2h",
    Mace: "mh",
    Scepter: "mh",
    Shield: "oh",
    Shortbow: "2h",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh+oh",
  },
});

export const REVENANT_SKILLS = revenantCatalog.skills;

export const REVENANT_ELITE_SPECIALIZATIONS = Object.freeze([
  "Herald",
  "Renegade",
  "Vindicator",
  "Conduit",
]);

export const revenantCatalogOwnership = defineCatalogOwnership({
  catalog: revenantCatalog,
  modules: ["Core", ...REVENANT_ELITE_SPECIALIZATIONS],
  skillOverrides: {
    [ID.FACET_OF_NATURE]: "Herald",
    [ID.TRUE_NATURE]: "Herald",
    [ID.TRUE_NATURE_ID_51675]: "Herald",
    [ID.TRUE_NATURE_ID_51696]: "Herald",
    [ID.TRUE_NATURE_ID_51713]: "Herald",
    [ID.TRUE_NATURE_ID_51714]: "Herald",
    [ID.HEROIC_COMMAND]: "Renegade",
    [ID.CITADEL_BOMBARDMENT]: "Renegade",
    [ID.ORDERS_FROM_ABOVE]: "Renegade",
    [ID.ALLIANCE_TACTICS]: "Vindicator",
    [ID.ENERGY_MELD]: "Vindicator",
    [ID.ENERGY_MELD_ID_72058]: "Vindicator",
    [ID.COSMIC_WISDOM]: "Conduit",
    [ID.RELEASE_POTENTIAL_MONK]: "Conduit",
    [ID.RELEASE_POTENTIAL_MESMER]: "Conduit",
    [ID.RELEASE_POTENTIAL_DERVISH]: "Conduit",
    [ID.RELEASE_POTENTIAL_ASSASSIN]: "Conduit",
    [ID.RELEASE_POTENTIAL_WARRIOR]: "Conduit",
  },
  handlerOwners: {
    "revenant.elemental-blast": "Herald",
    "revenant.facet-consume": "Herald",
    "revenant.heroic-command": "Renegade",
    "revenant.orders-from-above": "Renegade",
    "revenant.band-together": "Renegade",
    "revenant.energy-meld": "Vindicator",
    "revenant.alliance-tactics": "Vindicator",
    "revenant.beguiling-haze": "Conduit",
    "revenant.gladiators-defense": "Conduit",
    "revenant.hex-eater-vortex": "Conduit",
    "revenant.twin-moon-sweep": "Conduit",
    "revenant.release-potential": "Conduit",
    "revenant.cosmic-wisdom": "Conduit",
  },
  core: { ownsWeapons: true },
});

export const revenantModuleCatalog = revenantCatalogOwnership.fragment;
