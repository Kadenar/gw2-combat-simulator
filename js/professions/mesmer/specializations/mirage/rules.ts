import { mirageState } from './state.js';
import { EPSILON } from '../../../../platform/engine/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { timedStacks } from '../../core/rules.js';
import { mesmerBalanceValue } from '../../core/profiles.js';
import { initializeMirageRuntime } from './runtime.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { AvailabilityResult, SkillMechanicTrigger } from '../../../../platform/engine/types.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { MesmerCastContext, MesmerPrecastContext, MesmerSkill } from '../../types.js';

interface SkillMechanicTriggerTiming {
  readonly castStart: number;
  readonly castEnd: number;
}

type MirageSkillMechanicHandler = (
  context: MesmerCastContext,
  trigger: SkillMechanicTrigger,
  at: number,
  skill: MesmerSkill
) => void;

const MIRAGE_SKILL_MECHANIC_HANDLERS: Readonly<Record<string, MirageSkillMechanicHandler>> = Object.freeze({
  'mesmer.mirage.create-mirror': (context, trigger, at, skill) => {
    mesmerRuntimeFor(context).mirage.createMirrors(at, trigger.count ?? 1, skill.name);
  },
  'mesmer.mirage.grant-cloak': (context, _trigger, at, skill) => {
    mesmerRuntimeFor(context).mirage.grantMirageCloak(at, skill.name);
  }
});

/** Resolves trigger offsets against the actual cast and invokes Mirage-owned mechanic handlers. */
export function dispatchSkillMechanicTriggers(
  context: MesmerCastContext,
  skill: MesmerSkill,
  timing: SkillMechanicTriggerTiming
): void {
  for (const trigger of skill.mechanicTriggers || []) {
    const handler = MIRAGE_SKILL_MECHANIC_HANDLERS[trigger.type];
    if (!handler) continue;

    const baseCastMs = Math.max(0, Number(skill.castTimeMs || 0));
    const actualCastMs = Math.max(0, timing.castEnd - timing.castStart) * 1000;
    const authoredOffsetMs = Number(trigger.atMs || 0);
    const offsetMs =
      trigger.timingScale === 'cast' && baseCastMs > 0
        ? authoredOffsetMs * (actualCastMs / baseCastMs)
        : authoredOffsetMs;
    const anchor = trigger.timingAnchor === 'castStart' ? timing.castStart : timing.castEnd;
    handler(context, trigger, anchor + offsetMs / 1000, skill);
  }
}

/** Dispatches declarative skill mechanics and applies Self-Deception to categorized Deception skills. */
function completeMirageSkill(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  dispatchSkillMechanicTriggers(context, skill, {
    castStart: context.start,
    castEnd: context.fullEnd
  });

  if (
    runtime.traits.has(TRAIT.SELF_DECEPTION) &&
    skill.categories?.includes('Deception') &&
    runtime.actions.currentResource() > 0
  ) {
    runtime.resources.queueResources(
      context.fullEnd + EPSILON,
      mesmerBalanceValue(context, TRAIT.SELF_DECEPTION, 'resourceGain', 1),
      runtime.activePrimaryWeapon(),
      `Self-Deception: ${skill.name}`,
      {
        traitId: TRAIT.SELF_DECEPTION,
        traitName: 'Self-Deception',
        sourceSkillId: skill.id
      }
    );
  }
}

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
  initialize: initializeMirageRuntime,
  onCastComplete: completeMirageSkill
});
