import fs from "node:fs";
import { inflateRawSync } from "node:zlib";

const input = process.argv[2];
if (!input) {
  console.error(
    "Usage: node scripts/analyze-evtc.mjs <fight.evtc|fight.zevtc> "
      + "[--summary] [--condition-events] [--window=<seconds>]",
  );
  process.exit(1);
}
const summaryOnly = process.argv.includes("--summary");
const includeConditionEvents = process.argv.includes("--condition-events");
const CONDITION_NAMES = new Set([
  "Bleeding",
  "Blindness",
  "Burning",
  "Chilled",
  "Confusion",
  "Crippled",
  "Fear",
  "Immobilized",
  "Poisoned",
  "Slow",
  "Torment",
  "Vulnerability",
  "Weakness",
]);
const windowSeconds = Number(
  process.argv
    .find(argument => argument.startsWith("--window="))
    ?.slice("--window=".length),
);

function readEvtc(path) {
  const inputData = fs.readFileSync(path);
  if (inputData.toString("ascii", 0, 4) !== "PK\u0003\u0004") {
    return inputData;
  }

  const compressionMethod = inputData.readUInt16LE(8);
  const compressedSize = inputData.readUInt32LE(18);
  const uncompressedSize = inputData.readUInt32LE(22);
  const nameLength = inputData.readUInt16LE(26);
  const extraLength = inputData.readUInt16LE(28);
  const payloadStart = 30 + nameLength + extraLength;
  const payload = inputData.subarray(
    payloadStart,
    payloadStart + compressedSize,
  );
  const result = compressionMethod === 0
    ? Buffer.from(payload)
    : compressionMethod === 8
      ? inflateRawSync(payload)
      : null;
  if (!result) {
    throw new Error(
      `${path} uses unsupported ZIP compression method ${compressionMethod}.`,
    );
  }
  if (uncompressedSize && result.length !== uncompressedSize) {
    throw new Error(
      `${path} expanded to ${result.length} bytes; expected ${uncompressedSize}.`,
    );
  }
  return result;
}

const data = readEvtc(input);
const magic = data.toString("ascii", 0, 12);
if (!magic.startsWith("EVTC")) {
  throw new Error(`${input} is not an uncompressed EVTC file.`);
}

let offset = 16;
const agentCount = data.readUInt32LE(offset);
offset += 4;
const agents = [];
for (let index = 0; index < agentCount; index += 1) {
  const address = data.readBigUInt64LE(offset);
  const profession = data.readUInt32LE(offset + 8);
  const elite = data.readUInt32LE(offset + 12);
  const names = data
    .toString("utf8", offset + 28, offset + 92)
    .split("\0")
    .filter(Boolean);
  agents.push({
    address,
    addressHex: `0x${address.toString(16)}`,
    profession,
    elite,
    character: names[0] || "",
    account: names[1] || "",
    subgroup: names[2] || "",
  });
  offset += 96;
}

const skillCount = data.readUInt32LE(offset);
offset += 4;
const skills = new Map();
for (let index = 0; index < skillCount; index += 1) {
  const id = data.readInt32LE(offset);
  const end = data.indexOf(0, offset + 4);
  const name = data.toString(
    "utf8",
    offset + 4,
    Math.min(end < 0 ? offset + 68 : end, offset + 68),
  );
  skills.set(id >>> 0, name);
  offset += 68;
}

const events = [];
while (offset + 64 <= data.length) {
  events.push({
    rawFlags: [...data.subarray(offset + 48, offset + 64)],
    time: Number(data.readBigUInt64LE(offset)),
    source: data.readBigUInt64LE(offset + 8),
    target: data.readBigUInt64LE(offset + 16),
    value: data.readInt32LE(offset + 24),
    buffDamage: data.readInt32LE(offset + 28),
    overstack: data.readUInt32LE(offset + 32),
    skillId: data.readUInt32LE(offset + 36),
    sourceInstance: data.readUInt16LE(offset + 40),
    targetInstance: data.readUInt16LE(offset + 42),
    sourceMasterInstance: data.readUInt16LE(offset + 44),
    targetMasterInstance: data.readUInt16LE(offset + 46),
    iff: data[offset + 48],
    buff: data[offset + 49],
    result: data[offset + 50],
    activation: data[offset + 51],
    buffRemove: data[offset + 52],
    stateChange: data[offset + 56],
  });
  offset += 64;
}

