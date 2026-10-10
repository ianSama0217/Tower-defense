const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{
      const original=CanvasRenderingContext2D.prototype.drawImage;window.bossDraws=[];
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image?.src?.includes('/assets/boss/')){window.bossDraws.push({file:image.src.split('/').at(-1),args});if(window.bossDraws.length>600)window.bossDraws.shift();}return original.call(this,image,...args);};
    });
    await page.goto('http://127.0.0.1:4173/test/');
    await page.locator('[data-category="boss"]').click();
    await page.getByRole('button',{name:'選擇Boss 獨眼巨人',exact:true}).click();
    const canvas=page.locator('#test-stage');
    async function place(){await canvas.scrollIntoViewIfNeeded();await canvas.click({position:{x:300,y:220}});}
    for(const [state,start,count] of [['idle',0,4],['walk',4,4],['attack',8,4],['throw',12,6],['hurt',18,3],['death',21,6]]){
      await page.locator('#enemy-animation').selectOption(state);await place();await page.evaluate(()=>window.bossDraws=[]);
      await page.waitForFunction(({start,count})=>window.bossDraws.some(d=>d.file==='boss_cyclops.png'&&d.args[0]>=start*96&&d.args[0]<(start+count)*96&&d.args[2]===96&&d.args[3]===96),{start,count});
      assert.ok(await page.locator('#simulate').isDisabled(),'Asset preview must not invent Boss combat stats');
      await page.locator('#clear').click();
    }
    for(const [name,state,file,size] of [['Boss 飛行石頭','fly','boss_cyclops_rock.png',32],['Boss 石頭落地','impact','boss_cyclops_rock_impact.png',48]]){
      await page.getByRole('button',{name:`選擇${name}`,exact:true}).click();assert.equal(await page.locator('#enemy-animation').inputValue(),state);await place();
      await page.waitForFunction(({file,size})=>window.bossDraws.some(d=>d.file===file&&d.args[2]===size&&d.args[3]===size),{file,size});await page.locator('#clear').click();
    }
    // Ordinary enemy simulation still works with the new preview-only category present.
    await page.locator('[data-category="enemy"]').click();await place();await page.locator('#simulate').click();await page.waitForFunction(()=>document.getElementById('simulation-status').textContent.includes('存活怪物 1'));await page.locator('#simulate').click();
    await page.goto('http://127.0.0.1:4173/boss-preview.html');await page.waitForFunction(()=>window.bossDraws.length>=8);
    assert.equal(await page.locator('.card').count(),8);await page.locator('#step').click();await page.locator('#flip').click();await page.locator('#background').selectOption('light');
    await page.screenshot({path:path.join(root,'art/boss-cyclops/browser-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);console.log('Boss preview: all 8 animations, fixed slicing, separate projectiles, controls and existing enemy simulation passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
