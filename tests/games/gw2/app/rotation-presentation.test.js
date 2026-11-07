import assert from 'node:assert/strict';
import test from 'node:test';

import { timelineIdleTimeMetric } from '#gw2/app/results/idle-time-metric.js';
import {
  activationCombatStartRelation,
  suggestedActivationInterruptMs,
  validateActivationConcurrentOffsetMs,
  validateActivationInterruptMs
} from '#gw2/app/rotation/editing/activation-editor.js';
import { rotationObservations } from '#gw2/app/rotation/insights/rotation-observations.js';
import { bindPaletteInteractions } from '#gw2/app/rotation/palette/interactions.js';
import { paletteGroupHtml, paletteSkillHtml } from '#gw2/app/rotation/palette/view.js';
import { targetHealthTimelineMarkers } from '#gw2/app/rotation/timeline/encounter.js';
import { bindTimelineInteractions, getSkillDropInsertionIndex } from '#gw2/app/rotation/timeline/interactions.js';
import {
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  rotationEntryName,
  rotationSkillHighlightKey,
  timelineDeadTimeMarkers,
  timelineImpactOffsets,
  timelineSkillCastOrdinals,
  timelineTargetImpactDetails,
  timelineWeaponRowGroups,
  timelineWeaponRows
} from '#gw2/app/rotation/timeline/model.js';
import { presentedTimelineSteps } from '#gw2/app/rotation/timeline/occupancy.js';
import { createEngineerBuildDefaults } from '#gw2/professions/engineer/build/build.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { professionTimelineSource } from '#tests/helpers/timeline-presentation.js';

// GW2 rotation views preserve editing, palette interactions, and timeline presentation.
test('activation editor suggests and validates manual interruption times', () => {
  assert.equal(suggestedActivationInterruptMs(920, 1200), 880);
  assert.equal(suggestedActivationInterruptMs(null, 500), 480);
  assert.equal(suggestedActivationInterruptMs(0, 0), 40);
  assert.deepEqual(validateActivationInterruptMs('640', 920), {
    valid: true,
    value: 640
  });
  assert.match(validateActivationInterruptMs('640.4', 920).error, /whole-millisecond/);
  assert.match(validateActivationInterruptMs('620', 920).error, /divisible by 40 ms/);
  assert.match(validateActivationInterruptMs('630', 920).error, /divisible by 40 ms/);
  assert.equal(validateActivationInterruptMs(20, 920).valid, false);
  assert.equal(validateActivationInterruptMs('', 920).valid, false);
  assert.equal(validateActivationInterruptMs(0, 920).valid, false);
  assert.deepEqual(validateActivationInterruptMs(920, 920), { valid: true, value: 920 });
  assert.match(validateActivationInterruptMs(657, 657).error, /divisible by 40 ms/);
  assert.equal(validateActivationInterruptMs(921, 920).valid, false);
  assert.deepEqual(validateActivationConcurrentOffsetMs(0), { valid: true, value: 0 });
  assert.deepEqual(validateActivationConcurrentOffsetMs(120), { valid: true, value: 120 });
  assert.match(validateActivationConcurrentOffsetMs('100.4').error, /divisible by 40 ms/);
  assert.match(validateActivationConcurrentOffsetMs(100).error, /divisible by 40 ms/);
  assert.deepEqual(validateActivationConcurrentOffsetMs(-440, null), { valid: true, value: -440 });
  assert.match(validateActivationConcurrentOffsetMs(681, null).error, /divisible by 40 ms/);
  assert.match(validateActivationConcurrentOffsetMs(-441, null).error, /divisible by 40 ms/);
  assert.match(validateActivationConcurrentOffsetMs('681.5', null).error, /divisible by 40 ms/);
  assert.equal(validateActivationConcurrentOffsetMs('').valid, false);
  assert.equal(validateActivationConcurrentOffsetMs(-1).valid, false);
});

