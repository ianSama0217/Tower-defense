(function(root){
 'use strict';
 const TD=typeof module!=='undefined'&&module.exports?require('../engine.js'):root.TD;
 const {stages,hp,stage,bounds,draw}=typeof module!=='undefined'&&module.exports?require('../fence-sprites.js'):root.FenceSprites;
 function createScenario(){return TD.createScenario({paths:[[[0,384],[1280,384]],[[896,96],[896,672]]],worldScale:TD.CAMPAIGN_WORLD_SCALE,mapConfig:{...TD.MAP_CONFIG}});}
 const scenario=createScenario();
 const geometry=new TD.Game(Math.random,scenario);
 function unit(o){return o.unit||{...o,orientation:o.asset.orientation,hp:hp*(o.condition??100)/100,maxHp:hp,...TD.wallSize(o.asset.orientation,scenario.worldScale,scenario.mapConfig.roadWidth)};}
 function placement(x,y,orientation,obstacles=[],exclude=null){
  geometry.walls=obstacles.filter(o=>o.id!==exclude&&['fence','wall'].includes(o.asset.category)).map(o=>o.asset.category==='fence'?unit(o):{...o,hp:300*(o.condition??100)/100,...TD.wallSize(o.asset.orientation,scenario.worldScale,scenario.mapConfig.roadWidth)});
  geometry.slots=obstacles.filter(o=>o.id!==exclude&&['tower','bomb-tower'].includes(o.asset.category));
  geometry.enemies=obstacles.filter(o=>o.id!==exclude&&o.asset.category==='enemy'&&o.animation!=='death').map(o=>({...o,hp:1}));
  const result=geometry.wallPlacement(x,y,orientation);
  if(!result.ok)result.message=result.message.replaceAll('城牆','柵欄');return result;
 }
 const api={stages,hp,scenario,createScenario,stage,unit,placement,bounds,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TestFences=api;
})(typeof globalThis!=='undefined'?globalThis:this);
