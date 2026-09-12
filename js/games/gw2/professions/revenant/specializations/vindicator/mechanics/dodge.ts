import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
/**
 * Revenant dodge execution.
 *
 * Pays the core or Vindicator endurance cost, snapshots the new resource
 * state, and emits the selected dodge replacement's landing effect from the
 * immutable profile in this specialization's mechanics module.
 */
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileFromContext as balanceProfileById } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/timelines.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { VINDICATOR_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Derives the landing profile from Vindicator's grandmaster trait so no separate dodge choice can drift. */
export function selectedDodgeSkill(context: RevenantSchedulerContext): RevenantSkill | undefined {
  const skillId = hasTrait(context, TRAIT.SAINT_OF_ZU_HELTZER)
    ? ID.SAINTS_SHIELD
    : hasTrait(context, TRAIT.VASSALS_OF_THE_EMPIRE)
      ? ID.IMPERIAL_IMPACT
      : ID.DEATH_DROP;
  return context.catalog.skillsById.get(skillId);
}

/** Applies Energy Meld's selected Vindicator trait package. */
export function performEnergyMeld(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = vindicatorState.from(context);
  const coreState = professionCoreState(context);
  const at = context.effectiveEnd;
  const songOfArboreum = hasTrait(context.config, TRAIT.SONG_OF_ARBOREUM);
  const enduranceProfile = songOfArboreum
    ? balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.songOfArboreum)
    : skill;
  // Song of Arboreum is mutually exclusive with the base endurance amount.
  Object.assign(
    coreState,
    grantEndurance(coreState, Number(enduranceProfile?.resourceGain), at, coreState.maximumEndurance)
  );
  if (hasTrait(context.config, TRAIT.REAVERS_CURSE)) {
    const reaversCurse = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse);
    const effect = reaversCurse?.effects?.find((candidate) => candidate.type === 'buff');
    // Casting Energy Meld arms Reaver's Curse; the next dodge will consume and zero this timestamp.
    state.reaversCurseUntil = at + Math.max(0, Number(effect?.duration));
  }

  if (
    hasTrait(context.config, TRAIT.ANGSIYANS_TRUST) &&
    // Angsiyah's Trust energy is gated by combat; pre-combat Energy Meld does not refund energy.
    revenantCombatActive(context, at)
  ) {
    const angsiyansTrust = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.angsiyansTrust);
    coreState.energy = Math.min(
      coreState.maximumEnergy,
      coreState.energy + Math.max(0, Number(angsiyansTrust?.resourceGain))
    );
  }

  if (songOfArboreum) {
    const vigor = enduranceProfile?.effects?.find((candidate) => candidate.type === 'boon');
    if (vigor) {
      const kind = String(vigor.boon || 'vigor');
      emitSkillBuff(context, skill, {
        at,
        sourceId: TRAIT.SONG_OF_ARBOREUM,
        name: `${skill.name} — ${kind}`,
        kind,
        duration: Number(vigor.duration || 0),
        stacks: Number(vigor.stacks ?? 1)
      });
    }
  }

  // State snapshot carries endurance value to the resolver; must come after all mutations above.
  emitRevenantStateSnapshot(context, at, 'energy-meld');
}

/** Emits the configured Vindicator dodge replacement at cast completion. */
export function completeVindicatorDodge(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  strikeProfileOrigin: number
): void {
  const state = vindicatorState.from(context);
  const profile = selectedDodgeSkill(context);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  // Full jumps offset this origin by airborne time; landing-only inputs begin at the landing animation.
  const offset = effect.type === 'strike' ? effectFirstAtMs(effect) : effect.atMs;
  const at = strikeProfileOrigin + Math.max(0, Number(offset || 0)) / 1000;
  // epsilon tolerance absorbs floating-point drift when reaversCurseUntil and at are nominally equal.
  const reaversCurse =
    hasTrait(context.config, TRAIT.REAVERS_CURSE) && Number(state.reaversCurseUntil || 0) + context.epsilon >= at;
  // Consume the buff immediately so a rapid second dodge cannot double-dip.
  if (reaversCurse) state.reaversCurseUntil = 0;
  // Strike scaling and Forerunner ordering stay local; support landings continue to their boon package.
  if (effect.type === 'strike' && strikeEffectCoefficient(effect) > 0) {
    const reaversCurseProfile = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse);
    // Capture forerunner state before the Death Drop below may extend it for this same hit.
    const previousForerunnerUntil = Number(state.forerunnerOfDeathUntil || 0);
    emitSkillDamage(context, {
      at,
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: profile.name,
      name: profile.name,
      coefficient:
        strikeEffectCoefficient(effect) *
        (reaversCurse ? Math.max(0, Number(reaversCurseProfile?.damageMultiplier ?? 1)) : 1),
      hits: strikeEffectTicks(effect).length,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: 'Unequipped',
      // Baking the flag into the event avoids a resolver time-comparison race when events replay out of order.
      forerunnerOfDeathActive: previousForerunnerUntil > at
    });
    if (profile.id === ID.DEATH_DROP && hasTrait(context.config, TRAIT.FORERUNNER_OF_DEATH)) {
      const forerunner = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.forerunnerOfDeath);
      const forerunnerEffect = forerunner?.effects?.find((candidate) => candidate.type === 'buff');
      const duration = Math.max(0, Number(forerunnerEffect?.duration));
      // Forerunner window is set after the damage event is emitted; the current hit benefits from the old window.
      state.forerunnerOfDeathUntil = at + duration;
      emitSkillBuff(context, {
        at,
        source: 'revenant',
        sourceId: TRAIT.FORERUNNER_OF_DEATH,
        actorType: 'player',
        skillId: TRAIT.FORERUNNER_OF_DEATH,
        skillName: 'Forerunner of Death',
        name: 'Forerunner of Death',
        kind: String(forerunnerEffect?.kind || 'forerunner-of-death'),
        duration,
        stacks: Number(forerunnerEffect?.stacks ?? 1)
      });
    }
  }

  // Every declared condition and boon accompanies the landing; shared emitters retain duration and audience policy.
  for (const secondary of profile.effects || []) {
    if (secondary.type === 'boon') {
      emitSkillBuff(context, profile, {
        at,
        kind: String(secondary.boon || ''),
        duration: secondary.duration,
        stacks: secondary.stacks,
        audience: secondary.audience
      });
    } else if (secondary.type === 'condition') {
      for (const tick of conditionEffectTicks(secondary)) {
        emitSkillCondition(context, profile, {
          at,
          condition: tick.condition,
          duration: tick.duration,
          stacks: tick.stacks
        });
      }
    }
  }

  emitRevenantStateSnapshot(context, at, 'vindicator-dodge-impact');
}
