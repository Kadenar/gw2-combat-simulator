import { EvtcError } from './errors.js';
import type { ParsedEvtc, ParsedEvtcAgent, ParsedEvtcEvent, ParsedEvtcSkill } from './types.js';

export const EVTC_PARSE_LIMITS = Object.freeze({
  maximumExpandedBytes: 512 * 1024 * 1024,
  maximumAgents: 100_000,
  maximumSkills: 100_000,
  maximumEvents: 8_000_000
});

const HEADER_SIZE = 16;
const AGENT_SIZE = 96;
const SKILL_SIZE = 68;
const EVENT_SIZE = 64;
const ARCDPS_FOOTER_SIZE = 24;
const decoder = new TextDecoder('utf-8', { fatal: false });
const EVTC_SKILL_NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'Master Tuning Crystal': 'Tuning Icicle'
});

/**
 * ArcDPS may append a 24-byte zero-padded footer after the combat records.
 * The only populated field observed in current logs is the little-endian
 * extension count at byte 16. It is not part of the combat-event table.
 */
function hasArcDpsFooter(bytes: Uint8Array, offset: number): boolean {
  if (bytes.byteLength - offset !== ARCDPS_FOOTER_SIZE) return false;
  return (
    bytes.subarray(offset, offset + 16).every((byte) => byte === 0) &&
    bytes.subarray(offset + 20).every((byte) => byte === 0)
  );
}

function readString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return decoder.decode(end < 0 ? bytes : bytes.subarray(0, end));
}

/** Canonicalizes equivalent EVTC labels so imports use one simulator item. */
function canonicalEvtcSkillName(name: string): string {
  return EVTC_SKILL_NAME_ALIASES[name] || name;
}

function ensureRange(
  size: number,
  offset: number,
  length: number,
  code: 'TRUNCATED_HEADER' | 'TRUNCATED_AGENTS' | 'TRUNCATED_SKILLS',
  label: string
): void {
  if (offset < 0 || length < 0 || offset + length > size) {
    throw new EvtcError(code, `The EVTC ${label} is truncated.`);
  }
}

