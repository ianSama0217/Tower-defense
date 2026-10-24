const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  fs.mkdirSync('art/level-5',{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(`${page.url()}: ${e.stack||e.message}`));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{
      let level;Object.defineProperty(window,'LevelFive',{get:()=>level,set:value=>{
        const Base=value.LevelFiveGame;value.LevelFiveGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};level=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/index.html#levels');
    await page.evaluate(()=>{localStorage.setItem('td-level-stars','[3,3,3,3,0]');localStorage.setItem('td-encountered-enemies','[1,6,4]');});
    await page.reload();await page.locator('.level-node').nth(4).click();
    assert.equal(await page.locator('#stage-enter-label').textContent(),'開始挑戰');
    assert.equal(await page.locator('.enemy-card').count(),4);
    assert.equal(await page.locator('.enemy-card.is-undiscovered').count(),1);
    await page.screenshot({path:'art/level-5/level-5-select.png'});
    await page.locator('#stage-enter').click();await page.waitForURL('**/level-five.html');
    const ready=()=>page.waitForFunction(()=>window.testGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
    await ready();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.pad-button').count(),10);
    assert.equal(await page.locator('#wave').textContent(),'0 / 6');
    assert.equal(await page.locator('#wave-control').isDisabled(),false);
    await page.screenshot({path:'art/level-5/level-5-desktop.png'});
    const terrain=await page.locator('#battlefield').evaluate(c=>c.toDataURL());
    fs.writeFileSync('art/level-5/level-5-terrain.png',Buffer.from(terrain.split(',')[1],'base64'));
    const fit=await page.evaluate(()=>{
      const g=testGame;
      for(const [x,y] of [[144,400],[448,400]]){
        const p=RoadBuilding.at(g,x,y);if(!g.placeWall(p.x,p.y,p.orientation).ok)throw Error('Fence placement failed');
      }
      const route=g.level.routes[0],exit=route.path.at(-1);
      g.shieldSoldiers=[-1,1].map(row=>({exit,routeIndex:0,targets:[],rowOffset:row*g.level.mapConfig.roadWidth/4,x:64,y:400+row*g.level.mapConfig.roadWidth/4,facing:1,startedAt:g.time}));
      g.update=()=>{};
      return {roadWidth:g.level.mapConfig.roadWidth,fences:g.walls.map(w=>({width:w.width,height:w.height,orientation:w.orientation})),soldierRows:g.shieldSoldiers.map(s=>s.y)};
    });
    await page.screenshot({path:'art/level-5/level-5-width-check.png'});
    await page.reload();await ready();
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:'art/level-5/level-5-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
    await page.locator('.pad-button').nth(0).click();
    await page.screenshot({path:'art/level-5/level-5-mobile-drawer.png'});
    assert.equal(await page.locator('#build').isVisible(),true);
    assert.equal(await page.locator('#build-bomb').isVisible(),true);
    assert.equal(await page.locator('#build-bomb-price .amount').textContent(),'80');
    await page.evaluate(()=>{for(let i=0;i<600;i++)testGame.update(1);});
    assert.equal(await page.evaluate(()=>testGame.phase),'playing');
    assert.equal(await page.evaluate(()=>testGame.wave),0);
    assert.equal(await page.evaluate(()=>testGame.enemies.length),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),'[3,3,3,3,0]');
    await page.locator('#build-bomb').click();
    await page.evaluate(()=>testGame.updateTowerActions(5));
    await page.waitForFunction(()=>document.querySelector('#stat-damage b').textContent==='25');
    assert.equal(await page.evaluate(()=>testGame.money),70);
    assert.equal(await page.evaluate(()=>testGame.slots[0].kind),'bomb');
    assert.equal(await page.locator('#stat-range b').textContent(),'45–125');
    assert.equal(await page.locator('#stat-target img[src$="target-air.png"]').count(),1);
    assert.equal(await page.locator('#stat-target img[src$="target-air.png"]').isVisible(),false);
    assert.equal(await page.locator('#upgrade').isVisible(),true);
    assert.equal(await page.locator('#repair').isVisible(),true);
    assert.equal(await page.locator('#demolish').isVisible(),true);
    assert.equal(await page.locator('#build-bomb').isVisible(),false);
    await page.screenshot({path:'art/level-5/level-5-mobile-bomb.png'});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{
      const g=testGame,s=g.slots[0];g.update=()=>{};
      g.enemies.push({id:999,level:1,hp:50,maxHp:50,x:s.x+140,y:s.y,distance:0,routeIndex:0,remaining:100,moving:false});
      g.time+=.01;g.fireTowers(.01);g.time+=.3;g.fireTowers(.3);g.time+=.25;
    });
    assert.equal(await page.evaluate(()=>testGame.bombs.length),1);
    await page.screenshot({path:'art/level-5/level-5-bomb-flight.png'});
    await page.evaluate(()=>{testGame.time+=1;testGame.fireTowers(1);});
    assert.equal(await page.evaluate(()=>testGame.enemies[0].hp),25);
    await page.screenshot({path:'art/level-5/level-5-bomb-explosion.png'});
    await page.reload();await ready();
    await page.locator('#wave-control').click();
    await page.waitForFunction(()=>testGame.wave===1&&testGame.enemies.length>0);
    assert.equal(await page.evaluate(()=>testGame.canBuildRoadBuildings),false);
    await page.screenshot({path:'art/level-5/level-5-combat.png'});
    await page.evaluate(()=>{
      const g=testGame;g.start();g.wave=5;g.launchWave();const encounter=g.onEnemySpawn;let captainSeen=false;
      g.onEnemySpawn=type=>{encounter(type);if(type===7)captainSeen=true;if(!captainSeen)g.damageEnemy(g.enemies.at(-1),999);};
      for(let i=0;i<3000&&!captainSeen;i++)g.update(1/60);
      for(let i=0;i<306;i++)g.update(1/60);
      g.update=()=>{};
    });
    assert.equal(await page.evaluate(()=>LevelProgress.readEncountered(localStorage).includes(7)),true);
    assert.equal(await page.evaluate(()=>{const c=testGame.enemies.find(e=>e.level===7);return !!c&&GoblinCaptain.cycle(testGame.time,c.spawnedAt).casting;}),true);
    const warcry=await page.evaluate(()=>{
      const g=testGame,c=g.enemies.find(e=>e.level===7),affected=g.enemies.filter(e=>g.enemyHaste(e)>1);
      return {hp:c.hp,maxHp:c.maxHp,affected:affected.length,multipliers:affected.map(e=>g.enemyHaste(e))};
    });
    assert.equal(warcry.maxHp,500);assert.ok(warcry.affected>0);assert.ok(warcry.multipliers.every(v=>v===1.2));
    await page.screenshot({path:'art/level-5/level-5-captain.png'});
    await page.reload();await ready();
    await page.evaluate(()=>{
      const g=testGame,encounter=g.onEnemySpawn;g.onEnemySpawn=type=>{encounter(type);g.damageEnemy(g.enemies.at(-1),999);};
      g.startNextWave();for(let i=0;i<40000&&g.phase==='playing';i++)g.update(1/60);
    });
    await page.waitForFunction(()=>document.querySelector('#result').open);
    assert.equal(await page.locator('#result-waves').textContent(),'6');
    assert.equal(await page.locator('#result-kills').textContent(),'129');
    assert.equal(await page.evaluate(()=>testGame.spawnQueue.length+testGame.pendingSpawns.length),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),'[3,3,3,3,3]');
    await page.screenshot({path:'art/level-5/level-5-victory.png'});
    await page.locator('#restart').click();
    await page.waitForFunction(()=>testGame.wave===0&&!document.querySelector('#result').open);
    assert.equal(await page.evaluate(()=>testGame.money),150);
    assert.equal(await page.evaluate(()=>testGame.bombs.length),0);
    await page.evaluate(()=>{
      const g=testGame;g.onEnemySpawn=null;g.wave=5;g.launchWave();g.spawnQueue=[{level:7,routeIndex:0}];g.update(.01);
      const boss=g.enemies.find(e=>e.level===7),route=g.level.routes[0];boss.distance=route.length-1;
      Object.assign(boss,TD.position(boss.distance,route));g.lineGraceUntil=Infinity;g.update(.1);
    });
    await page.waitForFunction(()=>document.querySelector('#result').open);
    assert.equal(await page.evaluate(()=>testGame.phase),'lost');
    assert.equal(await page.evaluate(()=>testGame.lives),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('td-level-stars')),'[3,3,3,3,3]');
    await page.screenshot({path:'art/level-5/level-5-boss-escape.png'});
    // Shared controller still renders earlier levels without bomb UI or missing assets.
    for(const url of ['tutorial.html','level-four.html']){
      await page.goto(`http://127.0.0.1:4173/${url}`);
      await page.waitForFunction(()=>document.querySelector('.pad-button')&&!document.querySelector('.pad-button').disabled);
      assert.equal(await page.locator('#build-bomb').count(),0);
      await page.locator('.pad-button').first().click();assert.equal(await page.locator('#build').isVisible(),true);
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync('art/level-5/verification.json',JSON.stringify({errors,fit,pads:10,waves:6,totalEnemies:147,spawnInterval:1.35,fastWaveInterval:.8,fastWaves:[3,6],initialMoney:150,buildings:['arrow','fence','bomb'],captain:{hp:500,warcry,firstDelay:5,interval:15,duration:5,haste:1.2,damageBonus:0,death:'immediate victory',escape:'immediate defeat'},combat:true,desktop:[1440,900],mobile:[390,844]},null,2));
    console.log('Level 5 combat, bomb towers, captain, victory/restart and desktop/mobile: passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
