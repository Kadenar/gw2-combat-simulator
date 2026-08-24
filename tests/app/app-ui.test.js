import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  groupedOptions,
  DEFAULT_TARGET_ARMOR,
  normalizeTargetArmor,
  option,
  PERMANENT_TARGET_CONDITIONS,
  PRIMARY_ATTRIBUTES,
  STACKING_TARGET_CONDITIONS,
  TARGET_ARMOR_OPTIONS,
  TARGET_CONDITION_GROUPS
} from '../../js/app/build/options.js';
import { getBuildExportPayload } from '../../js/app/build/files.js';
import { skillBarDisplaySkill } from '../../js/app/build/skills-panel.js';
import { createDefaultBuild, replaceBuildConfiguration } from '../../js/app/build/persistence.js';
import { loadProfessionAppAdapter, professionOptions, professionRegistry } from '../../js/app/profession/registry.js';
import { professionRoute } from '../../js/app/profession/selector.js';
import {
  autoattackChainSkillAvailable,
  displayedFlipSkills,
  displayedWeaponSkills,
  paletteActionSkills,
  rotationUtilityFlipByParent,
  weaponSkills,
  weaponPaletteSectionHtml,
  weaponPaletteStackHtml,
  weaponPaletteRows
} from '../../js/app/rotation/palette/model.js';
import { dragonChargeReleaseProjection } from '../../js/professions/warrior/specializations/bladesworn/charge-release.js';
import {
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterLabel,
  relicProcExpirationTimelineMarkers,
  relicProcTimelineMarkers,
  rotationSkillHighlightKey,
  shatterResourceSpends,
  sigilProcTimelineMarkers,
  targetHealthTimelineMarkers,
  timelineWeaponRows
} from '../../js/app/rotation/timeline/model.js';
import { addRotation, createRotationItem, insertRotationItems } from '../../js/app/rotation/editing/actions.js';
import { parseWaitDurationMs } from '../../js/app/rotation/palette/view.js';
import { syncProcVisibility } from '../../js/app/rotation/timeline/view.js';
import { ACTION_ICONS, resolveProcIcon, resultSkillIcon } from '../../js/app/rotation/shared/icons.js';
import { renderResults } from '../../js/app/rotation/result/view.js';
import {
  PREFIXES,
  PREFIX_GROUPS,
  SIGIL_GROUPS,
  SIGIL_NAMES,
  WEAPON_DATA,
  createProfessionWeaponData
} from '../../js/platform/gw2/gear-data.js';
import { createGuardianBuildDefaults } from '../../js/professions/guardian/build.js';
import { createEngineerBuildDefaults } from '../../js/professions/engineer/build.js';
import { guardianProfession } from '../../js/professions/guardian/definition.js';
import { createMesmerBuildDefaults } from '../../js/professions/mesmer/build.js';
import { mesmerProfession } from '../../js/professions/mesmer/definition.js';
import { createDefaultConfig, simulateMesmer } from '../helpers/mesmer-simulation.js';

test('target armor presets use base by default and allow custom values', () => {
  assert.equal(DEFAULT_TARGET_ARMOR, 2597);
  assert.deepEqual(TARGET_ARMOR_OPTIONS, [
    { value: 2597, label: 'Base' },
    { value: 1910, label: 'Vale Guardian / Keep Construct' },
    { value: 5346, label: 'McLeod' },
    { value: 2460, label: 'Berg' },
    { value: 2323, label: 'Zane' },
    { value: 2184, label: 'Narella' }
  ]);
  assert.equal(normalizeTargetArmor(1910), 1910);
  assert.equal(normalizeTargetArmor('2184'), 2184);
  assert.equal(normalizeTargetArmor(3210), 3210);
  assert.equal(normalizeTargetArmor('not armor'), DEFAULT_TARGET_ARMOR);
});

test('proc display groups only consecutive occurrences of the same proc', () => {
  const proc = (type, skill, start) => ({ type, skill, start });
  const groups = groupConsecutiveProcSteps([
    proc('relic_proc', 'Relic of Fireworks', 480),
    proc('relic_proc', 'Relic of Fireworks', 1280),
    proc('trait_proc', 'Sharper Images', 1400),
    proc('relic_proc', 'Relic of Fireworks', 2200)
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      key: group.key,
      starts: group.steps.map((step) => step.start)
    })),
    [
      {
        key: 'relic_proc:Relic of Fireworks',
        starts: [480, 1280]
      },
      {
        key: 'trait_proc:Sharper Images',
        starts: [1400]
      },
      {
        key: 'relic_proc:Relic of Fireworks',
        starts: [2200]
      }
    ]
  );
});

test('equipment proc timeline markers follow their simulated activation times', () => {
  const result = {
    steps: [
      { ri: 0, skill: 'Opening Strike', start: 0, end: 600 },
      { ri: 1, skill: 'Follow-up', start: 700, end: 1200 },
      { ri: 2, skill: 'Finisher', start: 1300, end: 1800 }
    ],
    procSteps: [
      {
        ri: -1,
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 0,
        end: 0
      },
      {
        ri: -1,
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 0,
        end: 0
      },
      {
        ri: -1,
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 400,
        end: 400
      },
      {
        ri: -1,
        type: 'trait_proc',
        skill: 'Trait Proc',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'trait.png',
        start: 800,
        end: 800
      },
      {
        ri: -1,
        type: 'relic_proc',
        skill: 'Relic of Fireworks',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'fireworks.png',
        start: 700,
        end: 700
      },
      {
        ri: -1,
        type: 'sigil_proc',
        skill: 'Sigil of Earth',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'earth.png',
        start: 900,
        end: 900
      }
    ]
  };

  assert.deepEqual(
    sigilProcTimelineMarkers(result, 3).map((marker) => ({
      skill: marker.skill,
      start: marker.start,
      insertionIndex: marker.insertionIndex,
      activations: marker.activations.length
    })),
    [
      {
        skill: 'Sigil of Air',
        start: 0,
        insertionIndex: 1,
        activations: 2
      },
      {
        skill: 'Sigil of Air',
        start: 400,
        insertionIndex: 1,
        activations: 1
      },
      {
        skill: 'Sigil of Earth',
        start: 900,
        insertionIndex: 2,
        activations: 1
      }
    ]
  );
  assert.deepEqual(
    relicProcTimelineMarkers(result, 3).map((marker) => ({
      skill: marker.skill,
      insertionIndex: marker.insertionIndex
    })),
    [{ skill: 'Relic of Fireworks', insertionIndex: 2 }]
  );
  assert.equal(procFilterLabel(result.procSteps[0]), 'Sigil of Air (Sigil)');
});

test('timed relic expiration markers merge refreshes and stay within the rotation', () => {
  const result = {
    duration: 12,
    steps: [
      { ri: 0, skill: 'Opening Strike', start: 0, end: 500 },
      { ri: 1, skill: 'Follow-up', start: 6000, end: 6500 },
      { ri: 2, skill: 'Finisher', start: 11500, end: 12000 }
    ],
    procSteps: [
      {
        type: 'relic_proc',
        skill: 'Relic of Fireworks',
        sourceSkill: 'Opening Strike',
        start: 1000,
        end: 1000,
        expiresAt: 7000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of Fireworks',
        sourceSkill: 'Follow-up',
        start: 5000,
        end: 5000,
        expiresAt: 11000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of the Claw',
        sourceSkill: 'Control',
        start: 2000,
        end: 2000,
        expiresAt: 10000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of Peitha',
        sourceSkill: 'Shadowstep',
        start: 9000,
        end: 9000,
        expiresAt: 13000
      }
    ]
  };

  assert.deepEqual(
    relicProcExpirationTimelineMarkers(result, 3).map((marker) => ({
      skill: marker.skill,
      start: marker.start,
      insertionIndex: marker.insertionIndex,
      activations: marker.activations.length,
      expired: marker.expired
    })),
    [
      {
        skill: 'Relic of the Claw',
        start: 10000,
        insertionIndex: 2,
        activations: 1,
        expired: true
      },
      {
        skill: 'Relic of Fireworks',
        start: 11000,
        insertionIndex: 2,
        activations: 2,
        expired: true
      }
    ]
  );
});

