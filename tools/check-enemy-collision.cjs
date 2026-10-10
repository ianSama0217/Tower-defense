const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    fs.mkdirSync('art/enemy-collision',{recursive:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      let level;Object.defineProperty(window,'LevelTwo',{get:()=>level,set:value=>{
        const Base=value.LevelTwoGame;value.LevelTwoGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};level=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/level-two.html');
    await page.waitForFunction(()=>window.testGame?.phase==='playing');
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>{
      const g=testGame;g.start();g.countdown=Infinity;g.lives=100;
      for(let i=0;i<12;i++){
        const level=i%3===0?6:1,routeIndex=i%2,distance=400-Math.floor(i/2)*65;
        g.enemies.push({id:g.nextId++,level,routeIndex,distance,hp:TD.ENEMIES[level].hp,maxHp:TD.ENEMIES[level].hp,...TD.position(distance,g.level.routes[routeIndex])});
      }
      let minimumGap=Infinity;
      window.advanceCollisionScene=frames=>{
        g.phase='playing';
        for(let frame=0;frame<frames;frame++){
          g.update(1/60);
          for(let i=0;i<g.enemies.length;i++)for(let j=i+1;j<g.enemies.length;j++){
            const a=g.enemies[i],b=g.enemies[j];
            const gap=Math.hypot(a.x-b.x,a.y-b.y)-TD.enemyRadius(a.level,g.worldScale)-TD.enemyRadius(b.level,g.worldScale);
            minimumGap=Math.min(minimumGap,gap);if(gap<-1e-6)throw new Error(`Overlapping enemies: ${a.id}/${b.id}`);
          }
        }
        g.phase='paused';return {minimumGap,alive:g.enemies.length,lives:g.lives};
      };
      return advanceCollisionScene(120);
    });
    await page.screenshot({path:'art/enemy-collision/merge-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'art/enemy-collision/merge-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const completion=await page.evaluate(()=>advanceCollisionScene(2400));
    assert.equal(completion.alive,0);assert.equal(completion.lives,88);assert.deepEqual(errors,[]);
    // Reproduce the crowded fence attack in the actual asset test scene.
    await page.setViewportSize({width:1440,height:1000});
    await page.addInitScript(()=>{
      let api;Object.defineProperty(window,'BombTowers',{get:()=>api,set:value=>{
        const Base=value.BombTowerGame;value.BombTowerGame=class extends Base{constructor(...args){super(...args);window.testGame=this;}};api=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/test');
    await page.waitForFunction(()=>!document.querySelector('#fence-demo').disabled);
    const clickGround=async(x,y)=>{
      const b=await page.locator('#test-stage').boundingBox();
      await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/768);
    };
    await page.locator('[data-category="fence"]').click();
    await page.getByRole('button',{name:'選擇柵欄 · 直向',exact:true}).click();await clickGround(640,384);
    await page.locator('[data-category="enemy"]').click();
    await page.getByRole('button',{name:'選擇Lv1 哥布林',exact:true}).click();
    for(let row=0;row<4;row++)for(let col=0;col<5;col++)await clickGround(320+col*48,312+row*48);
    await page.locator('#simulate').click();await page.locator('#play-animation').click();
    const crowd=await page.evaluate(()=>{
      const g=testGame,w=g.walls[0];w.hp=w.maxHp=100000;
      for(let frame=0;frame<720;frame++)g.update(1/60);
      let minimumGap=Infinity;
      for(let i=0;i<g.enemies.length;i++)for(let j=i+1;j<g.enemies.length;j++){
        const a=g.enemies[i],b=g.enemies[j];
        minimumGap=Math.min(minimumGap,Math.hypot(a.x-b.x,a.y-b.y)-TD.enemyRadius(a.level,g.worldScale)-TD.enemyRadius(b.level,g.worldScale));
      }
      return {total:g.enemies.length,attacking:g.enemies.filter(e=>e.attackAt!=null&&g.time-e.attackAt<1.22).length,minimumGap};
    });
    assert.equal(crowd.total,20);assert.ok(crowd.attacking>=16);assert.ok(crowd.minimumGap>=-1e-6);
    await page.locator('#test-stage').screenshot({path:'art/enemy-collision/fence-crowd.png'});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({snapshot:result,completion,crowd,errors},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
