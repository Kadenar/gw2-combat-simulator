import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  PARAGON_BALANCE_PROFILE_IDS as PROFILE,
  PARAGON_COMMAND_ECHO_PROFILES
} from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { BalanceProfile, Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;
const REFRAIN = 'warrior.paragon-refrain';
const ECHO = 'warrior.paragon-command-echo';
const CHANTS = [ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM];

/** Motivation is a single capped live pool, immediately visible to damage modifiers. */
function gainMotivation(runtime: Runtime, amount: number): void {
  const state = paragonState.from(runtime);
  state.motivation = grantCapped(state.motivation, amount, state.maximumMotivation);
}

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

/** Replacing even the same chant invalidates the old pulse before arming a new cadence. */
function startRefrain(runtime: Runtime): void {
  const state = paragonState.from(runtime);
  runtime.cancelOwner({ id: REFRAIN, generation: state.refrainGeneration });
  state.refrainGeneration++;
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'pulseInterval');
  if (interval > 0)
    runtime.schedule(
      REFRAIN,
      canonicalTime(runtime.time + interval),
      null,
      { id: REFRAIN, generation: state.refrainGeneration },
      -200
    );
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
  let cost = 1;
  const kinds: string[] = [];
  if (skill.id === ID.CHANT_OF_ACTION) {
    kinds.push('might');
    if (level >= 2) kinds.push('fury');
  } else if (skill.id === ID.CHANT_OF_RECUPERATION) {
    cost = level === 3 ? 3 : 2;
    if (level === 3) kinds.push('regeneration');
  } else if (skill.id === ID.CHANT_OF_FREEDOM) {
    cost = level;
    kinds.push('swiftness');
    if (level >= 2) kinds.push('resolution');
    if (level === 3) kinds.push('protection');
  }

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
      stacks:
        event.kind === 'might'
          ? Number(event.stacks) *
            level *
            (hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
              ? balanceProfileNumber(
                  requireBalanceProfileFromContext(runtime, PROFILE.enduringRefrain),
                  'stackMultiplier'
                )
              : 1)
          : event.stacks
    })
  });

  const spent = Math.min(cost, state.motivation);
  state.motivation -= spent;
  if (hasTrait(runtime, TRAIT.INVIGORATING_TEMPO))
    grantWarriorAdrenaline(
      runtime,
      spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.invigoratingTempo), 'resourceGain')
    );
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
  gainMotivation(
    runtime,
    balanceProfileNumber(profile, 'resourceGain') +
      (hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.enduringRefrain), 'resourceGain')
        : 0)
  );
  startRefrain(runtime);
  const kinds =
    cast.skill.id === ID.CHANT_OF_ACTION
      ? ['might', 'fury']
      : cast.skill.id === ID.CHANT_OF_RECUPERATION
        ? ['vigor']
        : ['stability'];
  boon(
    runtime,
    cast.skill,
    profile,
    (profile.effects ?? []).filter((effect) => effect.type === 'boon' && kinds.includes(String(effect.boon))),
    cast.id
  );

  if (!hasTrait(runtime, TRAIT.FEVERISH_PULSE)) return;
  const feverish = requireBalanceProfileFromContext(runtime, PROFILE.feverishPulse);
  for (const id of CHANTS) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill && id !== cast.skill.id)
      runtime.cooldownController.reduceSkillRecharge(
        skill,
        balanceProfileNumber(feverish, 'rechargeReduction'),
        runtime.time
      );
  }

  boon(
    runtime,
    cast.skill,
    feverish,
    (feverish.effects ?? []).filter((effect) => effect.type === 'boon' && effect.boon === 'alacrity'),
    cast.id
  );
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
  const remaining = hasTrait(runtime, TRAIT.REVERBERATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.reverberation), 'maximumStacks')
    : 1;
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
  initialize(runtime) {
    const state = paragonState.from(runtime);
    state.maximumMotivation = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    state.motivation = Math.min(state.motivation, state.maximumMotivation);
  },
  onCombatStart(runtime) {
    const state = paragonState.from(runtime);
    if (state.callToActionActivated || !hasTrait(runtime, TRAIT.CALL_TO_ACTION)) return;
    state.callToActionActivated = true;
    gainMotivation(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.callToAction), 'resourceGain')
    );
    if (state.activeRefrainId == null) {
      state.activeRefrainId = ID.CHANT_OF_ACTION;
      startRefrain(runtime);
    }
  },
  onCastStart(runtime, cast) {
    if (cast.cancelled) return;
    if (
      cast.skill.burst &&
      !cast.skill.categories?.includes('Chant') &&
      hasTrait(runtime, TRAIT.RALLY_THE_VALIANT) &&
      paragonState.from(runtime).activeRefrainId != null
    )
      gainMotivation(
        runtime,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.rallyTheValiant), 'resourceGain')
      );
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.categories?.includes('Chant')) activateChant(runtime, cast);
    if (cast.skill.categories?.includes('Command')) activateCommand(runtime, cast);
    if (cast.skill.burst)
      for (const activationId of Object.keys(paragonState.from(runtime).commandEchoes))
        consumeEcho(runtime, activationId);
    if (
      cast.skill.inputCategory === 'weapon-swap' &&
      hasTrait(runtime, TRAIT.INSPIRING_IMPLEMENTS) &&
      isInternalCooldownReady(runtime.time, runtime.procs.deadline('warrior.paragon.inspiringImplements'))
    ) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.inspiringImplements);
      runtime.procs.readyAt['warrior.paragon.inspiringImplements'] = canonicalTime(
        runtime.time + balanceProfileNumber(profile, 'internalCooldown')
      );
      grantWarriorAdrenaline(runtime, balanceProfileNumber(profile, 'resourceGain'));
      gainMotivation(runtime, balanceProfileNumber(profile, 'minimumStacks'));
    }
  },
  tasks: {
    [REFRAIN]: pulseRefrain,
    [ECHO](runtime, activationId) {
      consumeEcho(runtime, activationId as string);
    }
  }
};
