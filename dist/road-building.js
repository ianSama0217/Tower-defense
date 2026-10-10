(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  const gridCache=new WeakMap();
  function cells(level){
    if(gridCache.has(level))return gridCache.get(level);
    const {roadWidth:size,width,height}=level.mapConfig,half=size/2,result=[],keys=new Set();
    function add(x,y,w,h,orientation,anchor=null){
      x=Math.max(0,Math.min(width-size,x));y=Math.max(0,Math.min(height-size,y));
      const key=[x,y,w,h].join(',');if(keys.has(key))return;keys.add(key);
      result.push({x:anchor?.x??x+w/2,y:anchor?.y??y+h/2,orientation,frame:{x,y,w,h}});
    }
    // Keep every frame square. Distribute spare road length as spacing, never
    // as a squeezed cell; short connector gaps select the nearest full cell.
    for(const route of level.routes){
      route.path.forEach((p,i)=>{
        const adjacent=route.path[i?i-1:1];
        // Inset the wall toward its segment so its thickness clears a bend's
        // rounded collision corner and stays inside the map at entrances.
        const inset=Math.min(size,TD.WALL.thickness*level.worldScale)/2;
        const anchor=i===0||i===route.path.length-1?null:{x:p.x+Math.sign(adjacent.x-p.x)*inset,y:p.y+Math.sign(adjacent.y-p.y)*inset};
        add(p.x-half,p.y-half,size,size,p.y===adjacent.y?'vertical':'horizontal',anchor);
      });
      for(let i=0;i<route.segments.length;i++){
        const a=route.path[i],b=route.path[i+1],horizontal=a.y===b.y;
        const limit=horizontal?width:height,center=value=>Math.max(half,Math.min(limit-half,value));
        const start=center(Math.min(horizontal?a.x:a.y,horizontal?b.x:b.y))+half;
        const end=center(Math.max(horizontal?a.x:a.y,horizontal?b.x:b.y))-half;
        const count=Math.max(0,Math.floor((end-start)/size)),gap=(end-start-count*size)/(count+1);
        for(let n=0;n<count;n++){const u=Math.round(start+gap+n*(size+gap));
          if(horizontal)add(u,a.y-half,size,size,'vertical');
          else add(a.x-half,u,size,size,'horizontal');
        }
      }
    }
    gridCache.set(level,result);return result;
  }
  function enabled(game){return game.level.stageIndex>=2&&game.wallsUnlocked&&game.phase==='playing';}
  function at(game,x,y){
    if(!enabled(game)||!Number.isFinite(x)||!Number.isFinite(y))return null;
    const grid=cells(game.level);
    let cell=grid.find(({frame:f})=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);
    if(!cell){
      const onRoad=game.level.routes.some(route=>route.segments.some((length,i)=>{
        const a=route.path[i],b=route.path[i+1];if(!length)return false;
        const t=Math.max(0,Math.min(1,((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/(length*length)));
        return Math.hypot(x-a.x-t*(b.x-a.x),y-a.y-t*(b.y-a.y))<=game.level.mapConfig.roadWidth/2;
      }));
      if(onRoad)cell=grid.reduce((nearest,next)=>!nearest||Math.hypot(next.x-x,next.y-y)<Math.hypot(nearest.x-x,nearest.y-y)?next:nearest,null);
    }
    if(!cell)return null;
    const wall=game.walls.find(w=>w.hp>0&&w.x>=cell.frame.x&&w.x<cell.frame.x+cell.frame.w&&w.y>=cell.frame.y&&w.y<cell.frame.y+cell.frame.h);
    if(wall)return {...wall,wall,frame:cell.frame};
    const f=cell.frame,reason=game.buildingBlockReason(f.x+f.w/2,f.y+f.h/2,f.w,f.h);
    if(reason)return {x:cell.x,y:cell.y,orientation:cell.orientation,frame:f,blocked:true,reason};
    const result=game.wallPlacement(cell.x,cell.y,cell.orientation);
    return result.ok?{...result.placement,frame:cell.frame}:null;
  }
  function item(game,placement,{ready=true,paused=false}={}){
    if(placement.wall)return {label:game.roadBuilding.name,amount:null,duration:null,income:false,disabled:true,reason:placement.wall.hp>0?'無法修復、升級或拆除':'已摧毀'};
    const result=game.canPlaceWall(placement.x,placement.y,placement.orientation);
    const reason=!ready?'素材載入中':paused?'遊戲已暫停':placement.blocked?placement.reason:result.ok?'':result.message;
    return {label:`建造${game.roadBuilding.name}`,amount:game.roadBuilding.cost,duration:0,income:false,disabled:!!reason,reason};
  }
  const api={enabled,at,item,cells};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoadBuilding=api;
})(typeof globalThis!=='undefined'?globalThis:this);
