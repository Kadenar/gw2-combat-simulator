import { claimActivation } from '#gw2/platform/combat/activation-claims.js';
import { isBeastSkill } from '#gw2/professions/ranger/core/traits/dispatch.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2TraitLookupContext } from '#gw2/platform/builds/selected-traits.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import { buildRangerStrikes, buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { EPSILON } from '#kernel/core/clock.js';

/** Shrike counts resolved projectile impacts, including returns, independently of Mistral. */
export function applyShrike(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context.traits, TRAIT.SHRIKE)) return;
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
export function reactToGaleshotPet(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'summon' || event.source !== 'ranger-pet' || !(Number(event.coefficient) > 0)) return;
  const at = event.at;

  const state = galeshotState.from(context);
  const activationId = event.activationId || '';
  if (
    !hasTrait(context.traits, TRAIT.WUTHERING_WIND) ||
    !state.wutheringWindReady ||
    at + EPSILON < state.wutheringWindReadyAt
  ) {
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
export function reactToGaleshotControl(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' && event.actorType !== 'summon') return;

  if (
    !hasTrait(context.traits, TRAIT.THRILL_OF_THE_CATCH) ||
    !context.procs.claim(TRAIT.THRILL_OF_THE_CATCH, 'ranger.galeshot.thrillOfTheCatch', context.time)
  ) {
    return;
  }

  // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
  const profile = requireBalanceProfileFromContext(context, TRAIT.THRILL_OF_THE_CATCH);
  context.resourceController.grant('arrows', balanceProfileNumber(profile, 'resourceGain'));
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
export function completeGaleshotSkill(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.FLOCK_TOGETHER) || !isBeastSkill(skill)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.FLOCK_TOGETHER);
  const quickness = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!quickness || !context.procs.claim(TRAIT.FLOCK_TOGETHER, 'ranger.galeshot.flockTogether', context.time)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.FLOCK_TOGETHER,
        actorType: 'effect',
        skillId: TRAIT.FLOCK_TOGETHER,
        skillName: 'Flock Together',
        kind: String(quickness.boon),
        boon: String(quickness.boon),
        duration: effectNumber(profile, quickness, 'duration'),
        stacks: effectNumber(profile, quickness, 'stacks'),
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        triggeredBy: skill.name
      },
      'buff'
    )
  });
}

export function applyGaleshotCycloneBowTraits(context: RangerRuntime, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (skill.id === ID.HAWKEYE) {
    if (hasTrait(context, TRAIT.GALE_FORCE)) {
      const profile = requireBalanceProfileFromContext(context, TRAIT.GALE_FORCE);
      const effect = requireEffect(profile, 'buff', 'gale-force');
      // The damage window belongs to the buff, so a removed buff opens no window.
      if (effect) {
        const duration = effectNumber(profile, effect, 'duration');
        // galeForceUntil is a timestamp, not a duration; compare against context.time in modifiers.
        state.galeForceUntil = context.time + duration;
        context.effects.emit({
          kind: 'packet',
          event: buildRangerPacket(
            {
              at: context.time,
              source: 'Trait',
              sourceId: TRAIT.GALE_FORCE,
              actorType: 'effect',
              skillId: TRAIT.GALE_FORCE,
              skillName: 'Gale Force',
              kind: String(effect.kind),
              duration,
              stacks: effectNumber(profile, effect, 'stacks'),
              triggeredBy: skill.name
            },
            'buff'
          )
        });
      }
    }

    emitCloudburstBoons(context, skill);
    return;
  }

  if (skill.id === ID.BLUSTER) {
    // Wuthering Wind is primed by Bluster; the charge is only consumable at or
    // after effectiveEnd so the same cast can't immediately trigger itself.
    state.wutheringWindReady = hasTrait(context, TRAIT.WUTHERING_WIND);
    state.wutheringWindReadyAt = context.time;
    emitCloudburstBoons(context, skill);
  }
}

// Grant Cloudburst's profile-defined party boons from the qualifying reset skill
// at cast completion.

function emitCloudburstBoons(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.CLOUDBURST)) return;
  const hawkeye = skill.id === ID.HAWKEYE;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CLOUDBURST);
  // Hawkeye owns separately named, stronger packets so removing one tier never borrows the other's values.
  for (const name of hawkeye ? ['Hawkeye quickness', 'Hawkeye might'] : ['quickness', 'might']) {
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) continue;
    const kind = String(effect.boon);
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at: context.time,
          source: 'Trait',
          sourceId: TRAIT.CLOUDBURST,
          actorType: 'effect',
          skillId: TRAIT.CLOUDBURST,
          skillName: 'Cloudburst',
          name: `Cloudburst - ${kind}`,
          kind,
          boon: kind,
          duration: effectNumber(profile, effect, 'duration'),
          stacks: effectNumber(profile, effect, 'stacks'),
          audience: { recipients: 'party' as const, maximumRecipients: 5 },
          triggeredBy: skill.name
        },
        'buff'
      )
    });
  }
}

/** Restricts the replacement pair consistently for live cast validation. */
export function perilousSkiesAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult | null {
  if (skill.id === ID.QUARRYS_PERIL && perilousSkiesSelected(context)) {
    return deny(skill, 'ranger.perilous-skies', 'Pelt replaces this skill.');
  }

  if (skill.id === ID.PELT && !perilousSkiesSelected(context)) {
    return deny(skill, 'ranger.perilous-skies', "select Perilous Skies to replace Quarry's Peril.");
  }

  return null;
}

/** Cloudburst resets Bluster at the committing skill's side-effect phase. */
export const cloudburstBlusterReset: SkillSideEffect = {
  on: 'castCommit',
  when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
  do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
};

/** Runtime and palette share the selected replacement pair. */
export function perilousSkiesSelected(context: Gw2TraitLookupContext): boolean {
  return hasTrait(context, TRAIT.PERILOUS_SKIES);
}
