(function(root){
  'use strict';
  const $=id=>document.getElementById(id),screen=$('level-screen'),dialog=$('stage-dialog');
  const nodes=[...document.querySelectorAll('.level-node')],stages=LevelProgress.stages;
  const enemyNames={1:'哥布林',2:'獸人',3:'獨眼巨人',4:'炸彈哥布林',5:'史萊姆',6:'哥布林弓箭手'};
  const settings=$('world-settings'),settingsButton=$('world-settings-open');
  let selected=0,stars=[];
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
      const surface=document.querySelector('.map-surface');
      surface.style.setProperty('--node-scale',Math.min(1.4,surface.clientWidth/1200)*2/3);
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
      node.setAttribute('aria-label',`第 ${index+1} 關，${stages[index].name}，${stars[index]} 顆星，${open?'已解鎖':'尚未解鎖'}`);
    });
  }
  function selectStage(index){
    selected=index;refresh();
    const stage=stages[index],open=LevelProgress.unlocked(stars,index);
    nodes.forEach((node,i)=>node.setAttribute('aria-expanded',String(i===index)));
    $('stage-title').textContent=`第 ${index+1} 關`;
    $('stage-name').textContent=stage.name;
    $('stage-preview').style.backgroundPosition=['0% 75%','10% 20%','50% 50%','75% 70%','100% 20%'][index];
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
    $('stage-stars').setAttribute('aria-label',`最佳紀錄 ${stars[index]} / 3 顆星`);
    $('stage-stars').querySelectorAll('span').forEach((star,i)=>star.classList.toggle('earned',i<stars[index]));
    $('stage-clear-status').textContent=stars[index]?'已通關':!open?'尚未解鎖':'尚未通關';
    $('stage-clear-status').classList.toggle('is-cleared',stars[index]>0);
    $('stage-enter').disabled=!open||!stage.href;
    $('stage-enter-label').textContent=!open?'尚未解鎖':!stage.href?'關卡準備中':stage.preview?'預覽關卡':'開始挑戰';
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
  $('world-levels').addEventListener('keydown',event=>{
    const current=nodes.indexOf(document.activeElement);if(current<0)return;
    let next=current;
    if(['ArrowRight','ArrowUp'].includes(event.key))next=Math.min(4,current+1);
    else if(['ArrowLeft','ArrowDown'].includes(event.key))next=Math.max(0,current-1);
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=4;
    else return;
    event.preventDefault();nodes[next].focus({preventScroll:true});
  });
  $('world-back').addEventListener('click',()=>{
    settings.close();screen.hidden=true;$('start-screen').hidden=false;document.title='幾何防線 · 森林守衛';
    root.StartScreen.resume();$('start').focus({preventScroll:true});
  });
  screen.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open&&!settings.open){event.preventDefault();openSettings();}});
  root.addEventListener('storage',()=>{if(!screen.hidden){refresh();if(dialog.open)selectStage(selected);}});
  root.addEventListener('pageshow',refresh);
  root.LevelSelect={
    ready(){},
    show(){
      root.StartScreen.stop();$('start-screen').hidden=true;screen.hidden=false;
      document.title='幾何防線 · 翡翠森林';refresh();
      const current=nodes.find((node,i)=>LevelProgress.unlocked(stars,i)&&stars[i]===0)||nodes[0];
      fitLayout();current.focus({preventScroll:true});
    }
  };
})(window);
