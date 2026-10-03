import { emitMesmerTraitBuffs } from '#gw2/professions/mesmer/core/mechanics/trait-buffs.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  MesmerPhantasmPolicy,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerProfiledTraitDamage } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Activates Deadly Blades only after a successfully resolved Virtuoso Bladesong. */
export function resolveDeadlyBlades(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.DEADLY_BLADES)) return;

  const at = resolution.at;
  const deadlyBladesProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
  emitMesmerTraitBuffs(runtime, TRAIT.DEADLY_BLADES, at, resolution.skill.name, [
    {
      // Deadly Blades starts after the Bladesong's same-time resolution work.
      priority: 5,
      kind: 'deadly-blades',
      stacks: 1,
      duration: balanceProfileNumber(deadlyBladesProfile, 'durationMultiplier')
    }
  ]);
}

export function phantasmalBladesDamage(context: MesmerRuntime): MesmerTraitDamage {
  // The phantasm conversion keeps its fixed weapon strength independently of patched or removed attacks.
  return mesmerProfiledTraitDamage(context, { weaponStrength: 2553.5 }, TRAIT.PHANTASMAL_BLADES);
}

/** Removed strikes cannot install a bonus packet; blade-tick conversion remains a Virtuoso mechanic. */
export function phantasmalBladesPolicy(
  context: MesmerRuntime,
  damage: MesmerTraitDamage
): Partial<MesmerPhantasmPolicy> {
  return hasTrait(context, TRAIT.PHANTASMAL_BLADES) && damage.type === 'strike'
    ? { bonusStrike: { name: 'Phantasmal Blade', traitName: 'Phantasmal Blades', damage } }
    : {};
}

/** Blade critical rewards preserve Deadly Blades before Jagged Mind and each packet's original actor ownership. */
export const resolveBladeCriticalTraits: NonNullable<
  RuntimeProfession<MesmerRuntimeState, MesmerSkill>['reactions']
>['damage.resolved'] = (runtime, event, details) => {
  const mechanics = mesmerMechanicsFor(runtime);
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if ((!event.metadata?.blade && !skill?.blade) || event.canCrit === false) return;
  for (const [id, name, condition, proc] of [
    [TRAIT.DEADLY_BLADES, 'Deadly Blades', 'Vulnerability', 'mesmer.virtuoso.deadly-blades'],
    [TRAIT.JAGGED_MIND, 'Jagged Mind', 'Bleeding', 'mesmer.virtuoso.jagged-mind']
  ] as const) {
    if (!hasTrait(runtime, id) || (id === TRAIT.DEADLY_BLADES && event.actorType !== 'player')) continue;
    const effect = requireEffect(requireBalanceProfileFromContext(runtime, id), 'condition', condition);
    if (!effect) continue;
    const critical = (details as NativeResolvedDamageDetails).hitContext!.critical;
    const application = advanceCriticalProc(criticalOpportunity(critical.chance, critical.didCrit), {
      id: proc,
      at: runtime.time
    });
    if (!application) continue;
    runtime.emitDerived(
      event,
      buildResolverCondition({
        at: runtime.time,
        name: `${event.name} — ${name}`,
        skillName: event.skillName,
        parentSkillName: event.parentSkillName,
        condition,
        stacks: application.quantity * Number(effect.stacks),
        duration: Number(effect.duration),
        source: id === TRAIT.DEADLY_BLADES ? 'Trait' : event.source,
        sourceId: id,
        actorType: id === TRAIT.DEADLY_BLADES ? 'effect' : event.actorType,
        ...(id === TRAIT.DEADLY_BLADES ? { ownerActorType: 'player' as const } : {})
      })
    );
    if (id === TRAIT.JAGGED_MIND) mechanics.addTraitProc(name, runtime.time, event.skillName);
  }
};

/** Direct simulations convert configured Vitality at the original imperative attribute boundary; built stats already include it. */
export function quietIntensityFerocity(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.QUIET_INTENSITY) && !professionStaticRulesApplied(context.config)
    ? (context.config?.stats?.vitality || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'vitalityConversion')
    : 0;
}

/** Preserve the original combined attribute adjustment so its zero-delta and provenance behavior stays intact. */
export function applyVirtuosoTraitAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  const staticApplied = professionStaticRulesApplied(context.config);
  const quietIntensityDelta = quietIntensityFerocity(context);
  const sharpeningSorrowDelta = hasTrait(context, TRAIT.SHARPENING_SORROW)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHARPENING_SORROW), 'expertiseBonus') *
      (Number(boonActive(context, 'fury')) - Number(staticApplied && Boolean(context.config?.boons?.fury)))
    : 0;
  if (quietIntensityDelta === 0 && sharpeningSorrowDelta === 0) return attributes;
  return {
    ...attributes,
    ferocity: (attributes.ferocity || 0) + quietIntensityDelta,
    expertise: (attributes.expertise || 0) + sharpeningSorrowDelta
  };
}

/** Refunds blades only after a completed Bladesong commits the configured maximum-spend threshold. */
export function resolveInfiniteForgeRefund(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  const runtime = mesmerMechanicsFor(context);
  if (
    !hasTrait(context, TRAIT.INFINITE_FORGE) ||
    resolution.spent <
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE), 'threshold')
  ) {
    return;
  }

  const infiniteForgeProfile = requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE);
  runtime.resources.queueResources(
    resolution.at,
    balanceProfileNumber(infiniteForgeProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Infinite Forge refund',
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: 'Infinite Forge'
    }
  );
}

/** Start the passive only after Virtuoso has installed its blade lifecycle; pulses schedule their own successor. */
export function startInfiniteForge(context: MesmerRuntime): void {
  if (hasTrait(context, TRAIT.INFINITE_FORGE)) {
    const interval = balanceProfileNumber(
      requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE),
      'pulseInterval'
    );
    if (interval > 0) context.schedule('mesmer.infinite-forge', interval, undefined, undefined, -20);
  }
}
