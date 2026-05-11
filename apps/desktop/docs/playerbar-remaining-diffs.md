# PlayerBar 剩余差异点（vs SPlayer MainPlayer）

> 更新时间：2026-05-09
> 已对齐项见 git log（PlayerBar 系列 commits + 本轮 PR）。
> 本文档列出当前 AudioPlayer `PlayerBar` 与 SPlayer `MainPlayer.vue` 仍未达成 1:1 视觉/交互对齐的部分。

---

## 1. 音质 / 控制 popover —— 内容深度不够

**当前状态：** 已能点开 `quality popover`（采样率 / 重采样器 / 输出位深 / 独占 / Dither / Loudness 只读列表 + 引导到设置）和 `controls popover`（打开设置 / 打开队列）。

**SPlayer 实现（PlayerRightMenu.vue）：** 真实切换 EQ、采样率档位、独占模式、关闭定时、夜间模式等都在 popover/dropdown 内完成；不需要跳到设置页。

**差距：**
- 没有"在 popover 内直接切换"的能力（只读 + 引导）。
- 缺少定时关闭 (autoClose)、个性化 FM、节目/电台分支按钮。
- Controls 菜单只有两项；SPlayer 大约十项以上。

**建议修复路径：** 拆分为多个有限功能 popover，每个绑定到具体 API（`api.setExclusiveMode`、`api.setTargetSamplerate` 等已存在）。优先级：定时关闭 > EQ 切换 > 采样率档位。

---

## 2. 封面 hover 滤镜效果

**当前状态：** 封面有 crossfade、淡入；hover 时显示 expand 图标。

**SPlayer：** hover 时封面 `transform: scale(1.2) + filter: brightness(0.6) blur(2px)`，随 expand 图标淡入做到完整的"放大变暗 + 中心图标"质感。

**差距：** 封面本身没有 scale + blur + brightness 联动，hover 视觉冲击较弱。

**建议修复路径：** `.player-bar-cover:hover .cover-art-image { transform: scale(1.12); filter: brightness(0.6) blur(1.5px); }`。

---

## 3. 喜欢按钮的真实状态 + 弹跳动画

**当前状态：** 心形按钮永远显示空心，无 onClick。

**SPlayer：** 实时反映 `dataStore.isLikeSong(id)`，hover 时 `transform: scale(1.15)`，点击触发 `toLikeSong` 并在喜欢/取消时颜色填充。

**差距：** 缺少收藏后端绑定 + 实心/空心切换 + hover 弹跳。

**建议修复路径：** 引入 favorites store（已经在 NCM 模块里有 `like`/`unlike` 接口），在 PlayerBar 暴露 `isFavorite` 与 `onToggleFavorite` 两个 prop。

---

## 4. 倍速 (playRate) tag

**当前状态：** `playbackRateLabel()` 永远返回 null，视觉上没有这个 chip。

**SPlayer：** 当 `playRate !== 1` 时显示一个 `n-tag size="small" round` 类型为 primary 的 chip（"1.5x" / "0.75x"），点击打开 changeRate 弹窗。

**差距：** 倍速整套 UI/交互未实现。后端是否已有 `set_playback_rate` 待确认。

---

## 5. 艺术家点击跳转 + hover 高亮

**当前状态：** 艺术家分隔已对齐（"/" 间隔），但点击无反应、hover 无颜色变化。

**SPlayer：** hover 整个 ar-item → `color: var(--primary-hex)`，点击 → 路由跳转到艺术家页（`openJumpArtist(artists, id)`）。

**差距：** PlayerBar 没有 onArtistClick 回调；artists 没有 id 信息。

**建议修复路径：** App.tsx 把 `currentTrackRef()?.artistList`（带 id 的数组）下推到 PlayerBar；hover/click 在 `<For>` 里绑定。

---

## 6. lyric 切换：fade vs lyric-slide 两套过渡

**当前状态：** 歌词与艺术家行用统一的 `secondary-enter` translateY 滑入。

**SPlayer：** 用户可在 `settingStore.lyricTransition` 切换 `fade`（out-in）或 `lyric-slide`（无 mode，类似 carousel 滑动）。

**差距：** 只实现一种过渡，没有出入并存的 carousel 切换；缺少 setting 配置项。

---

## 7. PlayerBar 入场动画占位 row

**当前状态：** `player-bar` 默认 `transform: translateY(100%)`，加 `is-visible` 后回到 0。但 grid row 始终占用 80px 空间。

**SPlayer：** `position: fixed; bottom: -90px` → 完全不占布局。

