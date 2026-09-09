/**
 * Compare source-independent IO update hypotheses against raw hit/upkeep inputs.
 * Observed IO is used only for scoring, never to release a simulated pending strike.
 * Build modules first; run with EVTC paths or --self-check. JSON goes to stdout.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { handleImpossibleOddsStrike } from '#gw2/professions/revenant/core/traits/index.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/timelines.js';
import { EPSILON } from '#kernel/core/clock.js';

const INTERVAL_MS = 250;
const DELAY_MS = 250;
const CANDIDATE_WINDOW_MS = [200, 400];
const before = (a, b) => a.time < b.time || (a.time === b.time && a.index < b.index);
const brief = ({ index, atMs, skillId, name }) => ({ index, atMs, skillId, name });

async function readRecording(path) {
  const bytes = await readFile(path);
  const log = parseEvtc(await decompressEvtcInput(bytes));
  const players = log.agents.filter((a) => a.profession === 9);
  if (players.length !== 1) throw new Error(`${path}: expected one Revenant.`);
  const player = players[0];
  if (player.elite === 79) throw new Error(`${path}: Conduit form-hit eligibility is outside this experiment.`);
  const start = log.events.find((e) => e.source === player.address && e.stateChange === 1)?.time;
  if (start == null) throw new Error(`${path}: missing ENTER_COMBAT.`);
  const names = new Map(log.skills.map((s) => [s.id, s.name]));
  const events = log.events.map((e, index) => ({ ...e, index, atMs: e.time - start, name: names.get(e.skillId) }));
  const upkeep = events.filter(
    (e) =>
      e.target === player.address &&
      e.skillId === 27581 &&
      e.buff &&
      (([0, 18, 69].includes(e.stateChange) && !e.buffRemove) ||
        ([0, 72].includes(e.stateChange) && e.buffRemove === 1))
  );
  const activeAt = (e) => upkeep.filter((b) => before(b, e)).at(-1)?.buffRemove === 0;
  const damage = events.filter(
    (e) => e.source === player.address && e.stateChange === 0 && !e.buff && !e.activation && e.value > 0
  );
  const hits = damage
    .filter((e) => e.skillId !== 49108)
    .map((e) => ({ ...e, active: activeAt(e) }))
    .sort((a, b) => a.time - b.time || a.index - b.index);
  const observed = damage
    .filter((e) => e.skillId === 49108)
    .map((e) => ({
      ...brief(e),
      candidates: hits
        .filter(
          (h) =>
            h.target === e.target &&
            e.time - h.time >= CANDIDATE_WINDOW_MS[0] &&
            e.time - h.time <= CANDIDATE_WINDOW_MS[1] &&
            (h.active || upkeep.some((b) => b.time === h.time && b.buffRemove === 1))
        )
        .map((h) => h.index)
    }));
  return { path, sha256: createHash('sha256').update(bytes).digest('hex'), start, hits, observed };
}

// The model receives no skill names, FPS labels, observed outputs, or per-hit fitted parameters.
function replay(hits, model, quantumMs = 0, phaseMs = 0, cooldownPhaseMs = phaseMs) {
  const up = (at, phase = phaseMs) => (quantumMs ? Math.ceil((at - phase) / quantumMs - 1e-9) * quantumMs + phase : at);
  const down = (at) => (quantumMs ? Math.floor((at - phaseMs) / quantumMs + 1e-9) * quantumMs + phaseMs : at);
  const accepted = [];
  let cooldownAt = -Infinity;
  let pendingAt = -Infinity;
  for (const hit of hits) {
    const at = model.sample === 'ceil' ? up(hit.atMs) : model.sample === 'floor' ? down(hit.atMs) : hit.atMs;
    const ready = model.cooldownUpdate ? up(cooldownAt, cooldownPhaseMs) : cooldownAt;
    // Gate equality only at the modeled update boundary; ordinary 250 ms cooldown equality stays eligible.
    const pending = model.pending && (at < pendingAt - 1e-7 || (model.hitsFirst && Math.abs(at - pendingAt) < 1e-7));
    const cooling =
      at < ready - 1e-7 ||
      (model.cooldownUpdate && (model.cooldownHitsFirst ?? model.hitsFirst) && Math.abs(at - ready) < 1e-7);
    if (!hit.active || cooling || pending) continue;
    cooldownAt = at + INTERVAL_MS;
    const emittedAtMs = model.strikeUpdate ? up(at + DELAY_MS) : at + DELAY_MS;
    pendingAt = emittedAtMs + (model.nextUpdateRelease ? quantumMs : 0);
    accepted.push({ index: hit.index, acceptedAtMs: at, emittedAtMs });
  }

  return accepted;
}

function productionReplay(hits) {
  const core = { activeUpkeeps: [], traitProcReadyAt: {} };
  const accepted = [];
  const context = {
    catalog: revenantCatalog,
    profession: { id: 'revenant' },
    state: { profession: { core } },
    epsilon: EPSILON,
    emitDerived(cause, event) {
      accepted.push({ index: cause.eventOrder, acceptedAtMs: cause.at * 1000, emittedAtMs: event.at * 1000 });
      return event;
    }
  };
  for (const hit of hits) {
    core.activeUpkeeps = hit.active ? [{ skillId: 27107 }] : [];
    handleImpossibleOddsStrike(context, {
      at: hit.atMs / 1000,
      payload: {
        event: {
          type: 'damage',
          at: hit.atMs / 1000,
          coefficient: 1,
          eventOrder: hit.index,
          skillName: hit.name
        }
      }
    });
  }

  return accepted;
}

// Use one-to-one matching so two observed procs cannot both be credited to one accepted hit.
function score(recording, accepted) {
  const acceptedByIndex = new Map(accepted.map((a) => [a.index, a]));
  const owner = new Map();
  function match(rowIndex, seen) {
    for (const hitIndex of recording.observed[rowIndex].candidates) {
      if (!acceptedByIndex.has(hitIndex) || seen.has(hitIndex)) continue;
      seen.add(hitIndex);
      if (!owner.has(hitIndex) || match(owner.get(hitIndex), seen)) {
        owner.set(hitIndex, rowIndex);
        return true;
      }
    }

    return false;
  }

  recording.observed.forEach((_, i) => match(i, new Set()));
  const matchedRows = new Set(owner.values());
  const extra = accepted.filter((a) => !owner.has(a.index)).map((a) => a.index);
  const missing = recording.observed.filter((_, i) => !matchedRows.has(i)).map((r) => r.index);
  const residuals = [...owner]
    .map(([hit, row]) => recording.observed[row].atMs - acceptedByIndex.get(hit).emittedAtMs)
    .sort((a, b) => a - b);
  return {
    accepted: accepted.length,
    matched: owner.size,
    extra: extra.length,
    missing: missing.length,
    disagreements: extra.length + missing.length,
    extraIndices: extra,
    missingIndices: missing,
    residualMs: residuals.length
      ? { min: residuals[0], median: residuals[Math.floor(residuals.length / 2)], max: residuals.at(-1) }
      : null
  };
}

function selfCheck() {
  const hits = [0, 250, 279, 280, 320].map((atMs, index) => ({ atMs, index, active: true }));
  assert.deepEqual(
    replay(hits, {}).map((a) => a.index),
    [0, 1]
  );
  assert.deepEqual(replay(hits, { pending: true }), replay(hits, {}));
  assert.deepEqual(
    replay(hits, { pending: true, strikeUpdate: true }, 40).map((a) => a.index),
    [0, 3]
  );
  assert.deepEqual(
    replay(hits, { pending: true, strikeUpdate: true, hitsFirst: true }, 40).map((a) => a.index),
    [0, 4]
  );
  // Independently phased updates must both clear; equality ordering belongs to each update separately.
  const independent = { pending: true, strikeUpdate: true, cooldownUpdate: true, cooldownHitsFirst: true };
  assert.deepEqual(
    replay(hits, independent, 40, 0, 10).map((a) => a.index),
    [0, 3]
  );
  assert.deepEqual(
    replay(hits, independent, 40, 10, 0).map((a) => a.index),
    [0, 4]
  );
  assert.equal(
    replay(
      [
        { atMs: 0, index: 0, active: true },
        { atMs: 100, index: 1, active: false }
      ],
      { pending: true }
    )[0].emittedAtMs,
    250
  );
  const shared = score(
    {
      observed: [
        { index: 10, atMs: 250, candidates: [0] },
        { index: 11, atMs: 280, candidates: [0] }
      ]
    },
    [{ index: 0, emittedAtMs: 250 }]
  );
  assert.equal(shared.matched, 1);
  assert.equal(shared.missing, 1);
  console.log('Timing boundary, pending lifetime, and one-to-one observation checks passed.');
}

const paths = process.argv.slice(2);
if (paths.length === 1 && paths[0] === '--self-check') {
  selfCheck();
} else {
  if (!paths.length || paths.some((p) => p.startsWith('--'))) throw new Error('Supply EVTC paths or --self-check.');
  const skill = revenantCatalog.skillsById.get(27107);
  assert.equal(skill.triggerIntervalMs, INTERVAL_MS, 'Experiment must retain the production interval.');
  assert.equal(
    effectFirstAtMs(skill.effects.find((e) => e.type === 'strike')),
    DELAY_MS,
    'Experiment must retain the production delay.'
  );
  const recordings = await Promise.all(paths.map(readRecording));
  const production = recordings.map((r) => productionReplay(r.hits));
  // A separate model must reproduce the real handler before its update variants can be interpreted.
  recordings.forEach((r, i) =>
    assert.deepEqual(
      replay(r.hits, {}).map((a) => a.index),
      production[i].map((a) => a.index)
    )
  );
  const models = [
    { id: 'continuous' },
    { id: 'pending-continuous', pending: true },
    ...[false, true].flatMap((hitsFirst) => [
      { id: `pending-update-${hitsFirst ? 'hits' : 'release'}-first`, pending: true, strikeUpdate: true, hitsFirst },
      { id: `cooldown-update-${hitsFirst ? 'hits' : 'release'}-first`, cooldownUpdate: true, hitsFirst },
      {
        id: `sample-ceil-${hitsFirst ? 'hits' : 'release'}-first`,
        sample: 'ceil',
        pending: true,
        strikeUpdate: true,
        hitsFirst
      },
      {
        id: `sample-floor-${hitsFirst ? 'hits' : 'release'}-first`,
        sample: 'floor',
        pending: true,
        strikeUpdate: true,
        hitsFirst
      },
      {
        id: `pending-next-update-${hitsFirst ? 'hits' : 'release'}-first`,
        pending: true,
        strikeUpdate: true,
        nextUpdateRelease: true,
        hitsFirst
      }
    ])
  ];
  const variants = [];
  for (const model of models) {
    for (const quantumMs of model.id.includes('continuous') ? [0] : [10, 20, 40]) {
      // Permit a fixed phase per recording as an optimistic nuisance parameter, not event-specific fitting.
      const phaseScores = recordings.map((r) =>
        Array.from({ length: quantumMs || 1 }, (_, phaseMs) => ({
          phaseMs,
          ...score(r, replay(r.hits, model, quantumMs, phaseMs))
        }))
      );
      const bestPerRecording = phaseScores.map(
        (scores) => [...scores].sort((a, b) => a.disagreements - b.disagreements || a.phaseMs - b.phaseMs)[0]
      );
      variants.push({
        model: model.id,
        quantumMs,
        optimisticDisagreements: bestPerRecording.reduce((sum, s) => sum + s.disagreements, 0),
        bestPerRecording,
        phaseScores
      });
    }
  }

  // Test distinct cooldown/strike phases too, so a shared clock phase cannot cause a false rejection.
  for (const hitsFirst of [false, true]) {
    for (const cooldownHitsFirst of [false, true]) {
      const model = { pending: true, strikeUpdate: true, cooldownUpdate: true, hitsFirst, cooldownHitsFirst };
      for (const quantumMs of [10, 20, 40]) {
        const phaseScores = [];
        const bestPerRecording = recordings.map((r) => {
          const scores = [];
          let best;
          for (let phaseMs = 0; phaseMs < quantumMs; phaseMs++) {
            for (let cooldownPhaseMs = 0; cooldownPhaseMs < quantumMs; cooldownPhaseMs++) {
              const result = score(r, replay(r.hits, model, quantumMs, phaseMs, cooldownPhaseMs));
              scores.push({ phaseMs, cooldownPhaseMs, disagreements: result.disagreements });
              if (!best || result.disagreements < best.disagreements) best = { phaseMs, cooldownPhaseMs, ...result };
            }
          }

          phaseScores.push(scores);
          return best;
        });
        variants.push({
          model: `independent-updates-pending-${hitsFirst ? 'hits' : 'release'}-first-cooldown-${cooldownHitsFirst ? 'hits' : 'release'}-first`,
          quantumMs,
          optimisticDisagreements: bestPerRecording.reduce((sum, s) => sum + s.disagreements, 0),
          bestPerRecording,
          phaseScores
        });
      }
    }
  }

  variants.sort((a, b) => a.optimisticDisagreements - b.optimisticDisagreements);
  console.log(
    JSON.stringify(
      {
        intervalMs: INTERVAL_MS,
        nominalDelayMs: DELAY_MS,
        candidateWindowMs: CANDIDATE_WINDOW_MS,
        scope:
          'Registered player hits and raw upkeep state. Per-recording phase sweep is optimistic fitting, not validation of a hidden clock. No observed IO enters model state.',
        recordings: recordings.map((r, i) => ({
          path: r.path,
          sha256: r.sha256,
          rawCombatStartMs: r.start,
          observed: r.observed,
          hits: r.hits.map((h) => ({ ...brief(h), active: h.active })),
          baseline: score(r, production[i])
        })),
        variants
      },
      null,
      2
    )
  );
}
