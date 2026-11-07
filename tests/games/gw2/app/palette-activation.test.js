/** Palette gestures share decisions and completion while preserving their distinct cursor behavior. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import { hasConfigurableDoubleEdgeOutcome } from '#gw2/app/rotation/editing/double-edge-editor.js';
import { dispatchPaletteAction, dispatchPaletteActivation } from '#gw2/app/rotation/palette/interactions.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { THIEF_SKILL_IDS } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { withoutTraitSkillVariants } from '#tests/helpers/patch-selection.js';

// Real edit commits expose command, cursor, and history behavior without requiring a browser editor.
function actionApp(skills) {
  const catalog = { skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
  const changes = [];
  let professionAction;
  const app = withoutTraitSkillVariants({
    build: { rotation: [], startingWeaponSet: 1, weapons: ['', ''], alternateWeapons: ['', ''] },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true,
      calculateCursorPreview: () => app.analysis.state.results
    },
    profession: {
      catalog,
      resolveProfession: () => ({ canSwapWeaponSetsInCombat: true }),
      ui: {
        castEditor: () => null,
        isPaletteSkillInstant: () => false,
        resolvePaletteAction: () => professionAction
      }
    },
    activeCatalog: catalog,
    analysis: {
      capture: () => ({ inputs: { baseline: () => ({ rotation: app.build.rotation, baseConfig: {} }) } }),
      state: { buildRevision: 0, resultRevision: 0, results: {} }
    },
    attributeData: null,
    rotationInsertionIndex: null,
    changed(...args) {
      changes.push(args);
    }
  });
  return {
    app,
    changes,
    setProfessionAction(value) {
      professionAction = value;
    }
  };
}

const ordinary = { id: 1, name: 'Ordinary', type: 'Utility', castTimeMs: 500 };
const instant = { id: 2, name: 'Instant', type: 'Utility', castTimeMs: 0 };
const dragonSlash = { id: 3, name: 'Dragon Slash', type: 'Profession', dragonSlash: true };
const doubleEdge = {
  id: 4,
  name: 'Double Edge',
  type: 'Utility',
  usableWhileRecharging: true,
  sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' } }]
};
const anchor = { querySelector: () => null };
const descriptor = {
  prepare() {
    assert.fail('The browser editor owns choice preparation');
  }
};

function request(type, skill = ordinary) {
  return {
    type,
    name: skill.name,
    skillId: skill.id,
    anchor,
    ...(type === 'drop' ? { index: 2 } : {})
  };
}

for (const type of ['activate', 'drop']) {
  test(`${type} waits for matching accepted results before resolving actions or editors`, () => {
    const { app, changes } = actionApp([ordinary]);
    app.profession.ui.resolvePaletteAction = () => assert.fail('A stale gesture must not resolve an action');
    app.analysis.state.buildRevision = 2;
    app.analysis.state.resultRevision = 1;
    dispatchPaletteAction(app, request(type), {});
    app.analysis.state.resultRevision = 2;
    for (const results of [null, undefined]) {
      app.analysis.state.results = results;
      dispatchPaletteAction(app, request(type), {});
    }

    assert.deepEqual(app.build.rotation, []);
    assert.equal(changes.length, 0);
    app.analysis.state.results = {};
    app.profession.ui.resolvePaletteAction = () => undefined;
    dispatchPaletteAction(app, request(type), {});
    assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: ordinary.id }]);
  });

  test(`${type} commits ordinary skills at its destination as one undoable edit`, () => {
    const { app, changes } = actionApp([ordinary]);
    const before = [{ type: 'cooldown-reset' }, { type: 'combat-start' }];
    app.build.rotation = before;
    app.rotationInsertionIndex = 0;
    dispatchPaletteAction(app, request(type), {});
    const cast = { type: 'cast', skillId: ordinary.id };
    assert.deepEqual(app.build.rotation, type === 'drop' ? [...before, cast] : [cast, ...before]);
    assert.equal(app.rotationInsertionIndex, type === 'drop' ? null : 1);
    assert.equal(changes.length, 1);
    assert.deepEqual(app._rotationHistory.undo, [before]);
    commitRotationEdit(app, { type: 'undo' });
    assert.deepEqual(app.build.rotation, before);
  });

  test(`${type} commits profession actions atomically and preserves handled no-ops`, () => {
    for (const result of [
      null,
      [],
      { type: 'cooldown-reset' },
      [
        { type: 'cast', skillId: 10 },
        { type: 'cast', skillId: 11 }
      ]
    ]) {
      const { app, changes, setProfessionAction } = actionApp([]);
      setProfessionAction(result);
      const before = [{ type: 'combat-start' }];
      app.build.rotation = before;
      app.rotationInsertionIndex = 0;
      dispatchPaletteAction(app, { ...request(type, { name: '__profession_action', id: null }), index: 1 }, {});
      const commands = result === null ? [] : Array.isArray(result) ? result : [result];
      assert.deepEqual(app.build.rotation, type === 'drop' ? [...before, ...commands] : [...commands, ...before]);
      assert.equal(changes.length, commands.length ? 1 : 0);

      if (commands.length) {
        assert.deepEqual(app._rotationHistory.undo, [before]);
        assert.equal(app.rotationInsertionIndex, type === 'drop' ? null : commands.length);
      } else {
        assert.equal(app._rotationHistory, undefined);
        assert.equal(app.rotationInsertionIndex, 0);
      }
    }
  });

  for (const [skill, editor, choice, command] of [
    [{ name: '__wait', id: null }, 'openDuration', 800, { type: 'wait', durationMs: 800 }],
    [dragonSlash, 'openCast', { releaseAtCharges: 3 }, { type: 'cast', skillId: 3, releaseAtCharges: 3 }],
    [doubleEdge, 'openDoubleEdge', 'backfire', { type: 'cast', skillId: 4, doubleEdgeOutcome: 'backfire' }]
  ]) {
    test(`${type} ${skill.name} leaves cancellation untouched and commits only the accepted editor choice`, () => {
      const { app, changes } = actionApp([dragonSlash, doubleEdge]);
      app.profession.ui.castEditor = (_context, value) => (value.id === dragonSlash.id ? descriptor : null);
      const before = [{ type: 'cooldown-reset' }, { type: 'combat-start' }];
      app.build.rotation = before;
      app.rotationInsertionIndex = 0;
      let opened;
      dispatchPaletteAction(app, request(type, skill), {
        [editor]: (options) => {
          opened = options;
        }
      });
      assert.ok(opened);
      assert.equal(opened.anchor, anchor);
      assert.equal(app.build.rotation, before);
      assert.equal(app._rotationHistory, undefined);
      assert.equal(app.rotationInsertionIndex, 0);
      assert.equal(changes.length, 0);

      if (editor === 'openCast') {
        assert.equal(opened.insertionIndex, type === 'drop' ? 2 : 0);
        assert.equal(opened.descriptor, descriptor);
      }

      opened.onApply(choice);
      assert.deepEqual(app.build.rotation, type === 'drop' ? [...before, command] : [command, ...before]);
      assert.equal(app.rotationInsertionIndex, type === 'drop' ? null : 1);
      assert.deepEqual(app._rotationHistory.undo, [before]);
      assert.equal(changes.length, 1);
    });
  }

  test(`${type} rejects duplicate combat markers and missing editor anchors without changing history`, () => {
    const { app, changes } = actionApp([]);
    app.build.rotation = [{ type: 'combat-start' }];
    dispatchPaletteAction(app, request(type, { name: '__combat_start', id: null }), {});
    dispatchPaletteAction(app, { ...request(type, { name: '__wait', id: null }), anchor: null }, {});
    assert.deepEqual(app.build.rotation, [{ type: 'combat-start' }]);
    assert.equal(app._rotationHistory, undefined);
    assert.equal(changes.length, 0);
  });
}

test('native activation uses the displayed face for its editor but inserts the canonical input', () => {
  const input = { id: 10, name: 'Generic input' };
  const displayed = { id: 11, name: 'Displayed form', castTimeMs: 500 };
  const { app } = actionApp([input, displayed]);
  let opened;
  dispatchPaletteActivation(
    app,
    displayed.name,
    {
      currentTarget: { ...anchor, dataset: { skillId: '10', displaySkillId: '11' } },
      ctrlKey: true,
      shiftKey: false
    },
    {
      openActivation: (options) => {
        opened = options;
      }
    }
  );
  assert.equal(opened.skillName, displayed.name);
  opened.onApply(600);
  assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: input.id, interruptAfterMs: 600 }]);
});

// Editor defaults come from the displayed skill's authored choice, without inserting a command before Apply.
test('Ctrl activation passes the authored interrupt default to the editor', () => {
  const skill = { ...ordinary, defaultInterruptMs: 480 };
  const { app } = actionApp([skill]);
  let opened;
  dispatchPaletteAction(
    app,
    { ...request('activate', skill), ctrlKey: true },
    {
      openActivation(options) {
        opened = options;
      }
    }
  );
  assert.equal(opened.interruptMs, 480);
  assert.equal(opened.suggestedInterruptMs, 480);
  assert.deepEqual(app.build.rotation, []);
});

test('Shift applies concurrency only to eligible activations; Ctrl remains an activation editor gesture', () => {
  const companion = { id: 5, name: 'Companion', independentCast: true, castTimeMs: 750 };
  for (const skill of [ordinary, instant, companion, { ...companion, canCastConcurrently: false }]) {
    for (const type of ['activate', 'drop']) {
      const { app } = actionApp([skill]);
      app.build.rotation = [{ type: 'cooldown-reset' }];
      dispatchPaletteAction(
        app,
        { ...request(type, skill), shiftKey: true, ctrlKey: true },
        {
          openActivation: (options) => options.onApply(600)
        }
      );
      const command = app.build.rotation.at(-1);
      const concurrent = type === 'activate' && skill !== ordinary && skill.canCastConcurrently !== false;
      assert.equal(command.concurrentOffsetMs, concurrent ? 120 : undefined);
      assert.equal(command.interruptAfterMs, type === 'activate' && !concurrent ? 600 : undefined);
    }
  }

  const { app } = actionApp([instant]);
  dispatchPaletteAction(app, { ...request('activate', instant), shiftKey: true }, {});
  assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: instant.id }]);
});

test('pet recharge handling does not expose Double Edge outcomes through either gesture', () => {
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
  for (const type of ['activate', 'drop']) {
    const { app } = actionApp([maul]);
    dispatchPaletteAction(app, request(type, maul), {});
    assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: maul.id }]);
  }
});
