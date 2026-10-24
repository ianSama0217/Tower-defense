(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const TD=node?require('./engine.js'):root.TD,progress=node?require('./level-progress.js'):root.LevelProgress;
  const sprites=node?require('./enemy-sprites.js'):root.EnemySprites,bombs=node?require('./bomb-towers.js'):root.BombTowers;
  const descriptions={1:'在森林中成群行動的小魔物，會靠近並攻擊防禦建築。',2:'強壯的森林戰士，以猛烈衝鋒突破防線。',4:'抱著炸彈衝向建築的哥布林，倒下時也十分危險。',5:'沿著林間道路前進的黏液魔物，看似溫馴，仍不可讓牠通過防線。',6:'攜帶弓箭的哥布林，能在遠處持續威脅建築。',7:'率領哥布林軍團的隊長，以戰吼鼓舞身邊的同伴。'};
  function catalog(storage){
    const seen=new Set(progress.readEncountered(storage)),stars=progress.read(storage);
    // The campaign roster is the allowlist: sandbox-only units never become entries.
    const ids=[...new Set(progress.stages.filter(stage=>stage.href).flatMap(stage=>stage.enemies))];
    const enemies=ids.map(id=>{
      const s=TD.ENEMIES[id],sprite=sprites.specs[id];
      const traits={1:['近距離攻擊建築。'],2:[`出生時獲得 ${s.chargeHealthBonus} 點衝鋒護盾，移速提升至 ${s.speed*s.chargeSpeedMultiplier}。`,`首次衝撞造成 ${s.chargeDamage} 傷害；護盾耗盡或接觸建築後停止衝鋒。`],4:[`靠近建築時自爆；被擊殺時也會爆炸。`,`爆炸半徑 ${s.blastRadius}，造成 ${s.blastDamage} 傷害，不傷害其他敵人。`],5:[`不攻擊塔防；遇到道路建築時，每 ${TD.WALL.attackInterval} 秒造成 ${TD.WALL.attackDamage} 傷害。`],6:[`使用弓箭遠距離攻擊，射程 ${s.attackRange}。`],7:['戰吼使附近哥布林、弓箭手與炸彈哥布林加速。','擊敗隊長即可獲勝；讓隊長逃脫則挑戰失敗。']};
      return {id:`enemy-${id}`,name:s.name,known:seen.has(id),image:`assets/enemies/${sprite.file}`,frames:sprite.frames||20,description:descriptions[id],stats:[['生命值',s.hp],['移動速度',s.speed],['攻擊力',s.blastDamage??s.attackDamage],['擊殺獎勵',`${s.reward} 金幣`]],traits:traits[id]||['無特殊能力。']};
    });
    const towers=[{id:'arrow',name:'箭塔',known:true,specs:TD.TOWERS,folder:'towers',description:'由弓箭手駐守的高塔，快速射擊單一目標，是森林防線的主力。',traits:['攻擊單一地面敵人。','可升級至三級，也可修復或拆除。']},{id:'bomb',name:'炸彈塔',known:progress.bombTowersUnlocked(stars),specs:bombs.specs,folder:'bomb-towers',description:'拋投炸彈轟擊敵群，適合對付密集前進的敵人。',traits:['爆炸會傷害範圍內的所有敵人。',`無法攻擊距離 ${bombs.specs[1].minRange} 以內的目標。`,'可升級至三級，也可修復或拆除。']}];
    return {enemies,towers,defenses:[{id:'fence',name:'柵欄',known:progress.wallsUnlocked(stars),image:'assets/fences/fence-100.png',description:'以交叉木樁組成的路障，阻擋敵人，為塔防爭取攻擊時間。',stats:[['生命值',TD.FENCE.hp],['建造費用',`${TD.FENCE.cost} 金幣`],['每場上限',`${TD.FENCE.limit} 座`]],traits:['只能在波次開始前或波次間的準備期間建造。','無法修復、升級或拆除。','摧毀後不再阻擋敵人，也不補回建造次數。']}]};
  }
  function towerLevel(entry,level){
    const s=entry.specs[level];
    return {...entry,level,image:`assets/${entry.folder}/tower_lv${level}.png`,stats:[['生命值',s.hp],['攻擊力',s.damage],['攻擊間隔',`${s.interval} 秒`],['射程',s.range],[level===1?'建造費用':'升級費用',`${s.cost} 金幣`],...(s.blastRadius?[['爆炸半徑',s.blastRadius]]:[])]};
  }
  const api={catalog,towerLevel};if(node)module.exports=api;else root.EncyclopediaData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
