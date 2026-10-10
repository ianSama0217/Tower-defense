(function(root){
 'use strict';
 const stages=[100,80,50,25,0];
 function stage(hp,maxHp){const r=hp/maxHp;return r<=0?0:r<=.25?25:r<=.5?50:r<=.8?80:100;}
 function file(orientation,hp=300,maxHp=300){return `assets/walls-topdown/wall-${orientation}-${stage(hp,maxHp)}.png`;}
 function layout(wall,scale=2){
  const vertical=wall.orientation==='vertical',visualScale=wall.visualScale??1;
  const base=root.TestWallFrames[`${wall.orientation}-100`],frame=root.TestWallFrames[`${wall.orientation}-${stage(wall.hp??300,wall.maxHp??300)}`];
  // Match the fence's visible span; preserve the compressed stone side faces.
  const span=(vertical?wall.height:wall.width)??48*scale,length=span*root.FenceSprites.lengthScale*visualScale;
  const sx=vertical?scale/2*visualScale:length/base.w,sy=vertical?length/base.h:scale/2*visualScale;
  const x=wall.x-(base.x+base.w/2)*sx,y=wall.y-(base.y+base.h/2)*sy;
  return {x,y,sx,sy,bounds:{x:x+frame.x*sx,y:y+frame.y*sy,w:frame.w*sx,h:frame.h*sy}};
 }
 function bounds(wall,scale=2){return layout(wall,scale).bounds;}
 function healthBar(wall,scale=2){const b=bounds(wall,scale),w=Math.min(48,Math.max(24,b.w));return {x:b.x+b.w/2-w/2,y:b.y-10,w,h:4};}
 function drawHealth(ctx,wall,scale=2){if(wall.hp<=0)return;const b=healthBar(wall,scale);ctx.fillStyle='#152a1c';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=wall.hp>wall.maxHp*.25?'#b0d879':'#ec977c';ctx.fillRect(b.x,b.y,b.w*wall.hp/wall.maxHp,b.h);}
 function draw(ctx,image,wall,scale=2,alpha=1){const {x,y,sx,sy}=layout(wall,scale);ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;ctx.drawImage(image,x,y,96*sx,96*sy);ctx.restore();}
 root.TestWallSprites={stages,stage,file,bounds,healthBar,drawHealth,draw};
})(globalThis);
