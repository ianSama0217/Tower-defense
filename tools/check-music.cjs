const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().includes('/assets/music/'))requests.push(r.url());});
    await page.addInitScript(()=>{
      const NativeAudio=window.Audio;window.musicElements=[];
      window.Audio=function(...args){const media=new NativeAudio(...args);musicElements.push(media);return media;};
      let tutorial;
      Object.defineProperty(window,'Tutorial',{get:()=>tutorial,set:value=>{
        const Game=value.TutorialGame;
        value.TutorialGame=class extends Game{constructor(...args){super(...args);window.testGame=this;}};
        tutorial=value;
      }});
    });
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#start:not([disabled])').click();
    assert.equal(await page.evaluate(()=>musicElements.length),0);assert.equal(requests.length,0);
    for(const [i,path] of ['tutorial.html','level-two.html','level-three.html'].entries()){
      await page.goto(`http://127.0.0.1:4173/${path}`);
      await page.locator('#wave-control:not([disabled])').waitFor();
      await page.locator('#pause').click();
      await page.waitForFunction(()=>musicElements[0]?.currentTime>.1&&!musicElements[0].paused);
      assert.deepEqual(await page.evaluate(()=>({loop:musicElements[0].loop,src:musicElements[0].src.split('/').pop(),count:musicElements.length})),{loop:true,src:`battle-${i+1}.mp3`,count:1});
      await page.locator('#battle-music').fill('23');
      assert.equal(await page.evaluate(()=>musicElements[0].volume),.23);
      await page.locator('#sound-volume').fill('0');
      assert.equal(await page.evaluate(()=>musicElements[0].volume),.23);
      await page.locator('#battle-music').fill('0');
      assert.equal(await page.evaluate(()=>musicElements[0].volume),0);
      await page.locator('#battle-music').fill('23');
      await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
      assert.equal(await page.evaluate(()=>musicElements[0].paused),true);
      await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
      await page.waitForFunction(()=>!musicElements[0].paused);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>musicElements[0].paused),true);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForFunction(()=>!musicElements[0].paused);
      // The actual decoder must wrap around at the end of the track.
      await page.evaluate(()=>{musicElements[0].currentTime=musicElements[0].duration-.15;});
      await page.waitForFunction(()=>musicElements[0].currentTime<2);
      if(i===0){
        await page.locator('#resume').click();
        await page.evaluate(()=>{testGame.phase='won';});
        await page.locator('#result[open]').waitFor();
        assert.equal(await page.evaluate(()=>musicElements[0].paused),true);
        await page.locator('#restart').click();
        await page.waitForFunction(()=>!musicElements[0].paused&&musicElements[0].currentTime<2);
        assert.equal(await page.evaluate(()=>musicElements.length),1);
        await page.locator('#pause').click();
      }
      await page.locator('#game-settings a').click();
      await page.waitForURL('**/index.html#levels');
      const before=requests.length;
      await page.locator('#world-settings-open').click();
      assert.equal(await page.evaluate(()=>musicElements.length),0);assert.equal(requests.length,before);
      assert.equal(await page.locator('#world-music').inputValue(),'23');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: three real audio tracks, looping, volume persistence, restart, visibility, navigation, silent menus.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
