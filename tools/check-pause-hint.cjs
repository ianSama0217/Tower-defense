const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await page.addInitScript(()=>{localStorage.setItem('td-menu-settings','{"speed":1}');});
  fs.mkdirSync('art/pause-hint',{recursive:true});
  async function pause(){for(let i=0;i<3;i++)await page.locator('#speed').click();await page.locator('#pause-shade').waitFor({state:'visible'});}
  const hint=page.locator('#pause-resume-hint');
  for(const file of ['tutorial','level-two','level-three','level-four','level-five']){
   await page.goto(`http://127.0.0.1:4173/${file}.html`);await page.locator('#speed:not([disabled])').waitFor();
   assert.equal(await hint.isVisible(),false);await pause();
   await page.waitForTimeout(2600);assert.equal(await hint.isVisible(),false,`${file}: no hint before three seconds`);
   await hint.waitFor({state:'visible',timeout:1600});
   assert.match(await hint.getAttribute('src'),/cursor-hand\.png$/);
   assert.equal(await hint.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   const speed=await page.locator('#speed').boundingBox(),hand=await hint.boundingBox();assert.ok(hand.y>speed.y+speed.height);
   const transform=await hint.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(200);assert.notEqual(await hint.evaluate(e=>getComputedStyle(e).transform),transform);
   if(file==='tutorial'){
    await page.mouse.move(0,0);await page.screenshot({path:'art/pause-hint/desktop.png'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/pause-hint/mobile.png'});
    const handMobile=await hint.boundingBox();assert.ok(handMobile.x>=0&&handMobile.x+handMobile.width<=390);
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await hint.evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#pause').click();assert.equal(await hint.isVisible(),false);
    await page.waitForTimeout(3200);assert.equal(await hint.isVisible(),false);
    await page.locator('#close-settings').click();assert.equal(await hint.isVisible(),false);
    await page.waitForTimeout(2600);assert.equal(await hint.isVisible(),false);await hint.waitFor({state:'visible',timeout:1600});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await hint.isVisible(),false);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(2600);assert.equal(await hint.isVisible(),false);await hint.waitFor({state:'visible',timeout:1600});
   }
   await page.locator('#speed').click();assert.equal(await hint.isVisible(),false);assert.equal(await page.locator('#pause-shade').isVisible(),false);
  }
  // Resuming before the deadline must not leave a delayed hint behind.
  await pause();await page.waitForTimeout(500);await page.locator('#speed').click();await page.waitForTimeout(3200);assert.equal(await hint.isVisible(),false);
  assert.deepEqual(errors,[]);
  fs.writeFileSync('art/pause-hint/verification.json',JSON.stringify({checks:['all five stages wait three seconds','shared cursor image and gentle motion','resume hides hint and cancels pending display','settings and hidden tab reset the delay','desktop/mobile positioning','reduced motion','no intercepted input'],errors},null,2)+'\n');
  console.log('Pause cursor hint checks passed across all five stages.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
