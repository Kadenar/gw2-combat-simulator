import {
  buildMesmerStrikes,
  mesmerPacketOwner,
  buildMesmerConditions
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// The axe chain uses reviewed 440/520/720 ms activations to keep its completion packets aligned.
export const MESMER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.MIRROR_STRIKES]: {
    castTimeMs: 720,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 6,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.LACERATING_CHOP]: {
    nextChainId: ID.ETHEREAL_CHOP,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 2,
        stacks: 1
      }
    ],
    castTimeMs: 440
  },
  [ID.ETHEREAL_CHOP]: {
    castTimeMs: 520,
    nextChainId: ID.MIRROR_STRIKES,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 2,
        stacks: 1
      }
    ]
  },
  // Shared Axe skills apply outside Mirage; Mirage owns its replacement declarations.
  [ID.LINGERING_THOUGHTS_NON_MIRAGE]: {
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Whirl',
        applications: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 1,
        stacks: 3
      }
    ],
    // The shared replacement keeps the same measured Axe cast timing as Mirage.
    castTimeMs: 920
  },
  [ID.AXES_OF_SYMMETRY_NON_MIRAGE]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.axes-confusion' } }],
    // The shared weapon variant retains the same shadowstep and relic response timing.
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 1
      }
    ],
    castTimeMs: 1000
  }
});

/** Snapshot ordinary Axe clones at acceptance; their own lifetime still cancels pending packets. */
export function scheduleAxesClones(state: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  const at = cast.fullEnd,
    castStart = cast.start;

  {
    const delivery = mesmerCastDelivery(cast, skill);
    const axeClones = professionCoreState(state).clones.filter(
      (clone) => clone.weapon === 'Axe' && clone.createdAt <= castStart + EPSILON
    );
    for (const clone of axeClones) {
      const impactAt = at - 0.04;
      buildMesmerStrikes(
        state,
        {
          id: ID.AXES_OF_SYMMETRY,
          name: `${skill.name} — Clone`,
          weapon: 'Axe',
          blade: false
        },
        impactAt,
        {
          coefficient: 1.75,
          hits: 1,
          source: 'Clone',
          weaponStrength: MESMER_CORE_CLONE_ATTACKS.Axe.weaponStrength
        },
        {
          metadata: { cloneId: clone.id },
          source: 'Clone',
          actorType: 'summon',
          summonKind: 'clone',
          name: `${skill.name} — Clone`
        }
      ).forEach((packet) => {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
      buildMesmerConditions(
        state,
        skill.name,
        impactAt,
        { name: 'Confusion', duration: 6, stacks: 1 },
        'Clone',
        `${skill.name} — Clone`,
        { metadata: { cloneId: clone.id }, skillId: skill.id, actorType: 'summon', summonKind: 'clone' }
      ).forEach((packet) => {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    }
  }
}

/** The alternate intentionally selects surviving pre-cast clones at commitment, including same-time creation. */
export function completeAxesConfusion(state: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  const at = state.time,
    castStart = cast.start;

  {
    const delivery = mesmerCastDelivery(cast, skill);
    // The non-Mirage variant adds one Confusion stack per cast-start clone; its declarative packet covers the player.
    const clones = professionCoreState(state).clones.filter((clone) => clone.createdAt <= castStart + EPSILON);
    if (clones.length) {
      buildMesmerConditions(
        state,
        skill.name,
        at,
        { name: 'Confusion', duration: 6, stacks: clones.length },
        'Player',
        skill.name,
        {
          skillId: skill.id
        }
      ).forEach((packet) => {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    }
  }
}
