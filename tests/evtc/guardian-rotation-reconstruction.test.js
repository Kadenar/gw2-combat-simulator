import assert from "node:assert/strict";
import test from "node:test";

import { reconstructEvtcRotation } from "../../js/evtc-analyzer/rotation/index.js";
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
} from "../../js/evtc-analyzer/types.js";

const PLAYER = 0x1000n;
const ALLY = 0x2000n;

function event(overrides = {}) {
  return {
    time: 1_000,
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
    type: "Profession",
    slot: "Profession_1",
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    implemented: true,
    ...overrides,
  };
}

function guardianLog(elite, skills, events) {
  return {
    header: {
      magic: "EVTC",
      arcdpsBuild: "20260815",
      revision: 1,
      encounterId: 16199,
      agentCount: 1,
      skillCount: skills.length,
      eventCount: events.length,
    },
    agents: [
      {
        address: PLAYER,
        profession: 1,
        elite,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: "Fixture Guardian",
        account: ":Fixture.1234",
        subgroup: "1",
      },
    ],
    skills: skills.map(({ id, name }) => ({ id, name })),
    events,
  };
}

function animation(skillId, name, start, duration) {
  return {
    skill: { id: skillId, name },
    events: [
      event({
        time: start,
        skillId,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
      }),
      event({
        time: start + duration,
        skillId,
        value: duration,
        activation: EVTC_ACTIVATION.CANCEL_FIRE,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      }),
    ],
  };
}

