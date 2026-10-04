(function(root){
  'use strict';
  const progress=typeof module!=='undefined'&&module.exports?require('./level-progress.js'):root.LevelProgress;
  function summarize(game,storage){
    const won=game.phase==='won',stars=progress.starsForResult(game.phase,game.lives);
    const stageIndex=game.level?.stageIndex??0;
    let records=progress.read(storage),best=records[stageIndex],saved=true;
    const hadWalls=progress.wallsUnlocked(records);
    if(won){const record=progress.record(storage,stageIndex,stars);records=record.stars;best=records[stageIndex];saved=record.saved;}
    const next=progress.stages[stageIndex+1];
    return {won,stars,best,saved,waves:won?game.waves.length:Math.max(0,game.wave-1),kills:game.kills,lives:game.lives,towers:game.towersBuilt||0,nextHref:won&&progress.unlocked(records,stageIndex+1)?next?.href:null,wallReward:won&&stageIndex===1&&progress.wallsUnlocked(records)?hadWalls?'owned':'unlocked':null};
  }
  function mount(dialog,{onRestart,stageIndex=0}={}){
    dialog.innerHTML=`<div class="battle-result">
      <p class="result-heading">森林守衛 · 第 ${stageIndex+1} 關</p>

      <div class="result-hero"><h2 id="result-title"></h2><img id="result-banner" alt=""><div id="result-stars" class="result-stars" role="img"></div></div>
      <section class="result-stats" aria-labelledby="result-stats-heading">
        <h3 id="result-stats-heading">本次戰績</h3>
        <dl class="result-grid">
          <div><span class="result-symbol result-flag" aria-hidden="true"></span><dt>完成波數</dt><dd><b id="result-waves"></b> 波</dd></div>
          <div><img class="result-symbol" src="assets/ui/ready-swords.png" alt=""><dt>擊敗怪物</dt><dd><b id="result-kills"></b> 隻</dd></div>
          <div><span class="result-symbol result-heart" aria-hidden="true"></span><dt>剩餘生命</dt><dd><b id="result-lives"></b> 顆</dd></div>
          <div><img class="result-symbol" src="assets/towers/tower_lv1.png" alt=""><dt>建造防禦塔</dt><dd><b id="result-towers"></b> 座</dd></div>
        </dl>
      </section>
      <div class="result-best"><span>最佳紀錄</span><div id="result-best-stars" class="result-stars" role="img"></div></div>
      <div id="result-wall-reward" class="result-wall-reward" hidden><span class="result-wall-icon" aria-hidden="true"></span><div><b id="result-wall-title"></b><p>第三關起可使用 · 每場 3 個 · 每個 100 金幣</p></div></div>
      <p id="save-note" role="status" hidden></p>
      <div class="result-buttons"><button id="restart" type="button"><img class="result-action-icon" src="assets/ui/result-restart-icon.png" alt="" draggable="false">再玩一次</button><button id="result-next" type="button"><img class="result-action-icon" src="assets/ui/result-next-icon.png" alt="" draggable="false"><span>下一關</span></button></div>
      <p id="result-next-note" hidden>下一關準備中</p>
      <a class="result-back" href="index.html#levels">← 返回關卡地圖</a>
    </div>`;
    const $=id=>dialog.querySelector('#'+id);
    let nextHref=null;
    $('restart').addEventListener('click',()=>{dialog.close();onRestart?.();});
    $('result-next').addEventListener('click',()=>{if(nextHref)root.location.href=nextHref;});
    dialog.addEventListener('cancel',event=>event.preventDefault());
    function fit(){
      if(!dialog.open)return;
      const width=root.visualViewport?.width||root.innerWidth,height=root.visualViewport?.height||root.innerHeight;
      dialog.style.zoom='1';dialog.style.width=`${Math.min(900,width-24)}px`;
      dialog.style.zoom=String(Math.min(1,(height-24)/dialog.offsetHeight));
    }
    root.addEventListener('resize',fit);root.visualViewport?.addEventListener('resize',fit);
    root.document.fonts?.ready.then(fit);
    $('result-banner').addEventListener('load',fit);
    function stars(id,count){const element=$(id);element.setAttribute('aria-label',`${count} / 3 顆星`);element.innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<count?'earned':''}" aria-hidden="true"></span>`).join('');}
    return {show(data){
      dialog.dataset.outcome=data.won?'won':'lost';
      $('result-title').textContent=data.won?'通關！':'失敗…';
      $('result-banner').src=`assets/ui/result-${data.won?'won':'lost'}-blank.png`;
      stars('result-stars',data.stars);stars('result-best-stars',data.best);
      for(const key of ['waves','kills','lives','towers'])$('result-'+key).textContent=data[key];
      $('save-note').hidden=data.saved;$('save-note').textContent=data.saved?'':'無法儲存本次紀錄，離開後可能遺失進度。';
      $('result-wall-reward').hidden=!data.wallReward;$('result-wall-title').textContent=data.wallReward==='owned'?'通關獎勵 · 城牆已解鎖':'通關獎勵 · 解鎖城牆';
      nextHref=data.nextHref;$('result-next').disabled=!nextHref;
      $('result-next').title=nextHref?'前往下一關':data.won?'下一關準備中':'通關後開放';
      $('result-next-note').hidden=!data.won||!!nextHref;
      if(!dialog.open)dialog.showModal();fit();$('restart').focus({preventScroll:true});
    },fit};
  }
  const api={summarize,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BattleResult=api;
})(typeof globalThis!=='undefined'?globalThis:this);
