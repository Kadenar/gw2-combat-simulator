# Patch preview

The patch-preview system lets the simulator model **one upcoming Guild Wars 2 balance patch** alongside the current live
game data.

A preview is a sparse overlay on top of the existing simulator data. It does not duplicate profession catalogs, builds,
or rotations.

This allows the same build and rotation to be simulated against:

- **Live** — the current simulator data;
- **Preview** — live data plus the authored upcoming changes.

The system is intended for upcoming **PvE changes that affect simulated behavior**.

---

## Normal workflow

For most patch previews:

```text
ArenaNet publishes preview notes
        ↓
Start the local authoring UI
        ↓
Select affected professions
        ↓
Edit skills, balance profiles, or modifier rules
        ↓
Review generated change overview
        ↓
Save active-preview.ts
        ↓
Rebuild/restart simulator
        ↓
Compare Live vs Preview
        ↓
When the patch ships, promote values into live source
        ↓
Remove the preview
```

Only one preview can be active at a time.

When no preview is being authored:

```ts
export const activePatchPreview: PatchPreview | null = null;
```

The file lives at:

```text
js/games/gw2/integrations/patches/active-preview.ts
```

---

# Author a preview

Start the dedicated local authoring server:

```sh
npm run author:patch-preview
```

Then open:

```text
http://127.0.0.1:4174
```

The authoring server binds only to `127.0.0.1`.

The normal simulator remains separate on:

```text
http://127.0.0.1:4173
```

The normal simulator server does not expose the patch-authoring write API.

---

## Preview metadata

At the top of the authoring page, configure:

- **ID** — stable internal identifier for the preview;
- **Label** — text shown in the simulator;
- **Publish date** — optional patch publication date;
- **Official patch notes URL** — link back to ArenaNet's source.

For example:

```text
ID: august-balance-preview
Label: August Balance Preview
Publish date: 2026-08-25
Official patch notes URL: https://...
```

Patch-note prose itself is **not** copied into the simulator manifest.

The manifest stores structured simulator changes and links back to the official notes for full context.

---

# What can be authored

The authoring UI exposes four main sections:

```text
Traits & modifiers
Skills
Balance profiles
Overview & source
```

Choose the section that owns the value being changed.

A useful rule is:

```text
Does the value belong to a skill?
    → Skills

Does it belong to shared non-skill mechanic data?
    → Balance profiles

Does it belong to a declarative damage/attribute modifier?
    → Traits & modifiers

Is it calculated imperatively in runtime code?
    → Patchable constant or ordinary code change
```

---

# Skills

The **Skills** section exposes the simulator's live skill metadata grouped by profession module and skill type.

Use it for changes such as:

- strike coefficients;
- condition stacks or durations;
- boon stacks or durations;
- cooldowns;
- cast times;
- ammo recharge;
- resource costs;
- hit counts;
- effect timing;
- other supported numeric skill fields.

The UI displays:

```text
live value → preview value
```

Changing a number produces a guarded edit:

```ts
{
  from: 1.2,
  to: 1.35,
}
```

The `from` value matters.

When the preview is rebuilt, the patch system verifies that the live value is still `1.2`. If the underlying simulator
data has changed, validation fails instead of silently applying the preview to a different baseline.

---

## Skill fields

Common skill-level values can be edited directly.

For example:

```ts
skills: {
  "12345": {
    fields: {
      cooldown: {
        from: 20,
        to: 15,
      },
    },
  },
},
```

Other examples include:

```text
castTimeMs
ammoRecharge
initiativeCost
energyCost
resourceCost
resourceGain
```

The available controls come from the actual live skill metadata. A field is only patchable when the skill exposes a
supported numeric value.

Prefer numeric skill IDs when possible.

---

## Existing effects

A skill's effects are shown individually.

Examples include:

```text
strike
condition
boon
buff
control
custom
```

Each effect is identified by its zero-based position in the skill's live `effects` array.

