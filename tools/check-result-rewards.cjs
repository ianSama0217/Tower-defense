const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  fs.mkdirSync('art/result-rewards',{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:4173/test/result-panel.html');
  await page.evaluate(()=>{document.querySelector('.result-heading').textContent='森林守衛 · 第 2 關';result.show({...data,wallReward:'unlocked',waves:6,kills:103,nextHref:'level-three.html'});});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#result-wall-title').textContent(),'通關獎勵 · 解鎖柵欄');
  assert.match(await page.locator('#result-wall-reward p').textContent(),/每個 30 金幣/);
  assert.match(await page.locator('#result-wall-reward').evaluate(e=>getComputedStyle(e).borderImageSource),/stage-kit\/heading.png/);
  assert.match(await page.locator('.result-wall-icon').evaluate(e=>getComputedStyle(e).backgroundImage),/fences\/fence-100.png/);
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>result.fit());
   await page.screenshot({path:`art/result-rewards/${name}.png`});
   const box=await page.locator('#result-wall-reward').boundingBox();
   assert.ok(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height);
   assert.equal(await page.locator('#result-wall-reward').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  }
  await page.evaluate(()=>result.show({...data,wallReward:'owned'}));
  assert.equal(await page.locator('#result-wall-title').textContent(),'通關獎勵 · 柵欄已解鎖');
  await page.evaluate(()=>result.show({...data,bombTowerReward:'unlocked'}));
  assert.equal(await page.locator('#result-wall-reward').isVisible(),false);
  assert.equal(await page.locator('#result-bomb-reward').isVisible(),true);
  await page.evaluate(()=>result.show({...data,won:false}));
  assert.equal(await page.locator('#result-bomb-reward').isVisible(),false);
  assert.deepEqual(errors,[]);
  const {LevelThreeGame}=require('../dist/level-three.js');
  const game=new LevelThreeGame(()=>0);game.start();game.wallsUnlocked=true;game.money=100;
  assert.equal(game.roadBuilding.name,'柵欄');assert.equal(game.roadBuilding.cost,30);
  assert.equal(game.placeWall(1008,400,'vertical').ok,true);assert.equal(game.money,70);
  console.log('PASS: reward frame, fence labels/icon, desktop/mobile bounds, repeat rewards, hidden states, and actual 30-gold construction.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
