# PHX Light Skill

分析二次元 / Cosplay / 动漫风摄影参考图的布光：反推每一盏灯的光色、光向、光质、附件与作用，以及它对画面黑白灰层次的影响，输出可复刻的简洁版或具体版布光分析；可按需生成极简光位图。

适用于：用户上传角色摄影图并要求「分析布光 / 分析灯光 / 这图怎么打光」等场景。

## 文件结构

- `SKILL.md` — 技能入口与核心规则
- `references/` — 分析框架、判光线索库、光位图规范、迭代记录
- `agents/openai.yaml` — 界面展示与调用配置

## 安装（Codex 用户）

把整个 `phx-light-skill` 文件夹放进你的 Codex 技能目录：

- Windows: `%USERPROFILE%\.codex\skills\phx-light-skill`
- macOS / Linux: `~/.codex/skills/phx-light-skill`

下载方式任选其一：

```bash
# 方式一：Git 克隆
git clone https://github.com/sequber/phx-light-skill.git
```

或在 GitHub 仓库页面点击 `Code` → `Download ZIP`，解压后按上面的路径放入技能目录。

放入后重启 Codex（或新开对话），技能即被识别。

## 使用

在 Codex 对话中上传动漫 / Cosplay 摄影图，然后说「分析这张图的布光」。该技能允许隐式调用，也可以显式使用 `$phx-light-skill`。

## 适用边界

面向二次元 / ACG 风格摄影（Cosplay、动漫风写真、角色氛围照）。普通纪实或产品摄影若用户明确要求分析也可套用，但二次元专项要点不强制。