test('target impact details preserve precombat applications and distinguish separate activations', () => {
  // Scheduled applications remain inspectable even when combat gating omits them from resolved damage.
  const details = timelineTargetImpactDetails(
    [
      { activationId: 'first', start: 1000, end: 2000 },
      { activationId: 'second', start: 3000, end: 3500 },
      { activationId: 'buff-only', start: 4000, end: 4000 },
      { activationId: 'invalid', start: 5000, end: 5500, invalid: true }
    ],
    [
      { activationId: 'first', type: 'damage', at: 1.8 },
      { activationId: 'first', type: 'condition', condition: 'Burning', at: 1.3, eventOrder: 2, causalOrder: 2 },
      // An explicit parent marks derived proc work; causal placement alone also belongs to ordinary live packets.
      {
        activationId: 'first',
        type: 'condition',
        condition: 'Burning',
        at: 1.1,
        eventOrder: 3,
        causalOrder: 1,
        parentEventOrder: 1
      },
      { activationId: 'first', type: 'damage', at: 1.1, cancelled: true },
      { activationId: 'second', type: 'damage', at: 3.6, offTarget: true },
      { activationId: 'buff-only', type: 'buff', at: 4 },
      { activationId: 'invalid', type: 'damage', at: 5.2 }
    ]
  );
  assert.equal(details.get('first'), 'First hit: 300 ms');
  assert.equal(details.get('second'), 'First hit: 600 ms');
  assert.equal(details.has('buff-only'), false);
  assert.equal(details.has('invalid'), false);
});

// Precombat debuffs can miss without implying that a later damaging hit is lost.
test('activation hit counts exclude non-damaging debuffs and control applications', () => {
  const activationId = 'cast';
  const offsets = timelineImpactOffsets(
    [{ activationId, start: 0, end: 400 }],
    [
      { activationId, type: 'condition', condition: 'Vulnerability', at: 0.4 },
      { activationId, type: 'condition', condition: 'Crippled', at: 0.5 },
      { activationId, type: 'control', controlKind: 'daze', at: 0.6 },
      { activationId, type: 'condition', condition: 'Blindness', stacks: 1, duration: 3, at: 0.7 },
      { activationId, type: 'damage', at: 1 },
      { activationId, type: 'condition', condition: 'Bleeding', at: 1 },
      { activationId, type: 'damage', at: 2 }
    ]
  ).get(activationId);
  assert.deepEqual(offsets, [1000, 2000]);
  assert.deepEqual(activationCombatStartRelation(offsets, 800), {
    text: 'Lands 200 ms after Combat Start',
    missedHits: 0
  });
});

// A cast-triggered proc credited to another skill is not a hit of the cast, so a cast that only triggers one has none.
test('activation hit counts exclude cast-triggered procs credited to another skill', () => {
  const offsets = timelineImpactOffsets(
    [
      { activationId: 'trigger', skillId: 62803, start: 1000, end: 1000 },
      { activationId: 'burst', skillId: 14354, start: 2000, end: 2400 }
    ],
    [
      { activationId: 'trigger', source: 'Trait', skillId: 62847, type: 'damage', at: 1 },
      { activationId: 'burst', source: 'warrior', skillId: 14354, type: 'damage', at: 2.3 },
      // Trait effects credited to the cast's own skill remain hits of that skill.
      { activationId: 'burst', source: 'Trait', skillId: 14354, type: 'condition', condition: 'Burning', at: 2.4 },
      { activationId: 'burst', source: 'Relic', skillId: 70000, type: 'condition', condition: 'Torment', at: 2.5 }
    ]
  );
  assert.equal(offsets.has('trigger'), false);
  assert.deepEqual(offsets.get('burst'), [300, 400]);
});

