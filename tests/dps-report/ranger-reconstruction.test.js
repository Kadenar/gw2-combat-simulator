import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerCatalog } from '../../js/games/gw2/content/professions/ranger/catalog.js';
import { parseDpsReport } from '../../js/games/gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '../../js/games/gw2/integrations/logs/dps-report/rotation/index.js';

// Fixtures retain only the Ranger signals needed to prove each report correction.
function reportFixture(profession, rotation, skillMap, options = {}) {
  const start = options.start ?? 0;
  const end = options.end ?? 10_000;
  return parseDpsReport({
    ...(options.damage ? { targets: [{}] } : {}),
    players: [
      {
        name: `Fixture ${profession}`,
        profession,
        rotation,
        ...(options.damage ? { targetDamageDist: [[options.damage]] } : {})
      }
    ],
    phases: [{ start, end, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap
  });
}

test('merges Untamed smash rows and removes the simulator-owned Lesser Sic Em proc', () => {
  const report = reportFixture(
    'Untamed',
    [
      { id: 63197, skills: [{ castTime: 0, duration: 250, timeGained: 710 }] },
      { id: 63224, skills: [{ castTime: 250, duration: 30, timeGained: -1 }] },
      { id: 79348, skills: [{ castTime: 400, duration: 0, timeGained: 0 }] }
    ],
    {
      s63197: { name: 'Unleashed Overbearing Smash' },
      s63224: { name: 'Unleashed Overbearing Smash (Leap)' },
      s79348: { name: 'Lesser Sic Em' }
    }
  );

  const result = reconstructDpsReportRotation(report, rangerCatalog);
  const smashes = result.actions.filter((action) => action.name === 'Unleashed Overbearing Smash');

  assert.equal(smashes.length, 1);
  assert.equal(smashes[0].durationMs, 280);
  assert.equal(smashes[0].status, 'interrupted');
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 79348),
    false
  );
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
});

test('orders recovered Cyclone Bow state around both Galeshot opener forms', () => {
  const cases = [
    {
      rotation: [
        { id: 77319, skills: [{ castTime: 0, duration: 680, timeGained: 0 }] },
        { id: 77213, skills: [{ castTime: 700, duration: 0, timeGained: 0 }] }
      ],
      damage: [{ id: 77319, connectedHits: 3 }],
      expected: ['Summon Cyclone Bow', 'Bluster']
    },
    {
      rotation: [
        { id: 12469, skills: [{ castTime: 0, duration: 1000, timeGained: 0 }] },
        { id: 77213, skills: [{ castTime: 1100, duration: 0, timeGained: 0 }] }
      ],
      expected: ['Barrage', 'Summon Cyclone Bow']
    }
  ];
  const skillMap = {
    s12469: { name: 'Barrage' },
    s77319: { name: 'Bluster' },
    s77213: { name: 'Dismiss Cyclone Bow', isInstantCast: true }
  };

  for (const fixture of cases) {
    const report = reportFixture('Galeshot', fixture.rotation, skillMap, {
      start: 100,
      damage: fixture.damage
    });
    const result = reconstructDpsReportRotation(report, rangerCatalog);

    assert.deepEqual(
      result.rotation.slice(0, 2).map((command) => command.name),
      fixture.expected
    );
  }
});

test('normalizes Galeshot swap, pet, and automatic report signals', () => {
  const report = reportFixture(
    'Galeshot',
    [
      { id: 76787, skills: [{ castTime: 0, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 1, duration: 0, timeGained: 0 }] },
      { id: 77319, skills: [{ castTime: 10, duration: 680, timeGained: 0 }] },
      { id: 77213, skills: [{ castTime: 700, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 701, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 1000, duration: 0, timeGained: 0 }] },
      { id: -28, skills: [{ castTime: 1100, duration: 0, timeGained: 0 }] },
      { id: 76905, skills: [{ castTime: 1200, duration: 0, timeGained: 0 }] },
      { id: 12703, skills: [{ castTime: 1300, duration: 333, timeGained: 0 }] },
      { id: 41156, skills: [{ castTime: 1700, duration: 1000, timeGained: 0 }] }
    ],
    {
      s76787: { name: 'Summon Cyclone Bow', isInstantCast: true },
      's-2': { name: 'Weapon Swap', isSwap: true, isInstantCast: true },
      s77319: { name: 'Bluster' },
      s77213: { name: 'Dismiss Cyclone Bow', isInstantCast: true },
      's-28': { name: 'Ranger Pet Spawned', isInstantCast: true },
      s76905: { name: 'Wuthering Wind', isInstantCast: true },
      s12703: { name: 'Regenerate' },
      s41156: { name: 'Fang Grapple' }
    },
    { damage: [{ id: 77319, connectedHits: 3 }] }
  );

  const result = reconstructDpsReportRotation(report, rangerCatalog);

  assert.equal(result.actions.filter((action) => action.name === 'Swap Weapons').length, 1);
  assert.equal(result.actions.filter((action) => action.name === 'Swap Pets').length, 1);
  assert.equal(
    result.actions.some((action) => [76905, 12703, 41156].includes(action.rawSkillId)),
    false
  );
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
});

test('recovers Galeshot casts only from packet totals and cast-sized bow gaps', () => {
  const report = reportFixture(
    'Galeshot',
    [
      { id: 76787, skills: [{ castTime: 0, duration: 0, timeGained: 0 }] },
      { id: 76807, skills: [{ castTime: 680, duration: 680, timeGained: 0 }] },
      { id: 77213, skills: [{ castTime: 1360, duration: 0, timeGained: 0 }] },
      { id: 76787, skills: [{ castTime: 2000, duration: 0, timeGained: 0 }] },
      { id: 77174, skills: [{ castTime: 2200, duration: 1000, timeGained: 0 }] },
      { id: 76757, skills: [{ castTime: 3880, duration: 320, timeGained: 0 }] },
      { id: 77213, skills: [{ castTime: 4200, duration: 0, timeGained: 0 }] }
    ],
    {
      s76787: { name: 'Summon Cyclone Bow', isInstantCast: true },
      s76807: { name: "Quarry's Peril" },
      s77213: { name: 'Dismiss Cyclone Bow', isInstantCast: true },
      s77174: { name: 'Supersonic Arrow' },
      s76757: { name: 'Mistral' }
    },
    {
      damage: [
        { id: 77319, connectedHits: 3 },
        { id: 76807, connectedHits: 2 }
      ]
    }
  );

  const result = reconstructDpsReportRotation(report, rangerCatalog);

  assert.deepEqual(
    result.actions.filter((action) => action.inferred).map((action) => action.name),
    ['Bluster', "Quarry's Peril"]
  );
  assert.match(result.warnings.join('\n'), /Recovered report evidence:.*Bluster.*Quarry's Peril/);
});
