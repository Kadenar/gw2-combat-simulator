# Effect Metadata Contract

Status: implemented

## Decision

Use three distinct parts of an effect contract:

1. The top-level effect envelope contains fields required to validate, schedule, materialize, or resolve the base effect.
2. A nested `audience` object contains recipient-selection fields.
3. A nested `metadata` object contains sparse, typed annotations owned by a downstream subsystem.

Both nested objects remain nested from skill definition through the runtime event. Input fields are never flattened or accepted in more than one location.

## Why

The old model gave `metadata` two incompatible meanings:

- an object on an authored effect; and
- fields spread onto a runtime event.

It also allows several fields both at the top level and inside `metadata`. That makes precedence part of the API even though no precedence rule is documented.

Nesting is useful when it groups a real concern. Recipient selection is one such concern. A generic metadata bag is not a substitute for a named behavior contract.

## Target shape

```ts
interface EffectAudience {
  readonly recipients: "self" | "party" | "summons";
  readonly affectsSelf?: boolean;
  readonly maximumRecipients?: number;
  readonly eligibleCompanionIds?: readonly string[];
}

interface ResolvedEffectAudience {
  readonly includesSelf: boolean;
  readonly includesSummons: boolean;
  readonly alliedPlayerCount: number;
  readonly companionIds: readonly string[];
  readonly recipientCount: number;
}

interface EffectMetadata {
  readonly activeSpirits?: number;
  readonly affinityOnHit?: boolean;
  readonly anguishConditionalDamage?: boolean;
  readonly blightEmpowered?: boolean;
  readonly dhuumfireDuration?: number;
  readonly dhuumfireInterval?: number;
  readonly engineerMech?: boolean;
  readonly essenceBlastDamagePerSpirit?: number;
  readonly evtcSkillId?: string | number;
  readonly hitboxIndex?: number;
  readonly largeHitboxOnly?: boolean;
  readonly legendId?: string;
  readonly necromancerBlight?: number;
  readonly necromancerShroudSkillOne?: boolean;
  readonly packetKind?: string;
  readonly radiantWeapon?: string;
  readonly smallHitboxCap?: number;
  readonly spirit?: string;
  readonly spiritAttackType?: string;
  readonly trigger?: string;
}

interface SkillEffectBase {
  readonly type: string;
  readonly atMs?: number;
  readonly audience?: EffectAudience;
  readonly metadata?: EffectMetadata;
}
```

The exact literal unions should reuse existing domain types. The example shows ownership and placement, not a request to replace existing types with `string`.

Do not add generic type parameters or module augmentation for metadata unless the closed interface becomes an actual maintenance problem.

`audience` is the selection request. Recipient resolution adds a separate `resolvedAudience` object to the prepared runtime event. This prevents input fields such as `affectsSummons` and `companionIds` from changing meaning after resolution.

### Audience semantics

- No `audience` object means self only.
- `self` selects only the caster.
- `party` selects the simulated player by default, then simulated allied party members. Eligible summons fill any slots left under `maximumRecipients`.
- `summons` selects the simulated player by default and eligible summons. For example, `"We Heal As One!"` uses this scope with a cap of two to select the player and pet.
- `affectsSelf: false` excludes the simulated player. This preserves ally-only and pet-only effects without adding recipient scopes.
- The simulator decides which summons are eligible under its sharing settings; skills do not encode that policy.
- `eligibleCompanionIds` supplies concrete candidates from procedural code or scheduler preparation. It is not the resolved recipient list.
- `maximumRecipients` caps the total selected recipients. The default is one for self-only effects and five for shared effects.
- `resolvedAudience.companionIds` contains only companions selected after player-first cap allocation.
- `resolvedAudience.includesSelf` reports whether the simulated player was selected. It is false for a summon-cast self buff even though that summon caster is always selected.
- Player-state consumers, including timed-effect charts and live boon queries, ignore applications whose resolved audience does not include the simulated player.

Every player-cast scope includes the simulated player unless `affectsSelf` is false. A summon-cast self effect selects that summon without selecting the simulated player.

Only the three canonical `recipients` values are accepted. Existing values and synonyms such as `allies`, `pet`, `pets`, and `companions` are retired rather than normalized.

## Placement rule

A field belongs at the top level when the platform must understand it to construct the base effect. Examples include:

- timing and identity: `type`, `at`, `skillName`, `parentSkillName`;
- strike formula: `coefficient`, `flatDamage`, `flatStrikeBase`, `flatStrikePowerCoeff`, critical-hit flags, and thresholds;
- duration and applications: `duration`, `stacks`, `applications`, `interval`;
- core payload: `boon`, `condition`, `controlKind`, `breakbar`, and `summonKind`.

A field belongs in `audience` when it changes which player, ally, or companion receives an otherwise complete effect.

A field belongs in `metadata` only when all of the following are true:

- the base effect can be validated and materialized without interpreting it;
- one downstream subsystem owns its meaning;
- the key and value type are declared in the metadata schema and catalog allowlist;
- it does not duplicate an envelope or audience field.

