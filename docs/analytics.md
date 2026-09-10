# Visitor analytics

## Purpose and current setup

One private **Pathway Agent** website in Umami Cloud Hobby will cover the public overview and workspace. The integration uses page views only: estimated visitors/visits, popular pages, approximate geography and device breakdown. No paid analytics resource, database table, application collection endpoint, model request or custom administration page is added.

**Activation status: live and verified September 10, 2026.** The owner signed into Umami and the private Pathway Agent website was created with public ID `ebedd5c5-0e67-4fa0-97c2-09b6d8256ee5`. No share link exists. Replays/heatmaps are unavailable without a Business upgrade; no upgrade or paid trial was initiated. Both Render services are Live on `bc42466472abbaa7b274f662d2cfac1e3d869618`. The controlled six-page visit was accepted by the collector and displayed in the authenticated dashboard as one visitor, one visit and six views, with United States under Location. These initial counts are verification traffic, not an audience-growth claim.

Private dashboard: https://cloud.umami.is/analytics/us/websites/ebedd5c5-0e67-4fa0-97c2-09b6d8256ee5 (owner login required).

## Collection contract

`web/analytics.js` constructs a fresh payload from a fixed route map. Overview, Approach, Choose Knowledge, Chat, Case Workspace, Knowledge Studio, Evidence, Human Review, Walkthrough, Settings and Evaluation map to `/`, `/approach`, `/knowledge`, `/agent`, `/workspace`, `/studio`, `/evidence`, `/review`, `/tour`, `/settings` and `/evaluation`. These are analytics labels; the app keeps its existing hash routing.

Allowed fields are public website ID, actual production hostname, the mapped URL/title, empty referrer, bounded screen dimensions and browser language. The browser's user agent and source IP reach Umami as ordinary request metadata. Umami derives approximate location and anonymous visitor/session estimates; its documentation says the IP is not stored. We do not call browser geolocation or relax the existing geolocation permission restriction.

Raw page URLs, arbitrary hashes, query parameters, handoff timestamps, referral URLs, chat text, files, filenames, role/case identifiers, session/CSRF tokens and API data are not analytics payload fields. `identify`, custom events, session replay, heatmaps and performance collection are not enabled. Browser requests to Umami omit credentials. Application cookies remain first-party and isolated on the backend.

One page view records each displayed route entry. Workspace pages count after readiness/session restoration succeeds. Repeated render calls, messages, role changes and loading updates do not generate extra views. Back/Forward and a true reload count as new page entries. Unknown routes are not sent. A new route through a loading screen can count its destination when it becomes visible; merely waiting is not a page view.

The tracker loads after the page can paint and buffers at most 20 already-sanitized views in memory while loading. Script load has a ten-second deadline; failures are dropped, never persisted or replayed. Page close or opt-out discards buffered views. Analytics failure cannot block application navigation, startup or actions. Extremely short visits, blockers and network failures can undercount traffic.

## Reviewed tracker and hosting

`web/vendor/umami.js` contains the MIT-licensed public Umami Cloud tracker fetched on September 10, 2026 from `https://cloud.umami.is/script.js`. Upstream bytes before the prepended license have SHA-256 `f91822332c2a13f91e8fe29c0aeb169497cb1d870d31a099c5ecc8bea58ea3ac`. License source: `https://raw.githubusercontent.com/umami-software/umami/master/LICENSE`. This records the actual retrieved bytes, not a guessed release version.

The reviewed script is shipped with the application so a vendor script update cannot silently add collection capabilities. Its initialization is disabled with `data-auto-track=false`; the application invokes only manual `track(payload)`. The verified collector is `https://gateway.umami.is/api/send`. Both service CSPs keep `script-src 'self'` and add only `https://gateway.umami.is` to `connect-src`. No wildcard, inline script, eval permission or analytics proxy is introduced. Future tracker/collector changes require a reviewed update and the focused tests.

`web/analytics-config.js` stores only the public website ID. Null means disabled, with no tracker request. The analytics client additionally admits only the exact HTTPS frontend/backend origins. Local, preview, unconfigured and opted-out browsers do not load the tracker. Keep all account passwords, API keys and authentication cookies out of this file.

## Owner setup and viewing

