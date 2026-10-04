(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('test-stage'), ctx = canvas.getContext('2d');
  // Share the actual game's map dimensions; display resizing never resets scene coordinates.
  canvas.width = TD.MAP_CONFIG.width;
  canvas.height = TD.MAP_CONFIG.height;
  $('stage-size').textContent = `${canvas.width} × ${canvas.height}`;
  const W = canvas.width, H = canvas.height, catalog = [], objects = [], history = [];
  const names = {oak:'橡樹',roundTree:'圓冠樹',birch:'白樺樹',pine:'松樹',limeTree:'嫩綠樹',oldOak:'古老橡樹',goldTree:'金葉樹',sapling:'幼苗',youngTree:'幼樹',smallTree:'小樹',smallOak:'小橡樹',bush:'灌木',flowers:'花叢',orangeBush:'橙花灌木',berryBush:'莓果灌木',log:'橫木',boulders:'巨石群',standingRock:'立石',rockCluster:'岩石群',mossRock:'苔蘚岩石',rock:'岩石',pebble:'小石',lowRock:'矮石',stump:'樹樁',fallenLog:'倒木',grass:'草地',grassDirt:'草土地',dirt:'泥土',meadow:'草甸',flowerGrass:'花草地',fern:'蕨類',tuft:'草叢',reeds:'蘆葦',whiteFlowers:'白花',pinkFlowers:'粉花',buildPad:'建造底座'};
  let asset = null, category = 'enemy', mode = 'place', selected = null, facing = 1, ready = false;
  let time = 0, previous = 0, paused = false, pointer = null, dragging = null, nextId = 1;
  let simulation=null;
  const description={2:'獸人 · 112 HP · 出場衝鋒，速度為原速 1.5 倍；首次撞塔或城牆造成 120 傷害，之後恢復原速，每秒普攻 10 傷害。',4:'炸彈哥布林 · 60 HP · 不普攻，追向最近的塔；接近或被擊殺時爆炸，對範圍內的塔與其他怪物造成 60 傷害。',5:'史萊姆 · 32 HP · 普通移速，不攻擊，沿路前進。',6:'哥布林弓箭手 · 40 HP · 射程內停下拉弓，每 1.4 秒射一箭，命中塔時造成 6 傷害。'};
  const arrowImage=new Image();arrowImage.src='assets/projectiles/arrow.png';
  const wallImages={};
  const bombImages={};
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
    $('enemy-description').textContent=active?.category==='enemy'?(description[active.level]||'判定範圍內有塔就鎖定最近一座，靠近後停下攻擊；摧毀後繼續搜尋附近的塔，沒有目標才回到路線。'):'';
    if(active?.category==='wall')$('enemy-description').textContent='城牆 · 300 HP · 敵人優先攻擊 · 無法修復。測試場可自由擺放，正式關卡每場限 3 個、每個 100 金幣。';
    if(active?.category==='bomb-tower'){const s=BombTowers.specs[active.level];$('enemy-description').textContent=`炸彈塔 Lv.${active.level} · ${s.hp} HP · 攻擊距離 55～125 px · 爆炸半徑 ${s.blastRadius} px · 傷害 ${s.damage} · 每 ${s.interval} 秒投彈。會傷害友軍與自己；距離小於 55 不投彈。勾選「塔可射擊」開始測試。`;}
    if(active?.category==='enemy')$('enemy-description').textContent+=' 附近城牆優先；史萊姆也會攻擊城牆。';
    if(active?.category==='enemy'){
      const r=TD.enemyRanges(active.level,simulation?.worldScale||1);
      $('enemy-description').textContent+=r.attack?` 判定半徑 ${r.detection} px；攻擊半徑 ${r.attack} px。`:r.blast?` 引爆距離 ${r.trigger} px；爆炸半徑 ${r.blast} px。`:' 攻擊半徑 0 px。';
    }
    $('simulate').disabled=!ready||(!simulation&&!objects.some(o=>o.asset.category==='enemy'));
    $('simulate').textContent=simulation?'結束行為測試':'開始行為測試';$('simulate').setAttribute('aria-pressed',String(!!simulation));
    $('kill-enemy').disabled=!simulation||!simulation.enemies.some(e=>e.id===selected&&e.hp>0);
    for(const id of ['object-scale','flip-object','tool-place','bomber-demo','bomb-tower-demo'])$(id).disabled=!ready||!!simulation;
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
      if(item.category==='wall')WallSprites.draw(ic,item.image,{x:64,y:58,orientation:item.orientation,...TD.wallSize(item.orientation,2,80)},2);
      else if(item.category==='bomb-tower')BombTowerSprites.draw(ic,bombImages,{x:64,y:110,level:item.level},Math.min(1.4,104/item.width),0);
      else ic.drawImage(item.image,0,0,item.width,item.height,Math.round((128-item.width*scale)/2),Math.round((116-item.height*scale)/2),Math.round(item.width*scale),Math.round(item.height*scale));
      const title=document.createElement('b');title.textContent=item.name;
      const dimensions=document.createElement('small');dimensions.textContent=item.category==='wall'?'80 px 道路寬度（2 倍）':`${item.width} × ${item.height} px`;
      button.append(icon,title,dimensions);button.addEventListener('click',()=>pickAsset(item));$('asset-list').append(button);
    }
  }
  function labWall(o){return o.unit||{...o,orientation:o.asset.orientation,hp:TD.WALL.hp,maxHp:TD.WALL.hp,...TD.wallSize(o.asset.orientation,o.scale,40*o.scale)};}
  function bounds(o){if(o.asset.category==='wall')return WallSprites.bounds(labWall(o),o.scale);return{x:o.x-o.asset.anchor.x*o.scale,y:o.y-o.asset.anchor.y*o.scale,w:o.asset.width*o.scale,h:o.asset.height*o.scale};}
  function paint(o,alpha=1){
    const a=o.asset;let frame=0;
    if(a.category==='bomb-tower'){BombTowerSprites.draw(ctx,bombImages,{...o,...o.unit,level:a.level},o.scale,time,alpha);return;}
    if(a.category==='wall'){
      const wall=labWall(o);
      WallSprites.draw(ctx,wallImages[`${a.orientation}-${WallSprites.stage(wall.hp,wall.maxHp)}`],wall,o.scale,alpha);return;
    }
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
    for(const w of simulation.walls){const o=objects.find(o=>o.id===w.objectId);scene.push({...o,unit:w});}
    for(const e of [...simulation.enemies.filter(e=>e.hp>0),...simulation.corpses]){const o=objects.find(o=>o.id===e.id);scene.push({...o,x:e.x,y:e.y,facing:e.facing??1,unit:e});}
    return scene;
  }
  function paintRanges(o,labels=false,alpha=1){
    if(o.asset.category!=='enemy'||o.animation==='death'&&!o.unit||o.unit&&(o.unit.hp<=0||o.unit.deathAt!=null))return;
    // Match combat distances in world coordinates, independent of sprite display scale.
    const r=TD.enemyRanges(o.asset.level,simulation?.worldScale||1);
    ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=2;
    if(!labels)for(const [radius,color,dash] of [[r.detection,'#79d9ef',[10,6]],[r.attack,'#ffcb70',[]],[r.blast,'#ff7777',[8,5]],[r.trigger,'#f9eea6',[3,3]]]){
      if(!radius||!Number.isFinite(radius))continue;
      ctx.beginPath();ctx.arc(o.x,o.y,radius,0,Math.PI*2);ctx.fillStyle=color+'12';ctx.fill();ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.stroke();
    }
    if(labels){
      const label=r.attack?`判定 ${r.detection} / 攻擊 ${r.attack} px`:r.blast?`引爆 ${r.trigger} / 爆炸 R ${r.blast} px`:'不攻擊 · R 0 px';
      ctx.setLineDash([]);ctx.font='16px "Fusion Pixel", "Microsoft JhengHei", sans-serif';ctx.textAlign='center';
      const width=ctx.measureText(label).width+16,x=Math.max(width/2+2,Math.min(W-width/2-2,o.x)),y=Math.min(H-24,o.y+12);
      ctx.fillStyle='#14241eee';ctx.fillRect(x-width/2,y,width,24);ctx.fillStyle=r.blast?'#ffaaaa':'#ffe0a0';ctx.fillText(label,x,y+18);
    }
    ctx.restore();
  }
  function paintBombRanges(o,alpha=1){
    if(o.asset.category!=='bomb-tower'||o.unit?.hp<=0)return;
    const r=BombTowers.ranges(o.asset.level,simulation?.worldScale||1);
    ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(o.x,o.y,r.min,0,Math.PI*2);ctx.fillStyle='#ec7b6722';ctx.fill();ctx.strokeStyle='#ef8d72';ctx.setLineDash([5,5]);ctx.stroke();
    ctx.beginPath();ctx.arc(o.x,o.y,r.max,0,Math.PI*2);ctx.strokeStyle='#f6d782';ctx.setLineDash([]);ctx.stroke();
    ctx.font='14px "Fusion Pixel"';ctx.textAlign='center';ctx.fillStyle='#fff0c4';ctx.strokeStyle='#1f2c20';ctx.lineWidth=3;const label=`投彈 ${r.min}～${r.max} · 爆炸 R ${r.blast}`;ctx.strokeText(label,o.x,o.y+r.max+19);ctx.fillText(label,o.x,o.y+r.max+19);ctx.restore();
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    const background=$('stage-background').value;
    if(background==='forest')ctx.drawImage(ground,0,0);
    else if(background==='dark'){ctx.fillStyle='#121e19';ctx.fillRect(0,0,W,H);}
    else for(let y=0;y<H;y+=24)for(let x=0;x<W;x+=24){ctx.fillStyle=(x/24+y/24)%2?'#bbc1ad':'#dce0cc';ctx.fillRect(x,y,24,24);}
    if($('show-grid').checked){ctx.strokeStyle=background==='dark'?'#ffffff15':'#213b2b25';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<W;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);}for(let y=0;y<H;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}ctx.stroke();}
    const scene=visibleObjects();
    const showRanges=$('show-enemy-ranges').checked;
    if(showRanges)scene.forEach(o=>paintRanges(o));
    if($('show-bomb-ranges').checked)scene.forEach(o=>paintBombRanges(o));
    [...scene].sort((a,b)=>a.y-b.y||a.id-b.id).forEach(o=>{
      paint(o);if(o.unit&&o.unit.hp>0&&o.unit.deathAt==null){if(o.asset.category==='wall'){WallSprites.drawHealth(ctx,o.unit,o.scale);return;}const b=bounds(o);ctx.fillStyle='#17241d';ctx.fillRect(o.x-24,b.y-12,48,4);ctx.fillStyle='#8fcd68';ctx.fillRect(o.x-24,b.y-12,48*o.unit.hp/o.unit.maxHp,4);ctx.fillStyle='#f1e4c5';ctx.font='11px "Fusion Pixel"';ctx.textAlign='center';ctx.fillText(`${o.unit.hp} HP`,o.x,b.y-17);}
    });
    if(simulation&&arrowImage.complete&&arrowImage.naturalWidth)for(const b of simulation.bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrowImage,-30,-6,32,12);ctx.restore();}
    if(simulation&&arrowImage.complete&&arrowImage.naturalWidth)for(const b of simulation.enemyArrows){ctx.save();ctx.translate(b.x,b.y-20);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrowImage,-24,-4.5,24,9);ctx.restore();}
    if(simulation){
      for(const b of simulation.bombs)BombTowerSprites.drawBomb(ctx,bombImages.bomb,b,simulation.time,simulation.worldScale);
      for(const e of simulation.effects)if(e.kind==='tower-bomb-explosion'){
        if($('show-bomb-ranges').checked){ctx.save();ctx.strokeStyle='#ff9b60';ctx.globalAlpha=e.life/e.duration;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);ctx.stroke();ctx.restore();}
        BombTowerSprites.drawExplosion(ctx,bombImages.explosion,e);
      }
    }
    const item=scene.find(o=>o.id===selected);
    if(item){const b=bounds(item);ctx.strokeStyle='#ffe199';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);ctx.setLineDash([]);ctx.fillStyle='#ffe199';ctx.fillRect(item.x-3,item.y-3,6,6);}
    if(showRanges&&item)paintRanges(item,true);
    if(!simulation&&mode==='place'&&pointer&&asset){const preview={asset,x:pointer.x,y:pointer.y,scale:Number($('object-scale').value),facing,animation:$('enemy-animation').value,started:time};if(showRanges)paintRanges(preview,true,.55);if($('show-bomb-ranges').checked)paintBombRanges(preview,.55);paint(preview,.55);}
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
  $('play-animation').addEventListener('click',()=>{paused=!paused;if(paused)window.gameSound.stopAll();$('play-animation').textContent=paused?'播放動畫':'暫停動畫';$('play-animation').setAttribute('aria-pressed',String(paused));});
  $('simulate').addEventListener('click',()=>{
    window.gameSound.stopAll();
    if(simulation){simulation=null;objects.forEach(o=>o.started=time);status('已結束測試並還原原始擺放。');$('simulation-status').textContent='放置塔與怪物後，可測試追塔、自爆與範圍傷害。';update();return;}
    if(!objects.some(o=>o.asset.category==='enemy'))return;
    const sim=new BombTowers.BombTowerGame();sim.start();sim.lives=150;sim.time=time;
    sim.sound=window.gameSound;
    sim.slots=objects.filter(o=>['tower','bomb-tower'].includes(o.asset.category)).map((o,id)=>({id,objectId:o.id,x:o.x,y:o.y,level:o.asset.level,kind:o.asset.category==='bomb-tower'?'bomb':'arrow',visualScale:o.scale,towerId:sim.nextTowerId++,kills:0,hp:100,maxHp:100,cooldown:0,action:null,destroyedAt:null}));
    sim.walls=objects.filter(o=>o.asset.category==='wall').map((o,id)=>({...labWall(o),id:-id-1,objectId:o.id,kind:'wall',level:1,towerId:sim.nextTowerId++}));
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
  $('bomb-tower-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;
    const add=(type,level,x,y)=>objects.push({id:nextId++,asset:catalog.find(a=>a.category===type&&(level==null||a.level===level)),x,y,scale:2,facing:1,animation:'walk',started:time});
    for(const [level,x] of [[1,280],[2,600],[3,920]]){add('bomb-tower',level,x,380);for(const [dx,dy] of level===1?[[-86,-16],[-74,0],[-86,16]]:[[88,-16],[100,0],[88,16]])add('enemy',5,x+dx,380+dy);}
    add('wall',null,700,430);selected=null;mode='move';pointer=null;$('tower-fire').checked=true;$('show-bomb-ranges').checked=true;$('show-enemy-ranges').checked=false;update();
    status('已載入三級炸彈塔。開始測試：左側查看近距離自傷，中間查看友方城牆受傷，右側查看範圍爆炸。');
  });
  document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{if(!ready)return;category=button.dataset.category;pickAsset(catalog.find(item=>item.category===category));}));
  document.addEventListener('keydown',event=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();$('undo').click();}
    if(event.key==='Delete'&&current()){event.preventDefault();$('remove').click();}
  });
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(!expanded()){selected=null;pointer=null;update();}return;}
    if(simulation)return;
    if(mode==='place'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();place(pointer||{x:W/2,y:H/2});return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const [dx,dy]={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(mode==='place'){pointer=pointer||{x:W/2,y:H/2};pointer={x:Math.max(0,Math.min(W,pointer.x+dx)),y:Math.max(0,Math.min(H,pointer.y+dy))};}
    else if(current()){record();current().x=Math.max(0,Math.min(W,current().x+dx));current().y=Math.max(0,Math.min(H,current().y+dy));update();}
  });
  function resize(){const bounds=$('stage-wrap').getBoundingClientRect(),scale=Math.min(bounds.width/W,bounds.height/H);canvas.style.width=`${Math.max(1,W*scale)}px`;canvas.style.height=`${Math.max(1,H*scale)}px`;}
  new ResizeObserver(resize).observe($('stage-wrap'));
  const scene = $('test-scene'), fullscreenButton = $('toggle-fullscreen');
  const expanded = () => document.fullscreenElement === scene || scene.classList.contains('stage-expanded');
  function syncSceneView(){
    const active = expanded();
    fullscreenButton.textContent = active ? '返回視窗' : '全螢幕';
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.title = active ? '返回視窗大小（也可按 Esc）' : '全螢幕顯示測試場景';
    pointer = null;
    resize();
    requestAnimationFrame(resize);
  }
  function expandInPage(){
    scene.classList.add('stage-expanded');
    document.body.classList.add('scene-expanded');
    status('已展開至整個瀏覽器視窗；按「返回視窗」或 Esc 還原。');
    syncSceneView();
  }
  function restoreInPage(){
    scene.classList.remove('stage-expanded');
    document.body.classList.remove('scene-expanded');
    syncSceneView();
    fullscreenButton.focus({preventScroll:true});
  }
  fullscreenButton.addEventListener('click', async () => {
    fullscreenButton.disabled = true;
    try {
      if (document.fullscreenElement === scene) await document.exitFullscreen();
      else if (scene.classList.contains('stage-expanded')) restoreInPage();
      else if (document.fullscreenEnabled && scene.requestFullscreen) {
        try { await scene.requestFullscreen(); }
        catch { expandInPage(); }
      } else expandInPage();
    } catch {
      status('無法切換全螢幕，請按 Esc 返回視窗後再試。');
    } finally {
      fullscreenButton.disabled = false;
      syncSceneView();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    syncSceneView();
    fullscreenButton.focus({preventScroll:true});
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !expanded()) return;
    event.preventDefault();
    if (scene.classList.contains('stage-expanded')) restoreInPage();
    else document.exitFullscreen().catch(() => status('請按「返回視窗」離開全螢幕。'));
  });
  syncSceneView();
  function load(category,name,file,spec,level){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const width=spec?.size||image.naturalWidth,height=spec?.size||image.naturalHeight;resolve({category,name,image,width,height,level,animations:spec?.animations,anchor:spec?.anchor||{x:width/2,y:height-2}});};image.onerror=()=>reject(new Error(`無法載入 ${file}`));image.src=file;});}
  const loads=[];
  for(const [i,spec] of BombTowerSprites.specs.entries())if(spec)loads.push(load('bomb-tower',`Lv${i} 炸彈塔`,`assets/bomb-towers/${spec.file}`,spec,i).then(item=>{bombImages[i]=item.image;return item;}));
  for(const name of ['operator','bomb','explosion'])loads.push(new Promise((resolve,reject)=>{const image=new Image();bombImages[name]=image;image.onload=()=>resolve(null);image.onerror=()=>reject(new Error(`無法載入炸彈塔 ${name}`));image.src=`assets/bomb-towers/${name}.png`;}));
  for(const orientation of ['horizontal','vertical']){
    loads.push(load('wall',`城牆 · ${orientation==='vertical'?'直向':'橫向'}`,WallSprites.file(orientation),{anchor:{x:32,y:76}}).then(item=>({...item,orientation})));
    for(const hp of WallSprites.stages)loads.push(new Promise((resolve,reject)=>{const image=new Image();wallImages[`${orientation}-${hp}`]=image;image.onload=()=>resolve(null);image.onerror=reject;image.src=WallSprites.file(orientation,hp,100);}));
  }
  for(const level of [5,1,6,2,3,4]){const spec=EnemySprites.specs[level];loads.push(load('enemy',spec.name||['','Lv1 哥布林','Lv2 獸人','Lv3 獨眼巨人'][level],`assets/enemies/${spec.file}`,spec,level));}
  TowerSprites.specs.slice(1).forEach((spec,i)=>loads.push(load('tower',['Lv1 木造箭塔','Lv2 石造箭塔','Lv3 強化箭塔'][i],`assets/towers/${spec.file}`,spec,i+1)));
  Environment.names.forEach(name=>loads.push(load('environment',names[name]||name,`assets/environment/${name}.png`)));
  Promise.all(loads).then(items=>{
    catalog.push(...items.filter(Boolean));const gc=ground.getContext('2d');gc.imageSmoothingEnabled=false;gc.fillStyle='#718b3d';gc.fillRect(0,0,W,H);
    const grass=catalog.find(item=>item.name===names.grass).image;
    gc.globalAlpha=.5;for(let y=0;y<H;y+=64)for(let x=0;x<W;x+=64)gc.drawImage(grass,x,y,64,64);
    ready=true;pickAsset(catalog.find(item=>item.category===category));resize();status(`已載入 ${catalog.length} 個素材。從下方選擇素材，再點畫布放置。`);
  }).catch(error=>{status(`${error.message}，請重新整理。`);$('selection-label').textContent='素材載入失敗';console.error(error);});
  function frame(now){
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!paused&&!document.hidden){time+=dt;if(simulation){
      simulation.bombFireEnabled=$('tower-fire').checked;
      if(!$('tower-fire').checked)simulation.slots.forEach(s=>s.cooldown=Infinity);
      let left=dt;while(left>0){const step=Math.min(left,1/60);simulation.update(step);left-=step;}
    }}
    if(simulation){$('simulation-status').textContent=`存活怪物 ${simulation.enemies.filter(e=>e.hp>0).length} · 存活塔 ${simulation.slots.filter(s=>s.level).length} · 塔生命 ${simulation.slots.reduce((sum,s)=>sum+s.hp,0)} HP · 擊殺 ${simulation.kills}`;$('kill-enemy').disabled=!simulation.enemies.some(e=>e.id===selected&&e.hp>0);}
    if(ready&&!document.hidden)draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
