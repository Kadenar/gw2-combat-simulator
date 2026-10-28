# Benchmarks

Choose **Benchmarks** in the main navigation to open the standalone dashboard. A profession's benchmark link starts with
that profession selected; the main link starts with all professions.

## Browse saved metrics

Use the profession toggles, search, **Damage type**, and **Boon role** filters to narrow the results. Profession
selections are additive. **Include outdated** shows older presets; **Reset** restores the initial all-profession
filters.

- **Build benchmarks** offers Cards and Table views. Open a build to load its saved build and matching rotation in the
  simulator. Reference links, when present, open the benchmark's external source.
- **DPS / APM by Build** compares saved damage and actions per minute across builds.
- **DPS vs APM** plots damage against input frequency. APM measures non-autoattack inputs over the execution window,
  excluding precasts before an explicit combat boundary; it is not a complete measure of build difficulty.
- **DPS by health** compares target-health bands. **Cumulative** measures damage from combat start to the band's
  endpoint; **Phase** measures only that band's damage and duration. You can select a band and show all matching builds
  or the top DPS build per profession.

These views read saved simulator metrics. Unreached health endpoints have no value; if the target survives, the final
20–0% band uses final overall DPS. Treat the numbers as results for those saved setups, not guaranteed in-game damage.

## Run a comparison

1. Open **Simulate comparison**.
2. Choose builds with saved rotations from its picker and review any **Allies per simulation** controls.
3. Select **Run comparison** and review warnings for each run.
4. Switch between **Average**, **Last 1s**, and **Last 5s** to compare sustained damage or burst windows.

Drag across the chart to zoom, click to pin a time, or toggle legend entries to hide curves. Completed results remain
cached until the page reloads. **Partial comparison** means some visible runs have ended, so later values cover fewer
builds. **Cancel run** stops an in-progress comparison.

When an active balance preview is available, **Patch preview** provides the corresponding comparison view. Keep the
patch and simulation assumptions consistent when interpreting differences.

For editing an individual setup, see [Builds and templates](Builds-and-Templates).
