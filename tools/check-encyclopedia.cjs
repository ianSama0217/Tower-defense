const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  fs.mkdirSync('art/encyclopedia',{recursive:true});
  await page.goto('http://127.0.0.1:4173/#levels');await page.locator('#level-screen').waitFor({state:'visible'});
  await page.locator('#encyclopedia-open').click();
  assert.equal(await page.locator('.encyclopedia-tabs button').count(),3);
  assert.equal(await page.locator('.encyclopedia-entry').count(),6);
  assert.equal(await page.locator('#encyclopedia-name').textContent(),'???');
  assert.equal(await page.locator('#encyclopedia-portrait .is-unknown').evaluate(e=>getComputedStyle(e).filter),'brightness(0)');
  assert.ok(!/出現關卡|蝙蝠|巨人|其他/.test(await page.locator('#encyclopedia-dialog').textContent()));
  await artReady();await page.screenshot({path:'art/encyclopedia/unknown-desktop.png'});
  await page.keyboard.press('Escape');assert.ok(await page.locator('#encyclopedia-dialog').isHidden());
  assert.equal(await page.evaluate(()=>document.activeElement.id),'encyclopedia-open');
  assert.ok(await page.locator('#world-settings').isHidden());
  await page.evaluate(()=>{LevelProgress.createEncounterTracker(localStorage).encounter(1);localStorage.setItem('td-level-stars','[3,3,3,3,0]');});
  await page.reload();await page.locator('#encyclopedia-open').click();
  await page.getByRole('button',{name:'哥布林',exact:true}).click();
  assert.equal(await page.locator('#encyclopedia-name').textContent(),'哥布林');
  assert.ok((await page.locator('#encyclopedia-stats').textContent()).includes('50'));
  await artReady();await page.screenshot({path:'art/encyclopedia/enemy-desktop.png'});
  await page.getByRole('tab',{name:'塔防',exact:true}).click();
  await page.getByRole('button',{name:'Lv.3',exact:true}).click();
  assert.ok((await page.locator('#encyclopedia-stats').textContent()).includes('34'));
  await page.getByRole('button',{name:'炸彈塔',exact:true}).click();
  await artReady();await page.screenshot({path:'art/encyclopedia/tower-desktop.png'});
  await page.getByRole('tab',{name:'防禦建築',exact:true}).click();assert.equal(await page.locator('.encyclopedia-entry').count(),1);
  assert.equal(await page.locator('#encyclopedia-name').textContent(),'柵欄');
  for(const view of [{width:1440,height:900},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:640,height:240}]){
   await page.setViewportSize(view);
   for(const category of ['敵人','塔防','防禦建築']){
    await page.getByRole('tab',{name:category,exact:true}).click();
    const rect=await page.locator('#encyclopedia-dialog').boundingBox();
    assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1,`offscreen ${JSON.stringify(view)}`);
    assert.equal(await page.locator('.encyclopedia-detail').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`horizontal overflow ${view.width} ${category}`);
    await page.locator('#encyclopedia-traits').scrollIntoViewIfNeeded();
    const close=await page.locator('#encyclopedia-close').boundingBox();assert.ok(close.y>=0&&close.y+close.height<=view.height,'Close button remains reachable');
    assert.ok(await page.locator('.encyclopedia-detail').evaluate(e=>e.clientHeight>=60),'Detail remains readable in short viewports');
    await page.locator('.encyclopedia-detail').evaluate(e=>e.scrollTop=0);
    if(view.width===390){await artReady();await page.screenshot({path:`art/encyclopedia/mobile-${category}.png`});}
   }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('tab',{name:'敵人',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'塔防',exact:true}).getAttribute('aria-selected'),'true');
  await page.locator('#encyclopedia-close').click();await page.locator('#world-settings-open').click();assert.ok(await page.locator('#world-settings').isVisible());await page.keyboard.press('Escape');
  await page.locator('[data-stage="1"]').click();assert.ok(await page.locator('#stage-dialog').isVisible());await page.keyboard.press('Escape');
  await page.locator('#encyclopedia-open').click();await page.mouse.click(2,2);assert.ok(await page.locator('#encyclopedia-dialog').isHidden());
  // Reveal every entry in this isolated profile to verify all sprite assets, including the boss.
  await page.evaluate(()=>localStorage.setItem('td-encountered-enemies','[1,2,3,4,5,6,7]'));
  await page.locator('#encyclopedia-open').click();await page.getByRole('tab',{name:'敵人',exact:true}).click();
  for(let i=0;i<6;i++){await page.locator('.encyclopedia-entry').nth(i).click();await artReady();assert.equal(await page.locator('#encyclopedia-portrait .is-unknown').count(),0);}
  await page.screenshot({path:'art/encyclopedia/captain-desktop.png'});
  assert.deepEqual(errors,[]);console.log('Encyclopedia: discovery, categories, stats, keyboard, responsive layouts, and existing dialogs passed.');
  async function artReady(){await page.evaluate(async()=>{await document.fonts.ready;const urls=new Set();for(const e of document.querySelectorAll('#encyclopedia-dialog, #encyclopedia-dialog *'))for(const value of [getComputedStyle(e).backgroundImage,getComputedStyle(e).borderImageSource])for(const m of value.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(m[1]);await Promise.all([...urls].map(async url=>{const img=new Image();img.src=url;await img.decode();}));});}
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
