import { WEAPON, ACTOR, AURA, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mesmerControlAccepted, mesmerHealCompleted } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import {
  mesmerProfessionActionCommitted,
  mesmerShatterResolved
} from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Successful F2 actions grant party Protection from the captured spend, excluding afterimage replays. */
export const illusionaryDefense = defineTrait<MesmerSkill>({
  id: TRAIT.ILLUSIONARY_DEFENSE,
  name: 'Illusionary Defense',
  triggers: [
    onTriggerPoint(mesmerProfessionActionCommitted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerProfessionActionCommitted>) => {
        if (input.slot === 2) grantIllusionaryDefense(runtime, input.skill, input.at, input.spent, input.delivery);
      }
    })
  ],
  balance: {
    durationPerTier: 2,
    maximumStacks: 3,
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.PROTECTION),
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  }
});

/** Scale the authored boon before duration bonuses; Virtuoso shares the live game's three-resource duration cap. */
function grantIllusionaryDefense(
  runtime: MesmerRuntime,
  skill: MesmerSkill,
  at: number,
  spent: number,
  delivery: EffectDelivery
): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ILLUSIONARY_DEFENSE);
  emitTraitProfile(runtime, TRAIT.ILLUSIONARY_DEFENSE, TRAIT.ILLUSIONARY_DEFENSE, undefined, {
    ...delivery,
    at,
    skillId: skill.id,
    skillName: skill.name,
    effect: { type: 'boon', name: boonKey(BOON.PROTECTION) },
    attribution: { actorType: ACTOR.PLAYER },
    transform: (event) => ({
      ...event,
      duration:
        Number(event.duration) +
        Math.min(spent, balanceProfileNumber(profile, 'maximumStacks')) *
          balanceProfileNumber(profile, 'durationPerTier')
    })
  });
}

/** Each committed shatter or instrument grants personal Stability and its slot's party boon once, regardless of hits. */
export const bountifulDisillusionment = defineTrait<MesmerSkill>({
  id: TRAIT.BOUNTIFUL_DISILLUSIONMENT,
  name: 'Bountiful Disillusionment',
  triggers: [
    {
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.shatter || cast.skill.instrument),
      run(runtime, cast) {
        const slot = cast.skill.shatter?.slot ?? cast.skill.instrument?.slot;
        const boon = [BOON.MIGHT, BOON.VIGOR, BOON.FURY, BOON.REGENERATION][(slot ?? 0) - 1];
        emitTraitProfile(runtime, TRAIT.BOUNTIFUL_DISILLUSIONMENT, TRAIT.BOUNTIFUL_DISILLUSIONMENT, undefined, {
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id,
          attribution: { actorType: ACTOR.PLAYER },
          effects: (effect) => effect.type === 'boon' && (effect.boon === BOON.STABILITY || effect.boon === boon)
        });
      }
    }
  ],
  balance: {
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.STABILITY),
        boon: BOON.STABILITY,
        duration: 1,
        stacks: 1,
        audience: { recipients: RECIPIENT.SELF }
      },
      {
        type: 'boon',
        name: boonKey(BOON.MIGHT),
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 3,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        name: boonKey(BOON.VIGOR),
        boon: BOON.VIGOR,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        name: boonKey(BOON.FURY),
        boon: BOON.FURY,
        duration: 6,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        name: boonKey(BOON.REGENERATION),
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  }
});

/** Own Chaotic Persistence tuning alongside its runtime behavior. */
export const chaoticPersistence = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_PERSISTENCE,
  name: 'Chaotic Persistence',
  balance: {
    expertiseBonus: 100,
    concentrationBonus: 250
  },
  attributes: ({ balanceContext, loadout }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.CHAOTIC_PERSISTENCE);
    // Regeneration enables both flat grants and their participation in utility and trait conversions.
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'expertiseBonus'),
          feedsConversions: 'all',
          enabled: loadout.assumptions.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'concentrationBonus'),
          feedsConversions: 'all',
          enabled: loadout.assumptions.regeneration !== false
        }
      ]
    };
  }
});

