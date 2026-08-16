import assert from "node:assert/strict";
import test from "node:test";

import { reconstructEvtcRotation } from "../../js/evtc-analyzer/rotation/index.js";
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
} from "../../js/evtc-analyzer/types.js";

const PLAYER = 0x1000n;
const TARGET = 0x2000n;
const EARTH_ELEMENTAL = 0x3000n;

function event(overrides = {}) {
  return {
    time: 1_000,
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

function animation(skillId, start, duration) {
  return [
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
}

function catalogSkill(id, name, type = "Profession") {
  return {
    id,
    name,
    type,
    slot: type === "Elite" ? "Elite" : "Profession_1",
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    implemented: true,
  };
}

test("reconstructs Catalyst attunements, Glyph of Storms aliases, and Earth Stomp", () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL,
    }),
    event({
      time: 1_400,
      source: EARTH_ELEMENTAL,
      value: 3_520,
      skillId: 2666,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
    }),
    event({
      time: 1_500,
      stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT,
    }),
    event({
      time: 2_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    ...animation(5737, 2_200, 600),
    event({
      time: 3_000,
      target: PLAYER,
      skillId: 5580,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY,
    }),
    ...animation(5736, 3_200, 600),
    event({
      time: 4_000,
      source: EARTH_ELEMENTAL,
      skillId: 2666,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START,
    }),
  ];
  const fixture = {
    header: {
      magic: "EVTC",
      arcdpsBuild: "20260715",
      revision: 1,
      encounterId: 16199,
      agentCount: 3,
      skillCount: 7,
      eventCount: events.length,
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 67,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: "Fixture Catalyst",
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
      {
        address: EARTH_ELEMENTAL,
        profession: 6523,
        elite: 0,
        toughness: 2061,
        concentration: 0,
        healing: 800,
        condition: 35,
        character: "Earth Elemental",
        account: "",
        subgroup: "",
      },
    ],
    skills: [
      { id: 5585, name: "Fire Attunement" },
      { id: 5575, name: "Air Attunement" },
      { id: 5580, name: "Earth Attunement" },
      { id: 5736, name: "Firestorm" },
      { id: 5737, name: "Lightning Storm" },
      { id: 2666, name: "Stomp" },
    ],
    events,
  };
  const skills = [
    catalogSkill(1100001, "Fire Attunement"),
    catalogSkill(1100003, "Air Attunement"),
    catalogSkill(1100004, "Earth Attunement"),
    catalogSkill(1100122, "Glyph of Storms (Fire)", "Utility"),
    catalogSkill(1100124, "Glyph of Storms (Air)", "Utility"),
    catalogSkill(2666, "Stomp", "Elite"),
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      "Stomp",
      "Air Attunement",
      "Glyph of Storms (Air)",
      "Earth Attunement",
      "Glyph of Storms (Fire)",
      "Stomp",
    ],
  );
  assert.equal(
    result.actions.some((action) => action.name === "Fire Attunement"),
    false,
  );
  assert.deepEqual(
    result.actions
      .filter((action) => action.name.startsWith("Glyph of Storms"))
      .map((action) => action.rawSkillId),
    [5737, 5736],
  );
  assert.deepEqual(
    result.actions.filter((action) => action.name === "Stomp"),
    [
      {
        timestampMs: 0,
        endTimestampMs: 0,
        durationMs: 0,
        expectedDurationMs: 0,
        rawSkillId: 2666,
        skillId: 2666,
        name: "Stomp",
        kind: "elite",
        evidence: "animation",
        status: "instant",
        supportedByCatalog: true,
      },
      {
        timestampMs: 6120,
        endTimestampMs: 6120,
        durationMs: 0,
        expectedDurationMs: 0,
        rawSkillId: 2666,
        skillId: 2666,
        name: "Stomp",
        kind: "elite",
        evidence: "animation",
        status: "instant",
        supportedByCatalog: true,
      },
    ],
  );
});
