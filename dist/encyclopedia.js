(function(root){
  'use strict';
  const $=id=>document.getElementById(id),dialog=$('encyclopedia-dialog'),opener=$('encyclopedia-open');
  const tabs=[...dialog.querySelectorAll('[role=tab]')];
  let category='enemies',selected=0,level=1,data;
  function storage(){try{return root.localStorage;}catch{return null;}}
  function portrait(entry){
    const art=document.createElement('span');art.className='encyclopedia-sprite';art.setAttribute('aria-hidden','true');
    art.style.backgroundImage=`url("${entry.image}")`;
    if(entry.frames){art.classList.add('is-sheet');art.style.setProperty('--frames',entry.frames);}
    if(entry.id==='bomb'){
      const operator=document.createElement('span'),size=[64,80,96][entry.level-1],platform=[24,33,41][entry.level-1];
      operator.className='encyclopedia-operator';operator.style.width=`${24/size*100}%`;operator.style.height=`${24/size*100}%`;operator.style.top=`${(platform-22)/size*100}%`;art.append(operator);
    }
    if(!entry.known)art.classList.add('is-unknown');
    return art;
  }
  function render(){
    const entries=data[category];selected=Math.min(selected,entries.length-1);
    tabs.forEach(tab=>{const active=tab.dataset.category===category;tab.setAttribute('aria-selected',active);tab.tabIndex=active?0:-1;});
    $('encyclopedia-content').setAttribute('aria-labelledby',`encyclopedia-tab-${category}`);
    $('encyclopedia-list').replaceChildren(...entries.map((entry,index)=>{
      const button=document.createElement('button'),label=document.createElement('span');
      button.type='button';button.className='encyclopedia-entry';button.setAttribute('aria-current',String(index===selected));
      label.textContent=entry.known?entry.name:'???';button.append(portrait(entry.specs?EncyclopediaData.towerLevel(entry,1):entry),label);
      button.addEventListener('click',()=>{selected=index;level=1;render();$('encyclopedia-list').children[index].focus({preventScroll:true});});return button;
    }));
    const base=entries[selected],entry=base.specs?EncyclopediaData.towerLevel(base,level):base;
    $('encyclopedia-name').textContent=entry.known?entry.name:'???';
    $('encyclopedia-portrait').replaceChildren(portrait(entry));
    $('encyclopedia-description').textContent=entry.known?entry.description:'尚未發現。繼續探索森林，解開這一頁的秘密。';
    $('encyclopedia-levels').hidden=!base.specs||!base.known;
    $('encyclopedia-levels').replaceChildren();
    if(base.specs&&base.known)for(let i=1;i<=3;i++){
      const button=document.createElement('button');button.textContent=`Lv.${i}`;button.setAttribute('aria-pressed',String(level===i));
      button.addEventListener('click',()=>{level=i;render();$('encyclopedia-levels').children[i-1].focus({preventScroll:true});});$('encyclopedia-levels').append(button);
    }
    $('encyclopedia-stats').replaceChildren();
    for(const [label,value] of entry.known?entry.stats:[['生命值','???'],['攻擊力','???']]){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('encyclopedia-stats').append(dt,dd);
    }
    $('encyclopedia-traits').replaceChildren(...(entry.known?entry.traits:['尚未發現']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    $('encyclopedia-prev').disabled=selected===0;$('encyclopedia-next').disabled=selected===entries.length-1;
  }
  function changeCategory(next){category=next;selected=0;level=1;render();}
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>changeCategory(tab.dataset.category));
    tab.addEventListener('keydown',event=>{
      let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
      event.preventDefault();changeCategory(tabs[next].dataset.category);tabs[next].focus();
    });
  });
  $('encyclopedia-prev').addEventListener('click',()=>{selected--;level=1;render();});
  $('encyclopedia-next').addEventListener('click',()=>{selected++;level=1;render();});
  opener.addEventListener('click',()=>{data=EncyclopediaData.catalog(storage());render();dialog.showModal();opener.setAttribute('aria-expanded','true');});
  $('encyclopedia-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  root.addEventListener('storage',()=>{if(dialog.open){data=EncyclopediaData.catalog(storage());render();}});
})(window);
