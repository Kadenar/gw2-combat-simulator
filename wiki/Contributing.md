# Contributing

## Submit a build

The simulator accepts community build and rotation presets through the repository's
[build-submission form](https://github.com/Kadenar/gw2-combat-simulator/issues/new?template=build-submission.yml).

Export and attach both the build JSON and matching rotation JSON. Include the profession, specialization, expected
simulator DPS, optional benchmark source, and any relevant modeling notes. Repository issue attachments are public, so
remove private notes or identifying information first.

See
[Community Build Submissions](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/BUILD-SUBMISSIONS.md) for the
review process.

## Report a problem

[Open an issue](https://github.com/Kadenar/gw2-combat-simulator/issues) with the smallest build and rotation that show the
problem. Include:

- Profession and specialization
- Exported build and rotation files
- The warning or incorrect result
- The expected behavior and how it was verified in game or from an authoritative source

## Contribute code

Start with the repository's
[README](https://github.com/Kadenar/gw2-combat-simulator#development) and
[architecture documentation](https://github.com/Kadenar/gw2-combat-simulator/tree/main/docs/architecture).

Run the full project check before submitting a pull request:

```bash
npm run check
```
