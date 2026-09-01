import { conduitState } from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/revenant/data/ids.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { revenantCombatActive } from '#gw2/content/professions/revenant/core/mechanics/legend-swap.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { revenantConduitFormIsActive } from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import { applyCosmicWisdomAfterCast } from '#gw2/content/professions/revenant/specializations/conduit/mechanics/forms.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/specializations/conduit/skills/index.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

// Twin Moon Sweep exists under two different skill IDs in the catalog; both must be excluded from Mistfire.
const TWIN_MOON_SKILL_IDS = new Set<SkillId>([ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001]);

export function modifyConduitCastDuration(context: RevenantPrecastContext, duration: number): number {
  if (context.skill?.handlerId !== 'revenant.beguiling-haze') return duration;
  const quickness = context.hasBuff?.('quickness', context.start);
  const followUpProfile = context.catalog.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);
  const mainExtensionProfile = context.catalog.balanceProfilesById.get(
    CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension
  );
  if (!followUpProfile || !mainExtensionProfile) {
    throw new Error('Missing Beguiling Haze cast-duration profiles.');
  }

  // Follow-up charges use a near-instant fixed cast time (0.25 s / 0.24 s with quickness).
  // The main cast appends an extra 0.4 s wind-up on top of the base skill duration.
  if (Number(conduitState.from(context).beguilingHazeCharges || 0) > 0) {
    const followUpDuration = Number(followUpProfile.castTimeMs || 0) / 1000;
    return followUpDuration * (quickness ? Number(followUpProfile.quicknessCastMultiplier || 1) : 1);
  }

  const mainExtension = Number(mainExtensionProfile.castTimeMs || 0) / 1000;
  return duration + mainExtension * (quickness ? Number(mainExtensionProfile.quicknessCastMultiplier || 1) : 1);
}

export function modifyConduitRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  const skill = context.skill;
  // Skip recharge modification for an already-zero cooldown to avoid turning a free swap into a 0 * 0.6 no-op.
  if (duration === 0 && skill?.id === ID.SWAP_LEGENDS) return 0;
  if (
    skill?.id === ID.SWAP_LEGENDS &&
    revenantCombatActive(context, context.at) &&
    hasTrait(context.config, TRAIT.ENHANCED_EMBODIMENT)
  ) {
    const profile = context.catalog.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment);
    // Enhanced Embodiment reduces the legend swap cooldown to 60%; read from skill data, not the incoming duration,
    // because the duration may already have been modified by alacrity at this point.
    return (
      Math.max(0, Number(skill.cooldown ?? skill.recharge ?? duration)) *
      Math.max(0, Number(profile?.rechargeMultiplier ?? 1))
    );
  }

  if (
    ([ID.BANISH_ENCHANTMENT, ID.BANISH_ENCHANTMENT_ID_78587] as readonly number[]).includes(Number(skill?.id)) &&
    revenantConduitFormIsActive(
      conduitState.from(context),
      'Mesmer',
      // Use start (cast time) when available; fall back to at (recharge resolution time).
      context.start ?? context.at
    )
  ) {
    // Mesmer form overrides Banish Enchantment's cooldown entirely; alacrity still applies to the new 5 s base.
    const profile = context.catalog.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment);
    const base = Math.max(0, Number(profile?.cooldown || 0));
    const rate = context.hasBuff?.('alacrity', context.at) ? Number(context.config.alacrityRechargeRate || 1.25) : 1;
    return base / rate;
  }

  // Kinetic Insight reduces Release Potential recharge by 20%, applied after all other recharge modifiers.
  return skill?.handlerId === 'revenant.release-potential' && hasTrait(context.config, TRAIT.KINETIC_INSIGHT)
    ? duration * 0.8
    : duration;
}

export function afterConduitTraitCast(context: RevenantCastContext, skill: RevenantSkill): void {
  // Cosmic Wisdom form procs (Lesser Enchanted Daggers, Dervish Attack) fire after cast completes.
  applyCosmicWisdomAfterCast(context, skill);
  // Shared Wisdom swiftness is only granted for Entity legend skills, not for all Conduit skills.
  if (skill.legendId === LEGEND.ENTITY && hasTrait(context.config, TRAIT.SHARED_WISDOM)) {
    const shared = context.catalog.balanceProfilesById
      .get(CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom)
      ?.effects?.find((effect) => effect.metadata?.trigger === 'entity-skill');
    if (shared?.type === 'boon' && shared.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${shared.boon}`,
        kind: shared.boon,
        duration: Number(shared.duration || 0),
        stacks: Number(shared.stacks || 1)
      });
    }
  }
}

export function observeConduitTraits(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type === 'damage' && event.affinityOnHit === true) {
    const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
    const cost = Number(skill?.energyCost || 0);
    // Affinity gain is deferred to a task so it resolves at the hit timestamp, not at cast start.
    // Skills costing ≥ 25 energy grant 2 affinity; cheaper skills grant 1.
    context.tasks.schedule({
      id: `revenant.affinity-hit:${event.eventOrder}`,
      type: 'revenant.affinity-hit',
      at: event.at,
      payload: { amount: cost >= 25 ? 2 : 1 }
    });
  }

  if (context.config.relic === 'Peitha' && event.type === 'damage' && event.skillName === 'Beguiling Haze') {
    // 0.32 s matches the observed Relic of Peitha proc delay after Beguiling Haze lands.
    context.emitDerived(event, {
      type: 'peitha',
      at: event.at + 0.32,
      source: 'revenant',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Relic of Peitha'
    });
  }

  if (
    event.type !== 'control' ||
    // Twin Moon Sweep emits control events as part of its own chain; Mistfire must not double-proc off them.
    (event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) ||
    !hasTrait(context.config, TRAIT.MISTFIRE)
  ) {
    return;
  }

  const state = conduitState.from(context);
  const profile = context.catalog.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.mistfire);
  const burning = profile?.effects?.find((effect) => effect.type === 'condition');
  const readyAt = Number(state.mistfireReadyAt || 0);
  // Mistfire follows the shared strict ICD boundary used by other event-driven procs.
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.mistfireReadyAt = event.at + Math.max(0, Number(profile?.cooldown || 0));
  emitSkillCondition(context, {
    cause: event,

    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.MISTFIRE,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: TRAIT.MISTFIRE,
    skillName: 'Mistfire',
    name: 'Mistfire — Burning',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 1),
    duration: Number(burning?.duration || 0)
  });
}
