const {chromium}=require('playwright');
// Run with Playwright installed (or NODE_PATH pointing to the bundled packages).
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{
   let tutorial;
   Object.defineProperty(window,'Tutorial',{get:()=>tutorial,set:value=>{
     const Original=value.TutorialGame;
     value.TutorialGame=class extends Original{constructor(...args){super(...args);window.testGame=this;}};
     tutorial=value;
   }});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function waitForDialogArt(){
   await page.locator('#stage-dialog').evaluate(async dialog=>{
     const urls=new Set();
     for(const element of [dialog,...dialog.querySelectorAll('*')]){
       const style=getComputedStyle(element);
       for(const value of [style.backgroundImage,style.borderImageSource]){
         for(const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(match[1]);
       }
     }
     await Promise.all([...urls].map(async url=>{const image=new Image();image.src=url;await image.decode();}));
   });
 }
 await page.goto('http://127.0.0.1:4173/#levels');
 await page.locator('#level-screen').waitFor({state:'visible'});
 await page.locator('.map-surface').evaluate(async e=>{const image=new Image();image.src='assets/ui/forest-world-map.png';await image.decode();});
 await page.screenshot({path:'art/level-select/map-desktop.png'});
 await page.locator('[data-stage="1"]').click();
 await waitForDialogArt();
 await page.screenshot({path:'art/level-select/dialog-desktop.png'});
 if(await page.locator('#stage-enemies li').count()!==2)throw Error('Enemy preview missing');
 if(await page.locator('.enemy-card.is-undiscovered').count()!==2)throw Error('New player saw undiscovered enemies');
 await page.keyboard.press('Escape');
 if(await page.locator('#level-screen').isHidden())throw Error('Escape left map');
 await page.locator('[data-stage="2"]').click();
 if(!await page.locator('#stage-enter').isDisabled())throw Error('Locked stage playable');
 await page.locator('#stage-close').click();
 await page.evaluate(()=>LevelProgress.record(localStorage,0,1));await page.reload();
 await page.locator('#level-screen').waitFor({state:'visible'});
 if(await page.locator('[data-stage="2"]').evaluate(e=>e.classList.contains('is-locked')))throw Error('One star did not unlock stage 2');
 if(!await page.locator('[data-stage="3"]').evaluate(e=>e.classList.contains('is-locked')))throw Error('Stage 3 incorrectly unlocked');
 await page.locator('[data-stage="2"]').click();
 if(!await page.locator('#stage-enter').isDisabled())throw Error('Unimplemented stage playable');
 await page.locator('#stage-close').click();
 await page.setViewportSize({width:390,height:844});await page.reload();
 await page.locator('#level-screen').waitFor({state:'visible'});
 await page.screenshot({path:'art/level-select/map-mobile.png'});
 await page.locator('[data-stage="1"]').click();await waitForDialogArt();await page.screenshot({path:'art/level-select/dialog-mobile.png'});
 await page.locator('#stage-enter').click();await page.waitForURL('**/tutorial.html');
 await page.locator('#wave-control:not([disabled])').waitFor();
 await page.evaluate(()=>{testGame.lives=1;testGame.phase='won';});
 await page.locator('#result[open]').waitFor();
 if(!await page.locator('#save-note').textContent().then(t=>t.includes('第 2 關已解鎖')))throw Error('Victory save integration failed');
 if(await page.evaluate(()=>JSON.parse(localStorage.getItem('td-level-stars'))[0])!==1)throw Error('Victory stars not saved');
 await page.locator('#result a').click();await page.locator('#level-screen').waitFor({state:'visible'});
 if(await page.locator('[data-stage="2"]').evaluate(e=>e.classList.contains('is-locked')))throw Error('Victory return did not unlock');
 await page.evaluate(()=>{localStorage.removeItem('td-level-stars');localStorage.setItem('td-tutorial-complete','true');});await page.reload();
 await page.locator('#level-screen').waitFor({state:'visible'});
 if(await page.locator('[data-stage="2"]').evaluate(e=>e.classList.contains('is-locked')))throw Error('Legacy save migration failed');
 // Every stop and both dialogs must fit without scrolling, including short landscape windows.
 for(const viewport of [{width:1920,height:990},{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:640,height:240}]){
   await page.setViewportSize(viewport);
   await page.waitForTimeout(80);
   for(const selector of ['html','body','#level-screen','#world-map','.map-surface']){
     if(await page.locator(selector).evaluate(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1))throw Error(`Overflow ${selector} at ${JSON.stringify(viewport)}`);
   }
   for(let stage=1;stage<=5;stage++){
     const node=page.locator(`[data-stage="${stage}"]`),box=await node.boundingBox();
     if(box.x<0||box.y<0||box.x+box.width>viewport.width||box.y+box.height>viewport.height)throw Error(`Clipped stage ${stage}`);
     await node.click();await checkDialog('#stage-dialog',viewport);await page.locator('#stage-close').click();
   }
   await page.locator('#world-settings-open').click();await checkDialog('#world-settings',viewport);
   await page.locator('#world-settings-close').click();
 }
 async function checkDialog(selector,viewport){
   const modal=page.locator(selector),box=await modal.boundingBox();
   if(box.x<0||box.y<0||box.x+box.width>viewport.width+1||box.y+box.height>viewport.height+1)throw Error(`Dialog offscreen ${selector}`);
   if(await modal.evaluate(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1))throw Error(`Dialog overflow ${selector} at ${JSON.stringify(viewport)}`);
   for(const button of await modal.locator('button').all()){
     const b=await button.boundingBox();
     if(b.x<box.x||b.y<box.y||b.x+b.width>box.x+box.width+1||b.y+b.height>box.y+box.height+1)throw Error(`Clipped button ${selector}`);
   }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('#world-settings-open').click();
 await page.locator('#world-volume').focus();await page.keyboard.press('Home');
 for(let i=0;i<73;i++)await page.keyboard.press('ArrowRight');
 if(await page.evaluate(()=>gameSound.volume)!==.73)throw Error('Volume not applied');
 await page.screenshot({path:'art/level-select/settings-desktop.png'});
 await page.locator('#world-back').click();
 if(!await page.locator('#start-screen').isVisible())throw Error('Return home failed');
 await page.locator('#settings-open').click();
 if(await page.locator('#sound-volume').inputValue()!=='73'||await page.locator('#sound-muted').isChecked())throw Error('Home sound controls out of sync');
 await page.keyboard.press('Escape');await page.locator('#start').click();
 await page.reload();await page.locator('#level-screen').waitFor({state:'visible'});
 await page.locator('#world-settings-open').click();
 if(await page.locator('#world-volume').inputValue()!=='73')throw Error('Sound settings not persisted');
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 if(!await page.locator('#world-settings').isVisible())throw Error('Map Escape did not open settings');
 await page.keyboard.press('Escape');
 const fresh=await browser.newPage({viewport:{width:1440,height:900}});
 fresh.on('pageerror',e=>errors.push(e.message));
 await fresh.goto('http://127.0.0.1:4173/tutorial.html');
 await fresh.locator('#wave-control:not([disabled])').waitFor();
 if(await fresh.evaluate(()=>LevelProgress.readEncountered(localStorage).length)!==0)throw Error('Entering a stage revealed enemies');
 await fresh.locator('#wave-control').click();
 await fresh.waitForFunction(()=>LevelProgress.readEncountered(localStorage).includes(5));
 if(await fresh.evaluate(()=>LevelProgress.readEncountered(localStorage).includes(1)))throw Error('Future goblin revealed prematurely');
 await fresh.locator('#pause').click();await fresh.locator('#game-settings a').click();
 await fresh.locator('#level-screen').waitFor({state:'visible'});await fresh.locator('[data-stage="1"]').click();
 if(await fresh.locator('.enemy-card.is-undiscovered').count()!==1)throw Error('Encounter state not reflected in cards');
 if(await fresh.locator('.enemy-card:not(.is-undiscovered) .enemy-name').textContent()!=='史萊姆')throw Error('Wrong enemy identified');
 const silhouette=await fresh.locator('.is-undiscovered .enemy-portrait').evaluate(e=>getComputedStyle(e).filter);
 if(!silhouette.includes('brightness(0)'))throw Error('Unknown enemy is not a black silhouette');
 await fresh.screenshot({path:'art/level-select/dialog-partially-discovered.png'});
 await fresh.reload();await fresh.locator('[data-stage="1"]').click();
 if(await fresh.locator('.enemy-card.is-undiscovered').count()!==1)throw Error('Encounter state did not survive reload');
 await fresh.evaluate(()=>{LevelProgress.record(localStorage,0,3);});
 await fresh.locator('#stage-close').click();await fresh.locator('[data-stage="1"]').click();
 if(await fresh.locator('.enemy-card.is-undiscovered').count()!==0||await fresh.locator('#stage-stars .earned').count()!==3)throw Error('Completion state missing');
 await fresh.screenshot({path:'art/level-select/dialog-completed.png'});
 await fresh.close();
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Browser checks passed: dialogs, Escape, locks, one-star unlock, pending stages, mobile, tutorial navigation, six viewport sizes without overflow, settings, sound sync and persistence; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
