import type { MesmerPhantasmAttackTiming } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';

/**
 * A condition's packetLabel ties its applications to the named strike's packets, even if a patch removes the strike.
 * Initial timing uses the entity's measurements first, then shared measurements, with authored ticks as the fallback.
 * Repeat ticks come only from measurements. Without them, the scheduler shifts the initial pattern to the repeat impact.
 */
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
