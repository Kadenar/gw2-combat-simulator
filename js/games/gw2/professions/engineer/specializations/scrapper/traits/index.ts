import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/live-events.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

// Some skills set type="Heal", others only set slot="Heal"; check both.
function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === 'Heal' || skill?.slot === 'Heal';
}

// Toolbelt skills inherit their heal category from their parent kit/gyro.
function isHealingToolbeltSkill(context: EngineerRuntime, skill: EngineerSkill): boolean {
  if (skill.toolbeltParentId == null) return false;
  return isHealingSkill(context.helpers.skillsById.get(skill.toolbeltParentId));
}

function isFunctionGyro(skill: EngineerSkill): boolean {
  return skill.id === ID.FUNCTION_GYRO;
}

function category(skill: EngineerSkill, name: string): boolean {
  return Boolean(skill.categories?.some((value) => String(value).toLowerCase() === name.toLowerCase()));
}

/** Emits the post-cast boon, combo, and control effects granted by active Scrapper traits. */
export function applyScrapperCastTraits(context: EngineerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  // Speed of Synergy: healing toolbelt skills grant superspeed.
  // Med Kit toolbelt gets 12s (exceptional duration from the kit design); all others get 7s.
  if (hasTrait(context.config, TRAIT.SPEED_OF_SYNERGY) && isHealingToolbeltSkill(context, skill)) {
    const speedOfSynergyProfile = requireBalanceProfileFromContext(context, PROFILE.speedOfSynergy);
    emitEngineerEvent(
      context,
      'buff',
      {
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.SPEED_OF_SYNERGY,
        actorType: 'player',
        name: 'Speed of Synergy — superspeed',
        kind: 'superspeed',
        duration:
          skill.toolbeltParentId === ID.MED_KIT
            ? balanceProfileNumber(speedOfSynergyProfile, 'maximumStacks')
            : balanceProfileNumber(speedOfSynergyProfile, 'minimumStacks'),
        stacks: 1,
        maximumDuration: 10
      },
      skill
    );
  }

  // Speed of Synergy also applies when casting the heal skill itself (7s),
  // but Med Kit is excluded because equipping it doesn't constitute a cast.
  if (hasTrait(context.config, TRAIT.SPEED_OF_SYNERGY) && isHealingSkill(skill) && skill.id !== ID.MED_KIT) {
    const speedOfSynergyProfile = requireBalanceProfileFromContext(context, PROFILE.speedOfSynergy);
    emitEngineerEvent(
      context,
      'buff',
      {
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.SPEED_OF_SYNERGY,
        actorType: 'player',
        name: 'Speed of Synergy — superspeed',
        kind: 'superspeed',
        duration: balanceProfileNumber(speedOfSynergyProfile, 'threshold'),
        stacks: 1,
        maximumDuration: 10
      },
      skill
    );
  }

  // Gyroscopic Acceleration (adept trait): Well skills and Function Gyro grant 5s superspeed.
  if (hasTrait(context.config, TRAIT.GYROSCOPIC_ACCELERATION) && (category(skill, 'Well') || isFunctionGyro(skill))) {
    const gyroscopicAccelerationProfile = requireBalanceProfileFromContext(context, PROFILE.gyroscopicAcceleration);
    const gyroscopicAccelerationSuperspeed = requireEffect(gyroscopicAccelerationProfile, 'buff', 'superspeed');
    if (gyroscopicAccelerationSuperspeed) {
      emitEngineerEvent(
        context,
        'buff',
        {
          at: context.time,
          source: 'Trait',
          sourceId: TRAIT.GYROSCOPIC_ACCELERATION,
          actorType: 'player',
          name: 'Gyroscopic Acceleration — superspeed',
          kind: 'superspeed',
          duration: Number(gyroscopicAccelerationSuperspeed.duration),
          stacks: Number(gyroscopicAccelerationSuperspeed.stacks),
          maximumDuration: 10
        },
        skill
      );
    }
  }

  // Remaining traits only proc on Function Gyro.
  if (!isFunctionGyro(skill)) return;
  // Kinetic Accelerators (GM trait): Function Gyro becomes a blast finisher.
  // The marker gives the shared combo materializer a trait-gated descriptor
  // while preserving Function Gyro as the source of the resulting combo.
  if (hasTrait(context.config, TRAIT.KINETIC_ACCELERATORS)) {
    produceRuntimeCombos(context, context.helpers, {
      type: 'action',
      endsAt: context.time,
      at: context.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Kinetic Accelerators — Function Gyro blast finisher',
      activationId: cast.id,
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
    emitEngineerEvent(context, 'control', {
      at: context.time,
      source: 'Trait',
      sourceId: TRAIT.SYSTEM_SHOCKER,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'System Shocker — daze',
      controlKind: 'daze'
    });
  }

  // Mass Momentum (GM trait): Function Gyro grants 3 stacks of stability (seeds the pulse loop).
  if (hasTrait(context.config, TRAIT.MASS_MOMENTUM)) {
    const massMomentumProfile = requireBalanceProfileFromContext(context, PROFILE.massMomentum);
    const massMomentumStability = requireEffect(massMomentumProfile, 'boon', 'stability');
    if (massMomentumStability) {
      emitEngineerEvent(
        context,
        'buff',
        {
          at: context.time,
          source: 'Trait',
          sourceId: TRAIT.MASS_MOMENTUM,
          actorType: 'player',
          name: 'Mass Momentum — stability',
          kind: String(massMomentumStability.boon).toLowerCase(),
          duration: Number(massMomentumStability.duration),
          stacks: Number(massMomentumStability.stacks)
        },
        skill
      );
    }
  }
}
