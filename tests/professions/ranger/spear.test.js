import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(rangerProfession, {
  primaryWeapon: 'Spear',
  secondaryWeapon: '',
  selectedPet: 'Pig',
  selectedTraitIds: [],
  boons: { quickness: true, alacrity: false },
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
  target: { armor: 2597, defiant: false, conditions: {} }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cast = (id, interruptAfterMs) => ({ type: 'cast', skillId: id, interruptAfterMs });
const strike = (result, id) => result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === id);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('spear stealth choice is consumed on activation even when the attack is cancelled', () => {
  for (const interrupt of [1, 800]) {
    const result = simulate('Soulbeast', [ID.PANTHERS_PROWL, cast(ID.WOLFS_ONSLAUGHT, interrupt), ID.FALCONS_STOOP]);
    assert.deepEqual(result.warnings, []);
    assert.ok(strike(result, ID.FALCONS_STOOP));
    assert.deepEqual(result.endState.profession.availableFlips, {});
    const attempt = result.steps.find((step) => step.skillId === ID.WOLFS_ONSLAUGHT);
    const contacts = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.WOLFS_ONSLAUGHT
    );
    assert.ok(contacts.every((event) => event.at * 1000 <= attempt.end));
    if (interrupt > 1) assert.ok(contacts.length > 0, 'cancellation must retain earlier contacts');
  }
});

test('Panther charges recharge serially and do not share recharge with Spider', () => {
  // Different stealth attacks consume the first two charges without waiting on a repeated attack's cooldown.
  const result = simulate('Soulbeast', [
    ID.PANTHERS_PROWL,
    ID.SPIDERS_WEB,
    ID.PANTHERS_PROWL,
    ID.OWLS_FLIGHT,
    ID.PANTHERS_PROWL
  ]);
  assert.deepEqual(result.warnings, []);
  const prowl = result.steps.filter((step) => step.skillId === ID.PANTHERS_PROWL);
  assert.ok(prowl[1].start < prowl[0].end + 10_000);
  assert.equal(prowl[2].start, prowl[0].end + 10_000);
  assert.equal(result.endState.ammoBySkillId[ID.PANTHERS_PROWL].charges, 0);
});

test('spear slots 2–4 commit identical cooldowns for base and stealth skills', () => {
  for (const [base, stealth] of [
    [ID.MONGOOSES_FRENZY, ID.WOLFS_ONSLAUGHT],
    [ID.FALCONS_STOOP, ID.OWLS_FLIGHT],
    [ID.WARCLAWS_ENGAGE, ID.PREDATORS_AMBUSH]
  ]) {
    for (const rotation of [[base], [ID.PANTHERS_PROWL, stealth], [ID.PANTHERS_PROWL, cast(stealth, 1)]]) {
      const result = simulate('Soulbeast', rotation);
      assert.deepEqual(result.warnings, []);
      assert.ok(result.schedulerState.cooldowns.get(base) > 0);
      assert.equal(result.schedulerState.cooldowns.get(base), result.schedulerState.cooldowns.get(stealth));
    }
  }
});

test('Falcon bonus requires a defiant, disabled, or immobilized target at impact', () => {
  const run = (target) => strike(simulate('Soulbeast', [ID.FALCONS_STOOP], { target }), ID.FALCONS_STOOP).damage;
  const baseline = run({});
  for (const target of [
    { defiant: true },
    { disabled: true },
    { defianceBroken: true },
    { conditions: { Immobilize: true } }
  ])
    close(run(target) / baseline, 1.2);
  close(run({ conditions: { Crippled: true } }) / baseline, 1);
  // A real preceding immobilize also qualifies; the bonus must read live condition state.
  const live = simulate('Soulbeast', [ID.PANTHERS_PROWL, ID.SPIDERS_WEB, ID.FALCONS_STOOP]);
  close(strike(live, ID.FALCONS_STOOP).damage / baseline, 1.2);
});

