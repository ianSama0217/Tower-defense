const {test}=require('node:test'),assert=require('node:assert/strict');
const Work=require('../dist/tower-work.js');
function canvas(){
  const calls=[],stack=[];
  return {calls,globalAlpha:1,imageSmoothingEnabled:true,
    save(){stack.push([this.globalAlpha,this.imageSmoothingEnabled]);},restore(){[this.globalAlpha,this.imageSmoothingEnabled]=stack.pop();},
    drawImage(...args){calls.push(args);},beginPath(){},rect(){},clip(){},translate(){},rotate(){},moveTo(){},lineTo(){},stroke(){}};
}
test('tower work advances through eight stages once, independently from the looping hammer',()=>{
  for(const duration of [3,5]){
    for(let stage=0;stage<8;stage++)assert.equal(Work.sample({elapsed:(stage+.5)*duration/8,duration}).stage,stage);
    assert.equal(Work.sample({elapsed:duration+2,duration}).stage,7);
    assert.equal(Work.sample({elapsed:-1,duration}).stage,0);
  }
  assert.equal(Work.sample({elapsed:.8,duration:5}).frame,0);
  assert.equal(Work.sample({elapsed:.7,duration:5}).frame,7);
});
test('paused jobs render deterministically and leave simulation state and canvas state intact',()=>{
  const action={kind:'demolish',elapsed:1.6,duration:3,material:'stone'},before={...action};
  const img={naturalWidth:80,naturalHeight:80},r={x:30,y:50,w:80,h:80},a=canvas(),b=canvas();
  Work.draw(a,img,r,action);Work.draw(b,img,r,action);
  assert.deepEqual(a.calls,b.calls);assert.deepEqual(action,before);assert.equal(a.globalAlpha,1);assert.equal(a.imageSmoothingEnabled,true);
});
test('completed upgrade draws the exact target tower at its supplied ground anchor',()=>{
  const a=canvas(),old={naturalWidth:64,naturalHeight:64},next={naturalWidth:80,naturalHeight:80};
  const r={x:36,y:39,w:64,h:64},target={image:next,rect:{x:20,y:23,w:80,h:80}};
  Work.draw(a,old,r,{kind:'upgrade',elapsed:5,duration:5},target);
  assert.equal(a.calls.length,1);assert.deepEqual(a.calls[0],[next,20,23,80,80]);
});
test('demolition never resurrects the intact tower after collapse or at completion',()=>{
  const img={naturalWidth:80,naturalHeight:80},r={x:0,y:0,w:80,h:80};
  for(const elapsed of [1.9,2.3,2.9,3,3.8]){
    const a=canvas();Work.draw(a,img,r,{kind:'demolish',elapsed,duration:3});
    assert.equal(a.calls.some(args=>args[0]===img),false);
  }
});
test('idle, repair completion and construction completion preserve the current artwork',()=>{
  const img={naturalWidth:96,naturalHeight:96},r={x:10,y:20,w:96,h:96};
  for(const action of [null,{kind:'repair',elapsed:3,duration:3},{kind:'build',elapsed:5,duration:5}]){
    const a=canvas();Work.draw(a,img,r,action);assert.deepEqual(a.calls,[[img,10,20,96,96]]);
  }
});
