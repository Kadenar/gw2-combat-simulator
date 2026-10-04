import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { battlePresenceSharesBoons } from '#gw2/professions/guardian/core/traits/behavior.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Decodes the live stack cap and selected lifetime before granting a window. */
export function lethalTempoParameters(context: unknown) {
  const tyrantsMomentum = hasTrait(context, TRAIT.TYRANTS_MOMENTUM);
  const profileId = tyrantsMomentum ? TRAIT.TYRANTS_MOMENTUM : TRAIT.LETHAL_TEMPO;
  const profile = requireBalanceProfileFromContext(context, profileId);
  const window = requireEffect(profile, 'buff', 'lethal-tempo');
  if (!window) return undefined;
  const lethalTempoProfile = requireBalanceProfileFromContext(context, TRAIT.LETHAL_TEMPO);
  return {
    maximumStacks: balanceProfileNumber(lethalTempoProfile, 'maximumStacks'),
    duration: effectNumber(profile, window, 'duration')
  };
}

export function gainLethalTempo(
  state: GuardianWillbenderState,
  at: number,
  { maximumStacks, duration }: NonNullable<ReturnType<typeof lethalTempoParameters>>
): number {
  // Grants through the expiry tick refresh every stack; only a later grant starts a new stack window.
  at = canonicalTime(at);
  if (state.lethalTempoUntil <= 0 || at > state.lethalTempoUntil) state.lethalTempoStacks = 0;
  state.lethalTempoStacks = Math.min(maximumStacks, state.lethalTempoStacks + 1);
  state.lethalTempoUntil = gw2EffectExpiresAt(at, duration);
  return state.lethalTempoStacks;
}

export function activeLethalTempo(state: GuardianWillbenderState, at: number): number {
  // Damage on the final effect tick still receives the bonus, matching the refresh boundary.
  return state.lethalTempoUntil > 0 && canonicalTime(at) <= state.lethalTempoUntil ? state.lethalTempoStacks : 0;
}

export function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

/** Both virtue boundaries grant and report the same inclusive stack window. */
function tempo(runtime: Runtime, event: Gw2ResolverEvent): void {
  const parameters = lethalTempoParameters(runtime);
  if (!parameters) return;
  const stacks = gainLethalTempo(willbenderState.from(runtime), runtime.time, parameters);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'guardian',
      sourceId: TRAIT.LETHAL_TEMPO,
      actorType: 'player',
      skillId: TRAIT.LETHAL_TEMPO,
      skillName: 'Lethal Tempo',
      name: 'Lethal Tempo',
      kind: 'lethal-tempo',
      stacks,
      duration: parameters.duration,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      triggeredBy: event.skillName
    }
  });
  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Lethal Tempo',
        at: runtime.time,
        sourceSkill: event.skillName,
        detail: `${stacks}/${parameters.maximumStacks} stacks`,
        icon: guardianTraitIcon(TRAIT.LETHAL_TEMPO)
      }
    });
  }
}

/** Earned base work applies to equipped weapon cooldowns and reservations before speed conversion. */
function reduceWeapons(runtime: Runtime, cause: Gw2ResolverEvent): void {
  const state = willbenderState.from(runtime);
  const names = new Set(gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1).filter(Boolean));
  const matches = (skill: Skill) => skill.type === 'Weapon' && (!names.size || names.has(String(skill.weapon)));
  const amount = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.RESTORATIVE_VIRTUES),
    'rechargeReduction'
  );
  let reduction = 0;
  for (const id of new Set([
    ...runtime.cooldownController.cooldownSkillIds(),
    ...runtime.cooldownController.ammoSkillIds()
  ])) {
    const skill = runtime.helpers.skillsById.get(id)!;
    if (matches(skill)) reduction += runtime.cooldownController.reduceSkillRecharge(skill, amount, runtime.time);
  }

  for (const [id, cast] of Object.entries(state.weaponCastRecharge)) {
    const skill = runtime.helpers.skillsById.get(cast.skillId)!;
    if (!matches(skill)) continue;
    const pending = state.pendingWeaponCooldownReduction[id] ?? 0;
    const available = runtime.cooldownController.remaining(
      skill,
      { startedAt: cast.rechargeStart, work: cast.rechargeWork },
      runtime.time
    );
    const gain = Math.min(amount, Math.max(0, available - pending));
    state.pendingWeaponCooldownReduction[id] = pending + gain;
    reduction += gain / runtime.cooldownController.rate(skill);
  }

  if (reduction > 0) {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Restorative Virtues',
        at: runtime.time,
        sourceSkill: cause.skillName,
        detail: `${Number(reduction.toFixed(3))}s weapon recharge`,
        icon: guardianTraitIcon(TRAIT.RESTORATIVE_VIRTUES)
      }
    });
  }
}

/** The mechanic opens the chosen profile window at its authored activation boundary. */
export function willbenderVirtueWindowProfile(runtime: Runtime, virtue: GuardianVirtue) {
  return requireBalanceProfileFromContext(
    runtime,
    virtue === 'justice' && hasTrait(runtime, TRAIT.TYRANTS_MOMENTUM) ? TRAIT.TYRANTS_MOMENTUM : PROFILE.virtueWindows
  );
}

