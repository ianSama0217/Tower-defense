(function(root){
  'use strict';
  const names=['oak','roundTree','birch','pine','limeTree','oldOak','goldTree','sapling','youngTree','smallTree','smallOak','bush','flowers','orangeBush','berryBush','log','boulders','standingRock','rockCluster','mossRock','rock','pebble','lowRock','stump','fallenLog','grass','grassDirt','dirt','meadow','flowerGrass','fern','tuft','reeds','whiteFlowers','pinkFlowers','buildPad'];
  function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function roadRects(level,margin=0){
    const half=level.mapConfig.roadWidth/2+margin,rects=[];
    for(const route of level.routes)for(let i=1;i<route.path.length;i++){
      const a=route.path[i-1],b=route.path[i];rects.push({x:Math.min(a.x,b.x)-half,y:Math.min(a.y,b.y)-half,w:Math.abs(a.x-b.x)+half*2,h:Math.abs(a.y-b.y)+half*2});
    }
    return rects;
  }
  function placements(level,images,displayScale=1){
    const random=rng(48315),map=level.mapConfig,placed=[],roads=roadRects(level,4);
    // Reserve the full tower silhouette above every build pad as well as its click area.
    const reserved=level.slots.map(s=>({x:s.x-24*displayScale,y:s.y-56*displayScale,w:48*displayScale,h:78*displayScale}));
    const groups=[{count:19,names:names.slice(0,11),scale:.85},{count:15,names:['boulders','standingRock','rockCluster','mossRock','rock','lowRock','stump','fallenLog','log'],scale:.8},{count:28,names:['bush','flowers','orangeBush','berryBush'],scale:.75},{count:45,names:['fern','tuft','reeds','whiteFlowers','pinkFlowers','pebble'],scale:.75}];
    for(const group of groups){let count=0;for(let attempt=0;attempt<1600&&count<group.count;attempt++){
      const name=group.names[Math.floor(random()*group.names.length)],img=images[name],scale=group.scale*(.85+random()*.3),w=Math.round(img.naturalWidth*scale)*displayScale,h=Math.round(img.naturalHeight*scale)*displayScale;
      const box={x:Math.floor(3+random()*(map.width-w-6)),y:Math.floor(4+random()*(map.height-h-8)),w,h};
      if(roads.some(r=>overlaps(box,r))||reserved.some(r=>overlaps(box,r)))continue;
      if(placed.some(p=>overlaps(box,{x:p.x+3,y:p.y+3,w:p.w-6,h:p.h-6})))continue;
      placed.push({...box,name});count++;
    }}
    return placed.sort((a,b)=>a.y+a.h-b.y-b.h);
  }
  function makeBackground(level,images,displayScale=1){
    const {width,height}=level.mapConfig,c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#718b3d';ctx.fillRect(0,0,width,height);
    const textureDensity=width*height/(640*384*displayScale*displayScale);
    const random=rng(71923),textures=['grass','grassDirt','meadow','flowerGrass'];
    // Feather irregularly positioned stamps so source tile edges never form a visible grid.
    const makeStamp=(name,inset=0)=>{
      const stamp=document.createElement('canvas');stamp.width=stamp.height=64;const sc=stamp.getContext('2d');sc.imageSmoothingEnabled=false;sc.drawImage(images[name],0,0,64,64);
      if(inset){sc.clearRect(0,0,64,64);sc.drawImage(images[name],inset,inset,images[name].naturalWidth-inset*2,images[name].naturalHeight-inset*2,0,0,64,64);}
      sc.globalCompositeOperation='destination-in';const g=sc.createRadialGradient(32,32,13,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(1,'#fff0');sc.fillStyle=g;sc.fillRect(0,0,64,64);return stamp;
    };
    const stamps=textures.map(name=>makeStamp(name));
    for(let i=0;i<Math.ceil(430*textureDensity);i++){ctx.globalAlpha=.45+random()*.4;ctx.drawImage(stamps[Math.floor(random()*stamps.length)],Math.floor(random()*(width+60*displayScale)-60*displayScale),Math.floor(random()*(height+60*displayScale)-60*displayScale),64*displayScale,64*displayScale);}ctx.globalAlpha=1;
    const road=new Path2D();for(const r of roadRects(level))road.rect(r.x,r.y,r.w,r.h);
    ctx.save();ctx.clip(road);ctx.fillStyle='#b79962';ctx.fillRect(0,0,width,height);
    for(let i=0;i<1600*textureDensity;i++){const x=Math.floor(random()*width),y=Math.floor(random()*height);ctx.fillStyle=['#aa8956','#c3a56e','#caae79','#95784e'][i%4];ctx.globalAlpha=.3+random()*.3;ctx.fillRect(x,y,(1+Math.floor(random()*4))*displayScale,(1+Math.floor(random()*2))*displayScale);}
    ctx.globalAlpha=.38;const dirtStamp=makeStamp('dirt',10);
    for(let i=0;i<350*textureDensity;i++){const size=(24+Math.floor(random()*32))*displayScale;ctx.drawImage(dirtStamp,Math.floor(random()*width),Math.floor(random()*height),size,size);}
    ctx.restore();
    const scenery=placements(level,images,displayScale);
    for(const p of scenery)ctx.drawImage(images[p.name],p.x,p.y,p.w,p.h);
    return {canvas:c,scenery};
  }
  const api={names,roadRects,placements,makeBackground};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Environment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