/** Each self Chaos Aura gain grants party Regeneration; other auras and summon-owned gains do not trigger it. */
export const chaoticTransference = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_TRANSFERENCE,
  name: 'Chaotic Transference',
  triggers: [
    {
      on: 'aura.applied',
      when: (_runtime, event) =>
        event.aura === AURA.CHAOS &&
        event.actorType === ACTOR.PLAYER &&
        (event.recipient == null || event.recipient === RECIPIENT.SELF),
      emit: TRAIT.CHAOTIC_TRANSFERENCE,
      attribution: { actorType: ACTOR.PLAYER }
    }
  ],
  balance: {
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.REGENERATION),
        boon: BOON.REGENERATION,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  }
});

/** Own Illusionary Membrane tuning alongside its runtime behavior. */
export const illusionaryMembrane = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterResolved, {
      run: (runtime: MesmerRuntime, { shatter, resolution }: TriggerPointInput<typeof mesmerShatterResolved>) =>
        grantShatterChaosAura(runtime, shatter?.slot, resolution.skill.name, resolution.at, resolution.delivery)
    }),
    // Instruments use their own completion path, but Flute is still the second profession skill.
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FLUSTERING_FLUTE,
      emit: TRAIT.ILLUSIONARY_MEMBRANE,
      effects: (effect) => effect.type === 'custom' && effect.name === AURA.CHAOS,
      attribution: { actorType: ACTOR.PLAYER }
    },
    {
      on: 'aura.applied',
      when: (_runtime, event) =>
        event.aura === AURA.CHAOS &&
        event.actorType === ACTOR.PLAYER &&
        (event.recipient == null || event.recipient === RECIPIENT.SELF),
      run: applyIllusionaryMembrane
    }
  ],
  id: TRAIT.ILLUSIONARY_MEMBRANE,
  name: 'Illusionary Membrane',
  balance: {
    conditionDamageIncrease: 0.07,
    maximumDuration: 15,
    effects: [
      { name: AURA.CHAOS, type: 'custom', eventType: 'aura', event: { aura: AURA.CHAOS, duration: 4 } },
      { name: 'illusionary-membrane', type: 'buff', kind: 'illusionary-membrane', duration: 5, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      id: 'mesmer.illusionary-membrane',
      requiresSelection: false,
      order: -1,
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE, 'conditionDamageIncrease'),
      when: (context) => buffActive(context, 'illusionary-membrane')
    }
  ]
});

/** Own Chaotic Interruption tuning alongside its runtime behavior. */
export const chaoticInterruption = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerControlAccepted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerControlAccepted>) =>
        triggerChaoticInterruption(runtime, input.event, input.event.skillName ?? input.event.name ?? 'Control effect')
    })
  ],
  id: TRAIT.CHAOTIC_INTERRUPTION,
  name: 'Chaotic Interruption',
  balance: {
    recharge: 5,
    internalCooldown: 1
  }
});

/** A completed heal invokes the storm; the skill owns its payload and Alacrity-adjusted recharge. */
export const methodOfMadness = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerHealCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerHealCompleted>) =>
        triggerMethodOfMadness(runtime, input.skill, input.at, input.delivery)
    })
  ],
  id: TRAIT.METHOD_OF_MADNESS,
  name: 'Method of Madness'
});

/**
 * Recharges the active weapon set's deterministic phantasm target when a
 * qualifying interrupt lands, evaluating cooldown state at the impact time.
 */
