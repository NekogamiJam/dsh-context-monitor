# v0.2.0 候选：隔离浏览器验收

**仅供本机隔离测试。** 已有的测试宿主位于开发工作树的 `artifacts/rc5-fake-provider-host/`；不要在生产 Desktop 启用候选。以下操作不需要模型账号或 API 密钥。先退出用过同一测试 home 的其他测试进程。

## 打开测试页面

在开发工作树根目录打开一个临时 PowerShell 窗口，运行：

```powershell
$root = (Resolve-Path -LiteralPath 'artifacts/rc5-fake-provider-host').Path
$overlay = (Resolve-Path -LiteralPath 'scripts/acp-isolated-no-providers.yml').Path
$env:DSH_HOME = Join-Path $root 'home'
$env:DSH_TELEMETRY_DISABLED = '1'
$cli = Join-Path $root 'node_modules/@deepseek-ai/dsh/lib/bin.js'
Set-Location -LiteralPath (Join-Path $root 'workspace')
node $cli web --patch $overlay --no-open --host 127.0.0.1 --port 0
```

手动在浏览器打开该进程打印的本机测试地址；不要分享它的临时认证参数、Cookie 或其他凭据。测试结束在这个 PowerShell 中按 `Ctrl+C`，然后关闭该窗口。不要进入生产地址，不要登录真实账号或安装其他插件。

## 通过条件

1. **更多 → 设置 → 上下文监控**能打开；看到 profile 全局开关、“不建议同时启用”的说明和「应用」。切换 `balanced` / `aggressive`，核对三项值分别为 `0.45 / 0.70 / 0.85`、`0.30 / 0.50 / 0.70`；改动任一非预设值显示自定义。切换预设不应立即写入；点「应用」才显示生效。高级选项初始折叠，展开可见谨慎操作提示及恢复默认按钮。
2. 在普通测试会话的斜杠菜单中检查三个 `acp-prune` 子项，选取压缩、解压时仅进入命令输入，不自动提交。再试手输 `/acp-prune status`；应返回 Host 状态，不出现真实模型请求。ACP 启用时在斜杠菜单搜索 `compact`，不应出现该命令；手输 `/compact` 会按普通文本处理，因此请只在假 provider 测试中提交。
3. 打开同一隔离站点的第二个浏览器标签页。先在第二页留下未应用草稿，再在第一页关闭 ACP 并应用。第二页应看到共享设置改变；提交较早草稿应报告冲突、不覆盖第一次写入。关闭后重开斜杠菜单，三个 ACP 子项应消失，`/compact` 应恢复。最后恢复 `balanced` 和原启用状态。全程无需刷新或重启宿主。
4. 检查窄屏与至少一种桌面宽度，若有条件再查明暗主题和仅键盘操作。监控页只应显示一行后端状态；确认的后端为绿色，未确认的为灰色。对齐水位、图表和压缩结构卡片的左右边；宽表只能在各自卡片内横滚。记录失败的步骤及预期／实际行为，截图前裁去地址栏与其他会话；只截这个隔离测试窗口。

这份清单不假设浏览器测试已执行。自动化脚本 `acp-isolated-web-smoke.mjs` 使用同一无真实模型路由 overlay，并独立验证 Host；它不能代替上述浏览器验收。
