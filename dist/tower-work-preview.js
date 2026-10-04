(()=>{
  'use strict';
  const $=id=>document.getElementById(id),images={},live=$('live').getContext('2d'),strip=$('strip').getContext('2d');
  let elapsed=0,playing=true,last=null,loaded=false;
  const duration=()=> $('kind').value==='upgrade'?5:3;
  function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`無法載入 ${src}`));img.src=src;});}
  function rect(level,x,ground,scale){const s=TowerSprites.specs[level];return{x:x-s.anchor.x*scale,y:ground-s.anchor.y*scale,w:s.size*scale,h:s.size*scale};}
  function drawTower(ctx,level,x,ground,scale,t){
    const kind=$('kind').value,r=rect(level,x,ground,scale),target=kind==='upgrade'?{image:images[level+1],rect:rect(level+1,x,ground,scale)}:null;
    ctx.drawImage(images.pad,x-36*scale,ground-23*scale,72*scale,35*scale);
    TowerWork.draw(ctx,images[level],r,{kind,elapsed:t,duration:duration(),material:level===1?'wood':'stone'},target);
  }
  function render(){
    if(!loaded)return;
    const upgrade=$('kind').value==='upgrade',count=upgrade?2:3,total=duration();
    live.clearRect(0,0,1200,330);live.imageSmoothingEnabled=false;live.font='20px "Fusion Pixel"';live.textAlign='center';live.fillStyle='#e4e9cf';
    for(let i=0;i<count;i++){
      const x=(i+.5)*1200/count;drawTower(live,i+1,x,270,2.1,Math.min(total,elapsed));
      live.fillText(upgrade?`Lv.${i+1} → Lv.${i+2}`:`Lv.${i+1} · ${i===0?'木材':'石材'}`,x,310);
    }
    strip.clearRect(0,0,1440,260);strip.imageSmoothingEnabled=false;strip.font='16px "Fusion Pixel"';strip.textAlign='center';
    for(let i=0;i<8;i++){
      const x=(i+.5)*180;drawTower(strip,upgrade?1:2,x,208,1.45,(i+.5)/8*total);
      strip.fillStyle='#bdd794';strip.fillText(String(i+1).padStart(2,'0'),x,28);
      strip.fillStyle='#e4e9cf';strip.fillText(TowerWork.stages[$('kind').value][i],x,242);
    }
    $('timeline').value=String(Math.min(1000,elapsed/total*1000));
    const state=TowerWork.sample({elapsed,duration:total});
    $('status').textContent=`${Math.min(elapsed,total).toFixed(1)} / ${total} 秒 · ${TowerWork.stages[$('kind').value][state.stage]}`;
  }
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暫停':'播放';};
  $('restart').onclick=()=>{elapsed=0;render();};
  $('kind').onchange=()=>{elapsed=0;render();};
  $('timeline').oninput=()=>{elapsed=Number($('timeline').value)/1000*duration();playing=false;$('play').textContent='播放';render();};
  Promise.all([TowerWork.ready.then(ok=>{if(!ok)throw new Error('無法載入動畫素材');}),...TowerSprites.specs.slice(1).map(async(s,i)=>{images[i+1]=await load(`assets/towers/${s.file}`);}),load('assets/environment/buildPad.png').then(img=>{images.pad=img;})]).then(()=>{loaded=true;render();}).catch(error=>{$('status').textContent=error.message;$('status').className='error';});
  function frame(now){const dt=last===null?0:Math.min(.08,(now-last)/1000);last=now;if(loaded&&playing&&!document.hidden){elapsed+=dt*Number($('speed').value);if(elapsed>duration()+.7)elapsed=0;render();}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
