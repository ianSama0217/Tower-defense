const assert=require('node:assert/strict'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('playwright'),spec=require('../dist/bat-sprites.js').bat;
(async()=>{
  const {data,info}=await sharp(path.join(__dirname,'../dist/assets/enemies',spec.file)).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,456);assert.equal(info.height,24);assert.equal(info.channels,4);
  let offset=0;for(const a of Object.values(spec.animations)){assert.equal(a.start,offset);offset+=a.count;}assert.equal(offset,19);
  for(let f=0;f<19;f++){
    let opaque=0,transparent=0;
    for(let y=0;y<24;y++)for(let x=0;x<24;x++){
      const alpha=data[(y*456+f*24+x)*4+3];assert.ok(alpha===0||alpha===255);
      if(x===0||x===23||y===0||y===23)assert.equal(alpha,0,`frame ${f} clips`);
      if(alpha)opaque++;else transparent++;
    }
    assert.ok(opaque>20&&transparent>0);
  }
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
    await page.addInitScript(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;window.batDraws=[];CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='test-stage'&&this.globalAlpha===1&&image.src?.includes('enemy_bat.png')){window.batDraws.push({args,scale:this.getTransform().a});if(window.batDraws.length>300)window.batDraws.shift();}return draw.call(this,image,...args);};});
    await page.goto('http://127.0.0.1:4173/test/');await page.getByRole('button',{name:'選擇洞窟蝙蝠',exact:true}).click();
    assert.equal(await page.locator('#asset-count').textContent(),'7 個素材');
    const canvas=page.locator('#test-stage');
    async function place(){await canvas.scrollIntoViewIfNeeded();await canvas.click({position:{x:300,y:220}});await page.mouse.move(0,0);}
    for(const [state,a] of Object.entries(spec.animations)){
      await page.locator('#enemy-animation').selectOption(state);await place();await page.evaluate(()=>window.batDraws=[]);
      await page.waitForFunction(({start,count})=>window.batDraws.some(d=>d.args[0]===(start+count-1)*24&&d.args[2]===24&&d.args[3]===24),a);
      assert.ok(await page.locator('#simulate').isDisabled());await page.locator('#clear').click();
    }
    await page.locator('#enemy-animation').selectOption('fly');await page.locator('#flip-object').click();await place();
    await page.waitForFunction(()=>window.batDraws.at(-1)?.scale===-2);
    await page.locator('#play-animation').click();await page.waitForTimeout(100);const last=await page.evaluate(()=>window.batDraws.at(-1).args[0]);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.batDraws.at(-1).args[0]),last);
    await page.locator('#play-animation').click();
    await page.getByRole('button',{name:'選擇史萊姆',exact:true}).click();await place();await page.locator('#simulate').click();await page.evaluate(()=>window.batDraws=[]);
    await page.waitForFunction(()=>window.batDraws.length>5);await page.locator('#simulate').click();
    assert.equal(await page.locator('#object-count').textContent(),'2 個物件');
    await page.getByRole('button',{name:'選擇洞窟蝙蝠',exact:true}).click();
    await page.screenshot({path:path.join(__dirname,'../art/bat/browser-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS: 19 transparent 24px cells, safe margins, five animations, flip, pause, preview-only and mixed combat scene.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
