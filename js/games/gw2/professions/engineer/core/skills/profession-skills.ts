import { BOON } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { notifyToolbeltActivation } from '#gw2/professions/engineer/core/mechanics/toolbelt.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';
/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Core toolbelt skill fragments and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MINE_FIELD]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.mine-field' } }],
    // Mine Field defers precast packets to the combat-start handler below, retaining detonation trait ordering.

    castTimeMs: 920,
    cooldown: 17,
    effects: [
      {
        // Precast mines are released by their combat-start owner; ordinary casts use these packets.
        when: (runtime) => !runtime.engagement.boundaryPending,
        type: 'strike',
        coefficient: 3.85,
        hits: 5,
        atMs: 0,
        name: 'Damage per Mine',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        when: (runtime) => !runtime.engagement.boundaryPending,
        type: 'condition',
        ticks: [
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2.5 },
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2.5 },
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2.5 },
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2.5 },
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    toolbeltParentId: ID.THROW_MINE
  },
  [ID.DETONATE_MINE_FIELD]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: 'player',
        damageKind: 'explosion',
        skillName: 'Mine Field'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
      }
    ],
    toolbeltParentId: ID.THROW_MINE
  },
  [ID.REGENERATING_MIST]: {
    castTimeMs: 300,
    cooldown: 18,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Water',
        duration: 1,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 2
      }
    ],
    toolbeltParentId: ID.HEALING_TURRET,
    mechanicSlot: 1
  },

  [ID.STATIC_SHOCK]: {
    castTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Static Shock',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]),
    toolbeltParentId: ID.A_E_D,
    mechanicSlot: 1
  },
  [ID.MED_PACK_DROP]: {
    castTimeMs: 360,
    cooldown: 50,
    effects: [],
    toolbeltParentId: ID.SUPPLY_CRATE,
    mechanicSlot: 5
  }
});

/** Precast mines retain activation ownership until the actual combat boundary permits detonation. */
function detonatePrecastMines(runtime: EngineerRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.MINE_FIELD)!;
  const detonation = runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!;
  for (const activationId of runtime.profession.core.pendingMineFieldActivationIds.splice(0)) {
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      attribution: {
        source: 'engineer',
        sourceId: skill.id,
        actorType: 'player',
        activationId,
        skillId: skill.id,
        skillName: skill.name
      }
    });
    notifyToolbeltActivation(runtime, detonation, activationId);
  }
}

/** Mine Field captures pending activation identities; ordinary casts notify detonation traits immediately. */
const mineFieldActions: NonNullable<RuntimeHooks<EngineerRuntimeState, EngineerSkill>['sideEffectHandlers']> = {
  'engineer.mine-field'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Mine Field requires a cast trigger.');

    if (runtime.engagement.boundaryPending) runtime.profession.core.pendingMineFieldActivationIds.push(context.cast.id);
    else notifyToolbeltActivation(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!, context.cast.id);
  }
};

/** Mine Field activations register here and detonate once at combat entry. */
export const mineFieldLifecycle = {
  sideEffectHandlers: mineFieldActions,
  onCombatStart: detonatePrecastMines
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
