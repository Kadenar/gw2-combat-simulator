// Supplies one vocabulary-neutral playable entry for exercising the shared game seam without loading GW2 code.
export function createFakeGamePlugin(gameId = 'fake') {
  const content = {
    gameId,
    id: 'pilot',
    async mount(root) {
      return { root, started: true };
    }
  };

  return {
    id: gameId,
    content: [{ id: 'pilot' }],
    async loadContent(contentId) {
      return contentId === content.id ? content : null;
    }
  };
}
