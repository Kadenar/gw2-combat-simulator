import { EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';

// EI d7f186c Golem.GetLogOffset: training golems with LogNPCUpdate start at the target's first nonzero damage.
const TRAINING_GOLEMS = new Set([16169, 16202, 16178, 16198, 16177, 16199, 19676, 19645, 16174, 16176]);

/** Separate golem encounter start from initial player combat snapshots without inferring any extra casts. */
export function encounterStartTime(log: ParsedEvtc): number | null {
  if (!TRAINING_GOLEMS.has(log.header.encounterId)) return null;
  const update = log.events.find((event) => event.stateChange === 47);
  if (!update) return null;
  const targets = log.agents.filter((agent) => agent.profession === log.header.encounterId);
  const target = targets.find((agent) => agent.address === update.target) ?? targets[0];
  if (!target) return null;
  const modernDamage = Number(log.header.arcdpsBuild) >= 20260501;
  const firstDamage = log.events.find(
    (event) =>
      (event.source === target.address || event.target === target.address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (modernDamage || (event.activation === 0 && event.buffRemove === 0 && (event.buff === 0 || event.value === 0))) &&
      (event.buff === 0 ? event.value > 0 : event.buffDamage > 0)
  );
  return firstDamage?.time ?? null;
}

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
