import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/engineer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  ENGINEER_SUPPLEMENTAL_SKILLS,
} from "./data/engineer-supplemental-skills.js";
import { ENGINEER_SKILL_IDS as ID } from "./data/ids.js";
import {
  ENGINEER_EXTRA_SKILLS,
  ENGINEER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  engineerSkillHandlers,
} from "./mechanics/specific/handlers.js";
import type {
  Skill,
  SkillFragment,
  SkillId,
} from "../../platform/engine/types.js";

const AMALGAM_PROTOCOL_ICONS = new Map<string, string>([
  ["Defensive Protocol: Cleanse", "https://render.guildwars2.com/file/71A2EA9B60E691E61521C2B621E665146BF1D1DD/3680127.png"],
  ["Defensive Protocol: Protect", "https://render.guildwars2.com/file/C043950F01DF7093BA14ACCCF67D1A16F245EAA8/3680132.png"],
  ["Defensive Protocol: Thorns", "https://render.guildwars2.com/file/5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png"],
  ["Offensive Protocol: Demolish", "https://render.guildwars2.com/file/337E150FB638D080A5A845A73D06B3E3ED7494C7/3680128.png"],
  ["Offensive Protocol: Obliterate", "https://render.guildwars2.com/file/569A167830C12BFC730095C72F1D095A7323DC3D/3680130.png"],
  ["Offensive Protocol: Pierce", "https://render.guildwars2.com/file/6C253CBFD36ABEB219013B62C4C73193C947ED60/3680131.png"],
  ["Offensive Protocol: Shred", "https://render.guildwars2.com/file/09A6184ADE9313765B0620780A27B23F4DF31D1A/3680134.png"],
]);
const UNSELECTABLE_SLOT_SKILLS = new Set([
  "Elixir B",
  "Elixir C",
  "Elixir S",
  "Elixir U",
  "Elixir R",
  "Utility Goggles",
  "Rocket Boots",
]);

const generatedIds = new Set<SkillId>(SKILLS.map(skill => skill.id));
const generatedSource = SKILLS.map(skill => ({
  ...skill,
}));
const allDeclared: readonly Skill[] = [
  ...generatedSource,
  ...ENGINEER_SUPPLEMENTAL_SKILLS,
];
const byId = new Map<SkillId, Skill>(
  allDeclared.map(skill => [skill.id, skill]),
);
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allDeclared) {
  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
    && byId.has(skill.flipSkillId)
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}
const preferredFlipParentById = new Map<SkillId, SkillId>([
  [ID.DETONATE_RIFLE_TURRET, ID.RIFLE_TURRET],
  [ID.DETONATE_FLAME_TURRET, ID.FLAME_TURRET],
  [ID.DETONATE_NET_TURRET, ID.NET_TURRET],
  [ID.DETONATE_THUMPER_TURRET, ID.THUMPER_TURRET],
  [ID.DETONATE_HEALING_TURRET, ID.HEALING_TURRET],
  [ID.DETONATE_ROCKET_TURRET, ID.ROCKET_TURRET],
  [ID.DETONATE, ID.THROW_MINE],
  [ID.STOW_FLAMETHROWER, ID.FLAMETHROWER],
  [ID.ELECTRIC_ARTILLERY, ID.LIGHTNING_ROD],
]);
const resolvedFlipParentId = (skillId: SkillId): SkillId | null => (
  preferredFlipParentById.has(skillId)
    ? preferredFlipParentById.get(skillId)!
    : flipParentById.get(skillId) ?? null
);
const generated = generatedSource.map(skill => ({
  ...skill,
  cooldown:
    (skill.ammo as number) > 0
      ? skill.ammoRecharge || skill.recharge
      : skill.recharge,
  flipParentId: resolvedFlipParentId(skill.id),
  implemented: false,
  effects: [],
  ...(UNSELECTABLE_SLOT_SKILLS.has(skill.name)
    ? { slotSelectable: false }
    : {}),
}));
const supplemental = ENGINEER_SUPPLEMENTAL_SKILLS.map(skill => ({
  ...skill,
  icon: AMALGAM_PROTOCOL_ICONS.get(skill.name) || skill.icon,
  flipParentId: resolvedFlipParentId(skill.id),
  slotSelectable: false,
}));
const mechanics: Record<string, SkillFragment> = Object.fromEntries(
  Object.entries(ENGINEER_SKILL_MECHANICS).map(([id, mechanic]) => {
    const declared = byId.get(Number(id));
    if (Number(id) === ID.FOCUSED_DEVASTATION) {
      return [id, {
        ...mechanic,
        simulatorExcluded: true,
      }];
    }
    if (
      declared?.categories?.includes("Turret")
      && Number.isFinite(Number(mechanic.paletteFlipSkillId))
    ) {
      return [id, {
        ...mechanic,
        handlerId: "engineer.turret-deploy",
        effects: [],
      }];
    }
    if (!declared?.categories?.includes("Morph")) return [id, mechanic];
    return [id, {
      ...mechanic,
      handlerId: "engineer.amalgam-morph",
    }];
  }),
);

export const engineerCatalog = createCanonicalCatalog({
  generated,
  mechanics,
  extraSkills: [...supplemental, ...ENGINEER_EXTRA_SKILLS],
  autoattackChains: {
    // The API exposes this automatic Rifle Burst damage packet as a chain.
    excludeSkillIds: [ID.RIFLE_BURST_GRENADE],
  },
  skillHandlers: engineerSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Hammer",
    "Mace",
    "Pistol",
    "Rifle",
    "Shield",
    "Shortbow",
    "Spear",
    "Sword",
  ],
  weaponHands: {
    Hammer: "2h",
    Mace: "mh",
    Pistol: "mh+oh",
    Rifle: "2h",
    Shield: "oh",
    Shortbow: "2h",
    Spear: "2h",
    Sword: "mh",
  },
});

export const ENGINEER_SKILLS = engineerCatalog.skills;
export const ENGINEER_GENERATED_SKILL_IDS = Object.freeze([...generatedIds]);
