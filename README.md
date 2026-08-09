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
| [`MultiAgentProjectGuide`](MultiAgentProjectGuide/SKILL.md) | 协调多智能体开发、审查、项目日志、GitHub、CI、部署和交接 |

## TRAE 安装

TRAE 可直接导入 Open Agent Skills 格式：

1. 打开 `Settings` → `Rule & Skills` → `Skills` → `Create`。
2. 选择目标目录中的 `SKILL.md`。
3. 首次显式调用该 Skill，确认安装和触发行为。

也可以使用各 Skill 自带的安装脚本复制到项目 `.agents/skills` 目录。
