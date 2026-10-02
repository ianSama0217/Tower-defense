(function(root){
  'use strict';
  const BREAK_FRAME_MS=90, BREAK_DURATION=8*BREAK_FRAME_MS;
  class HeartTimeline {
    constructor(count=3){this.count=count;this.reset(count);}
    reset(lives=this.count){this.lives=Math.max(0,Math.min(this.count,lives));this.lossTimes=Array(this.count).fill(null);}
    update(lives,now){
      const next=Math.max(0,Math.min(this.count,lives));
      if(next<this.lives)for(let i=next;i<this.lives;i++)this.lossTimes[i]=now;
      if(next>this.lives)for(let i=this.lives;i<next;i++)this.lossTimes[i]=null;
      this.lives=next;
    }
    sample(index,now,reducedMotion=false){
      if(index<this.lives)return{state:'alive',frame:reducedMotion?0:Math.floor((now+index*160)/160)%8};
      const lost=this.lossTimes[index],elapsed=lost===null?Infinity:Math.max(0,now-lost);
      if(elapsed<(reducedMotion?180:BREAK_DURATION))return{state:'breaking',frame:reducedMotion?9:8+Math.min(7,Math.floor(elapsed/BREAK_FRAME_MS))};
      return{state:'empty',frame:0};
    }
    isBreaking(now,reducedMotion=false){return this.lossTimes.some((time,i)=>i>=this.lives&&time!==null&&now-time<(reducedMotion?180:BREAK_DURATION));}
  }
  class GameHud {
    constructor(element){
      this.element=element;this.timeline=new HeartTimeline();
      this.reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
      this.hearts=Array.from({length:3},()=>{const heart=document.createElement('span');heart.className='heart-sprite';heart.setAttribute('aria-hidden','true');element.append(heart);return heart;});
      this.reset(3);
    }
    reset(lives){this.timeline.reset(lives);this.update(lives,performance.now());}
    update(lives,now=performance.now()){
      this.timeline.update(lives,now);this.element.setAttribute('aria-label',`剩餘生命 ${lives} / 3`);this.render(now);
    }
    render(now){
      this.hearts.forEach((heart,i)=>{
        const {state,frame}=this.timeline.sample(i,now,this.reducedMotion?.matches);
        heart.dataset.state=state;heart.style.backgroundPosition=`${frame%4*100/3}% ${Math.floor(frame/4)*100/3}%`;
      });
    }
    isBreaking(now=performance.now()){return this.timeline.isBreaking(now,this.reducedMotion?.matches);}
  }
  const api={HeartTimeline,GameHud,BREAK_FRAME_MS,BREAK_DURATION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ForestHud=api;
})(typeof globalThis!=='undefined'?globalThis:this);
