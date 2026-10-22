import { STATUS, ACTOR, RECIPIENT, BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive, buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket, buildRangerStrikes } from '#gw2/professions/ranger/core/events.js';
import { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { isBeastSkill, isPetActorEvent } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { activePetFamily } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import {
  cycloneBowCompleted,
  galeshotCastCompleted,
  galeshotControlAccepted,
  galeshotPetStrike,
  missileResolved
} from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import type { GaleshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { RangerModifierContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

function galeshotRuntimeState(context: RangerModifierContext) {
  return readProfessionSpecializationState<GaleshotState>(context.runtime?.profession, 'Galeshot');
}

/** Modifiers read the current zero-rate clock so delayed gains and resets take effect at their owned boundary. */
function windForce(context: RangerModifierContext): number {
  return galeshotRuntimeState(context)?.windForce?.value ?? 0;
}

function galeForceAmount(context: RangerModifierContext): number {
  const galeForce =
    (galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time
      ? balanceNumberFromContext(context, TRAIT.GALE_FORCE, 'damageIncrease')
      : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return galeForce + windForce(context) * balanceNumberFromContext(context, TRAIT.GALE_FORCE, 'damageIncreasePerStack');
}

function activePetIsFeathered(context: RangerModifierContext): boolean {
  // Combat and detached previews resolve the same selected pet family.
  return ['avian', 'moa', 'phoenix', 'raptor swiftwing'].includes(activePetFamily(context));
}

/** Owns Shrike's live tuning and trait behavior. */
const shrike = defineTrait({
  triggers: [
    onTriggerPoint(missileResolved, {
      run: (runtime, input: TriggerPointInput<typeof missileResolved>) => applyShrike(runtime, input.event)
    })
  ],
  id: TRAIT.SHRIKE,
  name: 'Shrike',
  balance: {
    threshold: 12,
    resourceGain: 1,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0.8,
        hits: 3,
        atMs: 0
      }
    ]
  }
});

/** Owns Wuthering Wind's live tuning and trait behavior. */
const wutheringWind = defineTrait({
  triggers: [
    onTriggerPoint(cycloneBowCompleted, {
      when: (_runtime, input: TriggerPointInput<typeof cycloneBowCompleted>) => input.skill.id === ID.BLUSTER,
      run: (runtime) => primeWutheringWind(runtime)
    }),
    onTriggerPoint(galeshotPetStrike, {
      run: (runtime, input: TriggerPointInput<typeof galeshotPetStrike>) => reactToGaleshotPet(runtime, input.event)
    })
  ],
  id: TRAIT.WUTHERING_WIND,
  name: 'Wuthering Wind',
  balance: {
    effects: [{ name: 'Strike', type: 'strike', coefficient: 2, hits: 1 }]
  }
});

/** Owns Thrill of the Catch's live tuning and trait behavior. */
const thrillOfTheCatch = defineTrait({
  triggers: [
    onTriggerPoint(galeshotControlAccepted, {
      run: (runtime, input: TriggerPointInput<typeof galeshotControlAccepted>) =>
        reactToGaleshotControl(runtime, input.event)
    })
  ],
  id: TRAIT.THRILL_OF_THE_CATCH,
  name: 'Thrill of the Catch',
  balance: {
    internalCooldown: 0.25,
    resourceGain: 1
  }
});

/** Owns Flock Together's live tuning and trait behavior. */
const flockTogether = defineTrait({
  triggers: [
    onTriggerPoint(galeshotCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof galeshotCastCompleted>) =>
        completeGaleshotSkill(runtime, input.skill)
    })
  ],
  id: TRAIT.FLOCK_TOGETHER,
  name: 'Flock Together',
  balance: {
    damageMultiplier: 1.25,
    internalCooldown: 20,
    effects: [{ name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 5, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 102,
      id: 'ranger.flock-together',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.FLOCK_TOGETHER, 'damageMultiplier'),
      when: (context) => isPetActorEvent(context.event) && activePetIsFeathered(context)
    }
  ]
});

/** Owns Cloudburst's live tuning and trait behavior. */
const cloudburst = defineTrait({
  triggers: [
    onTriggerPoint(cycloneBowCompleted, {
      when: (_runtime, input: TriggerPointInput<typeof cycloneBowCompleted>) =>
        input.skill.id === ID.HAWKEYE || input.skill.id === ID.BLUSTER,
      run: (runtime, input: TriggerPointInput<typeof cycloneBowCompleted>) => emitCloudburstBoons(runtime, input.skill)
    })
  ],
  id: TRAIT.CLOUDBURST,
  name: 'Cloudburst',
  balance: {
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 4, stacks: 1 },
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 10, stacks: 4 },
      { name: 'Hawkeye quickness', type: 'boon', boon: BOON.QUICKNESS, duration: 8, stacks: 1 },
      { name: 'Hawkeye might', type: 'boon', boon: BOON.MIGHT, duration: 10, stacks: 8 }
    ]
  }
});