test('timeline dead time includes explicit waits and excludes concurrent casts and gap-fill attacks', () => {
  const markers = timelineDeadTimeMarkers([
    { rotationCommandIndex: 0, skillName: 'Long Cast', start: 0, end: 1000 },
    { rotationCommandIndex: 1, skillName: 'Instant Cast', start: 200, end: 200 },
    { rotationCommandIndex: 2, skillName: 'Wait', start: 1000, end: 1400, type: 'wait' },
    { rotationCommandIndex: 3, skillName: 'Next Cast', start: 1400, end: 1800 },
    {
      rotationCommandIndex: 4,
      skillName: 'Gap-filled Cast',
      start: 2000,
      end: 2400,
      partialFill: { startMs: 1800, durationMs: 150 }
    },
    {
      rotationCommandIndex: 5,
      skillName: 'Invalid Cast',
      start: 3000,
      end: 3200,
      invalid: true
    }
  ]);

  assert.deepEqual(markers, [
    { insertionIndex: 2, start: 1000, end: 1400, durationMs: 400, reason: 'explicit-wait' },
    { insertionIndex: 4, start: 1950, end: 2000, durationMs: 50 }
  ]);
  assert.equal(formatTimelineDuration(400), '400ms');
  assert.equal(formatTimelineDuration(1000), '1s');
  assert.equal(formatTimelineDuration(1250), '1.25s');
  assert.equal(formatTimelineDuration(12_500), '12.5s');
  assert.equal(formatTimelineDuration(100_000), '100s');
});

test('Dragon Trigger excludes only its charge window from timeline gaps and total idle time', () => {
  const source = professionTimelineSource(warriorProfession, 'Bladesworn');
  source.ui = {
    ...source.ui,
    timelineAnnotation: () => {
      throw new Error('Occupancy consumers must not prepare row labels without an authored entry.');
    }
  };
  // Exercise early release, exact full charge, and overholding from a nonzero entry timestamp.
  for (const maximumChargingSeconds of [1.2, 2.48]) {
    for (const chargingSeconds of [0.5, maximumChargingSeconds, maximumChargingSeconds + 0.8]) {
      const start = Math.round(1000 + chargingSeconds * 1000);
      const result = {
        steps: [
          { rotationCommandIndex: 0, skillName: 'Dragon Trigger', start: 1000, end: 1000 },
          {
            rotationCommandIndex: 1,
            skillName: 'Dragon Slash',
            skillId: 62797,
            activationId: 'slash',
            start,
            end: start + 500
          }
        ],
        events: [
          {
            type: 'resource',
            reason: 'profession mechanic',
            activationId: 'slash',
            resource: 'dragon charges',
            chargingSeconds,
            maximumChargingSeconds
          }
        ],
        dpsStartTime: 0,
        effectReport: null,
        resolvedEvents: []
      };
      const markers = timelineDeadTimeMarkers(presentedTimelineSteps(result, source));
      const overheld = chargingSeconds > maximumChargingSeconds;
      const observations = rotationObservations(result, (start + 500) / 1000, source);
      assert.ok(Math.abs((observations.idle.get('gap') ?? 0) - (overheld ? 0.8 : 0)) < 1e-9);
      assert.deepEqual(
        markers,
        overheld
          ? [{ insertionIndex: 1, start: 1000 + maximumChargingSeconds * 1000, end: start, durationMs: 800 }]
          : []
      );
      assert.equal(timelineIdleTimeMetric(result, source).value, overheld ? '800ms' : '0ms');
    }
  }
});

test('timeline dead time precedes simultaneous instant and non-instant casts', () => {
  const markers = timelineDeadTimeMarkers([
    { rotationCommandIndex: 0, skillName: 'Previous Cast', start: 0, end: 1000 },
    { rotationCommandIndex: 1, skillName: 'Instant Cast', start: 1500, end: 1500 },
    { rotationCommandIndex: 2, skillName: 'Following Cast', start: 1500, end: 1900 }
  ]);

  assert.deepEqual(markers, [{ insertionIndex: 1, start: 1000, end: 1500, durationMs: 500 }]);
});

test('timeline overlays suppress wait shapes and retain only excess dead time', () => {
  const markers = timelineDeadTimeMarkers(
    [
      { rotationCommandIndex: 0, skillName: 'First Cast', start: 0, end: 1000 },
      { rotationCommandIndex: 1, skillName: 'Wait', start: 1000, end: 1400, type: 'wait' },
      { rotationCommandIndex: 2, skillName: 'Next Cast', start: 1500, end: 1900 }
    ],
    [],
    { includeExplicitWaits: false }
  );

  assert.deepEqual(markers, [{ insertionIndex: 2, start: 1400, end: 1500, durationMs: 100 }]);
});

