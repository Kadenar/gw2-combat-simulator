/**
 * Owns Engineer sword cast behavior shared by Core and Holosmith sword variants.
 * Skill fragments live in weapon catalogs; handler registration lives in `index.ts`.
 */
import type { EngineerCastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { reduceMatchingCooldowns } from '#gw2/platform/execution/cooldowns.js';

/** Reduces recharge on active Engineer sword skills other than the triggering Gleam Saber cast. */
export function rechargeOtherSwordSkills(context: EngineerCastContext, gleamSaber: EngineerSkill): void {
  const at = context.effectiveEnd;
  const reducedBy = reduceMatchingCooldowns(
    context,
    (skill) => skill.type === 'Weapon' && skill.weapon === 'Sword' && skill.id !== gleamSaber.id,
    1,
    at
  );

  // only emit proc when something actually changed — no-op if no sword skill was on cooldown
  if (reducedBy <= 0) return;
  context.emit({
    type: 'proc',
    at,
    source: 'engineer',
    sourceId: gleamSaber.id,
    actorType: 'player',
    name: 'Gleam Saber — Sword Recharge',
    procType: 'skill',
    sourceSkill: gleamSaber.name,
    cooldownReduction: reducedBy
  });
}
