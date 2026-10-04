(function(root){
  'use strict';
  const labels={build:'建造',upgrade:'升級',repair:'修復',demolish:'拆除'};
  const stages={
    upgrade:['原始狀態','搭建木頭鷹架','開始敲擊','持續施工','噴出石子／灰塵','接近完成','最後敲擊','完成升級'],
    demolish:['原始狀態','開始敲擊','出現裂痕','持續破壞','大量崩落','剩餘殘骸','碎石消散','完全拆除']
  };
  let atlas=null;
  // Resolve relative to this script, including when used from nested preview pages.
  const ready=typeof Image==='undefined'?Promise.resolve(false):new Promise(resolve=>{
    atlas=new Image();atlas.onload=()=>resolve(true);atlas.onerror=()=>resolve(false);
    atlas.src=new URL('assets/tower-work/effects.png',document.currentScript?.src||document.baseURI).href;
  });
  const clamp=value=>Math.max(0,Math.min(1,value));
  function sample(action){
    const elapsed=Math.max(0,Number(action.elapsed)||0),duration=Math.max(.001,Number(action.duration)||.001);
    const progress=clamp(elapsed/duration);
    return {progress,stage:Math.min(7,Math.floor(progress*8)),frame:Math.floor(elapsed*10+1e-7)%8,time:Math.floor(elapsed*10+1e-7)/10};
  }
  function effect(ctx,index,x,y,w,h=w,alpha=1){
    if(!atlas?.complete||!atlas.naturalWidth||alpha<=0)return;
    ctx.save();ctx.globalAlpha*=clamp(alpha);
    ctx.drawImage(atlas,index%4*96,Math.floor(index/4)*96,96,96,Math.round(x),Math.round(y),Math.round(w),Math.round(h));ctx.restore();
  }
  function drawProgress(ctx,x,y,progress,size=48){
    // Twelve clockwise steps, with an open center so the artwork remains visible.
    const amount=Math.floor(Math.max(0,Math.min(1,progress))*12)/12;
    ctx.save();ctx.translate(x,y);ctx.scale(size/48,size/48);
    ctx.lineCap='butt';
    const arc=(radius,width,color,end=Math.PI*1.5)=>{
      ctx.beginPath();ctx.arc(0,0,radius,-Math.PI/2,end);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
    };
    arc(18,12,'#171c18');
    arc(18,8,'#777d78');
    arc(20,2,'#b6bab1');arc(15.5,1,'#4b534c');
    if(amount>0){
      const end=-Math.PI/2+Math.PI*2*amount;
      arc(18,8,'#39d844',end);
      arc(20,2,'#a3fa87',end);arc(15.5,1,'#238b35',end);
      if(amount<1){ctx.strokeStyle='#263e29';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.cos(end)*14,Math.sin(end)*14);ctx.lineTo(Math.cos(end)*22,Math.sin(end)*22);ctx.stroke();}
    }
    ctx.restore();
  }
  function debris(ctx,x,y,width,elapsed,material,strength=1){
    const frame=Math.floor(Math.max(0,elapsed)*10)%8,index=Math.floor(frame/2);
    effect(ctx,material==='wood'?(index<2?14:15):8+index,x-width*.55,y-width*.65,width*1.1,width*.72,strength);
    effect(ctx,4+index,x-width*.6,y-width*.65,width*1.2,width*.8,strength*.7);
    return frame;
  }
  function tower(ctx,img,r){ctx.drawImage(img,r.x,r.y,r.w,r.h);}
  function hammer(ctx,r,frame,offsetX=.57,offsetY=-.05){
    const pose=Math.floor(frame/2),size=r.w*.55,x=r.x+r.w*offsetX,y=r.y+r.h*offsetY;
    effect(ctx,pose,x,y,size);
    if(pose===2)effect(ctx,13,x-size*.14,y+size*.54,size*.48);
  }
  function cracks(ctx,r,stage){
    ctx.save();ctx.strokeStyle='#292820';ctx.lineWidth=Math.max(1,r.w*.018);ctx.lineJoin='miter';
    for(let i=0;i<(stage===2?1:3);i++){
      const x=r.x+r.w*(.35+i*.18),y=r.y+r.h*(.35+i*.09);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-r.w*.035,y+r.h*.09);ctx.lineTo(x+r.w*.03,y+r.h*.13);ctx.lineTo(x-r.w*.04,y+r.h*.24);ctx.stroke();
    }
    ctx.restore();
  }
  function collapse(ctx,img,r,amount){
    const sw=(img.naturalWidth||img.width)/5,sh=(img.naturalHeight||img.height)/5;
    // Actual sprite fragments keep their texture and fall around the original pad.
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const t=clamp(amount*(1+(4-row)*.12)),side=col-2;
      const x=r.x+col*r.w/5+side*t*r.w*.055,y=r.y+row*r.h/5+t*t*(4-row)*r.h/5;
      ctx.save();ctx.globalAlpha*=1-t*.8;
      ctx.translate(x+r.w/10,y+r.h/10);ctx.rotate(side*t*.25);
      ctx.drawImage(img,col*sw,row*sh,sw,sh,-r.w/10,-r.h/10,r.w/5,r.h/5);ctx.restore();
    }
  }
  function draw(ctx,img,rect,action,target=null){
    if(!action){tower(ctx,img,rect);return;}
    const {stage,frame,time,progress}=sample(action),{x,y,w,h}=rect;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(action.kind==='demolish'){
      if(stage<4){
        const shake=stage>=2?Math.sin(frame*2.3)*w*.012:0;
        const r={...rect,x:x+shake};tower(ctx,img,r);
        if(stage>=2)cracks(ctx,r,stage);
        if(stage>=1)hammer(ctx,r,frame,.22,.06);
        if(stage===3)debris(ctx,x+w/2,y+h*.93,w*.75,time,action.material,.65);
      }else if(stage===4){
        collapse(ctx,img,rect,clamp((progress-.5)/.125));
        effect(ctx,action.material==='wood'?14:9,x-w*.08,y+h*.28,w*1.16,h*.72);
        effect(ctx,6,x-w*.2,y+h*.03,w*1.4,h*.96,.9);
      }else if(stage<7){
        const alpha=stage===5?1:clamp((.875-progress)/.125);
        effect(ctx,action.material==='wood'?15:10,x,y+h*.53,w,h*.46,alpha);
        effect(ctx,7,x-w*.14,y+h*.15,w*1.28,h*.85,alpha*.8);
      }
    }else{
      const next=action.kind==='upgrade'&&target?.image?target:{image:img,rect};
      const reveal=action.kind==='repair'?0:[0,0,.12,.3,.52,.76,.94,1][stage];
      const baseline=Math.max(y+h,next.rect.y+next.rect.h),top=Math.min(y,next.rect.y);
      const split=baseline-(baseline-top)*reveal;
      if(action.kind!=='build'&&reveal<1){
        ctx.save();ctx.beginPath();ctx.rect(Math.min(x,next.rect.x)-w,top-h,w*4,split-top+h);ctx.clip();tower(ctx,img,rect);ctx.restore();
      }
      if(reveal>0){
        ctx.save();ctx.beginPath();ctx.rect(Math.min(x,next.rect.x)-w,split,w*4,baseline-split+h);ctx.clip();tower(ctx,next.image,next.rect);ctx.restore();
      }
      const work={x:Math.min(x,next.rect.x),y:Math.min(y,next.rect.y),w:Math.max(w,next.rect.w),h:Math.max(h,next.rect.h)};
      // Seat the upgrade scaffold over the foot of the tower at every sprite scale.
      if(action.kind==='upgrade'){work.x-=work.w*.1;work.y+=work.h*.12;}
      if(stage>=1&&stage<=6){
        effect(ctx,12,work.x-work.w*.08,work.y+work.h*.16,work.w*1.16,work.h*.84,stage===6?.55:1);
        if(stage>=2)hammer(ctx,work,frame);
        if(stage>=3&&(frame===4||frame===5||stage===4))debris(ctx,work.x+work.w/2,work.y+work.h*.93,work.w*.85,time,'stone',.5);
      }
      if(stage===7&&action.kind!=='repair')effect(ctx,13,next.rect.x+next.rect.w*.6,next.rect.y,next.rect.w*.3,next.rect.w*.3,(1-progress)*8);
    }
    ctx.restore();
  }
  const api={labels,stages,ready,sample,draw,debris,drawProgress};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TowerWork=api;
})(globalThis);
