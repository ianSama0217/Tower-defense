(function(root){
  'use strict';
  const stages=[100,80,50,25,0],hp=150;
  const lengthScale=1.75;
  function stage(value,max=hp){const ratio=value/max;return ratio<=0?0:ratio<=.25?25:ratio<=.5?50:ratio<=.8?80:100;}
  function layout(w){const vertical=w.orientation==='vertical',scale=w.visualScale??1,span=vertical?w.height:w.width;
    return {vertical,length:span*lengthScale*scale,thickness:48*(span/96)*scale};
  }
  function bounds(w){const {vertical,length,thickness}=layout(w),h=thickness*(stage(w.hp,w.maxHp)===0?22/36:1);
    return vertical?{x:w.x-thickness/2,y:w.y-length/2,w:h,h:length}:{x:w.x-length/2,y:w.y+thickness/2-h,w:length,h};
  }
  function draw(ctx,images,w,alpha=1){
    const image=images[stage(w.hp??hp,w.maxHp??hp)];if(!image)return;
    const {vertical,length,thickness}=layout(w);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;ctx.translate(w.x,w.y);if(vertical)ctx.rotate(Math.PI/2);
    // Preserve all four X braces; rotate the complete strip for vertical roads.
    ctx.drawImage(image,0,0,96,36,-length/2,-thickness/2,length,thickness);ctx.restore();
  }
  function drawHealth(ctx,w){
    if(w.hp<=0)return;const b=bounds(w),width=Math.min(48,Math.max(32,b.w)),x=b.x+(b.w-width)/2,y=b.y-10;
    ctx.fillStyle='#152a1c';ctx.fillRect(x,y,width,4);ctx.fillStyle=w.hp>w.maxHp*.25?'#b0d879':'#ec977c';ctx.fillRect(x,y,width*w.hp/w.maxHp,4);
  }
  const api={stages,hp,lengthScale,stage,layout,bounds,draw,drawHealth};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FenceSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
