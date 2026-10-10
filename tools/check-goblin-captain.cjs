const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),sharp=require('sharp');
(async()=>{
  for(const [file,frames] of [['boss_goblin_captain.png',27],['goblin_warcry_aura.png',4]]){
    const {data,info}=await sharp(path.join(__dirname,'../dist/assets/boss',file)).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,48*frames);assert.equal(info.height,48);assert.equal(info.channels,4);
    for(let f=0;f<frames;f++){let opaque=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){
      const p=(y*info.width+f*48+x)*4,a=data[p+3];assert.ok(a===0||a===255);if(a)opaque++;else assert.equal(data.readUIntBE(p,3),0);
      if(x===0||y===0||x===47||y===47)assert.equal(a,0,`${file} clipped frame ${f}`);
    }assert.ok(opaque>20);}
  }
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
    await page.addInitScript(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;window.warcryDraws=[];CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='test-stage'&&image.src?.includes('goblin_warcry_aura.png')){window.warcryDraws.push(args);if(window.warcryDraws.length>200)window.warcryDraws.shift();}return draw.call(this,image,...args);};});
    await page.goto('http://127.0.0.1:4173/test/');await page.locator('#warcry-demo').click();
    await page.waitForFunction(()=>document.getElementById('warcry-status').textContent.includes('下次戰吼'));
    assert.equal(await page.locator('#object-count').textContent(),'7 個物件');assert.equal(await page.evaluate(()=>window.warcryDraws.length),0);
    await page.waitForFunction(()=>document.getElementById('warcry-status').textContent.includes('戰吼生效'),null,{timeout:22000});
    await page.locator('#play-animation').click();await page.waitForFunction(()=>window.warcryDraws.length>8);
    const text=await page.locator('#warcry-status').textContent();assert.match(text,/3 名哥布林/);
    const positions=await page.evaluate(()=>[...new Set(window.warcryDraws.map(a=>a[4]))].sort((a,b)=>a-b));assert.deepEqual(positions,[432,552,642,712]);
    await page.waitForTimeout(200);assert.equal(await page.locator('#warcry-status').textContent(),text);
    await page.screenshot({path:path.join(__dirname,'../art/goblin-captain/browser-warcry.png'),fullPage:true});
    await page.locator('#play-animation').click();await page.waitForFunction(()=>document.getElementById('warcry-status').textContent.includes('下次戰吼'),null,{timeout:7000});
    await page.evaluate(()=>window.warcryDraws=[]);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.warcryDraws.length),0);
    await page.locator('#warcry-now').click();await page.waitForFunction(()=>document.getElementById('warcry-status').textContent.includes('戰吼生效'));
    assert.deepEqual(errors,[]);console.log('Captain: fixed RGBA sprites, automatic 15s cast, 5s expiry, goblin-only radius, pause and manual preview passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
