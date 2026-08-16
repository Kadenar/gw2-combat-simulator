/** Vindicator mechanics constants owned by the Vindicator Revenant module. */

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const VINDICATOR_MECHANICS = freeze({
  legendInvocation: freeze({
    spiritBoon: freeze({
      kind: "vigor",
      // 4 s vigor on legend swap; shorter than most boon sources so it rarely overwrites existing stacks.
      duration: 4,
      stacks: 1,
    }),
    song: freeze({
      name: "Call of the Alliance",
      coefficient: 0.93,
      conditions: freeze([]),
      boons: freeze([]),
      // Song of the Mists grants endurance both on activation and per hit; hits=1 so the total is always 8.
      enduranceOnCast: 5,
      endurancePerHit: 3,
    }),
  }),
  endurance: freeze({
    // Standard out-of-vigor regen rate; vigor multiplies it to 10/s via vigorRegenerationMultiplier.
    regenerationPerSecond: 5,
    // Standard dodge costs 50; Vindicator uses the same amount but replaces the evasion roll with a damaging leap.
    dodgeCost: 50,
    vigorRegenerationMultiplier: 1.5,
    vindicatorDodgeCost: 50,
    // Dodge is modeled as a 0.2 s cast so the scheduler can represent the animation lock before the strike.
    vindicatorDodgeCastTime: 0.2,
    // The damaging strike lands ~160 ms after the dodge animation starts, not at cast completion.
    dodgeStrikeDelay: 0.16,
    energyMeld: freeze({
      // Base endurance grant from Energy Meld; Song of Arboreum raises it to 40 instead.
      endurance: 25,
      songOfArboreumEndurance: 40,
      songOfArboreumVigorDuration: 9,
      // Angsiyah's Trust restores legend energy (the separate Revenant resource), not endurance.
      angsiyansTrustEnergy: 25,
      // Reaver's Curse window; the next Vindicator dodge within this period consumes the buff.
      reaversCurseDuration: 6,
      // Reaver's Curse halves the recharge of Energy Meld.
      reaversCurseRechargeMultiplier: 0.5,
      // Consuming Reaver's Curse doubles the dodge strike coefficient.
      reaversCurseDodgeDamageMultiplier: 2,
    }),
    // Keyed by player-facing dodge name so the rotation builder and resolver share one source of truth.
    dodgeByName: freeze({
      "Death Drop": freeze({
        coefficient: 3.3,
        hits: 1,
      }),
      "Imperial Impact": freeze({
        coefficient: 2,
        hits: 1,
      }),
    }),
    // 10% flat strike bonus while endurance is not full; any fraction below the maximum qualifies.
    leviathanStrengthStrikeMultiplier: 1.1,
    // Forerunner of Death enters the GW2 damage-additive bucket, not a separate multiply.
    forerunnerOfDeathStrikeBonus: 0.25,
    // Forerunner window measured from the Death Drop landing timestamp; a second Death Drop resets it.
    forerunnerOfDeathDuration: 10,
    // Empire Divided flat power bonus; guard prevents double-adding when the caller pre-bakes static rules.
    empireDividedPower: 240,
    // Bonus applies strictly above 50% HP; exactly 50% does NOT qualify.
    empireDividedHealthThreshold: 0.5,
  }),
});
