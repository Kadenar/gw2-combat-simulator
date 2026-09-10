import assert from 'node:assert/strict';
import test from 'node:test';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { createReaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import { createScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { createRitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { handleNecromancerStateEvent } from '#gw2/professions/necromancer/core/mechanics/event-handlers.js';
import {
  handleNecromancerPainfulBond,
  handleNecromancerWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/event-handlers.js';
import { ritualistResolverEventReactions } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';

test('Core and Reaper snapshots retain resolver clocks and carapace multiplicities', () => {
  // Scheduler snapshots update resources and Victory while leaving Nova progress and resolver effects intact.
  const core = createNecromancerCoreState();
  const reaper = createReaperState();
  const context = { profession: { core, specialization: { kind: 'Reaper', state: reaper } } };
  const snapshot = structuredClone({
    ...core,
    ...reaper,
    lifeForce: 42,
    chillingVictoryReadyAt: 7,
    carapaceExpiries: [10, 10, 20]
  });
  delete snapshot.availableFlips;
  snapshot.unknownField = true;
  core.targetChilledUntil = 12;
  core.traitProcReadyAt = { proc: 8 };
  core.carapaceExpiries = [10, 20, 20];
  reaper.chillingNovaProgress = 0.75;
  reaper.chillingNovaReadyAt = 9;

  for (const at of [1, 2]) {
    handleNecromancerStateEvent(context, { at, state: snapshot });
    assert.equal(core.lifeForce, 42);
    assert.equal(core.targetChilledUntil, 12);
    assert.deepEqual(core.traitProcReadyAt, { proc: 8 });
    assert.deepEqual(core.carapaceExpiries, [10, 10, 20, 20]);
    assert.equal(reaper.chillingNovaProgress, 0.75);
    assert.equal(reaper.chillingNovaReadyAt, 9);
    assert.equal(reaper.chillingVictoryReadyAt, 7);
  }

  assert.equal(Object.hasOwn(core, 'availableFlips'), false);
  assert.equal(Object.hasOwn(core, 'unknownField'), false);
  assert.equal(Object.hasOwn(reaper, 'lifeForce'), false);
  assert.deepEqual(snapshot.carapaceExpiries, [10, 10, 20]);
});

test('Scourge restores detached shade state without rewinding Demonic Lore', () => {
  // Shades and Nourishing Ashes come from the scheduler; Demonic Lore advances only in resolution.
  const core = createNecromancerCoreState();
  const scourge = createScourgeState();
  const context = { profession: { core, specialization: { kind: 'Scourge', state: scourge } } };
  const snapshot = { ...core, ...scourge, shades: [10], nourishingAshesReadyAt: 5 };
  scourge.demonicLoreReadyAt = 8;
  handleNecromancerStateEvent(context, { at: 1, state: snapshot });
  assert.equal(scourge.demonicLoreReadyAt, 8);
  assert.equal(scourge.nourishingAshesReadyAt, 5);
  scourge.shades.push(20);
  assert.deepEqual(snapshot.shades, [10]);
  assert.equal(Object.hasOwn(core, 'shades'), false);
});

test('Ritualist snapshots preserve Bond cadence and independent weapon-spell spending', () => {
  // Interleave real resolver grants and spending with stale scheduler snapshots.
  const core = createNecromancerCoreState();
  const ritualist = createRitualistState();
  const queued = [];
  const context = {
    profession: { core, specialization: { kind: 'Ritualist', state: ritualist } },
    catalog: necromancerCatalog,
    queue: { enqueue: (event) => queued.push(event) }
  };
  const snapshot = structuredClone({ ...core, ...ritualist });
  handleNecromancerPainfulBond(context, { at: 0, mode: 'apply', duration: 2 });
  const anchor = ritualist.painfulBondPulseAnchorAt;
  handleNecromancerWeaponSpell(context, {
    at: 0,
    spell: 'splinter',
    duration: 10,
    playerStacks: 3,
    allyStacks: 2,
    resolvedAudience: { companionIds: ['spirit:1'] }
  });
  handleNecromancerStateEvent(context, { at: 0.5, state: snapshot });
  handleNecromancerPainfulBond(context, { at: 1, mode: 'apply', duration: 3 });
  ritualistResolverEventReactions.damage(context, { at: 1, actorType: 'player', coefficient: 1 });
  ritualistResolverEventReactions.damage(context, {
    at: 1,
    actorType: 'summon',
    summonOwner: 'spirit:1',
    coefficient: 1
  });
  const spell = ritualist.weaponSpells.splinter;
  handleNecromancerStateEvent(context, { at: 1.5, state: snapshot });
  assert.equal(ritualist.painfulBondUntil, 5);
  assert.equal(ritualist.painfulBondPulseAnchorAt, anchor);
  assert.equal(queued.filter((event) => event.mode === 'tick').length, 1);
  assert.equal(ritualist.weaponSpells.splinter, spell);
  assert.equal(spell.recipients.player.stacks, 2);
  assert.equal(spell.recipients['spirit:1'].stacks, 1);
  assert.deepEqual(snapshot.weaponSpells, {});
});
