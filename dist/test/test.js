(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('test-stage'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, catalog = [], objects = [], history = [];
  const names = {oak:'橡樹',roundTree:'圓冠樹',birch:'白樺樹',pine:'松樹',limeTree:'嫩綠樹',oldOak:'古老橡樹',goldTree:'金葉樹',sapling:'幼苗',youngTree:'幼樹',smallTree:'小樹',smallOak:'小橡樹',bush:'灌木',flowers:'花叢',orangeBush:'橙花灌木',berryBush:'莓果灌木',log:'橫木',boulders:'巨石群',standingRock:'立石',rockCluster:'岩石群',mossRock:'苔蘚岩石',rock:'岩石',pebble:'小石',lowRock:'矮石',stump:'樹樁',fallenLog:'倒木',grass:'草地',grassDirt:'草土地',dirt:'泥土',meadow:'草甸',flowerGrass:'花草地',fern:'蕨類',tuft:'草叢',reeds:'蘆葦',whiteFlowers:'白花',pinkFlowers:'粉花',buildPad:'建造底座'};
  let asset = null, category = 'enemy', mode = 'place', selected = null, facing = 1, ready = false;
  let time = 0, previous = 0, paused = false, pointer = null, dragging = null, nextId = 1;
  let simulation=null;
  const description={4:'炸彈哥布林 · 60 HP · 不普攻，追向最近的塔；接近或被擊殺時爆炸，對範圍內的塔與其他怪物造成 60 傷害。',5:'史萊姆 · 32 HP · 普通移速，不攻擊，沿路前進；第一波的新手敵人。'};
  const arrowImage=new Image();arrowImage.src='assets/projectiles/arrow.png';
  const ground = document.createElement('canvas'); ground.width=W;ground.height=H;
  function status(message){$('lab-status').textContent=message;}
  function record(){history.push(objects.map(o=>({...o})));if(history.length>50)history.shift();}
  function current(){return objects.find(o=>o.id===selected);}
  function update(){
    $('object-count').textContent=`${objects.length} 個物件`;
    $('empty-hint').hidden=objects.length>0;
    $('undo').disabled=!!simulation||!history.length;$('remove').disabled=!!simulation||!current();$('clear').disabled=!!simulation||!objects.length;
    const item=current();
    $('selection-label').textContent=item?`選取：${item.asset.name}`:asset?`放置素材：${asset.name}`:'尚未選擇素材';
    const active=(item?item.asset:asset),states=active?.animations||EnemySprites.animations;
    for(const option of $('enemy-animation').options)option.disabled=!states[option.value];
    if(!states[$('enemy-animation').value])$('enemy-animation').value='walk';
    $('enemy-animation').disabled=!!simulation||active?.category!=='enemy';
    $('enemy-description').textContent=active?.category==='enemy'?(description[active.level]||'沿路前進，攻擊範圍內最近的箭塔。'):'';
    $('simulate').disabled=!ready||(!simulation&&!objects.some(o=>o.asset.category==='enemy'));
    $('simulate').textContent=simulation?'結束行為測試':'開始行為測試';$('simulate').setAttribute('aria-pressed',String(!!simulation));
    $('kill-enemy').disabled=!simulation||!simulation.enemies.some(e=>e.id===selected&&e.hp>0);
    for(const id of ['object-scale','flip-object','tool-place','bomber-demo'])$(id).disabled=!ready||!!simulation;
    document.querySelectorAll('.asset-card,[data-category]').forEach(button=>button.disabled=!!simulation);
    $('tool-place').setAttribute('aria-pressed',String(mode==='place'));
    $('tool-move').setAttribute('aria-pressed',String(mode==='move'));
    canvas.style.cursor=mode==='place'?'crosshair':dragging?'grabbing':'grab';
  }
  function setMode(value){mode=value;pointer=null;update();status(mode==='place'?'點選畫布放置素材；可連續放置。':'點選物件以選取，拖曳可移動。');}
  function pickAsset(item){if(simulation)return;asset=item;selected=null;setMode('place');renderPalette();update();}
  function renderPalette(){
    $('asset-list').replaceChildren();
    const items=catalog.filter(item=>item.category===category);
    $('asset-count').textContent=`${items.length} 個素材`;
    document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));
    for(const item of items){
      const button=document.createElement('button');button.className='asset-card';button.setAttribute('aria-pressed',String(asset===item));button.setAttribute('aria-label',`選擇${item.name}`);
      const icon=document.createElement('canvas');icon.width=128;icon.height=116;icon.setAttribute('aria-hidden','true');
      const ic=icon.getContext('2d');ic.imageSmoothingEnabled=false;
      const scale=Math.min(104/item.width,104/item.height);
      ic.drawImage(item.image,0,0,item.width,item.height,Math.round((128-item.width*scale)/2),Math.round((116-item.height*scale)/2),Math.round(item.width*scale),Math.round(item.height*scale));
      const title=document.createElement('b');title.textContent=item.name;
      const dimensions=document.createElement('small');dimensions.textContent=`${item.width} × ${item.height} px`;
      button.append(icon,title,dimensions);button.addEventListener('click',()=>pickAsset(item));$('asset-list').append(button);
    }
  }
  function bounds(o){return{x:o.x-o.asset.anchor.x*o.scale,y:o.y-o.asset.anchor.y*o.scale,w:o.asset.width*o.scale,h:o.asset.height*o.scale};}
  function paint(o,alpha=1){
    const a=o.asset;let frame=0;
    if(a.category==='enemy'){
      if(o.unit)frame=EnemySprites.sample(o.unit,time).index;
      else{const animation=(a.animations||EnemySprites.animations)[o.animation]||a.animations.walk,elapsed=Math.max(0,time-o.started);
        const tick=Math.floor(elapsed*animation.fps);frame=animation.start+(animation.loop?tick%animation.count:Math.min(tick,animation.count-1));}
    }
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(o.x,o.y);ctx.scale(o.facing*o.scale,o.scale);
    ctx.drawImage(a.image,frame*a.width,0,a.width,a.height,-a.anchor.x,-a.anchor.y,a.width,a.height);ctx.restore();
  }
  function visibleObjects(){
    if(!simulation)return objects;
    const scene=objects.filter(o=>o.asset.category==='environment');
    for(const s of simulation.slots)if(s.level){const o=objects.find(o=>o.id===s.objectId);scene.push({...o,unit:s});}
    for(const e of [...simulation.enemies.filter(e=>e.hp>0),...simulation.corpses]){const o=objects.find(o=>o.id===e.id);scene.push({...o,x:e.x,y:e.y,facing:e.facing??1,unit:e});}
    return scene;
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    const background=$('stage-background').value;
    if(background==='forest')ctx.drawImage(ground,0,0);
    else if(background==='dark'){ctx.fillStyle='#121e19';ctx.fillRect(0,0,W,H);}
    else for(let y=0;y<H;y+=24)for(let x=0;x<W;x+=24){ctx.fillStyle=(x/24+y/24)%2?'#bbc1ad':'#dce0cc';ctx.fillRect(x,y,24,24);}
    if($('show-grid').checked){ctx.strokeStyle=background==='dark'?'#ffffff15':'#213b2b25';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<W;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);}for(let y=0;y<H;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}ctx.stroke();}
    const scene=visibleObjects();
    [...scene].sort((a,b)=>a.y-b.y||a.id-b.id).forEach(o=>{
      paint(o);if(o.unit&&o.unit.deathAt==null){const b=bounds(o);ctx.fillStyle='#17241d';ctx.fillRect(o.x-24,b.y-12,48,4);ctx.fillStyle='#8fcd68';ctx.fillRect(o.x-24,b.y-12,48*o.unit.hp/o.unit.maxHp,4);ctx.fillStyle='#f1e4c5';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(`${o.unit.hp} HP`,o.x,b.y-17);}
    });
    if(simulation&&arrowImage.complete&&arrowImage.naturalWidth)for(const b of simulation.bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrowImage,-30,-6,32,12);ctx.restore();}
    const item=scene.find(o=>o.id===selected);
    if(item){const b=bounds(item);ctx.strokeStyle='#ffe199';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);ctx.setLineDash([]);ctx.fillStyle='#ffe199';ctx.fillRect(item.x-3,item.y-3,6,6);}
    if(!simulation&&mode==='place'&&pointer&&asset){paint({asset,x:pointer.x,y:pointer.y,scale:Number($('object-scale').value),facing,animation:$('enemy-animation').value,started:time},.55);}
  }
  function coordinates(event){const rect=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(W,(event.clientX-rect.left)*W/rect.width)),y:Math.max(0,Math.min(H,(event.clientY-rect.top)*H/rect.height))};}
  function place(p){
    if(!ready||!asset||simulation)return;
    if(objects.length>=150){status('測試場景最多放置 150 個物件，請先移除部分物件。');return;}
    record();objects.push({id:nextId++,asset,x:Math.round(p.x),y:Math.round(p.y),scale:Number($('object-scale').value),facing,animation:$('enemy-animation').value,started:time});selected=null;update();status(`已放置${asset.name}，可繼續點選畫布放置。`);
  }
  function hit(p){return [...visibleObjects()].sort((a,b)=>b.y-a.y||b.id-a.id).find(o=>{const b=bounds(o);return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||!ready)return;event.preventDefault();canvas.focus({preventScroll:true});pointer=coordinates(event);
    if(simulation){selected=hit(pointer)?.id??null;update();return;}
    if(mode==='place'){place(pointer);return;}
    const item=hit(pointer);selected=item?.id??null;
    if(item){$('object-scale').value=String(item.scale);$('enemy-animation').value=item.animation;dragging={id:item.id,dx:pointer.x-item.x,dy:pointer.y-item.y,original:objects.map(o=>({...o})),changed:false};canvas.setPointerCapture(event.pointerId);status(`已選取${item.asset.name}；拖曳移動，Delete 移除。`);}else status('此處沒有物件，請點選素材。');update();
  });
  canvas.addEventListener('pointermove',event=>{pointer=coordinates(event);if(dragging){const item=current();if(item){const x=Math.round(Math.max(0,Math.min(W,pointer.x-dragging.dx))),y=Math.round(Math.max(0,Math.min(H,pointer.y-dragging.dy)));if(x!==item.x||y!==item.y)dragging.changed=true;item.x=x;item.y=y;}}});
  function finishDrag(cancel=false){if(!dragging)return;if(cancel){objects.splice(0,objects.length,...dragging.original);}else if(dragging.changed){history.push(dragging.original);if(history.length>50)history.shift();}dragging=null;update();}
  canvas.addEventListener('pointerup',event=>{finishDrag();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(event.pointerType!=='mouse')pointer=null;});
  canvas.addEventListener('pointercancel',()=>{finishDrag(true);pointer=null;});
  canvas.addEventListener('lostpointercapture',()=>finishDrag());
  canvas.addEventListener('pointerleave',()=>{if(!dragging)pointer=null;});
  $('tool-place').addEventListener('click',()=>setMode('place'));$('tool-move').addEventListener('click',()=>setMode('move'));
  $('remove').addEventListener('click',()=>{if(!current())return;record();objects.splice(objects.findIndex(o=>o.id===selected),1);selected=null;update();status('已移除物件，可按復原恢復。');});
  $('clear').addEventListener('click',()=>{if(!objects.length)return;record();objects.length=0;selected=null;update();status('已清空場景，可按復原恢復。');});
  $('undo').addEventListener('click',()=>{if(!history.length)return;objects.splice(0,objects.length,...history.pop());selected=null;update();status('已復原上一步。');});
  $('object-scale').addEventListener('change',()=>{const item=current();if(item){record();item.scale=Number($('object-scale').value);status(`已調整${item.asset.name}為 ${item.scale} 倍。`);update();}});
  $('enemy-animation').addEventListener('change',()=>{const item=current();if(item?.asset.category==='enemy'){record();item.animation=$('enemy-animation').value;item.started=time;update();}status('已切換怪物動作；攻擊、受傷與死亡動作播放一次。');});
  $('flip-object').addEventListener('click',()=>{const item=current();if(item){record();item.facing*=-1;}else facing*=-1;update();status(item?'已翻轉選取物件。':'已翻轉接下來放置素材的方向。');});
  $('play-animation').addEventListener('click',()=>{paused=!paused;$('play-animation').textContent=paused?'播放動畫':'暫停動畫';$('play-animation').setAttribute('aria-pressed',String(paused));});
  $('simulate').addEventListener('click',()=>{
    if(simulation){simulation=null;objects.forEach(o=>o.started=time);status('已結束測試並還原原始擺放。');$('simulation-status').textContent='放置塔與怪物後，可測試追塔、自爆與範圍傷害。';update();return;}
    if(!objects.some(o=>o.asset.category==='enemy'))return;
    const sim=new TD.Game();sim.start();sim.worldScale=1;sim.countdown=1e9;sim.lives=150;sim.time=time;
    sim.level={...sim.level,routes:[],worldScale:1};
    sim.slots=objects.filter(o=>o.asset.category==='tower').map((o,id)=>({id,objectId:o.id,x:o.x,y:o.y,level:o.asset.level,hp:100,maxHp:100,cooldown:0,action:null,destroyedAt:null}));
    sim.enemies=objects.filter(o=>o.asset.category==='enemy').map(o=>{
      const spec=TD.ENEMIES[o.asset.level],routeIndex=sim.level.routes.length;
      sim.level.routes.push({path:[{x:0,y:o.y},{x:W,y:o.y}],segments:[W],length:W});
      return {id:o.id,level:o.asset.level,x:o.x,y:o.y,hp:spec.hp,maxHp:spec.hp,distance:o.x,remaining:W-o.x,routeIndex,facing:1,moving:true};
    });
    simulation=sim;paused=false;$('play-animation').textContent='暫停動畫';$('play-animation').setAttribute('aria-pressed','false');mode='move';pointer=null;
    status('行為測試中：點選怪物後可直接擊殺，驗證死亡爆炸。');update();
  });
  $('kill-enemy').addEventListener('click',()=>{const e=simulation?.enemies.find(e=>e.id===selected&&e.hp>0);if(e){simulation.damageEnemy(e,e.hp);status('已擊殺選取怪物；炸彈會立即造成範圍傷害。');update();}});
  $('tower-fire').addEventListener('change',()=>{if(simulation)simulation.slots.forEach(s=>s.cooldown=0);});
  $('bomber-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;
    for(const [type,level,x,y] of [['tower',1,680,300],['enemy',4,300,300],['enemy',5,335,315],['enemy',1,280,335]]){
      objects.push({id:nextId++,asset:catalog.find(a=>a.category===type&&a.level===level),x,y,scale:2,facing:1,animation:'walk',started:time});
    }
    selected=objects.find(o=>o.asset.level===4&&o.asset.category==='enemy').id;mode='move';$('tower-fire').checked=false;update();
    status('範例已載入。開始行為測試可看追塔自爆；立即擊殺炸彈哥布林可看波及旁邊怪物。');
  });
  document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{if(!ready)return;category=button.dataset.category;pickAsset(catalog.find(item=>item.category===category));}));
  document.addEventListener('keydown',event=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();$('undo').click();}
    if(event.key==='Delete'&&current()){event.preventDefault();$('remove').click();}
  });
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Escape'){selected=null;pointer=null;update();return;}
    if(simulation)return;
    if(mode==='place'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();place(pointer||{x:W/2,y:H/2});return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const [dx,dy]={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(mode==='place'){pointer=pointer||{x:W/2,y:H/2};pointer={x:Math.max(0,Math.min(W,pointer.x+dx)),y:Math.max(0,Math.min(H,pointer.y+dy))};}
    else if(current()){record();current().x=Math.max(0,Math.min(W,current().x+dx));current().y=Math.max(0,Math.min(H,current().y+dy));update();}
  });
  function resize(){const bounds=$('stage-wrap').getBoundingClientRect(),scale=Math.min(bounds.width/W,bounds.height/H);canvas.style.width=`${Math.max(1,W*scale)}px`;canvas.style.height=`${Math.max(1,H*scale)}px`;}
  new ResizeObserver(resize).observe($('stage-wrap'));
  function load(category,name,file,spec,level){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const width=spec?.size||image.naturalWidth,height=spec?.size||image.naturalHeight;resolve({category,name,image,width,height,level,animations:spec?.animations,anchor:spec?.anchor||{x:width/2,y:height-2}});};image.onerror=()=>reject(new Error(`無法載入 ${file}`));image.src=file;});}
  const loads=[];
  for(const level of [5,1,2,3,4]){const spec=EnemySprites.specs[level];loads.push(load('enemy',spec.name||['','Lv1 哥布林','Lv2 獸人','Lv3 獨眼巨人'][level],`assets/enemies/${spec.file}`,spec,level));}
  TowerSprites.specs.slice(1).forEach((spec,i)=>loads.push(load('tower',['Lv1 木造箭塔','Lv2 石造箭塔','Lv3 強化箭塔'][i],`assets/towers/${spec.file}`,spec,i+1)));
  Environment.names.forEach(name=>loads.push(load('environment',names[name]||name,`assets/environment/${name}.png`)));
  Promise.all(loads).then(items=>{
    catalog.push(...items);const gc=ground.getContext('2d');gc.imageSmoothingEnabled=false;gc.fillStyle='#718b3d';gc.fillRect(0,0,W,H);
    const grass=catalog.find(item=>item.name===names.grass).image;
    gc.globalAlpha=.5;for(let y=0;y<H;y+=64)for(let x=0;x<W;x+=64)gc.drawImage(grass,x,y,64,64);
    ready=true;pickAsset(catalog[0]);resize();status(`已載入 ${catalog.length} 個素材。從下方選擇素材，再點畫布放置。`);
  }).catch(error=>{status(`${error.message}，請重新整理。`);$('selection-label').textContent='素材載入失敗';console.error(error);});
  function frame(now){
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!paused&&!document.hidden){time+=dt;if(simulation){
      if(!$('tower-fire').checked)simulation.slots.forEach(s=>s.cooldown=Infinity);
      let left=dt;while(left>0){const step=Math.min(left,1/60);simulation.update(step);left-=step;}
    }}
    if(simulation){$('simulation-status').textContent=`存活怪物 ${simulation.enemies.filter(e=>e.hp>0).length} · 存活塔 ${simulation.slots.filter(s=>s.level).length} · 塔生命 ${simulation.slots.reduce((sum,s)=>sum+s.hp,0)} HP · 擊殺 ${simulation.kills}`;$('kill-enemy').disabled=!simulation.enemies.some(e=>e.id===selected&&e.hp>0);}
    if(ready&&!document.hidden)draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