test('timeline skill tooltips include matching and global cast ordinals', () => {
  const steps = [
    { rotationCommandIndex: 0, skillName: 'Well of Darkness', start: 1000, end: 1481 },
    { rotationCommandIndex: 1, skillName: 'Wait', start: 1481, end: 2000 },
    { rotationCommandIndex: 2, skillName: 'Nightfall', start: 2000, end: 2750 },
    { rotationCommandIndex: 3, skillName: 'Well of Darkness', start: 3000, end: 3481 },
    { rotationCommandIndex: 4, skillName: 'Well of Darkness', start: 2500, end: 2981 },
    {
      rotationCommandIndex: 5,
      skillName: 'Well of Darkness',
      start: 4000,
      end: 4481,
      invalid: true
    }
  ];
  const ordinals = timelineSkillCastOrdinals(steps);

  assert.deepEqual(ordinals.get(4), {
    skillUseNumber: 2,
    skillUseCount: 3,
    rotationCastNumber: 3,
    rotationCastCount: 4
  });
  assert.match(
    formatTimelineSkillTooltip(
      'Well of Darkness',
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
      undefined
    ),
    /Skill use: 2 of 3\nRotation action: 3 of 4$/
  );
  assert.match(
    formatTimelineSkillTooltip(
      'Dragon Slash-Force',
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
      undefined,
      ['Charges reached: 4', 'Time spent charging: 0.750s', 'Flow spent: 10']
    ),
    /Charges reached: 4\nTime spent charging: 0\.750s\nFlow spent: 10$/
  );
  assert.equal(ordinals.has(1), false);
  assert.equal(ordinals.has(5), false);
});

