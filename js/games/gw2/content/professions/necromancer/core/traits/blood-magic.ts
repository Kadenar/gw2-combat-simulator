/** Owns imperative Core Necromancer Blood Magic trait behavior for ordered dispatcher calls. */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedEffectRecipients, gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import { TRAITS as NECROMANCER_TRAITS } from '#gw2/content/professions/necromancer/data/traits-data.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/content/professions/necromancer/types.js';

interface TraitDamageDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly flatStrikeBase: number;
  readonly flatStrikePowerCoeff: number;
  readonly icon?: string;
}

/** Queues a flat life-steal trait packet and records matching proc attribution. */
function queueBloodMagicLifeSteal(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, flatStrikeBase, flatStrikePowerCoeff, icon }: TraitDamageDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillWeapon: 'Unequipped',
    noCrit: true,
    damageKind: 'life-steal',
    ...(icon ? { icon } : {}),
    ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
    triggeredBy: event.skillName
  });
  // Mirror the scheduled packet in result-level trait attribution.
  context.recordProc?.('trait', name, event.at, event.skillName, '', icon);
}

// Both packet variants explicitly use the granting trait's artwork so the
// minion variant cannot fall back to the icon of the attack that triggered it.
const VAMPIRIC_ICON = String(NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.VAMPIRIC)?.icon || '');

/** Applies Vampiric to qualifying player, minion, and Ritualist spirit strikes. */
export function applyVampiric(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC)) return;
  const summonHit = event.actorType === 'summon';
  const minionHit = summonHit && event.summonKind !== 'spirit';
  if (event.actorType !== 'player' && !summonHit) return;

  const profile = balanceProfileFromContext(context, PROFILE.vampiric);
  const packetLabel = minionHit ? 'minion' : 'player';
  const effect = profile?.effects?.find(
    (candidate) => candidate.type === 'strike' && candidate.packetLabel === packetLabel
  );
  queueBloodMagicLifeSteal(context, event, {
    name: minionHit ? 'Vampiric — Minion Life Steal' : 'Vampiric',
    traitId: TRAIT.VAMPIRIC,
    flatStrikeBase: Number(effect?.flatStrikeBase || (minionHit ? 50 : 38)),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff || (minionHit ? 0.0213 : 0.003)),
    icon: VAMPIRIC_ICON
  });
}

/** Maps a player, spirit, or selected minion hit to its independent Vampiric Presence cooldown owner. */
function vampiricPresenceActorKey(context: NecromancerResolverContext, event: NecromancerResolverEvent): string | null {
  // Spirit attacks are owner-attributed and share the player's proc interval;
  // ordinary minions remain independent capped allied recipients.
  if (event.actorType === 'player' || (event.actorType === 'summon' && event.summonKind === 'spirit')) return 'self';
  if (event.actorType !== 'summon') return null;
  const recipients = gw2AlliedEffectRecipients(context.config, {
    recipients: 'party',
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(context)
  });
  const owner = String(event.summonOwner || '');
  if (owner && recipients.companionIds.includes(owner)) return owner;
  if (!owner && recipients.companionIds.length > 0) {
    return `summon:${String(event.sourceId || event.skillId || event.skillName || 'unknown')}`;
  }

  return null;
}

