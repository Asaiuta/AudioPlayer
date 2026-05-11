# 全局设置页面对齐分析（vs SPlayer MainSetting）

> 更新时间：2026-05-09
> 对照源：D:/AI/SPlayer/src/components/Setting/MainSetting.vue + config/*.ts（共 ~4150 行 config）
> AudioPlayer 当前实现：apps/desktop/src/features/settings/SettingsPage.tsx（P0 重构后）+ sections/*.tsx
>
> **P0 已完成**：左侧分类导航 + 顶部搜索框 + 通用 SettingItem/SettingGroup 组件 + 5 个 section（appearance / playback / lyrics / audio-engine / network）+ 跳转高亮。
>
> **TL;DR**：AudioPlayer 设置页约 30 项 ≈ SPlayer 200+ 项的 15%；缺整套导入导出 / 桌面歌词 / 任务栏歌词 / 第三方集成 / 快捷键 / 缓存与下载 / 自定义 CSS 等。
> 但 **音频引擎（IIR/FIR EQ、噪声整形、LUFS、过采样、Crossfeed、Saturation）** 是 AudioPlayer 独有的优势，SPlayer 完全没有这一层。

---

## 1. 整体框架差异

| 维度 | AudioPlayer | SPlayer |
| --- | --- | --- |
| 布局 | ✅ 左侧分类菜单（220px） + 右侧滚动内容（P0 完成） | 左 280px 分类菜单 + 右滚动内容区，75vh modal 形式 |
| 分类数 | 5 个一级 tab（appearance / playback / lyrics / audio-engine / network；about 留待 P1） | 8 个一级 tab（general / appearance / play / lyrics / keyboard / local / network / about） |
| 搜索框 | ✅ `SettingsSearchBox`（标签 / 描述 / keywords / 分类名匹配，键盘上下选中、回车跳转）（P0 完成） | ✅ `SettingSearch.vue`，按 label/desc/keywords 全局搜索，命中后滚动并高亮 |
| 跳转高亮 | ✅ 通过 `highlightId` + `setting-${id}` 锚点，`.is-highlighted` outline + 2.5s 脉冲渐隐（P0 完成） | ✅ `highlightKey` 控制黄色脉冲高亮 2.5s |
| 设置项渲染 | ⚠️ 通用 `SettingItem` / `SettingGroup` 已抽出，但仍是手写 JSX 组合（非 type 驱动） | `SettingItemRenderer.vue` 配置驱动（switch / select / number / slider / color / text / button / shortcut / custom） |
| 自动保存 | ✅ 通用项 onChange 立即写 localStorage；音频引擎需手动 Save | ✅ 全部项 onChange 写 settingStore（pinia + persist） |
| 嵌套子项 | ❌ 父项 toggle 后用 `<Show>` 显示，但只能一层 | ✅ `children: SettingItem[]` 递归渲染，缩进展示从属关系 |
| 导入/导出/重置 | ❌ 无（P1） | ✅ exportSettings / importSettings / resetSetting / clearAllData 四个按钮 |
| Modal 嵌套配置面板 | 1 个（HomeSectionManager） | 13 个（CoverManager / FontManager / CustomCode / SidebarHide / PlaylistPageManager / FullscreenPlayer / ContextMenu / LocalMusicDirectory / AMLLServer / ExcludeLyrics / ExcludeComment / SongUnlock / StreamingServer） |
| 关于页 | ❌ 无（P1） | ✅ AboutSetting.vue 442 行（版本 / GitHub / 鸣谢 / 更新检查 / 协议 / 反馈链接） |
| 移动端响应式 | ❌ 没适配 | ✅ < 768px 时左侧菜单变抽屉 + 遮罩 |

---

## 2. 分类对齐总表

> ✅ 已对齐 / ⚠️ 部分对齐 / ❌ 缺失 / 🆕 AudioPlayer 独有

### A. general（常规设置）

| 设置项 | AudioPlayer | SPlayer key |
| --- | --- | --- |
| 在线服务总开关 | ❌ | useOnlineService |
| 关闭按钮行为（最小化到托盘 / 退出 / 询问） | ❌ | closeAppMethod + showCloseAppTip |
| 任务栏进度条 | ❌ | showTaskbarProgress |
| Orpheus URL Scheme 注册 | ❌ | orpheusProtocol |
| 启动时检查更新 | ❌ | checkUpdateOnStart |
| 更新通道（stable / beta / nightly） | ❌ | updateChannel |
| 显示搜索历史 | ❌ | showSearchHistory |
| 显示热搜榜 | ❌ | showHotSearch |
| 启用搜索关键字 | ❌ | enableSearchKeyword |
| 搜索框行为（聚焦时清空 / 选中） | ❌ | searchInputBehavior |
| 隐藏歌名括号内容 | ❌ | hideBracketedContent |
| 屏蔽评论关键字配置 | ❌ | configExcludeComment |
| 分享 URL 格式 | ❌ | shareUrlFormat |
| 导出设置 / 导入设置 | ❌ | exportSettings + importSettings |
| 恢复默认 / 清空所有数据 | ❌ | resetSetting + clearAllData |

### B. appearance（外观设置）

| 设置项 | AudioPlayer | SPlayer key |
| --- | --- | --- |
| 主题模式（dark/light/auto） | ✅ themeMode | themeMode |
| 主题色配置（取色器） | ❌ | themeConfig |
| 无边框窗口 | ⚠️ customChrome（仅切换） | useBorderless |
| 字体配置（字族 / 加载本地字体） | ❌ | fontConfig（专门 modal） |
| 自定义 CSS / JS 注入 | ❌ | customCode（专门 modal） |
| 隐藏侧边栏项 | ❌ | sidebarHide（专门 modal） |
| 主页板块管理 | ✅ HomeSectionManager | homePageSection |
| 歌单页元素显示 | ❌ | playlistPageElements |
| 全屏播放器配置 | ⚠️ fullPlayerLayout 二选一 | fullscreenPlayer（多项可视化配置） |
| 右键菜单管理 | ❌ | contextMenu |
| 菜单显示封面 | ❌ | menuShowCover |
| 显示歌单数量 | ❌ | showPlaylistCount |
| 路由切换动画（8 种） | ✅ routeAnimation | routeAnimation |
| 播放器类型（mini/full） | ❌ | playerType |
| 播放器风格比例 | ❌ | playerStyleRatio |
| 全屏播放器渐变 | ❌ | playerFullscreenGradient |
| 播放器背景类型（封面 / 视频 / Spectrum） | ⚠️ bgEnabled+模糊+遮罩 | playerBackgroundType + 5 个子项（fps / flowSpeed / renderScale / pause / lowFreqVolume） |
| 播放器展开动画 | ❌ | playerExpandAnimation |
| 播放器跟随封面色 | ❌ | playerFollowCoverColor |
| 动态封面 | ❌ | dynamicCover |
| 播放器内显示评论 | ❌ | showPlayerComment + commentDisplayMode |
| 频谱显示 | ❌ | showSpectrums |
| 封面源管理 | ❌ | coverManager |
| 自动隐藏播放器元数据 | ❌ | autoHidePlayerMeta |
| 显示播放计数 | ❌ | showPlayMeta |
| PlayerBar 歌词显示 | ❌（已硬编码 ON） | barLyricShow |
| 显示音质标签 | ❌ | showSongQuality / showPlayerQuality |
| 倒计时显示 | ❌ | countDownShow |
| 时间格式 | ❌ | timeFormat |
| 歌曲列表列开关（封面/专辑/歌手/时长/操作/音质/特权/Explicit/原版） | ❌ | showSongAlbum/Artist/Duration/Operations/Quality/PrivilegeTag/ExplicitTag/OriginalTag |

### C. play（播放设置）

| 设置项 | AudioPlayer | SPlayer key |
| --- | --- | --- |
| 自动播放 | ✅ autoPlay | autoPlay |
| 下一曲预加载 | ❌ | useNextPrefetch |
| 记忆上次播放位置 | ✅ memoryLastSeek | memoryLastSeek |
| 阻止系统休眠 | ❌ | preventSleep |
| 进度条 tooltip 开关 | ❌ | progressTooltipShow + progressLyricShow |
| 进度调整时吸附歌词 | ❌ | progressAdjustLyric |
| 切歌音量淡入淡出 | ✅ volumeFade + volumeFadeTime | songVolumeFade + songVolumeFadeTime |
| 自动混音（Beta） | ❌ | enableAutomix + automixMaxAnalyzeTime |
| 歌曲音质 | ✅ ncmSongLevel | songLevel |
| 屏蔽 AI 音频 | ❌ | disableAiAudio |
| 屏蔽 DJ 模式 | ❌ | disableDjMode |
| 还原被屏蔽歌词 | ❌ | uncensorMaskedProfanity |
| 音频引擎（HTML5 / WebAudio / Native） | ❌ | audioEngine |
| 音频延迟策略 | ❌ | audioLatencyHint |
| 延迟补偿 | ❌ | audioDelayCompensation |
| 试听 30s 模式 | ❌ | playSongDemo |
| 输出设备 | ✅ device | playDevice |
| 独占模式 | ✅ exclusiveMode | （SPlayer 无此项） |
| ReplayGain | ❌ | enableReplayGain + replayGainMode |
| 歌曲解灰 | ❌ | useSongUnlock + songUnlockConfig |
| **🆕 EQ（IIR/FIR + 10 频段）** | ✅ | ❌ |
| **🆕 噪声整形（5 种曲线）** | ✅ | ❌ |
| **🆕 LUFS Loudness（track/album/streaming/replaygain）** | ✅ | ❌ |
| **🆕 Preamp 增益** | ✅ | ❌ |
| **🆕 Saturation（drive + mix）** | ✅ | ❌ |
| **🆕 Crossfeed** | ✅ | ❌ |
| **🆕 Dynamic Loudness** | ✅ | ❌ |
| **🆕 目标采样率 + 重采样质量（low/std/hq/uhq）** | ✅ | ❌ |
| **🆕 输出位深 16/24/32** | ✅ | ❌ |
| **🆕 Dither 开关** | ✅ | ❌ |
| **🆕 抢占式重采样** | ✅ | ❌ |

### D. lyrics（歌词设置）—— SPlayer 60+ 项，AudioPlayer 3 项

| 子分类 | AudioPlayer | SPlayer 范围 |
| --- | --- | --- |
| 字体大小（主/译/罗马） | ⚠️ 仅 lyricFontSize | lyricFontSizeMode + lyricFontSize + lyricTranFontSize + lyricRomaFontSize |
| 字体族 / 字重 | ❌ | fontConfig + lyricFontWeight |
| 切换过渡（fade / slide） | ❌ | lyricTransition |
| 位置 / 偏移 / 对齐 | ❌ | lyricsPosition + lyricHorizontalOffset + lyricAlignRight + lyricsScrollOffset |
| 逐字歌词 | ✅ showWordLyrics | showWordLyrics + enableQQMusicLyric + localLyricQQMusicMatch |
| 翻译 / 罗马音 / 互换 | ⚠️ 仅 showLyricTranslation | showTran + showRoma + swapTranRoma |
| 边缘模糊 / 混合模式 | ❌ | lyricsBlur + lyricsBlendMode |
| 时间补偿步长 | ❌ | lyricOffsetStep |
| 歌词源优先级 | ❌ | lyricPriority |
| 简繁转换 | ❌ | preferTraditionalChinese + traditionalChineseVariant |
| AMLL 在线歌词 | ❌ | enableOnlineTTMLLyric + amllDbServer |
| 歌词关键字屏蔽 | ❌ | configExcludeLyric |
| 替换括号内容 | ❌ | replaceLyricBrackets + bracketReplacementPreset + customBracketReplacement |
| Apple Music-like Lyrics 引擎 | ❌ | useAMLyrics + useAMSpring + hidePassedLines + wordFadeWidth + showWordsRoma |
| 桌面歌词（25 项） | ❌ | showDesktopLyric / Lock / DoubleLine / LimitBounds / Position / Font / ShowWordLyrics / ShowTran / Animation / FontWeight / FontSize / PlayedColor / UnplayedColor / ShadowColor / TextBackgroundMask / BackgroundMaskColor / AlwaysShowPlayInfo / Restore |
| 任务栏歌词（25 项） | ❌ | taskbarLyric* 系列（位置 / 宽度 / 模式 / 颜色 / 字体 / 缩放 / 单双行...） |
| macOS 状态栏歌词 | ❌ | macStatusBarLyricEnabled |

### E. keyboard（快捷键）

| 设置项 | AudioPlayer | SPlayer |
| --- | --- | --- |
| 全局快捷键开关 | ❌ | globalOpen |
| 单个快捷键录制器 | ❌ | ShortcutRecorder.vue 组件 |
| 重置快捷键 | ❌ | resetShortcut |
| 页面内快捷键列表 | ❌ | 一组只读说明 |

### F. local（本地与缓存）—— 28 项

| 子分类 | AudioPlayer | SPlayer |
| --- | --- | --- |
| 本地歌曲目录 | ❌ | LocalMusicDirectory modal + showLocalCover + localFolderDisplayMode + showDefaultLocalPath + localFilesPath + localLyricPath |
| 缓存（启用 / 大小限制 / 路径 / 清空） | ⚠️ 仅 useCache 单个开关 | cacheEnabled + songCacheEnabled + cacheLimit + cachePath + clearCache |
| 下载（路径 / 多线程 / HTTP/2 / 音质 / 元数据 / 封面 / 歌词 / 翻译 / 罗马音 / 文件名 / 文件夹策略） | ❌ | 16 个独立设置项 |
| 歌词文件保存格式（.lrc/.yrc/.ass / 简繁 / 编码） | ❌ | downloadMakeYrc / downloadSaveAsAss / downloadLyricToTraditional / downloadLyricEncoding |

### G. network（网络与连接）—— 18 项

| 设置项 | AudioPlayer | SPlayer |
| --- | --- | --- |
| 流媒体服务（自部署 NCM API） | ❌ | streamingEnabled + serverList |
| 网络代理（协议 / 服务 / 端口 / 测试） | ❌ | proxyProtocol + proxyServe + proxyPort + proxyTest |
| 真实 IP 设置 | ❌ | useRealIP + realIP |
| Windows SMTC 集成 | ❌ | smtcOpen |
| Last.fm scrobble（apikey / secret / connect / scrobble / nowplaying） | ❌ | lastfm_* 系列 6 项 |
| Discord RPC（启用 / 暂停时显示 / 模式） | ❌ | discord_* 系列 3 项 |
| WebSocket 远程控制（端口 / 测试） | ❌ | socket_* 系列 3 项 |

### H. about（关于与鸣谢）

整页 AudioPlayer 完全缺失。SPlayer 442 行内容包含：版本号 + 通道、构建时间 + commit、GitHub + 反馈链接、依赖鸣谢列表、更新日志、检查更新按钮、开源协议。

---

## 3. 渲染机制差异

SPlayer 用 `SettingItemRenderer.vue` + 配置式声明：

```ts
// general.ts 摘抄
{
  key: "useOnlineService",
  type: "switch",            // switch / select / slider / number / text / color / button / shortcut / custom
  label: "在线服务",
  description: "...",
  keywords: ["network", "online"],
  show: () => isElectron,    // 条件可见
  children: [...]             // 嵌套子项
}
```

带来的好处：
- 所有项自动出现在搜索框
- 单个 `<SettingItem>` 渲染层统一处理 hover / 高亮 / disabled / 描述折叠
- 新增设置只动 config 文件，不动 JSX
- 可以做"配置项分享"——导出 config 即导出整套设置 schema

AudioPlayer 当前手写 JSX 缺乏上述任何一项。

---

## 4. 优先级建议

| 优先级 | 项 | 工作量 | 备注 |
| --- | --- | --- | --- |
| **高** | 改造为左侧分类 + 右侧滚动布局 | 中 | 不破坏现有内容，只把现有 6 个 SettingGroup 装进对应 tab；后端无依赖 |
| **高** | 抽出 `SettingItem` + `SettingGroup` 通用组件，参考 SPlayer SettingItemRenderer 用 type 驱动 | 中 | 为后续批量加项铺路 |
| **高** | 加搜索框（SettingSearch 等价物） | 中 | 按 label + description + keywords 模糊匹配 |
| **高** | "About" 分类 | 小 | 版本号 + GitHub + 鸣谢链接，先做静态版本 |
| **高** | 进度条 tooltip 开关 + 歌词吸附开关（playerbar-remaining-diffs.md #13/#14 已待办） | 小 | 仅 setting toggle，后端已实现 |
| **中** | 导出 / 导入 / 重置设置三按钮 | 中 | localStorage + JSON 文件互导，注意排除敏感字段 |
| **中** | 网络代理（HTTP / SOCKS 测试） | 中 | 后端要支持代理转发；NCM 模块尤其需要 |
| **中** | 关闭按钮行为（托盘 / 退出 / 询问） | 中 | Tauri tray 已具备，只需 UI |
| **中** | 字体配置 + 自定义 CSS（开发者向） | 中 | Modal 嵌套面板模式 |
| **中** | 桌面歌词整套（25 项 + 独立窗口） | 大 | 后端要新建 desktop_lyric Tauri Window；先做开关，再做配色 |
| **中** | 任务栏歌词（Windows 浮动条） | 大 | 同样要 Tauri 子窗口；macOS 用菜单栏 API |
| **中** | 下载模块（路径 / 多线程 / 文件名 / 元数据） | 大 | 后端要 download manager；NCM 已有部分能力 |
| **低** | 全局快捷键 + 录制器 | 中 | Tauri global-shortcut 插件，但要 UI 录制 widget |
| **低** | Last.fm / Discord RPC / SMTC | 大 | 第三方 OAuth + native；是否在路线图待定 |
| **低** | 歌曲列表列开关（9 项） | 小 | UI 仅 toggle，但要把 LibraryPage 的列变成可配置 |
| **低** | AMLL / TTML 在线歌词源 | 中 | 依赖外部服务，当前未集成 |
| **低** | ReplayGain / Automix（AudioPlayer 已有 Loudness/Crossfeed 替代品，重要性低） | 中 | |

---

## 5. AudioPlayer 应保留的优势

⚠️ **不要为了对齐 SPlayer 把这些拆掉**：

- IIR / FIR EQ 双引擎 + 10 频段
- 噪声整形 5 种曲线选择
- LUFS Target Loudness（4 种模式）
- Preamp / Saturation / Crossfeed / Dynamic Loudness 完整链路
- 目标采样率 + 重采样质量四档
- 输出位深 16/24/32 + Dither 独立控制
- 抢占式重采样
- 独占模式（exclusive mode，绕过系统混音）

这些是 AudioPlayer "音频质量优先" 定位的硬实力，SPlayer 完全没有。建议在新分类布局里把它们放在 **"音频引擎（高级）"** 一栏，不与 SPlayer "播放设置" 混淆。

---

## 6. 建议落地顺序

1. **P0（一个 PR）**：分类左导航 + 搜索框 + 通用 `SettingItem`/`SettingGroup` 组件，把现有项按 SPlayer 8 大类塞进去（仅重构，不加新功能）。
2. **P1（一个 PR）**：约 setting 与 playerbar-remaining-diffs.md 第 #13/#14 项联动；加 export/import/reset；加 About 页静态内容。
3. **P2（迭代）**：按需求补缺失项；优先补"用户每天都摸"的（关闭行为、代理、桌面歌词、下载）。
4. **P3**：第三方集成（Last.fm/Discord/SMTC），与 NCM 模块绑定。

---

> 当前对齐度：**~15%**（按设置项数量计）
> 若完成 P0 + P1：**~25%** 视觉与可发现性显著拉齐
> 若完成 P2 主要项：**~70%** 功能基本覆盖个人音乐播放器主流诉求
