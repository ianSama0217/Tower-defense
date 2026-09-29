(function(root){
  'use strict';
  const specs=[null,
    {file:'tower_lv1.png',size:64,anchor:{x:32,y:61},archers:1,footprintTiles:{width:2,height:2}},
    {file:'tower_lv2.png',size:80,anchor:{x:40,y:77},archers:2,footprintTiles:{width:2,height:2}},
    {file:'tower_lv3.png',size:96,anchor:{x:48,y:93},archers:3,footprintTiles:{width:2,height:2}}
  ];
  // Sprite canvas and building occupancy are independent. All upgrades share one pad.
  function placement(level,padSize,worldScale=1){const s=specs[level],scale=Math.min(1,padSize/worldScale/32*.65);return {width:s.size*scale,height:s.size*scale,anchorX:s.anchor.x*scale,anchorY:s.anchor.y*scale,groundOffset:padSize*.35};}
  const api={specs,placement};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TowerSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
