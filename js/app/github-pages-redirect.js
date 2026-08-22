// Single source for the GitHub Pages redirect. The inject-github-pages-redirect
// Vite plugin inlines this verbatim as a blocking <script> at the top of each
// hosted page's <head>, so it runs before the page paints (zero flicker).
//
// Bounces direct visitors of the GitHub Pages deployment to the SnowCrows page
// where the simulator is embedded. When the page is framed (the SnowCrows embed)
// window.self !== window.top, so it stays put. Set SNOWCROWS_URL to enable.
(function redirectFromGithubPages() {
  const GITHUB_PAGES_HOST = 'kadenar.github.io';
  const SNOWCROWS_URL = null; // e.g. 'https://snowcrows.com/your-embed-page'

  const onGithubPages = window.location.hostname === GITHUB_PAGES_HOST;
  const topLevel = window.self === window.top;

  if (SNOWCROWS_URL && onGithubPages && topLevel) {
    window.location.replace(SNOWCROWS_URL);
  }
})();
