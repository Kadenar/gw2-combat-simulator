/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { notifyToolbeltActivation } from '#gw2/professions/engineer/core/mechanics/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines Core toolbelt skill definitions and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<EngineerSkill>>> = {
  [ID.MINE_FIELD]: {
    name: 'Mine Field',
    icon: 'https://render.guildwars2.com/file/6AB7A3B167C393C8C19AE5F2ABEF79473234B6C2/103412.png',
    type: 'Profession',
    slot: 'Action',

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
    name: 'Detonate Mine Field',
    icon: 'https://render.guildwars2.com/file/D97BF56EBB6D074BFEFC11E103D6D1F2360C6A17/102902.png',
    type: 'Profession',
    slot: 'Action',

    rotationInputExcluded: true,
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
    name: 'Regenerating Mist',
    icon: 'https://render.guildwars2.com/file/D7F356D2A7C6B42FF295CDA6765B0B45F508541A/103463.png',
    type: 'Profession',
    slot: 'Profession_1',

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
    name: 'Static Shock',
    icon: 'https://render.guildwars2.com/file/C79E3806E41C32ABA80D6BCC274123F10BCF1AD7/699526.png',
    type: 'Profession',
    slot: 'Profession_1',

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
    name: 'Med Pack Drop',
    icon: 'https://render.guildwars2.com/file/51DC5A050A99BCAA72FDF51DD6402C18249FB816/1012858.png',
    type: 'Profession',
    slot: 'Profession_5',

    cooldown: 50,
    toolbeltParentId: ID.SUPPLY_CRATE,
    mechanicSlot: 5,
    castTimeMs: 360,
    effects: []
  }
};

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
