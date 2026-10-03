import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerMechanics } from '#gw2/professions/mesmer/types.js';

/** Keep scheduled timeline markers while linking their grants explicitly for event-log consolidation. */
export function emitMesmerTraitBuffs(
  mechanics: Pick<MesmerMechanics, 'context' | 'addEvent'>,
  traitId: SkillId,
  at: number,
  sourceSkill: string,
  buffs: readonly MesmerEventExtra[],
  { detail = '', announce = true }: { readonly detail?: string; readonly announce?: boolean } = {}
): void {
  if (!buffs.length) return;
  const name = requireBalanceProfileFromContext(mechanics.context, traitId).name;
  const source = {
    source: 'Trait',
    sourceId: traitId,
    actorType: 'player' as const,
    skillId: traitId,
    skillName: name
  };
  const proc = announce
    ? mechanics.addEvent({
        ...source,
        actorType: 'effect',
        type: 'proc',
        procType: 'trait',
        name,
        at,
        sourceSkill,
        detail
      })
    : null;
  for (const buff of buffs)
    mechanics.addEvent({
      ...buff,
      ...source,
      type: 'buff',
      at,
      name,
      sourceSkill,
      ...(proc?.eventOrder == null ? {} : { parentEventOrder: proc.eventOrder })
    });
}
