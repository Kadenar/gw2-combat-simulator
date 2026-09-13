import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import type { ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { agentOwners, effectEvidence, isBuffApply } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
const CLONES = new Set([
  8108, 8109, 18894, 8110, 8111, 9058, 6479, 25569, 10542, 26153, 8107, 15090, 15114, 15233, 15199, 15181, 8106, 15084,
  15131, 15117, 15003, 15032, 15044, 15156, 15196, 15240, 15249, 18922, 18939, 19134, 19257, 25576, 25570, 25573, 25575,
  25578, 25582
]);
const PETS = new Set([
  19005, 6849, 3827, 7932, 19166, 6044, 15380, 24298, 26628, 8003, 10022, 8002, 6045, 27259, 8004, 6889, 6850, 11491,
  6888, 5582, 7928, 7927, 4426, 6898, 7926, 8013, 8016, 8015, 8014, 6887, 6883, 6884, 6885, 6886, 8008, 8005, 8007,
  8006, 5581, 7949, 7948, 6043, 7336, 7976, 4425, 7975, 8041, 9458, 8042, 15436, 15399, 8035, 15418, 18688, 18119,
  19104, 6968, 24796, 15402, 24203, 25652, 26147, 26220, 26851, 27687
]);
const SHATTERS = new Map<string, number>([
  ['C035166E3E4C414ABE640F47797D9B4A', -64],
  ['DC1C8A043ADCD24B9458688A792B04BA', 56928],
  ['AB2E22E7EE74DA4C87DA777C62E475EA', 56873]
]);
const SHATTER_IDS = new Set([56930, 56925, 56928, 56873]);

function float32(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, bits, true);
  return view.getFloat32(0, true);
}

function samePosition(a: ParsedEvtcEvent, b: ParsedEvtcEvent): boolean {
  // Split ground effects pack signed coordinates into dst_agent; value holds orientation, not position.
  const position = (e: ParsedEvtcEvent): number[] => {
    if ([60, 79].includes(e.stateChange))
      return [0n, 16n, 32n].map((shift) => Number(BigInt.asIntN(16, e.target >> shift)) * 10);
    if (e.stateChange === 62 || ([45, 51].includes(e.stateChange) && e.target !== 0n)) return [0, 0, 0];
    return [float32(e.value), float32(e.buffDamage), float32(e.overstackValue)];
  };

  const left = position(a),
    right = position(b);
  return left.reduce((distance, value, index) => distance + (value - right[index]) ** 2, 0) < 1e-6;
}

/** EI MesmerHelper excludes clone shatter visuals and distinguishes Mind Wrack from Distortion and its ammo variant. */
export function eiMesmerShatters(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  if (profile.professionId !== 'mesmer' || !['core', 'mirage'].includes(profile.specializationId)) return [];
  const effects = effectEvidence(log).filter((e) => e.event.source === playerAddress);
  const cloneEffects = effects.filter((e) => e.guid === '5FA6527231BB8041AC783396142C6200');
  const owners = agentOwners(log);
  const shatters = new Map([
    ['3D29ABD39CB5BD458C4D50A22FCC0E4B', 10191],
    ['52F65A4D9970954BA849CB57A46A65A8', 10190],
    ['916D8385083F144EBAA5BEEDE21FD47A', 10287]
  ]);
  const previous = new Map<number, number>();
  return effects
    .sort((a, b) => a.event.time - b.event.time)
    .flatMap(({ event, eventIndex, guid }) => {
      let skillId = shatters.get(guid);
      if (
        skillId == null ||
        cloneEffects.some((e) => Math.abs(e.event.time - event.time) < 10 && samePosition(e.event, event))
      )
        return [];
      if (skillId === 10191) {
        if (
          log.events.some(
            (e) =>
              e.skillId === 10243 &&
              e.target === playerAddress &&
              isBuffApply(log, e, true) &&
              Math.abs(e.time - event.time) < 10
          )
        )
          return [];
        const hasDamage = (id: number): boolean =>
          log.events.some(
            (e) =>
              e.stateChange === 0 &&
              e.buff === 0 &&
              e.activation === 0 &&
              e.skillId === id &&
              (owners.get(e.source) ?? e.source) === playerAddress &&
              Math.abs(e.time - event.time) < 2000
          );
        const normal = hasDamage(10191),
          ammo = hasDamage(49068);
        skillId = normal === ammo ? -63 : ammo ? 49068 : 10191;
      }

      const duplicate = event.time - (previous.get(skillId) ?? -Infinity) < 50;
      previous.set(skillId, event.time);
      return duplicate
        ? []
        : [
            {
              start: event.time,
              end: event.time,
              expectedDuration: 0,
              rawSkillId: skillId,
              rawName: log.skills.find((s) => s.id === skillId)?.name ?? 'Unknown ' + skillId,
              eventIndex,
              status: 'instant' as const,
              evidence: 'effect' as const,
              metadataAccurate: false,
              castOrigin: 'skill' as const,
              eiRule: 'MesmerHelper.EffectCastFinder(Shatter)'
            }
          ];
    });
}

