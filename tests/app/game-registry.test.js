import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapGameApp } from '../../js/app/bootstrap.js';
import { defineGameRegistry, loadGameContent } from '../../js/app/game/registry.js';
import { createFakeGamePlugin } from '../fixtures/fake-game-plugin.js';

// Builds a game with no GW2 dependencies so registry and bootstrap behavior stay content-vocabulary neutral.
function fakeRegistry(gameId = 'fake') {
  return defineGameRegistry([
    {
      id: gameId,
      async load() {
        return createFakeGamePlugin(gameId);
      }
    }
  ]);
}

test('a non-GW2 game reaches the shared bootstrap through explicit game and content IDs', async () => {
  const root = { body: { dataset: { game: 'fake', content: 'pilot' } } };
  const app = await bootstrapGameApp(root, fakeRegistry());

  assert.deepEqual(app, { root, started: true });
});

test('legacy profession markup defaults to the GW2 game ID', async () => {
  const root = { body: { dataset: { profession: 'pilot' } } };
  const app = await bootstrapGameApp(root, fakeRegistry('gw2'));

  assert.equal(app.started, true);
});

test('the GW2 game plug-in exposes the existing lazy profession registry', async () => {
  const [{ professionRegistry }, { gw2Plugin }] = await Promise.all([
    import('../../js/app/profession/registry.js'),
    import('../../js/games/gw2/plugin.js')
  ]);

  assert.deepEqual(
    gw2Plugin.content.map(({ id, name, route }) => ({ id, name, route })),
    professionRegistry.map(({ id, name, route }) => ({ id, name, route }))
  );
  assert.equal((await loadGameContent('gw2', 'warrior'))?.gameId, 'gw2');
  assert.equal(await loadGameContent('gw2', 'unknown'), null);
});

test('registry validation rejects duplicate IDs and malformed plug-ins', async () => {
  assert.throws(
    () =>
      defineGameRegistry([
        { id: 'fake', load: async () => null },
        { id: 'fake', load: async () => null }
      ]),
    /duplicate ID/
  );

  await assert.rejects(
    loadGameContent(
      'fake',
      'pilot',
      defineGameRegistry([
        {
          id: 'fake',
          load: async () => ({ id: 'other', name: 'Other', content: [], loadContent: async () => null })
        }
      ])
    ),
    /returned plug-in "other"/
  );

  await assert.rejects(
    loadGameContent(
      'fake',
      'pilot',
      defineGameRegistry([
        {
          id: 'fake',
          async load() {
            return { ...createFakeGamePlugin(), content: [{ id: 'pilot', name: 'Pilot', route: '' }] };
          }
        }
      ])
    ),
    /content\[0\]\.route/
  );
});