// Vampiric Presence has a per-recipient interval and swaps to its stronger
// packet only for real Necromancer Shroud forms; Lich Form is a transform.
function queueVampiricPresence(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  actorKey: string,
  intervalAlreadyApplied = false
): void {
  // Select the live shroud packet and recipient-owned cooldown before materializing the life steal.
  const profile = balanceProfileFromContext(context, PROFILE.vampiricPresence);
  const state = professionCoreState(context);
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  const packetLabel = inShroud ? 'shroud' : 'base';
  const effect = profile?.effects?.find(
    (candidate) => candidate.type === 'strike' && candidate.packetLabel === packetLabel
  );
  const readyAt =
    actorKey === 'self'
      ? Number(state.vampiricPresenceReadyAt || 0)
      : Number(state.traitProcReadyAt[`vampiricPresence:${actorKey}`] || 0);
  if (!intervalAlreadyApplied && !isInternalCooldownReady(event.at, readyAt)) return;

  if (!intervalAlreadyApplied) {
    const nextAt = event.at + Number(profile?.cooldown ?? 0.5);
    if (actorKey === 'self') state.vampiricPresenceReadyAt = nextAt;
    else state.traitProcReadyAt[`vampiricPresence:${actorKey}`] = nextAt;
  }

  // Both player and allied-recipient paths converge on the same attributed packet.
  queueBloodMagicLifeSteal(context, event, {
    name: 'Vampiric Presence',
    traitId: TRAIT.VAMPIRIC_PRESENCE,
    flatStrikeBase: Number(effect?.flatStrikeBase ?? (inShroud ? 129 : 65)),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff ?? (inShroud ? 0.0666 : 0.0333))
  });
}

export function applyVampiricPresence(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  const actorKey = vampiricPresenceActorKey(context, event);
  if (actorKey) queueVampiricPresence(context, event, actorKey);
}

/** Applies an allied player's pre-materialized Vampiric Presence proc. */
export function reactToVampiricPresenceAlliedHit(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  queueVampiricPresence(context, event, `ally:${Number(event.allyIndex || 0)}`, true);
}

// Taste for Blood uses generic buff reporting while profession-owned pools
// preserve independent charge consumption for every affected recipient.
function consumeTasteForBloodBuff(context: NecromancerResolverContext, recipient: string, at: number): boolean {
  const buffs = professionCoreState(context).tasteForBloodBuffs;
  const applications = buffs[recipient] || [];
  const index = applications.findIndex(
    (application) => application.at <= at && application.expiresAt > at && application.stacks > 0
  );
  if (index < 0) return false;

  const application = applications[index];
  if (application.stacks === 1) {
    applications.splice(index, 1);
  } else {
    applications[index] = { ...application, stacks: application.stacks - 1 };
  }

  buffs[recipient] = applications;
  return true;
}

function alliedTasteForBloodRecipient(allyIndex: number): string {
  return `ally:${allyIndex}`;
}

function companionTasteForBloodRecipient(companionId: string): string {
  return `companion:${companionId}`;
}

/** Adds one expiring Taste for Blood application to an independent recipient pool. */
function addTasteForBloodApplication(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  recipient: string
): void {
  const buffs = professionCoreState(context).tasteForBloodBuffs;
  const applications = (buffs[recipient] || []).filter(
    (application) => application.expiresAt > event.at && application.stacks > 0
  );
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1))
  });
  buffs[recipient] = applications;
}

// Trait-derived Taste for Blood packets and proc markers keep Overflowing
// Thirst artwork so attribution matches the mechanic that granted the stacks.
const OVERFLOWING_THIRST_ICON = String(
  NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon || ''
);

/** Consumes a recipient charge as Taste for Blood's power-only life-steal packet. */
function queueTasteForBlood(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.overflowingThirst), 'strike');
  // Taste for Blood is a power-only life siphon, so armor and weapon strength
  // must not enter its 375 + 0.05 * Power damage formula.
  queueBloodMagicLifeSteal(context, event, {
    name: 'Taste for Blood',
    traitId: TRAIT.OVERFLOWING_THIRST,
    flatStrikeBase: Number(effect?.flatStrikeBase ?? 375),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff ?? 0.05),
    icon: OVERFLOWING_THIRST_ICON
  });
}

/** Gives each selected player or minion its own expiring stack application. */
export function reactToTasteForBloodGrant(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  if (event.resolvedAudience?.includesSelf) addTasteForBloodApplication(context, event, 'self');
  for (let allyIndex = 1; allyIndex <= Number(event.resolvedAudience?.alliedPlayerCount || 0); allyIndex += 1) {
    addTasteForBloodApplication(context, event, alliedTasteForBloodRecipient(allyIndex));
  }

  for (const companionId of event.resolvedAudience?.companionIds || []) {
    addTasteForBloodApplication(context, event, companionTasteForBloodRecipient(companionId));
  }
}

