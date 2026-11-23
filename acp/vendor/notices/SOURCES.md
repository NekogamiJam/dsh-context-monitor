# Vendored ACP source and licenses

The checked-in engine is derived from the public `Kiva007/billion-context-dsh` source at version `0.2.272`, pinned to commit `83b888a265d6b763b2658dedd54a91118bc702be` (tag `v0.2.272`). Canonical source: <https://github.com/Kiva007/billion-context-dsh/tree/83b888a265d6b763b2658dedd54a91118bc702be>.

The upstream archive used to build this adapter was SHA-256 `E02CDD99B7B83C2324A19F3DCD218B78464252CB177A4E54EFFBF26081CA537E` (2,521,478 bytes; GitHub API tarball endpoint for the pinned commit). Do not use the moving branch head or an npm-installed Kiva package as build input.

That commit vendors `acp-kernel` version `0.0.198` from the `ranxianglei/billion-context` project. The kernel implementation is included inline in the generated engine; its upstream `PROVENANCE.md` and `SNAPSHOT.md` are retained here, and its MIT license is retained as `acp-kernel-MIT.txt`. The upstream adapter MIT license is `upstream-MIT.txt`.

The project repository keeps the complete local adaptation as `adapter.patch` against the fixed public archive rather than a second extracted copy of the upstream tree. Reproduce the exact patched source and checked-in bundle with `RECIPE.md` and `build-vendor.ps1`. The npm package intentionally includes only generated `acp/vendor/engine.js`, the small public `index.js`/`runtime.js` bridge, and this notices directory—not node_modules, build caches, source maps, duplicate extracted source trees, or any private files.
