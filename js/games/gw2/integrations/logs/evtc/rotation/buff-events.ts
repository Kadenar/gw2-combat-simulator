import type { ParsedEvtc, ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';

/** Legacy offcycle extensions share the application record shape. */
function isLegacyBuffApplication(event: ParsedEvtcEvent): boolean {
  return (
    event.stateChange === 0 &&
    event.buff !== 0 &&
    event.buffDamage === 0 &&
    event.value > 0 &&
    event.activation === 0 &&
    event.buffRemove === 0
  );
}

/** EI BuffGainCastFinder excludes snapshots and extensions; custom animated finders opt into snapshots explicitly. */
export function isBuffApply(log: ParsedEvtc, event: ParsedEvtcEvent, initial = false): boolean {
  const modern = Number(log.header.arcdpsBuild) >= 20260501;

  // EI CombatEventFactory classifies legacy offcycle records as extensions, never BuffApplyEvent evidence.
  if (!modern && event.offcycle > 0) return false;

  if (event.stateChange === 18) return initial;

  return modern ? event.stateChange === 69 : isLegacyBuffApplication(event);
}

export function isBuffRemoveAll(log: ParsedEvtc, event: ParsedEvtcEvent): boolean {
  return Number(log.header.arcdpsBuild) >= 20260501
    ? event.stateChange === 72
    : event.stateChange === 0 && event.activation === 0 && event.buffRemove === 1;
}

/** Any stack removal, single or all, ends a nonstacking buff and can anchor a buff-event group. */
export function isBuffRemoval(log: ParsedEvtc, event: ParsedEvtcEvent): boolean {
  return Number(log.header.arcdpsBuild) >= 20260501
    ? event.stateChange === 71 || event.stateChange === 72
    : event.stateChange === 0 && event.activation === 0 && event.buffRemove !== 0;
}

/** Extensions can anchor a group of buff events without counting as fresh applications. */
export function isBuffExtension(log: ParsedEvtc, event: ParsedEvtcEvent): boolean {
  return Number(log.header.arcdpsBuild) >= 20260501
    ? event.stateChange === 70
    : isLegacyBuffApplication(event) && event.offcycle > 0;
}
