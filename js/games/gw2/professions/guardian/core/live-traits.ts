import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { remainingDurationStackSeconds, durationStackingBoonCapSeconds } from '#gw2/platform/combat/boons.js';
import { grantTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { isGuardianSymbolSkill, recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { reactToSymbolOfIgnition } from '#gw2/professions/guardian/core/traits/index.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const BOON = 'guardian.trait-boon';
const MIGHT = 'guardian.righteous-might';
const RESOLUTION_EXPIRY = 'guardian.resolution-expiry';
const AVENGER_EXPIRY = 'guardian.symbolic-avenger-expiry';
// These child effects have packet identities but no player-selectable catalog entry.
const symbols: Readonly<Record<SkillId, Skill>> = {
  [ID.LESSER_SYMBOL_OF_BLADES]: {
    id: ID.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_PROTECTION]: {
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    name: 'Lesser Symbol of Protection',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_RESOLUTION]: {
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    name: 'Lesser Symbol of Resolution',
    weapon: 'Unequipped'
  }
};

/** Fields are selected before registration, so extensions never rewrite an already executed action. */
export function guardianLiveComboFields(
  runtime: Runtime,
  cast: RuntimeCast,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (cast.skill.id === ID.SYMBOL_OF_IGNITION) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolOfIgnition);
    const field = requireEffect(profile, 'buff', 'guardian-symbol-of-ignition-field');
    fields = field
      ? [
          {
            ownerId: 'guardian',
            fieldType: 'Light',
            duration: effectNumber(profile, field, 'duration'),
            startAnchor: 'castEnd'
          }
        ]
      : [];
  }

  if (cast.skill.id === ID.PURGING_FLAMES && hasTrait(runtime, TRAIT.MASTER_OF_CONSECRATIONS)) {
    const multiplier = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.masterOfConsecrations),
      'durationMultiplier'
    );
    fields = fields?.map((field) => ({ ...field, duration: Number(field.duration) * multiplier }));
  }

  if (isGuardianSymbolSkill(cast.skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.writOfPersistence);
    const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
    if (window)
      fields = fields?.map((field, index) =>
        index === 0 ? { ...field, duration: Number(field.duration) + effectNumber(profile, window, 'duration') } : field
      );
  }

  return fields;
}

/** Select authored trait extensions once and leave cancellation, impact delay, and boon sampling to the common runtime. */
export function guardianLiveTraitEffects(
  runtime: Runtime,
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const extra: SkillEffect[] = [];
  const skill = cast.skill;
  if (skill.id === ID.PURGING_FLAMES && hasTrait(runtime, TRAIT.MASTER_OF_CONSECRATIONS)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.masterOfConsecrations);
    for (const effect of profile.effects ?? []) {
      if (effect.type !== 'strike' && effect.type !== 'condition') continue;
      if (!effect.ticks?.length) throw new Error('Master of Consecrations requires explicit packet timelines.');
      extra.push({
        ...effect,
        name: effect.type === 'strike' ? skill.name : `${skill.name} — Burning`,
        weapon: 'Unequipped'
      });
    }
  }

  const field = skill.comboFields?.[0];
  if (field && isGuardianSymbolSkill(skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.writOfPersistence);
    if (skill.id === ID.SYMBOL_OF_PUNISHMENT) {
      for (const effect of profile.effects ?? []) {
        if (effect.type === 'strike') extra.push({ ...effect, name: skill.name, weapon: 'Scepter' });
        else if (effect.type === 'boon') extra.push({ ...effect, audience: { recipients: 'party' } });
      }
    } else {
      const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
      const extension = window ? effectNumber(profile, window, 'duration') : 0;
      const pulse = effects.filter((effect) => effect.type === 'strike' && strikeEffectTicks(effect).length > 1).at(-1);
      if (pulse?.type === 'strike' && extension > 0) {
        const ticks = strikeEffectTicks(pulse);
        const last = ticks.at(-1)!;
        const fieldEnd =
          (field.startAnchor === 'castEnd' ? cast.fullEnd : cast.start) +
          Number(field.startMs ?? 0) / 1000 +
          Number(field.duration);
        const lastAt =
          ticks.length >= 5
            ? fieldEnd
            : (pulse.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + last.atMs / 1000;
        extra.push({
          type: 'strike',
          name: pulse.name ?? skill.name,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: pulse.persistsAfterInterrupt,
          ticks: Array.from({ length: Math.floor(extension) }, (_, index) => ({
            atMs: (lastAt - cast.start + index + 1) * 1000,
            coefficient: last.coefficient
          }))
        });
      }
    }
  }

  const multiplier = hasTrait(runtime, TRAIT.VIRTUE_OF_RESOLUTION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.virtueOfResolution), 'durationMultiplier')
    : 1;
  const selected = [...effects, ...extra];
  // A symbol's self boon belongs to each pulse even when its hostile packet misses the target.
  if (skill.id === ID.SYMBOL_OF_RESOLUTION)
    for (const effect of [...selected]) {
      if (effect.type !== 'strike') continue;
      for (const tick of strikeEffectTicks(effect))
        selected.push({
          type: 'boon',
          boon: 'resolution',
          duration: 1,
          stacks: 1,
          atMs: tick.atMs,
          timingAnchor: effect.timingAnchor,
          timingScale: effect.timingScale,
          persistsAfterInterrupt: effect.persistsAfterInterrupt
        });
    }

  return selected.map((effect) =>
    effect.type === 'boon' && String(effect.boon ?? effect.name).toLowerCase() === 'resolution'
      ? { ...effect, duration: effect.duration * multiplier }
      : effect
  );
}

