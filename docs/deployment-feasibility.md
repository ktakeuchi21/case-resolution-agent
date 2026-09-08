# Public synthetic demo deployment feasibility

Assessment: September 7, 2026. This is a feasibility assessment, not evidence of a deployed application. The execution charter authorizes a public synthetic portfolio MVP on existing authenticated free or already-authorized resources. It does not authorize new charges, unrelated repositories, or weakening isolation.

## Recommended path

Retain Render for the Node web/API and Supabase for durable PostgreSQL/pgvector, subject to the preflight below. A single free web service can also acquire due simulated work while awake and catch up after restart. It cannot promise uninterrupted worker execution or wall-clock SLA delivery: Render Free sleeps after 15 minutes without inbound traffic, has an ephemeral filesystem, and does not offer a free background-worker service. Do not add keep-alive traffic to defeat plan restrictions. [Render free service limits](https://render.com/docs/free)

Use a Supabase database dedicated to this synthetic demonstration. Runtime must connect as the restricted `pathway_app` role, never the administrator or Supabase `service_role`. Browser requests go through the application API; do not expose the `pathway` schema through a public Data API. Exact scoped vector retrieval and Pathway-owned governance remain unchanged. Supabase documents custom roles and pgvector, but their availability does not prove our migrations work on a selected project. [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)

Prefer a direct TLS connection when network compatibility permits, otherwise the Supabase session pooler on port 5432 for this persistent Node client. A migration holds a session advisory lock, so do not run it through transaction pooling. Keep one checked-out connection for each application transaction, including transaction-local scope and advisory locks. Obtain the database certificate through the provider; never disable certificate verification to get a connection working. [Connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres)

ADR-001 proposed separate mode projects, object storage, Supabase Auth, and always-running workers. A bounded fixture-only public demo can use cryptographic anonymous sessions with server-selected disposable workspaces and mode-scoped RLS in one dedicated synthetic database. This is a deliberate portfolio topology reduction, not production isolation equivalence. It needs an explicit current architecture/decision entry and cross-session tests. No arbitrary uploads or external action credentials belong in this topology.

## Verified local access inventory

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

Attempting to open the Render dashboard for a read-only account check was rejected by automatic approval review, which stated that private deployment-account access was not authorized. No workaround or alternate account-access path was attempted after that rejection. This leaves authentication and ownership unverified even though the charter contains deployment authority. Account access must be approved through the normal mechanism before that check resumes.

Sites was not substituted: the available capability is not evidence that it can host this existing Node/PostgreSQL/pgvector runtime unchanged. A static mock or alternative persistence backend would fail the stated completion boundary.

## Concrete external requirements

1. Access to an identified Render workspace using an authenticated dashboard/CLI or `RENDER_API_KEY`; confirm its existing free capacity, billing and overage settings. If multiple owners are plausible, choose only with the user's identification.
2. An identified **new/dedicated** Pathway Agent Supabase project under the intended organization, with free capacity or already-authorized resource allocation. Dashboard authentication or `SUPABASE_ACCESS_TOKEN` enables management; neither alone supplies the database password.
3. Server-only `PATHWAY_ADMIN_DATABASE_URL` for the one-time migration environment, and a different server-only `PATHWAY_DATABASE_URL` authenticating the restricted runtime role. Do not place admin credentials in the running web service. Connection strings must be entered through a secret manager or local ignored environment, never pasted into public artifacts or command output.
4. An authorized source repository or registry artifact for Render. This checkout currently has no Git metadata; do not publish unrelated source or infer a new public repository owner from a browser profile.
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

Account identity, selected resource plan, migration output, hosted role/RLS checks, published artifact identity, health check, live URL, deployed browser tests and screenshots remain unverified. Local build or a generated deployment manifest must never be reported as a successful public deployment.
