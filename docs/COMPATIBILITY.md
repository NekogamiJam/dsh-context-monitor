# DSH compatibility / DSH 版本兼容性

## v0.2.0: exact host revision

The built-in ACP changes host preset composition and adds a settings and command adapter. Its declaration is **DSH 0.2.2-rc.5 only**, for the four shipped Desktop/Web presets, with **Node ≥24.9**. A version exemption is not a supported installation path. See [built-in ACP](BUILT-IN-ACP.md) for setup and boundaries.

The remainder of this document describes the historical **read-only v0.1.x** monitor and does not widen v0.2.0's compatibility declaration.

## v0.1.x: declared range / 旧版声明范围

Since plugin **0.1.5**:

```text
>=0.2.2-rc.1 <0.2.3-0
```

- **DSH 0.2.2-rc.3: exercised locally.** The monitor's installed-host projection integration and ordinary UI use were checked, including recognition of a committed T1 block produced by the separate `billion-context-dsh` backend. This is not a comprehensive browser, platform, fork-first-request, restart, or proxy-migration test.
- **DSH 0.2.2-rc.5: the monitor was exercised locally in the live Desktop environment and its read-only monitoring path operated normally.** This confirms the monitor on rc.5 only; it does not mean the monitor performed a compaction or validate the optional backend's general compatibility.
- **Separate backend check:** on rc.5, `billion-context-dsh v0.2.272` (after a temporary version exemption) performed one live T1 compaction, reporting about 19.8K tokens reclaimed. That behavior belongs to `billion-context-dsh`, not `dsh-context-monitor`; it was a smoke test, not restart or fork-first-provider-request E2E.
- **DSH 0.2.2-rc.1 and 0.2.2-rc.2: source-reviewed candidates, NOT runtime-tested.** Their published sources expose the required projection, session hooks and conversation tab contract. No old host was installed or launched for this investigation.
- **DSH 0.2.2-rc.4 and the eventual 0.2.2 stable: NOT runtime-tested.** Their inclusion in the declared range is based on the same-patch-line contract assumption; they were not individually reviewed here.
- **0.2.2 alpha/beta builds, versions below 0.2.2-rc.1, and 0.2.3 or newer (including its prereleases): outside the declared range.** No claim of support is made. Future release lines should be reviewed before widening again.

中文摘要：监控插件在 **0.2.2-rc.3 和 rc.5** 均有本机实测；rc.5 的只读监控路径运行正常。rc.1 / rc.2 仅静态核对，rc.4 和 0.2.2 正式版未经实测。另一次约 19.8K token 的 T1 压缩由 `billion-context-dsh v0.2.272` 在临时豁免后执行，**不是监控插件的压缩能力**。

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

The lower comparator explicitly names the **0.2.2 prerelease tuple**. Tests use normal `semver.satisfies()` without `includePrerelease`: rc.1 / rc.2 / rc.3 / rc.4 and stable 0.2.2 match; the unchanged declared range also admits rc.5, which has now been exercised locally for the monitor's read-only path. 0.2.1-rc.5, 0.2.2-alpha.3 and 0.2.3-alpha.1 do not match. A broad-looking range starting on an unrelated prerelease tuple is not equivalent.

The range is for this **monitor**, not a promise about billion-context-dsh's own engine constraints. ACP metadata support was reviewed with `billion-context-dsh v0.2.272` ledger version 1. Other backend releases are not runtime-verified here; unsupported metadata is shown as generic summary records.

Missing token-meter views show unavailable values; missing inventory shows unknown status; absent ACP backend retains generic metrics. A missing **required** projection service leaves the host plugin waiting/inactive. A custom preset lacking the expected session hook or conversation slot is not guaranteed by the version range alone. Do not use force-install/version exemptions as evidence of compatibility.

## Reproduction / 复查方式

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check
```

`test/compatibility.test.mjs` verifies positive/negative engine matches and lockfile consistency. `semver` is a development-only dependency, not a production dependency. Optional host integration is described in [VERIFICATION.md](VERIFICATION.md). Downloaded upstream research artifacts remain local and ignored by Git; public documentation links to the original version-pinned sources instead.
