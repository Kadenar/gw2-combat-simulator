import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import {
  isJsonRotationFile,
  readEvtcRotationFile,
} from "../../js/app/build/evtc-rotation-import.js";
import { EvtcError } from "../../js/evtc-analyzer/errors.js";
import {
  EVTC_PROFESSIONS,
  EVTC_SPECIALIZATIONS,
} from "../../js/evtc-analyzer/profession-metadata.js";
import {
  detectEvtcRotationPlayers,
  EVTC_PROFESSION_ROTATION_PARSERS,
  getEvtcProfessionRotationParser,
  reconstructEvtcRotation,
} from "../../js/evtc-analyzer/rotation/index.js";

const PLAYER = 0x1000n;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEvtc(bytes) {
  const name = new TextEncoder().encode("fixture.evtc");
  const compressed = deflateRawSync(bytes);
  const checksum = crc32(bytes);
  const local = new Uint8Array(30 + name.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(14, checksum, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, bytes.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, checksum, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, bytes.length, true);
  centralView.setUint16(28, name.length, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length + compressed.length, true);

  const result = new Uint8Array(
    local.length + compressed.length + central.length + end.length,
  );
  result.set(local, 0);
  result.set(compressed, local.length);
  result.set(central, local.length + compressed.length);
  result.set(end, local.length + compressed.length + central.length);
  return result;
}

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
    activation: 0,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: 0,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides,
  };
}

function log(overrides = {}) {
  return {
    header: {
      magic: "EVTC",
      arcdpsBuild: "20260815",
      revision: 1,
      encounterId: 16199,
      agentCount: 1,
      skillCount: 4,
      eventCount: 0,
    },
    agents: [
      {
        address: PLAYER,
        profession: 7,
        elite: 40,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: "Fixture Chronomancer",
        account: ":Fixture.1234",
        subgroup: "1",
      },
    ],
    skills: [
      { id: 1_000, name: "Mind Stab" },
      { id: 2_000, name: "Time Sink" },
      { id: 3_000, name: "Blink" },
      { id: 65_001, name: "Dodge" },
    ],
    events: [],
    ...overrides,
  };
}

const catalog = {
  skills: [
    {
      id: 1_000,
      name: "Mind Stab",
      type: "Weapon",
      slot: "Weapon_2",
      castTimeMs: 800,
      effects: [],
      implemented: true,
    },
    {
      id: 2_000,
      name: "Time Sink",
      type: "Profession",
      slot: "Profession_3",
      castTimeMs: 0,
      effects: [{ type: "strike", atMs: 0 }],
      implemented: true,
    },
    {
      id: 3_000,
      name: "Blink",
      type: "Utility",
      slot: "Utility",
      castTimeMs: 500,
      effects: [],
      implemented: true,
    },
    {
      id: -3,
      name: "Swap Weapons",
      type: "Action",
      slot: "Action",
      castTimeMs: 0,
      effects: [],
      implemented: true,
    },
  ],
};

function expandedEvtcFixture() {
  const header = Buffer.alloc(16);
  header.write("EVTC20260815", 0, "ascii");
  header[12] = 1;
  header.writeUInt16LE(16_199, 13);
  const agentCount = Buffer.alloc(4);
  agentCount.writeUInt32LE(1);
  const agent = Buffer.alloc(96);
  agent.writeBigUInt64LE(PLAYER, 0);
  agent.writeUInt32LE(7, 8);
  agent.writeUInt32LE(40, 12);
  Buffer.from(
    ["Fixture Chronomancer", ":Fixture.1234", "1", ""].join("\0"),
    "utf8",
  ).copy(agent, 28);
  const skillCount = Buffer.alloc(4);
  skillCount.writeUInt32LE(1);
  const skill = Buffer.alloc(68);
  skill.writeUInt32LE(1_000, 0);
  skill.write("Mind Stab", 4, "utf8");
  const activation = Buffer.alloc(64);
  activation.writeBigUInt64LE(1_000n, 0);
  activation.writeBigUInt64LE(PLAYER, 8);
  activation.writeInt32LE(800, 24);
  activation.writeUInt32LE(1_000, 36);
  activation.writeUInt16LE(1, 40);
  activation[56] = 67;
  return Buffer.concat([
    header,
    agentCount,
    agent,
    skillCount,
    skill,
    activation,
  ]);
}

