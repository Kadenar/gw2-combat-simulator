import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber, balanceProfileNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { activeStackCount } from '#kernel/resources/timed-stacks.js';

// Siphon adds the two reductions before Alacrity or other recharge rates apply.
export function additiveStealRecharge(
  source: BalanceProfileSource,
  selected: (id: SkillId) => boolean,
  work: number
): number {
  const reduction = (id: SkillId) => (selected(id) ? 1 - balanceNumber(source, id, 'rechargeMultiplier') : 0);
  return work * (1 - reduction(TRAIT.LEAD_ATTACKS) - reduction(TRAIT.SLEIGHT_OF_HAND));
}

/** Lead Attacks stacks expire individually, so a siphon counts those active at its own impact. */
export function leadAttacksSiphonMultiplier(
  context: {
    readonly profession: unknown;
    readonly traits: unknown;
    readonly helpers: import('#gw2/platform/skills/balance-profiles.js').BalanceProfileSource;
  },
  at: number
): number {
  if (!hasTrait(context.traits, TRAIT.LEAD_ATTACKS)) return 1;

  const state = readProfessionCoreState<ThiefCoreState>(context.profession);
  const leadAttacksProfile = requireBalanceProfile(context.helpers, TRAIT.LEAD_ATTACKS);
  const stacks = Math.min(
    balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
    activeStackCount(state.leadAttackExpirations || [], at)
  );
  return 1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack');
}
