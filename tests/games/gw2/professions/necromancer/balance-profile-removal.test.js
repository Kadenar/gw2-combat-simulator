import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/necromancer/core/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS as RITUALIST } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { applyDarkDefense } from '#gw2/professions/necromancer/core/traits/death-magic.js';
import { applyVampiric } from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { minionDefinitionForSkill } from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const patched = (balanceProfiles) => applyBalanceProfilePatch(necromancerCatalog, { balanceProfiles });

// A patched Ritualist rotation exercises spirit compilation through the real scheduler and resolver.
function run(balanceProfiles, specialization, rotation, config = {}) {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'necromancer-removal',
    label: 'Necromancer removal',
    professions: { necromancer: { balanceProfiles } }
  });
  const result = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 2000, ferocity: 500, conditionDamage: 1200, expertise: 0, vitality: 1000 },
    target: { armor: 2597, health: 1_000_000 }
  })(specialization, rotation, { patchId: 'necromancer-removal', ...config });
  assert.deepEqual(result.warnings, []);
  return result;
}

function castContext(balanceProfiles, selectedTraitIds) {
  const config = { selectedTraitIds };
  const events = [];
  return {
    config,
    catalog: patched(balanceProfiles),
    effectiveEnd: 1,
    state: { time: 1, profession: { core: createNecromancerCoreState(config) } },
    events,
    emit: (event) => events.push(event)
  };
}

test('removed Dark Defense protection keeps its carapace and cooldown', () => {
  const context = castContext({ [TRAIT.DARK_DEFENSE]: remove('boon', 'protection') }, [TRAIT.DARK_DEFENSE]);
  applyDarkDefense(context, necromancerCatalog.skillsById.get(ID.CONSUME_CONDITIONS));
  const core = context.state.profession.core;
  assert.ok(core.carapaceExpiries.length > 0);
  assert.ok(core.traitProcReadyAt.darkDefense > 1);
  assert.deepEqual(context.events, []);
});

test('removed minion Vampiric siphon keeps the player siphon bound to its own values', () => {
  const queued = [];
  const context = {
    config: { selectedTraitIds: [TRAIT.VAMPIRIC] },
    catalog: patched({ [CORE.vampiric]: remove('strike', 'minion') }),
    queue: { enqueue: (event) => queued.push(event) }
  };
  applyVampiric(context, { type: 'damage', at: 1, actorType: 'summon', summonKind: 'minion', skillName: 'Bite' });
  assert.deepEqual(queued, []);
  applyVampiric(context, { type: 'damage', at: 2, actorType: 'player', skillName: 'Strike' });
  const player = necromancerCatalog.balanceProfilesById
    .get(CORE.vampiric)
    .effects.find((effect) => effect.name === 'player');
  assert.equal(queued.length, 1);
  assert.equal(queued[0].flatStrikeBase, player.flatStrikeBase);
});

test('removing every alternate minion packet compiles no alternate cadence', () => {
  const context = {
    catalog: patched({
      [CORE.boneFiendAttack]: {
        removeEffects: [
          { type: 'strike', name: 'Bone Shard - Crippling Volley - First Projectile' },
          { type: 'strike', name: 'Bone Shard - Crippling Volley - Second Projectile' },
          { type: 'condition', name: 'Crippled' }
        ]
      }
    })
  };
  const summon = minionDefinitionForSkill(context, ID.SUMMON_BONE_FIEND);
  assert.deepEqual(summon.alternateAttacks, []);
  assert.equal(summon.alternateEvery, 0);
  assert.equal(summon.attacks.length, 2);
});

test('removed Anguish autoattack stops autonomous attacks while its summon barrage survives', () => {
  const result = run(
    { [RITUALIST.anguish]: remove('strike', 'Anguish Autoattack') },
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 9000 }],
    { initialResource: 100 }
  );
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.spirit-attack'),
    false
  );
  assert.ok(result.resolvedEvents.some((event) => event.metadata?.spiritAttackType === 'initial'));
});

test('a missing required Necromancer scalar fails instead of using a local default', () => {
  const profile = { ...necromancerCatalog.balanceProfilesById.get(TRAIT.DARK_DEFENSE) };
  delete profile.duration;
  const context = castContext({}, [TRAIT.DARK_DEFENSE]);
  context.catalog = { balanceProfilesById: new Map([[TRAIT.DARK_DEFENSE, profile]]) };
  assert.throws(
    () => applyDarkDefense(context, necromancerCatalog.skillsById.get(ID.CONSUME_CONDITIONS)),
    /Invalid balance data: .*field=duration/
  );
});
