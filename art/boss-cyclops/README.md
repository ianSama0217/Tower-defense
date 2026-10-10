# Boss Cyclops 素材

依使用者提供的 Boss 獨眼巨人參考圖，使用內建 imagegen 製作。原始提示詞與石頭提示詞見 `prompts.txt`，收緊揮擊／倒地姿勢的修改提示詞見 `revision-prompt.txt`。`source-final.png` 是採用的角色原稿，`rock-source.png` 是獨立石頭原稿。

成品在 `dist/assets/boss/`：

| 圖集 | 每格 | 格數 | 整張尺寸 | Anchor |
| --- | --- | --- | --- | --- |
| boss_cyclops.png | 96×96 | 27 | 2592×96 | (48,90) |
| boss_cyclops_rock.png | 32×32 | 6 | 192×32 | (16,16) |
| boss_cyclops_rock_impact.png | 48×48 | 4 | 192×48 | (24,43) |

所有圖集為單列、零間距、RGBA 真透明，透明像素 RGB 歸零。角色所有動作共用一個等比例 nearest-neighbor 縮放係數；站立本體實測 75～77 px，腳底最後不透明列固定 y=89。死亡與投擲不改畫格尺寸、不單獨縮小身體。手持石頭僅出現在投擲準備動作，放手後的飛行石頭由獨立圖集提供。

角色排列：Idle(4) | Walk(4) | Attack(4) | Throw(6) | Hurt(3) | Death(6)。起始 frame 分別為 0、4、8、12、18、21。任一格來源為 `{sx: frameIndex*96, sy:0, sw:96, sh:96}`，繪製時減去 anchor。完整資料在 `sprites.json`；`dist/boss-sprites.js` 提供播放取樣。

`/test` →「Boss 素材」可放置角色、石頭、落地效果，並切換各動作。`/boss-preview.html` 提供所有動作同時播放、逐格、翻轉及背景檢查。Boss 此次只加入素材預覽，未替換既有 Lv3 獨眼巨人，也未新增戰鬥數值或關卡出場。

重建：Node 可載入 sharp 時，執行 `node tools/pack-boss-cyclops.cjs`。`packing-report.json` 記錄每格邊界與來源定位；`contact-sheet.png` 是透明接觸表。
