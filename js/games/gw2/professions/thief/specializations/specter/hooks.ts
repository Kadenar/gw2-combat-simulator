import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { EPSILON } from '#kernel/core/clock.js';
import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { gw2CooldownReadyAt, castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { emitThiefBuff, emitThiefCondition } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal, emitThiefStealTraits } from '#gw2/professions/thief/core/mechanics/steal.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const SHADOW_DEPLETED = 'thief.shadow-shroud-depleted';
const DARK_SENTRY = 'thief.specter-dark-sentry';
const ROT_WALLOW_VENOM_ICON = 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

/**
 * Every gain or rate change replaces the prior depletion wake; shroud exhaustion is detected on the same tick grid as
 * cooldowns so fractional drain is kept.
 */
function refreshShadowDepletion(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  runtime.cancelOwner({ id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration });
  state.shadowWakeGeneration++;
  const at = gw2CooldownReadyAt(resourceDepletionAt(state.shadowClock));
  if (Number.isFinite(at))
    runtime.schedule(SHADOW_DEPLETED, at, null, { id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration }, -10);
}

/** Specter supplies drain and capacity; the shared lifecycle advances and replaces the depletion deadline. */
const shadowForce: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => specterState.from(runtime).shadowClock,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: (runtime) => (runtime.config as ThiefConfig).initialShadowForce ?? 0,
  recovery: (runtime) => {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    return specterState.from(runtime).shadowShroudActive
      ? -balanceProfileNumber(profile, 'maximumStacks') * balanceProfileNumber(profile, 'lifeForceDrain')
      : 0;
  },
  depletion: { refresh: refreshShadowDepletion, stop: refreshShadowDepletion }
};

/** Shroud transitions block input for their recovery and publish the bar change like a weapon swap. */
function setShadowShroud(runtime: ThiefRuntime, active: boolean, skill: { id: string | number; name: string }): void {
  lockTransitionInput(runtime, active ? 'shroudEntryMs' : 'shroudExitMs', skill);
  specterState.from(runtime).shadowShroudActive = active;
  runtime.resourceController.refresh('shadowForce');
  runtime.emit({
    type: 'weapon_set',
    at: runtime.time,
    source: 'thief',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: runtime.activeWeaponSet,
    shroudSwap: true
  });
}

/** The surviving depletion wake forces the shroud closed with the exit transition's input lockout. */
function shadowDepleted(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  if (!state.shadowShroudActive) return;
  setShadowShroud(runtime, false, { id: SHADOW_DEPLETED, name: 'Exit Shadow Shroud' });
}

/** Barrier on allies arms Dark Sentry's per-ally venom and its queued allied Torment. */
function darkSentry(runtime: ThiefRuntime, data: unknown): void {
  const party = gw2AlliedPlayerAssumptions(runtime.config);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.darkSentry);
  const venom = requireEffect(profile, 'buff', 'rot-wallow-venom');
  if (!venom) return;
  // Claim only validated, distinct allies after confirming that venom can be granted.
  const allies = [
    ...new Set(
      ((data as { allyIndices?: readonly number[] }).allyIndices ?? [])
        .map(Number)
        .filter((ally) => Number.isInteger(ally) && ally >= 1 && ally <= party.count)
    )
  ].filter((ally) => runtime.procs.claim(PROFILE.darkSentry, `thief.specter.darkSentry:${ally}`, runtime.time));
  if (!allies.length) return;
  const torment = requireEffect(profile, 'condition', 'Torment');
  const venomDuration = effectNumber(profile, venom, 'duration');
  emitThiefBuff(runtime, null, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.DARK_SENTRY,
    skillId: TRAIT.DARK_SENTRY,
    skillName: 'Dark Sentry',
    name: 'Rot Wallow Venom',
    icon: ROT_WALLOW_VENOM_ICON,
    kind: 'rot-wallow-venom',
    duration: venomDuration,
    stacks: effectNumber(profile, venom, 'stacks'),
    audience: { recipients: 'party', affectsSelf: false, maximumRecipients: allies.length },
    fixedDuration: true
  });
  if (!torment) return;
  // The next allied strike must fit the grant, including the shared allied expiry boundary.
  for (const proc of gw2AlliedPlayerProcTimeline(runtime.config, {
    start: runtime.time,
    duration: venomDuration,
    maximumPerAlly: 1
  }))
    if (allies.includes(proc.allyIndex))
      emitThiefCondition(runtime, null, {
        at: proc.at,
        source: 'Trait',
        skillId: TRAIT.DARK_SENTRY,
        skillName: 'Rot Wallow Venom',
        name: `Rot Wallow Venom - Ally ${proc.allyIndex} Torment`,
        icon: ROT_WALLOW_VENOM_ICON,
        condition: String(torment.condition),
        stacks: effectNumber(profile, torment, 'stacks'),
        duration: effectNumber(profile, torment, 'duration'),
        metadata: { triggeredByAlly: proc.allyIndex }
      });
}

