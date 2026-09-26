import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_AIRBORNE_MS, VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { emitRevenantBuff, revenantLiveCombatActive } from '#gw2/professions/revenant/core/live-events.js';
import { revenantCastCommitted } from '#gw2/professions/revenant/core/live.js';
import {
  emitRevenantInvocationProfile,
  emitRevenantInvocationSkill
} from '#gw2/professions/revenant/core/live-traits.js';
import { VINDICATOR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/live-events.js';

const LANDING = 'revenant.vindicator-landing';
const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

/** The grandmaster trait selects the dodge landing, so no separate dodge choice can drift from the build. */
function selectedDodge(runtime: RevenantRuntime): RevenantSkill | undefined {
  const skillId = hasTrait(runtime, TRAIT.SAINT_OF_ZU_HELTZER)
    ? ID.SAINTS_SHIELD
    : hasTrait(runtime, TRAIT.VASSALS_OF_THE_EMPIRE)
      ? ID.IMPERIAL_IMPACT
      : ID.DEATH_DROP;
  return runtime.helpers.skillsById.get(skillId) as RevenantSkill | undefined;
}

/** A dodge's landing resolves at its authored offset from the landing origin, not at acceptance. */
function scheduleLanding(runtime: RevenantRuntime, cast: RuntimeCast, origin: number): void {
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  const offset = effect.type === 'strike' ? effectFirstAtMs(effect) : effect.atMs;
  runtime.schedule(LANDING, canonicalTime(origin + Math.max(0, Number(offset || 0)) / 1000), {
    skillId: cast.skill.id,
    activationId: cast.id
  });
}

/** Landing consumes an armed Reaver's Curse, strikes with the Forerunner window it lands in, then renews it. */
function land(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, activationId } = data as { skillId: SkillId; activationId: string };
  const state = vindicatorState.from(runtime);
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  // An armed charge includes landing exactly at expiry; zero is the unarmed sentinel.
  const reaversCurse =
    hasTrait(runtime, TRAIT.REAVERS_CURSE) && state.reaversCurseUntil > 0 && state.reaversCurseUntil >= runtime.time;
  if (reaversCurse) state.reaversCurseUntil = 0;
  if (effect.type === 'strike' && strikeEffectCoefficient(effect) > 0) {
    const previousForerunnerUntil = Number(state.forerunnerOfDeathUntil || 0);
    const hits = strikeEffectTicks(effect).length;
    const coefficient =
      strikeEffectCoefficient(effect) *
      (reaversCurse
        ? Math.max(
            0,
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.reaversCurse), 'damageMultiplier')
          )
        : 1);
    for (let hit = 0; hit < hits; hit += 1)
      runtime.emit(
        buildResolverStrike({
          at: runtime.time,
          source: 'revenant',
          sourceId: skillId,
          actorType: 'player',
          skillId,
          skillName: profile.name,
          activationId,
          name: profile.name,
          coefficient: coefficient / hits,
          skillWeapon: 'Unequipped',
          // The strike benefits from the window it lands in; its own renewal follows below.
          forerunnerOfDeathActive: previousForerunnerUntil > runtime.time
        })
      );
    if (profile.id === ID.DEATH_DROP && hasTrait(runtime, TRAIT.FORERUNNER_OF_DEATH)) {
      const forerunner = requireBalanceProfileFromContext(runtime, PROFILE.forerunnerOfDeath);
      const window = requireEffect(forerunner, 'buff', 'forerunner-of-death');
      // The damage window is the buff, so a removed buff opens no window.
      if (window) {
        const duration = Math.max(0, effectNumber(forerunner, window, 'duration'));
        state.forerunnerOfDeathUntil = runtime.time + duration;
        emitRevenantBuff(
          runtime,
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
          null,
          true
        );
      }
    }
  }

  // Every declared condition and boon accompanies the landing.
  for (const secondary of profile.effects ?? []) {
    if (secondary.type === 'boon')
      emitRevenantBuff(runtime, {
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId: profile.id,
        actorType: 'player',
        skillId: profile.id,
        skillName: profile.name,
        activationId,
        kind: String(secondary.boon || ''),
        duration: Number(secondary.duration),
        stacks: Number(secondary.stacks ?? 1),
        ...(secondary.audience ? { audience: secondary.audience } : {})
      });
    else if (secondary.type === 'condition')
      for (const tick of conditionEffectTicks(secondary))
        runtime.emit(
          buildResolverCondition({
            at: runtime.time,
            source: 'revenant',
            sourceId: profile.id,
            actorType: 'player',
            skillId: profile.id,
            skillName: profile.name,
            activationId,
            condition: tick.condition,
            duration: tick.duration,
            stacks: tick.stacks
          })
        );
  }
}

