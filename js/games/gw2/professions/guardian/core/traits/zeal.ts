import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  emitGuardianProc,
  guardianResolverState,
  guardianTraitIcon,
  isGuardianSymbolSkill,
  queueGuardianResolverBuff,
  recordGuardianTraitProc
} from '#gw2/professions/guardian/core/traits/shared.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

/** Owns Core Guardian Zeal's imperative symbol procs while leaving their sequence in the public dispatcher. */
function emitLesserSymbolOfBlades(context: GuardianSchedulerContext, skill: GuardianSkill, at: number): void {
  const furiousFocusProfile = requireBalanceProfileFromContext(context, PROFILE.furiousFocus);
  const strike = requireEffect(furiousFocusProfile, 'strike', 'Strike');
  if (!strike) return;
  const ticks = strike?.ticks ?? [];
  if (!ticks?.length) throw new Error('Furious Focus requires an explicit strike timeline.');
  // The triggered symbol is one distinct activation so its unequipped weapon-strength roll is shared by its
  // pulses without colliding with the virtue cast's equipped-weapon roll.
  const activationId = context.createActivationId('effect');
  for (const [index, tick] of (ticks ?? []).entries()) {
    context.emit(
      buildGuardianStrike({
        at: at + Number(tick.atMs) / 1000,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        actorType: 'player',
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        skillName: 'Lesser Symbol of Blades',
        name: 'Lesser Symbol of Blades',
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        activationId,
        hitIndex: index + 1,
        totalHits: ticks.length,
        isSymbol: true,
        // The first symbol pulse owns its four-second Light field for shared combo resolution.
        comboFields: index === 0 ? [{ ownerId: 'guardian', fieldType: 'Light', duration: 4 }] : undefined,
        triggeredBy: skill.name
      })
    );
  }

  emitGuardianProc(context, {
    name: 'Lesser Symbol of Blades',
    at,
    sourceSkill: skill.name,
    detail: 'Furious Focus',
    icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS)
  });
}

export function applyFuriousFocus(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtueSlot: string,
  at: number
): void {
  // Spear's symbol forms before its strike and tether; cancelling the aftercast must not move that activation.
  if (skill.id === GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE) {
    at = context.start + projectCastRelativeEffectTimingMs(skill, (context.fullEnd - context.start) * 1000, 480) / 1000;
  }

  if (
    virtueSlot !== 'Profession_1' ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) ||
    !isInternalCooldownReady(at, professionCoreState(context).furiousFocusReadyAt)
  ) {
    return;
  }

  const furiousFocusProfile = requireBalanceProfileFromContext(context, PROFILE.furiousFocus);
  if (!requireEffect(furiousFocusProfile, 'strike', 'Strike')) return;
  // The proc profile owns recharge even when the catalog also contains its display skill.
  const lesserSymbol = {
    ...context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES),
    id: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    cooldown: balanceProfileNumber(furiousFocusProfile, 'cooldown')
  } as GuardianSkill;
  professionCoreState(context).furiousFocusReadyAt = at + context.rechargeDurationFor(lesserSymbol, at);
  emitLesserSymbolOfBlades(context, skill, at);
}

export function applySymbolicExposure(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)) return;
  const symbolicExposureProfile = requireBalanceProfileFromContext(context, PROFILE.symbolicExposure);
  const exposure = requireEffect(symbolicExposureProfile, 'condition', 'Vulnerability');
  if (!exposure) return;
  emitSkillCondition(context, {
    at: event.at,
    actorType: 'effect',
    skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    skillName: 'Symbolic Exposure',
    condition: 'Vulnerability',
    stacks: effectNumber(symbolicExposureProfile, exposure, 'stacks'),
    duration: effectNumber(symbolicExposureProfile, exposure, 'duration'),
    triggeredBy: event.skillName
  });
}