/** EI identifies Phase Retreat only when its teleport coincides with an owned staff clone's first awareness. */
export function eiMesmerPhaseRetreat(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  if (profile.professionId !== 'mesmer') return [];
  const owners = agentOwners(log);
  const spawns = log.agents
    .filter(
      (a) => a.elite === 0xffffffff && (a.profession & 0xffff) === 8111 && owners.get(a.address) === playerAddress
    )
    .map((a) => log.events.find((e) => e.source === a.address || e.target === a.address)?.time ?? Infinity);
  let previous = -Infinity;
  return effectEvidence(log)
    .filter(
      ({ event, guid }) =>
        guid === 'C34E250B01FF534292EE6AB36D768337' &&
        event.target === playerAddress &&
        ![60, 79].includes(event.stateChange) &&
        spawns.some((time) => Math.abs(time - event.time) < 30) &&
        !log.events.some(
          (e) =>
            e.skillId === 10353 &&
            e.source === playerAddress &&
            Math.abs(e.time - event.time) < 30 &&
            (Number(log.header.arcdpsBuild) >= 20260501
              ? [71, 72].includes(e.stateChange)
              : e.stateChange === 0 && e.buffRemove !== 0)
        )
    )
    .sort((a, b) => a.event.time - b.event.time)
    .flatMap(({ event, eventIndex }) => {
      const duplicate = event.time - previous < 50;
      previous = event.time;
      return duplicate
        ? []
        : [
            {
              start: event.time,
              end: event.time,
              expectedDuration: 0,
              rawSkillId: 10310,
              rawName: 'Phase Retreat',
              eventIndex,
              status: 'instant' as const,
              evidence: 'effect' as const,
              metadataAccurate: false,
              castOrigin: 'skill' as const,
              eiRule: 'MesmerHelper.EffectCastFinderByDst(PhaseRetreat)'
            }
          ];
    });
}

/** EI ChronomancerHelper.ComputeChronomancerShatters consumes clone deaths in reverse shatter order. */
export function eiChronomancerShatters(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'chronomancer') return [];
  const { log, playerAddress } = context,
    owners = agentOwners(log);
  const effects = effectEvidence(log).filter((e) => e.event.source === playerAddress);
  const chrono = effects.filter((e) => e.guid === '5FA6527231BB8041AC783396142C6200');
  if (!chrono.length) return [];
  const boon = effects.filter((e) => e.guid === '4C7A5E148F7FD642B34EE4996DDCBBAB');
  const clones = log.agents.filter(
    (a) => a.elite === 0xffffffff && CLONES.has(a.profession & 0xffff) && owners.get(a.address) === playerAddress
  );
  const kills = new Map(
    clones.map((a) => [
      a.address,
      log.events.filter((e) => e.stateChange === 0 && e.result === 8 && e.target === a.address)
    ])
  );
  const deaths = clones
    .filter((a) => !kills.get(a.address)!.length || kills.get(a.address)!.some((e) => SHATTER_IDS.has(e.skillId)))
    .flatMap((a) => {
      const death = log.events.filter((e) => e.stateChange === 4 && e.source === a.address).at(-1);
      return death ? [death] : [];
    })
    .sort((a, b) => a.time - b.time);
  const result: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex, guid } of effects
    .filter((e) => SHATTERS.has(e.guid))
    .sort((a, b) => b.event.time - a.event.time)) {
    let skillId = SHATTERS.get(guid)!;
    let ids = new Set([skillId]);
    if (skillId === -64) {
      ids = new Set([56930, 56925]);
      for (const variant of [56925, 56930])
        if (
          log.events.some(
            (e) =>
              e.stateChange === 0 &&
              e.skillId === variant &&
              (owners.get(e.source) ?? e.source) === playerAddress &&
              Math.abs(e.time - event.time) < 2000
          )
        ) {
          skillId = variant;
          break;
        }
    }

    const nearby = boon.filter((e) => Math.abs(e.event.time - event.time) < 10);
    let emit = nearby.some((e) => samePosition(e.event, event));
    if (!emit) {
      if (nearby.length) continue;
      const dead = [...deaths]
        .reverse()
        .find(
          (e) =>
            e.time >= event.time &&
            e.time - event.time < 20 &&
            (!kills.get(e.source)!.length || kills.get(e.source)!.some((k) => ids.has(k.skillId)))
        );
      if (dead) {
        deaths.splice(deaths.indexOf(dead), 1);
        continue;
      }

      emit = chrono.some((e) => Math.abs(e.event.time - event.time) < 10 && samePosition(e.event, event));
    }

    if (emit)
      result.push({
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: skillId,
        rawName: log.skills.find((s) => s.id === skillId)?.name ?? 'Unknown ' + skillId,
        eventIndex,
        status: 'instant',
        evidence: 'effect',
        metadataAccurate: false,
        castOrigin: 'skill',
        eiRule: 'ChronomancerHelper.ComputeChronomancerShatters'
      });
  }

  return result;
}

/** EI MinionSpawnCastFinder uses actual spawns, ordered by each owned minion's first awareness. */
export function eiMinionSpawns(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  const owners = agentOwners(log);
  const skillId = profile.professionId === 'ranger' ? -28 : profile.specializationId === 'reaper' ? 30772 : null;
  if (skillId == null) return [];
  const species = profile.professionId === 'ranger' ? PETS : new Set([15314]);
  const agents = log.agents.filter(
    (a) => a.elite === 0xffffffff && species.has(a.profession & 0xffff) && owners.get(a.address) === playerAddress
  );
  const first = (address: bigint): number =>
    log.events.find((e) => e.source === address || e.target === address)?.time ?? Infinity;
  agents.sort((a, b) => first(a.address) - first(b.address));
  let previous = -Infinity;
  const result: EvtcRecordedRotationAction[] = [];
  for (const agent of agents)
    for (const [eventIndex, event] of log.events.entries()) {
      if (event.stateChange !== 6 || event.source !== agent.address) continue;
      const duplicate = event.time - previous < 50;
      previous = event.time;
      if (duplicate) continue;
      result.push({
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: skillId,
        rawName: log.skills.find((s) => s.id === skillId)?.name ?? 'Unknown ' + skillId,
        eventIndex,
        status: 'instant',
        evidence: 'effect',
        metadataAccurate: profile.professionId !== 'ranger',
        castOrigin: 'skill',
        eiRule: 'MinionSpawnCastFinder'
      });
    }

  return result;
}