function triggerChaoticInterruption(context: MesmerRuntime, event: SimulationEvent, skillName: string): void {
  if (!context.config.target?.activatingSkills) {
    return;
  }

  const defiant = Boolean(context.config.target.defiant);
  const set = context.activeWeaponSet;
  const [configuredMainhand, configuredOffhand] = gw2ConfiguredWeaponSet(context.config, set);
  const [primaryMainhand, primaryOffhand] = gw2ConfiguredWeaponSet(context.config, 1);
  const mainhand = configuredMainhand || primaryMainhand;
  const offhand = configuredOffhand || primaryOffhand;

  let targetId: number | null = null;

  if (mainhand === WEAPON.STAFF) targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === WEAPON.PISTOL) targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === WEAPON.TORCH) targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = context.cooldownController.readyAt(targetId) || 0;

  if (!(readyAt > event.at)) return;

  const reduction = balanceNumberFromContext(context, TRAIT.CHAOTIC_INTERRUPTION, 'recharge');
  const target = context.helpers.skillsById.get(targetId);

  if (!target) return;

  // Only a defiant target consumes an interval, after a recharging weapon skill has been selected.
  if (defiant && !context.procs.claim(TRAIT.CHAOTIC_INTERRUPTION, TRAIT.CHAOTIC_INTERRUPTION, event.at)) return;

  context.cooldownController.reduceSkillRecharge(target, reduction, event.at);

  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.CHAOTIC_INTERRUPTION, actorType: ACTOR.EFFECT },
    announcement: {
      type: 'trait',
      name: 'Chaotic Interruption',
      at: event.at,
      sourceSkill: skillName,
      detail: `${context.helpers.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
    }
  });
}

/** F2 grants an aura after earlier shatter traits; aura acceptance owns the damage reward. */
function grantShatterChaosAura(
  context: MesmerRuntime,
  slot: number | undefined,
  skillName: string,
  at: number,
  delivery: EffectDelivery = {}
): void {
  if (slot !== 2) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE);

  if (!requireEffect(profile, 'custom', AURA.CHAOS)) return;

  const traitSource = {
    source: 'Trait',
    sourceId: TRAIT.ILLUSIONARY_MEMBRANE,
    actorType: ACTOR.PLAYER,
    skillId: TRAIT.ILLUSIONARY_MEMBRANE,
    skillName: profile.name
  };
  const proc = context.effects.emit({
    receipt: true,
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { ...traitSource, actorType: ACTOR.EFFECT },
    announcement: { type: 'trait', name: profile.name, at, sourceSkill: skillName, detail: '' }
  });
  // The aura settles after the same-time shatter packets under its original causal announcement.
  emitTraitProfile(context, TRAIT.ILLUSIONARY_MEMBRANE, TRAIT.ILLUSIONARY_MEMBRANE, proc, {
    ...delivery,
    at,
    effect: { type: 'custom', name: AURA.CHAOS },
    attribution: traitSource,
    transform: (event) => ({
      ...event,
      at,
      priority: 5,
      name: profile.name,
      ...traitSource,
      sourceSkill: skillName,
      duration: event.duration
    })
  });
}

/** Every accepted self Chaos Aura extends the damage window by five seconds, capped at fifteen remaining. */
function applyIllusionaryMembrane(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE);
  const buff = requireEffect(profile, 'buff', 'illusionary-membrane');

  if (!buff) return;

  const expiresAt = context.combat
    .buffApplications('illusionary-membrane')
    .reduce((latest, application) => Math.max(latest, application.expiresAt), event.at);
  const duration = Math.min(balanceProfileNumber(profile, 'maximumDuration'), expiresAt - event.at + buff.duration);
  emitTraitProfile(context, TRAIT.ILLUSIONARY_MEMBRANE, TRAIT.ILLUSIONARY_MEMBRANE, event, {
    effect: { type: 'buff', name: 'illusionary-membrane' },
    attribution: { actorType: ACTOR.PLAYER },
    transform: (packet) => ({ ...packet, duration })
  });
}

/** Emits Method of Madness at the owning healing-skill completion position. */
function triggerMethodOfMadness(
  context: MesmerRuntime,
  skill: MesmerSkill,
  at: number,
  delivery: EffectDelivery = {}
): void {
  if (skill.type !== 'Heal') return;

  const storm = context.helpers.skillsById.get(ID.LESSER_CHAOS_STORM)!;

  // The selected skill owns its recharge and surviving payload; no trait profile duplicates it.
  if (!storm.effects?.length || context.cooldownController.isOnCooldown(storm.id, context.time)) return;

  context.cooldownController.startRecharge(storm, context.time);
  invokeTraitSkill(
    context,
    TRAIT.METHOD_OF_MADNESS,
    storm.id,
    {
      type: 'action',
      at,
      source: 'Trait',
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      actorType: ACTOR.PLAYER
    },
    {
      cast: delivery.cast,
      attribution: { actorType: ACTOR.PLAYER },
      announce: true,
      announcementName: 'Method of Madness',
      logAnnouncement: true
    }
  );

  // Syncopate follows the accepted storm independently of diagnostic logging.
  if (context.profession.specialization.kind === 'Troubadour') context.schedule('mesmer.syncopate', at);
}
