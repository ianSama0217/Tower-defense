(function(root){
  'use strict';
  const KEY='td-level-stars', ENCOUNTER_KEY='td-encountered-enemies', COUNT=5;
  const stages=[
    {name:'林間入口',enemies:[5,1],href:'tutorial.html'},
    {name:'林間小徑',enemies:[1,6],href:'level-two.html'},
    {name:'深林',enemies:[1,6,2],href:'level-three.html'},
    {name:'哥布林營地',enemies:[1,6,2,4],href:'level-four.html'},
    {name:'哥布林巢穴',enemies:[1,6,4,7],href:'level-five.html'}
  ];
  function normalize(value){return Array.from({length:COUNT},(_,i)=>Number.isInteger(value?.[i])&&value[i]>=0&&value[i]<=3?value[i]:0);}
  function read(storage){
    let stars=normalize(null);
    try{stars=normalize(JSON.parse(storage.getItem(KEY)));}catch{}
    // Old saves contain no life count: preserve completion as at least one star.
    try{if(storage.getItem('td-tutorial-complete')==='true')stars[0]=Math.max(1,stars[0]);}catch{}
    return stars;
  }
  function unlocked(stars,index){return Number.isInteger(index)&&index>=0&&index<COUNT&&(index===0||normalize(stars)[index-1]>=1);}
  function wallsUnlocked(stars){return normalize(stars)[1]>=1;}
  function bombTowersUnlocked(stars){return normalize(stars)[3]>=1;}
  function starsForResult(phase,lives){return phase==='won'&&Number.isFinite(lives)&&lives>=1?Math.min(3,Math.floor(lives)):0;}
  function record(storage,index,earned){
    const stars=read(storage);
    if(!unlocked(stars,index)||!Number.isInteger(earned)||earned<1||earned>3)return {stars,saved:false};
    stars[index]=Math.max(stars[index],earned);
    let saved=false;
    try{storage.setItem(KEY,JSON.stringify(stars));saved=true;}catch{}
    return {stars,saved};
  }
  function reset(storage){
    const keys=[KEY,ENCOUNTER_KEY,'td-tutorial-complete'],removed=[];
    try{
      const previous=keys.map(key=>[key,storage.getItem(key)]);
      for(const entry of previous){storage.removeItem(entry[0]);removed.push(entry);}
      return true;
    }catch{
      // Restore anything already removed if storage rejects the reset midway.
      for(const [key,value] of removed)if(value!==null){try{storage.setItem(key,value);}catch{}}
      return false;
    }
  }
  const validEnemy=id=>Number.isInteger(id)&&id>=1&&id<=7;
  function readEncountered(storage){
    let ids=[];
    try{const value=JSON.parse(storage.getItem(ENCOUNTER_KEY));if(Array.isArray(value))ids=value.filter(validEnemy);}catch{}
    // A completed tutorial necessarily encountered both of its enemy types.
    if(read(storage)[0]>=1)ids.push(...stages[0].enemies);
    return [...new Set(ids)].sort((a,b)=>a-b);
  }
  function createEncounterTracker(storage){
    const seen=new Set(readEncountered(storage));
    return {
      has:id=>seen.has(id),
      encounter(id){
        if(!validEnemy(id)||seen.has(id))return false;
        readEncountered(storage).forEach(value=>seen.add(value));
        seen.add(id);
        try{storage.setItem(ENCOUNTER_KEY,JSON.stringify([...seen].sort((a,b)=>a-b)));}catch{}
        return true;
      }
    };
  }
  const api={KEY,ENCOUNTER_KEY,stages,read,unlocked,wallsUnlocked,bombTowersUnlocked,starsForResult,record,reset,readEncountered,createEncounterTracker};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LevelProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this);
