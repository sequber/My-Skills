---
name: phx-light-skill
description: 分析二次元/Cosplay/动漫风摄影参考图的布光,反推每盏灯的光色/光向/光质/附件及其对画面黑白灰的影响,输出可复刻的简洁版或具体版布光分析;可按需生成极简光位图。适用于用户上传角色摄影图并要求"分析布光/分析灯光/这图怎么打光"等。Use when the user uploads an anime/cosplay-style photo and asks to analyze its lighting into a reproducible setup.
metadata:
  short-description: 二次元摄影布光反向工程
---

# PHX Light Skill

把一张(或一组)二次元/Cosplay 摄影参考图,反推成可复刻的布光说明。

## 核心流程

1. 先看全图定"空间结构 + 动作 + 机位"参照系;再看人物身上的光影(受光面、高光、阴影、眼神光、色彩),反推每盏灯。
2. 判断哪盏是塑形光、哪盏只是填充光——受光面越均匀、越软、越没方向感,越要警惕是填充光而不是主光。灯的身份看"亮斑照的朝向面 + 光从哪来",别按"都亮都高/哪盏在发光"判。
3. 对每盏灯写清:光色、光向、光质、附件、作用,以及它对画面整体黑白灰的影响。
4. 默认输出简洁版(直接给结论);用户要求"具体/详细分析"时切到具体版(现象 → 结论)。
5. 只有用户要求光位图时,才按 [references/diagram-style.md](references/diagram-style.md) 生成极简图。

## 必守规则

- 一盏灯一个段落;段落内先光色、再光向、再光质,落到作用,并说明该灯把画面哪些区域提亮/压暗、如何参与黑白灰层次。
- 方位用"相对人物动作 + 机位 + 空间"描述,不用钟点位。
- 综合分析直接讲动作、机位、光位在这张图里怎么相互影响与配合,不复述"三位一体"这个名词。
- 相机参数(光圈/快门/ISO)拿不准就整句不提及,不补"无法确证/不猜"说明。
- 后期调整单独分段;区分现场布光与后期加光/调色。
- 输出用自然段落,不写标题、步骤或表格;段首只用一句短标签点题。

## 参考文件

- 分析全流程、灯光逻辑与判读陷阱:[references/framework.md](references/framework.md)
- 判光线索库(证据 → 推断):[references/clue-library.md](references/clue-library.md)
- 极简光位图设计规范(按需读取):[references/diagram-style.md](references/diagram-style.md)
- 迭代记录(每轮测试的教训与落点):[references/iterations-log.md](references/iterations-log.md)

## 适用边界

面向二次元/ACG 风格摄影(Cosplay、动漫风写真、角色氛围照)。普通纪实或产品摄影若用户明确要求分析也可套用,但二次元专项要点不强制。
