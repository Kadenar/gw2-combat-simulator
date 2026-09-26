import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { emitGuardianBoon } from '#gw2/professions/guardian/core/traits/index.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { reactToAshesHit } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const ASHES = 'guardian.firebrand.ashes';
const EXPIRE = 'guardian.firebrand.ashes-expiry';

/** Derived trait effects inherit attribution and causality, never the triggering buff's recipients or duration. */
function attribution(event: Gw2ResolverEvent) {
  return {
    source: 'guardian',
    actorType: 'player' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    activationId: event.activationId,
    causalOrder: event.causalOrder ?? event.eventOrder,
    triggeredBy: event.skillName
  };
}

function traitBoons(
  runtime: Runtime,
  trait: number,
  profileId: string | number,
  event: Gw2ResolverEvent,
  party = false
): boolean {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effects = (profile.effects ?? []).filter((effect) => effect.type === 'boon');
  for (const effect of effects)
    emitGuardianBoon(runtime, {
      ...attribution(event),
      type: 'buff',
      at: runtime.time,
      sourceId: trait,
      skillId: trait,
      skillName: profile.name,
      kind: String(effect.boon),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: { recipients: party ? 'party' : 'self' }
    });
  if (effects.length) recordGuardianTraitProc(runtime, trait, profile.name, runtime.time, event.skillName, 'Boons');
  return effects.length > 0;
}

/** Finite allied opportunities enter ordinary hostile resolution, which rejects precombat and post-death outcomes. */
function alliedAshes(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  count: number,
  duration: number,
  quickfire: boolean
): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(profile, 'condition', 'Burning');
  if (!burn) return;
  const procs = gw2AlliedPlayerProcTimeline(runtime.config, {
    start: runtime.time,
    duration,
    maximumAllies: quickfire ? 1 : Infinity,
    maximumPerAlly: count,
    internalCooldown: balanceProfileNumber(profile, 'internalCooldown')
  });
  for (const proc of procs)
    runtime.emit(
      buildResolverCondition({
        ...attribution(event),
        at: proc.at,
        priority: quickfire ? 5 : 0,
        sourceId: 'guardian.ashes-of-the-just',
        skillId: ID.ASHES_OF_THE_JUST,
        skillName: quickfire ? 'Quickfire' : 'Epilogue: Ashes of the Just',
        activationId: `${event.activationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        name: `${quickfire ? 'Quickfire' : 'Ashes of the Just'} — Ally ${proc.allyIndex} Burning`,
        condition: String(burn.condition),
        stacks: effectNumber(profile, burn, 'stacks'),
        duration: effectNumber(profile, burn, 'duration'),
        metadata: { triggeredByAlly: proc.allyIndex }
      })
    );
}

/** Ashes is granted during a committed animation; acceptance cannot expose its charges to earlier hits. */
export function startFirebrandAshes(runtime: Runtime, cast: RuntimeCast): void {
  if (cast.skill.id !== ID.ASHES_OF_THE_JUST) return;
  runtime.schedule(ASHES, canonicalTime(cast.start + 0.56), {
    type: 'buff',
    at: cast.start,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  });
}

export const firebrandEffectTasks = {
  [ASHES](runtime: Runtime, data: unknown) {
    const event = data as Gw2ResolverEvent;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
    const might = requireEffect(profile, 'boon', 'might');
    if (might)
      emitGuardianBoon(runtime, {
        ...event,
        at: runtime.time,
        kind: 'might',
        stacks: effectNumber(profile, might, 'stacks'),
        duration: effectNumber(profile, might, 'duration'),
        audience: { recipients: 'party' }
      });
    const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
    const burn = requireEffect(profile, 'condition', 'Burning');
    if (!buff || !burn) return;
    const state = firebrandState.from(runtime);
    const duration = effectNumber(profile, buff, 'duration');
    state.ashes = grantCharges(
      balanceProfileNumber(profile, 'maximumStacks'),
      gw2EffectExpiresAt(runtime.time, duration)
    );
    state.ashesBurnDuration = effectNumber(profile, burn, 'duration');
    runtime.emit({
      ...event,
      at: runtime.time,
      name: 'Ashes of the Just',
      kind: 'ashes-of-the-just',
      stacks: state.ashes.charges,
      duration,
      audience: { recipients: 'party' }
    });
    runtime.schedule(EXPIRE, state.ashes.expiresAt, undefined, undefined, 10);
    alliedAshes(runtime, event, state.ashes.charges, state.ashes.expiresAt - runtime.time, false);
  },
  [EXPIRE](runtime: Runtime) {
    expireCharges(firebrandState.from(runtime).ashes, runtime.time);
  }
};

/** Player hit traits claim only accepted strikes; an off-target or pending axe packet cannot create Bleeding. */
export function reactToFirebrandDamage(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  if (event.actorType !== 'player' || !((details.hitContext?.damage ?? 0) > 0)) return;
  reactToAshesHit(runtime, event, details);
  if (
    !hasTrait(runtime, TRAIT.UNRELENTING_CRITICISM) ||
    event.skillId == null ||
    runtime.helpers.skillsById.get(event.skillId)?.weapon !== 'Axe'
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.unrelentingCriticism);
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

/** Actual disables and qualifying condition applications own Stoic Demeanor, including selected component removal. */
export function reactToFirebrandControl(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType === 'player' && hasTrait(runtime, TRAIT.STOIC_DEMEANOR))
    traitBoons(runtime, TRAIT.STOIC_DEMEANOR, PROFILE.stoicDemeanor, event);
}

/** Delivered boons own Stalwart Speed and Quickfire; eligibility precedes their one shared cooldown claim. */
export function reactToFirebrandBuff(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = firebrandState.from(runtime);
  const self = event.resolvedAudience?.includesSelf === true;
  const allies = Number(event.resolvedAudience?.alliedPlayerCount ?? 0);
  if (!self && allies <= 0) return;
  if (
    (event.kind === 'aegis' || event.kind === 'stability') &&
    hasTrait(runtime, TRAIT.STALWART_SPEED) &&
    isInternalCooldownReady(runtime.time, state.stalwartSpeedReadyAt)
  ) {
    if (traitBoons(runtime, TRAIT.STALWART_SPEED, PROFILE.stalwartSpeed, event, true))
      state.stalwartSpeedReadyAt = canonicalTime(
        runtime.time +
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.stalwartSpeed), 'internalCooldown')
      );
  }

  if (
    event.kind !== 'quickness' ||
    !hasTrait(runtime, TRAIT.QUICKFIRE) ||
    !isInternalCooldownReady(runtime.time, state.quickfireReadyAt)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.quickfire);
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const ashes = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(ashes, 'condition', 'Burning');
  if (!buff || !burn) return;
  state.quickfireReadyAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'internalCooldown'));
  const expiresAt = gw2EffectExpiresAt(runtime.time, effectNumber(profile, buff, 'duration'));
  if (allies > 0) alliedAshes(runtime, event, 1, expiresAt - runtime.time, true);
  else {
    state.ashes = grantCharges(1, expiresAt, state.ashes, runtime.time);
    state.ashesBurnDuration = effectNumber(ashes, burn, 'duration');
    runtime.schedule(EXPIRE, expiresAt, undefined, undefined, 10);
  }

  recordGuardianTraitProc(runtime, TRAIT.QUICKFIRE, 'Quickfire', runtime.time, event.skillName, '+1 Ashes of the Just');
}
