import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.OPPRESSIVE_COLLAPSE]: {
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.oppressive-collapse' }
          }
        ],
        coefficient: 1.2
      },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 9 },
      { type: 'control', controlKind: 'control' }
    ])
  },
  [ID.HARROWING_WAVE]: {
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 5 } })
          }
        ],
        coefficient: 0.8
      },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 8 },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 6 }
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
    actorType: 'player' as const,
    skillId: ID.OPPRESSIVE_COLLAPSE,
    skillName: event.skillName,
    activationId: event.activationId,
    kind: 'might',
    stacks,
    duration: 8,
    audience: {
      recipients: 'party' as const,
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
