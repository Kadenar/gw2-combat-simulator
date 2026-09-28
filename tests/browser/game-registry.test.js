import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapGameApp } from '#browser/bootstrap.js';
import { defineGameRegistry, loadGameContent } from '#browser/game/registry.js';
import { loadGameWorkerDriver } from '#browser/game/worker-driver.js';
import { createFakeGamePlugin } from '#tests/fixtures/fake-game-plugin.js';

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
  const content = await loadGameContent('fake', 'pilot', fakeRegistry());

  assert.deepEqual(app, { root, started: true });
  assert.equal(content.gameId, 'fake');
});

test('bootstrap requires both explicit IDs even when legacy profession markup is present', async () => {
  // Reject incomplete identity before attempting to select or mount content.
  for (const dataset of [
    { profession: 'pilot' },
    { game: 'gw2', profession: 'pilot' },
    { content: 'pilot', profession: 'pilot' }
  ]) {
    await assert.rejects(
      bootstrapGameApp({ body: { dataset } }, fakeRegistry('gw2')),
      /requires data-game and data-content/
    );
  }
});

test('the GW2 game plug-in exposes the existing lazy profession registry', async () => {
  const [{ professionRegistry }, { gw2Plugin }] = await Promise.all([
    import('#gw2/profession-registry.js'),
    import('#gw2/plugin.js')
  ]);

  assert.deepEqual(
    gw2Plugin.content,
    professionRegistry.map(({ id }) => ({ id }))
  );
  const content = await loadGameContent('gw2', 'warrior');
  const adapter = await professionRegistry.find(({ id }) => id === 'warrior').loadAppAdapter();
  const profession = await loadGameWorkerDriver({ gameId: 'gw2', contentId: 'warrior' });
  assert.equal(content.gameId, 'gw2');
  assert.deepEqual(
    adapter.buildEditor.sections.map(({ id }) => id),
    ['gear', 'traits', 'attributes', 'skills', 'assumptions']
  );
  assert.equal(typeof adapter.presentation.createViewModel, 'function');
  // Worker drivers expose the engine directly; browser-only composition belongs to the app loader.
  assert.equal(profession.id, 'warrior');
  assert.equal(typeof profession.resolveProfession, 'function');
  assert.equal(typeof profession.catalogFor, 'function');
  assert.equal('buildEditor' in profession, false);
  assert.equal(await loadGameWorkerDriver({ gameId: 'gw2', contentId: 'warrior' }), profession);
  assert.equal(await loadGameWorkerDriver({ gameId: 'unknown', contentId: 'warrior' }), null);
  assert.equal(await loadGameWorkerDriver({ gameId: 'gw2', contentId: 'unknown' }), null);
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
          load: async () => ({ id: 'other', content: [], loadContent: async () => null })
        }
      ])
    ),
    /returned plug-in "other"/
  );

  // Removing display metadata must preserve validation of identity and the loading lifecycle.
  for (const [overrides, error] of [
    [{ id: 'Invalid' }, /GamePlugin\.id/],
    [{ content: [{ id: 'Invalid' }] }, /content\[0\]\.id/],
    [{ content: [{ id: 'pilot' }, { id: 'pilot' }] }, /duplicate ID/],
    [{ loadContent: null }, /loadContent must be a function/],
    [{ loadContent: async () => null }, /did not load its declared content/],
    [{ loadContent: async () => ({ gameId: 'other', id: 'pilot' }) }, /mismatched plug-in/],
    [{ loadContent: async () => ({ gameId: 'fake', id: 'other' }) }, /mismatched plug-in/],
    [{ loadContent: async () => ({ gameId: 'fake', id: 'pilot' }) }, /mount must be a function/]
  ]) {
    const registry = defineGameRegistry([
      { id: 'fake', load: async () => ({ ...createFakeGamePlugin(), ...overrides }) }
    ]);
    await assert.rejects(loadGameContent('fake', 'pilot', registry), error);
  }
});