/** Committed ignition placement owns an inclusive reaction window independent of its public field record. */
export function completeGuardianIgnition(runtime: Runtime, cast: RuntimeCast): void {
  if (cast.skill.id !== ID.SYMBOL_OF_IGNITION) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolOfIgnition);
  const field = requireEffect(profile, 'buff', 'guardian-symbol-of-ignition-field');
  if (!field) return;
  runtime.profession.core.symbolIgnitionStartsAt = runtime.time;
  runtime.profession.core.symbolIgnitionUntil = canonicalTime(runtime.time + effectNumber(profile, field, 'duration'));
}

/** Ready Justice activations claim real symbol recharge; transient Alacrity changes work already in progress. */
export function triggerGuardianFuriousFocus(runtime: Runtime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.FURIOUS_FOCUS)) return;
  const state = runtime.profession.core;
  const symbol = symbols[ID.LESSER_SYMBOL_OF_BLADES];
  if (state.furiousFocusRecharge)
    state.furiousFocusReadyAt = runtime.cooldownController.project(symbol, state.furiousFocusRecharge);
  if (!isInternalCooldownReady(runtime.time, state.furiousFocusReadyAt)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.furiousFocus);
  if (!requireEffect(profile, 'strike', 'Strike')) return;
  const cause = {
    type: 'action' as const,
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
  if (!emitTraitSymbol(runtime, TRAIT.FURIOUS_FOCUS, ID.LESSER_SYMBOL_OF_BLADES, cause)) return;
  state.furiousFocusRecharge = { startedAt: runtime.time, work: balanceProfileNumber(profile, 'cooldown') };
  state.furiousFocusReadyAt = runtime.cooldownController.project(symbol, state.furiousFocusRecharge);
}

/** All Guardian-generated boons sample attributes at application; Resolution's selected trait scales once. */
export function emitGuardianLiveBoon(runtime: Runtime, event: SimulationEventBase): void {
  // Canonicalize before comparing: raw pulse addition can otherwise reschedule the same rounded timestamp forever.
  event = { ...event, at: canonicalTime(event.at) };
  if (event.at > runtime.time) {
    runtime.schedule(BOON, event.at, event);
    return;
  }

  const kind = String(event.kind);
  const multiplier =
    kind === 'resolution' && hasTrait(runtime, TRAIT.VIRTUE_OF_RESOLUTION)
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, PROFILE.virtueOfResolution),
          'durationMultiplier'
        )
      : 1;
  runtime.emit({
    ...event,
    duration: gw2ResolverBoonDuration(runtime, { ...event, type: 'buff' }, kind, Number(event.duration) * multiplier)
  });
}

/** A triggered symbol owns a distinct activation and schedules only its surviving selected components. */
function emitTraitSymbol(runtime: Runtime, trait: number, symbolId: SkillId, cause: Gw2ResolverEvent): boolean {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const components = (profile.effects ?? []).filter((effect) => effect.type === 'strike' || effect.type === 'boon');
  if (!components.length) return false;
  const symbol = symbols[symbolId];
  const activationId = `guardian.symbol:${symbolId}:${cause.activationId ?? cause.eventOrder}:${runtime.time}`;
  for (const component of components) {
    if (component.type === 'strike' && !component.ticks?.length)
      throw new Error(`${profile.name} requires an explicit strike timeline.`);
    const effect = {
      ...component,
      ...(component.type === 'strike' ? { name: symbol.name, weapon: 'Unequipped' } : {}),
      ...(trait === TRAIT.PROTECTORS_RESTORATION && component.type === 'boon'
        ? { audience: { recipients: 'party' as const } }
        : {})
    };
    for (const { event } of materializeSkillEffectApplications({
      skill: symbol,
      effect,
      start: runtime.time,
      fullEnd: runtime.time,
      baseEvent: {
        source: 'guardian',
        sourceId: symbolId,
        actorType: 'player',
        skillId: symbolId,
        skillName: symbol.name,
        activationId
      },
      skillWeaponFallback: 'Unequipped'
    })) {
      const packet = { ...event, causalOrder: cause.causalOrder ?? cause.eventOrder, triggeredBy: cause.skillName };
      if (event.type === 'buff') emitGuardianLiveBoon(runtime, packet);
      else {
        const fieldDuration =
          trait === TRAIT.FURIOUS_FOCUS
            ? 4
            : trait === TRAIT.PROTECTORS_RESTORATION && component.type === 'strike'
              ? Number(component.ticks?.at(-1)?.atMs ?? 0) / 1000
              : 0;
        runtime.emit({
          ...packet,
          isSymbol: true,
          ...(event.hitIndex === 1 && fieldDuration > 0
            ? { comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: fieldDuration }] }
            : {})
        });
      }
    }
  }

  recordGuardianTraitProc(runtime, trait, symbol.name, runtime.time, cause.skillName, profile.name);
  return true;
}