test('palette primitives escape values and render state, ammo, cooldowns, and groups', () => {
  const html = paletteSkillHtml({
    name: 'Skill"><bad>',
    skillId: 12345,
    title: 'Title"><bad>',
    icon: 'icon" onerror="bad',
    variantBadge: '<MAX>',
    color: '#abc',
    disabled: true,
    draggable: true,
    cooldownLabel: '<5s',
    ammo: { current: 1, maximum: 2, pips: [true, false] },
    resource: {
      id: 'endurance',
      label: 'Current endurance: 50/100',
      value: 50,
      maximum: 100
    }
  });

  assert.match(html, /pal-disabled/);
  assert.match(html, /draggable="false"/);
  assert.match(html, /aria-disabled="false"/);
  assert.match(html, /aria-label="Title&quot;&gt;&lt;bad&gt;, 1\/2 charges, Cooldown: &lt;5s"/);
  assert.match(paletteSkillHtml({ name: 'Unavailable', contextDisabled: true }), /aria-disabled="true"/);
  assert.match(html, /1\/2/);
  assert.equal((html.match(/pal-ammo-pip filled/g) || []).length, 1);
  assert.match(html, /&lt;5s/);
  assert.match(paletteSkillHtml({ name: 'Missing icon' }), /src="data:image\/svg\+xml/);
  assert.match(html, /data-skill-id="12345"/);
  assert.match(html, /skill-variant-badge pal-variant-badge/);
  assert.match(html, /pal-has-resource/);
  assert.match(html, /data-resource-id="endurance"/);
  assert.match(html, /style="width:50%"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /&lt;MAX&gt;/);
  assert.doesNotMatch(html, /<bad>/);
  assert.doesNotMatch(html, /onerror="bad"/);

  const virtualView = {
    name: 'Wait',
    title: 'Wait',
    icon: 'wait.png'
  };
  assert.match(
    paletteGroupHtml({
      label: '<Group>',
      statusIcon: {
        icon: 'pet.png',
        label: 'Fanged Iboga',
        title: 'Active pet: Fanged Iboga'
      },
      skills: [virtualView]
    }),
    /&lt;Group&gt;/
  );
  assert.match(
    paletteGroupHtml({
      label: 'Pet',
      statusIcon: {
        icon: 'pet.png',
        label: 'Fanged Iboga',
        title: 'Active pet: Fanged Iboga'
      },
      skills: [virtualView]
    }),
    /Active pet: Fanged Iboga/
  );
  assert.match(
    paletteGroupHtml({
      id: 'resource-controls',
      label: 'Resource',
      controls: [
        {
          id: 'resource"><bad>',
          label: 'Resource control',
          icon: 'resource.png',
          color: '#abc',
          className: 'resource-control',
          active: true,
          pressed: true,
          muted: true,
          badge: 'S'
        }
      ]
    }),
    /data-palette-group="resource-controls"[\s\S]*class="pal-control resource-control pal-control-active pal-control-pressed pal-control-muted"[\s\S]*data-palette-control-id="resource&quot;&gt;&lt;bad&gt;"[\s\S]*class="pal-control-badge"/
  );
});

test('palette controls delegate neutral control identities', () => {
  const control = {
    dataset: { paletteControlId: 'profession-resource:one' },
    onclick: null
  };
  let activated = '';

  bindPaletteInteractions(
    {
      querySelectorAll(selector) {
        return selector === '.pal-control[data-palette-control-id]' ? [control] : [];
      }
    },
    {
      onControlActivate(id) {
        activated = id;
      }
    }
  );

  control.onclick({});
  assert.equal(activated, 'profession-resource:one');
});

// Cooldown styling must not block queueing, and only real pointer clicks relinquish keyboard focus.
test('palette activation distinguishes context restrictions and pointer focus', () => {
  const calls = [];
  let contextDisabled = false;
  const icon = {
    dataset: { skill: 'Recharge' },
    getAttribute: (name) => (name === 'aria-disabled' ? String(contextDisabled) : 'false'),
    blur: () => calls.push('blur')
  };
  bindPaletteInteractions(
    {
      querySelectorAll: (selector) => (selector === '.pal-skill[data-skill]' ? [icon] : [])
    },
    { onActivate: (name) => calls.push(name) }
  );
  icon.onclick({ detail: 1 });
  assert.deepEqual(calls.splice(0), ['blur', 'Recharge']);
  icon.onclick({ detail: 0 });
  assert.deepEqual(calls.splice(0), ['Recharge']);
  contextDisabled = true;
  icon.onclick({ detail: 0 });
  assert.deepEqual(calls, []);
  contextDisabled = false;
  for (const key of ['Enter', ' ']) {
    let consumed = false;
    icon.onkeydown({
      key,
      ctrlKey: true,
      preventDefault: () => {
        consumed = true;
      }
    });
    assert.equal(consumed, true);
    assert.deepEqual(calls.splice(0), ['Recharge']);
  }
});

// Rebound native buttons must cancel repeat defaults while preserving the first activation of each press.
test('palette and timeline removal suppress repeated native activation keys', () => {
  const icon = { dataset: { skill: 'Skill' }, getAttribute: () => 'false' };
  const control = { dataset: { paletteControlId: 'control' } };
  bindPaletteInteractions({
    querySelectorAll: (selector) =>
      selector === '.pal-skill[data-skill]'
        ? [icon]
        : selector === '.pal-control[data-palette-control-id]'
          ? [control]
          : []
  });
  const remove = { setAttribute() {} };
  const item = { dataset: { idx: '0' }, querySelector: (selector) => (selector === '.rot-x' ? remove : null) };
  bindTimelineInteractions(
    {
      querySelectorAll: (selector) => (selector === '.rot-skill[data-idx]:not(.rot-injected)' ? [item] : [])
    },
    {
      rotation: [],
      getDragState: () => null,
      setDragState() {},
      moveEntry: () => false,
      onPaletteDrop() {}
    }
  );
  for (const [handler, target] of [
    [icon.onkeydown, icon],
    [control.onkeydown, control],
    [item.onkeydown, remove]
  ]) {
    for (const key of ['Enter', ' ', 'ArrowDown']) {
      for (const repeat of [false, true]) {
        let prevented = false;
        handler({
          key,
          repeat,
          target,
          preventDefault: () => {
            prevented = true;
          }
        });
        assert.equal(prevented, repeat && key !== 'ArrowDown', `${key}, repeat=${repeat}`);
      }
    }
  }
});

test('palette disclosures restore and persist their visibility', () => {
  const writes = [];
  const disclosure = {
    dataset: { paletteStorageKey: 'palette-panel-open' },
    open: true,
    ontoggle: null
  };

  bindPaletteInteractions({
    ownerDocument: {
      defaultView: {
        localStorage: {
          getItem: () => 'false',
          setItem: (key, value) => writes.push([key, value])
        }
      }
    },
    querySelectorAll(selector) {
      return selector === 'details[data-palette-storage-key]' ? [disclosure] : [];
    }
  });

  assert.equal(disclosure.open, false);
  disclosure.open = true;
  disclosure.ontoggle();
  assert.deepEqual(writes, [['palette-panel-open', 'true']]);
});

test('timeline canonical entries expose stable presentation names', () => {
  assert.equal(rotationEntryName({ type: 'cast', skillId: 'One' }), 'One');
  assert.equal(rotationEntryName({ type: 'wait', durationMs: 50 }), '__wait');
});

test('timeline binding forwards palette drops and drop positions use tile halves', (t) => {
  // Drive the registered drop handler through an insertion gap, as the browser does.
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  class DropTarget {
    closest(selector) {
      return selector === '.rot-insertion-gap' ? { dataset: { insertionIndex: '1' } } : null;
    }
  }
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: DropTarget });
  t.after(() => {
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement);
    else delete globalThis.Element;
  });
  const drop = () => root.ondrop({ target: new DropTarget(), preventDefault() {}, stopPropagation() {} });
  const dragged = { source: 'palette', name: 'New', skillId: 12345 };
  let dragState = dragged;
  let current = true;
  const drops = [];
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll: () => []
  };
  bindTimelineInteractions(root, {
    rotation: [{ type: 'cast', skillId: 'A' }],
    canInteract: () => current,
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    moveEntry: () => assert.fail('A palette drop must not reorder the timeline'),
    onPaletteDrop(name, drag, index) {
      assert.equal(dragState, null);
      drops.push({ name, drag, index });
    }
  });
  drop();
  assert.deepEqual(drops, [{ name: 'New', drag: dragged, index: 1 }]);
  current = false;
  dragState = dragged;
  drop();
  assert.equal(drops.length, 1);
  assert.equal(dragState, null);

  const tile = {
    dataset: { idx: '3' },
    getBoundingClientRect: () => ({ left: 10, width: 40 })
  };

  assert.equal(getSkillDropInsertionIndex(tile, 20), 3);
  assert.equal(getSkillDropInsertionIndex(tile, 31), 4);
  assert.equal(getSkillDropInsertionIndex({ dataset: {} }, 0), null);
  assert.equal(getSkillDropInsertionIndex({ dataset: { idx: '' } }, 0), null);
});

