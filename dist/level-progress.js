(function(root){
  'use strict';
  const KEY='td-level-stars', ENCOUNTER_KEY='td-encountered-enemies', COUNT=5;
  const stages=[
    {name:'林間入口',enemies:[5,1],href:'tutorial.html'},
    {name:'花徑哨站',enemies:[1,6],href:'level-two.html'},
    {name:'古木岔路',enemies:[1,6,2],href:'level-three.html'},
    {name:'暮色防線',enemies:[]},
    {name:'荊棘王座',enemies:[]}
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
  function starsForResult(phase,lives){return phase==='won'&&Number.isFinite(lives)&&lives>=1?Math.min(3,Math.floor(lives)):0;}
  function record(storage,index,earned){
    const stars=read(storage);
    if(!unlocked(stars,index)||!Number.isInteger(earned)||earned<1||earned>3)return {stars,saved:false};
    stars[index]=Math.max(stars[index],earned);
    let saved=false;
    try{storage.setItem(KEY,JSON.stringify(stars));saved=true;}catch{}
    return {stars,saved};
  }
  const validEnemy=id=>Number.isInteger(id)&&id>=1&&id<=6;
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
  const api={KEY,ENCOUNTER_KEY,stages,read,unlocked,wallsUnlocked,starsForResult,record,readEncountered,createEncounterTracker};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LevelProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this);
