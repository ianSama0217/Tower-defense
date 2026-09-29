'use strict';
const $=id=>document.getElementById(id), game=new TD.Game(), canvas=$('board'), ctx=canvas.getContext('2d');
let selected=null,hovered=null,paused=false,speed=1,last=0,viewWidth=1040,viewHeight=770;
let observedAction=null;
// Map geometry remains orthographic; artwork uses a grounded three-quarter view.
let MAP_SCALE=1, mapOrigin={x:0,y:0};
// Display-only enlargement. Source frames, path geometry and combat distances stay in world units.
const SPRITE_SCALE=2;
const enemyImages=[null],towerImages=[null],environmentImages={};
let firstLevelBackground=null;
$('start').disabled=true;
$('menu-status').textContent='正在準備森林素材…';
const assetLoads=[];
const arrowImage=new Image();
assetLoads.push(new Promise((resolve,reject)=>{
  arrowImage.onload=()=>arrowImage.naturalWidth===32&&arrowImage.naturalHeight===12?resolve():reject(new Error('Invalid arrow dimensions'));
  arrowImage.onerror=()=>reject(new Error('Failed to load arrow sprite'));
  arrowImage.src='assets/projectiles/arrow.png';
}));
for(const {specs,images,folder,frames} of [{specs:EnemySprites.specs,images:enemyImages,folder:'enemies',frames:20},{specs:TowerSprites.specs,images:towerImages,folder:'towers',frames:1}]){
  specs.slice(1).forEach((spec,i)=>assetLoads.push(new Promise((resolve,reject)=>{
    const img=new Image();images[i+1]=img;
    img.onload=()=>img.naturalWidth===spec.size*(spec.frames||frames)&&img.naturalHeight===spec.size?resolve():reject(new Error(`Invalid dimensions: ${spec.file}`));
    img.onerror=()=>reject(new Error(`Failed to load: ${spec.file}`));
    img.src=`assets/${folder}/${spec.file}`;
  })));
}
for(const name of Environment.names)assetLoads.push(new Promise((resolve,reject)=>{
  const img=new Image();environmentImages[name]=img;img.onload=resolve;img.onerror=()=>reject(new Error(`Failed to load environment: ${name}`));img.src=`assets/environment/${name}.png`;
}));
Promise.all(assetLoads).then(()=>{firstLevelBackground=Environment.makeBackground(TD.LEVELS[0],environmentImages,SPRITE_SCALE);StartScreen.ready(environmentImages);LevelSelect.ready(environmentImages);$('start').disabled=false;$('menu-status').textContent='選擇木牌，踏入森林';}).catch(error=>{$('menu-status').textContent='素材載入失敗，請重新整理';console.error(error);});
document.querySelector('.building-icon').textContent='';
const project=(x,y)=>({x:mapOrigin.x+x*MAP_SCALE,y:mapOrigin.y+y*MAP_SCALE});
function drawTower(s){
  const img=towerImages[s.level];if(!img?.complete||!img.naturalWidth)return;
  const active=s.id===selected||s.id===hovered,map=game.level.mapConfig,place=TowerSprites.placement(s.level,map.towerSlotSize,game.worldScale),p=project(s.x,s.y+place.groundOffset);
  ctx.save();ctx.imageSmoothingEnabled=false;
  TowerWork.draw(ctx,img,{x:p.x-place.anchorX*MAP_SCALE*SPRITE_SCALE,y:p.y-place.anchorY*MAP_SCALE*SPRITE_SCALE,w:place.width*MAP_SCALE*SPRITE_SCALE,h:place.height*MAP_SCALE*SPRITE_SCALE},s.action?{...s.action,material:s.level===1?'wood':'stone'}:null);ctx.restore();
  if(s.hp<s.maxHp||active||s.action){
    const width=map.towerSlotSize/game.worldScale*.9*MAP_SCALE*SPRITE_SCALE,barY=p.y-place.anchorY*MAP_SCALE*SPRITE_SCALE-5;
    ctx.fillStyle='#53604b60';ctx.fillRect(p.x-width/2,barY,width,3);
    ctx.fillStyle=s.hp>30?'#438361':'#d35c43';ctx.fillRect(p.x-width/2,barY,width*s.hp/s.maxHp,3);
    if(s.action){const a=s.action,size=48;TowerWork.drawProgress(ctx,p.x,Math.max(size/2+2,barY-size/2-5),a.elapsed/a.duration,size);}
  }
}
function drawEnemy(e){
  const spec=EnemySprites.specs[e.level],img=enemyImages[e.level];
  if(!img?.complete||!img.naturalWidth)return;
  const frame=EnemySprites.sample(e,game.time),p=project(e.x,e.y);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.translate(p.x,p.y);ctx.scale((e.facing??-1)*MAP_SCALE*SPRITE_SCALE,MAP_SCALE*SPRITE_SCALE);
  ctx.drawImage(img,frame.sx,frame.sy,frame.sw,frame.sh,-spec.anchor.x,-spec.anchor.y,spec.size,spec.size);
  ctx.restore();
  if(e.deathAt==null&&e.hp<e.maxHp){const width=spec.size*MAP_SCALE*SPRITE_SCALE,y=p.y-spec.anchor.y*MAP_SCALE*SPRITE_SCALE-4;ctx.fillStyle='#63574d30';ctx.fillRect(p.x-width/2,y,width,3);ctx.fillStyle='#678166';ctx.fillRect(p.x-width/2,y,width*e.hp/e.maxHp,3);}
}
function rectangle(x,y,width,height,fill,stroke) {
  const p=project(x-width/2,y-height/2);
  ctx.fillStyle=fill;ctx.fillRect(p.x,p.y,width*MAP_SCALE,height*MAP_SCALE);
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(p.x,p.y,width*MAP_SCALE,height*MAP_SCALE);}
}
function road(color,width) {
  ctx.beginPath();
  game.level.routes.forEach(route=>route.path.forEach((p,i)=>{
    const q=project(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);
  }));
  ctx.lineWidth=width*MAP_SCALE;ctx.lineJoin=game.levelIndex===0?'miter':'round';ctx.lineCap='butt';ctx.strokeStyle=color;ctx.stroke();
}
function rangeCircle(x,y,r,fill,stroke) {
  const p=project(x,y);ctx.beginPath();ctx.arc(p.x,p.y,r*MAP_SCALE,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}
}
function draw() {
  ctx.clearRect(0,0,viewWidth,viewHeight);
  const map=game.level.mapConfig;
  if(game.levelIndex===0){
    if(firstLevelBackground){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(firstLevelBackground.canvas,mapOrigin.x,mapOrigin.y,map.width*MAP_SCALE,map.height*MAP_SCALE);ctx.restore();}
    else rectangle(map.width/2,map.height/2,map.width,map.height,'#718b3d');
  }else{
    rectangle(500,405,1030,845,'#dce1cf','#bcc8b2');
    road('#aeb7a7',map.roadWidth);road('#d2d4cc',map.roadWidth-2);
    ctx.save();ctx.setLineDash([3,13]);road('#b7beb0',1.4);ctx.restore();
  }
  if(map.debugGrid){
    ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle='#9cae91';ctx.lineWidth=.5;
    for(let col=0;col<=map.cols;col++){const a=project(col*map.tileSize,0),b=project(col*map.tileSize,map.height);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(let row=0;row<=map.rows;row++){const a=project(0,row*map.tileSize),b=project(map.width,row*map.tileSize);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.restore();
  }
  if(selected!==null){const s=game.slots[selected];rangeCircle(s.x,s.y,TD.TOWERS[Math.max(1,s.level)].range*game.worldScale,'#537d6c0d','#72958365');}
  for(const s of game.slots) {
    const active=s.id===selected||s.id===hovered,p=project(s.x,s.y);
    if(environmentImages.buildPad?.complete&&environmentImages.buildPad.naturalWidth){
      const pad=environmentImages.buildPad,w=map.towerSlotSize/game.worldScale*1.15*MAP_SCALE*SPRITE_SCALE,h=w*pad.naturalHeight/pad.naturalWidth;
      ctx.save();ctx.imageSmoothingEnabled=false;if(active){ctx.shadowColor='#ffeda1';ctx.shadowBlur=7;}ctx.drawImage(pad,p.x-w/2,p.y-h/2,w,h);ctx.restore();
    }else if(!s.level){
      ctx.strokeStyle=active?'#426e57':'#97ab8a';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke();
    }
  }
  const actors=[...game.slots.filter(s=>s.level).map(s=>({y:s.y+map.towerSlotSize*.35,draw:()=>drawTower(s)})),...[...game.corpses,...game.enemies].map(e=>({y:e.y,draw:()=>drawEnemy(e)}))];
  actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());
  for(const b of game.bullets){
    const p=project(b.x,b.y),angle=Math.atan2(b.target.y-b.y,b.target.x-b.x),scale=MAP_SCALE*SPRITE_SCALE*.5;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.imageSmoothingEnabled=false;
    // The tip follows the existing projectile position; flight and damage stay in the engine.
    ctx.drawImage(arrowImage,-30*scale,-6*scale,32*scale,12*scale);ctx.restore();
  }
  for(const e of game.effects){
    if(e.kind==='bomb-explosion')continue; // The bomber's death sprite supplies the explosion animation.
    if(e.kind==='demolition'){const place=TowerSprites.placement(e.level,game.level.mapConfig.towerSlotSize,game.worldScale),p=project(e.x,e.y+place.groundOffset);TowerWork.debris(ctx,p.x,p.y,place.width*MAP_SCALE*SPRITE_SCALE,e.duration-e.life+3,e.material,e.life/e.duration);continue;}
    const p=project(e.x,e.y);ctx.beginPath();ctx.lineWidth=2;
    if(e.kind==='enemy-attack'){
      const target=project(e.toX,e.toY);ctx.moveTo(p.x,p.y);ctx.lineTo(target.x,target.y);
      ctx.strokeStyle=`rgba(219,132,40,${e.life/.18})`;
    }else{
      ctx.arc(p.x,p.y,(12+(1-e.life/.5)*19)*MAP_SCALE,0,Math.PI*2);
      ctx.strokeStyle=e.kind==='kill'?`rgba(191,110,84,${e.life*1.7})`:`rgba(205,64,57,${e.life*1.7})`;
    }
    ctx.stroke();
  }
  if(paused){ctx.fillStyle='#e6e8dcb0';ctx.fillRect(0,0,viewWidth,viewHeight);ctx.font='500 26px Microsoft JhengHei';ctx.fillStyle='#3b6b60';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('已暫停',viewWidth/2,viewHeight/2);}
}
function resize(){const map=game.level.mapConfig;viewWidth=game.levelIndex===0?map.width:1040;viewHeight=game.levelIndex===0?map.height:770;MAP_SCALE=game.levelIndex===0?.95:.84;mapOrigin=game.levelIndex===0?{x:32,y:19}:{x:100,y:49};const bounds=canvas.parentElement.getBoundingClientRect();if(!bounds.width||!bounds.height)return;const scale=Math.min(bounds.width/viewWidth,bounds.height/viewHeight);const width=viewWidth*scale,height=viewHeight*scale;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));ctx.setTransform(canvas.width/viewWidth,0,0,canvas.height/viewHeight,0,0);draw();}
function pick(event) {
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*viewWidth,y=(event.clientY-rect.top)/rect.height*viewHeight;
  const pad=environmentImages.buildPad,w=game.level.mapConfig.towerSlotSize/game.worldScale*1.15*MAP_SCALE*SPRITE_SCALE,h=w*(pad?.naturalHeight/pad?.naturalWidth||.8);
  let picked=null,nearest=Infinity;
  // Enlarged neighboring pads can overlap: select the closest pad center in that area.
  for(const s of game.slots){const p=project(s.x,s.y),dx=Math.abs(p.x-x),dy=Math.abs(p.y-y),distance=dx*dx+dy*dy;if(dx<=w/2&&dy<=h/2&&distance<nearest){picked=s.id;nearest=distance;}}
  return picked;
}
function select(id) {
  selected=id;
  observedAction=null;
  $('feedback').textContent='';
  updatePanel();draw();
}
function updatePanel() {
  const s=selected===null?null:game.slots[selected], level=s?.level||0;
  const spec=TD.TOWERS[Math.max(1,level)],action=s?.action,busy=!!action;
  if(observedAction?.slot!==selected)observedAction=null;
  if(action)observedAction={slot:selected,action};
  else if(observedAction){
    const finished=observedAction.action;
    $('feedback').textContent=s?.destroyedAt!==null?'箭塔被摧毀，作業已中止。':finished.kind==='demolish'?`拆除完成，返還 ${finished.refund} 金幣。`:`${TowerWork.labels[finished.kind]}完成，生命已回復至 100 HP。`;
    observedAction=null;
  }
  $('tower-title').textContent=!s?'點選地形':level?`箭塔 · ${level} 級`:'可建造的建築';
  $('tower-copy').textContent=!s?'點選方形底座，查看可建造的建築。':busy?'作業期間停止攻擊，仍會受到敵人傷害。':level===3?'滿級塔可花費 50 金幣修復至 100 HP。':level?'升級需 5 秒並回滿 HP；拆除需 3 秒，返還 50% 花費。':s.destroyedAt!==null?'箭塔已被摧毀，可在此重新建造。':'點選箭塔，在目前底座建造。';
  $('tower-work').hidden=!busy;$('tower-progress').hidden=!busy;
  if(action){
    const remaining=(action.duration-action.elapsed).toFixed(1),progress=action.elapsed/action.duration,ring=$('tower-progress'),ringCtx=ring.getContext('2d');
    $('tower-work').textContent=`${TowerWork.labels[action.kind]}中 · 剩餘 ${remaining} 秒 · 停止攻擊`;
    ring.setAttribute('aria-valuenow',Math.round(progress*100));ring.setAttribute('aria-valuetext',`${TowerWork.labels[action.kind]}中，剩餘 ${remaining} 秒`);
    ringCtx.clearRect(0,0,48,48);TowerWork.drawProgress(ringCtx,24,24,progress);
  }
  $('tower-health').hidden=!level;
  $('tower-health').textContent=`生命 ${level?s.hp:TD.TOWER_MAX_HP} / ${TD.TOWER_MAX_HP} HP`;
  $('building-options').hidden=!s||level>0;
  $('tower-actions').hidden=!level;
  $('tower-stats').hidden=!s;
  $('damage').textContent=spec.damage;
  $('range').textContent=spec.range*game.worldScale;
  $('level').textContent=`${Math.max(1,level)} / 3`;
  $('build').disabled=game.phase!=='playing'||game.money<TD.TOWERS[1].cost;
  const next=TD.TOWERS[Math.min(3,level+1)];
  $('upgrade').hidden=level===3;
  $('upgrade').disabled=busy||level===3||game.money<next.cost||game.phase!=='playing';
  $('upgrade').textContent=`升至 ${level+1} 級 · ${next.cost} 金幣 · 5 秒`;
  $('repair').hidden=level!==3;
  $('repair').disabled=busy||s?.hp>=s?.maxHp||game.money<TD.TOWER_ACTIONS.repair.cost||game.phase!=='playing';
  $('repair').textContent=s?.hp>=s?.maxHp?'生命已滿':'修復 · 50 金幣 · 3 秒';
  $('demolish').disabled=busy||game.phase!=='playing';
  $('demolish').textContent=`拆除 · 3 秒 · 返還 ${TD.refundFor(level)} 金幣`;
}
function updateUI() {
  updateHearts();$('money').textContent=game.money;
  $('wave').innerHTML=`${game.wave} <small>/ ${TD.WAVES.length}</small>`;
  $('status').textContent=paused?'已暫停':game.countdown>0?`${game.wave===0?'部署箭塔':'下一波準備中'} · ${Math.ceil(game.countdown)} 秒`:`第 ${game.wave} 波 · 剩餘 ${game.enemies.length+game.spawnQueue.length} 個敵人`;
  updatePanel();
  if(game.phase==='won'||game.phase==='lost') {
    $('result').hidden=false;
    $('result-level').textContent=game.level.name;
    $('result-title').textContent=game.phase==='won'?'防線守住了':'防線失守';
    $('result-copy').textContent=game.phase==='won'?`完成全部 ${TD.WAVES.length} 波攻勢，擊敗 ${game.kills} 個敵人，剩餘 ${game.lives} 顆愛心。`:`抵擋到第 ${game.wave} 波，擊敗 ${game.kills} 個敵人。試著在道路轉折處部署更多箭塔。`;
    $('next-level').hidden=game.phase!=='won'||game.levelIndex>=TD.LEVELS.length-1;
  }
}
function updateHearts(){const lives=$('lives');lives.setAttribute('aria-label',`剩餘生命 ${game.lives} / 3`);lives.querySelectorAll('.heart').forEach((heart,index)=>heart.classList.toggle('is-lost',index>=game.lives));}
function begin(levelIndex=0) {
  $('start-screen').hidden=true;$('game').hidden=false;$('result').hidden=true;
  StartScreen.stop();
  game.start(levelIndex);selected=null;hovered=null;observedAction=null;paused=false;speed=StartScreen.settings.speed;
  $('speed').textContent=`${speed}×`;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暫停遊戲');
  $('feedback').textContent='';
  TD.LEVELS.forEach((_,i)=>$(`level-${i+1}`).setAttribute('aria-pressed',String(i===levelIndex)));
  document.title=`幾何防線 · ${game.level.name}`;
  canvas.setAttribute('aria-label',`${game.level.name}，點選底座建造箭塔；方向鍵選擇底座，Enter 確認`);
  resize();updateUI();canvas.focus({preventScroll:true});
}
function performBuild(){if(selected===null)return;const result=game.build(selected);$('feedback').textContent=result.message;updateUI();draw();return result;}
function performDemolish(){if(selected===null)return;const result=game.demolish(selected);$('feedback').textContent=result.message;updateUI();draw();return result;}
function performRepair(){if(selected===null)return;const result=game.repair(selected);$('feedback').textContent=result.message;updateUI();draw();return result;}
$('start').addEventListener('click',()=>LevelSelect.show());
$('restart').addEventListener('click',()=>begin(game.levelIndex));
$('next-level').addEventListener('click',()=>{if(game.phase==='won'&&game.levelIndex<TD.LEVELS.length-1)begin(game.levelIndex+1);});
TD.LEVELS.forEach((_,i)=>$(`level-${i+1}`).addEventListener('click',()=>begin(i)));
$('build').addEventListener('click',()=>{if(selected!==null&&!game.slots[selected].level)performBuild();});
$('upgrade').addEventListener('click',()=>{if(selected!==null&&game.slots[selected].level)performBuild();});
$('demolish').addEventListener('click',performDemolish);
$('repair').addEventListener('click',performRepair);
canvas.addEventListener('click',e=>select(pick(e)));
canvas.addEventListener('pointermove',e=>{hovered=pick(e);canvas.style.cursor=hovered===null?'default':'pointer';});
canvas.addEventListener('pointerleave',()=>{hovered=null;});
canvas.addEventListener('keydown',e=>{
  if(e.key==='Escape'){select(null);return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(selected===null)select(0);else (game.slots[selected].level===3?$('repair'):game.slots[selected].level?$('upgrade'):$('build')).focus();return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();
  if(selected===null){select(0);return;}
  const s=game.slots[selected],direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  const candidates=game.slots.filter(t=>(t.x-s.x)*direction[0]+(t.y-s.y)*direction[1]>0);
  candidates.sort((a,b)=>{const score=t=>Math.hypot(t.x-s.x,t.y-s.y)+Math.abs((t.x-s.x)*direction[1]-(t.y-s.y)*direction[0])*2;return score(a)-score(b);});
  if(candidates.length)select(candidates[0].id);
});
$('speed').addEventListener('click',()=>{speed=speed===1?2:1;$('speed').textContent=`${speed}×`;});
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'繼續遊戲':'暫停遊戲');updateUI();});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.phase==='playing'&&!paused)$('pause').click();});
new ResizeObserver(resize).observe(canvas.parentElement);
let uiTimer=0;
function frame(now){const dt=Math.min((now-last)/1000,.06);last=now;if(!$('game').hidden){if(!paused){let remaining=dt*speed;while(remaining>0){const step=Math.min(remaining,1/60);game.update(step);remaining-=step;}}uiTimer+=dt;if(uiTimer>.12){updateUI();uiTimer=0;}draw();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
if(document.modelContext?.registerTool) {
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_defense_state',description:'Read the current level, tower operations, coins, lives, and enemy route choices.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({phase:game.phase,level:game.levelIndex+1,wave:game.wave,money:game.money,lives:game.lives,slots:game.slots.map(({id,level,hp,maxHp,action})=>({id,level,hp,maxHp,action:action?{kind:action.kind,remaining:action.duration-action.elapsed}:null})),enemies:game.enemies.map(({id,routeIndex,targetId})=>({id,routeIndex,targetId}))})});
  const schema={type:'object',properties:{slotId:{type:'integer',minimum:0}},required:['slotId'],additionalProperties:false};
  const validate=input=>{if(!input||!Number.isInteger(input.slotId)||!game.slots[input.slotId])throw new Error('Invalid slotId');select(input.slotId);};
  register({name:'build_or_upgrade_tower',description:'Spend coins to build a tower immediately or begin a five-second upgrade that suspends attacks.',inputSchema:schema,annotations:{readOnlyHint:false},execute:input=>{validate(input);const result=performBuild();return{...result,money:game.money,level:game.slots[input.slotId].level};}});
  register({name:'repair_tower',description:'Spend 50 coins to repair a damaged level-three tower to 100 HP over three seconds, suspending attacks.',inputSchema:schema,annotations:{readOnlyHint:false},execute:input=>{validate(input);return{...performRepair(),money:game.money};}});
  register({name:'demolish_tower',description:'Begin a three-second demolition that suspends attacks. Refund 50 percent of build and upgrade costs only on completion.',inputSchema:schema,annotations:{readOnlyHint:false},execute:input=>{validate(input);return{...performDemolish(),money:game.money};}});
}
