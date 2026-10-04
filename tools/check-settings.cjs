const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  let tutorial;
  Object.defineProperty(window,'Tutorial',{get:()=>tutorial,set:value=>{
   const Original=value.TutorialGame;
   value.TutorialGame=class extends Original{constructor(...args){super(...args);window.testGame=this;}};
   tutorial=value;
  }});
 });
 async function art(){await page.locator('.forest-settings[open]').evaluate(async dialog=>{
  const urls=new Set();for(const e of [dialog,...dialog.querySelectorAll('*')]){
   if(e.tagName==='IMG')urls.add(e.src);
   for(const pseudo of [null,'::before']){const s=getComputedStyle(e,pseudo);for(const value of [s.backgroundImage,s.borderImageSource])for(const m of value.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(m[1]);}
  }await Promise.all([...urls].map(async src=>{const image=new Image();image.src=src;await image.decode();}));
 });}
 async function volume(selector,value){await page.locator(selector).fill(String(value));}
 await page.goto('http://127.0.0.1:4173/#levels');await page.locator('#world-settings-open').click();
 await volume('#world-volume',80);await volume('#world-music',60);
 assert.equal(await page.locator('[data-volume-output="sound"]').textContent(),'80%');
 assert.equal(await page.locator('[data-volume-output="music"]').textContent(),'60%');
 await art();await page.screenshot({path:'art/settings/map-desktop.png'});
 for(const view of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:640,height:240}]){
  await page.setViewportSize(view);await page.waitForTimeout(80);
  for(const selector of ['#world-settings','.forest-volume-row','.forest-display-options','.forest-settings-actions']){
   for(const e of await page.locator(selector).all())assert.equal(await e.evaluate(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1),false,`${selector} overflow at ${JSON.stringify(view)}`);
  }
  const box=await page.locator('#world-settings').boundingBox();assert.ok(box.y>=0&&box.x>=0&&box.y+box.height<=view.height+1);
  if(view.width===390)await page.screenshot({path:'art/settings/map-mobile.png'});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-display-option="damageNumbers"]').uncheck();await page.locator('[data-display-option="enemyHealth"]').uncheck();
 await volume('#world-volume',0);assert.equal(await page.locator('[data-volume-output="sound"]').textContent(),'0%');
 await volume('#world-volume',100);assert.equal(await page.locator('[data-volume-output="sound"]').textContent(),'100%');
 await page.locator('#world-volume').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-volume-output="sound"]').textContent(),'99%');
 await volume('#world-volume',80);await page.locator('#world-resume').click();assert.equal(await page.locator('#world-settings').isVisible(),false);
 await page.locator('[data-stage="1"]').click();await page.locator('#stage-enter').click();await page.locator('#wave-control:not([disabled])').waitFor();
 await page.locator('#wave-control').click();await page.waitForFunction(()=>testGame.enemies.length>0);await page.locator('#pause').click();
 assert.equal(await page.locator('#game-settings a').textContent(),'返回關卡選單');
 assert.equal(await page.locator('[data-volume-output="sound"]').textContent(),'80%');assert.equal(await page.locator('[data-volume-output="music"]').textContent(),'60%');
 assert.deepEqual(await page.evaluate(()=>gameDisplay),{damageNumbers:false,enemyHealth:false});
 const time=await page.evaluate(()=>testGame.time);await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>testGame.time),time);
 await page.locator('[data-display-option="damageNumbers"]').check();await page.locator('[data-display-option="enemyHealth"]').check();
 await volume('#battle-music',35);assert.equal(await page.locator('[data-volume-output="music"]').textContent(),'35%');
 await art();await page.screenshot({path:'art/settings/battle-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);await page.screenshot({path:'art/settings/battle-mobile.png'});
 assert.equal(await page.locator('#game-settings').evaluate(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1),false);
 await page.locator('#resume').click();await page.waitForFunction(previous=>testGame.time>previous,time);
 await page.locator('#pause').click();await page.locator('#close-settings').click();assert.equal(await page.locator('#game-settings').isVisible(),false);
 await page.locator('#pause').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#game-settings').isVisible(),false);
 await page.locator('#pause').click();await page.locator('#game-settings a').click();await page.locator('#world-settings-open').click();
 assert.equal(await page.locator('[data-volume-output="music"]').textContent(),'35%');assert.equal(await page.locator('[data-display-option="damageNumbers"]').isChecked(),true);
 await page.reload();await page.locator('#world-settings-open').click();assert.equal(await page.locator('[data-volume-output="music"]').textContent(),'35%');
 await page.locator('#world-back').click();assert.equal(await page.locator('#start-screen').isVisible(),true);
 assert.deepEqual(errors,[]);await browser.close();console.log('Settings checks passed: dynamic percentages, keyboard, 0–100%, persisted independent volumes and display options, pause/resume/Escape, both return destinations, desktop/mobile/short windows.');
})().catch(error=>{console.error(error);process.exit(1);});
