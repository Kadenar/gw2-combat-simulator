import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { paragonRefrains } from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const REFRAIN = 'warrior.paragon-refrain';

/** Replacing even the same chant invalidates the old pulse before arming a new cadence. */
export function startRefrain(runtime: WarriorRuntime): void {
  const state = paragonState.from(runtime);
  runtime.cancelOwner({ id: REFRAIN, generation: state.refrainGeneration });
  state.refrainGeneration++;
  const interval = balanceNumberFromContext(runtime, PROFILE.resources, 'pulseInterval');

  if (interval > 0)
    runtime.schedule(
      REFRAIN,
      canonicalTime(runtime.time + interval),
      null,
      { id: REFRAIN, generation: state.refrainGeneration },
      -200
    );
}

/** Motivation starts empty and changes only through rewards and the existing refrain tasks, never passive recovery. */
const paragonMotivationPolicy: ResourcePolicy<WarriorRuntime> = {
  kind: 'continuous',
  state: (runtime) => paragonState.from(runtime).motivation,
  maximum: (runtime) => balanceNumberFromContext(runtime, PROFILE.resources, 'maximumStacks'),
  initial: () => 0,
  recovery: () => 0
};

/** Grant the selected reward at this boundary before the mechanic continues. */
export const motivationSpent = defineTriggerPoint<{ readonly spent: number }>('warrior.motivation-spent', [
  TRAIT.INVIGORATING_TEMPO
]);

/** Grant the selected reward at this boundary before the mechanic continues. */
export const chantActivated = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill> }>(
  'warrior.chant-activated',
  [TRAIT.FEVERISH_PULSE]
);

/** Combat entry admits Call to Action once; the refrain itself keeps its mechanic-owned lifetime. */
export const paragonCombatStarted = defineTriggerPoint<Record<string, never>>('warrior.paragon-combat-started', [
  TRAIT.CALL_TO_ACTION
]);

/** Enduring Refrain scales Might only; other packets retain their original stacks. */
function enduringRefrainMultiplier(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceNumberFromContext(runtime, TRAIT.ENDURING_REFRAIN, 'stackMultiplier')
    : 1;
}

/** Chant entry adds the selected trait's Motivation before opening boons. */
function enduringRefrainMotivation(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceNumberFromContext(runtime, TRAIT.ENDURING_REFRAIN, 'resourceGain')
    : 0;
}

/** Each pulse uses the tier before spending, rewards actual spend, and stops when Motivation is exhausted. */
function pulseRefrain(runtime: WarriorRuntime): void {
  const state = paragonState.from(runtime);
  const skill = state.activeRefrainId == null ? undefined : runtime.helpers.skillsById.get(state.activeRefrainId);
  const motivation = runtime.resourceController.value('motivation');

  if (!skill || motivation <= 0) {
    state.activeRefrainId = null;
    return;
  }

  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const level =
    motivation >= balanceProfileNumber(profile, 'threshold')
      ? 3
      : motivation >= balanceProfileNumber(profile, 'minimumStacks')
        ? 2
        : 1;
  const recipe = paragonRefrains[Number(skill.id)];

  if (!recipe) throw new TypeError(`Missing refrain recipe for ${skill.name}.`);

  const { cost, kinds } = recipe.pulse(level);

  const refrain = requireBalanceProfileFromContext(runtime, PROFILE.refrain);
  // Select the tier before spending; only Might scales its stacks with the tier and Enduring Refrain.
  runtime.effects.emit({
    kind: 'profile',
    profile: refrain,
    effects: refrain.effects?.filter((effect) => effect.type === 'boon' && kinds.includes(String(effect.boon))),
    attribution: {
      source: 'Paragon',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name
    },
    transform: (event) => ({
      ...event,
      name: `${skill.name} — ${event.kind}`,
      audience: { recipients: 'party' },
      stacks: event.kind === 'might' ? Number(event.stacks) * level * enduringRefrainMultiplier(runtime) : event.stacks
    })
  });

  const spent = Math.min(cost, runtime.resourceController.value('motivation'));
  runtime.resourceController.spend('motivation', spent);
  runtime.fireTrigger(motivationSpent, { spent });

  if (runtime.resourceController.value('motivation') <= 0) state.activeRefrainId = null;

  const interval = balanceProfileNumber(profile, 'pulseInterval');

  if (state.activeRefrainId != null && interval > 0)
    runtime.schedule(
      REFRAIN,
      canonicalTime(runtime.time + interval),
      null,
      { id: REFRAIN, generation: state.refrainGeneration },
      -200
    );
}

/** A completed chant opens its selected packets and reduces only the other chants' existing recharge. */
function activateChant(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const state = paragonState.from(runtime);
  state.activeRefrainId = cast.skill.id;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.chants);
  runtime.resourceController.grant(
    'motivation',
    balanceProfileNumber(profile, 'resourceGain') + enduringRefrainMotivation(runtime)
  );
  startRefrain(runtime);
  const kinds = paragonRefrains[Number(cast.skill.id)].openingBoons;

  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: (profile.effects ?? []).filter((effect) => effect.type === 'boon' && kinds.includes(String(effect.boon))),
    attribution: {
      source: 'Paragon',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: cast.skill.name + ' — ' + event.kind,
      audience: { recipients: 'party' }
    })
  });

  runtime.fireTrigger(chantActivated, { cast });
}

/** Keep Motivation, chant entry, and refrain pulses on the same replaceable lifetime. */
export const paragonRefrainLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    runtime.resourceController.replace('motivation', Number(inputs.motivation ?? 0));
    paragonState.from(runtime).activeRefrainId = inputs.refrain ? Number(inputs.refrain) : null;
  },
  onCombatStart(runtime) {
    runtime.fireTrigger(paragonCombatStarted, {});
  },
  resources: { motivation: paragonMotivationPolicy },
  sideEffectHandlers: {
    'warrior.chant-activate'(runtime, context) {
      if (context.kind === 'cast') activateChant(runtime, context.cast);
    }
  },
  tasks: { [REFRAIN]: pulseRefrain }
};
