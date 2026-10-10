import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  mesmerControlAccepted,
  mesmerHealCompleted
} from '#gw2/professions/mesmer/core/mechanics/combat-boundaries.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerStrikes, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerShatterResolved } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerProfiledTraitDamage } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

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
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'expertiseBonus'),
          feedsConversions: false,
          enabled: loadout.assumptions.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'concentrationBonus'),
          feedsConversions: false,
          enabled: loadout.assumptions.regeneration !== false
        }
      ]
    };
  }
});

/** Own Illusionary Membrane tuning alongside its runtime behavior. */
export const illusionaryMembrane = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterResolved, {
      run: (runtime: MesmerRuntime, { shatter, resolution }: TriggerPointInput<typeof mesmerShatterResolved>) =>
        triggerIllusionaryMembrane(runtime, shatter, resolution.skill.name, resolution.at, resolution.delivery)
    })
  ],
  id: TRAIT.ILLUSIONARY_MEMBRANE,
  name: 'Illusionary Membrane',
  balance: {
    conditionDamageIncrease: 0.07,
    effects: [{ name: 'illusionary-membrane', type: 'buff', kind: 'illusionary-membrane', duration: 15, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.illusionary-membrane',
      requiresSelection: false,
      order: -1,
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE),
          'conditionDamageIncrease'
        ),
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

/** Keep Method of Madness's authored attack and cooldown with its definition. */
export const methodOfMadness = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerHealCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerHealCompleted>) =>
        triggerMethodOfMadness(runtime, input.skill, input.at, methodOfMadnessDamage(runtime), input.delivery)
    })
  ],
  id: TRAIT.METHOD_OF_MADNESS,
  name: 'Method of Madness',
  // The lesser storm owns a skill recharge, including Chronomancer's stronger Alacrity.
  balance: {
    cooldownPolicy: 'playerRecharge',
    cooldown: 28,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 1.98 / 6 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
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
  if (mainhand === 'Staff') targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === 'Pistol') targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === 'Torch') targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = context.cooldownController.readyAt(targetId) || 0;
  if (!(readyAt > event.at)) return;
  const chaoticInterruptionProfile = requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_INTERRUPTION);
  const reduction = balanceProfileNumber(chaoticInterruptionProfile, 'recharge');
  const target = context.helpers.skillsById.get(targetId);
  if (!target) return;
  // Only a defiant target consumes an interval, after a recharging weapon skill has been selected.
  if (defiant && !context.procs.claim(TRAIT.CHAOTIC_INTERRUPTION, TRAIT.CHAOTIC_INTERRUPTION, event.at)) return;
  context.cooldownController.reduceSkillRecharge(target, reduction, event.at);

  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.CHAOTIC_INTERRUPTION, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Chaotic Interruption',
      at: event.at,
      sourceSkill: skillName,
      detail: `${context.helpers.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
    }
  });
}

/** Applies Illusionary Membrane after earlier post-resolution shatter traits. */
function triggerIllusionaryMembrane(
  context: MesmerRuntime,
  shatter: MesmerShatter | undefined,
  skillName: string,
  at: number,
  delivery: EffectDelivery = {}
): void {
  if (shatter?.slot !== 2) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE);
  if (!requireEffect(profile, 'buff', 'illusionary-membrane')) return;
  const traitSource = {
    source: 'Trait',
    sourceId: TRAIT.ILLUSIONARY_MEMBRANE,
    actorType: 'player' as const,
    skillId: TRAIT.ILLUSIONARY_MEMBRANE,
    skillName: profile.name
  };
  const proc = context.effects.emit({
    receipt: true,
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { ...traitSource, actorType: 'effect' },
    announcement: { type: 'trait', name: profile.name, at, sourceSkill: skillName, detail: '' }
  });
  // This stack settles after the same-time shatter packets under its original causal announcement.
  emitTraitProfile(context, TRAIT.ILLUSIONARY_MEMBRANE, TRAIT.ILLUSIONARY_MEMBRANE, proc, {
    ...delivery,
    at,
    effect: { type: 'buff', name: 'illusionary-membrane' },
    attribution: traitSource,
    transform: (event) => ({
      type: 'buff',
      at,
      priority: 5,
      name: profile.name,
      ...traitSource,
      sourceSkill: skillName,
      kind: event.kind,
      stacks: event.stacks,
      duration: event.duration
    })
  });
}

/** Emits Method of Madness at the owning healing-skill completion position. */
function triggerMethodOfMadness(
  context: MesmerRuntime,
  skill: MesmerSkill,
  at: number,
  storm: MesmerTraitDamage,
  delivery: EffectDelivery = {}
): void {
  if (skill.type !== 'Heal') return;
  // A removed storm has no attack, proc, or attack-owned cooldown.
  if (storm.type !== 'strike' || !context.procs.claim(TRAIT.METHOD_OF_MADNESS, TRAIT.METHOD_OF_MADNESS, at)) return;
  buildMesmerStrikes(
    context,
    {
      id: 'Lesser Chaos Storm',
      name: 'Lesser Chaos Storm',
      weapon: 'Utility',
      blade: false
    },
    at,
    {
      ...storm,
      summonKind: undefined,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      source: 'Player',
      weapon: 'utility'
    }
  ).forEach((packet) => {
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.METHOD_OF_MADNESS, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Method of Madness', at: at, sourceSkill: skill.name, detail: '' }
  });
  // Elite consequences follow the accepted mechanic, independently of its diagnostic marker.
  // Only Troubadour owns the delayed Syncopate consequence of this accepted heal.
  if (context.profession.specialization.kind === 'Troubadour') context.schedule('mesmer.syncopate', at);
}

/** Compile the selected storm before the shared runtime begins processing casts. */
export function methodOfMadnessDamage(context: unknown): MesmerTraitDamage {
  return mesmerProfiledTraitDamage(context, { requiresCooldown: true }, TRAIT.METHOD_OF_MADNESS);
}
