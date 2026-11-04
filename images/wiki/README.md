# Local GW2 Wiki image backups

The simulator bundles these images with Vite instead of requesting them from the Guild Wars 2 Wiki at runtime. This
keeps the artwork available during Wiki maintenance or an outage, including the trait-line backgrounds that were
previously constructed from specialization names.

## Inventory

The October 21, 2026 assessment found **84 distinct runtime icons** and **81 specialization backgrounds** dependent on
the Wiki. The nine Wiki-sourced core profession portraits were already stored under `images/professions/`; their
original attribution is preserved in that directory's README.

- Original Wiki icons were recovered from public Internet Archive snapshots where available.
- For icons without an archived full-size file, Wiki thumbnails were recovered at their archived resolution; they have
  not been enlarged or regenerated.
- Heavy Shot was downloaded from the corresponding ArenaNet skill icon (the public Soulbeast skill record), as neither
  the full-size Wiki file nor a thumbnail was archived.
- All 81 specialization backgrounds were downloaded from the `background` field of ArenaNet's `/v2/specializations` API
  as 1024 × 256 textures, then cropped to the 647 × 136 banner at `(0, 120)` without resizing. This removes the
  transparent or black padding and extra artwork that would otherwise shrink and displace portraits in the trait panel.

Wiki-sourced browser artwork uses local files. Wiki article links in tooltips are separate from image loading. ArenaNet
render-service images continue to use the existing CDN handling.

The audit also corrected a stale source path: Phoenix Wing Buffet uses `Wing_Buffet.png`.

## Maintaining the backups

Use a static asset URL so Vite includes the file in production builds and resolves it relative to the deployment
location:

```ts
icon: new URL('@images/wiki/dodge.png', import.meta.url).href;
```

Trait-line artwork is listed explicitly in `js/games/gw2/app/shared/specialization-backgrounds.ts`. Profession skill and
trait declarations are maintained directly in their owning files. Update their image references with static
`new URL('@images/wiki/...', import.meta.url).href` expressions; there is no profession-data generator or refresh step.

When replacing a specialization background from the API, apply the same banner crop before saving it. Do not trim only
transparent pixels: many source textures have opaque black margins or artwork outside the banner rectangle.

When adding or replacing an image, run:

```sh
npm run build
node --test tests/scripts/wiki-images.test.mjs
npm run test:browser -- tests/browser/image-assets.spec.js
```

The checks validate specialization background coverage and browser artwork loading. Normal builds and tests never
download these backups.

Guild Wars 2 artwork remains the property of ArenaNet and its respective rights holders; these files are not newly
created simulator artwork.
