/** Owns imperative Core Mesmer Domination trait effects. */
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { MesmerCastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Adds two enemy packets to Mirror Blade's four-hit base inside the existing cast-emission interruption scope. */
export function scheduleBountifulBlades(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = context.mesmerRuntime;
  if (skill.id !== ID.MIRROR_BLADE || !runtime?.traits.has(TRAIT.BOUNTIFUL_BLADES)) return;
  const effect = balanceProfileEffectFromContext(context, TRAIT.BOUNTIFUL_BLADES, 'strike');
  if (effect?.type !== 'strike') return;
  runtime.addDamage(
    skill,
    context.start,
    {
      ticks: effect.ticks,
      name: 'Additional target hits from Bountiful Blades'
    },
    { sourceId: TRAIT.BOUNTIFUL_BLADES }
  );
}

/** Emits Dazzling's control observation without taking ownership of control-event classification. */
export function triggerDazzling(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
  skillId: number,
  skillName: string
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.DAZZLING)) return;
  runtime.addEvent({
    type: 'weakness_vulnerability',
    at: event.at,
    skillId: Number.isFinite(skillId) ? skillId : undefined,
    skillName
  });
}
