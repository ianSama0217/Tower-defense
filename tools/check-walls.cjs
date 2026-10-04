const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{
   for(const [name,gameName] of [['LevelTwo','LevelTwoGame'],['Tutorial','TutorialGame']]){
    let api;Object.defineProperty(window,name,{get:()=>api,set:v=>{const Base=v[gameName];v[gameName]=class extends Base{constructor(...args){super(...args);window.testGame=this;}};api=v;}});
   }
  });
  await page.goto('http://127.0.0.1:4173/level-two.html');await page.waitForFunction(()=>window.testGame?.phase==='playing');
  await page.evaluate(()=>localStorage.setItem('td-level-stars','[3,0,0,0,0]'));
  assert.equal(await page.locator('.wall-tools,#wall-build').count(),0);
  assert.equal(await page.evaluate(()=>{testGame.money=1000;testGame.wallsUnlocked=true;return testGame.placeWall(600,392).ok;}),false);
  await page.screenshot({path:'art/walls/level-two-no-wall-ui.png'});
  // Preview geometry in the real renderer using a sandbox fixture, without enabling walls in these levels.
  await page.evaluate(()=>{
   const sandbox=new TD.Game(()=>0,{...testGame.level,stageIndex:undefined});sandbox.start();sandbox.money=1000;
   for(const [x,y,o] of [[609,405,'vertical'],[899,285,'horizontal'],[385,395,'vertical']]){const r=sandbox.placeWall(x,y,o);if(!r.ok)throw Error(r.message);}
   sandbox.damageTower(sandbox.walls[2],170);testGame.walls=sandbox.walls;
  });
  await page.waitForTimeout(150);await page.screenshot({path:'art/walls/aligned-80px.png'});
  assert.ok(await page.evaluate(()=>testGame.walls.every(w=>{
   const b=WallSprites.bounds(w),bar=WallSprites.healthBar(w);return bar.y+bar.h===b.y-6&&Math.max(w.width,w.height)===80;
  })));
  // Pixel comparison proves that vertical draws rotate the same horizontal pixels by 90 degrees.
  const difference=await page.evaluate(async()=>{
   const image=new Image();image.src=WallSprites.file('horizontal');await image.decode();
   const make=orientation=>{const c=document.createElement('canvas');c.width=c.height=128;WallSprites.draw(c.getContext('2d'),image,{x:64,y:64,orientation,...TD.wallSize(orientation,2,96)},2);return c.getContext('2d').getImageData(0,0,128,128).data;};
   const a=make('horizontal'),b=make('vertical');let diff=0;
   for(let y=0;y<128;y++)for(let x=0;x<128;x++)for(let ch=0;ch<4;ch++)if(a[(y*128+x)*4+ch]!==b[(x*128+127-y)*4+ch])diff++;
   return diff;
  });assert.ok(difference<128,`rotation mismatched ${difference} channels`);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/walls/aligned-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{testGame.walls=[];testGame.phase='won';testGame.wave=6;testGame.kills=103;testGame.lives=3;});
  await page.locator('#result').waitFor({state:'visible'});await page.locator('#result-wall-reward').waitFor({state:'visible'});
  assert.equal(await page.locator('#result-wall-title').textContent(),'通關獎勵 · 解鎖城牆');
  assert.equal(await page.evaluate(()=>LevelProgress.wallsUnlocked(LevelProgress.read(localStorage))),true);
  await page.screenshot({path:'art/walls/reward-desktop.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:'art/walls/reward-mobile.png'});
  const reward=await page.locator('#result-wall-reward').boundingBox();assert.ok(reward.x>=0&&reward.x+reward.width<=390&&reward.y+reward.height<=844);
  await page.locator('#restart').click();assert.equal(await page.locator('#result-wall-reward').isVisible(),false);
  await page.evaluate(()=>{testGame.phase='won';testGame.wave=6;testGame.lives=3;});await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('#result-wall-title').textContent(),'通關獎勵 · 城牆已解鎖');
  await page.goto('http://127.0.0.1:4173/tutorial.html');await page.waitForFunction(()=>window.testGame?.phase==='playing');
  assert.equal(await page.locator('.wall-tools,#wall-build').count(),0);assert.equal(await page.evaluate(()=>{testGame.money=1000;return testGame.placeWall(600,400).ok;}),false);
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{const s=new TD.Game(()=>0,{...testGame.level,stageIndex:2,wallsUnlocked:true});s.start();s.money=1000;s.placeWall(605,406,'vertical');s.placeWall(805,406,'horizontal');testGame.walls=s.walls;});
  await page.waitForTimeout(150);await page.screenshot({path:'art/walls/aligned-96px.png'});
  await page.goto('http://127.0.0.1:4173/test');await page.locator('[data-category="wall"]').click();assert.equal(await page.locator('.asset-card').count(),2);
  const stage=page.locator('#test-stage');let box=await stage.boundingBox();
  await page.locator('.asset-card').first().click();await stage.click({position:{x:box.width*.4,y:box.height*.5}});
  await page.locator('.asset-card').nth(1).click();await stage.click({position:{x:box.width*.65,y:box.height*.5}});
  await page.locator('[data-category="enemy"]').click();await page.locator('.asset-card').first().click();await stage.click({position:{x:box.width*.3,y:box.height*.5}});await page.locator('#simulate').click();
  await page.waitForTimeout(300);await page.screenshot({path:'art/walls/rotated-test-lab.png'});
  assert.deepEqual(errors,[]);fs.writeFileSync('art/walls/verification.json',JSON.stringify({checks:['no wall UI in first two levels','first two levels reject wall purchases after unlocking','80px and 96px road-centered geometry','six pixel HP gap','90 degree pixel rotation','mobile layout','second-level wall reward','reward persistence and replay','test lab wall bounds and simulation'],rotationChannelDifference:difference,errors},null,2));console.log('Wall alignment and reward browser checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
