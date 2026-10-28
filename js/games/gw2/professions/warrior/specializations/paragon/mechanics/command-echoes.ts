import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumberFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const ECHO = 'warrior.paragon-command-echo';

/** Grant the selected reward at this boundary before the mechanic continues. */
export const paragonCastCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill> }>(
  'warrior.paragon-cast-completed',
  [TRAIT.INSPIRING_IMPLEMENTS]
);

/** Echo counts are fixed at command admission and survive later trait changes. */
function reverberationEchoCount(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.REVERBERATION)
    ? balanceNumberFromContext(runtime, TRAIT.REVERBERATION, 'maximumStacks')
    : 1;
}

/** A consumed echo invalidates its old wake and starts any remaining repeat from the actual consumption time. */
function consumeEcho(runtime: WarriorRuntime, activationId: string): void {
  const state = paragonState.from(runtime);
  const echo = state.commandEchoes[activationId];

  if (!echo) return;

  const ownerId = `${ECHO}.${activationId}`;
  runtime.cancelOwner({ id: ownerId, generation: echo.generation });
  const skill = runtime.helpers.skillsById.get(echo.skillId)!;
  // The selected command owns its reward; echo consumption alone decides when it is emitted.
  const action = requireSkillAction(skill, 'echo');
  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    effects: action.effects,
    attribution: {
      source: 'Paragon',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name,
      activationId
    },
    transform: (event) => ({
      ...event,
      name: `${skill.name} — ${event.type === 'buff' ? event.kind : event.name}`,
      ...(event.type === 'buff' ? { audience: { recipients: RECIPIENT.PARTY } } : {})
    })
  });
  runtime.resourceController.grant('adrenaline', skillNumber(skill, 'echoResourceGain'));

  echo.remaining--;
  const interval = skillNumber(skill, 'pulseInterval');

  if (echo.remaining <= 0 || interval <= 0) {
    delete state.commandEchoes[activationId];
    return;
  }

  echo.generation++;
  runtime.schedule(
    ECHO,
    canonicalTime(runtime.time + interval),
    activationId,
    { id: ownerId, generation: echo.generation },
    -20
  );
}

/** Command instances retain independent repeats; a successful burst consumes one repeat from each pending command. */
function activateCommand(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const interval = skillNumber(cast.skill, 'pulseInterval');
  const remaining = reverberationEchoCount(runtime);

  if (interval <= 0 || remaining <= 0) return;

  if (!Number.isSafeInteger(remaining)) throw new RangeError('Command echo counts must be positive integers.');

  paragonState.from(runtime).commandEchoes[cast.id] = { skillId: cast.skill.id, remaining, generation: 0 };
  runtime.schedule(
    ECHO,
    canonicalTime(runtime.time + interval),
    cast.id,
    { id: `${ECHO}.${cast.id}`, generation: 0 },
    -20
  );
}

/** Each command retains its own repeats; burst completion consumes echoes before its trait rewards. */
export const paragonCommandLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  sideEffectHandlers: {
    'warrior.command-arm'(runtime, context) {
      if (context.kind === 'cast') activateCommand(runtime, context.cast);
    }
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.burst)
      for (const activationId of Object.keys(paragonState.from(runtime).commandEchoes))
        consumeEcho(runtime, activationId);

    runtime.fireTrigger(paragonCastCompleted, { cast });
  },
  tasks: {
    [ECHO](runtime, activationId) {
      consumeEcho(runtime, activationId as string);
    }
  }
};
