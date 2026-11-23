# Verification and privacy notes

## v0.2.0 verification

The monitoring projection is still read-only. A separate built-in engine provides ACP, with a profile-wide settings switch. Compatibility is restricted to rc.5. Prior v0.1.x Desktop tests below validate only the old monitoring integration, not the new engine or its settings UI. Automated integration fixtures use isolated profiles and synthetic data, not production sessions or real provider credentials.

- The detached wiring fixture loads the installed Cordis and Typert modules and checks strict status registration. A separate npm-installed rc.5 Web process, home and profile exercised all four concurrent preset scopes, the strict status Gateway, and real revisioned settings writes. `/compact` is absent from the Host command catalog while ACP is on and reaches stock when off; `/acp-prune status` works when active. A switch issued during a live turn remained pending until it settled, without restarting the Host.
- The isolated Web fixture captured requests at a loopback HTTP fake provider. Model-driven `compress` committed a T1 checkpoint and hid its bookkeeping tool pair. The real ordinary fork's first request and the first request after reopening the fork in a new JSONL-backed process included the summary and excluded its unique original marker. Model `decompress`, `search_context` and `acp_status` worked after reopening.
- Additional loopback checks exercised T2 and T3 distillation and recovery through the parent links, one durable reduction and retry after provider-confirmed overflow, and a recognized invalid ACP ledger that was refused before provider dispatch.
- The isolated CLI accepted, installed and loaded the package without a version exemption or force flag. Its separate profile package manager reported missing peer warnings in profile `node_modules`; at runtime DSH resolves those peers from the matching installation.
- In Edge on the isolated Web host, the settings section rendered four cards in a 2×2 grid. Selecting `aggressive` set the three expected values, Apply showed success, and the Advanced section showed its caution when expanded. The command menu showed all four ACP entries together with their descriptions, and picking `compress` filled the draft without submitting it. This is a basic desktop browser check, not exhaustive mobile, multi-tab, cancellation or multi-tool coverage. Legacy proxy migration is not supported.

## Historical v0.1.x verification

- Declared DSH range: **`>=0.2.2-rc.1 <0.2.3-0`**. Plugin 0.1.6 was exercised locally on **0.2.2-rc.3 and 0.2.2-rc.5**; the read-only monitor path operated normally on rc.5. rc.1 / rc.2 were source-reviewed, not runtime-tested; rc.4 and stable 0.2.2 were not runtime-tested. See [COMPATIBILITY.md](COMPATIBILITY.md) for scope and exclusions.
- **Capability attribution:** the live T1 compaction observed on rc.5 was performed by the separately installed `billion-context-dsh v0.2.272` under a temporary version exemption. `dsh-context-monitor` is read-only: it observes host projections and optional backend metadata; it does not compress, decompress or search context. The backend smoke test does not validate fork-first-request compaction, restart recovery, or general Kiva compatibility.
- Plugin **0.1.7** retains the read-only behavior of 0.1.6. The publication change renames the package and client module together while retaining the bundle row ID and projection key. The model, contract, layout, inventory, semver, cache-row and README schematic tests accompany JavaScript syntax checks. The semver tests use ordinary prerelease matching, not `includePrerelease`; earlier branches and 0.2.3 prereleases are explicitly rejected.
- The README image is a hand-authored fictional SVG schematic, not a session screenshot; its data is illustrative and includes no user/session identifiers, paths or provider routes.
- Optional ACP metadata adapter: **billion-context-dsh v0.2.272**, ledger marker version 1.
- Generic context and usage telemetry remains available without that ACP plugin. Inventory failures show an explicit unknown reason rather than claiming that a plugin is active.

## Checks performed

- Pure model and contract tests cover usage buckets, missing cache fields, immutable/replayable JSON state, bounded history, compaction transactions, tier relationships, non-monotonic seq values, malformed metadata and safe fallback.
- A detached in-memory integration test imports the installed DSH Cordis, Session and projection registry. It verifies wire snapshots, synthetic usage and compaction checkpoints, and registration disposal. It never starts a provider or persistence service.
- Read-only replay of a local native compression transaction was checked during development. Only this result is retained here: the monitor recognized a committed T1 block and closed transaction. No private log, session identifier, exact machine path, or conversation content is included in the repository.
- User-provided screenshots confirmed that the tab and compaction structure render. The mobile axis clipping defect was corrected using HTML tick labels outside the SVG viewBox.
- Cache reads use a 22%-opacity blue fill with no outline; total input retains its original blue stroke. Missing usage and route changes split filled segments.
- The default range is the latest **600** recorded usage samples; 60 and 180 remain selectable.
- Source-level UI/UX reviews were performed. Automated tests are not equivalent to visual verification in every browser, theme and viewport.

## Measurement limits

The normalized DSH usage buckets are disjoint: prompt input is uncached input plus cache reads plus cache writes. The cache graph shows a token share, not a request hit rate, monetary savings or KV-cache residency.

Current context pressure is host-projected. It is not an HTTP capture. Historical samples include inherited session events. A visible block or a passing replay test does not establish that a fork's first provider request is compacted, and does not verify restart recovery or migration from a proxy backend.

The monitor records at most 600 usage samples and 400 summary records. Nested folds overlap and their source-size estimates must not be summed as cumulative savings. Summary size is a character-based approximation.

## Privacy and publication boundary

- The monitoring view does not transmit telemetry to third parties, call a model, change a prompt, or publish conversation data. The optional engine can add ACP guidance and retry a provider-confirmed overflow through DSH when enabled. Neither component imports or migrates legacy proxy state.
- The host projection sends selected metadata to the authenticated DSH client: usage, route identifiers, block references, and bounded topics. Topics can contain sensitive information; use care when sharing screenshots.
- Git publication contains only this plugin's source, synthetic tests, metadata and public documentation. Dependencies, personal workspace archives, diagnostic logs, attachments, local deployment records and Git credentials are excluded.
- Local live-session diagnostics are excluded from Git and release assets. No installation or normal plugin operation runs diagnostic scripts.
- No raw private screenshots are bundled as a marketplace preview.

## Running checks

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check
```

For the optional installed-host smoke check, run `scripts/host-smoke.mjs` using the installation's ASAR-aware Electron-as-Node environment and `DSH_INSTALL_DIR`. There are no hard-coded host paths; a normal Node installation cannot read modules inside an Electron ASAR archive.
