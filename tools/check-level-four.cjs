const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  fs.mkdirSync('art/level-4',{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{
      let level;Object.defineProperty(window,'LevelFour',{get:()=>level,set:value=>{
        const Base=value.LevelFourGame;value.LevelFourGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};level=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/index.html#levels');
    await page.evaluate(()=>{localStorage.setItem('td-level-stars','[3,3,3,0,0]');localStorage.setItem('td-encountered-enemies','[1,6,2]');});
    await page.reload();await page.locator('.level-node').nth(3).click();
    assert.equal(await page.locator('#stage-enter-label').textContent(),'開始挑戰');
    assert.equal(await page.locator('.enemy-card').count(),4);
    assert.equal(await page.locator('.enemy-card.is-undiscovered').count(),1);
    await page.screenshot({path:'art/level-4/level-4-select.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'art/level-4/level-4-select-mobile.png'});
    assert.equal(await page.locator('#stage-enter').isVisible(),true);
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#stage-enter').click();await page.waitForURL('**/level-four.html');
    await page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.pad-button').count(),13);
    assert.equal(await page.locator('#wave').textContent(),'0 / 6');
    assert.equal(await page.locator('#coins').textContent(),'150');
    assert.equal(await page.locator('#wave-control').isDisabled(),false);
    await page.screenshot({path:'art/level-4/level-4-desktop.png'});
    const terrain=await page.locator('#battlefield').evaluate(c=>c.toDataURL());
    fs.writeFileSync('art/level-4/level-4-terrain.png',Buffer.from(terrain.split(',')[1],'base64'));
    const fit=await page.evaluate(()=>{
      const g=testGame;
      for(const [x,y] of [[160,432],[720,432]]){
        const p=RoadBuilding.at(g,x,y);if(!g.placeWall(p.x,p.y,p.orientation).ok)throw Error('Fence placement failed');
      }
      // Display the existing rescue formation for a visual width comparison only.
      const route=g.level.routes[0],exit=route.path.at(-1);
      g.shieldSoldiers=[-1,1].map(row=>({exit,routeIndex:0,targets:[],rowOffset:row*g.level.mapConfig.roadWidth/4,x:240,y:432+row*g.level.mapConfig.roadWidth/4,facing:1,startedAt:g.time}));
      g.update=()=>{};
      return {roadWidth:g.level.mapConfig.roadWidth,fences:g.walls.map(w=>({width:w.width,height:w.height,orientation:w.orientation})),soldierRows:g.shieldSoldiers.map(s=>s.y)};
    });
    await page.screenshot({path:'art/level-4/level-4-width-check.png'});
    await page.reload();await page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'art/level-4/level-4-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
    assert.equal(await page.locator('.pad-button').count(),13);
    await page.evaluate(()=>{for(let i=0;i<600;i++)testGame.update(1);});
    assert.equal(await page.evaluate(()=>testGame.phase),'playing');
    assert.equal(await page.evaluate(()=>testGame.wave),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),'[3,3,3,0,0]');
    await page.locator('#wave-control').click();
    await page.waitForFunction(()=>testGame.wave===1&&testGame.enemies.length>0);
    await page.screenshot({path:'art/level-4/level-4-mobile-combat.png'});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{
      testGame.start();testGame.wave=2;testGame.launchWave();
      const encounter=testGame.onEnemySpawn;
      testGame.onEnemySpawn=type=>{encounter(type);const e=testGame.enemies.at(-1);if(type!==4){testGame.damageEnemy(e,999);if(e.hp>0)testGame.damageEnemy(e,999);}};
      for(let i=0;i<2100&&!testGame.enemies.some(e=>e.level===4);i++)testGame.update(1/60);
      for(let i=0;i<60;i++)testGame.update(1/60);
    });
    await page.waitForFunction(()=>document.querySelector('#wave').textContent==='3 / 6');
    assert.equal(await page.evaluate(()=>testGame.enemies.some(e=>e.level===4)),true);
    assert.equal(await page.evaluate(()=>LevelProgress.readEncountered(localStorage).includes(4)),true);
    await page.screenshot({path:'art/level-4/level-4-bomber.png'});
    await page.reload();await page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
    await page.evaluate(()=>{
      const encounter=testGame.onEnemySpawn;
      testGame.onEnemySpawn=type=>{encounter(type);const e=testGame.enemies.at(-1);testGame.damageEnemy(e,999);if(e.hp>0)testGame.damageEnemy(e,999);};
    });
    await page.locator('#wave-control').click();
    await page.evaluate(()=>{for(let i=0;i<40000&&testGame.phase==='playing';i++)testGame.update(1/60);});
    await page.waitForFunction(()=>document.querySelector('#result').open);
    assert.equal(await page.locator('#result-waves').textContent(),'6');
    assert.equal(await page.locator('#result-kills').textContent(),'118');
    assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),'[3,3,3,3,0]');
    assert.equal(await page.evaluate(()=>LevelProgress.bombTowersUnlocked(LevelProgress.read(localStorage))),true);
    assert.equal(await page.locator('#result-bomb-title').textContent(),'通關獎勵 · 解鎖炸彈塔');
    assert.equal(await page.locator('#result-bomb-reward').isVisible(),true);
    await page.screenshot({path:'art/level-4/level-4-victory.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'art/level-4/level-4-victory-mobile.png'});
    await page.locator('#restart').click();
    await page.waitForFunction(()=>testGame.wave===0&&testGame.canStartWave&&!document.querySelector('#result').open);
    assert.equal(await page.evaluate(()=>testGame.money),150);
    await page.reload();await page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
    assert.equal(await page.evaluate(()=>LevelProgress.bombTowersUnlocked(LevelProgress.read(localStorage))),true);
    assert.equal(await page.evaluate(()=>TowerMenu.state(testGame,0).build.label),'建造箭塔');
    assert.equal(await page.evaluate(()=>testGame.roadBuilding.type),'fence');
    assert.deepEqual(errors,[]);
    fs.writeFileSync('art/level-4/verification.json',JSON.stringify({errors,fit,pads:13,waves:6,totalEnemies:118,initialMoney:150,buildings:['arrow','fence'],reward:'bomb-tower',combat:true,desktop:[1440,900],mobile:[390,844]},null,2));
    console.log('Level 4 combat, encounters, victory/restart, desktop/mobile and road widths: passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
