/**
 * Feed registered player hits and upkeep into the real IO handler, without cast reconstruction or equipment prediction.
 * This diagnoses model disagreement; EVTC registration times and timing candidates are not server-side parent links.
 * Usage after build:modules: node scripts/analysis/audit-impossible-odds.mjs <log.zevtc> [...logs]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { EVTC_STATE_CHANGE as STATE } from '#gw2/integrations/logs/evtc/types.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { handleImpossibleOddsStrike } from '#gw2/professions/revenant/core/traits/index.js';
import { EPSILON } from '#kernel/core/clock.js';

const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Supply one or more EVTC paths; build modules before running this audit.');

for (const path of paths) {
  const bytes = await readFile(path);
  const log = parseEvtc(await decompressEvtcInput(bytes));
  const players = log.agents.filter((agent) => agent.profession === 9);
  if (players.length !== 1) throw new Error(`${path}: expected one Revenant player, found ${players.length}.`);
  const player = players[0];
  const start = log.events.find((e) => e.source === player.address && e.stateChange === STATE.ENTER_COMBAT)?.time;
  if (start == null) throw new Error(`${path}: missing player ENTER_COMBAT.`);
  const names = new Map(log.skills.map((skill) => [skill.id, skill.name]));
  const events = log.events.map((e, index) => ({ ...e, index, atMs: e.time - start }));
  const damage = events.filter(
    (e) => e.source === player.address && e.stateChange === STATE.NONE && !e.buff && !e.activation
  );
  const procs = damage.filter((e) => e.skillId === 49108 && e.value > 0);
  const hits = damage.filter((e) => e.skillId !== 49108 && e.value > 0);
  const upkeep = events.filter(
    (e) =>
      e.target === player.address &&
      e.skillId === 27581 &&
      e.buff &&
      (([STATE.NONE, STATE.BUFF_APPLY, STATE.BUFF_INITIAL].includes(e.stateChange) && !e.buffRemove) ||
        ([STATE.NONE, STATE.BUFF_REMOVE_ALL].includes(e.stateChange) && e.buffRemove === 1))
  );
  const before = (a, b) => a.time < b.time || (a.time === b.time && a.index < b.index);
  const activeAt = (e) => upkeep.filter((b) => before(b, e)).at(-1)?.buffRemove === 0;
  const brief = (e) => ({
    index: e.index,
    rawMs: e.time,
    atMs: e.atMs,
    skillId: e.skillId,
    name: names.get(e.skillId)
  });
  // Keep all 250–310 ms candidates, including removal-time collisions, rather than selecting the nearest hit.
  const rows = procs.map((e) => ({
    ...brief(e),
    candidates: hits
      .filter(
        (h) =>
          h.target === e.target &&
          e.time - h.time >= 250 &&
          e.time - h.time <= 310 &&
          (activeAt(h) || upkeep.some((b) => b.time === h.time && b.buffRemove === 1))
      )
      .map((h) => ({ ...brief(h), delayMs: e.time - h.time, boundaryAmbiguous: !activeAt(h) }))
  }));

  const core = { activeUpkeeps: [], traitProcReadyAt: {} };
  const emitted = [];
  const context = {
    catalog: revenantCatalog,
    profession: { id: 'revenant' },
    state: { profession: { core } },
    epsilon: EPSILON,
    emitDerived(cause, event) {
      const derived = { ...event, causeIndex: cause.eventOrder };
      emitted.push(derived);
      return derived;
    }
  };
  // Replace only inputs to the production handler. Equipment hits are already recorded; do not generate them again.
  const accepted = [];
  for (const hit of [...hits].sort((a, b) => a.time - b.time || a.index - b.index)) {
    core.activeUpkeeps = activeAt(hit) ? [{ skillId: 27107 }] : [];
    const priorCount = emitted.length;
    handleImpossibleOddsStrike(context, {
      at: hit.atMs / 1000,
      payload: {
        event: {
          type: 'damage',
          at: hit.atMs / 1000,
          coefficient: 1,
          eventOrder: hit.index,
          skillName: names.get(hit.skillId)
        }
      }
    });
    if (emitted.length > priorCount) accepted.push(hit);
  }

  assert.equal(accepted.length, emitted.length, 'Each accepted hit must emit exactly one IO strike.');
  const acceptedIndices = new Set(accepted.map((e) => e.index));
  const candidateIndices = new Set(rows.flatMap((row) => row.candidates.map((c) => c.index)));
  const unsupported = accepted.filter((e) => !candidateIndices.has(e.index));
  const unrepresented = rows.filter((row) => !row.candidates.some((c) => acceptedIndices.has(c.index)));
  const interval = revenantCatalog.skillsById.get(27107).triggerIntervalMs;
  const collisions = hits
    .filter((h) => activeAt(h) && rows.some((r) => r.atMs === h.atMs))
    .map((h) => ({
      ...brief(h),
      followupCandidates: rows.filter((r) => r.candidates.some((c) => c.index === h.index)).map((r) => r.atMs)
    }));
  console.log(
    JSON.stringify(
      {
        path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        player: player.character,
        rawCombatStartMs: start,
        intervalMs: interval,
        scope:
          'Positive player direct damage; recorded equipment input; raw upkeep ordering. Registration-time diagnostic, not server causality.',
        summary: {
          logged: procs.length,
          replayed: accepted.length,
          acceptedWithoutObservedCandidate: unsupported.length,
          observedWithoutAcceptedCandidate: unrepresented.length,
          zeroOrNegativeIORecords: damage.filter((e) => e.skillId === 49108 && e.value <= 0).length,
          procsWithoutTimingCandidate: rows.filter((r) => !r.candidates.length).length
        },
        acceptedWithoutObservedCandidate: unsupported.map(brief),
        observedWithoutAcceptedCandidate: unrepresented,
        sameTimestampHits: collisions,
        rows
      },
      null,
      2
    )
  );
}
