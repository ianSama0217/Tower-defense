(() => {
  'use strict';
  const art=document.getElementById('home-art');
  document.getElementById('start').addEventListener('click',()=>LevelSelect.show());
  art.decode().then(()=>{
    StartScreen.ready();LevelSelect.ready();
    document.getElementById('start').disabled=false;
    document.getElementById('menu-status').textContent='';
    if(location.hash==='#levels')LevelSelect.show();
  }).catch(error=>{
    document.getElementById('menu-status').textContent='素材載入失敗，請重新整理';
    console.error(error);
  });
})();
