(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  function state(game,id,{ready=true,paused=false}={}){
    const slot=Number.isInteger(id)?game.slots[id]:null;
    if(!slot)return null;
    const common=!ready?'素材載入中':game.phase!=='playing'?'本局已結束':paused?'遊戲已暫停':slot.action?'工程進行中':'';
    const buildLocked=['upgrade','upgrading'].includes(game.lesson);
    const tutorial=typeof game.lesson==='string';
    const upgradeLocked=tutorial&&(game.wave<2||(game.wave===2&&!game.awaitingWave));
    const item=(label,amount,reason='',income=false)=>({label,amount,income,reason:common||reason,disabled:!!(common||reason)});
    const buildCost=TD.TOWERS[1].cost,next=TD.TOWERS[slot.level+1];
    const repairCost=TD.TOWER_ACTIONS.repair.cost;
    const menu={
      slot,
      stats:slot.level?{hp:slot.hp,maxHp:slot.maxHp,damage:TD.TOWERS[slot.level].damage,interval:TD.TOWERS[slot.level].interval,range:TD.TOWERS[slot.level].range,targets:['ground','air'],kills:slot.kills||0}:null,
      investment:TD.TOWERS.slice(1,slot.level+1).reduce((sum,t)=>sum+t.cost,0),
      build:item('建造箭塔',buildCost,slot.level?'已建造箭塔':buildLocked?'先完成一座箭塔的升級':game.money<buildCost?'金幣不足':''),
      upgrade:item('升級',next?.cost??null,!slot.level?'請先建造箭塔':!next?'已達最高等級':upgradeLocked?'第二波結束後開放升級':game.money<next.cost?'金幣不足':''),
      repair:item('修復',repairCost,!slot.level?'請先建造箭塔':slot.level!==3?'滿級箭塔才能修復':slot.hp>=slot.maxHp?'生命已滿':game.money<repairCost?'金幣不足':''),
      demolish:item('拆除',slot.level?TD.refundFor(slot.level):0,!slot.level?'請先建造箭塔':tutorial&&!game.upgradeLearned?'完成首次升級後開放拆除':'',true)
    };
    for(const kind of ['build','upgrade','repair','demolish'])menu[kind].duration=TD.TOWER_ACTIONS[kind].duration;
    if(!next)menu.upgrade.duration=null;
    return menu;
  }
  const api={state};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TowerMenu=api;
})(typeof globalThis!=='undefined'?globalThis:this);