/** Energy Meld grants endurance, arms Reaver's Curse, refunds in-combat Energy, and grants Song of Arboreum's Vigor. */
function energyMeld(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = vindicatorState.from(runtime);
  const song = hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM)
    ? requireBalanceProfileFromContext(runtime, PROFILE.songOfArboreum)
    : undefined;
  // Song of Arboreum replaces the base endurance amount.
  runtime.endurance.grant(song ? balanceProfileNumber(song, 'resourceGain') : Number(cast.skill.resourceGain));
  if (hasTrait(runtime, TRAIT.REAVERS_CURSE)) {
    const curse = requireBalanceProfileFromContext(runtime, PROFILE.reaversCurse);
    const effect = requireEffect(curse, 'buff', 'reavers-curse');
    // The armed window is the buff, so a removed buff arms nothing.
    if (effect)
      state.reaversCurseUntil = gw2EffectExpiresAt(runtime.time, Math.max(0, effectNumber(curse, effect, 'duration')));
  }

  // Angsiyan's Trust refunds Energy only in combat.
  if (hasTrait(runtime, TRAIT.ANGSIYANS_TRUST) && revenantLiveCombatActive(runtime))
    runtime.resourceController.grant(
      'energy',
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.angsiyansTrust), 'resourceGain')
      )
    );
  const vigor = song && requireEffect(song, 'boon', 'vigor');
  if (song && vigor)
    emitRevenantBuff(runtime, {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.SONG_OF_ARBOREUM,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: `${cast.skill.name} — ${String(vigor.boon)}`,
      kind: String(vigor.boon),
      duration: effectNumber(song, vigor, 'duration'),
      stacks: effectNumber(song, vigor, 'stacks')
    });
}

/** Swapping into Alliance in combat applies Spirit Boon and Song of the Mists, which also restores endurance. */
function invokeAlliance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !revenantLiveCombatActive(runtime)) return;
  if (hasTrait(runtime, TRAIT.SPIRIT_BOON))
    emitRevenantInvocationProfile(runtime, PROFILE.spiritBoon, TRAIT.SPIRIT_BOON);
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  emitRevenantInvocationSkill(runtime, ID.CALL_OF_THE_ALLIANCE, TRAIT.SONG_OF_THE_MISTS);
  runtime.endurance.grant(Number(song.resourceGain || 0));
}

/** Vindicator owns its dodge landings, Energy Meld, and Alliance invocation on the shared live state. */
export const vindicatorLiveMechanics: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  // The landing-only Dodge input uses the selected dodge's fixed animation.
  castDurationMs: (runtime, skill, duration) =>
    skill.id === ID.DODGE ? Math.max(0, Number(selectedDodge(runtime)?.castTimeMs || 0)) : duration,
  rechargeWork(runtime, skill, work) {
    if (!ENERGY_MELD_IDS.has(skill.id) || !hasTrait(runtime, TRAIT.REAVERS_CURSE)) return work;
    return (
      work *
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.reaversCurse), 'rechargeMultiplier')
      )
    );
  },
  modifyEffects: (_runtime, cast, effects) => (cast.skill.id === VINDICATOR_JUMP_SKILL.id ? [] : effects),
  onCastStart(runtime, cast) {
    // Landing-only inputs begin at the landing animation; full jumps land after their airborne time.
    if (cast.skill.id === ID.DODGE) scheduleLanding(runtime, cast, cast.start);
    else if (cast.skill.id === VINDICATOR_JUMP_SKILL.id && revenantCastCommitted(cast))
      scheduleLanding(runtime, cast, cast.start + VINDICATOR_AIRBORNE_MS / 1000);
  },
  onCastComplete(runtime, cast) {
    // Airborne autos may advance the chain; landing resets it before the next serial input.
    if (cast.skill.id === VINDICATOR_JUMP_SKILL.id) resetAutoattackChains(runtime);
    if (!revenantCastCommitted(cast)) return;
    if (ENERGY_MELD_IDS.has(cast.skill.id)) energyMeld(runtime, cast);
    if (cast.skill.id === ID.SWAP_LEGENDS) invokeAlliance(runtime);
  },
  tasks: { [LANDING]: land }
};