For example:

```ts
effects: [
  {
    effectIndex: 0,
    type: "strike",
    coefficient: {
      from: 1.2,
      to: 1.35,
    },
  },
],
```

The additional `type`, `condition`, `boon`, or similar identity fields act as guards.

If the live effect at that position no longer matches those expectations, preview construction fails.

This prevents an old patch from silently modifying the wrong effect after the live data changes.

---

## Timeline ticks

Effects with individual `ticks` can be edited at the tick level.

For example:

```ts
{
  effectIndex: 1,
  type: "condition",
  condition: "Burning",
  tickIndex: 2,
  duration: {
    from: 3,
    to: 4,
  },
}
```

Use tick-level editing when only one packet in a multi-packet effect changes.

---

## Add a new effect

The authoring UI can append a complete new effect object.

For example:

```ts
{
  type: "condition",
  condition: "Bleeding",
  stacks: 2,
  duration: 6,
  atMs: 500,
  timingAnchor: "castStart",
}
```

When adding an effect, define its complete simulator representation.

Timing fields are particularly important when the effect should not occur at the default effect time.

---

## Remove an effect

Existing effects can also be removed from the preview.

The generated patch uses a guarded selector such as:

```ts
removeEffects: [
  {
    effectIndex: 1,
    type: "condition",
    condition: "Poisoned",
  },
],
```

Removing an effect is different from changing its stacks, duration, or coefficient to zero.

The selected effect no longer exists in the preview catalog.

---

# Balance profiles

Some combat data belongs to reusable mechanic or balance profiles rather than directly to a skill.

These appear in the **Balance profiles** section.

A balance profile uses the same basic patch grammar as a skill:

```ts
balanceProfiles: {
  "profession.example-profile": {
    fields: {
      maximumStacks: {
        from: 5,
        to: 7,
      },
    },

    effects: [
      {
        effectIndex: 0,
        stacks: {
          from: 2,
          to: 3,
        },
      },
    ],
  },
},
```

Use a balance profile when the underlying simulator mechanic is already modeled as one.

Do not duplicate that value onto a skill solely to make it patchable.

The authoring UI exposes the live profile metadata and supported numeric values.

---

# Traits and modifier rules

Declarative trait and modifier behavior is authored through **modifier rules**.

A trait may contribute several independent modifier rules, so preview edits target the stable **modifier rule ID**, not
merely the trait ID.

For a static modifier:

```ts
modifierRules: {
  "profession.example-strike-bonus": {
    factor: {
      from: 1.1,
      to: 1.15,
    },
  },
},
```

The authoring UI shows the relevant rule alongside its trait/module context.

---

## Resolver-backed modifiers

Some modifiers calculate their value at runtime.

For example:

```ts
{
  id: "profession.example-stacking-bonus",
  parameters: {
    perStack: 0.01,
  },

  amount: (context, _target, parameters) =>
    activeStacks(context) * parameters.perStack,
}
```

The function itself is not patched.

Instead, expose the changing numeric input as a named parameter:

```ts
modifierRules: {
  "profession.example-stacking-bonus": {
    parameters: {
      perStack: {
        from: 0.01,
        to: 0.015,
      },
    },
  },
},
```

This keeps preview changes:

- numeric;
- inspectable;
- deterministic;
- protected by the same stale-value validation.

If a runtime calculation does not expose the changed number as a parameter, add that patchable seam to the
implementation first.

---

# Runtime constants

Some numeric behavior does not belong to:

- a skill;
- a balance profile;
- or a declarative modifier rule.

For those cases, the preview schema supports **named patchable constants**.

Example runtime code:

```ts
const factor = patchRuntimeValue(context.config.patchValues, 'warrior.traits.example.factor', 0.1);
```

The preview can then supply:

```ts
constants: {
  "warrior.traits.example.factor": {
    from: 0.1,
    to: 0.15,
  },
},
```

