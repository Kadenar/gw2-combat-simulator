import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import {
  skillBreakdownRows,
  skillDamageKeyByIdentity,
  skillDamageIdentityKey
} from '#gw2/app/results/result-tables.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(rangerProfession, {
  primaryWeapon: 'Spear',
  selectedPet: 'Pig',
  selectedTraitIds: [],
  boons: { quickness: true, alacrity: false },
  stats: { power: 2000, precision: 1000, ferocity: 0 },
  target: { armor: 2597 }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });
const hits = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

test('One Wolf Pack uses its own strength and accepts periodic hits at the recharge boundary', () => {
  // Five evenly spaced pulses must each produce one echo; weapon triggers must use the same stance formula.
  const trap = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.FROST_TRAP, wait(6000)]);
  const echoes = hits(trap, ID.ONE_WOLF_PACK);
  assert.equal(echoes.length, hits(trap, ID.FROST_TRAP).length);
  const weapon = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.DRAKES_SWIPE, wait(1000)]);
  const echo = hits(weapon, ID.ONE_WOLF_PACK)[0];
  assert.equal(echo.skillWeapon, 'Unequipped');
  assert.equal(echo.resolvedWeaponStrength, echoes[0].resolvedWeaponStrength);
  assert.equal(echo.damage, echoes[0].damage);
});

test('precast Frost Trap waits for combat and preserves its whole pulse train and field', () => {
  const ordinary = simulate('Soulbeast', [ID.FROST_TRAP, wait(6000)]);
  const precast = simulate('Soulbeast', [ID.FROST_TRAP, wait(6000), { type: 'combat-start' }, wait(6000)]);
  const ordinaryHits = hits(ordinary, ID.FROST_TRAP),
    delayedHits = hits(precast, ID.FROST_TRAP);
  assert.deepEqual(precast.warnings, []);
  assert.equal(delayedHits.length, ordinaryHits.length);
  assert.equal(delayedHits[0].at, precast.combatStartTime);
  const offsets = (rows) => rows.map((event) => Math.round((event.at - rows[0].at) * 1000));
  assert.deepEqual(offsets(delayedHits), offsets(ordinaryHits));
  const field = precast.events.find((event) => event.type === 'combo_field' && event.offTarget !== true);
  const originalField = ordinary.events.find((event) => event.type === 'combo_field');
  assert.equal(field.at, precast.combatStartTime);
  assert.equal(field.expiresAt - field.at, originalField.expiresAt - originalField.at);
  assert.equal(precast.schedulerState.profession.core.pendingFrostTrapEvents.length, 0);
  const early = simulate('Soulbeast', [ID.FROST_TRAP, { type: 'combat-start' }, wait(6000)]);
  assert.equal(hits(early, ID.FROST_TRAP)[0].at, ordinaryHits[0].at, 'combat cannot bypass arming');
  const cancelled = simulate('Soulbeast', [
    { type: 'cast', skillId: ID.FROST_TRAP, interruptAfterMs: 1 },
    { type: 'combat-start' },
    wait(6000)
  ]);
  assert.equal(hits(cancelled, ID.FROST_TRAP).length, 0);
});

test('Path of Scars variants share one row and chart series with both casts counted', () => {
  const result = simulate('Soulbeast', [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE, wait(2000)], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe'
  });
  assert.deepEqual(result.warnings, []);
  const rows = skillBreakdownRows(result).filter((row) => row.name.startsWith('Path of Scars'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Path of Scars');
  assert.equal(rows[0].casts, 2);
  const contacts = [...hits(result, ID.PATH_OF_SCARS), ...hits(result, ID.PATH_OF_SCARS_MAX_RANGE)];
  assert.equal(rows[0].hits, contacts.length);
  const keys = skillDamageKeyByIdentity(result);
  for (const event of contacts) assert.equal(keys.get(skillDamageIdentityKey(event)), rows[0].key);
  const actions = result.events.filter(
    (event) => event.type === 'action' && [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE].includes(event.skillId)
  );
  const castTime = actions.reduce((total, event) => total + event.endsAt - event.at, 0);
  assert.ok(Math.abs(rows[0].dct - rows[0].total / castTime) < 1e-6);
});

test('Brutal Charge activates Claw on delayed contact rather than its queued activation', () => {
  const rotation = [ID.BRUTAL_CHARGE_ID_46432, ID.DRAKES_SWIPE, wait(1500)];
  const result = simulate('Soulbeast', rotation, { relic: 'Claw' });
  const baseline = simulate('Soulbeast', rotation, { relic: '' });
  const charge = hits(result, ID.BRUTAL_CHARGE_ID_46432)[0];
  const swipe = hits(result, ID.DRAKES_SWIPE)[0];
  const proc = result.procSteps.find((event) => event.skill === 'Relic of the Claw');
  assert.deepEqual(result.warnings, []);
  assert.ok(swipe.at < charge.at);
  assert.equal(swipe.damage, hits(baseline, ID.DRAKES_SWIPE)[0].damage);
  assert.equal(proc.start, Math.round(charge.at * 1000));
});
