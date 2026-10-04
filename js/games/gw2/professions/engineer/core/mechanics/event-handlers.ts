import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Builds kit transitions as sigil swaps so shared equipment reactions observe the bar change. */
export function emitEngineerBarSwap(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      weaponSet: context.activeWeaponSet
    }
  });
}
