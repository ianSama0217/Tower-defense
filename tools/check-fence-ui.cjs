const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('td-level-stars','[3,3,0,0,0]');localStorage.setItem('td-menu-settings','{"speed":1}');
   let level;Object.defineProperty(window,'LevelThree',{get:()=>level,set:value=>{const Base=value.LevelThreeGame;value.LevelThreeGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};level=value;}});
  });
  await page.goto('http://127.0.0.1:4173/level-three.html');
  await page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
  await page.evaluate(()=>{testGame.money=1000;});
  async function select(x,y=400){const r=await page.locator('#battlefield').boundingBox();await page.mouse.click(r.x+x/1280*r.width,r.y+y/768*r.height);await page.locator('.road-build-info').waitFor({state:'visible'});await page.locator('#tower-drawer').evaluate(async e=>Promise.all(e.getAnimations().map(a=>a.finished)));}
  await select(1008);
  assert.equal(await page.locator('#road-stat-health b').textContent(),'150/150');
  assert.equal(await page.locator('#road-stat-time b').textContent(),'0 秒');
  assert.equal(await page.locator('#build-stock').textContent(),'3/3');
  assert.equal(await page.locator('#build-time').isVisible(),false);
  fs.mkdirSync('art/fence-ui',{recursive:true});await page.screenshot({path:'art/fence-ui/build-desktop.png'});
  await page.locator('#build').click();await select(1008);
  assert.equal(await page.locator('#build-stock').textContent(),'2/3');
  assert.equal(await page.locator('#build').isDisabled(),true);
  // Let a real enemy attack while the open drawer follows health and block time.
  await page.evaluate(()=>{const w=testGame.walls[0];testGame.enemies=[{id:1,level:1,hp:44,maxHp:44,targetId:w.id,x:w.x+w.width/2+64,y:w.y,routeIndex:0,distance:200,remaining:1000,attackCooldown:100}];for(let i=0;i<80;i++)testGame.update(.1);testGame.enemies=[];testGame.damageTower(w,30);});
  await page.waitForFunction(()=>document.querySelector('#road-stat-time b').textContent==='8 秒');
  assert.equal(await page.locator('#road-stat-health b').textContent(),'120/150');
  await page.screenshot({path:'art/fence-ui/stats-desktop.png'});
  await page.locator('#pause').click();const t=await page.evaluate(()=>testGame.walls[0].blockedTime);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>testGame.walls[0].blockedTime),t);await page.locator('#resume').click();
  await select(832,336);await page.locator('#build').click();await select(96);
  assert.equal(await page.locator('#build-stock').textContent(),'1/3');await page.locator('#build').click();await select(256);
  assert.equal(await page.locator('#build-stock').textContent(),'0/3');assert.equal(await page.locator('#build').isDisabled(),true);
  await page.evaluate(()=>testGame.damageTower(testGame.walls[0],150));await select(1008);assert.equal(await page.locator('#build-stock').textContent(),'0/3');
  await page.locator('.pad-button').nth(5).click();assert.equal(await page.locator('#build-stock').isVisible(),false);assert.equal(await page.locator('#build-time').isVisible(),true);assert.equal(await page.locator('.road-build-info').isVisible(),false);
  await select(832,336);await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.fonts.ready);await page.locator('#tower-drawer').evaluate(async e=>Promise.all(e.getAnimations().map(a=>a.finished)));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const info=await page.locator('.road-build-info').boundingBox(),drawer=await page.locator('#tower-drawer').boundingBox();assert.ok(info.x+info.width<=drawer.x+drawer.width&&info.y+info.height<=drawer.y+drawer.height);
  await page.screenshot({path:'art/fence-ui/stats-mobile.png'});assert.deepEqual(errors,[]);
  console.log('Fence UI: stock 3/3 through 0/3, live HP/block time, arrow clock, desktop/mobile passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
