#!/usr/bin/env node
/**
 * DSH v4 会话日志修复器（Windows / 跨平台 Node 18+，只用内置模块）
 *
 * 症状：某个会话突然发不出消息，桥接显示
 *   ⚠️ 消息未被接受：（含敏感信息，已隐藏）
 * 真实原因（常被这句遮掩）：DSH 恢复会话时报
 *   corrupt Zstandard session log: first frame is not exactly one header line
 *   format v4 message requires a producer-owned source kind
 *   system/message does not match an open turn and step
 *   message must have model source
 *
 * 成因：上下文压缩把整份日志重写成了一个 zstd 帧，并且丢了 turn/step 边界与
 * message.source，导致 v4 状态机校验失败，会话从此无法 resume。
 *
 * 用法：
 *   node repair-session-log.mjs <session.v4.jsonl.zstd>          # 只看诊断
 *   node repair-session-log.mjs <file> --fix                     # 修复（先备份）
 *
 * 修复策略：按 v4 状态机重建最小合法骨架
 *   session → 设置类事件 → session/title → turn/start → step/start
 *   → system/message → user/message →（合法的 assistant/message）
 *   → step/end → turn/end
 * 无法补全的 assistant/message（缺 provider/model/replayState）会被丢弃并报告。
 * 原文件始终先另存为 *.bak-<时间戳>。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import zlib from 'node:zlib'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]) // zstd frame magic
const SETTINGS = ['permission/preset', 'sandbox/mode', 'approval/policy', 'subagent/model-selection-policy', 'agent-preset/selected']

function frameOffsets(buf) {
  const offsets = []
  let i = 0
  for (;;) {
    const at = buf.indexOf(MAGIC, i)
    if (at < 0) break
    offsets.push(at)
    i = at + 4
  }
  return offsets
}

function decode(file) {
  const buf = readFileSync(file)
  const offsets = frameOffsets(buf)
  const events = []
  const bad = []
  for (let n = 0; n < offsets.length; n++) {
    const end = n + 1 < offsets.length ? offsets[n + 1] : buf.length
    try {
      const text = zlib.zstdDecompressSync(buf.subarray(offsets[n], end)).toString('utf8')
      for (const line of text.split('\n')) {
        if (line.trim() === '') continue
        events.push(JSON.parse(line))
      }
    } catch (error) {
      bad.push({ frame: n, error: error.message })
    }
  }
  return { frames: offsets.length, events, bad }
}

function diagnose(file) {
  const { frames, events, bad } = decode(file)
  console.log(`file    : ${file}`)
  console.log(`frames  : ${frames}${bad.length ? ` (${bad.length} undecodable)` : ''}`)
  console.log(`events  : ${events.length}`)
  const problems = []
  if (frames === 1 && events.length > 1) problems.push('单帧塞了多行（DSH 要求第一帧只有 header 行）')
  let openTurn = null
  let openStep = null
  for (const event of events) {
    const d = event.data ?? {}
    if (event.type === 'turn/start') openTurn = d.turn
    if (event.type === 'step/start') openStep = d.step
    if (event.type === 'step/end' || event.type === 'turn/end') {
      openStep = null
      if (event.type === 'turn/end') openTurn = null
    }
    if (event.type === 'system/message' && (d.turn !== openTurn || d.step !== openStep)) {
      problems.push(`system/message(turn=${d.turn}, step=${d.step}) 不在打开的 turn=${openTurn}/step=${openStep} 内`)
    }
    if (event.type === 'user/message' && (d.role === undefined || d.source === undefined)) {
      problems.push('user/message 缺 role/source（v4 要求 producer-owned source kind）')
    }
    if (event.type === 'assistant/message' && !(d.message?.source?.provider && d.message?.source?.model)) {
      problems.push('assistant/message 的 message.source 缺 provider/model')
    }
  }
  if (problems.length === 0) console.log('诊断    : 没发现已知问题（若仍失败，把报错原文发给维护者）')
  for (const problem of problems) console.log(`  ⚠️  ${problem}`)
}

function repair(file) {
  const { events } = decode(file)
  const of = (type) => events.filter((event) => event.type === type)
  const header = of('session')[0]
  const userMessage = of('user/message').pop()
  if (!header || !userMessage) {
    console.error('缺少 session header 或 user/message，拒绝重建（请人工检查）')
    process.exit(2)
  }
  const settings = events.filter((event) => SETTINGS.includes(event.type))
  const title = of('session/title').pop()
  const systemMessage = of('system/message').pop()
  const assistantMessage = of('assistant/message').pop()
  const dropped = []

  const TURN = 1
  const STEP = 1
  const out = [header, ...settings]
  if (title) out.push(title)
  out.push({ type: 'turn/start', time: Date.now(), data: { turn: TURN } })
  out.push({ type: 'step/start', time: Date.now(), data: { turn: TURN, step: STEP } })
  if (systemMessage) out.push({ ...systemMessage, data: { ...systemMessage.data, turn: TURN, step: STEP } })

  const userData = { ...userMessage.data }
  delete userData.turn
  delete userData.step
  if (userData.role === undefined) userData.role = 'user'
  if (userData.source === undefined) userData.source = { kind: 'user', rpcId: randomUUID() }
  if (userData.id === undefined) userData.id = randomUUID()
  out.push({ ...userMessage, data: userData })

  if (assistantMessage) {
    const source = assistantMessage.data?.message?.source
    if (source?.provider && source?.model) {
      out.push({ ...assistantMessage, data: { ...assistantMessage.data, turn: TURN, step: STEP } })
    } else {
      dropped.push('assistant/message（message.source 缺 provider/model，无法补全）')
    }
  }
  out.push({ type: 'step/end', time: Date.now(), data: { turn: TURN, step: STEP } })
  out.push({ type: 'turn/end', time: Date.now(), data: { turn: TURN, reason: { kind: 'completed' } } })

  let seq = 0
  for (const event of out) {
    if (event.type === 'session') continue
    event.seq = seq++
  }

  const backup = `${file}.bak-${Date.now()}`
  copyFileSync(file, backup)
  // 一行一帧：DSH 逐帧读，每帧必须恰好一行
  writeFileSync(file, Buffer.concat(out.map((event) => zlib.zstdCompressSync(Buffer.from(JSON.stringify(event) + '\n', 'utf8')))))
  console.log(`已修复：${out.length} 个事件，一行一帧`)
  console.log(`备份  ：${backup}`)
  if (dropped.length) console.log(`丢弃  ：${dropped.join('；')}`)
  console.log('下一步：重启 DSH 或重新触发该会话（QQ 桥可 `node src/bridge.js` 重启），再发一条消息验证。')
}

const file = process.argv[2]
if (!file) {
  console.error('用法：node repair-session-log.mjs <session.v4.jsonl.zstd> [--fix]')
  process.exit(1)
}
if (process.argv.includes('--fix')) repair(file)
else diagnose(file)