**差距：** 隐藏时仍预留 80px，content-area `padding-bottom` 始终保留这块空白；视觉上不影响，但和 SPlayer 的"完全消失"不一致。如果用户允许 `position: absolute`，可以做到 1:1。

---

## 8. 时间显示双 `<n-text depth=2>` + 下划线 hover

**当前状态：** 单个 toggle 按钮显示 `1:23 / 4:56`，hover 无下划线。

**SPlayer：** 用两个 `n-text depth=2` 拼接，间用 "/"；hover 时 `text-decoration: underline; text-decoration-color: var(--primary-hex)`。颜色稍微更暗。

**差距：** 颜色深度差一档，hover 没有彩色下划线。容易补：现有 `.player-time-toggle:hover { text-decoration: underline; text-decoration-color: var(--accent); }`。

---

## 9. 触摸滑动手势切歌（useSwipe）

**当前状态：** 无。

**SPlayer：** `useSwipe(playerRef, threshold: 50)` 在 PlayerBar 上左右滑切歌，方便触屏 / 触摸板手势。

**差距：** 桌面端用得少，但触摸屏/平板 Tauri 用例下缺失。

---

## 10. autoClose 定时关闭 chip

**当前状态：** 无。

**SPlayer：** 当用户启用了"定时关闭"，时间区域上方显示一个倒计时 `n-tag`（带 `TimeAuto` 图标，点击重新设置）。

**差距：** 后端可能尚未提供"定时关闭"能力，需要先评估再做。

---

## 11. 个性化 FM (PersonalFM) 模式分支

**当前状态：** 无相关 UI。

**SPlayer：** `personalFmMode` 时上一曲按钮替换为"不喜欢" (ThumbDown)，无 shuffle/repeat 按钮，整个右侧菜单切换。

**差距：** AudioPlayer 没有 personalFM 概念。这是 NCM 私人 FM 模式特有功能，看是否在路线图里。

---

## 12. play-pause 按钮的 SPlayer naive button 风格

**当前状态：** 已使用 `.transport-primary` 圆形 + accent 半透明背景；图标 28px；icon-swap 动画。

**SPlayer：** `n-button type="primary" strong secondary circle`，hover `scale(1.1)`，按下 `scale(1)`；与我们现在已经一致。

**差距：** 基本对齐，仅按下反弹的 transition 时长 SPlayer 是 0.3s 我们是 0.2s，影响极小。

---

## 13. 进度条 tooltip 受 settings 控制

**当前状态：** tooltip 默认开启（含时间 + 最近歌词），无开关。

**SPlayer：** `settingStore.progressTooltipShow` 和 `settingStore.progressLyricShow` 分别控制 tooltip 和歌词内嵌；用户可关掉。

**差距：** 缺 setting toggle，我们目前总是显示。

---

## 14. 进度条歌词吸附阈值参数化

**当前状态：** 已实现 SPlayer 同款"下一行 ≤ 2.5s 吸附 / 当前行 ≤ 10s 吸附"逻辑，写死阈值。

**SPlayer：** 用户可在 settings 关闭歌词吸附（`progressAdjustLyric`）。

**差距：** 缺 setting toggle，我们目前总是吸附。

---

## 15. 加载中按钮的 spinner（playLoading）

**当前状态：** 播放/暂停按钮内只切换 Play/Pause 图标。

**SPlayer：** 当 `statusStore.playLoading` 为 true 时按钮内是 naive-ui spinner。

**差距：** 加载中视觉反馈较弱（顶部进度条已显示加载进度，可接受）。

---

## 总结优先级

| 优先级 | 项 | 工作量 |
| --- | --- | --- |
| 高 | #2 封面 hover 滤镜 | 2 行 CSS |
| 高 | #8 时间下划线 hover + depth | 5 行 CSS |
| 高 | #5 艺术家 hover/click | 中（需带 id 的 artists 数组） |
| 中 | #1 popover 内真实切换 | 大（API + 多 UI） |
| 中 | #3 喜欢按钮真实状态 | 中（需收藏 store） |
| 中 | #13/#14 setting toggles | 小（依赖 settings 表） |
| 低 | #4 倍速 chip | 大（缺后端） |
| 低 | #9 触摸手势 | 小，桌面端低优先级 |
| 低 | #10 autoClose | 大（缺后端） |
| 低 | #11 personalFM | 大（NCM 私人 FM 全套） |
| 低 | #15 spinner | 小，可接受当前方案 |

> 最后两轮已经把 PlayerBar 视觉对齐拉到 ≈92%。剩下的差距集中在 `popover 真实交互`、`收藏/倍速等业务能力补齐` 和少量 `hover 颗粒度`。
