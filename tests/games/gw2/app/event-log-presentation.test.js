import assert from 'node:assert/strict';
import test from 'node:test';

import { renderEventLog, simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { effectFields } from '#tests/helpers/effect-report.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { eventLogCsv, mountEventLog } from '#ui/results/event-log.js';

// Deferred logs must not read simulation events until opened, and opening must use only the latest result.
test('collapsed event logs prepare nothing until opened, then use the latest result', (t) => {
  let html = '';
  let details = null;
  const summary = { textContent: 'Event Log' };
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      details = value ? { open: value.includes('event-log-details" open'), querySelector: () => summary } : null;
    },
    querySelector: (selector) => (selector === '[data-role="event-log-details"]' ? details : null),
    querySelectorAll: () => []
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { activeElement: null, getElementById: () => container }
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  const superseded = {
    get events() {
      return assert.fail('Superseded results must never be prepared');
    }
  };
  const app = { build: { rotation: [{ type: 'wait', durationMs: 1000 }] }, profession: {}, results: superseded };
  renderEventLog(app);
  const shell = details;
  app.results = { events: [{ type: 'marker', at: 0, name: 'Latest result' }], resolvedEvents: [] };
  renderEventLog(app);
  assert.equal(details, shell);
  assert.doesNotMatch(html, /Latest result/);

  details.open = true;
  details.ontoggle();
  assert.match(html, /Latest result/);

  // A result published after mounting waits for the next opening and retires the prepared count.
  details.open = false;
  summary.textContent = 'Event Log (1 events)';
  app.results = { events: [{ type: 'marker', at: 0, name: 'New result' }], resolvedEvents: [] };
  renderEventLog(app);
  assert.doesNotMatch(html, /New result/);
  assert.equal(summary.textContent, 'Event Log');

  details.open = true;
  details.ontoggle();
  assert.match(html, /New result/);

  app.build.rotation = [];
  renderEventLog(app);
  assert.equal(html, '');
});

test('event log CSV escapes cells', () => {
  const rows = [{ at: 0, type: 'action', description: 'CAST Quote "skill"' }];

  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
});

// Same-time rows follow activation order, including instant casts and derived hits with different names.
test('event log finishes an activation before the next same-time cast', () => {
  const rows = simulationEventLogRows({
    events: [
      { type: 'action', activationId: 'first', at: 0, endsAt: 0, name: 'Z' },
      { type: 'action', activationId: 'second', at: 0, endsAt: 0, name: 'A' },
      { type: 'action', activationId: 'third', at: 0, endsAt: 1, name: 'Z' },
      { type: 'action', activationId: 'fourth', at: 1, endsAt: 2, name: 'B' },
      { type: 'combat_start', at: 0 }
    ],
    resolvedEvents: [
      { type: 'damage', activationId: 'third', at: 1, name: 'Derived hit', damage: 1 },
      { type: 'damage', activationId: 'fourth', at: 1, name: 'Opening hit', damage: 1 },
      { type: 'damage', activationId: 'first', at: 1.5, name: 'Delayed hit', damage: 1 }
    ]
  });

  assert.deepEqual(
    rows.map(({ at, description }) => [at, description]),
    [
      [0, 'COMBAT START'],
      [0, 'CAST Z (0ms)'],
      [0, 'END Z'],
      [0, 'CAST A (0ms)'],
      [0, 'END A'],
      [0, 'CAST Z (1000ms)'],
      [1, 'HIT Derived hit x1 → 1 damage'],
      [1, 'END Z'],
      [1, 'CAST B (1000ms)'],
      [1, 'HIT Opening hit x1 → 1 damage'],
      [1.5, 'HIT Delayed hit x1 → 1 damage'],
      [2, 'END B']
    ]
  );
});

