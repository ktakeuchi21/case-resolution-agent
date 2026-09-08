# Codex skill setup — 2026-09-07

This setup changes developer workflows only. No Pathway Agent product feature, runtime dependency, fixture, test, or evaluation artifact was changed. Product work remains paused for the user's review of this setup.

## Inventory and selection

Existing local skills preserved: `imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`, `playwright`, and `ui-ux-pro-max`. An internal `review-agent` skill also exists on disk but was not exposed in this task's active skill catalog; its delegated defect review is narrower than gstack's engineering review workflow.

Existing active plugin skills preserved: `sites:sites-building`, `sites:sites-hosting`, `deep-research-work:deep-research`, `documents:documents`, `pdf:pdf`, `presentations:Presentations`, `spreadsheets:Spreadsheets`, `spreadsheets:excel-live-control`, `plugin-management:plugin-management`, `template-creator:template-creator`, and `visualize:visualize`. Other plugin-cache files are not evidence of active skill discovery. No security review skill was previously installed. Sites supplies hosting workflows but does not determine Pathway's deployment architecture.

Reused now: skill-installer for the catalog/install, skill-creator for the custom skill/validator, openai-docs for Codex configuration semantics. Reuse ui-ux-pro-max for interface/accessibility work and Playwright/native browser tools for browser QA later. Keep Sites available for actual Sites work; this setup does not migrate the project to Sites.

The current official curated catalog was fetched with the installed skill-installer helper. Its 39 entries were evaluated against the actual project documents and Phase 2A code. Installed `security-threat-model` and `security-best-practices` from [openai/skills at 49f948faa9258a0c61caceaf225e179651397431](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated), using the official installer pinned to that revision. Both keep their supporting references, license and interface metadata; `agents/openai.yaml` now sets `allow_implicit_invocation: false`.

Considered but not separately installed:

| Need | Decision |
| --- | --- |
| AI/RAG evaluation | No dedicated curated skill found. Existing openai-docs covers OpenAI eval APIs; the project needs its own executable evaluation system. The custom review skill does not implement it. |
| AWS, Supabase, TypeScript backend | No dedicated curated skill found. Use canonical architecture/contracts and provider documentation; do not substitute a generic skill for engineering evidence. |
| Browser QA | Curated Playwright is already installed. playwright-interactive overlaps existing Playwright/native CUA and introduces another browser session workflow. |
| Accessibility | No standalone curated skill found. Existing ui-ux-pro-max plus real browser/accessibility checks cover this stage. |
| GitHub PR/CI/release | gh-address-comments and gh-fix-ci are useful when an actual PR or Actions failure exists; defer. yeet bundles commit/push/PR operations beyond this task. gstack-review adds structured review, not authorization to ship. |
| Deployment | render-deploy, Cloudflare, Netlify and Vercel skills target real deployment work. Defer until the host is selected and deployment requested; avoid installing competing host workflows now. |
| Ownership security | security-ownership-map needs meaningful Git history; premature for this local project. |
| Additional documents/design plugins | Existing tools suffice. No Figma, Supabase connector, or unrelated plugin was installed. |

## Newly installed trigger names

Invoke with `$` followed by the exact name. All are explicit-only. The supported gstack installer installs the suite as a unit; the routing guide selects only relevant workflows.

- `gstack`
- `gstack-autoplan`
- `gstack-benchmark`
- `gstack-benchmark-models`
- `gstack-browse`
- `gstack-canary`
- `gstack-careful`
- `gstack-claude`
- `gstack-context-restore`
- `gstack-context-save`
- `gstack-cso`
- `gstack-design-consultation`
- `gstack-design-html`
- `gstack-design-review`
- `gstack-design-shotgun`
- `gstack-devex-review`
- `gstack-diagram`
- `gstack-document-generate`
- `gstack-document-release`
- `gstack-freeze`
- `gstack-guard`
- `gstack-health`
- `gstack-investigate`
- `gstack-ios-clean`
- `gstack-ios-design-review`
- `gstack-ios-fix`
- `gstack-ios-qa`
- `gstack-ios-sync`
- `gstack-land-and-deploy`
- `gstack-landing-report`
- `gstack-learn`
- `gstack-make-pdf`
- `gstack-office-hours`
- `gstack-open-gstack-browser`
- `gstack-pair-agent`
- `gstack-plan-ceo-review`
- `gstack-plan-design-review`
- `gstack-plan-devex-review`
- `gstack-plan-eng-review`
- `gstack-plan-tune`
- `gstack-qa`
- `gstack-qa-only`
- `gstack-retro`
- `gstack-review`
- `gstack-scrape`
- `gstack-setup-browser-cookies`
- `gstack-setup-deploy`
- `gstack-setup-gbrain`
- `gstack-ship`
- `gstack-skillify`
- `gstack-spec`
- `gstack-sync-gbrain`
- `gstack-unfreeze`
- `gstack-upgrade`
- `pathway-governance-review`
- `security-best-practices`
- `security-threat-model`

