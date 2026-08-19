import { mirageState } from './state.js';
import { EPSILON } from '../../../../platform/engine/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { timedStacks } from '../../core/rules.js';
import { initializeMirageRuntime } from './runtime.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { MesmerPrecastContext, MesmerSkill } from '../../types.js';

function mirageAvailability(context: MesmerPrecastContext, skill: MesmerSkill): AvailabilityResult {
  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context).mirrors;
    if (
      mirrors.some(
        (mirror) => mirror.availableAt <= context.start + EPSILON && mirror.expiresAt > context.start + EPSILON
      )
    ) {
      return { ready: true };
    }

    const retryAt = Math.min(
      ...mirrors.filter((mirror) => mirror.expiresAt > context.start + EPSILON).map((mirror) => mirror.availableAt)
    );
    return {
      ready: false,
      retryAt: Number.isFinite(retryAt) ? retryAt : null,
      code: 'mesmer.mirage-mirror',
      reason: 'No Mirage Mirror is available to pick up.'
    };
  }

  if (!skill.ambush) return { ready: true };
  const runtime = mesmerRuntimeFor(context);
  const activeAmbush = runtime.ambushAttacks[runtime.activePrimaryWeapon()];
  const state = mirageState.from(context);
  if (
    activeAmbush &&
    activeAmbush.name === skill.name &&
    state.ambushSource &&
    state.ambushUntil > context.start + EPSILON
  ) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.ambush',
    reason: `${skill.name} has no active Mirage Cloak ambush window.`
  };
}

export const mirageCastRules = Object.freeze({
  availability: {
    id: 'mesmer.mirage.availability',
    order: 20,
    handler: mirageAvailability
  }
});

export const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.nomads-endurance',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      strikeBonus: 0.1,
      conditionBonus: 0.05
    } as Readonly<Record<string, number>>,
    amount: (_context, target, parameters) =>
      target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus,
    when: (context) =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE) && Boolean(context.timeline?.vigorActiveAt(context.time))
  },
  {
    id: 'mesmer.phantom-pain',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      duration: 10,
      maximumStacks: 4,
      strikePerStack: 0.0625,
      conditionPerStack: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) =>
      timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
      (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
  }
]);

export const mirageAttributeRules = Object.freeze({
  modifierRules: mirageModifierRules
});

export const mirageSchedulerHooks = Object.freeze({
  initialize: initializeMirageRuntime
});
