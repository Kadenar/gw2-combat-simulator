// Supplies one vocabulary-neutral playable entry for exercising the shared game seam without loading GW2 code.
export function createFakeGamePlugin(gameId = 'fake') {
  const content = {
    gameId,
    id: 'pilot',
    name: 'Pilot',
    async mount(root) {
      return { root, started: true };
    }
  };

  return {
    id: gameId,
    name: 'Fake Game',
    content: [{ id: 'pilot', name: 'Pilot', route: 'pilot.html' }],
    async loadContent(contentId) {
      return contentId === content.id ? content : null;
    }
  };
}
