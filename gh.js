<!-- GOLD & HOME v8.0
  FIX: CFG exposes all transition/menu timing — tweak without touching logic
  FIX: Trans.run uses CFG values (slower, cinematic defaults)
  FIX: Menu is a FULL SCENE — Trans.run exits/enters it; _prevPageEl restores on plain close
  FIX: menuIntro hero talk ("Excellent!…") plays on EVERY menu open (utility + narrative)
  FIX: Hamburger OPEN → pointOut if pointing → open menu
       Hamburger CLOSE → instant close, NO pointOut ever
  FIX: Menu nav buttons → Hero.pointOutThen() before navigating (pointingLeftOut now visible)
  FIX: Menu inactivity → auto-navigate to page01 after CFG.menuInactivitySec
  FIX: CTA on page04 → only opens contact form, no re-transition black flash
  FIX: Wood modals — teleport only sets display/visibility; CSS handles position (like contact)
  FIX: Stagger animations on wood buttons (p01 sub-scenes) and kitchen cards (p02)
  FIX: All existing: SM watchdog, debounce, retry, consistency, walkIn pre-trans, sub-TL flush
-->
<script>
(function(){
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   §1  CONFIG  — edit these values freely; no need to touch logic below
   ═══════════════════════════════════════════════════════════════════════ */
const CFG={
  s3:'https://s3.amazonaws.com/webflow-prod-assets/6936cf86612ee72fffe0a4e7/',

  /* ── Scene transition ─────────────────────────────────────────── */
  transOutDur   : 0.55,   // exit-page fade duration  (s)  was 0.45
  transInDur    : 0.72,   // enter-page fade duration (s)  was 0.55
  transDelay    : 0.08,   // pause between out-end and in-start (s)
  transOutScale : 0.93,   // scale of page while exiting
  transInScale  : 1.04,   // initial scale of entering page
  transBlur     : 8,      // blur (px) applied during transition

  /* ── Menu ─────────────────────────────────────────────────────── */
  menuTransDur      : 0.45,  // menu-specific in/out duration (s)
  menuInactivitySec : 30,    // auto-leave idle menu (0 = disabled)

  /* ── Pages ────────────────────────────────────────────────────── */
  p02InactivitySec : 60,

  /* ── Hero video ───────────────────────────────────────────────── */
  pointIdleLoops : 3,
  videoBlurFade  : true,

  /* ── Misc ─────────────────────────────────────────────────────── */
  stepThrottle  : 800,
  subsPollMs    :  80,
  subsCross     : 200,
  subsLingerSec : 3.0,
  animations    : true,
  debug         : true,
};

/* ── BGM ── */
const BGM={url:'https://cdn.prod.website-files.com/6936cf86612ee72fffe0a4e7/6995ed7b8c30348a1ee2dc6e_soulfuljamtracks-classical-background-music-483075.mp3',vol:0.015,inst:null};
function initMusic(){
  if(BGM.inst)return;
  const a=new Audio(BGM.url);a.loop=true;a.volume=BGM.vol;a.playsInline=true;BGM.inst=a;
  const p=()=>a.play().catch(()=>{});p();
  ['click','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,p,{once:true}));
}

/* ═══════════════════════════════════════════════════════════════════════
   §2  STATE MACHINE
   ═══════════════════════════════════════════════════════════════════════ */
const SM=(()=>{
  const S={IDLE:'IDLE',TRANSITIONING:'TRANSITIONING',LOCKED:'LOCKED',PLAYING:'PLAYING'};
  let _s=S.IDLE,_wd=null;
  const WD=4500;
  function _watch(){
    clearTimeout(_wd);
    if(_s===S.TRANSITIONING||_s===S.LOCKED){
      _wd=setTimeout(()=>{
        log('[SM] ⚠ watchdog: stuck in',_s,'→ IDLE');
        _s=S.IDLE;
        const pages=['#PAGE-00-1','#PAGE-01','#PAGE-02','#PAGE-03','#PAGE-04'];
        const vis=pages.find(s=>{const e=document.querySelector(s);return e&&parseFloat(getComputedStyle(e).opacity)>0.05;});
        if(!vis){const e=document.querySelector('#PAGE-00-1');if(e)gsap.set(e,{display:'flex',autoAlpha:1,clearProps:'scale,rotateX,filter'});}
      },WD);
    }
  }
  return{
    S,
    get state(){return _s;},
    set(s,why){if(_s===s)return;log('[SM]',_s,'→',s,why||'');_s=s;_watch();},
    is(...ss){return ss.includes(_s);},
    canNavigate(){return this.is(S.IDLE,S.PLAYING);},
  };
})();

const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};

/* ═══════════════════════════════════════════════════════════════════════
   §3  FORMAT / LOG
   ═══════════════════════════════════════════════════════════════════════ */
const FMT=(/^((?!chrome|android|chromium).)*safari/i.test(navigator.userAgent)||/iPad|iPhone|iPod/.test(navigator.userAgent))?'mp4':'webm';
const log=(...a)=>CFG.debug&&console.log('[GH]',...a);

/* ═══════════════════════════════════════════════════════════════════════
   §4  CLIPS
   ═══════════════════════════════════════════════════════════════════════ */
const S3=CFG.s3;
const CLIPS={
  walkIn:          [S3+'69931c2c08322f0623485fe6_h-walk-in-frame.webm',S3+'6991b81860575b5a990d3f58_h-walk-in-frame.mp4'],
  walkOut:         [S3+'69972dc0fe57ca1981d26275_h-walk-out-frame.webm',S3+'69972d9437f11a6ff7b19e9c_h-walk-out-frame.mp4'],
  idealKitchen:    [S3+'69972e691a99941536a99b5c_h-p00-1-let-me-tell-about-ideal-kitchen.webm',S3+'69972e7a52da2312df72eb1a_h-p00-1-let-me-tell-about-ideal-%20kitchen.mp4'],
  idleBreath:      [S3+'6997426d670814baad5e16c3_h-idle-breath.webm',S3+'699742592be8a5d21276f270_h-idle-breath.mp4'],
  pointingLeftIn:  [S3+'69973106c832fd7e4a3b923c_h-pointing-left-in.webm',S3+'699730daf78965ff30720d82_h-pointing-left-in.mp4'],
  pointingLeftIdle:[S3+'699731679a08228d07f5adf6_h-pointing-left-idle.webm',S3+'6997318b45f79e7d4a293777_h-pointing-left-idle.mp4'],
  pointingLeftOut: [S3+'69932276d4714d72c65c7ece_h-pointing-left-out.webm',S3+'699322b660a1970bfcfc9568_h-pointing-left-out.mp4'],
  menuIntro:       [S3+'6997326cc8e0fe8a084af0b4_h-p00-2-Menu.webm',S3+'69973240cd44eed392b20ce3_h-p00-2-Menu.mp4'],
  showsExplaining: [S3+'699733abf8987fc0d574dc7e_h-shows-explaining.webm',S3+'69973370ec63575b9748c3b1_h-shows-explaining.mp4'],
  winterWalkIn:    [S3+'6997345d558646581ffc62b5_h-w-walking-in-frame.webm',S3+'6997343aef27164267ec7819_h-w-walking-in-frame.mp4'],
  p01s0:           [S3+'699ef4807f8dcb9c25038cab_h-p01-1-winter-wood%2B.webm',S3+'699ef4b1a0c79a76bef8a7e2_h-p01-1-winter-wood%2B.mp4'],
  winterWalkOut:   [S3+'699735f15c63ef40dfe0a626_h-w-walk-out-frame.webm',S3+'69973582c7533eb0a50e615f_h-w-walk-out-frame.mp4'],
  p01s1:           ['',''],
  jump:            [S3+'699741f697b76397e00d0754_h-jump.webm',S3+'699741b1d009ea8f0534bbf2_h-jump.mp4'],
  p01s2a:          ['',''],
  p01s2b:          ['',''],
  p01s3:           [S3+'69974a7887baeb95f3b38bcd_h-p01-4.webm',''],
  p01s4a:          ['',''],  // ← paste S3 hash when available
  p01s4b:          ['',''],  // ← paste S3 hash when available
  takeCoffeeIn:    [S3+'69974ae198f53f0cd8d9003f_h-take-coffee-in.webm',S3+'69974abe97a96b6cfc689926_h-take-coffee-in.mp4'],
  p02s1:           [S3+'699749273ff6f11199b118dc_h-p02-1-coffee.webm',''],
  p02s2:           [S3+'699743d5fc939539baf86668_h-p02-2.webm',S3+'6997439a4574bf86516bb697_h-p02-2.mp4'],
  p02s4a:          ['',''],
  p02s4b:          ['',''],
  p02s5:           [S3+'69974583c3f90cbe5fc41e01_h-p02-5.webm',S3+'69974548f6e82fe91eff5c5f_h-p02-5.mp4'],
  p02s6:           [S3+'69974612b8a08616b16393d4_h-p02-6-button.webm',S3+'699745ecd5328ef9ebe71fd4_h-p02-6-button.mp4'],
  p03s1:           [S3+'699746806f66f3242d5819f7_h-p03-1.webm',S3+'699746594574bf86516c6cad_h-p03-1.mp4'],
  p03s2:           [S3+'699746f6bf5217e0930d585a_h-p03-2.webm',S3+'699746d013f2981abdcd3b7a_h-p03-2.mp4'],
  p03s3:           [S3+'6997477b896906698aa9a792_h-p03-3.webm',''],
  p03s4:           [S3+'699747654a8d44b4ce023761_h-p03-4.webm',S3+'699747292ba19607438a0703_h-p03-4.mp4'],
  p04CardIn:       ['',''],
  cardOut:         [S3+'6997488c831caf7bd690b744_h-card-out.webm',S3+'6997486c463a5487b2e637c6_h-card-out.mp4'],
};
const clipURL=k=>{const p=CLIPS[k];if(!p){log('⚠clip:',k);return'';}return FMT==='mp4'?(p[1]||p[0]||''):(p[0]||p[1]||'');};

/* ═══════════════════════════════════════════════════════════════════════
   §5  SUBTITLES DATA
   ═══════════════════════════════════════════════════════════════════════ */
const SUBS={
  idealKitchen:[{s:0,e:3,t:'Let me tell you about your ideal kitchen…'}],
  menuIntro:   [{s:0,e:3,t:'Excellent! Where shall we start?'}],
  p01s0:[{s:0,e:2,t:'The wood for your kitchen grew in Europe…'},{s:2,e:5,t:'…specifically in the part where the climate is cool.'},{s:5,e:10,t:'Because only in this climate does wood develop the quality you can truly rely on.'},{s:10,e:15,t:'It handles humidity changes and temperature fluctuations beautifully.'}],
  p01s1:[{s:0,e:6,t:'I should mention that we use only 4 wood species: oak, ash, walnut, and cherry.'},{s:6,e:12,t:'And after selecting solid wood of exceptional quality — what do we do?'},{s:12,e:15,t:'Make your kitchen from it? No, of course not.'},{s:15,e:20,t:'After that, we cure it for a very long time — at least 18 months.'},{s:20,e:32,t:'Steaming and drying, cycle after cycle, month after month, for at least a year and a half.'},{s:32,e:38,t:'We achieve ideal solid wood with internal moisture below 10%.'},{s:38,e:45,t:'Your kitchen remains flawlessly stable — resistant to settling, warping, and deformation.'}],
  p01s2:[{s:0,e:6,t:'But that\'s still not all. We then create laminated timber from this cured natural wood.'},{s:6,e:12,t:'It\'s significantly lighter and significantly stronger than standard solid wood.'},{s:12,e:18,t:'This laminated natural timber will serve many generations of your family.'}],
  p01s3:[{s:0,e:6,t:'And the environmental standards we follow? Far stricter than those in the USA.'},{s:6,e:15,t:'Our formaldehyde emission standard exceeds the EPA\'s permissible level by more than 6 times.'},{s:15,e:23,t:'TSCA Title VI, 2016 — the federal standard based on California\'s CARB Phase 2.'}],
  p01s4:[{s:0,e:6,t:'If you need more information about the wood, click this button.'},{s:6,e:10,t:'Or, if you prefer, let\'s move right along.'}],
  p02s1:[{s:0,e:3,t:'I suppose it\'s already clear that we\'re in Italy.'},{s:3,e:9,t:'An obvious question: why travel so far for your ideal kitchen?'},{s:9,e:13,t:'The answer is simple: because it\'s yours.'},{s:13,e:17,t:'After all, your home says more about you than any words could.'},{s:17,e:20,t:'And the kitchen is the heart of any home.'},{s:20,e:26,t:'That\'s why we weren\'t looking for just any kitchen — but the world\'s best kitchen.'},{s:26,e:33,t:'It just so happens that the best kitchens have been made in Italy for roughly the last 500 years…'}],
  p02s2:[{s:0,e:3,t:'…and the best kitchen design is also Italian. This fact is about 5 centuries old.'},{s:3,e:7,t:'We work with three leading studios: l\'Ottocento, Michele Marcon, and Makethatstudio.'}],
  p02s4:[{s:0,e:6,t:'Though to be fair, all our kitchens have won design awards. But that\'s really just a nice bonus.'},{s:6,e:16,t:'What truly matters is the care and attention to detail — every element, down to the smallest.'},{s:16,e:25,t:'How softly the doors open. How quietly they close. The exact speed at which a drawer glides.'},{s:25,e:31,t:'Literally everything that matters to you in a kitchen has been considered.'}],
  p02s5:[{s:0,e:6,t:'But it\'s equally important that you can choose a style that suits you specifically.'},{s:6,e:11,t:'One that perfectly complements your home\'s design, style, atmosphere, and personality.'}],
  p02s6:[{s:0,e:4,t:'You can step inside any kitchen that has this panoramic tour symbol.'}],
  p03s1:[{s:0,e:7,t:'We chose Italy because Italy is home to the world\'s finest cabinetmakers.'},{s:7,e:10,t:'Behind me right now, you can see them at work.'}],
  p03s2:[{s:0,e:7,t:'Your kitchen will be made in Cittadella, near Venice — famous for centuries of artisan tradition.'},{s:7,e:14,t:'This matters because your kitchen will actually be hand-assembled twice!'}],
  p03s3:[{s:0,e:10,t:'First, we build a precise replica of your kitchen space at the factory — accurate to the inch.'},{s:10,e:13,t:'Then we craft and hand-assemble your entire kitchen inside it.'},{s:13,e:17,t:'Then we carefully and thoroughly inspect every element.'},{s:17,e:23,t:'Then we disassemble and meticulously pack each component.'},{s:23,e:26,t:'And only then do we ship your kitchen to you.'}],
  p03s4:[{s:0,e:4,t:'See? Just as I promised — that didn\'t take long at all, did it?'},{s:4,e:7,t:'Let\'s move to the final page of the site.'}],
  p04s1:[{s:0,e:3,t:'And now, New York — where we\'re based.'},{s:3,e:10,t:'From here, we can easily reach you and ensure your kitchen installation is absolutely flawless.'},{s:10,e:20,t:'We\'ll handle everything: visit your home, ask the right questions, understand your vision, and help you choose.'},{s:20,e:26,t:'We\'ll take measurements, create the design, meet every deadline, and install your ideal kitchen perfectly.'},{s:26,e:33,t:'The very same one crafted for you in Italy, assembled, inspected, disassembled, packed, and shipped.'},{s:33,e:37,t:'Now I\'ve told you everything. Call us, write to us, or come visit.'},{s:37,e:40,t:'Here\'s my card.'}],
};

/* ═══════════════════════════════════════════════════════════════════════
   §6  DOM HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let _activeVideoEl=null;
const heroVid=()=>_activeVideoEl||$('#avatarVideo')||$('.hero video');
const menuEl=()=>document.getElementById('PAGE-00-2')||$('.menu-wrapper')||null;

function emitIX(name){
  try{
    const ix=window.Webflow&&window.Webflow.require&&window.Webflow.require('ix3');
    if(ix&&typeof ix.emit==='function'){
      ix.emit(name);
      requestAnimationFrame(()=>{
        ['#avatarVideo','#avatarVideo_standby','.hero','.img---the-narratormask-group','.hero-wrapper','.hero video']
          .forEach(sel=>document.querySelectorAll(sel).forEach(el=>{let n=el;for(let i=0;i<4;i++){if(!n||n===document.body)break;n.style.overflow='visible';n.style.clipPath='none';n=n.parentElement;}}));
      });
      return;
    }
  }catch(e){}
  window.dispatchEvent(new CustomEvent(name,{bubbles:true}));
  log('emitIX:',name);
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  SUBTITLES PLAYER
   ═══════════════════════════════════════════════════════════════════════ */
const Subs=(()=>{
  let _poll=null,_last='',_xT=null;
  const box=()=>$('#subtitles')||$('.subtitles');
  const span=()=>$('#subtitle-text')||$('.subtitle-text');
  const showB=()=>{const b=box();if(b)gsap.to(b,{autoAlpha:1,duration:0.30,ease:'power2.out',overwrite:true});};
  const showT=()=>{const s=span();if(s)gsap.to(s,{opacity:1,duration:0.25,ease:'power2.out',overwrite:true});};
  const hideT=(d)=>{const s=span();if(s)gsap.to(s,{opacity:0,duration:0.40,ease:'power2.in',delay:d||0,overwrite:false});};
  function setText(txt){
    const s=span();if(!s||s.textContent===txt)return;
    if(s.textContent){
      s.classList.remove('sub-in');void s.offsetWidth;s.classList.add('sub-out');
      clearTimeout(_xT);
      _xT=setTimeout(()=>{s.classList.remove('sub-out');s.textContent=txt;void s.offsetWidth;s.classList.add('sub-in');},CFG.subsCross);
    }else{s.textContent=txt;s.classList.remove('sub-out','sub-in');void s.offsetWidth;s.classList.add('sub-in');}
  }
  return{
    start(key){
      this.stop();const list=SUBS[key];if(!list)return;
      const maxT=Math.max(...list.map(c=>c.e));showB();
      _poll=setInterval(()=>{
        const t=heroVid()?.currentTime??0;let f='';
        for(const c of list){if(t>=c.s&&t<c.e){f=c.t;break;}}
        if(f!==_last){_last=f;if(f){showT();setText(f);}else if(t<maxT-0.08)hideT(0);}
      },CFG.subsPollMs);
    },
    pause(){clearInterval(_poll);_poll=null;_last='';},
    linger(){
      clearInterval(_poll);_poll=null;clearTimeout(_xT);_xT=null;_last='';
      const s=span();if(!s)return;gsap.killTweensOf(s);gsap.set(s,{opacity:1});hideT(CFG.subsLingerSec);
    },
    stop(){
      clearInterval(_poll);_poll=null;clearTimeout(_xT);_xT=null;_last='';
      const s=span(),b=box();
      if(s){gsap.killTweensOf(s);gsap.set(s,{opacity:0});s.classList.remove('sub-in','sub-out');}
      if(b){gsap.killTweensOf(b);gsap.set(b,{autoAlpha:0});}
    },
    flash(t){showB();showT();setText(t);},
    hide(){hideT(0);},
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   §8  HERO VIDEO
   ═══════════════════════════════════════════════════════════════════════ */
const Hero=(()=>{
  let _c=false,_vA=null,_vB=null,_done=false,_vBKey=null;
  let _jumpNext=false,_pointing=false,_extTl=null;

  function _buf(){
    if(_done)return;
    const orig=document.querySelector('#avatarVideo')||document.querySelector('.hero video');
    if(!orig){log('⚠ #avatarVideo not found');return;}
    const par=orig.parentElement;if(!par)return;
    if(getComputedStyle(par).position==='static')par.style.position='relative';
    orig.style.background=orig.style.backgroundColor='transparent';
    const cs=getComputedStyle(orig);
    const firstUrl=clipURL('walkIn');
    if(firstUrl&&orig.dataset.clip!=='walkIn'){orig.src=firstUrl;orig.dataset.clip='walkIn';orig.load();}
    const cl=orig.cloneNode(false);
    cl.removeAttribute('src');cl.removeAttribute('data-clip');
    cl.id=orig.id?orig.id+'_standby':'';cl.muted=true;cl.playsInline=true;cl.setAttribute('playsinline','');
    Object.assign(cl.style,{position:'absolute',top:'0',left:'0',width:'100%',height:'auto',
      objectFit:cs.objectFit||'contain',objectPosition:cs.objectPosition||'center',maxWidth:cs.maxWidth||'100%',
      background:'transparent',backgroundColor:'transparent',opacity:'0',zIndex:'1',pointerEvents:'none',
      display:'block',transform:'translateZ(0)',webkitTransform:'translateZ(0)'});
    Object.assign(orig.style,{position:'relative',zIndex:'2',transform:'translateZ(0)',webkitTransform:'translateZ(0)'});
    par.appendChild(cl);_vA=orig;_vB=cl;_activeVideoEl=_vA;_done=true;
    log('Hero buf ✓ walkIn pre-loaded');
  }

  function _pre(key){
    if(!_done||!_vB)return;const url=clipURL(key);
    if(!url||_vBKey===key||_vA?.dataset.clip===key)return;
    _vBKey=key;_vB.src=url;_vB.dataset.clip=key;_vB.load();
  }

  function _swap(loop,cb){
    const useBlur=CFG.videoBlurFade&&_jumpNext;_jumpNext=false;
    _vB.muted=false;_vB.loop=loop;
    _vB.play().catch(()=>['click','touchend'].forEach(ev=>document.addEventListener(ev,()=>_vB.play(),{once:true})));
    let done=false;
    function flip(){
      if(done)return;done=true;_vB.removeEventListener('timeupdate',flip);clearTimeout(sc);
      if(useBlur){
        _vB.style.zIndex='2';_vB.style.opacity='0';
        gsap.to(_vA,{opacity:0,filter:'blur(6px)',duration:0.35,ease:'power2.in',onComplete:()=>{_vA.pause();_vA.muted=true;gsap.set(_vA,{clearProps:'filter'});_vA.style.zIndex='1';}});
        gsap.fromTo(_vB,{opacity:0,filter:'blur(6px)'},{opacity:1,filter:'blur(0px)',duration:0.40,ease:'power2.out',onComplete:()=>{const t=_vA;_vA=_vB;_vB=t;_activeVideoEl=_vA;_vBKey=null;gsap.set(_vA,{clearProps:'filter'});if(!loop&&cb)_vA.onended=cb;}});
      }else{
        _vB.style.opacity='1';_vB.style.zIndex='2';
        _vA.style.opacity='0';_vA.style.zIndex='1';
        _vA.pause();_vA.muted=true;
        const t=_vA;_vA=_vB;_vB=t;_activeVideoEl=_vA;_vBKey=null;
        log('↔',_vA.dataset.clip);if(!loop&&cb)_vA.onended=cb;
      }
    }
    _vB.addEventListener('timeupdate',flip,{once:true});const sc=setTimeout(flip,500);
  }

  function _play(key,loop,cb,_retry){
    _retry=_retry||0;_buf();loop=!!loop;
    if(!_vA){
      const v=$('#avatarVideo')||$('.hero video');if(!v){cb&&setTimeout(cb,50);return;}
      const url=clipURL(key);if(!url){cb&&setTimeout(cb,50);return;}
      v.onended=null;v.loop=loop;
      const go=()=>{v.play().catch(()=>{});if(!loop&&cb)v.onended=cb;};
      if(v.dataset.clip!==key){v.src=url;v.dataset.clip=key;v.load();v.addEventListener('canplay',go,{once:true});}
      else{v.currentTime=0;go();}return;
    }
    _vA.onended=null;
    if(_vA.dataset.clip===key){_vA.loop=loop;_vA.currentTime=0;_vA.play().catch(()=>{});if(!loop&&cb)_vA.onended=cb;return;}
    const url=clipURL(key);if(!url){log('⚠skip',key);cb&&setTimeout(cb,50);return;}
    if(_vB.dataset.clip===key&&_vB.readyState>=3){_swap(loop,cb);return;}
    if(_vB.dataset.clip!==key){_vBKey=key;_vB.src=url;_vB.dataset.clip=key;_vB.load();}
    let fired=false;
    function rdy(){if(fired)return;fired=true;clearTimeout(sf);_vB.removeEventListener('canplay',rdy);_vB.removeEventListener('canplaythrough',rdy);_swap(loop,cb);}
    _vB.addEventListener('canplay',rdy,{once:true});_vB.addEventListener('canplaythrough',rdy,{once:true});
    const delay=600+_retry*400;
    const sf=setTimeout(()=>{
      if(_retry<2){log('⚠ retry('+ (_retry+1)+'):',key);fired=true;_vBKey=null;_play(key,loop,cb,_retry+1);}
      else{log('⚠ max retries, proceeding:',key);rdy();}
    },delay);
  }

  function _seq(keys,cb){let i=0;function n(){if(_c)return;if(i>=keys.length){cb&&cb();return;}const k=keys[i++];if(i<keys.length)_pre(keys[i]);_play(k,false,n);}n();}
  function _seqS(steps,cb){
    let i=0;
    function n(){
      if(_c){Subs.stop();return;}
      if(i>=steps.length){Subs.linger();cb&&cb();return;}
      const st=steps[i++],ck=typeof st==='string'?st:st.clip,sk=typeof st==='string'?null:st.sub;
      if(i<steps.length){const nx=steps[i];_pre(typeof nx==='string'?nx:nx.clip);}
      Subs.pause();if(sk)Subs.start(sk);_play(ck,false,n);
    }
    n();
  }
  function _idle(onDone){let done=false;function s(){if(_c)return;_play('idleBreath',false,()=>{if(_c)return;if(!done&&onDone){done=true;onDone();}else s();});}s();}
  function _point(onAuto){
    if(_c)return;_pointing=true;let loops=0;_pre('pointingLeftIdle');
    _play('pointingLeftIn',false,()=>{
      if(_c)return;
      function lp(){if(_c)return;_play('pointingLeftIdle',false,()=>{if(_c)return;loops++;if(loops>=CFG.pointIdleLoops){_play('pointingLeftOut',false,()=>{if(_c)return;_pointing=false;_idle(null);onAuto&&onAuto();});}else lp();});}lp();
    });
  }

  return{
    init(){_buf();},
    cancel(){
      if(_extTl){try{_extTl.progress(1).kill();}catch(e){}_extTl=null;}
      _c=true;_pointing=false;_jumpNext=true;
      if(_vA){_vA.onended=null;_vA.loop=false;}
      if(_vB){gsap.killTweensOf(_vB);_vB.style.opacity='0';_vB.style.zIndex='1';}
      _vBKey=null;Subs.stop();
    },
    get isPointing(){return _pointing;},
    setSubTl(tl){_extTl=tl;if(tl)tl.eventCallback('onComplete',()=>{_extTl=null;});},

    /* pointOut: SM.LOCKED during animation, IDLE after → safe to call Scene.go in cb */
    pointOutThen(cb){
      if(_pointing){
        SM.set(SM.S.LOCKED,'pointOut');
        _c=true;_pointing=false;_jumpNext=true;
        if(_vA){_vA.loop=false;_vA.onended=null;}
        setTimeout(()=>{_c=false;_play('pointingLeftOut',false,()=>{SM.set(SM.S.IDLE,'pointOut done');cb&&cb();});},50);
      }else{cb&&cb();}
    },

    walkOut(cb){_c=false;_jumpNext=false;_pre('winterWalkIn');_play('walkOut',false,()=>{cb&&cb();});},
    walkIn(cb){_c=false;_jumpNext=false;_pre('p03s1');_play('walkIn',false,()=>{cb&&cb();});},
    intro(onPt){_c=false;_seqS(['walkIn',{clip:'idealKitchen',sub:'idealKitchen'}],()=>_point(onPt));},

    /* menuIntro: plays on every menu open; onAuto called after pointing idle loops */
    menuIntro(onAuto){_c=false;_seqS([{clip:'menuIntro',sub:'menuIntro'}],()=>_point(onAuto));},

    page01s0(cb){
      _c=false;_pre('p01s0');
      _seq(['winterWalkIn'],()=>{
        if(_c)return;_pre('winterWalkOut');Subs.start('p01s0');
        _play('p01s0',false,()=>{Subs.linger();if(_c)return;_seq(['winterWalkOut','walkIn'],()=>{if(_c)return;_idle(cb);});});
      });
    },
    page01s1(cb){this.cancel();setTimeout(()=>{_c=false;_pre('p01s1');_play('showsExplaining',false,()=>{if(_c)return;Subs.start('p01s1');_play('p01s1',false,()=>{Subs.linger();_idle(cb);});});},50);},
    page01s2(cb){this.cancel();setTimeout(()=>{_c=false;let b=0;function w(){if(_c)return;if(b<2){b++;_play('idleBreath',false,w);}else{_pre('p01s2a');_play('jump',false,()=>{if(_c)return;Subs.start('p01s2');_play('p01s2a',false,()=>{if(_c)return;_pre('p01s2b');Subs.pause();_play('p01s2b',false,()=>{Subs.linger();_idle(cb);});});});}}w();},50);},
    page01s3(cb){this.cancel();setTimeout(()=>{_c=false;Subs.start('p01s3');_play('p01s3',false,()=>{Subs.linger();_idle(cb);});},50);},
    page01s4(cb){this.cancel();setTimeout(()=>{_c=false;_pre('p01s4a');Subs.start('p01s4');_play('p01s4a',false,()=>{if(_c)return;_pre('p01s4b');Subs.pause();_play('p01s4b',false,()=>{Subs.linger();_idle(cb);});});},50);},
    page01ExitNormal(cb){this.cancel();setTimeout(()=>{_c=false;cb&&cb();},50);},

    page02(cb){
      _c=false;
      _seqS(['takeCoffeeIn',{clip:'p02s1',sub:'p02s1'},{clip:'p02s2',sub:'p02s2'},{clip:'p02s4a',sub:'p02s4'},'p02s4b',{clip:'p02s5',sub:'p02s5'},{clip:'p02s6',sub:'p02s6'}],()=>{
        if(_c)return;
        function doWalkOut(){_pre('walkOut');_play('walkOut',false,()=>{cb&&cb();});}
        if(Modal._stack.length>0){Modal._onAllClosed=()=>{if(_c)return;doWalkOut();};_idle(null);return;}
        doWalkOut();
      });
    },
    page03(cb){_c=false;_seqS([{clip:'p03s1',sub:'p03s1'},{clip:'p03s2',sub:'p03s2'},{clip:'p03s3',sub:'p03s3'},{clip:'p03s4',sub:'p03s4'}],()=>{_idle(cb);});},
    page04(cb){_c=false;_seqS([{clip:'p04CardIn',sub:'p04s1'},'cardOut'],()=>{_idle(null);cb&&cb();});},
    idleLoop(f){_c=false;_idle(f||null);},
    stopIdle(){this.cancel();},
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   §9  TRANSITIONS  — all durations/scales driven by CFG
   ═══════════════════════════════════════════════════════════════════════ */
const Trans=(()=>{
  let _tl=null;
  function _resetEl(el){if(!el)return;gsap.killTweensOf(el);gsap.set(el,{clearProps:'all'});}

  function run(ex,en,cb){
    SM.set(SM.S.TRANSITIONING,'Trans.run');
    if(_tl)_tl.kill();
    if(en){_resetEl(en);gsap.set(en,{display:'flex',autoAlpha:0});}
    const tl=gsap.timeline({onComplete:()=>{SM.set(SM.S.IDLE,'Trans.done');cb&&cb();}});
    _tl=tl;
    if(ex)tl.to(ex,{
      autoAlpha:0,
      scale:CFG.animations?CFG.transOutScale:1,
      rotateX:CFG.animations?5:0,
      transformOrigin:'50% 55%',
      filter:CFG.animations?`blur(${CFG.transBlur}px)`:'none',
      duration:CFG.transOutDur,
      ease:'power3.in',
      onComplete:()=>gsap.set(ex,{display:'none',clearProps:'scale,rotateX,filter,transformOrigin'}),
    });
    if(en)tl.fromTo(en,
      {autoAlpha:0,scale:CFG.animations?CFG.transInScale:1,rotateX:CFG.animations?-5:0,transformOrigin:'50% 55%',filter:CFG.animations?`blur(${CFG.transBlur}px)`:'none'},
      {autoAlpha:1,scale:1,rotateX:0,filter:'blur(0px)',duration:CFG.transInDur,ease:'power2.out',clearProps:'filter,rotateX,transformOrigin'},
      ex?`+=${CFG.transDelay}`:0
    );
  }

  return{run};
})();

function _mBtns(){const f=new Set();$$('.button-menu').forEach(e=>f.add(e));const m=menuEl();if(m)m.querySelectorAll('a[href],button').forEach(e=>f.add(e));return[...f];}

/* ═══════════════════════════════════════════════════════════════════════
   §10  INACTIVITY
   ═══════════════════════════════════════════════════════════════════════ */
const Inactivity=(()=>{
  let _t=null,_cb=null,_on=false,_sec=60;
  const evts=['mousemove','click','keydown','touchstart'];
  function act(){if(!_on)return;clearTimeout(_t);_t=setTimeout(()=>{_on=false;_cb&&_cb();},_sec*1000);}
  return{
    start(sec,cb){_sec=sec;_cb=cb;_on=true;clearTimeout(_t);_t=setTimeout(()=>{_on=false;cb&&cb();},sec*1000);evts.forEach(ev=>document.addEventListener(ev,act,{passive:true}));},
    stop(){_on=false;clearTimeout(_t);_t=null;_cb=null;evts.forEach(ev=>document.removeEventListener(ev,act));},
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   §11  SCENE
   KEY CHANGES:
   • _pageEl now tracks menu element when menu is active
   • _prevPageEl saves last scene page before menu opens
   • _openMenu(mode, onOpened): Trans.run exits current scene, enters menu
     → always calls Hero.menuIntro after transition
   • _closeMenu(cb, instant):
       instant=true  → reset state only; caller's _goPage handles menu exit
       instant=false → Trans.run exits menu, restores _prevPageEl
   ═══════════════════════════════════════════════════════════════════════ */
const Scene=(()=>{
  let cur=null;
  let _pageEl=null;        // current active scene element (including menu)
  let _prevPageEl=null;    // scene page saved before menu opened (for plain close)
  let _menuOpen=false;
  let menuMode='none';
  let p01Step=0,lastT=0,inP01=false;
  let _p02HeroOut=false;
  let _subTl=null;

  const cta={
    show:()=>gsap.to('.cta-btn',{autoAlpha:1,duration:0.4,pointerEvents:'auto',overwrite:true}),
    hide:()=>gsap.to('.cta-btn',{autoAlpha:0,duration:0.3,pointerEvents:'none',overwrite:true}),
  };

  /* Core page transition — exits _pageEl, enters nextEl */
  function _goPage(nextEl,cb){
    const ex=_pageEl;
    _pageEl=nextEl;
    Trans.run(ex,nextEl,cb||(()=>{}));
  }

  /* ── Open menu as a SCENE  ────────────────────────────────────────── */
  function _openMenu(mode,onOpened){
    if(_menuOpen)return;
    _menuOpen=true;menuMode=mode||'utility';
    document.body.classList.add('is-menu-open');
    const el=menuEl();if(!el)return;

    _prevPageEl=_pageEl; // save current scene for plain-close restoration

    _goPage(el,()=>{
      // Stagger menu buttons in after transition
      const btns=_mBtns();
      if(btns.length){
        gsap.fromTo(btns,
          {autoAlpha:0,y:18},
          {autoAlpha:1,y:0,stagger:0.08,duration:0.38,ease:'power2.out',delay:0.05,overwrite:'auto'}
        );
      }
      log('Menu open →',mode);
      onOpened&&onOpened();
    });
  }

  /* ── Close menu  ─────────────────────────────────────────────────────
     instant=true  : navigation is about to call _goPage (menu = exit target)
                     just reset state; DO NOT call Trans.run here
     instant=false : plain close from hamburger
                     Trans.run exits menu, enters _prevPageEl
  ─────────────────────────────────────────────────────────────────────── */
  function _closeMenu(cb,instant){
    if(!_menuOpen){cb&&cb();return;}
    _menuOpen=false;menuMode='none';
    document.body.classList.remove('is-menu-open');
    Inactivity.stop();
    const el=menuEl();
    if(!el){cb&&cb();return;}

    if(instant){
      // Let the upcoming Trans.run handle the visual exit of menu
      if(el)el.style.pointerEvents='none';
      cb&&cb();
    }else{
      // Restore previous scene
      const prev=_prevPageEl;_prevPageEl=null;
      // Fade out menu buttons before scene transition
      const btns=_mBtns();
      if(btns.length)gsap.to(btns,{autoAlpha:0,y:-10,duration:0.18,ease:'power2.in',stagger:0.04,overwrite:'auto'});
      _goPage(prev,cb||(()=>{}));
    }
  }

  /* Sub-scene TL management */
  function registerSubTl(tl){
    _subTl=tl;Hero.setSubTl(tl);
    if(tl)tl.eventCallback('onComplete',()=>{_subTl=null;});
  }
  function _flushSubTl(){
    if(_subTl){try{_subTl.progress(1).kill();}catch(e){}_subTl=null;}
  }

  /* ── PAGE 00 ─────────────────────────────────────────────────────── */
  function p00(){
    Hero.cancel();cta.hide();Subs.stop();inP01=false;Inactivity.stop();_p02HeroOut=false;
    const el=$('#PAGE-00-1');
    el.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play().catch(()=>{});});
    _goPage(el,()=>{Hero.intro(()=>{log('p00 auto → menu');_openMenu('narrative',_narrativeMenuOpened);});});
  }

  /* Shared handler for after narrative menu transition completes */
  function _narrativeMenuOpened(){
    Hero.menuIntro(()=>{
      if(_menuOpen&&menuMode==='narrative'){
        log('narrative auto → page01');
        _closeMenu(()=>{cur='page01';_doScene('page01',{});},true);
      }
    });
  }

  /* ── MENU NARRATIVE  ─────────────────────────────────────────────── */
  function menuNarrative(){
    Inactivity.stop();
    _openMenu('narrative',_narrativeMenuOpened);
  }

  /* ── MENU UTILITY  ───────────────────────────────────────────────── */
  function menuUtility(){
    Inactivity.stop();
    _openMenu('utility',()=>{
      // Hero always talks on menu open
      Hero.menuIntro(null); // no onAuto — just talk + point, then idle
      // Inactivity auto-advance
      if(CFG.menuInactivitySec>0){
        Inactivity.start(CFG.menuInactivitySec,()=>{
          if(_menuOpen){
            log('menu inactivity → page01');
            _closeMenu(()=>{cur='page01';_doScene('page01',{});},true);
          }
        });
      }
    });
  }

  /* ── PAGE 01  ────────────────────────────────────────────────────── */
  function p01(step){
    step=step||0;
    const heroAlreadyOut=_p02HeroOut;
    Hero.cancel();cta.show();Subs.stop();p01Step=step;inP01=true;Inactivity.stop();_p02HeroOut=false;
    if(step===0){
      setTimeout(()=>{
        if(heroAlreadyOut){
          _goPage($('#PAGE-01'),()=>showSub(0));
        }else{
          Hero.walkOut(()=>{_goPage($('#PAGE-01'),()=>showSub(0));});
        }
      },50);
    }else{
      _goPage($('#PAGE-01'),()=>showSub(step));
    }
  }

  const P01H=['page01s0','page01s1','page01s2','page01s3','page01s4'];

  function showSub(step){
    _flushSubTl();
    $$('.sub-scene').forEach((sc,i)=>{
      if(i===step){
        gsap.set(sc,{display:'flex',visibility:'visible'});
        gsap.fromTo(sc,
          {autoAlpha:0,scale:CFG.animations?1.02:1},
          {autoAlpha:1,scale:1,duration:0.5,ease:'power2.out'}
        );
        const inn=sc.querySelector('.sub-container,.container-52');
        if(inn&&CFG.animations)gsap.fromTo(inn,{autoAlpha:0,y:16},{autoAlpha:1,y:0,duration:0.6,delay:0.12});

        /* ── Stagger: wood species buttons ── */
        const woodBtns=sc.querySelectorAll('.btn-wood');
        if(woodBtns.length){
          gsap.fromTo(woodBtns,
            {autoAlpha:0,y:22,scale:0.88},
            {autoAlpha:1,y:0,scale:1,stagger:0.13,duration:0.55,delay:0.42,ease:'back.out(1.6)',overwrite:'auto'}
          );
        }
        /* ── Stagger: any other inner elements (p-text, images etc.) ── */
        const innerEls=sc.querySelectorAll('.p-text-gray,.p-text-white,.text-block');
        if(innerEls.length&&CFG.animations){
          gsap.fromTo(innerEls,
            {autoAlpha:0,x:-8},
            {autoAlpha:1,x:0,stagger:0.1,duration:0.5,delay:0.28,ease:'power2.out',overwrite:'auto'}
          );
        }
      }else{
        gsap.to(sc,{autoAlpha:0,duration:0.25,onComplete:()=>gsap.set(sc,{display:'none',visibility:'hidden'})});
      }
    });
    emitIX('sub-scene-'+step);
    if(step===0)$$('.sub-scene')[0]?.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play().catch(()=>{});});
    const m=P01H[step];
    if(m&&Hero[m]){
      const done=()=>{
        if(!inP01)return;
        const tot=$$('.sub-scene').length;
        if(p01Step<tot-1){p01Step++;showSub(p01Step);}
        else leaveP01(()=>_doScene('page02',{}));
      };
      setTimeout(()=>Hero[m](done),300);
    }
  }

  function nextStep(){
    const now=Date.now();if(now-lastT<CFG.stepThrottle)return;lastT=now;
    _flushSubTl();
    const tot=$$('.sub-scene').length;
    if(p01Step<tot-1){p01Step++;showSub(p01Step);}else leaveP01(()=>_doScene('page02',{}));
  }
  function leaveP01(cb){if(inP01){inP01=false;Hero.page01ExitNormal(cb);}else cb&&cb();}

  /* ── PAGE 02  ────────────────────────────────────────────────────── */
  function p02(){
    Hero.cancel();cta.show();Subs.stop();inP01=false;Inactivity.stop();_p02HeroOut=false;
    const el=$('#PAGE-02');
    _goPage(el,()=>{
      const h2=el.querySelector('.heading-style-2');
      if(h2&&CFG.animations)gsap.fromTo(h2,{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.7,delay:0.1});
      if(CFG.animations){
        gsap.fromTo('.container-38',{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:0.6,delay:0.3});
        gsap.fromTo('.container-39',{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:0.6,delay:0.4});
      }
      /* ── Stagger: kitchen cards ── */
      const cards=el.querySelectorAll('.card');
      if(cards.length){
        gsap.fromTo(cards,
          {autoAlpha:0,y:30,scale:0.95},
          {autoAlpha:1,y:0,scale:1,stagger:0.09,duration:0.58,delay:0.5,ease:'power2.out',overwrite:'auto'}
        );
      }
      initCards();
    });
    Hero.page02(()=>{
      if(cur!=='page02')return;
      _p02HeroOut=true;
      log('p02 hero out — user exploring');
      Hero.idleLoop(null);
      Inactivity.start(CFG.p02InactivitySec,()=>{log('p02 inactivity → p03');go('page03');});
    });
  }

  /* ── PAGE 03  ────────────────────────────────────────────────────── */
  function p03(){
    Hero.cancel();cta.show();Subs.stop();inP01=false;Inactivity.stop();_p02HeroOut=false;
    const el=$('#PAGE-03');
    _goPage(el,()=>{
      const h2=el.querySelector('.heading-style-2');
      if(h2&&CFG.animations)gsap.fromTo(h2,{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.7,delay:0.1});
      if(CFG.animations)gsap.fromTo('.container-53 .p-text-gray',{autoAlpha:0,x:-10},{autoAlpha:1,x:0,stagger:0.15,duration:0.5,delay:0.35});
    });
    Hero.page03(()=>_doScene('page04',{}));
  }

  /* ── PAGE 04  ────────────────────────────────────────────────────── */
  function p04(opts){
    Hero.cancel();cta.show();Subs.stop();inP01=false;Inactivity.stop();_p02HeroOut=false;
    const el=$('#PAGE-04');
    _goPage(el,()=>{
      const h2=el.querySelector('.heading-style-2');
      if(h2&&CFG.animations)gsap.fromTo(h2,{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.8,delay:0.1});
      if(CFG.animations){
        gsap.fromTo('.container-70 .p-text-white',{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:0.6,delay:0.3});
        gsap.fromTo('.container-70 .p-text-gray',{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:0.6,delay:0.45});
      }
      if(opts&&opts.openForm){const fm=$('.component-modal.form.contact');if(fm)setTimeout(()=>Modal.open(fm),300);}
    });
    Hero.page04(null);
  }

  function initCards(){
    const w=$('.cards-wrapper');if(!w||w.dataset.si)return;w.dataset.si='1';
    let dn=false,sx=0,sl=0;
    w.addEventListener('mousedown',e=>{dn=true;sx=e.pageX-w.offsetLeft;sl=w.scrollLeft;w.style.cursor='grabbing';});
    w.addEventListener('mouseleave',()=>{dn=false;w.style.cursor='';});
    w.addEventListener('mouseup',()=>{dn=false;w.style.cursor='';});
    w.addEventListener('mousemove',e=>{if(!dn)return;w.scrollLeft=sl-(e.pageX-w.offsetLeft-sx)*1.5;});
    $('.arrow-btn.left')?.addEventListener('click',()=>gsap.to(w,{scrollLeft:w.scrollLeft-320,duration:0.45}));
    $('.arrow-btn.right')?.addEventListener('click',()=>gsap.to(w,{scrollLeft:w.scrollLeft+320,duration:0.45}));
  }

  /* ── go: public navigation entry point  ──────────────────────────────
     If menu is open → _closeMenu(instant=true) then dispatch
     (instant=true means _pageEl is still menuEl; next _goPage exits it) */
  function go(name,opts){
    if(!SM.canNavigate()){log('[SM] ⛔ blocked →',name,'('+SM.state+')');return;}
    opts=opts||{};log('→',name);cur=name;
    if(_menuOpen&&name!=='menu'){
      _closeMenu(()=>{
        if(inP01&&name!=='page01')leaveP01(()=>_dispatch(name,opts));
        else _dispatch(name,opts);
      },true); // instant — Trans.run will handle the menu exit visually
      return;
    }
    if(inP01&&name!=='page01')leaveP01(()=>_dispatch(name,opts));
    else _dispatch(name,opts);
  }

  /* walkIn guard before scenes when hero was out of frame on p02 */
  function _dispatch(name,opts){
    Modal.closeAll();
    if(_p02HeroOut&&name!=='page02'&&name!=='page01'){
      _p02HeroOut=false;Inactivity.stop();
      SM.set(SM.S.LOCKED,'walkIn-pre');
      Hero.cancel();
      setTimeout(()=>{Hero.walkIn(()=>{SM.set(SM.S.IDLE,'walkIn done');_doScene(name,opts);});},50);
      return;
    }
    _doScene(name,opts);
  }

  function _doScene(name,opts){
    switch(name){
      case 'page00':p00();break;
      case 'menu':(opts&&opts.narrative)?menuNarrative():menuUtility();break;
      case 'page01':p01(opts&&opts.step);break;
      case 'page02':p02();break;
      case 'page03':p03();break;
      case 'page04':p04(opts);break;
    }
  }

  return{
    go,nextStep,registerSubTl,
    closeMenu:(cb)=>_closeMenu(cb,false),
    get current(){return cur;},
    get menuOpen(){return _menuOpen;},
    get menuMode(){return menuMode;},
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   §12  MODAL
   ═══════════════════════════════════════════════════════════════════════ */
const Modal={
  _stack:[],_onAllClosed:null,
  open(el){
    if(!el)return;this._stack.push(el);
    const f=el.querySelector('iframe[data-matterport-src]')||el.querySelector('iframe');
    if(f){if(!f.dataset.matterportSrc&&f.src&&f.src!=='about:blank')f.dataset.matterportSrc=f.src;if(!f.src||f.src==='about:blank')f.src=f.dataset.matterportSrc;}
    gsap.set(el,{display:'flex'});
    gsap.fromTo(el,{autoAlpha:0,scale:0.97,y:12},{autoAlpha:1,scale:1,y:0,duration:0.40,ease:'power3.out'});
  },
  close(el){
    el=el||this._stack[this._stack.length-1];if(!el)return;
    const i=this._stack.indexOf(el);if(i>-1)this._stack.splice(i,1);
    gsap.to(el,{autoAlpha:0,scale:0.97,y:8,duration:0.28,ease:'power2.in',onComplete:()=>{
      gsap.set(el,{display:'none',clearProps:'scale,y'});
      const f=el.querySelector('iframe');if(f)f.src='about:blank';
      if(el.classList.contains('contact'))gsap.to('.cta-btn',{pointerEvents:'auto',overwrite:true});
      if(this._stack.length===0&&this._onAllClosed){const fn=this._onAllClosed;this._onAllClosed=null;fn();}
    }});
  },
  closeAll(){
    const it=[...this._stack];this._stack=[];
    it.forEach(el=>{gsap.to(el,{autoAlpha:0,scale:0.97,duration:0.28,ease:'power2.in',onComplete:()=>{gsap.set(el,{display:'none',clearProps:'scale,y,visibility'});const f=el.querySelector('iframe');if(f)f.src='about:blank';}});});
    if(this._onAllClosed){const fn=this._onAllClosed;this._onAllClosed=null;fn();}
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   §13  CARD MAP
   ═══════════════════════════════════════════════════════════════════════ */
const CMAP={
  'Atlante & Floral Kitchen':'Atlante-Floral-Kitchen','Levante Kitchen':'Levante',
  'Archetipo Kitchen':'Archetipo-Kitchen','Living & Living Design Kitchen':'Living-Living-Design-Kitchen',
  'Atlante Kitchen':'Atlante-Kitchen','Atlante Wall Boiserie System':'Atlante-Wall',
  'Wine Cellar & Closet':'wine-closet','Custom Closets':'Custom-Closets',
};

/* ═══════════════════════════════════════════════════════════════════════
   §14  EVENTS
   ═══════════════════════════════════════════════════════════════════════ */
function bindEvents(){
  // Logo → restart page00
  ['#logo','.nav-logo','.w-nav-brand'].forEach(sel=>
    $$(sel).forEach(b=>b.addEventListener('click',debounce(e=>{e.preventDefault();Scene.go('page00');})))
  );

  // btn-begin → pointOut if pointing, then open narrative menu
  $('#btn-begin')?.addEventListener('click',debounce(e=>{
    e.preventDefault();
    Hero.pointOutThen(()=>Scene.go('menu',{narrative:true}));
  }));

  /* ── Hamburger  ───────────────────────────────────────────────────────
     OPEN  → pointOut if pointing, then open menu (no pointOut if not pointing)
     CLOSE → plain instant close, NO pointOut ever
  ─────────────────────────────────────────────────────────────────────── */
  $$('.menu-button,.w-nav-button').forEach(b=>b.addEventListener('click',debounce(e=>{
    e.preventDefault();
    if(Scene.menuOpen){
      // Plain close — no hero interaction
      Scene.closeMenu();
    }else{
      // Opening — pointOut only if hero is currently pointing
      Hero.pointOutThen(()=>Scene.go('menu',{}));
    }
  })));

  /* ── Menu nav buttons  ────────────────────────────────────────────────
     pointOut before navigating so pointingLeftOut plays visibly
  ─────────────────────────────────────────────────────────────────────── */
  const MDEST={'#PAGE-01':'page01','#PAGE-02':'page02','#PAGE-03':'page03','#PAGE-04':'page04'};
  function bindMBtn(b){
    if(b.dataset.ghBound)return;b.dataset.ghBound='1';
    const dest=MDEST[b.getAttribute('href')];if(!dest)return;
    b.addEventListener('click',debounce(e=>{
      e.preventDefault();
      // pointOut → then navigate (pointOutThen is instant if not pointing)
      Hero.pointOutThen(()=>Scene.go(dest));
    }));
    log('Menu btn →',dest);
  }
  $$('.button-menu').forEach(bindMBtn);
  const mel=menuEl();if(mel)mel.querySelectorAll('a[href]').forEach(bindMBtn);
  document.body.addEventListener('is-menu-open',()=>{$$('.button-menu').forEach(bindMBtn);if(mel)mel.querySelectorAll('a[href]').forEach(bindMBtn);});

  /* ── CTA button  ──────────────────────────────────────────────────────
     If already on page04 → just open form modal (no re-transition / black flash)
     Otherwise → go to page04 and auto-open form
  ─────────────────────────────────────────────────────────────────────── */
  $$('#btn-consult,#CTA-BTN,.button-cta').forEach(b=>b.addEventListener('click',debounce(e=>{
    e.preventDefault();
    if(Scene.current==='page04'){
      // Already on page04 — just open the form, nothing else
      const fm=$('.component-modal.form.contact');
      if(fm&&!Modal._stack.includes(fm))Modal.open(fm);
    }else{
      Scene.go('page04',{openForm:true});
    }
  })));

  $$('.btn-section').forEach(b=>{
    const href=b.getAttribute('href')||'';
    b.addEventListener('click',debounce(e=>{
      e.preventDefault();
      if(/sub-scene/.test(href))Scene.nextStep();
      else{const d={'#PAGE-02':'page02','#PAGE-03':'page03','#PAGE-04':'page04'}[href];if(d)Scene.go(d);}
    }));
  });

  let hT;
  $$('.card').forEach(card=>{
    card.addEventListener('click',e=>{
      e.preventDefault();
      const nm=card.querySelector('.text-42')?.textContent.trim()||'';
      const id=CMAP[nm];if(id)Modal.open(document.getElementById(id));
    });
    card.addEventListener('mouseenter',()=>{const nm=card.querySelector('.text-42')?.textContent||'';hT=setTimeout(()=>Subs.flash(`Let me tell you about ${nm}…`),400);});
    card.addEventListener('mouseleave',()=>{clearTimeout(hT);Subs.hide();});
  });

  // Modal close buttons
  $$('.uui-banner16_close-button.modal:not(.wood)').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();Modal.close(b.closest('.modal-card-wrapper'));}));

  // Wood species buttons — click to open wood modal
  $$('.btn-wood').forEach(b=>{
    b.addEventListener('click',e=>{
      e.preventDefault();
      const src=(b.querySelector('.wood-img')?.src||'').toLowerCase();
      let cls='oak';
      if(src.includes('ash'))cls='ash';
      else if(src.includes('walnut'))cls='walnut';
      else if(src.includes('cherry'))cls='cherry';
      const m=document.querySelector(`.component-modal.wood.${cls}`);if(m)Modal.open(m);
    });
  });

  $$('.uui-banner16_close-button.modal.wood').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();Modal.close(b.closest('.component-modal.wood'));}));
  $$('.component-modal.form.contact [data-modal-close],.component-modal.form.contact .modal-close').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();Modal.close($('.component-modal.form.contact'));}));
  $('#PAGE-04 a[data-w-id="36f29b75-6a30-7189-ab83-c08f1713118a"]')?.addEventListener('click',e=>{
    e.preventDefault();
    const ch=$('.component-modal.form:not(.contact)');
    if(ch)gsap.to(ch,{autoAlpha:0,duration:0.2,onComplete:()=>gsap.set(ch,{display:'none'})});
    const fm=$('.component-modal.form.contact');if(fm)Modal.open(fm);
  });
  $('#subtitle-close-btn')?.addEventListener('click',e=>{e.preventDefault();Subs.stop();});
  $('#subtitles-open-btn')?.addEventListener('click',e=>{e.preventDefault();($('#subtitles')||$('.subtitles'))?.classList.add('show');});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(Modal._stack.length)Modal.closeAll();else if(Scene.menuOpen)Scene.closeMenu();}
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   §15  INPUT (scroll/touch/key for page01 step advance)
   ═══════════════════════════════════════════════════════════════════════ */
function bindInputs(){
  document.addEventListener('wheel',e=>{if(Scene.current!=='page01')return;if(e.deltaY>30)Scene.nextStep();},{passive:true});
  let ty=0;
  document.addEventListener('touchstart',e=>{ty=e.touches[0].clientY;},{passive:true});
  document.addEventListener('touchend',e=>{if(Scene.current!=='page01')return;if(ty-e.changedTouches[0].clientY>50)Scene.nextStep();});
  document.addEventListener('keydown',e=>{if((e.key==='ArrowDown'||e.key==='ArrowRight')&&Scene.current==='page01')Scene.nextStep();});
}

/* ═══════════════════════════════════════════════════════════════════════
   §16  CSS INJECTION
   ═══════════════════════════════════════════════════════════════════════ */
function injectCSS(){
  const s=document.createElement('style');
  s.textContent=`
    body{overflow:hidden;}

    /* Scene pages */
    #PAGE-00-1,#PAGE-01,#PAGE-02,#PAGE-03,#PAGE-04{
      position:fixed;inset:0;z-index:1;
      display:none;opacity:0;visibility:hidden;
      perspective:1200px;transform-style:preserve-3d;
    }
    #PAGE-00-1{display:flex;opacity:1;visibility:visible;}

    /* Menu — treated as a scene (same stacking as pages, z-index:5 clears during Trans.run) */
    #PAGE-00-2,.menu-wrapper{
      display:none;opacity:0;visibility:hidden;pointer-events:none;
      position:fixed!important;inset:0!important;z-index:5!important;
    }
    body.is-menu-open #PAGE-00-2,
    body.is-menu-open .menu-wrapper{pointer-events:auto;}
    #PAGE-00-2 a,#PAGE-00-2 button,
    .menu-wrapper a,.menu-wrapper button,.button-menu{
      pointer-events:auto!important;cursor:pointer!important;
    }

    /* Hamburger icon — rotates when menu is open (Webflow IX compat) */
    .menu-button .w-icon-nav-menu,
    .w-nav-button .w-icon-nav-menu{
      transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);
    }
    body.is-menu-open .menu-button .w-icon-nav-menu,
    body.is-menu-open .w-nav-button .w-icon-nav-menu{
      transform:rotate(90deg);
    }

    .nav-bar{position:fixed;top:0;left:0;right:0;z-index:200;}
    .hero,.img---the-narratormask-group{pointer-events:none;}
    .cta-btn{opacity:0;visibility:hidden;pointer-events:none;}
    .hero,.hero-wrapper,.img---the-narratormask-group,
    #avatarVideo,#avatarVideo_standby{
      overflow:visible!important;clip-path:none!important;
    }

    /* Modals — wood modals get same treatment as contact form
       position/layout comes from Webflow; we only manage display & visibility */
    .modal-card-wrapper{display:none;opacity:0;}
    .component-modal.wood{
      position:fixed!important;inset:0!important;
      z-index:1000!important;display:none;opacity:0;visibility:hidden;
    }
    .component-modal.form{
      position:fixed!important;inset:0!important;
      z-index:1000!important;display:none;opacity:0;visibility:hidden;
    }

    .sub-scene{display:none;opacity:0;visibility:hidden;}

    /* Subtitles */
    #subtitle-text,.subtitle-text{display:block;will-change:transform,opacity;}
    @keyframes ghSubIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes ghSubOut{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-6px)}}
    #subtitle-text.sub-in,.subtitle-text.sub-in{animation:ghSubIn 0.38s cubic-bezier(0.22,0.61,0.36,1) both;}
    #subtitle-text.sub-out,.subtitle-text.sub-out{animation:ghSubOut 0.20s ease-in both;}
  `;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════════════════
   §17  TELEPORT — move modals to <body> for correct stacking
        Wood modals: only override display/visibility (position = Webflow)
        Contact form modal: same treatment
   ═══════════════════════════════════════════════════════════════════════ */
function teleport(){
  document.querySelectorAll('.component-modal.wood').forEach(m=>{
    if(m.parentElement===document.body)return;
    document.body.appendChild(m);
    // Only set initial hidden state — CSS rule handles position/z-index
    gsap.set(m,{display:'none',autoAlpha:0});
  });
  const fm=$('.component-modal.form.contact');
  if(fm&&fm.parentElement!==document.body){
    document.body.appendChild(fm);
    gsap.set(fm,{display:'none',autoAlpha:0});
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   §18  BOOT
   ═══════════════════════════════════════════════════════════════════════ */
function boot(){
  if(typeof gsap==='undefined'){console.error('[GH] GSAP missing');return;}
  gsap.registerPlugin(ScrollTrigger);

  // Lazy-load Matterport iframes
  $$('.modal-card-wrapper iframe,.modal-card-wrapper .kitchen iframe').forEach(f=>{
    if(!f.dataset.matterportSrc&&f.src&&f.src!=='about:blank'){
      f.dataset.matterportSrc=f.src;f.src='about:blank';
    }
  });

  injectCSS();
  teleport();
  Hero.init();

  // Prime menu element — hidden but display:flex so GSAP autoAlpha works
  const m=menuEl();
  if(m)gsap.set(m,{display:'flex',autoAlpha:0,pointerEvents:'none'});

  // Prime subtitles bar
  const sb=$('#subtitles')||$('.subtitles');
  if(sb)gsap.set(sb,{autoAlpha:0});

  bindEvents();
  bindInputs();
  initMusic();
  Scene.go('page00');

  log('Ready ✓ v8.0  format=%s  transOut=%ss  transIn=%ss',
    FMT.toUpperCase(), CFG.transOutDur, CFG.transInDur);
}

document.readyState==='loading'
  ? document.addEventListener('DOMContentLoaded',boot)
  : boot();

})();
</script>
