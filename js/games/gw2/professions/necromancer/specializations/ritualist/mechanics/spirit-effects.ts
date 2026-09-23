import { buildResolverStrike, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  handleNecromancerPainfulBond,
  painfulBondPulses,
  handleNecromancerWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/event-handlers.js';
import { materializeNecromancerSummonAttack } from '#gw2/professions/necromancer/core/mechanics/event-handlers.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

// Weapon-spell stacks follow the creature that owns an attack before its stat
// attribution, so player-scaled spirit packets cannot spend the player's stacks.
function recipientKeys(event: NecromancerResolverEvent): string[] {
  if (event.summonOwnerBase && Number(event.summonCount || 0) > 1) {
    return Array.from({ length: Number(event.summonCount) }, (_, index) => `${event.summonOwnerBase}:${index}`);
  }

  if (event.summonOwner) return [event.summonOwner];
  if (event.actorType === 'player') return ['player'];
  if (event.actorType !== 'summon') return [];

  return [];
}

function spellIcon(context: NecromancerResolverContext, skillId: SkillId): string {
  return context.helpers.skillsById?.get(skillId)?.icon || '';
}

// Resolve a Nightmare Weapon stack as a non-critical life steal plus vulnerability,
// preserving whether the triggering strike belonged to an ally.
function queueNightmareWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile
): void {
  const strike = requireEffect(definition, 'strike', 'Strike');
  const vulnerability = requireEffect(definition, 'condition', 'Vulnerability');
  // Materialize both components at the triggering strike's timestamp before recording the combined proc; each
  // survives the other's removal.
  if (strike)
    context.queue.enqueue(
      buildResolverStrike({
        at: event.at,

        skillName: 'Nightmare Weapon',
        coefficient: 0,
        flatStrikeBase: effectNumber(definition, strike, 'flatStrikeBase'),
        flatStrikePowerCoeff: effectNumber(definition, strike, 'flatStrikePowerCoeff'),

        source: 'Weapon Spell',
        sourceId: ID.NIGHTMARE_WEAPON,
        actorType: 'effect',
        skillId: ID.NIGHTMARE_WEAPON,
        skillWeapon: 'Unequipped',
        noCrit: true,
        damageKind: 'life-steal',
        triggeredBy: event.skillName,
        // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
        ...(event.metadata?.triggeredByAlly == null
          ? {}
          : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
      })
    );
  if (vulnerability)
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        name: 'Nightmare Weapon',
        skillName: 'Nightmare Weapon',
        condition: String(vulnerability.condition),
        stacks: effectNumber(definition, vulnerability, 'stacks'),
        duration: effectNumber(definition, vulnerability, 'duration'),
        source: 'Weapon Spell',
        sourceId: ID.NIGHTMARE_WEAPON,
        actorType: 'effect',
        triggeredBy: event.skillName,
        // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
        ...(event.metadata?.triggeredByAlly == null
          ? {}
          : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
      })
    );
  context.recordProc?.(
    'skill',
    'Nightmare Weapon',
    event.at,
    event.skillName,
    '',
    spellIcon(context, ID.NIGHTMARE_WEAPON)
  );
}

// Resolve a Splinter Weapon stack as a derived strike while preserving ally
// trigger attribution and proc logging.
function queueSplinterWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile
): void {
  const strike = requireEffect(definition, 'strike', 'Strike');
  if (!strike) return;
  // Queue the derived strike first, then expose the same trigger through proc reporting.
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at,

      skillName: 'Splinter Weapon',
      coefficient: effectNumber(definition, strike, 'coefficient'),

      source: 'Weapon Spell',
      sourceId: ID.SPLINTER_WEAPON,
      actorType: 'effect',
      skillId: ID.SPLINTER_WEAPON,
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName,
      // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
      ...(event.metadata?.triggeredByAlly == null
        ? {}
        : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
    })
  );
  context.recordProc?.(
    'skill',
    'Splinter Weapon',
    event.at,
    event.skillName,
    '',
    spellIcon(context, ID.SPLINTER_WEAPON)
  );
}

/** Resolves a precomputed allied-player weapon-spell trigger without consuming player charges. */
export function handleNecromancerWeaponSpellAllyTrigger(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = requireBalanceProfileFromContext(
    context,
    event.spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
  );
  if (event.spell === 'nightmare') {
    queueNightmareWeapon(context, event, definition);
  } else if (event.spell === 'splinter') {
    queueSplinterWeapon(context, event, definition);
  }
}

// Spend eligible recipients' weapon-spell charges when their damaging strikes resolve.
function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Effect-sourced damage (e.g. prior spell proc) must not chain into another proc; coefficient > 0 guards against flat-damage-only strikes
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const keys = recipientKeys(event);
  if (!keys.length) return;
  for (const spell of ['nightmare', 'splinter']) {
    const active = ritualistState.from(context).weaponSpells?.[spell];
    // Each recipient grant owns its expiry and spending; the spell has no second deadline.
    if (!active) continue;
    const definition = requireBalanceProfileFromContext(
      context,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    // Charges exist only to deliver the spell's packets, so a spell with every packet removed spends none.
    const hasOutput =
      requireEffect(definition, 'strike', 'Strike') !== undefined ||
      (spell === 'nightmare' && requireEffect(definition, 'condition', 'Vulnerability') !== undefined);
    if (!hasOutput) continue;
    const internalCooldown = balanceProfileNumber(definition, 'internalCooldown');
    for (const key of keys) {
      const recipient = active.recipients?.[key];
      if (!consumeCharge(recipient, event.at, internalCooldown)) continue;
      if (spell === 'nightmare') {
        queueNightmareWeapon(context, event, definition);
      } else {
        queueSplinterWeapon(context, event, definition);
      }
    }
  }
}

/** Exposes Ritualist's hit-triggered weapon-spell reaction. */
export const ritualistResolverEventReactions = Object.freeze({
  damage: reactToDamage
});

/** Routes Ritualist resolver events to spirit, bond, and weapon-spell handlers. */
export const ritualistEventHandlers = Object.freeze({
  'necromancer.spirit-attack': (context: NecromancerResolverContext, event: NecromancerResolverEvent): void => {
    const state = ritualistState.from(context);
    if (
      !event.requiresSpirit ||
      !state.activeSpirits[event.requiresSpirit] ||
      (event.requiresSpiritGeneration != null &&
        Number(state.spiritGenerations[event.requiresSpirit] || 0) !== Number(event.requiresSpiritGeneration)) ||
      Number(state.spiritBusyUntil[event.requiresSpirit] || 0) > event.at
    ) {
      return;
    }

    // A spirit busy at attack start skips this pulse even if it would be ready by the damage timestamp.
    if (Number(event.spiritAttackDelay || 0) > 0) {
      context.queue.enqueue({
        ...event,
        at: event.at + Number(event.spiritAttackDelay),
        spiritAttackDelay: 0
      });
      return;
    }

    // Recheck lifetime at impact so replacing a spirit also cancels its pending old-generation strike.
    materializeNecromancerSummonAttack(context, event);
  },
  'necromancer.painful-bond': handleNecromancerPainfulBond,
  ...painfulBondPulses.eventHandlers,
  'necromancer.weapon-spell': handleNecromancerWeaponSpell,
  'necromancer.weapon-spell-ally-trigger': handleNecromancerWeaponSpellAllyTrigger
});
