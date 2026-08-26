# Log analyzers

`log-analyzer` owns rotation reconstruction from recorded combat. It separates source parsing from rules that must be
identical for EVTC and dps.report imports.

```text
log-analyzer/
├── lib/          Source-neutral contracts, catalog/profile lookup, scheduling, and reusable rules
├── evtc/         Raw ArcDPS parsing and EVTC-only evidence inference
└── dps-report/   Elite Insights validation and report-only inference
```

Code belongs in `lib/` when its inputs no longer require an EVTC event or Elite Insights field. In particular, command
construction, idle/overlap scheduling, player tie-breaking, profession identities, composite casts, and generic
autoattack chains are shared. Packet reconciliation, buff/effect inference, report URL handling, and lossy-source
recovery stay in their adapters.

Both adapters return the same base result contract: `timelineOriginMs`, a nullable combat-start offset, normalized
action summaries, executable commands, and warnings. Adapter results may add evidence that only their source exposes.
