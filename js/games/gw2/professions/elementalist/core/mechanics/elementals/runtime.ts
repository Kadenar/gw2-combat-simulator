import { ACTOR } from '#gw2/platform/constants.js';
import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  interruptCurrentAction,
  startSingleImpactAttack,
  startFlameBarrage,
  startStomp,
  elementalistElementalAttackTasks
} from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';
import {
  retireElemental,
  ELEMENTAL_TASK_OWNER
} from '#gw2/professions/elementalist/core/mechanics/elementals/lifecycle.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import {
  FLAME_BARRAGE_ID,
  STOMP_ID,
  type ElementalKind,
  activeElemental,
  selectedElemental,
  elementalForGlyphId,
  glyphSkillForElement
} from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistSkill,
  ElementalistRuntimeState
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

// Actor step: picks the next autonomous attack. Prefers the secondary attack
// (Flame Burst / Enervating Punch) whenever its cooldown is ready, else the auto.
// Player commands (Flame Barrage / Stomp) are driven by the rotation, not here.
// Ready-first Fire AI omits observed selection delays; replace when their eligibility rule is established.
function stepElemental(
  context: ElementalistRuntime,
  at: number,
  state: {
    summonGeneration: number;
  }
): {
  at: number;
} | null {
  const elemental = professionCoreState(context).summonedElemental;

  if (
    !activeElemental(context, state.summonGeneration, at) ||
    // New attacks require a live window even though final queued impacts can still land.
    at >= elemental.activeUntil
  ) {
    return null;
  }

  if (elemental.element === 'Earth') {
    // Decisions compare the projected recharge to this canonical wake without early readiness.
    if (canonicalTime(elemental.secondaryAttackReadyAt) <= canonicalTime(at)) {
      startSingleImpactAttack(
        context,
        at,
        EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch,
        'Enervating Punch',
        'enervating-punch'
      );
    } else {
      startSingleImpactAttack(context, at, EARTH_ELEMENTAL_EVTC_PROFILE.punch, 'Punch', 'punch');
    }
  } else if (canonicalTime(elemental.secondaryAttackReadyAt) <= canonicalTime(at)) {
    startSingleImpactAttack(context, at, FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst, 'Flame Burst', 'flame-burst');
  } else {
    startSingleImpactAttack(context, at, FIRE_ELEMENTAL_EVTC_PROFILE.fireball, 'Fireball', 'fireball');
  }

  // Only the next decision deadline escapes; scheduling captures the current summon generation.
  return elemental.busyUntil < elemental.activeUntil ? { at: elemental.busyUntil } : null;
}

/** A command replaces only the next decision; impact tasks keep their action-generation checks. */
function scheduleElementalDecision(context: ElementalistRuntime, at: number): void {
  // Commands retain their recovery during preparation without waking autonomous decisions.
  if (!autonomousActionsAllowed(context)) return;

  context.profession.core.summonedElemental.started = true;
  const generation = context.profession.core.summonedElemental.summonGeneration;
  const owner = { id: 'elementalist.elemental-decision', generation };
  context.cancelOwner(owner);
  context.schedule('elementalist.elemental-decision', at, generation, owner);
}

// Lifetime teardown: end of lifetime. Interrupts the in-flight action, clears all
// elemental state, removes the command flip, and puts the glyph on its post-expiry
// recharge so it can be re-summoned. Ignored if a newer summon already superseded it.
function expireElemental(
  context: ElementalistRuntime,
  at: number,
  captured: {
    summonGeneration: number;
  }
): void {
  const state = professionCoreState(context);
  const elemental = state.summonedElemental;

  if (captured.summonGeneration !== elemental.summonGeneration) return;

  const element = elemental.element;

  if (element !== 'Fire' && element !== 'Earth') return;

  context.cancelOwner({ id: 'elementalist.elemental-decision', generation: captured.summonGeneration });
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  elemental.element = null;
  elemental.activeUntil = 0;
  elemental.busyUntil = 0;
  elemental.secondaryAttackReadyAt = 0;
  elemental.currentActivationId = null;
  retireElemental(context, captured.summonGeneration);
  elemental.started = false;
  consumeSkillFlip(
    state.availableFlips,
    element === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND
  );
  const glyph = glyphSkillForElement(context, element);

  if (glyph) {
    context.cooldownController.startRecharge(glyph, at, skillNumber(glyph, 'rechargeAfterExpiry'));
  }
}

// Kicks off the attack loop after the initial target-acquisition delay. Idempotent
// via the `started` flag so combat-start and cast paths don't double-start it.
function startElemental(context: ElementalistRuntime, at: number): void {
  const elemental = professionCoreState(context).summonedElemental;

  if (
    (elemental.element !== 'Fire' && elemental.element !== 'Earth') ||
    !autonomousActionsAllowed(context) ||
    elemental.started ||
    elemental.activeUntil <= at
  ) {
    return;
  }

  const glyph = glyphSkillForElement(context, elemental.element)!;
  const delay = skillNumber(glyph, 'summonStartupDelay');
  scheduleElementalDecision(context, Math.max(at + delay, elemental.busyUntil));
}

