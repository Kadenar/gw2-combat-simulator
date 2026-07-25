import { GUARDIAN_SKILL_IDS as ID } from "../ids.js";
import {
  condition,
  implemented,
  repeatedCondition,
  strike,
} from "./effect-factories.js";

export const GUARDIAN_SKILL_OVERRIDES = Object.freeze({
  [ID.GREAT_SWORD_STRIKE]: implemented({
    castTimeMs: 500,
    effects: [strike(1)],
  }),
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: implemented({
    castTimeMs: 500,
    effects: [strike(1.1)],
  }),
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: implemented({
    castTimeMs: 500,
    effects: [strike(1.5)],
  }),
  [ID.WHIRLING_WRATH]: implemented({
    castTimeMs: 750,
    effects: [
      strike(2.45, { hits: 7, atMs: 100, intervalMs: 100 }),
      strike(0.275, { atMs: 750, name: "Whirling Wrath Projectile" }),
    ],
  }),
  [ID.LEAP_OF_FAITH]: implemented({
    castTimeMs: 500,
    effects: [strike(2), { type: "blind" }],
  }),
  [ID.SYMBOL_OF_RESOLUTION]: implemented({
    castTimeMs: 250,
    effects: [
      strike(0.8, { atMs: 250, name: "Symbol of Resolution — Initial" }),
      strike(2.6, {
        hits: 4,
        atMs: 250,
        intervalMs: 1000,
        name: "Symbol of Resolution",
      }),
    ],
  }),
  [ID.BINDING_BLADE]: implemented({
    castTimeMs: 750,
    effects: [strike(2.5), { type: "control" }],
  }),

  [ID.SWORD_OF_WRATH]: implemented({
    castTimeMs: 500,
    effects: [strike(0.75)],
  }),
  [ID.SWORD_ARC]: implemented({
    castTimeMs: 500,
    effects: [strike(0.8)],
  }),
  [ID.SWORD_WAVE]: implemented({
    castTimeMs: 500,
    effects: [strike(1.65, { hits: 3 })],
  }),
  [ID.SYMBOL_OF_BLADES]: implemented({
    castTimeMs: 250,
    effects: [
      strike(3.25, { hits: 5, atMs: 250, intervalMs: 1000 }),
      { type: "blind" },
      { type: "boon", boon: "fury", duration: 2 },
    ],
  }),
  [ID.ZEALOTS_DEFENSE]: implemented({
    castTimeMs: 3000,
    effects: [
      strike(4.8, { hits: 8, atMs: 375, intervalMs: 375 }),
    ],
  }),

  [ID.TRUE_STRIKE]: implemented({
    castTimeMs: 500,
    effects: [strike(0.8)],
  }),
  [ID.PURE_STRIKE]: implemented({
    castTimeMs: 500,
    effects: [strike(1)],
  }),
  [ID.FAITHFUL_STRIKE]: implemented({
    castTimeMs: 750,
    effects: [strike(1.55)],
  }),
  [ID.SYMBOL_OF_FAITH]: implemented({
    castTimeMs: 750,
    effects: [
      strike(3.25, { hits: 5, atMs: 750, intervalMs: 1000 }),
    ],
  }),
  [ID.PROTECTORS_STRIKE]: implemented({
    castTimeMs: 750,
    effects: [strike(2)],
  }),

  [ID.ORB_OF_WRATH]: implemented({
    castTimeMs: 500,
    effects: [strike(0.666)],
  }),
  [ID.SYMBOL_OF_PUNISHMENT]: implemented({
    castTimeMs: 250,
    effects: [
      strike(2.5, { hits: 5, atMs: 250, intervalMs: 1000 }),
    ],
  }),
  [ID.CHAINS_OF_LIGHT]: implemented({
    castTimeMs: 750,
    effects: [strike(0.25), { type: "control" }],
  }),

  [ID.RAY_OF_JUDGMENT]: implemented({
    castTimeMs: 750,
    effects: [
      strike(4.05, { hits: 6, atMs: 750, intervalMs: 500 }),
      { type: "blind" },
    ],
  }),
  [ID.SHIELD_OF_WRATH]: implemented({
    castTimeMs: 0,
    effects: [strike(2.5, { atMs: 4000 })],
  }),
  [ID.ZEALOTS_FLAME]: implemented({
    castTimeMs: 0,
    effects: [condition("Burning", 4, 3)],
  }),
  [ID.ZEALOTS_FIRE]: implemented({
    castTimeMs: 250,
    cooldown: 0,
    effects: [
      strike(2.25),
      condition("Burning", 3, 3),
    ],
  }),
  [ID.CLEANSING_FLAME]: implemented({
    castTimeMs: 4000,
    effects: [
      strike(4, { hits: 10, atMs: 400, intervalMs: 400 }),
      condition("Burning", 2, 4, 4000),
    ],
  }),

  [ID.THROUGH_THE_HEART]: implemented({
    castTimeMs: 500,
    effects: [
      strike(0.6),
      condition("Bleeding", 1, 8),
    ],
  }),
  [ID.PEACEKEEPER]: implemented({
    castTimeMs: 500,
    effects: [
      strike(1.25, { hits: 5, atMs: 100, intervalMs: 100 }),
      ...repeatedCondition("Burning", {
        count: 5,
        duration: 2,
        firstAtMs: 100,
        intervalMs: 100,
      }),
    ],
  }),
  [ID.SYMBOL_OF_IGNITION]: implemented({
    castTimeMs: 250,
    effects: [
      strike(2, { hits: 5, atMs: 250, intervalMs: 1000 }),
      condition("Burning", 1, 1, 250),
    ],
  }),
  [ID.HAIL_OF_JUSTICE]: implemented({
    castTimeMs: 250,
    cooldown: 10,
    ammo: 2,
    effects: [
      strike(1.5, { hits: 5, atMs: 50, intervalMs: 50 }),
      ...repeatedCondition("Bleeding", {
        count: 5,
        duration: 8,
        firstAtMs: 50,
        intervalMs: 50,
      }),
    ],
  }),
  [ID.JURISDICTION]: implemented({
    castTimeMs: 750,
    effects: [
      strike(3),
      condition("Burning", 5, 6),
      { type: "control" },
    ],
  }),

  [ID.SWORD_OF_JUSTICE]: implemented({
    castTimeMs: 500,
    cooldown: 15,
    ammo: 3,
    effects: [
      strike(2.88, { hits: 4, atMs: 500, intervalMs: 1000 }),
    ],
  }),
  [ID.SIGNET_OF_WRATH]: implemented({
    castTimeMs: 1000,
    effects: [
      strike(0.25),
      condition("Burning", 3, 5),
      { type: "control" },
    ],
  }),
  [ID.PURGING_FLAMES]: implemented({
    castTimeMs: 250,
    effects: [
      strike(1.2, { hits: 6, atMs: 250, intervalMs: 1000 }),
      ...repeatedCondition("Burning", {
        count: 6,
        duration: 2,
        firstAtMs: 250,
        intervalMs: 1000,
      }),
    ],
  }),
  [ID.PROCESSION_OF_BLADES]: implemented({
    castTimeMs: 250,
    effects: [
      strike(4.4, { hits: 10, atMs: 250, intervalMs: 500 }),
    ],
  }),

  [ID.JUSTICE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.RESOLVE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.COURAGE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.RENEWED_FOCUS]: implemented({
    castTimeMs: 2000,
    handlerId: "guardian.renewed-focus",
    effects: [],
  }),
  [ID.TOME_OF_JUSTICE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.TOME_OF_RESOLVE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.TOME_OF_COURAGE]: implemented({
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }),
  [ID.SCORCHED_AFTERMATH]: implemented({
    castTimeMs: 500,
    handlerId: "guardian.tome-page",
    effects: [
      strike(3.2, { hits: 5, atMs: 500, intervalMs: 1000 }),
      ...repeatedCondition("Burning", {
        count: 5,
        duration: 3,
        firstAtMs: 500,
        intervalMs: 1000,
      }),
      ...repeatedCondition("Bleeding", {
        count: 5,
        duration: 5,
        firstAtMs: 500,
        intervalMs: 1000,
      }),
    ],
  }),
  [ID.ASHES_OF_THE_JUST]: implemented({
    castTimeMs: 750,
    handlerId: "guardian.tome-page",
    effects: [],
  }),
});
