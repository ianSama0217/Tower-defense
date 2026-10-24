(() => {
  'use strict';
  const art=document.getElementById('home-art');
  const restart=document.getElementById('home-restart'),dialog=document.getElementById('restart-dialog'),error=document.getElementById('restart-error');
  function fitRestart(){if(dialog.open)ForestSettings.fit(dialog);}
  restart.addEventListener('click',()=>{error.hidden=true;dialog.showModal();restart.setAttribute('aria-expanded','true');fitRestart();});
  for(const id of ['restart-close','restart-cancel'])document.getElementById(id).addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{restart.setAttribute('aria-expanded','false');restart.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  document.getElementById('restart-confirm').addEventListener('click',()=>{
    let storage=null;try{storage=localStorage;}catch{}
    if(!LevelProgress.reset(storage)){error.textContent='無法重置紀錄，請確認瀏覽器允許儲存資料後再試。';error.hidden=false;fitRestart();return;}
    dialog.close();location.href='index.html#levels';
  });
  window.addEventListener('resize',fitRestart);window.visualViewport?.addEventListener('resize',fitRestart);
  document.getElementById('start').addEventListener('click',()=>LevelSelect.show());
  art.decode().then(()=>{
    StartScreen.ready();LevelSelect.ready();
    document.getElementById('start').disabled=false;
    restart.disabled=false;
    document.getElementById('menu-status').textContent='';
    if(location.hash==='#levels')LevelSelect.show();
  }).catch(error=>{
    document.getElementById('menu-status').textContent='素材載入失敗，請重新整理';
    console.error(error);
  });
})();