1. Sign in at [Umami Cloud](https://cloud.umami.is). Stay on **Hobby**, with no paid trial or upgrade.
2. Under Websites, add **Pathway Agent**, domain `case-resolution-frontend.onrender.com`. Use this one website ID for both application origins. Keep its share URL disabled and replay/heatmap recording disabled.
3. Copy the public website ID from its tracking snippet into `web/analytics-config.js`. No account credential is required by the app.
4. Deploy matching backend/frontend revisions manually. Update the existing static site's CSP header in Render as well as the repository Blueprint; existing dashboard-managed configuration does not automatically follow a file change.
5. Open the private website dashboard, choose Today, Last 7 days, Last 30 days or a custom range. View Visitors, Visits, Views, Pages, Locations and Devices. Select the frontend hostname for public-entry traffic or the backend hostname for workspace usage. Pages lists the paths below; Filter also supports Page title. Use **Filter → Hostname** to distinguish the two surfaces.
6. A controlled post-deployment visit must appear in the dashboard before activation is reported complete. Deliver the authenticated dashboard URL, not a public share link.

Do not sum visitor counts across the two hostnames as unique people. Anonymous estimates can count the same person more than once; shared networks, changing devices and VPNs also affect identity and geography. Counts begin at activation, with no historical backfill. Existing workspace reservations include tests and are not visitor statistics. Account quota/retention were not displayed in the website settings; no numeric allowance is promised. An allowance change is not authorization to upgrade.

## Excluding your own visits

The **Visitor analytics** disclosure in each site's footer contains **Exclude this browser from analytics**. Use it on both the overview and workspace addresses, in every browser you use for testing. It stores only `umami.disabled=1` on that origin. This is an opt-out preference, not a tracking identifier. To re-enable locally, remove that key using browser storage tools.

Do Not Track and Global Privacy Control disable tracking before the tracker loads. If browser storage cannot be read, tracking fails closed. Automated tests intercept the collector; public smoke contexts should set the opt-out on both origins, except for the explicitly identified controlled acceptance visit.

## Verification

- `node --test tests/analytics.test.ts`: payload allowlist, exact production origins, preferences, entry deduplication, bounded queue, failure handling, tracker integrity and CSP.
- `npm run typecheck`, `npm test`, `node scripts/db/with-verification.ts app`, `npm run build`, `node scripts/verify-hygiene.ts`.
- `scripts/browser/run-analytics.mjs`: actual application and reviewed tracker, virtual production origins served from a separate local synthetic server on port 3017, collector intercepted. No live model calls.
- Public acceptance requires matching deployed assets/headers, an inspected sanitized collection request and an actual private dashboard event. Local tests alone do not prove Umami accepted or counted a visit.

Official references: [configuration](https://docs.umami.is/docs/tracker-configuration), [manual payloads](https://docs.umami.is/docs/tracker-functions), [metrics and geography](https://docs.umami.is/docs/metric-definitions), [free plan](https://docs.umami.is/docs/cloud/faq), [browser exclusion](https://docs.umami.is/docs/exclude-my-own-visits).

September 10 local verification: **89 core tests (including eight analytics tests), 29 application/security tests, type checking, production build and hygiene pass**. The focused real-browser suite passes **45/45** with intercepted collection and zero model requests: `artifacts/mvp/analytics-browser-c22ab2f4f67c1e070ef0858eb39df20f64c92407e90086a41e1d45ebcb07b17e.json`. Desktop/tablet/mobile disclosure screenshots were inspected. Earlier retained browser failures were harness corrections (collector/app request distinction, full readiness contract and exact sample-button accessible name), not successful product traces.


## September 10 deployment evidence

| Service | Deployment | Render recorded start (MDT) | Result |
| --- | --- | --- | --- |
| Backend, existing Free instance | `dep-dahigkcs728c73b8phv0` | 3:59:45 PM | Live, 34.7 s |
| Static frontend | `dep-dahigrks728c73b8qbig` | 4:00:14 PM | Live, 34.2 s |

Both source links match `bc42466472abbaa7b274f662d2cfac1e3d869618`. The static dashboard CSP was saved and both live origins return the intended policy. Backend health/assets pass (`artifacts/conversation/public-smoke-2035505f83cdbe47811475a8ee403b75b25b8c7910671d7c2b2008ac0815dbdf.json`); static assets/private-path checks pass **19/19** (`artifacts/mvp/static-assets-e9c3769724704fc8af05bef1ab11602fd22408febd8604b1f8052be79767a4df.json`).

The deliberately counted public acceptance visit passes **8/8** checks: `artifacts/mvp/analytics-public-9c3ec1852a8700dc71218facf621b6749f089832db34ea37e30c8e3bf7218f51.json`. Overview → Approach → Choose Knowledge → Chat → Knowledge Studio → Evaluation produced exactly six sanitized requests, all HTTP 200. The UI dashboard separately showed these six paths, one anonymous visitor/visit, Chrome and United States. First contentful paint was **464 ms**, TTFB **220 ms**, in this one desktop sample, not an uptime or cold-start guarantee. No model requests occurred.

The post-release record is documentation/test evidence only; it does not require a second runtime deployment. Existing provider cap 100, workspace cap 128, retained history, manual deployment and Free services are unchanged. The separate failed/incomplete conversation-quality qualification remains unchanged by analytics.

| Dashboard path | Page |
| --- | --- |
| `/` | Overview |
| `/approach` | Approach |
| `/knowledge` | Choose Knowledge |
| `/agent` | Chat |
| `/workspace` | Case Workspace |
| `/studio` | Knowledge Studio |
| `/evidence` | Evidence |
| `/review` | Human Review |
| `/tour` | Walkthrough |
| `/settings` | Settings |
| `/evaluation` | Evaluation |
