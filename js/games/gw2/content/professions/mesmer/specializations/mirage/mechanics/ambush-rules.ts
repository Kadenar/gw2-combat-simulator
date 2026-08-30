import { mirageState } from '../state.js';
import { EPSILON } from '../../../../../../../../kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { MODIFIER_TARGET } from '../../../../../../platform/combat/modifiers/rules.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { illusionSource, timedStacks } from '../../../core/mechanics/execution.js';
import { mesmerBalanceValue } from '../../../core/profiles.js';
import { initializeMirageRuntime, mirageControllerFor } from './runtime.js';
import { mesmerRuntimeFor } from '../../../core/mechanics/runtime.js';
import type {
  AvailabilityResult,
  SimulationEvent,
  SkillMechanicTrigger
} from '../../../../../../platform/engine/types.js';
import type { Gw2ModifierRule } from '../../../../../../platform/combat/modifiers/types.js';
import type {
  MesmerCastContext,
  MesmerPrecastContext,
  MesmerRechargeContext,
  MesmerSchedulerContext,
  MesmerSkill
} from '../../../types.js';

type MirageSkillMechanicHandler = (invocation: {
  readonly context: MesmerSchedulerContext;
  readonly skill: MesmerSkill;
  readonly trigger: SkillMechanicTrigger;
  readonly at: number;
  readonly castStart: number;
  readonly castEnd: number;
  readonly activationId: string;
}) => void;

export const mirageSkillMechanicHandlers: Readonly<Record<string, MirageSkillMechanicHandler>> = Object.freeze({
  'mesmer.mirage.create-mirror': ({ context, trigger, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).createMirrors(at, trigger.count ?? 1, skill.name);
  },
  'mesmer.mirage.grant-cloak': ({ context, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).grantMirageCloak(at, skill.name);
  },
  'mesmer.mirage.pick-up-mirror': ({ context, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).pickUpMirror(at, skill.name);
  },
  'mesmer.mirage.dodge': ({ context, at, skill }) => {
    const runtime = mesmerRuntimeFor(context);
    mirageControllerFor(runtime).grantMirageCloak(at, skill.name);
    if (runtime.traits.has(TRAIT.DECEPTIVE_EVASION)) {
      runtime.resources.queueResources(at + EPSILON, 1, runtime.activePrimaryWeapon(), 'Deceptive Evasion', {
        traitId: TRAIT.DECEPTIVE_EVASION,
        traitName: 'Deceptive Evasion'
      });
    }
  }
});

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
function completeMirageSkill(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
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

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      context.tasks.nextAt('mesmer.mirage.create-mirror'),
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

/** Uses Mirage endurance recharge semantics only for the specialization's dodge action. */
function modifyMirageRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  if (context.ammoCastLockout || context.skill.id !== ID.DODGE_MIRAGE_CLOAK) return sharedDuration;
  return Number(context.skill.cooldown || 0) / (context.config.boons?.vigor ? 1.5 : 1);
}

export const mirageCastRules = Object.freeze({
  availability: {
    id: 'mesmer.mirage.availability',
    order: 20,
    handler: mirageAvailability
  },
  modifyRechargeDuration: modifyMirageRecharge
});

/** Expires Mirage Mirrors when scheduler time passes their pickup window. */
function advanceMirageScheduler(context: MesmerSchedulerContext, target: number): void {
  const state = mirageState.from(context);
  state.mirrors = state.mirrors.filter((mirror) => mirror.expiresAt > target + EPSILON);
}

/** Converts Sigil of Energy's proc into Mirage dodge endurance without involving Core. */
function observeMirageEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'proc' || event.sourceId !== 'sigil.energy') return;
  const runtime = mesmerRuntimeFor(context);
  const dodge = runtime.skillsById.get(ID.DODGE_MIRAGE_CLOAK);
  const ammo = dodge ? context.cooldownController.refreshAmmo(dodge, event.at) : null;
  if (!dodge || !ammo || ammo.charges >= ammo.maximum) return;
  ammo.charges += 1;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.state.cooldowns.delete(dodge.id);
}

export const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.nomads-endurance',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      strikeBonus: 0.1,
      conditionBonus: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) => {
      // Illusion strikes do not inherit personal strike bonuses, while their conditions remain owner-resolved.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus;
    },
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
    amount: (context, target, parameters) => {
      // Phantom Pain joins other additive outgoing-damage bonuses; phantasm
      // conditions use owner modifiers, but phantasm strikes use summon ownership.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return (
        timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
        (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
      );
    }
  }
]);

export const mirageAttributeRules = Object.freeze({
  modifierRules: mirageModifierRules
});

export const mirageSchedulerHooks = Object.freeze({
  initialize: initializeMirageRuntime,
  advance: {
    id: 'mesmer.mirage.mirrors',
    order: 20,
    handler: advanceMirageScheduler
  },
  onCastComplete: completeMirageSkill,
  onEventScheduled: {
    id: 'mesmer.mirage.energy-sigil',
    order: 20,
    handler: observeMirageEvent
  }
});
