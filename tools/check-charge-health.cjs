const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    fs.mkdirSync('art/charge-health',{recursive:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      let api;
      Object.defineProperty(window,'TD',{get:()=>api,set:value=>{
        const Base=value.Game;
        value.Game=class extends Base{constructor(...args){super(...args);window.chargeTestGame=this;}};
        api=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/level-three.html');
    await page.waitForFunction(()=>window.chargeTestGame?.phase==='playing');
    await page.evaluate(()=>{
      const g=chargeTestGame;g.start();g.spawnQueue=[2];g.update(.1);
      const e=g.enemies[0];e.distance=600;Object.assign(e,TD.position(e.distance,g.level.routes[0]));
      e.remaining=g.level.routes[0].length-e.distance;g.phase='ready';
    });
    const campaignPixel=()=>page.evaluate(()=>{
      const e=chargeTestGame.enemies[0],ctx=document.getElementById('battlefield').getContext('2d');
      return [...ctx.getImageData(Math.round(e.x),Math.round(e.y-52),1,1).data];
    });
    await page.waitForFunction(()=>{
      const e=chargeTestGame.enemies[0],p=document.getElementById('battlefield').getContext('2d').getImageData(Math.round(e.x),Math.round(e.y-52),1,1).data;
      return p[0]===174&&p[1]===180&&p[2]===189;
    });
    assert.deepEqual(await campaignPixel(),[174,180,189,255]);
    await page.screenshot({path:'art/charge-health/campaign-gray-full.png'});
    await page.evaluate(()=>chargeTestGame.damageEnemy(chargeTestGame.enemies[0],20));
    await page.waitForFunction(()=>{
      const e=chargeTestGame.enemies[0],p=document.getElementById('battlefield').getContext('2d').getImageData(Math.round(e.x-10),Math.round(e.y-52),1,1).data;
      const q=document.getElementById('battlefield').getContext('2d').getImageData(Math.round(e.x+10),Math.round(e.y-52),1,1).data;
      return p[0]===174&&q[0]===24;
    });
    await page.screenshot({path:'art/charge-health/campaign-gray-half.png'});
    const rain=await page.evaluate(()=>{
      const g=chargeTestGame,e=g.enemies[0],money=g.money;g.fireArrowRain();
      return {hp:e.hp,shield:e.chargeHp,charging:e.charging,money:g.money-money,kills:g.kills};
    });
    assert.deepEqual(rain,{hp:80,shield:0,charging:false,money:0,kills:0});
    await page.evaluate(()=>chargeTestGame.damageEnemy(chargeTestGame.enemies[0],20));
    await page.waitForFunction(()=>{
      const e=chargeTestGame.enemies[0],p=document.getElementById('battlefield').getContext('2d').getImageData(Math.round(e.x-10),Math.round(e.y-52),1,1).data;
      return p[0]===186&&p[1]===220&&p[2]===125;
    });
    await page.screenshot({path:'art/charge-health/campaign-base-green.png'});
    await page.evaluate(()=>{
      const g=chargeTestGame;g.phase='playing';g.money=1000;
      for(let level=1;level<=3;level++){g.build(4);g.updateTowerActions(5);}
      if(g.slots[4].hp!==150||g.slots[4].maxHp!==150)throw Error('Tower health did not scale');
      g.damageTower(g.slots[4],75);g.phase='ready';
    });
    await page.waitForFunction(()=>{
      const g=chargeTestGame,s=g.slots[4],rect=TowerSprites.worldRect(3,s.x,s.y,g.level.mapConfig.towerSlotSize,g.worldScale),ctx=document.getElementById('battlefield').getContext('2d');
      const left=ctx.getImageData(s.x-16,Math.round(rect.y-9),1,1).data,right=ctx.getImageData(s.x+16,Math.round(rect.y-9),1,1).data;
      return left[0]===176&&left[1]===216&&right[0]===21;
    });
    await page.screenshot({path:'art/charge-health/campaign-tower-health.png'});
    await page.goto('http://127.0.0.1:4173/test');
    await page.getByRole('button',{name:'選擇Lv2 獸人',exact:true}).waitFor();
    const canvas=page.locator('#test-stage'),box=await canvas.boundingBox();
    await page.locator('[data-category="tower"]').click();
    await page.getByRole('button',{name:'選擇Lv2 石造箭塔',exact:true}).click();
    await canvas.click({position:{x:box.width*.2,y:box.height*.2}});
    await page.locator('[data-category="bomb-tower"]').click();
    await page.getByRole('button',{name:'選擇Lv3 炸彈塔',exact:true}).click();
    await canvas.click({position:{x:box.width*.8,y:box.height*.2}});
    await page.locator('[data-category="enemy"]').click();
    const orc=page.getByRole('button',{name:/選擇.*獸人/});await orc.click();
    await canvas.click({position:{x:box.width*.5,y:box.height*.5}});
    await page.locator('#simulate').click();await page.locator('#play-animation').click();
    assert.deepEqual(await page.evaluate(()=>chargeTestGame.slots.map(s=>({kind:s.kind,hp:s.hp,maxHp:s.maxHp}))),[{kind:'arrow',hp:125,maxHp:125},{kind:'bomb',hp:200,maxHp:200}]);
    assert.deepEqual(await page.evaluate(()=>{
      const e=chargeTestGame.enemies[0];return {hp:e.hp,gray:e.chargeHp,bar:EnemySprites.healthBar(e).hp};
    }),{hp:80,gray:40,bar:40});
    await page.screenshot({path:'art/charge-health/lab-gray-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'art/charge-health/lab-gray-mobile.png'});
    await page.evaluate(()=>chargeTestGame.damageEnemy(chargeTestGame.enemies[0],200));
    assert.deepEqual(await page.evaluate(()=>{
      const e=chargeTestGame.enemies[0];return {hp:e.hp,gray:e.chargeHp,bar:EnemySprites.healthBar(e).hp};
    }),{hp:80,gray:0,bar:80});
    await page.screenshot({path:'art/charge-health/lab-base-mobile.png'});
    assert.deepEqual(errors,[]);
    console.log('Campaign and laboratory gray/base bars, desktop/mobile and 200 damage arrow rain verified.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
