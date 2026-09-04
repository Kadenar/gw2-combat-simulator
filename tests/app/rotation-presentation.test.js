import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activationDamageCommitLabel,
  activationDamageCommitMs,
  activationDamageCommitWarning,
  suggestedActivationInterruptMs,
  validateActivationConcurrentOffsetMs,
  validateActivationInterruptMs
} from '#gw2/app/rotation/editing/activation-editor.js';
import { bindPaletteInteractions } from '#gw2/app/rotation/palette/interactions.js';
import { paletteGroupHtml, paletteSkillHtml, virtualPaletteSkillHtml } from '#gw2/app/rotation/palette/view.js';
import { escapeHtml, gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import {
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals
} from '#gw2/app/rotation/timeline/model.js';
import { bindTimelineInteractions, getSkillDropInsertionIndex } from '#gw2/app/rotation/timeline/interactions.js';

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
  assert.deepEqual(validateActivationInterruptMs('620', 920), { valid: true, value: 620 });
  assert.match(validateActivationInterruptMs('630', 920).error, /divisible by 20 ms/);
  assert.equal(validateActivationInterruptMs('', 920).valid, false);
  assert.equal(validateActivationInterruptMs(0, 920).valid, false);
  assert.deepEqual(validateActivationInterruptMs(920, 920), { valid: true, value: 920 });
  assert.deepEqual(validateActivationInterruptMs(657, 657), { valid: true, value: 657 });
  assert.equal(validateActivationInterruptMs(921, 920).valid, false);
  assert.deepEqual(validateActivationConcurrentOffsetMs(0), { valid: true, value: 0 });
  assert.deepEqual(validateActivationConcurrentOffsetMs(120), { valid: true, value: 120 });
  assert.match(validateActivationConcurrentOffsetMs('100.4').error, /divisible by 40 ms/);
  assert.match(validateActivationConcurrentOffsetMs(100).error, /divisible by 40 ms/);
  assert.deepEqual(validateActivationConcurrentOffsetMs(-440, null), { valid: true, value: -440 });
  assert.deepEqual(validateActivationConcurrentOffsetMs(681, null), { valid: true, value: 681 });
  assert.match(validateActivationConcurrentOffsetMs('681.5', null).error, /whole-millisecond/);
  assert.equal(validateActivationConcurrentOffsetMs('').valid, false);
  assert.equal(validateActivationConcurrentOffsetMs(-1).valid, false);
  assert.equal(
    activationDamageCommitMs({
      effects: [
        { type: 'strike', persistsAfterInterrupt: true, interruptCommitMs: 560 },
        { type: 'strike', persistsAfterInterrupt: true, interruptCommitMs: 280 }
      ]
    }),
    280
  );
  assert.equal(activationDamageCommitMs({ effects: [], interruptCommitMs: 160 }), 160);
  assert.equal(activationDamageCommitMs({ effects: [], interruptMode: 'per-packet' }), 0);
  assert.equal(activationDamageCommitMs({ effects: [] }), null);
  assert.equal(activationDamageCommitLabel(160), 'Damage commit cutoff: 160 ms minimum');
  assert.equal(activationDamageCommitLabel(null), '');
  assert.match(activationDamageCommitWarning(159, 160), /contribute no damage.*at least 160 ms/);
  assert.match(activationDamageCommitWarning(200, null), /No damage commit time is configured/);
  assert.equal(activationDamageCommitWarning(160, 160), '');
});

test('timeline cast details preserve millisecond wait boundaries', () => {
  assert.equal(
    formatTimelineCastDetails({ start: 3000, end: 3083 }, (time) => `${(time / 1000).toFixed(3)}s`),
    'Cast: 3.000s → 3.083s\nCast time: 0.083s'
  );
});

