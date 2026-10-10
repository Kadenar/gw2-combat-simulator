import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { appendChargeGrant, consumeChargeBatch, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedEffectRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import { necromancerStrike } from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { necromancerPassivesInitialized } from '#gw2/professions/necromancer/core/mechanics/passives.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { TasteForBloodGrant } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { TRAITS as NECROMANCER_TRAITS } from '#gw2/professions/necromancer/data/traits-data.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Grant Last Rites' full-health Healing Power once in either build or raw runtime attributes. */
export const lastRites = defineTrait({
  id: TRAIT.LAST_RITES,
  name: 'Last Rites',
  balance: { attributeBonus: 150 },
  buildAttributes: traitAttributeEffects(TRAIT.LAST_RITES, [
    { kind: 'flat', to: 'Healing Power', field: 'attributeBonus', feedsConversions: true }
  ]),
  modifierRules: [
    {
      id: 'necromancer.last-rites-healing-power',
      target: MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LAST_RITES), 'attributeBonus'),
      when: (context) => !professionStaticRulesApplied(context.config)
    }
  ]
});

/** Owns Vampiric tuning and behavior at its existing execution boundaries. */
export const vampiric = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyVampiric(runtime, input.event)
    })
  ],
  id: TRAIT.VAMPIRIC,
  name: 'Vampiric',
  balance: {
    effects: [
      {
        name: 'player',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 38,
        flatStrikePowerCoeff: 0.003,
        actorType: 'effect',
        packetLabel: 'player',
        canCrit: false,
        damageKind: 'life-steal'
      },
      {
        name: 'minion',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 50,
        flatStrikePowerCoeff: 0.0213,
        actorType: 'effect',
        packetLabel: 'minion',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Vampiric Presence tuning and behavior at its existing execution boundaries. */
export const vampiricPresence = defineTrait({
  triggers: [
    onTriggerPoint(necromancerPassivesInitialized, { run: startNecromancerAlliedOpportunities }),
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyVampiricPresence(runtime, input.event)
    })
  ],
  id: TRAIT.VAMPIRIC_PRESENCE,
  name: 'Vampiric Presence',
  balance: {
    cooldown: 0.5,
    // Vampiric Aura pulses on a free-running 3 s clock; the first in-combat pulse lands at its expected phase.
    auraPulseInterval: 3,
    effects: [
      {
        name: 'base',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 65,
        flatStrikePowerCoeff: 0.0333,
        actorType: 'effect',
        packetLabel: 'base',
        canCrit: false,
        damageKind: 'life-steal'
      },
      {
        name: 'shroud',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 129,
        flatStrikePowerCoeff: 0.0666,
        actorType: 'effect',
        packetLabel: 'shroud',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Overflowing Thirst tuning and behavior at its existing execution boundaries. */
export const overflowingThirst = defineTrait({
  // Cast admission starts charges; accepted applications and their consumption remain lifetime work.
  triggers: [{ on: 'castStart', run: applyOverflowingThirstCast }],
  lifetime: {
    reactions: {
      'buff.applied'(runtime, event) {
        if (event.kind === 'taste-for-blood') reactToTasteForBloodGrant(runtime, event);
      },
      'damage.resolved'(runtime, event) {
        if (event.actorType !== 'effect' && Number(event.coefficient) > 0) applyOverflowingThirstDamage(runtime, event);
      }
    }
  },
  id: TRAIT.OVERFLOWING_THIRST,
  name: 'Overflowing Thirst',
  balance: {
    minimumStacks: 1,
    effects: [
      {
        name: 'taste-for-blood',
        type: 'buff',
        kind: 'taste-for-blood',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 375,
        flatStrikePowerCoeff: 0.05,
        hits: 1,
        actorType: 'effect',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Transfusion tuning and behavior at its existing execution boundaries. */
export const transfusion = defineTrait({
  id: TRAIT.TRANSFUSION,
  name: 'Transfusion',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.8, hits: 1 },
      { name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 2, duration: 4 },
      { name: 'Chilled', type: 'condition', condition: 'Chilled', stacks: 1, duration: 2 }
    ]
  },
  triggers: [
    ...(['Strike', 'Poisoned', 'Chilled'] as const).map<
      Extract<
        NonNullable<import('#gw2/platform/profession-definition/traits.js').TraitDefinition['triggers']>[number],
        { on: 'castCommit' }
      >
    >((name) => ({
      order: 2,
      on: 'castCommit' as const,
      when: (_runtime, cast) => cast.skill.shroudSlot === 4,
      emit: TRAIT.TRANSFUSION,
      effects: (effect) => effect.type === (name === 'Strike' ? 'strike' : 'condition') && effect.name === name,
      attribution: (runtime, cast) => ({
        skillId: ID.LESSER_CHILBLAINS,
        skillName: 'Lesser Chilblains',
        name: name === 'Strike' ? 'Lesser Chilblains' : `Lesser Chilblains — ${name}`,
        parentSkillName: cast.skill.name,
        icon: runtime.helpers.skillsById.get(ID.CHILLBLAINS)?.icon,
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }))
  ]
});

/** A completed combat dodge triggers its mark at the landing position, without an internal cooldown. */
export const markOfEvasion = defineTrait({
  id: TRAIT.MARK_OF_EVASION,
  name: 'Mark of Evasion',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.33, hits: 1 },
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8 },
      {
        name: 'Regeneration',
        type: 'boon',
        boon: 'regeneration',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      on: 'castCommit',
      when: (runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE && runtime.combatStartedAt(),
      emit: TRAIT.MARK_OF_EVASION,
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Lesser Mark of Blood',
        name: 'Lesser Mark of Blood',
        skillWeapon: 'Unequipped',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

/** Extend the swarm and its swiftness while increasing siphon base damage, leaving Power scaling unchanged. */
export const bansheesWail = defineTrait({
  id: TRAIT.BANSHEES_WAIL,
  name: "Banshee's Wail",
  balance: { pulseInterval: 0.5, durationMultiplier: 1.5 },
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (cast.skill.id !== ID.LOCUST_SWARM || !hasTrait(runtime, TRAIT.BANSHEES_WAIL)) return effects;
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.BANSHEES_WAIL);
      const multiplier = balanceProfileNumber(profile, 'durationMultiplier');
      const pulseIntervalMs = balanceProfileNumber(profile, 'pulseInterval') * 1000;
      return effects.map((effect) => {
        if (effect.type === 'boon') return { ...effect, duration: effect.duration * multiplier };
        if (effect.type !== 'strike' || !effect.ticks?.length) return effect;
        const ticks = effect.ticks;
        const last = ticks[ticks.length - 1]!;
        return {
          ...effect,
          flatStrikeBase: Math.floor((effect.flatStrikeBase ?? 0) * multiplier),
          ticks: Array.from(
            { length: Math.round(ticks.length * multiplier) },
            (_, index) =>
              ticks[index] ?? {
                ...last,
                // Extend after the native swarm so faster trait pulses cannot advance damage or life force.
                atMs: quantizeGw2ActionDurationUp(last.atMs + (index - ticks.length + 1) * pulseIntervalMs)
              }
          )
        };
      });
    }
  }
});

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
  context.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: event.at,
      skillName: name,
      coefficient: 0,
      flatStrikeBase,
      flatStrikePowerCoeff,

      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillWeapon: 'Unequipped',
      canCrit: false,
      damageKind: 'life-steal',
      ...(icon ? { icon } : {}),
      ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
      triggeredBy: event.skillName
    })
  });
  // Mirror the scheduled packet in result-level trait attribution.
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: name, at: event.at, sourceSkill: event.skillName, detail: '', icon: icon }
  });
}

// Both packet variants explicitly use the granting trait's artwork so the
// minion variant cannot fall back to the icon of the attack that triggered it.
const VAMPIRIC_ICON = NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.VAMPIRIC)?.icon || '';

