import {
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe alchemy tooltips from the selected balance data. */
export const engineerAlchemyTooltips = {
  [TRAIT.HIDDEN_FLASK]: outsideScopeTooltip,
  [TRAIT.TRANSMUTE]: outsideScopeTooltip,
  [TRAIT.COMPOUNDING_CHEMICALS]: traitTooltip('Gain concentration.', [
    ['attributeBonuses.concentration', 'Concentration']
  ]),
  [TRAIT.INVIGORATING_SPEED]: outsideScopeTooltip,
  [TRAIT.PROTECTION_INJECTION]: outsideScopeTooltip,
  [TRAIT.HEALTH_INSURANCE]: outsideScopeTooltip,
  [TRAIT.COMEBACK_CURE]: outsideScopeTooltip,
  [TRAIT.BOILING_POINT]: traitTooltip('Gaining might while at or above the might threshold grants fury.', [
    ['threshold', 'Might needed for fury'],
    ['internalCooldown', 'Fury cooldown', tooltipSeconds]
  ]),
  // This custom marker carries a finisher rather than an ordinary damage or boon payload.
  [TRAIT.BLAST_ZONE]: (balanceContext, entity) => ({
    description: 'Using your healing tool belt skill or first mech command creates a blast finisher at your location.',
    facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap((effect) =>
      (effect.comboFinishers || []).map((finisher) => ({
        name: 'Combo finisher',
        detail: String(finisher.finisherType)
      }))
    )
  }),
  [TRAIT.HGH]: traitTooltip(
    'Completing an elixir grants might and fury. Elixir boons, conditions, and combo fields last longer; Acid Bomb gains an additional strike pulse.',
    [['durationMultiplier', 'Elixir boon, condition, and field duration', tooltipFactorChange]]
  ),
  [TRAIT.EQUAL_AND_OPPOSITE_REACTION]: traitTooltip(
    'Disabling an enemy with a player-owned stun, daze, knockback, pull, knockdown, launch, float, sink, taunt, or fear grants quickness and stability.',
    [['internalCooldown', 'Cooldown', tooltipSeconds]]
  ),
  [TRAIT.CHAIN_REACTIVITY]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
