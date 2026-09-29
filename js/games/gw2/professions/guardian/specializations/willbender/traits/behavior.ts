import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { battlePresenceSharesBoons, recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { willbenderBoon as boon } from '#gw2/professions/guardian/specializations/willbender/mechanics/boons.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianRuntimeState, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;

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
  runtime.emit({
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
  });
  recordGuardianTraitProc(
    runtime,
    TRAIT.LETHAL_TEMPO,
    'Lethal Tempo',
    runtime.time,
    event.skillName,
    `${stacks}/${parameters.maximumStacks} stacks`
  );
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
  for (const id of new Set([...runtime.cooldowns.keys(), ...runtime.ammo.keys()])) {
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

  if (reduction > 0)
    recordGuardianTraitProc(
      runtime,
      TRAIT.RESTORATIVE_VIRTUES,
      'Restorative Virtues',
      runtime.time,
      cause.skillName,
      `${Number(reduction.toFixed(3))}s weapon recharge`
    );
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
  if (virtue === 'resolve' && hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL))
    boon(
      runtime,
      event,
      TRAIT.PHOENIX_PROTOCOL,
      'alacrity (triggered)',
      TRAIT.PHOENIX_PROTOCOL,
      battlePresenceSharesBoons(runtime)
    );
}

/** Activation rewards run after the mechanic installs the virtue window and before any later hit. */
export function applyWillbenderActivationTraits(
  runtime: Runtime,
  cause: Gw2ResolverEvent,
  virtue: GuardianVirtue
): void {
  tempo(runtime, cause);
  if (virtue === 'justice' && hasTrait(runtime, TRAIT.HOLY_RECKONING))
    boon(runtime, cause, TRAIT.HOLY_RECKONING, 'fury', TRAIT.HOLY_RECKONING);
  if (virtue === 'resolve') {
    if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES))
      boon(runtime, cause, TRAIT.RESTORATIVE_VIRTUES, 'vigor', TRAIT.RESTORATIVE_VIRTUES);
    if (hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL))
      boon(
        runtime,
        cause,
        TRAIT.PHOENIX_PROTOCOL,
        'alacrity',
        TRAIT.PHOENIX_PROTOCOL,
        battlePresenceSharesBoons(runtime)
      );
  }
}

/** Completed hit cycles grant Tempo, Might, and recharge reduction before the virtue's own effects. */
export function applyWillbenderTriggerTraits(runtime: Runtime, event: Gw2ResolverEvent): void {
  tempo(runtime, event);
  if (hasTrait(runtime, TRAIT.HOLY_RECKONING))
    boon(runtime, event, TRAIT.HOLY_RECKONING, 'might', TRAIT.HOLY_RECKONING, true);
  if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES)) reduceWeapons(runtime, event);
}
