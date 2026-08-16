import assert from "node:assert/strict";
import test from "node:test";

import { reconstructEvtcRotation } from "../../js/evtc-analyzer/rotation/index.js";
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
} from "../../js/evtc-analyzer/types.js";

const PLAYER = 0x1000n;
const TARGET = 0x2000n;

function event(overrides = {}) {
  return {
    time: 10_000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 1,
    targetInstance: 0,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 0,
    buff: 0,
    result: 0,
    activation: EVTC_ACTIVATION.NONE,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: EVTC_STATE_CHANGE.NONE,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides,
  };
}

function skill(id, name, overrides = {}) {
  return {
    id,
    name,
    type: "Weapon",
    slot: "Weapon_2",
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    implemented: true,
    ...overrides,
  };
}

function engineerLog(skills, events, { elite = 75, agents = [] } = {}) {
  return {
    header: {
      magic: "EVTC",
      arcdpsBuild: "20260815",
      revision: 1,
      encounterId: 16199,
      agentCount: 2 + agents.length,
      skillCount: skills.length,
      eventCount: events.length,
    },
    agents: [
      {
        address: PLAYER,
        profession: 3,
        elite,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: "Fixture Amalgam",
        account: ":Fixture.1234",
        subgroup: "1",
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: "Standard Kitty Golem",
        account: "",
        subgroup: "",
      },
      ...agents,
    ],
    skills: skills.map(({ id, name }) => ({ id, name })),
    events,
  };
}

test("reconstructs Mechanist commands, Overclock, and opening weapon precasts", () => {
  const mech = 0x3000n;
  const skills = [
    skill(63345, "Core Reactor Shot", {
      type: "Profession",
      slot: "Profession_1",
    }),
    skill(63121, "Jade Mortar", {
      type: "Profession",
      slot: "Profession_2",
    }),
    skill(63188, "Spark Revolver", {
      type: "Profession",
      slot: "Profession_3",
    }),
    skill(63095, "Overclock Signet", {
      type: "Elite",
      slot: "Elite",
    }),
    skill(6004, "Net Shot", {
      slot: "Weapon_2",
      quicknessCastTimeMs: 200,
    }),
    skill(6153, "Blunderbuss", {
      slot: "Weapon_3",
      quicknessCastTimeMs: 400,
    }),
  ];
  const fixture = engineerLog(
    skills,
    [
      event({
        time: 10_000,
        sourceInstance: 7,
        stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT,
      }),
      event({
        time: 10_050,
        value: 250,
        skillId: 6004,
        sourceInstance: 7,
        activation: EVTC_ACTIVATION.RESET,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      }),
      event({
        time: 10_050,
        source: mech,
        value: 250,
        skillId: 63345,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        activation: EVTC_ACTIVATION.RESET,
      }),
      ...animation(6153, 10_100, 400, { sourceInstance: 7 }),
      event({
        time: 10_600,
        source: mech,
        skillId: 63121,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        activation: EVTC_ACTIVATION.START,
      }),
      event({
        time: 10_800,
        source: mech,
        skillId: 63188,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        activation: EVTC_ACTIVATION.START,
      }),
      event({
        time: 11_000,
        target: PLAYER,
        skillId: 63059,
        sourceInstance: 7,
        buff: 1,
        buffRemove: 3,
      }),
      event({
        time: 11_000,
        target: PLAYER,
        skillId: 63059,
        sourceInstance: 7,
        buff: 1,
        buffRemove: 1,
      }),
    ],
    {
      elite: 70,
      agents: [
        {
          address: mech,
          profession: 0,
          elite: 0,
          toughness: 0,
          concentration: 0,
          healing: 0,
          condition: 0,
          character: "Jade Mech",
          account: "",
          subgroup: "",
        },
      ],
    },
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "engineer:mechanist");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      "Core Reactor Shot",
      "Net Shot",
      "Blunderbuss",
      "Jade Mortar",
      "Spark Revolver",
      "Overclock Signet",
    ],
  );
  assert.equal(
    result.actions.filter((action) => action.name === "Overclock Signet")
      .length,
    1,
  );
});

