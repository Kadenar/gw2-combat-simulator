import type { BalanceProfile } from "../../../../platform/engine/types.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const SCRAPPER_BALANCE_PROFILE_IDS = Object.freeze({
  kineticAccelerators: TRAIT.KINETIC_ACCELERATORS,
  massMomentum: TRAIT.MASS_MOMENTUM,
  speedOfSynergy: TRAIT.SPEED_OF_SYNERGY,
  gyroscopicAcceleration: TRAIT.GYROSCOPIC_ACCELERATION,
  systemShocker: TRAIT.SYSTEM_SHOCKER,
  appliedForce: TRAIT.APPLIED_FORCE,
});

const trait = (
  id: number,
  name: string,
  fields: Readonly<Record<string, unknown>>,
): BalanceProfile => ({
  id,
  name,
  profileKind: "trait",
  categories: ["Trait"],
  skillFamily: "Trait",
  effects: [],
  ...fields,
});

export const SCRAPPER_BALANCE_PROFILES: readonly BalanceProfile[] =
  Object.freeze([
    trait(
      SCRAPPER_BALANCE_PROFILE_IDS.kineticAccelerators,
      "Kinetic Accelerators",
      {
        internalCooldown: 3,
        effects: [
          { type: "boon", boon: "quickness", stacks: 1, duration: 3 },
          { type: "boon", boon: "might", stacks: 3, duration: 10 },
        ],
      },
    ),
    trait(SCRAPPER_BALANCE_PROFILE_IDS.massMomentum, "Mass Momentum", {
      pulseInterval: 1,
      effects: [
        { type: "boon", boon: "might", stacks: 1, duration: 5 },
        { type: "boon", boon: "stability", stacks: 1, duration: 3 },
      ],
    }),
    trait(SCRAPPER_BALANCE_PROFILE_IDS.speedOfSynergy, "Speed of Synergy", {
      minimumStacks: 5,
      threshold: 7,
      maximumStacks: 12,
    }),
    trait(
      SCRAPPER_BALANCE_PROFILE_IDS.gyroscopicAcceleration,
      "Gyroscopic Acceleration",
      {
        effects: [{ type: "buff", kind: "superspeed", stacks: 1, duration: 5 }],
      },
    ),
    trait(SCRAPPER_BALANCE_PROFILE_IDS.systemShocker, "System Shocker", {
      effects: [{ type: "control", duration: 1 }],
    }),
    trait(SCRAPPER_BALANCE_PROFILE_IDS.appliedForce, "Applied Force", {
      maximumStacks: 25,
      threshold: 10,
      internalCooldown: 10,
      attributePerStack: 30,
      effects: [{ type: "boon", boon: "stability", stacks: 1, duration: 3 }],
    }),
  ]);
