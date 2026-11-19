import { isBuffApply, isBuffExtension, isBuffRemoval } from '#gw2/integrations/logs/evtc/rotation/buff-events.js';
import type { EiInstantRule } from '#gw2/integrations/logs/evtc/rotation/ei-rules.js';
import type { IndexedEvent } from '#gw2/integrations/logs/evtc/rotation/evidence.js';
import type { EvtcProfessionReconstructionContext } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';

const WEAVER_ELEMENTS = [
  { name: 'Fire', basic: 5585, major: 40926, minor: 42811 },
  { name: 'Water', basic: 5586, major: 43236, minor: 43370 },
  { name: 'Air', basic: 5575, major: 41692, minor: 43229 },
  { name: 'Earth', basic: 5580, major: 43740, minor: 44822 }
] as const;
const WEAVER_ATTUNEMENT_IDS = [
  [43470, -5, -6, -7],
  [-8, 41166, -9, -10],
  [-11, -12, 42264, -13],
  [-14, -15, -16, 44857]
];
const attunementIds = new Set(WEAVER_ATTUNEMENT_IDS.flat());

/** Each EI attunement has a distinct source identity and replays as its primary element's swap. */
export const WEAVER_ATTUNEMENT_RULES: readonly EiInstantRule[] = WEAVER_ELEMENTS.flatMap((primary, row) =>
  WEAVER_ELEMENTS.map((secondary, column): EiInstantRule => {
    const skillId = WEAVER_ATTUNEMENT_IDS[row][column];
    const first = row === column ? 'Dual' : primary.name;
    return {
      profession: 'elementalist',
      specialization: 'weaver',
      skillId,
      signal: skillId,
      kind: 'buff-gain',
      rule: `WeaverHelper.BuffGainCastFinder(${first}${secondary.name}Attunement)`,
      actionIdentity: {
        rawName: `${first} ${secondary.name} Attunement`,
        canonicalSkillId: ELEMENTALIST_ATTUNEMENT_SKILL_IDS[primary.name],
        canonicalName: `${primary.name} Attunement`,
        isSwap: true
      }
    };
  })
);

/** Ports EI's Weaver buff transformation for cast inference without mutating the raw log or inventing missing halves. */
export function weaverAttunementEvents({
  log,
  playerAddress,
  evidence
}: EvtcProfessionReconstructionContext): ReadonlyMap<number, readonly IndexedEvent[]> {
  // Replace only transformed buckets so shared raw evidence remains available to every other finder.
  const eventsBySkill = new Map(evidence.eventsBySkill);
  const modern = Number(log.header.arcdpsBuild) >= 20260501;
  const components = WEAVER_ELEMENTS.flatMap(({ basic, major, minor }, index) => [
    basic,
    major,
    minor,
    WEAVER_ATTUNEMENT_IDS[index][index]
  ]);
  const buffs: (IndexedEvent & { apply: boolean })[] = [];
  for (const id of components) {
    eventsBySkill.set(
      id,
      (eventsBySkill.get(id) ?? []).filter(({ event, eventIndex }) => {
        const application = isBuffApply(log, event, true);
        const extension = isBuffExtension(log, event);
        const removal = isBuffRemoval(log, event);
        const selected =
          ((application || extension) && event.target === playerAddress) || (removal && event.source === playerAddress);

        if (selected) buffs.push({ event, eventIndex, apply: application && !extension });

        // Suppress component buffs even when incomplete, just as EI invalidates the original attunement events.
        return !selected;
      })
    );
  }

  const groups: (typeof buffs)[] = [];
  for (const buff of buffs.sort((a, b) => a.event.time - b.event.time || a.eventIndex - b.eventIndex)) {
    const last = groups.at(-1);

    // EI GroupByTime uses a strict 10 ms window anchored at the group's first event, including removals/extensions.
    if (last && buff.event.time - last[0].event.time < 10) last.push(buff);
    else groups.push([buff]);
  }

  const syntheticBySkill = new Map<number, IndexedEvent[]>();
  for (const group of groups) {
    const applies = group.filter(({ apply }) => apply);
    let primary = -1;
    let secondary = -1;
    let id = 0;
    const loneBasic =
      applies.length === 1 ? WEAVER_ELEMENTS.findIndex(({ basic }) => basic === applies[0].event.skillId) : -1;

    if (loneBasic >= 0) id = WEAVER_ATTUNEMENT_IDS[loneBasic][loneBasic];
    else {
      for (const { event } of applies) {
        if (attunementIds.has(event.skillId)) {
          id = event.skillId;
          break;
        }

        const major = WEAVER_ELEMENTS.findIndex(
          ({ basic, major }) => event.skillId === basic || event.skillId === major
        );
        const minor = WEAVER_ELEMENTS.findIndex(({ minor }) => event.skillId === minor);

        if (major >= 0) primary = major;
        else if (minor >= 0) secondary = minor;
      }

      if (!id && primary >= 0 && secondary >= 0) id = WEAVER_ATTUNEMENT_IDS[primary][secondary];
    }

    if (!id) continue;

    // EI creates non-initial applications even from snapshots. Previous-state removals have no cast-finder consumer.
    const synthetic = {
      eventIndex: group[0].eventIndex,
      event: {
        ...applies[0].event,
        time: group[0].event.time,
        source: playerAddress,
        target: playerAddress,
        skillId: id,
        stateChange: modern ? 69 : 0,
        buff: 1,
        value: 2147483647,
        buffDamage: 0,
        activation: 0,
        buffRemove: 0,
        offcycle: 0
      }
    };
    const syntheticEvents = syntheticBySkill.get(id) ?? [];
    syntheticEvents.push(synthetic);
    syntheticBySkill.set(id, syntheticEvents);
  }

  // Append each synthetic bucket once so repeated attunements do not repeatedly copy a growing array.
  for (const [id, syntheticEvents] of syntheticBySkill) {
    eventsBySkill.set(id, [...(eventsBySkill.get(id) ?? []), ...syntheticEvents]);
  }

  return eventsBySkill;
}
