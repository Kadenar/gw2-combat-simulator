import { resolverSourceSkill, buildResolverStrike, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
/**
 * Resolver-side Catalyst reactions.
 *
 * The scheduler emits the canonical event stream; these handlers read it after
 * resolution to grant Empowering Auras and Elemental Empowerment stacks, run the
 * combo-finisher traits (Elemental Epitome, Elemental Synergy), pay out Vicious
 * Empowerment, and queue the Shattering Ice packet.
 */
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';
import {
  activeElementalistBuffs,
  queueElementalistAura,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import {
  catalystState,
  grantCatalystElementalEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';

import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import {
  empoweringAurasParameters,
  elementalEpitomeEmpowerment,
  elementalEpitomeAura,
  elementalSynergyBoon
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/aura-parameters.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';

/**
 * Convert resolved aura applications into Catalyst aura-stack traits and their
 * profile-defined capped durations.
 *
 * Empowering Auras refreshes every live stack and adds one more below the cap;
 * Elemental Epitome turns the same aura into an Elemental Empowerment stack, but
 * only once combat has started.
 */
export function applyCatalystResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  // Scheduled auras already carry their trait grants; only newly resolved auras
  // need new grants here. Both paths still refresh Empowering Auras' duration.
  const needsGrants = event.elementalistResolverGeneratedAura === true || event.type === 'aura';
  if (hasTrait(context, 'Empowering Auras')) {
    const { maximumStacks, duration } = empoweringAurasParameters(context);
    const current = activeElementalistBuffs(context, 'Empowering Auras', event.at);
    refreshElementalistBuffs(context, 'Empowering Auras', event.at, () => event.at + duration);
    const activeStacks = current.reduce((total, application) => total + Number(application.stacks || 1), 0);
    if (needsGrants && activeStacks < maximumStacks) {
      queueElementalistBuff(context, event, 'Empowering Auras', 1, duration, resolverSourceSkill(event));
    }

    recordElementalistTraitProc(context, event, 'Empowering Auras');
  }

  if (
    !needsGrants ||
    !hasTrait(context, 'Elemental Epitome') ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }

  const empowerment = elementalEpitomeEmpowerment(context);
  if (!empowerment) return;
  queueElementalistBuff(
    context,
    event,
    'Elemental Empowerment',
    empowerment.stacks,
    empowerment.duration,
    resolverSourceSkill(event)
  );
}

/**
 * Resolve combo traits only after field selection is known, enforcing the
 * per-attunement Epitome cooldown before granting aura and empowerment effects.
 *
 * Elemental Synergy runs on its own per-attunement cooldown and pays out by
 * element: might in Fire, stability in Earth, endurance in Air.
 */
export function applyCatalystComboTraits(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  const state = catalystState.from(context);
  const attunement = core.primaryAttunement;
  if (
    hasTrait(context, 'Elemental Epitome') &&
    tryConsumeProcCooldown(
      state.elementalEpitomeReadyAt,
      attunement,
      event.at,
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalEpitome), 'internalCooldown')
    )
  ) {
    const aura = elementalEpitomeAura(context, attunement);
    if (aura) {
      queueElementalistAura(context, event, aura.aura, aura.duration, 'Elemental Epitome');
      recordElementalistTraitProc(context, event, 'Elemental Epitome');
    }
  }

  if (
    hasTrait(context, 'Elemental Synergy') &&
    tryConsumeProcCooldown(
      state.elementalSynergyReadyAt,
      attunement,
      event.at,
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalSynergy), 'internalCooldown')
    )
  ) {
    if (attunement === 'Fire' || attunement === 'Earth') {
      const boon = elementalSynergyBoon(context, attunement);
      if (boon) queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, 'Elemental Synergy');
    } else if (attunement === 'Air') {
      const elementalSynergyProfile = requireBalanceProfileFromContext(context, PROFILE.elementalSynergy);

      Object.assign(
        core,
        grantEndurance(
          core,
          balanceProfileNumber(elementalSynergyProfile, 'resourceGain'),
          event.at,
          elementalistEndurance.maximum(context)
        )
      );
    }

    recordElementalistTraitProc(context, event, 'Elemental Synergy');
  }
}

