# Codex model policy

## Sources and scope

The route uses ChatGPT OAuth through the installed pi-ai Codex provider. Its
capacity must not be inferred from a public API model's total-context number.

- The installed pi-ai `1.1.0` `openai-codex` catalog supplies GPT-6 Astra,
  Sol, Luna and GPT-6.1 Sol. Their descriptors own names, pricing tiers, output
  limits, reasoning mappings, transport compatibility, and image input limits.
  The plugin no longer duplicates those fields in legacy fallback entries.
- [Pinned Codex context metadata, revision bcd6d9a](https://github.com/openai/codex/blob/bcd6d9ab6b9f26f85d76d0c680b3f88b367bffa0/codex-rs/models-manager/models.json)
  is the source of the retained GPT-6/6.1 872,000-token opt-in budget. This is
  an existing plugin policy, not a claim about current CLI defaults.
- The route retains its explicit GPT-6.1 Sol `low` default and GPT-6 temperature
  rejection. This cleanup does not change request policy or infer Codex OAuth
  capabilities from public API metadata.

## Policy

The installed provider catalog is authoritative. With default settings, the
plugin preserves installed descriptors and adds Terra only when absent. The retired
GPT-5.6-based fallback entries and their duplicate pricing/reasoning data have
been removed; older catalogs are not repaired by those historical entries.

The missing-model mechanism remains in `src/codex-context.ts` as the explicit
`CODEX_MODEL_SUPPLEMENTS` registry. Each explicit entry supplies a
`templateId` and `overrides` containing at least an ID and name. Only missing
IDs with an installed template are added, ahead of the original catalog.
Installed descriptors win, duplicate entries are skipped, and absent templates
produce no model. Other fields are inherited unless explicitly overridden;
model-specific capacities, pricing and reasoning must be verified before
registering a real supplement.

GPT-6.1 Terra is supplemented from GPT-6.1 Sol, retaining its Codex transport,
tool compatibility and image input limits. Terra overrides ID, name, output
limit (128,000), cost and reasoning mapping. The local Codex model cache inspected
on 2026-11-03 reports default reasoning low, supported efforts low/medium/high/
xhigh/max (plus orchestration-only ultra), context_window 500000 and
max_context_window 872000. Only these capability facts are recorded here;
the cache and its prompt content are not packaged or read at runtime.

[Official Terra API metadata](https://developers.openai.com/api/docs/models/gpt-6.1-terra)
supplies per-million-token cost estimates: input $1, output $5, cache read $0.05,
and 30-minute cache write $1.25. Above 272K input tokens the whole request's
input/cache rates double and output rate increases by 1.5x. These API estimates
are not a claim about ChatGPT subscription billing. The public API's none effort
and 1.05M context do not establish the Codex OAuth route's capabilities.

The fork retains eight independent model-ID boolean switches and its global
serviceTier preference; the aggregate context switch is UI-only. The
long-context opt-in changes only contextWindow: GPT-6/6.1 uses 872K, while the
pre-existing GPT-5.6 1M policy remains unchanged. Terra starts at 500K when supplied by the plugin. Turning the setting off
returns the original provider capacity (or the supplement baseline); source
objects are never mutated. The setting
is a local compaction budget, not a backend entitlement.

The optional per-profile `excludedModelIds` string array defaults to empty.
Exact, case-sensitive ID filtering runs last, after descriptor completion and
long-context policy. Unknown and duplicate IDs do not change any other model;
no model is hard-coded as excluded. Remaining descriptors retain their fields
and order and the source catalog is not mutated. The volatile field uses the
existing `llm-codex-auth` Config Form and profile patch persistence, including
the usual route update notification. GPT Auth offers a comma-separated editor
that saves on blur or Enter and trims/deduplicates its input.

The plugin does not change the selected model or old sessions when their model
is excluded. Later resolution follows the host's `UNKNOWN_MODEL` behavior;
excluding all models produces an empty catalog. Prepared calls resolve catalog
visibility again on dispatch; already running requests are not cancelled.
Visibility filtering is not a request
permission check and does not alter authentication, Search or Image settings.

Installed provider descriptors own reasoning capabilities. The pinned pi-ai
1.1.0 catalog marks Off unsupported for Astra and GPT-6.1 Sol, while GPT-6
Sol/Luna use `off: "none"` and therefore advertise Off and send explicit none.
DSH minimal is a compatibility alias for low. The adapter retains low for an
unspecified GPT-6.1 Sol or Terra request; explicit efforts remain unchanged. Ultra is a
Codex orchestration mode and is not sent as a raw wire effort. Temperature is
rejected for the known GPT-6/6.1 models before authentication, regardless of
direct or prepared call entry point.

## Verification boundary

Tests cover preserving the actual pi-ai 1.1.0 descriptors, adding Terra, removal of
legacy automatic fallbacks, synthetic explicit supplements, provider precedence,
deduplication, missing templates, and supplement/context/exclusion ordering.
Request tests use the real installed catalog, covering direct/prepared calls,
exact efforts, provider-owned Off support, unsupported Off/Ultra, temperature,
Terra default/long budgets, and successful scripted SSE text and function-call decoding. Existing tests
retain model-specific budgets, immutable defaults, toggling and UI wording.
These use synthetic credentials and an offline transport, not a live account.
This does not prove backend model availability, actual long-context acceptance,
subscription quota, or live OAuth behavior. No release or package publication
is part of this change.

Exclusion regressions cover empty/omitted settings, exact matching, unknown and
duplicate IDs, supplemented descriptors, long-context compatibility, source
immutability, empty catalogs and missing-model failures before credentials or
transport. Two synthetic profiles exercise the real Settings Forms, Config
Editor and Loader path: edits remain isolated, persist, restore on restart and
notify the live model catalog without remounting the plugin. Client tests cover
save/clear, profile switching and write failure. Real user profiles and live
requests are outside this verification boundary.

Search defaults new or omitted fallback settings to gpt-6.1-terra. Explicitly saved
fallbacks, including gpt-5.6-terra, remain unchanged. A known initiating Codex model
continues to take precedence. Search sends its model ID directly and does not
require the model to be visible in the inference catalog.