test('spear leap damage increases only below half target health', () => {
  for (const id of [ID.WARCLAWS_ENGAGE, ID.PREDATORS_AMBUSH]) {
    const rotation = id === ID.PREDATORS_AMBUSH ? [ID.PANTHERS_PROWL, id] : [id];
    const run = (healthFraction) => strike(simulate('Soulbeast', rotation, { target: { healthFraction } }), id).damage;
    close(run(0.49) / run(0.5), 1.2);
    close(run(0.75) / run(0.5), 1);
  }

  const target = { health: 1_000_000, startingHealthFraction: 0.500001 };
  const baseline = simulate('Soulbeast', [ID.WARCLAWS_ENGAGE], { target });
  const crossed = simulate('Soulbeast', [ID.DRAKES_SWIPE, ID.WARCLAWS_ENGAGE], { target });
  close(strike(crossed, ID.WARCLAWS_ENGAGE).damage / strike(baseline, ID.WARCLAWS_ENGAGE).damage, 1.2);
});

test('ordinary stealth unlocks spear and outgoing strikes apply Revealed without consuming Prowess', () => {
  const config = { primaryWeapon: 'Longbow', weaponSet2Primary: 'Spear', weaponSet2Secondary: '' };
  const ordinary = simulate('Soulbeast', [ID.HUNTERS_SHOT, 'Swap Weapons', ID.WOLFS_ONSLAUGHT], config);
  assert.deepEqual(ordinary.warnings, []);
  assert.ok(strike(ordinary, ID.WOLFS_ONSLAUGHT));
  const revealed = simulate(
    'Soulbeast',
    [ID.HUNTERS_SHOT, 'Swap Weapons', ID.DRAKES_SWIPE, ID.WOLFS_ONSLAUGHT],
    config
  );
  assert.ok(revealed.warnings.some((warning) => warning.includes('gain stealth first')));
  const prowess = simulate('Soulbeast', [
    ID.PANTHERS_PROWL,
    ID.DRAKES_SWIPE,
    ID.OWLS_FLIGHT,
    ID.PANTHERS_PROWL,
    ID.WOLFS_ONSLAUGHT
  ]);
  assert.deepEqual(prowess.warnings, []);
  assert.ok(strike(prowess, ID.WOLFS_ONSLAUGHT));
  const expired = simulate('Soulbeast', [ID.PANTHERS_PROWL, wait(3100), ID.WOLFS_ONSLAUGHT]);
  assert.ok(expired.warnings.some((warning) => warning.includes('gain stealth first')));
});

test('spear finishers consume Smoke Cloud and Spider grants superspeed to the pet', () => {
  const combo = simulate('Core', [ID.SMOKE_CLOUD, wait(600), ID.WARCLAWS_ENGAGE, ID.WOLFS_ONSLAUGHT], {
    selectedPet: 'Smokescale'
  });
  assert.deepEqual(combo.warnings, []);
  assert.ok(
    combo.resolvedEvents.some(
      (event) => event.type === 'combo' && event.fieldType === 'Smoke' && event.finisherType === 'Leap'
    )
  );
  assert.ok(strike(combo, ID.WOLFS_ONSLAUGHT));
  const spider = simulate('Core', [ID.PANTHERS_PROWL, ID.SPIDERS_WEB]);
  const superspeed = spider.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'superspeed');
  assert.equal(superspeed.resolvedAudience.includesSelf, false);
  assert.equal(superspeed.resolvedAudience.includesSummons, true);
  assert.equal(rangerCatalog.skillsById.get(ID.FALCONS_STOOP).effects[0].comboFinishers[0].finisherType, 'Projectile');
});

test('Jaguar stealth enables spear stealth attacks independently of Prowl', () => {
  const jaguar = simulate('Core', [ID.STALK, wait(500), ID.WOLFS_ONSLAUGHT], { selectedPet: 'Jaguar' });
  assert.deepEqual(jaguar.warnings, []);
  assert.ok(strike(jaguar, ID.WOLFS_ONSLAUGHT));
});
