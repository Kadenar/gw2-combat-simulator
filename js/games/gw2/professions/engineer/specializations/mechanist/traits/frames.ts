import type { SkillId, BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { selectedMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import {
  MECHANIST_BALANCE_PROFILES,
  MECHANIST_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/engineer/specializations/mechanist/profiles.js';

interface EngineerMechAttributes {
  power: number;
  precision: number;
  toughness: number;
  vitality: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  concentration: number;
  healingPower: number;
}

/** Choose this command row in its existing priority order, retaining the first option for an empty selection. */
export function mechFrameCommand(traits: EngineerConfig | ReadonlySet<SkillId>): SkillId {
  return selectedMechCommand(traits, [
    [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, ID.DISCHARGE_ARRAY],
    [TRAIT.MECH_FRAME_CHANNELING_CONDUITS, ID.CRISIS_ZONE],
    [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, ID.CORE_REACTOR_SHOT]
  ]);
}

/** Read non-negative player attributes with the same missing-stat baseline used by standalone initialization. */
function playerAttribute(stats: Partial<Gw2Stats>, key: keyof EngineerMechAttributes, fallback = 0): number {
  return Math.max(0, stats[key] ?? fallback);
}

/** Frame selection adjusts inheritance groups and caps without applying player boon or damage ownership. */
export function engineerMechAttributes(
  config: EngineerConfig = {},
  playerStats: Partial<Gw2Stats> = {},
  profile: BalanceProfile = MECHANIST_BALANCE_PROFILES.find((entry) => entry.id === PROFILE.resources)!
): EngineerMechAttributes {
  const traits = selectedEngineerTraits(config);
  const conductive = hasTrait(traits, TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS);
  const channeling = hasTrait(traits, TRAIT.MECH_FRAME_CHANNELING_CONDUITS);
  const variable = hasTrait(traits, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR);

  // Standalone initialization uses the canonical declaration; runtime callers pass their selected profile.
  const balanceContext = { balanceProfile: () => profile };
  const resourcesProfile = requireBalanceProfileFromContext(balanceContext, PROFILE.resources);
  const baseAttribute = balanceProfileNumber(resourcesProfile, 'baseAttribute');
  const inheritanceRatio = balanceProfileNumber(resourcesProfile, 'inheritanceRatio');
  const secondaryCap = balanceProfileNumber(resourcesProfile, 'secondaryAttributeCap');
  const improvedSecondaryCap = balanceProfileNumber(resourcesProfile, 'improvedSecondaryAttributeCap');
  const improvedInheritanceRatio = balanceProfileNumber(resourcesProfile, 'improvedInheritanceRatio');
  // Secondary stats inherit 50 % of the player's value up to 750.
  // Conductive Alloys and Channeling Conduits each double the cap to 1500 and
  // raise the inheritance ratio to 100 % for their respective stat groups.
  const secondary = (key: keyof EngineerMechAttributes, improved = false): number =>
    Math.min(
      improved ? improvedSecondaryCap : secondaryCap,
      playerAttribute(playerStats, key) * (improved ? improvedInheritanceRatio : inheritanceRatio)
    );

  return {
    power: Math.min(
      balanceProfileNumber(resourcesProfile, 'powerCap'),
      baseAttribute + playerAttribute(playerStats, 'power', 1000) * inheritanceRatio
    ),
    precision: variable
      ? Math.min(
          balanceProfileNumber(resourcesProfile, 'precisionCap'),
          balanceProfileNumber(resourcesProfile, 'basePrecision') + playerAttribute(playerStats, 'precision', 1000)
        )
      : balanceProfileNumber(resourcesProfile, 'basePrecision'),
    toughness: baseAttribute + playerAttribute(playerStats, 'toughness', 1000),
    vitality: baseAttribute + playerAttribute(playerStats, 'vitality', 1000),
    ferocity: secondary('ferocity'),
    conditionDamage: secondary('conditionDamage', conductive),
    expertise: secondary('expertise', conductive),
    concentration: secondary('concentration', channeling),
    healingPower: secondary('healingPower', channeling)
  };
}