// A remount keeps the previous search, so only matching rows render with their escaped details.
test('event-log mounting keeps the search, escapes descriptions, and configures filename', () => {
  let html = '';
  let mounted = false;
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      mounted = true;
    },
    querySelector(selector) {
      if (mounted) return null;

      if (selector.includes('event-log-details')) return { open: true };

      if (selector.includes('event-log-search')) return { value: 'safe' };

      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  mountEventLog(
    container,
    [
      { at: 0, type: 'one', description: 'Keep <safe>', details: ['Power <1000>'] },
      { at: 1, type: 'two', description: 'Drop me' }
    ],
    { filename: 'custom"name.csv' }
  );

  assert.match(html, /<details class="log-desc"><summary>Keep &lt;<mark>safe<\/mark>&gt;<\/summary>/);
  assert.match(html, /<li>Power &lt;1000&gt;<\/li>/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /value="safe"/);
});

// Calculations carry authored names, so every field must be escaped and raw facts must stay available to copy.
test('event-log mounting renders calculations with escaped fields and their copy action', () => {
  let html = '';
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
    },
    querySelector: (selector) => (selector.includes('event-log-details') ? { open: true } : null),
    querySelectorAll: () => []
  };
  mountEventLog(container, [
    {
      at: 0,
      type: 'damage',
      description: 'HIT <Full>',
      calculation: {
        heading: 'HIT <Short>',
        meta: '0.000s <meta>',
        steps: [
          { label: 'Base', explanation: '<base>', value: '1', exact: '1.0"' },
          { label: 'Damage', explanation: '<result>', value: '2', exact: '2' }
        ],
        factors: [{ label: '<factor>', value: '×1.1', impact: '−1', exact: '1.1' }],
        effects: ['<effect>', 'Aegis'],
        trace: 'sim <trace>',
        raw: ['Power: <1000>']
      }
    }
  ]);
  assert.match(html, /<details class="log-desc log-calc"><summary><span class="log-calc-heading">HIT &lt;Short&gt;/);
  assert.doesNotMatch(html, /HIT &lt;Full&gt;/);
  assert.match(html, /<span class="log-calc-meta">0\.000s &lt;meta&gt;<\/span>/);
  assert.match(html, /title="1\.0&quot;"/);
  assert.match(html, /<tr class="log-calc-result"><th scope="row">Damage<\/th><td>&lt;result&gt;<\/td>/);
  assert.match(html, /<th scope="row">&lt;factor&gt;<\/th>/);
  assert.match(html, /<div>&lt;effect&gt; · Aegis<\/div>/);
  assert.match(html, /<summary>Trace: sim &lt;trace&gt;<\/summary>/);
  assert.match(html, /<li>Power: &lt;1000&gt;<\/li>/);
  assert.match(html, /data-role="event-log-copy-raw"/);
});

// Calculation details retain captured state and distinguish additive bonuses from multiplicative factors.
test('event log exposes optional damage calculations at full simulation precision', () => {
  const event = {
    type: 'damage',
    at: 0.600001,
    source: 'Player',
    sourceId: 'hit',
    actorType: 'player',
    name: 'Hit',
    flatDamage: 10,
    damage: 10,
    criticalChance: 0
  };
  const result = { events: [], ...effectFields([event], 120) };
  assert.equal(simulationEventLogRows(result)[0].calculation, undefined);
  const damageCalculation = {
    activeBuffs: [
      { kind: 'might', stacks: 25 },
      { kind: 'test-charge', stacks: 2 }
    ],
    phase: 'Ordinary',
    targetHealthBefore: null,
    targetHealthFractionBefore: null,
    power: 1000,
    baseDamage: 10,
    criticalMultiplier: 1,
    outgoingMultiplier: 1.32,
    outgoingContributors: [
      { id: 'additive', label: 'Additive bonus', bucket: 'additive', value: 0.1 },
      { id: 'factor', label: 'Multiplicative bonus', bucket: 'multiplier', value: 1.2 }
    ],
    unroundedDamage: 10,
    rounding: 'floor'
  };
  const profession = { ui: { effectPresentations: () => [{ kind: 'test-charge', name: 'Test Charge' }] } };
  const row = simulationEventLogRows(
    { ...result, ...effectFields([{ ...event, damageCalculation }], 120) },
    null,
    profession
  )[0];
  const { raw } = row.calculation;
  assert.ok(raw.includes('Simulation time: 0.600001s; phase: Ordinary'));
  assert.ok(raw.includes('Target health before: unbounded; fraction: unbounded'));
  assert.ok(raw.includes('Unrounded damage: 10; rounding: floor; damage: 10'));
  assert.ok(!raw.some((detail) => detail.startsWith('Weapon strength:')));
  assert.ok(raw.includes('Active player buffs and boons: Might x25, Test Charge x2'));
  assert.ok(raw.includes('Outgoing additive: Additive bonus +0.1'));
  assert.ok(raw.includes('Outgoing factor: Multiplicative bonus ×1.2'));
  const empty = simulationEventLogRows({
    ...result,
    ...effectFields(
      [{ ...event, damageCalculation: { ...damageCalculation, activeBuffs: [], outgoingContributors: [] } }],
      120
    )
  })[0];
  assert.ok(empty.calculation.raw.includes('Active player buffs and boons: None'));
  assert.ok(
    !empty.calculation.raw.some(
      (detail) => detail.startsWith('Outgoing factor:') || detail.startsWith('Outgoing additive:')
    )
  );
});

