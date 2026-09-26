import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProcIcon } from '#gw2/app/shared/icons.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

const scrapperConfig = Object.freeze({
  specialization: 'Scrapper',
  selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Bomb Kit', 'Flamethrower', 'Elite Mortar Kit'],
  relic: 'Steamshrieker',
  boons: { quickness: true },
  stats: { power: 2000, conditionDamage: 1000 }
});

function simulate(rotation) {
  return runGw2Runtime({
    profession: engineerProfession.runtimeFor(scrapperConfig),
    rotation,
    config: scrapperConfig
  });
}

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

// Relic attribution must win over the triggering skill regardless of the current artwork URL.
test('Steamshrieker proc rows use the relic icon before the triggering skill icon', () => {
  const app = {
    attributeData: { activeTraits: [] },
    skillByName: new Map([['Devastator', { icon: 'wrong-trigger-icon.png' }]])
  };

  assert.ok(RELIC_DATA.Steamshrieker.icon);
  assert.equal(
    resolveProcIcon(app, {
      type: 'relic_proc',
      skill: 'Relic of Steamshrieker',
      sourceSkill: 'Devastator'
    }),
    RELIC_DATA.Steamshrieker.icon
  );
});