/** Owns Gale Force's live tuning and trait behavior. */
const galeForce = defineTrait({
  triggers: [
    onTriggerPoint(cycloneBowCompleted, {
      when: (_runtime, input: TriggerPointInput<typeof cycloneBowCompleted>) => input.skill.id === ID.HAWKEYE,
      run: (runtime, input: TriggerPointInput<typeof cycloneBowCompleted>) => applyGaleForce(runtime, input.skill)
    })
  ],
  id: TRAIT.GALE_FORCE,
  name: 'Gale Force',
  balance: {
    damageIncrease: 0.25,
    damageIncreasePerStack: 0.03,
    effects: [{ name: 'gale-force', type: 'buff', kind: 'gale-force', duration: 10, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.gale-force',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) => galeForceAmount(context),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        ((galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time || windForce(context) > 0)
    }
  ]
});

/** Owns Bird of Prey's live tuning and trait behavior. */
const birdOfPrey = defineTrait({
  id: TRAIT.BIRD_OF_PREY,
  name: 'Bird of Prey',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.05 },
  modifierRules: [
    {
      order: 100,
      id: 'ranger.bird-of-prey',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.BIRD_OF_PREY, 'damageIncrease'),
      // Either movement buff activates the player bonus, including generated buffs until they expire.
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (boonActive(context, boonKey(BOON.SWIFTNESS)) || buffActive(context, STATUS.SUPERSPEED))
    }
  ]
});

/** Owns Perilous Skies's live tuning and trait behavior. */
const perilousSkies = defineTrait({ id: TRAIT.PERILOUS_SKIES, name: 'Perilous Skies' });

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
export const galeshotTraits = [
  shrike,
  wutheringWind,
  thrillOfTheCatch,
  flockTogether,
  cloudburst,
  galeForce,
  birdOfPrey,
  perilousSkies
];

/** Shrike counts resolved projectile impacts, including returns, independently of Mistral. */
function applyShrike(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const at = event.at;
  const state = galeshotState.from(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.SHRIKE);
  const threshold = balanceProfileNumber(profile, 'threshold');
  // Completing the missile-hit cycle resets buildup before granting the arrow refund and optional strike.
  const progress = advanceCounter(state.missileHits, 1, threshold, 'reset');
  state.missileHits = progress.value;

  if (!progress.reached) return;

  // The arrow refund is independent of the strike, so it survives strike removal.
  context.resourceController.grant('arrows', balanceProfileNumber(profile, 'resourceGain'));
  const strike = requireEffect(profile, 'strike', 'Strike');

  if (!strike) return;

  const hits = effectNumber(profile, strike, 'hits');
  const coefficient = effectNumber(profile, strike, 'coefficient');
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    buildRangerStrikes(
      buildRangerPacket(
        {
          at: at,
          source: 'Trait',
          sourceId: TRAIT.SHRIKE,
          actorType: ACTOR.EFFECT,
          ownerActorType: ACTOR.PLAYER,
          skillId: TRAIT.SHRIKE,
          skillName: 'Shrike',
          name: 'Shrike',
          coefficient,
          hits: 1,
          hitIndex,
          totalHits: hits,
          canCrit: true,
          damageKind: 'galeshot-shrike',
          triggeredBy: event.skillName
        },
        'damage'
      )
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}

/** Pet strikes claim Wuthering Wind once per accepted activation. */
function reactToGaleshotPet(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (!isPetActorEvent(event) || !(Number(event.coefficient) > 0)) return;

  const at = event.at;

  const pet = context.profession.core.pet;

  if (!pet || event.summonOwner !== pet.id) return;

  const activationId = event.activationId || '';

  if (!pet.wutheringWindReady || canonicalTime(at) < pet.wutheringWindReadyAt) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.WUTHERING_WIND);
  const strike = requireEffect(profile, 'strike', 'Strike');

  // The primed charge and proc exist only for the strike, so a removed strike leaves the charge armed.
  if (!strike) return;

  // ID-less packets may consume the charge; identified activations may consume it only once.
  if (activationId && !claimActivation(pet.activationClaims, 'ranger.wuthering-wind', activationId)) return;

  pet.wutheringWindReady = false;
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.WUTHERING_WIND,
      actorType: ACTOR.EFFECT,
      skillId: ID.WUTHERING_WIND,
      skillName: 'Wuthering Wind'
    },
    announcement: { name: 'Wuthering Wind', at: at, detail: 'activated', type: 'trait', sourceSkill: event.skillName }
  });
  buildRangerStrikes(
    buildRangerPacket(
      {
        at: at,
        source: 'Trait',
        sourceId: TRAIT.WUTHERING_WIND,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillId: ID.WUTHERING_WIND,
        skillName: 'Wuthering Wind',
        name: 'Wuthering Wind',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        hits: effectNumber(profile, strike, 'hits'),
        canCrit: true,
        damageKind: 'galeshot-wuthering-wind',
        triggeredBy: event.skillName,
        // Trait proc uses pet power scaling, not the player's weapon strength;
        // profession modifiers (e.g. Flock Together) still apply via the flags below.
        independentSummonStrike: true,
        summonUsesProfessionModifiers: true,
        summonBasePower: RANGER_PET_STRIKE_SCALING.basePower,
        summonBaseConditionDamage: RANGER_PET_STRIKE_SCALING.baseConditionDamage,
        summonInheritsCriticalAttributes: true
      },
      'damage'
    )
  ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
}

