const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 await page.goto('http://127.0.0.1:4173/test');await page.waitForFunction(()=>!document.querySelector('#wall-demo').disabled);await page.locator('#wall-demo').click();
 assert.equal(await page.locator('#object-count').textContent(),'10 個物件');assert.equal(await page.locator('.asset-card').count(),2);
 await page.locator('#show-grid').uncheck();await page.locator('#test-stage').screenshot({path:'art/walls-topdown/test-stages.png'});
 await page.screenshot({path:'art/walls-topdown/test-desktop.png',fullPage:true});
 const b=await page.locator('#test-stage').boundingBox();await page.mouse.click(b.x+240*b.width/1280,b.y+260*b.height/768);await page.locator('#fence-condition').selectOption('50');assert.equal(await page.locator('#fence-condition').inputValue(),'50');await page.locator('#undo').click();
 assert.ok(await page.evaluate(()=>TestWallSprites.file('horizontal')!==TestWallSprites.file('vertical')));
 assert.ok(await page.evaluate(()=>{for(const orientation of ['horizontal','vertical'])for(const hp of [300,240,150,75]){const w={x:400,y:300,orientation,hp,maxHp:300},b=TestWallSprites.bounds(w),h=TestWallSprites.healthBar(w);if(h.y+h.h!==b.y-6)return false;}return true;}));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/walls-topdown/test-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('Passed: ten sprites, separate orientations, HP preview, undo, HP anchoring, mobile layout, no load errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
