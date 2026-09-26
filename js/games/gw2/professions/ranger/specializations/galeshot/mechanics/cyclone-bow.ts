import { emitRangerBuff, emitRangerDamage, rangerEvent } from '#gw2/professions/ranger/core/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';

import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';

const MISSILE_SKILL_IDS = new Set<number>([
  ID.RICOCHET,
  ID.SPLITBLADE,
  ID.WINTERS_BITE,
  ID.PATH_OF_SCARS,
  ID.PATH_OF_SCARS_MAX_RANGE,
  ID.RAPID_FIRE,
  ID.LONG_RANGE_SHOT,
  ID.POINT_BLANK_SHOT,
  ID.HUNTERS_SHOT,
  ID.KEEN_SHOT,
  ID.HAWKEYE,
  ID.BLUSTER,
  ID.FLEETING_ZEPHYR,
  ID.QUARRYS_PERIL,
  ID.PELT,
  ID.SUPERSONIC_ARROW,
  ID.PIERCING_GALES
]);

/** Accepted missile strikes alone refund arrows and trigger the active Mistral window. */
export function reactToGaleshotMissile(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !MISSILE_SKILL_IDS.has(Number(event.skillId ?? event.sourceId))
  )
    return;
  const at = event.at;

  const state = galeshotState.from(context);
  // An armed Mistral includes missiles landing at expiry; zero never arms it.
  if (state.mistralUntil > 0 && at <= state.mistralUntil) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.mistral);
    const strike = requireEffect(profile, 'strike', 'Strike');
    const chilled = requireEffect(profile, 'condition', 'Chilled');
    // Each missile-triggered Mistral is its own effect activation while its
    // strike and condition packets remain grouped under one identity.
    const activationId = strike || chilled ? 'mistral:' + event.eventOrder : undefined;
    if (strike)
      emitRangerDamage(
        context,
        rangerEvent(
          {
            at: at,
            source: 'ranger',
            sourceId: ID.MISTRAL,
            actorType: 'player',
            skillId: ID.MISTRAL,
            skillName: 'Mistral',
            name: 'Mistral',
            coefficient: effectNumber(profile, strike, 'coefficient'),
            hits: effectNumber(profile, strike, 'hits'),
            canCrit: true,
            damageKind: 'galeshot-mistral',
            triggeredBy: event.skillName,
            activationId
          },
          'damage'
        )
      );
    if (chilled)
      context.emit(
        rangerEvent(
          {
            at: at,
            skillId: ID.MISTRAL,
            skillName: 'Mistral',
            name: 'Mistral - Chilled',
            condition: String(chilled.condition),
            duration: effectNumber(profile, chilled, 'duration'),
            stacks: effectNumber(profile, chilled, 'stacks'),
            triggeredBy: event.skillName,
            activationId
          },
          'condition'
        )
      );
  }

  if (!hasTrait({ config: context.config }, TRAIT.SHRIKE)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.shrike);
  const threshold = balanceProfileNumber(profile, 'threshold');
  state.missileHits += 1;
  if (state.missileHits < threshold) return;
  // Subtract rather than reset so any overshoot from burst windows is preserved.
  state.missileHits -= threshold;
  // The arrow refund is independent of the strike, so it survives strike removal.
  context.resourceController.grant('arrows', balanceProfileNumber(profile, 'resourceGain'));
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (!strike) return;
  const hits = effectNumber(profile, strike, 'hits');
  const coefficient = effectNumber(profile, strike, 'coefficient');
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    emitRangerDamage(
      context,
      rangerEvent(
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
    );
  }
}

/** Pet strikes claim Wuthering Wind once per accepted activation. */
export function reactToGaleshotPet(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'summon' || event.source !== 'ranger-pet' || !(Number(event.coefficient) > 0)) return;
  const at = event.at;

  const state = galeshotState.from(context);
  const activationId = String(event.activationId || '');
  if (
    !hasTrait({ config: context.config }, TRAIT.WUTHERING_WIND) ||
    !state.wutheringWindReady ||
    at + EPSILON < state.wutheringWindReadyAt ||
    (activationId && state.wutheringWindActivationIds[activationId])
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.wutheringWind);
  const strike = requireEffect(profile, 'strike', 'Strike');
  // The primed charge and proc exist only for the strike, so a removed strike leaves the charge armed.
  if (!strike) return;
  state.wutheringWindReady = false;
  if (activationId) state.wutheringWindActivationIds[activationId] = true;
  context.emit({
    type: 'proc',
    at: at,
    source: 'Trait',
    sourceId: TRAIT.WUTHERING_WIND,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: ID.WUTHERING_WIND,
    skillName: 'Wuthering Wind',
    name: 'Wuthering Wind',
    procType: 'trait',
    sourceSkill: event.skillName,
    detail: 'activated'
  });
  emitRangerDamage(
    context,
    rangerEvent(
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
  );
}