// Schedule Lesser Symbol of Resolution's pulse sequence as causally ordered
// symbol packets and boons from one activation.
function queueLesserSymbolOfResolution(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined
): boolean {
  const zealotsResolutionProfile = requireBalanceProfileFromContext(context, PROFILE.zealotsResolution);
  const strike = requireEffect(zealotsResolutionProfile, 'strike', 'Strike');
  const resolution = requireEffect(zealotsResolutionProfile, 'boon', 'resolution');
  const ticks = strike?.ticks ?? [];
  if (strike && !ticks?.length) throw new Error("Zealot's Resolution requires an explicit strike timeline.");
  if (!strike && !resolution) return false;
  for (const [index, tick] of (ticks ?? []).entries()) {
    const pulseAt = at + Number(tick.atMs) / 1000;
    context.queue.enqueue(
      buildGuardianStrike({
        at: pulseAt,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: 'Lesser Symbol of Resolution',
        name: 'Lesser Symbol of Resolution',
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        hitIndex: index + 1,
        totalHits: ticks.length,
        isSymbol: true,
        triggeredBy: sourceSkill
      })
    );
  }

  if (resolution) {
    // Resolve the surviving boon's cadence once for all symbol pulses.
    const applications = effectNumber(zealotsResolutionProfile, resolution, 'applications');
    const intervalMs = effectNumber(zealotsResolutionProfile, resolution, 'intervalMs');
    const duration = effectNumber(zealotsResolutionProfile, resolution, 'duration');
    const stacks = effectNumber(zealotsResolutionProfile, resolution, 'stacks');
    for (let index = 0; index < applications; index++) {
      queueGuardianResolverBuff(context, {
        at: at + (index * intervalMs) / 1000,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: 'Lesser Symbol of Resolution',
        kind: 'resolution',
        duration,
        stacks,
        priority: 5
      });
    }
  }

  return true;
}

export function reactToZealSymbolTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) return;

  const state = guardianResolverState(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)) {
    const symbolicAvengerProfile = requireBalanceProfileFromContext(context, PROFILE.symbolicAvenger);
    // At the cap, replace only the shortest remaining stack instead of refreshing the entire buff.
    state.symbolicAvengerExpirations = grantTimedStacks(state.symbolicAvengerExpirations || [], {
      at: event.at,
      expiresAt: event.at + balanceProfileNumber(symbolicAvengerProfile, 'pulseInterval'),
      count: 1,
      maximumStacks: balanceProfileNumber(symbolicAvengerProfile, 'maximumStacks'),
      retain: 'latest-expiry'
    });
    recordGuardianTraitProc(
      context,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      'Symbolic Avenger',
      event.at,
      event.skillName,
      `${state.symbolicAvengerExpirations.length}/5 stacks`
    );
  }

  if (
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
  ) {
    const symbolicExposureProfile = requireBalanceProfileFromContext(context, PROFILE.symbolicExposure);
    const exposure = requireEffect(symbolicExposureProfile, 'condition', 'Vulnerability');
    if (!exposure) return;
    // Lesser Symbol applies target Vulnerability directly so it shares condition duration and stacking rules.
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
        actorType: 'effect',
        skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
        skillName: 'Symbolic Exposure',
        condition: 'Vulnerability',
        duration: effectNumber(symbolicExposureProfile, exposure, 'duration'),
        stacks: effectNumber(symbolicExposureProfile, exposure, 'stacks'),
        priority: 5
      })
    );
  }
}

// The enemy must already be below the threshold before this strike; the crossing hit cannot trigger the symbol.
export function reactToZealotsResolution(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  hitDamage: number
): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION)) return;
  const state = guardianResolverState(context);
  const targetHealth = Number(context.config.target?.health ?? 0);
  const damageDone = targetHealthLoss(context.config, context) - hitDamage;
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    !(
      damageDone >
      targetHealth *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.zealotsResolution), 'threshold')
    ) ||
    !isInternalCooldownReady(event.at, Number(state.zealotsResolutionReadyAt || 0)) ||
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
  ) {
    return;
  }

  if (!queueLesserSymbolOfResolution(context, event.at, event.skillName)) return;
  const zealotsResolutionProfile = requireBalanceProfileFromContext(context, PROFILE.zealotsResolution);
  state.zealotsResolutionReadyAt = event.at + balanceProfileNumber(zealotsResolutionProfile, 'cooldown');
  recordGuardianTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION,
    'Lesser Symbol of Resolution',
    event.at,
    event.skillName,
    "Zealot's Resolution"
  );
}