// Core spawn: cancels the previous elemental's tasks, resets summonedElemental state
// with a fresh summonGeneration, emits the expiry marker, arms its lifetime, and enables
// the command flip. Optionally starts the attack loop immediately.
function summonElemental(context: ElementalistRuntime, at: number, element: ElementalKind): void {
  const state = professionCoreState(context);
  // Explicit casts and configured openers share the selected glyph's lifecycle tuning.
  const glyph = glyphSkillForElement(context, element)!;
  // Replacement ends the old action and flip together with its queued work.
  interruptCurrentAction(context, at);
  const previousElement = state.summonedElemental.element;

  if (previousElement === 'Fire' || previousElement === 'Earth')
    consumeSkillFlip(
      state.availableFlips,
      previousElement === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND
    );

  const previousGeneration = state.summonedElemental.summonGeneration;
  retireElemental(context, previousGeneration);
  context.cancelOwner({ id: 'elementalist.elemental-decision', generation: previousGeneration });
  context.cancelOwner({ id: ELEMENTAL_TASK_OWNER, generation: previousGeneration });
  const summonGeneration = state.summonedElemental.summonGeneration + 1;
  state.summonedElemental = {
    element,
    summonGeneration,
    actionGeneration: 0,
    activeUntil: canonicalTime(at + skillNumber(glyph, 'duration')),
    busyUntil: at,
    secondaryAttackReadyAt: at,
    currentActivationId: null,
    started: false
  };
  const expiresAt = state.summonedElemental.activeUntil;
  context.schedule(
    'elementalist.elemental-expire',
    expiresAt,
    { summonGeneration },
    { id: ELEMENTAL_TASK_OWNER, generation: summonGeneration },
    50
  );
  armSkillFlip(
    state.availableFlips,
    element === 'Earth' ? ID.STOMP_ELEMENTAL_COMMAND : ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    at,
    expiresAt
  );
  startElemental(context, at);
}

/**
 * Cast-complete hook: spawns the elemental at cast end. Its attack loop starts immediately
 * unless the rotation is still pre-combat and waiting on an explicit combat-start event.
 */
export function completeElementalistGlyphCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const element = elementalForGlyphId(skill.id);

  if (!element) return;

  summonElemental(context, cast.effectiveEnd, element);
}

/**
 * Cast-complete hook for the player-commanded flip skills: pre-empts whatever the elemental
 * is doing and drives Flame Barrage / Stomp on the live companion.
 */
export function completeElementalistElementalCommand(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (skill.id === FLAME_BARRAGE_ID) {
    startFlameBarrage(context, cast.effectiveEnd);
  } else if (skill.id === STOMP_ID) {
    startStomp(context, cast.effectiveEnd);
  } else {
    return;
  }

  // A command replaces the pending decision, including target acquisition, with its own recovery deadline.
  const elemental = professionCoreState(context).summonedElemental;
  scheduleElementalDecision(context, elemental.busyUntil);
}

/** Generation zero permits one automatic opener; expiry never bypasses the glyph's recharge with another summon. */
export function ensureElementalistElemental(context: ElementalistRuntime, skill?: Skill): void {
  const selected = selectedElemental(context);

  if (
    selected &&
    context.profession.core.summonedElemental.summonGeneration === 0 &&
    (!skill || !elementalForGlyphId(skill.id))
  ) {
    const glyph = glyphSkillForElement(context, selected);

    if (glyph) summonElemental(context, context.time, selected);
  }

  startElemental(context, context.time);
}

/** The summon owner registers decisions and expiry alongside the attack owner's generation-checked impacts. */
const elementalistElementalTasks = {
  'elementalist.elemental-decision'(context: ElementalistRuntime, data: unknown): void {
    const generation = Number(data);
    const elemental = context.profession.core.summonedElemental;

    if (!autonomousActionsAllowed(context) || !activeElemental(context, generation, context.time)) return;

    if (canonicalTime(elemental.busyUntil) > context.time) {
      scheduleElementalDecision(context, elemental.busyUntil);
      return;
    }

    const next = stepElemental(context, context.time, { summonGeneration: generation });

    if (next) scheduleElementalDecision(context, next.at);
  },
  'elementalist.elemental-expire'(context: ElementalistRuntime, data: unknown): void {
    const captured = data as {
      summonGeneration: number;
    };

    if (captured.summonGeneration !== context.profession.core.summonedElemental.summonGeneration) return;

    const element = context.profession.core.summonedElemental.element;
    expireElemental(context, context.time, captured);
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'marker',
        at: context.time,
        source: 'Elementalist',
        sourceId: 'elementalist.elemental-expire',
        actorType: ACTOR.SUMMON,
        name: element + ' Elemental expires'
      }
    });
  },
  ...elementalistElementalAttackTasks
};

/** Physical elementals own independent attacks, expiry, and combat-entry summoning; their lifetime does not extend player skill previews. */
export const elementalistElementalLifecycle = {
  backgroundTasks: Object.keys(elementalistElementalTasks),
  tasks: elementalistElementalTasks,
  onCombatStart: ensureElementalistElemental
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