test('timeline binding routes the wait pencil to duration editing', () => {
  let editedIndex = null;
  let propagationStopped = false;
  const waitPencil = { dataset: { idx: '2' } };
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll(selector) {
      return selector === '.rot-edit-wait, .rot-wait-badge' ? [waitPencil] : [];
    }
  };

  // The pencil opens the editor without reporting a completed timeline mutation until Apply is used.
  bindTimelineInteractions(root, {
    rotation: [],
    getDragState: () => null,
    setDragState() {},
    moveEntry: () => false,
    onPaletteDrop() {},
    onEditWait(index) {
      editedIndex = index;
    }
  });
  waitPencil.onclick({
    stopPropagation() {
      propagationStopped = true;
    }
  });

  assert.equal(editedIndex, 2);
  assert.equal(propagationStopped, true);
});

test('weapon swaps start new weapon-set rows in the rotation timeline', () => {
  const rows = timelineWeaponRows(
    ['Bladecall', 'Swap Weapons', 'Psycut', 'Swap Weapons', 'Bladecall'].map((skillId) => ({
      type: 'cast',
      skillId
    }))
  );

  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1, 2, 1]
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
  assert.deepEqual(
    timelineWeaponRowGroups(rows).map((group) => [group.weaponSet, group.rows.length]),
    [
      [1, 1],
      [2, 1],
      [1, 1]
    ]
  );
});

