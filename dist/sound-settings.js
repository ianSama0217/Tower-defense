(() => {
  'use strict';
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('td-sound-settings'))||{};}catch{}
  const sound=window.gameSound=new SoundManager({volume:saved.volume,muted:saved.muted===true});
  const unlock=()=>{void sound.unlock();};
  document.addEventListener('pointerdown',unlock,{capture:true});
  document.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('click',unlock,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.stopAll();});
  window.addEventListener('pagehide',()=>sound.stopAll());
  function save(){try{localStorage.setItem('td-sound-settings',JSON.stringify({volume:sound.volume,muted:sound.muted}));}catch{}}
  const volumeInputs=[...document.querySelectorAll('[data-sound-volume]')];
  const muteInputs=[...document.querySelectorAll('[data-sound-muted]')];
  function syncControls(){
    volumeInputs.forEach(input=>{input.value=String(Math.round(sound.volume*100));});
    muteInputs.forEach(input=>{input.checked=sound.muted;});
  }
  volumeInputs.forEach(input=>{
    input.value=String(Math.round(sound.volume*100));
    input.addEventListener('input',()=>{sound.setVolume(Number(input.value)/100);syncControls();save();});
  });
  muteInputs.forEach(input=>{
    input.checked=sound.muted;
    input.addEventListener('change',()=>{sound.setMuted(input.checked);syncControls();save();});
  });
})();
