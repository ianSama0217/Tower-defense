(() => {
  'use strict';
  const images={};
  document.getElementById('start').addEventListener('click',()=>LevelSelect.show());
  Promise.all(Environment.names.map(name=>new Promise((resolve,reject)=>{
    const image=new Image();images[name]=image;
    image.onload=resolve;image.onerror=()=>reject(new Error(`無法載入森林素材：${name}`));
    image.src=`assets/environment/${name}.png`;
  }))).then(()=>{
    StartScreen.ready(images);LevelSelect.ready(images);
    document.getElementById('start').disabled=false;
    document.getElementById('menu-status').textContent='選擇木牌，踏入森林';
    if(location.hash==='#levels')LevelSelect.show();
  }).catch(error=>{
    document.getElementById('menu-status').textContent='素材載入失敗，請重新整理';
    console.error(error);
  });
})();
