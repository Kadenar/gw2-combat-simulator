# Local GW2 Wiki image backups

The simulator bundles these images with Vite instead of requesting them from the Guild Wars 2 Wiki at runtime. This
keeps the artwork available during Wiki maintenance or an outage, including the trait-line backgrounds that were
previously constructed from specialization names.

## Inventory

The October 21, 2026 assessment found **84 distinct runtime icons** and **81 specialization backgrounds** dependent on
the Wiki. The nine Wiki-sourced core profession portraits were already stored under `images/professions/`; their
original attribution is preserved in that directory's README.

`manifest.json` records every backed-up image, its original Wiki URL, the actual download source, dimensions, byte
count, SHA-256 checksum, and the source files that referenced it. Archive timestamps identify the version recovered when
the live Wiki image host returned HTTP 403.

- Original Wiki icons were recovered from public Internet Archive snapshots where available.
- For icons without an archived full-size file, the manifest identifies the recovered Wiki thumbnail and its actual
  dimensions. These are the same artwork at the archived resolution; they have not been enlarged or regenerated.
- Heavy Shot was downloaded from the corresponding ArenaNet skill icon (the public Soulbeast skill record), as neither
  the full-size Wiki file nor a thumbnail was archived.
- All 81 specialization backgrounds were downloaded from the `background` field of ArenaNet's `/v2/specializations` API
  as 1024 × 256 textures, then cropped to the 647 × 136 banner at `(0, 120)` without resizing. This removes the
  transparent or black padding and extra artwork that would otherwise shrink and displace portraits in the trait panel.
  The manifest records the source dimensions and crop alongside the resulting file dimensions and checksum.

The manifest retains upstream URLs for provenance. Browser image references use local files. Wiki article links in
tooltips and the optional data generators' Wiki metadata requests are separate from image loading. ArenaNet
render-service images continue to use the existing CDN handling.

The audit also corrected two stale source paths: Phoenix Wing Buffet uses `Wing_Buffet.png`, and Exploding Spores uses
`/images/2/21/Exploding_Spores.png`. The original references and recovered sources are both retained in the manifest.

## Maintaining the backups

Use a static asset URL so Vite includes the file in production builds and resolves it relative to the deployment
location:

```ts
icon: new URL('@images/wiki/dodge.png', import.meta.url).href;
```

Trait-line artwork is listed explicitly in `js/games/gw2/app/shared/specialization-backgrounds.ts`. The Ranger and
Warrior generator inputs use `@images/wiki/...` specifiers, and their serializers emit the same static URL expressions;
regenerating profession data therefore preserves these local images.

When replacing a specialization background from the API, apply the same banner crop before saving it. Do not trim only
transparent pixels: many source textures have opaque black margins or artwork outside the banner rectangle. Keep the
upstream URL and source dimensions in the manifest so the transformation remains reproducible.

When adding or replacing an image, update its manifest entry and run:

```sh
npm run build
node --test tests/scripts/wiki-images.test.mjs tests/scripts/generated-identity-preservation.test.mjs
npm run test:browser -- tests/browser/image-assets.spec.js
```

The checks validate PNG signatures and checksums, inventory coverage, specialization coverage and banner dimensions,
generator preservation, and browser image decoding while the Wiki host is blocked. Normal builds and tests never
download these backups.

Guild Wars 2 artwork remains the property of ArenaNet and its respective rights holders. Original source links are
retained for attribution; these files are not newly created simulator artwork.
