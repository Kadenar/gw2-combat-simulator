// Keep icon URL and layout assertions independent of the external image host and its failure fallbacks.
export async function mockGw2Icons(page) {
  await page.route('https://render.guildwars2.com/file/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#a38ad5"/></svg>'
    })
  );
}
