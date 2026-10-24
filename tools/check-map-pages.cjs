const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  fs.mkdirSync('art/level-select-cave',{recursive:true});
  const page=await browser.newPage({viewport:{width:1774,height:887}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:4173/#levels');
  await page.locator('#level-screen').waitFor({state:'visible'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(['cave-world-map.png','map-prev.png','map-next.png','level-markers/banner-blank.png'].map(async file=>{const i=new Image();i.src='assets/ui/'+file;await i.decode();}));});
  assert.equal(await page.locator('.level-node').count(),10);
  assert.equal(await page.locator('#map-prev').isDisabled(),true);
  assert.equal(await page.locator('#map-next').isDisabled(),false);
  await page.screenshot({path:'art/level-select-cave/forest-desktop.png'});
  const initialSave=await page.evaluate(()=>localStorage.getItem('td-level-stars'));
  // Sample during the transition to verify both surfaces really move together.
  await page.locator('#map-next').click();
  await page.waitForTimeout(180);
  const mid=await page.locator('#map-track').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41);
  assert.ok(mid<0&&mid>-1774,`Expected in-flight sliding transform, got ${mid}`);
  await page.screenshot({path:'art/level-select-cave/sliding.png'});
  await page.locator('#map-prev:not([disabled])').waitFor();
  assert.equal(await page.locator('#map-next').isDisabled(),true);
  assert.equal(await page.locator('[data-map-page="0"]').evaluate(e=>e.inert),true);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.stage),'6');
  await page.screenshot({path:'art/level-select-cave/cave-desktop.png'});
  for(let stage=6;stage<=10;stage++){
   await page.locator(`[data-stage="${stage}"]`).click();
   assert.equal(await page.locator('#stage-title').textContent(),`第 ${stage} 關`);
   assert.equal(await page.locator('#stage-enter').isDisabled(),true);
   assert.equal(await page.locator('#stage-enter-label').textContent(),'關卡準備中');
   assert.match(await page.locator('#stage-preview').evaluate(e=>getComputedStyle(e).backgroundImage),/cave-world-map/);
   await page.locator('#stage-close').click();
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),initialSave);
  // Rapid repeated requests never skip or leave the carousel between pages.
  await page.evaluate(()=>{document.getElementById('map-prev').click();document.getElementById('map-next').click();document.getElementById('map-prev').click();});
  await page.locator('#map-next:not([disabled])').waitFor();
  assert.equal(await page.locator('#level-screen').getAttribute('data-map-page'),'0');
  await page.locator('[data-stage="1"]').click();
  assert.equal(await page.locator('#stage-enter').isDisabled(),false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('PageDown');await page.locator('#map-prev:not([disabled])').waitFor();
  await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.stage),'10');
  await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.stage),'6');
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:640,height:240}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   for(const selector of ['#map-prev','#map-next',...Array.from({length:5},(_,i)=>`[data-stage="${i+6}"]`)]){
    const b=await page.locator(selector).boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,`Clipped ${selector}: ${JSON.stringify(viewport)}`);
   }
   await page.locator('[data-stage="10"]').click();
   const b=await page.locator('#stage-dialog').boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1);
   await page.locator('#stage-close').click();
   if(viewport.width===390)await page.screenshot({path:'art/level-select-cave/cave-mobile.png'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#map-prev').click();
  assert.equal(await page.locator('#map-track').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.locator('#world-settings-open').click();await page.locator('#world-back').click();
  assert.equal(await page.locator('#start-screen').isVisible(),true);
  await page.locator('#start').click();assert.equal(await page.locator('#level-screen').getAttribute('data-map-page'),'0');
  assert.deepEqual(errors,[]);
  console.log('PASS: two maps, sliding animation, rapid clicks, 6–10 previews, original stage access, saved progress, keyboard, reduced motion, settings/home, four mobile/landscape sizes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
