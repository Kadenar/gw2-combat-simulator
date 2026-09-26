import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  skillFlipReady
} from '#gw2/platform/engine/skills/skill-flips.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { castCompleted, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { denySkillCast } from '#gw2/professions/shared/availability.js';
import { applyGuardianVirtueActivationTraits, refreshGuardianVirtues } from '#gw2/professions/guardian/core/live.js';
import { emitGuardianLiveBoon, triggerGuardianFuriousFocus } from '#gw2/professions/guardian/core/live-traits.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import {
  gainLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const ACTIVATE = 'guardian.willbender.activate';
const FLAMES = 'guardian.willbender.flames';
const PULSE = 'guardian.willbender.pulse';
const REPOSE = 'guardian.willbender.repose-expiry';
const readyVirtues = new WeakSet<RuntimeCast>();
const VIRTUES = [
  [ID.RUSHING_JUSTICE, 'justice'],
  [ID.FLOWING_RESOLVE, 'resolve'],
  [ID.CRASHING_COURAGE, 'courage']
] as const;
const FLAME_IDS = {
  justice: ID.WILLBENDER_FLAMES_ID_62618,
  resolve: ID.WILLBENDER_FLAMES,
  courage: ID.WILLBENDER_FLAMES_COURAGE
};
const flameOwner = (generation: number) => ({ id: 'willbender-flames', generation });

function causeFor(runtime: Runtime, cast: RuntimeCast): Gw2ResolverEvent {
  return {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}

/** Boons sample current attributes without inheriting the triggering packet's audience or hostile annotations. */
function boon(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  profileId: string | number,
  name: string,
  sourceId: number,
  party = false
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effect = requireEffect(profile, 'boon', name);
  if (!effect) return;
  emitGuardianLiveBoon(runtime, {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId: sourceId,
    skillName: profile.name,
    name: `${profile.name} — ${name}`,
    activationId: event.activationId,
    causalOrder: event.causalOrder ?? event.eventOrder,
    triggeredBy: event.skillName,
    kind: String(effect.boon),
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration'),
    audience: { recipients: party ? 'party' : 'self' }
  });
}

/** Activation and hit-cycle grants share one inclusive stack window and one modifier owner. */
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

/** Windows open at their authored boundary without predicting hits or resetting partial hit progress. */
function activate(runtime: Runtime, data: unknown): void {
  const { cast, virtue } = data as { cast: RuntimeCast; virtue: GuardianVirtue };
  const profile = requireBalanceProfileFromContext(
    runtime,
    virtue === 'justice' && hasTrait(runtime, TRAIT.TYRANTS_MOMENTUM) ? PROFILE.tyrantsMomentum : PROFILE.virtueWindows
  );
  const window = requireEffect(profile, 'buff', virtue);
  const state = willbenderState.from(runtime);
  const cause = causeFor(runtime, cast);
  state[`${virtue}Until`] = window ? gw2EffectExpiresAt(runtime.time, effectNumber(profile, window, 'duration')) : 0;
  if (window)
    runtime.emit({
      ...cause,
      kind: `willbender-${virtue}`,
      duration: effectNumber(profile, window, 'duration'),
      stacks: 1,
      audience: { recipients: 'self' }
    });
  tempo(runtime, cause);
  if (virtue === 'justice' && hasTrait(runtime, TRAIT.HOLY_RECKONING))
    boon(runtime, cause, PROFILE.holyReckoning, 'fury', TRAIT.HOLY_RECKONING);
  if (virtue === 'resolve') {
    if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES))
      boon(runtime, cause, PROFILE.restorativeVirtues, 'vigor', TRAIT.RESTORATIVE_VIRTUES);
    if (hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL))
      boon(
        runtime,
        cause,
        PROFILE.phoenixProtocol,
        'alacrity',
        TRAIT.PHOENIX_PROTOCOL,
        hasTrait(runtime, TRAIT.BATTLE_PRESENCE)
      );
  }
}

