import { RECIPIENT, AURA, ACTOR, BOON } from '#gw2/platform/constants.js';
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
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
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

// Singularity is intrinsic to Tempest; overload readiness reads its selected dwell even without an explicit minor ID.
const singularity = defineTrait({
  name: 'Singularity',
  id: TRAIT.SINGULARITY,
  balance: { duration: 6, effects: [] }
});

const galeSong = defineTrait({
  name: 'Gale Song',
  id: TRAIT.GALE_SONG,
  balance: {
    effects: [
      {
        type: 'boon',
        name: BOON.PROTECTION,
        boon: BOON.PROTECTION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 3
      }
    ]
  },
  triggers: [
    onTriggerPoint(tempestCastCompleting, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyGaleSong(runtime, cast, cast.skill)
    })
  ]
});

const latentStamina = defineTrait({
  name: 'Latent Stamina',
  id: TRAIT.LATENT_STAMINA,
  balance: {
    internalCooldown: 10,
    effects: [
      {
        type: 'boon',
        name: BOON.VIGOR,
        boon: BOON.VIGOR,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 3
      }
    ]
  },
  triggers: [
    onTriggerPoint(tempestTransitionObserved, {
      run: (runtime: ElementalistRuntime, { event, emissionCast }: TempestTransition) =>
        applyLatentStamina(runtime, event, emissionCast)
    })
  ]
});

const tempestuousAria = defineTrait({
  name: 'Tempestuous Aria',
  id: TRAIT.TEMPESTUOUS_ARIA,
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.05,
    // Each aura extends the damage buff by `durationExtension` seconds, capped `maximumStacks`
    // seconds past the triggering aura; `Shout Might` is the separate shout-completion payload.
    maximumStacks: 10,
    durationExtension: 5,
    effects: [{ type: 'boon', name: 'Shout Might', boon: BOON.MIGHT, stacks: 2, duration: 10 }]
  },
  modifierRules: [
    {
      id: 'elementalist.tempestuous-aria-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.TEMPESTUOUS_ARIA, 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'tempestuous aria', 1) > 0
    },
    {
      id: 'elementalist.tempestuous-aria-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.TEMPESTUOUS_ARIA, 'conditionDamageIncrease'),
      when: (context) => activeBuffStacks(context, 'tempestuous aria', 1) > 0
    }
  ],
  triggers: [
    onTriggerPoint(tempestCastCompleted, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => cast.skill.skillFamily === 'Shout',
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyTempestShoutTraits(runtime, cast, cast.skill)
    }),
    onTriggerPoint(auraAccepted, { run: applyTempestuousAria })
  ]
});

const invigoratingTorrents = defineTrait({
  name: 'Invigorating Torrents',
  id: TRAIT.INVIGORATING_TORRENTS,
  balance: {
    effects: [
      { type: 'boon', name: BOON.VIGOR, boon: BOON.VIGOR, stacks: 1, duration: 5 },
      { type: 'boon', name: BOON.REGENERATION, boon: BOON.REGENERATION, stacks: 1, duration: 5 }
    ]
  },
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistResolverContext, { cause }: ElementalistReaction) =>
        applyTempestAuraBoons(runtime, cause, TRAIT.INVIGORATING_TORRENTS, 'Invigorating Torrents')
    })
  ]
});

const elementalBastion = defineTrait({
  name: 'Elemental Bastion',
  id: TRAIT.ELEMENTAL_BASTION,
  balance: {
    effects: [{ type: 'boon', name: BOON.ALACRITY, boon: BOON.ALACRITY, stacks: 1, duration: 4 }]
  },
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistResolverContext, { cause }: ElementalistReaction) =>
        applyTempestAuraBoons(runtime, cause, TRAIT.ELEMENTAL_BASTION, 'Elemental Bastion')
    })
  ]
});

const unstableConduit = defineTrait({
  name: 'Unstable Conduit',
  id: TRAIT.UNSTABLE_CONDUIT,
  balance: {
    // One entry per attunement: the completing overload looks its aura duration up by
    // attunement name, so the effect `name` is the lookup key rather than the aura's name.
    effects: [
      {
        type: 'aura',
        name: 'Fire',
        aura: AURA.FIRE,
        duration: 4
      },
      {
        type: 'aura',
        name: 'Water',
        aura: AURA.FROST,
        duration: 4
      },
      {
        type: 'aura',
        name: 'Air',
        aura: AURA.SHOCKING,
        duration: 4
      },
      {
        type: 'aura',
        name: 'Earth',
        aura: AURA.MAGNETIC,
        duration: 4
      }
    ]
  },
  triggers: [
    onTriggerPoint(tempestCastCompleting, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => Boolean(cast.skill.overload),
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyUnstableConduit(runtime, cast, cast.skill)
    })
  ]
});

const gatheredFocus = defineTrait({
  name: 'Gathered Focus',
  id: TRAIT.GATHERED_FOCUS,
  balance: {
    attributeBonuses: { concentration: 240 }
  },
  attributes: traitAttributeEffects(TRAIT.GATHERED_FOCUS, [
    { kind: 'flat', to: 'Concentration', feedsConversions: 'none' }
  ])
});