test('timeline dead time includes explicit waits and excludes concurrent casts and gap-fill attacks', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Long Cast', start: 0, end: 1000 },
    { ri: 1, skill: 'Instant Cast', start: 200, end: 200 },
    { ri: 2, skill: 'Wait', start: 1000, end: 1400, type: 'wait' },
    { ri: 3, skill: 'Next Cast', start: 1400, end: 1800 },
    {
      ri: 4,
      skill: 'Gap-filled Cast',
      start: 2000,
      end: 2400,
      partialFill: { startMs: 1800, durationMs: 150 }
    },
    {
      ri: 5,
      skill: 'Invalid Cast',
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

test('timeline dead time precedes simultaneous instant and non-instant casts', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Previous Cast', start: 0, end: 1000 },
    { ri: 1, skill: 'Instant Cast', start: 1500, end: 1500 },
    { ri: 2, skill: 'Following Cast', start: 1500, end: 1900 }
  ]);

  assert.deepEqual(markers, [{ insertionIndex: 1, start: 1000, end: 1500, durationMs: 500 }]);
});

test('timeline overlays suppress wait shapes and retain only excess dead time', () => {
  const markers = timelineDeadTimeMarkers(
    [
      { ri: 0, skill: 'First Cast', start: 0, end: 1000 },
      { ri: 1, skill: 'Wait', start: 1000, end: 1400, type: 'wait' },
      { ri: 2, skill: 'Next Cast', start: 1500, end: 1900 }
    ],
    [],
    { includeExplicitWaits: false }
  );

  assert.deepEqual(markers, [{ insertionIndex: 2, start: 1400, end: 1500, durationMs: 100 }]);
});

test('timeline dead time excludes forced post-interrupt cast lockout', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Interrupted Cast', start: 0, end: 400, castLockoutEnd: 1000, interrupted: true },
    { ri: 1, skill: 'Following Cast', start: 1000, end: 1200 }
  ]);

  assert.deepEqual(markers, []);
});

test('timeline dead time includes missing commits and the full duration of explicit pre-commit cancellations', () => {
  const markers = timelineDeadTimeMarkers(
    [
      {
        ri: 0,
        skill: 'Missing Commit',
        start: 0,
        end: 400,
        activationId: 'cast:1',
        interrupted: true,
        missingInterruptCommit: true
      },
      {
        ri: 1,
        skill: 'Missing Commit With Damage',
        start: 400,
        end: 700,
        activationId: 'cast:2',
        interrupted: true,
        missingInterruptCommit: true
      },
      {
        ri: 2,
        skill: 'Below Explicit Commit',
        start: 700,
        end: 900,
        activationId: 'cast:3',
        interrupted: true,
        cancelledBeforeCommit: true
      },
      {
        ri: 3,
        skill: 'Per-packet Channel',
        start: 900,
        end: 1000,
        activationId: 'cast:4',
        interrupted: true
      }
    ],
    [
      { type: 'damage', at: 0.5, source: 'fixture', sourceId: 2, activationId: 'cast:2', damage: 10 },
      { type: 'damage', at: 0.8, source: 'fixture', sourceId: 3, activationId: 'cast:3', damage: 10 }
    ]
  );

  assert.deepEqual(markers, [
    {
      insertionIndex: 0,
      start: 0,
      end: 400,
      durationMs: 400,
      reason: 'zero-damage-cast',
      skill: 'Missing Commit'
    },
    {
      insertionIndex: 2,
      start: 700,
      end: 900,
      durationMs: 200,
      reason: 'cancelled-before-commit',
      skill: 'Below Explicit Commit'
    }
  ]);
});

