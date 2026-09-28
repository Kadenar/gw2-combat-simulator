import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { effectFirstAtMs, strikeEffectCoefficient } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_AIRBORNE_MS, VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { VINDICATOR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

const LANDING = 'revenant.vindicator-landing';
const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

/** The grandmaster trait selects the dodge landing, so no separate dodge choice can drift from the build. */
function selectedDodge(runtime: RevenantRuntime): RevenantSkill | undefined {
  const skillId = hasTrait(runtime, TRAIT.SAINT_OF_ZU_HELTZER)
    ? ID.SAINTS_SHIELD
    : hasTrait(runtime, TRAIT.VASSALS_OF_THE_EMPIRE)
      ? ID.IMPERIAL_IMPACT
      : ID.DEATH_DROP;
  return runtime.helpers.skillsById.get(skillId);
}

/** A dodge's landing resolves at its authored offset from the landing origin, not at acceptance. */
function scheduleLanding(runtime: RevenantRuntime, cast: RuntimeCast, origin: number): void {
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  const offset = effect.type === 'strike' ? effectFirstAtMs(effect) : effect.atMs;
  runtime.schedule(LANDING, canonicalTime(origin + Math.max(0, offset || 0) / 1000), {
    origin,
    skillId: cast.skill.id,
    activationId: cast.id
  });
}

/** The shared Dodge declaration delegates its Vindicator-only landing through family composition. */
export function startVindicatorDodge(runtime: RevenantRuntime, cast: RuntimeCast): void {
  scheduleLanding(runtime, cast, cast.start);
}

/** Landing consumes an armed Reaver's Curse, strikes with the Forerunner window it lands in, then renews it. */
function land(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, activationId, origin } = data as { skillId: SkillId; activationId: string; origin: number };
  const state = vindicatorState.from(runtime);
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  // An armed charge includes landing exactly at expiry; zero is the unarmed sentinel.
  const reaversCurse =
    hasTrait(runtime, TRAIT.REAVERS_CURSE) && state.reaversCurseUntil > 0 && state.reaversCurseUntil >= runtime.time;
  if (reaversCurse) state.reaversCurseUntil = 0;
  if (effect.type === 'strike' && strikeEffectCoefficient(effect) > 0) {
    const previousForerunnerUntil = state.forerunnerOfDeathUntil || 0;
    emitEffects(runtime, {
      owner: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'strike'),
      at: origin,
      baseEvent: {
        source: 'revenant',
        sourceId: skillId,
        actorType: 'player',
        skillId,
        skillName: profile.name,
        activationId
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        coefficient:
          Number(event.coefficient) *
          (reaversCurse
            ? Math.max(
                0,
                balanceProfileNumber(
                  requireBalanceProfileFromContext(runtime, PROFILE.reaversCurse),
                  'damageMultiplier'
                )
              )
            : 1),
        skillWeapon: 'Unequipped',
        forerunnerOfDeathActive: previousForerunnerUntil > runtime.time
      })
    });
    if (profile.id === ID.DEATH_DROP && hasTrait(runtime, TRAIT.FORERUNNER_OF_DEATH)) {
      const forerunner = requireBalanceProfileFromContext(runtime, PROFILE.forerunnerOfDeath);
      const window = requireEffect(forerunner, 'buff', 'forerunner-of-death');
      // The damage window is the buff, so a removed buff opens no window.
      if (window) {
        const duration = Math.max(0, effectNumber(forerunner, window, 'duration'));
        state.forerunnerOfDeathUntil = runtime.time + duration;
        runtime.emitProcedural(
          {
            type: 'buff',
            at: runtime.time,
            source: 'revenant',
            sourceId: TRAIT.FORERUNNER_OF_DEATH,
            actorType: 'player',
            skillId: TRAIT.FORERUNNER_OF_DEATH,
            skillName: 'Forerunner of Death',
            activationId,
            name: 'Forerunner of Death',
            kind: String(window.kind),
            duration,
            stacks: effectNumber(forerunner, window, 'stacks')
          },
          { fixedDuration: true }
        );
      }
    }
  }

  // Secondary effects retain their own timing and applications, independent of the strike timeline.
  emitEffects(runtime, {
    owner: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'condition'),
    at: origin,
    fullEnd: runtime.time,
    baseEvent: {
      source: 'revenant',
      sourceId: profile.id,
      actorType: 'player',
      skillId: profile.id,
      skillName: profile.name,
      activationId
    }
  });
}

