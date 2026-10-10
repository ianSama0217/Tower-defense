const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 await page.addInitScript(()=>{let api;Object.defineProperty(window,'BombTowers',{get:()=>api,set:v=>{const Base=v.BombTowerGame;v.BombTowerGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};api=v;}});
 const draw=CanvasRenderingContext2D.prototype.drawImage;window.towerDraws=[];CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='test-stage'&&image.src?.includes('assets/towers/')){window.towerDraws.push(args);if(towerDraws.length>30)towerDraws.shift();}return draw.call(this,image,...args);};});
 await page.goto('http://127.0.0.1:4173/test');await page.waitForFunction(()=>!document.querySelector('#bomber-demo').disabled);
 assert.equal(await page.locator('#object-scale').count(),0);
 await page.locator('#bomber-demo').click();await page.waitForFunction(()=>towerDraws.length);assert.equal(await page.evaluate(()=>towerDraws.at(-1)[2]),83.2);
 await page.locator('#simulate').click();await page.locator('#play-animation').click();
 assert.equal(await page.evaluate(()=>testGame.worldScale),2);assert.equal(await page.evaluate(()=>testGame.level.mapConfig.roadWidth),96);
 const snapshot=await page.evaluate(()=>JSON.stringify({enemies:testGame.enemies,slots:testGame.slots,time:testGame.time}));
 for(const zoom of ['0.5','1','2']){await page.locator('#view-zoom').selectOption(zoom);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.querySelector('#test-stage').getBoundingClientRect().width),1280*Number(zoom));assert.equal(await page.evaluate(()=>JSON.stringify({enemies:testGame.enemies,slots:testGame.slots,time:testGame.time})),snapshot);}
 await page.locator('#view-zoom').selectOption('1');fs.mkdirSync('art/test-scale',{recursive:true});await page.screenshot({path:'art/test-scale/zoom-100.png',fullPage:true});
 await page.locator('#simulate').click();await page.locator('#clear').click();await page.locator('[data-category="enemy"]').click();
 // Placement after zooming and scrolling must still hit the same world point.
 await page.evaluate(()=>{const v=document.querySelector('#stage-wrap');v.scrollLeft=260;v.scrollTop=160;});
 const pos=await page.evaluate(()=>{const r=document.querySelector('#test-stage').getBoundingClientRect();return{x:r.left+640,y:r.top+384};});await page.mouse.click(pos.x,pos.y);
 assert.equal(await page.locator('#object-count').textContent(),'1 個物件');await page.locator('#simulate').click();await page.locator('#play-animation').click();
 assert.ok(await page.evaluate(()=>Math.abs(testGame.enemies[0].y-384)<1));assert.ok(await page.evaluate(()=>Math.abs(testGame.enemies[0].x-640)<30));
 await page.locator('#simulate').click();await page.locator('#view-zoom').selectOption('fit');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.screenshot({path:'art/test-scale/mobile-fit.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#view-zoom').selectOption('2');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#view-zoom').selectOption('fit');await page.locator('#toggle-fullscreen').click();await page.waitForTimeout(100);await page.locator('#toggle-fullscreen').click();
 assert.deepEqual(errors,[]);console.log('Passed: campaign tower sizing/combat scale, independent 50–200% zoom, scroll placement, pause invariance, mobile and fullscreen.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
