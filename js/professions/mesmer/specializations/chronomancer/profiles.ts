import type { BalanceProfile } from "../../../../platform/engine/types.js";
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  mesmerShatterProfile,
  mesmerTraitDamageProfile,
} from "../../core/profiles.js";
import {
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_TRAIT_DAMAGE,
} from "./mechanics.js";

export const CHRONOMANCER_BALANCE_PROFILE_IDS = Object.freeze({
  continuumSplit: "mesmer.chronomancer.continuum-split",
  timeSink: "mesmer.chronomancer.time-sink",
  rewinder: "mesmer.chronomancer.rewinder",
  splitSecond: "mesmer.chronomancer.split-second",
  flowOfTime: TRAIT.FLOW_OF_TIME,
  dangerTime: TRAIT.DANGER_TIME,
  timeBomb: TRAIT.TIME_BOMB,
  illusionaryReversion: TRAIT.ILLUSIONARY_REVERSION,
  chronophantasma: TRAIT.CHRONOPHANTASMA,
});

export const CHRONOMANCER_SHATTER_PROFILE_IDS: Readonly<
  Record<number, string>
> = Object.freeze({
  [ID.CONTINUUM_SPLIT]: CHRONOMANCER_BALANCE_PROFILE_IDS.continuumSplit,
  [ID.TIME_SINK]: CHRONOMANCER_BALANCE_PROFILE_IDS.timeSink,
  [ID.REWINDER]: CHRONOMANCER_BALANCE_PROFILE_IDS.rewinder,
  [ID.SPLIT_SECOND]: CHRONOMANCER_BALANCE_PROFILE_IDS.splitSecond,
});

const trait = (
  id: number,
  name: string,
  fields: Readonly<Record<string, unknown>> = {},
): BalanceProfile => ({
  id,
  name,
  profileKind: "trait",
  categories: ["Trait"],
  skillFamily: "Trait",
  effects: [],
  ...fields,
});

export const CHRONOMANCER_BALANCE_PROFILES: readonly BalanceProfile[] =
  Object.freeze([
    ...Object.entries(MESMER_CHRONOMANCER_SHATTERS).map(([skillId, shatter]) =>
      mesmerShatterProfile(
        CHRONOMANCER_SHATTER_PROFILE_IDS[Number(skillId)],
        Number(skillId),
        {
          [ID.CONTINUUM_SPLIT]: "Continuum Split",
          [ID.TIME_SINK]: "Time Sink",
          [ID.REWINDER]: "Rewinder",
          [ID.SPLIT_SECOND]: "Split Second",
        }[Number(skillId)] || `Chronomancer Shatter ${skillId}`,
        shatter,
        Number(skillId) === ID.REWINDER
          ? [
              {
                type: "condition",
                condition: "Confusion",
                duration: 3,
                stacks: 1,
              },
            ]
          : [],
      ),
    ),
    trait(CHRONOMANCER_BALANCE_PROFILE_IDS.flowOfTime, "Flow of Time", {
      criticalChance: 0.15,
    }),
    trait(CHRONOMANCER_BALANCE_PROFILE_IDS.dangerTime, "Danger Time", {
      criticalDamage: 0.05,
      durationMultiplier: 10,
    }),
    mesmerTraitDamageProfile(
      CHRONOMANCER_BALANCE_PROFILE_IDS.timeBomb,
      "Time Bomb",
      MESMER_CHRONOMANCER_TRAIT_DAMAGE["Time Bomb"],
    ),
    trait(
      CHRONOMANCER_BALANCE_PROFILE_IDS.illusionaryReversion,
      "Illusionary Reversion",
      { threshold: 3, resourceGain: 1 },
    ),
    trait(CHRONOMANCER_BALANCE_PROFILE_IDS.chronophantasma, "Chronophantasma", {
      damageMultiplier: 1.05,
    }),
  ]);
