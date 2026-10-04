(() => {
  'use strict';
  const dialogs=[...document.querySelectorAll('[data-settings-panel]')];
  let saved={};try{saved=JSON.parse(localStorage.getItem('td-display-settings'))||{};}catch{}
  const display=window.gameDisplay={damageNumbers:saved.damageNumbers!==false,enemyHealth:saved.enemyHealth!==false};
  function fit(dialog){
    if(!dialog.open)return;
    const width=window.visualViewport?.width||innerWidth,height=window.visualViewport?.height||innerHeight;
    dialog.style.zoom='1';dialog.style.width=`${Math.min(680,width-24)}px`;
    dialog.style.zoom=String(Math.min(1,(height-24)/dialog.offsetHeight));
  }
  for(const dialog of dialogs){
    const battle=dialog.dataset.settingsPanel==='battle';
    const prefix=battle?'battle':'world',title=battle?'settings-title':'world-settings-title';
    const volume=battle?'sound-volume':'world-volume';
    dialog.classList.add('forest-settings');
    dialog.innerHTML=`<div class="forest-settings-panel">
      <h2 id="${title}" class="forest-settings-title">遊戲設定</h2>
      <button id="${battle?'close-settings':'world-settings-close'}" class="forest-settings-close" aria-label="關閉設定" autofocus>×</button>
      <div class="forest-volume-row">
        <img src="assets/ui/settings-kit/speaker.png" alt="" class="forest-audio-icon">
        <div class="forest-volume-control"><label for="${volume}">音效音量</label><input id="${volume}" data-sound-volume type="range" min="0" max="100" value="50"></div>
        <output for="${volume}" data-volume-output="sound">50%</output>
      </div>
      <div class="forest-volume-row">
        <img src="assets/ui/settings-kit/music.png" alt="" class="forest-audio-icon">
        <div class="forest-volume-control"><label for="${prefix}-music">音樂音量</label><input id="${prefix}-music" data-music-volume type="range" min="0" max="100" value="60"></div>
        <output for="${prefix}-music" data-volume-output="music">60%</output>
      </div>
      <div class="forest-settings-divider" aria-hidden="true"></div>
      <div class="forest-display-options">
        <label><input type="checkbox" data-display-option="damageNumbers">顯示傷害數字</label>
        <label><input type="checkbox" data-display-option="enemyHealth">顯示敵人血條</label>
      </div>
      <div class="forest-settings-actions">
        <button id="${battle?'resume':'world-resume'}">繼續遊戲</button>
        ${battle?'<a href="index.html#levels">返回關卡選單</a>':'<button id="world-back">返回首頁</button>'}
      </div>
    </div>`;
    dialog.querySelectorAll('[data-display-option]').forEach(input=>{
      input.checked=display[input.dataset.displayOption];
      input.addEventListener('change',()=>{
        display[input.dataset.displayOption]=input.checked;
        try{localStorage.setItem('td-display-settings',JSON.stringify(display));}catch{}
      });
    });
    new MutationObserver(()=>fit(dialog)).observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  window.addEventListener('resize',()=>dialogs.forEach(fit));
  window.visualViewport?.addEventListener('resize',()=>dialogs.forEach(fit));
  window.ForestSettings={fit};
})();
