import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import {
  requireBalanceProfileFromContext,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/traits/index.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

type RevenantMechanicContext = RevenantSchedulerContext & {
  readonly start?: number;
  readonly effectiveEnd?: number;
  readonly skill?: RevenantSkill;
};

interface ConduitAffinityTaskPayload {
  readonly amount: number;
}

/** Adds capped Conduit affinity and snapshots a real resource change. */
export function gainConduitAffinity(context: RevenantMechanicContext, amount: number, reason: string): void {
  // Affinity is combat-only, so explicit precasts may spend Energy or swap legends without building it.
  if (context.config.specialization !== 'Conduit' || !revenantCombatActive(context)) return;
  const state = conduitState.from(context);
  const coreState = professionCoreState(context);
  const affinityProfile = requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  const maximum = Math.max(1, balanceProfileNumber(affinityProfile, 'maximumStacks'));
  state.affinityMaximum = maximum;
  const previous = Number(state.affinity || 0);
  state.affinity = grantCapped(previous, amount, maximum);
  if (previous < maximum && state.affinity === maximum && hasTrait(context, TRAIT.EXPANDED_CONSCIOUSNESS)) {
    const expanded = requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness);
    coreState.energy = grantCapped(
      coreState.energy,
      balanceProfileNumber(expanded, 'resourceGain'),
      coreState.maximumEnergy
    );
  }

  if (state.affinity !== previous) {
    emitRevenantStateSnapshot(context, context.start ?? context.state.time, reason);
  }
}

/** Applies Mesmer-form costs to canonical skills; input aliases have already been resolved. */
export function syncConduitEnergyCostOverrides(context: RevenantSchedulerContext): void {
  const state = conduitState.from(context);
  if (state.conduitForm !== 'Mesmer') {
    state.energyCostOverrides = {};
    return;
  }

  state.energyCostOverrides = {
    [ID.EMPOWERING_MISERY]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerEmpoweringMisery),
      'energyCost'
    ),
    [ID.PAIN_ABSORPTION]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerPainAbsorption),
      'energyCost'
    ),
    [ID.BANISH_ENCHANTMENT]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment),
      'energyCost'
    ),
    [ID.CALL_TO_ANGUISH]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerCallToAnguish),
      'energyCost'
    ),
    [ID.UNYIELDING_IMPACT]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerUnyieldingImpact),
      'energyCost'
    ),
    [ID.EMBRACE_THE_DARKNESS]: balanceProfileNumber(
      requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerEmbraceTheDarkness),
      'energyCost'
    )
  };
}

/** Resolves a delayed affinity gain scheduled for a qualifying hit. */
export const conduitAffinityReaction = scheduledReaction<
  RevenantSchedulerContext,
  SimulationEvent,
  ConduitAffinityTaskPayload
>({
  id: 'revenant.affinity-hit',
  select(context, event) {
    if (event.type === 'damage' && event.metadata?.affinityOnHit === true) {
      const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
      const cost = Number(skill?.energyCost || 0);
      // Affinity gain is deferred to a task so it resolves at the hit timestamp, not at cast start.
      // Skills costing ≥ 25 energy grant 2 affinity; cheaper skills grant 1.
      return {
        id: `revenant.affinity-hit:${event.eventOrder}`,
        at: event.at,
        payload: { amount: cost >= 25 ? 2 : 1 }
      };
    }

    return null;
  },
  execute(context, _at, payload) {
    gainConduitAffinity(context, payload.amount, 'enigmatic-connection-hit');
  }
});

/** Emits Numinous Gift's base and equipped-legend boon profile. */
export function emitNuminousGift(
  context: RevenantMechanicContext,
  skill: RevenantSkill,
  options: { readonly allies?: boolean } = {}
): void {
  if (context.config.specialization !== 'Conduit') return;
  const profile = requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.numinousGift);
  const audience = { recipients: options.allies ? ('party' as const) : ('self' as const) };
  const selectedLegends = professionCoreState(context).selectedLegendIds;
  // Every surviving boon is emitted by iteration, so removing one legend's boon leaves the others intact.
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'boon' || !effect.boon) continue;
    const legendId = String(effect.metadata?.legendId || '');
    if (legendId && !selectedLegends.includes(legendId)) continue;
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd ?? context.state.time,
      name: `${skill.name} — ${effect.boon}`,
      kind: effect.boon,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience
    });
  }
}