const hardyConduit = defineTrait({
  name: 'Hardy Conduit',
  id: TRAIT.HARDY_CONDUIT,
  balance: {
    effects: [
      {
        type: 'boon',
        name: BOON.PROTECTION,
        boon: BOON.PROTECTION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 3
      }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARDY_CONDUIT,
      effects: (effect) => effect.type === 'boon' && [BOON.PROTECTION].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Hardy Conduit',
        sourceId: cast.skill.id,
        actorType: ACTOR.PLAYER,
        skillName: 'Hardy Conduit',
        name: 'Hardy Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

const harmoniousConduit = defineTrait({
  name: 'Harmonious Conduit',
  id: TRAIT.HARMONIOUS_CONDUIT,
  balance: {
    effects: [
      { type: 'boon', name: BOON.SWIFTNESS, boon: BOON.SWIFTNESS, stacks: 1, duration: 8 },
      { type: 'boon', name: BOON.STABILITY, boon: BOON.STABILITY, stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARMONIOUS_CONDUIT,
      effects: (effect) =>
        effect.type === 'boon' && [BOON.SWIFTNESS, BOON.STABILITY].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Harmonious Conduit',
        sourceId: cast.skill.id,
        actorType: ACTOR.PLAYER,
        skillName: 'Harmonious Conduit',
        name: 'Harmonious Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

const transcendentTempest = defineTrait({
  name: 'Transcendent Tempest',
  id: TRAIT.TRANSCENDENT_TEMPEST,
  balance: {
    // Shortened singularity dwell, separate from the damage buff's seven-second lifetime.
    duration: 4,
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
      amount: (context) => balanceNumberFromContext(context, TRAIT.TRANSCENDENT_TEMPEST, 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'transcendent-tempest', 1) > 0
    },
    {
      id: 'elementalist.transcendent-tempest-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.TRANSCENDENT_TEMPEST, 'conditionDamageIncrease'),
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
        actorType: ACTOR.PLAYER,
        skillId: cast.skill.id,
        skillName: 'Transcendent Tempest',
        priority: -10,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

const lucidSingularity = defineTrait({
  name: 'Lucid Singularity',
  id: TRAIT.LUCID_SINGULARITY,
  balance: {
    // At most `maximumStacks` overload hits pulse alacrity; the last of them uses `Final Alacrity`.
    maximumStacks: 5,
    effects: [
      {
        type: 'boon',
        name: 'Pulse Alacrity',
        boon: BOON.ALACRITY,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 1
      },
      {
        type: 'boon',
        name: 'Final Alacrity',
        boon: BOON.ALACRITY,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 4.5
      }
    ]
  },
  triggers: [
    onTriggerPoint(tempestCastStarted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyLucidSingularity(runtime, cast, cast.skill)
    })
  ]
});

/** Register tempest traits in their existing execution order. */
export const tempestTraits = [
  singularity,
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
  const extension = balanceProfileNumber(tempestuousAriaProfile, 'durationExtension');
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
        actorType: ACTOR.PLAYER,
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
      actorType: ACTOR.PLAYER,
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
      actorType: ACTOR.PLAYER,
      name: skill.name,
      priority: 0,
      audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
    }
  });
}

/** Committed heals receive Gale Song before overload-specific completion work. */
function applyGaleSong(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (skill.type === 'Heal')
    emitTraitProfile(context, TRAIT.GALE_SONG, TRAIT.GALE_SONG, undefined, {
      at: cast.effectiveEnd,
      fullEnd: cast.effectiveEnd,
      effect: { type: 'boon', name: BOON.PROTECTION },
      skillId: skill.id,
      skillName: 'Gale Song',
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.GALE_SONG,
        actorType: ACTOR.PLAYER,
        name: 'Gale Song',
        priority: 0
      }
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
      const vigor = requireEffect(latentStaminaProfile, 'boon', BOON.VIGOR);
      const sourceId = event.skillId ?? event.sourceId;

      if (vigor) {
        emitTraitProfile(context, TRAIT.LATENT_STAMINA, TRAIT.LATENT_STAMINA, undefined, {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'boon', name: BOON.VIGOR },
          cast: emissionCast,
          attribution: {
            source: 'Latent Stamina',
            sourceId: sourceId,
            actorType: ACTOR.PLAYER,
            skillName: 'Latent Stamina',
            skillId: elementalistEventSkill(context, 'Latent Stamina', sourceId).id,
            name: 'Latent Stamina'
          }
        });
      }
    }
  }
}

/** Schedule alacrity from accepted overload hits before packet emission, retaining shortened-channel behavior. */
function applyLucidSingularity(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (!skill.overload) return;

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
          actorType: ACTOR.PLAYER,
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
    .slice(0, balanceNumberFromContext(context, TRAIT.LUCID_SINGULARITY, 'maximumStacks'));
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
        actorType: ACTOR.PLAYER,
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
    const unstableConduitProfile = requireBalanceProfileFromContext(context, TRAIT.UNSTABLE_CONDUIT);
    const unstableConduitAttunement = requireEffect(unstableConduitProfile, 'aura', attunement);

    if (unstableConduitAttunement) {
      applyElementalistAura(context, {
        at: cast.effectiveEnd,
        aura: unstableConduitAttunement.aura,
        duration: unstableConduitAttunement.duration,
        skillName: 'Unstable Conduit',
        sourceId: skill.id,
        // The completion aura precedes the same-time Overload packet.
        priority: -20
      });
    }
  }
}
