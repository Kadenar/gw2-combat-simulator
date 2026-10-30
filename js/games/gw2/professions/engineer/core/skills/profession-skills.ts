/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { notifyToolbeltActivation } from '#gw2/professions/engineer/core/mechanics/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines Core toolbelt skill fragments and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MINE_FIELD]: {
    cooldown: 17,
    toolbeltParentId: ID.THROW_MINE,
    // Mine Field defers precast packets to the combat-start handler below, retaining detonation trait ordering.

    castTimeMs: 920,
    effects: [
      {
        // Precast mines are released by their combat-start owner; ordinary casts use these packets.
        when: (runtime) => !runtime.engagement.boundaryPending,
        type: 'strike',
        coefficient: 3.85,
        hits: 5,
        atMs: 0,
        name: 'Damage per Mine',
        actorType: ACTOR.PLAYER,
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
        actorType: ACTOR.PLAYER
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.mine-field' } }]
  },
  [ID.DETONATE_MINE_FIELD]: {
    cooldown: 0,
    toolbeltParentId: ID.THROW_MINE,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        skillName: 'Mine Field'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2.5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.REGENERATING_MIST]: {
    cooldown: 18,
    toolbeltParentId: ID.HEALING_TURRET,
    mechanicSlot: 1,
    castTimeMs: 400,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 1,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 2
      }
    ]
  },

  [ID.STATIC_SHOCK]: {
    cooldown: 20,
    toolbeltParentId: ID.A_E_D,
    mechanicSlot: 1,
    castTimeMs: 680,
    interruptCommitMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Static Shock',
        weapon: 'Profession mechanic',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.MED_PACK_DROP]: {
    cooldown: 50,
    toolbeltParentId: ID.SUPPLY_CRATE,
    mechanicSlot: 5,
    castTimeMs: 360,
    effects: []
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
        actorType: ACTOR.PLAYER,
        activationId,
        skillId: skill.id,
        skillName: skill.name
      }
    });
    notifyToolbeltActivation(runtime, detonation);
  }
}

/** Mine Field captures pending activation identities; ordinary casts notify detonation traits immediately. */
const mineFieldActions: NonNullable<RuntimeHooks<EngineerRuntimeState, EngineerSkill>['sideEffectHandlers']> = {
  'engineer.mine-field'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Mine Field requires a cast trigger.');

    if (runtime.engagement.boundaryPending) runtime.profession.core.pendingMineFieldActivationIds.push(context.cast.id);
    else notifyToolbeltActivation(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!);
  }
};

/** Mine Field activations register here and detonate once at combat entry. */
export const mineFieldLifecycle = {
  sideEffectHandlers: mineFieldActions,
  onCombatStart: detonatePrecastMines
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
