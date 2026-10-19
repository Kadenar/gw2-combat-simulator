import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { scourgeShadeManifested } from '#gw2/professions/necromancer/specializations/scourge/mechanics/trigger-points.js';
import { shadeDhuumfireParameters } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-projection.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { purgeScourgeTimedState, scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { sandSavantShadeProfile } from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const EXPIRE = 'scourge.shade-expiry';

const MANIFEST = 'scourge.manifest-impact';

/** Shade replacements cancel the old expiry wake; only the next surviving shade deadline remains queued. */
function refreshShadeExpiry(runtime: NecromancerRuntime): void {
  const state = scourgeState.from(runtime);
  runtime.cancelOwner({ id: EXPIRE, generation: state.shadeGeneration });
  state.shadeGeneration++;

  if (state.shades.length)
    runtime.schedule(EXPIRE, Math.min(...state.shades), null, { id: EXPIRE, generation: state.shadeGeneration }, -20);
}

/** Every shade command owns one common strike and Torment application, independent of the number of active shades. */
function shadeStrike(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.shade);
  // Desert Shroud's shared shade hit lands with its first pulse, so hit-triggered traits wait for impact.
  const impactDelayMs =
    cast.skill.id === ID.DESERT_SHROUD
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.desertShroud), 'impactDelayMs')
      : 0;
  const attribution = {
    at: canonicalTime(runtime.time + impactDelayMs / 1000),
    source: 'necromancer',
    sourceId: ID.MANIFEST_SAND_SHADE,
    actorType: ACTOR.PLAYER,
    skillId: cast.skill.id,
    skillName: cast.skill.id === ID.NEFARIOUS_FAVOR ? 'Manifest Sand Shade' : 'Manifest Sand Shade (F1/F5)',
    parentSkillName: cast.skill.name
  };
  const strike = requireEffect(profile, 'strike', 'Strike');

  if (strike) {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionCast: RuntimeCast<NecromancerSkill> = cast;
    const emissionEvent: SimulationEventBase = buildResolverStrike({
      ...attribution,
      name: 'Sand Shade - Strike',
      skillWeapon: 'Unequipped',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      metadata: {
        necromancerShroudSkillOne: true,
        ...shadeDhuumfireParameters(profile)
      }
    });

    emissionRuntime.effects.emit({
      kind: 'packet',
      event: {
        ...emissionEvent,
        activationId: emissionCast.id,
        offTarget: emissionCast.command.offTarget,
        at: canonicalTime(
          emissionEvent.at +
            (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
        )
      }
    });
  }

  const torment = requireEffect(profile, 'condition', CONDITION.TORMENT);

  if (torment) {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionCast: RuntimeCast<NecromancerSkill> = cast;
    const emissionEvent: SimulationEventBase = buildResolverCondition({
      ...attribution,
      condition: String(torment.condition),
      stacks: effectNumber(profile, torment, 'stacks'),
      duration: effectNumber(profile, torment, 'duration')
    });

    emissionRuntime.effects.emit({
      kind: 'packet',
      event: {
        ...emissionEvent,
        activationId: emissionCast.id,
        offTarget: emissionCast.command.offTarget,
        at: canonicalTime(
          emissionEvent.at +
            (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
        )
      }
    });
  }
}

/** Manifest refreshes the capped shade lifetime before its queued impact. */
function manifestShade(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const profile = sandSavantShadeProfile(runtime);
  const lifetime = requireEffect(profile, 'buff', 'active-shade');

  if (lifetime) {
    const state = scourgeState.from(runtime);
    state.shades = grantTimedStacks(state.shades, {
      at: runtime.time,
      expiresAt: canonicalTime(runtime.time + effectNumber(profile, lifetime, 'duration')),
      count: 1,
      maximumStacks: balanceProfileNumber(profile, 'maximumStacks'),
      retain: 'latest-expiry'
    }).reverse();
    refreshShadeExpiry(runtime);
  }

  runtime.fireTrigger(scourgeShadeManifested, { cast, at: runtime.time, activationId: cast.id });
}

/** Shade commands share manifestation, lifetime replacement, and their common strike. */
const scourgeShadeActions = {
  'scourge.manifest-start'(runtime, context) {
    if (context.kind === 'cast' && !context.cast.cancelled)
      runtime.scheduleForCast(
        MANIFEST,
        canonicalTime(context.cast.start + ((context.cast.fullEnd - context.cast.start) * 11) / 12),
        context.cast
      );
  },
  'scourge.manifest'(runtime, context) {
    if (context.kind === 'cast') manifestShade(runtime, context.cast);
  },
  'scourge.strike'(runtime, context) {
    if (context.kind === 'cast') shadeStrike(runtime, context.cast);
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']>;

/** Shade expiry and queued manifestation settle through the same lifetime and strike owners. */
const scourgeShadeTasks = {
  [EXPIRE](runtime) {
    purgeScourgeTimedState(scourgeState.from(runtime), runtime.time);
    refreshShadeExpiry(runtime);
  },
  [MANIFEST](runtime, data) {
    shadeStrike(runtime, (data as { cast: RuntimeCast<NecromancerSkill> }).cast);
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Shade commands, expiry, and queued manifestation share one owner. */
export const scourgeShadeLifecycle = {
  sideEffectHandlers: scourgeShadeActions,
  tasks: scourgeShadeTasks
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
