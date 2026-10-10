(function(root){
  'use strict';
  const ARROW_COUNT=240;
  function draw(ctx,arrow,rain,time){
    if(!rain||!arrow?.complete||!arrow.naturalWidth)return;
    const age=time-rain.startedAt;
    if(age<0||age>=1.2)return;
    for(let i=0;i<ARROW_COUNT;i++){
      const x=12+((i*487+37)%1256),ground=80+((i*293+19)%650),delay=(i%8)*.075;
      const progress=(age-delay)/.6;
      if(progress>=0&&progress<1){
        ctx.save();ctx.translate(x,-70+(ground+70)*progress);ctx.rotate(Math.PI/2);ctx.globalAlpha=Math.min(1,(1.2-age)*2);ctx.drawImage(arrow,-20,-5,40,10);ctx.restore();
      }else if(progress>=1&&progress<1.45){
        const fade=1-(progress-1)/.45;ctx.fillStyle=`rgba(255,194,82,${fade*.8})`;
        ctx.fillRect(x-7,ground-2,14,4);ctx.fillRect(x-2,ground-7,4,14);
      }
    }
  }
  const api={draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArrowRain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