/** Applies Vampiric to qualifying player, minion, and Ritualist spirit strikes. */
function applyVampiric(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const summonHit = event.actorType === 'summon';
  const minionHit = summonHit && event.summonKind !== 'spirit';
  if (event.actorType !== 'player' && !summonHit) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.VAMPIRIC);
  // Player and minion siphons are separately named, so removing one never borrows the other's values.
  const effect = requireEffect(profile, 'strike', minionHit ? 'minion' : 'player');
  if (!effect) return;
  queueBloodMagicLifeSteal(context, event, {
    name: minionHit ? 'Vampiric — Minion Life Steal' : 'Vampiric',
    traitId: TRAIT.VAMPIRIC,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff'),
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
  const owner = event.summonOwner || '';
  if (owner && recipients.companionIds.includes(owner)) return owner;
  if (!owner && recipients.companionIds.length > 0) {
    return `summon:${String(event.sourceId || event.skillId || event.skillName || 'unknown')}`;
  }

  return null;
}

// While the necromancer is in a Necromancer Shroud form (not the Lich Form transform), every recipient's siphon,
// including allies and minions, uses the stronger packet. In-game chat confirms it (221 vs 112); arcdps logs
// record the base value for these life-steal events, so their siphon amounts cannot verify this.
function vampiricPresenceDamage(
  context: NecromancerResolverContext,
  profile: BalanceProfile
): TraitDamageDefinition | undefined {
  const state = professionCoreState(context);
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  const effect = requireEffect(profile, 'strike', inShroud ? 'shroud' : 'base');
  // A removed packet produces no siphon; callers decide whether a recipient cooldown can be spent.
  if (!effect) return;
  return {
    name: 'Vampiric Presence',
    traitId: TRAIT.VAMPIRIC_PRESENCE,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff')
  };
}

/**
 * Vampiric Presence siphons only under Vampiric Aura. In game the aura pulses every 3 s on a clock anchored to
 * character or map load, applies only in combat, and never lapses once up, so the first pulse lands a random
 * 0-3 s after engagement. The simulation places it at the expected half interval after combat start.
 */
function vampiricAuraActive(
  context: Pick<NecromancerResolverContext, 'combatStartTime' | 'combatStartPending'>,
  profile: BalanceProfile,
  at: number
): boolean {
  if (context.combatStartPending) return false;
  const firstPulse = (context.combatStartTime ?? 0) + balanceProfileNumber(profile, 'auraPulseInterval') / 2;
  return canonicalTime(at) >= canonicalTime(firstPulse);
}

function applyVampiricPresence(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const actorKey = vampiricPresenceActorKey(context, event);
  // Ineligible effects do no balance lookup; eligible actors resolve their live profile only once.
  if (!actorKey) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.VAMPIRIC_PRESENCE);
  if (!vampiricAuraActive(context, profile, event.at)) return;
  const damage = vampiricPresenceDamage(context, profile);
  if (!damage) return;
  const key = actorKey === 'self' ? 'necromancer.core.vampiricPresence' : `vampiricPresence:${actorKey}`;
  // Player and companion hits keep independent cooldowns. In-game logs bracket the ICD at (498, 500] ms
  // with a proc exactly at +0.5 s, so a hit on the deadline is eligible.
  if (canonicalTime(event.at) < canonicalTime(context.procs.deadline(key))) return;
  context.procs.setDeadline(key, event.at + balanceProfileNumber(profile, 'cooldown'));
  queueBloodMagicLifeSteal(context, event, damage);
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
): TasteForBloodGrant {
  const grants = professionCoreState(context).tasteForBloodGrants;
  const application = {
    ...grantCharges(Math.max(1, event.stacks ?? 1), canonicalTime(event.at + Math.max(0, event.duration || 0))),
    at: canonicalTime(event.at)
  };
  grants[recipient] = appendChargeGrant(grants[recipient] ?? [], application, event.at, 'insertion');
  // Even an immediately expired application retains its own identity when registering its allied window.
  return application;
}

