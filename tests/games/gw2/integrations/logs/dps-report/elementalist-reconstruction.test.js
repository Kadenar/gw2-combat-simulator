import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';

const skill = (id, name, extras = {}) => ({ id, name, ...extras });

// These fixtures isolate the EI signals needed for each Elementalist recovery rule.
function reportFixture(profession, rotation, skillMap, extras = {}) {
  const end = extras.end ?? 10_000;

  return parseDpsReport({
    durationMS: end,
    players: [
      {
        name: `Fixture ${profession}`,
        account: 'Fixture.1234',
        profession,
        rotation,
        ...(extras.player || {})
      }
    ],
    targets: extras.targets || [],
    phases: [{ start: 0, end, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap
  });
}

test('tracks Elementalist attunements when resolving EI-only skill names', () => {
  const report = reportFixture(
    'Weaver',
    [
      { id: 5737, skills: [{ castTime: 0, duration: 600, timeGained: 0 }] },
      {
        id: 40183,
        skills: [
          { castTime: 100, duration: 0, timeGained: 0 },
          { castTime: 650, duration: 0, timeGained: 0 }
        ]
      },
      { id: 90_001, skills: [{ castTime: 600, duration: 0, timeGained: 0 }] }
    ],
    {
      s5737: { name: 'Lightning Storm' },
      s40183: { name: 'Primordial Stance', isInstantCast: true },
      s90001: { name: 'Earth Air Attunement', isInstantCast: true, isSwap: true }
    }
  );
  const catalog = {
    skills: [
      skill(ID.GLYPH_OF_STORMS_AIR, 'Glyph of Storms (Air)', {
        type: 'Utility',
        attunement: 'Air',
        castTimeMs: 600
      }),
      skill(ID.PRIMORDIAL_STANCE_AIR, 'Primordial Stance (Air)', {
        type: 'Utility',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.EARTH_ATTUNEMENT, 'Earth Attunement', {
        type: 'Profession',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.PRIMORDIAL_STANCE_EARTH, 'Primordial Stance (Earth)', {
        type: 'Utility',
        castTimeMs: 0,
        independentCast: true
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(result.actions.find((action) => action.rawSkillId === 5737)?.skillId, ID.GLYPH_OF_STORMS_AIR);
  assert.equal(result.actions.find((action) => action.name === 'Earth Attunement')?.skillId, ID.EARTH_ATTUNEMENT);
  assert.deepEqual(
    result.actions.filter((action) => action.rawSkillId === 40183).map((action) => action.skillId),
    [ID.PRIMORDIAL_STANCE_AIR, ID.PRIMORDIAL_STANCE_EARTH]
  );
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('Aerial Agility keeps recorded IDs and leaves invalid chain steps to the simulator', () => {
  // Repeated names cannot justify inventing a follow-up or replacing an explicitly recorded dash.
  for (const nextId of [ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_DASH]) {
    const report = reportFixture(
      'Elementalist',
      [
        { id: ID.AERIAL_AGILITY, skills: [{ castTime: 0, duration: 520, timeGained: 0 }] },
        { id: nextId, skills: [{ castTime: 520, duration: 520, timeGained: 0 }] }
      ],
      {
        [`s${ID.AERIAL_AGILITY}`]: { name: 'Aerial Agility' },
        [`s${nextId}`]: { name: 'Aerial Agility' }
      }
    );
    const imported = reconstructDpsReportRotation(report, elementalistCatalog);
    const simulation = simulateGw2({
      profession: elementalistProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({ specialization: 'Core', primaryWeapon: 'Pistol', startAttunement: 'Air' })
    });

    assert.equal(imported.actions.at(-1).skillId, nextId);
    assert.equal(simulation.steps.at(-1).skillId, nextId);
    assert.equal(simulation.steps.at(-1).invalid, true);
    assert.match(simulation.warnings.join(' '), /is unavailable — cast Aerial Agility \(chain\) first/);
  }
});

test('EI Unravel identity synchronizes both hands without replaying its generated Dual input', () => {
  // EI's inferred ID can collide with Fervent Stance; the named cast owns the fully attuned transition.
  for (const rawId of [ID.FERVENT_STANCE, ID.UNRAVEL]) {
    const report = reportFixture(
      'Weaver',
      [
        { id: 42264, skills: [{ castTime: 100, duration: 0 }] },
        { id: rawId, skills: [{ castTime: 100, duration: 0 }] },
        { id: 43470, skills: [{ castTime: 400, duration: 0 }] },
        { id: ID.METEOR, skills: [{ castTime: 500, duration: 680 }] }
      ],
      {
        s42264: { name: 'Dual Air Attunement', isSwap: true },
        [`s${rawId}`]: { name: 'Unravel', isInstantCast: true },
        s43470: { name: 'Dual Fire Attunement', isSwap: true },
        [`s${ID.METEOR}`]: { name: 'Meteor' }
      }
    );
    const imported = reconstructDpsReportRotation(report, elementalistCatalog);
    const unravel = imported.actions.find((action) => action.name === 'Unravel');
    assert.equal(unravel.rawSkillId, rawId);
    assert.equal(unravel.skillId, ID.UNRAVEL);
    assert.equal(
      imported.actions.some((action) => action.rawSkillId === 42264),
      false
    );
    const simulation = simulateGw2({
      profession: elementalistProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({
        specialization: 'Weaver',
        primaryWeapon: 'Spear',
        startAttunement: 'Air',
        secondaryAttunement: 'Earth',
        selectedTraitIds: [TRAIT.ELEMENTS_OF_RAGE]
      })
    });
    assert.deepEqual(simulation.warnings, []);
    assert.equal(simulation.planningState.profession.primaryAttunement, 'Fire');
    assert.equal(simulation.planningState.profession.secondaryAttunement, 'Fire');
  }
});

test('a report explicitly naming Fervent Stance retains its own skill and adjacent attunement', () => {
  const report = reportFixture(
    'Weaver',
    [
      { id: ID.FERVENT_STANCE, skills: [{ castTime: 100, duration: 0 }] },
      { id: 42264, skills: [{ castTime: 100, duration: 0 }] }
    ],
    {
      [`s${ID.FERVENT_STANCE}`]: { name: 'Fervent Stance', isInstantCast: true },
      s42264: { name: 'Dual Air Attunement', isSwap: true }
    }
  );
  const imported = reconstructDpsReportRotation(report, elementalistCatalog);
  assert.equal(imported.actions.find((action) => action.name === 'Fervent Stance').skillId, ID.FERVENT_STANCE);
  assert.equal(imported.actions.find((action) => action.rawSkillId === 42264).skillId, ID.AIR_ATTUNEMENT);
});
