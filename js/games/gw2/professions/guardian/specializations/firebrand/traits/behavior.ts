import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianBoonDuration, recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  alliedAshes,
  attribution,
  boon,
  FIREBRAND_ASHES_EXPIRE
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type {
  GuardianConfig,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntimeState,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';

type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;

/** Tome session changes reset only the counter, never refunds earned by accepted casts. */
export function resetSwiftScholar(runtime: Runtime, virtue?: string): void {
  const state = firebrandState.from(runtime);
  if (virtue === undefined || state.swiftScholarTome !== virtue) {
    state.swiftScholarTome = virtue ?? '';
    state.swiftScholarCount = 0;
  }
}

/** Ready tome activations grant Swift Scholar after the shared virtue rewards. */
export function activateSwiftScholar(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (boon(runtime, TRAIT.SWIFT_SCHOLAR, 'quickness', guardianCastCause(runtime, cast)))
    recordGuardianTraitProc(
      runtime,
      TRAIT.SWIFT_SCHOLAR,
      'Swift Scholar',
      runtime.time,
      cast.skill.name,
      'Tome activation'
    );
}

/** Stoic Demeanor retains Courage's passive on the mechanic's unchanged cadence. */
export function stoicDemeanorRetainsCourage(runtime: Runtime): boolean {
  return hasTrait(runtime, TRAIT.STOIC_DEMEANOR);
}

/** Derived boons retain authored order and actual recipients. */
function traitBoons(
  runtime: Runtime,
  trait: number,
  profileId: string | number,
  event: Gw2ResolverEvent,
  party = false
): boolean {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effects = (profile.effects ?? []).filter((effect) => effect.type === 'boon');
  emitEffects(runtime, {
    owner: profile,
    effects,
    baseEvent: { ...attribution(event), sourceId: trait, skillId: trait, skillName: profile.name },
    transform: (packet) => ({
      ...packet,
      duration: guardianBoonDuration(runtime, packet),
      causalOrder: event.causalOrder ?? event.eventOrder,
      audience: { recipients: party ? 'party' : 'self' }
    })
  });
  if (effects.length) recordGuardianTraitProc(runtime, trait, profile.name, runtime.time, event.skillName, 'Boons');
  return effects.length > 0;
}

/** Accepted axe hits apply Bleeding after consuming any Ashes charge. */
export function reactToUnrelentingCriticism(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  if (event.actorType !== 'player' || !((details.hitContext?.damage ?? 0) > 0)) return;
  if (
    !hasTrait(runtime, TRAIT.UNRELENTING_CRITICISM) ||
    event.skillId == null ||
    runtime.helpers.skillsById.get(event.skillId)?.weapon !== 'Axe'
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UNRELENTING_CRITICISM);
  const effect = requireEffect(profile, 'condition', 'Bleeding');
  if (effect)
    runtime.applyCondition(
      buildResolverCondition({
        ...attribution(event),
        at: runtime.time,
        sourceId: event.skillId,
        name: 'Unrelenting Criticism — Bleeding',
        triggeredBy: 'Unrelenting Criticism',
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      })
    );
}

/** Accepted player controls grant the surviving Stoic Demeanor boons. */
export function reactToFirebrandControl(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType === 'player' && hasTrait(runtime, TRAIT.STOIC_DEMEANOR))
    traitBoons(runtime, TRAIT.STOIC_DEMEANOR, TRAIT.STOIC_DEMEANOR, event);
}

/** Delivered boons claim the existing intervals only when their derived effects survive. */
export function reactToFirebrandBuff(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = firebrandState.from(runtime);
  const self = event.resolvedAudience?.includesSelf === true;
  const allies = event.resolvedAudience?.alliedPlayerCount ?? 0;
  if (!self && allies <= 0) return;
  if (
    (event.kind === 'aegis' || event.kind === 'stability') &&
    hasTrait(runtime, TRAIT.STALWART_SPEED) &&
    isInternalCooldownReady(runtime.time, runtime.procs.deadline('guardian.firebrand.stalwartSpeed'))
  ) {
    if (traitBoons(runtime, TRAIT.STALWART_SPEED, TRAIT.STALWART_SPEED, event, true))
      runtime.procs.readyAt['guardian.firebrand.stalwartSpeed'] = canonicalTime(
        runtime.time +
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.STALWART_SPEED), 'internalCooldown')
      );
  }

  if (event.kind !== 'quickness' || !hasTrait(runtime, TRAIT.QUICKFIRE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.QUICKFIRE);
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const ashes = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(ashes, 'condition', 'Burning');
  // Both the charge and its Burning packet must survive before Quickfire claims an interval.
  if (!buff || !burn || !runtime.procs.claim(TRAIT.QUICKFIRE, 'guardian.firebrand.quickfire', runtime.time)) return;
  const expiresAt = gw2EffectExpiresAt(runtime.time, effectNumber(profile, buff, 'duration'));
  if (allies > 0)
    alliedAshes(runtime, event, 1, expiresAt - runtime.time, {
      maximumAllies: 1,
      priority: 5,
      skillName: 'Quickfire',
      name: 'Quickfire'
    });
  else {
    state.ashes = grantCharges(1, expiresAt, state.ashes, runtime.time);
    state.ashesBurnDuration = effectNumber(ashes, burn, 'duration');
    runtime.schedule(FIREBRAND_ASHES_EXPIRE, expiresAt, undefined, undefined, 10);
  }

  recordGuardianTraitProc(runtime, TRAIT.QUICKFIRE, 'Quickfire', runtime.time, event.skillName, '+1 Ashes of the Just');
}

/** Quickfire retains the tome passive without changing the shared Justice hit tracker. */
export function reactToFirebrandJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasTrait(context, TRAIT.QUICKFIRE),
    skillId: ID.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice',
    // Tome passive Burning starts at one second; Amplified Wrath applies separately.
    passiveBurnDuration: 1
  });
}

// Final mantra rewards run before the mechanic retires its final charge.
export const weightyTermsRewards: NonNullable<Skill['sideEffects']> = [
  {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.WEIGHTY_TERMS),
    do: {
      type: 'resourceGrant',
      resource: 'tomePages',
      amount: { profile: TRAIT.WEIGHTY_TERMS, field: 'resourceGain' }
    }
  },
  {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.WEIGHTY_TERMS),
    do: {
      type: 'emitProfile',
      profileId: TRAIT.WEIGHTY_TERMS,
      attribution: { source: 'guardian', actorType: 'player', name: 'Weighty Terms — Slow' }
    }
  }
];

/** Traits choose capacity, initial default, and cadence; the resource controller owns page accounting. */
export function firebrandPageTuning(context: { readonly config: GuardianConfig }) {
  const archivistOfWhispers = hasTrait(context, TRAIT.ARCHIVIST_OF_WHISPERS);

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = archivistOfWhispers
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCHIVIST_OF_WHISPERS), 'maximumStacks')
    : defaultMaximum;
  const interval = hasTrait(context, TRAIT.LOREMASTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LOREMASTER), 'pulseInterval')
    : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  const initial = context.config.initialTomePages ?? traitMaximum;
  return {
    maximum: traitMaximum,
    initial: archivistOfWhispers && initial === defaultMaximum ? traitMaximum : initial,
    interval
  };
}
