import assert from "node:assert/strict";
import test from "node:test";

import {
  guardianAttributeRules,
} from "../js/professions/guardian/attribute-rules.js";
import {
  GUARDIAN_TRAIT_IDS as GUARDIAN,
} from "../js/professions/guardian/data/ids.js";
import {
  mesmerAttributeRules,
} from "../js/professions/mesmer/attribute-rules.js";
import {
  MESMER_TRAIT_IDS as MESMER,
} from "../js/professions/mesmer/data/ids.js";
import {
  necromancerAttributeRules,
} from "../js/professions/necromancer/attribute-rules.js";
import {
  NECROMANCER_TRAIT_IDS as NECROMANCER,
} from "../js/professions/necromancer/data/ids.js";

function modifierContext({
  traits = [],
  event = { source: "Player" },
  config = {},
  runtime = {},
  events = [],
  active = [],
  stacks = {},
  sigils = {
    strike: 1.08,
    strikeAdd: 0.08,
    condition: 1.05,
    conditionAdd: 0.05,
  },
} = {}) {
  const activeKinds = new Set(active);
  return {
    time: 1,
    traits: new Set(traits),
    event,
    events,
    config: {
      boons: {},
      target: {},
      ...config,
    },
    runtime: {
      totals: { strike: 0, condition: 0 },
      profession: {},
      boons: new Map(),
      conditionState: new Map(),
      ...runtime,
    },
    timeline: {
      activeSigilSetAt: () => sigils,
      timedActive: kind => activeKinds.has(kind),
      timedStacks: kind => Number(stacks[kind] || 0),
      furyActiveAt: () => Boolean(config.boons?.fury),
      vigorActiveAt: () => Boolean(config.boons?.vigor),
      vulnerabilityStacksAt: () =>
        Number(config.target?.conditions?.Vulnerability || 0),
      mightStacksAt: () => Number(config.boons?.might || 0),
    },
  };
}

test("Guardian additive and multiplicative modifiers use separate buckets", () => {
  const context = modifierContext({
    traits: [
      GUARDIAN.EMPOWERED_ARMAMENTS,
      GUARDIAN.RADIANT_ARMAMENTS,
      GUARDIAN.FURIOUS_FOCUS,
      GUARDIAN.RETRIBUTION,
      GUARDIAN.SYMBOLIC_AVENGER,
      GUARDIAN.FIERY_WRATH,
      GUARDIAN.SYMBOLIC_EXPOSURE,
    ],
    config: {
      boons: { fury: true },
      target: {
        conditions: { Burning: true, Vulnerability: 25 },
      },
    },
    runtime: {
      totals: { strike: 0, condition: 0 },
      profession: {
        resolutionUntil: 10,
        symbolicAvengerUntil: 10,
        symbolicAvengerStacks: 5,
      },
      boons: new Map(),
      conditionState: new Map(),
    },
    active: [
      "guardian-empowered-armaments",
      "guardian-piercing-stance",
    ],
    events: [{
      type: "buff",
      kind: "guardian-radiant-armaments",
      at: 0,
      duration: 10,
      radiantWeapon: "hammer",
    }],
  });

  const actual = guardianAttributeRules.modifyStrikeDamage(context, 1.08);
  assert.ok(Math.abs(actual - 1.6 * 1.05 * 1.05) < 1e-12);
});

test("Necromancer outgoing damage follows Discretize modifier buckets", () => {
  const traits = [
    NECROMANCER.SOUL_BARBS,
    NECROMANCER.DREAD,
    NECROMANCER.WICKED_CORRUPTION,
    NECROMANCER.SEPTIC_CORRUPTION,
    NECROMANCER.CASCADING_CORRUPTION,
    NECROMANCER.LINGERING_SPIRITS,
    NECROMANCER.SPITEFUL_TALISMAN,
    NECROMANCER.CLOSE_TO_DEATH,
    NECROMANCER.COLD_SHOULDER,
    NECROMANCER.SOUL_EATER,
  ];
  const context = modifierContext({
    traits,
    config: {
      target: {
        health: 100,
        boonless: true,
        nearby: true,
        conditions: { Chilled: true },
      },
    },
    runtime: {
      totals: { strike: 60, condition: 0 },
      profession: {
        blight: 10,
        dreadUntil: 10,
        meltdownUntil: 10,
        activeSpirits: {
          anguish: true,
          wanderlust: true,
        },
      },
      boons: new Map(),
      conditionState: new Map(),
    },
    active: ["necromancer-soul-barbs"],
  });

  const strike = necromancerAttributeRules.modifyStrikeDamage(context, 1.08);
  assert.ok(
    Math.abs(strike - 1.63 * 1.05 * 1.2 * 1.15 * 1.15) < 1e-12,
  );

  const condition = necromancerAttributeRules.modifyConditionDamage(
    { ...context, condition: "Bleeding" },
    1.05,
  );
  assert.ok(Math.abs(condition - 1.275) < 1e-12);
});

