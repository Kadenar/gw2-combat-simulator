import assert from "node:assert/strict";
import test from "node:test";

import { reconstructEvtcRotation } from "../../js/evtc-analyzer/rotation/index.js";
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
} from "../../js/evtc-analyzer/types.js";

const PLAYER = 0x1000n;
const TARGET = 0x2000n;

const GUIDS = Object.freeze({
  rewinder: "DC1C8A043ADCD24B9458688A792B04BA",
  splitSecond: "C035166E3E4C414ABE640F47797D9B4A",
  timeSink: "AB2E22E7EE74DA4C87DA777C62E475EA",
  diversion: "916D8385083F144EBAA5BEEDE21FD47A",
  mirageMirror: "1370CDF5F2061445A656A1D77C37A55C",
  mesmerTeleport: "C34E250B01FF534292EE6AB36D768337",
  bladeturnRequiem: "87B761200637AC48B71469F553BA6F60",
  thousandCuts: "E4002B7AD7DF024394D0184B47A316E7",
});

function event(overrides = {}) {
  return {
    time: 10_000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 7,
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
    type: "Profession",
    slot: "Profession_1",
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    implemented: true,
    ...overrides,
  };
}

function agent(address, profession, character, overrides = {}) {
  return {
    address,
    profession,
    elite: 0,
    toughness: 0,
    concentration: 0,
    healing: 0,
    condition: 0,
    character,
    account: "",
    subgroup: "",
    ...overrides,
  };
}

function mesmerLog(elite, skills, events, extraAgents = []) {
  return {
    header: {
      magic: "EVTC",
      arcdpsBuild: "20260815",
      revision: 1,
      encounterId: 16199,
      agentCount: 2 + extraAgents.length,
      skillCount: skills.length,
      eventCount: events.length,
    },
    agents: [
      agent(PLAYER, 7, "Fixture Mesmer", {
        elite,
        account: ":Fixture.1234",
        subgroup: "1",
      }),
      agent(TARGET, 16199, "Standard Kitty Golem"),
      ...extraAgents,
    ],
    skills: skills.map(({ id, name }) => ({ id, name })),
    events,
  };
}

function guidParts(guid) {
  const bytes = guid.match(/../g);
  const part = (offset) =>
    BigInt(
      `0x${bytes
        .slice(offset, offset + 8)
        .reverse()
        .join("")}`,
    );
  return [part(0), part(8)];
}

function guidMapping(guid, contentId) {
  const [source, target] = guidParts(guid);
  return event({
    time: 0,
    source,
    target,
    skillId: contentId,
    sourceInstance: 0,
    stateChange: 46,
  });
}

function effect(contentId, time) {
  return event({ time, skillId: contentId, stateChange: 60 });
}

function direct(skillId, time) {
  return event({ time, target: TARGET, value: 100, skillId });
}

function names(result, name) {
  return result.actions.filter((action) => action.name === name);
}

