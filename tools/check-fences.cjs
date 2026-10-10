const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await page.addInitScript(()=>{let api;Object.defineProperty(window,'BombTowers',{get:()=>api,set:v=>{const Base=v.BombTowerGame;v.BombTowerGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};api=v;}});});
  await page.goto('http://127.0.0.1:4173/test');await page.waitForFunction(()=>!document.querySelector('#fence-demo').disabled);
  await page.locator('[data-category="fence"]').click();assert.equal(await page.locator('.asset-card').count(),2);assert.equal(await page.locator('#object-scale').count(),0);assert.ok(await page.locator('#view-zoom').isEnabled());
  const point=async(x,y)=>{const b=await page.locator('#test-stage').boundingBox();return{x:b.x+x*b.width/1280,y:b.y+y*b.height/768};};
  const click=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);};
  await click(400,250);assert.equal(await page.locator('#object-count').textContent(),'0 個物件');assert.match(await page.locator('#lab-status').textContent(),/道路/);
  await click(896,208);assert.equal(await page.locator('#object-count').textContent(),'1 個物件');
  await click(896,208);assert.equal(await page.locator('#object-count').textContent(),'1 個物件');
  await page.locator('#tool-move').click();await click(896,208);await page.locator('#fence-condition').selectOption('25');
  const start=await point(896,208),end=await point(700,200);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await page.mouse.up();assert.match(await page.locator('#lab-status').textContent(),/道路/);
  await page.locator('#fence-demo').click();assert.equal(await page.locator('#object-count').textContent(),'7 個物件');await page.screenshot({path:'art/fences/test-desktop.png',fullPage:true});
  await page.locator('#simulate').click();await page.waitForFunction(()=>testGame.walls[0].hp<150);await page.locator('#play-animation').click();assert.equal(await page.evaluate(()=>testGame.walls[0].material),'wood');await page.locator('#test-stage').screenshot({path:'art/fences/test-damage.png'});
  await page.locator('#simulate').click();assert.equal(await page.locator('#object-count').textContent(),'7 個物件');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/fences/test-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const requests=[];page.on('request',r=>{if(r.url().includes('fence'))requests.push(r.url());});for(const file of ['tutorial.html','level-two.html'])await page.goto('http://127.0.0.1:4173/'+file);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log('Fence browser checks passed: roads, overlap, drag rejection, damage, mobile, campaign isolation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