/** Triggered Resolve Alacrity follows the cycle's ordinary virtue effects. */
export function triggerPhoenixProtocol(runtime: Runtime, event: Gw2ResolverEvent, virtue: GuardianVirtue): void {
  if (virtue === 'resolve' && hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.PHOENIX_PROTOCOL);
    const effect = requireEffect(profile, 'boon', 'alacrity (triggered)');
    if (effect) {
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: [effect],
        attribution: {
          source: 'guardian',
          sourceId: TRAIT.PHOENIX_PROTOCOL,
          actorType: 'player',
          skillId: TRAIT.PHOENIX_PROTOCOL,
          skillName: profile.name,
          activationId: event.activationId,
          triggeredBy: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          duration: packet.duration,
          name: profile.name + ' — ' + 'alacrity (triggered)',
          causalOrder: event.causalOrder ?? event.eventOrder,
          audience: { recipients: battlePresenceSharesBoons(runtime) ? 'party' : 'self' }
        })
      });
    }
  }
}

/** Activation rewards run after the mechanic installs the virtue window and before any later hit. */
export function applyWillbenderActivationTraits(
  runtime: Runtime,
  cause: Gw2ResolverEvent,
  virtue: GuardianVirtue
): void {
  tempo(runtime, cause);
  if (virtue === 'justice' && hasTrait(runtime, TRAIT.HOLY_RECKONING)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HOLY_RECKONING);
    const effect = requireEffect(profile, 'boon', 'fury');
    if (effect) {
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: [effect],
        attribution: {
          source: 'guardian',
          sourceId: TRAIT.HOLY_RECKONING,
          actorType: 'player',
          skillId: TRAIT.HOLY_RECKONING,
          skillName: profile.name,
          activationId: cause.activationId,
          triggeredBy: cause.skillName
        },
        transform: (packet) => ({
          ...packet,
          duration: packet.duration,
          name: profile.name + ' — ' + 'fury',
          causalOrder: cause.causalOrder ?? cause.eventOrder,
          audience: { recipients: 'self' }
        })
      });
    }
  }

  if (virtue === 'resolve') {
    if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES)) {
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.RESTORATIVE_VIRTUES);
      const effect = requireEffect(profile, 'boon', 'vigor');
      if (effect) {
        runtime.effects.emit({
          kind: 'profile',
          profile: profile,
          effects: [effect],
          attribution: {
            source: 'guardian',
            sourceId: TRAIT.RESTORATIVE_VIRTUES,
            actorType: 'player',
            skillId: TRAIT.RESTORATIVE_VIRTUES,
            skillName: profile.name,
            activationId: cause.activationId,
            triggeredBy: cause.skillName
          },
          transform: (packet) => ({
            ...packet,
            duration: packet.duration,
            name: profile.name + ' — ' + 'vigor',
            causalOrder: cause.causalOrder ?? cause.eventOrder,
            audience: { recipients: 'self' }
          })
        });
      }
    }

    if (hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL)) {
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.PHOENIX_PROTOCOL);
      const effect = requireEffect(profile, 'boon', 'alacrity');
      if (effect) {
        runtime.effects.emit({
          kind: 'profile',
          profile: profile,
          effects: [effect],
          attribution: {
            source: 'guardian',
            sourceId: TRAIT.PHOENIX_PROTOCOL,
            actorType: 'player',
            skillId: TRAIT.PHOENIX_PROTOCOL,
            skillName: profile.name,
            activationId: cause.activationId,
            triggeredBy: cause.skillName
          },
          transform: (packet) => ({
            ...packet,
            duration: packet.duration,
            name: profile.name + ' — ' + 'alacrity',
            causalOrder: cause.causalOrder ?? cause.eventOrder,
            audience: { recipients: battlePresenceSharesBoons(runtime) ? 'party' : 'self' }
          })
        });
      }
    }
  }
}

/** Completed hit cycles grant Tempo, Might, and recharge reduction before the virtue's own effects. */
export function applyWillbenderTriggerTraits(runtime: Runtime, event: Gw2ResolverEvent): void {
  tempo(runtime, event);
  if (hasTrait(runtime, TRAIT.HOLY_RECKONING)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HOLY_RECKONING);
    const effect = requireEffect(profile, 'boon', 'might');
    if (effect) {
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: [effect],
        attribution: {
          source: 'guardian',
          sourceId: TRAIT.HOLY_RECKONING,
          actorType: 'player',
          skillId: TRAIT.HOLY_RECKONING,
          skillName: profile.name,
          activationId: event.activationId,
          triggeredBy: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          duration: packet.duration,
          name: profile.name + ' — ' + 'might',
          causalOrder: event.causalOrder ?? event.eventOrder,
          audience: { recipients: 'party' }
        })
      });
    }
  }

  if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES)) reduceWeapons(runtime, event);
}