// The equation must reconcile by hand: every input to base and crit is named, and modifiers rank by what the hit loses.
test('event log calculation reads as an equation with ranked modifiers and every active effect', () => {
  const event = {
    type: 'damage',
    at: 8,
    source: 'Player',
    sourceId: 'hit',
    actorType: 'player',
    name: 'Hit',
    coefficient: 1.5,
    resolvedWeaponStrength: 1000,
    weaponStrengthProfileId: 'weapon.test',
    activationId: 'cast:9',
    damage: 2520,
    criticalChance: 1,
    criticalDamage: 2.6,
    critEligible: true,
    averagedCriticalDamage: true,
    didCrit: true
  };
  const damageCalculation = {
    activeBuffs: [
      { kind: 'aegis', stacks: 1 },
      { kind: 'might', stacks: 25 },
      { kind: 'test-charge', stacks: 5, name: 'Test Charge' },
      { kind: 'fury', stacks: 1 }
    ],
    phase: 'Ordinary',
    targetHealthBefore: 900,
    targetHealthFractionBefore: 0.9,
    power: 2000,
    ferocity: 600,
    targetArmor: 2500,
    baseDamage: 1200,
    criticalMultiplier: 2.1,
    criticalDamageContributors: [
      { id: 'ferocity', label: 'Ferocity', bucket: 'additive', value: 0.4 },
      { id: 'sigil-severance', label: 'Severance', bucket: 'additive', value: 0.2 }
    ],
    outgoingMultiplier: 1.05,
    outgoingContributors: [
      { id: 'small', label: 'Small', bucket: 'multiplier', value: 1.05 },
      { id: 'large', label: 'Large', bucket: 'multiplier', value: 1.25 },
      { id: 'share', label: 'Share', bucket: 'additive', value: 0.05 },
      { id: 'penalty', label: 'Penalty', bucket: 'multiplier', value: 0.8 }
    ],
    unroundedDamage: 2520.5,
    rounding: 'floor'
  };
  const row = simulationEventLogRows({ events: [], ...effectFields([{ ...event, damageCalculation }], 120) })[0];
  const { calculation } = row;
  assert.deepEqual(
    calculation.steps.map(({ label, explanation }) => [label, explanation]),
    [
      ['Base', '2,000 Power × 1.5 coef × 1,000 weapon ÷ 2,500 armor'],
      ['Crit', '100% · 1.5 + 600 Fero/1500 + 0.200 Severance'],
      ['Outgoing', '4 modifiers'],
      ['Damage', '2,520.50, floored']
    ]
  );
  assert.deepEqual(
    calculation.steps.map(({ value }) => value),
    ['1,200.00', '× 2.100', '× 1.050', '2,520']
  );
  assert.equal(calculation.heading, 'HIT Hit → 2,520');
  assert.equal(calculation.meta, `${row.at.toFixed(3)}s · target 90% HP`);
  // Removing a penalty raises damage; additive entries take only their share of the (1 + Σ) factor.
  assert.deepEqual(
    calculation.factors.map(({ label, value, impact }) => [label, value, impact]),
    [
      ['Penalty', '×0.8', '+630'],
      ['Large', '×1.25', '−504'],
      ['Small', '×1.05', '−120'],
      ['Share', '+5% add.', '−120']
    ]
  );
  assert.deepEqual(calculation.effects, ['Might 25', 'Fury', 'Test Charge 5', 'Aegis']);
  assert.equal(calculation.trace, 'sim 8.000s · cast:9 · Ordinary');
  assert.ok(calculation.raw.includes('Target armor: 2500'));
  assert.ok(calculation.raw.includes('Critical damage additive: Severance +0.2'));
});

