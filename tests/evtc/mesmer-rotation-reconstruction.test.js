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
