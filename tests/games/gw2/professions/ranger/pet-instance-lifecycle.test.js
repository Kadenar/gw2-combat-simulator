import assert from 'node:assert/strict';
import test from 'node:test';

import { createChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { setBeastmode } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// Exercise real recipient application and whole-instance replacement without depending on native attack schedules.
function grant(runtime, kind, companionId) {
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'fixture',
      sourceId: kind,
      actorType: 'player',
      kind,
      stacks: 1,
      duration: 30,
      audience: { recipients: 'party', eligibleCompanionIds: [companionId] }
    }
  });
}

for (const output of ['detailed', 'score']) {
  test(`swapping replaces all pet rewards while preserving player rewards and global recharge (${output})`, () => {
    let outgoing;
    let replacement;
    let readyAt;
    const swap = (runtime) => swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
    const result = runRanger(
      [{ type: 'wait', durationMs: 6000 }],
      {
        selectedPet: 'Carrion Devourer',
        selectedPet2: 'Tiger',
        allies: { count: 0 },
        sharePlayerBoonsWithSummons: true
      },
      {
        output,
        initialize(runtime) {
          outgoing = runtime.profession.core.pet;
          outgoing.poisonousStrikes = createChargeGrant(3, 30);
          outgoing.poisonMasterReady = true;
          outgoing.ferociousSymbiosis = { count: 5, expiresAt: 30 };
          outgoing.wutheringWindReady = true;
          outgoing.openingStrikeReady = false;
          runtime.profession.core.player.poisonousStrikes = createChargeGrant(2, 30);
          grant(runtime, 'alacrity', outgoing.id);
          grant(runtime, 'superspeed', outgoing.id);
          runtime.cooldownController.startRecharge(
            runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD),
            0,
            30,
            outgoing.id
          );
        },
        timeline: [
          {
            at: 2,
            run(runtime) {
              assert.equal(
                runtime.combat.activeBoonStacks('alacrity', 2, 1, { actor: 'companion', companionId: outgoing.id }),
                1
              );
              swap(runtime);
              replacement = runtime.profession.core.pet;
              assert.notEqual(replacement, outgoing);
              assert.equal(
                runtime.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                  actor: 'companion',
                  companionId: outgoing.id
                }),
                0
              );
              assert.equal(
                runtime.combat.activeBuffStacks('superspeed', runtime.time, 1, {
                  actor: 'companion',
                  companionId: outgoing.id
                }),
                0
              );
              assert.equal(runtime.combat.companionRetiredAt(outgoing.id), runtime.time);
              assert.equal(replacement.poisonousStrikes.count, 0);
              assert.equal(replacement.poisonMasterReady, false);
              assert.equal(replacement.ferociousSymbiosis.count, 0);
              assert.equal(replacement.wutheringWindReady, false);
              assert.equal(replacement.openingStrikeReady, true);
              assert.equal(runtime.profession.core.player.poisonousStrikes.count, 2);
              assert.equal(runtime.combat.activeBoonStacks('alacrity', 2), 1);
              readyAt = runtime.cooldownController.readyAt(ID.POISONOUS_CLOUD);
              assert.equal(readyAt, 29.5, 'Only the first two seconds receive Alacrity acceleration.');
              assert.equal(runtime.cooldownController.rechargeFor(ID.POISONOUS_CLOUD), undefined);
            }
          },
          {
            at: 3,
            run(runtime) {
              grant(runtime, 'alacrity', replacement.id);
            }
          },
          {
            at: 4,
            run(runtime) {
              swap(runtime);
              const returned = runtime.profession.core.pet;
              assert.notEqual(returned.id, outgoing.id);
              assert.equal(
                runtime.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                  actor: 'companion',
                  companionId: returned.id
                }),
                0
              );
              assert.equal(returned.poisonousStrikes.count, 0);
              assert.equal(runtime.cooldownController.readyAt(ID.POISONOUS_CLOUD), readyAt);
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);

    if (output === 'detailed') {
      const retirements = result.events.filter((event) => event.action === 'companion-retired');
      assert.ok(retirements.length > 0);
      assert.ok(retirements.every((event) => event.sourceId === ID.PET_SWAP));
    }
  });

  test(`Soulbeast merge destroys pet effects and unmerge creates a fresh lifetime (${output})`, () => {
    let outgoing;
    const mode = (runtime, active) =>
      setBeastmode(
        runtime.mechanics,
        runtime.helpers.skillsById.get(active ? ID.BEASTMODE : ID.LEAVE_BEASTMODE),
        active
      );
    const result = runRanger(
      [{ type: 'wait', durationMs: 1000 }],
      { specialization: 'Soulbeast', allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
      {
        output,
        timeline: [
          {
            at: 0.1,
            run(runtime) {
              mode(runtime, false);
              outgoing = runtime.profession.core.pet;
              outgoing.poisonMasterReady = true;
              outgoing.poisonousStrikes = createChargeGrant(2, 10);
              grant(runtime, 'might', outgoing.id);
            }
          },
          {
            at: 0.4,
            run(runtime) {
              mode(runtime, true);
              assert.equal(runtime.profession.core.pet, null);
              assert.equal(runtime.profession.core.player.poisonMasterReady, false);
              assert.equal(runtime.profession.core.player.poisonousStrikes.count, 0);
              assert.equal(
                runtime.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                  actor: 'companion',
                  companionId: outgoing.id
                }),
                0
              );
              assert.equal(runtime.combat.companionRetiredAt(outgoing.id), runtime.time);
            }
          },
          {
            at: 0.6,
            run(runtime) {
              mode(runtime, false);
              const pet = runtime.profession.core.pet;
              assert.notEqual(pet.id, outgoing.id);
              assert.equal(pet.poisonMasterReady, false);
              assert.equal(pet.poisonousStrikes.count, 0);
              assert.equal(
                runtime.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                  actor: 'companion',
                  companionId: pet.id
                }),
                0
              );
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);

    if (output === 'detailed') {
      const retirements = result.events.filter((event) => event.action === 'companion-retired');
      assert.ok(retirements.length > 0);
      assert.ok(retirements.every((event) => event.sourceId === ID.BEASTMODE));
    }
  });
}