/** Accepted controls refund arrows at the trait's own cooldown boundary. */
export function reactToGaleshotControl(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' && event.actorType !== 'summon') return;

  const state = galeshotState.from(context);
  if (
    !hasTrait({ config: context.config }, TRAIT.THRILL_OF_THE_CATCH) ||
    !isInternalCooldownReady(context.time, state.thrillOfTheCatchReadyAt)
  ) {
    return;
  }

  // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
  const profile = requireBalanceProfileFromContext(context, PROFILE.thrillOfTheCatch);
  state.thrillOfTheCatchReadyAt = context.time + balanceProfileNumber(profile, 'internalCooldown');
  context.resourceController.grant('arrows', balanceProfileNumber(profile, 'resourceGain'));
}

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(
    // petFamilySkills are passive and never cast by the player, so they don't
    // count. BEASTMODE / LEAVE_BEASTMODE are the mode-switch commands, not
    // actual pet abilities, so they're excluded as well.
    (skill.petSkill && !skill.petFamilySkill) ||
    (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
  );
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
export function completeGaleshotSkill(context: RangerRuntime, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (
    !hasTrait(context, TRAIT.FLOCK_TOGETHER) ||
    !isBeastSkill(skill) ||
    !isInternalCooldownReady(context.time, state.flockTogetherReadyAt)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.flockTogether);
  const quickness = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!quickness) return;
  state.flockTogetherReadyAt = context.time + balanceProfileNumber(profile, 'internalCooldown');
  emitRangerBuff(
    context,
    rangerEvent(
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
  );
}
// Gate Galeshot casts by Cyclone Bow ownership, arrows, Wind Force, and the
// Perilous Skies replacement before the shared Ranger checks run.

export function galeshotCastAvailability(context: RangerRuntime, skill: RangerSkill): AvailabilityResult {
  const state = galeshotState.from(context);
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'summon the Cyclone Bow first.');
  }

  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-active', 'the Cyclone Bow is already active.');
  }

  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'the Cyclone Bow is not active.');
  }

  if (Number(skill.arrowCost || 0) > state.arrows.value) {
    return deny(skill, 'ranger.arrows', `requires ${skill.arrowCost} arrows.`);
  }

  const maximumWindForce = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.resources),
    'minimumStacks'
  );
  if (skill.id === ID.HAWKEYE && state.windForce < maximumWindForce) {
    return deny(skill, 'ranger.wind-force', `requires ${maximumWindForce} Wind Force.`);
  }

  if (skill.id === ID.KEEN_SHOT && state.windForce >= maximumWindForce) {
    return deny(skill, 'ranger.hawkeye-ready', 'Hawkeye replaces Keen Shot at 5 Wind Force.');
  }

  if (skill.id === ID.QUARRYS_PERIL && hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(skill, 'ranger.perilous-skies', 'Pelt replaces this skill.');
  }

  if (skill.id === ID.PELT && !hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(skill, 'ranger.perilous-skies', "select Perilous Skies to replace Quarry's Peril.");
  }

  if (state.cycloneBowActive && skill.type === 'Weapon' && !skill.cycloneBowSkill) {
    return deny(skill, 'ranger.cyclone-bow-weapon-bar', 'the Cyclone Bow replaces weapon skills.');
  }

  return { ready: true };
}

export function applyGaleshotCycloneBowTraits(context: RangerRuntime, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (skill.id === ID.HAWKEYE) {
    if (hasTrait(context, TRAIT.GALE_FORCE)) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.galeForce);
      const effect = requireEffect(profile, 'buff', 'gale-force');
      // The damage window belongs to the buff, so a removed buff opens no window.
      if (effect) {
        const duration = effectNumber(profile, effect, 'duration');
        // galeForceUntil is a timestamp, not a duration; compare against context.time in modifiers.
        state.galeForceUntil = context.time + duration;
        emitRangerBuff(
          context,
          rangerEvent(
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
        );
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

  if (
    hasTrait(context, TRAIT.CLOUDBURST) &&
    [ID.QUARRYS_PERIL, ID.SUPERSONIC_ARROW].includes(skill.id as typeof ID.QUARRYS_PERIL | typeof ID.SUPERSONIC_ARROW)
  ) {
    // Cloudburst trait: these two skills reset Bluster's cooldown on cast.
    context.cooldownController.clear(ID.BLUSTER);
  }
}
// Grant Cloudburst's profile-defined party boons from the qualifying reset skill
// at cast completion.

function emitCloudburstBoons(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.CLOUDBURST)) return;
  const hawkeye = skill.id === ID.HAWKEYE;
  const profile = requireBalanceProfileFromContext(context, PROFILE.cloudburst);
  // Hawkeye owns separately named, stronger packets so removing one tier never borrows the other's values.
  for (const name of hawkeye ? ['Hawkeye quickness', 'Hawkeye might'] : ['quickness', 'might']) {
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) continue;
    const kind = String(effect.boon);
    emitRangerBuff(
      context,
      rangerEvent(
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
    );
  }
}
