(() => {
  'use strict';
  const WallSprites=window.TestWallSprites;
  const WORLD_SCALE=TD.CAMPAIGN_WORLD_SCALE,MAP=TD.MAP_CONFIG;
  const $ = id => document.getElementById(id), canvas = $('test-stage'), ctx = canvas.getContext('2d');
  // Share the actual game's map dimensions; display resizing never resets scene coordinates.
  canvas.width = TD.MAP_CONFIG.width;
  canvas.height = TD.MAP_CONFIG.height;
  $('stage-size').textContent = `${canvas.width} × ${canvas.height}`;
  const W = canvas.width, H = canvas.height, catalog = [], objects = [], history = [];
  const names = {oak:'橡樹',roundTree:'圓冠樹',birch:'白樺樹',pine:'松樹',limeTree:'嫩綠樹',oldOak:'古老橡樹',goldTree:'金葉樹',sapling:'幼苗',youngTree:'幼樹',smallTree:'小樹',smallOak:'小橡樹',bush:'灌木',flowers:'花叢',orangeBush:'橙花灌木',berryBush:'莓果灌木',log:'橫木',boulders:'巨石群',standingRock:'立石',rockCluster:'岩石群',mossRock:'苔蘚岩石',rock:'岩石',pebble:'小石',lowRock:'矮石',stump:'樹樁',fallenLog:'倒木',grass:'草地',grassDirt:'草土地',dirt:'泥土',meadow:'草甸',flowerGrass:'花草地',fern:'蕨類',tuft:'草叢',reeds:'蘆葦',whiteFlowers:'白花',pinkFlowers:'粉花',buildPad:'建造底座'};
  let asset = null, category = 'enemy', mode = 'place', selected = null, facing = 1, ready = false;
  let time = 0, previous = 0, paused = false, pointer = null, dragging = null, nextId = 1;
  let shieldPreview=null;
  let simulation=null,rainDemoLoaded=false,rainDemoActive=false;
  const description={2:'獸人 · 112 HP · 出場衝鋒，速度為原速 1.5 倍；首次撞塔或城牆造成 120 傷害；衝鋒期間累計受到 50 HP 傷害會中斷衝鋒。撞擊或中斷後恢復原速，每秒普攻 10 傷害，不再衝鋒。',4:'炸彈哥布林 · 60 HP · 不普攻，追向最近的塔；接近或被擊殺時爆炸，對範圍內的塔與其他怪物造成 60 傷害。',5:'史萊姆 · 32 HP · 普通移速，不攻擊，沿路前進。',6:'哥布林弓箭手 · 40 HP · 射程內停下拉弓，每 1.4 秒射一箭，命中塔時造成 6 傷害。'};
  const arrowImage=new Image();arrowImage.src='assets/projectiles/arrow.png';
  const wallImages={};
  const bombImages={};
  const fenceImages={};
  let ground=null,groundOverlay=null;
  function status(message){$('lab-status').textContent=message;}
  function record(){history.push(objects.map(o=>({...o})));if(history.length>50)history.shift();}
  function current(){return objects.find(o=>o.id===selected);}
  function update(){
    $('object-count').textContent=`${objects.length} 個物件`;
    $('empty-hint').hidden=objects.length>0;
    $('undo').disabled=(!!simulation||!!shieldPreview)||!history.length;$('remove').disabled=(!!simulation||!!shieldPreview)||!current();$('clear').disabled=(!!simulation||!!shieldPreview)||!objects.length;
    $('shield-preview').disabled=!ready||!!simulation||(!shieldPreview&&!objects.some(o=>o.asset.category==='friendly'));
    $('shield-preview').textContent=shieldPreview?'結束盾兵預覽':'盾兵推進預覽';$('shield-preview').setAttribute('aria-pressed',String(!!shieldPreview));
    $('warcry-demo').disabled=!ready||!!simulation||!!shieldPreview;
    $('warcry-now').disabled=!ready||!!shieldPreview||!objects.some(o=>o.asset.level==='goblinCaptain'&&o.animation!=='death');
    const item=current();
    $('selection-label').textContent=item?`選取：${item.asset.name}`:asset?`放置素材：${asset.name}`:'尚未選擇素材';
    const active=(item?item.asset:asset),states=active?.animations||EnemySprites.animations;
    $('fence-condition-label').hidden=!['fence','wall'].includes(active?.category);$('fence-condition').disabled=(!!simulation||!!shieldPreview);
    $('fence-condition-label').firstChild.textContent=active?.category==='wall'?'城牆耐久 ':'柵欄耐久 ';
    if(['fence','wall'].includes(item?.asset.category))$('fence-condition').value=String(item.condition??100);
    for(const option of $('enemy-animation').options)option.disabled=!states[option.value];
    if(!states[$('enemy-animation').value])$('enemy-animation').value=states.walk?'walk':Object.keys(states)[0];
    $('enemy-animation').disabled=(!!simulation||!!shieldPreview)||!['enemy','boss','friendly'].includes(active?.category);
    $('enemy-description').textContent=active?.category==='enemy'?(description[active.level]||'判定範圍內有塔就鎖定最近一座，靠近後停下攻擊；摧毀後繼續搜尋附近的塔，沒有目標才回到路線。'):'';
    if(active?.category==='friendly')$('enemy-description').textContent='友方盾兵 · 48×48／格 · 不會攻擊。待機 4／行走 4／推進 6／受傷 3／死亡 5 格。「盾兵推進預覽」只展示素材動作；正式關卡在敵人越線後召喚一名盾兵，將終點附近的敵人一併回推。';
    if(active?.category==='boss')$('enemy-description').textContent=active.level==='cyclops'?'Boss 獨眼巨人 · 所有動作固定 96×96 · 站立本體約 80 px · 待機 4／行走 4／近戰 4／投擲 6／受傷 3／死亡 6 格。此處為素材預覽，尚未設定戰鬥數值。':active.level==='rock'?'飛行石頭 · 獨立 32×32／格 · 6 格循環 · 置於 Boss 圖集之外，可單獨移動與旋轉。':'石頭落地 · 獨立 48×48／格 · 4 格單次播放。';
    if(active?.category==='boss'&&active.level==='goblinCaptain')$('enemy-description').textContent='Boss 哥布林隊長 · 48×48／格 · 每 15 秒戰吼一次，增益動畫持續 5 秒；附近哥布林、炸彈哥布林與哥布林弓箭手顯示光環。範圍為預覽示意，尚未設定攻速與移速增幅。';
    if(active?.category==='boss'&&active.level==='warcryAura')$('enemy-description').textContent='戰吼光環 · 獨立 48×48／格 · 4 格循環，播放於受增益單位腳下。';
    if(active?.category==='wall')$('enemy-description').textContent='城牆 · 300 HP · 高角度俯視，橫／直向獨立繪製。耐久選單可查看五階段受損外觀；敵人優先攻擊，無法修復。';
    if(active?.category==='fence')$('enemy-description').textContent=`柵欄 · ${TD.FENCE.hp} HP · 僅能放在道路，使用正式關卡 ${MAP.roadWidth} px 道路設定。敵人優先攻擊，可受爆炸傷害；耐久選單可預覽五階段外觀。`;
    if(active?.category==='bomb-tower'){const s=BombTowers.specs[active.level],r=BombTowers.ranges(active.level,WORLD_SCALE);$('enemy-description').textContent=`炸彈塔 Lv.${active.level} · ${s.hp} HP · 攻擊距離 ${r.min}～${r.max} px · 爆炸半徑 ${r.blast} px · 傷害 ${s.damage} · 每 ${s.interval} 秒投彈。會傷害友軍與自己；過近不投彈。勾選「塔可射擊」開始測試。`;}
    if(active?.category==='enemy')$('enemy-description').textContent+=' 附近城牆優先；史萊姆也會攻擊城牆。';
    if(active?.category==='enemy'){
      const r=TD.enemyRanges(active.level,WORLD_SCALE);
      $('enemy-description').textContent+=r.attack?` 判定半徑 ${r.detection} px；攻擊半徑 ${r.attack} px。`:r.blast?` 引爆距離 ${r.trigger} px；爆炸半徑 ${r.blast} px。`:' 攻擊半徑 0 px。';
    }
    $('simulate').disabled=!!shieldPreview||!ready||(!simulation&&!objects.some(o=>o.asset.category==='enemy'));
    $('simulate').textContent=simulation?'結束行為測試':'開始行為測試';$('simulate').setAttribute('aria-pressed',String(!!simulation));
    $('kill-enemy').disabled=!simulation||!simulation.enemies.some(e=>e.id===selected&&e.hp>0);
    for(const id of ['flip-object','tool-place','bomber-demo','bomb-tower-demo','arrow-rain-demo','fence-demo','wall-demo'])$(id).disabled=!ready||(!!simulation||!!shieldPreview);
    $('arrow-rain-fast-forward').hidden=!rainDemoActive;
    $('arrow-rain-fast-forward').disabled=!rainDemoActive||!simulation||simulation.arrowRainFired;
    if(['fence','wall'].includes(active?.category))$('flip-object').disabled=true;
    document.querySelectorAll('.asset-card,[data-category]').forEach(button=>button.disabled=(!!simulation||!!shieldPreview));
    $('tool-place').setAttribute('aria-pressed',String(mode==='place'));
    $('tool-move').setAttribute('aria-pressed',String(mode==='move'));
    canvas.style.cursor=mode==='place'?'crosshair':dragging?'grabbing':'grab';
  }
  function setMode(value){mode=value;pointer=null;update();status(mode==='place'?'點選畫布放置素材；可連續放置。':'點選物件以選取，拖曳可移動。');}
  function pickAsset(item){if(simulation||shieldPreview)return;rainDemoLoaded=false;asset=item;selected=null;setMode('place');renderPalette();update();}
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
      if(item.category==='wall')WallSprites.draw(ic,item.image,{x:64,y:58,orientation:item.orientation,visualScale:.6,...TD.wallSize(item.orientation,2,96)},2);
      else if(item.category==='fence')TestFences.draw(ic,fenceImages,{...TestFences.unit({asset:item,x:64,y:58}),visualScale:.6});
      else if(item.category==='bomb-tower')BombTowerSprites.draw(ic,bombImages,{x:64,y:110,level:item.level},Math.min(1.4,104/item.width),0);
      else ic.drawImage(item.image,0,0,item.width,item.height,Math.round((128-item.width*scale)/2),Math.round((116-item.height*scale)/2),Math.round(item.width*scale),Math.round(item.height*scale));
      const title=document.createElement('b');title.textContent=item.name;
      const dimensions=document.createElement('small');dimensions.textContent=item.category==='fence'?'固定跨距 96 px':item.category==='wall'?'長度同木柵欄（2 倍）':`${item.width} × ${item.height} px`;
      button.append(icon,title,dimensions);button.addEventListener('click',()=>pickAsset(item));$('asset-list').append(button);
    }
  }
  function labWall(o){return o.unit||{...o,orientation:o.asset.orientation,hp:TD.WALL.hp*(o.condition??100)/100,maxHp:TD.WALL.hp,...TD.wallSize(o.asset.orientation,WORLD_SCALE,MAP.roadWidth)};}
  function bounds(o){if(o.asset.category==='fence')return TestFences.bounds(TestFences.unit(o));if(o.asset.category==='wall')return WallSprites.bounds(labWall(o),WORLD_SCALE);if(o.asset.category==='tower')return TowerSprites.worldRect(o.asset.level,o.x,o.y,MAP.towerSlotSize,WORLD_SCALE);return{x:o.x-o.asset.anchor.x*o.scale,y:o.y-o.asset.anchor.y*o.scale,w:o.asset.width*o.scale,h:o.asset.height*o.scale};}
  function paint(o,alpha=1){
    const a=o.asset;let frame=0;
    if(a.category==='tower'){const b=bounds(o);ctx.save();ctx.globalAlpha=alpha;ctx.translate(o.x,0);ctx.scale(o.facing,1);ctx.drawImage(a.image,b.x-o.x,b.y,b.w,b.h);ctx.restore();return;}
    if(a.category==='fence'){TestFences.draw(ctx,fenceImages,TestFences.unit(o),alpha);return;}
    if(a.category==='bomb-tower'){BombTowerSprites.draw(ctx,bombImages,{...o,...o.unit,level:a.level},o.scale,time,alpha);return;}
    if(a.category==='wall'){
      const wall=labWall(o);
      WallSprites.draw(ctx,wallImages[`${a.orientation}-${WallSprites.stage(wall.hp,wall.maxHp)}`],wall,o.scale,alpha);return;
    }
    if(['enemy','boss','friendly'].includes(a.category)){
      if(o.unit)frame=EnemySprites.sample(o.unit,time).index;
      else{const states=a.animations||EnemySprites.animations,animation=states[o.animation]||Object.values(states)[0],elapsed=Math.max(0,time-o.started);
        const tick=Math.floor(elapsed*animation.fps);frame=animation.start+(animation.loop?tick%animation.count:Math.min(tick,animation.count-1));}
    }
    if(a.level==='goblinCaptain'&&o.animation!=='death'&&o.animation!=='hurt'){const c=GoblinCaptain.cycle(time,o.warcryStart??o.started);if(c.casting)frame=GoblinCaptain.sample(GoblinCaptain.captain,'warcry',c.age).index;}
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(o.x,o.y);ctx.scale(o.facing*o.scale,o.scale);
    ctx.drawImage(a.image,frame*a.width,0,a.width,a.height,-a.anchor.x,-a.anchor.y,a.width,a.height);ctx.restore();
  }
  function visibleObjects(){
    if(!simulation)return shieldPreview?objects.map(o=>shieldPreview.find(p=>p.id===o.id)||o):objects;
    const scene=objects.filter(o=>['environment','boss','friendly'].includes(o.asset.category));
    for(const s of simulation.slots)if(s.level){const o=objects.find(o=>o.id===s.objectId);scene.push({...o,unit:s});}
    for(const w of simulation.walls){const o=objects.find(o=>o.id===w.objectId);scene.push({...o,unit:w});}
    for(const e of [...simulation.enemies.filter(e=>e.hp>0),...simulation.corpses]){const o=objects.find(o=>o.id===e.id);scene.push({...o,x:e.x,y:e.y,facing:e.facing??1,unit:e});}
    return scene;
  }
  function paintWarcry(scene){
    const casters=scene.filter(o=>o.asset.level==='goblinCaptain'&&o.animation!=='death'),label=$('warcry-status');
    label.hidden=!casters.length;if(!casters.length)return;
    const targets=scene.filter(o=>o.asset.category==='enemy').map(o=>({...o,level:o.asset.level,hp:o.unit?.hp,deathAt:o.unit?.deathAt??(o.animation==='death'?0:null),escaped:o.unit?.escaped}));
    const radius=GoblinCaptain.PREVIEW_RADIUS*WORLD_SCALE,affected=new Map(),rings=new Map();let active=0,displayCycle=null;
    for(const caster of casters){
      const cycle=GoblinCaptain.cycle(time,caster.warcryStart??caster.started);
      if($('show-enemy-ranges').checked){ctx.save();ctx.strokeStyle=cycle.active?'#ff9659':'#b58b68';ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.arc(caster.x,caster.y,radius,0,Math.PI*2);ctx.stroke();ctx.restore();}
      if(!cycle.active)continue;active++;displayCycle??=cycle;rings.set(caster.id,{o:caster,age:cycle.age});
      for(const o of GoblinCaptain.recipients(caster,targets,radius)){affected.set(o.id,o);rings.set(o.id,{o,age:cycle.age});}
    }
    const image=catalog.find(a=>a.level==='warcryAura')?.image,spec=GoblinCaptain.aura;
    if(image)for(const {o,age} of rings.values()){
      const f=GoblinCaptain.sample(spec,'aura',age),scale=o.scale;
      ctx.drawImage(image,f.sx,0,48,48,o.x-spec.anchor.x*scale,o.y-spec.anchor.y*scale,48*scale,48*scale);
    }
    const next=displayCycle||GoblinCaptain.cycle(time,casters[0].warcryStart??casters[0].started);
    label.textContent=active?`戰吼生效 · ${affected.size} 名哥布林顯示增益光環 · 剩餘 ${next.remaining.toFixed(1)} 秒 · 僅動畫，不改攻速／移速`:`下次戰吼 ${next.remaining.toFixed(1)} 秒 · 每 15 秒觸發／持續 5 秒 · 示意半徑 ${radius} px`;
  }
  function paintRanges(o,labels=false,alpha=1){
    if(o.asset.category!=='enemy'||o.animation==='death'&&!o.unit||o.unit&&(o.unit.hp<=0||o.unit.deathAt!=null))return;
    // Match combat distances in world coordinates, independent of sprite display scale.
    const r=TD.enemyRanges(o.asset.level,WORLD_SCALE);
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
    const r=BombTowers.ranges(o.asset.level,WORLD_SCALE);
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
    if(background!=='forest')ctx.drawImage(groundOverlay,0,0);
    if($('show-grid').checked){ctx.strokeStyle=background==='dark'?'#ffffff15':'#213b2b25';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<W;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);}for(let y=0;y<H;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}ctx.stroke();}
    const scene=visibleObjects();
    paintWarcry(scene);
    const showRanges=$('show-enemy-ranges').checked;
    if(showRanges)scene.forEach(o=>paintRanges(o));
    if($('show-bomb-ranges').checked)scene.forEach(o=>paintBombRanges(o));
    [...scene].sort((a,b)=>a.y-b.y||a.id-b.id).forEach(o=>{
      paint(o);if(o.unit&&o.unit.hp>0&&o.unit.deathAt==null){if(o.asset.category==='wall'){WallSprites.drawHealth(ctx,o.unit,o.scale);return;}const b=bounds(o);ctx.fillStyle='#17241d';ctx.fillRect(o.x-24,b.y-12,48,4);ctx.fillStyle='#8fcd68';ctx.fillRect(o.x-24,b.y-12,48*o.unit.hp/o.unit.maxHp,4);ctx.fillStyle='#f1e4c5';ctx.font='11px "Fusion Pixel"';ctx.textAlign='center';ctx.fillText(`${o.unit.hp} HP`,o.x,b.y-17);}
    });
    if(simulation&&arrowImage.complete&&arrowImage.naturalWidth)for(const b of simulation.bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrowImage,-40,-8,48,16);ctx.restore();}
    if(simulation&&arrowImage.complete&&arrowImage.naturalWidth)for(const b of simulation.enemyArrows){ctx.save();ctx.translate(b.x,b.y-20);ctx.rotate(Math.atan2(b.target.y-b.y,b.target.x-b.x));ctx.drawImage(arrowImage,-30,-6,32,12);ctx.restore();}
    if(simulation)ArrowRain.draw(ctx,arrowImage,simulation.arrowRain,simulation.time);
    if(simulation){
      for(const b of simulation.bombs)BombTowerSprites.drawBomb(ctx,bombImages.bomb,b,simulation.time,simulation.worldScale);
      for(const e of simulation.effects)if(e.kind==='tower-bomb-explosion'){
        if($('show-bomb-ranges').checked){ctx.save();ctx.strokeStyle='#ff9b60';ctx.globalAlpha=e.life/e.duration;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);ctx.stroke();ctx.restore();}
        BombTowerSprites.drawExplosion(ctx,bombImages.explosion,e);
      }
      if(rainDemoActive){
        for(const e of simulation.effects)if(e.kind==='damage'){
          ctx.save();ctx.globalAlpha=Math.min(1,e.life*3);ctx.font='bold 22px "Fusion Pixel"';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#29160e';ctx.fillStyle='#fff0b4';const y=e.y-55-(.7-e.life)*30;ctx.strokeText(String(e.amount),e.x,y);ctx.fillText(String(e.amount),e.x,y);ctx.restore();
        }
        ctx.fillStyle='#14241ee8';ctx.fillRect(16,16,308,40);ctx.fillStyle='#ffe1a0';ctx.font='17px "Fusion Pixel"';ctx.textAlign='left';
        ctx.fillText(simulation.arrowRainFired?'箭雨已發射 · 全圖 -200 HP':`箭雨倒數 ${Math.ceil(TimedWaves.ARROW_RAIN_SECONDS-simulation.battleTime)} 秒`,28,43);
      }
    }
    const item=scene.find(o=>o.id===selected);
    if(item){const b=bounds(item);ctx.strokeStyle='#ffe199';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);ctx.setLineDash([]);ctx.fillStyle='#ffe199';ctx.fillRect(item.x-3,item.y-3,6,6);}
    if(showRanges&&item)paintRanges(item,true);
    if(!simulation&&mode==='place'&&pointer&&asset){const preview={asset,x:pointer.x,y:pointer.y,scale:asset.scale,warcryStart:time,condition:Number($('fence-condition').value),facing,animation:$('enemy-animation').value,started:time};
      if(asset.category==='fence'){const result=TestFences.placement(pointer.x,pointer.y,asset.orientation,objects);if(result.ok)Object.assign(preview,result.placement);const w=TestFences.unit(preview);ctx.fillStyle=result.ok?'#c3e77a55':'#ef665555';ctx.fillRect(w.x-w.width/2,w.y-w.height/2,w.width,w.height);}
      if(showRanges)paintRanges(preview,true,.55);if($('show-bomb-ranges').checked)paintBombRanges(preview,.55);paint(preview,.55);}
  }
  function coordinates(event){const rect=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(W,(event.clientX-rect.left)*W/rect.width)),y:Math.max(0,Math.min(H,(event.clientY-rect.top)*H/rect.height))};}
  function place(p){
    if(!ready||!asset||simulation||shieldPreview)return;
    if(objects.length>=150){status('測試場景最多放置 150 個物件，請先移除部分物件。');return;}
    if(asset.category==='fence'){const result=TestFences.placement(p.x,p.y,asset.orientation,objects);if(!result.ok){status(result.message);return;}p=result.placement;}
    record();rainDemoLoaded=false;objects.push({id:nextId++,asset,x:Math.round(p.x),y:Math.round(p.y),scale:asset.scale,condition:Number($('fence-condition').value),facing,animation:$('enemy-animation').value,started:time});selected=null;update();status(`已放置${asset.name}，可繼續點選畫布放置。`);
  }
  function hit(p){return [...visibleObjects()].sort((a,b)=>b.y-a.y||b.id-a.id).find(o=>{const b=bounds(o);return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||!ready||shieldPreview)return;event.preventDefault();canvas.focus({preventScroll:true});pointer=coordinates(event);
    if(simulation){selected=hit(pointer)?.id??null;update();return;}
    if(mode==='place'){place(pointer);return;}
    const item=hit(pointer);selected=item?.id??null;
    if(item){$('enemy-animation').value=item.animation;dragging={id:item.id,dx:pointer.x-item.x,dy:pointer.y-item.y,original:objects.map(o=>({...o})),changed:false};canvas.setPointerCapture(event.pointerId);status(`已選取${item.asset.name}；拖曳移動，Delete 移除。`);}else status('此處沒有物件，請點選素材。');update();
  });
  function movePosition(item,x,y){
    if(item.asset.category!=='fence')return {x,y};
    const result=TestFences.placement(x,y,item.asset.orientation,objects,item.id);if(!result.ok){status(result.message);return null;}return result.placement;
  }
  canvas.addEventListener('pointermove',event=>{pointer=coordinates(event);if(dragging){const item=current();if(item){const p=movePosition(item,Math.round(Math.max(0,Math.min(W,pointer.x-dragging.dx))),Math.round(Math.max(0,Math.min(H,pointer.y-dragging.dy))));if(!p)return;if(p.x!==item.x||p.y!==item.y)dragging.changed=true;item.x=p.x;item.y=p.y;}}});
  function finishDrag(cancel=false){if(!dragging)return;if(cancel){objects.splice(0,objects.length,...dragging.original);}else if(dragging.changed){history.push(dragging.original);if(history.length>50)history.shift();}dragging=null;update();}
  canvas.addEventListener('pointerup',event=>{finishDrag();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(event.pointerType!=='mouse')pointer=null;});
  canvas.addEventListener('pointercancel',()=>{finishDrag(true);pointer=null;});
  canvas.addEventListener('lostpointercapture',()=>finishDrag());
  canvas.addEventListener('pointerleave',()=>{if(!dragging)pointer=null;});
  $('tool-place').addEventListener('click',()=>setMode('place'));$('tool-move').addEventListener('click',()=>setMode('move'));
  $('remove').addEventListener('click',()=>{if(!current())return;record();objects.splice(objects.findIndex(o=>o.id===selected),1);selected=null;update();status('已移除物件，可按復原恢復。');});
  $('clear').addEventListener('click',()=>{if(!objects.length)return;record();objects.length=0;rainDemoLoaded=false;selected=null;update();status('已清空場景，可按復原恢復。');});
  $('undo').addEventListener('click',()=>{if(!history.length)return;objects.splice(0,objects.length,...history.pop());selected=null;update();status('已復原上一步。');});
  $('warcry-demo').addEventListener('click',()=>{
    if(!ready||simulation||shieldPreview)return;record();objects.length=0;rainDemoLoaded=false;
    for(const [kind,level,x,y] of [['boss','goblinCaptain',600,350],['enemy',1,480,400],['enemy',4,690,430],['enemy',6,760,300],['enemy',2,540,280],['enemy',5,700,230],['enemy',1,1050,390]]){
      objects.push({id:nextId++,asset:catalog.find(a=>a.category===kind&&a.level===level),x,y,scale:WORLD_SCALE,facing:1,animation:'idle',started:time,warcryStart:time});
    }
    category='boss';asset=catalog.find(a=>a.level==='goblinCaptain');selected=null;mode='move';pointer=null;paused=false;
    $('play-animation').textContent='暫停動畫';$('play-animation').setAttribute('aria-pressed','false');renderPalette();update();
    status('戰吼範例：15 秒後自動發動，光環維持 5 秒。獸人、史萊姆與範圍外哥布林不顯示增益。');
  });
  $('warcry-now').addEventListener('click',()=>{
    for(const o of objects)if(o.asset.level==='goblinCaptain')o.warcryStart=time-GoblinCaptain.INTERVAL;
    status('立即預覽戰吼：光環持續 5 秒，之後每 15 秒再次發動；不更動戰鬥數值。');
  });
  $('shield-preview').addEventListener('click',()=>{
    if(simulation||!ready)return;
    if(shieldPreview){shieldPreview=null;status('盾兵預覽結束，已還原原始位置。');}
    else{shieldPreview=objects.filter(o=>o.asset.category==='friendly').map(o=>({...o,animation:'push',started:time}));paused=false;$('play-animation').textContent='暫停動畫';$('play-animation').setAttribute('aria-pressed','false');status('盾兵舉盾向前推進；不會攻擊或造成傷害。抵達畫布邊緣後停止。');}
    pointer=null;update();
  });
  $('enemy-animation').addEventListener('change',()=>{const item=current();if(['enemy','boss','friendly'].includes(item?.asset.category)){record();item.animation=$('enemy-animation').value;item.started=time;update();}status('已切換動作；攻擊、投擲、受傷、死亡與落地動作播放一次。');});
  $('fence-condition').addEventListener('change',()=>{const item=current();if(['fence','wall'].includes(item?.asset.category)){record();item.condition=Number($('fence-condition').value);update();}status('已切換設施耐久；行為測試會從此耐久開始。');});
  $('flip-object').addEventListener('click',()=>{const item=current();if(item){record();item.facing*=-1;}else facing*=-1;update();status(item?'已翻轉選取物件。':'已翻轉接下來放置素材的方向。');});
  $('play-animation').addEventListener('click',()=>{paused=!paused;if(paused)window.gameSound.stopAll();$('play-animation').textContent=paused?'播放動畫':'暫停動畫';$('play-animation').setAttribute('aria-pressed',String(paused));});
  $('simulate').addEventListener('click',()=>{
    window.gameSound.stopAll();
    if(simulation){simulation=null;rainDemoActive=false;objects.forEach(o=>o.started=time);status('已結束測試並還原原始擺放。');$('simulation-status').textContent='放置塔與怪物後，可測試追塔、自爆與範圍傷害。';update();return;}
    if(!objects.some(o=>o.asset.category==='enemy'))return;
    const sim=new BombTowers.BombTowerGame(Math.random,TestFences.createScenario());sim.start();sim.lives=150;sim.time=time;
    sim.sound=window.gameSound;
    sim.slots=objects.filter(o=>['tower','bomb-tower'].includes(o.asset.category)).map((o,id)=>({id,objectId:o.id,x:o.x,y:o.y,level:o.asset.level,kind:o.asset.category==='bomb-tower'?'bomb':'arrow',visualScale:o.scale,towerId:sim.nextTowerId++,kills:0,hp:100,maxHp:100,cooldown:0,action:null,destroyedAt:null}));
    sim.walls=objects.filter(o=>['wall','fence'].includes(o.asset.category)).map((o,id)=>{const w=o.asset.category==='fence'?TestFences.unit(o):labWall(o);return {...w,id:-id-1,objectId:o.id,kind:'wall',material:o.asset.category==='fence'?'wood':'stone',level:w.hp>0?1:0,towerId:sim.nextTowerId++};});
    sim.enemies=objects.filter(o=>o.asset.category==='enemy').map(o=>{
      const spec=TD.ENEMIES[o.asset.level],routeIndex=sim.level.routes.length;
      sim.level.routes.push({path:[{x:0,y:o.y},{x:W,y:o.y}],segments:[W],length:W});
      return {id:o.id,level:o.asset.level,x:o.x,y:o.y,hp:spec.hp,maxHp:spec.hp,distance:o.x,remaining:W-o.x,routeIndex,facing:1,moving:true};
    });
    rainDemoActive=rainDemoLoaded;
    if(rainDemoActive){sim.battleTime=0;sim.arrowRainStartedAt=null;sim.lastEnemySpawnAt=sim.time;sim.arrowRainFired=false;sim.arrowRain=null;sim.moveEnemy=enemy=>{enemy.moving=false;};TimedWaves.updateArrowRainClock(sim);}
    simulation=sim;paused=false;$('play-animation').textContent='暫停動畫';$('play-animation').setAttribute('aria-pressed','false');mode='move';pointer=null;
    status(rainDemoActive?'箭雨測試中：六名敵人已全數進場，30 秒後發射，或快轉至發射前 1 秒。':'行為測試中：點選怪物後可直接擊殺，驗證死亡爆炸。');update();
  });
  $('arrow-rain-fast-forward').addEventListener('click',()=>{
    if(!simulation||!rainDemoActive||simulation.arrowRainFired)return;
    simulation.battleTime=Math.max(simulation.battleTime,TimedWaves.ARROW_RAIN_SECONDS-1);
    simulation.arrowRainStartedAt=simulation.time-simulation.battleTime;
    status('已快轉至箭雨前 1 秒；倒數後將對每名場上敵人造成 200 傷害。');update();
  });
  $('kill-enemy').addEventListener('click',()=>{const e=simulation?.enemies.find(e=>e.id===selected&&e.hp>0);if(e){simulation.damageEnemy(e,e.hp);status('已擊殺選取怪物；炸彈會立即造成範圍傷害。');update();}});
  $('tower-fire').addEventListener('change',()=>{if(simulation)simulation.slots.forEach(s=>s.cooldown=0);});
  $('bomber-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;rainDemoLoaded=false;
    for(const [type,level,x,y] of [['tower',1,680,300],['enemy',4,300,300],['enemy',5,335,315],['enemy',1,280,335]]){
      objects.push({id:nextId++,asset:catalog.find(a=>a.category===type&&a.level===level),x,y,scale:WORLD_SCALE,facing:1,animation:'walk',started:time});
    }
    selected=objects.find(o=>o.asset.level===4&&o.asset.category==='enemy').id;mode='move';$('tower-fire').checked=false;update();
    status('範例已載入。開始行為測試可看追塔自爆；立即擊殺炸彈哥布林可看波及旁邊怪物。');
  });
  $('bomb-tower-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;rainDemoLoaded=false;
    const add=(type,level,x,y)=>objects.push({id:nextId++,asset:catalog.find(a=>a.category===type&&(level==null||a.level===level)),x,y,scale:WORLD_SCALE,facing:1,animation:'walk',started:time});
    for(const [level,x] of [[1,280],[2,600],[3,920]]){add('bomb-tower',level,x,380);for(const [dx,dy] of level===1?[[-172,-32],[-148,0],[-172,32]]:[[176,-32],[200,0],[176,32]])add('enemy',5,x+dx,380+dy);}
    add('wall',null,700,430);selected=null;mode='move';pointer=null;$('tower-fire').checked=true;$('show-bomb-ranges').checked=true;$('show-enemy-ranges').checked=false;update();
    status('已載入三級炸彈塔。開始測試：左側查看近距離自傷，中間查看友方城牆受傷，右側查看範圍爆炸。');
  });
  $('arrow-rain-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;rainDemoLoaded=true;
    for(const [level,x,y] of [[3,240,250],[3,640,250],[3,1040,250],[1,240,530],[1,640,530],[1,1040,530]]){
      objects.push({id:nextId++,asset:catalog.find(a=>a.category==='enemy'&&a.level===level),x,y,scale:WORLD_SCALE,facing:1,animation:'idle',started:time});
    }
    selected=null;mode='move';pointer=null;$('show-enemy-ranges').checked=false;$('tower-fire').checked=false;update();
    status('箭雨範例已載入。按「開始行為測試」讓六名敵人同時進場，30 秒後發射箭雨；可使用快轉按鈕預覽。');
  });
  $('fence-demo').addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;rainDemoLoaded=false;
    for(const [i,condition] of TestFences.stages.entries())objects.push({id:nextId++,asset:catalog.find(a=>a.category==='fence'&&a.orientation==='vertical'),x:240+i*112,y:384,scale:WORLD_SCALE,condition,facing:1,animation:'idle',started:time});
    objects.push({id:nextId++,asset:catalog.find(a=>a.category==='fence'&&a.orientation==='horizontal'),x:896,y:208,scale:WORLD_SCALE,condition:100,facing:1,animation:'idle',started:time});
    objects.push({id:nextId++,asset:catalog.find(a=>a.category==='enemy'&&a.level===2),x:112,y:384,scale:WORLD_SCALE,facing:1,animation:'walk',started:time});
    category='fence';asset=catalog.find(a=>a.category==='fence');selected=null;mode='move';pointer=null;$('tower-fire').checked=false;$('show-enemy-ranges').checked=false;renderPalette();update();
    status('五階段柵欄已載入：由左至右為 100%、80%、50%、25%、0%。上方為橫向柵欄；開始測試可查看獸人衝撞。');
  });
  const wallDemo=document.createElement('button');wallDemo.id='wall-demo';wallDemo.textContent='載入城牆外觀';wallDemo.disabled=true;$('fence-demo').after(wallDemo);
  wallDemo.addEventListener('click',()=>{
    if(simulation||!ready)return;record();objects.length=0;rainDemoLoaded=false;
    for(const [row,orientation] of ['horizontal','vertical'].entries())for(const [i,condition] of WallSprites.stages.entries())objects.push({id:nextId++,asset:catalog.find(a=>a.category==='wall'&&a.orientation===orientation),x:240+i*200,y:row?500:260,scale:WORLD_SCALE,condition,facing:1,animation:'idle',started:time});
    category='wall';asset=catalog.find(a=>a.category==='wall');selected=null;mode='move';pointer=null;renderPalette();update();status('城牆外觀：上排橫向、下排直向；由左至右為 100%、80%、50%、25%、0%。');
  });
  const fenceTab=document.createElement('button');fenceTab.dataset.category='fence';fenceTab.setAttribute('aria-pressed','false');fenceTab.textContent='柵欄 2';document.querySelector('[data-category="environment"]').before(fenceTab);
  document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{if(!ready)return;category=button.dataset.category;pickAsset(catalog.find(item=>item.category===category));}));
  document.addEventListener('keydown',event=>{
    if(shieldPreview)return;
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();$('undo').click();}
    if(event.key==='Delete'&&current()){event.preventDefault();$('remove').click();}
  });
  canvas.addEventListener('keydown',event=>{
    if(shieldPreview)return;
    if(event.key==='Escape'){if(!expanded()){selected=null;pointer=null;update();}return;}
    if(simulation)return;
    if(mode==='place'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();place(pointer||{x:W/2,y:H/2});return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const [dx,dy]={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(mode==='place'){pointer=pointer||{x:W/2,y:H/2};pointer={x:Math.max(0,Math.min(W,pointer.x+dx)),y:Math.max(0,Math.min(H,pointer.y+dy))};}
    else if(current()){const item=current(),p=movePosition(item,Math.max(0,Math.min(W,item.x+dx)),Math.max(0,Math.min(H,item.y+dy)));if(p){record();item.x=p.x;item.y=p.y;update();}}
  });
  let camera=null;
  function resize(){
    const viewport=$('stage-wrap'),content=$('stage-content'),vw=viewport.clientWidth,vh=viewport.clientHeight;if(!vw||!vh)return;
    const center=camera?{x:(viewport.scrollLeft+vw/2-camera.left)/camera.scale,y:(viewport.scrollTop+vh/2-camera.top)/camera.scale}:{x:W/2,y:H/2};
    const scale=$('view-zoom').value==='fit'?Math.min(vw/W,vh/H):Number($('view-zoom').value),cw=Math.max(vw,W*scale),ch=Math.max(vh,H*scale);
    camera={scale,left:(cw-W*scale)/2,top:(ch-H*scale)/2};
    content.style.width=`${cw}px`;content.style.height=`${ch}px`;canvas.style.width=`${W*scale}px`;canvas.style.height=`${H*scale}px`;
    viewport.scrollLeft=Math.max(0,center.x*scale+camera.left-vw/2);viewport.scrollTop=Math.max(0,center.y*scale+camera.top-vh/2);
    $('zoom-readout').textContent=`${Math.round(scale*100)}%`;
  }
  $('view-zoom').addEventListener('change',()=>{finishDrag();pointer=null;resize();status('僅調整畫面縮放；放大後可用捲軸或觸控板移動視野。');});
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
  loads.push(load('boss',GoblinCaptain.captain.name,`assets/boss/${GoblinCaptain.captain.file}`,GoblinCaptain.captain,'goblinCaptain'));
  loads.push(load('boss',GoblinCaptain.aura.name,`assets/boss/${GoblinCaptain.aura.file}`,GoblinCaptain.aura,'warcryAura'));
  loads.push(load('friendly',FriendlySprites.shield.name,`assets/friendly/${FriendlySprites.shield.file}`,FriendlySprites.shield,'shield'));
  for(const [key,spec] of Object.entries(BossSprites.specs))loads.push(load('boss',spec.name,`assets/boss/${spec.file}`,spec,key));
  for(const condition of TestFences.stages)loads.push(new Promise((resolve,reject)=>{const image=new Image();fenceImages[condition]=image;image.onload=()=>resolve(null);image.onerror=()=>reject(new Error('無法載入柵欄'));image.src=`assets/fences/fence-${condition}.png`;}));
  for(const orientation of ['horizontal','vertical'])loads.push(load('fence',`柵欄 · ${orientation==='vertical'?'直向':'橫向'}`,'assets/fences/fence-100.png').then(item=>({...item,orientation})));
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
    catalog.push(...items.filter(Boolean));
    const images=Object.fromEntries(Environment.names.map(name=>[name,catalog.find(item=>item.name===names[name]).image]));
    ground=Environment.makeBackground(TestFences.scenario,images,WORLD_SCALE,{decorate:false}).canvas;
    groundOverlay=document.createElement('canvas');groundOverlay.width=W;groundOverlay.height=H;const oc=groundOverlay.getContext('2d');oc.imageSmoothingEnabled=false;
    oc.save();oc.beginPath();for(const r of Environment.roadRects(TestFences.scenario))oc.rect(r.x,r.y,r.w,r.h);oc.clip();oc.drawImage(ground,0,0);oc.restore();
    // Props have natural size variation in campaign maps; use a representative
    // placement from the shared scenery generator instead of enlarging every prop.
    const scenery=Environment.placements({...TestFences.scenario,environment:'flower-forest'},images,WORLD_SCALE);
    for(const a of catalog){a.scale=WORLD_SCALE;if(a.category==='environment'){const key=Object.keys(names).find(k=>names[k]===a.name),p=scenery.find(p=>p.name===key);a.scale=p?p.w/a.width:1;}}
    ready=true;pickAsset(catalog.find(item=>item.category===category));resize();status(`已載入 ${catalog.length} 個素材。從下方選擇素材，再點畫布放置。`);
  }).catch(error=>{status(`${error.message}，請重新整理。`);$('selection-label').textContent='素材載入失敗';console.error(error);});
  function frame(now){
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!paused&&!document.hidden){time+=dt;if(shieldPreview)shieldPreview.forEach(o=>FriendlySprites.advancePreview(o,dt,W));if(simulation){
      simulation.bombFireEnabled=$('tower-fire').checked;
      if(!$('tower-fire').checked)simulation.slots.forEach(s=>s.cooldown=Infinity);
      let left=dt;while(left>0){
        const step=Math.min(left,1/60,rainDemoActive&&!simulation.arrowRainFired?Math.max(0,TimedWaves.ARROW_RAIN_SECONDS-simulation.battleTime):Infinity);
        if(step>0){simulation.update(step);left-=step;}
        if(rainDemoActive&&!simulation.arrowRainFired){
          TimedWaves.updateArrowRainClock(simulation);
          if(simulation.arrowRainFired){$('arrow-rain-fast-forward').disabled=true;status('箭雨已發射：場上每名敵人受到 200 傷害。');}
        }
      }
    }}
    if(simulation){$('simulation-status').textContent=rainDemoActive?`箭雨 ${simulation.arrowRainFired?'已發射':`倒數 ${Math.ceil(TimedWaves.ARROW_RAIN_SECONDS-simulation.battleTime)} 秒`} · 存活怪物 ${simulation.enemies.filter(e=>e.hp>0).length} · 擊殺 ${simulation.kills}`:`存活怪物 ${simulation.enemies.filter(e=>e.hp>0).length} · 存活塔 ${simulation.slots.filter(s=>s.level).length} · 塔生命 ${simulation.slots.reduce((sum,s)=>sum+s.hp,0)} HP · 擊殺 ${simulation.kills}`;$('kill-enemy').disabled=!simulation.enemies.some(e=>e.id===selected&&e.hp>0);}
    if(ready&&!document.hidden)draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