// Vicious Empowerment's payouts all share one source name.
function queueCatalystBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number
): void {
  queueElementalistBuff(context, event, kind, stacks, duration, 'Vicious Empowerment');
}

/**
 * Trigger Vicious Empowerment from qualifying control or immobilize events while
 * enforcing its shared internal cooldown.
 *
 * Pays Elemental Empowerment stacks plus might, and ignores anything landing
 * before combat start.
 */
export function applyViciousEmpowerment(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const immobilize = ['Immobilize', 'Immobilized'].includes(String(event.condition || ''));
  if (
    !hasTrait(context, 'Vicious Empowerment') ||
    event.actorType !== 'player' ||
    (event.type !== 'control' && !immobilize) ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }

  const state = catalystState.from(context);
  if (!isInternalCooldownReady(event.at, state.viciousEmpowermentReadyAt)) return;
  const viciousEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.viciousEmpowerment);
  state.viciousEmpowermentReadyAt = event.at + balanceProfileNumber(viciousEmpowermentProfile, 'internalCooldown');
  const empowerment = requireEffect(viciousEmpowermentProfile, 'buff', 'Empowerment');
  const might = requireEffect(viciousEmpowermentProfile, 'boon', 'Might');
  if (empowerment) {
    queueCatalystBuff(
      context,
      event,
      'elemental empowerment',
      Number(empowerment.stacks),
      Number(empowerment.duration)
    );
  }

  if (might) {
    queueCatalystBuff(context, event, String(might.boon), Number(might.stacks), Number(might.duration));
  }

  context.recordProc('trait', 'Vicious Empowerment', event.at, event.skillName);
}

/**
 * Elemental Empowerment starts with three permanent stacks. Timed grants fill
 * the remaining seven slots and replace the oldest timed stack at the cap.
 *
 * The same handler captures the Shattering Ice buff window, rearming its first
 * proc whenever the buff is reapplied.
 */
export function applyCatalystEmpowerment(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  if (kind === 'shattering ice' && event.resolvedAudience?.includesSelf) {
    const state = catalystState.from(context);
    state.shatteringIceUntil = gw2EffectExpiresAt(event.at, Math.max(0, Number(event.duration || 0)));
    // Refreshing the buff rearms its first strike; subsequent strikes use the canonical strict ICD.
    state.shatteringIceReadyAt = 0;
    return;
  }

  if (kind !== 'elemental empowerment' || !event.resolvedAudience?.includesSelf) {
    return;
  }

  const state = catalystState.from(context);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment);
  grantCatalystElementalEmpowerment(
    state,
    event.at,
    Number(event.duration || 0),
    Number(event.stacks || 1),
    balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks')
  );
}

/**
 * Spend active Shattering Ice state on player-owned attacks, including fields
 * and effects, while preventing summons and the derived packet from retriggering it.
 *
 * A qualifying hit consumes the profile internal cooldown and queues the strike
 * and chill packets that Shattering Ice owns.
 */
export function applyCatalystResolvedDamage(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const state = catalystState.from(context);
  if (
    (event.actorType !== 'player' && event.actorType !== 'effect') ||
    event.skillName === 'Shattering Ice Proc' ||
    !(Number(event.coefficient) > 0) ||
    state.shatteringIceUntil <= event.at ||
    !isInternalCooldownReady(event.at, state.shatteringIceReadyAt)
  ) {
    return;
  }

  const shatteringIceProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringIce);
  state.shatteringIceReadyAt = event.at + balanceProfileNumber(shatteringIceProfile, 'internalCooldown');
  const strike = requireEffect(shatteringIceProfile, 'strike', 'Shattering Ice - Triggered Packet');
  const chilled = requireEffect(shatteringIceProfile, 'condition', 'Chilled');
  if (strike) {
    context.queue.enqueue(
      buildResolverStrike({
        at: event.at,
        source: 'Shattering Ice Proc',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Shattering Ice Proc',
        coefficient: Number(strike.coefficient),
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    );
  }

  if (chilled) {
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'Shattering Ice Proc',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Shattering Ice Proc',
        condition: String(chilled.condition),
        stacks: Number(chilled.stacks),
        duration: Number(chilled.duration),
        triggeredBy: event.skillName
      })
    );
  }
}