// Trait-derived Taste for Blood packets and proc markers keep Overflowing
// Thirst artwork so attribution matches the mechanic that granted the stacks.
const OVERFLOWING_THIRST_ICON = NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon || '';

/**
 * Consumes a recipient charge as Taste for Blood's power-only life-steal packet. Charges exist only to deliver the
 * siphon, so a removed strike leaves them unspent.
 */
function consumeTasteForBlood(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  recipient: string,
  application?: TasteForBloodGrant
): boolean {
  const profile = requireBalanceProfileFromContext(context, TRAIT.OVERFLOWING_THIRST);
  const effect = requireEffect(profile, 'strike', 'Strike');
  // Application time remains owner metadata: future grants cannot pay for an earlier hit.
  const grants = professionCoreState(context).tasteForBloodGrants[recipient] ?? [];
  // Stable grant identity keeps each allied callback bound to its own application instead of borrowing a sibling.
  if (
    !effect ||
    !consumeChargeBatch(grants, event.at, (grant) => grant.at <= event.at && (!application || grant === application))
  )
    return false;
  // Taste for Blood is a power-only life siphon, so armor and weapon strength
  // must not enter its flat base plus Power damage formula.
  queueBloodMagicLifeSteal(context, event, {
    name: 'Taste for Blood',
    traitId: TRAIT.OVERFLOWING_THIRST,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff'),
    icon: OVERFLOWING_THIRST_ICON
  });
  return true;
}