## gstack compatibility, audit and installation

Installed the full official repository at [0530392821c277b95e5cd65aa9d9fda4248718b2](https://github.com/garrytan/gstack/tree/0530392821c277b95e5cd65aa9d9fda4248718b2), package version 1.81.0. Its current [README](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/README.md) explicitly supports `./setup --host codex`. This is a complete shared-runtime installation, not copied isolated SKILL.md folders.

Before execution, inspected README, setup, build and generator scripts, Codex/Claude host definitions, model resolution, config/settings helpers, GBrain detection, update/telemetry helpers, skill startup, health checker and uninstall script. The audited source was cloned locally, pinned, and its origin points to the official upstream. No issue/comment/fixture instructions were used as installation instructions.

Installed prerequisites: official Bun 1.4.2 macOS arm64 binary at `~/.bun/bin/bun`, with `bunx` symlink. The release ZIP matched GitHub's published SHA-256 `90987a3a16d7db556d886ac3d551e7b6d3edf0a1cf43acaed622e8676be1d12f`. Node, npm, Git, Python, jq, gh and Codex already existed. A temporary Python venv with PyYAML 6.0.3 supported the official skill validator; no project Python or npm dependencies changed. Bun is intentionally not added to shell or Codex config: prefix helper commands with `PATH="$HOME/.bun/bin:$PATH"`.

Supported setup command, from `~/.gstack/repos/gstack`:

```sh
./setup --host codex --prefix --no-team --no-plan-tune-hooks --no-timeline-stop-hook
```

The setup environment additionally used `GSTACK_SETUP_RUNNING=1`, `GSTACK_SETTINGS_FILE=/private/tmp/pathway-gstack-disabled-hooks.json`, and `GSTACK_SKIP_PLAYWRIGHT=1`, `GSTACK_SKIP_COREUTILS=1`, `GSTACK_SKIP_FONTS=1`, `GSTACK_SKIP_ASIDE=1`, `GSTACK_SKIP_GBRAIN_REGEN=1`. These skip optional downloads/system changes, not the shared runtime build. An outer macOS sandbox denied credential/config reads under Claude, GBrain, AWS, SSH and Codex auth, and denied writes to Claude settings, Codex config and the project. Network permission was granted for official downloads and locked dependencies. All requested approvals succeeded.

The installer fetched 228 locked packages and built the browse, design, PDF, discovery and helper infrastructure. It generated Codex skills and linked them into `~/.codex/skills`. Its supported model detection read the top-level Codex model, selected the generic GPT template, and left the user's model/config unchanged. It did not run paid model evaluations.

Important inspected behavior and boundaries:

- Setup can install browsers, system packages/fonts, session hooks, other-host configuration and optional integrations. Those paths were disabled/skipped here. Its settings helper still runs on a Codex install; redirecting its settings file and denying Claude writes protected existing configuration.
- Runtime helpers can read integration/credential configuration when optional features are invoked. GBrain detection specifically probes Claude/GBrain configuration; that access was denied in installation and the startup smoke test. This audit is not a guarantee that every future workflow avoids credential access.
- The suite contains cookie-import, provider API, GitHub, shipping, GBrain, ngrok/pair-agent, and update capabilities. Dependencies containing those capabilities are installed; their services, hooks, tunnels and authenticated workflows were not enabled or run.
- Update helpers can contact upstream and change the checkout when enabled. Both checking and automatic upgrading are off. No shell, Codex session, Git pre-push, plan-tune or timeline hook was installed. The checkout contains upstream hook code/sample files; those are not registered hooks.
- The uninstaller can stop browser daemons and delete gstack installs/state across multiple hosts and the current Git project; it is not inherently Codex-only. See scoped removal below.

### Local Codex registration corrections

At this pinned revision, `--prefix` names the installed directories and display labels but leaves unprefixed SKILL frontmatter names. Generated `agents/openai.yaml` also enables implicit invocation even when gstack's proactive setting is false. The installed root runtime sidecar omits some shared resources referenced by the generated workflows.

The reviewed project helper `tools/configure-codex-skills.py --apply` therefore:

1. Normalizes all 54 generated Codex frontmatter names to their installed names (`gstack` and `gstack-*`).
2. Sets every Codex metadata policy to `allow_implicit_invocation: false`, with a `$gstack-*` default prompt.
3. Links the root Codex metadata plus shared docs, scripts, review specialists, QA templates/references, design binary and PDF binary to the full checkout (8 links). It never copies Claude SKILL directories.

The helper defaults to read-only checks, refuses unknown revisions/registration counts/foreign targets, and does not modify upstream templates. These are local compatibility/configuration overrides. **Setup or generation can reset them. Even upstream `skill:check` currently writes metadata during its purported dry-run.** Run the checker after generation, review any new revision, and reapply the approved overrides before using the suite. Automatic upgrades are disabled for this reason as well.

Codex bodies inline many upstream sections. Cross-workflow references should load the prefixed generated Codex entry rather than a Claude template. The suite is usable for explicitly requested planning/review workflows, subject to ordinary task prerequisites; directory presence is not proof that all 54 specialized workflows work here.

### Effective settings

All 57 newly installed skills, including the custom skill, are explicit-only in Codex. gstack's `~/.gstack/config.yaml` additionally contains:

```yaml
proactive: false
routing_declined: true
telemetry: off
auto_upgrade: false
update_check: false
skill_prefix: true
checkpoint_mode: explicit
checkpoint_push: false
team_mode: false
plan_tune_hooks: no
timeline_stop_hook: no
redact_prepush_hook: false
artifacts_sync_mode: off
artifacts_sync_mode_prompted: true
transcript_ingest_mode: off
cross_project_learnings: false
gstack_contributor: false
pair_agent: off
codex_reviews: disabled
workspace_root: null
```

Consent markers record the user's existing choices against proactive invocation, telemetry and continuous checkpoints; they do not opt into new features. Telemetry off disables both remote usage telemetry and local usage analytics in the inspected logger. Explicit workflow invocation can still produce local sessions, project notes, learning records or timelines. Artifact/transcript sync is off. The smoke test created local startup/cache state, but no usage JSONL or remote transmission. These settings are opt-outs, not a permanent OS network sandbox.

No optional Chromium download, Aside installation, cookie import or browser extension occurred. gstack browser QA, live design review and PDF rendering remain **unverified**; continue with existing Playwright/native tools. The bundled browse help command works without launching a browser. The PDF version command exits successfully but says `version unknown`; PDF generation was not validated and existing PDF/document skills remain primary. Claude/GBrain/Aside CLIs are absent, so workflows requiring them remain unavailable. There is no project Git history yet; diff review and retro need that prerequisite or an explicitly provided comparison.

## Custom governance skill decision

Created one explicit-only `pathway-governance-review`. Deferral was appropriate before executable contracts existed, but this workspace already contains Phase 2A schemas, structured reason codes, enforcement implementations and passing governance tests. The fresh `npm test` run passed all 44 tests. Its narrow description triggers a requested knowledge-governance review, not general implementation. It reads canonical source/tests on every invocation rather than copying strategy documents or freezing reason codes into skill references. It distinguishes synthetic examples, known limitations, proposals and pharmaceutical facts. No subsystem-specific custom skills were created.

This is structural and reference validation of a new review workflow, not a claim that it has already caught regressions in repeated model-driven reviews. Reassess it after the first real review and whenever canonical contracts move.

## Validation and preservation

- Official setup: exit 0; frozen dependency install and shared binary build completed.
- Official creator `quick_validate.py`: **57/57 valid**, including all generated gstack entries and both official security skills. All names match installed directory names, are unique, and all metadata policies are explicit-only.
- Local configuration helper: **54 registrations and 8 shared links pass**. Security reference files are present; custom canonical references resolve.
- Official offline `bun test test/codex-generation-model.test.ts test/host-config.test.ts`: **85 passed, 1 skipped, 0 failed**. The skipped test assumes a Claude host. No paid/API evals were run.
- Official `bun run skill:check`, before local overrides: **exit 1**. All external-host entries report 54 skills and zero missing; the sole error is missing native `claude/SKILL.md`. The Claude host intentionally excludes its own `claude` wrapper, while the all-template checker expects it. This upstream non-Codex inconsistency was not patched or concealed. Local metadata changes must be reapplied after running this command.
- Installed startup, telemetry logger and update-check smoke tests ran with network denied and credential-file reads denied. Startup protocol 1 reported proactive false, prefix true, telemetry off, explicit checkpoints, no push and sync off. Update-check emitted nothing; no usage analytics JSONL was created. This validates opt-out startup behavior, not every skill's execution.
- Bun version and browse help execute. gstack browser/LLM/provider workflows were not exercised.
- Existing Pathway tests: **44 passed**; `npm run typecheck` passed. These establish the custom skill's tested foundation, not new feature delivery.
- SHA-256 preservation: **1,279 existing skill/plugin files unchanged**, **8 global settings existence/hash checks unchanged**, **23 product/source/test/fixture/artifact/package snapshots unchanged**. Existing Codex/Claude config and shell/Git settings were preserved.

## Files changed and evidence

Project additions: `AGENTS.md`, `tools/configure-codex-skills.py`, this document, `docs/skill-setup-manifest.json`, and `docs/skill-setup-evidence/`. Project modification: one D-26 decision entry in `docs/decisions.md`. No product implementation changes or commits.

Global additions/configuration:

- `~/.codex/skills/security-threat-model/` and `security-best-practices/`: official full skill resources plus explicit-only metadata.
- `~/.codex/skills/pathway-governance-review/`: SKILL.md and agents/openai.yaml.
- `~/.codex/skills/gstack` runtime sidecar and 53 other `gstack-*` registrations. Their complete contents/targets and all trigger names are in the manifest.
- `~/.gstack/repos/gstack/`: full pinned repository, its own `.git`, locked dependencies, generated skills and binaries. Local metadata/frontmatter corrections are confined to generated Codex artifacts.
- `~/.gstack/config.yaml`, onboarding/choice/version markers, GBrain detection caches, startup sessions and slug cache. Empty analytics/projects directories can exist without usage telemetry.
- `~/.bun/bin/bun`, `~/.bun/bin/bunx`, and Bun's dependency cache under `~/.bun/install/cache`. The cache inventory records observed contents; it is not an assertion of exclusive ownership of all cache entries.

The [manifest](skill-setup-manifest.json) enumerates persistent installation files/symlinks, observed Bun cache paths, project files, skill validation and preservation results. [Evidence files](skill-setup-evidence/) preserve setup, health-check, host-test and validation output. Temporary audit clones/downloads/venv/logs are under `/private/tmp/pathway-*`; OS/tool-managed transient files are not project configuration. No unrelated repository was modified.

## Disable, uninstall and upgrade

To disable a skill, move its exact registration directory/link out of `~/.codex/skills` into a non-discovery backup directory, then start a new Codex session. For gstack, move all 54 manifest-listed registration entries together; removing the root runtime sidecar alone would break the remaining skills. Keep the checkout/state for reversible re-enabling. All additions are already explicit-only.

To remove an official security skill or the custom skill, remove only its exact named directory under `~/.codex/skills`; no hooks, services or dependencies are registered by those skills. Update this project's routing table if the workflow is removed.

For gstack, the supported upstream command is `~/.gstack/repos/gstack/bin/gstack-uninstall` (interactive), with `--keep-state` available. Inspect the pinned script before use: it removes gstack registrations across several hosts, edits matching hook registrations, can stop browse daemons, and considers the current Git project. **Do not blindly use `--force` or run it from an unrelated repository.** For this Codex-only installation, the narrower removal is to remove the exact 54 registration entries listed in the manifest, then remove `~/.gstack/repos/gstack` and, after retaining any wanted notes, the newly created `~/.gstack` state. Do not follow registration symlinks into another installation or delete unrelated skill directories. No daemon was started in this session.

Bun is a separate dependency. If no other workflow has begun using it, remove only this installation's `~/.bun/bin/bun` and `bunx` link. Its cache may be retained, or audited and pruned separately; never delete a shared cache on the assumption it belongs only to gstack. No PATH/config rollback is required. Temporary validation venv/downloads can be discarded without affecting installed skills.

Upgrades are manual. Inspect new upstream code, preserve config, repeat the supported Codex setup with the same opt-outs/settings redirection, then review/update the pinned revision in the local helper and reapply/validate explicit-only metadata. Do not enable hooks, telemetry, automatic commits or team-required installation as an upgrade side effect.

## Next use

Start a fresh Codex session (restart the app if discovery is stale); this turn cannot prove a refreshed skill picker. No approval remains pending. For reviewing/extending the already implemented Phase 2A, request `$gstack-plan-eng-review`, then `$pathway-governance-review` and `$gstack-review` at meaningful increments. Use `openai-docs` when selecting an actual OpenAI adapter, and explicitly request the two security reviews at the security milestone/before external deployment. Defer browser/design execution until a browser surface exists. Do not begin implementation until this setup is reviewed.
