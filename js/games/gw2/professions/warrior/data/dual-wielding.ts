import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Cast duration and commit timing share the trait's active-offhand requirement. */
export function warriorDualWieldingActive(config: Gw2Config | undefined, activeWeaponSet: number): boolean {
  const offhand = gw2ConfiguredWeaponSet(config, activeWeaponSet)[1];
  return hasTrait(config, TRAIT.DUAL_WIELDING) && ['Axe', 'Dagger', 'Mace', 'Sword'].includes(String(offhand));
}

/** Capture the measured cutoff on a cast-local skill so interruption consumers never rescale it or query later state. */
export function resolveWarriorInterruptCommit<TSkill extends WarriorSkill>(
  skill: TSkill,
  config: Gw2Config | undefined,
  activeWeaponSet: number
): TSkill {
  return skill.dualWieldInterruptCommitMs != null && warriorDualWieldingActive(config, activeWeaponSet)
    ? { ...skill, interruptCommitMs: skill.dualWieldInterruptCommitMs }
    : skill;
}
