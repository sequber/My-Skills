# dsh-music-listen-together

一个 DSH 技能：让 DSH（以及它的 QQ 机器人）和用户的电脑「一起听歌」——
看见正在播放（Windows SMTC / DSH 内置播放器）、遥控播放、读取账号歌单、换歌时点评。

## 装

把 `SKILL.md` 放进任意一个 DSH 技能根目录，例如：

- 用户级：`~/.dsh/skills/dsh-music-listen-together/SKILL.md`
- 项目级：`<workspace>/.dsh/skills/dsh-music-listen-together/SKILL.md`

然后在 DSH 里 `skill` 工具按名字调用即可。

## 内容

SKILL.md 里覆盖：SMTC 桥（含 UTF-16/编码坑）、listen 插件接口、网易云 cookie 的
DPAPI + AES-GCM 提取、dsh-MusicPlayer 的三处必修、遥控器改造、QQ 桥的三个钩子
（提示词 / reason=music 唤醒 / 执行期白名单）、换歌自动评论参数、验证清单与回滚。

## 许可

MIT