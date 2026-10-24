(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  function state(game,id,{ready=true,paused=false,kind}={}){
    const slot=Number.isInteger(id)?game.slots[id]:null;
    if(!slot)return null;
    const common=!ready?'素材載入中':game.phase!=='playing'?'本局已結束':paused?'遊戲已暫停':slot.action?'工程進行中':'';
    const item=(label,amount,reason='',income=false)=>({label,amount,income,reason:common||reason,disabled:!!(common||reason)});
    const chosen=!slot.level&&kind?{...slot,kind}:slot;
    const specs=game.towerSpecs(chosen),buildCost=specs[1].cost,next=specs[slot.level+1];
    const name=chosen.kind==='bomb'?'炸彈塔':'箭塔';
    const repairCost=TD.TOWER_ACTIONS.repair.cost;
    const menu={
      slot,
      stats:slot.level?{hp:slot.hp,maxHp:slot.maxHp,damage:specs[slot.level].damage,interval:specs[slot.level].interval,range:specs[slot.level].range,minRange:specs[slot.level].minRange,targets:slot.kind==='bomb'?['ground']:['ground','air'],kills:slot.kills||0}:null,
      investment:specs.slice(1,slot.level+1).reduce((sum,t)=>sum+t.cost,0),
      build:item(`建造${name}`,buildCost,slot.level?`已建造${name}`:game.money<buildCost?'金幣不足':''),
      upgrade:item('升級',next?.cost??null,!slot.level?`請先建造${name}`:!next?'已達最高等級':game.money<next.cost?'金幣不足':''),
      repair:item('修復',repairCost,!slot.level?`請先建造${name}`:slot.level!==3?`滿級${name}才能修復`:slot.hp>=slot.maxHp?'生命已滿':game.money<repairCost?'金幣不足':''),
      demolish:item('拆除',slot.level?TD.refundFor(slot.level,specs):0,!slot.level?`請先建造${name}`:'',true)
    };
    for(const kind of ['build','upgrade','repair','demolish'])menu[kind].duration=TD.TOWER_ACTIONS[kind].duration;
    if(!next)menu.upgrade.duration=null;
    return menu;
  }
  const api={state};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TowerMenu=api;
})(typeof globalThis!=='undefined'?globalThis:this);
