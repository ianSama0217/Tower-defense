const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
    await page.addInitScript(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;window.shieldDraws=[];CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='test-stage'&&this.globalAlpha===1&&image.src?.includes('friendly_shield_soldier.png')){window.shieldDraws.push({args,x:this.getTransform().e});if(window.shieldDraws.length>300)window.shieldDraws.shift();}return draw.call(this,image,...args);};});
    await page.goto('http://127.0.0.1:4173/test/');await page.locator('[data-category="friendly"]').click();await page.getByRole('button',{name:'選擇友方盾兵',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#enemy-animation option[value="attack"]').disabled);
    const canvas=page.locator('#test-stage');
    async function place(){await canvas.scrollIntoViewIfNeeded();await canvas.click({position:{x:300,y:220}});await page.mouse.move(0,0);}
    for(const [state,start,count] of [['idle',0,4],['walk',4,4],['push',8,6],['hurt',14,3],['death',17,5]]){
      await page.locator('#enemy-animation').selectOption(state);await place();await page.evaluate(()=>window.shieldDraws=[]);
      await page.waitForFunction(({start,count})=>window.shieldDraws.some(d=>d.args[0]>=start*48&&d.args[0]<(start+count)*48&&d.args[2]===48&&d.args[3]===48),{start,count});await page.locator('#clear').click();
    }
    await page.locator('#enemy-animation').selectOption('push');await place();await page.evaluate(()=>window.shieldDraws=[]);await page.waitForFunction(()=>window.shieldDraws.length>0);
    const initial=await page.evaluate(()=>window.shieldDraws.at(-1).x);await page.locator('#shield-preview').click();
    await page.waitForFunction(x=>window.shieldDraws.at(-1)?.x>x+10,initial);assert.ok(await page.locator('#simulate').isDisabled());assert.ok(await page.locator('#clear').isDisabled());
    await page.locator('#play-animation').click();const paused=await page.evaluate(()=>window.shieldDraws.at(-1).x);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.shieldDraws.at(-1).x),paused);
    await page.locator('#shield-preview').click();await page.waitForFunction(x=>window.shieldDraws.at(-1)?.x===x,initial);assert.equal(await page.locator('#object-count').textContent(),'1 個物件');
    await page.screenshot({path:path.join(__dirname,'../art/shield-soldier/browser-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);console.log('Shield UI: five 48px animations, no attack option, forward movement, pause and position restoration passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
