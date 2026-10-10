# 友方盾兵

依使用者參考图使用內建 imagegen 製作；提示詞見 `prompt.txt`，原稿為 `source.png`。使用者指定「不會攻擊」，因此未採用參考圖的攻擊／盾擊動作與命中特效。

成品：`dist/assets/friendly/friendly_shield_soldier.png`，1056×48，22 格，每格固定 **48×48**，真透明 RGBA，固定腳底 anchor **(24,44)**。所有動作共用同一縮放比例；不透明腳底固定最後一列 y=43。面向右，可水平翻轉向左。

排列：Idle(4) | Walk(4) | Push(6) | Hurt(3) | Death(5)，起始格為 0、4、8、14、17。來源座標 `{sx:frame*48,sy:0,sw:48,sh:48}`。`shield-soldier.json` 提供完整尺寸、定位與播放設定，`dist/friendly-sprites.js` 提供動畫取樣及純視覺推進預覽，明確標示 `faction:'friendly'`、`canAttack:false`。

`/test` →「友方單位」可選盾兵、預覽五種動作。放置後按「盾兵推進預覽」，盾兵朝面向方向舉盾前進，到邊界停止；可暫停，結束後恢復擺放位置。此素材預覽不鎖定敵人、不造成傷害。正式關卡中，第一隻敵人越線會立即扣 1 點生命並離場，防線接著獲得 1 秒免扣生命期；上下並排的兩名盾兵會將終點附近尚未越線的敵人一併回推，3 秒約為地圖寬度的 1/3。已越線的敵人一律離場，不會被回推；保護期內越線不再扣血。盾兵沒有攻擊與獨立 HP。

重建：Node 可載入 sharp 時執行 `node tools/pack-shield-soldier.cjs`。`packing-report.json` 提供各格邊界，`contact-sheet.png` 提供動作總覽。
