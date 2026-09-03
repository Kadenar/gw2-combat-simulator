import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProcIcon } from '#gw2/app/rotation/shared/icons.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/catalog.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';

const STEAMSHRIEKER_ICON = 'https://render.guildwars2.com/file/23B0F0A5BF05E05C9F527BF7EB4962C9F49C6F42/3441975.png';

const scrapperConfig = Object.freeze({
  specialization: 'Scrapper',
  selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Bomb Kit', 'Flamethrower', 'Elite Mortar Kit'],
  relic: 'Steamshrieker',
  boons: { quickness: true },
  stats: { power: 2000, conditionDamage: 1000 }
});

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

function simulate(rotation) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: scrapperConfig
  });
}

test('Scrapper healing skills expose their measured Quickness timings and water fields', () => {
  const medicGyro = mechanic('Medic Gyro');
  const reconstructionField = mechanic('Reconstruction Field');
  const elixirShell = mechanic('Elixir Shell');

  assert.equal(medicGyro.quicknessCastTimeMs, 360);
  assert.equal(medicGyro.comboFields[0].fieldType, 'Water');
  assert.equal(medicGyro.comboFields[0].duration, 5);
  assert.equal(reconstructionField.quicknessCastTimeMs, 360);
  assert.equal(reconstructionField.comboFields[0].fieldType, 'Water');
  assert.equal(reconstructionField.comboFields[0].duration, 2);
  assert.equal(elixirShell.quicknessCastTimeMs, 560);
  assert.equal(elixirShell.comboFields[0].fieldType, 'Water');
  assert.equal(elixirShell.comboFields[0].duration, 5);
});

test('Poison Gas Shell uses its measured Quickness cast time', () => {
  const result = simulate(['Elite Mortar Kit', 'Poison Gas Shell']);
  const step = result.steps.find((candidate) => candidate.skill === 'Poison Gas Shell');

  assert.equal(mechanic('Poison Gas Shell').quicknessCastTimeMs, 560);
  assert.equal(step.end - step.start, 560);
});

test('Steamshrieker burns once for each affected Engineer blast or leap', () => {
  const scenarios = [
    { rotation: ['Medic Gyro', 'Devastator'], skillName: 'Devastator', finisherType: 'Blast' },
    { rotation: ['Medic Gyro', 'Conduit Surge'], skillName: 'Conduit Surge', finisherType: 'Leap' },
    { rotation: ['Medic Gyro', 'Flamethrower', 'Flame Blast'], skillName: 'Flame Blast', finisherType: 'Blast' },
    {
      rotation: ['Elite Mortar Kit', 'Elixir Shell', 'Flamethrower', 'Flame Blast'],
      skillName: 'Flame Blast',
      finisherType: 'Blast'
    },
    { rotation: ['Reconstruction Field', 'Conduit Surge'], skillName: 'Conduit Surge', finisherType: 'Leap' }
  ];

  // Each minimal rotation isolates one field/finisher contract without depending on a saved benchmark rotation.
  for (const { rotation, skillName, finisherType } of scenarios) {
    const result = simulate(rotation);
    const combos = result.resolvedEvents.filter(
      (event) => event.type === 'combo' && event.skillName === skillName && event.fieldType === 'Water'
    );
    const relicBurns = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === 'relic.steamshrieker'
    );

    assert.equal(result.warnings.length, 0, rotation.join(' -> '));
    assert.equal(combos.length, 1, rotation.join(' -> '));
    assert.equal(combos[0].finisherType, finisherType, rotation.join(' -> '));
    assert.equal(relicBurns.length, 1, rotation.join(' -> '));
    assert.equal(relicBurns[0].triggeredBy, skillName, rotation.join(' -> '));
  }
});

test('Steamshrieker proc rows use the relic icon before the triggering skill icon', () => {
  const app = {
    attributeData: { activeTraits: [] },
    skillByName: new Map([['Devastator', { icon: 'wrong-trigger-icon.png' }]])
  };

  assert.equal(RELIC_DATA.Steamshrieker.icon, STEAMSHRIEKER_ICON);
  assert.equal(
    resolveProcIcon(app, {
      type: 'relic_proc',
      skill: 'Relic of Steamshrieker',
      sourceSkill: 'Devastator'
    }),
    STEAMSHRIEKER_ICON
  );
});
