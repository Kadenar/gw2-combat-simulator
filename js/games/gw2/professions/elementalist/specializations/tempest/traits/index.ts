import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import {
  auraAccepted,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import {
  tempestCastCompleted,
  tempestCastCompleting,
  tempestCastStarted,
  tempestTransitionObserved,
  type TempestTransition
} from '#gw2/professions/elementalist/specializations/tempest/mechanics/trigger-points.js';
import type {
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

export const galeSong = defineTrait({
  triggers: [
    onTriggerPoint(tempestCastCompleting, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyGaleSong(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.GALE_SONG,
  name: 'Gale Song',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const latentStamina = defineTrait({
  triggers: [
    onTriggerPoint(tempestTransitionObserved, {
      run: (runtime: ElementalistRuntime, { event, emissionCast }: TempestTransition) =>
        applyLatentStamina(runtime, event, emissionCast)
    })
  ],
  id: TRAIT.LATENT_STAMINA,
  name: 'Latent Stamina',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 3 }]
  }
});

export const tempestuousAria = defineTrait({
  triggers: [
    onTriggerPoint(tempestCastCompleted, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => cast.skill.skillFamily === 'Shout',
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyTempestShoutTraits(runtime, cast, cast.skill)
    }),
    onTriggerPoint(auraAccepted, { run: applyTempestuousAria })
  ],
  id: TRAIT.TEMPESTUOUS_ARIA,
  name: 'Tempestuous Aria',
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.05,
    // Each aura extends the damage buff by `durationMultiplier` seconds, capped `maximumStacks`
    // seconds past the triggering aura; `Shout Might` is the separate shout-completion payload.
    maximumStacks: 10,
    durationMultiplier: 5,
    effects: [{ type: 'boon', name: 'Shout Might', boon: 'might', stacks: 2, duration: 10 }]
  },
  modifierRules: [
    {
      id: 'elementalist.tempestuous-aria-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA), 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'tempestuous aria', 1) > 0
    },
    {
      id: 'elementalist.tempestuous-aria-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA),
          'conditionDamageIncrease'
        ),
      when: (context) => activeBuffStacks(context, 'tempestuous aria', 1) > 0
    }
  ]
});

export const invigoratingTorrents = defineTrait({
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistResolverContext, { cause }: ElementalistReaction) =>
        applyTempestAuraBoons(runtime, cause, TRAIT.INVIGORATING_TORRENTS, 'Invigorating Torrents')
    })
  ],
  id: TRAIT.INVIGORATING_TORRENTS,
  name: 'Invigorating Torrents',
  balance: {
    effects: [
      { type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Regeneration', boon: 'regeneration', stacks: 1, duration: 5 }
    ]
  }
});

export const elementalBastion = defineTrait({
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistResolverContext, { cause }: ElementalistReaction) =>
        applyTempestAuraBoons(runtime, cause, TRAIT.ELEMENTAL_BASTION, 'Elemental Bastion')
    })
  ],
  id: TRAIT.ELEMENTAL_BASTION,
  name: 'Elemental Bastion',
  balance: {
    effects: [{ type: 'boon', name: 'Alacrity', boon: 'alacrity', stacks: 1, duration: 4 }]
  }
});