test("reconstructs Chronomancer shatters and Continuum transitions", () => {
  const skills = [
    skill(56930, "Split Second"),
    skill(56928, "Rewinder"),
    skill(56873, "Time Sink"),
    skill(29830, "Continuum Split"),
    skill(-4, "Continuum Shift"),
  ];
  const fixture = mesmerLog(40, skills, [
    guidMapping(GUIDS.splitSecond, 101),
    guidMapping(GUIDS.rewinder, 102),
    guidMapping(GUIDS.timeSink, 103),
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    direct(56925, 11_000),
    direct(56925, 11_100),
    direct(56925, 12_000),
    effect(102, 13_000),
    effect(102, 13_250),
    effect(102, 14_100),
    effect(103, 15_000),
    effect(103, 15_500),
    event({
      time: 16_000,
      target: PLAYER,
      value: 4_500,
      skillId: 30136,
      buff: 1,
    }),
    event({
      time: 17_000,
      target: PLAYER,
      value: 500,
      buffDamage: 500,
      skillId: 30136,
      buff: 1,
      buffRemove: 3,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "mesmer:chronomancer");
  assert.equal(names(result, "Split Second").length, 2);
  assert.equal(names(result, "Rewinder").length, 2);
  assert.equal(names(result, "Time Sink").length, 1);
  assert.equal(names(result, "Continuum Split").length, 1);
  assert.equal(names(result, "Continuum Shift").length, 1);
});

test("splits Chronomancer effect packets after four shatter sources", () => {
  const skills = [skill(56930, "Split Second")];
  const fixture = mesmerLog(40, skills, [
    guidMapping(GUIDS.splitSecond, 101),
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    effect(101, 11_000),
    effect(101, 11_100),
    effect(101, 11_200),
    effect(101, 11_300),
    effect(101, 11_400),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(names(result, "Split Second").length, 2);
});

test("recovers a Chronomancer Mirror Images use suppressed at clone cap", () => {
  const cloneAddresses = Array.from(
    { length: 6 },
    (_, index) => 0x3000n + BigInt(index),
  );
  const skills = [
    skill(10202, "Mirror Images"),
    skill(10192, "Distortion"),
    skill(56930, "Split Second"),
  ];
  const clonePair = (time, offset) =>
    cloneAddresses.slice(offset, offset + 2).map((source, index) =>
      event({
        time,
        source,
        sourceInstance: offset + index + 10,
        sourceMasterInstance: 7,
      }),
    );
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      ...clonePair(11_000, 0),
      ...clonePair(31_000, 2),
      event({
        time: 50_500,
        target: PLAYER,
        value: 1_000,
        skillId: 10243,
        buff: 1,
      }),
      effect(101, 51_000),
      ...clonePair(71_000, 4),
    ],
    cloneAddresses.map((address) =>
      agent(address, 8111, "Illusionary Warlock"),
    ),
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const mirrors = names(result, "Mirror Images");

  assert.equal(mirrors.length, 4);
  assert.ok(
    mirrors.some(
      (action) =>
        action.evidence === "resource-inference" &&
        action.timestampMs > 40_000 &&
        action.timestampMs < 50_000,
    ),
  );
});

test("reconstructs Mirage cloak sources and shatters without packet spam", () => {
  const skills = [
    skill(-1, "Dodge / Mirage Cloak", { type: "Action", slot: "Action" }),
    skill(-2, "Pick Up Mirage Mirror", {
      type: "Action",
      slot: "Action",
    }),
    skill(10190, "Cry of Frustration"),
    skill(10191, "Mind Wrack"),
    skill(10192, "Distortion"),
    skill(10287, "Diversion"),
  ];
  const fixture = mesmerLog(59, skills, [
    guidMapping(GUIDS.diversion, 201),
    guidMapping(GUIDS.mirageMirror, 202),
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
    }),
    event({
      time: 11_000,
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1,
    }),
    effect(202, 12_000),
    event({
      time: 12_000,
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1,
    }),
    event({
      time: 13_000,
      target: PLAYER,
      value: 1_000,
      skillId: 40408,
      buff: 1,
    }),
    direct(10191, 14_000),
    direct(10191, 14_100),
    direct(10191, 16_000),
    direct(10190, 17_000),
    direct(10190, 17_200),
    effect(201, 17_500),
    effect(201, 19_000),
    event({
      time: 20_000,
      target: PLAYER,
      value: 1_000,
      skillId: 10243,
      buff: 1,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "mesmer:mirage");
  assert.equal(names(result, "Dodge / Mirage Cloak").length, 2);
  assert.equal(names(result, "Pick Up Mirage Mirror").length, 1);
  assert.equal(names(result, "Mind Wrack").length, 2);
  assert.equal(names(result, "Cry of Frustration").length, 1);
  assert.equal(names(result, "Diversion").length, 1);
  assert.equal(names(result, "Distortion").length, 1);
});

test("does not mistake a Phase Retreat clone pair for Mirror Images", () => {
  const cloneOne = 0x3100n;
  const cloneTwo = 0x3101n;
  const skills = [skill(10310, "Phase Retreat"), skill(10202, "Mirror Images")];
  const fixture = mesmerLog(
    59,
    skills,
    [
      guidMapping(GUIDS.mesmerTeleport, 201),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        time: 12_000,
        source: cloneOne,
        sourceInstance: 8,
        sourceMasterInstance: 7,
      }),
      event({
        time: 12_000,
        source: cloneTwo,
        sourceInstance: 9,
        sourceMasterInstance: 7,
      }),
      effect(201, 12_000),
    ],
    [
      agent(cloneOne, 8111, "Illusionary Warlock"),
      agent(cloneTwo, 8111, "Illusionary Warlock"),
    ],
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(names(result, "Phase Retreat").length, 1);
  assert.equal(names(result, "Mirror Images").length, 0);
});

test("places delayed Mirage Chaos Armor evidence before the weapon swap", () => {
  const skills = [
    skill(10169, "Chaos Storm", {
      type: "Weapon",
      slot: "Weapon_5",
      castTimeMs: 720,
      quicknessCastTimeMs: 480,
    }),
    skill(10331, "Chaos Armor", {
      type: "Weapon",
      slot: "Weapon_4",
    }),
  ];
  const fixture = mesmerLog(59, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      skillId: 10169,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
    }),
    event({
      time: 10_480,
      value: 480,
      skillId: 10169,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
    event({
      time: 10_560,
      target: 4n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 11_300,
      target: PLAYER,
      value: 5_000,
      skillId: 10332,
      buff: 1,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const chaosArmor = names(result, "Chaos Armor")[0];
  const weaponSwap = names(result, "Swap Weapons")[0];

  assert.ok(chaosArmor.timestampMs < weaponSwap.timestampMs);
});

test("keeps a zero-duration phantasm cast when damage and a spawn commit it", () => {
  const phantasm = 0x3200n;
  const skills = [
    skill(10221, "Phantasmal Berserker", {
      type: "Weapon",
      slot: "Weapon_4",
      castTimeMs: 840,
      quicknessCastTimeMs: 560,
      phantasm: true,
    }),
  ];
  const fixture = mesmerLog(
    40,
    skills,
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        time: 11_000,
        value: 840,
        skillId: 10221,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
      }),
      event({
        time: 11_000,
        skillId: 10221,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      }),
      direct(10221, 11_560),
      event({
        time: 11_560,
        source: phantasm,
        stateChange: 6,
      }),
    ],
    [agent(phantasm, 6535, "Illusionary Berserker")],
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const berserker = names(result, "Phantasmal Berserker")[0];
  const command = result.rotation.find(
    (entry) => entry.name === "Phantasmal Berserker",
  );

  assert.equal(berserker.status, "completed");
  assert.equal(command.interruptMs, undefined);
});

test("reconstructs Virtuoso effects, opening ticks, and initial phantasms", () => {
  const phantasm = 0x3000n;
  const skills = [
    skill(62597, "Bladeturn Requiem"),
    skill(24755, "Thousand Cuts"),
    skill(68273, "Bladesong Distortion"),
    skill(62607, "Unstable Bladestorm", {
      type: "Weapon",
      slot: "Weapon_3",
      castTimeMs: 500,
      quicknessCastTimeMs: 500,
    }),
    skill(10175, "Phantasmal Duelist", {
      type: "Weapon",
      slot: "Weapon_4",
      castTimeMs: 750,
      quicknessCastTimeMs: 750,
    }),
  ];
  const fixture = mesmerLog(
    66,
    skills,
    [
      guidMapping(GUIDS.bladeturnRequiem, 301),
      guidMapping(GUIDS.thousandCuts, 302),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        source: phantasm,
        target: phantasm,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
      }),
      event({ time: 10_100, skillId: 62607, stateChange: 57 }),
      event({ time: 10_200, skillId: 62607, stateChange: 57 }),
      direct(62597, 10_500),
      effect(301, 13_000),
      direct(62597, 13_100),
      direct(24755, 14_500),
      effect(302, 17_000),
      direct(24755, 17_100),
      event({
        time: 19_000,
        target: PLAYER,
        value: 1_000,
        skillId: 10243,
        buff: 1,
      }),
    ],
    [agent(phantasm, 5758, "Illusionary Duelist")],
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "mesmer:virtuoso");
  assert.equal(names(result, "Bladeturn Requiem").length, 2);
  assert.equal(names(result, "Thousand Cuts").length, 2);
  assert.equal(names(result, "Bladesong Distortion").length, 1);
  assert.equal(names(result, "Unstable Bladestorm").length, 1);
  assert.equal(names(result, "Phantasmal Duelist").length, 1);
  assert.equal(
    names(result, "Phantasmal Duelist")[0].evidence,
    "initial-state",
  );
});

test("resolves the historical Virtuoso Bladecall ID", () => {
  const skills = [
    skill(69311, "Bladecall", {
      type: "Weapon",
      slot: "Weapon_2",
      castTimeMs: 500,
      quicknessCastTimeMs: 500,
    }),
  ];
  const fixture = mesmerLog(66, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 11_000,
      skillId: 62560,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
    }),
    event({
      time: 11_500,
      value: 500,
      skillId: 62560,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const bladecalls = names(result, "Bladecall");

  assert.equal(bladecalls.length, 1);
  assert.equal(bladecalls[0].skillId, 69311);
  assert.equal(bladecalls[0].supportedByCatalog, true);
});

test("recovers Troubadour opening Mimic and removes Weapon Stow", () => {
  const skills = [
    skill(29578, "Mimic", {
      type: "Utility",
      slot: "Utility_1",
      castTimeMs: 600,
      quicknessCastTimeMs: 600,
    }),
    skill(23285, "Weapon Stow", { type: "Action", slot: "Action" }),
  ];
  const animation = (skillId, start, duration) => [
    event({
      time: start,
      skillId,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
    }),
    event({
      time: start + duration,
      value: duration,
      skillId,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
  ];
  const fixture = mesmerLog(73, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    ...animation(29578, 30_000, 600),
    ...animation(23285, 40_000, 0),
    ...animation(29578, 65_000, 600),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, "mesmer:troubadour");
  assert.equal(names(result, "Mimic").length, 3);
  assert.equal(names(result, "Mimic")[0].evidence, "initial-state");
  assert.equal(names(result, "Weapon Stow").length, 0);
});
