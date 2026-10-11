import assert from 'node:assert/strict';
import test from 'node:test';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Trigger-only skills remain editable without becoming selectable rotation actions.
test('Engineer exposes supported trait skills to patch authoring', () => {
  const authoring = withActivePatchPreview(engineerProfession).patchAuthoring;
  for (const id of [ID.STATIC_DISCHARGE_TRAIT_SKILL, ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL, ID.CONTROLLED_ANALYSIS]) {
    assert.ok(authoring.modules.some((module) => module.skills.some((skill) => skill.id === id)));
  }
});

// Use real resolver admission so misses and companion controls cannot consume the player proc's recharge.
test('Lock On invokes the patched Controlled Analysis payload and shared cooldown after accepted disables', () => {
  for (const selected of [false, true]) {
    const result = runEngineer(
      [{ type: 'wait', durationMs: 3500 }],
      {
        selectedTraitIds: selected ? [TRAIT.LOCK_ON] : [],
        boons: { alacrity: true },
        target: { armor: 2597, defiant: true, conditions: {} }
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.CONTROLLED_ANALYSIS]: {
                fields: { cooldown: { from: 25, to: 2 } },
                effects: [
                  { type: 'boon', boon: 'fury', duration: { from: 5, to: 7 } },
                  {
                    type: 'condition',
                    condition: 'Vulnerability',
                    stacks: { from: 10, to: 3 },
                    duration: { from: 8, to: 4 }
                  }
                ]
              }
            }
          }),
        initialize(runtime) {
          for (const [at, flags] of [
            [0.1, { offTarget: true }],
            [0.2, { actorType: 'summon' }],
            [1, {}],
            [1.1, {}],
            [3.1, {}]
          ]) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'control',
                at,
                source: 'fixture',
                sourceId: ID.OVERCHARGED_SHOT,
                skillId: ID.OVERCHARGED_SHOT,
                skillName: 'Overcharged Shot',
                actorType: 'player',
                controlKind: 'knockback',
                duration: 1,
                ...flags
              }
            });
          }
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const packets = result.resolvedEvents.filter((event) => event.skillId === ID.CONTROLLED_ANALYSIS);
    const fury = packets.filter((event) => event.kind === 'fury');
    assert.deepEqual(
      fury.map((event) => event.at),
      selected ? [1, 3.1] : []
    );
    assert.ok(fury.every((event) => event.duration === 7));
    assert.equal(
      packets.filter((event) => event.condition === 'Vulnerability').reduce((sum, event) => sum + event.stacks, 0),
      selected ? 6 : 0
    );
    assert.ok(
      packets.every(
        (event) => event.sourceId === ID.CONTROLLED_ANALYSIS && event.parentSkillName === 'Overcharged Shot'
      )
    );
    assert.equal(
      observedRuntime(result).cooldownController.readyAt(ID.CONTROLLED_ANALYSIS),
      selected ? 4.7 : undefined
    );
  }
});
