import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Cast duration and commit timing share the trait's active-offhand requirement. */
export function warriorDualWieldingActive(config: Gw2Config | undefined, activeWeaponSet: number): boolean {
  const offhand = gw2ConfiguredWeaponSet(config, activeWeaponSet)[1];
  return (
    hasTrait(config, TRAIT.DUAL_WIELDING) &&
    [WEAPON.AXE, WEAPON.DAGGER, WEAPON.MACE, WEAPON.SWORD].some((weapon) => weapon === offhand)
  );
}

/** Capture measured commitment and packet timing on the cast-local skill, shared by replay and log reconstruction. */
export function resolveWarriorDualWieldSkill<TSkill extends WarriorSkill>(
  skill: TSkill,
  config: Gw2Config | undefined,
  activeWeaponSet: number
): TSkill {
  if (!warriorDualWieldingActive(config, activeWeaponSet)) return skill;

  const offsets = skill.dualWieldEffectOffsetsMs;

  if (!offsets && skill.dualWieldInterruptCommitMs == null) return skill;

  // Fixed recovery anchors already follow the full cast end; only explicitly measured start offsets are replaced.
  const effects = offsets
    ? skill.effects?.map((effect) => {
        if (effect.timingAnchor !== 'castStart') return effect;

        const measured = (atMs: number): number => {
          const value = offsets[atMs];

          if (!Number.isFinite(value)) throw new TypeError(`${skill.name} has no Dual Wielding offset for ${atMs} ms.`);

          return value;
        };

        return {
          ...effect,
          timingScale: 'fixed' as const,
          ...(effect.atMs == null ? {} : { atMs: measured(effect.atMs) }),
          ...(Array.isArray(effect.ticks)
            ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: measured(tick.atMs) })) }
            : {})
        };
      })
    : skill.effects;
  return {
    ...skill,
    ...(skill.dualWieldInterruptCommitMs == null ? {} : { interruptCommitMs: skill.dualWieldInterruptCommitMs }),
    ...(offsets ? { effects } : {})
  };
}
