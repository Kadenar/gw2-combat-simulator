import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/content/professions/revenant/data/ids.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type {
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

type RevenantMechanicContext = RevenantSchedulerContext & {
  readonly start?: number;
  readonly effectiveEnd?: number;
  readonly skill?: RevenantSkill;
};

interface ConduitAffinityTaskPayload extends SchedulerRecord {
  readonly amount: number;
}

/** Adds capped Conduit affinity and snapshots a real resource change. */
export function gainConduitAffinity(context: RevenantMechanicContext, amount: number, reason: string): number {
  if (context.config.specialization !== 'Conduit') return 0;
  const state = conduitState.from(context);
  const coreState = professionCoreState(context);
  const affinityProfile = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  const maximum = Math.max(1, Number(affinityProfile?.maximumStacks || 1));
  state.affinityMaximum = maximum;
  const previous = Number(state.affinity || 0);
  state.affinity = Math.min(maximum, previous + Math.max(0, Number(amount || 0)));
  if (previous < maximum && state.affinity === maximum && hasTrait(context, TRAIT.EXPANDED_CONSCIOUSNESS)) {
    const expanded = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness);
    coreState.energy = Math.min(
      coreState.maximumEnergy,
      coreState.energy + Math.max(0, Number(expanded?.resourceGain || 0))
    );
  }

  if (state.affinity !== previous) {
    emitRevenantStateSnapshot(context, context.start ?? context.state.time, reason);
  }

  return state.affinity - previous;
}

/** Refreshes Conduit-owned Energy overrides from the active Mesmer form profiles. */
export function syncConduitEnergyCostOverrides(context: RevenantSchedulerContext): void {
  const state = conduitState.from(context);
  if (state.conduitForm !== 'Mesmer') {
    state.energyCostOverrides = {};
    return;
  }

  state.energyCostOverrides = {
    [ID.BANISH_ENCHANTMENT]: Number(
      balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment)?.energyCost || 0
    ),
    [ID.BANISH_ENCHANTMENT_ID_78587]: Number(
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
export function handleConduitAffinityHit(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<ConduitAffinityTaskPayload>
): void {
  if (!task.payload) return;
  gainConduitAffinity(context, task.payload.amount, 'enigmatic-connection-hit');
}

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
      stacks: Number(effect.stacks || 1),
      audience
    });
  }
}