export function parseEvtc(input: ArrayBuffer | Uint8Array): ParsedEvtc {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.byteLength > EVTC_PARSE_LIMITS.maximumExpandedBytes) {
    throw new EvtcError('EXPANDED_SIZE_EXCEEDED', 'The expanded EVTC file exceeds the 512 MiB safety limit.');
  }

  ensureRange(bytes.byteLength, 0, HEADER_SIZE, 'TRUNCATED_HEADER', 'header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));

  if (magic !== 'EVTC') {
    throw new EvtcError('INVALID_MAGIC', 'The file does not contain EVTC data.');
  }

  const arcdpsBuild = String.fromCharCode(...bytes.subarray(4, 12));

  if (!/^\d{8}$/.test(arcdpsBuild)) {
    throw new EvtcError('INVALID_MAGIC', 'The EVTC header has an invalid ArcDPS build identifier.');
  }

  const rawRevision = view.getUint8(12);

  if (rawRevision !== 0 && rawRevision !== 1) {
    throw new EvtcError('UNSUPPORTED_REVISION', `EVTC combat-event revision ${rawRevision} is not supported.`, {
      revision: rawRevision
    });
  }

  const revision: 0 | 1 = rawRevision;
  const encounterId = view.getUint16(13, true);
  let offset = HEADER_SIZE;

  ensureRange(bytes.byteLength, offset, 4, 'TRUNCATED_AGENTS', 'agent count');
  const agentCount = view.getUint32(offset, true);
  offset += 4;

  if (agentCount > EVTC_PARSE_LIMITS.maximumAgents) {
    throw new EvtcError('LIMIT_EXCEEDED', `The EVTC agent count (${agentCount}) exceeds the safety limit.`, {
      agentCount
    });
  }

  ensureRange(bytes.byteLength, offset, agentCount * AGENT_SIZE, 'TRUNCATED_AGENTS', 'agent table');
  const agents: ParsedEvtcAgent[] = [];
  for (let index = 0; index < agentCount; index += 1) {
    const record = offset + index * AGENT_SIZE;
    const names = decoder.decode(bytes.subarray(record + 28, record + 92)).split('\0');
    agents.push({
      address: view.getBigUint64(record, true),
      profession: view.getUint32(record + 8, true),
      elite: view.getUint32(record + 12, true),
      toughness: view.getUint16(record + 16, true),
      concentration: view.getUint16(record + 18, true),
      healing: view.getUint16(record + 20, true),
      condition: view.getUint16(record + 22, true),
      character: names[0] || '',
      account: names[1] || '',
      subgroup: names[2] || ''
    });
  }

  offset += agentCount * AGENT_SIZE;

  ensureRange(bytes.byteLength, offset, 4, 'TRUNCATED_SKILLS', 'skill count');
  const skillCount = view.getUint32(offset, true);
  offset += 4;

  if (skillCount > EVTC_PARSE_LIMITS.maximumSkills) {
    throw new EvtcError('LIMIT_EXCEEDED', `The EVTC skill count (${skillCount}) exceeds the safety limit.`, {
      skillCount
    });
  }

  ensureRange(bytes.byteLength, offset, skillCount * SKILL_SIZE, 'TRUNCATED_SKILLS', 'skill table');
  const skills: ParsedEvtcSkill[] = [];
  for (let index = 0; index < skillCount; index += 1) {
    const record = offset + index * SKILL_SIZE;
    skills.push({
      id: view.getUint32(record, true),
      name: canonicalEvtcSkillName(readString(bytes.subarray(record + 4, record + SKILL_SIZE)))
    });
  }

  offset += skillCount * SKILL_SIZE;

  const remainingBytes = bytes.byteLength - offset;
  const trailingBytes = remainingBytes % EVENT_SIZE;
  const eventBytes = hasArcDpsFooter(bytes, bytes.byteLength - trailingBytes)
    ? remainingBytes - trailingBytes
    : remainingBytes;

  if (eventBytes % EVENT_SIZE !== 0) {
    throw new EvtcError('TRUNCATED_EVENTS', 'The EVTC combat-event table ends with a truncated record.', {
      trailingBytes
    });
  }

  const eventCount = eventBytes / EVENT_SIZE;

  if (eventCount > EVTC_PARSE_LIMITS.maximumEvents) {
    throw new EvtcError('LIMIT_EXCEEDED', `The EVTC combat-event count (${eventCount}) exceeds the safety limit.`, {
      eventCount
    });
  }

  const events: ParsedEvtcEvent[] = [];
  for (let index = 0; index < eventCount; index += 1) {
    const record = offset + index * EVENT_SIZE;
    events.push({
      time: Number(view.getBigUint64(record, true)),
      source: view.getBigUint64(record + 8, true),
      target: view.getBigUint64(record + 16, true),
      value: view.getInt32(record + 24, true),
      buffDamage: view.getInt32(record + 28, true),
      overstackValue: view.getUint32(record + 32, true),
      skillId: view.getUint32(record + 36, true),
      sourceInstance: view.getUint16(record + 40, true),
      targetInstance: view.getUint16(record + 42, true),
      sourceMasterInstance: view.getUint16(record + 44, true),
      targetMasterInstance: view.getUint16(record + 46, true),
      iff: view.getUint8(record + 48),
      buff: view.getUint8(record + 49),
      result: view.getUint8(record + 50),
      activation: view.getUint8(record + 51),
      buffRemove: view.getUint8(record + 52),
      ninety: view.getUint8(record + 53),
      fifty: view.getUint8(record + 54),
      moving: view.getUint8(record + 55),
      stateChange: view.getUint8(record + 56),
      flanking: view.getUint8(record + 57),
      shields: view.getUint8(record + 58),
      offcycle: view.getUint8(record + 59),
      pad: view.getUint32(record + 60, true)
    });
  }

  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild,
      revision,
      encounterId,
      agentCount,
      skillCount,
      eventCount
    },
    agents,
    skills,
    events
  };
}
