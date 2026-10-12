const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 fs.mkdirSync('art/road-construction',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let api;Object.defineProperty(window,'TD',{get:()=>api,set:value=>{
    const Base=value.Game;value.Game=class extends Base{constructor(...args){super(...args);window.roadGame=this;}};api=value;
   }});localStorage.setItem('td-level-stars','[3,3,3,0,0]');
  });
  await page.goto('http://127.0.0.1:4173/level-three.html');
  await page.waitForFunction(()=>window.roadGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{window.roadStep=roadGame.update.bind(roadGame);roadGame.update=()=>{};roadGame.money=1000;});
  const box=await page.locator('#battlefield').boundingBox();
  await page.mouse.click(box.x+1008/1280*box.width,box.y+400/768*box.height);
  await page.waitForFunction(()=>document.getElementById('tower-drawer').classList.contains('is-road'));
  assert.equal(await page.locator('#build').isDisabled(),false);
  await page.locator('#wave-control').click();
  await page.waitForFunction(()=>document.getElementById('build').disabled);
  assert.match(await page.locator('#build').getAttribute('aria-label'),/戰鬥中/);
  assert.equal(await page.locator('.road-build-reason:not(.sr-only)').isVisible(),true);
  assert.equal(await page.locator('#road-stat-time').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>{
   const before=[roadGame.money,roadGame.wallsUsed,roadGame.walls.length],r=roadGame.placeWall(1008,400,'vertical');
   return {blocked:!r.ok,unchanged:JSON.stringify(before)===JSON.stringify([roadGame.money,roadGame.wallsUsed,roadGame.walls.length])};
  }),{blocked:true,unchanged:true});
  await page.evaluate(()=>Promise.all(document.getElementById('tower-drawer').getAnimations().map(a=>a.finished)));
  await page.screenshot({path:'art/road-construction/desktop-combat.png'});
  await page.locator('#pause').click();assert.equal(await page.evaluate(()=>roadGame.canBuildRoadBuildings),false);
  await page.locator('#resume').click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'art/road-construction/mobile-combat.png'});
  await page.evaluate(()=>{
   roadGame.onEnemySpawn=()=>{const e=roadGame.enemies.at(-1);roadGame.damageEnemy(e,999);if(e.hp>0)roadGame.damageEnemy(e,999);};
   for(let i=0;i<5000&&!roadGame.awaitingWave;i++)roadStep(1/60);
  });
  await page.waitForFunction(()=>!document.getElementById('build').disabled);
  assert.equal(await page.locator('.road-build-reason:not(.sr-only)').count(),0);
  await page.screenshot({path:'art/road-construction/mobile-preparation.png'});
  await page.locator('#build').click();assert.equal(await page.evaluate(()=>roadGame.walls.length),1);
  await page.evaluate(()=>roadStep(15));assert.equal(await page.evaluate(()=>roadGame.canBuildRoadBuildings),false);
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.pad-button').nth(0).click();assert.equal(await page.locator('#build').isDisabled(),false);
  await page.locator('#build').click();assert.equal(await page.evaluate(()=>roadGame.slots[0].level),1);
  assert.deepEqual(errors,[]);
  fs.writeFileSync('art/road-construction/verification.json',JSON.stringify({checks:['wave launch immediately disables road button','visible combat reason on desktop and mobile','direct placement cannot spend money or stock during combat','pause cannot unlock road construction','intermission restores road construction','road button builds during preparation','next wave disables road construction','tower button still builds during combat','no mobile overflow or browser errors'],errors},null,2)+'\n');
  console.log('Road construction browser checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
