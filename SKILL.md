---
name: dsh-music-listen-together
description: "Use when making a DSH instance (Windows desktop) \"listen along\" with the user's music: show the current track from Windows SMTC or the in-DSH NetEase player, remote-control it from chat or a floating card, load the user's own NetEase playlists, and let the QQ bridge comment on song changes. Covers the plugin, the dsh-music patches, the NetEase cookie extraction, the QQ bridge hooks, and their pitfalls."
whenToUse: "用户想让 DSH（或它的 QQ 机器人）知道\"我在听什么\"、能切歌、能就换歌点评；或听歌链路上的 SMTC/白名单/编码问题需要排查。"
---
# 一起听（DSH + Windows SMTC + QQ 桥）

把「用户电脑上正在放的音乐」接到 DSH：**看得见 → 控得动 → 聊得上**。
本机实测环境：Windows + DSH 桌面版 0.2.1-rc.3 + 网易云客户端 + qq-bridge（reserved2）。

## 四条腿

| 组件 | 干什么 | 在哪里 |
|---|---|---|
| `dsh-listen-together` 插件 | 读 SMTC、遥控、给模型 `listen_now`、闸门与冷却 | `~/.dsh/profiles/<p>/node_modules/dsh-listen-together` |
| `dsh-MusicPlayer` 修补 | 浮窗里放歌 / 改遥控 / 我的歌单 / `remote_*` | `…/@dsh-external/dsh-music` |
| 网易云 cookie | 读账号歌单、解锁完整曲 | `~/.dsh/music-cookie.txt` |
| QQ 桥钩子 | 换歌唤醒 + 允许 `listen_now` + 提示词 | `qq-bridge/src/bridge.js`、`qq-agent-presets/qq-tool-restrict.mjs` |

## 一、SMTC 桥（host 侧的命脉）

`smtc.ps1` 是一条**长命进程**，每秒往 stdout 打一行 JSON；Node 逐行 `JSON.parse`。要点：

1. **必须直接写 UTF-8 字节**。PowerShell 的 stdout 在管道里默认 UTF-16，中文歌名会碎：
   ```powershell
   $stdout = [Console]::OpenStandardOutput()
   $bytes = [System.Text.Encoding]::UTF8.GetBytes($json + "`n")
   $stdout.Write($bytes, 0, $bytes.Length); $stdout.Flush()
   ```
   靠 `[Console]::Out.WriteLine` 一定翻车。
2. **ps1 保持纯 ASCII、无 BOM**：Windows PowerShell 5.1 会按 ANSI 读无 BOM 的 UTF-8，中文注释能直接把它读成语法错误。
3. `GetPlaybackInfo().PlaybackStatus` 的 `ToString()` 是 `Playing`（PascalCase），比较前统一 `toUpperCase()`。
4. WinRT 异步要 `AsTask` + `MakeGenericMethod`；**显式传结果类型**，不要靠 `GenericTypeArguments`。
5. 封面：网易云报 `thumb=true` 但流是 0 字节，cast 到 `IRandomAccessStreamWithContentType` 会失败 —— 外部播放器这条路**放弃封面**，显示 ♪。DSH 播放器那条路有 URL，能显示。
6. 进度：网易云不报 timeline（`pos/end = 0`、`canSeek=false`）→ 只能显示"正在播放"。
7. 控制：`canPause/canNext/canPrev` 为 true 时可遥控；用一次性进程调 `TryPlayAsync/TryPauseAsync/TrySkipNextAsync/TrySkipPreviousAsync`。

宿主侧：`spawn('powershell.exe', [... '-File', script])`，`stdio:['ignore','pipe','pipe']`，子进程死了 3 秒后重连，超过 12 秒没有新样本就当"没在放"。

## 二、listen 插件表面

```
GET  /dsh-listen/now          合并后的「正在播放」（DSH 播放器优先 → SMTC 兜底）
GET  /dsh-listen/cover        SMTC 缩略图（落盘后回吐，多数拿不到）
GET  /dsh-listen/img?u=…      网易云封面代理（绕防盗链）
POST /dsh-listen/control      {action: play|pause|next|prev|toggle}
GET/POST /dsh-listen/config   换歌评论参数
POST /dsh-listen/comment-now  立刻让 QQ 那边评一句（绕过概率与冷却，调试用）
工具 listen_now                给模型的一句话
```

客户端两块 UI：
- `conversation.input.dock`（输入框上方）：「正在听」窄条 —— 封面/歌名/歌手/进度 + 跟随播放状态跳的小柱子。**没有真波形**（SMTC 不给音频），别假装。
- `settings.section`（设置页）：「一起听」参数页，写 `~/.dsh/listen-together.json`。

## 三、网易云 cookie（自动取，别让用户手抄）

网易云桌面客户端是 CEF：
1. cookie 库：`%LOCALAPPDATA%\NetEase\CloudMusic\webapp91x64\Cookies`（SQLite，运行时被锁 → 用 `FileShare.ReadWrite` 拷一份）
2. key：同目录 `LocalPrefs.json` 的 `os_crypt.encrypted_key`（base64，前 5 字节是 `DPAPI`）→ `[System.Security.Cryptography.ProtectedData]::Unprotect`（**先 `Add-Type -AssemblyName System.Security`**）
3. 解密：`v10` + AES-256-GCM（IV 前 12B，tag 末 16B）
4. 明文**就是 cookie 值本身**（`MUSIC_U`/`__csrf` 本来就是 hex 串），**不要再 hex 解码**
5. 拼成 `MUSIC_U=…; __csrf=…; os=pc; …` 写 `~/.dsh/music-cookie.txt`（UTF-8 **无 BOM**）

验证：`GET https://music.163.com/api/nuser/account/get` 带 cookie → `profile.nickname`。
**weapi 会返回空体**（上游协议变了）→ 账号/歌单一律走公共接口：`/api/nuser/account/get`、`/api/user/playlist?uid=…&limit=1000`。

