const {createScenario}=require('../dist/engine.js');
// Minimal combat fixture, not a shipped playable level.
function combatScenario(){return createScenario({
  paths:[[[1280,400],[0,400]]],slots:[[1216,368],[1248,380],[96,96]],worldScale:2
});}
module.exports={combatScenario};