test('rotation skill highlights group occurrences by displayed skill', () => {
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: 123 }), 'skill:123');
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: 123, interruptAfterMs: 500 }), 'skill:123');
  assert.equal(rotationSkillHighlightKey({ type: 'cast', skillId: -5 }), 'skill:-5');
});

test('palette additions insert at an armed cursor and advance it', () => {
  let changeCount = 0;
  const app = {
    build: {
      rotation: [
        { type: 'cast', skillId: 'First' },
        { type: 'cast', skillId: 'Last' }
      ]
    },
    rotationInsertionIndex: 1,
    skillById: new Map(),
    skillByName: new Map(),
    changed: () => {
      changeCount += 1;
    }
  };

  addRotation(app, 'Second');
  insertRotationItems(app, [
    { type: 'cast', skillId: 'Third' },
    { type: 'cast', skillId: 'Fourth' }
  ]);

  assert.deepEqual(app.build.rotation, [
    { type: 'cast', skillId: 'First' },
    { type: 'cast', skillId: 'Second' },
    { type: 'cast', skillId: 'Third' },
    { type: 'cast', skillId: 'Fourth' },
    { type: 'cast', skillId: 'Last' }
  ]);
  assert.equal(app.rotationInsertionIndex, 4);
  assert.equal(changeCount, 2);
});

test('Dragon Slash release projections respect Flow and traited charge caps', () => {
  const skill = {
    id: 1,
    name: 'Dragon Slash—Force',
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4
  };
  const entry = {
    type: 'resource',
    at: 1,
    source: 'Warrior',
    sourceId: 2,
    reason: 'dragon trigger entry',
    rotationIndex: 0,
    value: 10,
    maximumFlow: 100,
    maximumCharges: 5,
    chargesPerInterval: 1,
    flowPerInterval: 10,
    nextChargeAt: 1.25,
    deadline: 3.5,
    flowRateSegments: []
  };
  const projection = dragonChargeReleaseProjection({
    events: [entry],
    insertionIndex: 1,
    skill
  });

  assert.equal(projection.unavailableMessage, undefined);
  assert.deepEqual(
    projection.rows.map((row) => row.charges),
    [1, 2, 3, 4, 5]
  );
  assert.equal(projection.rows[0].disabled, false);
  assert.equal(projection.rows[0].flowAfter, 0);
  assert.equal(projection.rows[1].disabled, true);
  assert.match(projection.rows[1].reason, /Insufficient Flow/);
  assert.equal(projection.rows.at(-1).coefficient, 20.4);
  assert.equal(
    dragonChargeReleaseProjection({
      events: [],
      insertionIndex: 1,
      skill
    }).unavailableMessage,
    'Enter Dragon Trigger before using this skill.'
  );
});

test('Dragon Slash resource spends preserve charge outcome details', () => {
  const spends = shatterResourceSpends({
    events: [
      {
        type: 'resource',
        reason: 'profession mechanic',
        rotationIndex: 4,
        amount: -4,
        resource: 'dragon charges',
        sourceSkill: 'Dragon Slash—Force',
        requestedCharges: 3,
        maximumCharges: 10,
        chargesReached: 4,
        chargingSeconds: 0.75,
        flowSpent: 10
      }
    ]
  });

  assert.deepEqual(spends.get(4), {
    count: 4,
    resource: 'dragon charges',
    sourceSkill: 'Dragon Slash—Force',
    requestedCharges: 3,
    maximumCharges: 10,
    chargesReached: 4,
    chargingSeconds: 0.75,
    flowSpent: 10
  });
});

test('proc visibility remains hidden after its first render', () => {
  const app = {};
  const procSteps = [{ type: 'trait_proc', skill: 'Sharper Images' }];
  const key = 'trait_proc:Sharper Images';

  const firstVisibility = syncProcVisibility(app, procSteps);

  assert.notEqual(app.procVisibility, app.procVisibilityKeys);
  firstVisibility.delete(key);

  const nextVisibility = syncProcVisibility(app, [...procSteps, { type: 'relic_proc', skill: 'Relic of Fireworks' }]);

  assert.equal(nextVisibility.has(key), false);
  assert.equal(nextVisibility.has('relic_proc:Relic of Fireworks'), true);
});

test('rotation items preserve default interrupts when options contain nullish values', () => {
  const skill = { name: 'Counter', defaultInterruptMs: 120 };
  const app = {
    skillById: new Map(),
    skillByName: new Map([[skill.name, skill]])
  };

  assert.deepEqual(createRotationItem(app, skill.name, { interruptAfterMs: undefined }), {
    type: 'cast',
    skillId: skill.name,
    interruptAfterMs: 120
  });
  assert.deepEqual(createRotationItem(app, skill.name, { interruptAfterMs: null }), {
    type: 'cast',
    skillId: skill.name,
    interruptAfterMs: 120
  });
});

test('wait duration parsing rejects cancelled, non-finite, and sub-millisecond values', () => {
  assert.equal(parseWaitDurationMs(null), null);
  assert.equal(parseWaitDurationMs('not a number'), null);
  assert.equal(parseWaitDurationMs('Infinity'), null);
  assert.equal(parseWaitDurationMs('0.9'), null);
  assert.equal(parseWaitDurationMs('1.4'), 1);
  assert.equal(parseWaitDurationMs('1000'), 1000);
});

test('cooldown-reduction procs use a refresh icon and reduction badge', () => {
  const sourceIcon = 'https://example.com/source-skill.png';
  const app = {
    attributeData: { activeTraits: [] },
    skillByName: new Map([['Abyssal Strike', { icon: sourceIcon }]])
  };
  const proc = {
    type: 'skill_proc',
    skill: 'Abyssal Strike — Abyssal Raze recharge',
    sourceSkill: 'Abyssal Strike',
    icon: sourceIcon,
    cooldownReduction: 1
  };

  assert.match(resolveProcIcon(app, proc), /^data:image\/svg\+xml/);
  assert.notEqual(resolveProcIcon(app, proc), sourceIcon);
  assert.equal(procBadgeLabel([proc]), '-1s');
  assert.equal(procBadgeLabel([proc, proc]), '-2s');
  assert.equal(
    procBadgeLabel([
      { type: 'trait_proc', skill: 'Sharper Images' },
      { type: 'trait_proc', skill: 'Sharper Images' }
    ]),
    '×2'
  );
});

test('shared app options escape labels and preserve selection state', () => {
  assert.equal(
    option('a&b', 'a&b', '<label>', true),
    '<option value="a&amp;b" selected disabled>&lt;label&gt;</option>'
  );
  assert.equal(
    groupedOptions([{ label: 'Damage & support', items: ['Power'] }], 'Power', (value) => `${value} <stat>`),
    '<optgroup label="Damage &amp; support"><option value="Power" selected>Power &lt;stat&gt;</option></optgroup>'
  );
});

test('gear prefixes and sigils are sorted into Power and Condition groups', () => {
  assert.deepEqual(PREFIX_GROUPS, [
    {
      label: 'Power',
      items: ["Assassin's", "Berserker's", "Diviner's", "Dragon's"]
    },
    {
      label: 'Condition',
      items: [
        'Celestial',
        'Dire',
        'Grieving',
        'Rabid',
        "Rampager's",
        "Ritualist's",
        'Sinister',
        "Trailblazer's",
        "Viper's"
      ]
    }
  ]);
  assert.deepEqual(SIGIL_GROUPS, [
    {
      label: 'Power',
      items: ['Accuracy', 'Air', 'Concentration', 'Energy', 'Force', 'Hydromancy', 'Impact', 'Night', 'Severance']
    },
    {
      label: 'Condition',
      items: [
        'Agony',
        'Blight',
        'Bursting',
        'Demons',
        'Doom',
        'Earth',
        'Geomancy',
        'Ice',
        'Malice',
        'Smoldering',
        'Torment',
        'Venom'
      ]
    }
  ]);
  assert.deepEqual(PREFIX_GROUPS.flatMap((group) => group.items).sort(), PREFIXES);
  assert.deepEqual(SIGIL_GROUPS.flatMap((group) => group.items).sort(), SIGIL_NAMES);
});