test("registers an individual parser for every current profession specialization", () => {
  assert.equal(EVTC_PROFESSION_ROTATION_PARSERS.length, 45);
  assert.equal(
    new Set(EVTC_PROFESSION_ROTATION_PARSERS.map((parser) => parser.id)).size,
    45,
  );
  assert.equal(
    getEvtcProfessionRotationParser("mesmer", "chronomancer")?.id,
    "mesmer:chronomancer",
  );
  assert.equal(
    getEvtcProfessionRotationParser("guardian", "luminary")?.id,
    "guardian:luminary",
  );
  assert.equal(getEvtcProfessionRotationParser("mesmer", "reaper"), null);

  for (const parser of EVTC_PROFESSION_ROTATION_PARSERS) {
    const profession = EVTC_PROFESSIONS.find(
      (candidate) => candidate.id === parser.professionId,
    );
    const specialization = EVTC_SPECIALIZATIONS.find(
      (candidate) =>
        candidate.professionId === parser.professionId &&
        candidate.id === parser.specializationId,
    );
    const fixture = log({
      agents: [
        {
          ...log().agents[0],
          profession: profession.code,
          elite: specialization?.code || 0,
        },
      ],
      events: [event({ stateChange: 67, skillId: 1_000 })],
    });
    assert.equal(
      parser.reconstruct(fixture, catalog, {
        inferInstantCasts: false,
      }).parserId,
      parser.id,
    );
  }
});

test("reconstructs casts, inferred instants, swaps, dodges, and exact timing", () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_300,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1,
      }),
      event({
        time: 1_301,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1,
      }),
      event({ time: 1_400, stateChange: 11, target: 5n }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 400,
        activation: 3,
      }),
      event({ time: 1_700, stateChange: 67, skillId: 65_001 }),
      event({
        time: 2_450,
        stateChange: 68,
        skillId: 65_001,
        value: 750,
        activation: 5,
      }),
    ],
  });
  fixture.header.eventCount = fixture.events.length;

  const result = reconstructEvtcRotation(fixture, catalog);

  assert.equal(result.parserId, "mesmer:chronomancer");
  assert.equal(result.combatStartTimestampMs, 0);
  assert.deepEqual(
    result.actions.map((action) => [
      action.name,
      action.timestampMs,
      action.durationMs,
      action.kind,
      action.evidence,
    ]),
    [
      ["Mind Stab", 200, 400, "weapon-skill", "animation"],
      ["Time Sink", 300, 0, "profession-skill", "effect"],
      ["Swap Weapons", 400, 0, "weapon-swap", "state-change"],
      ["Dodge", 700, 750, "dodge", "animation"],
    ],
  );
  assert.equal(result.actions[0].status, "reduced");
  assert.equal(result.actions[2].weaponSet, 5);
  assert.equal(result.actions[3].supportedByCatalog, false);
  assert.deepEqual(result.rotation, [
    { name: "__combat_start" },
    { name: "__wait", waitMs: 200 },
    { name: "Mind Stab", skillId: 1_000, interruptMs: 400 },
    { name: "Time Sink", skillId: 2_000, offset: 100 },
    { name: "Swap Weapons", skillId: -3, offset: 100 },
    { name: "__wait", waitMs: 100 },
    { name: "Dodge", skillId: -5 },
  ]);
  assert.match(result.warnings[0], /instant cast was inferred/);
  assert.match(result.warnings[1], /not present/);
});

test("pairs a stop before the next same-millisecond animation start", () => {
  const fixture = log({
    events: [
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 2_000,
        value: 500,
        activation: 3,
      }),
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3,
      }),
      event({ time: 1_600, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 2_200,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3,
      }),
    ],
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false,
    inferInstantCasts: false,
  });
  assert.deepEqual(
    result.actions.map((action) => ({
      timestampMs: action.timestampMs,
      durationMs: action.durationMs,
    })),
    [
      { timestampMs: 0, durationMs: 600 },
      { timestampMs: 600, durationMs: 600 },
    ],
  );
  assert.deepEqual(result.rotation, [
    { name: "Mind Stab", skillId: 1_000 },
    { name: "Mind Stab", skillId: 1_000 },
  ]);
});

