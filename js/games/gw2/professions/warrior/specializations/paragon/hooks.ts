import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import {
  REFRAIN,
  gainMotivation,
  startRefrain
} from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import {
  PARAGON_COMMAND_ECHO_PROFILES,
  paragonRefrains
} from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import {
  applyFeverishPulse,
  applyInspiringImplements,
  applyInvigoratingTempo,
  enduringRefrainMotivation,
  enduringRefrainMultiplier,
  reverberationEchoCount
} from '#gw2/professions/warrior/specializations/paragon/traits/behavior.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;

const ECHO = 'warrior.paragon-command-echo';

/** Opening packets, refrain pulses, and echoes share actual application-time duration and party ownership. */
function boon(
  runtime: Runtime,
  skill: Skill,
  profile: BalanceProfile,
  effects: readonly SkillEffect[],
  activationId?: string
): void {
  emitEffects(runtime, {
    owner: profile,
    effects,
    baseEvent: {
      source: 'Paragon',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      activationId
    },
    transform: (event) => ({ ...event, name: skill.name + ' — ' + event.kind, audience: { recipients: 'party' } })
  });
}

/** Each pulse uses the tier before spending, rewards actual spend, and stops when Motivation is exhausted. */
function pulseRefrain(runtime: Runtime): void {
  const state = paragonState.from(runtime);
  const skill = state.activeRefrainId == null ? undefined : runtime.helpers.skillsById.get(state.activeRefrainId);
  if (!skill || state.motivation <= 0) {
    state.activeRefrainId = null;
    return;
  }

  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const level =
    state.motivation >= balanceProfileNumber(profile, 'threshold')
      ? 3
      : state.motivation >= balanceProfileNumber(profile, 'minimumStacks')
        ? 2
        : 1;
  const recipe = paragonRefrains[Number(skill.id)];
  if (!recipe) throw new TypeError(`Missing refrain recipe for ${skill.name}.`);
  const { cost, kinds } = recipe.pulse(level);

  const refrain = requireBalanceProfileFromContext(runtime, PROFILE.refrain);
  // Select the tier before spending; only Might scales its stacks with the tier and Enduring Refrain.
  emitEffects(runtime, {
    owner: refrain,
    effects: refrain.effects?.filter((effect) => effect.type === 'boon' && kinds.includes(String(effect.boon))),
    baseEvent: { source: 'Paragon', sourceId: skill.id, actorType: 'player', skillId: skill.id, skillName: skill.name },
    transform: (event) => ({
      ...event,
      name: `${skill.name} — ${event.kind}`,
      audience: { recipients: 'party' },
      stacks: event.kind === 'might' ? Number(event.stacks) * level * enduringRefrainMultiplier(runtime) : event.stacks
    })
  });

  const spent = Math.min(cost, state.motivation);
  state.motivation -= spent;
  applyInvigoratingTempo(runtime, spent);
  if (state.motivation <= 0) state.activeRefrainId = null;
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
function activateChant(runtime: Runtime, cast: RuntimeCast): void {
  const state = paragonState.from(runtime);
  state.activeRefrainId = cast.skill.id;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.chants);
  gainMotivation(runtime, balanceProfileNumber(profile, 'resourceGain') + enduringRefrainMotivation(runtime));
  startRefrain(runtime);
  const kinds = paragonRefrains[Number(cast.skill.id)].openingBoons;
  boon(
    runtime,
    cast.skill,
    profile,
    (profile.effects ?? []).filter((effect) => effect.type === 'boon' && kinds.includes(String(effect.boon))),
    cast.id
  );

  applyFeverishPulse(runtime, cast);
}

/** A consumed echo invalidates its old wake and starts any remaining repeat from the actual consumption time. */
function consumeEcho(runtime: Runtime, activationId: string): void {
  const state = paragonState.from(runtime);
  const echo = state.commandEchoes[activationId];
  if (!echo) return;
  const ownerId = `${ECHO}.${activationId}`;
  runtime.cancelOwner({ id: ownerId, generation: echo.generation });
  const skill = runtime.helpers.skillsById.get(echo.skillId)!;
  const profileId = PARAGON_COMMAND_ECHO_PROFILES[Number(skill.id)];
  if (profileId) {
    const payload = requireBalanceProfileFromContext(runtime, profileId);
    emitEffects(runtime, {
      owner: payload,
      baseEvent: {
        source: 'Paragon',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId
      },
      transform: (event) => ({
        ...event,
        name: `${skill.name} — ${event.type === 'buff' ? event.kind : event.name}`,
        ...(event.type === 'buff' ? { audience: { recipients: 'party' } } : {})
      })
    });
    grantWarriorAdrenaline(runtime, balanceProfileNumber(payload, 'resourceGain'));
  }

  echo.remaining--;
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.commands), 'pulseInterval');
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
function activateCommand(runtime: Runtime, cast: RuntimeCast): void {
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.commands), 'pulseInterval');
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

/** Paragon mutates live state at combat entry, committed casts, swaps, and queued pulses without replay events. */
export const paragonHooks: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  // Declarations own eligibility; these actions retain shared motivation, replacement, and echo lifetimes.
  sideEffectHandlers: {
    'warrior.chant-activate'(runtime, context) {
      if (context.kind === 'cast') activateChant(runtime, context.cast);
    },
    'warrior.command-arm'(runtime, context) {
      if (context.kind === 'cast') activateCommand(runtime, context.cast);
    }
  },
  // Chant Alacrity is independent of the imperative refrain and recharge-reduction state.

  initialize(runtime) {
    const state = paragonState.from(runtime);
    state.maximumMotivation = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    state.motivation = Math.min(state.motivation, state.maximumMotivation);
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.burst)
      for (const activationId of Object.keys(paragonState.from(runtime).commandEchoes))
        consumeEcho(runtime, activationId);
    applyInspiringImplements(runtime, cast);
  },
  tasks: {
    [REFRAIN]: pulseRefrain,
    [ECHO](runtime, activationId) {
      consumeEcho(runtime, activationId as string);
    }
  }
};