/** Dawn's Repose includes the caster; only allied recipients can trigger Dark Sentry. */
function grantBarrier(runtime: ThiefRuntime, cast: RuntimeCast, profileId: string | number, name: string): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const barrier = requireEffect(profile, 'buff', 'barrier');
  const affectsSelf = cast.skill.id === ID.DAWNS_REPOSE;
  const recipients = Math.min(
    balanceProfileNumber(profile, 'maximumTargets'),
    gw2AlliedPlayerAssumptions(runtime.config).count + Number(affectsSelf)
  );
  // Barrier removal also suppresses the barrier-triggered Dark Sentry reaction.
  if (!barrier || recipients <= 0) return;
  emitThiefBuff(runtime, null, {
    at: runtime.time,
    source: 'thief',
    sourceId: cast.skill.id,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name,
    kind: 'barrier',
    duration: effectNumber(profile, barrier, 'duration'),
    stacks: effectNumber(profile, barrier, 'stacks'),
    audience: { recipients: 'party', affectsSelf, maximumRecipients: recipients },
    fixedDuration: true
  });
  runtime.schedule(DARK_SENTRY, runtime.time, {
    allyIndices: Array.from({ length: recipients - Number(affectsSelf) }, (_, index) => index + 1)
  });
}

/** Siphon grants Shadow Force (Amplified Siphoning, then Improvisation) and completes as a choice-less steal. */
function completeSiphon(runtime: ThiefRuntime, cast: RuntimeCast): void {
  emitThiefStealTraits(runtime, cast);
  let gain =
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceGain') +
    (hasTrait(runtime, TRAIT.AMPLIFIED_SIPHONING)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.amplifiedSiphoning), 'resourceGain')
      : 0);
  if (hasTrait(runtime, TRAIT.IMPROVISATION))
    gain *=
      1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, CORE_PROFILE.improvisation), 'lifeForceGain');
  runtime.resourceController.grant('shadowForce', gain);
  completeThiefSteal(runtime, []);
}

/** Shroud entry needs force; inside the shroud only its own bar is castable, and exit waits out its lockout. */
function specterAvailability(runtime: ThiefRuntime, rawSkill: Skill): AvailabilityResult {
  const skill = rawSkill as ThiefSkill;
  const state = specterState.from(runtime);
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    if (state.shadowShroudActive) return denySkillCast(skill, 'thief.in-shroud', 'Shadow Shroud is already active.');
    if (runtime.resourceController.value('shadowForce') <= 0)
      return denySkillCast(skill, 'thief.shadow-force', 'requires shadow force.');
  }

  if (skill.id === ID.EXIT_SHADOW_SHROUD && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'Shadow Shroud is not active.');
  if (skill.id === ID.EXIT_SHADOW_SHROUD && state.shadowShroudExitReadyAt > runtime.time + EPSILON)
    return denySkillCast(
      skill,
      'thief.shroud-exit-lockout',
      'Shadow Shroud exit is not ready.',
      state.shadowShroudExitReadyAt
    );
  if (skill.shadowShroudSkill && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'enter Shadow Shroud first.');
  if (
    state.shadowShroudActive &&
    !skill.shadowShroudSkill &&
    (skill.type === 'Weapon' || ['Heal', 'Utility', 'Elite'].includes(skill.type || ''))
  )
    return denySkillCast(skill, 'thief.in-shroud', 'the Shadow Shroud bar replaces weapons and slot skills.');
  return { ready: true };
}

