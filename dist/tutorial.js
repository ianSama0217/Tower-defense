(() => {
  'use strict';
  const $=id=>document.getElementById(id),g=new Tutorial.TutorialGame(),canvas=$('battlefield'),ctx=canvas.getContext('2d');
  g.sound=window.gameSound;
  const images={},enemies={},towers={},arrow=new Image(),buttons=[];
  const hud=new ForestHud.GameHud($('hearts')),settings=$('game-settings');
  let pausedBeforeSettings=false;
  let background=null,selected=null,paused=false,speed=1,ready=false,last=0,uiTime=0,resultShown=false;
  try{speed=JSON.parse(localStorage.getItem('td-menu-settings'))?.speed===2?2:1;}catch{}
  function load(file,target,key){return new Promise((resolve,reject)=>{const img=new Image();target[key]=img;img.onload=resolve;img.onerror=()=>reject(new Error(`無法載入 ${file}`));img.src=file;});}
  const loads=Environment.names.map(name=>load(`assets/environment/${name}.png`,images,name));
  loads.push(load('assets/ui/heart-atlas.png',images,'heartAtlas'),load('assets/ui/hud-icons.png',images,'hudIcons'),load('assets/ui/engineering-icons.png',images,'towerActions'),load('assets/ui/build-time-clock-green.png',images,'buildTimeClock'),load('assets/ui/clock-face.png',images,'clockFace'),load('assets/ui/ready-swords.png',images,'readySwords'));
  for(const type of [1,5])loads.push(load(`assets/enemies/${EnemySprites.specs[type].file}`,enemies,type));
  for(const type of [1,2,3])loads.push(load(`assets/towers/${TowerSprites.specs[type].file}`,towers,type));
  loads.push(new Promise((resolve,reject)=>{arrow.onload=resolve;arrow.onerror=reject;arrow.src='assets/projectiles/arrow.png';}));
  for(const s of g.slots){
    const button=document.createElement('button');button.className='pad-button';button.style.left=`${s.x/1280*100}%`;button.style.top=`${s.y/768*100}%`;
    button.addEventListener('click',()=>{selectPad(s.id);});
    button.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;selectPad((s.id+step+buttons.length)%buttons.length);buttons[selected].focus();});
    $('pads').append(button);buttons.push(button);
  }
  function start(){g.sound.stopAll();g.start();hud.reset(g.lives);selected=null;paused=false;resultShown=false;$('result').close();$('feedback').textContent='';updateUI();draw();}
  Promise.all(loads).then(()=>{background=Environment.makeBackground(g.level,images,2).canvas;ready=true;start();}).catch(error=>{$('wave-status').textContent='素材載入失敗，請重新整理頁面。';console.error(error);});
  function perform(action){if(paused||!ready||selected===null)return;const result=g[action](selected);$('feedback').textContent=result.message;updateUI();}
  function selectPad(id){selected=id;$('feedback').textContent='';updateUI();draw();}
  function closeDrawer(restoreFocus=false){const previous=selected;selected=null;updateUI();draw();if(restoreFocus&&previous!==null)buttons[previous].focus();}
  $('pads').addEventListener('click',event=>{if(event.target===$('pads'))closeDrawer();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!settings.open&&!$('result').open&&selected!==null){event.preventDefault();closeDrawer(true);}});
  $('upgrade').addEventListener('click',()=>perform('build'));
  $('build').addEventListener('click',()=>perform('build'));
  $('repair').addEventListener('click',()=>perform('repair'));
  $('demolish').addEventListener('click',()=>perform('demolish'));
  $('wave-control').addEventListener('click',()=>{if(ready&&!paused&&g.startNextWave()){$('feedback').textContent='';updateUI();}});
  $('pause').addEventListener('click',()=>{if(!ready||g.phase!=='playing')return;pausedBeforeSettings=paused;paused=true;g.sound.stopAll();settings.showModal();updateUI();});
  function closeSettings(resume=false){paused=resume?false:pausedBeforeSettings;settings.close();updateUI();}
  $('close-settings').addEventListener('click',()=>closeSettings());
  $('resume').addEventListener('click',()=>closeSettings(true));
  settings.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
  function setSpeed(value){speed=value;try{const saved=JSON.parse(localStorage.getItem('td-menu-settings'))||{};localStorage.setItem('td-menu-settings',JSON.stringify({...saved,speed}));}catch{}updateUI();}
  $('speed').addEventListener('click',()=>setSpeed(speed===1?2:1));
  settings.querySelectorAll('[data-speed]').forEach(button=>button.addEventListener('click',()=>setSpeed(Number(button.dataset.speed))));
  $('restart').addEventListener('click',start);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready&&g.phase==='playing'){paused=true;updateUI();}});
  $('result').addEventListener('cancel',event=>event.preventDefault());
  function renderAction(id,item){
    const button=$(id),price=$(`${id}-price`);
    button.disabled=item.disabled;
    const amount=item.amount===null?'—':String(item.amount);
    price.querySelector('.amount').textContent=amount;
    price.classList.toggle('income',item.income);
    const duration=item.duration===null?'—':`${item.duration}秒`;
    $(`${id}-time`).querySelector('.duration').textContent=duration;
    price.classList.toggle('unavailable',item.disabled);
    button.title=`${item.label} · ${item.income?'取得':'花費'} ${amount} 金幣 · ${duration}${item.reason?` · ${item.reason}`:''}`;
    button.setAttribute('aria-label',`${item.label}${item.amount===null?'':`，${item.income?'取得':'花費'} ${amount} 金幣`}${item.duration===null?'':`，需要 ${item.duration} 秒`}${item.reason?`，${item.reason}`:''}`);
  }
  function updateUI(){
    const lesson=g.lesson,hasTower=g.slots.some(s=>s.level),menu=TowerMenu.state(g,selected,{ready,paused});
    $('coins').textContent=g.money;hud.update(g.lives);
    $('wave').textContent=`${g.wave} / 4`;$('speed').textContent=`${speed}×`;$('speed').setAttribute('aria-label',`切換遊戲速度，目前 ${speed} 倍`);$('pause').setAttribute('aria-expanded',String(settings.open));$('pause').disabled=!ready||g.phase!=='playing';$('pause-shade').hidden=!paused;
    settings.querySelectorAll('[data-speed]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===speed)));
    const open=!!menu&&g.phase==='playing';
    $('tower-drawer').classList.toggle('is-open',open);$('tower-drawer').inert=!open;$('tower-drawer').setAttribute('aria-hidden',String(!open));
    document.querySelector('.game-window').classList.toggle('has-selection',open);
    if(menu){
      const s=menu.slot,busy=s.action;
      $('tower-title').textContent=s.level?`箭塔 Lv.${s.level} · 臺座 ${s.id+1}`:`臺座 ${s.id+1} · 可建造`;
      $('tower-info').textContent=busy?`${TowerWork.labels[busy.kind]}中 · ${Math.max(0,busy.duration-busy.elapsed).toFixed(1)} 秒`:s.level?`生命 ${s.hp} / ${s.maxHp} · 傷害 ${TD.TOWERS[s.level].damage}`:'選擇箭塔建立防線';
      const preview=$('tower-preview'),src=`assets/towers/${TowerSprites.specs[Math.max(1,s.level)].file}`;
      if(preview.getAttribute('src')!==src)preview.src=src;
      preview.alt=s.level?`${s.level} 級箭塔`:'1 級箭塔';
      renderAction('build',menu.build);$('build').dataset.unavailable=String(!s.level&&menu.build.disabled);
      if(s.level){$('build').title=s.action?.kind==='build'?'箭塔建造中':'已建造箭塔';$('build').setAttribute('aria-label',`${$('build').title}，建造花費 ${menu.build.amount} 金幣，需要 ${menu.build.duration} 秒`);}
      $('tower-actions').hidden=!s.level;
      for(const action of ['upgrade','repair','demolish'])renderAction(action,menu[action]);
    }
    const clockState=WaveClock.sample(g),waveButton=$('wave-control');
    waveButton.dataset.state=clockState.mode;waveButton.disabled=!ready||paused||!g.canStartWave;
    waveButton.hidden=clockState.mode==='finished';
    $('ready-swords').hidden=clockState.mode!=='ready';$('wave-clock').hidden=clockState.mode==='ready';
    const clockLabel=clockState.mode==='ready'?'準備完成，開始第一波':clockState.mode==='intermission'?'下一波準備中':`第 ${g.wave} 波，已擊殺 ${clockState.kills} / ${clockState.total}`;
    waveButton.title=clockLabel;waveButton.setAttribute('aria-label',clockLabel);
    if(ready&&clockState.mode!=='ready')WaveClock.draw($('wave-clock'),images.clockFace,clockState);
    const announcement=paused?'遊戲已暫停':clockState.mode==='ready'?'準備完成後點擊上方雙劍':clockState.mode==='intermission'?`第 ${g.wave} 波結束，15 秒後自動開始下一波`:`第 ${g.wave} 波進行中`;
    if($('wave-status').textContent!==announcement)$('wave-status').textContent=announcement;
    buttons.forEach((button,id)=>{const slot=g.slots[id];button.disabled=!ready||g.phase!=='playing';button.setAttribute('aria-pressed',String(open&&selected===id));button.setAttribute('aria-expanded',String(open&&selected===id));button.setAttribute('aria-controls','tower-drawer');button.setAttribute('aria-label',`臺座 ${id+1}${slot.level?`，${slot.level} 級箭塔，生命 ${slot.hp}`:'，可建造箭塔'}`);button.classList.toggle('recommended',lesson==='build'&&!hasTower&&id===0||lesson==='upgrade'&&slot.level===1);});
    if(['won','lost'].includes(g.phase)&&!resultShown&&!hud.isBreaking()){
      resultShown=true;$('result-title').textContent=g.phase==='won'?'第一關通過！':'防線失守';
      $('result-copy').textContent=g.phase==='won'?`完成 4 波教學，擊敗 ${g.kills} 隻怪物，剩餘 ${g.lives} 顆生命。你已學會建造、升級與應對哥布林。`:'怪物突破了防線。再試一次，優先建好右側箭塔並完成升級。';
      $('save-note').textContent='';if(g.phase==='won'){try{localStorage.setItem('td-tutorial-complete','true');$('save-note').textContent='通關紀錄已儲存在此瀏覽器。';}catch{$('save-note').textContent='本次已通關，但瀏覽器無法保存紀錄。';}}
      $('result').showModal();
    }
  }
  function draw(){
    if(!ready)return;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,1280,768);ctx.drawImage(background,0,0);
    const s=g.slots[selected];if(s&&g.phase==='playing'){ctx.beginPath();ctx.arc(s.x,s.y,TD.TOWERS[Math.max(1,s.level)].range*g.worldScale,0,Math.PI*2);ctx.fillStyle='#d8eb9a0c';ctx.fill();ctx.strokeStyle='#e7df9480';ctx.lineWidth=2;ctx.stroke();}
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
  }
  function frame(now){const dt=Math.min((now-last)/1000,.08);last=now;if(ready&&!document.hidden){if(!paused&&!resultShown){let remaining=dt*speed;while(remaining>0){const step=Math.min(remaining,1/60);g.update(step);remaining-=step;}}uiTime+=dt;if(uiTime>=.1){updateUI();uiTime=0;}hud.render(now);draw();}requestAnimationFrame(frame);}
  updateUI();
  requestAnimationFrame(frame);
})();