/** Same-virtue fields overlap; a different virtue retires all pending work from the prior flame group. */
function flames(runtime: Runtime, data: unknown): void {
  const { cast, virtue } = data as { cast: RuntimeCast; virtue: GuardianVirtue };
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.flames);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (!strike) return;
  if (!strike.ticks?.length) throw new Error('Willbender Flames requires an explicit strike timeline.');
  const state = willbenderState.from(runtime);
  if (state.flameVirtue !== virtue) {
    runtime.cancelOwner(flameOwner(state.flameGeneration));
    state.flameGeneration++;
    state.flameVirtue = virtue;
  }

  for (const [index, tick] of strike.ticks.entries())
    runtime.schedule(
      PULSE,
      canonicalTime(runtime.time + Number(tick.atMs) / 1000),
      {
        ...causeFor(runtime, cast),
        type: 'damage',
        sourceId: FLAME_IDS[virtue],
        skillId: FLAME_IDS[virtue],
        skillName: 'Willbender Flames',
        name: 'Willbender Flames',
        activationId: `${cast.id}:flames`,
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        hitIndex: index + 1,
        totalHits: strike.ticks.length,
        willbenderFlames: true,
        offTarget: cast.command.offTarget
      },
      flameOwner(state.flameGeneration)
    );
}

/** Completed and reserved weapon recharges receive base work reductions, preserving ownership through the cast boundary. */
function reduceWeapons(runtime: Runtime, cause: Gw2ResolverEvent): void {
  const state = willbenderState.from(runtime);
  const names = new Set(gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1).filter(Boolean));
  const matches = (skill: Skill) => skill.type === 'Weapon' && (!names.size || names.has(String(skill.weapon)));
  const amount = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.restorativeVirtues),
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
    reduction += gain / runtime.cooldownController.rate(skill, runtime.time);
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

/** Accepted player strikes and Air sigil procs advance each currently open virtue; no scheduler prediction is consulted. */
function hit(runtime: Runtime, event: Gw2ResolverEvent, details: NativeResolvedDamageDetails): void {
  if (
    !((details.hitContext?.damage ?? 0) > 0) ||
    !(Number(event.coefficient) > 0) ||
    (event.actorType !== 'player' && event.sourceId !== 'sigil.air')
  )
    return;
  const state = willbenderState.from(runtime);
  for (const virtue of ['justice', 'resolve', 'courage'] as const) {
    const until = state[`${virtue}Until`];
    if (!(until > 0) || runtime.time > until) continue;
    const threshold =
      virtue === 'justice' && hasTrait(runtime, TRAIT.PERMEATING_WRATH)
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PERMEATING_WRATH), 'threshold')
        : balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.virtueWindows), 'threshold');
    state.virtueHitCounts[virtue]++;
    if (state.virtueHitCounts[virtue] < threshold) continue;
    state.virtueHitCounts[virtue] = 0;
    state.triggeredVirtueEffects++;
    tempo(runtime, event);
    if (hasTrait(runtime, TRAIT.HOLY_RECKONING))
      boon(runtime, event, PROFILE.holyReckoning, 'might', TRAIT.HOLY_RECKONING, true);
    if (hasTrait(runtime, TRAIT.RESTORATIVE_VIRTUES)) reduceWeapons(runtime, event);
    if (virtue === 'justice') {
      const profile = requireBalanceProfileFromContext(runtime, CORE_PROFILE.justice);
      const burn = requireEffect(profile, 'condition', 'Burning (active)');
      if (burn) {
        runtime.profession.core.justiceActiveBurns++;
        runtime.emitDerived(
          event,
          buildResolverCondition({
            at: runtime.time,
            priority: 5,
            source: 'guardian',
            sourceId: 'guardian.justice-passive',
            actorType: 'player',
            skillId: ID.WILLBENDER_JUSTICE,
            skillName: 'Justice',
            name: 'Justice — Active Burning',
            icon: runtime.helpers.skillsById.get(ID.RUSHING_JUSTICE)?.icon,
            condition: String(burn.condition),
            stacks: effectNumber(profile, burn, 'stacks'),
            duration: effectNumber(profile, burn, 'duration'),
            triggeredBy: event.skillName
          })
        );
      }
    }

    if (virtue === 'courage')
      for (const name of ['aegis', 'stability'])
        boon(runtime, event, PROFILE.courageTrigger, name, ID.CRASHING_COURAGE);
    if (virtue === 'resolve' && hasTrait(runtime, TRAIT.PHOENIX_PROTOCOL))
      boon(
        runtime,
        event,
        PROFILE.phoenixProtocol,
        'alacrity (triggered)',
        TRAIT.PHOENIX_PROTOCOL,
        hasTrait(runtime, TRAIT.BATTLE_PRESENCE)
      );
  }

  if (event.willbenderFlames && hasTrait(runtime, TRAIT.SEARING_PACT)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.searingPact);
    const burn = requireEffect(profile, 'condition', 'Burning');
    if (burn)
      runtime.emitDerived(
        event,
        buildResolverCondition({
          at: runtime.time,
          source: 'guardian',
          sourceId: TRAIT.SEARING_PACT,
          actorType: 'player',
          skillId: TRAIT.SEARING_PACT,
          skillName: 'Searing Pact',
          name: 'Searing Pact — Burning',
          condition: String(burn.condition),
          stacks: effectNumber(profile, burn, 'stacks'),
          duration: effectNumber(profile, burn, 'duration'),
          triggeredBy: 'Willbender Flames'
        })
      );
  }
}

