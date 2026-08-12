import { deflateRawSync } from "node:zlib";

export const ADDRESSES = Object.freeze({
  player: 0x1000n,
  secondPlayer: 0x2000n,
  golem: 0x3000n,
});

export function playerAgent(overrides = {}) {
  return {
    address: ADDRESSES.player,
    profession: 8,
    elite: 64,
    character: "Fixture Necromancer",
    account: ":Fixture.0000",
    subgroup: "1",
    ...overrides,
  };
}

export function golemAgent(speciesId = 16199, overrides = {}) {
  return {
    address: ADDRESSES.golem,
    profession: speciesId,
    elite: 0xffffffff,
    character: "Synthetic Training Target",
    account: "",
    subgroup: "",
    ...overrides,
  };
}

export function combatEvent(overrides = {}) {
  return {
    time: 1_000,
    source: ADDRESSES.player,
    target: ADDRESSES.golem,
    value: 1_000,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 100,
    sourceInstance: 1,
    targetInstance: 2,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 1,
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

function writeAgent(agent) {
  const record = Buffer.alloc(96);
  record.writeBigUInt64LE(agent.address, 0);
  record.writeUInt32LE(agent.profession >>> 0, 8);
  record.writeUInt32LE(agent.elite >>> 0, 12);
  record.writeUInt16LE(agent.toughness || 0, 16);
  record.writeUInt16LE(agent.concentration || 0, 18);
  record.writeUInt16LE(agent.healing || 0, 20);
  record.writeUInt16LE(agent.condition || 0, 22);
  Buffer.from(
    `${agent.character || ""}\0${agent.account || ""}\0${agent.subgroup || ""}\0`,
    "utf8",
  ).copy(record, 28, 0, 64);
  return record;
}

function writeSkill(skill) {
  const record = Buffer.alloc(68);
  record.writeUInt32LE(skill.id >>> 0, 0);
  Buffer.from(skill.name || "", "utf8").copy(record, 4, 0, 63);
  return record;
}

function writeEvent(event) {
  const record = Buffer.alloc(64);
  record.writeBigUInt64LE(BigInt(event.time), 0);
  record.writeBigUInt64LE(event.source, 8);
  record.writeBigUInt64LE(event.target, 16);
  record.writeInt32LE(event.value, 24);
  record.writeInt32LE(event.buffDamage, 28);
  record.writeUInt32LE(event.overstackValue >>> 0, 32);
  record.writeUInt32LE(event.skillId >>> 0, 36);
  record.writeUInt16LE(event.sourceInstance, 40);
  record.writeUInt16LE(event.targetInstance, 42);
  record.writeUInt16LE(event.sourceMasterInstance, 44);
  record.writeUInt16LE(event.targetMasterInstance, 46);
  record[48] = event.iff;
  record[49] = event.buff;
  record[50] = event.result;
  record[51] = event.activation;
  record[52] = event.buffRemove;
  record[53] = event.ninety;
  record[54] = event.fifty;
  record[55] = event.moving;
  record[56] = event.stateChange;
  record[57] = event.flanking;
  record[58] = event.shields;
  record[59] = event.offcycle;
  record.writeUInt32LE(event.pad >>> 0, 60);
  return record;
}

export function buildEvtc({
  revision = 1,
  encounterId = 16199,
  agents = [playerAgent(), golemAgent(encounterId)],
  skills = [
    { id: 100, name: "Fixture Strike" },
    { id: 736, name: "Bleeding" },
    { id: 10529, name: "Dark Pact" },
    { id: 10705, name: "Deathly Swarm" },
  ],
  events = [
    combatEvent({
      time: 100,
      source: 1154n,
      target: 0n,
      value: 0,
      skillId: 0,
      sourceInstance: 0,
      targetInstance: 0,
      iff: 0,
      stateChange: 25,
    }),
    combatEvent({ time: 1_000, result: 1 }),
    combatEvent({ time: 2_000, value: 800 }),
  ],
} = {}) {
  const header = Buffer.alloc(16);
  header.write("EVTC20260812", 0, "ascii");
  header[12] = revision;
  header.writeUInt16LE(encounterId, 13);
  const agentCount = Buffer.alloc(4);
  agentCount.writeUInt32LE(agents.length);
  const skillCount = Buffer.alloc(4);
  skillCount.writeUInt32LE(skills.length);
  return Buffer.concat([
    header,
    agentCount,
    ...agents.map(writeAgent),
    skillCount,
    ...skills.map(writeSkill),
    ...events.map((event) => writeEvent(combatEvent(event))),
  ]);
}

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

export function buildZip(
  content,
  {
    method = 8,
    fileName = "fixture.evtc",
    declaredExpandedSize = content.length,
  } = {},
) {
  const name = Buffer.from(fileName, "utf8");
  const payload = method === 8 ? deflateRawSync(content) : Buffer.from(content);
  const crc = crc32(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(declaredExpandedSize, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(declaredExpandedSize, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + name.length + payload.length;
  const centralSize = central.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, payload, central, name, end]);
}