test("resolves Weaponmaster skills owned by another specialization", () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: "Fixture Harbinger",
      },
    ],
    skills: [{ id: 45_846, name: "Harrowing Wave" }],
    events: [event({ stateChange: 67, skillId: 45_846 })],
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 45_846,
        name: "Harrowing Wave",
        type: "Weapon",
        slot: "Weapon_4",
        specialization: "Scourge",
        castTimeMs: 650,
        effects: [],
        implemented: true,
      },
    ],
  });
  assert.equal(result.actions[0].skillId, 45_846);
  assert.equal(result.actions[0].supportedByCatalog, true);
});

test("reconstructs Harbinger Shroud entry and exit from buff transitions", () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: "Fixture Harbinger",
      },
    ],
    skills: [{ id: 59_964, name: "Harbinger Shroud" }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 10_000,
        skillId: 59_964,
        buff: 1,
      }),
      event({ time: 1_000, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 59_964,
        buff: 1,
        buffRemove: 1,
      }),
      event({ time: 3_000, target: 5n, stateChange: 11 }),
    ],
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 62_567,
        name: "Harbinger Shroud",
        type: "Profession",
        slot: "Profession_1",
        specialization: "Harbinger",
        castTimeMs: 0,
        effects: [],
        implemented: true,
      },
      {
        id: 62_540,
        name: "Exit Harbinger Shroud",
        type: "Profession",
        slot: "Profession_1",
        specialization: "Harbinger",
        castTimeMs: 0,
        effects: [],
        implemented: true,
      },
      catalog.skills.at(-1),
    ],
  });
  assert.deepEqual(
    result.actions.map((action) => ({
      name: action.name,
      skillId: action.skillId,
      evidence: action.evidence,
    })),
    [
      {
        name: "Harbinger Shroud",
        skillId: 62_567,
        evidence: "buff-transition",
      },
      {
        name: "Exit Harbinger Shroud",
        skillId: 62_540,
        evidence: "buff-transition",
      },
    ],
  );
  assert.equal(
    result.actions.some((action) => action.name === "Swap Weapons"),
    false,
  );
});

test("reconstructs Bladesworn Gunsaber unsheathe and sheathe transitions", () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 68,
        character: "Fixture Bladesworn",
      },
    ],
    skills: [{ id: 62_769, name: "Gunsaber Mode" }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 10_000,
        skillId: 62_769,
        buff: 1,
      }),
      event({ time: 1_010, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 62_769,
        buff: 1,
        buffRemove: 1,
      }),
      event({ time: 3_010, target: 5n, stateChange: 11 }),
    ],
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 62_745,
        name: "Unsheathe Gunsaber",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 0,
        effects: [],
        implemented: true,
      },
      {
        id: 62_861,
        name: "Sheathe Gunsaber",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 0,
        effects: [],
        implemented: true,
      },
      catalog.skills.at(-1),
    ],
  });
  assert.deepEqual(
    result.actions.map((action) => [
      action.name,
      action.skillId,
      action.evidence,
    ]),
    [
      ["Unsheathe Gunsaber", 62_745, "buff-transition"],
      ["Sheathe Gunsaber", 62_861, "buff-transition"],
    ],
  );
});

