// Single source for the GitHub Pages redirect. The inject-github-pages-redirect
// Vite plugin inlines this verbatim as a blocking <script> at the top of each
// hosted page's <head>, so it runs before the page paints (zero flicker).
//
// Bounces direct visitors of the GitHub Pages deployment to the SnowCrows page
// where the simulator is embedded. When the page is framed (the SnowCrows embed)
// window.self !== window.top, so it stays put.
(function redirectFromGithubPages() {
  const GITHUB_PAGES_HOST = 'kadenar.github.io';
  const SNOWCROWS_URL = 'https://snowcrows.com/combat-simulator';

  const onGithubPages = window.location.hostname === GITHUB_PAGES_HOST;
  const topLevel = window.self === window.top;

  if (!onGithubPages || !topLevel) return;

  // The unlisted ?standalone=1 link bypasses the redirect only while the URL carries the flag.
  // This is a convenience flag, not access control; embed styling still uses ?embed=1 independently.
  const standalone = new URLSearchParams(window.location.search).get('standalone') === '1';

  if (!standalone) {
    window.location.replace(SNOWCROWS_URL);
  }
})();
