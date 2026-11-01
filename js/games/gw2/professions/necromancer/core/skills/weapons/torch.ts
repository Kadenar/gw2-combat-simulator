/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

export const NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.HARROWING_WAVE]: {
    name: 'Harrowing Wave',
    description:
      'Unleash a wave of corrupted fire, burning and tormenting enemies. Gain life force for each enemy struck.',
    icon: 'https://render.guildwars2.com/file/A2ADDF0F080938253AE452B043A71161EE045410/1770540.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_4',
    cooldown: 16,
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 5 } })
          }
        ],
        coefficient: 0.8
      },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 2, duration: 6 }
    ])
  },
  [ID.OPPRESSIVE_COLLAPSE]: {
    name: 'Oppressive Collapse',
    description:
      'Corrupt the ground under your target; if they remain within the area, they will be knocked down. Grant might to allies near your target based on how many conditions they have.',
    icon: 'https://render.guildwars2.com/file/BE78672ACBDE107931DAAE08B6F001E010FF3F2B/1770541.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.oppressive-collapse' }
          }
        ],
        coefficient: 1.2
      },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 2, duration: 9 },
      { type: 'control', controlKind: CONTROL.KNOCKDOWN }
    ])
  }
});

/** Party Might samples live conditions and companion eligibility at the accepted impact. */
function resolveOppressiveCollapse(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  const stacks = 2 * Math.min(7, runtime.combat.targetConditionCount(runtime.time));

  if (!stacks) return;

  const boon = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'necromancer',
    sourceId: ID.OPPRESSIVE_COLLAPSE,
    actorType: ACTOR.PLAYER,
    skillId: ID.OPPRESSIVE_COLLAPSE,
    skillName: event.skillName,
    activationId: event.activationId,
    kind: boonKey(BOON.MIGHT),
    stacks,
    duration: 8,
    audience: {
      recipients: RECIPIENT.PARTY,
      maximumRecipients: 5,
      eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime)
    }
  };
  runtime.effects.emit({ kind: 'packet', event: boon, durationContext: event });
}

/** The torch's accepted-impact declaration selects the one application that grants party Might. */
export const torchLifecycle = {
  sideEffectHandlers: {
    'necromancer.oppressive-collapse'(runtime, context) {
      if (context.kind === 'effect') resolveOppressiveCollapse(runtime, context.trigger.event);
    }
  }
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