/**
 * Each applied player Torment grants Shadow Force outside the shroud and one life siphon per stack, whether or not
 * the shroud is active.
 */
function larcenousTorment(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  if (
    application.condition !== 'Torment' ||
    application.actorType !== 'player' ||
    !hasTrait(runtime, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  const stacks = Math.max(0, Math.trunc(application.stacks || 0));
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.larcenousTorment);
  const strike = requireEffect(profile, 'strike', 'Larcenous Torment');
  if (strike)
    for (let stack = 1; stack <= stacks; stack += 1)
      runtime.emitDerived(
        application,
        buildResolverStrike({
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.LARCENOUS_TORMENT,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.LARCENOUS_TORMENT,
          skillName: 'Larcenous Torment',
          name: 'Larcenous Torment - Life Siphon',
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
          canCrit: false,
          damageKind: 'life-steal',
          triggeredBy: application.skillName
        })
      );
  if (!specterState.from(runtime).shadowShroudActive && stacks > 0)
    runtime.resourceController.grant('shadowForce', stacks * balanceProfileNumber(profile, 'resourceGain'));
}

/** Specter hooks: Shadow Force and its shroud, Siphon, shroud skill traits, Dark Sentry, and Larcenous Torment. */
export const specterHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  sideEffectHandlers: {
    'thief.dawn-shade-step'(runtime, context) {
      if (context.kind !== 'cast' || !hasTrait(runtime, TRAIT.SHADESTEP)) return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.shadeStep);
      emitEffects(runtime, {
        owner: profile,
        effects: profile.effects?.filter((effect) => effect.type === 'boon' && effect.name === 'protection'),
        baseEvent: {
          source: 'Trait',
          sourceId: PROFILE.shadeStep,
          actorType: 'player',
          skillId: context.skill.id,
          skillName: context.skill.name,
          activationId: context.cast.id
        },
        transform: (event) => ({ ...event, name: 'Shade Step - protection', audience: { recipients: 'party' } })
      });
    },
    'thief.siphon'(runtime, context) {
      if (context.kind === 'cast') completeSiphon(runtime, context.cast);
    },
    'thief.enter-shadow-shroud'(runtime, context) {
      specterState.from(runtime).shadowShroudExitReadyAt = runtime.time + 0.5;
      setShadowShroud(runtime, true, context.skill);
    },
    'thief.exit-shadow-shroud'(runtime, context) {
      setShadowShroud(runtime, false, context.skill);
    },
    'thief.shroud-entry-barrier'(runtime, context) {
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.enterShadowShroud, 'Enter Shadow Shroud - Barrier');
    },
    'thief.dawns-barrier'(runtime, context) {
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.dawnsReposeBarrier, "Dawn's Repose - Barrier");
    }
  },
  // These shroud skills grant their own party boon; Dawn's declaration notifies Shade Step before its barrier.
  traitTriggers: (
    [
      [ID.GRASPING_SHADOWS, 'alacrity'],
      [ID.MIND_SHOCK, 'aegis']
    ] as const
  ).map<TraitTrigger<ThiefRuntimeState>>(([skillId, boon]) => ({
    trait: TRAIT.SHADESTEP,
    emit: PROFILE.shadeStep,
    on: 'castCommit',
    when: (_runtime, cast) =>
      cast.skill.id === skillId && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
    effects: (effect) => effect.type === 'boon' && effect.name === boon,
    attribution: { actorType: 'player', name: `Shade Step - ${boon}`, audience: { recipients: 'party' } }
  })),
  resources: { shadowForce },
  availability: specterAvailability,
  onCastStart(runtime, cast) {
    // Spent initiative converts into Shadow Force in parallel with Core's spend.
    const cost = (cast.skill as ThiefSkill).initiativeCost || 0;
    if (cost > 0)
      runtime.resourceController.grant(
        'shadowForce',
        cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceGain')
      );
  },
  onCooldownReset(runtime) {
    // The training-area reset refills Shadow Force without forcing Specter out of Shadow Shroud.
    runtime.resourceController.grant('shadowForce', specterState.from(runtime).shadowClock.maximum);
  },
  reactions: { 'condition.applied': larcenousTorment },
  tasks: {
    [SHADOW_DEPLETED]: shadowDepleted,
    [DARK_SENTRY]: darkSentry
  }
};
