import { AURA, ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { elementalEmpowermentAttributes } from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import {
  catalystCombatStarted,
  catalystTransitionObserved,
  sphereDeployed
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/trigger-points.js';
import { catalystState, type CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  CATALYST_BASE_EMPOWERMENT_TASK,
  applyCatalystEmpowerment,
  renewBaseEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
import { sphereSpecialistDuration } from '#gw2/professions/elementalist/specializations/catalyst/traits/spheres.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Owns Empowering Auras tuning and its existing execution behavior. */
const empoweringAuras = defineTrait({
  id: TRAIT.EMPOWERING_AURAS,
  name: 'Empowering Auras',
  // New aura rewards obey activation isolation; accepted stacks still retain their lifetime.
  triggers: [{ on: 'aura.applied', run: applyEmpoweringAura }],
  lifetime: { reactions: { 'buff.applied': applyEmpoweringAurasBuff } },
  balance: {
    maximumStacks: 5,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01,
    conditionDamageIncreasePerStack: 0.01
  },
  // The trait balance owns the shared cap and independent damage rates; modifiers only apply them.
  modifierRules: [
    {
      id: 'elementalist.empowering-auras-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
        return (
          Math.min(balanceProfileNumber(profile, 'maximumStacks'), empoweringAuraStacks(context)) *
          balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      }
    },
    {
      id: 'elementalist.empowering-auras-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
        return (
          Math.min(balanceProfileNumber(profile, 'maximumStacks'), empoweringAuraStacks(context)) *
          balanceProfileNumber(profile, 'conditionDamageIncreasePerStack')
        );
      }
    }
  ]
});
/** Owns Elemental Epitome tuning and its existing execution behavior. */
const elementalEpitome = defineTrait({
  id: TRAIT.ELEMENTAL_EPITOME,
  name: 'Elemental Epitome',
  // Aura and combo admission share selection without sharing their independent eligibility rules.
  triggers: [
    { on: 'aura.applied', run: applyEpitomeAura },
    { on: 'combo.resolved', run: applyEpitomeCombo }
  ],
  balance: {
    internalCooldown: 10,
    effects: [
      aura('Fire', AURA.FIRE, 4),
      aura('Water', AURA.FROST, 4),
      aura('Air', AURA.SHOCKING, 3),
      aura('Earth', AURA.MAGNETIC, 3),
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 1,
        duration: 15
      }
    ]
  }
});
/** Owns Elemental Synergy tuning and its existing execution behavior. */
const elementalSynergy = defineTrait({
  id: TRAIT.ELEMENTAL_SYNERGY,
  name: 'Elemental Synergy',
  // Per-element combo rewards are admitted only while trait producers are enabled.
  triggers: [{ on: 'combo.resolved', run: applySynergyCombo }],
  balance: {
    internalCooldown: 10,
    resourceGain: 50,
    effects: [boon('Fire', boonKey(BOON.MIGHT), 6, 10), boon('Earth', boonKey(BOON.STABILITY), 2, 6)]
  }
});
/** Shares the existing Elemental Empowerment profile's scaling fields without duplicating patch targets. */
const empoweredEmpowerment = defineTrait({ id: TRAIT.EMPOWERED_EMPOWERMENT, name: 'Empowered Empowerment' });
/** Owns Elemental Empowerment tuning and its existing execution behavior. */
const elementalEmpowerment = defineTrait({
  attributes: elementalEmpowermentAttributes,
  id: TRAIT.ELEMENTAL_EMPOWERMENT,
  name: 'Elemental Empowerment',
  balance: {
    maximumStacks: 10,
    playerStacks: 3,
    durationMultiplier: 15,
    attributePerStack: 0.01,
    coefficientMultiplier: 0.015,
    attributeConversion: 0.2
  },
  // Admit one renewal loop at combat entry; scheduled renewals belong to the admitted lifetime.
  triggers: [
    onTriggerPoint(catalystCombatStarted, {
      run(runtime: ElementalistRuntime) {
        const state = catalystState.from(runtime);

        if (state.elementalEmpowermentRefreshStarted) return;

        state.elementalEmpowermentRefreshStarted = true;
        renewBaseEmpowerment(runtime);
      }
    })
  ],
  lifetime: {
    reactions: { 'buff.applied': applyCatalystEmpowerment },
    // Permanent base stacks renew in the background, without extending an isolated damage observation.
    backgroundTasks: [CATALYST_BASE_EMPOWERMENT_TASK],
    tasks: { [CATALYST_BASE_EMPOWERMENT_TASK]: renewBaseEmpowerment }
  }
});

/** Owns Vicious Empowerment tuning and its existing execution behavior. */
export const viciousEmpowerment = defineTrait({
  id: TRAIT.VICIOUS_EMPOWERMENT,
  name: 'Vicious Empowerment',
  // Both qualifying inputs use the same selected producer and cooldown claim.
  triggers: [
    { on: 'control.resolved', run: applyViciousEmpowerment },
    { on: 'condition.applied', run: applyViciousEmpowerment }
  ],
  balance: {
    internalCooldown: 0.25,
    effects: [
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 2,
        duration: 15
      },
      boon(BOON.MIGHT, boonKey(BOON.MIGHT), 2, 10)
    ]
  }
});
/** Unlocks Catalyst; the energy resource profile owns its capacity. */
const depthOfElements = defineTrait({
  id: TRAIT.DEPTH_OF_ELEMENTS,
  name: 'Depth of Elements'
});
/** Owns Energized Elements tuning and its existing execution behavior. */
const energizedElements = defineTrait({
  triggers: [
    onTriggerPoint(catalystTransitionObserved, {
      run: (runtime: ElementalistRuntime, { event }: { readonly event: SimulationEvent }) => {
        applyEnergizedElements(runtime, event);
      }
    })
  ],
  id: TRAIT.ENERGIZED_ELEMENTS,
  name: 'Energized Elements',
  balance: {
    resourceGain: 2,
    effects: [boon(BOON.FURY, boonKey(BOON.FURY), 1, 2)]
  }
});
/** Owns Spectacular Sphere tuning and its existing execution behavior. */
const spectacularSphere = defineTrait({
  triggers: [
    onTriggerPoint(sphereDeployed, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applySphereStartTraits(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.SPECTACULAR_SPHERE,
  name: 'Spectacular Sphere',
  balance: {
    effects: [
      boon(BOON.QUICKNESS, boonKey(BOON.QUICKNESS), 1, 2),
      boon('Fire', boonKey(BOON.MIGHT), 5, 10),
      boon('Water', boonKey(BOON.VIGOR), 1, 5),
      boon('Air', boonKey(BOON.FURY), 1, 5),
      boon('Earth', boonKey(BOON.AEGIS), 1, 3)
    ]
  }
});
/** Owns Sphere Specialist tuning and its existing execution behavior. */
const sphereSpecialist = defineTrait({
  id: TRAIT.SPHERE_SPECIALIST,
  name: 'Sphere Specialist',
  balance: {
    durationMultiplier: 1.5
  }
});

/** Register catalyst traits in their existing execution order. */
export const catalystTraits = [
  depthOfElements,
  viciousEmpowerment,
  energizedElements,
  elementalEmpowerment,
  empoweringAuras,
  spectacularSphere,
  elementalEpitome,
  elementalSynergy,
  empoweredEmpowerment,
  sphereSpecialist
];

/** Sphere traits observe the deployment after its intrinsic start action and before ordinary packet emission. */
function applySphereStartTraits(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // Spectacular Sphere pays party quickness plus the attunement's boon on deployment.
  // Sphere Specialist scales these procedural payouts once, separately from authored sphere packets.

  const durationMultiplier = sphereSpecialistDuration(context);
  const spectacularSphereProfile = requireBalanceProfileFromContext(context, TRAIT.SPECTACULAR_SPHERE);
  const quickness = requireEffect(spectacularSphereProfile, 'boon', BOON.QUICKNESS);

  if (quickness) {
    emitTraitProfile(context, TRAIT.SPECTACULAR_SPHERE, TRAIT.SPECTACULAR_SPHERE, undefined, {
      at: cast.start,
      fullEnd: cast.start,
      effect: { type: 'boon', name: BOON.QUICKNESS },
      // Sphere traits scale the authored base duration before the live boon-duration transaction.
      transform: (packet) => ({ ...packet, duration: Number(packet.duration) * durationMultiplier }),
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: {
        source: skill.name,
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillName: skill.name,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        skillId: skill.id,
        name: skill.name
      }
    });
  }

  const profiledBoon = requireEffect(spectacularSphereProfile, 'boon', String(skill.attunement));

  if (profiledBoon) {
    emitTraitProfile(context, TRAIT.SPECTACULAR_SPHERE, TRAIT.SPECTACULAR_SPHERE, undefined, {
      at: cast.start,
      fullEnd: cast.start,
      effect: { type: 'boon', name: String(skill.attunement) },
      transform: (packet) => ({ ...packet, duration: Number(packet.duration) * durationMultiplier }),
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: {
        source: skill.name,
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillName: skill.name,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        skillId: skill.id,
        name: skill.name
      }
    });
  }
}

function applyEnergizedElements(context: ElementalistRuntime, event: SimulationEvent): boolean {
  // Energized Elements refunds energy and grants fury on every attunement swap.
  if (event.type === 'elementalist.attunement') {
    const state = catalystState.from(context);
    const before = context.resourceController.value('catalystEnergy');
    const energizedElementsProfile = requireBalanceProfileFromContext(context, TRAIT.ENERGIZED_ELEMENTS);
    const energyGain = balanceProfileNumber(energizedElementsProfile, 'resourceGain');
    // Report only the capped gain while preserving energy, Fury, then resource-observation ordering.
    context.resourceController.grant('catalystEnergy', energyGain);
    const after = context.resourceController.value('catalystEnergy');
    const fury = requireEffect(energizedElementsProfile, 'boon', BOON.FURY);

    if (fury) {
      emitTraitProfile(context, TRAIT.ENERGIZED_ELEMENTS, TRAIT.ENERGIZED_ELEMENTS, undefined, {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'boon', name: BOON.FURY },
        attribution: {
          source: 'Energized Elements',
          sourceId: event.sourceId,
          actorType: ACTOR.PLAYER,
          skillName: 'Energized Elements',
          skillId: elementalistEventSkill(context, 'Energized Elements', event.sourceId).id,
          name: 'Energized Elements'
        }
      });
    }

    if (after !== before) {
      context.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          type: 'resource',
          at: event.at,
          source: 'Energized Elements',
          sourceId: event.sourceId,
          actorType: ACTOR.PLAYER,
          skillName: 'Energized Elements',
          kind: 'catalyst-energy',
          value: after,
          maximum: state.catalystEnergy.maximum,
          change: after - before
        }
      });
    }

    return true;
  }

  return false;
}

