# 上下文监控 / DSH context monitor

**`dsh-context-monitor` v0.2.0**提供只读监控，并可通过设置启用同包内置的 ACP 压缩后端（首装默认开启）。不需另装 `billion-context-dsh`。内置后端使用 [acp-kernel](https://github.com/ranxianglei/acp-kernel) 与 [billion-context](https://github.com/ranxianglei/billion-context)，基于 [Kiva 的 DSH 适配](https://github.com/Kiva007/billion-context-dsh/tree/v0.2.272)。

## DSH 版本兼容性

v0.2.0 仅支持 **DSH 0.2.2-rc.5** 的 Desktop/Web 四个内置预设。内置后端依赖此版本的命令、配置和预设编排，而不只是 v0.1.x 的只读投影。不要用旧版监控报告或版本豁免推断兼容性。详见 [内置 ACP 设置、升级与测试边界](docs/BUILT-IN-ACP.md)。

## 用法与功能

安装并刷新现有 DSH 页面后，在会话顶部与聊天等并列的标签中选择 **上下文 / Context**。

### 安装

在 DSH 插件管理器中任选一种安装来源（均含前端产物，无需构建脚本）：

- **npm（推荐）：** `dsh-context-monitor`，也可用 `dsh-context-monitor@0.2.0` 固定版本。需要旧版只读监控时，请按兼容性说明选择 `dsh-context-monitor@0.1.7`。
- **GitHub 源码：** 从 [Releases](https://github.com/NekogamiJam/dsh-context-monitor/releases) 选定标签后使用 `github:NekogamiJam/dsh-context-monitor#vX.Y.Z`。
- **GitHub 预打包文件：** [下载最新稳定版安装包](https://github.com/NekogamiJam/dsh-context-monitor/releases/latest/download/dsh-context-monitor.tgz)。

旧版包名为 `@local/dsh-context-monitor`；不会自动迁移到新包名。新旧包使用同一个插件行 ID，请勿并装。需要切换时，在插件管理器中移除旧 bundle，再安装新包；若宿主提示重启，按提示操作。移除旧 bundle 不会改写会话历史。


- 概览：宿主累计输入、缓存读取和输出，监控投影记录的 usage 样本数。
- 水位：DSH `contextPressure.projectedTokens` 本地投影估算、窗口容量、最近已结算请求的真实 usage 输入。
- 趋势：总输入蓝线、缓存读取半透明蓝色面积、已提交的原生压缩检查点标记、缓存读取 token 比例；**默认最近 600 个样本**，也可选最近 60 / 180 个样本。
- 压缩结构：T1/T2/T3、持久 compaction ID、billion-context-dsh bN 引用、来源块关系、源 seq、替换规模、摘要粗估、事务和表层状态；支持主题／引用筛选。
- 会话后端：单行显示实际挂载的内置 ACP、DSH 原生压缩或外部后端；后端未确认时仍展示通用 DSH 指标。监控投影缺失时显示提示，不影响聊天。

### 界面示意

![上下文监控的去敏界面示意图，所有数字和记录均为虚构样例](docs/context-monitor-preview.svg)

> 这是按当前界面布局绘制的静态示意图，并非用户会话截图；图中数值、趋势线、检查点与压缩记录均为虚构内容，不含账号、路径、会话标识或真实请求数据。

这里的监控页只显示脱离正文的元数据。若在 **更多 → 设置 → 上下文监控** 启用了内置 ACP，独立的后端可执行压缩与恢复等操作，触发 ACP 提示或溢出处理。**不要同时启用其他上下文压缩插件。** 本插件不读取或迁移旧 bili 数据库。

## 指标口径（重要）

DSH 0.2.2-rc.3 / rc.5 的 TokenUsage 是互斥桶：

```
prompt input = inputTokens（未缓存）+ cacheReadTokens + cacheWriteTokens
cache-read share = cacheReadTokens / prompt input
```

- 累计桶直接订阅宿主 `tokenUsage`，包括该投影处理的重试与继承历史；**不是当前 fork 子会话的独立账单**。
- 图表记录显式 `assistant/message.data.usage`。未上报 read 的样本留空，不伪装成 0%；usage 只在失败 attempt stream 中的请求不会出现在图表。因此样本数不是全部 HTTP 请求数。
- 当前水位为宿主估算，最近请求输入为 provider reported；请求进行中保留上一已结算值。窗口容量与压力是独立时间点，不保证原子配对。
- 缓存读取比例不是“多少请求命中”、价格折扣、实际节省金额或 KV 驻留率。
- `shadowedTokenCount` 是宿主／插件的日志计价；摘要按文本字符数 / 4 粗估。它们都不等同于 provider 实测。多层压缩存在重叠，不累计成“节省 token”。
- 无法可靠归因缓存失效是 TTL、压缩还是模型切换，不仿造截图中的 Cache economics／Ledger balanced。
- 原始记录仍在 DSH 会话日志；此插件不打开或迁移旧代理状态。

## 数据与上限

Host 通过 `ctx.sessionProjections.register()` 注册 `localContextMonitor`，使用纯同步 fold，JSON state、版本 1、Zod 严格 schema、`summary: false`（不增加会话列表摘要流量）。Client 在 `conversation.view` session slot 使用 `props.useProjection`，不重复扫描会话正文或轮询事件。

每会话最多保留 **600 个样本、400 个摘要记录**。超过后页面明确提示不完整；全部事件仍在原始日志，重放结果有相同上限。不会把未知元数据或缺少精确 sourceEventSeqs 的表层关系猜成确定结果。

后端状态读取当前会话实际挂载的压缩服务，不从全局开关或历史压缩块推断。检测到后端时状态为绿色；无法确认、未加载或切换中时为灰色。打开监控页、后端变化或点击「重新检测」时更新。

## 本地开发

```powershell
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run check
```

生产依赖固定 `zod 4.6.6`，ACP 所用 DSH 接口通过宿主 peer 获取；开发测试另用 `semver 7.8.5`。安装无需执行构建脚本。前端使用宿主 ModuleLoader 和 React，无 CDN 或 iframe。

v0.2.0 已在 rc.5 的隔离宿主做端到端测试，并在 Desktop 试用。它替换四个内置预设中的压缩后端和命令入口；不应与自定义预设补丁或其他压缩引擎叠加。请通过插件管理器安装，不要手改生产 profile 文件。

卸载／回退：在插件管理器停用或删除 **上下文监控** bundle，不会改写会话历史。若要恢复独立压缩插件，先确认内置后端已停用，再单独启用它。开发目录安装后被 profile 链接引用，**不要移动或删除该目录**。

## 验证状态

实现和测试范围见 [验证记录](docs/VERIFICATION.md)。隔离假 provider 抓取验证了普通 fork 与重启后的首个请求使用压缩表层；这不等于真实 provider 的费用验证。监控面板中的块数不能证明出站行为，本插件也不是旧代理迁移器。

界面参考用户提供的 billion-context 仪表盘布局，但未复制其源码、截图或第三方品牌标识。README 中的界面示意为原创 SVG，所有数据虚构；图标是原创轻量折线图 SVG。插件管理器无单独详情配图，按 README 回退展示使用说明。
