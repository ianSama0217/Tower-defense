(function(root){
  'use strict';
  const bat={name:'洞窟蝙蝠',file:'enemy_bat.png',size:24,frames:19,anchor:{x:12,y:21},previewOnly:true,animations:{
    idle:{start:0,count:4,fps:5,loop:true},fly:{start:4,count:4,fps:9,loop:true},
    attack:{start:8,count:4,fps:10,loop:false},hurt:{start:12,count:3,fps:10,loop:false},death:{start:15,count:4,fps:7,loop:false}
  }};
  if(typeof module!=='undefined'&&module.exports)module.exports={bat};else root.BatSprites={bat};
})(typeof globalThis!=='undefined'?globalThis:this);
