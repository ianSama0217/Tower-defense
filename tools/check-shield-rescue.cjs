const {chromium}=require('playwright'),assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    await page.addInitScript(()=>{let api;Object.defineProperty(window,'Tutorial',{get:()=>api,set:value=>{const Base=value.TutorialGame;value.TutorialGame=class extends Base{constructor(...args){super(...args);window.shieldRescueGame=this;}};api=value;}});});
    await page.goto('http://127.0.0.1:4173/tutorial.html');
    await page.locator('#wave-control').waitFor();
    await page.waitForFunction(()=>window.shieldRescueGame&&document.querySelector('#wave-control').disabled===false);
    await page.evaluate(()=>{
      const g=window.shieldRescueGame;g.startNextWave();g.spawnQueue=[];
      const route=g.level.routes[0];
      const enemies=[route.length-.1,route.length-60,route.length-120].map(distance=>({id:g.nextId++,level:1,hp:44,maxHp:44,distance,remaining:route.length-distance,routeIndex:0,...TD.position(distance,route)}));
      g.enemies.push(...enemies);window.shieldRescueEnemies=enemies;g.update(1/60);
    });
    await page.waitForFunction(()=>window.shieldRescueEnemies[1].shieldPushRemaining<2.2);
    const state=await page.evaluate(()=>({lives:shieldRescueGame.lives,soldiers:shieldRescueGame.shieldSoldiers.map(s=>({x:s.x,y:s.y,targets:s.targets.length})),escaped:shieldRescueEnemies[0].escaped,firstPresent:shieldRescueGame.enemies.includes(shieldRescueEnemies[0]),remaining:shieldRescueGame.enemies.length}));
    assert.equal(state.lives,2);assert.equal(state.soldiers.length,2);assert.equal(state.escaped,true);assert.equal(state.firstPresent,false);assert.equal(state.remaining,2);
    assert.ok(state.soldiers.every(s=>s.targets===2));assert.equal(state.soldiers[0].x,state.soldiers[1].x);assert.ok(state.soldiers[0].y<state.soldiers[1].y);
    await page.locator('#battlefield').screenshot({path:path.join(os.tmpdir(),'td-shield-rescue-preview.png')});
    await page.waitForFunction(()=>shieldRescueGame.shieldSoldiers.length===0);
    assert.ok(await page.evaluate(()=>shieldRescueEnemies.slice(1).every(enemy=>enemy.distance<1280-1280/3+100)));
    assert.deepEqual(errors,[]);
    console.log('Shield rescue campaign check passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
