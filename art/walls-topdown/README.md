# 測試區俯視城牆

僅 `/test` 使用。橫向與直向各自繪製 100 / 80 / 50 / 25 / 0 五階段，固定左上光源，加入石塊頂面、短接觸陰影與少量碎石。

`source.png` 為內建 imagegen 原稿；`prompt.txt` 記錄提示詞。`node tools/pack-test-walls.cjs` 以 nearest-neighbor 打包十張 96×96 RGBA PNG 至 `dist/assets/walls-topdown/`，錨點 (48,48)，2× 測試倍率按原生尺寸顯示。產生的 alpha 範圍供選取框及 HP 條定位使用。

測試區的「載入城牆外觀」一次列出十張圖；「城牆耐久」選單可修改選取城牆的預覽／戰鬥起始耐久。300 HP 與既有戰鬥規則沿用。

執行 `node tools/check-test-walls.cjs` 驗證外觀選單、獨立方向、復原、血條、手機排版及素材載入。
`/test` 城牆在預設 2× 倍率使用 96 px 邏輯跨距，與木柵欄共用 lengthScale，完整狀態可見長度為 168 px。僅沿長軸延長，側面厚度保持原樣；受損圖共用完整圖的縮放與定位，選取框及血條隨 alpha 範圍調整。