const players = agents.filter(agent =>
  agent.account.startsWith(":")
  || (
    agent.profession >= 1
    && agent.profession <= 9
    && agent.elite !== 0xffffffff
  ));
const playerAddresses = new Set(players.map(player => player.address));
const timelineEvents = events.filter(event =>
  event.time > 0
  && (
    event.stateChange === 0
    || event.stateChange === 9
    || event.stateChange === 10
  ));
const startTime = Math.min(...timelineEvents.map(event => event.time));
const relative = time => Number(((time - startTime) / 1000).toFixed(3));
const skillName = id => skills.get(id) || `Unknown ${id}`;
const agentByAddress = new Map(agents.map(agent => [agent.address, agent]));

const casts = events
  .filter(event =>
    playerAddresses.has(event.source)
    && event.stateChange === 68
    && event.value > 0
    && event.activation === 3)
  .map(event => ({
    at: relative(event.time),
    skillId: event.skillId,
    skill: skillName(event.skillId),
    durationMs: event.value,
    quickness: null,
  }));

const outgoing = new Map();
for (const event of events) {
  if (
    !playerAddresses.has(event.source)
    || event.stateChange !== 0
    || event.activation !== 0
  ) continue;
  const strike = event.buff === 0 ? Math.max(0, event.value) : 0;
  const condition = event.buff === 1 ? Math.max(0, event.buffDamage) : 0;
  if (!strike && !condition) continue;
  const current = outgoing.get(event.skillId) || {
    skillId: event.skillId,
    skill: skillName(event.skillId),
    strikeDamage: 0,
    conditionDamage: 0,
    strikeHits: 0,
    conditionTicks: 0,
    packets: [],
    firstAt: relative(event.time),
    lastAt: relative(event.time),
  };
  current.strikeDamage += strike;
  current.conditionDamage += condition;
  current.strikeHits += strike > 0 ? 1 : 0;
  current.conditionTicks += condition > 0 ? 1 : 0;
  current.lastAt = relative(event.time);
  current.packets.push({
    at: relative(event.time),
    strike,
    condition,
    result: event.result,
  });
  outgoing.set(event.skillId, current);
}

const buffs = new Map();
for (const event of events) {
  if (
    !playerAddresses.has(event.target)
    || event.buff !== 1
    || event.stateChange !== 0
    || event.activation !== 0
    || event.buffRemove !== 0
    || event.value <= 0
  ) continue;
  const current = buffs.get(event.skillId) || {
    skillId: event.skillId,
    skill: skillName(event.skillId),
    applications: 0,
    totalDurationMs: 0,
    firstAt: relative(event.time),
    lastAt: relative(event.time),
  };
  current.applications += 1;
  current.totalDurationMs += event.value;
  current.lastAt = relative(event.time);
  buffs.set(event.skillId, current);
}

function collectConditionApplications({ self }) {
  const applications = new Map();
  for (const event of events) {
    const playerSource = playerAddresses.has(event.source);
    const playerTarget = playerAddresses.has(event.target);
    if (
      !playerSource
      || playerTarget !== self
      || event.buff !== 1
      || event.stateChange !== 69
      || event.activation !== 0
      || event.buffRemove !== 0
      || event.value <= 0
      || event.buffDamage !== 0
      || !CONDITION_NAMES.has(skillName(event.skillId))
    ) continue;
    const current = applications.get(event.skillId) || {
      skillId: event.skillId,
      skill: skillName(event.skillId),
      applications: 0,
      totalDurationMs: 0,
      firstAt: relative(event.time),
      lastAt: relative(event.time),
      samples: [],
    };
    current.applications += 1;
    current.totalDurationMs += event.value;
    current.lastAt = relative(event.time);
    if (current.samples.length < 12) {
      current.samples.push({
        at: relative(event.time),
        durationMs: event.value,
        overstack: event.overstack,
        target: `0x${event.target.toString(16)}`,
      });
    }
    applications.set(event.skillId, current);
  }
  return [...applications.values()]
    .sort((left, right) => right.applications - left.applications);
}

const outgoingConditionApplications =
  collectConditionApplications({ self: false });
const selfConditionApplications =
  collectConditionApplications({ self: true });