/** Energy Meld arms Reaver's Curse and refunds in-combat Energy independently of its boon reward. */
function energyMeld(runtime: RevenantRuntime): void {
  const state = vindicatorState.from(runtime);
  if (hasTrait(runtime, TRAIT.REAVERS_CURSE)) {
    const curse = requireBalanceProfileFromContext(runtime, PROFILE.reaversCurse);
    const effect = requireEffect(curse, 'buff', 'reavers-curse');
    // The armed window is the buff, so a removed buff arms nothing.
    if (effect)
      state.reaversCurseUntil = gw2EffectExpiresAt(runtime.time, Math.max(0, effectNumber(curse, effect, 'duration')));
  }

  // Angsiyan's Trust refunds Energy only in combat.
  if (hasTrait(runtime, TRAIT.ANGSIYANS_TRUST) && runtime.combatStartedAt())
    runtime.resourceController.grant(
      'energy',
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.angsiyansTrust), 'resourceGain')
      )
    );
}

/** Core emits the invocation packets; Alliance additionally restores the Song skill's authored endurance. */
function grantAllianceInvocationEndurance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  runtime.endurance.grant(song.resourceGain || 0);
}

/** Vindicator owns its dodge landings, Energy Meld, and Alliance invocation on the shared live state. */
export const vindicatorHooks: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  // Both Energy Meld variants grant the same Vigor without coupling it to resource or armed-window changes.
  traitTriggers: [
    {
      trait: TRAIT.SONG_OF_ARBOREUM,
      emit: PROFILE.songOfArboreum,
      on: 'castCommit',
      when: (_runtime, cast) => ENERGY_MELD_IDS.has(cast.skill.id),
      effects: (effect) => effect.type === 'boon' && effect.name === 'vigor',
      attribution: (_runtime, cast) => ({
        source: 'revenant',
        actorType: 'player',
        name: `${cast.skill.name} — vigor`
      })
    }
  ],
  // The landing-only Dodge input uses the selected dodge's fixed animation.
  castDurationMs: (runtime, skill, duration) =>
    skill.id === SHARED_SKILL_IDS.DODGE ? Math.max(0, selectedDodge(runtime)?.castTimeMs || 0) : duration,
  // Energy Meld variants share the same selected trait reduction.
  rechargeRules: [
    {
      trait: TRAIT.REAVERS_CURSE,
      when: (_runtime, skill) => ENERGY_MELD_IDS.has(skill.id),
      multiplier: { profile: PROFILE.reaversCurse, field: 'rechargeMultiplier' }
    }
  ],
  modifyEffects: (_runtime, cast, effects) => (cast.skill.id === VINDICATOR_JUMP_SKILL.id ? [] : effects),
  sideEffectHandlers: {
    'revenant.vindicator-jump'(runtime, context) {
      if (context.kind === 'cast')
        scheduleLanding(runtime, context.cast, context.cast.start + VINDICATOR_AIRBORNE_MS / 1000);
    },
    'revenant.vindicator-chain-reset'(runtime) {
      resetAutoattackChains(runtime);
    }
  },
  onCastCommit(runtime, cast) {
    if (ENERGY_MELD_IDS.has(cast.skill.id)) energyMeld(runtime);
    if (cast.skill.id === ID.SWAP_LEGENDS) grantAllianceInvocationEndurance(runtime);
  },
  onCastCancel(runtime, cast) {
    // Ending a cancelled jump also retires any autoattack chain advanced while airborne.
    if (cast.skill.id === VINDICATOR_JUMP_SKILL.id) resetAutoattackChains(runtime);
  },
  tasks: { [LANDING]: land }
};
