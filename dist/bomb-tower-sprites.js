(function(root){
 'use strict';
 const specs=[null,...[64,80,96].map((size,i)=>({file:`tower_lv${i+1}.png`,size,anchor:{x:size/2,y:size-3},platform:{x:size/2,y:[24,33,41][i]}}))];
 function operatorFrame(unit,time){const elapsed=unit?.throwAt==null?Infinity:time-unit.throwAt;return elapsed>=0&&elapsed<.9?Math.min(7,2+Math.floor((elapsed+1e-9)/.15)):Math.floor(time*3)%2;}
 function draw(ctx,images,tower,scale,time,alpha=1){
  const s=specs[tower.level],x=tower.x-s.anchor.x*scale,y=tower.y-s.anchor.y*scale;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(images[tower.level],x,y,s.size*scale,s.size*scale);
  ctx.translate(x+s.platform.x*scale,y+s.platform.y*scale);ctx.scale((tower.bombFacing??tower.facing??1)*scale,scale);
  const frame=operatorFrame(tower,time);ctx.drawImage(images.operator,frame*24,0,24,24,-12,-22,24,24);ctx.restore();
 }
 function drawBomb(ctx,image,bomb,time,worldScale=1){
  const t=Math.max(0,Math.min(1,(time-bomb.launchedAt)/bomb.duration)),s=specs[bomb.sourceLevel];
  const height=(s.anchor.y-s.platform.y+12)*bomb.sourceScale,x=bomb.fromX+(bomb.toX-bomb.fromX)*t,y=bomb.fromY+(bomb.toY-bomb.fromY)*t-height*(1-t)-Math.sin(Math.PI*t)*45*worldScale;
  ctx.save();ctx.fillStyle='#10271f55';ctx.beginPath();ctx.ellipse(x,bomb.fromY+(bomb.toY-bomb.fromY)*t,5*worldScale,2*worldScale,0,0,Math.PI*2);ctx.fill();
  const frame=Math.floor(t*10)%5,scale=1.5*worldScale;ctx.drawImage(image,frame*16,0,16,16,x-8*scale,y-8*scale,16*scale,16*scale);ctx.restore();
 }
 function drawExplosion(ctx,image,e){
  const frame=Math.min(4,Math.floor((1-e.life/e.duration)*5)),size=e.radius*2;
  ctx.drawImage(image,frame*64,0,64,64,e.x-size/2,e.y-size*.8,size,size);
 }
 const api={specs,operatorFrame,draw,drawBomb,drawExplosion};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BombTowerSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