/** Heals commit their shared trait cooldowns only if a selected packet can actually be created. */
export function completeGuardianHealTraits(runtime: Runtime, cast: RuntimeCast): void {
  if (cast.skill.type !== 'Heal') return;
  const state = runtime.profession.core;
  const cause = {
    type: 'action' as const,
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
  if (
    hasTrait(runtime, TRAIT.HEALERS_RESOLUTION) &&
    isInternalCooldownReady(runtime.time, state.healersResolutionReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.healersResolution);
    const effect = requireEffect(profile, 'boon', 'resolution');
    if (effect) {
      state.healersResolutionReadyAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'internalCooldown'));
      emitGuardianLiveBoon(runtime, {
        ...cause,
        type: 'buff',
        sourceId: TRAIT.HEALERS_RESOLUTION,
        name: profile.name,
        kind: 'resolution',
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      });
    }
  }

  if (
    hasTrait(runtime, TRAIT.PROTECTORS_RESTORATION) &&
    isInternalCooldownReady(runtime.time, state.protectorsRestorationReadyAt)
  ) {
    if (emitTraitSymbol(runtime, TRAIT.PROTECTORS_RESTORATION, ID.LESSER_SYMBOL_OF_PROTECTION, cause))
      state.protectorsRestorationReadyAt = canonicalTime(
        runtime.time +
          balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, PROFILE.protectorsRestoration),
            'internalCooldown'
          )
      );
  }
}

/** Only accepted positive player impacts grant symbol traits; the threshold-crossing hit cannot trigger its own reward. */
export function reactToGuardianLiveDamage(runtime: Runtime, event: Gw2ResolverEvent, damage: number): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !(damage > 0)) return;
  reactToSymbolOfIgnition(runtime, event);
  const state = runtime.profession.core;
  const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
  if (event.isSymbol || isGuardianSymbolSkill(skill, event.skillName)) {
    if (hasTrait(runtime, TRAIT.SYMBOLIC_AVENGER)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolicAvenger);
      state.symbolicAvengerExpirations = grantTimedStacks(state.symbolicAvengerExpirations, {
        at: runtime.time,
        expiresAt: canonicalTime(runtime.time + balanceProfileNumber(profile, 'pulseInterval')),
        count: 1,
        maximumStacks: balanceProfileNumber(profile, 'maximumStacks'),
        retain: 'latest-expiry'
      });
      if (state.symbolicAvengerExpirations.length)
        runtime.schedule(
          AVENGER_EXPIRY,
          Math.min(...state.symbolicAvengerExpirations),
          Math.min(...state.symbolicAvengerExpirations),
          undefined,
          -220
        );
      recordGuardianTraitProc(
        runtime,
        TRAIT.SYMBOLIC_AVENGER,
        profile.name,
        runtime.time,
        event.skillName,
        `${state.symbolicAvengerExpirations.length}/${balanceProfileNumber(profile, 'maximumStacks')} stacks`
      );
    }

    if (hasTrait(runtime, TRAIT.SYMBOLIC_EXPOSURE)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolicExposure);
      const effect = requireEffect(profile, 'condition', 'Vulnerability');
      if (effect)
        runtime.emitDerived(
          event,
          buildResolverCondition({
            at: runtime.time,
            source: 'guardian',
            sourceId: TRAIT.SYMBOLIC_EXPOSURE,
            actorType: 'effect',
            skillId: TRAIT.SYMBOLIC_EXPOSURE,
            skillName: profile.name,
            condition: 'Vulnerability',
            stacks: effectNumber(profile, effect, 'stacks'),
            duration: effectNumber(profile, effect, 'duration'),
            priority: 5
          })
        );
    }
  }

  if (!hasTrait(runtime, TRAIT.ZEALOTS_RESOLUTION) || event.skillId === ID.LESSER_SYMBOL_OF_RESOLUTION) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.zealotsResolution);
  const health = Number(runtime.config.target?.health ?? 0);
  if (
    !(health > 0) ||
    !(targetHealthLoss(runtime.config, runtime) - damage > health * balanceProfileNumber(profile, 'threshold')) ||
    !isInternalCooldownReady(runtime.time, state.zealotsResolutionReadyAt)
  )
    return;
  // Claim before the first queued symbol impact so same-time children cannot recursively claim it.
  if (emitTraitSymbol(runtime, TRAIT.ZEALOTS_RESOLUTION, ID.LESSER_SYMBOL_OF_RESOLUTION, event))
    state.zealotsResolutionReadyAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'cooldown'));
}