test('grouped options can disable items without losing the selection', () => {
  assert.equal(
    groupedOptions(
      [{ label: 'Power', items: ['Force', 'Impact'] }],
      'Force',
      (value) => value,
      (value) => value === 'Impact'
    ),
    '<optgroup label="Power"><option value="Force" selected>Force</option><option value="Impact" disabled>Impact</option></optgroup>'
  );
});

test('shared app metadata owns common attributes and target conditions', () => {
  const defaultTargetConditions = createMesmerBuildDefaults().assumptions.targetConditions;

  assert.equal(PRIMARY_ATTRIBUTES.includes('Condition Damage'), true);
  assert.equal(PERMANENT_TARGET_CONDITIONS.includes('Vulnerability'), true);
  assert.equal(Object.hasOwn(defaultTargetConditions, 'Fear'), false);
  assert.equal(Object.hasOwn(defaultTargetConditions, 'Taunt'), false);
  assert.equal(STACKING_TARGET_CONDITIONS.has('Vulnerability'), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has('Burning'), false);
  assert.deepEqual(
    TARGET_CONDITION_GROUPS.map((group) => [group.label, [...group.conditions]]),
    [
      ['Damaging', ['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poisoned']],
      [
        'Control',
        ['Vulnerability', 'Weakness', 'Blindness', 'Slow', 'Chilled', 'Cripple', 'Immobilize', 'Fear', 'Taunt']
      ]
    ]
  );
  assert.deepEqual(
    PERMANENT_TARGET_CONDITIONS,
    TARGET_CONDITION_GROUPS.flatMap((group) => group.conditions)
  );
});

