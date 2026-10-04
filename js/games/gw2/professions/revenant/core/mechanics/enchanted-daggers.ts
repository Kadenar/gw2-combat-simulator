import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { effectNumber, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** A ready, unexpired Enchanted Daggers charge becomes a delayed siphon after a landed player strike. */
export function enchantedDaggers(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const daggers = runtime.profession.core.enchantedDaggers;
  if (
    event.skillId === ID.ENCHANTED_DAGGERS ||
    !((daggers.charges || 0) > 0) ||
    !isInternalCooldownReady(runtime.time, daggers.readyAt || 0)
  )
    return;
  const skill = runtime.helpers.skillsById.get(ID.ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Enchanted Daggers skill declaration.');
  const strike = requireEffect(skill, 'strike', 'Enchanted Daggers — Siphon Damage');
  const buff = requireEffect(skill, 'buff', 'enchanted-daggers');
  // Charges exist only to deliver the siphon, so a removed strike leaves them unspent.
  if (!strike || !buff) return;
  const totalHits = effectNumber(skill, buff, 'stacks');
  const delay = (strike.atMs || 0) / 1000;
  if (!consumeCharge(daggers, runtime.time, delay)) return;
  // Preserve strict same-timestamp gating even when a patched strike has no delay.
  if (delay === 0) daggers.readyAt = runtime.time;
  emitEnchantedDagger(runtime, event, totalHits - daggers.charges, totalHits);
}

/** A single delayed siphon is independent of how the healing skill armed its charges. */
export function emitEnchantedDagger(
  runtime: RevenantRuntime,
  event: Gw2ResolverEvent,
  hitIndex = 1,
  totalHits = 1
): void {
  const skill = runtime.helpers.skillsById.get(ID.ENCHANTED_DAGGERS)!;
  const strike = requireEffect(skill, 'strike', 'Enchanted Daggers — Siphon Damage');
  if (!strike) return;
  const delay = (strike.atMs || 0) / 1000;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: canonicalTime(runtime.time + delay),
      source: 'revenant',
      sourceId: ID.ENCHANTED_DAGGERS,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.ENCHANTED_DAGGERS,
      skillName: 'Enchanted Daggers',
      // The armed heal owns this siphon; its causal hit must not absorb the damage in isolated previews.
      procType: 'profession',
      icon: skill.icon,
      name: 'Enchanted Daggers — Siphon Damage',
      coefficient: 0,
      damageKind: strike.damageKind,
      flatStrikeBase: effectNumber(skill, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(skill, strike, 'flatStrikePowerCoeff'),
      canCrit: false,
      hitIndex,
      totalHits
    })
  });
}

/** A committed Enchanted Daggers arms its finite charge window at completion. */
export function completeRevenantEnchantedDaggers(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const buff = requireEffect(cast.skill, 'buff', 'enchanted-daggers');
  // Charges are the buff's stacks, so a removed buff arms nothing.
  if (!buff) return;
  const charges = Math.max(0, effectNumber(cast.skill, buff, 'stacks'));
  const duration = Math.max(0, effectNumber(cast.skill, buff, 'duration'));
  runtime.profession.core.enchantedDaggers = {
    ...grantCharges(charges, runtime.time + duration),
    readyAt: runtime.time
  };
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        name: 'Enchanted Daggers',
        kind: 'enchanted-daggers',
        duration,
        stacks: charges
      },
      fixedDuration: true
    }
  });
}
