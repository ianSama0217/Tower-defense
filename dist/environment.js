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
    const grassUnderlay=document.createElement('canvas');grassUnderlay.width=width;grassUnderlay.height=height;grassUnderlay.getContext('2d').drawImage(c,0,0);
    // Pixel-stepped shoulders vary only the artwork; movement still uses the original routes.
    const road=new Path2D(),shoulders=[],rects=roadRects(level),edgeRandom=rng(86219);
    for(const r of rects){
      const horizontal=r.w>=r.h,start=horizontal?r.x:r.y,end=start+(horizontal?r.w:r.h);
      const low=horizontal?r.y:r.x,high=low+(horizontal?r.h:r.w),sides=[];
      for(const [edge,sign] of [[low,-1],[high,1]]){
        const points=[];let previous=edge;
        for(let u=start;u<end;){
          const next=Math.min(end,u+(3+Math.floor(edgeRandom()*5))*displayScale);
          const v=edge+(Math.floor(edgeRandom()*5)-2)*displayScale;
          points.push([u,previous],[u,v],[next,v]);previous=v;
          const mid=(u+next)/2,x=horizontal?mid:v,y=horizontal?v:mid;
          // Do not decorate seams within overlapping road sections or their intersections.
          const outerX=x+(horizontal?0:sign*8*displayScale),outerY=y+(horizontal?sign*8*displayScale:0);
          if(!rects.some(other=>other!==r&&outerX>other.x&&outerX<other.x+other.w&&outerY>other.y&&outerY<other.y+other.h))shoulders.push({x,y,horizontal,sign});
          u=next;
        }
        sides.push(points);
      }
      const outline=[...sides[0],...sides[1].reverse()];
      if(!horizontal)outline.reverse(); // Keep the same winding so crossing road sections form a union.
      outline.forEach(([u,v],i)=>{const x=horizontal?u:v,y=horizontal?v:u;i?road.lineTo(x,y):road.moveTo(x,y);});road.closePath();
    }
    ctx.save();ctx.clip(road);ctx.fillStyle='#b79962';ctx.fillRect(0,0,width,height);
    for(let i=0;i<1600*textureDensity;i++){const x=Math.floor(random()*width),y=Math.floor(random()*height);ctx.fillStyle=['#aa8956','#c3a56e','#caae79','#95784e'][i%4];ctx.globalAlpha=.3+random()*.3;ctx.fillRect(x,y,(1+Math.floor(random()*4))*displayScale,(1+Math.floor(random()*2))*displayScale);}
    ctx.globalAlpha=.38;const dirtStamp=makeStamp('dirt',10);
    for(let i=0;i<350*textureDensity;i++){const size=(24+Math.floor(random()*32))*displayScale;ctx.drawImage(dirtStamp,Math.floor(random()*width),Math.floor(random()*height),size,size);}
    ctx.restore();
    // Sparse small plants and pebbles bridge grass and dirt without covering the walking lane.
    const detailRandom=rng(64013),padClear=level.slots.map(s=>({x:s.x-24*displayScale,y:s.y-32*displayScale,w:48*displayScale,h:48*displayScale}));
    for(const edge of shoulders){
      // Restore tiny grass-texture tongues along the shoulder, breaking up its hard silhouette.
      for(let j=0;j<3;j++){
        const along=(detailRandom()-.5)*10*displayScale,depth=(detailRandom()*4-1)*displayScale;
        const x=Math.round(edge.x+(edge.horizontal?along:-edge.sign*depth)),y=Math.round(edge.y+(edge.horizontal?-edge.sign*depth:along));
        const w=(1+Math.floor(detailRandom()*3))*displayScale,h=(1+Math.floor(detailRandom()*2))*displayScale;
        if(x>=0&&y>=0&&x+w<=width&&y+h<=height)ctx.drawImage(grassUnderlay,x,y,w,h,x,y,w,h);
      }
      if(detailRandom()>.3)continue;
      const isStone=detailRandom()<.25,name=isStone?'pebble':detailRandom()<.2?'fern':'tuft';
      const scale=(isStone?.22+detailRandom()*.14:.38+detailRandom()*.27)*displayScale,img=images[name];
      const w=Math.round(img.naturalWidth*scale),h=Math.round(img.naturalHeight*scale);
      const inward=(isStone?-1:1)*(1+detailRandom()*3)*displayScale;
      const x=Math.round(edge.x-w/2+(edge.horizontal?0:edge.sign*inward)),y=Math.round(edge.y-h*.55+(edge.horizontal?edge.sign*inward:0));
      if(padClear.some(r=>overlaps({x,y,w,h},r)))continue;
      // Loose soil flecks and tiny gravel soften the remaining straight pixels between clumps.
      ctx.fillStyle=isStone?'#877b59':'#819346';ctx.globalAlpha=.65;
      for(let j=0;j<3;j++){const dx=Math.round((detailRandom()-.5)*w*1.6),dy=Math.round((detailRandom()-.5)*h);ctx.fillRect(Math.round(edge.x+dx),Math.round(edge.y+dy),displayScale*(1+j%2),displayScale);}
      ctx.globalAlpha=1;ctx.drawImage(img,x,y,w,h);
    }
    const scenery=placements(level,images,displayScale);
    for(const p of scenery)ctx.drawImage(images[p.name],p.x,p.y,p.w,p.h);
    return {canvas:c,scenery};
  }
  const api={names,roadRects,placements,makeBackground};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Environment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
