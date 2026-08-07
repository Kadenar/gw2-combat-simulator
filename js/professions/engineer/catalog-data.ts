import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import { SKILLS, SPECIALIZATIONS } from "./data/engineer-api-metadata.js";
import { ENGINEER_SUPPLEMENTAL_SKILLS } from "./data/engineer-supplemental-skills.js";
import { ENGINEER_SKILL_IDS as ID } from "./data/ids.js";
import { TRAITS } from "./data/traits-data.js";
import type {
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillId,
  SkillHandlerStrategy,
} from "../../platform/engine/types.js";
import type { NativeAutoattackChains } from "../../platform/gw2/native-profession.js";

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
  "Elixir B", "Elixir C", "Elixir S", "Elixir U", "Elixir R",
  "Utility Goggles", "Rocket Boots",
]);

const generatedIds = new Set<SkillId>(SKILLS.map((skill) => skill.id));
const generatedSource = SKILLS.map((skill) => ({ ...skill }));
const allDeclared: readonly Skill[] = [
  ...generatedSource,
  ...ENGINEER_SUPPLEMENTAL_SKILLS,
];
const byId = new Map<SkillId, Skill>(allDeclared.map((skill) => [skill.id, skill]));
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allDeclared) {
  if (skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    byId.has(skill.flipSkillId)) {
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
const resolvedFlipParentId = (skillId: SkillId): SkillId | null =>
  preferredFlipParentById.get(skillId) ?? flipParentById.get(skillId) ?? null;

const generated: readonly Skill[] = generatedSource.map((skill) => ({
  ...skill,
  cooldown: Number(skill.ammo) > 0
    ? skill.ammoRecharge || skill.recharge
    : skill.recharge,
  flipParentId: resolvedFlipParentId(skill.id),
  implemented: false,
  effects: [],
  ...(UNSELECTABLE_SLOT_SKILLS.has(skill.name) ? { slotSelectable: false } : {}),
}));
const supplemental: readonly Skill[] = ENGINEER_SUPPLEMENTAL_SKILLS.map(
  (skill) => ({
    ...skill,
    icon: AMALGAM_PROTOCOL_ICONS.get(skill.name) || skill.icon,
    flipParentId: resolvedFlipParentId(skill.id),
    slotSelectable: false,
  }),
);

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> =
  Object.freeze({
    Holosmith: [
      ID.DEACTIVATE_PHOTON_FORGE, ID.ENGAGE_PHOTON_FORGE,
      ID.FLASH_CUTTER_STORM, ID.BRIGHT_SLASH_STORM,
      ID.HOLOGRAPHIC_SHOCKWAVE, ID.HOLO_LEAP, ID.LIGHT_STRIKE_STORM,
      ID.CORONA_BURST, ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.PHOTON_BLITZ,
      ID.FLASH_CUTTER,
    ],
    Scrapper: [ID.FUNCTION_GYRO, ID.FUNCTION_GYRO_ID_72103, ID.FUNCTION_GYRO_ID_72114],
    Mechanist: [ID.CRASH_DOWN, ID.RECALL_MECH, ID.MECH_SUPPORT_DEPTH_CHARGES],
    Amalgam: [
      ID.EVOLVE, ID.EVOLVE_ID_76651, ID.LOCKED, ID.LOCKED_ID_77107,
      ID.LOCKED_ID_77388,
    ],
  });
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(Object.fromEntries(
  Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
    skillIds.map((skillId) => [String(skillId), owner])
  ),
));

const WEAPONS = Object.freeze([
  "Hammer", "Mace", "Pistol", "Rifle", "Shield", "Shortbow", "Spear", "Sword",
]);
const WEAPON_HANDS = Object.freeze({
  Hammer: "2h", Mace: "mh", Pistol: "mh+oh", Rifle: "2h", Shield: "oh",
  Shortbow: "2h", Spear: "2h", Sword: "mh",
});

interface EngineerModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly handlers?:
    | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
    | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
  readonly autoattackChains?: NativeAutoattackChains;
}

function normalizeMechanics(
  mechanics: Readonly<Record<string, SkillFragment>>,
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(mechanics).map(([id, mechanic]) => {
      const declared = byId.get(Number(id));
      if (Number(id) === ID.FOCUSED_DEVASTATION) {
        return [id, { ...mechanic, simulatorExcluded: true }];
      }
      if (declared?.categories?.includes("Turret") &&
        Number.isFinite(Number(mechanic.paletteFlipSkillId))) {
        return [id, {
          ...mechanic,
          handlerId: "engineer.turret-deploy",
          effects: [],
        }];
      }
      if (!declared?.categories?.includes("Morph")) return [id, mechanic];
      return [id, { ...mechanic, handlerId: "engineer.amalgam-morph" }];
    }),
  ));
}

export const ENGINEER_GENERATED_SKILL_IDS = Object.freeze([...generatedIds]);

export function createEngineerModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    extraSkills = [],
    handlers,
    autoattackChains,
  }: EngineerModuleDataOptions<TContext>,
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics: normalizeMechanics(skillMechanics),
    extraSkills,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === "Core" ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
    ...(autoattackChains ? { autoattackChains } : {}),
  });
}

