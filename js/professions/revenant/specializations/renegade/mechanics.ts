/** Renegade mechanics constants owned by the Renegade Revenant module. */

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const RENEGADE_MECHANICS = freeze({
  legendInvocation: freeze({
    spiritBoon: freeze({
      kind: "resolution",
      duration: 4,
      stacks: 1,
    }),
    song: freeze({
      name: "Call of the Renegade",
      coefficient: 0.5,
      conditions: freeze([freeze(["Bleeding", 2, 8])]),
      boons: freeze([
        freeze(["kallas-fervor", 8, 1]),
        // kallas-fervor-hit is a second Kalla's Fervor stack granted on hit (Song grants 2 total)
        freeze(["kallas-fervor-hit", 8, 1]),
      ]),
    }),
  }),
  soulcleave: freeze({
    // 1-second internal cooldown prevents a single burst from triggering multiple Soulcleave pulses
    interval: 1,
    coefficient: 0.8,
    siphon: freeze({
      // Life Siphon uses a flat-strike formula (base + power coefficient) instead of a normal coefficient
      flatStrikeBase: 325,
      flatStrikePowerCoeff: 0.1,
    }),
  }),
  bandTogether: freeze({
    // 4-second window during which a second Band Together press triggers the enhanced summon
    duration: 4,
    darkrazor: freeze({
      // Stability pulse durations differ: 1s self-only cast stability vs 6s allied stability
      casterStabilityDuration: 1,
      alliedStabilityDuration: 6,
      // Enhanced Darkrazor's Daring total breakbar: 600 base + 400 bonus = 1000
      enhancedBreakbar: 600,
      bonusDefianceBreak: 400,
      resistance: 4,
      protection: 4,
    }),
    icerazor: freeze({
      // 1.5s chill on enhanced hits; normal Icerazor chill is handled via catalog effects
      enhancedChill: 1.5,
      // ~161ms between successive Icerazor projectile impacts (measured in-game at 60fps)
      packetInterval: 0.161,
      // Normal Icerazor first impact lands 0.5s after cast; enhanced version is delayed to 1.2s
      normalImpactDelay: 0.5,
      enhancedFirstImpactDelay: 1.2,
      // Immobilize on enhanced Icerazor lands 2 packets after the first hit (2 × packetInterval ≈ 0.322s)
      enhancedImpactSpan: 0.322,
    }),
    razorclaw: freeze({
      // 4 charges shared across the player and all allies; each hit by the player also draws a charge
      charges: 4,
      // 5-second summon window; charges expire when this duration elapses
      duration: 5,
      // 1-second per-charge internal cooldown prevents rapid multi-hit skills from exhausting all charges
      interval: 1,
      bleedDuration: 3,
      // Enhanced Razorclaw's Rage additionally applies 3 stacks of 6s Torment to the caster
      enhancedTormentStacks: 3,
      enhancedTormentDuration: 6,
    }),
  }),
  renegade: freeze({
    kallasFervor: freeze({
      maximumStacks: 5,
      // Lasting Legacy (minor master trait) extends duration from 8s to 12s and increases per-stack bonuses
      duration: 8,
      improvedDuration: 12,
      // +2% strike / condition / life-siphon damage per stack; Lasting Legacy raises strike to 5%, conditions to 3%
      strikeDamagePerStack: 0.02,
      conditionDamagePerStack: 0.02,
      lifeSiphonDamagePerStack: 0.02,
      improvedStrikeDamagePerStack: 0.05,
      improvedConditionDamagePerStack: 0.03,
      improvedLifeSiphonDamagePerStack: 0.03,
    }),
    heroicCommand: freeze({
      mightDuration: 8,
      // Heroic Command grants (stacks × 2) Might; Lasting Legacy raises this to (stacks × 3)
      mightPerFervor: 2,
      improvedMightPerFervor: 3,
    }),
    ordersFromAbove: freeze({
      // Each pulse gives 2s Alacrity; 4 pulses × 2s = 8s total without Righteous Rebel
      alacrityDuration: 2,
      pulses: 4,
      // Righteous Rebel adds 2 extra pulses for 6 total (12s Alacrity)
      improvedPulses: 6,
      // Pulses fire 1 second apart starting at cast completion
      interval: 1,
    }),
    endlessEnmity: freeze({
      furyDuration: 4,
      // 8-second ICD prevents double-procing from rapid multi-hit burst
      interval: 8,
    }),
    bloodFury: freeze({
      // 3-second ICD between Blood Fury Kalla's Fervor grants from fury applications
      interval: 3,
      // Blood Fury also extends Bleeding duration by 25% while under Fury
      bleedingDurationMultiplier: 1.25,
    }),
    allForOne: freeze({
      // Empowered Band Together restores 10 energy via All for One
      energy: 10,
      // All for One halves Band Together's recharge (×0.5 multiplier)
      enhancedRechargeMultiplier: 0.5,
    }),
    vindication: freeze({
      dazeDuration: 1,
    }),
  }),
});