Constants can exist globally or under an individual profession.

They are an **advanced escape hatch for imperative code**.

The current local authoring UI does not provide a general constant editor, so adding a new constant usually requires:

1. exposing the named `patchRuntimeValue()` seam in code;
2. adding the structured constant edit to the manifest;
3. validating the preview.

Prefer skills, balance profiles, or modifier parameters whenever those already own the value.

---

# Behavior changes

Not every balance patch is numeric.

A patch may change:

- when an effect triggers;
- resource behavior;
- skill availability;
- a state transition;
- target selection;
- effect ownership;
- another mechanic implemented in code.

Do **not** create an inert numeric manifest entry simply to represent the patch note.

Implement the new behavior in the appropriate profession/runtime code.

If both Live and Preview behavior must exist simultaneously, branch on the selected patch through an explicit
preview-aware seam.

The patch preview should model actual simulator behavior, not act as a checklist of every sentence in ArenaNet's notes.

---

# Changes that should not be authored

The simulator models PvE.

Do not create preview edits for:

- PvP-only changes;
- WvW-only changes;
- description-only text changes;
- systems the simulator does not model;
- patch-note entries explicitly marked unchanged;
- obsolete changes superseded by newer preview notes.

The official patch-notes URL remains the source for the complete announcement.

The preview manifest should contain only changes that affect this simulator's output or behavior.

---

# Generated overview

The **Overview & source** section is read-only.

It is generated from the structured authored changes.

Currently, overview entries are generated from:

```text
skill diffs
balance-profile diffs
modifier-rule diffs
```

For example:

```text
Example Skill
Coefficient 1.2 → 1.35; cooldown 20 → 15.

Example Profile
Maximum stacks 5 → 7.

Example Modifier
Factor 1.1 → 1.15.
```

Authors do not maintain a second copy of patch-note prose.

Manual overview notes are intentionally unsupported so the displayed summary cannot drift away from the actual
structured preview.

Runtime constants and ordinary code-only behavior changes are not automatically described by this generated diff
overview.

Use the official source link and code review for those changes.

---

# Saving the preview

Saving the authoring form sends the complete draft to:

```text
PUT /api/patch-preview
```

The local authoring server then:

1. validates the overall preview schema;
2. generates the structured overview;
3. validates each affected profession against its live catalog and modifier declarations;
4. rejects stale or unknown targets;
5. writes:

```text
js/games/gw2/integrations/patches/active-preview.ts
```

A successful save changes source code on disk.

The simulator does **not** automatically reload that TypeScript source.

Rebuild or restart the simulator before testing the newly saved preview.

---

# Using the preview in the simulator

When an active preview exists, profession pages expose a **Game data** selector:

```text
Live | <Preview Label>
```

The selection determines which catalog and runtime values are used for the detailed simulation result.

Patch selection is application state, not build identity.

A build describes things such as:

```text
gear
traits
skills
weapons
rotation
assumptions
```

The patch selector describes **which version of the game's simulated data evaluates that build**.

Exporting the build therefore does not turn it into a preview-specific build.

---

## Live vs Preview comparison

When a preview is active, the simulator evaluates the same build and rotation against both data sets.

The comparison shows:

- Live DPS;
- Preview DPS;
- absolute DPS difference;
- percentage difference;
- per-skill DPS changes;
- generated change overview;
- link to the official patch notes.

For example:

```text
Live DPS       42,100
Preview DPS    40,850
Difference     -1,250 (-2.97%)
```

The automatic comparison uses deterministic simulation so RNG noise is not mistaken for a balance change.

The normal detailed result follows whichever data set is selected by the user.

---

# How the overlay works

The important architecture rule is:

> Live data remains the source of truth. Preview data is only the difference.

Conceptually:

```text
live skill catalog
        +
preview skill/profile edits
        ↓
preview catalog
```

and:

```text
live modifier declarations
        +
preview modifier edits
        ↓
preview runtime rules
```

