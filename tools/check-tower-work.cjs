const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto('http://127.0.0.1:4173/tower-work-preview.html');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('/ 5 秒'));
    await page.locator('#timeline').fill('610');
    const paused=await page.locator('#live').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#live').evaluate(c=>c.toDataURL()),paused);
    await page.screenshot({path:'art/tower-work/upgrade-preview.png'});
    await page.locator('#kind').selectOption('demolish');await page.locator('#timeline').fill('210');
    await page.screenshot({path:'art/tower-work/demolish-hammer-preview.png'});
    await page.locator('#timeline').fill('550');
    await page.screenshot({path:'art/tower-work/demolish-preview.png'});
    await page.locator('#timeline').fill('1000');assert.match(await page.locator('#status').textContent(),/完全拆除/);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'art/tower-work/work-mobile.png'});
    await page.setViewportSize({width:1440,height:1000});
    await page.addInitScript(()=>{
      let tutorial;Object.defineProperty(window,'Tutorial',{get:()=>tutorial,set:value=>{
        const Base=value.TutorialGame;value.TutorialGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};tutorial=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/tutorial.html');
    await page.waitForFunction(()=>window.testGame?.phase==='playing');
    await page.evaluate(()=>{
      testGame.wave=2;testGame.money=1000;testGame.upgradeLearned=true;
      for(const s of testGame.slots)Object.assign(s,{level:1,hp:100,maxHp:100,action:null});
      testGame.build(0);testGame.slots[0].action.elapsed=2.7;
      testGame.slots[1].level=2;testGame.demolish(1);testGame.slots[1].action.elapsed=1.5;
    });
    await page.screenshot({path:'art/tower-work/work-in-game.png'});
    await page.locator('#pause').click();
    const actions=await page.evaluate(()=>testGame.slots.map(s=>s.action?.elapsed));
    await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>testGame.slots.map(s=>s.action?.elapsed)),actions);
    await page.locator('#resume').click();
    await page.waitForFunction(()=>!testGame.slots[0].action&&!testGame.slots[1].action);
    assert.deepEqual(await page.evaluate(()=>[testGame.slots[0].level,testGame.slots[1].level]),[2,0]);
    assert.deepEqual(errors,[]);
    fs.writeFileSync('art/tower-work/verification.json',JSON.stringify({browser:'Edge',checks:['preview assets loaded','pause keeps identical pixels','demolition reaches empty pad','390 px viewport has no overflow','tutorial pause freezes both jobs','upgrade and demolition finish at correct levels'],errors},null,2)+'\n');
    console.log('Tower work browser checks passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