/** Refresh Empowering Auras before Epitome grants an empowerment stack from the same aura. */
function applyEmpoweringAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const { maximumStacks, duration } = empoweringAurasParameters(context);
  const state = catalystState.from(context);
  const activeStacks = activeRefreshedStacks(state.empoweringAuras, event.at, 'exclusive');
  // Refresh survivors now, including at cap; new stacks still arrive at their queued buff-application boundary.
  const expiresAt = gw2EffectExpiresAt(event.at, duration);
  state.empoweringAuras = grantRefreshedStacks(
    state.empoweringAuras,
    0,
    event.at,
    expiresAt,
    maximumStacks,
    'exclusive'
  );

  if (activeStacks < maximumStacks) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.EMPOWERING_AURAS,
        actorType: ACTOR.PLAYER,
        skillName: requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS).name,
        kind: 'Empowering Auras'.toLowerCase(),
        stacks: 1,
        duration: duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
  }

  // Report refreshes even at the cap, where no new gameplay stack is granted.
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Empowering Auras',
      at: event.at,
      sourceSkill: resolverSourceSkill(event),
      detail: '',
      icon: '',
      cooldownReduction: null,
      expiresAt
    }
  });
}

/** Aura acceptance grants Epitome stacks only after combat starts. */
function applyEpitomeAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  // Only accepted combat auras grant the profiled stack; expiry and stack tracking remain with the buff owner.
  if (context.engagement.startTime != null && event.at < context.engagement.startTime) return;

  emitTraitProfile(context, TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_EPITOME, undefined, {
    at: event.at,
    fullEnd: event.at,
    durationContext: event,
    effect: { type: 'buff', name: 'Empowerment' },
    attribution: {
      actorType: ACTOR.PLAYER,
      skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME).name,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    },
    transform: (packet) => ({
      ...packet,
      name: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME).name
    })
  });
}