// An averaged multiplier differs from the multiplier on a crit, so the two critical modes must read differently.
test('event log calculation names the critical outcome and packets that skip armor', () => {
  const crit = (fields, damageCalculation = {}) => {
    const event = {
      type: 'damage',
      at: 1,
      source: 'Player',
      sourceId: 'hit',
      actorType: 'player',
      name: 'Hit',
      coefficient: 1,
      resolvedWeaponStrength: 1000,
      damage: 100,
      criticalChance: 0.5,
      criticalDamage: 2,
      critEligible: true,
      ...fields
    };
    return simulationEventLogRows({
      events: [],
      ...effectFields(
        [
          {
            ...event,
            damageCalculation: {
              activeBuffs: [],
              phase: 'Ordinary',
              targetHealthBefore: null,
              targetHealthFractionBefore: null,
              power: 1000,
              ferocity: 750,
              targetArmor: 1000,
              baseDamage: 100,
              criticalMultiplier: 1,
              criticalDamageContributors: [
                { id: 'ferocity', label: 'Ferocity', bucket: 'additive', value: 0.5 },
                { id: 'keen', label: 'Keen', bucket: 'multiplier', value: 1.1 }
              ],
              outgoingMultiplier: 1,
              unroundedDamage: 100,
              rounding: 'floor',
              ...damageCalculation
            }
          }
        ],
        120
      )
    })[0].calculation.steps;
  };

  const explanation = (steps, label) => steps.find((step) => step.label === label).explanation;
  const formula = '(1.5 + 750 Fero/1500) × 1.1 Keen';
  assert.equal(explanation(crit({ averagedCriticalDamage: true }), 'Crit'), `50%, averaged · ${formula} on crit`);
  assert.equal(explanation(crit({ didCrit: true }), 'Crit'), `Rolled crit at 50% · ${formula}`);
  assert.equal(explanation(crit({ didCrit: false }), 'Crit'), 'Rolled no crit at 50%');
  assert.equal(explanation(crit({ critEligible: false }), 'Crit'), 'Cannot crit');
  // Authored summon crit damage has no Ferocity steps to show, and the formula must not invent them.
  assert.equal(
    explanation(crit({ averagedCriticalDamage: true }, { criticalDamageContributors: undefined }), 'Crit'),
    '50%, averaged · ×2 authored on crit'
  );
  const fixed = crit({ coefficient: undefined, resolvedWeaponStrength: undefined }, { targetArmor: undefined });
  assert.equal(explanation(fixed, 'Base'), 'Fixed packet');
  assert.equal(explanation(fixed, 'Outgoing'), 'No modifiers');
  // A health gate can clamp the packet below its rounded value, which the equation alone cannot explain.
  assert.equal(explanation(crit({ damage: 40 }), 'Damage'), '100.00, floored, limited by health gate');
});

test('event log distinguishes phantasm summon, attack, and clone conversion', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const log = simulationEventLogRows(result, null, withPatchPreview(mesmerProfession));

  assert.ok(
    log.some(
      (event) => Math.abs(event.at - 0.56) < 0.00001 && event.description === 'PHANTASM SUMMONED Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 2.8) < 0.00001 && event.description === 'PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 3.36) < 0.00001 &&
        event.description.includes('CLONE SPAWNED x1') &&
        event.description.includes('Phantasmal Duelist phantasm conversion')
    )
  );
  assert.match(eventLogCsv(log), /Phantasmal Duelist phantasm conversion/);
});
