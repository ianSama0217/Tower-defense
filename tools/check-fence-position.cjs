const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 fs.mkdirSync('art/fence-position',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let api;Object.defineProperty(window,'TD',{get:()=>api,set:value=>{
    const Base=value.Game;value.Game=class extends Base{constructor(...args){super(...args);window.positionGame=this;}};api=value;
   }});localStorage.setItem('td-level-stars','[3,3,3,0,0]');
  });
  await page.goto('http://127.0.0.1:4173/level-three.html');
  await page.waitForFunction(()=>window.positionGame?.phase==='playing'&&!document.querySelector('.pad-button').disabled);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{
   positionGame.update=()=>{};positionGame.money=1000;positionGame.wallsUnlocked=true;
   const ctx=document.getElementById('battlefield').getContext('2d'),clear=ctx.clearRect,draw=ctx.drawImage;
   ctx.clearRect=function(...args){window.positionDraws=[];return clear.apply(this,args);};
   ctx.drawImage=function(image,...args){if(image?.src?.endsWith('/fence-100.png')){
    const t=this.getTransform();positionDraws.push({x:t.e,y:t.f,alpha:this.globalAlpha});
   }return draw.call(this,image,...args);};
  });
  for(const [x,y,orientation] of [[1008,400,'vertical'],[832,336,'horizontal']]){
   const expected=await page.evaluate(({x,y})=>{
    const p=RoadBuilding.at(positionGame,x,y),visual=FenceSprites.atCellRight({...p,hp:150,maxHp:150},p.frame);
    return {geometry:{x:p.x,y:p.y,width:p.width,height:p.height,orientation:p.orientation},visualX:visual.visualX,visualY:visual.y,bounds:FenceSprites.bounds(visual)};
   },{x,y});
   assert.equal(expected.geometry.orientation,orientation);
   const box=await page.locator('#battlefield').boundingBox();await page.mouse.click(box.x+x/1280*box.width,box.y+y/768*box.height);
   await page.locator('#build').hover();
   await page.waitForFunction(e=>positionDraws.some(d=>d.x===e.visualX&&d.y===e.visualY&&d.alpha===.5),expected);
   await page.screenshot({path:`art/fence-position/${orientation}-preview.png`});
   await page.locator('#build').click();
   await page.waitForFunction(e=>positionDraws.some(d=>d.x===e.visualX&&d.y===e.visualY&&d.alpha===1),expected);
   const actual=await page.evaluate(()=>{
    const w=positionGame.walls.at(-1);return {x:w.x,y:w.y,width:w.width,height:w.height,orientation:w.orientation,hasVisualX:Object.hasOwn(w,'visualX')};
   });
   assert.equal(actual.hasVisualX,false);delete actual.hasVisualX;assert.deepEqual(actual,expected.geometry);
   assert.deepEqual(await page.evaluate(({x,y})=>{
    const w=positionGame.walls.at(-1);return TD.targetPoint(w,{x:x+200,y});
   },actual),{x:actual.x+actual.width/2,y:actual.y});
   assert.deepEqual(await page.evaluate(e=>{
    const b=e.bounds,ctx=document.getElementById('battlefield').getContext('2d');
    return [...ctx.getImageData(Math.round(b.x+b.w/2),Math.round(b.y-8),1,1).data];
   },expected),[176,216,121,255]);
   await page.screenshot({path:`art/fence-position/${orientation}-built.png`});
  }
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'art/fence-position/mobile.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('art/fence-position/verification.json',JSON.stringify({checks:['vertical and horizontal ghost at right-side visual anchor','built art matches preview','stored collision coordinates and dimensions unchanged','attack target point unchanged','health bar follows art','390px layout'],errors},null,2)+'\n');
  console.log('Fence visual position browser checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
