(function (root) {
  'use strict';
  const screen=document.getElementById('start-screen');
  const board=document.getElementById('home-artboard');
  const canvas=document.getElementById('forest-scene'),ctx=canvas.getContext('2d');
  const dialog=document.getElementById('settings-dialog');
  const settingsButton=document.getElementById('settings-open');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const settings={speed:1,motion:!reducedMotion.matches};
  try {
    const saved=JSON.parse(localStorage.getItem('td-menu-settings'));
    if(saved?.speed===1||saved?.speed===2)settings.speed=saved.speed;
    if(typeof saved?.motion==='boolean')settings.motion=saved.motion;
  } catch { /* Storage may be unavailable. */ }
  let ready=false,running=true,animation=0;
  canvas.width=870;canvas.height=452;
  function fitScene(){
    if(!running)return;
    const width=screen.clientWidth,height=screen.clientHeight;
    // Cover landscape screens, but keep the entire 680 px central title visible on portrait screens.
    const scale=Math.min(Math.max(width/1739,height/904),width/680);
    board.style.width=`${1739*scale}px`;
  }
  function render(now){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!settings.motion||reducedMotion.matches)return;
    for(let i=0;i<16;i++){
      const x=((i*137+37)%870)+Math.sin(now/3200+i)*5;
      const y=240+((i*73)%200)+Math.cos(now/4100+i)*5;
      // Keep the title and all three wooden buttons clear.
      if(x>280&&x<590)continue;
      ctx.globalAlpha=.12+(Math.sin(now/1600+i*7)+1)*.15;
      ctx.fillStyle='#ffeda1';ctx.fillRect(Math.round(x),Math.round(y),1,1);
    }
    ctx.globalAlpha=1;
  }
  function animate(now){render(now);animation=requestAnimationFrame(animate);}
  function syncAnimation(){
    cancelAnimationFrame(animation);
    if(!ready||!running)return;
    render(0);
    if(settings.motion&&!reducedMotion.matches&&!document.hidden)animation=requestAnimationFrame(animate);
  }
  settingsButton.addEventListener('click',()=>{dialog.showModal();root.ForestSettings.fit(dialog);settingsButton.setAttribute('aria-expanded','true');});
  dialog.addEventListener('click',event=>{
    const bounds=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))dialog.close();
  });
  dialog.addEventListener('close',()=>{settingsButton.setAttribute('aria-expanded','false');if(!screen.hidden)settingsButton.focus({preventScroll:true});});
  reducedMotion.addEventListener('change',syncAnimation);
  document.addEventListener('visibilitychange',syncAnimation);
  new ResizeObserver(fitScene).observe(screen);
  root.StartScreen={settings,
    ready(){ready=true;fitScene();syncAnimation();},
    stop(){running=false;cancelAnimationFrame(animation);},
    resume(){running=true;fitScene();syncAnimation();}
  };
  fitScene();
})(window);
