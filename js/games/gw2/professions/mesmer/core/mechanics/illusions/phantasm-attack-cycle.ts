import type { MesmerPhantasmAttackTiming } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';

/** A named attack can retain its packet timings even when the selected patch removes its strike. */
export function phantasmAttackCycle(
  skill: MesmerSkill,
  timing: Partial<MesmerPhantasmAttackTiming> | undefined,
  entityIndex: number,
  group: string | MesmerStrikeEffect
) {
  const label = typeof group === 'string' ? group : (group.name ?? '');
  const measured = timing?.damageTicksByEntity?.[entityIndex]?.[label] ?? timing?.damageTicks?.[label];
  const repeat = timing?.repeatDamageTicksByEntity?.[entityIndex]?.[label] ?? timing?.repeatDamageTicks?.[label];
  const initial = measured?.length
    ? measured
    : typeof group === 'string'
      ? skill.effects?.find((effect): effect is MesmerStrikeEffect => effect.type === 'strike' && effect.name === label)
          ?.ticks
      : group.ticks;
  return { initial, repeat: repeat?.length ? repeat : undefined };
}