/** Gives each selected player or minion its own expiring stack application. */
function reactToTasteForBloodGrant(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.resolvedAudience?.includesSelf) addTasteForBloodApplication(context, event, 'self');
  context.alliedStrikes.registerRecipients(
    (allyIndex) => {
      const recipient = alliedTasteForBloodRecipient(allyIndex);
      const added = addTasteForBloodApplication(context, event, recipient);
      return {
        id: `taste-for-blood:${event.eventOrder}:${event.at}:${allyIndex}`,
        // Matching finite batches retain their individual cause even when application times coincide.
        expiresAt: added.expiresAt,
        isActive: () => added.charges > 0,
        consumptionGroup: 'taste-for-blood',
        trigger(opportunity) {
          return consumeTasteForBlood(
            context,
            {
              ...event,
              type: 'proc',
              at: opportunity.at,
              skillName: `Allied Player ${allyIndex} Attack`,
              allyIndex,
              activationId: opportunity.activationId
            },
            recipient,
            added
          );
        }
      };
    },
    {
      maximumAllies: event.resolvedAudience?.alliedPlayerCount ?? 0,
      alliedPlayerIndex: event.resolvedAudience?.alliedPlayerIndex
    }
  );

  for (const companionId of event.resolvedAudience?.companionIds || []) {
    addTasteForBloodApplication(context, event, companionTasteForBloodRecipient(companionId));
  }
}

function applyOverflowingThirstDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const recipient =
    event.actorType === 'player'
      ? 'self'
      : event.actorType === 'summon' && event.summonOwner
        ? companionTasteForBloodRecipient(event.summonOwner)
        : null;
  if (recipient) consumeTasteForBlood(context, event, recipient);
}

const TASTE_FOR_BLOOD_SKILLS = new Set<number>([
  ID.NECROTIC_BITE,
  ID.LIFE_SIPHON,
  ID.DARK_PACT,
  ID.DEATHLY_SWARM,
  ID.ENFEEBLING_BLOOD
]);

/** Dagger activations deliver party charges before player, minion, and allied hits spend their individual pools. */
function applyOverflowingThirstCast(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  if (!TASTE_FOR_BLOOD_SKILLS.has(Number(cast.skill.id)) || !hasTrait(runtime, TRAIT.OVERFLOWING_THIRST)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.OVERFLOWING_THIRST);
  const buff = requireEffect(profile, 'buff', 'taste-for-blood');
  if (!buff) return;
  emitTraitProfile(runtime, TRAIT.OVERFLOWING_THIRST, TRAIT.OVERFLOWING_THIRST, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'buff', name: 'taste-for-blood' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.OVERFLOWING_THIRST,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
      }
    },
    preserveName: true,
    // The autoattack grants the smaller balance amount; other dagger skills use the authored buff stacks.
    transform: (packet) => ({
      ...packet,
      stacks:
        cast.skill.id === ID.NECROTIC_BITE
          ? balanceProfileNumber(profile, 'minimumStacks')
          : effectNumber(profile, buff, 'stacks')
    })
  });
}

/** Persistent trait listeners consume the common ally strike without maintaining independent clocks. */
function startNecromancerAlliedOpportunities(runtime: NecromancerRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.VAMPIRIC_PRESENCE);
  runtime.alliedStrikes.registerRecipients((allyIndex) => ({
    id: `necromancer.vampiric-presence:${allyIndex}`,
    internalCooldown: balanceProfileNumber(profile, 'cooldown'),
    trigger(opportunity) {
      // Allies share the player's aura pulse; strikes before it neither siphon nor spend the recipient ICD.
      if (!vampiricAuraActive(runtime, profile, opportunity.at)) return false;
      const damage = vampiricPresenceDamage(runtime, profile);
      if (!damage) return false;
      queueBloodMagicLifeSteal(
        runtime,
        {
          type: 'proc',
          at: opportunity.at,
          source: 'Trait',
          sourceId: TRAIT.VAMPIRIC_PRESENCE,
          actorType: 'effect',
          skillName: `Allied Player ${allyIndex} Attack`,
          allyIndex,
          activationId: opportunity.activationId
        },
        damage
      );
    }
  }));
}
