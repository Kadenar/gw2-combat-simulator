/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import {
  buildMesmerConditions,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { axeCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/axe-clone.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// The axe chain uses reviewed 440/520/720 ms activations to keep its completion packets aligned.
export const MESMER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> = {
  [ID.LACERATING_CHOP]: {
    name: 'Lacerating Chop',
    icon: 'https://render.guildwars2.com/file/72D44CE94461AD01DA5CA6B7CBCB4E625B50993A/1770500.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.ETHEREAL_CHOP]: {
    name: 'Ethereal Chop',
    icon: 'https://render.guildwars2.com/file/257AE20DBC1F5BB232D8F37FED4443065ED10346/1770501.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.MIRROR_STRIKES]: {
    name: 'Mirror Strikes',
    icon: 'https://render.guildwars2.com/file/44E70008A846C1A03343996F1F10031966E41F0D/1770502.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        duration: 6,
        stacks: 1
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 6,
        stacks: 1
      }
    ]
  },
  // Shared Axe skills apply outside Mirage; Mirage owns its replacement declarations.
  [ID.LINGERING_THOUGHTS_NON_MIRAGE]: {
    name: 'Lingering Thoughts',
    icon: 'https://render.guildwars2.com/file/A49921EC7A0C62617006BAF11F76B103C26A120C/1770503.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    ammoCastLockout: 0.25,
    cooldown: 6,
    ammo: 2,

    resource: {
      mode: 'add',
      count: 1
    },
    // The shared replacement keeps the same measured Axe cast timing as Mirage.
    castTimeMs: 920,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: COMBO_FINISHER.WHIRL,
        applications: 2
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        duration: 1,
        stacks: 3
      }
    ]
  },
  [ID.AXES_OF_SYMMETRY_NON_MIRAGE]: {
    name: 'Axes of Symmetry',
    icon: 'https://render.guildwars2.com/file/516ED87B7FC703AC09DE924218CDB53D2FFF39C9/1770504.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cooldown: 8,
    // The shared weapon variant retains the same shadowstep and relic response timing.
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    castTimeMs: 1000,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 6,
        stacks: 1
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.axes-confusion' } }]
  }
};

/** Snapshot ordinary Axe clones at acceptance; their own lifetime still cancels pending packets. */
export function scheduleAxesClones(state: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  const at = cast.fullEnd,
    castStart = cast.start;

  {
    const delivery = mesmerCastDelivery(cast, skill);
    const axeClones = professionCoreState(state.profession).clones.filter(
      (clone) => clone.weapon === WEAPON.AXE && canonicalTime(clone.createdAt) <= canonicalTime(castStart)
    );
    for (const clone of axeClones) {
      const impactAt = at - 0.04;
      buildMesmerStrikes(
        state,
        {
          name: `${skill.name} - Clone`,
          icon: 'https://render.guildwars2.com/file/516ED87B7FC703AC09DE924218CDB53D2FFF39C9/1770504.png',
          id: ID.AXES_OF_SYMMETRY,
          weapon: WEAPON.AXE,
          blade: false
        },
        impactAt,
        {
          coefficient: 1.75,
          hits: 1,
          source: 'Clone',
          weaponStrength: axeCloneAttack.weaponStrength
        },
        {
          metadata: { cloneId: clone.id },
          source: 'Clone',
          actorType: ACTOR.SUMMON,
          summonKind: 'clone',
          name: `${skill.name} - Clone`
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
        { type: 'condition', condition: CONDITION.CONFUSION, duration: 6, stacks: 1 },
        'Clone',
        `${skill.name} - Clone`,
        { metadata: { cloneId: clone.id }, skillId: skill.id, actorType: ACTOR.SUMMON, summonKind: 'clone' }
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
    const clones = professionCoreState(state.profession).clones.filter(
      (clone) => canonicalTime(clone.createdAt) <= canonicalTime(castStart)
    );

    if (clones.length) {
      buildMesmerConditions(
        state,
        skill.name,
        at,
        { type: 'condition', condition: CONDITION.CONFUSION, duration: 6, stacks: clones.length },
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

// Core variants remain distinct from the elite specialization weapon identities.
export const NON_MIRAGE_AXE_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.AXES_OF_SYMMETRY_NON_MIRAGE,
  ID.LINGERING_THOUGHTS_NON_MIRAGE
]);
