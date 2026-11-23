# Reproduce the checked-in ACP engine

1. Download the GitHub API tarball for commit `83b888a265d6b763b2658dedd54a91118bc702be` and verify SHA-256 `E02CDD99B7B83C2324A19F3DCD218B78464252CB177A4E54EFFBF26081CA537E`.
2. Extract it to a clean directory (for example ignored `artifacts/vendor-upstream/`) with the archive's single top-level directory removed. Do not copy or commit any `node_modules`.
3. From the repository root run `pwsh -File acp/vendor/notices/build-vendor.ps1 -SourceDir artifacts/vendor-upstream`. The script applies `adapter.patch` to the clean pinned source, runs `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build`, then copies `dist/index.js` to `acp/vendor/engine.js` while removing only the absent source-map reference.
4. The checked-in adapter patch is against the pinned source's `src/` files; the kernel remains the unmodified `vendor/acp-kernel` snapshot at version `0.0.198` and is bundled inline by the upstream `tsup` config. No model/provider calls are made by the build or tests.

Build-time `node_modules`, extracted tarballs, sourcemaps and temporary source trees are ignored artifacts only. Runtime uses the checked-in engine bundle and host peer dependencies; it never downloads or imports the Kiva npm package.
