(function(root){
  'use strict';
  const labels={build:'建造',upgrade:'升級',repair:'修復',demolish:'拆除'};
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
    const wood=material==='wood',phase=Math.floor(elapsed*10)%8;
    ctx.save();
    for(let i=0;i<15;i++){
      const t=(elapsed*1.5+i*.137)%1,side=i%2?-1:1;
      const px=x+side*(.08+t*.55)*width*((i%4+2)/5),py=y-width*(.08+Math.sin(t*Math.PI)*.24)+t*t*width*.14;
      ctx.globalAlpha=(1-t)*strength;
      ctx.fillStyle=wood?['#734625','#ad7541','#d7a269'][i%3]:['#5d605e','#969589','#c3bdac'][i%3];
      ctx.save();ctx.translate(px,py);ctx.rotate(side*(t*5+i));
      if(wood)ctx.fillRect(-3,-1,4+i%5,2);
      else{ctx.beginPath();ctx.moveTo(-3,-2);ctx.lineTo(2,-3);ctx.lineTo(4,1);ctx.lineTo(0,3);ctx.lineTo(-3,1);ctx.fill();}
      ctx.restore();
    }
    for(let i=0;i<8;i++){
      const t=(elapsed*.8+i*.113)%1,px=x+((i%2?-1:1)*(.12+t*.4))*width,py=y-width*.05-t*width*.22;
      ctx.globalAlpha=(1-t)*.48*strength;ctx.fillStyle=['#c9bda3','#dfd4bb','#b6a78b'][i%3];
      const r=width*(.045+.08*t);ctx.fillRect(Math.round(px-r),Math.round(py-r),Math.ceil(r*2),Math.ceil(r*1.6));
      ctx.fillRect(Math.round(px-r*.6),Math.round(py-r*1.4),Math.ceil(r*1.3),Math.ceil(r*2.1));
    }
    ctx.restore();return phase;
  }
  function draw(ctx,img,rect,action){
    const {x,y,w,h}=rect;
    if(!action){ctx.drawImage(img,x,y,w,h);return;}
    const progress=Math.min(1,action.elapsed/action.duration),phase=Math.floor(action.elapsed*10)%8;
    ctx.save();
    if(action.kind==='demolish'){
      // Collapse the original tower in horizontal sections toward the same ground anchor.
      const collapse=Math.max(0,(progress-.35)/.65);
      for(let i=0;i<8;i++){
        const sh=img.naturalHeight/8,dy=h/8,fall=collapse*collapse*(h-dy*(i+1)),shake=collapse*Math.sin(i*4+phase)*w*.045;
        ctx.globalAlpha=1-collapse*.9;
        ctx.drawImage(img,0,i*sh,img.naturalWidth,sh,x+shake,y+i*dy+fall,w,dy*(1-collapse*.65));
      }
      ctx.globalAlpha=1;debris(ctx,x+w/2,y+h*.92,w,action.elapsed,action.material,Math.min(1,.3+progress));
    }else{
      ctx.drawImage(img,x,y,w,h);
      const left=x+w*.16,right=x+w*.84,top=y+h*.3,bottom=y+h*.91;
      ctx.lineWidth=Math.max(2,w*.025);ctx.strokeStyle='#62442c';ctx.beginPath();
      ctx.moveTo(left,bottom);ctx.lineTo(left,top);ctx.moveTo(right,bottom);ctx.lineTo(right,top);
      for(let i=0;i<3;i++){const yy=top+(bottom-top)*i/3;ctx.moveTo(left-w*.05,yy);ctx.lineTo(right+w*.05,yy);}
      ctx.moveTo(left,bottom);ctx.lineTo(right,top);ctx.stroke();
      ctx.strokeStyle='#bb8a4c';ctx.lineWidth=Math.max(1,w*.012);ctx.beginPath();ctx.moveTo(left-1,bottom);ctx.lineTo(left-1,top);ctx.moveTo(right-1,bottom);ctx.lineTo(right-1,top);ctx.stroke();
      // Eight discrete poses / 0.8-second cycle, sharing the tower's ground position.
      const hx=x+w*(phase<4?.26:.73),hy=y+h*.38;
      ctx.save();ctx.translate(hx,hy);ctx.rotate([-.8,-.5,-.1,.65,-.8,-.5,-.1,.65][phase]);
      ctx.fillStyle='#b98141';ctx.fillRect(-2,0,4,h*.15);ctx.fillStyle='#474d50';ctx.fillRect(-w*.055,-3,w*.14,7);ctx.fillStyle='#b7bdba';ctx.fillRect(-w*.055,-3,w*.14,2);ctx.restore();
      if(phase===3||phase===7){ctx.fillStyle='#ffe395';for(let i=0;i<5;i++)ctx.fillRect(hx+Math.cos(i*1.3)*w*.09,hy+Math.sin(i*1.3)*h*.08,2+i%2,2);}
      if(phase>=5)debris(ctx,x+w/2,y+h*.91,w*.7,action.elapsed,'stone',.25);
    }
    ctx.restore();
  }
  root.TowerWork={labels,draw,debris,drawProgress};
})(globalThis);
