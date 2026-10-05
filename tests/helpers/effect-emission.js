import { isStandardBoon, recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';

/** Isolate mechanic payload decisions while using the real shared profile expansion and submission contract. */
export function captureEffectEmissions({ now = () => 0, submit, announce } = {}) {
  const events = [];
  const announcements = [];
  const effects = createEffectEmissionService({
    now,
    registerReaction: () => undefined,
    submit(event, delivery) {
      events.push(event);
      return submit ? submit(event, delivery) : event;
    },
    announce(request) {
      announcements.push(request);
      return announce ? announce(request) : { type: 'proc', ...request.attribution, ...request.announcement };
    }
  });
  return { effects, events, announcements };
}

/** Direct hook fixtures explicitly accept emitted buffs, keeping modifier queries independent of private timers. */
export function captureAcceptedBuffEmissions() {
  const boons = new Map();
  const buffs = new Map();
  return {
    boons,
    buffs,
    ...captureEffectEmissions({
      submit(event) {
        if (event.type === 'buff')
          recordBuffApplication(isStandardBoon(event.kind) ? boons : buffs, {
            ...event,
            resolvedAudience: gw2BuffApplicationRecipients({}, event)
          });
        return event;
      }
    })
  };
}
