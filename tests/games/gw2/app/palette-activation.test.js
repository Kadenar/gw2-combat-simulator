import assert from 'node:assert/strict';
import test from 'node:test';

import { hasConfigurableDoubleEdgeOutcome } from '#gw2/app/rotation/editing/double-edge-editor.js';
import { dispatchPaletteActivation, resolvePaletteDrop } from '#gw2/app/rotation/palette/interactions.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS } from '#gw2/professions/thief/data/ids.js';

// Builds only the app surface used by palette activation so each branch stays isolated.
function activationApp(skills) {
  const catalog = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName: new Map(skills.map((skill) => [skill.name, skill]))
  };
  const added = [];
  let professionAction;
  const app = {
    build: {
      rotation: [],
      startingWeaponSet: 1,
      weapons: ['', ''],
      alternateWeapons: ['', '']
    },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true
    },
    profession: {
      catalog,
      ui: {
        isPaletteSkillInstant: () => false,
        resolvePaletteAction: () => professionAction
      }
    },
    activeCatalog: catalog,
    skills,
    skillById: catalog.skillsById,
    skillByName: catalog.skillsByName,
    results: null,
    attributeData: null,
    rotationInsertionIndex: null,
    changed() {},
    addRotation(name, options) {
      added.push({ name, options });
    }
  };
  return {
    app,
    added,
    setProfessionAction(value) {
      professionAction = value;
    }
  };
}

function activationEvent(skillId, { shiftKey = false, ctrlKey = false } = {}) {
  return {
    currentTarget: {
      dataset: { skillId: String(skillId) },
      classList: { contains: () => false },
      querySelector: () => null
    },
    shiftKey,
    ctrlKey
  };
}

// A retained tile must not resolve a profession macro or skill against a newer, unsimulated rotation.
test('palette activation waits for matching result and build revisions', () => {
  const skill = { id: 1, name: 'Ordinary', type: 'Weapon' };
  const { app, added } = activationApp([skill]);
  app.buildRevision = 2;
  app.resultRevision = 1;
  dispatchPaletteActivation(app, skill.name, activationEvent(skill.id));
  assert.deepEqual(added, []);
  app.resultRevision = 2;
  dispatchPaletteActivation(app, skill.name, activationEvent(skill.id));
  assert.deepEqual(added, [{ name: skill.name, options: { skillId: skill.id } }]);
});

test('palette activation dispatches ordinary and exceptional actions', () => {
  const ordinary = { id: 1, name: 'Ordinary', type: 'Utility', castTimeMs: 500 };
  const instant = { id: 2, name: 'Instant', type: 'Utility', castTimeMs: 0 };
  const dragonSlash = { id: 3, name: 'Dragon Slash', type: 'Profession', castTimeMs: 0, dragonSlash: true };
  const doubleEdge = {
    id: 4,
    name: 'Double Edge',
    type: 'Utility',
    usableWhileRecharging: true,
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' } }]
  };
  const { app, added, setProfessionAction } = activationApp([ordinary, instant, dragonSlash, doubleEdge]);
  const opened = {};
  const editors = {
    openDuration(options) {
      opened.duration = options;
    },
    openDragonSlash(options) {
      opened.dragonSlash = options;
    },
    openDoubleEdge(options) {
      opened.doubleEdge = options;
    },
    openActivation(options) {
      opened.activation = options;
    }
  };

  dispatchPaletteActivation(app, ordinary.name, activationEvent(ordinary.id), editors);
  assert.deepEqual(added.pop(), { name: ordinary.name, options: { skillId: ordinary.id } });

  setProfessionAction({ type: 'cooldown-reset' });
  dispatchPaletteActivation(app, 'Profession Action', activationEvent(-1), editors);
  assert.deepEqual(app.build.rotation, [{ type: 'cooldown-reset' }]);
  setProfessionAction(undefined);

  dispatchPaletteActivation(app, '__wait', activationEvent(-2), editors);
  opened.duration.onApply(750);
  assert.deepEqual(added.pop(), { name: '__wait', options: { durationMs: 750 } });

  app.build.rotation = [];
  dispatchPaletteActivation(app, dragonSlash.name, activationEvent(dragonSlash.id), editors);
  assert.equal(opened.dragonSlash.insertionIndex, 0);
  opened.dragonSlash.onApply(3);
  assert.deepEqual(added.pop(), {
    name: dragonSlash.name,
    options: { skillId: dragonSlash.id, releaseAtCharges: 3 }
  });

  dispatchPaletteActivation(app, doubleEdge.name, activationEvent(doubleEdge.id), editors);
  opened.doubleEdge.onApply('backfire');
  assert.deepEqual(added.pop(), {
    name: doubleEdge.name,
    options: { skillId: doubleEdge.id, doubleEdgeOutcome: 'backfire' }
  });

  app.build.rotation = [{ type: 'cast', skillId: ordinary.id }];
  dispatchPaletteActivation(app, instant.name, activationEvent(instant.id, { shiftKey: true }), editors);
  assert.deepEqual(added.pop(), {
    name: instant.name,
    options: { skillId: instant.id, concurrentOffsetMs: 120 }
  });

  dispatchPaletteActivation(app, ordinary.name, activationEvent(ordinary.id, { ctrlKey: true }), editors);
  opened.activation.onApply(120);
  assert.deepEqual(added.pop(), {
    name: ordinary.name,
    options: { skillId: ordinary.id, interruptAfterMs: 120 }
  });
});

