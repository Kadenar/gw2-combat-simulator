import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive, buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket, buildRangerStrikes } from '#gw2/professions/ranger/core/events.js';
import { isBeastSkill } from '#gw2/professions/ranger/core/mechanics/combat.js';
import { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  cycloneBowCompleted,
  galeshotCastCompleted,
  galeshotControlAccepted,
  galeshotPetStrike
} from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import { missileResolved } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
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
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GALE_FORCE), 'damageIncrease')
      : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return (
    galeForce +
    windForce(context) *
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GALE_FORCE), 'damageIncreasePerStack')
  );
}

function activePetIsFeathered(context: RangerModifierContext): boolean {
  const name =
    readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
    context.config?.selectedPet ||
    '';
  return ['avian', 'moa', 'phoenix', 'raptor swiftwing'].includes(rangerPetByName(name).family);
}

/** Owns Shrike's live tuning and trait behavior. */
export const shrike = defineTrait({
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
export const wutheringWind = defineTrait({
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
export const thrillOfTheCatch = defineTrait({
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
export const flockTogether = defineTrait({
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
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 102,
      id: 'ranger.flock-together',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLOCK_TOGETHER), 'damageMultiplier'),
      when: (context) =>
        context.event?.actorType === 'summon' && context.event.source === 'ranger-pet' && activePetIsFeathered(context)
    }
  ]
});

/** Owns Cloudburst's live tuning and trait behavior. */
export const cloudburst = defineTrait({
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
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 4, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 10, stacks: 4 },
      { name: 'Hawkeye quickness', type: 'boon', boon: 'quickness', duration: 8, stacks: 1 },
      { name: 'Hawkeye might', type: 'boon', boon: 'might', duration: 10, stacks: 8 }
    ]
  }
});

/** Owns Gale Force's live tuning and trait behavior. */
export const galeForce = defineTrait({
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
export const birdOfPrey = defineTrait({
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BIRD_OF_PREY), 'damageIncrease'),
      // Either movement buff activates the player bonus, including generated buffs until they expire.
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (boonActive(context, 'swiftness') || buffActive(context, 'superspeed'))
    }
  ]
});

/** Owns Perilous Skies's live tuning and trait behavior. */
export const perilousSkies = defineTrait({ id: TRAIT.PERILOUS_SKIES, name: 'Perilous Skies' });

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
          actorType: 'effect',
          ownerActorType: 'player',
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
  if (event.actorType !== 'summon' || event.source !== 'ranger-pet' || !(Number(event.coefficient) > 0)) return;
  const at = event.at;

  const state = galeshotState.from(context);
  const activationId = event.activationId || '';
  if (!state.wutheringWindReady || canonicalTime(at) < state.wutheringWindReadyAt) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.WUTHERING_WIND);
  const strike = requireEffect(profile, 'strike', 'Strike');
  // The primed charge and proc exist only for the strike, so a removed strike leaves the charge armed.
  if (!strike) return;
  // ID-less packets may consume the charge; identified activations may consume it only once.
  if (activationId && !claimActivation(state.galeshotActivationClaims, 'ranger.wuthering-wind', activationId)) return;
  state.wutheringWindReady = false;
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.WUTHERING_WIND,
      actorType: 'effect',
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
        actorType: 'effect',
        ownerActorType: 'player',
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
  if (event.actorType !== 'player' && event.actorType !== 'summon') return;

  if (!context.procs.claim(TRAIT.THRILL_OF_THE_CATCH, 'ranger.galeshot.thrillOfTheCatch', context.time)) {
    return;
  }

  // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
  const profile = requireBalanceProfileFromContext(context, TRAIT.THRILL_OF_THE_CATCH);
  context.resourceController.grant('arrows', balanceProfileNumber(profile, 'resourceGain'));
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
function completeGaleshotSkill(context: RangerRuntime, skill: RangerSkill): void {
  if (!isBeastSkill(skill)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.FLOCK_TOGETHER);
  const quickness = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!quickness || !context.procs.claim(TRAIT.FLOCK_TOGETHER, 'ranger.galeshot.flockTogether', context.time)) return;
  emitTraitProfile(context, TRAIT.FLOCK_TOGETHER, TRAIT.FLOCK_TOGETHER, undefined, {
    at: context.time,
    fullEnd: context.time,
    effect: { type: 'boon', name: 'quickness' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.FLOCK_TOGETHER,
      actorType: 'effect',
      skillId: TRAIT.FLOCK_TOGETHER,
      skillName: 'Flock Together',
      audience: { recipients: 'party' as const, maximumRecipients: 5 },
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
          actorType: 'effect',
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
  const state = galeshotState.from(context);
  state.wutheringWindReady = true;
  state.wutheringWindReadyAt = context.time;
}

// Grant Cloudburst's profile-defined party boons from the qualifying reset skill
// at cast completion.

function emitCloudburstBoons(context: RangerRuntime, skill: RangerSkill): void {
  const hawkeye = skill.id === ID.HAWKEYE;
  for (const name of hawkeye ? ['Hawkeye quickness', 'Hawkeye might'] : ['quickness', 'might']) {
    emitTraitProfile(context, TRAIT.CLOUDBURST, TRAIT.CLOUDBURST, undefined, {
      effect: { type: 'boon', name },
      at: context.time,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CLOUDBURST,
        actorType: 'effect',
        skillId: TRAIT.CLOUDBURST,
        skillName: 'Cloudburst',
        triggeredBy: skill.name
      },
      transform: (packet) => ({
        ...packet,
        name: 'Cloudburst - ' + packet.kind,
        boon: packet.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });
  }
}
