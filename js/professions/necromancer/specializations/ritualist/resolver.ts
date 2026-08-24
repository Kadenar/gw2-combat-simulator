import { ritualistState } from './state.js';
import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '../../data/ids.js';
import { handleNecromancerPainfulBond, handleNecromancerWeaponSpell } from './events.js';
import { materializeNecromancerSummonAttack } from '../../core/events.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '../../types.js';
import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Weapon-spell stacks are tracked per-recipient key; multi-summon events expand into one key per summon index
function recipientKeys(event: NecromancerResolverEvent): string[] {
  if (event.actorType === 'player') return ['player'];
  if (event.actorType !== 'summon') return [];
  if (event.summonOwnerBase && Number(event.summonCount || 0) > 1) {
    return Array.from({ length: Number(event.summonCount) }, (_, index) => `${event.summonOwnerBase}:${index}`);
  }

  return event.summonOwner ? [event.summonOwner] : [];
}

function spellIcon(context: NecromancerResolverContext, skillId: SkillId): string {
  return context.helpers.skillsById?.get(skillId)?.icon || '';
}

function queueNightmareWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile
): void {
  const strike = balanceProfileEffect(definition, 'strike');
  const vulnerability = balanceProfileEffect(definition, 'condition');
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

function queueSplinterWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile
): void {
  const strike = balanceProfileEffect(definition, 'strike');
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

export function handleNecromancerWeaponSpellAllyTrigger(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = necromancerBalanceProfile(
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

function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Effect-sourced damage (e.g. prior spell proc) must not chain into another proc; coefficient > 0 guards against flat-damage-only strikes
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const keys = recipientKeys(event);
  if (!keys.length) return;
  for (const spell of ['nightmare', 'splinter']) {
    const active = ritualistState.from(context).weaponSpells?.[spell];
    if (!active || Number(active.expiresAt || 0) <= event.at) continue;
    const definition = necromancerBalanceProfile(
      context,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    if (!definition) continue;
    for (const key of keys) {
      const recipient = active.recipients?.[key];
      if (!recipient || recipient.stacks <= 0 || recipient.nextAt > event.at) {
        continue;
      }

      recipient.stacks -= 1;
      // nextAt enforces an ICD so rapid multi-hit attacks cannot consume multiple stacks simultaneously
      recipient.nextAt = event.at + Number(definition.internalCooldown || 0);
      if (spell === 'nightmare') {
        queueNightmareWeapon(context, event, definition);
      } else {
        queueSplinterWeapon(context, event, definition);
      }
    }
  }
}

export const ritualistResolverEventReactions = Object.freeze({
  damage: reactToDamage
});

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
