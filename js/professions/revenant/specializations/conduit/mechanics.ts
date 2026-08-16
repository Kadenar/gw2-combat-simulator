/** Conduit handler profiles owned by the Conduit Revenant module. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const CONDUIT_MECHANICS = freeze({
  legendInvocation: freeze({
    // Affinity granted by Lingering Determination on legend swap (trait effect, not the standard 1 per legend skill).
    lingeringDeterminationAffinity: 2,
    // Enhanced Embodiment extends Cosmic Wisdom by 1 s per legend swap while the form is active.
    enhancedEmbodimentExtension: 1,
  }),
  traitProcs: freeze({
    mistfire: freeze({
      // 1-second cooldown prevents Mistfire from firing on every rapid control event.
      interval: 1,
      coefficient: 0.6,
      burningStacks: 1,
      burningDuration: 6,
    }),
  }),
  conduit: freeze({
    affinityMaximum: 5,
    // At affinity ≥ 3, Release Potential gains effects from all equipped legends, not just the active one.
    allReleaseEffectsAffinity: 3,
    // Energy pulse granted by Expanded Consciousness when affinity reaches maximum.
    expandedConsciousnessEnergy: 15,
    sharedWisdomSwiftness: 5,
    numinousGift: freeze({
      mightStacks: 5,
      mightDuration: 10,
      boons: freeze({
        // One unique boon per legend; keyed by legend ID so Numinous Gift iterates selectedLegendIds.
        [LEGEND.ASSASSIN]: freeze(["fury", 10]),
        [LEGEND.DEMON]: freeze(["resistance", 5]),
        [LEGEND.DWARF]: freeze(["stability", 5]),
        [LEGEND.CENTAUR]: freeze(["protection", 5]),
        [LEGEND.ENTITY]: freeze(["quickness", 5]),
      }),
    }),
    beguilingHaze: freeze({
      mainCoefficient: 2.2,
      // Measured from cast start, not cast end; the impact lands during the animation.
      mainImpactDelay: 0.522,
      followUpCoefficient: 0.6,
      // Follow-up casts are near-instant; the 0.25 s cast time (without quickness) dwarfs this delay.
      followUpImpactDelay: 0.2,
      followUpCharges: 2,
      sharedWisdomFury: 5,
    }),
    hexEaterVortex: freeze({
      maximumProjectiles: 6,
      projectileCoefficient: 0.2,
      // Fixed per-projectile timestamps measured from cast start; all 6 slots must be defined even when fewer fire.
      projectileDelays: freeze([0.443, 0.562, 0.682, 0.802, 0.92, 1.039]),
      tormentStacks: 1,
      tormentDuration: 1.5,
      sharedWisdomResolution: 3,
    }),
    gladiatorsDefense: freeze({
      coefficient: 1.5,
      weaknessDuration: 5,
      resolutionDuration: 3,
      resistanceDuration: 3,
      sharedWisdomStability: 3,
    }),
    twinMoonSweep: freeze({
      playerCoefficient: 2.5,
      fragmentCoefficient: 2.5,
      // Both player hit and fragment share this delay and loop count; they land simultaneously.
      packets: 2,
      impactDelay: 0.88,
      bleedStacks: 2,
      bleedDuration: 3,
      mightStacks: 2,
      mightDuration: 8,
      assassinImmobilize: 2,
      // Demon shatter arrives after the main hit; treated as a separate delayed packet per loop.
      demonShatterCoefficient: 0.2,
      demonShatterDelay: 1.402,
      demonConfusionStacks: 3,
      demonConfusionDuration: 3,
      // burningBolts/Delay are defined but not yet emitted (placeholder for future Burning Bolt resonance).
      burningBolts: 2,
      burningBoltDuration: 1,
      burningBoltDelay: 0.04,
      sharedWisdomMightStacks: 5,
      sharedWisdomMightDuration: 10,
    }),
    releasePotential: freeze({
      // Monk variant is purely defensive; no damage, no affinity scaling.
      [ID.RELEASE_POTENTIAL_MONK]: freeze({
        resistanceDuration: 2,
        regenerationDuration: 6,
      }),
      [ID.RELEASE_POTENTIAL_DERVISH]: freeze({
        coefficient: 1.98,
        impactDelay: 0.56,
        demonBleedStacks: 3,
        demonBleedDuration: 6,
        centaurMightStacks: 10,
        centaurMightDuration: 8,
        centaurFuryDuration: 8,
      }),
      [ID.RELEASE_POTENTIAL_MESMER]: freeze({
        coefficient: 1.98,
        impactDelay: 0.28,
        tormentStacks: 2,
        // Target torment grows with affinity; self-inflicted torment shrinks with affinity (higher affinity = less self-harm).
        tormentBaseDuration: 3,
        tormentDurationPerAffinity: 0.1,
        selfTormentBaseDuration: 8,
        selfDurationReductionPerAffinity: 0.15,
        dazeDuration: 2,
      }),
      [ID.RELEASE_POTENTIAL_ASSASSIN]: freeze({
        coefficientPerHit: 0.6,
        hits: 3,
        hitDelays: freeze([0.16, 0.48, 0.8]),
        // Both Crippled and Immobilized conditions share the same affinity-scaled duration formula.
        conditionBaseDuration: 2,
        conditionDurationPerAffinity: 0.2,
      }),
      [ID.RELEASE_POTENTIAL_WARRIOR]: freeze({
        // Warrior variant has no legend-based conditional effects; pure strike damage only.
        coefficient: 1.649,
      }),
    }),
    // Cosmic Wisdom duration in seconds; Extended Embodiment adds on top via legend-swap hook.
    cosmicWisdomDuration: 7,
    formOfTheMesmer: freeze({
      // Banish Enchantment costs 5 energy and has a 5 s cooldown in Mesmer form instead of its base values.
      banishEnchantmentEnergyCost: 5,
      banishEnchantmentCooldown: 5,
      callToAnguishEnergyCost: 10,
      // Unyielding Impact and Embrace the Darkness become free in Mesmer form.
      unyieldingImpactEnergyCost: 0,
      embraceTheDarknessEnergyCost: 0,
    }),
    formOfTheAssassin: freeze({
      lesserEnchantedDaggersCoefficient: 0.06,
      // Impossible Odds proc fires every 1 s; tracked via nextAlliedProcAt on the upkeep record.
      impossibleOddsInterval: 1,
    }),
    formOfTheDervishCoefficient: 0.8,
  }),
});
