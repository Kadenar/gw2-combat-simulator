import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

// The stronger critical bonus needs a supported control condition or a low-health target.
test('Superiority Complex treats Fear, Taunt and low health as alternatives', () => {
  const config = { specialization: 'Core', selectedTraitIds: [TRAIT.SUPERIORITY_COMPLEX] };
  const profession = mesmerProfession.runtimeFor(config);
  function damage(health, conditions = {}, defiant = false) {
    const context = {
      catalog: profession.catalog,
      time: 0,
      event: { actorType: 'player' },
      config: { ...config, target: { fixedHealthFraction: health, conditions, defiant } }
    };
    return profession.calculations.modifyCriticalDamage(context, 1);
  }

  const ordinary = damage(1);
  const low = damage(0.1);
  assert.ok(low > ordinary);
  assert.equal(damage(1, {}, true), ordinary);
  for (const control of ['Fear', 'Taunt']) {
    assert.equal(damage(1, { [control]: true }), low);
    assert.equal(damage(0.1, { [control]: true }), low);
  }
});

// Instrument history can grow between two damage queries for the same build.
test('Lute updates affect player strikes and exclude illusions', () => {
  const config = { specialization: 'Troubadour', selectedTraitIds: [TRAIT.SHREDDING] };
  const profession = mesmerProfession.runtimeFor(config);
  const events = [];
  const damage = (event) =>
    profession.calculations.modifyStrikeDamage({ catalog: profession.catalog, config, time: 1, events, event }, 1);
  const player = { actorType: 'player' };
  const phantasm = { actorType: 'summon', summonKind: 'phantasm', source: 'Phantasm' };
  const initial = damage(player);
  const initialPhantasm = damage(phantasm);
  events.push({ type: 'mesmer.instrument', instrument: 'Lute', at: 0, expiresAt: 5 });
  const playing = damage(player);
  assert.ok(playing > initial);
  assert.equal(damage(phantasm), initialPhantasm);
  events.push({ type: 'mesmer.instrument', instrument: 'Lute', at: 1, expiresAt: 1 });
  assert.equal(damage(player), initial);
});

// Only Troubadour needs to scan past instrument events during a damage or attribute query.
test('Virtuoso skips instrument history', () => {
  const config = { specialization: 'Virtuoso' };
  const profession = mesmerProfession.runtimeFor(config);
  const events = [];
  Object.defineProperty(events, 0, {
    get() {
      throw new Error('Inactive specialization read instrument history');
    }
  });
  const context = { config, catalog: profession.catalog, time: 1, events, event: { actorType: 'player' } };
  profession.calculations.modifyAttributes(context, { power: 100 });
  profession.calculations.modifyStrikeDamage(context, 1);
});
