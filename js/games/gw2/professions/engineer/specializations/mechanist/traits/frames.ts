import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { selectedMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-queries.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';

/** The mech's base attributes are fixed; Mechanical Genius and selected frames own inherited-stat tuning. */
export const MECH_BASE_ATTRIBUTES = Object.freeze({ attribute: 1000, precision: 1, criticalChance: 0.05 });

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
  config: EngineerConfig,
  playerStats: Partial<Gw2Stats>,
  balanceContext: unknown
): EngineerMechAttributes {
  const traits = selectedEngineerTraits(config);
  const conductive = hasTrait(traits, TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS)
    ? TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS
    : undefined;
  const channeling = hasTrait(traits, TRAIT.MECH_FRAME_CHANNELING_CONDUITS)
    ? TRAIT.MECH_FRAME_CHANNELING_CONDUITS
    : undefined;
  const variable = hasTrait(traits, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR);

  const baseAttribute = MECH_BASE_ATTRIBUTES.attribute;
  const inheritanceRatio = balanceNumberFromContext(balanceContext, TRAIT.MECHANICAL_GENIUS, 'inheritanceRatio');
  const secondaryCap = balanceNumberFromContext(balanceContext, TRAIT.MECHANICAL_GENIUS, 'secondaryAttributeCap');
  // Secondary stats inherit 50 % of the player's value up to 750.
  // Conductive Alloys and Channeling Conduits each double the cap to 1500 and
  // raise the inheritance ratio to 100 % for their respective stat groups.
  const secondary = (key: keyof EngineerMechAttributes, trait?: SkillId): number => {
    const improved = trait == null ? undefined : requireBalanceProfileFromContext(balanceContext, trait);
    return Math.min(
      improved ? balanceProfileNumber(improved, 'secondaryAttributeCap') : secondaryCap,
      playerAttribute(playerStats, key) *
        (improved ? balanceProfileNumber(improved, 'inheritanceRatio') : inheritanceRatio)
    );
  };

  return {
    power: Math.min(
      balanceNumberFromContext(balanceContext, TRAIT.MECHANICAL_GENIUS, 'powerCap'),
      baseAttribute + playerAttribute(playerStats, 'power', 1000) * inheritanceRatio
    ),
    precision: variable
      ? Math.min(
          balanceNumberFromContext(balanceContext, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, 'precisionCap'),
          MECH_BASE_ATTRIBUTES.precision + playerAttribute(playerStats, 'precision', 1000)
        )
      : MECH_BASE_ATTRIBUTES.precision,
    toughness: baseAttribute + playerAttribute(playerStats, 'toughness', 1000),
    vitality: baseAttribute + playerAttribute(playerStats, 'vitality', 1000),
    ferocity: secondary('ferocity'),
    conditionDamage: secondary('conditionDamage', conductive),
    expertise: secondary('expertise', conductive),
    concentration: secondary('concentration', channeling),
    healingPower: secondary('healingPower', channeling)
  };
}