test("Mesmer trait and skill buffs share their additive damage buckets", () => {
  const context = modifierContext({
    traits: [
      MESMER.NOMADS_ENDURANCE,
      MESMER.SHREDDING,
    ],
    config: {
      boons: { vigor: true },
      target: {},
    },
    active: [
      "deadly-blades",
      "illusionary-membrane",
      "altered-chord",
    ],
    stacks: {
      compounding: 5,
      "phantom-pain": 2,
    },
    events: [{
      type: "mesmer.instrument",
      instrument: "Lute",
      at: 0,
      expiresAt: 10,
    }],
  });

  const strike = mesmerAttributeRules.modifyStrikeDamage(context, 1.08);
  assert.ok(Math.abs(strike - 1.905) < 1e-12);

  const condition = mesmerAttributeRules.modifyConditionDamage(
    { ...context, condition: "Torment" },
    1.05,
  );
  assert.ok(Math.abs(condition - 1.67) < 1e-12);
});

test("Mesmer instrument checks skip other specializations and index events once", () => {
  const countedEvents = () => {
    let reads = 0;
    const events = new Proxy([
      ...Array.from({ length: 100 }, (_, index) => ({
        type: "action",
        at: index,
      })),
      {
        type: "mesmer.instrument",
        instrument: "Lute",
        at: 0,
        expiresAt: 10,
      },
    ], {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) {
          reads += 1;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    return { events, reads: () => reads };
  };

  const irrelevant = countedEvents();
  const virtuoso = modifierContext({
    config: { specialization: "Virtuoso" },
    events: irrelevant.events,
  });
  mesmerAttributeRules.modifyAttributes(virtuoso, { power: 100 });
  mesmerAttributeRules.modifyStrikeDamage(virtuoso, 1.08);
  assert.equal(irrelevant.reads(), 0);

  const relevant = countedEvents();
  const troubadour = modifierContext({
    traits: [MESMER.FORTISSIMO, MESMER.SHREDDING],
    config: { specialization: "Troubadour" },
    events: relevant.events,
  });
  const attributes = mesmerAttributeRules.modifyAttributes(
    troubadour,
    { power: 100 },
  );
  const first = mesmerAttributeRules.modifyStrikeDamage(troubadour, 1.08);
  const second = mesmerAttributeRules.modifyStrikeDamage(troubadour, 1.08);

  assert.equal(attributes.power, 104);
  assert.equal(first, second);
  assert.equal(relevant.reads(), relevant.events.length);
});

test("Vicious Expression always applies its base multiplicative modifier", () => {
  const base = modifierContext({
    traits: [MESMER.VICIOUS_EXPRESSION],
  });
  const boonless = modifierContext({
    traits: [MESMER.VICIOUS_EXPRESSION],
    config: { target: { boonless: true } },
  });

  assert.ok(
    Math.abs(mesmerAttributeRules.modifyStrikeDamage(base, 1.08) - 1.188)
      < 1e-12,
  );
  assert.ok(
    Math.abs(
      mesmerAttributeRules.modifyStrikeDamage(boonless, 1.08) - 1.242,
    ) < 1e-12,
  );
});

test("Mesmer strike sigils apply to the player but not illusion sources", () => {
  const player = modifierContext({ event: { source: "Player" } });
  const clone = modifierContext({ event: { source: "Clone" } });
  const phantasm = modifierContext({ event: { source: "Phantasm" } });

  assert.equal(mesmerAttributeRules.modifyStrikeDamage(player, 1.08), 1.08);
  assert.equal(mesmerAttributeRules.modifyStrikeDamage(clone, 1.08), 1);
  assert.equal(mesmerAttributeRules.modifyStrikeDamage(phantasm, 1.08), 1);
});
