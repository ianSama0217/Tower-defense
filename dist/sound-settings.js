(() => {
  'use strict';
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('td-sound-settings'))||{};}catch{}
  const sound=window.gameSound=new SoundManager({volume:saved.volume,muted:saved.muted===true});
  let musicVolume=Number.isFinite(saved.musicVolume)?Math.max(0,Math.min(1,saved.musicVolume)):.6;
  // Music assets can opt into the independent music channel; no soundtrack is bundled yet.
  window.gameMusic={get volume(){return musicVolume;},setVolume(value){
    if(!Number.isFinite(value))return;
    musicVolume=Math.max(0,Math.min(1,value));
    document.querySelectorAll('[data-background-music]').forEach(media=>{media.volume=musicVolume;});
  }};
  gameMusic.setVolume(musicVolume);
  const unlock=()=>{void sound.unlock();};
  document.addEventListener('pointerdown',unlock,{capture:true});
  document.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('click',unlock,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.stopAll();});
  window.addEventListener('pagehide',()=>sound.stopAll());
  function save(){try{localStorage.setItem('td-sound-settings',JSON.stringify({volume:sound.volume,muted:sound.muted,musicVolume}));}catch{}}
  const volumeInputs=[...document.querySelectorAll('[data-sound-volume]')];
  const musicInputs=[...document.querySelectorAll('[data-music-volume]')];
  const muteInputs=[...document.querySelectorAll('[data-sound-muted]')];
  function syncControls(){
    volumeInputs.forEach(input=>{const value=sound.muted&&input.closest('.forest-settings')?0:Math.round(sound.volume*100);input.value=String(value);input.style.setProperty('--fill',`${sound.muted?0:value}%`);input.setAttribute('aria-valuetext',`${value}%`);});
    musicInputs.forEach(input=>{const value=Math.round(musicVolume*100);input.value=String(value);input.style.setProperty('--fill',`${value}%`);input.setAttribute('aria-valuetext',`${value}%`);});
    document.querySelectorAll('[data-volume-output]').forEach(output=>{output.textContent=`${Math.round((output.dataset.volumeOutput==='music'?musicVolume:sound.muted?0:sound.volume)*100)}%`;});
    muteInputs.forEach(input=>{input.checked=sound.muted;});
  }
  volumeInputs.forEach(input=>{
    input.value=String(Math.round(sound.volume*100));
    input.addEventListener('input',()=>{sound.setMuted(false);sound.setVolume(Number(input.value)/100);syncControls();save();});
  });
  musicInputs.forEach(input=>input.addEventListener('input',()=>{gameMusic.setVolume(Number(input.value)/100);syncControls();save();}));
  muteInputs.forEach(input=>{
    input.checked=sound.muted;
    input.addEventListener('change',()=>{sound.setMuted(input.checked);syncControls();save();});
  });
  syncControls();
})();
