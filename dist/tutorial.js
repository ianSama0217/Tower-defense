(() => {
  'use strict';
  const $=id=>document.getElementById(id),g=new Tutorial.TutorialGame(),canvas=$('battlefield'),ctx=canvas.getContext('2d');
  const images={},enemies={},towers={},arrow=new Image(),buttons=[];
  let background=null,selected=0,paused=false,speed=1,ready=false,last=0,uiTime=0,lastLesson='',resultShown=false;
  try{speed=JSON.parse(localStorage.getItem('td-menu-settings'))?.speed===2?2:1;}catch{}
  const lessons={
    build:['第一課 · 建立防線','建立第一座箭塔','你有 120 金幣。點選右側發光的臺座，再按「建造箭塔」花費 60 金幣。箭塔會自動攻擊；第一波只有不會攻擊的史萊姆。'],
    wave1:['第 1 波 · 初次迎敵','讓箭塔守住小徑','史萊姆只會沿路前進，不會攻擊箭塔。觀察箭塔自動射擊，擊敗怪物可獲得金幣。也可以用剩餘金幣再建一座塔。'],
    slimes:['第一波完成','再練習一次','第二波仍然只有史萊姆。你可以再建一座箭塔；完成這波會額外獲得 80 金幣，接著學習升級。'],
    wave2:['第 2 波 · 鞏固防線','守住更多史萊姆','這一波也不會攻擊你的塔。完成後會獲得 80 金幣教學獎勵，足夠將一座箭塔升至 2 級。'],
    upgrade:['第二課 · 獎勵已入帳','升級你的箭塔','第二波完成！已額外獲得 80 金幣。選取一座已建造的箭塔，花費 80 金幣升級。升級需要等待 5 秒，期間箭塔停止攻擊。'],
    upgrading:['第二課 · 正在施工','等待 5 秒完成升級','升級期間箭塔無法射擊，仍然會受到怪物攻擊。現在是安全的準備階段；升級完成後，箭塔會提高傷害並回滿生命。'],
    goblins:['第三課 · 新敵人','小心，哥布林會攻塔','升級完成！第三波會混合史萊姆與哥布林。哥布林會鎖定判定範圍內的塔，靠近後停下攻擊；塔被摧毀後，牠會尋找下一個目標。留意塔上方的生命條。'],
    wave3:['第 3 波 · 混合攻勢','保護你的防禦塔','史萊姆繼續往出口移動，哥布林則可能靠近並攻擊你的塔。善用多座箭塔互相支援；戰鬥中升級會有 5 秒無法射擊。'],
    final:['最後一課 · 守住森林','準備最後一波','第四波全部是哥布林！先檢查箭塔生命並補強防線。擊敗最後一波的所有敵人，就能完成第一關。'],
    wave4:['第 4 波 · 最終考驗','守住最後一波','這一波只有會攻塔的哥布林。保持火力，守住左側出口；清除所有剩餘敵人即可通關。'],
    won:['教學完成','森林守住了','你已學會建造、升級與應對攻塔怪物。'],
    lost:['防線失守','再試一次','優先在右側臺座建塔，並在第二波結束後完成升級。']
  };
  function load(file,target,key){return new Promise((resolve,reject)=>{const img=new Image();target[key]=img;img.onload=resolve;img.onerror=()=>reject(new Error(`無法載入 ${file}`));img.src=file;});}
  const loads=Environment.names.map(name=>load(`assets/environment/${name}.png`,images,name));
  for(const type of [1,5])loads.push(load(`assets/enemies/${EnemySprites.specs[type].file}`,enemies,type));
  for(const type of [1,2,3])loads.push(load(`assets/towers/${TowerSprites.specs[type].file}`,towers,type));
  loads.push(new Promise((resolve,reject)=>{arrow.onload=resolve;arrow.onerror=reject;arrow.src='assets/projectiles/arrow.png';}));
  for(const s of g.slots){
    const button=document.createElement('button');button.className='pad-button';button.style.left=`${s.x/1280*100}%`;button.style.top=`${s.y/768*100}%`;
    button.innerHTML=`<span>臺座 ${s.id+1}</span>`;button.addEventListener('click',()=>{selected=s.id;$('feedback').textContent='';updateUI();});
    button.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;selected=(selected+step+buttons.length)%buttons.length;buttons[selected].focus();updateUI();});
    $('pads').append(button);buttons.push(button);
  }
  function start(){g.start();selected=0;paused=false;resultShown=false;lastLesson='';$('result').close();$('feedback').textContent='';updateUI();}
  Promise.all(loads).then(()=>{background=Environment.makeBackground(g.level,images,2).canvas;ready=true;start();}).catch(error=>{$('lesson-copy').textContent='素材載入失敗，請重新整理頁面。';console.error(error);});
  function perform(action){if(paused||!ready)return;const result=g[action](selected);$('feedback').textContent=result.message;updateUI();}
  $('build').addEventListener('click',()=>perform('build'));
  $('repair').addEventListener('click',()=>perform('repair'));
  $('demolish').addEventListener('click',()=>perform('demolish'));
  $('next-wave').addEventListener('click',()=>{if(!paused&&g.startNextWave()){$('feedback').textContent='';updateUI();}});
  $('pause').addEventListener('click',()=>{if(!ready||g.phase!=='playing')return;paused=!paused;updateUI();});
  $('speed').addEventListener('click',()=>{speed=speed===1?2:1;updateUI();});
  $('restart').addEventListener('click',start);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready&&g.phase==='playing'){paused=true;updateUI();}});
  $('result').addEventListener('cancel',event=>event.preventDefault());
  function updateUI(){
    const s=g.slots[selected],lesson=g.lesson,busy=!!s.action;
    $('coins').textContent=g.money;$('hearts').textContent=Array.from({length:3},(_,i)=>i<g.lives?'♥':'♡').join(' ');$('hearts').setAttribute('aria-label',`剩餘生命 ${g.lives}`);
    $('wave').textContent=`${g.wave} / 4`;$('speed').textContent=`${speed}×`;$('pause').textContent=paused?'繼續':'暫停';$('pause').setAttribute('aria-pressed',String(paused));$('pause-shade').hidden=!paused;
    if(lastLesson!==lesson){const [tag,title,copy]=lessons[lesson]||lessons.build;$('lesson-tag').textContent=tag;$('lesson-title').textContent=title;$('lesson-copy').textContent=copy;lastLesson=lesson;}
    const upgraded=g.slots.find(s=>s.action?.kind==='upgrade'),hasTower=g.slots.some(s=>s.level);
    $('lesson-goal').textContent=lesson==='build'?(hasTower?'✓ 已建好箭塔，可以開始第一波。':'目標：建造至少 1 座箭塔。'):lesson==='upgrade'?'目標：選擇已有的塔，升級至 2 級。':lesson==='upgrading'?`施工剩餘 ${Math.max(0,upgraded.action.duration-upgraded.action.elapsed).toFixed(1)} 秒（遊戲時間）`:lesson==='goblins'?'✓ 已完成升級。閱讀敵人說明後開始第三波。':g.awaitingWave?'準備完成後，按下方按鈕出發。':`本關已擊敗 ${g.kills} 隻怪物`;
    const step=Math.min(4,g.awaitingWave?g.wave+1:Math.max(1,g.wave));$('step-label').textContent=`0${step} / 04`;
    document.querySelectorAll('.wave-track span').forEach((el,i)=>{el.classList.toggle('current',i===step-1);el.classList.toggle('done',i<step-1||g.phase==='won');});
    $('next-wave').disabled=!ready||paused||!g.canStartWave;
    $('next-wave').textContent=!g.awaitingWave?'波次進行中':lesson==='build'&&!hasTower?'先建造一座箭塔':lesson==='upgrade'?'先完成一次升級':lesson==='upgrading'?'等待升級完成':lesson==='goblins'?'了解，開始第 3 波':`開始第 ${g.wave+1} 波`;
    $('wave-status').textContent=paused?'遊戲已暫停':g.awaitingWave?'準備階段 · 不會自動出怪':`場上 ${g.enemies.length} 隻 · 尚未出場 ${g.spawnQueue.length} 隻`;
    $('tower-title').textContent=s.level?`臺座 ${s.id+1} · ${s.level} 級箭塔`:`臺座 ${s.id+1} · 可建造`;
    $('tower-info').textContent=s.level?`生命 ${s.hp} / 100 · 傷害 ${TD.TOWERS[s.level].damage} · 射程 ${TD.TOWERS[s.level].range*g.worldScale} px${busy?`｜${TowerWork.labels[s.action.kind]}中，剩 ${Math.max(0,s.action.duration-s.action.elapsed).toFixed(1)} 秒`:''}`:'箭塔會自動攻擊，建造後立即生效。建造費用 60 金幣。';
    const lockedUpgrade=s.level&&(g.wave<2||g.wave===2&&!g.awaitingWave),lockedBuild=!s.level&&['upgrade','upgrading'].includes(lesson);
    const cost=TD.TOWERS[Math.min(3,s.level+1)].cost;
    $('build').disabled=!ready||paused||busy||g.phase!=='playing'||s.level===3||g.money<cost||lockedUpgrade||lockedBuild;
    $('build').textContent=busy?`${TowerWork.labels[s.action.kind]}中…`:s.level===3?'已達最高等級':!s.level?'建造箭塔 · 60 金幣':lockedUpgrade?'第二波結束後學習升級':`升至 ${s.level+1} 級 · ${cost} 金幣 · 5 秒`;
    $('repair').hidden=s.level!==3;$('repair').disabled=paused||busy||s.hp>=100||g.money<50;
    $('demolish').hidden=!s.level||!g.upgradeLearned;$('demolish').disabled=paused||busy;
    buttons.forEach((button,id)=>{const slot=g.slots[id];button.disabled=!ready||g.phase!=='playing';button.setAttribute('aria-pressed',String(selected===id));button.setAttribute('aria-label',`臺座 ${id+1}${slot.level?`，${slot.level} 級箭塔，生命 ${slot.hp}`:'，可建造箭塔'}`);button.classList.toggle('recommended',lesson==='build'&&!hasTower&&id===0||lesson==='upgrade'&&slot.level===1);button.firstChild.textContent=slot.level?`${slot.level} 級 · ${slot.hp} HP`:`臺座 ${id+1}`;});
    if(['won','lost'].includes(g.phase)&&!resultShown){
      resultShown=true;$('result-title').textContent=g.phase==='won'?'第一關通過！':'防線失守';
      $('result-copy').textContent=g.phase==='won'?`完成 4 波教學，擊敗 ${g.kills} 隻怪物，剩餘 ${g.lives} 顆生命。你已學會建造、升級與應對哥布林。`:'怪物突破了防線。再試一次，優先建好右側箭塔並完成升級。';
      $('save-note').textContent='';if(g.phase==='won'){try{localStorage.setItem('td-tutorial-complete','true');$('save-note').textContent='通關紀錄已儲存在此瀏覽器。';}catch{$('save-note').textContent='本次已通關，但瀏覽器無法保存紀錄。';}}
      $('result').showModal();
    }
  }
  function draw(){
    if(!ready)return;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,1280,768);ctx.drawImage(background,0,0);
    const s=g.slots[selected];ctx.beginPath();ctx.arc(s.x,s.y,TD.TOWERS[Math.max(1,s.level)].range*g.worldScale,0,Math.PI*2);ctx.fillStyle='#d8eb9a0c';ctx.fill();ctx.strokeStyle='#e7df9480';ctx.lineWidth=2;ctx.stroke();
    g.slots.forEach(slot=>ctx.drawImage(images.buildPad,slot.x-36,slot.y-30,72,60));
    const actors=[];
    for(const slot of g.slots)if(slot.level)actors.push({y:slot.y,draw:()=>{
      const p=TowerSprites.placement(slot.level,64,2),scale=2,x=slot.x-p.anchorX*scale,y=slot.y+p.groundOffset-p.anchorY*scale;
      TowerWork.draw(ctx,towers[slot.level],{x,y,w:p.width*scale,h:p.height*scale},slot.action?{...slot.action,material:slot.level===1?'wood':'stone'}:null);
      ctx.fillStyle='#152a1c';ctx.fillRect(slot.x-32,y-12,64,6);ctx.fillStyle=slot.hp>40?'#b0d879':'#ec977c';ctx.fillRect(slot.x-32,y-12,64*slot.hp/100,6);
      if(slot.action)TowerWork.drawProgress(ctx,slot.x,y-42,slot.action.elapsed/slot.action.duration,42);
    }});
    for(const e of [...g.enemies,...g.corpses])actors.push({y:e.y,draw:()=>{
      const spec=EnemySprites.specs[e.level],frame=EnemySprites.sample(e,g.time);ctx.save();ctx.translate(e.x,e.y);ctx.scale((e.facing??-1)*2,2);ctx.drawImage(enemies[e.level],frame.sx,frame.sy,frame.sw,frame.sh,-spec.anchor.x,-spec.anchor.y,spec.size,spec.size);ctx.restore();
      if(e.hp>0&&e.hp<e.maxHp){ctx.fillStyle='#182a1b';ctx.fillRect(e.x-20,e.y-54,40,4);ctx.fillStyle='#badc7d';ctx.fillRect(e.x-20,e.y-54,40*e.hp/e.maxHp,4);}
    }});
    actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());
    for(const b of g.bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrow,-40,-8,48,16);ctx.restore();}
    for(const e of g.effects)if(e.kind==='enemy-attack'){ctx.beginPath();ctx.moveTo(e.x,e.y-20);ctx.lineTo(e.toX,e.toY-15);ctx.strokeStyle='#ffd18c';ctx.lineWidth=3;ctx.stroke();}
    ctx.font='bold 16px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#f4e8b6';ctx.textAlign='left';ctx.fillText('← 守護出口',20,460);ctx.textAlign='right';ctx.fillText('怪物入口 ←',1260,460);
  }
  function resize(){const width=document.querySelector('.map-space').clientWidth,max=window.innerWidth<=700?width:Math.max(250,(window.innerHeight-190)*5/3);$('map-frame').style.width=`${Math.min(width,max)}px`;}
  new ResizeObserver(resize).observe(document.querySelector('.map-space'));window.addEventListener('resize',resize);resize();
  function frame(now){const dt=Math.min((now-last)/1000,.08);last=now;if(ready&&!document.hidden){if(!paused&&!resultShown){let remaining=dt*speed;while(remaining>0){const step=Math.min(remaining,1/60);g.update(step);remaining-=step;}}uiTime+=dt;if(uiTime>=.1){updateUI();uiTime=0;}draw();}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
