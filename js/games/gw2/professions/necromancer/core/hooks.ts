import { ACTOR } from '#gw2/platform/constants.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { anchorResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { necromancerBuffPolicies, necromancerEffectStates } from '#gw2/professions/necromancer/core/effect-state.js';
import { necromancerAvailability } from '#gw2/professions/necromancer/core/mechanics/availability.js';
import { reactToNecromancerAxeHealth } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import {
  necromancerConditionApplied,
  necromancerControlAccepted,
  necromancerStrike,
  necromancerStrikeLifeForce,
  necromancerStrikePreparing
} from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import {
  completeNecromancerCorruption,
  necromancerConditionLifecycle,
  resolveNecromancerSkillConditions,
  resolveNecromancerTransfer,
  resolvePlagueSignetTransfer,
  scheduleBloodIsPowerLaunch,
  scheduleDevouringDarkness
} from '#gw2/professions/necromancer/core/mechanics/condition-management.js';
import {
  enterLich,
  enterNecromancerShroud,
  exitLich,
  exitNecromancerShroud,
  necromancerFormLifecycle
} from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  commandNecromancerMinion,
  necromancerMinionLifecycle,
  summonNecromancerHorrors,
  summonNecromancerMinion
} from '#gw2/professions/necromancer/core/mechanics/minions.js';
import {
  initializeNecromancerPassives,
  necromancerPassiveLifecycle
} from '#gw2/professions/necromancer/core/mechanics/passives.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import {
  emitSoulShard,
  grantNecromancerSoulShards,
  perforate,
  soulShardLifecycle
} from '#gw2/professions/necromancer/core/mechanics/soul-shards.js';
import { necromancerSwordLifecycle } from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { emitVampirismPassive } from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { torchLifecycle } from '#gw2/professions/necromancer/core/skills/weapons/torch.js';
import { necromancerLifeForceCapacity } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as DAMAGE_SKILL } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Landed player packets own weapon gains and the post-hit half-health test; no predicted observation is replayed. */
function damage(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;

  const skill = skillForEvent(runtime.helpers, event);

  if (!skill) return;

  if (event.actorType !== ACTOR.PLAYER) return;

  // Combine trait rewards before the shared conversion and pool refresh, ahead of condition transfers.
  const reward = { skill, event, percent: 0 };
  runtime.fireTrigger(necromancerStrikeLifeForce, reward);
  grantNecromancerLifeForce(runtime, reward.percent);
}

