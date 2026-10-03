(function(root){
  'use strict';
  const KEY='td-level-stars', COUNT=5;
  const stages=[
    {name:'林間入口',enemies:[5,1],href:'tutorial.html'},
    {name:'花徑哨站',enemies:[]},
    {name:'古木岔路',enemies:[]},
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
  function starsForResult(phase,lives){return phase==='won'&&Number.isFinite(lives)&&lives>=1?Math.min(3,Math.floor(lives)):0;}
  function record(storage,index,earned){
    const stars=read(storage);
    if(!unlocked(stars,index)||!Number.isInteger(earned)||earned<1||earned>3)return {stars,saved:false};
    stars[index]=Math.max(stars[index],earned);
    let saved=false;
    try{storage.setItem(KEY,JSON.stringify(stars));saved=true;}catch{}
    return {stars,saved};
  }
  const api={KEY,stages,read,unlocked,starsForResult,record};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LevelProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this);