/** Virtue windows, flame lifetimes, and earned recharge reductions live beside the shared cast and damage owners. */
export const willbenderLiveMechanics: Partial<RuntimeProfession<GuardianRuntimeState>> = {
  availability(runtime, skill) {
    return skill.id === ID.REPOSE && !skillFlipReady(runtime.profession.core.availableFlips[ID.REPOSE], runtime.time)
      ? denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.')
      : { ready: true };
  },
  modifyEffects(_runtime, cast, effects) {
    if (cast.skill.id !== ID.RUSHING_JUSTICE && cast.skill.id !== ID.CRASHING_COURAGE) return effects;
    return effects.map((effect) => ({
      ...effect,
      ...(cast.skill.id === ID.RUSHING_JUSTICE ? { sourceId: ID.RUSHING_JUSTICE_IMPACT } : {}),
      ...(effect.type === 'strike' ? { weapon: 'Profession Mechanic' } : {})
    }));
  },
  onCastStart(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    if (cast.skill.type === 'Weapon')
      willbenderState.from(runtime).weaponCastRecharge[cast.id] = {
        skillId: cast.skill.id,
        rechargeStart: cast.rechargeStart,
        rechargeWork: cast.rechargeWork
      };
    const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (!virtue) return;
    refreshGuardianVirtues(runtime);
    if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
    const at = canonicalTime(
      virtue === 'justice'
        ? Math.min(cast.effectiveEnd, cast.start + 0.04)
        : virtue === 'courage'
          ? Math.min(cast.effectiveEnd, cast.start + 0.52)
          : cast.effectiveEnd
    );
    const flameAt = canonicalTime(
      virtue === 'resolve' ? cast.start : virtue === 'justice' ? Math.max(at, cast.effectiveEnd - 0.04) : at
    );
    runtime.schedule(ACTIVATE, at, { cast, virtue });
    runtime.schedule(FLAMES, flameAt, { cast, virtue }, undefined, -10);
  },
  onCastComplete(runtime, cast) {
    const state = willbenderState.from(runtime);
    const pending = state.pendingWeaponCooldownReduction[cast.id] ?? 0;
    delete state.pendingWeaponCooldownReduction[cast.id];
    delete state.weaponCastRecharge[cast.id];
    if (pending > 0) runtime.cooldownController.reduceSkillRecharge(cast.skill, pending, runtime.time);
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (virtue) {
      refreshGuardianVirtues(runtime);
      if (readyVirtues.has(cast)) {
        applyGuardianVirtueActivationTraits(runtime, cast, virtue);
        if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
      }
    }

    if (cast.skill.id === ID.FLASH_COMBO && castCompleted(cast)) {
      const window = armSkillFlip(
        runtime.profession.core.availableFlips,
        ID.REPOSE,
        runtime.time,
        canonicalTime(runtime.time + 6)
      );
      runtime.schedule(REPOSE, window.expiresAt!, window.identity, undefined, -220);
    }

    if (cast.skill.id === ID.REPOSE) consumeSkillFlip(runtime.profession.core.availableFlips, ID.REPOSE);
  },
  tasks: {
    [ACTIVATE]: activate,
    [FLAMES]: flames,
    [PULSE](runtime, data) {
      const event = data as Gw2ResolverEvent;
      runtime.emit(buildResolverStrike({ ...event, at: runtime.time, coefficient: Number(event.coefficient) }));
    },
    [REPOSE](runtime, identity) {
      expireSkillFlip(runtime.profession.core.availableFlips, ID.REPOSE, runtime.time, identity as string | number);
    }
  },
  reactions: {
    'damage.resolved': (runtime, event, details) => hit(runtime, event, details as NativeResolvedDamageDetails)
  }
};