test('mobile rotation workspace keeps controls, timeline, and focus metrics usable', async () => {
  const css = await readFile(new URL('../../css/style.css', import.meta.url), 'utf8');

  assert.match(css, /body:not\(\[data-rotation-focus\]\) \.rotation-panel\s*\{\s*max-height: none;/);
  assert.match(css, /grid-template-areas:\s*['"]label size['"]\s*['"]start start['"]\s*['"]buttons buttons['"];/);
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-section\s*\{\s*display: block;\s*padding: 6px;\s*overflow-x: hidden;\s*overflow-y: auto;/
  );
  assert.match(css, /body\[data-rotation-focus\] \.rotation-panel-shell > \.rotation-panel\s*\{\s*height: auto;/);
  assert.match(css, /\.rotation-timeline\s*\{\s*flex: 0 0 clamp\(320px, 50vh, 520px\);\s*min-height: 320px;/);
  assert.match(css, /body\[data-rotation-focus\] \.rotation-palette\s*\{\s*max-height: none;\s*overflow-y: visible;/);
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-timeline\s*\{\s*flex: 0 0 auto;\s*height: auto;\s*overflow-y: visible;/
  );
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-results\s*\{\s*grid-template-columns: 1fr;\s*max-height: none;\s*margin-top: 8px;\s*overflow-x: hidden;/
  );
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-dps-summary \.res-summary\s*\{\s*display: grid;\s*width: 100%;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-results \.res-breakpoint-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
});

test('timeline display checkboxes are owned by Simulation Config instead of the rotation output', async () => {
  const [displayControls, timelineView, timelineSize] = await Promise.all([
    readFile(new URL('../../js/app/rotation/timeline/display-controls.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/rotation/timeline/view.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/platform/ui/rotation-timeline-size.ts', import.meta.url), 'utf8')
  ]);

  assert.match(displayControls, /summary\.textContent = 'Timeline Display'/);
  assert.match(displayControls, /id: 'rotation-show-dead-time'/);
  assert.match(displayControls, /label: 'Display idle time'/);
  assert.match(displayControls, /id: 'rotation-overlay-sigil-procs'/);
  assert.match(displayControls, /id: 'rotation-overlay-relic-procs'/);
  assert.doesNotMatch(timelineView, /data-overlay-proc-type/);
  assert.doesNotMatch(timelineSize, /rotation-dead-time-control/);
});

test('shared profession palettes preserve utility rows before wrapping combat tools', async () => {
  const css = await readFile(new URL('../../css/style.css', import.meta.url), 'utf8');

  assert.match(css, /\.rotation-palette \.pal-group\.utility-palette-group > \.pal-row\s*\{\s*flex-wrap: nowrap;/);
  assert.match(
    css,
    /body\[data-profession\] \.rotation-palette:not\(:has\(\.weaver-weapon-palette\)\)\s*\{\s*display: flex;\s*flex-wrap: wrap;/
  );
  assert.match(
    css,
    /body\[data-profession\] \.rotation-palette > \.timeline-tools-palette-stack\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?flex-wrap: nowrap;[\s\S]*?margin-inline-start: auto;/
  );
});

test('empty rotations keep placeholder DPS metrics grouped with the builder', () => {
  const results = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const summaryStrip = { ...results, innerHTML: '' };
  const summaryMirror = { innerHTML: 'stale summary' };
  const previousDocument = globalThis.document;

  const mockDocument = {
    getElementById: (id) =>
      id === 'rotation-results'
        ? results
        : id === 'rotation-dps-summary'
          ? summaryStrip
          : id === 'analysis-dps-summary'
            ? summaryMirror
            : null
  };
  // Mirror the ownerDocument relationship that real result containers expose.
  results.ownerDocument = mockDocument;
  globalThis.document = mockDocument;
  try {
    renderResults({ build: { rotation: [] }, results: null });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(summaryStrip.innerHTML, /res-summary-placeholder/);
  assert.deepEqual(
    [...summaryStrip.innerHTML.matchAll(/<span class="res-label">([^<]+)<\/span>/g)].map((match) => match[1]),
    ['Duration', 'Total Idle Time', 'Total Damage', 'DPS', 'Strike', 'Condition']
  );
  assert.equal([...summaryStrip.innerHTML.matchAll(/<span class="res-val[^>]*">—<\/span>/g)].length, 6);
  assert.match(results.innerHTML, /No analysis yet/);
  assert.equal(summaryMirror.innerHTML, '');
});

test('current rotation DPS stays above the footer and hides in the professions view', async () => {
  const css = await readFile(new URL('../../css/style.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.floating-dps\s*\{\s*position: absolute;\s*right: max\(14px, env\(safe-area-inset-right\)\);\s*bottom: calc\(100% \+ 12px\);/
  );
  assert.match(
    css,
    /body\[data-profession\]\[data-simulator-view='professions'\] \.floating-dps\s*\{\s*display: none;/
  );
});

test('gear panel leaves current rotation DPS to the floating metric', async () => {
  const [gearPanel, professionApp, css] = await Promise.all([
    readFile(new URL('../../js/app/build/gear-panel.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/profession-app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../css/style.css', import.meta.url), 'utf8')
  ]);

  assert.doesNotMatch(gearPanel, /current-rotation-dps|gear-rotation-dps|currentRotationDps/);
  assert.doesNotMatch(professionApp, /updateGearRotationDps/);
  assert.doesNotMatch(css, /\.gear-rotation-(?:result|dps)/);
});

test('empty and authored rotations keep the same timeline height', async () => {
  const css = await readFile(new URL('../../css/style.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.rotation-timeline\s*\{\s*flex: 1 1 auto;\s*height: clamp\(280px, 52vh, 600px\);\s*min-height: 280px;/
  );
  assert.match(css, /\.rotation-timeline\.is-empty\s*\{\s*display: grid;\s*place-items: center;\s*background:/);
  assert.match(
    css,
    /body\[data-rotation-focus\] \.rotation-timeline\s*\{\s*flex: 0 0 auto;\s*height: auto;\s*overflow-y: visible;/
  );
});

test('shared app and platform helpers are profession neutral', async () => {
  const sources = await Promise.all([
    readFile(new URL('../../js/app/simulation/modifier-contributions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/build/persistence.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/app.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/simulation/config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/app/simulation/modifier-contribution-worker.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../js/platform/ui/rotation-results.ts', import.meta.url), 'utf8')
  ]);
  const professionTerms = professionRegistry.flatMap((entry) => [entry.id, entry.name]);

  for (const source of sources) {
    for (const term of professionTerms) {
      assert.equal(source.toLowerCase().includes(term.toLowerCase()), false, term);
    }
  }
});

test('Guardian is exposed by the profession selector and app composition', async () => {
  const guardianPage = await readFile(new URL('../../guardian.html', import.meta.url), 'utf8');

  assert.equal(
    professionOptions.some((option) => option.id === 'guardian'),
    true
  );
  assert.equal(professionRoute('guardian'), 'guardian.html');
  assert.equal((await loadProfessionAppAdapter('guardian'))?.id, 'guardian');
  assert.match(guardianPage, /data-profession="guardian"/);
});

test('the generic landing page and profession simulators have separate entries', async () => {
  const landingPage = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const professionPages = await Promise.all(
    professionRegistry.map(async (entry) => ({
      entry,
      source: await readFile(new URL(`../../${entry.route}`, import.meta.url), 'utf8')
    }))
  );

  assert.match(landingPage, /<body class="landing-page">/);
  assert.match(landingPage, /data-profession-grid/);
  assert.doesNotMatch(landingPage, /profession-card-mesmer/);
  assert.deepEqual(
    professionOptions,
    professionRegistry.map(({ id, name }) => ({ id, name }))
  );
  assert.equal(new Set(professionRegistry.map((entry) => entry.route)).size, professionRegistry.length);
  assert.doesNotMatch(landingPage, /js\/app\/app\.js/);
  assert.doesNotMatch(landingPage, /ARCHITECTURE\.md/);
  for (const { entry, source } of professionPages) {
    assert.match(source, /<a class="home-link" href="index\.html">← All professions<\/a>/);
    assert.equal(professionRoute(entry.id), entry.route);
    assert.match(source, new RegExp(`data-profession="${entry.id}"`));
    assert.match(source, /js\/app\/app\.js/);
    assert.match(source, /id="rotation-warnings"/);
    // Every profession uses the shared combat-loadout card so its weapons,
    // mechanics, and selectable skills stay together beside traits.
    assert.match(source, /skills-section combat-loadout-section/);
    assert.match(source, /combat-loadout-panel/);
    assert.match(source, /combat-loadout-weapons/);
    assert.match(source, /combat-loadout-skills/);
    assert.doesNotMatch(source, /skills-primary-column/);
    assert.doesNotMatch(source, /equipped-skills-panel/);
    assert.doesNotMatch(source, /weapon-sets-panel/);
    assert.match(source, /skill-bar-column weapon-bar-column/);
    assert.match(source, /skill-bar-column equipped-skill-bar-column/);

    if (entry.id === 'elementalist') {
      assert.match(source, /class="elementalist-theme"/);
    } else {
      assert.match(source, /profession-loadout-theme/);
    }

    assert.doesNotMatch(source, /id="skill-info-table"/);
    assert.doesNotMatch(source, /selected-skills-panel/);
  }
});

test('Mesmer default builds resolve without embedded rotations', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/mesmer/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('mesmer');
  const presets = manifest.flatMap((section) => section.presets);

  assert.deepEqual(
    presets.map((preset) => preset.label),
    [
      'Power (Greatsword-Dagger/Sword)',
      'Power (Spear-Dagger/Sword)',
      'Condition (Staff-Scepter/Pistol)',
      'Condition (Staff-Axe/Torch) - Dune Cloak',
      'Power (Spear / Greatsword)',
      'Condition (Dagger/Sword-Pistol)',
      'Power (Dagger-Sword / Spear)'
    ]
  );
  for (const preset of presets) {
    const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
    const build = adapter.toApplicationBuild(saved);

    assert.equal(Object.hasOwn(saved, 'rotation'), false);
    assert.equal(build.schemaVersion, 3);
    assert.equal(build.profession, 'mesmer');
    assert.equal(build.specializations.length, 3);
  }
});

test('Guardian Power Luminary default builds resolve', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/guardian/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('guardian');
  const section = manifest.find((candidate) => candidate.section === 'Luminary');
  const powerPreset = section.presets.find((preset) => preset.label === 'Power (Greatsword / Spear)');
  const longbowPreset = section.presets.find((preset) => preset.label === 'Power (Greatsword / Longbow)');
  const alacrityPreset = section.presets.find((preset) => preset.label === 'Power Alacrity (Greatsword / Spear)');
  const [saved, savedLongbow, savedAlacrity, alacrityRotation] = await Promise.all(
    [powerPreset.build, longbowPreset.build, alacrityPreset.build, alacrityPreset.rotation].map((path) =>
      readFile(new URL(`../../${path}`, import.meta.url), 'utf8').then(JSON.parse)
    )
  );
  const build = adapter.toApplicationBuild(saved);
  const longbowBuild = adapter.toApplicationBuild(savedLongbow);
  const alacrityBuild = adapter.toApplicationBuild(savedAlacrity);
  const radiantBulwarks = alacrityRotation.rotation.filter(
    (step) => (typeof step === 'string' ? step : step.name) === 'Radiant Bulwark'
  );
  const alacrityRotationNames = alacrityRotation.rotation.map((step) => (typeof step === 'string' ? step : step.name));

  assert.equal(section.section, 'Luminary');
  assert.equal(powerPreset.label, 'Power (Greatsword / Spear)');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'guardian');
  assert.equal(build.specializations[2].name, 'Luminary');
  assert.deepEqual(build.weapons, ['Greatsword', '']);
  assert.deepEqual(build.alternateWeapons, ['Spear', '']);
  assert.equal(build.startingWeaponSet, 2);
  assert.deepEqual(longbowBuild.weapons, ['Greatsword', '']);
  assert.deepEqual(longbowBuild.alternateWeapons, ['Longbow', '']);
  assert.equal(longbowBuild.startingWeaponSet, 2);
  // The Longbow variant intentionally replaces only the Spear, preserving every gearing choice.
  assert.deepEqual({ ...savedLongbow, alternateWeapons: saved.alternateWeapons }, saved);

  assert.equal(alacrityPreset.benchmarkDps, 37836);
  assert.equal(Object.hasOwn(savedAlacrity, 'rotation'), false);
  assert.deepEqual(alacrityBuild.weapons, ['Greatsword', '']);
  assert.deepEqual(alacrityBuild.alternateWeapons, ['Spear', '']);
  assert.deepEqual(alacrityBuild.gear, {
    Helm: "Berserker's",
    Shoulders: "Berserker's",
    Chest: "Diviner's",
    Gloves: "Berserker's",
    Leggins: "Dragon's",
    Boots: "Berserker's",
    Amulet: "Dragon's",
    Ring1: "Dragon's",
    Ring2: "Dragon's",
    Accessory1: "Dragon's",
    Accessory2: "Dragon's",
    Back: "Dragon's",
    Weapon1: "Dragon's",
    Weapon2: "Diviner's"
  });
  assert.deepEqual(alacrityBuild.weaponSigils, [
    ['Force', 'Impact'],
    ['Force', 'Concentration']
  ]);
  assert.deepEqual(alacrityBuild.specializations[2], {
    name: 'Luminary',
    traits: '3-1-2'
  });
  assert.deepEqual(alacrityBuild.infusions, [
    { stat: 'Power', count: 18 },
    { stat: 'Precision', count: 0 },
    { stat: 'Condition Damage', count: 0 }
  ]);
  assert.equal(alacrityRotation.metadata.log, alacrityPreset.dpsReportUrl);
  assert.equal(alacrityRotation.rotation.length, 238);
  assert.deepEqual(alacrityRotation.rotation.slice(0, 4), [
    { name: 'Radiant Courage', offset: 100 },
    'Enter Radiant Forge',
    'Daring Advance',
    { name: '__combat_start', offset: 682 }
  ]);
  assert.equal(
    alacrityRotation.rotation.filter((step) => typeof step === 'object' && step.interruptMs != null).length,
    5
  );
  assert.equal(alacrityRotationNames.filter((name) => name === 'Glaring Burst').length, 22);
  assert.deepEqual(alacrityRotationNames.slice(-3), ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin']);
  assert.deepEqual(
    radiantBulwarks.map((step) => step.interruptMs),
    [241, 201, 199, 195, 200]
  );
  assert.equal(alacrityRotation.metadata.benchmarkDamage, 3975695);
});

test('Revenant Power Renegade Greatsword default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const renegade = manifest.find((section) => section.section === 'Renegade');
  const [preset] = renegade.presets;
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.label, 'Power (Greatsword / SwSw)');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.equal(build.specializations[2].name, 'Renegade');
  assert.deepEqual(build.weapons, ['Greatsword', '']);
  assert.deepEqual(build.alternateWeapons, ['Sword', 'Sword']);
  assert.deepEqual(build.selectedLegends, ['LegendaryAssassin', 'LegendaryRenegade']);
  assert.equal(build.startingLegend, 'LegendaryAssassin');
});

test('Revenant Power Renegade Hammer default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const renegade = manifest.find((section) => section.section === 'Renegade');
  const preset = renegade.presets.find((candidate) => candidate.label === 'Power Renegade (Hammer / SwSw)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.build, 'Builds/revenant/b-power-renegade-hammer.json');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.equal(build.specializations[2].name, 'Renegade');
  assert.deepEqual(build.weapons, ['Hammer', '']);
  assert.deepEqual(build.alternateWeapons, ['Sword', 'Sword']);
  assert.equal(build.relic, 'Brawler');
  assert.deepEqual(build.selectedLegends, ['LegendaryAssassin', 'LegendaryRenegade']);
  assert.equal(build.startingLegend, 'LegendaryAssassin');
});

test('Revenant Power Vindicator Greatsword defaults resolve', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const vindicator = manifest.find((section) => section.section === 'Vindicator');
  const energyPreset = vindicator.presets.find((candidate) => candidate.label === 'Power (Greatsword / SwSw - Energy)');
  const hydroPreset = vindicator.presets.find((candidate) => candidate.label === 'Power (Greatsword / SwSw - Hydro)');
  const [energySaved, hydroSaved, replay] = await Promise.all([
    readFile(new URL(`../../${energyPreset.build}`, import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL(`../../${hydroPreset.build}`, import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL(`../../${energyPreset.rotation}`, import.meta.url), 'utf8').then(JSON.parse)
  ]);
  const energyBuild = adapter.toApplicationBuild(energySaved);
  const hydroBuild = adapter.toApplicationBuild(hydroSaved);
  const dodgeCount = replay.rotation.filter((entry) => (entry.name || entry) === 'Dodge').length;

  assert.equal(energyPreset.build, 'Builds/revenant/b-power-vindicator-greatsword-energy.json');
  assert.equal(hydroPreset.build, 'Builds/revenant/b-power-vindicator-greatsword-hydro.json');
  assert.equal(energyPreset.rotation, 'Rotations/revenant/r-power-vindicator-greatsword-benchmark.json');
  assert.equal(Object.hasOwn(hydroPreset, 'rotation'), false);
  assert.equal(Object.hasOwn(energySaved, 'rotation'), false);
  assert.equal(Object.hasOwn(hydroSaved, 'rotation'), false);
  assert.equal(energyBuild.profession, 'revenant');
  assert.deepEqual(energyBuild.specializations, [
    { name: 'Devastation', traits: '2-2-2' },
    { name: 'Invocation', traits: '2-1-3' },
    { name: 'Vindicator', traits: '1-1-1' }
  ]);
  assert.deepEqual(energyBuild.weapons, ['Sword', 'Sword']);
  assert.deepEqual(energyBuild.alternateWeapons, ['Greatsword', '']);
  assert.deepEqual(energyBuild.weaponSigils, [
    ['Force', 'Air'],
    ['Force', 'Energy']
  ]);
  assert.deepEqual(hydroBuild.weaponSigils, [
    ['Force', 'Air'],
    ['Force', 'Hydromancy']
  ]);
  assert.deepEqual(energySaved.gear, hydroSaved.gear);
  assert.deepEqual(energySaved.gear, {
    Helm: "Berserker's",
    Shoulders: "Berserker's",
    Chest: "Berserker's",
    Gloves: "Berserker's",
    Leggins: "Berserker's",
    Boots: "Berserker's",
    Amulet: "Berserker's",
    Ring1: "Berserker's",
    Ring2: "Berserker's",
    Accessory1: "Berserker's",
    Accessory2: "Berserker's",
    Back: "Dragon's",
    Weapon1: "Berserker's",
    Weapon2: "Berserker's"
  });
  assert.equal(energyBuild.relic, 'Thief');
  assert.equal(hydroBuild.relic, 'Thief');
  assert.deepEqual(energyBuild.selectedLegends, ['LegendaryAlliance', 'LegendaryAssassin']);
  assert.equal(energyBuild.startingLegend, 'LegendaryAlliance');
  assert.equal(energyBuild.startingWeaponSet, 2);
  assert.equal(dodgeCount, 25);
  assert.deepEqual(replay.rotation.slice(6, 9), [
    { name: 'Mist Swing', skillId: 62913, offset: 41 },
    { name: 'Swap Legends', offset: 397 },
    'Swap Weapons'
  ]);
});

test('Revenant Condition Renegade Shortbow default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const renegade = manifest.find((section) => section.section === 'Renegade');
  const preset = renegade.presets.find((candidate) => candidate.label === 'Condition (Shortbow / Mace-Axe)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.build, 'Builds/revenant/b-condi-renegade-shortbow-mace-axe.json');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.deepEqual(build.specializations, [
    { name: 'Corruption', traits: '1-3-1' },
    { name: 'Invocation', traits: '2-1-2' },
    { name: 'Renegade', traits: '2-2-2' }
  ]);
  assert.deepEqual(build.weapons, ['Shortbow', '']);
  assert.deepEqual(build.alternateWeapons, ['Mace', 'Axe']);
  assert.deepEqual(build.selectedLegends, ['LegendaryRenegade', 'LegendaryDemon']);
  assert.equal(build.startingLegend, 'LegendaryRenegade');
  assert.equal(build.startingWeaponSet, 2);
});

test('Revenant Condition Renegade Spear default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const renegade = manifest.find((section) => section.section === 'Renegade');
  const preset = renegade.presets.find((candidate) => candidate.label === 'Condition (Mace-Axe / Spear)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.build, 'Builds/revenant/b-condi-renegade-spear-mace-axe.json');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.deepEqual(build.specializations, [
    { name: 'Corruption', traits: '1-3-1' },
    { name: 'Invocation', traits: '2-3-2' },
    { name: 'Renegade', traits: '2-2-2' }
  ]);
  assert.deepEqual(build.weapons, ['Mace', 'Axe']);
  assert.deepEqual(build.alternateWeapons, ['Spear', '']);
  assert.deepEqual(build.weaponSigils, [
    ['Geomancy', 'Torment'],
    ['Doom', 'Earth']
  ]);
  assert.deepEqual(build.selectedLegends, ['LegendaryRenegade', 'LegendaryDemon']);
  assert.equal(build.startingLegend, 'LegendaryRenegade');
  assert.equal(build.startingWeaponSet, 1);
});

test('Revenant Condition Quickness Herald default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const herald = manifest.find((section) => section.section === 'Herald');
  const preset = herald.presets.find((candidate) => candidate.label === 'Condition Quickness (Shortbow / Mace-Axe)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.build, 'Builds/revenant/b-condi-quick-herald-shortbow-mace-axe.json');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.deepEqual(build.specializations, [
    { name: 'Corruption', traits: '1-3-1' },
    { name: 'Invocation', traits: '2-1-1' },
    { name: 'Herald', traits: '2-1-1' }
  ]);
  assert.deepEqual(build.weapons, ['Shortbow', '']);
  assert.deepEqual(build.alternateWeapons, ['Mace', 'Axe']);
  assert.deepEqual(build.weaponSigils, [
    ['Geomancy', 'Doom'],
    ['Torment', 'Earth']
  ]);
  assert.deepEqual(build.selectedLegends, ['LegendaryDragon', 'LegendaryDemon']);
  assert.equal(build.startingLegend, 'LegendaryDragon');
  assert.equal(build.startingWeaponSet, 1);
});

test('Revenant Condition Conduit Mistfire default build resolves', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../Builds/revenant/manifest.json', import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const conduit = manifest.find((section) => section.section === 'Conduit');
  const preset = conduit.presets.find((candidate) => candidate.label === 'Condition (Mistfire)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const build = adapter.toApplicationBuild(saved);

  assert.equal(preset.build, 'Builds/revenant/b-condi-conduit-mistfire.json');
  assert.equal(Object.hasOwn(saved, 'rotation'), false);
  assert.equal(build.profession, 'revenant');
  assert.deepEqual(build.specializations, [
    { name: 'Corruption', traits: '1-1-1' },
    { name: 'Invocation', traits: '2-2-2' },
    { name: 'Conduit', traits: '3-2-1' }
  ]);
  assert.deepEqual(build.weapons, ['Spear', '']);
  assert.deepEqual(build.alternateWeapons, ['Mace', 'Axe']);
  assert.deepEqual(build.selectedLegends, ['LegendaryDemon', 'LegendaryEntity']);
  assert.equal(build.startingLegend, 'LegendaryEntity');
  assert.equal(build.startingWeaponSet, 2);
});

test('Necromancer preset builds keep rotation data separate', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../Builds/necromancer/manifest.json', import.meta.url), 'utf8')
  );
  const adapter = await loadProfessionAppAdapter('necromancer');
  const presets = manifest.flatMap((section) =>
    section.presets.map((preset) => ({
      ...preset,
      section: section.section
    }))
  );
  const harbingerPresets = manifest.find((section) => section.section === 'Harbinger').presets;

  assert.deepEqual(
    manifest.map((section) => section.section),
    ['Scourge', 'Reaper', 'Ritualist', 'Harbinger']
  );
  assert.deepEqual(
    presets.map((preset) => preset.label),
    [
      'Condition (Pistol / Torch + Scepter / Torch)',
      'Power (Greatsword / Spear)',
      'Condition (Dagger / Sword + Spear)',
      'Condition (Fields - Pistol / Torch + Greatsword)',
      'Power (Greatsword / Spear)',
      'Power (Greatsword / Spear)',
      'Condition Quickness (Pistol / Dagger + Scepter / Torch)',
      'Condition (Pistol / Torch + Scepter / Dagger)'
    ]
  );
  for (const preset of presets) {
    const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
    const build = adapter.toApplicationBuild(saved);

    assert.equal(Object.hasOwn(saved, 'rotation'), false);
    assert.equal(build.profession, 'necromancer');
    assert.equal(build.specializations[2].name, preset.section);
    assert.equal(build.weapons.length, 2);
    assert.equal(build.alternateWeapons.length, 2);
  }

  const power = JSON.parse(await readFile(new URL(`../../${harbingerPresets[0].build}`, import.meta.url), 'utf8'));

  assert.deepEqual(power.weapons, ['Greatsword', '']);
  assert.deepEqual(power.alternateWeapons, ['Spear', '']);
  assert.equal(power.rune, 'Dragonhunter');
  assert.deepEqual(power.weaponSigils, [
    ['Force', 'Accuracy'],
    ['Force', 'Accuracy']
  ]);
  assert.equal(power.selectedSkills.Utility1, 'Well of Suffering');
  assert.equal(power.selectedSkills.Utility2, 'Well of Darkness');
});

test('build import and export leave rotation state separate', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const current = createDefaultBuild(adapter);

  current.rotation = ['Keep this rotation'];
  const imported = {
    ...createDefaultBuild(adapter),
    rune: 'Krait',
    rotation: ['Do not import this rotation']
  };

  const loaded = replaceBuildConfiguration(imported, current, adapter);
  const exported = getBuildExportPayload(loaded);

  assert.deepEqual(loaded.rotation, ['Keep this rotation']);
  assert.equal(loaded.rune, 'Krait');
  assert.equal(Object.hasOwn(exported, 'rotation'), false);
  assert.deepEqual(current.rotation, ['Keep this rotation']);
});

test('Mesmer and Guardian palettes show only equipped weapon-set rows', () => {
  const appFor = (profession, build) => ({
    profession,
    build,
    skills: profession.catalog.skills,
    adapter: {
      eliteSpecialization: () => '',
      isSkillAvailable: () => true
    },
    weaponData: createProfessionWeaponData(profession.catalog, {
      weaponData: WEAPON_DATA
    })
  });

  for (const app of [
    appFor(mesmerProfession, createMesmerBuildDefaults()),
    appFor(guardianProfession, createGuardianBuildDefaults())
  ]) {
    const setOne = weaponPaletteRows(app, 1);
    const setTwo = weaponPaletteRows(app, 2);

    assert.deepEqual(
      setOne.map((row) => row.label),
      ['W1', 'W2']
    );
    assert.deepEqual(
      setTwo.map((row) => row.label),
      ['W1', 'W2']
    );
    assert.deepEqual(
      setOne.map((row) => row.active),
      [true, false]
    );
    assert.deepEqual(
      setTwo.map((row) => row.active),
      [false, true]
    );
    assert.equal(
      setOne.every((row) => row.skills.length > 0),
      true
    );

    app.build.alternateWeapons = ['', ''];
    assert.deepEqual(
      weaponPaletteRows(app, 1).map((row) => row.label),
      ['W1']
    );
    assert.equal(
      paletteActionSkills(app).some((skill) => skill.name === 'Swap Weapons'),
      false
    );
  }
});

test('Mesmer palette advances through autoattack chain skills', () => {
  const config = {
    ...createDefaultConfig(),
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    initialResource: 0
  };
  const skill = (name) => mesmerProfession.catalog.skillsByName.get(name);
  const availabilityAfter = (rotation) => {
    const result = simulateMesmer(rotation, config);
    const chainState = result.endState.profession.autoattackChains;

    return ['Mind Slash', 'Mind Gash', 'Mind Spike'].map((name) =>
      autoattackChainSkillAvailable(skill(name), chainState)
    );
  };

  assert.deepEqual(availabilityAfter(['Mind Slash']), [false, true, false]);
  assert.deepEqual(availabilityAfter(['Mind Slash', 'Mind Gash']), [false, false, true]);
});

test('weapon palette families display one live autoattack or flip skill', () => {
  const autoRoot = { id: 1, name: 'First Strike', chainRoot: 1 };
  const autoSecond = { id: 2, name: 'Second Strike', chainRoot: 1 };
  const flipRoot = { id: 3, name: 'Counter Stance', flipSkillId: 4 };
  const flip = { id: 4, name: 'Counter Attack', flipParentId: 3 };
  const skills = [autoRoot, autoSecond, flipRoot, flip];
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const app = {
    build: { rotation: [] },
    skills,
    skillById,
    profession: { catalog: { skillsById: skillById } },
    results: {
      endState: {
        profession: {
          autoattackChains: { 1: 2 },
          availableFlips: { 4: true }
        }
      }
    }
  };

  assert.deepEqual(
    displayedWeaponSkills(app, skills).map((skill) => skill.name),
    ['Second Strike', 'Counter Attack']
  );

  app.results.endState.profession = { autoattackChains: {}, availableFlips: {} };
  assert.deepEqual(
    displayedWeaponSkills(app, skills).map((skill) => skill.name),
    ['First Strike', 'Counter Stance']
  );
});

test('palette flip projection infers catalog children and honors timed expiry', () => {
  const parent = { id: 10, name: 'Opening Skill', flipSkillId: 11 };
  const child = { id: 11, name: 'Follow-up Skill' };
  const skills = [parent, child];
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const app = {
    skills,
    skillById: skillsById,
    profession: { catalog: { skills, skillsById } },
    results: {
      endState: {
        time: 1500,
        profession: { availableFlips: { 11: 2 } }
      }
    }
  };

  assert.deepEqual(
    displayedFlipSkills(app, [parent]).map((skill) => skill.name),
    ['Follow-up Skill']
  );

  app.results.endState.time = 2000;
  assert.deepEqual(
    displayedFlipSkills(app, [parent]).map((skill) => skill.name),
    ['Opening Skill']
  );
});

test('Mesmer weapon flips replace and restore their parent palette tile', () => {
  const config = {
    ...createDefaultConfig(),
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    initialResource: 0
  };
  const parent = mesmerProfession.catalog.skillsByName.get('Illusionary Counter');
  const flip = mesmerProfession.catalog.skillsByName.get('Counterspell');
  const app = {
    build: { rotation: [] },
    skills: mesmerProfession.catalog.skills,
    skillById: mesmerProfession.catalog.skillsById,
    profession: mesmerProfession,
    results: null
  };
  const displayedAfter = (rotation) => {
    app.results = simulateMesmer(rotation, config);

    return displayedWeaponSkills(app, [parent, flip]).map((skill) => skill.name);
  };

  assert.deepEqual(displayedAfter([]), ['Illusionary Counter']);
  assert.deepEqual(displayedAfter(['Illusionary Counter']), ['Counterspell']);
  assert.deepEqual(displayedAfter(['Illusionary Counter', 'Counterspell']), ['Illusionary Counter']);
});

test('damage result rows reuse the icons shown for generated procs', () => {
  const earthIcon = 'earth.png';
  const nourishmentIcon = 'nourishment.png';
  const phantasmalBladesIcon = 'phantasmal-blades.png';
  const meltdownIcon = 'meltdown.png';
  const explicitIcon = 'soul-shards.png';
  const app = {
    attributeData: {
      activeTraits: [
        {
          name: 'Phantasmal Blades',
          icon: phantasmalBladesIcon
        }
      ]
    },
    results: {
      procSteps: [
        {
          type: 'sigil_proc',
          skill: 'Sigil of Earth',
          sourceSkill: 'Bladecall',
          icon: earthIcon
        },
        {
          type: 'food_proc',
          skill: 'Nourishment',
          sourceSkill: 'Bladecall',
          icon: nourishmentIcon
        },
        {
          type: 'trait_proc',
          skill: 'Phantasmal Blades',
          sourceSkill: 'Phantasmal Lancer'
        },
        {
          type: 'trait_proc',
          skill: 'Meltdown',
          sourceSkill: 'Devouring Cut',
          icon: meltdownIcon
        }
      ]
    },
    skillByName: new Map(),
    skills: []
  };

  assert.equal(resultSkillIcon(app, { name: 'Sigil of Earth' }), earthIcon);
  assert.equal(resultSkillIcon(app, { name: 'Nourishment' }), nourishmentIcon);
  assert.equal(resultSkillIcon(app, { name: 'Phantasmal Blade' }), phantasmalBladesIcon);
  assert.equal(resultSkillIcon(app, { name: 'Cascading Corruption' }), meltdownIcon);
  assert.equal(resultSkillIcon(app, { name: 'Soul Shards', icon: explicitIcon }), explicitIcon);
  assert.equal(
    resultSkillIcon(app, { name: 'Relic of the Shackles' }),
    'https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png'
  );
});

test('clone attack damage rows use their weapon skill icons', () => {
  const windsIcon = 'winds-of-chaos.png';
  const etherBoltIcon = 'ether-bolt.png';
  const app = {
    attributeData: { activeTraits: [] },
    results: { procSteps: [] },
    skillByName: new Map([
      ['Winds of Chaos', { icon: windsIcon }],
      ['Ether Bolt', { icon: etherBoltIcon }]
    ]),
    skills: []
  };

  assert.equal(resultSkillIcon(app, { name: 'Clone: Winds of Chaos' }), windsIcon);
  assert.equal(resultSkillIcon(app, { name: 'Clone: Ether Bolt' }), etherBoltIcon);
});

test('Mesmer weapon palette displays only the current autoattack chain step', () => {
  const build = createMesmerBuildDefaults();

  build.specializations[2] = { name: 'Mirage', traits: '1-1-1' };
  build.weapons = ['Axe', 'Sword'];
  const app = {
    profession: mesmerProfession,
    build,
    skills: mesmerProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => 'Mirage',
      isSkillAvailable: () => true
    },
    weaponData: createProfessionWeaponData(mesmerProfession.catalog, {
      weaponData: WEAPON_DATA
    })
  };

  assert.deepEqual(
    weaponPaletteRows(app, 1)[0]
      .skills.filter((skill) => skill.chainRoot === 44791)
      .map((skill) => skill.name),
    ['Lacerating Chop']
  );
});