test('shroud and forge transitions start a new row on the current weapon set', () => {
  for (const [profession, specialization, enter, exit] of [
    [revenantProfession, 'Core', 'Swap Legends', 'Swap Legends'],
    [necromancerProfession, 'Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"],
    [necromancerProfession, 'Harbinger', 'Harbinger Shroud', 'Exit Harbinger Shroud'],
    [necromancerProfession, 'Ritualist', "Ritualist's Shroud", "Exit Ritualist's Shroud"],
    [thiefProfession, 'Specter', 'Enter Shadow Shroud', 'Exit Shadow Shroud'],
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 'Exit Radiant Forge']
  ]) {
    const rows = timelineWeaponRows(
      ['Before', enter, 'During', exit, 'After', 'Swap Weapons', 'Other set'].map((skillId) => ({
        type: 'cast',
        skillId
      })),
      {
        startingWeaponSet: 2,
        // Profession transitions retain their boundaries when display names change.
        weaponLineTransition: (entry, current) => {
          const skill = profession.catalog.skills.find((candidate) => candidate.name === entry.skillId);
          return profession.ui.timelineWeaponLineTransition({
            specialization,
            ...current,
            skill: skill && { ...skill, name: 'Renamed action' }
          });
        }
      }
    );

    assert.deepEqual(
      rows.map((row) => row.weaponSet),
      [2, 2, 2, 1],
      enter
    );
    assert.deepEqual(
      rows.map((row) => row.skills.map((skill) => skill.index)),
      [[0, 1], [2, 3], [4, 5], [6]],
      enter
    );
    assert.deepEqual(
      timelineWeaponRowGroups(rows).map((group) => [group.weaponSet, group.rows.length]),
      [
        [2, 3],
        [1, 1]
      ],
      enter
    );
  }
});

test('a final weapon swap remains on its originating weapon-set row', () => {
  const rows = timelineWeaponRows(['Bladecall', 'Swap Weapons'].map((skillId) => ({ type: 'cast', skillId })));

  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1]
  );
  assert.deepEqual(
    rows[0].skills.map((skill) => skill.index),
    [0, 1]
  );
});

test('rotation skill highlights group occurrences by displayed skill', () => {
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: 123 }), 'skill:123');
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: 123, interruptAfterMs: 500 }), 'skill:123');
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: -5 }), 'skill:-5');
});

test('target-health timeline markers are inserted after the crossing hit', () => {
  const result = {
    steps: [
      { rotationCommandIndex: 0, start: 0 },
      { rotationCommandIndex: 1, start: 1000 },
      { rotationCommandIndex: 2, start: 2000 }
    ],
    resolvedEvents: [
      { type: 'damage', at: 0.5, damage: 400 },
      { type: 'damage', at: 1.5, damage: 200 }
    ]
  };

  assert.deepEqual(targetHealthTimelineMarkers(result, 1000, [0.5], 3), [
    {
      insertionIndex: 2,
      healthPercent: 50,
      start: 1500,
      damage: 600
    }
  ]);
  assert.deepEqual(targetHealthTimelineMarkers(result, 1000, [], 3), []);
});

test('Engineer kits register distinct weapon lines in the timeline', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const build = createEngineerBuildDefaults();
  const catalogSkills = adapter.profession.catalog.skills;
  const rotationNames = [
    'Grenade Kit',
    'Shrapnel Grenade',
    'Flamethrower',
    'Flame Blast',
    'Stow Flamethrower',
    'Blunderbuss'
  ];
  const rotation = rotationNames.map((name) => ({
    type: 'cast',
    skillId: catalogSkills.find((skill) => skill.name === name).id
  }));
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    isWeaponSwap: () => false,
    skillName: (entry) => adapter.profession.catalog.skillsById.get(entry.skillId)?.name || '',
    weaponLineTransition(entry, current) {
      const skill = adapter.profession.catalog.skillsById.get(entry.skillId);

      return adapter.profession.ui.timelineWeaponLineTransition({
        entry,
        skill,
        build,
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3, 4], [5]]
  );
  assert.ok(rows.every((row) => row.weaponSet === 1));
});