/** An allied hit consumes only that ally's Taste for Blood stack pool. */
export function reactToTasteForBloodAlliedHit(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const allyIndex = Number(event.allyIndex || 0);
  if (!allyIndex || !consumeTasteForBloodBuff(context, alliedTasteForBloodRecipient(allyIndex), event.at)) return;
  queueTasteForBlood(context, event);
}

export function applyOverflowingThirstDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const recipient =
    event.actorType === 'player'
      ? 'self'
      : event.actorType === 'summon' && event.summonOwner
        ? companionTasteForBloodRecipient(String(event.summonOwner))
        : null;
  if (
    hasTrait(context, TRAIT.OVERFLOWING_THIRST) &&
    recipient &&
    consumeTasteForBloodBuff(context, recipient, event.at)
  ) {
    queueTasteForBlood(context, event);
  }
}

const TASTE_FOR_BLOOD_STACKS_BY_SKILL = new Map<number, number>([
  [ID.NECROTIC_BITE, 1],
  [ID.LIFE_SIPHON, 3],
  [ID.DARK_PACT, 3],
  [ID.DEATHLY_SWARM, 3],
  [ID.ENFEEBLING_BLOOD, 3]
]);

/** Grants Taste for Blood before the activating dagger skill can spend those party stacks. */
export function applyOverflowingThirst(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const stacks = TASTE_FOR_BLOOD_STACKS_BY_SKILL.get(Number(skill.id));
  if (!stacks) return;

  const buff = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.overflowingThirst), 'buff');
  const duration = Number(buff?.duration || 10);
  // Resolve the exact self, allied-player, and active-minion recipients for this grant.
  const selected = gw2BuffApplicationRecipients(context.config, {
    audience: {
      recipients: 'party',
      maximumRecipients: 5,
      eligibleCompanionIds: necromancerActiveMinionCompanionIds(context)
    }
  });
  const audience = {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: selected.companionIds
  };
  // Emit both the visible buff and the profession event that seeds per-recipient charge pools.
  emitSkillBuff(context, skill, {
    at: context.start,
    kind: String(buff?.kind || 'taste-for-blood'),
    duration,
    stacks,
    audience
  });
  context.emit({
    type: 'necromancer.taste-for-blood-grant',
    at: context.start,
    source: 'Trait',
    sourceId: TRAIT.OVERFLOWING_THIRST,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    duration,
    stacks,
    resolvedAudience: selected
  });
}

/** Applies Transfusion's Lesser Chilblains package after a shroud-slot-four cast. */
export function applyTransfusion(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (skill.shroudSlot !== 4 || !hasTrait(context, TRAIT.TRANSFUSION)) return;
  const lesserChilblainsIcon = String(context.catalog.skillsById.get(ID.CHILLBLAINS)?.icon || '');
  emitSkillDamage(context, skill, {
    at: context.effectiveEnd,
    name: 'Lesser Chilblains',
    source: 'Trait',
    sourceId: TRAIT.TRANSFUSION,
    actorType: 'effect',
    skillId: ID.LESSER_CHILBLAINS,
    skillName: 'Lesser Chilblains',
    parentSkillName: skill.name,
    triggeredBy: skill.name,
    coefficient: 1.8,
    skillWeapon: 'Unequipped',
    icon: lesserChilblainsIcon
  });
  emitSkillCondition(context, skill, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.TRANSFUSION,
    actorType: 'effect',
    skillId: ID.LESSER_CHILBLAINS,
    skillName: 'Lesser Chilblains',
    parentSkillName: skill.name,
    triggeredBy: skill.name,
    name: 'Lesser Chilblains - Poisoned',
    condition: 'Poisoned',
    stacks: 2,
    duration: 4,
    icon: lesserChilblainsIcon
  });
  context.emit({
    type: 'necromancer.chill',
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.TRANSFUSION,
    actorType: 'effect',
    skillId: skill.id,
    skillName: 'Lesser Chilblains',
    duration: 2
  });
}
