# dsh-session-log-repair

修一个很坑的 DSH 故障：**某个会话（比如 QQ 桥用的那个）突然发不出消息**，桥接侧只显示

```
⚠️ 消息未被接受：（含敏感信息，已隐藏）
```

那句「含敏感信息」是**误导**——它只是把真正的错误脱敏了。真实原因藏在 DSH 侧：

```
stored session "session-xxxx" is corrupt:
  corrupt Zstandard session log: first frame is not exactly one header line
  format v4 message requires a producer-owned source kind
  system/message does not match an open turn and step
  message must have model source
```

## 怎么会坏

上下文**压缩（compaction）**把整份会话日志重写成了**一个 zstd 帧**，并且弄丢了 `turn/step` 边界与消息的 `source`。DSH 的 v4 格式要求：

- 每帧**恰好一行**（第一帧只有 header）
- `user/message` 必须有 producer-owned 的 `source`（如 `{kind:'user', rpcId}`）
- `system/message` 必须在**打开的** turn/step 内（即 `turn/start` → `step/start` 之后）
- `assistant/message` 的 `message.source` 必须带 `provider` / `model`（正常还有 `replayState`）

任一条不满足，会话就再也 resume 不了，而桥接只会看到那句被脱敏的提示。

## 怎么修

```bash
# 1) 先诊断（只读，不改文件）
node repair-session-log.mjs "<DSH_HOME>/sessions/<workspace>/<session-id>/session.v4.jsonl.zstd"

# 2) 修复（自动备份为 *.bak-<时间戳>）
node repair-session-log.mjs "<...session.v4.jsonl.zstd>" --fix

# 3) 让新日志生效：重启 DSH；只修 QQ 会话时重启桥就够
```

修复做的事：按 v4 状态机重建最小合法骨架 —

```
session → 设置类事件 → session/title → turn/start → step/start
        → system/message → user/message →（合法的 assistant/message）
        → step/end → turn/end
```

一行一帧重新写入。补不全的 `assistant/message`（缺 provider/model）会被丢弃并明确报告——通常是「断线说明」这类一次性内容。

## 会丢什么

- 只保留**一条** turn 骨架，压缩后的系统摘要（`system/message`）内容**保留**
- 无法补全的 assistant 消息会被丢弃
- 原始文件永远先备份，随时可以拿回来

## 已知复发

压缩是 DSH 自己做的，下次压缩仍可能再次写坏。如果又出现同样症状：

1. 用本脚本 `--fix` 再修一次
2. 或者把那个 QQ 会话的绑定换成新会话（`/api/socialV2/reset`），代价是丢上下文

## 环境

- Node 18+（只用内置 `node:zlib` 的 zstd 支持，需要 Node 22+；Node 24 实测可用）
- 无需任何第三方依赖，不需要联网
