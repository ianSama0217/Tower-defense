const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  // A fresh browser context keeps the user's real save out of this destructive-flow check.
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  const saved={'td-level-stars':'[3,3,3,3,3]','td-encountered-enemies':'[1,2,3,4,5,6,7]','td-tutorial-complete':'true','td-sound-settings':'{"volume":0.7,"musicVolume":0.3}','td-display-settings':'{"enemyHealth":false}','td-menu-settings':'{"speed":2}','unrelated':'keep'};
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(data=>{for(const [key,value] of Object.entries(data))localStorage.setItem(key,value);},saved);await page.reload();
  await page.locator('#home-restart:not([disabled])').waitFor();
  const snapshot=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  for(const view of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
   await page.setViewportSize(view);
   await page.locator('#home-art').evaluate(img=>img.decode());
   const boxes=await Promise.all(['#start','#home-restart','#settings-open'].map(s=>page.locator(s).boundingBox()));
   assert.ok(boxes[0].y+boxes[0].height<boxes[1].y&&boxes[1].y+boxes[1].height<boxes[2].y);
   if(view.width===1440||view.width===390)await page.screenshot({path:`art/home/restart-home-${view.width}.png`});
   await page.locator('#home-restart').click();
   assert.equal(await page.locator('#restart-dialog').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'restart-cancel');
   assert.match(await page.locator('#restart-description').textContent(),/重置.*無法復原/);
   assert.deepEqual(await snapshot(),saved);
   const r=await page.locator('#restart-dialog').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.y+r.height<=view.height+1);
   assert.equal(await page.locator('#restart-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1),false);
   if(view.width===1440||view.width===390)await page.screenshot({path:`art/home/restart-confirm-${view.width}.png`});
   await page.locator('#restart-cancel').click();assert.deepEqual(await snapshot(),saved);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'home-restart');
  }
  for(const action of ['escape','close','backdrop']){
   await page.locator('#home-restart').click();
   if(action==='escape')await page.keyboard.press('Escape');else if(action==='close')await page.locator('#restart-close').click();else await page.mouse.click(1,1);
   assert.equal(await page.locator('#restart-dialog').isVisible(),false);assert.deepEqual(await snapshot(),saved);
  }
  await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-dialog').isVisible(),true);await page.locator('#home-settings-close').click();
  await page.locator('#start').click();assert.equal(await page.locator('.level-node.is-locked').count(),0);assert.deepEqual(await snapshot(),saved);
  await page.goto('http://127.0.0.1:4173/');await page.locator('#home-restart:not([disabled])').waitFor();
  await page.locator('#home-restart').click();
  await page.evaluate(()=>{window.originalRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(){throw new Error('test storage blocked');};});
  await page.locator('#restart-confirm').click();assert.equal(await page.locator('#restart-error').isVisible(),true);assert.deepEqual(await snapshot(),saved);
  await page.evaluate(()=>{Storage.prototype.removeItem=window.originalRemoveItem;});
  await page.locator('#restart-confirm').click();await page.waitForURL('**/index.html#levels');await page.locator('#level-screen').waitFor({state:'visible'});
  for(const key of ['td-level-stars','td-encountered-enemies','td-tutorial-complete'])assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
  for(const key of ['td-sound-settings','td-display-settings','td-menu-settings','unrelated'])assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),saved[key]);
  assert.equal(await page.locator('#start-screen').isVisible(),false);
  assert.equal(await page.locator('.level-node.is-locked').count(),4);assert.equal(await page.locator('.node-stars .earned').count(),0);
  await page.goto('http://127.0.0.1:4173/#levels');assert.equal(await page.locator('.level-node.is-locked').count(),4);assert.equal(await page.locator('.node-stars .earned').count(),0);
  assert.deepEqual(errors,[]);fs.writeFileSync('art/home/restart-verification.json',JSON.stringify({checks:['three menu controls aligned','desktop, mobile, landscape and short viewport','cancel/close/Escape/backdrop preserve records','cancel focused by default','storage failure stays in dialog','confirm resets campaign and legacy save','preferences retained','confirmation opens level selection with only stage one unlocked','later stages locked after reload'],errors},null,2)+'\n');
  console.log('Home restart checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
