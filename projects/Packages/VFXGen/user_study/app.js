'use strict';
(() => {
  const data=window.STUDY_DATA, cases=data.cases, letters=['A','B','C','D'];
  const metrics=['overall_quality','image_alignment','text_alignment'];
  const questionKeys={overall_quality:'overallQuestion',image_alignment:'imageQuestion',text_alignment:'textQuestion'};
  const shortKeys={overall_quality:'bestOverall',image_alignment:'bestImage',text_alignment:'bestText'};
  const badgeKeys={overall_quality:'badgeOverall',image_alignment:'badgeImage',text_alignment:'badgeText'};
  const $=id=>document.getElementById(id), storageKey='vfx-study-demo:'+data.version, languageKey='vfx-study-language';
  let language='zh';
  try {if(localStorage.getItem(languageKey)==='en')language='en';} catch (_) {}
  const bindings=new Map();
  function t(key, values={}) {
    const pair=window.STUDY_TEXT[key];
    if(!pair)throw new Error('Missing translation: '+key);
    const variables={total:cases.length,totalAnswers:cases.length*metrics.length,...values};
    return pair[language==='en'?1:0].replace(/\{(\w+)\}/g,(_,k)=>String(variables[k]??''));
  }
  function bind(target,key,values={}) {
    const node=typeof target==='string'?$(target):target;
    bindings.set(node,{key,values});node.textContent=t(key,values);
  }
  const googleEndpoint=String(window.STUDY_CONFIG?.appsScriptUrl||'').trim();
  const usingGoogle=!!googleEndpoint, endpoint=googleEndpoint;
  const destination=endpoint?new URL(endpoint,location.href).href:'';
  let state, timer, sending=false, entered=0, visible=false, activeScreen='intro', renderId=0;
  let mediaReady=new Set(),mediaErrors=new Set();
  let activeMetric=null,drag=null,suppressMetricClick=false;
  let tutorialPaused=false;
  const shuffle=items=>{const a=items.slice();for(let i=a.length-1;i>0;i--){const r=new Uint32Array(1);crypto.getRandomValues(r);const j=r[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  const token=()=>{const b=new Uint8Array(8);crypto.getRandomValues(b);return Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');};
  function fresh(){
    const base=shuffle([0,1,2,3]),offsets=shuffle(cases.map((_,i)=>i%4));
    return {version:data.version,session_id:token(),started_at:new Date().toISOString(),finished_at:null,index:0,revision:0,submitted_revision:null,language_started:language,
      assignments:Object.fromEntries(cases.map((c,i)=>[c.id,base.map(j=>c.videos[(j+offsets[i])%4].id)])),answers:{},trial_languages:{},seconds:{},tutorial_seen:false};
  }
  function valid(s){
    return s&&s.version===data.version&&/^[a-f0-9]{16}$/.test(s.session_id)&&Number.isInteger(s.index)&&s.index>=0&&s.index<cases.length&&Number.isInteger(s.revision)&&s.revision>=0&&
      ['zh','en'].includes(s.language_started)&&s.answers&&s.trial_languages&&s.seconds&&cases.every(c=>{
        const ids=s.assignments?.[c.id],answers=s.answers[c.id]||{};
        return ids?.length===4&&new Set(ids).size===4&&ids.every(id=>c.videos.some(v=>v.id===id))&&typeof answers==='object'&&!Array.isArray(answers)&&Object.keys(answers).every(m=>metrics.includes(m)&&ids.includes(answers[m]));
      });
  }
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(valid(saved))state=saved;}catch(_){}
  const hasSaved=!!state;state||=fresh();
  function trialComplete(c){return metrics.every(m=>state.assignments[c.id].includes(state.answers[c.id]?.[m]));}
  const allComplete=()=>cases.every(trialComplete);
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));bind('saveStatus','saved');}catch(_){bind('saveStatus','saveFailed');}}
  function account(){if(visible&&entered){const c=cases[state.index];state.seconds[c.id]=(state.seconds[c.id]||0)+(performance.now()-entered)/1000;}entered=performance.now();}
  function stop(){document.querySelectorAll('video').forEach(v=>v.pause());}
  function screen(name){cancelDrag();activeMetric=null;activeScreen=name;document.body.dataset.screen=name;for(const id of ['intro','tutorial','study','done'])$(id).hidden=id!==name;$('progress').hidden=!['study','done'].includes(name);visible=name==='study'&&!document.hidden;entered=performance.now();}
  function progress(){
    const count=cases.filter(trialComplete).length;
    $('progressText').textContent=activeScreen==='done'?cases.length+' / '+cases.length:(state.index+1)+' / '+cases.length;
    $('steps').replaceChildren(...cases.map((c,i)=>{const el=document.createElement('i');el.className=trialComplete(c)?'complete':i===state.index?'current':'';return el;}));
    $('progress').setAttribute('aria-label',t('progressAria',{count,total:cases.length}));
  }
  function updateCaseText(){
    if(activeScreen!=='study')return;
    const c=cases[state.index];
    bind('caseLabel','caseLabel',{number:String(state.index+1).padStart(2,'0'),total:cases.length});
    bind('sourceCaseLabel','sourceCaseLabel',{source:String(c.number).padStart(3,'0')});
    $('caseTitle').textContent=language==='zh'?(c.title_zh||c.title):c.title;
    $('prompt').textContent=language==='zh'?(c.prompt_zh||c.prompt):c.prompt;
    $('prompt').lang=language==='zh'?'zh-CN':'en';$('promptNote').hidden=language==='en';
    $('referenceImage').alt=t('reference');
    document.querySelectorAll('video').forEach((video,i)=>video.setAttribute('aria-label',t('candidate',{letter:letters[i]})));
    document.querySelectorAll('button[data-metric]').forEach(button=>button.setAttribute('aria-label',t('chooseLabel',{metric:t(button.dataset.metric),letter:button.dataset.letter})));
    document.querySelectorAll('[data-drag-metric]').forEach(button=>{button.setAttribute('aria-label',t('dragMetric',{metric:t(shortKeys[button.dataset.dragMetric])}));button.title=t(questionKeys[button.dataset.dragMetric]);});
  }
  function refreshResume(){
    if(!hasSaved&&state.revision===0)return;
    bind('startTitle',allComplete()?'doneTitle':'resumeTitle');
    const answers=cases.reduce((sum,c)=>sum+metrics.filter(m=>!!state.answers[c.id]?.[m]).length,0);
    bind('resumeText','resumeProgress',{count:cases.filter(trialComplete).length,total:cases.length,answers});
    bind('start',allComplete()?'viewStatus':'continue');$('reset').hidden=false;
  }
  function applyLanguage(){
    document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=t('studyName');$('languageSelect').value=language;
    document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
    document.querySelectorAll('[data-i18n-aria]').forEach(node=>node.setAttribute('aria-label',t(node.dataset.i18nAria)));
    for(const [node,binding] of bindings){if(!node.isConnected){bindings.delete(node);continue;}node.textContent=t(binding.key,binding.values);}
    updateCaseText();refreshResume();progress();
    if(activeScreen==='study')paint();
  }
  function paint(){
    const c=cases[state.index],answers=state.answers[c.id]||{},ready=mediaReady.size===4&&!mediaErrors.size;
    document.querySelectorAll('button[data-metric]').forEach(button=>{
      const selected=answers[button.dataset.metric]===button.dataset.choice;
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=!ready;
    });
    metrics.forEach(m=>{const row=$('metric-'+m);if(row){row.classList.toggle('answered',!!answers[m]);row.classList.toggle('active-metric',activeMetric===m);}});
    document.querySelectorAll('.metric-chip').forEach(button=>{button.disabled=!ready;button.setAttribute('aria-pressed',String(activeMetric===button.dataset.dragMetric));});
    document.querySelectorAll('.video-card').forEach(card=>{
      const chosen=metrics.filter(m=>answers[m]===card.dataset.choice),badges=card.querySelector('.candidate-marks');
      // Keep badge nodes stable while dragging or navigating with a keyboard.
      metrics.forEach(m=>{const badge=badges.querySelector('[data-drag-metric="'+m+'"]');badge.hidden=!chosen.includes(m);badge.disabled=!ready;badge.setAttribute('aria-pressed',String(activeMetric===m));});
      card.querySelector('.no-marks').hidden=chosen.length>0;
      card.classList.toggle('has-marks',chosen.length>0);
      const target=card.querySelector('.assign-here');target.hidden=!activeMetric;target.disabled=!ready;
      if(activeMetric){bind(target,'assignHere');target.setAttribute('aria-label',t('chooseLabel',{metric:t(shortKeys[activeMetric]),letter:card.dataset.letter}));}
    });
    bind('interactionHint',activeMetric?'tapCandidate':'interactionHint',activeMetric?{metric:t(shortKeys[activeMetric])}:{});
    bind('answeredCount','answeredCount',{count:metrics.filter(m=>!!answers[m]).length});
    $('next').disabled=!trialComplete(c)||!ready;
    bind('next',state.index===cases.length-1?'finish':'next');
  }
  function mediaStatus(){
    bind('mediaStatus',mediaErrors.size?'mediaError':mediaReady.size===4?'mediaReady':'mediaLoading');
    $('reloadMedia').hidden=!mediaErrors.size;paint();
  }
  function canChoose(){return !sending&&activeScreen==='study'&&mediaReady.size===4&&!mediaErrors.size;}
  function selectMetric(metric){
    if(!canChoose())return;
    clearTimeout(timer);activeMetric=activeMetric===metric?null:metric;paint();
    bind('choiceStatus',trialComplete(cases[state.index])?'readyToAdvance':'completeRemaining');
  }
  function metricControl(button,metric){
    button.type='button';button.dataset.dragMetric=metric;
    button.onclick=()=>{if(suppressMetricClick){suppressMetricClick=false;return;}selectMetric(metric);};
    button.addEventListener('pointerdown',event=>{
      if(!canChoose()||event.isPrimary===false||event.button!==0||drag)return;
      suppressMetricClick=false;clearTimeout(timer);
      bind('choiceStatus',trialComplete(cases[state.index])?'readyToAdvance':'completeRemaining');
      drag={metric,button,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,target:null,ghost:null};
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('lostpointercapture',()=>cancelDrag());
  }
  function cancelDrag(){
    if(!drag)return;const current=drag;drag=null;
    if(current.frame)cancelAnimationFrame(current.frame);
    current.ghost?.remove();document.body.classList.remove('dragging-metric');
    document.querySelectorAll('.drop-hover').forEach(card=>card.classList.remove('drop-hover'));
    if(current.button.hasPointerCapture?.(current.pointerId))current.button.releasePointerCapture(current.pointerId);
  }
  function dropTarget(event){
    const card=document.elementFromPoint?.(event.clientX,event.clientY)?.closest('.video-card');
    return card&&$('videoGrid').contains(card)?card:null;
  }
  function scrollDuringDrag(){
    if(!drag?.moved)return;
    const edge=56,y=drag.clientY;
    const step=y<edge?-Math.ceil((edge-y)/5):y>innerHeight-edge?Math.ceil((y-innerHeight+edge)/5):0;
    if(step&&document.documentElement.scrollHeight>innerHeight){
      window.scrollBy(0,Math.max(-14,Math.min(14,step)));
      const target=dropTarget(drag);
      if(drag.target!==target){drag.target?.classList.remove('drop-hover');target?.classList.add('drop-hover');drag.target=target;}
    }
    drag.frame=requestAnimationFrame(scrollDuringDrag);
  }
  document.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    event.preventDefault();
    drag.clientX=event.clientX;drag.clientY=event.clientY;
    if(!drag.moved){drag.moved=true;drag.ghost=document.createElement('div');drag.ghost.className='metric-ghost';drag.ghost.textContent=t(shortKeys[drag.metric]);document.body.append(drag.ghost);document.body.classList.add('dragging-metric');drag.frame=requestAnimationFrame(scrollDuringDrag);}
    drag.ghost.style.left=Math.max(8,Math.min(event.clientX+14,window.innerWidth-drag.ghost.offsetWidth-8))+'px';
    drag.ghost.style.top=Math.max(8,Math.min(event.clientY-42,window.innerHeight-42))+'px';
    const target=dropTarget(event);if(drag.target!==target){drag.target?.classList.remove('drop-hover');target?.classList.add('drop-hover');drag.target=target;}
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const {metric,moved}=drag,target=dropTarget(event);cancelDrag();
    if(moved){event.preventDefault();suppressMetricClick=true;setTimeout(()=>suppressMetricClick=false,0);if(target)choose(metric,target.dataset.choice);}
  });
  document.addEventListener('pointercancel',cancelDrag);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelDrag();activeMetric=null;if(activeScreen==='study')paint();}});
  function render(){
    clearTimeout(timer);stop();const currentRender=++renderId;mediaReady=new Set();mediaErrors=new Set();screen('study');
    const c=cases[state.index];$('referenceImage').src=c.image;$('referenceLink').href=c.image;
    $('videoGrid').replaceChildren();$('metricRows').replaceChildren();
    state.assignments[c.id].forEach((id,i)=>{
      const source=c.videos.find(v=>v.id===id),card=document.createElement('article');card.className='video-card';card.dataset.choice=id;card.dataset.letter=letters[i];
      const stage=document.createElement('div');stage.className='video-stage';
      const video=document.createElement('video');video.controls=true;video.muted=true;video.playsInline=true;video.loop=true;video.preload='auto';
      const label=document.createElement('span');label.className='video-label';label.textContent=letters[i];stage.append(video,label);
      const target=document.createElement('button');target.type='button';target.className='assign-here';target.hidden=true;target.onclick=()=>{if(activeMetric)choose(activeMetric,id);};stage.append(target);
      const footer=document.createElement('div');footer.className='video-footer candidate-marks';
      const empty=document.createElement('span');empty.className='no-marks';bind(empty,'noMarks');footer.append(empty);
      metrics.forEach(metric=>{const badge=document.createElement('button');badge.className='assigned-metric';badge.hidden=true;metricControl(badge,metric);bind(badge,badgeKeys[metric]);footer.append(badge);});
      card.append(stage,footer);$('videoGrid').append(card);
      video.addEventListener('loadeddata',()=>{if(currentRender!==renderId)return;mediaReady.add(id);mediaErrors.delete(id);mediaStatus();});
      video.addEventListener('error',()=>{if(currentRender!==renderId)return;mediaErrors.add(id);mediaReady.delete(id);mediaStatus();});
      video.src=source.url;
    });
    metrics.forEach(metric=>{
      const row=document.createElement('fieldset');row.id='metric-'+metric;row.className='metric-row';
      const legend=document.createElement('legend');legend.className='visually-hidden';bind(legend,metric);
      const inner=document.createElement('div');inner.className='metric-row-inner';
      const chip=document.createElement('button');chip.className='metric-chip';chip.id='question-'+metric;metricControl(chip,metric);bind(chip,shortKeys[metric]);
      const choices=document.createElement('div');choices.className='answers';choices.setAttribute('role','group');choices.setAttribute('aria-labelledby',chip.id);
      state.assignments[c.id].forEach((id,i)=>{
        const button=document.createElement('button');button.type='button';button.textContent=letters[i];button.dataset.metric=metric;button.dataset.choice=id;button.dataset.letter=letters[i];
        button.onclick=()=>choose(metric,id);choices.append(button);
      });
      inner.append(chip,choices);row.append(legend,inner);$('metricRows').append(row);
    });
    $('back').disabled=state.index===0;bind('choiceStatus',trialComplete(c)?'readyToAdvance':'completeRemaining');
    updateCaseText();progress();mediaStatus();window.scrollTo({top:0});
  }
  function choose(metric,id){
    if(sending||activeScreen!=='study'||mediaReady.size!==4||mediaErrors.size||!metrics.includes(metric))return;
    const c=cases[state.index];if(!state.assignments[c.id].includes(id))return;
    account();clearTimeout(timer);activeMetric=null;state.answers[c.id]||={};
    if(state.answers[c.id][metric]!==id){state.answers[c.id][metric]=id;state.revision++;state.finished_at=null;state.trial_languages[c.id]=language;}
    save();paint();progress();
    if(trialComplete(c)){
      bind('choiceStatus',state.index===cases.length-1?'submitPending':'advancePending');
      timer=setTimeout(advance,state.index===cases.length-1?1500:1100);
    }else bind('choiceStatus','completeRemaining');
  }
  function advance(){
    clearTimeout(timer);
    if(sending||activeScreen!=='study'||!trialComplete(cases[state.index])||mediaReady.size!==4||mediaErrors.size)return;
    account();
    if(state.index===cases.length-1){if(allComplete())finish();}
    else{state.index++;save();render();}
  }
  async function play(reset){
    const nodes=[...document.querySelectorAll('video')];if(reset)nodes.forEach(v=>v.currentTime=0);
    const results=await Promise.allSettled(nodes.map(v=>v.play()));if(results.some(r=>r.status==='rejected'))bind('mediaStatus','playError');
  }
  function payload(){return {version:state.version,session_id:state.session_id,revision:state.revision,started_at:state.started_at,finished_at:state.finished_at,
    language_started:state.language_started,language_completed:language,
    trials:cases.map(c=>({case_id:c.id,shown:state.assignments[c.id],choices:{...state.answers[c.id]},seconds:Math.round((state.seconds[c.id]||0)*10)/10,language:state.trial_languages[c.id]||language}))};}
  function message(title,detail){bind('submitStatus',title);bind('submitDetail',detail);}
  async function submit(){
    if(sending||!allComplete())return;$('retry').hidden=true;
    if(state.submitted_revision===state.revision&&state.submitted_endpoint===destination){message('success','successDetail');return;}
    if(!endpoint){message('noEndpoint','noEndpointDetail');return;}
    sending=true;$('review').disabled=true;message('submitting','submittingDetail');
    const body=payload(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      if(usingGoogle){
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))throw new Error('Invalid collector URL');
        const response=await fetch(endpoint,{cache:'no-store',redirect:'follow',signal:controller.signal});
        const health=await response.json();
        if(!response.ok||health.version!==data.version||health.case_count!==cases.length||!metrics.every(m=>health.metrics?.includes(m))){const error=new Error('Collector update required');error.code='UPDATE_REQUIRED';throw error;}
      }
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':usingGoogle?'text/plain;charset=utf-8':'application/json'},body:JSON.stringify(body),redirect:'follow',signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.ok!==true||result.version!==data.version||result.session_id!==body.session_id||result.revision!==body.revision)throw new Error('Invalid acknowledgement');
      state.submitted_revision=body.revision;state.submitted_endpoint=destination;save();message('success','successDetail');
    }catch(error){
      message(error.code==='UPDATE_REQUIRED'?'backendUpdate':'submitFailed',error.code==='UPDATE_REQUIRED'?'backendUpdateDetail':'submitFailedDetail');$('retry').hidden=false;
    }finally{clearTimeout(timeout);sending=false;$('review').disabled=false;}
  }
  function finish(){
    if(!allComplete())return;clearTimeout(timer);account();stop();state.finished_at||=new Date().toISOString();save();screen('done');progress();
    $('participantCode').textContent=state.session_id.toUpperCase();submit();window.scrollTo({top:0});
  }
  $('languageSelect').onchange=()=>{
    account();clearTimeout(timer);cancelDrag();language=$('languageSelect').value==='en'?'en':'zh';
    try{localStorage.setItem(languageKey,language);}catch(_){}
    if(state.revision===0)state.language_started=language;
    applyLanguage();if(activeScreen==='study')bind('choiceStatus',trialComplete(cases[state.index])?'readyToAdvance':'completeRemaining');save();
  };
  function beginStudy(){if(allComplete())finish();else{state.index=cases.findIndex(c=>!trialComplete(c));save();render();}}
  function updateTutorialMotion(){
    $('tutorial').classList.toggle('tutorial-paused',tutorialPaused);
    $('tutorialMotion').setAttribute('aria-pressed',String(tutorialPaused));
    bind('tutorialMotion',tutorialPaused?'tutorialPlay':'tutorialPause');
  }
  function showTutorial(){
    account();clearTimeout(timer);stop();tutorialPaused=false;screen('tutorial');updateTutorialMotion();
    bind('tutorialContinue',allComplete()?'viewStatus':'tutorialContinue');save();window.scrollTo({top:0});$('tutorialTitle').focus({preventScroll:true});
  }
  $('start').onclick=()=>{if(state.revision===0&&!state.tutorial_seen)showTutorial();else beginStudy();};
  $('tutorialHelp').onclick=showTutorial;
  $('tutorialMotion').onclick=()=>{tutorialPaused=!tutorialPaused;updateTutorialMotion();};
  $('tutorialBack').onclick=()=>{screen('intro');refreshResume();window.scrollTo({top:0});$('start').focus({preventScroll:true});};
  $('tutorialContinue').onclick=()=>{state.tutorial_seen=true;save();beginStudy();};
  $('reset').onclick=()=>{if(!confirm(t('resetConfirm')))return;state=fresh();save();showTutorial();};
  $('playAll').onclick=()=>play(false);$('restartAll').onclick=()=>play(true);$('pauseAll').onclick=stop;
  $('reloadMedia').onclick=()=>{account();save();render();};
  $('back').onclick=()=>{clearTimeout(timer);account();state.index=Math.max(0,state.index-1);save();render();};
  $('next').onclick=advance;$('retry').onclick=submit;$('review').onclick=()=>{state.index=0;render();};
  $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='vfx-study-'+state.session_id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  document.addEventListener('visibilitychange',()=>{
    account();visible=!document.hidden&&activeScreen==='study';
    if(document.hidden){stop();clearTimeout(timer);cancelDrag();}else if(activeScreen==='study')bind('choiceStatus',trialComplete(cases[state.index])?'readyToAdvance':'completeRemaining');save();
  });
  window.addEventListener('pagehide',()=>{cancelDrag();account();save();});
  screen('intro');applyLanguage();
})();
