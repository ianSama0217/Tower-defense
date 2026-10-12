const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 fs.mkdirSync('art/fence-rubble',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let api;Object.defineProperty(window,'TD',{get:()=>api,set:value=>{
    const Base=value.Game;value.Game=class extends Base{constructor(...args){super(...args);window.rubbleGame=this;}};api=value;
   }});
   localStorage.setItem('td-level-stars','[3,3,3,0,0]');
  });
  await page.goto('http://127.0.0.1:4173/level-three.html');
  await page.waitForFunction(()=>window.rubbleGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
  await page.evaluate(()=>document.fonts.ready);
  // Freeze only this test instance so snapshots have exact game-time boundaries.
  await page.evaluate(()=>{
   const g=rubbleGame;g.update=()=>{};g.money=1000;g.wallsUnlocked=true;
   const ctx=document.getElementById('battlefield').getContext('2d'),draw=ctx.drawImage;
   ctx.drawImage=function(image,...args){if(image?.src?.endsWith('/fence-0.png')){window.rubbleDraws=(window.rubbleDraws||0)+1;window.rubbleAlpha=this.globalAlpha;}return draw.call(this,image,...args);};
   const cell=RoadBuilding.cells(g.level).find(({frame:f})=>1008>=f.x&&1008<f.x+f.w&&400>=f.y&&400<f.y+f.h);
   const visual=FenceSprites.atCellRight({x:1008,y:400,hp:150,maxHp:150,orientation:'vertical',width:32,height:96},cell.frame),bounds=FenceSprites.bounds(visual);
   window.rubbleCrop={x:Math.floor(bounds.x-8),y:Math.floor(bounds.y-8),w:Math.ceil(bounds.w+16),h:Math.ceil(bounds.h+16)};
   const c=rubbleCrop;window.clearRoad=[...ctx.getImageData(c.x,c.y,c.w,c.h).data];
   window.rubbleFence=g.placeWall(1008,400,'vertical').wall;g.damageTower(rubbleFence,150);g.effects=[];
  });
  const rendered=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await rendered();assert.equal(await page.evaluate(()=>rubbleAlpha),1);
  await page.screenshot({path:'art/fence-rubble/destroyed.png'});
  await page.evaluate(()=>{rubbleGame.time+=1.5;});await rendered();
  assert.equal(await page.evaluate(()=>rubbleAlpha),.5);
  await page.screenshot({path:'art/fence-rubble/half-faded.png'});
  await page.locator('#pause').click();await rendered();
  assert.equal(await page.evaluate(()=>rubbleAlpha),.5);await page.locator('#resume').click();
  await page.evaluate(()=>{rubbleGame.time+=1.5;rubbleDraws=0;});await rendered();
  assert.equal(await page.evaluate(()=>rubbleDraws),0);
  assert.equal(await page.evaluate(()=>{
   const c=rubbleCrop,pixels=document.getElementById('battlefield').getContext('2d').getImageData(c.x,c.y,c.w,c.h).data;
   return pixels.every((v,i)=>v===clearRoad[i]);
  }),true);
  await page.screenshot({path:'art/fence-rubble/gone.png'});
  await page.evaluate(()=>{
   const fresh=rubbleGame.placeWall(1008,400,'vertical');if(!fresh.ok)throw Error('Replacement failed');
   const g=rubbleGame;g.money=1000;g.build(8);g.updateTowerActions(5);
  });
  await page.locator('.pad-button').nth(8).click();
  for(const hp of [100,125,150]){
   await page.waitForFunction(value=>document.querySelector('#stat-health b').textContent===`${value}/${value}`,hp);
   if(hp<150)await page.evaluate(()=>{rubbleGame.build(8);rubbleGame.updateTowerActions(5);});
  }
  await page.evaluate(()=>{rubbleGame.damageTower(rubbleGame.slots[8],75);rubbleGame.repair(8);rubbleGame.updateTowerActions(3);});
  await page.waitForFunction(()=>document.querySelector('#stat-health b').textContent==='150/150');
  await page.setViewportSize({width:390,height:844});await rendered();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'art/fence-rubble/replacement-mobile.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('art/fence-rubble/verification.json',JSON.stringify({checks:['full rubble at destruction','half opacity at 1.5 seconds','pause preserves opacity','no rubble draw at 3 seconds','road pixels restored exactly','same-cell replacement','actual tower health UI 100/125/150','repair to 150','390px layout'],errors},null,2)+'\n');
  console.log('Fence rubble and revised tower health browser checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
