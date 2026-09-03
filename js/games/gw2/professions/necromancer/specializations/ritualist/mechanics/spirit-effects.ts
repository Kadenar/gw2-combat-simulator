import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  handleNecromancerPainfulBond,
  handleNecromancerWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/event-handlers.js';
import { materializeNecromancerSummonAttack } from '#gw2/professions/necromancer/core/mechanics/event-handlers.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import type { BalanceProfile } from '#gw2/platform/engine/types.js';

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
  const strike = balanceProfileEffect(definition, 'strike');
  const vulnerability = balanceProfileEffect(definition, 'condition');
  // Materialize both components at the triggering strike's timestamp before recording the combined proc.
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name: 'Nightmare Weapon',
    skillName: 'Nightmare Weapon',
    coefficient: 0,
    flatStrikeBase: Number(strike?.flatStrikeBase || 0),
    flatStrikePowerCoeff: Number(strike?.flatStrikePowerCoeff || 0),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Weapon Spell',
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: 'effect',
    skillId: ID.NIGHTMARE_WEAPON,
    skillWeapon: 'Unequipped',
    noCrit: true,
    damageKind: 'life-steal',
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly
  });
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name: 'Nightmare Weapon',
    skillName: 'Nightmare Weapon',
    condition: 'Vulnerability',
    stacks: Number(vulnerability?.stacks || 0),
    duration: Number(vulnerability?.duration || 0),
    source: 'Weapon Spell',
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: 'effect',
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly
  });
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
  const strike = balanceProfileEffect(definition, 'strike');
  // Queue the derived strike first, then expose the same trigger through proc reporting.
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name: 'Splinter Weapon',
    skillName: 'Splinter Weapon',
    coefficient: Number(strike?.coefficient || 0),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Weapon Spell',
    sourceId: ID.SPLINTER_WEAPON,
    actorType: 'effect',
    skillId: ID.SPLINTER_WEAPON,
    skillWeapon: 'Unequipped',
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly
  });
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
  const definition = balanceProfileFromContext(
    context,
    event.spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
  );
  if (!definition) return;
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
    if (!active || Number(active.expiresAt || 0) <= event.at) continue;
    const definition = balanceProfileFromContext(
      context,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    if (!definition) continue;
    for (const key of keys) {
      const recipient = active.recipients?.[key];
      const internalCooldown = Number(definition.internalCooldown || 0);
      if (
        !recipient ||
        recipient.stacks <= 0 ||
        (internalCooldown > 0 && !isInternalCooldownReady(event.at, recipient.nextAt))
      ) {
        continue;
      }

      recipient.stacks -= 1;
      // Positive weapon-spell ICDs use the strict shared boundary; zero preserves unrestricted charge consumption.
      recipient.nextAt = event.at + internalCooldown;
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

    // Ritualist validates spirit generation and active-skill lockout before reusing Core's generic packet materializer.
    materializeNecromancerSummonAttack(context, event);
  },
  'necromancer.painful-bond': handleNecromancerPainfulBond,
  'necromancer.weapon-spell': handleNecromancerWeaponSpell,
  'necromancer.weapon-spell-ally-trigger': handleNecromancerWeaponSpellAllyTrigger
});
