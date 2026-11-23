window.__ModuleLoader__.load({
  id: 'dsh-context-monitor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'local.contextMonitor';
    const ACP_FORM = 'context-monitor-acp';
    const PRESETS = {
      preserve: [0.55,0.78,0.93], relaxed: [0.50,0.75,0.90], balanced: [0.45,0.70,0.85], efficient: [0.40,0.60,0.78], aggressive: [0.30,0.50,0.70],
    };
    const ACP_DEFAULTS = { enabled:true, nudgeMinContextLimitPct:.45, nudgeMaxContextLimitPct:.70, nudgeEmergencyThresholdPct:.85, autoNudge:true, autoTools:true, autoCommand:true, autoModelContextLimit:true, maxOverflowRetries:1, coreOverrides:{}, prompts:{} };
    const stableJson = value => Array.isArray(value) ? value.map(stableJson) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableJson(value[key])])) : value;
    const zh = {
      tab: '上下文', title: '上下文', subtitle: '只读监控 · 不改变压缩、缓存或模型请求',
      loading: '正在读取宿主投影…', noProjection: '监控投影暂不可用。请确认插件宿主已启用并刷新页面；对话仍可正常使用。',
      current: '当前上下文估算', last: '最近请求输入', requests: '已记录 usage 样本', totalInput: '累计输入（宿主记录）', cacheRead: '累计缓存读取', output: '累计输出', hit: '窗口内缓存读取比例',
      window: '上下文窗口', unavailable: '暂无数据', unknownValue: '未知', estimate: '宿主估算，非出站实测', actual: 'Provider usage · 不含输出',
      pressureNote: '水位估算来自 DSH contextPressure；最近请求输入来自 provider usage。分子与窗口可能来自不同时间点，换模型后尤其需要留意。此页不捕获 HTTP 出站消息，也不能证明 fork 首请求正确。',
      trend: '上下文水位变化', cacheTrend: '缓存读取比例变化', sampleNote: '按请求结算样本排列；只包含有显式 usage 的 assistant/message，不包含仅失败 attempt 的 usage。红色虚线为已替换的原生压缩检查点。',
      inputLegend: '总输入', cacheLegend: '其中缓存读取', capLegend: '当前窗口（仅参考）', foldLegend: '压缩检查点',
      noSamples: '尚无已完成请求的 usage 样本。开始对话后自动更新，不需要为监控额外调用模型。',
      range: '显示范围', recent60: '最近 60 个样本', recent180: '最近 180 个样本', recent600: '最近 600 个样本',
      ratioNote: '缓存读取 /（未缓存输入 + 缓存读取 + 缓存写入）。这是 token 比例，不是请求命中率、费用节省或 KV 缓存驻留率；未上报缓存字段的样本留空。',
      structure: '压缩结构', records: '摘要记录', resident: '当前保留', folded: '已被替换', uncommitted: '未见检查点', unknownStatus: '表层状态未知',
      noBlocks: '本会话没有原生压缩摘要记录。旧 bili 的代理数据库不会自动导入。', search: '筛选主题或块引用', all: '所有层级', generic: '通用 / 未知层级',
      block: '块 / 主题', tier: '层级', span: '源范围', size: '替换规模 → 摘要估算', parents: '来源块', state: '状态', time: '时间',
      sizeNote: '原文规模为日志 shadowedTokenCount（宿主/插件计价）；摘要按文本字符 ÷ 4 粗估，非 provider 实测。分层折叠会重复涉及旧块，禁止把各行相加当“累计节省”。不发送原文或摘要正文；主题元数据仍可能包含会话信息。',
      unknownLedger: '检测到不支持的 ACP 元数据版本，已退回通用摘要记录。', partial: '历史展示有上限：最多 600 个 usage 样本、400 个摘要记录；计数与表层状态可能仅覆盖保留记录。',
      more: '显示更多记录', emptyFilter: '没有匹配的压缩记录。', genericBlock: '原生摘要', transactionOpen: '事务未闭合', transactionError: '事务记录有错误',
      method: '指标口径与安全边界', methodText:'只读回放会话投影，并检测当前会话后端；监控页不会发起模型请求、改变提示词或读取旧代理数据库。无法确认后端时仍保留通用指标。',
      trendData: '查看近期请求数据', seq: '日志 seq', input: '总输入', cache: '缓存读', sampleHit: '缓存读比例', route: '路线',
      readonly: '只读', pending: '请求进行中时显示上一结算样本', historical: '包含继承的历史事件，不是当前子会话的独立账单',
      settingsTitle:'上下文监控',acpWarning:'不建议同时启用其他上下文压缩插件，以免发生冲突。',acpConflict:'检测到其他压缩后端。请先在插件管理器中停用冲突插件。',acpUnmanaged:'有未接入内置 ACP 的预设或旧会话修订；未切换后端。',acpActivationFailed:'后端切换失败，请检查有效的 profile 与预设配置。',acpInvalidAdvanced:'高级 ACP 配置无效，保留上一套有效设置。',acpAdvancedWarning:'不理解这些选项时请保留默认值。',acpApplied:'设置已应用。',acpSuperseded:'此设置已被另一次修改取代。',acpSavedBlocked:'设置已保存，但内置 ACP 未能按请求启用。', settingsDescription:'配置本机 DSH 的 ACP 行为；保存的是 Host 设置草稿，不会执行 JavaScript。', acpLoading:'正在读取 ACP 设置…', acpUnavailable:'Host 尚未提供 context-monitor-acp 设置或当前连接不可写。', acpEnabled:'启用 ACP', acpAutoNudge:'自动提醒', acpAutoTools:'自动工具', acpAutoCommand:'自动命令', acpAutoModel:'自动模型上下文上限', acpLimit:'模型上下文上限（留空表示不提交字段）', acpRetries:'溢出重试次数', acpThresholds:'Nudge 阈值（最小 / 最大 / 紧急）', acpPreset:'预设', acpCustom:'自定义',preserveHelp:'尽量保留上下文，接近上限才提醒。',relaxedHelp:'轻度压缩，比 preserve 稍早提醒。',balancedHelp:'默认平衡，与原插件的开箱阈值一致。',efficientHelp:'更勤修剪，减少 token 占用。',aggressiveHelp:'更早、更频繁地压缩。', acpApply:'应用', acpDiscard:'撤销草稿', acpDirty:'有未应用草稿', acpSaved:'设置已写入；正在等待 Host 生效状态。', acpSaveFailed:'应用失败或版本冲突；草稿已保留，请核对后重试。', acpStatusUnavailable:'运行状态不可用；不代表应用成功。', acpEffective:'有效', acpBlocked:'被阻止', acpPending:'切换中 / 等待 Host', acpPhase:'Host 阶段', acpReason:'原因', acpAdvanced:'高级选项',acpResetAdvanced:'恢复高级默认值', acpCoreOverrides:'coreOverrides JSON', acpPrompts:'prompts JSON', acpInvalidJson:'JSON 格式无效。', acpInvalidNumber:'数值无效。', acpStatus:'状态',acpStatusUsage:'查看压缩块和当前占用，无需参数',acpCompressUsage:'压缩范围：起始 seq、结束 seq、摘要',acpDecompressUsage:'读取压缩块：块 ID [偏移] [条数]', acpCompress:'压缩', acpDecompress:'解压', acpHint:'通过 Host 的 /acp-prune 命令提交；选取菜单项会进入命令模式。', builtInAcp:'内置 ACP', thirdParty:'第三方供应方', acpRebase:'保留草稿并基于最新版本重试', acpRequested:'请求启用', upstream:'上游项目',
       sessionBackend:'压缩后端', sessionBuiltin:'内置 ACP（billion-context-dsh）', sessionStock:'DSH 原生压缩', sessionExternal:'外部压缩后端', sessionSwitching:'切换中', sessionNone:'当前会话未加载', sessionUnknown:'当前会话未确认', acpProfileScope:'此处显示全局设置。当前会话实际使用的后端请查看「上下文」。', checkBackend:'重新检测',
    };
    const en = {
      tab:'Context',title:'Context',subtitle:'Read-only telemetry · never alters compaction, caching or requests',loading:'Reading host projection…',noProjection:'Monitor projection unavailable. Check the host plugin and refresh. Conversation remains available.',current:'Projected context',last:'Latest request input',requests:'Recorded usage samples',totalInput:'Cumulative input (host)',cacheRead:'Cache reads (host)',output:'Output (host)',hit:'Cache-read share in range',window:'Context window',unavailable:'No data',unknownValue:'Unknown',estimate:'Host estimate, not outgoing measurement',actual:'Provider usage · excludes output',pressureNote:'Projection uses DSH contextPressure. Latest input uses provider usage. Numerator and capacity may be sampled at different times, especially after route changes. This view does not capture HTTP requests or verify a fork’s first request.',trend:'Context history',cacheTrend:'Cache-read share history',sampleNote:'Settled requests with explicit assistant/message usage only; failed-attempt-only usage is excluded. Red dashed markers show committed native summary replacements.',inputLegend:'Total input',cacheLegend:'Cache reads',capLegend:'Current capacity (reference)',foldLegend:'Compaction',noSamples:'No settled usage samples yet. Updates during normal conversation with no additional model calls.',range:'Range',recent60:'Latest 60 samples',recent180:'Latest 180 samples',recent600:'Latest 600 samples',ratioNote:'Cache reads / (uncached input + cache reads + cache writes). This is a token share, not request hit rate, monetary savings or KV residency. Unreported cache fields stay empty.',structure:'Compaction structure',records:'Summary records',resident:'Retained',folded:'Replaced',uncommitted:'No checkpoint observed',unknownStatus:'Surface state unknown',noBlocks:'No native summary records. Old bili proxy state is not automatically imported.',search:'Filter topics or block references',all:'All tiers',generic:'Generic / unknown tier',block:'Block / topic',tier:'Tier',span:'Source range',size:'Replaced → summary estimate',parents:'Source blocks',state:'Status',time:'Time',sizeNote:'Source size is logged shadowedTokenCount; summary size is text characters / 4, not provider measured. Nested folds overlap: row sizes must not be summed as cumulative savings. No original or summary bodies are sent; topic metadata may still contain private information.',unknownLedger:'Unsupported ACP metadata version; generic summary records remain available.',partial:'History is bounded to 600 usage samples and 400 summary records. Counts and surface state may cover only retained records.',more:'Show more records',emptyFilter:'No matching compaction records.',genericBlock:'Native summary',transactionOpen:'Transaction not closed',transactionError:'Transaction recorded an error',method:'Measurement and safety',methodText:'Read-only session projections and a live backend check. The monitor does not send model requests, change prompts, or read a legacy proxy database. Generic telemetry remains available when the backend cannot be confirmed.',trendData:'Recent request data',seq:'Log seq',input:'Total input',cache:'Cache read',sampleHit:'Cache-read share',route:'Route',readonly:'Read only',pending:'While streaming, shows the previous settled sample',historical:'Includes inherited history; not a separate bill for the current child session',
      settingsTitle:'Context monitor',acpWarning:'Do not enable other context compaction plugins alongside this engine.',acpConflict:'Another compaction backend was detected. Disable the conflicting plugin first.',acpUnmanaged:'A preset or an older session revision is not managed by the built-in engine.',acpActivationFailed:'Backend switch failed. Check the effective profile and presets.',acpInvalidAdvanced:'Invalid advanced ACP settings. The last effective configuration was retained.',acpAdvancedWarning:'Keep the defaults unless you understand these options.',acpApplied:'Settings applied.',acpSuperseded:'Another edit superseded these settings.',acpSavedBlocked:'Settings saved, but the ACP engine could not activate as requested.',settingsDescription:'Configure DSH built-in ACP behavior. Advanced values are validated JSON, never executed.',acpLoading:'Loading ACP settings…',acpUnavailable:'Host does not serve context-monitor-acp settings or this connection is not writable.',acpEnabled:'Enable ACP',acpAutoNudge:'Automatic nudges',acpAutoTools:'Automatic tools',acpAutoCommand:'Automatic commands',acpAutoModel:'Automatic model context limit',acpLimit:'Model context limit (blank leaves field unset)',acpRetries:'Overflow retries',acpThresholds:'Nudge thresholds (min / max / emergency)',acpPreset:'Preset',acpCustom:'Custom',preserveHelp:'Keep more context; nudge near the limit.',relaxedHelp:'Nudge slightly earlier than preserve.',balancedHelp:'Default balance, using the original engine thresholds.',efficientHelp:'Prune more often to reduce token pressure.',aggressiveHelp:'Prune earlier and more often.',acpApply:'Apply',acpDiscard:'Discard draft',acpDirty:'Unapplied draft',acpSaved:'Settings written; waiting for Host effective status.',acpSaveFailed:'Apply failed or revision conflicted; draft preserved for review.',acpStatusUnavailable:'Runtime status unavailable; this does not mean Apply succeeded.',acpEffective:'Effective',acpBlocked:'Blocked',acpPending:'Switching / waiting for Host',acpPhase:'Host phase',acpReason:'Reason',acpAdvanced:'Advanced options',acpResetAdvanced:'Restore advanced defaults',acpCoreOverrides:'coreOverrides JSON',acpPrompts:'prompts JSON',acpInvalidJson:'Invalid JSON.',acpInvalidNumber:'Invalid number.',acpStatus:'Status',acpStatusUsage:'Show blocks and context usage; no arguments',acpCompressUsage:'Compress a range: start seq, end seq, summary',acpDecompressUsage:'Read a block: block ID [offset] [limit]',acpCompress:'Compress',acpDecompress:'Decompress',acpHint:'Submits through the Host /acp-prune command; selecting a menu item enters command mode.',builtInAcp:'Built-in ACP',thirdParty:'Third-party provider',acpRebase:'Keep draft and retry on latest revision',acpRequested:'Requested enabled',upstream:'Upstream projects',
       sessionBackend:'Compression backend', sessionBuiltin:'Built-in ACP (billion-context-dsh)', sessionStock:'DSH native compaction', sessionExternal:'External compaction backend', sessionSwitching:'Switching', sessionNone:'Not loaded for this session', sessionUnknown:'Not confirmed for this session', acpProfileScope:'These are profile-wide settings. See Context for the current session’s actual backend.', checkBackend:'Check again',
    };
    const css = `
.dcm{height:100%;min-height:0;overflow:auto;box-sizing:border-box;padding:24px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font-size:13px;line-height:1.6;container-type:inline-size}
.dcm *{box-sizing:border-box}.dcm-inner{max-width:1160px;margin:0 auto;display:flex;flex-direction:column;gap:18px}.dcm h2{font-size:23px;line-height:1.3;letter-spacing:-.4px;margin:0}.dcm h3{font-size:15px;line-height:1.4;margin:0;font-weight:600}.dcm p{margin:0}.dcm-muted{color:var(--dsw-alias-label-tertiary);font-size:12px}.dcm-header,.dcm-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.dcm-title{display:flex;gap:10px;align-items:center}.dcm-tag{border:1px solid var(--dsw-alias-border-l4);border-radius:20px;padding:2px 9px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dcm-card{padding:18px;border:1px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4));background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2));border-radius:16px;min-width:0}.dcm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.dcm-stat{border:1px solid var(--dsw-alias-border-l4);border-radius:12px;padding:14px;min-width:0;background:var(--dsw-alias-bg-layer-1)}.dcm-value{font-size:24px;font-weight:650;letter-spacing:-.5px;font-variant-numeric:tabular-nums;margin-top:6px;overflow-wrap:anywhere}.dcm-value small{font-size:12px;font-weight:400;letter-spacing:0;color:var(--dsw-alias-label-tertiary)}
.dcm button,.dcm select,.dcm input,.dcm textarea{font:inherit;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);min-height:34px}.dcm fieldset{border:0;padding:0;margin:0;min-width:0}.dcm legend{font-weight:600;margin:10px 0}.dcm-control{display:flex;align-items:center;gap:9px;min-height:36px}.dcm-control input[type=checkbox]{min-width:18px;flex:none;accent-color:var(--dsw-alias-state-business-primary)}.dcm-control-stack{align-items:stretch;flex-direction:column;gap:4px;min-width:min(100%,220px)}.dcm-control-stack input,.dcm-control-stack textarea,.dcm-control-stack select{width:100%;min-width:0;max-width:100%}.dcm-control-stack textarea{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}.dcm-control-row{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}.dcm-status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dcm-status-grid>div{overflow-wrap:anywhere;padding:10px;border:1px solid var(--dsw-alias-border-l4);border-radius:10px;min-width:0}.dcm-status-grid p{overflow-wrap:anywhere}.dcm-settings{height:auto;min-height:100%;overflow:auto}.dcm-settings .dcm-inner{max-width:960px}.dcm-settings fieldset{display:flex;flex-direction:column;gap:10px}.dcm-settings .dcm-bar{justify-content:flex-start}.dcm-settings .dcm-bar>div{margin-left:auto}@container(max-width:540px){.dcm-settings{padding:14px}.dcm-control-row>.dcm-control-stack{flex:1 1 100%}.dcm-settings .dcm-bar>span{flex:1 1 100%}.dcm-settings .dcm-bar>div{margin-left:0}}\n.dcm button,.dcm select,.dcm input{font:inherit;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);min-height:34px}.dcm button{cursor:pointer}.dcm button:disabled{opacity:.55;cursor:default}.dcm button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcm :is(button,select,input,summary):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.dcm input{min-width:140px;max-width:100%;flex:1}.dcm-filter{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.dcm-chart-block{margin:12px 0 6px}.dcm-chart-cap{text-align:right;margin-bottom:8px!important;overflow-wrap:anywhere}.dcm-chart-layout{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:10px;row-gap:6px;min-width:0}.dcm-yaxis{height:190px;min-width:5ch;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;font-size:11px;line-height:12px;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dcm-chart{display:block;width:100%;height:190px;min-width:0;overflow:visible}.dcm-chart path,.dcm-chart line{vector-effect:non-scaling-stroke}.dcm-chart-times{grid-column:2;display:flex;justify-content:space-between;gap:12px;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;min-width:0}.dcm-chart-times time{min-width:0;overflow-wrap:anywhere}.dcm-chart-times time:last-child{text-align:right}.dcm-input{stroke:var(--dsw-alias-state-business-primary);fill:none;stroke-width:2}.dcm-cached{stroke:none;fill:var(--dsw-alias-state-business-primary);fill-opacity:.22}.dcm-fold{stroke:var(--dsw-alias-state-error-primary);stroke-dasharray:4 4;opacity:.7}.dcm-axis{stroke:var(--dsw-alias-border-l4)}.dcm-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary)}.dcm-dot{display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--dsw-alias-state-business-primary);margin-right:6px}.dcm-dot.cache{background:var(--dsw-alias-state-business-primary);opacity:.22}.dcm-dot.fold{background:var(--dsw-alias-state-error-primary)}.dcm-meter{height:8px;border-radius:8px;overflow:hidden;background:var(--dsw-alias-border-l4);margin:12px 0 7px}.dcm-meter>span{height:100%;display:block;background:var(--dsw-alias-state-business-primary)}.dcm-meter[data-level=high]>span{background:var(--dsw-alias-state-error-primary)}.dcm-note{border-left:3px solid var(--dsw-alias-state-business-primary);padding:8px 12px;background:var(--dsw-alias-bg-layer-1);border-radius:0 8px 8px 0}.dcm-tablewrap{max-width:100%;overflow:auto}.dcm table{border-collapse:collapse;width:100%;white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums}.dcm th{color:var(--dsw-alias-label-tertiary);font-weight:500;text-align:left}.dcm th,.dcm td{padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l4);vertical-align:top}.dcm th:first-child,.dcm td:first-child{padding-left:0}.dcm-topic{white-space:normal;min-width:160px;max-width:260px;overflow-wrap:anywhere}.dcm code{font:11px ui-monospace,monospace;overflow-wrap:anywhere}.dcm-state{font-size:11px;color:var(--dsw-alias-label-secondary)}.dcm-state.active{color:var(--dsw-alias-state-success-primary)}.dcm-empty{padding:26px 0;text-align:center;color:var(--dsw-alias-label-tertiary)}.dcm details>summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary)}.dcm details>p{margin-top:10px}.dcm-spaced{margin-top:12px!important}.dcm-route{overflow-wrap:anywhere;word-break:break-word}.dcm-tiers{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.dcm-latest{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
/* Charts and tables must never size the shared column from their contents. */
.dcm{inline-size:100%;min-inline-size:0;max-inline-size:100%}
.dcm .dcm-inner{inline-size:100%;min-inline-size:0;display:grid;grid-template-columns:minmax(0,1fr)}
.dcm .dcm-inner>*{min-inline-size:0}
.dcm .dcm-inner>.dcm-card{inline-size:100%;max-inline-size:100%;justify-self:stretch}
.dcm .dcm-tablewrap{inline-size:100%;min-inline-size:0;max-inline-size:100%;overflow-x:auto}
.dcm .dcm-tablewrap>table{inline-size:100%;min-inline-size:38rem}
.dcm .dcm-chart-layout{max-inline-size:100%;min-inline-size:0}
.dcm .dcm-header,.dcm .dcm-bar,.dcm .dcm-note{min-inline-size:0;overflow-wrap:anywhere}
.dcm .dcm-header>div,.dcm .dcm-bar>p{min-inline-size:0}
.dcm-backendbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}
.dcm .dcm-backend[data-present="true"]{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-tertiary))}
@container(max-width:760px){.dcm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dcm-value{font-size:21px}}@container(max-width:440px){.dcm-grid{grid-template-columns:1fr 1fr}.dcm-card{padding:12px}.dcm-latest{grid-template-columns:1fr}.dcm-value{font-size:19px}.dcm-filter>*{width:100%}.dcm-chart-layout{column-gap:8px}}
`;
    const fmt = n => typeof n !== 'number' || !Number.isFinite(n) ? '—' : n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(Math.round(n));
    const pct = n => typeof n === 'number' && Number.isFinite(n) ? `${(n*100).toFixed(1)}%` : '—';
    const time = n => typeof n === 'number' ? new Date(n).toLocaleString('sv-SE') : '—';
    const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    function Chart({samples,blocks,capacity,ratio,t}) {
      if (!samples.length || (ratio && samples.every(s=>s.hit===null))) return h('p',{className:'dcm-empty'},t('noSamples'));
      // Axis text lives in HTML at its actual CSS font size. SVG text would
      // scale on phones while its fixed left gutter stays too narrow.
      const W=1000,H=190,L=0,R=0,T=6,B=6;
      const max=ratio?1:Math.max(1,...samples.map(s=>s.input),valid(capacity)?capacity:0)*1.04;
      const x=i=>L+(W-L-R)*i/Math.max(1,samples.length-1), y=v=>H-B-(H-T-B)*Math.min(max,Math.max(0,v))/max;
      const path=key=>{let open=false;return samples.map((s,i)=>{const v=s[key];if(!valid(v)){open=false;return ''}if(i>0&&(s.provider!==samples[i-1].provider||s.model!==samples[i-1].model))open=false;const cmd=open?'L':'M';open=true;return `${cmd}${x(i).toFixed(2)},${y(v).toFixed(2)}`}).join(' ')};
      const cachedArea = () => {
        const polygons = [];
        let segment = [];
        const close = () => {
          if (segment.length) {
            const first = segment[0], last = segment.at(-1);
            polygons.push(`M${x(first.index)},${y(0)} ${segment.map(p=>`L${x(p.index)},${y(p.value)}`).join(' ')} L${x(last.index)},${y(0)} Z`);
            segment = [];
          }
        };
        samples.forEach((sample,index) => {
          if (index > 0 && (sample.provider !== samples[index-1].provider || sample.model !== samples[index-1].model)) close();
          if (!valid(sample.read)) { close(); return; }
          segment.push({index,value:sample.read});
        });
        close();
        return polygons.join(' ');
      };
      const marks=blocks.filter(b=>b.checkpointSeq!==null&&b.checkpointSeq>=samples[0].seq&&b.checkpointSeq<=samples.at(-1).seq);
      const ticks=[1,.75,.5,.25,0].map(fraction=>max*fraction);
      const children=ticks.map((value,i)=>h('line',{key:`g${i}`,className:'dcm-axis',x1:L,x2:W-R,y1:y(value),y2:y(value)}));
      if(!ratio&&valid(capacity)&&capacity>0)children.push(h('line',{key:'cap',className:'dcm-fold',x1:L,x2:W-R,y1:y(capacity),y2:y(capacity)},h('title',null,`${t('capLegend')} ${fmt(capacity)}`)));
      marks.forEach(b=>{const next=samples.findIndex(s=>s.seq>=b.checkpointSeq);const px=x(Math.max(0,next));children.push(h('line',{key:`m${b.id}`,className:'dcm-fold',x1:px,x2:px,y1:T,y2:H-B},h('title',null,`${t('foldLegend')} ${b.ref||b.id} · ${time(b.time)}`)))});
      if(!ratio)children.push(h('path',{key:'cache',className:'dcm-cached',d:cachedArea()}));
      children.push(h('path',{key:'input',className:'dcm-input',d:path(ratio?'hit':'input')}));
      if(samples.length===1){const v=ratio?samples[0].hit:samples[0].input;if(valid(v))children.push(h('circle',{key:'one',cx:x(0),cy:y(v),r:3,fill:'var(--dsw-alias-state-business-primary)'}))}
      return h('div',{className:'dcm-chart-block'},
        !ratio&&valid(capacity)&&capacity>0?h('p',{className:'dcm-chart-cap dcm-muted'},`${t('capLegend')} ${fmt(capacity)}`):null,
        h('div',{className:'dcm-chart-layout'},
          h('div',{className:'dcm-yaxis','aria-hidden':true},ticks.map((value,i)=>h('span',{key:i},ratio?pct(value):fmt(value)))),
          h('svg',{className:'dcm-chart',viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',role:'img','aria-label':t(ratio?'cacheTrend':'trend')},h('title',null,t(ratio?'cacheTrend':'trend')),children),
          h('div',{className:'dcm-chart-times'},h('time',null,time(samples[0].time)),h('time',null,time(samples.at(-1).time)))
        )
      );
    }
    class Boundary extends React.Component {
      constructor(p){super(p);this.state={failed:false}}
      static getDerivedStateFromError(){return {failed:true}}
      render(){return this.state.failed?h('div',{className:'dcm',role:'status'},h('style',null,css),this.props.fallback):this.props.children}
    }
    return {
      inject:['slots','locale','configForms','commandUi','sessions','conversation','remote','remote.commands'],
      apply(ctx) {
        ctx.effect(()=>ctx.locale.register(NS,{zh,en}));
        const t=ctx.locale.bind(NS);
        async function readAcpStatus(signal=AbortSignal.timeout(5000)){
          try {
            const service=ctx.get('remote.contextMonitorAcp');
            if(service&&typeof service.status==='function')return Promise.resolve(service.status()).then(result=>result?.ok&&result.value?{kind:'ready',value:result.value}:{kind:'unavailable'}).catch(()=>({kind:'unavailable'}));
            const connection=ctx.get('connection');
            if(connection?.rpc?.call){const result=await connection.rpc.call('/api','contextMonitorAcp/status',{args:{}},signal);return result?.ok&&result.value?{kind:'ready',value:result.value}:{kind:'unavailable'}}
            return {kind:'unavailable'};
          } catch(_error) { return {kind:'unavailable'}; }
        }
        async function readSessionAcpStatus(sessionId,signal=AbortSignal.timeout(5000)){
           try {
             const connection=ctx.get('connection');
             if(!connection?.rpc?.call || typeof sessionId!=='string')return null;
             const result=await connection.rpc.call('/api','contextMonitorAcp/sessionStatus',{args:{sessionId}},signal);
             return result?.ok ? result.value : null;
           } catch { return null; }
         }
         const backendLabels=Object.freeze({builtin:'sessionBuiltin',stock:'sessionStock',external:'sessionExternal',switching:'sessionSwitching',none:'sessionNone',unknown:'sessionUnknown'});
          function backendPresentation(backend){
            return {
              label:typeof backend==='string'&&Object.hasOwn(backendLabels,backend)?backendLabels[backend]:backendLabels.unknown,
              detected:backend==='builtin'||backend==='stock'||backend==='external',
            };
          }
         function useFormSnapshot(form){
          return React.useSyncExternalStore(listener=>form.subscribe(listener),()=>form.getSnapshot(),()=>form.getSnapshot());
        }
        function AcpSettings(){
          const form=ctx.configForms.get('context-monitor-acp');
          const snapshot=useFormSnapshot(form);
          const accepted=snapshot.value?.acp&&typeof snapshot.value.acp==='object'&&!Array.isArray(snapshot.value.acp)?snapshot.value.acp:{};
          const [draft,setDraft]=React.useState(null),[draftRevision,setDraftRevision]=React.useState(null),[message,setMessage]=React.useState(''),[saving,setSaving]=React.useState(false),[runtime,setRuntime]=React.useState({kind:'loading'}),[pendingRevision,setPendingRevision]=React.useState(null);
          const statusEpoch=React.useRef(0);
           React.useEffect(()=>{let live=true;const refresh=()=>{const read=++statusEpoch.current;void readAcpStatus().then(value=>{if(live&&read===statusEpoch.current)setRuntime(value)})};refresh();const off=ctx.remote?.$on?.('commands/change',refresh);const off2=ctx.on('connection/reset',refresh);return()=>{live=false;off?.();off2?.()}},[snapshot.revision]);
          const current={...ACP_DEFAULTS,...accepted};
          const local=draft??{...current,coreOverridesText:JSON.stringify(current.coreOverrides??{},null,2),promptsText:JSON.stringify(current.prompts??{},null,2)};
          const preset=Object.entries(PRESETS).find(([,values])=>values.every((value,i)=>value===[local.nudgeMinContextLimitPct,local.nudgeMaxContextLimitPct,local.nudgeEmergencyThresholdPct][i]))?.[0]??'custom'; const dirty=draft!==null;
          const draftBase=()=>({...current,coreOverridesText:JSON.stringify(current.coreOverrides??{},null,2),promptsText:JSON.stringify(current.prompts??{},null,2)});
          const stage=update=>{if(draft===null)setDraftRevision(snapshot.revision);setDraft(old=>typeof update==='function'?update(old??draftBase()):update)};
          const setField=(key,value)=>{stage(old=>({...old,[key]:value}))};
          const usePreset=name=>{const values=PRESETS[name];stage(old=>({...old,nudgeMinContextLimitPct:values[0],nudgeMaxContextLimitPct:values[1],nudgeEmergencyThresholdPct:values[2]}))};
          const apply=async()=>{
            const min=Number(local.nudgeMinContextLimitPct),max=Number(local.nudgeMaxContextLimitPct),emergency=Number(local.nudgeEmergencyThresholdPct),retries=Number(local.maxOverflowRetries);
            if([local.nudgeMinContextLimitPct,local.nudgeMaxContextLimitPct,local.nudgeEmergencyThresholdPct,local.maxOverflowRetries].some(value=>value==='')||![min,max,emergency].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||min>max||max>emergency||!Number.isInteger(retries)||retries<0){setMessage(t('acpInvalidNumber'));return}
            let coreOverrides,prompts;
            try{coreOverrides=JSON.parse(local.coreOverridesText||'{}');prompts=JSON.parse(local.promptsText||'{}');if(!coreOverrides||typeof coreOverrides!=='object'||Array.isArray(coreOverrides)||!prompts||typeof prompts!=='object'||Array.isArray(prompts))throw Error()}catch(_error){setMessage(t('acpInvalidJson'));return}
            const value={...accepted,enabled:Boolean(local.enabled),nudgeMinContextLimitPct:min,nudgeMaxContextLimitPct:max,nudgeEmergencyThresholdPct:emergency,autoNudge:Boolean(local.autoNudge),autoTools:Boolean(local.autoTools),autoCommand:Boolean(local.autoCommand),autoModelContextLimit:Boolean(local.autoModelContextLimit),maxOverflowRetries:retries,coreOverrides,prompts};
            const limit=String(local.modelContextLimit??'').trim();if(limit!==''){const parsed=Number(limit);if(!Number.isSafeInteger(parsed)||parsed<=0){setMessage(t('acpInvalidNumber'));return}value.modelContextLimit=parsed}else delete value.modelContextLimit;
            if(typeof draftRevision!=='number'){setMessage(t('acpUnavailable'));return}
            setSaving(true);setMessage('');setPendingRevision(null);
            try{
              const ok=await form.mutate([{op:'set',path:['acp'],value}],draftRevision);
              if(!ok){setMessage(t('acpSaveFailed'));return}
              const latest=form.getSnapshot();
              if(!latest.value?.acp||JSON.stringify(stableJson(latest.value.acp))!==JSON.stringify(stableJson(value))){setMessage(t('acpSaveFailed'));return}
              setDraft(null);setDraftRevision(null);setPendingRevision(latest.revision);setRuntime({kind:'loading'});setMessage(t('acpPending'));
              let finalStatus={kind:'unavailable'};
              for(let i=0;i<8;i++){
                const read=++statusEpoch.current;
                 finalStatus=await readAcpStatus();
                 if(read!==statusEpoch.current)continue;
                 setRuntime(finalStatus);
                if(finalStatus.kind==='ready'&&(finalStatus.value.phase==='blocked'||finalStatus.value.configApplied===true))break;
                if(finalStatus.kind!=='ready')break;
                await new Promise(resolve=>setTimeout(resolve,400));
              }
              if(form.getSnapshot().revision!==latest.revision){setPendingRevision(null);setMessage(t('acpSuperseded'));return;}
               if(finalStatus.kind!=='ready')setMessage(t('acpStatusUnavailable'));
            }catch(_error){setPendingRevision(null);setMessage(t('acpSaveFailed'))}finally{setSaving(false)}
          };
          const status=runtime.kind==='ready'?runtime.value:null;
           React.useEffect(()=>{
             if(saving||pendingRevision===null)return;
             if(snapshot.revision!==pendingRevision){setPendingRevision(null);setMessage(t('acpSuperseded'));return;}
             if(status?.phase==='blocked'){setPendingRevision(null);setMessage(t('acpSavedBlocked'));return;}
             if(status?.configApplied===true){setPendingRevision(null);setMessage(t('acpApplied'));}
           },[pendingRevision,saving,snapshot.revision,status,t]);
           const reasonKeys={'external-compaction':'acpConflict','unmanaged-preset':'acpUnmanaged','loader-unavailable':'acpUnavailable','activation-failed':'acpActivationFailed','invalid-advanced-config':'acpInvalidAdvanced'};
           const reason=status?.reason?(reasonKeys[status.reason]?t(reasonKeys[status.reason]):t('acpBlocked')):'—';
          const bool=(key,label)=>h('label',{className:'dcm-control'},h('input',{type:'checkbox',checked:Boolean(local[key]),onChange:e=>setField(key,e.target.checked)}),h('span',null,label));
          const number=(key,label,step='1',minValue='0',maxValue)=>h('label',{className:'dcm-control dcm-control-stack'},h('span',null,label),h('input',{type:'number',step,min:minValue,...(maxValue?{max:maxValue}:{}),value:local[key]??'',onChange:e=>setField(key,e.target.value===''?'':Number(e.target.value))}));
          return h('div',{className:'dcm dcm-settings'},h('style',null,css),h('div',{className:'dcm-inner'},
            h('header',null,h('h2',null,t('settingsTitle')),h('p',{className:'dcm-muted'},t('settingsDescription')),h('p',{className:'dcm-muted'},t('acpProfileScope')),h('p',{role:'note',className:'dcm-note'},t('acpWarning')),h('p',{className:'dcm-muted'},t('upstream'),': ',h('a',{href:'https://github.com/ranxianglei/acp-kernel',target:'_blank',rel:'noreferrer'},'acp-kernel'),' · ',h('a',{href:'https://github.com/ranxianglei/billion-context',target:'_blank',rel:'noreferrer'},'billion-context'))),
            h('section',{className:'dcm-card'},
              h('div',{className:'dcm-status-grid'},
                h('div',null,h('strong',null,t('acpPhase')),h('p',null,status?.phase??t('acpStatusUnavailable'))),
                h('div',null,h('strong',null,t('acpRequested')),h('p',null,status?String(status.requestedEnabled):t('unknownValue'))),
                h('div',null,h('strong',null,t('acpEffective')),h('p',null,status?String(status.effectiveEnabled):t('unknownValue'))),
                h('div',null,h('strong',null,t('acpBlocked')),h('p',null,status?.phase==='switching'?t('acpPending'):reason))
              ),
              h('p',{className:'dcm-muted'},status?`${t('acpReason')}: ${reason} · r${status.revision}`:''),
            ),
            snapshot.status!=='ready'?h('p',{role:'status'},t(snapshot.status==='loading'?'acpLoading':'acpUnavailable')):null,
            h('fieldset',{disabled:saving||snapshot.status!=='ready'||!snapshot.writable},h('legend',null,t('settingsTitle')),
              bool('enabled',t('acpEnabled')),

              h('label',{className:'dcm-control dcm-control-stack'},h('span',null,t('acpPreset')),h('select',{value:preset,onChange:e=>e.target.value==='custom'?null:usePreset(e.target.value)},h('option',{value:'custom'},t('acpCustom')),...Object.keys(PRESETS).map(name=>h('option',{key:name,value:name},name)))),
              h('p',{className:'dcm-muted'},preset==='custom'?t('acpThresholds'):t(preset+'Help')),
              h('div',{className:'dcm-control-row'},number('nudgeMinContextLimitPct','Min','0.01','0','1'),number('nudgeMaxContextLimitPct','Max','0.01','0','1'),number('nudgeEmergencyThresholdPct','Emergency','0.01','0','1')),

              h('details',null,h('summary',null,t('acpAdvanced')),h('p',{className:'dcm-note'},t('acpAdvancedWarning')),h('button',{type:'button',onClick:()=>stage(old=>({...old,autoNudge:true,autoTools:true,autoCommand:true,autoModelContextLimit:true,modelContextLimit:'',maxOverflowRetries:1,coreOverridesText:'{}',promptsText:'{}'}))},t('acpResetAdvanced')),h('div',{className:'dcm-control-row'},bool('autoNudge',t('acpAutoNudge')),bool('autoTools',t('acpAutoTools')),bool('autoCommand',t('acpAutoCommand')),bool('autoModelContextLimit',t('acpAutoModel'))),number('modelContextLimit',t('acpLimit'),'1','1'),number('maxOverflowRetries',t('acpRetries'),'1','0'), h('label',{className:'dcm-control dcm-control-stack'},h('span',null,t('acpCoreOverrides')),h('textarea',{value:local.coreOverridesText,onChange:e=>setField('coreOverridesText',e.target.value),rows:5,spellCheck:false})),h('label',{className:'dcm-control dcm-control-stack'},h('span',null,t('acpPrompts')),h('textarea',{value:local.promptsText,onChange:e=>setField('promptsText',e.target.value),rows:5,spellCheck:false})))
            ),
            h('div',{className:'dcm-bar'},h('span',{role:'status',className:message.includes('失败')||message.includes('failed')?'dcm-note':'dcm-muted'},message|| (dirty?t('acpDirty'):'')),h('div',null,h('button',{type:'button',disabled:!dirty||saving,onClick:()=>{setDraft(null);setDraftRevision(null);setMessage('')}},t('acpDiscard')),message===t('acpSaveFailed')&&typeof snapshot.revision==='number'?h('button',{type:'button',disabled:saving,onClick:()=>{setDraftRevision(snapshot.revision);setMessage('')}},t('acpRebase')):null,' ',h('button',{type:'button',disabled:!dirty||saving||!snapshot.writable,onClick:apply},saving?t('acpPending'):t('acpApply'))))
          ));
        }
        function registerAcpCommands(){
           let live=true, epoch=0, active=false;
           const form=ctx.configForms.get(ACP_FORM);
           const refresh=()=>{
             const id=++epoch;
             void readAcpStatus().then(result=>{if(live&&id===epoch)active=result.kind==='ready'&&result.value.phase==='on'&&result.value.effectiveEnabled});
           };
           const available=session=>{
             const acp=form.getSnapshot().value?.acp;
             return active&&acp?.enabled===true&&acp?.autoCommand===true&&ctx.sessions.subagentAddress(session.sessionId)===undefined;
           };
           const commands=[['status','acpStatusUsage'],['compress','acpCompressUsage'],['decompress','acpDecompressUsage']];
           const disposers=commands.map(([verb,usage])=>ctx.commandUi.register({
             name:`acp-prune ${verb}`,description:()=>t(usage),available,
             ui:{kind:'action',run(session){
               if(!available(session))return;
               const binding=ctx.sessions.binding(session.sessionId);
               if(!binding)return;
               const input=ctx.conversation.input.for(binding.ctx);
               const state=input.state.getSnapshot();
               if(state.draft.trim()||state.attachmentIds.length)return;
               input.setDraft(`/acp-prune ${verb} `);
               input.focus();
             }},
           }));
           disposers.push(form.subscribe(refresh),ctx.remote.$on('commands/change',refresh),ctx.on('connection/reset',refresh));
           refresh();
           return()=>{live=false;for(const dispose of disposers)dispose?.();};
         }
         ctx.effect(registerAcpCommands);
         ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'context-monitor-acp',order:35,label:()=>t('settingsTitle'),locale:NS},AcpSettings));
        function Monitor(props){
          const t = props.t;
          const state=props.useProjection('localContextMonitor');
          const pressure=props.useProjection('contextPressure');
          const totals=props.useProjection('tokenUsage');
          const [range,setRange]=React.useState(600),[query,setQuery]=React.useState(''),[tier,setTier]=React.useState('all'),[limit,setLimit]=React.useState(50);
           const [backend,setBackend]=React.useState('unknown');
           const backendRequest=React.useRef(0);
           const refreshBackend=React.useCallback(async()=>{
             const id=++backendRequest.current;
             const result=await readSessionAcpStatus(props.sessionId);
             if(id===backendRequest.current)setBackend(result?.backend??'unknown');
           },[props.sessionId]);
           React.useEffect(()=>{
             const run=()=>void refreshBackend();
             const reload=()=>{setBackend('unknown');run();};
             const updateSession=id=>{if(id===props.sessionId)run();};
             const offs=[ctx.remote.$on('commands/change',run),ctx.remote.$on('api-session/added',summary=>updateSession(summary.sessionId)),ctx.remote.$on('api-session/removed',updateSession),ctx.remote.$on('agent-preset/selected',updateSession),ctx.on('connection/reset',reload)];
             run();
             return()=>{backendRequest.current++;for(const off of offs)off?.();};
           },[refreshBackend,props.sessionId]);
           const shownBackend=backendPresentation(backend);
          if(!state)return h('div',{className:'dcm',role:'status'},h('style',null,css),h('div',{className:'dcm-inner'},h('h2',null,t('title')),h('p',null,t('noProjection'))));
          const samples=state.samples.slice(-range),blocks=state.blocks,last=state.samples.at(-1);
          const capacity=pressure?.contextWindow??state.contextWindow;
          const projected=pressure?.projectedTokens;
          const occupancy=valid(projected)&&valid(capacity)&&capacity>0?projected/capacity:null;
          const reported=samples.filter(s=>s.read!==null),den=reported.reduce((n,s)=>n+s.input,0),hit=den>0?reported.reduce((n,s)=>n+s.read,0)/den:null;
          const sum=totals?totals.uncachedInputTokens+totals.cacheReadTokens+totals.cacheWriteTokens:null;
          const normalized=query.trim().toLocaleLowerCase();
          const filtered=blocks.filter(b=>(tier==='all'||(tier==='generic'?!b.tier:String(b.tier)===tier))&&(!normalized||`${b.id} ${b.ref??''} ${b.topic??''}`.toLocaleLowerCase().includes(normalized))).slice().reverse();
          const stats=[['requests',state.sampleCount],['totalInput',sum],['cacheRead',totals?.cacheReadTokens],['output',totals?.outputTokens]];
          const statusKey={resident:'resident',folded:'folded',unknown:'unknownStatus',uncommitted:'uncommitted'};
          const blockRows = filtered.slice(0,limit).map(b => {
            const names = b.parents.length ? b.parents.map(id => h('p',{key:id},h('code',null,blocks.find(p=>p.id===id)?.ref||id))) : '—';
            return h('tr',{key:b.id},
              h('td',{className:'dcm-topic'},h('strong',null,b.ref||t('genericBlock')),h('p',null,b.topic||'—'),h('code',null,b.id),h('p',{className:'dcm-muted'},time(b.time))),
              h('td',null,b.tier?`T${b.tier}`:'—'),
              h('td',null,`${b.start??'?'} … ${b.end??'?'}`,h('p',{className:'dcm-muted'},`${b.messages??'?'} nodes`)),
              h('td',null,`${fmt(b.originalTokens)} → ≈${fmt(b.summaryTokensEstimate)}`),
              h('td',null,names),
              h('td',null,h('span',{className:'dcm-state'},t(statusKey[b.status])),!b.closed?h('p',{className:'dcm-muted'},t('transactionOpen')):null,b.error?h('p',null,t('transactionError')):null)
            );
          });
          const blockTable = filtered.length ? h('div',{className:'dcm-tablewrap'},
            h('table',null,
              h('thead',null,h('tr',null,['block','tier','span','size','parents','state'].map(k=>h('th',{key:k,scope:'col'},t(k))))),
              h('tbody',null,blockRows)
            )
          ) : h('p',{className:'dcm-empty'},t('emptyFilter'));
          const blockFilters = h('div',{className:'dcm-filter'},
            h('input',{type:'search',value:query,'aria-label':t('search'),placeholder:t('search'),onChange:e=>{setQuery(e.target.value);setLimit(50)}}),
            h('select',{value:tier,'aria-label':t('tier'),onChange:e=>{setTier(e.target.value);setLimit(50)}},
              h('option',{value:'all'},t('all')),[1,2,3].map(n=>h('option',{key:n,value:String(n)},`T${n}`)),h('option',{value:'generic'},t('generic'))
            )
          );
          const blockBody = blocks.length ? h(React.Fragment,null,blockFilters,blockTable,
            filtered.length>limit?h('button',{className:'dcm-spaced',type:'button',onClick:()=>setLimit(n=>n+50)},t('more')):null
          ) : h('p',{className:'dcm-empty'},t('noBlocks'));
          return h('div',{className:'dcm'},h('style',null,css),h('div',{className:'dcm-inner'},
             h('header',{className:'dcm-header'},
               h('div',null,h('div',{className:'dcm-title'},h('h2',null,t('title')),h('span',{className:'dcm-tag'},t('readonly'))),h('p',{className:'dcm-muted'},t('subtitle'))),
               h('div',{className:'dcm-backendbar'},
                 h('p',{role:'status',className:'dcm-muted dcm-backend','data-present':shownBackend.detected},t('sessionBackend'),': ',t(shownBackend.label)),
                 h('button',{type:'button',onClick:refreshBackend},t('checkBackend')))),
            h('section',{className:'dcm-card'},h('div',{className:'dcm-grid'},stats.map(([key,value])=>h('div',{className:'dcm-stat',key},h('p',{className:'dcm-muted'},t(key)),h('div',{className:'dcm-value'},fmt(value))))),
              h('div',{className:'dcm-latest'},h('div',null,h('p',{className:'dcm-muted'},t('current')),h('div',{className:'dcm-value'},fmt(projected),' ',h('small',null,`/ ${fmt(capacity)}${occupancy!==null?` · ${pct(occupancy)}`:''}`)),h('div',{className:'dcm-meter','data-level':occupancy>=.85?'high':'normal',role:'meter','aria-label':t('current'),'aria-valuemin':0,'aria-valuemax':100,...(occupancy!==null?{'aria-valuenow':Math.min(100,occupancy*100)}:{})},h('span',{style:{width:occupancy===null?'0%':`${Math.min(100,occupancy*100)}%`}})),h('p',{className:'dcm-muted'},t('estimate'))),h('div',null,h('p',{className:'dcm-muted'},t('last')),h('div',{className:'dcm-value'},fmt(last?.input)),h('p',{className:'dcm-muted'},t('actual')),h('p',{className:'dcm-muted'},time(last?.time)))),h('p',{className:'dcm-muted dcm-spaced'},t('pressureNote')),h('p',{className:'dcm-muted'},t('historical'))),
            h('section',{className:'dcm-card'},h('div',{className:'dcm-bar'},h('h3',null,t('trend')),h('label',null,h('span',{className:'dcm-muted'},`${t('range')} `),h('select',{value:range,onChange:e=>setRange(Number(e.target.value))},[60,180,600].map(n=>h('option',{key:n,value:n},t(`recent${n}`)))))),h(Chart,{samples,blocks,capacity,ratio:false,t}),h('div',{className:'dcm-legend'},['inputLegend','cacheLegend','foldLegend'].map((key,i)=>h('span',{key},h('i',{className:`dcm-dot ${i===1?'cache':i===2?'fold':''}`}),t(key)))),h('p',{className:'dcm-muted dcm-spaced'},t('sampleNote'))),
            h('section',{className:'dcm-card'},h('div',{className:'dcm-bar'},h('h3',null,t('cacheTrend')),h('span',{className:'dcm-tag'},`${t('hit')} ${pct(hit)}`)),h(Chart,{samples,blocks,ratio:true,t}),h('p',{className:'dcm-muted'},t('ratioNote')),
              h('details',{className:'dcm-spaced'},h('summary',null,t('trendData')),h('div',{className:'dcm-tablewrap'},h('table',null,h('thead',null,h('tr',null,['seq','time','input','cache','sampleHit','route'].map(k=>h('th',{key:k,scope:'col'},t(k))))),h('tbody',null,samples.slice(-50).reverse().map(s=>h('tr',{key:s.seq},h('td',null,s.seq),h('td',null,time(s.time)),h('td',null,fmt(s.input)),h('td',null,fmt(s.read)),h('td',null,pct(s.hit)),h('td',null,`${s.provider??'—'}/${s.model??'—'}`)))))))),
            h('section',{className:'dcm-card'},h('div',{className:'dcm-bar'},h('h3',null,t('structure')),h('span',{className:'dcm-muted'},`${t('records')}: ${state.blockCount}`)),
              h('div',{className:'dcm-tiers'},[1,2,3].map(n=>h('span',{className:'dcm-tag',key:n},`T${n} · ${blocks.filter(b=>b.tier===n).length}`)),h('span',{className:'dcm-muted'},`${t('resident')}: ${blocks.filter(b=>b.status==='resident').length}`)),
              state.malformedLedgers>0?h('p',{className:'dcm-note'},t('unknownLedger')):null,
              blockBody,
              h('p',{className:'dcm-muted dcm-spaced'},t('sizeNote'))),
            state.droppedSamples||state.droppedBlocks?h('p',{className:'dcm-note'},t('partial')):null,
            h('details',{className:'dcm-card'},h('summary',null,t('method')),h('p',null,t('methodText')))
          ));
        }
        function View(props){return h(Boundary,{key:props.sessionId,fallback:t('noProjection')},h(Monitor,props))}
        ctx.slots.inject('conversation.view',()=>ctx.slots.register({name:'conversation.view',id:'local-context-monitor',order:35,label:()=>t('tab'),locale:NS},View));
      },
    };
  },
});