/** Resolution readiness follows the accepted self-boon pool, including its cap and extension records. */
function resolutionDeadline(runtime: Runtime): number {
  const remaining = remainingDurationStackSeconds(runtime.boons.get('resolution') ?? [], runtime.time, {
    includes: (application) => application.resolvedAudience.includesSelf,
    maximum: durationStackingBoonCapSeconds('resolution'),
    ordered: true
  });
  return remaining > 0 ? canonicalTime(runtime.time + remaining) : 0;
}

function righteousMight(runtime: Runtime, event: Gw2ResolverEvent): boolean {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.righteousInstincts);
  const effect = requireEffect(profile, 'boon', 'might');
  if (!effect) return false;
  emitGuardianLiveBoon(runtime, {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: TRAIT.RIGHTEOUS_INSTINCTS,
    actorType: 'player',
    skillId: TRAIT.RIGHTEOUS_INSTINCTS,
    skillName: profile.name,
    activationId: event.activationId,
    causalOrder: event.causalOrder ?? event.eventOrder,
    kind: 'might',
    duration: effectNumber(profile, effect, 'duration'),
    stacks: effectNumber(profile, effect, 'stacks')
  });
  recordGuardianTraitProc(
    runtime,
    TRAIT.RIGHTEOUS_INSTINCTS,
    profile.name,
    runtime.time,
    'Resolution',
    'Resolution active'
  );
  return true;
}

/** A new self Resolution window starts one cadence; additional applications extend its pool without duplicating ticks. */
export function reactToGuardianLiveBuff(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (
    event.kind !== 'resolution' ||
    event.resolvedAudience?.includesSelf !== true ||
    !hasTrait(runtime, TRAIT.RIGHTEOUS_INSTINCTS)
  )
    return;
  const state = runtime.profession.core;
  const active = state.resolutionUntil > runtime.time;
  state.resolutionUntil = resolutionDeadline(runtime);
  if (!(state.resolutionUntil > runtime.time)) return;
  runtime.schedule(RESOLUTION_EXPIRY, state.resolutionUntil, state.resolutionUntil, undefined, -220);
  if (active) return;
  state.righteousInstinctsGeneration++;
  if (!righteousMight(runtime, event)) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.righteousInstincts),
    'pulseInterval'
  );
  if (interval > 0)
    runtime.schedule(
      MIGHT,
      canonicalTime(runtime.time + interval),
      { generation: state.righteousInstinctsGeneration, event },
      undefined,
      -10
    );
}

export const guardianLiveTraitTasks = {
  [BOON]: (runtime: Runtime, event: unknown) => emitGuardianLiveBoon(runtime, event as SimulationEventBase),
  [AVENGER_EXPIRY](runtime: Runtime, deadline: unknown) {
    const state = runtime.profession.core;
    if (Math.min(...state.symbolicAvengerExpirations) !== deadline) return;
    state.symbolicAvengerExpirations = purgeExpiredStacks(state.symbolicAvengerExpirations, runtime.time);
    if (state.symbolicAvengerExpirations.length)
      runtime.schedule(
        AVENGER_EXPIRY,
        Math.min(...state.symbolicAvengerExpirations),
        Math.min(...state.symbolicAvengerExpirations),
        undefined,
        -220
      );
  },
  [RESOLUTION_EXPIRY](runtime: Runtime, deadline: unknown) {
    const state = runtime.profession.core;
    if (state.resolutionUntil !== deadline) return;
    state.resolutionUntil = resolutionDeadline(runtime);
    if (state.resolutionUntil > runtime.time)
      runtime.schedule(RESOLUTION_EXPIRY, state.resolutionUntil, state.resolutionUntil, undefined, -220);
  },
  [MIGHT](runtime: Runtime, data: unknown) {
    const { generation, event } = data as { generation: number; event: Gw2ResolverEvent };
    const state = runtime.profession.core;
    if (generation !== state.righteousInstinctsGeneration) return;
    state.resolutionUntil = resolutionDeadline(runtime);
    if (!(state.resolutionUntil > runtime.time) || !righteousMight(runtime, event)) return;
    const interval = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.righteousInstincts),
      'pulseInterval'
    );
    if (interval > 0) runtime.schedule(MIGHT, canonicalTime(runtime.time + interval), data, undefined, -10);
  }
};