Metadata may influence downstream behavior. It is not limited to display-only information. The contractual boundary is that upstream effect construction treats it as an opaque, validated value and preserves it unchanged.

## One signature end to end

Declarative skill effect:

```ts
{
  type: "boon",
  boon: "might",
  duration: 10,
  audience: {
    recipients: "party",
    maximumRecipients: 5,
  },
}
```

Procedural emitter:

```ts
emitSkillBuff(context, skill, {
  at,
  kind: "might",
  duration: 10,
  audience: {
    recipients: "party",
    maximumRecipients: 5,
  },
});
```

Runtime event before recipient resolution:

```ts
{
  type: "buff",
  kind: "might",
  duration: 10,
  audience: {
    recipients: "party",
    maximumRecipients: 5,
  },
}
```

Runtime event after recipient resolution:

```ts
{
  // Base fields, audience, and metadata are unchanged.
  resolvedAudience: {
    includesSelf: true,
    includesSummons: false,
    alliedPlayerCount: 4,
    companionIds: [],
    recipientCount: 5,
  },
}
```

Consumers read `event.audience.recipients` and `event.metadata.trigger`. The materializer and procedural emitters do not spread either object onto the event.

After recipient resolution, consumers of actual application state read `event.resolvedAudience`. They do not infer the result again from the selection request.

## Field disposition

The remaining overlapping fields should resolve as follows:

| Field group | Canonical location | Reason |
| --- | --- | --- |
| `recipients`, `maximumRecipients` | `audience` | Recipient selection |
| Input `affectsSelf` | `audience` | Excludes the simulated player for ally-only or pet-only effects |
| Input `affectsSummons` | Retire; use `audience.recipients` | `party` uses summons as fallback and `summons` selects self plus summons |
| Input `companionIds` | Retire in favor of `audience.eligibleCompanionIds` | Identifies candidates, not selected recipients |
| Output `affectsSelf` | `resolvedAudience.includesSelf` | Reports whether the simulated player was selected, which can be false for summon-cast effects |
| Output `affectsSummons`, `alliedPlayerCount`, `companionIds`, `recipientCount` | `resolvedAudience` | Resolution result |
| `targetCap` | Retire; use `audience.maximumRecipients` | It is currently an alias with precedence, not a distinct concept |
| `duration` | Top level | Core effect lifetime |
| `flatDamage`, `flatStrikeBase`, `flatStrikePowerCoeff` | Top level | Core strike formula |
| Strike multipliers, thresholds, and critical-hit flags | Top level | Core strike formula |
| `summonKind` | Top level | Core ownership/source identity |
| `controlKind`, `breakbar`, `bonusDefianceBreak` | Top level | Core control payload |
| `skillName`, `parentSkillName` | Top level | Canonical attribution |
| `hitboxIndex`, `smallHitboxCap`, `largeHitboxOnly` | `metadata` | Downstream hitbox resolution |
| `affinityOnHit`, `legendId`, `trigger` | `metadata` | Profession-specific selection or reaction data |
| `target` | Top level on effect types that support a non-default target | Core effect destination |
| `packetKind` | `metadata` | Downstream packet classification |

If a metadata area grows into several related fields with shared validation, promote that group to a named nested object. Do not create such objects speculatively.

## Validation

Validation must enforce one canonical placement rather than normalize inputs:

- reject unknown top-level effect fields;
- reject unknown `audience` and `metadata` fields;
- reject non-object `audience` or `metadata` values;
- reject invalid values such as non-positive recipient caps;
- reject any key registered in more than one contract;
- keep TypeScript declarations and runtime allowlists derived from, or tested against, the same field inventory.

There is no precedence rule because duplicate placement is invalid.

## Implementation

This is a hard schema change with no compatibility adapters:

1. `EffectAudience` and the closed `EffectMetadata` contract are shared by declarative and procedural effects.
2. The materializer, procedural emitters, runtime event types, and recipient resolver preserve and consume the nested objects.
3. Skill definitions and procedural callers use the canonical field locations.
4. Old metadata fallbacks, object spreads, direct recipient fields, and duplicate allowlist entries are removed.
5. Catalog validation rejects every retired placement.

If these event objects are persisted or consumed outside this repository, version that external boundary and migrate it explicitly. Do not keep dual readers inside the engine.

## Required contract tests

Keep the tests focused on the boundary:

- a declarative effect preserves `audience` and `metadata` as nested objects;
- a procedural emitter produces the same runtime shape;
- the recipient resolver consumes only `event.audience`;
- resolved applications expose only `event.resolvedAudience` for selected recipients;
- duplicate, misplaced, and unknown fields are rejected;
- `duration`, strike formula fields, and `summonKind` work only at their canonical top-level locations;
- metadata owned by a downstream subsystem survives materialization unchanged.

Broad preset regressions are not needed for this contract beyond the repository's existing load-and-simulate checks.

## Result

The model stays compact without making `metadata` an untyped escape hatch:

```text
effect
|-- base effect envelope
|-- audience     recipient-selection contract
`-- metadata     typed downstream annotations
```

Each field has one owner, one location, and one runtime shape.
