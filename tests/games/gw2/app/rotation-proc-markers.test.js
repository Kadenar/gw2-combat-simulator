import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterLabel,
  procStackLabel,
  relicProcExpirationTimelineMarkers,
  relicProcTimelineMarkers,
  sigilProcTimelineMarkers,
  traitProcTimelineMarkers
} from '#gw2/app/rotation/timeline/model.js';
import { syncProcVisibility } from '#gw2/app/rotation/timeline/view.js';
import { resolveProcIcon } from '#gw2/app/shared/icons.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';

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

test('proc timeline markers follow their simulated activation times', () => {
  const result = {
    steps: [
      { ri: 0, skill: 'Opening Strike', start: 0, end: 600 },
      { ri: 1, skill: 'Follow-up', start: 700, end: 1200 },
      { ri: 2, skill: 'Finisher', start: 1300, end: 1800 }
    ],
    procSteps: [
      {
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 0
      },
      {
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 0
      },
      {
        type: 'sigil_proc',
        skill: 'Sigil of Air',
        sourceSkill: 'Opening Strike',
        detail: '',
        icon: 'air.png',
        start: 400
      },
      {
        type: 'trait_proc',
        skill: 'Trait Proc',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'trait.png',
        start: 800
      },
      {
        type: 'trait_proc',
        skill: 'Sovereign of Light',
        sourceSkill: 'Dazzling Hammer',
        detail: 'Light aura detonated',
        icon: 'sovereign.png',
        start: 800
      },
      {
        type: 'relic_proc',
        skill: 'Relic of Fireworks',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'fireworks.png',
        start: 700
      },
      {
        type: 'sigil_proc',
        skill: 'Sigil of Earth',
        sourceSkill: 'Follow-up',
        detail: '',
        icon: 'earth.png',
        start: 900
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
  assert.deepEqual(
    traitProcTimelineMarkers(result, 3).map((marker) => ({
      skill: marker.skill,
      insertionIndex: marker.insertionIndex
    })),
    [
      { skill: 'Trait Proc', insertionIndex: 2 },
      { skill: 'Sovereign of Light', insertionIndex: 2 }
    ]
  );
  assert.equal(procFilterLabel(result.procSteps[0]), 'Sigil of Air (Sigil)');
});

test('timed relic expiration markers merge refreshes and stay within the rotation', () => {
  const result = {
    rotationEndTime: 12,
    observationEndTime: 12,
    combatEndTime: 12,
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
        expiresAt: 7000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of Fireworks',
        sourceSkill: 'Follow-up',
        start: 5000,
        expiresAt: 11000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of the Claw',
        sourceSkill: 'Control',
        start: 2000,
        expiresAt: 10000
      },
      {
        type: 'relic_proc',
        skill: 'Relic of Peitha',
        sourceSkill: 'Shadowstep',
        start: 9000,
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

// Consuming a stack pool ends its pending lifetime without erasing unrelated or later natural expirations.
test('relic consumption cancels stale timeouts and makes subsequent buildup a fresh activation', () => {
  const volatility = (start, stacks, expiresAt) => ({
    type: 'relic_proc',
    skill: 'Bloodstone Volatility',
    start,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    effectState: { stacks, maximumStacks: 4 }
  });
  const result = {
    combatEndTime: 40,
    steps: [],
    procSteps: [
      volatility(1000, 3, 11000),
      volatility(1000, 0),
      { type: 'relic_proc', skill: 'Relic of Bloodstone', start: 1000, expiresAt: 9000 },
      volatility(9000, 1, 19000),
      volatility(20000, 3, 30000),
      volatility(21000, 0),
      volatility(22000, 1, 32000),
      // A later state clear must preserve a timeout that has already happened.
      volatility(33000, 0)
    ]
  };

  assert.deepEqual(
    relicProcExpirationTimelineMarkers(result).map(({ skill, start }) => ({ skill, start })),
    [
      { skill: 'Relic of Bloodstone', start: 9000 },
      { skill: 'Bloodstone Volatility', start: 19000 },
      { skill: 'Bloodstone Volatility', start: 32000 }
    ]
  );
  for (const start of [9000, 22000]) {
    assert.equal(relicProcTimelineMarkers(result).find((marker) => marker.start === start).refreshed, false);
  }
});

test('relic overlay markers flag activations that only refresh an active window', () => {
  const relic = (skill, start, expiresAt, effectState) => ({
    type: 'relic_proc',
    skill,
    sourceSkill: 'Strike',
    start,
    expiresAt,
    ...(effectState ? { effectState } : {})
  });
  const result = {
    steps: [{ ri: 0, skill: 'Strike', start: 0, end: 500 }],
    procSteps: [
      relic('Relic of the Claw', 1000, 9000),
      relic('Relic of the Claw', 4000, 12000),
      // An activation at the exact expiry starts a fresh window.
      relic('Relic of the Claw', 12000, 20000),
      relic('Relic of the Thief', 1000, 7000, { stacks: 4, maximumStacks: 5 }),
      relic('Relic of the Thief', 2000, 8000, { stacks: 5, maximumStacks: 5 }),
      relic('Relic of the Thief', 3000, 9000, { stacks: 5, maximumStacks: 5 })
    ]
  };

  assert.deepEqual(
    relicProcTimelineMarkers(result, 1).map((marker) => ({
      skill: marker.skill,
      start: marker.start,
      refreshed: marker.refreshed,
      stacks: procStackLabel(marker)
    })),
    [
      { skill: 'Relic of the Claw', start: 1000, refreshed: false, stacks: '' },
      { skill: 'Relic of the Thief', start: 1000, refreshed: false, stacks: '4/5' },
      { skill: 'Relic of the Thief', start: 2000, refreshed: false, stacks: '5/5' },
      { skill: 'Relic of the Thief', start: 3000, refreshed: true, stacks: '5/5' },
      { skill: 'Relic of the Claw', start: 4000, refreshed: true, stacks: '' },
      { skill: 'Relic of the Claw', start: 12000, refreshed: false, stacks: '' }
    ]
  );
});

test('proc visibility remains hidden after its first render', () => {
  const app = { patchId: 'current' };
  const procSteps = [{ type: 'trait_proc', skill: 'Sharper Images' }];
  const key = 'trait_proc:Sharper Images';

  const firstVisibility = syncProcVisibility(app, procSteps);

  assert.notEqual(app.procVisibility, app.procVisibilityKeys);
  firstVisibility.delete(key);

  const nextVisibility = syncProcVisibility(app, [...procSteps, { type: 'relic_proc', skill: 'Relic of Fireworks' }]);

  assert.equal(nextVisibility.has(key), false);
  assert.equal(nextVisibility.has('relic_proc:Relic of Fireworks'), true);
});

test('cooldown-reduction procs use a refresh icon and reduction badge', () => {
  const sourceIcon = 'https://example.com/source-skill.png';
  const app = {
    patch: patchSelectionFixture({
      skills: [{ name: 'Abyssal Strike', ...{ icon: sourceIcon } }]
    }),
    attributeData: { activeTraits: [] },
    activeCatalog: {
      skills: [{ name: 'Abyssal Strike', ...{ icon: sourceIcon } }]
    }
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
