const {test}=require('node:test'),assert=require('node:assert/strict');
const {LEVELS}=require('../dist/engine.js'),environment=require('../dist/environment.js'),specs=require('../dist/assets/environment/sprites.json');
const images=Object.fromEntries(Object.entries(specs).map(([name,s])=>[name,{naturalWidth:s.width,naturalHeight:s.height}]));
test('first level hides the debug grid and scenery leaves roads and every build pad clear',()=>{
  const level=LEVELS[0],items=environment.placements(level,images,2);assert.equal(level.mapConfig.debugGrid,false);assert.equal(level.slots.length,27);assert.ok(items.length>=20);
  for(const item of items){
    assert.ok(item.x>=0&&item.y>=0&&item.x+item.w<=1280&&item.y+item.h<=768);
    for(const s of level.slots)assert.ok(item.x+item.w<=s.x-32||item.x>=s.x+32||item.y+item.h<=s.y-32||item.y>=s.y+32,'Scenery overlaps a build pad');
    for(const route of level.routes)for(let i=1;i<route.path.length;i++){
      const a=route.path[i-1],b=route.path[i],left=Math.min(a.x,b.x)-48,right=Math.max(a.x,b.x)+48,top=Math.min(a.y,b.y)-48,bottom=Math.max(a.y,b.y)+48;
      assert.ok(item.x+item.w<=left||item.x>=right||item.y+item.h<=top||item.y>=bottom,'Scenery covers enemy route');
    }
  }
  assert.ok(items.some(p=>environment.names.indexOf(p.name)<11));assert.ok(items.some(p=>p.name==='flowers'));assert.ok(items.some(p=>p.name==='fallenLog'));
});
test('scenery remains stable across restarts and only the first build-pad variant is shipped',()=>{
  assert.deepEqual(environment.placements(LEVELS[0],images,2),environment.placements(LEVELS[0],images,2));
  assert.deepEqual(environment.names.filter(n=>/pad/i.test(n)),['buildPad']);
  assert.deepEqual(Object.keys(specs).sort(),[...environment.names].sort());
});
