/**
 * Resolver-side Catalyst reactions.
 *
 * The scheduler emits the canonical event stream; these handlers read it after
 * resolution to grant Empowering Auras and Elemental Empowerment stacks, run the
 * combo-finisher traits (Elemental Epitome, Elemental Synergy), pay out Vicious
 * Empowerment, and queue the Shattering Ice packet.
 */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import type { ElementalistResolverContext } from '#gw2/content/professions/elementalist/types.js';
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistAura,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/content/professions/elementalist/core/mechanics/reactions.js';
import {
  catalystState,
  grantCatalystElementalEmpowerment
} from '#gw2/content/professions/elementalist/specializations/catalyst/state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue
} from '#gw2/content/professions/elementalist/core/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/catalyst/profiles.js';

/**
 * Convert resolved aura applications into Catalyst aura-stack traits and their
 * profile-defined capped durations.
 *
 * Empowering Auras refreshes every live stack and adds one more below the cap;
 * Elemental Epitome turns the same aura into an Elemental Empowerment stack, but
 * only once combat has started.
 */
export function applyCatalystResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, 'Empowering Auras')) {
    const maximumStacks = elementalistBalanceValue(context, PROFILE.empoweringAuras, 'maximumStacks', 5);
    const duration = elementalistBalanceValue(context, PROFILE.empoweringAuras, 'durationMultiplier', 10);
    const current = activeElementalistBuffs(context, 'Empowering Auras', event.at);
    refreshElementalistBuffs(context, 'Empowering Auras', event.at, () => event.at + duration);
    const activeStacks = current.reduce((total, application) => total + Number(application.stacks || 1), 0);
    if (activeStacks < maximumStacks) {
      queueElementalistBuff(context, event, 'Empowering Auras', 1, duration, elementalistSourceSkill(event));
    }

    recordElementalistTraitProc(context, event, 'Empowering Auras');
  }

  if (
    !hasTrait(context, 'Elemental Epitome') ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }

  const empowerment = elementalistBalanceEffect(context, PROFILE.elementalEpitome, 'buff', 'Empowerment');
  queueElementalistBuff(
    context,
    event,
    'Elemental Empowerment',
    Number(empowerment?.stacks ?? 1),
    Number(empowerment?.duration ?? 15),
    elementalistSourceSkill(event)
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
  const epitomeReadyAt = Number(state.elementalEpitomeReadyAt[attunement] || 0);
  if (hasTrait(context, 'Elemental Epitome') && isInternalCooldownReady(event.at, epitomeReadyAt)) {
    state.elementalEpitomeReadyAt[attunement] =
      event.at + elementalistBalanceValue(context, PROFILE.elementalEpitome, 'internalCooldown', 10);
    const aura =
      attunement === 'Fire'
        ? (['Fire Aura', 4] as const)
        : attunement === 'Water'
          ? (['Frost Aura', 4] as const)
          : attunement === 'Air'
            ? (['Shocking Aura', 3] as const)
            : (['Magnetic Aura', 3] as const);
    queueElementalistAura(
      context,
      event,
      aura[0],
      Number(elementalistBalanceEffect(context, PROFILE.elementalEpitome, 'buff', attunement)?.duration ?? aura[1]),
      'Elemental Epitome'
    );
    recordElementalistTraitProc(context, event, 'Elemental Epitome');
  }

  const synergyReadyAt = Number(state.elementalSynergyReadyAt[attunement] || 0);
  if (hasTrait(context, 'Elemental Synergy') && isInternalCooldownReady(event.at, synergyReadyAt)) {
    state.elementalSynergyReadyAt[attunement] =
      event.at + elementalistBalanceValue(context, PROFILE.elementalSynergy, 'internalCooldown', 10);
    if (attunement === 'Fire') {
      const might = elementalistBalanceEffect(context, PROFILE.elementalSynergy, 'boon', 'Fire');
      queueElementalistBuff(
        context,
        event,
        String(might?.boon || 'Might'),
        Number(might?.stacks ?? 6),
        Number(might?.duration ?? 10),
        'Elemental Synergy'
      );
    } else if (attunement === 'Earth') {
      const stability = elementalistBalanceEffect(context, PROFILE.elementalSynergy, 'boon', 'Earth');
      queueElementalistBuff(
        context,
        event,
        String(stability?.boon || 'Stability'),
        Number(stability?.stacks ?? 2),
        Number(stability?.duration ?? 6),
        'Elemental Synergy'
      );
    } else if (attunement === 'Air') {
      Object.assign(
        core,
        grantEndurance(
          core,
          elementalistBalanceValue(context, PROFILE.elementalSynergy, 'resourceGain', 50),
          event.at,
          elementalistBalanceValue(context, CORE_PROFILE.resources, 'maximumStacks', 100)
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
  state.viciousEmpowermentReadyAt =
    event.at + elementalistBalanceValue(context, PROFILE.viciousEmpowerment, 'internalCooldown', 0.25);
  const empowerment = elementalistBalanceEffect(context, PROFILE.viciousEmpowerment, 'buff', 'Empowerment');
  const might = elementalistBalanceEffect(context, PROFILE.viciousEmpowerment, 'boon', 'Might');
  queueCatalystBuff(
    context,
    event,
    'elemental empowerment',
    Number(empowerment?.stacks ?? 2),
    Number(empowerment?.duration ?? 15)
  );
  queueCatalystBuff(
    context,
    event,
    String(might?.boon || 'might'),
    Number(might?.stacks ?? 2),
    Number(might?.duration ?? 10)
  );
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
  if (kind === 'shattering ice' && event.affectsSelf !== false) {
    const state = catalystState.from(context);
    state.shatteringIceUntil = event.at + Math.max(0, Number(event.duration || 0));
    // Refreshing the buff rearms its first strike; subsequent strikes use the canonical strict ICD.
    state.shatteringIceReadyAt = 0;
    return;
  }

  if (kind !== 'elemental empowerment' || event.affectsSelf === false) {
    return;
  }

  const state = catalystState.from(context);
  grantCatalystElementalEmpowerment(
    state,
    event.at,
    Number(event.duration || 0),
    Number(event.stacks || 1),
    EPSILON,
    elementalistBalanceValue(context, PROFILE.elementalEmpowerment, 'maximumStacks', 10)
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
    state.shatteringIceUntil <= event.at + EPSILON ||
    !isInternalCooldownReady(event.at, state.shatteringIceReadyAt)
  ) {
    return;
  }

  state.shatteringIceReadyAt =
    event.at + elementalistBalanceValue(context, PROFILE.shatteringIce, 'internalCooldown', 1);
  const strike = elementalistBalanceEffect(context, PROFILE.shatteringIce, 'strike');
  const chilled = elementalistBalanceEffect(context, PROFILE.shatteringIce, 'condition');
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    source: 'Shattering Ice Proc',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Shattering Ice Proc',
    coefficient: Number(strike?.coefficient ?? 0.6),
    skillWeapon: 'Unequipped',
    triggeredBy: event.skillName
  });

  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Shattering Ice Proc',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Shattering Ice Proc',
    condition: String(chilled?.condition || 'Chilled'),
    stacks: Number(chilled?.stacks ?? 1),
    duration: Number(chilled?.duration ?? 1),
    triggeredBy: event.skillName
  });
}
