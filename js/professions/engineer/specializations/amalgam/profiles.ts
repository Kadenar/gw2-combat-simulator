import type { BalanceProfile } from "../../../../platform/engine/types.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const AMALGAM_BALANCE_PROFILE_IDS = Object.freeze({
  morphs: "engineer.amalgam.morphs",
  strains: "engineer.amalgam.strains",
  evolve: "engineer.amalgam.evolve",
  newGenes: TRAIT.NEW_GENES,
  willingHost: TRAIT.WILLING_HOST,
  hardenedChrome: TRAIT.HARDENED_CHROME,
  mercurialTendencies: TRAIT.MERCURIAL_TENDENCIES,
  plasmaticState: "engineer.amalgam.plasmatic-state",
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

export const AMALGAM_BALANCE_PROFILES: readonly BalanceProfile[] =
  Object.freeze([
    {
      id: AMALGAM_BALANCE_PROFILE_IDS.morphs,
      name: "Amalgam Morphs",
      profileKind: "mechanic",
      durationMultiplier: 6,
      pulseInterval: 1,
      maximumStacks: 6,
      effects: [{ type: "strike", coefficient: 0.5, hits: 1 }],
    },
    {
      id: AMALGAM_BALANCE_PROFILE_IDS.strains,
      name: "Amalgam Strains",
      profileKind: "mechanic",
      durationMultiplier: 8,
      maximumStacks: 10,
      attributePerStack: 5,
      effects: [],
    },
    {
      id: AMALGAM_BALANCE_PROFILE_IDS.evolve,
      name: "Evolved",
      profileKind: "mechanic",
      durationMultiplier: 8,
      damageMultiplier: 1.1,
      coefficientMultiplier: 1.2,
      minimumStacks: 1,
      maximumStacks: 2,
      effects: [],
    },
    trait(AMALGAM_BALANCE_PROFILE_IDS.newGenes, "New Genes", {
      effects: [
        { type: "boon", boon: "alacrity", stacks: 1, duration: 5 },
        { type: "boon", boon: "might", stacks: 4, duration: 12 },
      ],
    }),
    trait(AMALGAM_BALANCE_PROFILE_IDS.willingHost, "Willing Host", {
      durationMultiplier: 10,
    }),
    trait(AMALGAM_BALANCE_PROFILE_IDS.hardenedChrome, "Hardened Chrome", {
      minimumStacks: 2.5,
      maximumStacks: 4,
    }),
    trait(
      AMALGAM_BALANCE_PROFILE_IDS.mercurialTendencies,
      "Mercurial Tendencies",
      { internalCooldown: 0.25, rechargeReduction: 2.5 },
    ),
    {
      id: AMALGAM_BALANCE_PROFILE_IDS.plasmaticState,
      name: "Plasmatic State",
      profileKind: "mechanic",
      durationMultiplier: 6,
      effects: [],
    },
  ]);
