import { conditionStackLimit } from '#gw2/platform/combat/state/targets.js';
import { EffectRecorder } from '#gw2/platform/results/effect-report.js';
import { observeBuffState, timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { recordBuffApplication, applyBoonExtension, standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import { buildBoonGeneration, projectedPartyEffects } from '#gw2/platform/results/boon-generation.js';

/** Build canonical report fixtures with combat's application helpers; UI tests supply engine policies explicitly. */
export function effectFields(applications = [], end = 120, { policies = [], frames = [], start = 0 } = {}) {
  const recorder = new EffectRecorder();
  const boons = new Map();
  const conditions = new Map();
  const selected = new Map(policies.map((policy) => [policy.kind, policy]));
  const ordered = applications
    .filter((event) => !event.cancelled && event.actorType !== 'environment')
    .toSorted((a, b) => a.at - b.at || (a.causalOrder ?? a.eventOrder ?? 0) - (b.causalOrder ?? b.eventOrder ?? 0));
  const times = [...new Set([0, end, ...ordered.map((event) => event.at), ...frames.map((frame) => frame.at)])]
    .filter((at) => at <= end)
    .sort((a, b) => a - b);
  let index = 0;
  for (const at of times) {
    while (index < ordered.length && ordered[index].at <= at) {
      const event = ordered[index++];
      if (event.type === 'buff') recordBuffApplication(boons, event);
      if (event.type === 'boon_extension') applyBoonExtension(boons, event);
      if (event.type === 'condition') {
        const windows = conditions.get(event.condition) ?? [];
        windows.push({ stacks: event.stacks ?? 1, expiresAt: event.at + event.duration });
        conditions.set(event.condition, windows);
      }
    }

    const states = [...boons].map(([kind, windows]) =>
      observeBuffState(
        kind,
        windows,
        at,
        selected.get(kind) ?? { kind, maximumStacks: standardBoonPresentation(kind)?.maximumStacks }
      )
    );
    for (const [kind, windows] of conditions)
      states.push(
        timedEffectState(kind, windows, conditionStackLimit(kind), {
          category: 'condition',
          recipient: 'target'
        })
      );
    recorder.capture(at, states);
    for (const frame of frames.filter((frame) => frame.at === at)) recorder.capture(at, frame.states, 'fixture');
  }

  const generation = buildBoonGeneration(applications, start, end);
  const report = recorder.finish(end);
  return {
    events: applications,
    resolvedEvents: applications,
    effectReport: { ...report, tracks: [...report.tracks, ...projectedPartyEffects(generation, end).tracks] },
    boonGeneration: { alliedPlayerCount: generation.alliedPlayerCount, boons: Object.fromEntries(generation.boons) }
  };
}
