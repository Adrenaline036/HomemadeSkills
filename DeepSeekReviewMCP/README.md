# DeepSeekReviewMCP

`MultiAgentProjectGuide` 的无凭据、用户级 DeepSeek 只读审查 MCP companion runtime。它固定使用 DeepSeek V4 Flash，提供 `warm_review_context` 与 `review_candidate`，每次工具调用只发送一次 Provider 请求且不自动重试。

v3.2.1 在 v3.1 审查语义上增加跨进程 generation registry，并放宽结构化 finding 的详细证据字段上限：缓存身份只取决于模型与精确稳定前缀，不取决于审查门、交付版本或对话。内建通用义务被固定在稳定前缀，动态后缀只携带本门任务义务与候选证据。首次预热前先用计划中的第一个动态包做本地比例/obligation预检；一次真实预热后，同一generation在其他MCP进程再次调用预热只返回`CACHE_WARMUP_REUSED`且Provider请求为0。registry仅在用户级state目录保存哈希、时间、脱敏响应身份、用量累计和状态，不保存提示词、候选、凭据或项目内容。

finding 仍必须绑定调用方声明或内建的 obligation，给出具体反例或可达代码路径；自相矛盾、搜索过程、未声明的新规范、重复根因和超长字段会 fail closed。API key 不在本目录、项目镜像或 Git 中，仍只由本机 DPAPI launcher 注入。

安装或更新：

```powershell
& '.\install-local.ps1'
```

安装器先运行纯 Node 合同测试，在 pending 目录执行锁定依赖安装和语法检查，再备份并替换 `%USERPROFILE%\.codex\mcp\deepseek-review-worker`。若 Windows 上当前 MCP 进程锁住工作目录，安装器仅在依赖锁完全相同时备份旧 worker 并原子替换源码/清单；新进程加载新版本，当前旧进程不被中途切换。它不修改 Codex MCP 配置、凭据、项目代码或 Git 状态。

开发校验：

```powershell
npm test
node --check '.\review-server.mjs'
```

经明确授权后，可运行真实多门验收（会产生 DeepSeek API 费用，输出目录必须尚不存在）：

```powershell
node '.\acceptance\multi-gate-live.mjs' --allow-live '<new-evidence-directory>'
```

该验收以不同进程模拟不同对话，覆盖两个交付版本的 Phase 0、RED、含缺陷 GREEN、修正 GREEN 和 final；重复预热调用必须为本地复用且 Provider 请求数为 0。每个正式审查及包含一次冷预热的整代累计命中率均须不低于 85%。

修改 model、system prompt、消息排序或 stable-context bytes 会改变缓存前缀，必须建立新 generation 并重新冷预热。新审查门、新交付版本或新对话在前缀未变时不得重新付费预热。缓存验收只认 Provider 返回的 hit/miss usage；registry复用证明“本地没有再次预热”，不替代正式审查返回的真实命中率。