export const unstableConduit = defineTrait({
  triggers: [
    onTriggerPoint(tempestCastCompleting, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => Boolean(cast.skill.overload),
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyUnstableConduit(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.UNSTABLE_CONDUIT,
  name: 'Unstable Conduit',
  balance: {
    // One entry per attunement: the completing overload looks its aura duration up by
    // attunement name, so the effect `name` is the lookup key rather than the aura's name.
    effects: [
      {
        type: 'buff',
        name: 'Fire',
        kind: 'Fire Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Water',
        kind: 'Frost Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Air',
        kind: 'Shocking Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Earth',
        kind: 'Magnetic Aura',
        stacks: 1,
        duration: 4
      }
    ]
  }
});

export const gatheredFocus = defineTrait({
  id: TRAIT.GATHERED_FOCUS,
  name: 'Gathered Focus',
  balance: {
    attributeBonus: 240
  },
  attributes: traitAttributeEffects(TRAIT.GATHERED_FOCUS, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const hardyConduit = defineTrait({
  id: TRAIT.HARDY_CONDUIT,
  name: 'Hardy Conduit',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARDY_CONDUIT,
      effects: (effect) => effect.type === 'boon' && ['Protection'].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Hardy Conduit',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillName: 'Hardy Conduit',
        name: 'Hardy Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const harmoniousConduit = defineTrait({
  id: TRAIT.HARMONIOUS_CONDUIT,
  name: 'Harmonious Conduit',
  balance: {
    effects: [
      { type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 8 },
      { type: 'boon', name: 'Stability', boon: 'stability', stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARMONIOUS_CONDUIT,
      effects: (effect) => effect.type === 'boon' && ['Swiftness', 'Stability'].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Harmonious Conduit',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillName: 'Harmonious Conduit',
        name: 'Harmonious Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const transcendentTempest = defineTrait({
  id: TRAIT.TRANSCENDENT_TEMPEST,
  name: 'Transcendent Tempest',
  balance: {
    damageIncrease: 0.25,
    conditionDamageIncrease: 0.2,
    // Completion grants the timed damage-bonus status from this profile.
    effects: [{ type: 'buff', name: 'Transcendent Tempest', kind: 'transcendent-tempest', duration: 7, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'elementalist.transcendent-tempest-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TRANSCENDENT_TEMPEST), 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'transcendent-tempest', 1) > 0
    },
    {
      id: 'elementalist.transcendent-tempest-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.TRANSCENDENT_TEMPEST),
          'conditionDamageIncrease'
        ),
      when: (context) => activeBuffStacks(context, 'transcendent-tempest', 1) > 0
    }
  ],
  triggers: [
    {
      emit: TRAIT.TRANSCENDENT_TEMPEST,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      // Apply before final overload packets and same-time completion strikes.
      attribution: (_runtime, cast) => ({
        source: 'Transcendent Tempest',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: 'Transcendent Tempest',
        priority: -10,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const lucidSingularity = defineTrait({
  triggers: [
    onTriggerPoint(tempestCastStarted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyLucidSingularity(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.LUCID_SINGULARITY,
  name: 'Lucid Singularity',
  balance: {
    // At most `maximumStacks` overload hits pulse alacrity; the last of them uses `Final Alacrity`.
    maximumStacks: 5,
    effects: [
      { type: 'boon', name: 'Pulse Alacrity', boon: 'alacrity', stacks: 1, duration: 1 },
      { type: 'boon', name: 'Final Alacrity', boon: 'alacrity', stacks: 1, duration: 4.5 }
    ]
  }
});
/** Register tempest traits in their existing execution order. */
export const tempestTraits = [
  galeSong,
  latentStamina,
  unstableConduit,
  gatheredFocus,
  hardyConduit,
  tempestuousAria,
  harmoniousConduit,
  invigoratingTorrents,
  transcendentTempest,
  lucidSingularity,
  elementalBastion
];

/** Aura acceptance refreshes the selected damage window before the later boon listeners. */
function applyTempestuousAria(context: ElementalistResolverContext, { cause: event }: ElementalistReaction): void {
  const tempestuousAriaProfile = requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA);
  const extension = balanceProfileNumber(tempestuousAriaProfile, 'durationMultiplier');
  const maximum = balanceProfileNumber(tempestuousAriaProfile, 'maximumStacks');
  // Extend the newest live application instead of stacking a second one, clamping the new expiry
  // to the maximum window measured from this aura; with none live, start a fresh application.
  const current = activeElementalistBuffs(context, 'Tempestuous Aria', event.at).at(-1);
  const expiresAt = current ? Math.min(event.at + maximum, current.expiresAt + extension) : event.at + extension;
  if (current) {
    refreshElementalistBuffs(context, 'Tempestuous Aria', event.at, (previousExpiry) =>
      previousExpiry === current.expiresAt ? expiresAt : previousExpiry
    );
  } else {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.TEMPESTUOUS_ARIA,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA).name,
        kind: 'Tempestuous Aria'.toLowerCase(),
        stacks: 1,
        duration: extension,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
  }

  // Preserve each extension's deadline so cursor snapshots do not read a stale initial buff duration.
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Tempestuous Aria',
      at: event.at,
      sourceSkill: resolverSourceSkill(event),
      detail: '',
      icon: '',
      cooldownReduction: null,
      expiresAt: expiresAt
    }
  });
}

/** Emit the selected aura boon package after its owning trait has passed the shared selection gate. */
function applyTempestAuraBoons(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
  traitId: number,
  trait: 'Invigorating Torrents' | 'Elemental Bastion'
): void {
  // Aura acceptance chooses the owner; shared materialization supplies the surviving boon package.
  const emitted = emitTraitProfile(context, traitId, traitId, undefined, {
    at: event.at,
    fullEnd: event.at,
    durationContext: event,
    effects: (effect) => effect.type === 'boon',
    attribution: {
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, traitId).name,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    },
    transform: (packet) => ({ ...packet, name: requireBalanceProfileFromContext(context, traitId).name }),
    receipt: true
  });
  if (emitted.length)
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: trait, at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
}

/** Shout rewards stay at committed completion after overload-specific work. */
function applyTempestShoutTraits(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // Keep the party reward at this committed shout's completion while reusing named profile emission.
  emitTraitProfile(context, TRAIT.TEMPESTUOUS_ARIA, TRAIT.TEMPESTUOUS_ARIA, undefined, {
    at: cast.effectiveEnd,
    fullEnd: cast.effectiveEnd,
    effect: { type: 'boon', name: 'Shout Might' },
    skillId: skill.id,
    skillName: skill.name,
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.TEMPESTUOUS_ARIA,
      actorType: 'player',
      name: skill.name,
      priority: 0,
      audience: { recipients: 'party', maximumRecipients: 5 }
    }
  });
}

/** Committed heals receive Gale Song before overload-specific completion work. */
function applyGaleSong(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (skill.type === 'Heal')
    emitTraitProfile(context, TRAIT.GALE_SONG, TRAIT.GALE_SONG, undefined, {
      at: cast.effectiveEnd,
      fullEnd: cast.effectiveEnd,
      effect: { type: 'boon', name: 'Protection' },
      skillId: skill.id,
      skillName: 'Gale Song',
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: { source: 'Trait', sourceId: TRAIT.GALE_SONG, actorType: 'player', name: 'Gale Song', priority: 0 }
    });
}

/** Water entry claims the ICD even when a preview removes the optional Vigor effect. */
function applyLatentStamina(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  if (event.type === 'elementalist.attunement' && event.to === 'Water') {
    if (context.procs.claim(TRAIT.LATENT_STAMINA, 'elementalist.tempest.latentStamina', event.at)) {
      const latentStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.LATENT_STAMINA);
      const vigor = requireEffect(latentStaminaProfile, 'boon', 'Vigor');
      const sourceId = event.skillId ?? event.sourceId;
      if (vigor) {
        emitTraitProfile(context, TRAIT.LATENT_STAMINA, TRAIT.LATENT_STAMINA, undefined, {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'boon', name: 'Vigor' },
          cast: emissionCast,
          attribution: {
            source: 'Latent Stamina',
            sourceId: sourceId,
            actorType: 'player',
            skillName: 'Latent Stamina',
            skillId: elementalistEventSkill(context, 'Latent Stamina', sourceId).id,
            name: 'Latent Stamina'
          }
        });
      }
    }

    return;
  }
}

/** Schedule alacrity from accepted overload hits before packet emission, retaining shortened-channel behavior. */
function applyLucidSingularity(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (!skill.overload) return;
  const lucidSingularityProfile = requireBalanceProfileFromContext(context, TRAIT.LUCID_SINGULARITY);
  const hits = (skill.effects ?? [])
    .flatMap((effect) =>
      materializeSkillEffectApplications({
        skill,
        effect: scaleCastBoundTiming(cast, skill, effect),
        start: cast.start,
        fullEnd: cast.fullEnd,
        baseEvent: {
          source: 'elementalist',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        }
      })
    )
    .map((application) => application.event)
    .filter(
      (event) =>
        event.type === 'damage' &&
        Number(event.coefficient) > 0 &&
        // Reuse the engine's commitment decision so the surviving storm retains its alacrity pulses.
        (!cast.cancelled || event.at <= cast.effectiveEnd)
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, balanceProfileNumber(lucidSingularityProfile, 'maximumStacks'));
  hits.forEach((event, index: number) => {
    const effectName = index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity';
    emitTraitProfile(context, TRAIT.LUCID_SINGULARITY, TRAIT.LUCID_SINGULARITY, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'boon', name: effectName },
      skillId: skill.id,
      skillName: 'Lucid Singularity',
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.LUCID_SINGULARITY,
        actorType: 'player',
        name: 'Lucid Singularity',
        priority: 0
      }
    });
  });
}

/** The completing overload's aura precedes the same-time overload packet and Fire-exit proc. */
function applyUnstableConduit(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const attunement = String(skill.attunement);
  {
    const aura =
      attunement === 'Fire'
        ? 'Fire Aura'
        : attunement === 'Water'
          ? 'Frost Aura'
          : attunement === 'Air'
            ? 'Shocking Aura'
            : 'Magnetic Aura';
    const unstableConduitProfile = requireBalanceProfileFromContext(context, TRAIT.UNSTABLE_CONDUIT);
    const unstableConduitAttunement = requireEffect(unstableConduitProfile, 'buff', attunement);
    if (unstableConduitAttunement) {
      applyElementalistAura(context, {
        at: cast.effectiveEnd,
        aura,
        duration: unstableConduitAttunement.duration,
        skillName: 'Unstable Conduit',
        sourceId: skill.id,
        // The completion aura precedes the same-time Overload packet.
        priority: -20
      });
    }
  }
}
