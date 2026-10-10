const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  fs.mkdirSync('art/entrance-flags',{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    for(const [file,scenario,count] of [['tutorial','Tutorial',1],['level-two','LevelTwo',2],['level-three','LevelThree',1]]){
      for(const [width,height] of [[1586,952],[390,844]]){
        await page.setViewportSize({width,height});
        await page.goto(`http://127.0.0.1:4173/${file}.html`);
        await page.waitForFunction(()=>document.querySelector('.pad-button')?.disabled===false);
        await page.evaluate(()=>document.fonts.ready);
        const flags=await page.evaluate(async name=>{
          const level=window[name].scenario(),images={};
          for(const key of [...Environment.names,'enemyEntranceFlag']){
            const img=new Image();img.src=key==='enemyEntranceFlag'?'assets/ui/enemy-entrance-flag.png':`assets/environment/${key}.png`;
            await img.decode();images[key]=img;
          }
          const markers=Environment.entranceFlags(level,2),scenery=Environment.placements(level,images,2);
          const entries=[...new Map(level.routes.map(r=>[`${r.path[0].x},${r.path[0].y}`,r.path[0]])).values()];
          const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
          return markers.map((p,i)=>({...p,straddlesRoad:p.y<entries[i].y+level.mapConfig.roadWidth/2&&p.y+p.h>entries[i].y+level.mapConfig.roadWidth/2,
            inside:p.x>=0&&p.x+p.w<=level.mapConfig.width&&p.y+p.h<=level.mapConfig.height,
            clear:!scenery.some(s=>overlaps(p,s))}));
        },scenario);
        assert.equal(flags.length,count);assert.ok(flags.every(f=>f.straddlesRoad&&f.inside&&f.clear));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.screenshot({path:`art/entrance-flags/${file}-${width}.png`});
        checks.push({page:file,width,flags});
      }
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync('art/entrance-flags/verification.json',JSON.stringify({checks,errors},null,2)+'\n');
    console.log('All three stages: entrance counts, road shoulder overlap, scenery clearance, desktop/mobile rendering and assets passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