test("reconstructs Luminary forge, virtue, stance, and physical swap signals", () => {
  const skills = [
    skill(77_073, "Enter Radiant Forge"),
    skill(76_616, "Exit Radiant Forge"),
    skill(78_837, "Radiant Justice"),
    skill(78_358, "Radiant Courage"),
    skill(76_813, "Effulgent Stance"),
    skill(-3, "Swap Weapons"),
  ];
  const fixture = guardianLog(81, skills, [
    event({
      time: 1_000,
      target: PLAYER,
      value: 19_100,
      buffDamage: 20_000,
      skillId: 77_142,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
    }),
    event({
      time: 1_000,
      target: PLAYER,
      value: 4_800,
      buffDamage: 6_000,
      skillId: 77_333,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
    }),
    event({ time: 1_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 2_000,
      target: PLAYER,
      value: 1_000,
      skillId: 77_821,
      buff: 1,
      buffRemove: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE,
    }),
    event({
      time: 2_500,
      target: 5n,
      value: 4,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 3_000,
      target: PLAYER,
      skillId: 77_142,
      buff: 1,
      buffRemove: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_REMOVE_ALL,
    }),
    event({
      time: 3_000,
      target: 3n,
      value: 5,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 4_000,
      target: PLAYER,
      skillId: 77_142,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    event({
      time: 4_000,
      target: 3n,
      value: 5,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 4_500,
      target: PLAYER,
      skillId: 77_095,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      "Radiant Courage",
      "Enter Radiant Forge",
      "Radiant Justice",
      "Swap Weapons",
      "Exit Radiant Forge",
      "Enter Radiant Forge",
      "Effulgent Stance",
    ],
  );
  assert.equal(result.combatStartTimestampMs, 1_200);
});

test("coalesces Willbender animations and ignores passive flame packets", () => {
  const rushingRoot = animation(62_668, "Rushing Justice", 2_000, 40);
  const rushingImpact = animation(62_624, "Rushing Justice", 2_041, 439);
  const laterSword = animation(9_168, "Sword of Justice", 2_600, 600);
  const skills = [
    skill(62_668, "Rushing Justice", {
      castTimeMs: 1_000,
      quicknessCastTimeMs: 1_000,
    }),
    skill(9_168, "Sword of Justice", {
      type: "Utility",
      slot: "Utility_1",
      castTimeMs: 600,
      quicknessCastTimeMs: 600,
      effects: [{ type: "strike", atMs: 650 }],
    }),
    skill(62_528, "Willbender Flames", { effects: [{ type: "strike" }] }),
    skill(62_618, "Willbender Flames", { effects: [{ type: "strike" }] }),
    skill(62_552, "Willbender Flames", { effects: [{ type: "strike" }] }),
  ];
  const fixture = guardianLog(65, skills, [
    event({
      time: 900,
      skillId: 62_624,
      value: 500,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
    event({ time: 1_000, skillId: 46_469, value: 1_000 }),
    ...rushingRoot.events,
    ...rushingImpact.events,
    ...laterSword.events,
    event({ time: 3_300, skillId: 62_528, value: 1_000 }),
    event({ time: 3_400, skillId: 62_618, value: 1_000 }),
    event({ time: 3_500, skillId: 62_552, value: 1_000 }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.actions.filter((action) => action.name === "Rushing Justice").length,
    2,
  );
  assert.equal(
    result.actions.filter((action) => action.name === "Sword of Justice")
      .length,
    2,
  );
  assert.equal(
    result.actions.some((action) => action.name === "Willbender Flames"),
    false,
  );
  assert.deepEqual(
    result.rotation.find(
      (command, index) =>
        command.name === "Sword of Justice" &&
        result.rotation[index - 1]?.name === "Rushing Justice",
    ),
    { name: "Sword of Justice", skillId: 9_168, offset: 600 },
  );
});

test("recovers legacy Willbender precasts and committed zero-duration casts", () => {
  const skills = [
    skill(62_603, "Flowing Resolve", {
      castTimeMs: 520,
      quicknessCastTimeMs: 520,
    }),
    skill(71_817, "Jurisdiction", {
      type: "Weapon",
      slot: "Weapon_5",
      castTimeMs: 750,
      quicknessCastTimeMs: 800,
      effects: [{ type: "strike", ticks: [{ atMs: 640 }] }],
    }),
    skill(71_987, "Symbol of Ignition", {
      type: "Weapon",
      slot: "Weapon_3",
      castTimeMs: 250,
      quicknessCastTimeMs: 360,
      effects: [{ type: "strike", ticks: [{ atMs: 280 }] }],
    }),
    skill(9_104, "Zealot's Flame", {
      type: "Weapon",
      slot: "Weapon_4",
    }),
    skill(9_089, "Zealot's Fire", {
      type: "Weapon",
      slot: "Weapon_4",
      castTimeMs: 250,
      quicknessCastTimeMs: 680,
      effects: [{ type: "strike", ticks: [{ atMs: 480 }] }],
    }),
  ];
  const fixture = guardianLog(65, skills, [
    event({
      time: 1_000,
      target: PLAYER,
      value: 5_360,
      buffDamage: 6_000,
      skillId: 62_632,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
    }),
    event({ time: 1_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({ time: 1_001, skillId: 71_818, value: 1_000 }),
    event({
      time: 2_000,
      skillId: 71_987,
      activation: EVTC_ACTIVATION.START,
    }),
    event({
      time: 2_000,
      skillId: 71_987,
      activation: EVTC_ACTIVATION.CANCEL_CANCEL,
    }),
    event({ time: 2_280, skillId: 71_987, value: 1_000 }),
    event({
      time: 2_400,
      target: PLAYER,
      value: 4_500,
      skillId: 9_103,
      buff: 1,
    }),
    event({
      time: 2_500,
      skillId: 9_089,
      activation: EVTC_ACTIVATION.START,
    }),
    event({
      time: 2_500,
      skillId: 9_089,
      activation: EVTC_ACTIVATION.CANCEL_CANCEL,
    }),
    event({
      time: 2_540,
      skillId: 9_089,
      activation: EVTC_ACTIVATION.START,
    }),
    event({ time: 3_020, skillId: 9_089, value: 1_000 }),
    event({
      time: 3_220,
      skillId: 9_089,
      value: 680,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
    }),
    event({
      time: 3_500,
      skillId: 71_987,
      activation: EVTC_ACTIVATION.START,
    }),
    event({ time: 3_780, skillId: 71_987, value: 1_000 }),
    event({
      time: 3_860,
      skillId: 71_987,
      value: 360,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
    }),
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.combatStartTimestampMs, 1_160);
  assert.equal(names.filter((name) => name === "Flowing Resolve").length, 1);
  assert.equal(names.filter((name) => name === "Jurisdiction").length, 1);
  assert.equal(names.filter((name) => name === "Symbol of Ignition").length, 2);
  assert.equal(names.filter((name) => name === "Zealot's Flame").length, 1);
  assert.equal(names.filter((name) => name === "Zealot's Fire").length, 1);
});

test("reconstructs Firebrand tomes, mantras, Zealot's Flame, and damage instants", () => {
  const chapter = animation(41_258, "Chapter 1: Searing Spell", 1_100, 500);
  const jurisdictionRoot = animation(71_817, "Jurisdiction", 3_000, 400);
  const jurisdictionChild = animation(71_818, "Jurisdiction", 3_400, 400);
  const skills = [
    skill(44_364, "Tome of Justice"),
    skill(41_380, "Stow Tome"),
    skill(41_258, "Chapter 1: Searing Spell", {
      castTimeMs: 500,
      quicknessCastTimeMs: 500,
    }),
    skill(71_817, "Jurisdiction", {
      type: "Weapon",
      slot: "Weapon_5",
      castTimeMs: 800,
      quicknessCastTimeMs: 800,
    }),
    skill(9_104, "Zealot's Flame", {
      type: "Weapon",
      slot: "Weapon_4",
    }),
    skill(45_082, "Flame Rush", { type: "Utility", slot: "Utility_1" }),
    skill(42_924, "Flame Surge", { type: "Utility", slot: "Utility_1" }),
    skill(41_475, "Restoring Reprieve", { type: "Heal", slot: "Heal" }),
    skill(42_960, "Rejuvenating Respite", {
      type: "Heal",
      slot: "Heal",
    }),
    skill(-3, "Swap Weapons"),
  ];
  const boonSignals = (time, includeAegis) => [
    event({
      time,
      target: ALLY,
      value: 2_000,
      skillId: 717,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    event({
      time,
      target: ALLY,
      value: 2_000,
      skillId: 873,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    ...(includeAegis
      ? [
          event({
            time,
            target: ALLY,
            value: 2_000,
            skillId: 743,
            buff: 1,
            stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
          }),
        ]
      : []),
  ];
  const fixture = guardianLog(62, skills, [
    event({ time: 900, skillId: 42_924, value: 1_000 }),
    event({
      time: 1_000,
      target: 2n,
      value: 4,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    ...chapter.events,
    event({
      time: 1_700,
      target: 4n,
      value: 2,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP,
    }),
    event({
      time: 2_000,
      target: PLAYER,
      skillId: 9_103,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    event({ time: 2_100, skillId: 45_082, value: 1_000 }),
    event({ time: 2_200, skillId: 42_924, value: 1_000 }),
    ...boonSignals(2_300, false),
    ...boonSignals(2_400, true),
    ...jurisdictionRoot.events,
    ...jurisdictionChild.events,
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const exhausted = reconstructEvtcRotation(
    fixture,
    { skills },
    {
      professionConfig: { initialTomePages: 1 },
    },
  );
  const weightyTerms = reconstructEvtcRotation(
    fixture,
    { skills },
    {
      professionConfig: {
        initialTomePages: 1,
        selectedTraitIds: [2_063],
      },
    },
  );
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(result.warnings, []);
  assert.equal(names.filter((name) => name === "Tome of Justice").length, 1);
  assert.equal(names.filter((name) => name === "Stow Tome").length, 1);
  assert.equal(
    exhausted.actions.some((action) => action.name === "Stow Tome"),
    false,
  );
  assert.equal(
    exhausted.rotation.some((command) => command.name === "Stow Tome"),
    false,
  );
  assert.equal(
    weightyTerms.actions.some((action) => action.name === "Stow Tome"),
    true,
  );
  assert.equal(names.filter((name) => name === "Jurisdiction").length, 1);
  assert.ok(names.includes("Zealot's Flame"));
  assert.ok(names.includes("Flame Rush"));
  assert.ok(names.includes("Flame Surge"));
  assert.ok(names.includes("Restoring Reprieve"));
  assert.ok(names.includes("Rejuvenating Respite"));
});
