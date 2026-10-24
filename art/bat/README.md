# 洞窟蝙蝠

使用內建 imagegen 依使用者參考圖繪製；提示詞見 prompt.txt，原始輸出保存在 source.png。

遊戲圖集：dist/assets/enemies/enemy_bat.png，456×24 RGBA。19 格水平排列，無間距，每格固定 24×24。固定 anchor 為 (12,21)，全圖使用同一縮放比例，最近鄰取樣，透明邊界保留。打包程式：tools/pack-bat.cjs。

順序：待機 4、飛行 4、攻擊 4、受傷 3、死亡 4。主朝向為右側 3/4，/test 支援水平翻轉；不含上／下方向獨立動畫。動作與切格資料見 dist/assets/enemies/bat.json。

在 /test 的怪物單位分類可放置並切換動作、暫停、翻轉。此次為素材預覽，未新增戰鬥數值或正式關卡出怪。預覽物件不參與行為測試的傷害與範圍計算。

驗證：設定 NODE_PATH 為含 sharp 與 playwright 的模組目錄，啟動 server.cjs 後執行 node tools/check-bat.cjs。
