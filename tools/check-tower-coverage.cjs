const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 fs.mkdirSync('art/tower-coverage',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{
   let api;Object.defineProperty(window,'TD',{get:()=>api,set:value=>{
    const Base=value.Game;value.Game=class extends Base{constructor(...args){super(...args);window.coverageGame=this;}};api=value;
   }});
   localStorage.setItem('td-level-stars','[3,3,3,0,0]');
  });
  for(const [name,file,count] of [['second','level-two.html',9],['third','level-three.html',10]]){
   await page.setViewportSize({width:1440,height:900});
   await page.goto(`http://127.0.0.1:4173/${file}`);
   await page.waitForFunction(()=>window.coverageGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.pad-button').count(),count);
   await page.screenshot({path:`art/tower-coverage/${name}-pads-desktop.png`});
   await page.evaluate(()=>{
    const g=coverageGame;g.money=10000;
    for(let tier=1;tier<=3;tier++){for(const slot of g.slots)g.build(slot.id);g.update(5.1);}
    const ctx=document.getElementById('battlefield').getContext('2d'),original=ctx.arc;
    ctx.arc=function(x,y,r,...rest){if(r===TD.TOWERS[3].range*g.worldScale)window.coverageCircle={x,y,r};return original.call(this,x,y,r,...rest);};
   });
   await page.locator('.pad-button').nth(3).click();
   await page.waitForFunction(()=>document.querySelector('#stat-damage b').textContent===String(TD.TOWERS[3].damage));
   assert.equal(await page.locator('#stat-range b').textContent(),'125');
   assert.equal(await page.locator('#stat-rate b').textContent(),'0.65');
   await page.waitForFunction(()=>window.coverageCircle?.x===coverageGame.slots[3].x);
   assert.equal(await page.evaluate(()=>coverageCircle.r),250);
   await page.locator('#tower-drawer').evaluate(async el=>Promise.all(el.getAnimations().map(a=>a.finished)));
   await page.screenshot({path:`art/tower-coverage/${name}-towers-desktop.png`});
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#tower-drawer').evaluate(async el=>Promise.all(el.getAnimations().map(a=>a.finished)));
   await page.screenshot({path:`art/tower-coverage/${name}-towers-mobile.png`});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('art/tower-coverage/verification.json',JSON.stringify({checks:['second and third pad counts','all pads build and upgrade to tier three','damage/range/interval match engine','actual canvas range circle','desktop and 390px layout'],errors},null,2)+'\n');
  console.log('Tower coverage browser checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
