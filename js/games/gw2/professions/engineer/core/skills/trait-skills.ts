/**
 * Owns Core Engineer fragments created by trait procs and trait-triggered actions.
 * Trait selection gates remain in `core/traits/`; triggered skills own their payload and delivery.
 */
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type {
  EngineerRuntime,
  EngineerSkill,
  EngineerResolverContext,
  EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';

/** Triggered packets use the selected skill's complete payload and identity, keeping the initiating action as context. */
export function emitEngineerTriggeredSkill(
  context: EngineerResolverContext,
  skillId: SkillId,
  trigger: EngineerResolverEvent
): boolean {
  const skill = context.helpers.skillsById.get(skillId)!;
  if (!skill.effects?.length) return false;
  context.effects.emit({
    kind: 'profile',
    profile: skill,
    at: trigger.at,
    cause: trigger,
    attribution: {
      source: 'Trait',
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      triggeredBy: trigger.skillName
    },
    transform: (event) => ({ ...event, parentSkillName: trigger.skillName, icon: skill.icon })
  });
  return true;
}

/** Dodge rearming never resets the skill's recharge; removed payloads leave both recharge and the armed attack intact. */
export function reserveExplosiveEntrance(context: EngineerRuntime, at: number): boolean {
  const skill = context.helpers.skillsById.get(ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL)!;
  // This proc retains its exclusive deadline instead of the ordinary cast controller's inclusive action tick.
  if (!skill.effects?.length || !isInternalCooldownReady(at, context.cooldownController.readyAt(skill.id)))
    return false;
  context.cooldownController.startRecharge(skill, at);
  return true;
}

/** Combat and isolated previews emit the same skill; the trait announcement retains the triggering action. */
export function emitExplosiveEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!emitEngineerTriggeredSkill(context, ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL, event)) return;
  announceTriggeredSkill(context, TRAIT.EXPLOSIVE_ENTRANCE, ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL, event);
}

/** Rocket and orbital variants each own their payload, delay, and finisher behavior in the selected catalog. */
export function emitAimAssistedRocket(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  orbital: boolean
): void {
  const id = orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL;
  if (!emitEngineerTriggeredSkill(context, id, event)) return;
  announceTriggeredSkill(context, TRAIT.AIM_ASSISTED_ROCKET, id, event);
}

function announceTriggeredSkill(
  context: EngineerResolverContext,
  traitId: SkillId,
  skillId: SkillId,
  event: EngineerResolverEvent
): void {
  const skill = context.helpers.skillsById.get(skillId)!;
  context.effects.emit({
    kind: 'announcement',
    attribution: { source: 'Trait', sourceId: traitId, actorType: 'effect' },
    cause: event,
    announcement: { type: 'trait', name: skill.name, at: event.at, sourceSkill: event.skillName, icon: skill.icon }
  });
}

/** Triggered and directly cast barrages share the skill's recharge, including Alacrity and cooldown resets. */
export function triggerLesserGrenadeBarrage(context: EngineerRuntime, trigger: EngineerSkill, at: number): void {
  const skill = context.helpers.skillsById.get(ID.LESSER_GRENADE_BARRAGE)!;
  if (!skill.effects?.length || context.cooldownController.isOnCooldown(skill.id, at)) return;
  context.cooldownController.startRecharge(skill, at);
  emitLesserGrenadeBarrage(context, trigger, at);
}

/** Emit the selected skill's effects with its own identity and icon, retaining the heal only as trigger context. */
export function emitLesserGrenadeBarrage(context: EngineerRuntime, trigger: EngineerSkill, at: number): void {
  emitEngineerTriggeredSkill(context, ID.LESSER_GRENADE_BARRAGE, {
    type: 'action',
    source: 'engineer',
    sourceId: trigger.id,
    actorType: 'player',
    at,
    skillId: trigger.id,
    skillName: trigger.name
  });
}

/** Defines the catalog fragments used by Core Engineer trait effects. */
export const ENGINEER_TRAIT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LESSER_GRENADE_BARRAGE]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        // Approximate scatter as three landed half-coefficient grenades at the average impact delay.
        coefficient: 1.5,
        hits: 3,
        atMs: 730,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Lesser Grenade Barrage',
        actorType: 'effect',
        ownerActorType: 'player',
        weapon: 'Unequipped',
        damageKind: 'explosion'
      }
    ]
  },
  [ID.LESSER_ELIXIR_B]: {
    castTimeMs: 0,
    cooldown: 24,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.STATIC_DISCHARGE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Static Discharge',
        actorType: 'effect',
        ownerActorType: 'player',
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped'
      }
    ]
  },
  [ID.DROP_MINE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Drop Mine',
        actorType: 'player'
      }
    ]
  },
  [ID.MAGNETIC_BOMB_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull'
      }
    ]
  },
  [ID.SUPERSPEED_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.FIRE_SHIELD_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.MAGNETIC_AURA_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.95,
        hits: 1,
        name: 'Bunker Down (trait skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.INVISIBLE_ANALYSIS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.CLEANSING_PULSE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.LESSER_UTILITY_GOGGLES]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aim-Assisted Rocket',
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'effect',
        ownerActorType: 'player',
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        damageKind: 'explosion'
      }
    ]
  },
  [ID.BANDAGE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ORBITAL_COMMAND_STRIKE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Orbital Command Strike',
        atMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'effect',
        ownerActorType: 'player',
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        comboFinishers: [{ ownerId: 'engineer', finisherType: 'Blast', chance: 1, ambiguousFieldSelection: 'oldest' }]
      }
    ]
  },
  [ID.CONTROLLED_ANALYSIS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Explosive Entrance',
        actorType: 'effect',
        ownerActorType: 'player',
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        damageKind: 'explosion'
      }
    ]
  }
});