test("validates Engineer cast completion from observed strike packets", () => {
  const skills = [
    skill(6005, "Jump Shot", {
      slot: "Weapon_5",
      castTimeMs: 1_000,
      unaffectedByQuickness: true,
      effects: [
        {
          type: "strike",
          name: "Leap Damage",
          atMs: 117,
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
        {
          type: "strike",
          name: "Landing Damage",
          atMs: 1_000,
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
      ],
    }),
    skill(5807, "Shrapnel Grenade", {
      quicknessCastTimeMs: 680,
      effects: [
        {
          type: "strike",
          ticks: [{ atMs: 400 }, { atMs: 440 }, { atMs: 440 }],
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
      ],
    }),
    skill(6003, "Rifle Burst", {
      slot: "Weapon_1",
      quicknessCastTimeMs: 835,
      effects: [
        {
          type: "strike",
          name: "Rifle Burst",
          atMs: 318,
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
        {
          type: "strike",
          name: "Rifle Burst Grenade",
          atMs: 602,
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
      ],
    }),
    skill(6154, "Overcharged Shot", {
      slot: "Weapon_4",
      quicknessCastTimeMs: 400,
      effects: [
        {
          type: "strike",
          atMs: 451,
          timingAnchor: "castStart",
          timingScale: "fixed",
          persistsAfterInterrupt: true,
        },
      ],
    }),
  ];
  const fixture = engineerLog(
    skills,
    [
      event({ time: 1_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      ...animation(6005, 2_000, 500),
      event({ time: 2_117, target: TARGET, value: 100, skillId: 6005 }),
      event({ time: 3_001, target: TARGET, value: 800, skillId: 68091 }),
      ...animation(5807, 4_000, 435),
      event({ time: 4_401, target: TARGET, value: 100, skillId: 5807 }),
      event({ time: 4_434, target: TARGET, value: 100, skillId: 5807 }),
      event({ time: 4_485, target: TARGET, value: 100, skillId: 5807 }),
      ...animation(6003, 6_000, 567),
      event({ time: 6_318, target: TARGET, value: 100, skillId: 6003 }),
      ...animation(6003, 7_000, 567),
      event({ time: 7_318, target: TARGET, value: 100, skillId: 6003 }),
      event({ time: 7_602, target: TARGET, value: 100, skillId: 68079 }),
      event({
        time: 8_000,
        skillId: 6154,
        activation: EVTC_ACTIVATION.START,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
      }),
      event({
        time: 8_000,
        skillId: 6154,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      }),
      event({ time: 8_451, target: TARGET, value: 100, skillId: 6154 }),
      event({
        time: 9_000,
        skillId: 6003,
        activation: EVTC_ACTIVATION.START,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
      }),
      event({
        time: 9_000,
        skillId: 6003,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      }),
    ],
    { elite: 70 },
  );
  fixture.skills.push(
    { id: 68079, name: "Rifle Burst Grenade" },
    { id: 68091, name: "Jump Shot" },
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const rifleActions = result.actions.filter(
    (action) => action.name === "Rifle Burst",
  );
  const rifleCommands = result.rotation.filter(
    (command) => command.name === "Rifle Burst",
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.actions.find((action) => action.name === "Jump Shot")?.status,
    "completed",
  );
  assert.equal(
    result.actions.find((action) => action.name === "Shrapnel Grenade")?.status,
    "reduced",
  );
  assert.deepEqual(
    rifleActions.map((action) => action.status),
    ["reduced", "reduced"],
  );
  assert.equal(
    result.actions.find((action) => action.name === "Overcharged Shot")?.status,
    "completed",
  );
  assert.deepEqual(rifleCommands, [
    { name: "Rifle Burst", skillId: 6003, interruptMs: 567 },
    {
      name: "Rifle Burst",
      skillId: 6003,
      interruptMs: 567,
      preserveEffectsAfterInterrupt: true,
    },
  ]);
  assert.deepEqual(
    result.rotation.find((command) => command.name === "Shrapnel Grenade"),
    {
      name: "Shrapnel Grenade",
      skillId: 5807,
      interruptMs: 435,
      preserveEffectsAfterInterrupt: true,
    },
  );
});

test("maps Holosmith Forge transitions and preserves automatic overheat boundaries", () => {
  const skills = [
    skill(42938, "Engage Photon Forge", {
      type: "Profession",
      slot: "Profession_5",
    }),
    skill(41123, "Deactivate Photon Forge", {
      type: "Profession",
      slot: "Profession_5",
    }),
    skill(44530, "Corona Burst", {
      slot: "Weapon_3",
      quicknessCastTimeMs: 480,
    }),
    skill(45783, "Photon Blitz", {
      slot: "Weapon_2",
      quicknessCastTimeMs: 1_320,
    }),
    skill(5810, "Grenade Barrage", {
      type: "Profession",
      slot: "Profession_1",
      quicknessCastTimeMs: 680,
    }),
    skill(5830, "Glue Shot", {
      slot: "Weapon_5",
      quicknessCastTimeMs: 560,
    }),
    skill(42163, "Blade Burst", {
      type: "Utility",
      slot: "Utility_1",
    }),
    skill(43937, "Overheat", {
      type: "Profession",
      slot: "Profession_5",
    }),
  ];
  const fixture = engineerLog(
    skills,
    [
      event({ time: 1_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        time: 1_100,
        target: 3n,
        stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
      }),
      event({ time: 1_150, target: TARGET, value: 1_000, skillId: 42163 }),
      ...animation(44530, 1_200, 480),
      ...animation(45783, 1_700, 1_320),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 41037,
        buff: 1,
      }),
      event({
        time: 3_000,
        target: 4n,
        stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
      }),
      ...animation(5810, 3_200, 560),
      event({ time: 3_300, target: TARGET, value: 1_000, skillId: 43937 }),
      ...animation(5830, 3_900, 560),
      event({
        time: 5_000,
        target: 3n,
        stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
      }),
      event({
        time: 6_000,
        target: 4n,
        stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
      }),
    ],
    { elite: 57 },
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "engineer:holosmith");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      "Engage Photon Forge",
      "Blade Burst",
      "Corona Burst",
      "Photon Blitz",
      "Grenade Barrage",
      "Glue Shot",
      "Engage Photon Forge",
      "Deactivate Photon Forge",
    ],
  );
  assert.equal(
    result.rotation.filter(
      (command) => command.name === "Deactivate Photon Forge",
    ).length,
    1,
  );
  assert.equal(
    Object.hasOwn(
      result.rotation.find((command) => command.name === "Grenade Barrage"),
      "interruptMs",
    ),
    false,
  );
  assert.equal(
    result.actions.some((action) => action.name === "Overheat"),
    false,
  );
});

function animation(skillId, start, duration, overrides = {}) {
  return [
    event({
      time: start,
      skillId,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
      ...overrides,
    }),
    event({
      time: start + duration,
      value: duration,
      skillId,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      ...overrides,
    }),
  ];
}

test("recovers Bomb Kit, Throw Mine, and Hammer 5 precasts from opening evidence", () => {
  const skills = [
    skill(6161, "Throw Mine", {
      type: "Utility",
      slot: "Utility_1",
      castTimeMs: 400,
      quicknessCastTimeMs: 400,
    }),
    skill(6162, "Detonate", {
      type: "Utility",
      slot: "Utility_1",
      independentCast: true,
    }),
    skill(5812, "Bomb Kit", {
      type: "Utility",
      slot: "Utility_2",
      kitName: "Bomb Kit",
      handlerId: "engineer.kit-equip",
    }),
    skill(6111, "Stow Bomb Kit", {
      type: "Bundle",
      slot: "Bundle",
      kit: "Bomb Kit",
      handlerId: "engineer.kit-stow",
    }),
    skill(5813, "Big Ol' Bomb", {
      kit: "Bomb Kit",
      quicknessCastTimeMs: 600,
    }),
    skill(76530, "Magnetic Bomb", {
      kit: "Bomb Kit",
      quicknessCastTimeMs: 600,
    }),
    skill(5823, "Fire Bomb", {
      kit: "Bomb Kit",
      quicknessCastTimeMs: 600,
    }),
    skill(5822, "Galvanic Bomb", {
      kit: "Bomb Kit",
      quicknessCastTimeMs: 600,
    }),
    skill(30713, "Thunderclap", {
      slot: "Weapon_5",
      castTimeMs: 840,
      quicknessCastTimeMs: 560,
    }),
    skill(30088, "Electro-whirl", {
      castTimeMs: 1_020,
      quicknessCastTimeMs: 680,
    }),
  ];
  const fixture = engineerLog(skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({ target: TARGET, value: 1_000, skillId: 5813 }),
    event({ target: TARGET, value: 1_000, skillId: 76530 }),
    event({ target: TARGET, value: 1_000, skillId: 5823 }),
    event({ target: TARGET, value: 1_000, skillId: 5822 }),
    event({ target: TARGET, value: 1_000, skillId: 6161, time: 10_717 }),
    event({
      time: 10_392,
      value: 559,
      buffDamage: 839,
      skillId: 30713,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
    event({
      time: 10_392,
      skillId: 30088,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
    }),
    event({
      time: 11_075,
      value: 683,
      buffDamage: 1_020,
      skillId: 30088,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
  ]);

  const result = reconstructEvtcRotation(
    fixture,
    { skills },
    {
      selectedSkillNames: ["Bomb Kit", "Throw Mine"],
      selectedSkillIds: [5812, 6161],
    },
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.combatStartTimestampMs, 7_967);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      "Throw Mine",
      "Bomb Kit",
      "Big Ol' Bomb",
      "Magnetic Bomb",
      "Fire Bomb",
      "Galvanic Bomb",
      "Stow Bomb Kit",
      "Thunderclap",
      "Electro-whirl",
      "Detonate",
    ],
  );
  assert.deepEqual(result.rotation, [
    { name: "Throw Mine", skillId: 6161 },
    { name: "__wait", waitMs: 5000 },
    { name: "Bomb Kit", skillId: 5812 },
    { name: "Big Ol' Bomb", skillId: 5813 },
    { name: "Magnetic Bomb", skillId: 76530 },
    { name: "Fire Bomb", skillId: 5823 },
    { name: "Galvanic Bomb", skillId: 5822 },
    { name: "Stow Bomb Kit", skillId: 6111 },
    { name: "Thunderclap", skillId: 30713 },
    { name: "__combat_start", offset: 167 },
    { name: "Electro-whirl", skillId: 30088 },
    { name: "Detonate", skillId: 6162, offset: 325 },
  ]);
});

test("maps Engineer kit swaps, Amalgam morphs, and passive packets", () => {
  const skills = [
    skill(5800, "Grenade Kit", {
      type: "Utility",
      slot: "Utility_1",
      kitName: "Grenade Kit",
      handlerId: "engineer.kit-equip",
    }),
    skill(6110, "Stow Grenade Kit", {
      type: "Bundle",
      slot: "Bundle",
      kit: "Grenade Kit",
      handlerId: "engineer.kit-stow",
    }),
    skill(5801, "Shrapnel Grenade", {
      kit: "Grenade Kit",
      quicknessCastTimeMs: 400,
    }),
    skill(5812, "Bomb Kit", {
      type: "Utility",
      slot: "Utility_2",
      kitName: "Bomb Kit",
      handlerId: "engineer.kit-equip",
    }),
    skill(6111, "Stow Bomb Kit", {
      type: "Bundle",
      slot: "Bundle",
      kit: "Bomb Kit",
      handlerId: "engineer.kit-stow",
    }),
    skill(5813, "Big Ol' Bomb", {
      kit: "Bomb Kit",
      quicknessCastTimeMs: 400,
    }),
    skill(76927, "Offensive Protocol: Demolish", {
      type: "Profession",
      slot: "Profession_2",
      quicknessCastTimeMs: 700,
    }),
    skill(77104, "Defensive Protocol: Thorns", {
      type: "Profession",
      slot: "Profession_3",
    }),
    skill(76642, "Evolve", {
      type: "Profession",
      slot: "Profession_5",
      quicknessCastTimeMs: 400,
    }),
    skill(29889, "Aim-Assisted Rocket", {
      type: "Profession",
      slot: "Profession_4",
    }),
  ];
  const fixture = engineerLog(skills, [
    event({ time: 1_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 2_000,
      target: 2n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    ...animation(5801, 2_050, 400),
    event({
      time: 3_000,
      target: 4n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 4_000,
      target: 2n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 4_100,
      target: 5n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    ...animation(5813, 4_200, 400),
    event({
      time: 5_000,
      target: 4n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    ...animation(76693, 6_000, 300),
    ...animation(77013, 6_350, 400),
    event({ time: 7_000, target: TARGET, value: 1_000, skillId: 76640 }),
    event({ time: 7_100, target: TARGET, value: 1_000, skillId: 29889 }),
    ...animation(76651, 8_000, 400),
  ]);
  fixture.skills.push(
    { id: 76693, name: "Offensive Protocol: Demolish" },
    { id: 77013, name: "Offensive Protocol: Demolish" },
    { id: 76640, name: "Defensive Protocol: Thorns" },
    { id: 76651, name: "Evolve" },
  );

  const result = reconstructEvtcRotation(
    fixture,
    { skills },
    {
      selectedSkillNames: ["Grenade Kit", "Bomb Kit"],
      selectedSkillIds: [76927, 77104, 76642],
    },
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map(({ name, skillId }) => ({ name, skillId })),
    [
      { name: "Grenade Kit", skillId: 5800 },
      { name: "Shrapnel Grenade", skillId: 5801 },
      { name: "Stow Grenade Kit", skillId: 6110 },
      { name: "Bomb Kit", skillId: 5812 },
      { name: "Big Ol' Bomb", skillId: 5813 },
      { name: "Stow Bomb Kit", skillId: 6111 },
      { name: "Offensive Protocol: Demolish", skillId: 76927 },
      { name: "Defensive Protocol: Thorns", skillId: 77104 },
      { name: "Evolve", skillId: 76642 },
    ],
  );
  assert.equal(
    result.actions.find((action) => action.name.includes("Thorns"))?.evidence,
    "resource-inference",
  );
  assert.equal(
    result.actions.some((action) => action.name === "Aim-Assisted Rocket"),
    false,
  );
});