test('timeline skill tooltips include matching and global cast ordinals', () => {
  const steps = [
    { ri: 0, skill: 'Well of Darkness', start: 1000, end: 1481 },
    { ri: 1, skill: 'Wait', start: 1481, end: 2000 },
    { ri: 2, skill: 'Nightfall', start: 2000, end: 2750 },
    { ri: 3, skill: 'Well of Darkness', start: 3000, end: 3481 },
    { ri: 4, skill: 'Well of Darkness', start: 2500, end: 2981 },
    {
      ri: 5,
      skill: 'Well of Darkness',
      start: 4000,
      end: 4481,
      invalid: true
    }
  ];
  const ordinals = timelineSkillCastOrdinals(steps);

  assert.deepEqual(ordinals.get(4), {
    matchingIndex: 2,
    matchingTotal: 3,
    skillIndex: 3,
    skillTotal: 4
  });
  assert.equal(
    formatTimelineSkillTooltip('Well of Darkness', steps[4], ordinals.get(4), (time) => `${(time / 1000).toFixed(3)}s`),
    'Well of Darkness at 2.500s for 481ms\n' + 'Well of Darkness cast 2 of 3\n' + 'Skill cast 3 of 4'
  );
  assert.match(
    formatTimelineSkillTooltip(
      'Dragon Slash—Force',
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
      ['Charges reached: 4', 'Time spent charging: 0.750s', 'Flow spent: 10']
    ),
    /Charges reached: 4\nTime spent charging: 0\.750s\nFlow spent: 10$/
  );
  assert.equal(ordinals.has(1), false);
  assert.equal(ordinals.has(5), false);
});

test('GW2 API text removes presentation tags for native tooltips', () => {
  const description = '<c=@abilitytype>Stances</c> grant protection.<br><c=@reminder>Once per interval.</c>';

  assert.equal(gw2ApiText(description), 'Stances grant protection.\nOnce per interval.');
  assert.equal(escapeHtml(gw2ApiText('<c=abilitytype>"Glamour" & allies</c>')), '&quot;Glamour&quot; &amp; allies');
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
  assert.match(paletteSkillHtml({ name: 'Reserved', concealed: true }), /pal-concealed/);

  const virtualView = {
    name: 'Wait',
    title: 'Wait',
    icon: 'wait.png'
  };
  const virtual = virtualPaletteSkillHtml(virtualView);

  assert.match(virtual, /draggable="true"/);
  assert.match(
    paletteGroupHtml({
      label: '<Group>',
      statusIcon: {
        icon: 'pet.png',
        label: 'Fanged Iboga',
        title: 'Active pet: Fanged Iboga'
      },
      skills: [{ ...virtualView, virtual: true }]
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
  assert.match(
    paletteGroupHtml({
      label: 'Reserved',
      className: 'pal-group-concealed',
      skills: [virtualView]
    }),
    /pal-group pal-group-concealed/
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

test('timeline binding inserts palette entries and drop positions use tile halves', () => {
  let dragState = { source: 'palette', name: 'New', skillId: 12345 };
  let changes = 0;
  const rotation = [{ type: 'cast', skillId: 'A' }];
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll: () => []
  };
  const insertEntries = (entries, insertAt) => {
    if (!entries.length) return false;
    rotation.splice(insertAt, 0, ...entries);
    return true;
  };

  const binding = bindTimelineInteractions(root, {
    rotation,
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    moveEntry: () => false,
    insertEntries,
    resolvePaletteEntry: (name, drag) => ({
      type: 'cast',
      skillId: drag.skillId,
      interruptAfterMs: 100
    }),
    onChanged: () => {
      changes += 1;
    }
  });

  assert.equal(binding.applyDrop(1), true);
  assert.deepEqual(rotation, [
    { type: 'cast', skillId: 'A' },
    { type: 'cast', skillId: 12345, interruptAfterMs: 100 }
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 1);

  dragState = { source: 'palette', name: 'Macro' };
  const macroBinding = bindTimelineInteractions(root, {
    rotation,
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    moveEntry: () => false,
    insertEntries,
    resolvePaletteEntry: () => [
      { type: 'cast', skillId: 10 },
      { type: 'cast', skillId: -5, concurrentOffsetMs: 0 }
    ],
    onChanged: () => {
      changes += 1;
    }
  });

  assert.equal(macroBinding.applyDrop(1), true);
  assert.deepEqual(rotation, [
    { type: 'cast', skillId: 'A' },
    { type: 'cast', skillId: 10 },
    { type: 'cast', skillId: -5, concurrentOffsetMs: 0 },
    { type: 'cast', skillId: 12345, interruptAfterMs: 100 }
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 2);

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
    insertEntries: () => false,
    onEditWait(index) {
      editedIndex = index;
      return false;
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
