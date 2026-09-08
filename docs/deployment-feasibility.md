# Public synthetic demo deployment feasibility

Assessment started September 7, 2026; the selected configuration deployed successfully September 8. [Live application](https://case-resolution-agent.onrender.com); hosted browser acceptance passed. The execution charter authorizes a public synthetic portfolio MVP on existing authenticated free or already-authorized resources. It does not authorize new charges, unrelated repositories, or weakening isolation.

## Recommended path

Retain Render for the Node web/API and Supabase for durable PostgreSQL/pgvector, subject to the preflight below. A single free web service can also acquire due simulated work while awake and catch up after restart. It cannot promise uninterrupted worker execution or wall-clock SLA delivery: Render Free sleeps after 15 minutes without inbound traffic, has an ephemeral filesystem, and does not offer a free background-worker service. Do not add keep-alive traffic to defeat plan restrictions. [Render free service limits](https://render.com/docs/free)

Use a Supabase database dedicated to this synthetic demonstration. Runtime must connect as the restricted `pathway_app` role, never the administrator or Supabase `service_role`. Browser requests go through the application API; do not expose the `pathway` schema through a public Data API. Exact scoped vector retrieval and Pathway-owned governance remain unchanged. Supabase documents custom roles and pgvector, but their availability does not prove our migrations work on a selected project. [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)

The selected hosted profile requires the Supabase session pooler on port 5432 for this persistent Node client. A migration holds a session advisory lock, so transaction pooling on port 6543 is rejected. Keep one checked-out connection for each application transaction, including transaction-local scope and advisory locks. Obtain the database certificate through the provider; never disable certificate verification to get a connection working. Client-to-pooler certificate and hostname verification has passed; the backend TLS limitation is recorded below. [Connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres)

ADR-001 proposed separate mode projects, object storage, Supabase Auth, and always-running workers. A bounded fixture-only public demo can use cryptographic anonymous sessions with server-selected disposable workspaces and mode-scoped RLS in one dedicated synthetic database. This is a deliberate portfolio topology reduction, not production isolation equivalence. It needs an explicit current architecture/decision entry and cross-session tests. No arbitrary uploads or external action credentials belong in this topology.

## Historical September 7 access inventory

Only credential presence and environment variable names were inspected; no secret values were read or printed.

| Surface | Observation |
| --- | --- |
| Render/Supabase CLI | Neither executable available on PATH |
| Environment | No names matching Render, Supabase, database URL, GitHub token or OpenAI in the assessment process |
| Project environment files | `.env`, `.env.local`, `.env.production` absent; `.env.example` is a template |
| Common CLI state | `~/.config/render`, `~/.config/render/cli.yaml`, `~/.config/supabase`, `~/.supabase`, `~/.render`, project `.supabase` absent |
| Git | Repository `.git` absent; GitHub CLI host-config file exists, but its contents/credential validity were not inspected |
| Connectors | Callable Sites tools available; no Render or Supabase connector found |
| Browser inventory | No existing Render or Supabase dashboard tab |
| Cloud resources | No authenticated Render workspace or Supabase project verified; no resource created |

The initial attempt to open the Render dashboard for a read-only account check was rejected by automatic approval review. No workaround was attempted. This historical access blocker was resolved when the user subsequently signed into Render/Supabase, identified the source repository and created the dedicated project. The current verified state appears below.

Sites was not substituted: the available capability is not evidence that it can host this existing Node/PostgreSQL/pgvector runtime unchanged. A static mock or alternative persistence backend would fail the stated completion boundary.

## Concrete external requirements

1. Access to an identified Render workspace using an authenticated dashboard/CLI or `RENDER_API_KEY`; confirm its existing free capacity, billing and overage settings. If multiple owners are plausible, choose only with the user's identification.
2. An identified **new/dedicated** Pathway Agent Supabase project under the intended organization, with free capacity or already-authorized resource allocation. Dashboard authentication or `SUPABASE_ACCESS_TOKEN` enables management; neither alone supplies the database password.
3. Server-only `PATHWAY_ADMIN_DATABASE_URL` for the one-time migration environment, and a different server-only `PATHWAY_DATABASE_URL` authenticating the restricted runtime role. Do not place admin credentials in the running web service. Connection strings must be entered through a secret manager or local ignored environment, never pasted into public artifacts or command output.
4. An authorized source repository or registry artifact for Render. The user identified `ktakeuchi21/case-resolution-agent`; the prepared source was published there through the isolated deployment checkout. Do not publish unrelated source or infer another owner.
5. The public origin selected by Render, recorded in the application origin allowlist and cookie configuration. Session cookies require HTTPS/Secure in the hosted environment.

No OpenAI secret is needed for a public cached-vector/controlled-explanation path. Guests must not be able to trigger paid generation or new embedding requests. Any operator-only live generation path requires separate server-side credentials and explicitly bounded authorization; absence must be visible.

## Hosting and migration preflight

- Inspect the actual project's PostgreSQL version and `pg_available_extension_versions` without credentials in output. `migrations/001_governance.sql:1` requests vector `0.8.6`; do not silently use another version, change applied migration checksums, or assume local PostgreSQL 18.6 is available on the host.
- Confirm extension placement resolves the unqualified `vector` type/operators. Supabase may already have vector installed in another schema; establish an explicit safe search path or validated provisioning step rather than disabling checks.
- Run all migrations from empty schema in the identified new database. Verify `pathway_app` can be created/granted without superuser and has no bypass-RLS or schema ownership (`src/db/database.ts:24`). Verify every table policy and immutable trigger. Set runtime login credentials through the provider's protected mechanism.
- Test TLS, exact vector ranking, all four decisions, session separation, retirement/dispatch serialization, restart, source history and citation fidelity against the deployed database before routing public users.
- Seed only reviewed fixture corpus and cached real embeddings with identity/dimension/content checks; do not ship `.local/postgres`, developer caches or previous test workspaces.
- Cap active sessions, request bodies, stored records and work per request. Preserve a reset/expiration boundary that deletes only disposable public-session data according to the documented retention policy; canonical historical evaluation artifacts remain untouched.
- Verify hosted response headers, cookie isolation, error redaction, production build, browser journey and cold-start recovery on the resulting URL.

Supabase Free currently lists 500 MB database space, two active projects and inactivity pausing after one week; account allocation must be checked. Free-tier automatic backups/PITR are not provided. [Supabase pricing](https://supabase.com/pricing)

Render Free is not a blanket no-cost guarantee: bandwidth and build overages can incur charges with a payment method. Verify existing controls and authorization before provisioning; otherwise stop at the reviewed deployment package. Free Render PostgreSQL expires after 30 days and is not recommended as this portfolio's durable store. [Render limits](https://render.com/docs/free)

## Completion evidence still required

Account selection, source publication, the free service draft, hosted migration bootstrap and bounded runtime/API privilege checks are verified. Hosted frozen retrieval parity, complete regression/audit results, deployed build identity, HTTPS health/browser checks, the live URL and deployed screenshots remain required. Local build or a generated deployment manifest must never be reported as a successful public deployment.


## September 8 hosted preparation

The user identified a new dedicated Supabase project, `qabaroofmvrzyuwuxndy`, in Oregon. The initial read-only preflight found PostgreSQL 17.6 and pgvector availability through 0.8.2. The explicit profile `supabase-pg17-vector082` now selects that exact server/extension pair and requires extension schema `extensions`. The guarded empty-project bootstrap installed vector 0.8.2 and applied all eight unchanged migrations; the second migration run was identical. Existing local PostgreSQL 18.6/vector 0.8.6 pins and historical benchmark artifacts are preserved. Frozen retrieval and governance parity now passes ([hosted frozen parity](../artifacts/phase2c/parity-84c57174e5f418c904098e085b2f6d0fa85bec756f1342225ee98969d65826b1.json)).

The authenticated Render draft selects Oregon, Free ($0 base/month), `NODE_ENV=production`, `/healthz` and automatic deployments Off. It points at `ktakeuchi21/case-resolution-agent`, branch `main`. No deployed URL is verified. Runtime must set the hosted profile, `PATHWAY_DATABASE_CA_FILE=/app/dist/config/supabase-ca.crt` and the restricted runtime database secret. `PUBLIC_ORIGIN` may be omitted only when `RENDER=true` and `RENDER_EXTERNAL_URL` validates as an exact HTTPS origin under `.onrender.com`; request headers cannot select the trusted origin. Neither administrator database credentials nor an OpenAI key belongs on Render.

A protected local password-entry file (0600 beneath a 0700 directory) beneath ignored `.local/deployment/` allowed the owner to provide the database credential without chat or source-control exposure. Connection tooling consumes private files without printing values and redacts raw errors. The official Supabase CA is packaged as public trust material in `config/supabase-ca.crt`; certificate SHA-256 fingerprint: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`. Client-to-session-pooler certificate and hostname verification passed. Database-side `pg_stat_ssl` reported `backend_tls=false`, so encryption from the provider's pooler to PostgreSQL has not been established and no end-to-end TLS claim is made.

The dedicated `pathway_app` role was verified with LOGIN enabled and superuser, BYPASSRLS, CREATEDB, CREATEROLE and INHERIT disabled; it has no memberships or application-schema ownership. Supabase default API grants on the public migration ledger were discovered and removed. The ledger now forces RLS, and effective `anon`/`authenticated` privileges on the application tables and ledger are zero. These checks must remain in the hosted audit; relying only on application schema placement would have missed the ledger exposure.

Evidence: [original dashboard preflight](../artifacts/mvp/hosted-dashboard-preflight-556c2f3b050e9fcfb92a74530bb85df6e7433e9bb774a42c686952d18bba2410.json) and [successful guarded bootstrap and identical rerun](../artifacts/phase2c/hosted-bootstrap-0291b3a8a0d317dd19781aabd7b72046746bae2eb6e18e5bbcfaf6685c60262d.json). Current verification includes 80 passing unit tests, the 84 rerun local integration/generation checks, 71 hosted regression passes and one intentional extra-database skip. Both database profiles pass 23 original references and 108 frozen retrieval comparisons. The hosted retirement/history/sandbox/concurrency demonstration also passed. The final read-only access/evidence/vector/workflow audits passed. Import the restricted runtime secret, then deploy and verify the actual HTTPS service. No public-deployment pass is claimed.


September 8 database release gate: [hosted qualification report](../artifacts/mvp/hosted-database-qualification-7761ac4f9bc7b6c55a4d3f82e87f4118259a9201eb0d37b54ce307cb4c9ec6df.json) records passing hosted access/RLS, exact vector/citation fidelity, immutable workflow links and retirement/history checks. The 459 vectors were verified using round-trippable float output; the audit changes only transaction-local formatting. Render secret import, deployed HTTPS and browser checks passed; see [hosted verification](hosted-verification.md).
