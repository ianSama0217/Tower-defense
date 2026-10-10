(() => {
  'use strict';
  const $=id=>document.getElementById(id),g=window.LevelThree?new LevelThree.LevelThreeGame():window.LevelTwo?new LevelTwo.LevelTwoGame():new Tutorial.TutorialGame(),canvas=$('battlefield'),ctx=canvas.getContext('2d');
  g.sound=window.gameSound;
  let encounterStorage=null;try{encounterStorage=localStorage;}catch{}
  const encounters=LevelProgress.createEncounterTracker(encounterStorage);
  g.onEnemySpawn=type=>encounters.encounter(type);
  const images={},enemies={},towers={},arrow=new Image(),buttons=[];
  const wallImages={};
  const fenceImages={},roadSpec=g.roadBuilding;
  function drawRoadBuilding(context,wall,alpha=1){
    if(roadSpec.type==='fence')FenceSprites.draw(context,fenceImages,wall,alpha);
    else WallSprites.draw(context,wallImages[`${wall.orientation}-${WallSprites.stage(wall.hp??300,wall.maxHp??300)}`],wall,g.worldScale,alpha);
  }
  const hud=new ForestHud.GameHud($('hearts')),settings=$('game-settings');
  const resultPanel=BattleResult.mount($('result'),{onRestart:start,stageIndex:g.level.stageIndex??0});
  let pausedBeforeSettings=false;
  let background=null,selected=null,paused=false,speed=1,ready=false,last=0,uiTime=0,resultShown=false;
  let roadSelected=null,roadHover=null;
  const roadUI=window.RoadBuilding;
  let wallPreview=null,roadInfo=null,roadStock=null;
  if(roadUI&&g.level.stageIndex>=2){
    wallPreview=document.createElement('canvas');wallPreview.id='wall-preview';wallPreview.width=96;wallPreview.height=72;wallPreview.hidden=true;wallPreview.setAttribute('aria-hidden','true');$('build').prepend(wallPreview);
    roadStock=document.createElement('span');roadStock.id='build-stock';roadStock.className='time-tag';roadStock.hidden=true;$('build').append(roadStock);
    roadInfo=document.createElement('div');roadInfo.className='road-build-info stat-column';roadInfo.hidden=true;roadInfo.setAttribute('aria-label',`${roadSpec.name}資訊`);
    roadInfo.innerHTML='<div id="road-stat-health" class="tower-stat" tabindex="0"><span class="stat-icon stat-health" aria-hidden="true"></span><b></b></div><div id="road-stat-target" class="tower-stat" tabindex="0" aria-label="目標：地面" title="目標：地面"><span class="stat-icon stat-target" aria-hidden="true"></span><span class="target-icons" aria-hidden="true"><img src="assets/ui/target-ground.png" alt=""></span></div><div id="road-stat-time" class="tower-stat" tabindex="0"><span class="road-stat-icon" aria-hidden="true"><span class="build-time-icon"></span></span><b></b></div><span class="road-build-reason sr-only"></span>';
    $('tower-drawer').append(roadInfo);
    $('pads').tabIndex=0;$('pads').setAttribute('aria-label',`建造區域：點擊臺座建造箭塔，點擊道路建造${roadSpec.name}。方向鍵移動道路游標，Enter 選取。`);
  }
  try{const savedSpeed=JSON.parse(localStorage.getItem('td-menu-settings'))?.speed;speed=[1,2,4].includes(savedSpeed)?savedSpeed:1;}catch{}
  function load(file,target,key){return new Promise((resolve,reject)=>{const img=new Image();target[key]=img;img.onload=resolve;img.onerror=()=>reject(new Error(`無法載入 ${file}`));img.src=file;});}
  const loads=Environment.names.map(name=>load(`assets/environment/${name}.png`,images,name));
  loads.push(load('assets/ui/enemy-entrance-flag.png',images,'enemyEntranceFlag'));
  loads.push(load('assets/ui/pad-allowed.png',images,'padAllowed'),load('assets/ui/pad-blocked.png',images,'padBlocked'));
  if(roadSpec.type==='fence')for(const hp of FenceSprites.stages)loads.push(load(`assets/fences/fence-${hp}.png`,fenceImages,hp));
  else for(const orientation of ['horizontal','vertical'])for(const hp of WallSprites.stages)loads.push(load(WallSprites.file(orientation,hp,100),wallImages,`${orientation}-${hp}`));
  loads.push(TowerWork.ready.then(loaded=>{if(!loaded)throw new Error('無法載入塔作業動畫');}));
  loads.push(load('assets/ui/heart-atlas.png',images,'heartAtlas'),load('assets/ui/hud-icons.png',images,'hudIcons'),load('assets/ui/engineering-icons.png',images,'towerActions'),load('assets/ui/build-time-clock-green.png',images,'buildTimeClock'),load('assets/ui/clock-face.png',images,'clockFace'),load('assets/ui/ready-swords.png',images,'readySwords'));
  for(let type=1;type<EnemySprites.specs.length;type++)loads.push(load(`assets/enemies/${EnemySprites.specs[type].file}`,enemies,type));
  loads.push(load('assets/friendly/friendly_shield_soldier.png',images,'shieldSoldier'));
  for(const type of [1,2,3])loads.push(load(`assets/towers/${TowerSprites.specs[type].file}`,towers,type));
  loads.push(new Promise((resolve,reject)=>{arrow.onload=resolve;arrow.onerror=reject;arrow.src='assets/projectiles/arrow.png';}));
  for(const s of g.slots){
    const button=document.createElement('button');button.className='pad-button';button.style.left=`${s.x/1280*100}%`;button.style.top=`${s.y/768*100}%`;
    // Placement permission, independent of money, upgrades, or construction work.
    // All existing pedestals are valid locations; reserve "blocked" for future rules.
    button.dataset.placementState='allowed';
    button.addEventListener('click',()=>{selectPad(s.id);});
    button.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;selectPad((s.id+step+buttons.length)%buttons.length);buttons[selected].focus();});
    $('pads').append(button);buttons.push(button);
  }
  function start(){g.sound.stopAll();g.start();g.wallsUnlocked=LevelProgress.wallsUnlocked(LevelProgress.read(encounterStorage));hud.reset(g.lives);selected=null;roadSelected=null;roadHover=null;paused=false;resultShown=false;$('result').close();$('feedback').textContent='';updateUI();draw();}
  Promise.all(loads).then(()=>{background=Environment.makeBackground(g.level,images,g.worldScale).canvas;ready=true;start();}).catch(error=>{$('wave-status').textContent='素材載入失敗，請重新整理頁面。';console.error(error);});
  function perform(action){if(paused||!ready||selected===null)return;const result=g[action](selected);$('feedback').textContent=result.message;updateUI();}
  function selectPad(id){selected=id;roadSelected=null;roadHover=null;$('feedback').textContent='';updateUI();draw();}
  function closeDrawer(restoreFocus=false){const previous=selected,wasRoad=!!roadSelected;selected=null;roadSelected=null;roadHover=null;updateUI();draw();if(restoreFocus){if(previous!==null)buttons[previous].focus();else if(wasRoad)$('pads').focus();}}
  function roadAtPointer(event){
    if(!ready||paused||!roadUI||event.target!==$('pads'))return null;
    const rect=canvas.getBoundingClientRect();
    return roadUI.at(g,(event.clientX-rect.left)/rect.width*canvas.width,(event.clientY-rect.top)/rect.height*canvas.height);
  }
  function selectRoad(placement){
    if(placement.blocked){selected=null;roadSelected=null;roadHover=placement;$('feedback').textContent=placement.reason;updateUI();$('wave-status').textContent=placement.reason;draw();return;}
    selected=null;roadSelected=placement;roadHover=null;$('feedback').textContent='';updateUI();draw();
  }
  function updateRoadCursor(){
    $('pads').classList.toggle('road-hover',!!roadHover&&!roadHover.blocked&&!paused);
    $('pads').classList.toggle('road-blocked',!!roadHover?.blocked&&!paused);
  }
  $('pads').addEventListener('pointermove',event=>{roadHover=roadAtPointer(event);updateRoadCursor();});
  $('pads').addEventListener('pointerleave',()=>{roadHover=null;updateRoadCursor();});
  $('pads').addEventListener('click',event=>{if(event.target!==$('pads'))return;const placement=roadAtPointer(event);if(placement)selectRoad(placement);else closeDrawer();});
  $('pads').addEventListener('keydown',event=>{
    if(event.target!==$('pads')||!ready||paused||!roadUI?.enabled(g))return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();const current=roadHover||roadSelected||g.level.routes[0].path[0],f=current.frame;
      const x=Math.max(16,Math.min(1264,event.key==='ArrowLeft'?(f?f.x-1:current.x-96):event.key==='ArrowRight'?(f?f.x+f.w+1:current.x+96):current.x));
      const y=Math.max(16,Math.min(752,event.key==='ArrowUp'?(f?f.y-1:current.y-96):event.key==='ArrowDown'?(f?f.y+f.h+1:current.y+96):current.y));
      roadHover=roadUI.at(g,x,y);updateRoadCursor();draw();
    }else if((event.key==='Enter'||event.key===' ')&&roadHover){event.preventDefault();selectRoad(roadHover);if(roadSelected)$('build').focus();}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!settings.open&&!$('result').open&&(selected!==null||roadSelected)){event.preventDefault();closeDrawer(true);}});
  $('upgrade').addEventListener('click',()=>perform('build'));
  $('build').addEventListener('click',()=>{
    if(!roadSelected){perform('build');return;}
    if(roadSelected.wall)return;
    if(!ready||paused)return;
    const result=g.placeWall(roadSelected.x,roadSelected.y,roadSelected.orientation);
    $('feedback').textContent=result.message;
    if(result.ok){roadSelected=null;roadHover=null;}
    updateUI();draw();
  });
  $('repair').addEventListener('click',()=>perform('repair'));
  $('demolish').addEventListener('click',()=>perform('demolish'));
  $('wave-control').addEventListener('click',()=>{if(ready&&!paused&&g.startNextWave()){$('feedback').textContent='';updateUI();}});
  $('pause').addEventListener('click',()=>{if(!ready||g.phase!=='playing')return;pausedBeforeSettings=paused;paused=true;g.sound.stopAll();settings.showModal();ForestSettings.fit(settings);updateUI();});
  function closeSettings(resume=false){paused=resume?false:pausedBeforeSettings;settings.close();updateUI();}
  $('close-settings').addEventListener('click',()=>closeSettings());
  $('resume').addEventListener('click',()=>closeSettings(true));
  settings.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
  function setSpeed(value){speed=[1,2,4].includes(value)?value:1;try{const saved=JSON.parse(localStorage.getItem('td-menu-settings'))||{};localStorage.setItem('td-menu-settings',JSON.stringify({...saved,speed}));}catch{}updateUI();}
  $('speed').addEventListener('click',()=>{
    if(!ready||g.phase!=='playing'||settings.open)return;
    if(paused){paused=false;setSpeed(1);}
    else if(speed===4){paused=true;g.sound.stopAll();updateUI();}
    else setSpeed(speed===1?2:4);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready&&g.phase==='playing'){paused=true;g.sound.stopAll();updateUI();}});
  function renderAction(id,item){
    const button=$(id),price=$(`${id}-price`);
    button.disabled=item.disabled;
    button.dataset.insufficientFunds=String(item.reason==='金幣不足');
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
    const menu=TowerMenu.state(g,selected,{ready,paused});
    $('coins').textContent=g.money;hud.update(g.lives);
    $('wave').textContent=`${g.wave} / ${g.level.plannedWaveCount??g.waves.length}`;
    $('speed-label').textContent=`${speed}×`;$('speed-label').hidden=paused;$('speed-play').hidden=!paused;
    $('speed').disabled=!ready||g.phase!=='playing'||settings.open;
    const speedAction=paused?'播放遊戲，以 1 倍速繼續':speed===4?'暫停遊戲':`切換至 ${speed===1?2:4} 倍速`;
    $('speed').title=speedAction;$('speed').setAttribute('aria-label',paused?speedAction:`目前 ${speed} 倍速，${speedAction}`);
    $('pause').setAttribute('aria-expanded',String(settings.open));$('pause').disabled=!ready||g.phase!=='playing';$('pause-shade').hidden=!paused||settings.open;
    const roadOpen=!!roadSelected&&roadUI?.enabled(g),open=(!!menu||roadOpen)&&g.phase==='playing';
    $('tower-drawer').classList.toggle('is-road',roadOpen);
    $('tower-drawer').setAttribute('aria-label',roadOpen?'道路建築選單':'臺座建築選單');
    if(wallPreview){wallPreview.hidden=!roadOpen;$('tower-preview').hidden=roadOpen;roadInfo.hidden=!roadOpen;roadStock.hidden=!roadOpen;}
    updateRoadCursor();
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
      $('build-price').hidden=!!s.level;$('build-time').hidden=!!s.level;
      $('build').classList.toggle('is-built',!!s.level);
      $('tower-drawer').classList.toggle('has-tower',!!s.level);
      $('tower-stats').hidden=!s.level;
      if(s.level){
        $('build').title=`箭塔 Lv.${s.level}${s.action?.kind==='build'?'，建造中':''}`;
        $('build').setAttribute('aria-label',$('build').title);
        const stats=menu.stats;
        for(const [key,value,label] of [
          ['damage',stats.damage,`傷害：每次命中 ${stats.damage}`],
          ['rate',stats.interval,`攻速：每 ${stats.interval} 秒攻擊一次`],
          ['range',stats.range,`射程：${stats.range}`],
          ['health',`${stats.hp}/${stats.maxHp}`,`生命：${stats.hp} / ${stats.maxHp}`],
          ['kills',stats.kills,`擊殺數：此箭塔已擊殺 ${stats.kills} 個敵方單位`]
        ]){const item=$('stat-'+key);item.querySelector('b').textContent=value;item.title=label;item.setAttribute('aria-label',label);}
      }
      $('tower-actions').hidden=!s.level;
      for(const action of ['upgrade','repair','demolish'])renderAction(action,menu[action]);
    }
    if(roadOpen){
      const item=roadUI.item(g,roadSelected,{ready,paused});
      $('tower-title').textContent=`道路 · 可建造${roadSpec.name}`;$('tower-info').textContent=`生命 ${roadSpec.hp} · 剩餘 ${g.wallsRemaining} / ${roadSpec.limit}`;
      renderAction('build',item);$('build').dataset.unavailable=String(item.disabled);$('build').classList.remove('is-built');
      const wall=roadSelected.wall,hp=Math.ceil(wall?.hp??roadSpec.hp),maxHp=wall?.maxHp??roadSpec.hp;
      $('build-price').hidden=!!wall;$('build-time').hidden=true;$('tower-stats').hidden=true;$('tower-actions').hidden=true;$('tower-drawer').classList.remove('has-tower');
      roadStock.textContent=`${g.wallsRemaining}/${roadSpec.limit}`;
      roadStock.setAttribute('aria-label',`剩餘可建造 ${g.wallsRemaining} / ${roadSpec.limit} 座`);
      $('build').setAttribute('aria-label',`${wall?roadSpec.name:`建造${roadSpec.name}，花費 ${roadSpec.cost} 金幣`}，剩餘可建造 ${g.wallsRemaining} / ${roadSpec.limit} 座${item.reason?`，${item.reason}`:''}`);
      $('build').title=$('build').getAttribute('aria-label');
      const seconds=Math.floor((wall?.blockedTime??0)*10+1e-7)/10;
      for(const [id,value,label] of [['road-stat-health',`${hp}/${maxHp}`,`生命：${hp} / ${maxHp}`],['road-stat-time',`${seconds} 秒`,`累計阻擋時間：${seconds} 秒`]]){
        const row=$(id);row.querySelector('b').textContent=value;row.title=label;row.setAttribute('aria-label',label);
      }
      roadInfo.querySelector('.road-build-reason').textContent=item.reason;
      const wc=wallPreview.getContext('2d');wc.clearRect(0,0,96,72);
      if(ready)drawRoadBuilding(wc,{x:48,y:36,width:88,height:32,orientation:'horizontal',visualScale:.55,hp,maxHp});
    }
    const clockState=WaveClock.sample(g),waveButton=$('wave-control');
    waveButton.dataset.state=clockState.mode;waveButton.disabled=!ready||paused||!g.canStartWave;
    waveButton.hidden=clockState.mode==='finished';
    $('ready-swords').hidden=clockState.mode!=='ready';$('wave-clock').hidden=clockState.mode==='ready';
    const clockLabel=g.level.wavesPending?'地形預覽，6 波敵軍配置準備中':clockState.mode==='ready'?'準備完成，開始第一波':clockState.mode==='intermission'?'下一波準備中':clockState.rainFired?`第 ${g.wave} 波，箭雨已發射`:clockState.waitingForSpawns?`第 ${g.wave} 波，等待最後一名敵人進場後開始 30 秒箭雨倒數`:`第 ${g.wave} 波，${Math.ceil(clockState.remaining)} 秒後發射全圖箭雨，對每名敵人造成 200 傷害`;
    waveButton.title=clockLabel;waveButton.setAttribute('aria-label',clockLabel);
    if(ready&&clockState.mode!=='ready')WaveClock.draw($('wave-clock'),images.clockFace,clockState);
    const announcement=paused?'遊戲已暫停':g.level.wavesPending?'地形預覽：可建造箭塔，6 波敵軍配置準備中。':clockState.mode==='ready'?'準備完成後點擊上方雙劍':clockState.mode==='intermission'?`第 ${g.wave} 波結束，15 秒後自動開始下一波`:clockState.rainFired?`第 ${g.wave} 波箭雨已發射，每名敵人受到 200 傷害`:clockState.waitingForSpawns?`第 ${g.wave} 波出兵中，最後一名敵人進場後開始 30 秒箭雨倒數`:`第 ${g.wave} 波進行中，箭雨倒數 ${Math.ceil(clockState.remaining)} 秒`;
    if($('wave-status').textContent!==announcement)$('wave-status').textContent=announcement;
    buttons.forEach((button,id)=>{
      const slot=g.slots[id];
      button.disabled=!ready||g.phase!=='playing';
      button.setAttribute('aria-pressed',String(open&&selected===id));
      button.setAttribute('aria-expanded',String(open&&selected===id));
      button.setAttribute('aria-controls','tower-drawer');
      button.setAttribute('aria-label',`臺座 ${id+1}${slot.level?`，${slot.level} 級箭塔，生命 ${slot.hp}`:'，可建造箭塔'}`);
    });
    if(['won','lost'].includes(g.phase)&&!resultShown&&!hud.isBreaking()){
      resultShown=true;g.sound.stopAll();
      let storage=null;try{storage=localStorage;}catch{}
      resultPanel.show(BattleResult.summarize(g,storage));
    }
  }
  function draw(){
    if(!ready)return;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,1280,768);ctx.drawImage(background,0,0);
    const s=g.slots[selected];if(s&&g.phase==='playing'){ctx.beginPath();ctx.arc(s.x,s.y,TD.TOWERS[Math.max(1,s.level)].range*g.worldScale,0,Math.PI*2);ctx.fillStyle='#d8eb9a0c';ctx.fill();ctx.strokeStyle='#e7df9480';ctx.lineWidth=2;ctx.stroke();}
    g.slots.forEach(slot=>ctx.drawImage(images.buildPad,slot.x-36,slot.y-30,72,60));
    if(roadUI?.enabled(g)&&!paused){
      const placement=roadHover||roadSelected;
      if(placement){
        const valid=placement.wall?.hp>0||!placement.blocked&&g.wallPlacement(placement.x,placement.y,placement.orientation).ok;
        const f=placement.frame;
        ctx.drawImage(valid?images.padAllowed:images.padBlocked,f.x,f.y,f.w,f.h);
      }
    }
    const actors=[];
    if(roadSelected&&roadUI?.enabled(g)&&!paused&&($('build').matches(':hover')||document.activeElement===$('build'))&&!roadUI.item(g,roadSelected,{ready,paused}).disabled){
      const wall=roadSelected;
      actors.push({y:wall.y+wall.height/2,draw:()=>drawRoadBuilding(ctx,wall,.5)});
    }
    for(const wall of g.walls)actors.push({y:wall.y+wall.height/2,draw:()=>{
      drawRoadBuilding(ctx,wall);
    }});
    for(const slot of g.slots)if(slot.level)actors.push({y:slot.y,draw:()=>{
      const rect=TowerSprites.worldRect(slot.level,slot.x,slot.y,g.level.mapConfig.towerSlotSize,g.worldScale),{x,y}=rect;
      let target=null;
      if(slot.action?.kind==='upgrade'){
        target={image:towers[slot.action.targetLevel],rect:TowerSprites.worldRect(slot.action.targetLevel,slot.x,slot.y,g.level.mapConfig.towerSlotSize,g.worldScale)};
      }
      TowerWork.draw(ctx,towers[slot.level],rect,slot.action?{...slot.action,material:slot.level===1?'wood':'stone'}:null,target);
      ctx.fillStyle='#152a1c';ctx.fillRect(slot.x-32,y-12,64,6);ctx.fillStyle=slot.hp>40?'#b0d879':'#ec977c';ctx.fillRect(slot.x-32,y-12,64*slot.hp/100,6);
      if(slot.action)TowerWork.drawProgress(ctx,slot.x,y-42,slot.action.elapsed/slot.action.duration,42);
    }});
    for(const e of [...g.enemies,...g.corpses])actors.push({y:e.y,draw:()=>{
      const spec=EnemySprites.specs[e.level],frame=EnemySprites.sample(e,g.time);ctx.save();ctx.translate(e.x,e.y);ctx.scale((e.facing??-1)*g.worldScale,g.worldScale);ctx.drawImage(enemies[e.level],frame.sx,frame.sy,frame.sw,frame.sh,-spec.anchor.x,-spec.anchor.y,spec.size,spec.size);ctx.restore();
      if(gameDisplay.enemyHealth&&e.hp>0&&e.hp<e.maxHp){ctx.fillStyle='#182a1b';ctx.fillRect(e.x-20,e.y-54,40,4);ctx.fillStyle='#badc7d';ctx.fillRect(e.x-20,e.y-54,40*e.hp/e.maxHp,4);}
    }});
    for(const soldier of g.shieldSoldiers)actors.push({y:soldier.y,draw:()=>{
      const spec=FriendlySprites.shield,frame=FriendlySprites.sample('push',g.time-soldier.startedAt);
      ctx.save();ctx.translate(soldier.x,soldier.y);ctx.scale(soldier.facing*g.worldScale,g.worldScale);
      ctx.drawImage(images.shieldSoldier,frame.sx,frame.sy,frame.sw,frame.sh,-spec.anchor.x,-spec.anchor.y,spec.size,spec.size);ctx.restore();
    }});
    actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());
    for(const wall of g.walls){if(roadSpec.type==='fence')FenceSprites.drawHealth(ctx,wall);else WallSprites.drawHealth(ctx,wall,g.worldScale);}
    for(const b of g.bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrow,-40,-8,48,16);ctx.restore();}
    for(const b of g.enemyArrows){ctx.save();ctx.translate(b.x,b.y-20);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrow,-30,-6,32,12);ctx.restore();}
    ArrowRain.draw(ctx,arrow,g.arrowRain,g.time);
    if(gameDisplay.damageNumbers)for(const e of g.effects)if(e.kind==='damage'){ctx.save();ctx.globalAlpha=Math.min(1,e.life*3);ctx.font='bold 22px "Fusion Pixel"';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#29160e';ctx.fillStyle='#fff0b4';const y=e.y-55-(.7-e.life)*30;ctx.strokeText(String(e.amount),e.x,y);ctx.fillText(String(e.amount),e.x,y);ctx.restore();}
    for(const e of g.effects)if(e.kind==='enemy-attack'){ctx.beginPath();ctx.moveTo(e.x,e.y-20);ctx.lineTo(e.toX,e.toY-15);ctx.strokeStyle='#ffd18c';ctx.lineWidth=3;ctx.stroke();}
  }
  function frame(now){const dt=Math.min((now-last)/1000,.08);last=now;if(ready&&!document.hidden){if(!paused&&!resultShown){let remaining=dt*speed;while(remaining>0){const step=Math.min(remaining,1/60);g.update(step);remaining-=step;}}uiTime+=dt;if(uiTime>=.1){updateUI();uiTime=0;}hud.render(now);draw();}requestAnimationFrame(frame);}
  updateUI();
  requestAnimationFrame(frame);
})();
