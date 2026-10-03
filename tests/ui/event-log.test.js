import assert from 'node:assert/strict';
import test from 'node:test';

import { eventLogCsv, mountEventLog } from '#ui/results/event-log.js';
import { inertContainer } from '#tests/helpers/dom.js';

const skill = { id: 'skill', label: 'Skill', badge: false };
const recorded = { kind: 'recorded', label: 'part of' };
const rows = [
  { at: 0, type: 'cast', description: 'CAST Strike (500ms)', id: 'c1', ordinal: 1, span: 0.5, source: skill },
  { at: 0.5, type: 'damage', description: 'HIT Strike', id: 'h1', parentId: 'c1', parentLink: recorded, metric: 10 },
  {
    at: 0.5,
    type: 'trigger',
    description: 'BUFF Might',
    id: 'b1',
    parentId: 'h1',
    parentLink: { kind: 'recorded', label: 'triggered by' },
    source: { id: 'trait', label: 'Trait' },
    tag: { label: 'Might', className: 'trigger' }
  },
  { at: 0.5, type: 'cast_end', description: 'END Strike', parentId: 'c1', layout: 'flat' },
  {
    at: 0.9,
    type: 'damage',
    description: 'HIT Echo',
    id: 'h2',
    parentId: 'c1',
    parentLink: { kind: 'inferred', label: 'inferred from "Strike"' },
    metric: 20
  },
  { at: 1, type: 'condition', description: 'CONDITION Burning', id: 'o1', orphan: true }
];

// A container that reports a prior search so the first mount renders filtered tree rows.
function searchedContainer(query) {
  const container = inertContainer();
  container.querySelector = (selector) => (selector.includes('event-log-search') ? { value: query } : null);
  return container;
}

test('event-log tree nests rows depth first with guides, offsets, and group summaries', () => {
  const container = inertContainer();
  mountEventLog(container, rows, { initiallyOpen: true, metricUnit: ['hit', 'hits'] });
  const html = container.innerHTML;

  assert.match(html, /data-view="tree" aria-pressed="true"/);
  assert.ok(html.indexOf('HIT Strike') < html.indexOf('BUFF Might'));
  assert.ok(html.indexOf('BUFF Might') < html.indexOf('HIT Echo'));
  // The buff sits under a non-last sibling, so its trail continues the cast's trunk.
  assert.match(html, /log-guide log-guide-pipe"><\/span><span class="log-guide log-guide-elbow"/);
  assert.match(html, /log-guide log-guide-elbow log-guide-inferred/);
  assert.match(html, /log-time log-time-offset log-time-late"[^>]*>\+0\.900</);
  assert.match(html, /2 hits · 30/);
  assert.match(html, /log-chip trigger">Might</);
  assert.match(html, /log-badge log-badge-trait">Trait</);
  assert.match(html, /log-badge-orphan[^>]*>No owner</);
  // End markers belong to the chronological layout only, but still count as events.
  assert.doesNotMatch(html, /END Strike/);
  assert.match(html, /\(6 events\)/);
});

test('event-log tree keeps filtered matches under dimmed ancestors', () => {
  const container = searchedContainer('might');
  mountEventLog(container, rows, { initiallyOpen: true });
  const html = container.innerHTML;

  assert.match(html, /BUFF <mark>Might<\/mark>/);
  assert.match(html, /log-tree-root log-dimmed"[^>]*>[\s\S]*CAST Strike/);
  assert.doesNotMatch(html, /HIT Echo/);
  assert.doesNotMatch(html, /CONDITION Burning/);
});

test('event-log rows without parents keep the flat layout and its controls', () => {
  const container = inertContainer();
  mountEventLog(container, [{ at: 0, type: 'cast', description: 'CAST Solo' }], { initiallyOpen: true });

  assert.match(container.innerHTML, /<div class="log-line">/);
  assert.doesNotMatch(container.innerHTML, /data-view=/);
  assert.doesNotMatch(container.innerHTML, /log-trace/);
});

test('event-log CSV exports row and parent ids', () => {
  const csv = eventLogCsv(rows);

  assert.match(csv, /^"Time \(s\)","Type","Event","Id","Parent Id"/);
  assert.match(csv, /"0\.500","damage","HIT Strike","h1","c1"/);
  assert.match(csv, /"0\.000","cast","CAST Strike \(500ms\)","c1",""/);
});
