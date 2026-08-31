import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { combinedTargetDamage } from '#gw2/platform/combat/state/target-health.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import {
  GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE,
  guardianBalanceProfile,
  guardianBalanceProfileEffect
} from '#gw2/content/professions/guardian/core/profiles.js';
import {
  emitGuardianProc,
  guardianResolverEpsilon,
  guardianResolverState,
  guardianTraitIcon,
  isGuardianSymbolSkill,
  queueGuardianResolverBuff,
  recordGuardianTraitProc
} from '#gw2/content/professions/guardian/core/traits/shared.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/content/professions/guardian/types.js';

/** Owns Core Guardian Zeal's imperative symbol procs while leaving their sequence in the public dispatcher. */
function emitLesserSymbolOfBlades(context: GuardianSchedulerContext, skill: GuardianSkill, at: number): void {
  const profile = guardianBalanceProfile(context, PROFILE.furiousFocus);
  const strike = guardianBalanceProfileEffect(profile, 'strike');
  const hits = Math.max(1, Math.trunc(Number(strike?.hits || 5)));
  const interval = Number(strike?.intervalMs || 1000) / 1000;
  // The triggered symbol is one distinct activation so its unequipped weapon-strength roll is shared by its
  // pulses without colliding with the virtue cast's equipped-weapon roll.
  const activationId = context.createActivationId('effect');
  for (let index = 0; index < hits; index += 1) {
    context.emit(
      buildGuardianStrike({
        at: at + index * interval,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        actorType: 'player',
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        skillName: 'Lesser Symbol of Blades',
        name: 'Lesser Symbol of Blades',
        coefficient: Number(strike?.coefficient || 0.65) / hits,
        skillWeapon: 'Unequipped',
        activationId,
        hitIndex: index + 1,
        totalHits: hits,
        isSymbol: true,
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
  if (
    virtueSlot !== 'Profession_1' ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) ||
    !isInternalCooldownReady(at, professionCoreState(context).furiousFocusReadyAt)
  ) {
    return;
  }

  const lesserSymbol =
    context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES) ||
    ({
      id: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
      name: 'Lesser Symbol of Blades',
      cooldown: Number(guardianBalanceProfile(context, PROFILE.furiousFocus)?.cooldown || 10)
    } as GuardianSkill);
  professionCoreState(context).furiousFocusReadyAt = at + context.rechargeDurationFor(lesserSymbol, at);
  emitLesserSymbolOfBlades(context, skill, at);
}

export function applySymbolicExposure(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)) return;
  const exposure = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.symbolicExposure), 'condition');
  emitSkillCondition(context, {
    at: event.at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    actorType: 'effect',
    skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    skillName: 'Symbolic Exposure',
    condition: 'Vulnerability',
    stacks: Number(exposure?.stacks || 2),
    duration: Number(exposure?.duration || 5),
    triggeredBy: event.skillName
  });
}

// Schedule Lesser Symbol of Resolution's pulse sequence as causally ordered
// symbol packets and boons from one activation.
function queueLesserSymbolOfResolution(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined
): void {
  const profile = guardianBalanceProfile(context, PROFILE.zealotsResolution);
  const strike = guardianBalanceProfileEffect(profile, 'strike');
  const resolution = guardianBalanceProfileEffect(profile, 'boon');
  const hits = Math.max(1, Math.trunc(Number(strike?.hits || 5)));
  const interval = Number(strike?.intervalMs || 1000) / 1000;
  for (let index = 0; index < hits; index += 1) {
    const pulseAt = at + index * interval;
    enqueueOrdered(
      context.queue,
      buildGuardianStrike({
        at: pulseAt,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: 'Lesser Symbol of Resolution',
        name: 'Lesser Symbol of Resolution',
        coefficient: Number(strike?.coefficient || 0.5) / hits,
        skillWeapon: 'Unequipped',
        hitIndex: index + 1,
        totalHits: hits,
        isSymbol: true,
        triggeredBy: sourceSkill
      })
    );
    queueGuardianResolverBuff(context, {
      at: pulseAt,
      sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
      skillName: 'Lesser Symbol of Resolution',
      kind: 'resolution',
      duration: Number(resolution?.duration || 2),
      stacks: Number(resolution?.stacks || 1),
      priority: 5
    });
  }
}

export function reactToZealSymbolTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) return;

  const state = guardianResolverState(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)) {
    const profile = guardianBalanceProfile(context, PROFILE.symbolicAvenger);
    if (event.at >= state.symbolicAvengerUntil - guardianResolverEpsilon(context)) {
      state.symbolicAvengerStacks = 0;
    }

    state.symbolicAvengerStacks = Math.min(
      Number(profile?.maximumStacks || 5),
      Number(state.symbolicAvengerStacks || 0) + 1
    );
    state.symbolicAvengerUntil = event.at + Number(profile?.pulseInterval || 15);
    recordGuardianTraitProc(
      context,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      'Symbolic Avenger',
      event.at,
      event.skillName,
      `${state.symbolicAvengerStacks}/5 stacks`
    );
  }

  if (
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
  ) {
    // Lesser Symbol applies target Vulnerability directly so it shares condition duration and stacking rules.
    enqueueOrdered(context.queue, {
      type: 'condition',
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: 'Symbolic Exposure',
      condition: 'Vulnerability',
      duration: 5,
      stacks: 2,
      priority: 5
    });
  }
}

// Trigger the lesser symbol only after cumulative damage crosses the configured
// target-health threshold, with guards against recursion and repeated ICD hits.
export function reactToZealotsResolution(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = guardianResolverState(context);
  const targetHealth = Number(context.config.target?.health ?? 0);
  const damageDone = combinedTargetDamage(context);
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    !(
      damageDone >
      targetHealth * Number(guardianBalanceProfile(context, PROFILE.zealotsResolution)?.threshold || 0.25)
    ) ||
    !isInternalCooldownReady(event.at, Number(state.zealotsResolutionReadyAt || 0)) ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION) ||
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
  ) {
    return;
  }

  state.zealotsResolutionReadyAt =
    event.at + Number(guardianBalanceProfile(context, PROFILE.zealotsResolution)?.cooldown || 30);
  queueLesserSymbolOfResolution(context, event.at, event.skillName);
  recordGuardianTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION,
    'Lesser Symbol of Resolution',
    event.at,
    event.skillName,
    "Zealot's Resolution"
  );
}