const damage = [...outgoing.values()]
  .sort((left, right) =>
    right.strikeDamage + right.conditionDamage
    - left.strikeDamage - left.conditionDamage);
const totalDamage = damage.reduce(
  (sum, entry) => sum + entry.strikeDamage + entry.conditionDamage,
  0,
);

const report = {
  header: {
    magic,
    revision: data[12],
    encounterId: data.readUInt16LE(13),
    agentCount,
    skillCount,
    eventCount: events.length,
    duration: relative(Math.max(...timelineEvents.map(event => event.time))),
  },
  players: players.map(({ address, ...player }) => player),
  activationCounts: Object.fromEntries(
    [...events.reduce((counts, event) => {
      counts.set(event.activation, (counts.get(event.activation) || 0) + 1);
      return counts;
    }, new Map())].sort((left, right) => left[0] - right[0]),
  ),
  activationSamples: events
    .filter(event => event.activation !== 0)
    .slice(0, 20)
    .map(event => ({
      at: relative(event.time),
      activation: event.activation,
      stateChange: event.stateChange,
      buff: event.buff,
      result: event.result,
      source: `0x${event.source.toString(16)}`,
      sourceName: agentByAddress.get(event.source)?.character || "",
      skillId: event.skillId,
      skill: skillName(event.skillId),
      value: event.value,
      rawFlags: event.rawFlags.join(" "),
    })),
  totalDamage,
  casts,
  damage,
  buffs: [...buffs.values()]
    .sort((left, right) => right.applications - left.applications),
  outgoingConditionApplications,
  selfConditionApplications,
  ...(includeConditionEvents
    ? {
        conditionEvents: events
          .filter(event =>
            ["Bleeding", "Burning", "Poisoned", "Torment", "Confusion"]
              .includes(skillName(event.skillId)))
          .map(event => ({
            at: relative(event.time),
            skillId: event.skillId,
            skill: skillName(event.skillId),
            source: `0x${event.source.toString(16)}`,
            target: `0x${event.target.toString(16)}`,
            value: event.value,
            buffDamage: event.buffDamage,
            overstack: event.overstack,
            iff: event.iff,
            buff: event.buff,
            result: event.result,
            activation: event.activation,
            buffRemove: event.buffRemove,
            stateChange: event.stateChange,
          })),
      }
    : {}),
};

const summary = {
  header: report.header,
  players: report.players,
  totalDamage,
  dps: totalDamage / report.header.duration,
  casts: [...casts.reduce((counts, cast) => {
    const current = counts.get(cast.skill) || {
      skill: cast.skill,
      casts: 0,
      averageDurationMs: 0,
    };
    current.averageDurationMs = (
      current.averageDurationMs * current.casts + cast.durationMs
    ) / (current.casts + 1);
    current.casts += 1;
    counts.set(cast.skill, current);
    return counts;
  }, new Map()).values()]
    .sort((left, right) => right.casts - left.casts),
  damage: damage.map(({ packets, ...entry }) => ({
    ...entry,
    totalDamage: entry.strikeDamage + entry.conditionDamage,
  })),
  buffs: report.buffs,
  outgoingConditionApplications,
  selfConditionApplications,
  ...(includeConditionEvents
    ? { conditionEvents: report.conditionEvents }
    : {}),
  ...(windowSeconds > 0
    ? {
        window: {
          duration: windowSeconds,
          totalDamage: damage.reduce(
            (sum, entry) => sum + entry.packets
              .filter(packet => packet.at <= windowSeconds)
              .reduce(
                (packetSum, packet) =>
                  packetSum + packet.strike + packet.condition,
                0,
              ),
            0,
          ),
          damage: damage
            .map(entry => ({
              skillId: entry.skillId,
              skill: entry.skill,
              damage: entry.packets
                .filter(packet => packet.at <= windowSeconds)
                .reduce(
                  (sum, packet) =>
                    sum + packet.strike + packet.condition,
                  0,
                ),
              hits: entry.packets
                .filter(packet => packet.at <= windowSeconds).length,
            }))
            .filter(entry => entry.damage > 0)
            .sort((left, right) => right.damage - left.damage),
        },
      }
    : {}),
};

if (summary.window) {
  summary.window.dps =
    summary.window.totalDamage / summary.window.duration;
}

console.log(JSON.stringify(summaryOnly ? summary : report, null, 2));
