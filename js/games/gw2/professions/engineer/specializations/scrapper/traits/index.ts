import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillControl } from '#gw2/platform/scheduler/skill-events.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

// Some skills set type="Heal", others only set slot="Heal"; check both.
function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === 'Heal' || skill?.slot === 'Heal';
}

// Toolbelt skills inherit their heal category from their parent kit/gyro.
function isHealingToolbeltSkill(context: EngineerCastContext, skill: EngineerSkill): boolean {
  if (skill.toolbeltParentId == null) return false;
  return isHealingSkill(context.catalog.skillsById.get(skill.toolbeltParentId));
}

function isFunctionGyro(skill: EngineerSkill): boolean {
  return skill.id === ID.FUNCTION_GYRO;
}

function category(skill: EngineerSkill, name: string): boolean {
  return Boolean(skill.categories?.some((value) => String(value).toLowerCase() === name.toLowerCase()));
}

/** Emits the post-cast boon, combo, and control effects granted by active Scrapper traits. */
export function applyScrapperCastTraits(context: EngineerCastContext, skill: EngineerSkill): void {
  // Speed of Synergy: healing toolbelt skills grant superspeed.
  // Med Kit toolbelt gets 12s (exceptional duration from the kit design); all others get 7s.
  if (hasTrait(context.config, TRAIT.SPEED_OF_SYNERGY) && isHealingToolbeltSkill(context, skill)) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.SPEED_OF_SYNERGY,
      actorType: 'player',
      name: 'Speed of Synergy — superspeed',
      kind: 'superspeed',
      duration:
        skill.toolbeltParentId === ID.MED_KIT
          ? balanceProfileValueFromContext(context, PROFILE.speedOfSynergy, 'maximumStacks', 12)
          : balanceProfileValueFromContext(context, PROFILE.speedOfSynergy, 'minimumStacks', 5),
      stacks: 1,
      maximumDuration: 10
    });
  }

  // Speed of Synergy also applies when casting the heal skill itself (7s),
  // but Med Kit is excluded because equipping it doesn't constitute a cast.
  if (hasTrait(context.config, TRAIT.SPEED_OF_SYNERGY) && isHealingSkill(skill) && skill.id !== ID.MED_KIT) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.SPEED_OF_SYNERGY,
      actorType: 'player',
      name: 'Speed of Synergy — superspeed',
      kind: 'superspeed',
      duration: balanceProfileValueFromContext(context, PROFILE.speedOfSynergy, 'threshold', 7),
      stacks: 1,
      maximumDuration: 10
    });
  }

  // Gyroscopic Acceleration (adept trait): Well skills and Function Gyro grant 5s superspeed.
  if (hasTrait(context.config, TRAIT.GYROSCOPIC_ACCELERATION) && (category(skill, 'Well') || isFunctionGyro(skill))) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.GYROSCOPIC_ACCELERATION,
      actorType: 'player',
      name: 'Gyroscopic Acceleration — superspeed',
      kind: 'superspeed',
      duration: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.gyroscopicAcceleration, 'buff'),
        'duration',
        5
      ),
      stacks: 1,
      maximumDuration: 10
    });
  }

  // Remaining traits only proc on Function Gyro.
  if (!isFunctionGyro(skill)) return;
  // Kinetic Accelerators (GM trait): Function Gyro becomes a blast finisher.
  // The marker gives the shared combo materializer a trait-gated descriptor
  // while preserving Function Gyro as the source of the resulting combo.
  if (hasTrait(context.config, TRAIT.KINETIC_ACCELERATORS)) {
    context.emitDerived(context.action, {
      type: 'marker',
      at: context.effectiveEnd,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Kinetic Accelerators — Function Gyro blast finisher',
      activationId: context.action.activationId,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Blast',
          chance: 1,
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  }

  // System Shocker (master trait): Function Gyro dazes for 1s on cast.
  if (hasTrait(context.config, TRAIT.SYSTEM_SHOCKER)) {
    emitSkillControl(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.SYSTEM_SHOCKER,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'System Shocker — daze',
      controlKind: 'daze',
      duration: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.systemShocker, 'control'),
        'duration',
        1
      )
    });
  }

  // Mass Momentum (GM trait): Function Gyro grants 3 stacks of stability (seeds the pulse loop).
  if (hasTrait(context.config, TRAIT.MASS_MOMENTUM)) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.MASS_MOMENTUM,
      actorType: 'player',
      name: 'Mass Momentum — stability',
      kind: 'stability',
      duration: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.massMomentum, 'boon', 1),
        'duration',
        3
      ),
      stacks: 1
    });
  }
}