test("canonicalizes Paragon Breaching Strike and Bloodthirster EVTC IDs", () => {
  const rawIds = [69_297, 69_433, 80_252, 80_263];
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 74,
        character: "Fixture Paragon",
      },
    ],
    skills: rawIds.map((id) => ({
      id,
      name: id < 80_000 ? "Breaching Strike" : "Bloodthirster",
    })),
    events: rawIds.flatMap((skillId, index) => {
      const time = 1_000 + index * 1_000;
      return [
        event({ time, stateChange: 67, skillId, value: 500 }),
        event({
          time: time + 500,
          stateChange: 68,
          skillId,
          value: 500,
          activation: 5,
        }),
      ];
    }),
  });
  const canonicalCatalog = {
    skills: [
      {
        id: 45_252,
        name: "Breaching Strike",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 842,
        effects: [],
        implemented: true,
      },
      {
        id: 80_203,
        name: "Bloodthirster",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 440,
        effects: [],
        implemented: true,
      },
      {
        id: 69_297,
        name: "Breaching Strike",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 840,
        effects: [],
        implemented: true,
      },
      {
        id: 80_252,
        name: "Bloodthirster",
        type: "Profession",
        slot: "Profession_1",
        castTimeMs: 440,
        effects: [],
        implemented: true,
      },
    ],
  };
  const result = reconstructEvtcRotation(fixture, canonicalCatalog);
  assert.deepEqual(
    result.actions.map((action) => [action.rawSkillId, action.skillId]),
    [
      [69_297, 45_252],
      [69_433, 45_252],
      [80_252, 80_203],
      [80_263, 80_203],
    ],
  );

  const spellbreaker = reconstructEvtcRotation(
    log({
      agents: [
        {
          ...log().agents[0],
          profession: 2,
          elite: 61,
          character: "Fixture Spellbreaker",
        },
      ],
      skills: [{ id: 69_297, name: "Breaching Strike" }],
      events: [event({ stateChange: 67, skillId: 69_297 })],
    }),
    canonicalCatalog,
  );
  assert.equal(spellbreaker.actions[0].skillId, 69_297);
});

test("supports the legacy single-event activation encoding", () => {
  const fixture = log({
    events: [
      event({
        time: 2_000,
        skillId: 3_000,
        value: 500,
        activation: 3,
      }),
    ],
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false,
  });
  assert.deepEqual(result.actions[0], {
    timestampMs: 0,
    endTimestampMs: 500,
    durationMs: 500,
    expectedDurationMs: 500,
    rawSkillId: 3_000,
    skillId: 3_000,
    name: "Blink",
    kind: "utility",
    evidence: "legacy-activation",
    status: "reduced",
    supportedByCatalog: true,
  });
  assert.deepEqual(result.rotation, [{ name: "Blink", skillId: 3_000 }]);
});

test("requires an address when multiple players have equal action evidence", () => {
  const secondAddress = 0x2000n;
  const fixture = log({
    agents: [
      ...log().agents,
      {
        ...log().agents[0],
        address: secondAddress,
        character: "Second Chronomancer",
      },
    ],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000 }),
      event({
        time: 1_000,
        source: secondAddress,
        stateChange: 67,
        skillId: 1_000,
      }),
    ],
  });
  const players = detectEvtcRotationPlayers(fixture);
  assert.equal(players.length, 2);
  assert.throws(
    () => reconstructEvtcRotation(fixture, catalog),
    (error) =>
      error instanceof EvtcError && error.code === "PLAYER_SELECTION_REQUIRED",
  );
});

test("the browser rotation importer reads compressed .zevtc files", async () => {
  assert.equal(isJsonRotationFile({ name: "rotation.json", type: "" }), true);
  assert.equal(isJsonRotationFile({ name: "fight.zevtc", type: "" }), false);
  const bytes = zipEvtc(expandedEvtcFixture());
  const imported = await readEvtcRotationFile(
    {
      name: "fight.zevtc",
      type: "application/octet-stream",
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    },
    {
      profession: { id: "mesmer", name: "Mesmer" },
      adapter: { eliteSpecialization: () => "Chronomancer" },
      build: {},
      activeCatalog: catalog,
    },
  );
  assert.equal(imported.playerLabel, "Fixture Chronomancer (:Fixture.1234)");
  assert.equal(imported.actionCount, 1);
  assert.deepEqual(imported.rotation, [{ name: "Mind Stab", skillId: 1_000 }]);
  assert.match(imported.warnings[0], /no matching stop event/);
});

test("every profession page exposes JSON and EVTC rotation files", async () => {
  const pages = [
    "elementalist",
    "engineer",
    "guardian",
    "mesmer",
    "necromancer",
    "ranger",
    "revenant",
    "thief",
    "warrior",
  ];
  for (const page of pages) {
    const html = await readFile(
      new URL(`../../${page}.html`, import.meta.url),
      "utf8",
    );
    assert.match(
      html,
      /id="rotation-file-input"\s+accept="\.json,\.evtc,\.evtc\.zip,\.zevtc,application\/json,application\/zip"/,
      page,
    );
  }
});
