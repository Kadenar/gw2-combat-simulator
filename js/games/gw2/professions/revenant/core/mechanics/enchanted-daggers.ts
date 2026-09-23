/** Owns Enchanted Daggers activation and on-hit consumption; catalog fragments live under `legends/assassin.ts`. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { requireEffect, effectNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import type { RevenantCastContext, RevenantSkill, RevenantSchedulerContext } from '#gw2/professions/revenant/types.js';

/** Arms the finite Enchanted Daggers charge/expiry state. */
export function activateEnchantedDaggers(context: RevenantCastContext, skill: RevenantSkill): void {
  // An aborted activation must not arm charges for later attacks.
  if (context.action.cancelled) return;
  const buff = requireEffect(skill, 'buff', 'enchanted-daggers');
  // Charges are the buff's stacks, so a removed buff arms nothing.
  if (!buff) return;
  const charges = Math.max(0, effectNumber(skill, buff, 'stacks'));
  const duration = Math.max(0, effectNumber(skill, buff, 'duration'));
  const at = context.effectiveEnd;
  professionCoreState(context).enchantedDaggers = {
    ...grantCharges(charges, at + duration),
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
export function triggerEnchantedDaggers(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const daggers = professionCoreState(context).enchantedDaggers;
  if (
    event.skillId !== ID.ENCHANTED_DAGGERS &&
    Number(daggers?.charges || 0) > 0 &&
    isInternalCooldownReady(event.at, Number(daggers.readyAt || 0))
  ) {
    const enchantedDaggers = context.catalog.skillsById.get(ID.ENCHANTED_DAGGERS);
    if (!enchantedDaggers) throw new Error('Missing Enchanted Daggers skill declaration.');
    const strike = requireEffect(enchantedDaggers, 'strike', 'Enchanted Daggers — Siphon Damage');
    const buff = requireEffect(enchantedDaggers, 'buff', 'enchanted-daggers');
    // Charges exist only to deliver the siphon, so a removed strike leaves them unspent.
    if (!strike || !buff) return;
    const totalHits = effectNumber(enchantedDaggers, buff, 'stacks');
    const delay = Number(strike.atMs || 0) / 1000;
    if (!consumeCharge(daggers, event.at, delay)) return;
    // Preserve strict same-timestamp gating even when a patched strike has no delay.
    if (delay === 0) daggers.readyAt = event.at;
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
      flatStrikeBase: effectNumber(enchantedDaggers, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(enchantedDaggers, strike, 'flatStrikePowerCoeff'),
      noCrit: true,
      hits: 1,
      hitIndex: totalHits - daggers.charges,
      totalHits
    });
  }
}