test('target-health timeline markers are inserted after the crossing hit', () => {
  const result = {
    steps: [
      { ri: 0, start: 0 },
      { ri: 1, start: 1000 },
      { ri: 2, start: 2000 }
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

test('weapon-set palette groups render side by side in set order', () => {
  const html = weaponPaletteStackHtml(['<div data-weapon-set="1">W1</div>', '<div data-weapon-set="2">W2</div>']);

  assert.match(html, /data-role="weapon-set-stack"/);
  assert.match(html, /flex-direction:row/);
  assert.match(html, /flex-wrap:wrap/);
  assert.equal(html.indexOf('data-weapon-set="1"') < html.indexOf('data-weapon-set="2"'), true);
});

test('weapon actions stay ordered beside the stacked weapon sets', () => {
  const mesmer = {
    profession: mesmerProfession,
    build: createMesmerBuildDefaults(),
    skills: mesmerProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => 'Mirage',
      isSkillAvailable: () => true
    }
  };
  const guardian = {
    profession: guardianProfession,
    build: createGuardianBuildDefaults(),
    skills: guardianProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => 'Firebrand',
      isSkillAvailable: () => true
    }
  };
  const mesmerActions = paletteActionSkills(mesmer);

  assert.deepEqual(
    mesmerActions.map((skill) => skill.name),
    ['Dodge / Mirage Cloak', 'Pick Up Mirage Mirror', 'Swap Weapons']
  );
  const mirrorIcon = 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png';

  assert.equal(mesmerActions.find((skill) => skill.name === 'Pick Up Mirage Mirror')?.icon, mirrorIcon);
  assert.equal(ACTION_ICONS['Pick Up Mirage Mirror'], mirrorIcon);
  assert.equal(ACTION_ICONS['Mirage Mirror'], mirrorIcon);
  assert.equal(resultSkillIcon(mesmer, { name: 'Mirage Mirror', skillId: 44677 }), mirrorIcon);
  const troubadour = {
    ...mesmer,
    adapter: {
      ...mesmer.adapter,
      eliteSpecialization: () => 'Troubadour'
    }
  };

  assert.deepEqual(
    paletteActionSkills(troubadour).map((skill) => skill.name),
    ['Dodge', 'Swap Weapons']
  );
  assert.deepEqual(
    paletteActionSkills(guardian).map((skill) => skill.name),
    ['Swap Weapons']
  );

  const html = weaponPaletteSectionHtml(['<div>W1</div>', '<div>W2</div>'], '<div>Act</div>', '<div>Legends</div>');

  assert.match(html, /data-role="weapon-palette-section"/);
  assert.equal(html.indexOf('weapon-set-stack') < html.indexOf('Act'), true);
  assert.equal(html.indexOf('Act') < html.indexOf('Legends'), true);
});

test('Engineer weapon swap stays visible as a state-gated kit exit', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const engineer = {
    profession: adapter.profession,
    build: createEngineerBuildDefaults(),
    skills: adapter.profession.catalog.skills,
    skillById: adapter.profession.catalog.skillsById,
    skillByName: adapter.profession.catalog.skillsByName,
    adapter
  };

  assert.equal(
    paletteActionSkills(engineer).some((skill) => skill.name === 'Swap Weapons'),
    true
  );
  const swapWeapons = engineer.skillById.get(-3);

  assert.equal(
    engineer.adapter.isSkillAvailable(engineer.skillByName.get('Rifle Burst Grenade'), { specialization: 'Core' }),
    false
  );
  assert.equal(
    engineer.profession.ui.isPaletteSkillAvailable({ professionState: { activeKit: '' } }, swapWeapons),
    false
  );
  engineer.results = {
    endState: {
      profession: { activeKit: 'Grenade Kit' }
    }
  };
  assert.equal(
    paletteActionSkills(engineer).some((skill) => skill.name === 'Swap Weapons'),
    true
  );
  assert.equal(
    engineer.profession.ui.isPaletteSkillAvailable({ professionState: { activeKit: 'Grenade Kit' } }, swapWeapons),
    true
  );
  assert.equal(
    resultSkillIcon(engineer, { name: 'Jade Energy Shot' }),
    'https://render.guildwars2.com/file/' + '73600241FA662501C5D617719A7B4792F30B2846/2503622.png'
  );
  assert.equal(
    resultSkillIcon(engineer, {
      name: 'Mech trait strike',
      skillId: 63185
    }),
    'https://render.guildwars2.com/file/' + '02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png'
  );
  assert.equal(
    resultSkillIcon(engineer, {
      name: 'Bloodstone Explosion',
      sourceId: 'relic.bloodstone'
    }),
    'https://render.guildwars2.com/file/' + 'A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png'
  );
  engineer.results = {
    ...engineer.results,
    procSteps: [
      {
        type: 'trait_proc',
        skill: 'Orbital Command Strike',
        sourceSkill: 'Shrapnel Grenade'
      }
    ]
  };
  assert.equal(
    resultSkillIcon(engineer, { name: 'Orbital Command Strike' }),
    engineer.skillByName.get('Orbital Command Strike').icon
  );
  assert.notEqual(
    resultSkillIcon(engineer, { name: 'Orbital Command Strike' }),
    engineer.skillByName.get('Shrapnel Grenade').icon
  );
  assert.equal(
    resolveProcIcon(engineer, {
      type: 'trait_proc',
      skill: 'Rapacious Strain',
      sourceSkill: 'Flux State',
      icon: 'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
    }),
    'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
  );
  assert.deepEqual(
    timelineWeaponRows(
      ['Grenade Kit', 'Swap Weapons', 'Blunderbuss'].map((name) => ({
        type: 'cast',
        skillId: engineer.skillByName.get(name).id
      })),
      {
        startingWeaponSet: 1,
        weaponSwapChangesSet: false,
        skillName: (entry) => engineer.skillById.get(entry.skillId)?.name || ''
      }
    ).map((row) => row.weaponSet),
    [1, 1]
  );
  const flips = rotationUtilityFlipByParent(engineer);

  for (const [parent, flip] of [
    ['Throw Mine', 'Detonate'],
    ['Rifle Turret', 'Detonate Rifle Turret'],
    ['Flame Turret', 'Detonate Flame Turret'],
    ['Net Turret', 'Detonate Net Turret'],
    ['Thumper Turret', 'Detonate Thumper Turret'],
    ['Healing Turret', 'Detonate Healing Turret'],
    ['Rocket Turret', 'Detonate Rocket Turret']
  ]) {
    assert.equal(flips.get(parent)?.name, flip, parent);
  }

  assert.equal(flips.has('Grenade Kit'), false);
});

test('Engineer kits register distinct weapon lines in the timeline', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const build = createEngineerBuildDefaults();
  const skillByName = adapter.profession.catalog.skillsByName;
  const rotationNames = [
    'Grenade Kit',
    'Shrapnel Grenade',
    'Flamethrower',
    'Flame Blast',
    'Stow Flamethrower',
    'Blunderbuss'
  ];
  const rotation = rotationNames.map((name) => ({ type: 'cast', skillId: skillByName.get(name).id }));
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponSwapChangesSet: false,
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
    rows.map((row) => row.weaponLine),
    [null, 'Grenade Kit', 'Flamethrower', null]
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3, 4], [5]]
  );
  assert.ok(rows.every((row) => row.weaponSet === 1));
});