while imperative values use:

```text
live constant
        +
patchValues
        ↓
preview runtime value
```

Untouched data remains live data.

The patch system does not mutate the live catalog or live modifier declarations when constructing a preview.

This keeps Live and Preview available side-by-side for the same build.

---

# Validation and failure behavior

Patch previews intentionally fail fast.

Examples of invalid authoring include:

```text
unknown profession
unknown skill
unknown balance profile
unknown modifier rule
unknown numeric field
unknown modifier parameter
stale "from" value
ambiguous effect selector
invalid effect index
invalid patch ID
invalid source URL
```

For example:

```ts
{
  from: 1.2,
  to: 1.3,
}
```

cannot be applied if the current live value has since become `1.25`.

The author must review the new live value and decide whether the preview still applies.

Do not bypass the stale-value guard merely to make an old preview validate.

---

# Preview limitations

The overlay is intentionally designed for sparse changes.

Preview edits should normally change:

```text
numbers
effects
modifier parameters
existing modeled behavior
```

They should not use the sparse catalog overlay to redefine major identity or topology.

Changes such as:

- completely new skills;
- removed skills;
- changed skill IDs;
- major loadout changes;
- new profession mechanics;

usually require ordinary implementation work.

If that work must remain preview-only until release, make the implementation explicitly patch-aware.

Existing build and rotation identities should remain stable whenever possible so the same scenario can be compared
against Live and Preview.

---

# Review before committing

The authoring UI writes source directly.

Always inspect the generated diff for:

```text
js/games/gw2/integrations/patches/active-preview.ts
```

before committing it.

The manifest should contain only the intended sparse edits.

In particular, verify:

- profession;
- skill/profile/rule identity;
- live `from` value;
- preview `to` value;
- effect/tick index;
- added or removed effects;
- official source URL.

Then rebuild and run:

```sh
npm run check
```

---

# Promotion when the patch goes live

When the preview becomes the live Guild Wars 2 patch, the preview should disappear.

The intended process is:

```text
preview value
      ↓
live owning source
      ↓
remove preview overlay
```

Do not keep the preview indefinitely as historical simulator data.

Run:

```sh
npm run patch-preview:report
```

before promotion.

The command builds the typed preview and resolves affected preview catalogs/runtimes so stale selectors and invalid
modifier declarations fail before promotion.

It also prints a promotion checklist for supported authored targets such as skills, modifier rules, and runtime
constants.

Balance-profile patches are validated as part of preview catalog construction; inspect their authored manifest entries
when promoting them as well.

Then:

1. apply every preview value to its live owning source;
2. update generated source where appropriate;
3. remove the preview by restoring:

```ts
export const activePatchPreview: PatchPreview | null = null;
```

4. rebuild;
5. run the full validation suite;
6. verify that the new Live result matches the former Preview result.

The promotion should be reviewable as an ordinary source change rather than an automated blind rewrite.

---

# Choosing the correct authoring path

Use this as the quick reference:

| Change                                 | Author through                            |
| -------------------------------------- | ----------------------------------------- |
| Skill coefficient                      | Skills → effect                           |
| Skill cooldown/cast time/resource cost | Skills → numeric field                    |
| Condition or boon duration/stacks      | Skills → effect/tick                      |
| New or removed skill effect            | Skills → add/remove effect                |
| Shared non-skill mechanic data         | Balance profiles                          |
| Static trait damage modifier           | Traits & modifiers                        |
| Runtime trait scaling value            | Modifier parameter                        |
| Imperative numeric constant            | `patchRuntimeValue()` + manifest constant |
| Behavioral/code change                 | Ordinary patch-aware implementation       |
| PvP/WvW-only change                    | Do not author                             |
| Description-only change                | Do not author                             |

The key principle is:

> Patch the value where the simulator already owns it.

Do not create duplicate preview-only data simply because another location is easier to edit.
