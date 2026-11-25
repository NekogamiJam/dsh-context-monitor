# 内置 Active Context Pruning（v0.2.1）

上下文监控页的投影仍然只读。可选内置 ACP 是另一部分：它在启用时提供 `compress`、`decompress`、`search_context`、`acp_status`，使用 DSH 的原生表层替换与持久检查点。它不经 bili HTTP 代理，也不安装或调用独立 `billion-context-dsh` 包。

## 兼容范围与升级

v0.2.1 的**唯一实机验证及保证基线仍是 DSH 0.2.2-rc.5**、Node ≥24.9 和该版本 Desktop/Web 的 `standard`、`ptc`、`minimal`、`cordis` 预设。版本元数据允许 DSH `0.2.3-*` 预发布尝试；alpha.1/alpha.2 仅做公开源码和包清单静态审查，未安装或启动 alpha Host，**不承诺 alpha 兼容**。未来 alpha 和 0.2.3 stable 也不在保证范围。alpha.2 的 DSH Host 自身要求 Node 24.22.3+（24.x）或 26.13.1+；插件的 Node floor 保持 24.9，以免丢失 rc.5。

`cordis.patch.yml` 保留 rc.5 预设基线；只在 Host 报告 `0.2.3-*` 时加入 alpha.2 的预设配置差异。Host 版本判断不等于 alpha 运行验证。不要把版本围栏接受或源码相似当成通过测试；alpha 使用请限于可丢弃的 profile，并预期行为可能不同。不要强装或使用版本豁免。

**不要与独立 `billion-context-dsh`、旧 bili 或其他压缩插件并装启用。** 如果已经安装独立后端，先按宿主界面停用或移除，再单独验证本候选。检测到在用的其他后端、无法接管的预设或旧预设修订时，显示原因而不是强行覆盖用户配置。监控独立工作；关闭内置引擎后，受管理预设恢复 DSH 原生压缩和 `/compact`。

启停不会解压或改写已提交的历史。现有原生账本只在精确映射时可用，不支持导入旧 HTTP 代理数据库，也不把代理 ledger 的序号视为 DSH seq。遇到恢复异常应停止并核查，不用生产长会话冒险验证。

## 设置

打开 **更多 → 设置 → 上下文监控**。内置 ACP 首装默认开启；界面分别显示全局请求与实际状态。设置属于当前 DSH profile，所有受管会话与窗口共用。编辑只改变草稿；按 **应用** 才提交。进行中的操作会先收尾，成功后出现提示；并发修改或配置阻断不会被当成应用成功。

会话的「上下文」页只显示一行「压缩后端」：实际检测到内置 ACP、DSH 原生压缩或外部后端时显示绿色；会话未挂载、切换中或状态未知时显示灰色。全局开关与历史压缩块都不作为当前后端的证据。已打开的会话可能保留旧预设修订；刷新页面不等于更换宿主预设。

| 预设 | `nudgeMinContextLimitPct` | `nudgeMaxContextLimitPct` | `nudgeEmergencyThresholdPct` | 定位 |
|---|---:|---:|---:|---|
| preserve | 0.55 | 0.78 | 0.93 | 尽量保留历史，接近上限才提醒 |
| relaxed | 0.50 | 0.75 | 0.90 | 轻度压缩，比 preserve 稍早 |
| balanced | 0.45 | 0.70 | 0.85 | 默认平衡 |
| efficient | 0.40 | 0.60 | 0.78 | 更勤修剪，减少 token 占用 |
| aggressive | 0.30 | 0.50 | 0.70 | 更早、更频繁修剪 |

可自定义，范围 `0 ≤ min ≤ max ≤ emergency ≤ 1`。阈值用于 nudge，不保证每次必然压缩。高级选项默认折叠，若不了解其影响请保留默认：`modelContextLimit`（留空为自动/回退）、`autoModelContextLimit`、`autoNudge`、`maxOverflowRetries`、`autoTools`、`autoCommand`、`coreOverrides` 与 `prompts`。两个对象使用 JSON，不执行代码，三个主阈值不允许被 JSON 覆盖。`countTokens` 属于宿主注入，`settingsEnabled` 属于旧装配机制，不是用户可调项。

## 命令

内置 ACP 生效时，受管理预设不注册 `/compact`，斜杠菜单不显示它。此时手输 `/compact` 可按普通文本发送，不会调用原生压缩。关闭内置 ACP 后，恢复原生 `/compact`。斜杠菜单在同一个「指令」分组列出 `/acp-prune` 及 `status`、`compress`、`decompress` 三个入口，并提示参数。压缩需明确范围与摘要，解压需块引用；选择子项只在空输入框中填入标准命令，不覆盖现有草稿或附件，也不自动发模型请求。手输语法仍为 `/acp-prune [status|compress|decompress|config]`，原生命令通道不依赖菜单。

## 归属

本插件使用 [acp-kernel](https://github.com/ranxianglei/acp-kernel) 和 [billion-context](https://github.com/ranxianglei/billion-context)。DSH 适配基于 [Kiva v0.2.272](https://github.com/Kiva007/billion-context-dsh/tree/v0.2.272)，内核固定为 `0.0.198`；随包提供源版本、版权、许可证与修改说明。预设基线基于 MIT 许可的 [DeepSeek Harness 0.2.2-rc.5](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.5)；alpha-only 预设差异仅按公开配置做条件适配，未经 alpha Host 验证。
