# 獸人衝鋒

使用內建 imagegen，以使用者的獸人衝鋒參考圖生成四個向右衝鋒姿勢。完整提示詞見 `prompt.txt`，生成原稿為 `source.png`。

`tools/pack-orc-charge.cjs` 使用同一 nearest-neighbor 比例，依腳底 anchor (16, 29) 對齊四格。每格 32×32，Alpha 為 0 / 255。保留原有二十格，在 `dist/assets/enemies/enemy_lv2_orc.png` 末尾增加第 20–23 格；圖集為 768×32。獨立衝鋒圖為 `dist/assets/enemies/enemy_orc_charge.png`（128×32）。`preview.png` 為 8 倍檢視圖。

重新打包：確保 Node 可載入 sharp，執行 `node tools/pack-orc-charge.cjs`。原有 `pack-enemies.cjs` 也會自動接上衝鋒素材。

出場以 1.5 倍速度衝鋒；首次接觸箭塔或城牆造成 120 傷害，永久結束該獸人的衝鋒，下一次普通攻擊前等待原本 1 秒冷卻。普通移速 49，普通攻擊 10。世界縮放同時作用於普通與衝鋒速度。非致命受傷或目標被移除不會消耗衝鋒。城牆維持現有優先規則。塔以占地半徑 32、城牆以最近邊緣加獸人半徑 8 判定接觸（皆隨世界縮放）。

`/test` 的獸人動作選單可選「衝鋒」，行為測試與正式關卡共用相同引擎。
