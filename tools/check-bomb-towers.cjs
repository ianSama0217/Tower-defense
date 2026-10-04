const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{let api;Object.defineProperty(window,'BombTowers',{get:()=>api,set:v=>{const Base=v.BombTowerGame;v.BombTowerGame=class extends Base{constructor(...args){super(...args);window.testBombGame=this;}};api=v;}});});
  await page.goto('http://127.0.0.1:4173/test');await page.locator('[data-category="bomb-tower"]').click();assert.equal(await page.locator('.asset-card').count(),3);assert.match(await page.locator('#enemy-description').textContent(),/55～125/);
  await page.locator('#bomb-tower-demo').click();assert.equal(await page.locator('#object-count').textContent(),'13 個物件');
  await page.screenshot({path:'art/bomb-towers/test-desktop.png',fullPage:true});
  await page.locator('#simulate').click();await page.waitForFunction(()=>window.testBombGame?.bombs.length>0);await page.locator('#play-animation').click();
  const paused=await page.evaluate(()=>testBombGame.time);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>testBombGame.time),paused);
  await page.locator('#test-stage').screenshot({path:'art/bomb-towers/test-flight.png'});
  await page.locator('#play-animation').click();await page.waitForFunction(()=>testBombGame.effects.some(e=>e.kind==='tower-bomb-explosion'));await page.locator('#play-animation').click();
  await page.locator('#test-stage').screenshot({path:'art/bomb-towers/test-explosion.png'});
  assert.ok(await page.evaluate(()=>testBombGame.kills>0||testBombGame.enemies.some(e=>e.hp<e.maxHp)));
  assert.ok(await page.evaluate(()=>testBombGame.slots[0].hp<100),'demo must show self damage');
  assert.ok(await page.evaluate(()=>testBombGame.walls[0].hp<300),'demo must show friendly wall damage');
  assert.equal(await page.evaluate(()=>testBombGame.bullets.length),0);
  await page.locator('#simulate').click();assert.equal(await page.locator('#object-count').textContent(),'13 個物件');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/bomb-towers/test-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#simulate').click();await page.waitForFunction(()=>testBombGame.bombs.length>0);await page.locator('#play-animation').click();await page.locator('#test-stage').screenshot({path:'art/bomb-towers/test-mobile-flight.png'});
  const campaignRequests=[];page.on('request',r=>{if(r.url().includes('bomb-tower'))campaignRequests.push(r.url());});
  for(const file of ['tutorial.html','level-two.html']){await page.goto('http://127.0.0.1:4173/'+file);await page.waitForFunction(()=>document.querySelector('#wave').textContent.startsWith('0 /'));assert.equal(await page.locator('[data-category="bomb-tower"]').count(),0);}
  assert.deepEqual(campaignRequests,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync('art/bomb-towers/verification.json',JSON.stringify({checks:['three tower assets and range description','one-click demo','live bomb flight','pause freezes travel and animation','explosion and damage','live self damage','live friendly wall damage','no arrow shots from bomb towers','restore original objects','390px layout and combat','no campaign asset loads'],errors},null,2));console.log('Bomb tower browser checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
