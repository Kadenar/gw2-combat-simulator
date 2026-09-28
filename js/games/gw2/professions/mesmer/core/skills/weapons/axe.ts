import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// The axe chain uses reviewed 440/520/720 ms activations to keep its completion packets aligned.
export const MESMER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
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
  [ID.AXES_OF_SYMMETRY]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.axes-clones' } }],
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    // Both weapon variants are shadowsteps and use the same movement-relic projectile timing.
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        atMs: 920,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5,
        atMs: -80
      }
    ],
    castTimeMs: 1000
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
  [ID.LINGERING_THOUGHTS]: {
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
      count: 1,
      timingAnchor: 'castEnd',
      atMs: 160
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
        condition: 'Torment',
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
    castTimeMs: 920
  },
  // Virtuoso and Troubadour Axe variants retain separate IDs so their conditions and finishers resolve independently.
  [ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS]: {
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
  [ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY]: {
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
export function scheduleAxesClones(state: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as MesmerSkill;
  const at = cast.fullEnd,
    castStart = cast.start;
  const { addDamage, addCondition } = mesmerMechanicsFor(state);
  withMesmerCastEmission(state, cast, skill, () => {
    const axeClones = professionCoreState(state).clones.filter(
      (clone) => clone.weapon === 'Axe' && clone.createdAt <= castStart + EPSILON
    );
    for (const clone of axeClones) {
      const impactAt = at - 0.04;
      addDamage(
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
      );
      addCondition(
        skill.name,
        impactAt,
        { name: 'Confusion', duration: 6, stacks: 1 },
        'Clone',
        `${skill.name} — Clone`,
        { metadata: { cloneId: clone.id }, skillId: skill.id, actorType: 'summon', summonKind: 'clone' }
      );
    }
  });
}

/** The alternate intentionally selects surviving pre-cast clones at commitment, including same-time creation. */
export function completeAxesConfusion(state: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as MesmerSkill;
  const at = state.time,
    castStart = cast.start;
  const { addCondition } = mesmerMechanicsFor(state);
  withMesmerCastEmission(state, cast, skill, () => {
    // The non-Mirage variant adds one Confusion stack per cast-start clone; its declarative packet covers the player.
    const clones = professionCoreState(state).clones.filter((clone) => clone.createdAt <= castStart + EPSILON);
    if (clones.length) {
      addCondition(skill.name, at, { name: 'Confusion', duration: 6, stacks: clones.length }, 'Player', skill.name, {
        skillId: skill.id
      });
    }
  });
}