## 四、dsh-MusicPlayer 的三处必修

1. **`defineTool` 缺失**：桌面 profile `autoInstallPeers: false`，`@deepseek-ai/*` 装不进来，`import { defineTool }` 让整条 row 不激活。放本地 shim `node_modules/@deepseek-ai/dsh-tools/`（只实现 defineTool：参数 map → object 根 JSON Schema、透传 execute/output）。
2. **版本闸门**：它声明 `dsh-tools: ^0.1.0-rc.6`，运行时 0.2.1-rc.3 → `plugin_manager` 判 `incompatible-version`。放宽成 `>=0.1.0-rc.6`。
3. **`file:` 安装是拷贝不是链接**：改源码后要手动同步到 profile 的 `node_modules`，再 `set_plugin include:<id> enabled=false → true` 重新装配。

## 五、把浮窗变成「网易云遥控器 / 双模式」

- 数据源：`/dsh-music/state` → `/dsh-listen/now`（映射成 `{smtc:true, queue:[{title,artist,cover}], index:0, playing, app}``）
- 按钮：`/dsh-music/command` → `POST /dsh-listen/control`
- **必须给 `<audio>` 加守卫**：`if (state.smtc) { audio.pause(); return }`，否则本地队列会和网易云双重出声
- 遥控模式下用 CSS 隐藏 `.dshm-body/.dsh-search/.dsh-list`，另画一组 ⏮⏯⏭；再加一个 `⇄ 切回本地播放器` 的开关（用 ref 存模式，避免轮询闭包拿到旧值）
- 给 `music` 工具加 `remote_play|remote_pause|remote_next|remote_prev|remote_toggle`，让它能戳系统播放器

## 六、QQ 桥钩子（三板斧）

1. **提示词每轮重建**：人格是会话创建时快照，改人格文件对老会话无效；要影响老会话，就改 `buildWakePromptV2` 里那条永远会在的 `musicLine`（"listen_now 存在且可调，聊到歌先调它"）。
2. **`reason: 'music'` 唤醒**：`POST /api/socialV2/wake?token=<console-token>`，body `{key, reason:'music', song:{title,artist}}`；桥里用模块级 `Map` 暂存歌名，`buildWakePromptV2` 的 music 分支用完即删。
3. **执行期白名单**：`qq-agent-presets/qq-tool-restrict.mjs` 的 `ctx.tools.guard` 会拒掉一切不在 `SAFE_EXACT` / `SAFE_PREFIXES` / `PRIVATE_ONLY_TOOLS` 里的工具 —— 把 `listen_now` 加进 `PRIVATE_ONLY_TOOLS`（只给绑定的管理员私聊）。守卫按会话重装，改完**下一轮就生效**，不必重启 DSH。

`/api/*` 需要控制台令牌：`?token=` 或 `x-console-token` 头，令牌在 `qq-bridge/state/console-token`。

## 七、换歌自动评论（参数可改）

`~/.dsh/listen-together.json`：

```json
{ "enabled": true, "probability": 0.3, "cooldownMin": 10,
  "targetKey": "private:<QQ号>", "onlyWhenPlaying": true,
  "bridgeUrl": "http://127.0.0.1:3100",
  "tokenFile": "…/qq-bridge/state/console-token" }
```

判定顺序：**第一次看到的歌只登记不评** → 换歌 → 冷却到 → 掷概率 → 调桥唤醒。
冷却按"上次开口"算，中间切十首也只算一次。

## 八、验证清单

1. `node -e "fetch('http://127.0.0.1:3080/dsh-listen/now').then(r=>r.json()).then(console.log)"` → 有 title/artist/app。
2. 遥控：`POST /dsh-listen/control {action:'pause'}` → 歌真的停；再 `play` 恢复。
3. `POST /dsh-listen/comment-now` → 桥日志出现 `唤醒 <key>（music）`，`tool-calls.jsonl` 里 `listen_now ok:true`，随后 `qq_send_message ok:true`。
4. 设置页：DSH 设置 →「一起听」→ 改参数 → 保存 → 再 GET `/dsh-listen/config` 核对。

## 九、翻过的坑（速查）

| 症状 | 原因 |
|---|---|
| 中文歌名乱码 / JSON 解析失败 | PowerShell 管道 UTF-16 |
| ps1 报语法错但看不出问题 | 无 BOM UTF-8 被按 ANSI 读 |
| 一直显示"暂停着" | `Playing` 大小写 |
| 配置读不出来 | json 带 BOM（`readConfig` 必须 strip `\uFEFF`） |
| 装完不生效 | `file:` 安装是拷贝；改源码要同步 |
| 覆盖 client.js 失败 | 文件被 DSH 占用，重启后或换路径再拷 |
| 工具被拒"不在 QQ 桥接白名单内" | `qq-tool-restrict.mjs` 执行期白名单 |
| 双重出声 | 遥控模式没 pause 本地 `<audio>` |

## 十、回滚

- 插件：`plugin_manager remove_bundle dsh-listen-together` / `@dsh-external/dsh-music`
- 桥：git 回退或还原备份的 `bridge.js`、`qq-tool-restrict.mjs`
- cookie：删 `~/.dsh/music-cookie.txt` 即退回游客
