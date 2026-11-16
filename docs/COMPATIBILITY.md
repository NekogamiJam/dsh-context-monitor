# DSH compatibility / DSH 版本兼容性

## Declared range / 声明范围

Since plugin **0.1.5**:

```text
>=0.2.2-rc.1 <0.2.3-0
```

- **DSH 0.2.2-rc.3: exercised locally.** Installed-host projection integration, ordinary UI use, and recognition of one committed native T1 block were checked. This is not a comprehensive browser, platform, fork-first-request, restart, or proxy-migration test.
- **DSH 0.2.2-rc.1 and 0.2.2-rc.2: source-reviewed candidates, NOT runtime-tested.** Their published sources expose the required projection, session hooks and conversation tab contract. No old host was installed or launched for this investigation.
- **Later 0.2.2 release candidates and the eventual 0.2.2 stable: conditionally allowed, NOT tested or individually reviewed.** The range intentionally permits the same patch release line, assuming those public contracts remain compatible. Stable 0.2.2 was not present among the upstream tags or npm version lists inspected on 2026-11-16.
- **0.2.2 alpha/beta builds, versions below 0.2.2-rc.1, and 0.2.3 or newer (including its prereleases): outside the declared range.** No claim of support is made. Future release lines should be reviewed before widening again.

中文摘要：目前只有 **0.2.2-rc.3 经过本机运行验证**；rc.1 / rc.2 仅做源码静态核对，未安装、未启动旧宿主。后续同一 0.2.2 版本线的 RC 与正式版只是保守预期兼容，不等于实测通过；0.2.2 正式版在本次调查时尚未发布。

## Why not declare every older version? / 为什么不无限向下兼容？

The projection API already existed in the older tags inspected (`0.1.7-rc.2`, `0.2.0-rc.2`, `0.2.1-rc.5`). However, their `ProjectionDefinition.wire` and registration code retain only `viewSchema` and `view`: they do **not** support `summary: false`.

This monitor uses `summary: false` to keep its up-to-600-sample / 400-block payload out of session-list summary snapshots. Older registries silently ignore the extra field and include the payload in summaries. A panel might still render, but that is not equivalent to satisfying the current performance contract. Supporting those releases would need a separate bounded/summary-safe compatibility design and testing; a broad engine range alone is not a fix.

旧版并非已证实“完全不能运行”；问题是缺少本插件依赖的摘要流量隔离能力。因此本次选择有证据的 rc.1 下限，不为扩大覆盖面而静默牺牲性能或声称旧版已支持。

## Reviewed contracts / 已核对契约

The following upstream sources were read at **both** `dsh-v0.2.2-rc.1` and `dsh-v0.2.2-rc.2` and compared against the installed rc.3 contract:

- [`session-projection/src/index.ts` (rc.1)](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/session/session-projection/src/index.ts#L83-L132): `register`, JSON fold state, Zod state/wire schemas, `stateVersion`, and `wire.summary`. Between rc.1 and rc.2 the fetched file differed only in the explanatory `stateVersion` comment, not implementation.
- [`token-meter/src/usage-projection.ts` (rc.1)](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/llm/token-meter/src/usage-projection.ts): `tokenUsage` disjoint buckets and `contextPressure` fields. The rc.1 and rc.2 source files were byte-identical in this comparison.
- [`ui-session/src/client/index.ts` (rc.1)](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-session/src/client/index.ts#L166-L185): session-scoped `useProjection` standard prop.
- [`ui-conversation` slot contract (rc.1)](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/contract/slots.ts): session-list `conversation.view` slot. Its [registration code](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-conversation/src/client/apply.ts) also uses the same locale registration and view-tab enumeration pattern.
- [`api/remotes/src/client/index.ts` (rc.1)](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/api/remotes/src/client/index.ts): application assembly imports and mounts `pluginInventoryRemote`. It remains optional to this plugin; errors produce an explicit unknown reason.
- Published conversation browser artifacts for rc.1 / rc.2 / rc.3 contain `useProjection` calls. The inspected rc.2 and rc.3 conversation browser artifacts were identical; rc.1's artifact was different, so this is not a claim that the entire clients are identical.

Earlier comparison references: [0.2.1-rc.5 registry](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/session/session-projection/src/index.ts#L49-L92), [0.2.0-rc.2 registry](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/session/session-projection/src/index.ts#L49-L92), [0.1.7-rc.2 registry](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/session/session-projection/src/index.ts#L49-L92).

The installed upgrade-guide index for the rc.1-to-current interval was also reviewed. Its listed account, Forge, CUA, terminal, request-mutation and provider-authentication changes are not APIs this read-only plugin consumes. It does not replace `Session.append`, mutate requests or draw shell overlays; no migration was applied on the basis of unrelated guides.

## Semver and fallback / 版本匹配与降级

The lower comparator explicitly names the **0.2.2 prerelease tuple**. Tests use normal `semver.satisfies()` without `includePrerelease`: rc.1 / rc.2 / rc.3 and stable 0.2.2 match; 0.2.1-rc.5, 0.2.2-alpha.3 and 0.2.3-alpha.1 do not. A broad-looking range starting on an unrelated prerelease tuple is not equivalent.

The range is for this **monitor**, not a promise about billion-context-dsh's own engine constraints. ACP metadata support was reviewed with `billion-context-dsh v0.2.272` ledger version 1. Other backend releases are not runtime-verified here; unsupported metadata is shown as generic summary records.

Missing token-meter views show unavailable values; missing inventory shows unknown status; absent ACP backend retains generic metrics. A missing **required** projection service leaves the host plugin waiting/inactive. A custom preset lacking the expected session hook or conversation slot is not guaranteed by the version range alone. Do not use force-install/version exemptions as evidence of compatibility.

## Reproduction / 复查方式

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check
```

`test/compatibility.test.mjs` verifies positive/negative engine matches and lockfile consistency. `semver` is a development-only dependency, not a production dependency. Optional host integration is described in [VERIFICATION.md](VERIFICATION.md). Downloaded upstream research artifacts remain local and ignored by Git; public documentation links to the original version-pinned sources instead.