test('Firebrand mantra flips replace their selected skill-bar parent', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const skillById = adapter.profession.catalog.skillsById;
  const skillByName = adapter.profession.catalog.skillsByName;
  const parent = skillByName.get('Mantra of Flame');
  const normal = skillByName.get('Flame Rush');
  const final = skillByName.get('Flame Surge');
  const app = {
    skillById,
    results: { endState: { profession: { availableFlips: {} } } }
  };

  assert.equal(skillBarDisplaySkill(app, parent), parent);
  app.results.endState.profession.availableFlips[normal.id] = Infinity;
  assert.equal(skillBarDisplaySkill(app, parent), normal);
  delete app.results.endState.profession.availableFlips[normal.id];
  app.results.endState.profession.availableFlips[final.id] = Infinity;
  assert.equal(skillBarDisplaySkill(app, parent), final);
  delete app.results.endState.profession.availableFlips[final.id];
  assert.equal(skillBarDisplaySkill(app, parent), parent);
});

test('shared palettes reject supplemental effects from weapon and action rows', () => {
  const app = {
    profession: {
      catalog: {
        weaponHands: new Map([['Rifle', '2h']])
      }
    },
    build: {
      weapons: ['Rifle', ''],
      alternateWeapons: ['', '']
    },
    skills: [
      {
        id: 1,
        name: 'Rifle Shot',
        type: 'Weapon',
        slot: 'Weapon_1',
        weapon: 'Rifle'
      },
      {
        id: 2,
        name: 'Temporary Bundle Shot',
        type: 'Weapon',
        slot: 'Weapon_1',
        weapon: ''
      },
      {
        id: 3,
        name: 'Trait Proc',
        type: 'Action',
        slot: 'Action'
      },
      {
        id: -3,
        name: 'Swap Weapons',
        type: 'Action',
        slot: 'Action'
      }
    ],
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true
    }
  };

  assert.deepEqual(
    weaponSkills(app).map((skill) => skill.name),
    ['Rifle Shot']
  );
  assert.deepEqual(
    paletteActionSkills(app).map((skill) => skill.name),
    []
  );
});