/** Accepted controls refund arrows at the trait's own cooldown boundary. */
function reactToGaleshotControl(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER && event.actorType !== ACTOR.SUMMON) return;

  if (!context.procs.claim(TRAIT.THRILL_OF_THE_CATCH, 'ranger.galeshot.thrillOfTheCatch', context.time)) {
    return;
  }

  // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
  context.resourceController.grant(
    'arrows',
    balanceNumberFromContext(context, TRAIT.THRILL_OF_THE_CATCH, 'resourceGain')
  );
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
function completeGaleshotSkill(context: RangerRuntime, skill: RangerSkill): void {
  if (!isBeastSkill(skill)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.FLOCK_TOGETHER);
  const quickness = requireEffect(profile, 'boon', boonKey(BOON.QUICKNESS));

  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!quickness || !context.procs.claim(TRAIT.FLOCK_TOGETHER, 'ranger.galeshot.flockTogether', context.time)) return;

  emitTraitProfile(context, TRAIT.FLOCK_TOGETHER, TRAIT.FLOCK_TOGETHER, undefined, {
    at: context.time,
    fullEnd: context.time,
    effect: { type: 'boon', name: boonKey(BOON.QUICKNESS) },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.FLOCK_TOGETHER,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.FLOCK_TOGETHER,
      skillName: 'Flock Together',
      audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
      triggeredBy: skill.name,
      name: 'Flock Together'
    }
  });
}

/** Hawkeye opens the selected Gale Force damage window after commitment. */
function applyGaleForce(context: RangerRuntime, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GALE_FORCE);
    const effect = requireEffect(profile, 'buff', 'gale-force');

    // The damage window belongs to the buff, so a removed buff opens no window.
    if (effect) {
      const duration = effectNumber(profile, effect, 'duration');
      // galeForceUntil is a timestamp, not a duration; compare against context.time in modifiers.
      state.galeForceUntil = context.time + duration;
      emitTraitProfile(context, TRAIT.GALE_FORCE, TRAIT.GALE_FORCE, undefined, {
        at: context.time,
        fullEnd: context.time,
        effect: { type: 'buff', name: 'gale-force' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.GALE_FORCE,
          actorType: ACTOR.EFFECT,
          skillId: TRAIT.GALE_FORCE,
          skillName: 'Gale Force',
          triggeredBy: skill.name,
          name: 'Gale Force'
        },
        transform: (packet) => ({ ...packet, duration: duration })
      });
    }
  }
}

/** Bluster primes the pet follow-up after its own effects have been committed. */
function primeWutheringWind(context: RangerRuntime): void {
  const pet = context.profession.core.pet;

  if (!pet) return;

  pet.wutheringWindReady = true;
  pet.wutheringWindReadyAt = context.time;
}

// Grant Cloudburst's profile-defined party boons from the qualifying reset skill
// at cast completion.

function emitCloudburstBoons(context: RangerRuntime, skill: RangerSkill): void {
  const hawkeye = skill.id === ID.HAWKEYE;
  for (const name of hawkeye
    ? ['Hawkeye quickness', 'Hawkeye might']
    : [boonKey(BOON.QUICKNESS), boonKey(BOON.MIGHT)]) {
    emitTraitProfile(context, TRAIT.CLOUDBURST, TRAIT.CLOUDBURST, undefined, {
      effect: { type: 'boon', name },
      at: context.time,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CLOUDBURST,
        actorType: ACTOR.EFFECT,
        skillId: TRAIT.CLOUDBURST,
        skillName: 'Cloudburst',
        triggeredBy: skill.name
      },
      transform: (packet) => ({
        ...packet,
        name: 'Cloudburst - ' + packet.kind,
        boon: packet.kind,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      })
    });
  }
}
