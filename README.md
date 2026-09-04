# HomemadeSkills

个人维护的可复用 Agent Skills 集合。

## 目录约定

- 每个 Skill 使用一个顶层目录。
- GitHub 目录使用 PascalCase（大驼峰）命名，例如 `MultiAgentProjectGuide`。
- Agent Skills 的 `SKILL.md` frontmatter 可继续使用标准兼容名称，例如 `guide-multi-agent-project`。
- 私有协作记录、测试输出、压缩包和本机配置只保存在被忽略的 `local/`、`work/`、`outputs/` 或 `dist/` 中。

## Skills

| 目录 | 用途 |
|---|---|
| [`FontsReader`](FontsReader/SKILL.md) | 只读审计动画 ASS/SSA 字幕并精确收集实际使用的字体，生成可二次加工的系列字体文件夹、清单和校验值 |
| [`MultiAgentProjectGuide`](MultiAgentProjectGuide/SKILL.md) | 协调多智能体开发、审查、项目日志、GitHub、CI、部署和交接 |

## Companion runtimes

| 目录 | 用途 |
|---|---|
| [`DeepSeekReviewMCP`](DeepSeekReviewMCP/README.md) | DeepSeek V4 Flash 只读审查 MCP：项目级 generation 一次预热与跨对话复用、显式义务绑定、结构与语义校验、Provider 用量闭合及零重试 |

## MultiAgentProjectGuide 标准部署

- Codex 用户级 Skill 安装在 `%USERPROFILE%\.codex\skills\guide-multi-agent-project`；需要项目内规则发现时，再将同一发布内容镜像到项目的 `.agents\skills\MultiAgentProjectGuide`。
- `DeepSeekReviewMCP/` 保存可公开复现的无凭据运行时源码、离线测试和安装器；活动 MCP 配置、DPAPI 凭据容器、Provider 返回与本机安装结果仍只属于用户级运行时，不复制进项目或 Git 仓库。
- Windows 适配器使用一个固定的 DPAPI 加密凭据容器作为唯一凭据来源；环境变量、`.env`、替代路径和旧 key 备份不作为回退。
- 本机 DeepSeek MCP 只暴露稳定上下文预热和候选审查两个专用工具；一次项目级 generation 冷预热后，用户级 registry 以稳定前缀哈希跨审查门、交付版本、对话和 MCP 进程抑制重复预热。固定通用义务进入稳定前缀，动态后缀只保留本门任务义务与候选证据。消息排序、V4 Flash、义务合并、紧凑 JSON 的结构与语义校验、请求计数和零重试由适配器统一执行，不再使用项目侧请求编译器或 LOAD ACK。合法 JSON、HTTP 200 或非空文本本身都不代表有效审查。
- 缓存命中以每次 Provider 响应中的 usage 字段为即时证据；新稳定上下文先显式预热一次，随后审查目标命中率不低于 85%。平台 Usage/账单可能稍后刷新，最终费用以同一 API key、UTC 时间段的导出账单对账。
- 本机 MCP 与各项目 Skill 镜像是两个层次：更新 Skill 不会复制、读取或公开 API key；更新 MCP/凭据也不会自动修改项目代码。

## TRAE 安装

TRAE 可直接导入 Open Agent Skills 格式：

1. 打开 `Settings` → `Rule & Skills` → `Skills` → `Create`。
2. 选择目标目录中的 `SKILL.md`。
3. 首次显式调用该 Skill，确认安装和触发行为。

也可以使用各 Skill 自带的安装脚本复制到项目 `.agents/skills` 目录。
