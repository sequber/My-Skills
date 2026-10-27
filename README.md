# My Skills

个人的 skill 仓库：**每个 skill 一个目录**，统一放在 `skills/<name>/` 下，和别的 skill 同级。

新的 skill 也往这里加——仓库就是唯一的存储点。

## 约定

- 目录名 = skill 的 `name`（kebab-case）
- 每个目录至少有一个 `SKILL.md`，开头是 YAML frontmatter：

  ```yaml
  ---
  name: <skill-name>
  description: <它做什么 + 什么时候该用它>
  ---
  ```

- 额外资料放 `references/`；可执行脚本放 `scripts/`；需要图形资源时放 `assets/`
- 一个 skill 一个提交，提交信息写清 skill 名（例：`feat: 新增 phx-light-skill`）

## 目录

| skill | 用途 |
| --- | --- |
| [`dsh-music-listen-together`](skills/dsh-music-listen-together/) | 让 DSH（及 QQ 机器人）和你的电脑「一起听歌」：读 Windows SMTC 当前播放、遥控播放器、读网易云账号歌单、换歌自动点评；含编码/白名单/安装坑的完整排障记录 |
| [`phx-light-skill`](skills/phx-light-skill/) | 二次元 / Cosplay / 动漫风摄影的布光逆向工程：从参考图反推每盏灯的光色、光向、光质、附件，以及它对画面黑白灰的影响，输出可复刻方案（可按需出极简光位图） |

## 怎么用

- **DSH**：把某个 skill 目录放到技能根目录（用户级 `~/.dsh/skills/<name>/`，或项目级 `<workspace>/.dsh/skills/<name>/`），DSH 会自动发现并按 `description` 路由。
- **Codex**：仓库里的 `agents/openai.yaml` 提供 Codex 侧的界面元数据（见 `skills/phx-light-skill/agents/`）。
