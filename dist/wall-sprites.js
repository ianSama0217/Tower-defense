(function(root){
  'use strict';
  const stages=[100,80,50,25,0];
  function stage(hp,maxHp){const ratio=hp/maxHp;return ratio<=0?0:ratio<=.25?25:ratio<=.5?50:ratio<=.8?80:100;}
  // Tight alpha bounds of the horizontal atlas, excluding the old 64 x 80 padding.
  // Both orientations use these same pixels; vertical is a Canvas quarter turn.
  const frames={100:{x:7,y:46,w:49,h:30},80:{x:6,y:46,w:52,h:30},50:{x:6,y:46,w:52,h:30},25:{x:4,y:49,w:56,h:27},0:{x:6,y:57,w:52,h:19}};
  function file(orientation,hp=300,maxHp=300){return `assets/walls/wall-horizontal-${stage(hp,maxHp)}.png`;}
  function layout(wall,scale=2){
    const vertical=wall.orientation==='vertical',width=wall.width??(vertical?16:36)*scale,height=wall.height??(vertical?36:16)*scale;
    const length=vertical?height:width,thickness=vertical?width:height,unit=thickness/30;
    const frame=frames[stage(wall.hp??300,wall.maxHp??300)];
    const bounds=vertical?{x:wall.x-thickness/2,y:wall.y-length/2,w:frame.h*unit,h:length}:{x:wall.x-length/2,y:wall.y-thickness/2+(frame.y-46)*unit,w:length,h:frame.h*unit};
    return {vertical,length,thickness,unit,frame,bounds};
  }
  function bounds(wall,scale=2){return layout(wall,scale).bounds;}
  function healthBar(wall,scale=2){const b=bounds(wall,scale),w=Math.min(48,Math.max(32,b.w));return {x:b.x+b.w/2-w/2,y:b.y-10,w,h:4};}
  function drawHealth(ctx,wall,scale=2){
    if(wall.hp<=0)return;
    const b=healthBar(wall,scale);ctx.fillStyle='#152a1c';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=wall.hp>wall.maxHp*.25?'#b0d879':'#ec977c';ctx.fillRect(b.x,b.y,b.w*wall.hp/wall.maxHp,b.h);
  }
  function draw(ctx,image,wall,scale=2,alpha=1){
    const {vertical,length,thickness,unit,frame}=layout(wall,scale),cap=12,edge=Math.min(length/2,cap*unit);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;ctx.translate(wall.x,wall.y);if(vertical)ctx.rotate(Math.PI/2);
    const y=-thickness/2,left=-length/2;
    ctx.drawImage(image,frame.x,46,cap,30,left,y,edge,thickness);
    // Repeat the middle tile instead of stretching all stones to the road width.
    const middle=frame.w-2*cap,tile=middle*unit;
    for(let x=edge;x<length-edge-1e-7;){const width=Math.min(tile,length-edge-x);ctx.drawImage(image,frame.x+cap,46,width/unit,30,left+x,y,width,thickness);x+=width;}
    ctx.drawImage(image,frame.x+frame.w-cap,46,cap,30,length/2-edge,y,edge,thickness);ctx.restore();
  }
  const api={stages,stage,file,frames,layout,bounds,healthBar,drawHealth,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WallSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
