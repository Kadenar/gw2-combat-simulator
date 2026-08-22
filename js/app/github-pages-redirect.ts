// Bounces direct visitors of the GitHub Pages deployment to the SnowCrows page
// where the simulator is embedded. Runs before the app boots. When the page is
// framed (the SnowCrows embed) window.self !== window.top, so it stays put.

const GITHUB_PAGES_HOST = 'kadenar.github.io';
const SNOWCROWS_URL = null; // 'https://snowcrows.com/YOUR-SIMULATOR-PAGE';

const isGitHubPages = window.location.hostname === GITHUB_PAGES_HOST;
const isTopLevel = window.self === window.top;

if (SNOWCROWS_URL && isGitHubPages && isTopLevel) {
  window.location.replace(SNOWCROWS_URL);
}

export {};
