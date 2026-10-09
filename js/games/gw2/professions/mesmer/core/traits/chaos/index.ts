import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerStrikes, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerProfiledTraitDamage, mesmerTraitDamageProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Own Chaotic Persistence tuning alongside its runtime behavior. */
export const chaoticPersistence = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_PERSISTENCE,
  name: 'Chaotic Persistence',
  balance: {
    expertiseBonus: 100,
    concentrationBonus: 250
  },
  buildAttributes: (_common, { balanceContext, build }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.CHAOTIC_PERSISTENCE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'expertiseBonus'),
          feedsConversions: false,
          enabled: build.assumptions?.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'concentrationBonus'),
          feedsConversions: false,
          enabled: build.assumptions?.regeneration !== false
        }
      ]
    };
  }
});

/** Own Illusionary Membrane tuning alongside its runtime behavior. */
export const illusionaryMembrane = defineTrait<MesmerSkill>({
  id: TRAIT.ILLUSIONARY_MEMBRANE,
  name: 'Illusionary Membrane',
  balance: {
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
      amount: 0.07,
      when: (context) => buffActive(context, 'illusionary-membrane')
    }
  ]
});

/** Own Chaotic Interruption tuning alongside its runtime behavior. */
export const chaoticInterruption = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_INTERRUPTION,
  name: 'Chaotic Interruption',
  balance: {
    recharge: 5,
    internalCooldown: 1
  }
});

/** Keep Method of Madness's authored attack and cooldown with its definition. */
const lesserChaosStorm: MesmerTraitDamage = {
  // Each storm pulse is a distinct strike packet, not an aggregate hit count.
  ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 1.98 / 6 })),
  cooldown: 28
};

export const methodOfMadness = defineTrait<MesmerSkill>({
  id: TRAIT.METHOD_OF_MADNESS,
  name: 'Method of Madness',
  // The lesser storm owns a skill recharge, including Chronomancer's stronger Alacrity.
  profiles: [mesmerTraitDamageProfile(TRAIT.METHOD_OF_MADNESS, 'Method of Madness', lesserChaosStorm, 'playerRecharge')]
});

interface MethodOfMadnessContext {
  readonly state: MesmerRuntime;
}

/**
 * Recharges the active weapon set's deterministic phantasm target when a
 * qualifying interrupt lands, evaluating cooldown state at the impact time.
 */
export function triggerChaoticInterruption(context: MesmerRuntime, event: SimulationEvent, skillName: string): void {
  if (!hasTrait(context, TRAIT.CHAOTIC_INTERRUPTION) || !context.config.target?.activatingSkills) {
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
export function triggerIllusionaryMembrane(
  context: MesmerRuntime,
  shatter: MesmerShatter | undefined,
  skillName: string,
  at: number,
  delivery: EffectDelivery = {}
): void {
  if (shatter?.slot !== 2 || !hasTrait(context, TRAIT.ILLUSIONARY_MEMBRANE)) return;
  const illusionaryMembraneProfile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE);
  const effect = requireEffect(illusionaryMembraneProfile, 'buff', 'illusionary-membrane');
  if (!effect) return;
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        // Resolve after the same-time shatter packets without inventing elapsed time.
        priority: 5,
        kind: 'illusionary-membrane',
        stacks: Number(effect.stacks),
        duration: effect.duration
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.ILLUSIONARY_MEMBRANE,
      actorType: 'player' as const,
      skillId: TRAIT.ILLUSIONARY_MEMBRANE,
      skillName: traitProfile.name
    };
    const options: { detail?: string; announce?: boolean } = {};
    if (grants.length) {
      const proc =
        options.announce !== false
          ? context.effects.emit({
              receipt: true,
              ...delivery,
              kind: 'announcement',
              log: true,
              attribution: { ...traitSource, actorType: 'effect' },
              announcement: {
                type: 'trait',
                name: traitProfile.name,
                at: at,
                sourceSkill: skillName,
                detail: options.detail ?? ''
              }
            })
          : undefined;
      for (const grant of grants)
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          cause: proc,
          event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skillName }
        });
    }
  }
}

/** Emits Method of Madness at the owning healing-skill completion position. */
export function triggerMethodOfMadness(
  context: MethodOfMadnessContext,
  skill: MesmerSkill,
  at: number,
  storm: MesmerTraitDamage,
  delivery: EffectDelivery = {}
): void {
  if (skill.type !== 'Heal' || !hasTrait(context.state, TRAIT.METHOD_OF_MADNESS)) return;
  // A removed storm has no attack, proc, or attack-owned cooldown.
  if (storm.type !== 'strike' || !context.state.procs.claim(TRAIT.METHOD_OF_MADNESS, TRAIT.METHOD_OF_MADNESS, at))
    return;
  buildMesmerStrikes(
    context.state,
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
    context.state.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  context.state.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.METHOD_OF_MADNESS, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Method of Madness', at: at, sourceSkill: skill.name, detail: '' }
  });
  // Elite consequences follow the accepted mechanic, independently of its diagnostic marker.
  // Only Troubadour owns the delayed Syncopate consequence of this accepted heal.
  if (context.state.profession.specialization.kind === 'Troubadour') context.state.schedule('mesmer.syncopate', at);
}

/** Compile the selected storm before the shared runtime begins processing casts. */
export function methodOfMadnessDamage(context: unknown): MesmerTraitDamage {
  return mesmerProfiledTraitDamage(context, { requiresCooldown: true }, TRAIT.METHOD_OF_MADNESS);
}

/** Selection and fixed profile values share the parent attribute-query cache. */
export function prepareChaoticPersistence(context: Gw2ModifierContext) {
  const selected = hasTrait(context, TRAIT.CHAOTIC_PERSISTENCE);
  return {
    expertise: selected
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_PERSISTENCE), 'expertiseBonus')
      : 0,
    concentration: selected
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHAOTIC_PERSISTENCE), 'concentrationBonus')
      : 0
  };
}

/** Reconcile assumed Regeneration against its live state without applying the build bonus twice. */
export function chaoticPersistenceAttributes(
  context: Gw2ModifierContext,
  facts: ReturnType<typeof prepareChaoticPersistence>
) {
  const delta =
    Number(boonActive(context, 'regeneration')) -
    Number(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.regeneration));
  return { expertise: delta * facts.expertise, concentration: delta * facts.concentration };
}
