import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { balanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
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
export function gainConduitAffinity(context: RevenantMechanicContext, amount: number, reason: string): number {
  // Affinity is combat-only, so explicit precasts may spend Energy or swap legends without building it.
  if (context.config.specialization !== 'Conduit' || !revenantCombatActive(context)) return 0;
  const state = conduitState.from(context);
  const coreState = professionCoreState(context);
  const affinityProfile = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  const maximum = Math.max(1, Number(affinityProfile?.maximumStacks ?? 1));
  state.affinityMaximum = maximum;
  const previous = Number(state.affinity || 0);
  state.affinity = grantCapped(previous, amount, maximum);
  if (previous < maximum && state.affinity === maximum && hasTrait(context, TRAIT.EXPANDED_CONSCIOUSNESS)) {
    const expanded = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness);
    coreState.energy = grantCapped(coreState.energy, Number(expanded?.resourceGain || 0), coreState.maximumEnergy);
  }

  if (state.affinity !== previous) {
    emitRevenantStateSnapshot(context, context.start ?? context.state.time, reason);
  }

  return state.affinity - previous;
}

/** Applies Mesmer-form costs to canonical skills; input aliases have already been resolved. */
export function syncConduitEnergyCostOverrides(context: RevenantSchedulerContext): void {
  const state = conduitState.from(context);
  if (state.conduitForm !== 'Mesmer') {
    state.energyCostOverrides = {};
    return;
  }

  state.energyCostOverrides = {
    [ID.EMPOWERING_MISERY]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerEmpoweringMisery)?.energyCost || 0
    ),
    [ID.PAIN_ABSORPTION]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerPainAbsorption)?.energyCost || 0
    ),
    [ID.BANISH_ENCHANTMENT]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment)?.energyCost || 0
    ),
    [ID.CALL_TO_ANGUISH]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerCallToAnguish)?.energyCost || 0
    ),
    [ID.UNYIELDING_IMPACT]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerUnyieldingImpact)?.energyCost || 0
    ),
    [ID.EMBRACE_THE_DARKNESS]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerEmbraceTheDarkness)?.energyCost || 0
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
  const profile = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.numinousGift);
  const audience = { recipients: options.allies ? ('party' as const) : ('self' as const) };
  const selectedLegends = professionCoreState(context).selectedLegendIds;
  for (const effect of profile?.effects || []) {
    if (effect.type !== 'boon' || !effect.boon) continue;
    const legendId = String(effect.metadata?.legendId || '');
    if (legendId && !selectedLegends.includes(legendId)) continue;
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd ?? context.state.time,
      name: `${skill.name} — ${effect.boon}`,
      kind: effect.boon,
      duration: Number(effect.duration || 0),
      stacks: Number(effect.stacks ?? 1),
      audience
    });
  }
}