const coreLifecycle: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'vampirism-passive',
      name: 'Signet of Vampirism (passive)',
      source: 'Profession',
      unit: 'pulse',
      sourceIds: [DAMAGE_SKILL.SIGNET_OF_VAMPIRISM],
      emit: (runtime) => emitVampirismPassive(runtime)
    },
    {
      id: 'soul-shards',
      name: 'Soul Shards',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.SOUL_SHARDS],
      emit: (runtime) => emitSoulShard(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    if (skill?.shroud) runtime.profession.core.activeShroud = skill.shroud;

    // Held Carapace affects both Power and Condition Damage without generating minion or kill events.
    runtime.profession.core.carapaceExpiries = Array(Number(inputs.carapace ?? 0)).fill(Infinity);
  },

  buffPolicies: necromancerBuffPolicies,
  observeEffects: necromancerEffectStates,
  resources: { lifeForce: necromancerLifeForce },
  // Standard endurance recovery applies equally inside and outside shroud.
  endurance: {
    state: (runtime) => runtime.profession.core.endurance,
    maximum: () => 100,
    regenerationRate: (_runtime, vigor) => 5 * (vigor ? 1.5 : 1)
  },
  sideEffectHandlers: {
    'necromancer.corruption'(runtime, context) {
      if (context.kind === 'cast') completeNecromancerCorruption(runtime, context.cast);
    },
    'necromancer.blood-is-power-launch'(runtime, context) {
      if (context.kind === 'cast') scheduleBloodIsPowerLaunch(runtime, context.cast);
    },
    'necromancer.signet-transfer'(runtime, context) {
      if (context.kind === 'cast') resolvePlagueSignetTransfer(runtime, context.cast);
    },
    'necromancer.devouring-impact'(runtime, context) {
      if (context.kind === 'cast') scheduleDevouringDarkness(runtime, context.cast);
    },
    'necromancer.enter-shroud'(runtime, context) {
      if (context.kind === 'cast') enterNecromancerShroud(runtime, context.cast);
    },
    'necromancer.summon-minion'(runtime, context) {
      if (context.kind === 'cast') summonNecromancerMinion(runtime, context.cast);
    },
    'necromancer.command-minion'(runtime, context) {
      if (context.kind === 'cast') commandNecromancerMinion(runtime, context.cast);
    },
    'necromancer.summon-horrors'(runtime, context) {
      if (context.kind === 'cast') summonNecromancerHorrors(runtime, context.cast);
    },
    'necromancer.enter-lich'(runtime) {
      enterLich(runtime);
    },
    'necromancer.exit-lich'(runtime) {
      exitLich(runtime);
    },
    'necromancer.exit-shroud'(runtime) {
      exitNecromancerShroud(runtime);
    },
    // Weapon definitions select their window; its deadline stays anchored to the accepted recharge boundary.
    'necromancer.weapon-flip'(runtime, context) {
      if (context.kind !== 'cast') return;

      const { cast, skill } = context;
      runtime.armFlip(skill.flipSkillId!, {
        expiresAt: cast.rechargeStart + Math.max(1, skill.flipDuration ?? skill.cooldown ?? 5)
      });
    },
    'necromancer.axe-health'(runtime, context) {
      if (context.kind === 'effect') reactToNecromancerAxeHealth(runtime, context.trigger.event);
    },
    'necromancer.life-siphon'(runtime, context) {
      if (context.kind === 'effect')
        resolveNecromancerSkillConditions(runtime, context.trigger.event, PROFILE.lifeSiphonOnHit);
    },
    'necromancer.dark-pact'(runtime, context) {
      if (context.kind === 'effect')
        resolveNecromancerSkillConditions(runtime, context.trigger.event, PROFILE.darkPactOnHit);
    },
    'necromancer.transfer'(runtime, context) {
      if (context.kind === 'effect') resolveNecromancerTransfer(runtime, context.trigger.event);
    },
    'necromancer.perforate'(runtime, context) {
      if (context.kind === 'effect') perforate(runtime, context.trigger.event);
    },
    // Declared shard rewards reuse the hit-time grant owner so caps and refresh expiry stay identical.
    'necromancer.soul-shards'(runtime, _cast, action) {
      if (action.type !== 'necromancer.soul-shards' || action.amount == null)
        throw new TypeError('Soul shard grants require an amount.');

      grantNecromancerSoulShards(runtime, sideEffectAmount(runtime, action.amount));
    }
  },
  initialize(runtime) {
    // Apply final attribute-derived capacity while preserving the initialized fraction of the pool.
    const pool = runtime.profession.core.lifeForce;
    const fraction = pool.value / pool.maximum;
    pool.maximum = necromancerLifeForceCapacity(
      runtime.config,
      runtime,
      runtime.combat.statsAt(runtime.time, {
        type: 'action',
        at: runtime.time,
        actorType: ACTOR.PLAYER,
        source: 'Player',
        sourceId: 'resource-initialization'
      }).vitality
    );
    // Initialization replaces the complete segment, including capacity when the starting balance is zero.
    pool.value = fraction * pool.maximum;
    anchorResourceClock(pool);
    runtime.resourceController.refresh('lifeForce');
    initializeNecromancerPassives(runtime);
  },
  availability: necromancerAvailability,
  // Recharge traits select work once at acceptance; the shared controller applies permanent Alacrity.
  // Rules scale accepted work; shroud entry and minion death still own their recharge anchors.

  rechargeWork: (_runtime, skill, work) => (skill.shroudEntry || skill.rechargeOnMinionDeath ? 0 : work),

  // Cast-derived attribution remains local to the declaration; balance profiles own all packets.

  onCooldownReset(runtime) {
    runtime.resourceController.grant('lifeForce', runtime.profession.core.lifeForce.maximum);
    runtime.profession.core.selfConditions = [];
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      damage(runtime, event);
      runtime.fireTrigger(necromancerStrikePreparing, { event });
      const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
      runtime.fireTrigger(necromancerStrike, {
        event,
        details,
        firstHit: Number(event.hitIndex || 1) === 1,
        shroudSkillOne: skill?.shroudSlot === 1 || event.metadata?.necromancerShroudSkillOne === true,
        dhuumfireDuration: skill?.dhuumfireDuration
      });
    },
    'condition.applied'(runtime, event) {
      runtime.fireTrigger(necromancerConditionApplied, { event });
    },
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(necromancerControlAccepted, { event });
    }
  }
};

/** Compose the shared profession lifecycle with each mechanic and skill owner's registered work. */
export const necromancerCoreHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  coreLifecycle,
  torchLifecycle,
  necromancerSwordLifecycle,
  soulShardLifecycle,
  necromancerConditionLifecycle,
  necromancerMinionLifecycle,
  necromancerPassiveLifecycle,
  necromancerFormLifecycle
]);