test("weaponmaster palettes keep the active spec's weapon-skill variant", () => {
  // Both Bladecall variants share a slot and pass availability under
  // weaponmaster training; the off-spec Troubadour rework (62560) sorts first
  // in catalog order but is absent from a non-Troubadour runtime catalog, so it
  // must not win the name-dedup and poison the rotation with an unknown id.
  const skills = [
    {
      id: 62560,
      name: 'Bladecall',
      type: 'Weapon',
      slot: 'Weapon_2',
      weapon: 'Dagger',
      specialization: 'Troubadour'
    },
    {
      id: 69311,
      name: 'Bladecall',
      type: 'Weapon',
      slot: 'Weapon_2',
      weapon: 'Dagger',
      specialization: ''
    }
  ];
  const makeApp = (specialization) => ({
    profession: { catalog: { weaponHands: new Map([['Dagger', 'mh']]) } },
    build: { weapons: ['Dagger', ''], alternateWeapons: ['', ''] },
    skills,
    adapter: {
      eliteSpecialization: () => specialization,
      isSkillAvailable: () => true
    }
  });

  assert.deepEqual(
    weaponSkills(makeApp('Chronomancer')).map((skill) => skill.id),
    [69311]
  );
  assert.deepEqual(
    weaponSkills(makeApp('Troubadour')).map((skill) => skill.id),
    [62560]
  );
});
