(function (root) {
  'use strict';
  const screen = document.getElementById('level-screen');
  const map = document.getElementById('world-map');
  const canvas = document.getElementById('world-scenery');
  const ctx = canvas.getContext('2d');
  const nodes = [...document.querySelectorAll('.level-node')];
  const stages = [
    { name: '林間入口', description: '陽光灑落的小徑，森林旅程的起點。' },
    { name: '花徑哨站', description: '穿過盛開的花叢，抵達林間的寧靜哨站。' },
    { name: '古木岔路', description: '古老橡樹盤根交錯，小徑在此分岔。' },
    { name: '暮色防線', description: '暮色籠罩最後的哨塔，前方就是森林禁地。' },
    { name: '荊棘王座', description: '紅旗在古堡上飄揚，森林深處的首領正等待著。' }
  ];
  let images = null, selected = 0;
  function selectStage(index, focus = false) {
    selected = index;
    nodes.forEach((node, i) => node.setAttribute('aria-pressed', String(i === index)));
    document.getElementById('stage-index').textContent = String(index + 1).padStart(2, '0');
    document.getElementById('stage-kind').textContent = index === 4 ? 'BOSS · 第 5 關' : `森林旅程 · 第 ${index + 1} 關`;
    document.getElementById('stage-title').textContent = stages[index].name;
    document.getElementById('stage-description').textContent = stages[index].description;
    document.querySelector('.world-bottom').classList.toggle('is-boss', index === 4);
    if (focus) nodes[index].focus({ preventScroll: true });
  }
  function draw() {
    if (screen.hidden || !images) return;
    const mobile = map.clientWidth <= 600;
    const points = mobile ? [[.25,.86],[.69,.72],[.29,.53],[.70,.37],[.34,.18]] : [[.13,.66],[.31,.42],[.49,.66],[.67,.43],[.85,.34]];
    // Reserve room above the fortress for its banner and keyboard selection marker.
    points[4][1] = Math.max(points[4][1], (mobile ? 125 : map.clientWidth >= 1200 ? 204 : 178) / map.clientHeight);
    nodes.forEach((node, i) => { node.style.left = `${points[i][0] * 100}%`; node.style.top = `${points[i][1] * 100}%`; });
    // Both the scenery and connecting trail share the buttons' normalized coordinates.
    const w = canvas.width = Math.ceil(map.clientWidth / 2);
    const h = canvas.height = Math.ceil(map.clientHeight / 2);
    ctx.imageSmoothingEnabled = false;
    let seed = 7561;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const anchors = points.map(([x,y]) => ({ x: x * w, y: y * h }));
    const ground = ctx.createLinearGradient(0,0,w,h);
    ground.addColorStop(0,'#51683b'); ground.addColorStop(.5,'#6c7d43'); ground.addColorStop(1,'#435c36');
    ctx.fillStyle = ground; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < w*h/14; i++) {
      ctx.fillStyle = ['#a6af6233','#2a492b44','#b9bc7033','#80974c44'][i%4];
      ctx.fillRect(Math.floor(random()*w),Math.floor(random()*h),1+Math.floor(random()*3),1);
    }
    const boss = anchors[4];
    const shadow = ctx.createRadialGradient(boss.x,boss.y,10,boss.x,boss.y,mobile?90:120);
    shadow.addColorStop(0,'#28352bd9'); shadow.addColorStop(.55,'#34403199'); shadow.addColorStop(1,'#34403100');
    ctx.fillStyle = shadow; ctx.fillRect(0,0,w,h);
    // Smooth route sampled into pixels; a dotted center makes the travel order clear.
    const route = [];
    for (let i=0;i<anchors.length-1;i++) {
      const a=anchors[i],b=anchors[i+1];
      for(let step=0;step<50;step++) {
        const t=step/49,s=t*t*(3-2*t);
        route.push({x:mobile?a.x+(b.x-a.x)*s:a.x+(b.x-a.x)*t,y:mobile?a.y+(b.y-a.y)*t:a.y+(b.y-a.y)*s});
      }
    }
    for (const [size,color] of [[15,'#344a2d88'],[12,'#ac9158'],[8,'#c0a56a']]) {
      ctx.fillStyle=color;
      for(const p of route)ctx.fillRect(Math.round(p.x-size/2),Math.round(p.y-size/2),size,size);
    }
    let distance=0;
    ctx.fillStyle='#7e6b4166';
    for(let i=1;i<route.length;i++) {
      distance+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);
      if(distance>9){ctx.fillRect(Math.round(route[i].x)-1,Math.round(route[i].y)-1,2,2);distance=0;}
    }
    function sprite(name,x,y,scale=1) {
      const image=images[name]; if(!image)return;
      const sw=Math.round(image.naturalWidth*scale),sh=Math.round(image.naturalHeight*scale);
      ctx.drawImage(image,Math.round(x-sw/2),Math.round(y-sh),sw,sh);
    }
    const scenery=[];
    for(let i=0;i<650;i++) {
      const x=random()*w,y=random()*(h+30),isTree=i<140;
      const name=(isTree?['oak','roundTree','birch','pine','oldOak']:['fern','tuft','flowers','mossRock','bush','whiteFlowers','fallenLog','pinkFlowers'])[Math.floor(random()*(isTree?5:8))];
      const scale=isTree?(mobile?.6:.8)+random()*.35:.6+random()*.3;
      const sw=images[name].naturalWidth*scale,sh=images[name].naturalHeight*scale;
      // Keep entire labels, hit targets and silhouettes unobstructed by large trees.
      if(anchors.some((p,index)=>Math.abs(x-p.x)<sw/2+(index===4?43:32)&&y>p.y-(index===4?82:58)&&y-sh<p.y+31))continue;
      if(route.some(p=>Math.abs(x-p.x)<sw/2+10&&y>p.y-8&&y-sh<p.y+8))continue;
      if(scenery.some(p=>Math.abs(x-p.x)<(sw+p.sw)*.33&&Math.abs(y-p.y)<(sh+p.sh)*.26))continue;
      scenery.push({name,x,y,scale,sw,sh});
    }
    scenery.sort((a,b)=>a.y-b.y).forEach(p=>sprite(p.name,p.x,p.y,p.scale));
    // Small clusters give the early stops a softer character and the boss grove rocky edges.
    sprite('whiteFlowers',anchors[0].x-31,anchors[0].y+12,.65);
    sprite('pinkFlowers',anchors[1].x+31,anchors[1].y+8,.7);
    sprite('mossRock',boss.x+43,boss.y+8,.7);
    sprite('fern',boss.x-42,boss.y+11,.65);
    const edge=ctx.createLinearGradient(0,0,0,h);
    edge.addColorStop(0,'#3d5637');edge.addColorStop(.10,'#3d563700');edge.addColorStop(.85,'#20382c00');edge.addColorStop(1,'#20382c88');
    ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);
  }
  nodes.forEach((node,index)=>node.addEventListener('click',()=>selectStage(index)));
  document.getElementById('world-levels').addEventListener('keydown',event=>{
    const current=nodes.indexOf(document.activeElement);
    if(current<0)return;
    let next=current;
    if(['ArrowRight','ArrowUp'].includes(event.key))next=Math.min(4,current+1);
    else if(['ArrowLeft','ArrowDown'].includes(event.key))next=Math.max(0,current-1);
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=4;
    else return;
    event.preventDefault();selectStage(next,true);
  });
  function back() {
    screen.hidden=true;
    document.getElementById('start-screen').hidden=false;
    document.title='幾何防線 · 森林守衛';
    root.StartScreen.resume();
    document.getElementById('start').focus({preventScroll:true});
  }
  document.getElementById('world-back').addEventListener('click',back);
  screen.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();back();}});
  new ResizeObserver(draw).observe(map);
  root.LevelSelect={
    ready(loadedImages){images=loadedImages;},
    show(){
      root.StartScreen.stop();document.getElementById('start-screen').hidden=true;screen.hidden=false;
      screen.scrollTop=0;document.title='幾何防線 · 翡翠森林';draw();selectStage(selected);
      document.getElementById('world-back').focus({preventScroll:true});
    }
  };
})(window);
