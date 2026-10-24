(function(root){
  'use strict';
  const $=id=>document.getElementById(id),screen=$('level-screen'),dialog=$('stage-dialog');
  // These map stops are previews until their battle scenarios are added.
  const caveStages=[
    {name:'洞窟入口',position:[11.6,34]},
    {name:'骸骨營地',position:[31.6,36]},
    {name:'深淵吊橋',position:[47.8,72]},
    {name:'幽火哨站',position:[67.3,49]},
    {name:'洞窟王座',position:[87.5,46]}
  ].map(stage=>({...stage,enemies:[],href:null}));
  const stages=[...LevelProgress.stages,...caveStages];
  caveStages.forEach((stage,i)=>{
    const node=document.createElement('button');
    node.className='level-node';node.dataset.stage=String(i+6);
    node.style.left=stage.position[0]+'%';node.style.top=stage.position[1]+'%';
    node.setAttribute('aria-haspopup','dialog');node.setAttribute('aria-controls','stage-dialog');node.setAttribute('aria-expanded','false');
    node.innerHTML=`<span class="node-art" aria-hidden="true"><img class="node-pad" src="assets/ui/level-markers/pedestal.png" alt=""><img class="node-flag" src="assets/ui/level-markers/banner-blank.png" alt=""><span class="node-number">${i+6}</span><img class="node-lock" src="assets/ui/level-markers/lock-chains.png" alt="" hidden></span><span class="node-stars" aria-hidden="true"><span></span><span></span><span></span></span>`;
    $('cave-levels').append(node);
  });
  const nodes=[...document.querySelectorAll('.level-node')],pages=[...document.querySelectorAll('.world-page')];
  const pageNames=['翡翠森林','幽暗洞窟'],track=$('map-track');
  const enemyNames={1:'哥布林',2:'獸人',3:'獨眼巨人',4:'炸彈哥布林',5:'史萊姆',6:'哥布林弓箭手',7:'哥布林隊長'};
  const settings=$('world-settings'),settingsButton=$('world-settings-open');
  let selected=0,stars=[],pageIndex=0,switchTimer=null;
  function pageControls(){
    $('map-prev').disabled=pageIndex===0||switchTimer!==null;
    $('map-next').disabled=pageIndex===pages.length-1||switchTimer!==null;
  }
  function changePage(index,{animate=true,focus=true}={}){
    if(index<0||index>=pages.length||switchTimer!==null)return;
    const moving=index!==pageIndex&&animate&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pageIndex=index;
    track.classList.toggle('no-transition',!moving);
    track.style.transform=`translateX(${-index*100}%)`;
    pages.forEach((page,i)=>{page.inert=i!==index;page.setAttribute('aria-hidden',String(i!==index));});
    screen.dataset.mapPage=String(index);
    $('world-title').textContent=pageNames[index]+'選關地圖';
    $('map-page-label').textContent=pageNames[index];
    document.title='林境守衛 · '+pageNames[index];
    const finish=()=>{switchTimer=null;pageControls();if(focus&&!screen.hidden)nodes[index*5].focus({preventScroll:true});};
    if(moving)switchTimer=root.setTimeout(finish,580);else finish();
    pageControls();
  }
  $('map-prev').addEventListener('click',()=>changePage(pageIndex-1));
  $('map-next').addEventListener('click',()=>changePage(pageIndex+1));
  function fitDialog(modal){
    if(!modal.open)return;
    if(modal===settings){ForestSettings.fit(modal);return;}
    const width=root.visualViewport?.width||root.innerWidth;
    const height=root.visualViewport?.height||root.innerHeight;
    modal.style.zoom='1';
    modal.style.width=`${Math.min(modal===dialog?900:370,width-32)}px`;
    modal.style.zoom=String(Math.min(1,(height-32)/modal.offsetHeight));
  }
  function fitLayout(){
    if(!screen.hidden){
      document.querySelectorAll('.map-surface').forEach(surface=>surface.style.setProperty('--node-scale',Math.min(1.4,surface.clientWidth/1200)*2/3));
    }
    fitDialog(dialog);fitDialog(settings);
  }
  new ResizeObserver(fitLayout).observe($('world-map'));
  root.addEventListener('resize',fitLayout);
  root.visualViewport?.addEventListener('resize',fitLayout);
  function openSettings(){settingsButton.setAttribute('aria-expanded','true');settings.showModal();fitDialog(settings);}
  settingsButton.addEventListener('click',openSettings);
  $('world-settings-close').addEventListener('click',()=>settings.close());
  $('world-resume').addEventListener('click',()=>settings.close());
  settings.addEventListener('close',()=>{settingsButton.setAttribute('aria-expanded','false');if(!screen.hidden)settingsButton.focus({preventScroll:true});});
  settings.addEventListener('click',event=>{if(event.target===settings){const rect=settings.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)settings.close();}});
  function storage(){try{return localStorage;}catch{return null;}}
  function refresh(){
    stars=LevelProgress.read(storage());
    nodes.forEach((node,index)=>{
      const open=LevelProgress.unlocked(stars,index);
      node.classList.toggle('is-locked',!open);
      node.classList.toggle('is-current',open&&stars[index]===0);
      node.querySelector('.node-lock').hidden=open;
      node.querySelectorAll('.node-stars span').forEach((star,i)=>star.classList.toggle('earned',i<stars[index]));
      node.setAttribute('aria-label',`第 ${index+1} 關，${stages[index].name}，${stars[index]||0} 顆星，${!stages[index].href?'關卡準備中':open?'已解鎖':'尚未解鎖'}`);
    });
  }
  function selectStage(index){
    selected=index;refresh();
    const stage=stages[index],open=LevelProgress.unlocked(stars,index);
    nodes.forEach((node,i)=>node.setAttribute('aria-expanded',String(i===index)));
    $('stage-title').textContent=`第 ${index+1} 關`;
    $('stage-name').textContent=stage.name;
    $('stage-preview').style.backgroundImage=`url('assets/ui/${index>=5?'cave':'forest'}-world-map.png')`;
    $('stage-preview').style.backgroundPosition=index>=5?stage.position.map(value=>value+'%').join(' '):['0% 75%','10% 20%','50% 50%','75% 70%','100% 20%'][index];
    $('stage-preview').setAttribute('aria-label',`${stage.name}區域示意圖`);
    const encountered=new Set(LevelProgress.readEncountered(storage()));
    $('stage-enemies').replaceChildren();
    $('stage-enemies').classList.toggle('three-enemies',stage.enemies.length===3);
    stage.enemies.forEach(id=>{
      const spec=EnemySprites.specs[id],item=document.createElement('li'),sprite=document.createElement('span'),label=document.createElement('span');
      const known=encountered.has(id);
      item.className=known?'enemy-card':'enemy-card is-undiscovered';
      sprite.className='enemy-portrait';sprite.setAttribute('aria-hidden','true');
      sprite.style.backgroundImage=`url("assets/enemies/${spec.file}")`;
      sprite.style.setProperty('--enemy-frames',spec.frames||20);
      label.className='enemy-name';label.textContent=known?enemyNames[id]:'未遭遇';item.append(sprite,label);$('stage-enemies').append(item);
    });
    $('enemies-pending').hidden=stage.enemies.length>0;
    $('stage-stars').setAttribute('aria-label',`最佳紀錄 ${stars[index]||0} / 3 顆星`);
    $('stage-stars').querySelectorAll('span').forEach((star,i)=>star.classList.toggle('earned',i<stars[index]));
    $('stage-clear-status').textContent=!stage.href?'關卡準備中':stars[index]?'已通關':!open?'尚未解鎖':'尚未通關';
    $('stage-clear-status').classList.toggle('is-cleared',stars[index]>0);
    $('stage-enter').disabled=!open||!stage.href;
    $('stage-enter-label').textContent=!stage.href?'關卡準備中':!open?'尚未解鎖':stage.preview?'預覽關卡':'開始挑戰';
    if(!dialog.open)dialog.showModal();
    fitDialog(dialog);
  }
  nodes.forEach((node,index)=>node.addEventListener('click',()=>selectStage(index)));
  $('stage-enter').addEventListener('click',()=>{
    refresh();const stage=stages[selected];
    if(LevelProgress.unlocked(stars,selected)&&stage.href)location.href=stage.href;
    else selectStage(selected);
  });
  $('stage-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{nodes.forEach(node=>node.setAttribute('aria-expanded','false'));nodes[selected].focus({preventScroll:true});});
  track.addEventListener('keydown',event=>{
    const current=nodes.indexOf(document.activeElement);if(current<0)return;
    let next=current;
    const first=pageIndex*5,last=first+4;
    if(event.key==='PageDown'||event.key==='PageUp'){
      event.preventDefault();changePage(pageIndex+(event.key==='PageDown'?1:-1));return;
    }
    if(['ArrowRight','ArrowUp'].includes(event.key))next=Math.min(last,current+1);
    else if(['ArrowLeft','ArrowDown'].includes(event.key))next=Math.max(first,current-1);
    else if(event.key==='Home')next=first;
    else if(event.key==='End')next=last;
    else return;
    event.preventDefault();nodes[next].focus({preventScroll:true});
  });
  $('world-back').addEventListener('click',()=>{
    settings.close();screen.hidden=true;$('start-screen').hidden=false;document.title='林境守衛';
    root.StartScreen.resume();$('start').focus({preventScroll:true});
  });
  screen.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open&&!settings.open&&!$('encyclopedia-dialog').open){event.preventDefault();openSettings();}});
  root.addEventListener('storage',()=>{if(!screen.hidden){refresh();if(dialog.open)selectStage(selected);}});
  root.addEventListener('pageshow',refresh);
  root.LevelSelect={
    ready(){},
    show(){
      root.StartScreen.stop();$('start-screen').hidden=true;screen.hidden=false;
      if(switchTimer!==null){root.clearTimeout(switchTimer);switchTimer=null;}
      refresh();
      const current=nodes.find((node,i)=>LevelProgress.unlocked(stars,i)&&stars[i]===0)||nodes[0];
      changePage(Math.floor(nodes.indexOf(current)/5),{animate:false,focus:false});
      fitLayout();current.focus({preventScroll:true});
    }
  };
})(window);
