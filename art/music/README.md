# 關卡音樂

來源為使用者提供的 `dist/assets/Midi files.zip`；此處保留實際使用的原始 MIDI。

| 關卡 | 原始樂曲 | 遊戲檔案 | 約略長度 |
| --- | --- | --- | --- |
| 第一關 | 01. Battle Theme MIDI.mid | assets/music/battle-1.mp3 | 61 秒 |
| 第二關 | 09. Battle Theme II MIDI.mid | assets/music/battle-2.mp3 | 47 秒 |
| 第三關 | 16. Battle Theme III MIDI.mid | assets/music/battle-3.mp3 | 86 秒 |

`tools/RenderMusic.java` 使用 JDK 21 的軟體合成器，依 MIDI 原有音符、樂器、力度及速度事件離線演奏。先編譯至暫存目錄，再傳入 MIDI 與 WAV 路徑：

```powershell
$musicBuild = Join-Path $env:TEMP 'td-music-build'
New-Item -ItemType Directory -Force $musicBuild | Out-Null
javac --add-exports java.desktop/com.sun.media.sound=ALL-UNNAMED -d $musicBuild tools/RenderMusic.java
java --add-exports java.desktop/com.sun.media.sound=ALL-UNNAMED -cp $musicBuild RenderMusic 'art/music/01. Battle Theme MIDI.mid' "$musicBuild/battle-1.wav"
ffmpeg -i "$musicBuild/battle-1.wav" -af 'loudnorm=I=-18:TP=-2:LRA=11' -ar 44100 -codec:a libmp3lame -q:a 4 dist/assets/music/battle-1.mp3
```

其他兩首套用相同流程。遊戲只需已輸出的 MP3，三首合計約 3.8 MB；不依賴 Java、FFmpeg、外部音源或網路播放器。

關卡就緒後循環播放；瀏覽器阻擋自動播放時，玩家首次點擊或按鍵後開始。音樂沿用獨立音量設定，關卡內設定／暫停時保留播放以供調整音量；隱藏分頁與離開頁面時暫停，結算時停止，重新開始時從頭播放。首頁、選關及素材測試頁不載入播放器與樂曲。

驗證：`node --test tests/music.test.cjs tests/sound.test.cjs`。啟動本機伺服器後，`node tools/check-music.cjs` 使用 Playwright／Edge 驗證三關音訊解碼、循環、音量保存、重玩、分頁生命週期與選單無音樂。
