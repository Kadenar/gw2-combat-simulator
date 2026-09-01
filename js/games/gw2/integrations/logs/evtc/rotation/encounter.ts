import { EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';

/** Returns the earliest death or combat-exit timestamp among agents identified as encounter targets. */
export function encounterEndTime(log: ParsedEvtc): number | null {
  const targets = new Set(
    log.agents.filter((agent) => agent.profession === log.header.encounterId).map((agent) => agent.address)
  );
  const times = log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}
