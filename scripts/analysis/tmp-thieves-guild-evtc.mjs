import fs from "node:fs";
import { inflateRawSync } from "node:zlib";

const input = process.argv[2];
const zipped = fs.readFileSync(input);
const method = zipped.readUInt16LE(8);
const compressedSize = zipped.readUInt32LE(18);
const nameLength = zipped.readUInt16LE(26);
const extraLength = zipped.readUInt16LE(28);
const payloadStart = 30 + nameLength + extraLength;
const payload = zipped.subarray(payloadStart, payloadStart + compressedSize);
const data = zipped.toString("ascii", 0, 4) === "PK\u0003\u0004"
  ? method === 8 ? inflateRawSync(payload) : Buffer.from(payload)
  : zipped;

let offset = 16;
const agentCount = data.readUInt32LE(offset);
offset += 4;
const agents = [];
for (let index = 0; index < agentCount; index += 1) {
  const address = data.readBigUInt64LE(offset);
  const names = data.toString("utf8", offset + 28, offset + 92)
    .split("\0").filter(Boolean);
  agents.push({
    address,
    addressHex: `0x${address.toString(16)}`,
    profession: data.readUInt32LE(offset + 8),
    character: names[0] || "",
  });
  offset += 96;
}
const skillCount = data.readUInt32LE(offset);
offset += 4;
const skills = new Map();
for (let index = 0; index < skillCount; index += 1) {
  const id = data.readInt32LE(offset) >>> 0;
  const end = data.indexOf(0, offset + 4);
  skills.set(id, data.toString("utf8", offset + 4, Math.min(end, offset + 68)));
  offset += 68;
}
const events = [];
while (offset + 64 <= data.length) {
  events.push({
    time: Number(data.readBigUInt64LE(offset)),
    source: data.readBigUInt64LE(offset + 8),
    target: data.readBigUInt64LE(offset + 16),
    value: data.readInt32LE(offset + 24),
    buffDamage: data.readInt32LE(offset + 28),
    skillId: data.readUInt32LE(offset + 36),
    sourceInstance: data.readUInt16LE(offset + 40),
    targetInstance: data.readUInt16LE(offset + 42),
    sourceMasterInstance: data.readUInt16LE(offset + 44),
    iff: data[offset + 48],
    buff: data[offset + 49],
    result: data[offset + 50],
    activation: data[offset + 51],
    buffRemove: data[offset + 52],
    stateChange: data[offset + 56],
  });
  offset += 64;
}
const timeline = events.filter(event => event.time > 0 && [0, 9, 10].includes(event.stateChange));
const start = Math.min(...timeline.map(event => event.time));
const at = event => Number(((event.time - start) / 1000).toFixed(3));
const address = value => `0x${value.toString(16)}`;
const summonAddresses = new Set([0x96an, 0x96bn, 0x96cn]);
const summonInstances = new Set(events
  .filter(event => summonAddresses.has(event.source) && event.sourceInstance)
  .map(event => event.sourceInstance));
const relevant = event =>
  summonAddresses.has(event.source)
  || summonInstances.has(event.sourceInstance)
  || summonInstances.has(event.sourceMasterInstance);
const eventView = event => ({
  at: at(event),
  source: address(event.source),
  sourceName: agents.find(agent => agent.address === event.source)?.character || "",
  sourceInstance: event.sourceInstance,
  sourceMasterInstance: event.sourceMasterInstance,
  target: address(event.target),
  targetInstance: event.targetInstance,
  skillId: event.skillId,
  skill: skills.get(event.skillId) || `Unknown ${event.skillId}`,
  value: event.value,
  buffDamage: event.buffDamage,
  result: event.result,
  activation: event.activation,
  buff: event.buff,
  buffRemove: event.buffRemove,
  stateChange: event.stateChange,
});

console.log(JSON.stringify({
  agents: agents.filter(agent => summonAddresses.has(agent.address)).map(agent => ({
    addressHex: agent.addressHex,
    profession: agent.profession,
    character: agent.character,
  })),
  summonInstances: [...summonInstances],
  activations: events.filter(event =>
    summonAddresses.has(event.source) && event.activation !== 0).map(eventView),
  damage: events.filter(event =>
    relevant(event) && event.stateChange === 0 && event.activation === 0
    && event.iff === 1 && (event.value > 0 || event.buffDamage > 0)).map(eventView),
  conditions: events.filter(event =>
    relevant(event) && event.stateChange === 0 && event.activation === 0
    && event.iff === 1 && event.buff === 1).map(eventView),
  state: events.filter(event =>
    summonAddresses.has(event.source) && event.stateChange !== 0).map(eventView),
}, null, 2));
