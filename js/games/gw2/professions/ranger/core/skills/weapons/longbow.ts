/** Canonical Core ranger skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.LONG_RANGE_SHOT]: {
    name: 'Long Range Shot',
    icon: 'https://render.guildwars2.com/file/2A4CFDE1D6FC1B04D864E32190E7A6521C000104/102827.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.33,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      }
    ]
  },
  [ID.RAPID_FIRE]: {
    name: 'Rapid Fire',
    icon: 'https://render.guildwars2.com/file/F74408EC9F2354940976E1E80D46E29C7C693C62/102828.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 1800,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        projectile: true,
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({ atMs, coefficient: 0.6 })),
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'condition',
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 10
        }))
      }
    ])
  },
  [ID.HUNTERS_SHOT]: {
    name: "Hunter's Shot",
    icon: 'https://render.guildwars2.com/file/04C30811DB264CFE9049BF480CC4D34D7BF353AA/104012.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 320,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      { type: 'buff', kind: STATUS.STEALTH, duration: 3, stacks: 1 }
    ]
  },
  [ID.POINT_BLANK_SHOT]: {
    name: 'Point-Blank Shot',
    icon: 'https://render.guildwars2.com/file/0C976CDCD10C3A7F4E54CABDC09ABEB6C1CB230D/103251.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.8,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  [ID.BARRAGE]: {
    name: 'Barrage',
    icon: 'https://render.guildwars2.com/file/0A4C91B8E60CC4F23BE64DA0AA6C56BF3E330C3B/103042.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_5',
    cooldown: 20,

    castTimeMs: 1880,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080, 7680].map((atMs) => ({
          atMs,
          coefficient: 0.5
        }))
      },
      {
        type: 'condition',
        ticks: [1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080, 7680].map((atMs) => ({
          atMs,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 1
        }))
      }
    ])
  }
};

// Keep selected declarations until their activation lands; misses never consume a stealth grant.
const huntersShotGrants = new WeakMap<
  RangerRuntime,
  Map<string, { skill: RangerSkill; effects: readonly SkillEffect[] }>
>();

/** Declared stealth retains its tooltip and patch ownership, but only a landed Hunter's Shot applies it. */
export const huntersShotLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id !== ID.HUNTERS_SHOT) return effects;

    const stealth = effects.filter(
      (effect) =>
        effect.type === 'buff' && effect.kind === STATUS.STEALTH && (!effect.when || effect.when(runtime.queries, cast))
    );
    let grants = huntersShotGrants.get(runtime);

    if (!grants) huntersShotGrants.set(runtime, (grants = new Map()));

    grants.set(cast.id, { skill: cast.skill, effects: stealth });
    return effects.filter((effect) => effect.type !== 'buff' || effect.kind !== STATUS.STEALTH);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      if (event.skillId !== ID.HUNTERS_SHOT || event.actorType !== ACTOR.PLAYER || !event.activationId) return;

      const grant = huntersShotGrants.get(runtime)?.get(event.activationId);

      if (!grant) return;

      huntersShotGrants.get(runtime)!.delete(event.activationId);
      runtime.effects.emit({
        kind: 'profile',
        settlement: 'reaction',
        profile: grant.skill,
        effects: grant.effects.map((effect) => ({
          ...effect,
          atMs: 0,
          timingAnchor: 'castStart' as const,
          when: undefined
        })),
        attribution: {
          source: 'ranger',
          sourceId: grant.skill.id,
          skillId: grant.skill.id,
          skillName: grant.skill.name,
          actorType: ACTOR.PLAYER,
          activationId: event.activationId
        }
      });
    }
  }
};