test('pet recharge handling does not expose Double Edge outcomes', () => {
  // Real catalog skills keep palette insertion and timeline badges tied to the authored Double Edge mechanic.
  const pets = rangerCatalog.skills.filter((skill) => skill.petSkill);
  assert.ok(pets.length > 0);
  for (const skill of pets) assert.equal(hasConfigurableDoubleEdgeOutcome(skill), false, skill.name);
  for (const id of [
    THIEF_SKILL_IDS.STONE_SUMMIT_CANNON,
    THIEF_SKILL_IDS.ANTIVENOM_DRAUGHT,
    THIEF_SKILL_IDS.CANACH_COIN_TOSS
  ]) {
    assert.equal(hasConfigurableDoubleEdgeOutcome(thiefCatalog.skillsById.get(id)), true);
  }

  const maul = pets.find((skill) => skill.name === 'Maul');
  assert.ok(maul);
  assert.equal(maul.usableWhileRecharging, true);
  const { app, added } = activationApp([maul]);
  dispatchPaletteActivation(app, maul.name, activationEvent(maul.id), {});
  assert.deepEqual(added, [{ name: maul.name, options: { skillId: maul.id } }]);
  assert.deepEqual(resolvePaletteDrop(app, maul.name, { skillId: maul.id }, 0), {
    type: 'cast',
    skillId: maul.id
  });
});

test('Ctrl-click initializes the editor with the authored interrupt default and accepts an override', () => {
  const skill = {
    id: 1,
    name: 'Default Interrupted Cast',
    castTimeMs: 2000,
    defaultInterruptMs: 480
  };
  const { app, added } = activationApp([skill]);
  // Verify the editor receives the same default used when inserting a cast normally.
  dispatchPaletteActivation(app, skill.name, activationEvent(skill.id, { ctrlKey: true }), {
    openActivation(options) {
      assert.equal(options.interruptMs, 480);
      assert.equal(options.suggestedInterruptMs, 480);
      options.onApply(600);
    }
  });
  assert.deepEqual(added, [{ name: skill.name, options: { skillId: skill.id, interruptAfterMs: 600 } }]);
});

test('Shift-click queues companion animations concurrently while respecting explicit prohibitions', () => {
  const command = { id: 1, name: 'Mech Command', castTimeMs: 750, independentCast: true };
  const { app, added } = activationApp([command]);
  app.build.rotation = [{ type: 'cast', skillId: 2 }];

  dispatchPaletteActivation(app, command.name, activationEvent(command.id, { shiftKey: true }), {});
  assert.deepEqual(added.pop().options, { skillId: command.id, concurrentOffsetMs: 120 });

  command.canCastConcurrently = false;
  dispatchPaletteActivation(app, command.name, activationEvent(command.id, { shiftKey: true }), {});
  assert.deepEqual(added.pop().options, { skillId: command.id });
});
