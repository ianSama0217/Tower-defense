const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{
      let level;Object.defineProperty(window,'LevelTwo',{get:()=>level,set:value=>{
        const Base=value.LevelTwoGame;value.LevelTwoGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};level=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/index.html#levels');
    await page.evaluate(()=>{localStorage.setItem('td-level-stars','[3,0,0,0,0]');localStorage.removeItem('td-encountered-enemies');});
    await page.reload();await page.locator('.level-node').nth(1).click();
    await page.locator('#stage-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('.enemy-card').count(),2);
    assert.equal(await page.locator('.enemy-card.is-undiscovered').count(),1);
    await page.locator('#stage-enter').click();await page.waitForURL('**/level-two.html');
    await page.waitForFunction(()=>window.testGame?.phase==='playing'&&document.querySelector('#wave').textContent==='0 / 6');
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.pad-button').count(),9);
    await page.screenshot({path:'art/level-2/level-2-desktop.png'});
    await page.locator('.pad-button').nth(3).click();await page.locator('#build').click();
    await page.waitForFunction(()=>testGame.slots[3].level===1&&!testGame.slots[3].action);
    await page.evaluate(()=>{testGame.money=500;});
    await page.waitForFunction(()=>!document.querySelector('#upgrade').disabled);
    await page.locator('#upgrade').click();await page.locator('#pause').click();
    const elapsed=await page.evaluate(()=>testGame.slots[3].action.elapsed);
    await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>testGame.slots[3].action.elapsed),elapsed);
    await page.locator('#resume').click();await page.waitForFunction(()=>testGame.slots[3].level===2&&!testGame.slots[3].action);
    await page.keyboard.press('Escape');await page.locator('#wave-control').click();
    await page.waitForFunction(()=>testGame.enemies.some(e=>e.routeIndex===0)&&testGame.enemies.some(e=>e.routeIndex===1));
    await page.screenshot({path:'art/level-2/level-2-battle.png'});
    // Verify actual live archer sprite, projectiles and wave HUD using the configured second wave.
    await page.evaluate(()=>{testGame.start();testGame.wave=1;testGame.launchWave();});
    await page.waitForFunction(()=>testGame.enemies.some(e=>e.level===6&&e.routeIndex===1));
    await page.waitForFunction(()=>document.querySelector('#wave').textContent==='2 / 6');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'art/level-2/level-2-mobile.png'});
    await page.locator('.pad-button').nth(8).click();
    await page.locator('#tower-drawer').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
    const drawer=await page.locator('#tower-drawer').boundingBox(),frame=await page.locator('.game-window').boundingBox();
    assert.ok(drawer.y>=frame.y&&drawer.y+drawer.height<=frame.y+frame.height+1);
    await page.screenshot({path:'art/level-2/level-2-mobile-drawer.png'});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{testGame.phase='won';testGame.wave=6;testGame.kills=103;testGame.lives=3;});
    await page.locator('#result').waitFor({state:'visible'});
    assert.match(await page.locator('.result-heading').textContent(),/第 2 關/);
    assert.equal(await page.locator('#result-waves').textContent(),'6');
    assert.equal(await page.locator('#result-next').isDisabled(),true);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('td-level-stars'))),[3,3,0,0,0]);
    await page.locator('#restart').click();assert.equal(await page.locator('#wave').textContent(),'0 / 6');
    await page.goto('http://127.0.0.1:4173/tutorial.html');
    await page.waitForFunction(()=>!document.querySelector('#wave-control').disabled);
    assert.equal(await page.locator('#wave').textContent(),'0 / 4');assert.equal(await page.locator('.pad-button').count(),4);
    assert.deepEqual(errors,[]);
    fs.writeFileSync('art/level-2/verification.json',JSON.stringify({browser:'Edge',checks:['unlocked level-two entry','archer silhouette before encounter','nine pads and six-wave HUD','build and upgrade','pause freezes construction','simultaneous lanes','live archer wave','390px layout and drawer','separate second-level result and stars','restart','first-level regression'],errors},null,2)+'\n');
    console.log('Level two browser checks passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
