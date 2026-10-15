import { isStandardBoon, recordBuffApplication, type Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

/** Live effects belong to one companion lifetime; reporting histories live outside this disposable store. */
export interface CompanionEffects {
  boons: Map<string, Gw2TimedBuffApplication[]>;
  buffs: Map<string, Gw2TimedBuffApplication[]>;
}

export function createCompanionEffects(): CompanionEffects {
  return { boons: new Map(), buffs: new Map() };
}

/** Fan an accepted grant out to independent live recipients without duplicating the reporting event. */
export function recordCompanionBuff(companions: Map<string, CompanionEffects>, event: SimulationEvent): void {
  const audience = event.resolvedAudience;
  if (!audience) throw new TypeError('Companion grants require resolved recipients.');
  for (const id of audience.companionIds) {
    let effects = companions.get(id);
    if (!effects) {
      effects = createCompanionEffects();
      companions.set(id, effects);
    }

    recordBuffApplication(isStandardBoon(event.kind) ? effects.boons : effects.buffs, {
      ...event,
      resolvedAudience: {
        ...audience,
        includesSelf: false,
        includesSummons: true,
        alliedPlayerCount: 0,
        companionIds: [id],
        recipientCount: 1
      }
    });
  }
}
