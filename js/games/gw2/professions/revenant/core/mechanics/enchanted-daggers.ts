/** Owns Enchanted Daggers activation and on-hit consumption; catalog fragments live under `legends/assassin.ts`. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { requireRevenantEffect as effectByType } from '#gw2/professions/revenant/core/traits/profile-access.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import type {
  RevenantCastContext,
  RevenantSkill,
  RevenantSchedulerContext,
  RevenantSimulationEvent
} from '#gw2/professions/revenant/types.js';

/** Arms the finite Enchanted Daggers charge/expiry state. */
export function activateEnchantedDaggers(context: RevenantCastContext, skill: RevenantSkill): void {
  // An aborted activation must not arm charges for later attacks.
  if (context.action.cancelled) return;
  const buff = skill.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'enchanted-daggers');
  if (!buff) throw new Error('Enchanted Daggers is missing its buff effect.');
  const charges = Math.max(0, Number(buff.stacks || 0));
  const duration = Math.max(0, Number(buff.duration || 0));
  const at = context.effectiveEnd;
  professionCoreState(context).enchantedDaggers = {
    charges,
    expiresAt: at + duration,
    readyAt: at
  };
  emitSkillBuff(context, {
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Enchanted Daggers',
    kind: 'enchanted-daggers',
    duration,
    stacks: charges
  });
  emitRevenantStateSnapshot(context, at, 'enchanted-daggers');
}

/** Consumes one unexpired, ready dagger charge after a qualifying player strike. */
export function triggerEnchantedDaggers(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const daggers = professionCoreState(context).enchantedDaggers;
  if (
    event.skillId !== ID.ENCHANTED_DAGGERS &&
    Number(daggers?.charges || 0) > 0 &&
    event.at < Number(daggers.expiresAt || 0) &&
    isInternalCooldownReady(event.at, Number(daggers.readyAt || 0))
  ) {
    const enchantedDaggers = context.catalog.skillsById.get(ID.ENCHANTED_DAGGERS);
    if (!enchantedDaggers) throw new Error('Missing Enchanted Daggers skill declaration.');
    const strike = effectByType(enchantedDaggers, 'strike');
    const buff = effectByType(enchantedDaggers, 'buff');
    const delay = Number(strike.atMs || 0) / 1000;
    daggers.charges -= 1;
    daggers.readyAt = event.at + delay;
    emitSkillDamage(context, {
      cause: event,
      at: event.at + delay,
      source: 'revenant',
      sourceId: ID.ENCHANTED_DAGGERS,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.ENCHANTED_DAGGERS,
      skillName: 'Enchanted Daggers',
      name: 'Enchanted Daggers — Siphon Damage',
      coefficient: 0,
      flatStrikeBase: Number(strike.flatStrikeBase || 0),
      flatStrikePowerCoeff: Number(strike.flatStrikePowerCoeff || 0),
      noCrit: true,
      hits: 1,
      hitIndex: Number(buff.stacks || 0) - daggers.charges,
      totalHits: Number(buff.stacks || 0)
    });
  }
}