/** Epitome claims its per-element combo interval before emitting the selected aura. */
function applyEpitomeCombo(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  const attunement = core.primaryAttunement;

  if (
    context.procs.claimCooldown(
      `elementalist.catalyst.elementalEpitome:${attunement}`,
      event.at,
      balanceNumberFromContext(context, TRAIT.ELEMENTAL_EPITOME, 'internalCooldown')
    )
  ) {
    const aura = elementalEpitomeAura(context, attunement);

    if (aura) {
      applyElementalistAura(context, {
        at: event.at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: 'Elemental Epitome',
        sourceId: event.skillId ?? event.sourceId
      });
      context.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Elemental Epitome',
          at: event.at,
          sourceSkill: resolverSourceSkill(event)
        }
      });
    }
  }
}

/** Synergy follows Epitome on an independent per-element combo interval. */
function applySynergyCombo(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  const attunement = core.primaryAttunement;

  if (
    context.procs.claimCooldown(
      `elementalist.catalyst.elementalSynergy:${attunement}`,
      event.at,
      balanceNumberFromContext(context, TRAIT.ELEMENTAL_SYNERGY, 'internalCooldown')
    )
  ) {
    if (attunement === 'Fire' || attunement === 'Earth') {
      emitTraitProfile(context, TRAIT.ELEMENTAL_SYNERGY, TRAIT.ELEMENTAL_SYNERGY, undefined, {
        at: event.at,
        fullEnd: event.at,
        durationContext: event,
        effect: { type: 'boon', name: attunement },
        attribution: {
          actorType: ACTOR.PLAYER,
          skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY).name,
          triggeredBy: resolverSourceSkill(event),
          priority: Number(event.priority || 0)
        },
        transform: (packet) => ({
          ...packet,
          name: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY).name
        })
      });
    } else if (attunement === 'Air') {
      context.endurance.grant(balanceNumberFromContext(context, TRAIT.ELEMENTAL_SYNERGY, 'resourceGain'));
    }

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Elemental Synergy', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Resolves the shared aura defaults; the resolver retains its canonical attunement identity. */
function elementalEpitomeAura(context: unknown, attunement: ElementalistAttunement) {
  const elementalEpitomeProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME);
  const effect = requireEffect(elementalEpitomeProfile, 'buff', attunement);

  if (!effect) return undefined;

  return { aura: String(effect.kind), duration: effect.duration };
}

