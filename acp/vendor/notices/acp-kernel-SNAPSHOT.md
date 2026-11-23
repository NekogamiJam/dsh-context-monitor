# Immutable upstream kernel snapshot

acp-kernel 0.0.198 from https://github.com/ranxianglei/billion-context/tree/3e42aae8bfa6d2f3bf48d376eaaaac27afbcf806/kernel . Source and build configuration are unchanged. snapshot.json records SHA-256 hashes of upstream files; tests/kernel-vendor.test.ts verifies the pin. Upstream LICENSE (including product attribution) and PROVENANCE.md are retained.

The root plugin consumes file:vendor/acp-kernel as a development dependency and tsup inlines it; end users need neither this build chain nor any install hook. dist is the upstream standalone build, retained so npm ci can typecheck/bundle without executing dependency lifecycle scripts. To rebuild, run npm run build in this directory using installed tsup and TypeScript. Never patch kernel algorithms here: replace the complete snapshot with a reviewed upstream commit and update hashes and regression evidence.