/**
 * Trigger Vicious Empowerment from qualifying control or immobilize events while
 * enforcing its shared internal cooldown.
 *
 * Pays Elemental Empowerment stacks plus might, and ignores anything landing
 * before combat start.
 */
function applyViciousEmpowerment(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const immobilize = event.condition === CONDITION.IMMOBILIZED;

  if (
    event.actorType !== ACTOR.PLAYER ||
    (event.type !== 'control' && !immobilize) ||
    (context.engagement.startTime != null && event.at < context.engagement.startTime)
  ) {
    return;
  }

  // The trait claims its interval independently of its optional buff packets.
  if (!context.procs.claim(TRAIT.VICIOUS_EMPOWERMENT, 'elementalist.catalyst.viciousEmpowerment', event.at)) return;

  // The claim gates the whole reward, including independently removable Might and empowerment.
  emitTraitProfile(context, TRAIT.VICIOUS_EMPOWERMENT, TRAIT.VICIOUS_EMPOWERMENT, undefined, {
    at: event.at,
    fullEnd: event.at,
    durationContext: event,
    effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
    attribution: {
      actorType: ACTOR.PLAYER,
      skillName: requireBalanceProfileFromContext(context, TRAIT.VICIOUS_EMPOWERMENT).name,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    },
    transform: (packet) => ({
      ...packet,
      name: requireBalanceProfileFromContext(context, TRAIT.VICIOUS_EMPOWERMENT).name
    })
  });

  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Vicious Empowerment', at: event.at, sourceSkill: event.skillName }
  });
}

/** Accepted self buffs add to the same refreshed pool, including isolated preview inputs. */
export function applyEmpoweringAurasBuff(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'empowering auras' || !event.resolvedAudience?.includesSelf) return;

  const state = catalystState.from(context);
  const { maximumStacks } = empoweringAurasParameters(context);
  state.empoweringAuras = grantRefreshedStacks(
    state.empoweringAuras,
    event.stacks || 1,
    event.at,
    gw2EffectExpiresAt(event.at, event.duration || 0),
    maximumStacks,
    'exclusive'
  );
}

/** Strike and condition modifiers read the canonical Catalyst pool without replaying buff receipts. */
export function empoweringAuraStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<CatalystState>(context.runtime?.profession, 'Catalyst');
  return activeRefreshedStacks(state?.empoweringAuras, context.time, 'exclusive');
}

/** Shares aura-stack parameters while each phase retains its grant and refresh rules. */
function empoweringAurasParameters(context: unknown) {
  const empoweringAurasProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
  return {
    maximumStacks: balanceProfileNumber(empoweringAurasProfile, 'maximumStacks'),
    duration: balanceProfileNumber(empoweringAurasProfile, 'durationMultiplier')
  };
}

/** Builds a named boon packet for the trait's selected balance profile. */
function boon(name: string, boonName: string, stacks: number, duration: number): SkillEffect {
  return { type: 'boon', name, boon: boonName, stacks, duration };
}

/** Builds a single aura grant for trait-owned effect declarations. */
function aura(name: string, auraName: string, duration: number): SkillEffect {
  return { type: 'buff', name, kind: auraName, stacks: 1, duration };
}
