(() => {
  "use strict";
  const STORAGE_KEY = "lifeTracker.v1"; // deliberately unchanged so existing data survives upgrades
  const APP_VERSION = 2;
  const CATEGORY_ORDER = ["money","health","exercise","wellbeing","learning","hobby","other"];
  const CATEGORY_LABELS = {money:"Money",health:"Health",exercise:"Exercise",wellbeing:"Wellbeing",learning:"Learning",hobby:"Hobbies",other:"Other"};
  const DEFAULT_SETTINGS = {
    currency:"GBP", weekStart:"monday", theme:"system", groupToday:true, showTargets:true,
    summaryMetrics:["spent","saved","exercise","logged"]
  };
  const DEFAULT_TRACKERS = [
    {id:"coffee_bought",name:"Coffee bought",icon:"☕",type:"money_spend",category:"money",defaultAmount:3.80,unit:"",quick:true,interaction:"quick",target:null},
    {id:"coffee_home",name:"Coffee at home",icon:"🏠",type:"money_save",category:"money",compareAmount:3.80,actualCost:0.30,unit:"",quick:true,interaction:"quick",target:null},
    {id:"food_out",name:"Food bought out",icon:"🥪",type:"money_spend",category:"money",defaultAmount:8.00,unit:"",quick:true,interaction:"quick",target:null},
    {id:"food_home",name:"Food from home",icon:"🍱",type:"money_save",category:"money",compareAmount:8.00,actualCost:2.50,unit:"",quick:true,interaction:"quick",target:null},
    {id:"water",name:"Water",icon:"💧",type:"counter",category:"health",defaultAmount:1,unit:"glasses",quick:true,interaction:"quick",target:null},
    {id:"fruit",name:"Fruit",icon:"🍎",type:"counter",category:"health",defaultAmount:1,unit:"portions",quick:true,interaction:"quick",target:null},
    {id:"veg",name:"Vegetables",icon:"🥦",type:"counter",category:"health",defaultAmount:1,unit:"portions",quick:true,interaction:"quick",target:null},
    {id:"walk",name:"Walk",icon:"🚶",type:"minutes",category:"exercise",defaultAmount:30,unit:"minutes",quick:true,interaction:"prompt",target:null},
    {id:"run",name:"Run",icon:"🏃",type:"minutes",category:"exercise",defaultAmount:30,unit:"minutes",quick:true,interaction:"prompt",target:null},
    {id:"swim",name:"Swim",icon:"🏊",type:"minutes",category:"exercise",defaultAmount:30,unit:"minutes",quick:true,interaction:"prompt",target:null},
    {id:"cycle",name:"Cycle",icon:"🚲",type:"minutes",category:"exercise",defaultAmount:30,unit:"minutes",quick:true,interaction:"prompt",target:null},
    {id:"mood",name:"Mood",icon:"🙂",type:"mood",category:"wellbeing",defaultAmount:3,unit:"",quick:true,interaction:"prompt",target:null},
    {id:"read",name:"Read",icon:"📚",type:"minutes",category:"hobby",defaultAmount:20,unit:"minutes",quick:true,interaction:"prompt",target:null},
    {id:"guitar",name:"Play guitar",icon:"🎸",type:"minutes",category:"hobby",defaultAmount:20,unit:"minutes",quick:true,interaction:"prompt",target:null}
  ];

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clone = x => JSON.parse(JSON.stringify(x));
  const uid = prefix => prefix+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const isoToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const currencyLocale = c => ({GBP:"en-GB",EUR:"en-IE",USD:"en-US",AUD:"en-AU",CAD:"en-CA"})[c] || "en-GB";
  const currencySymbol = c => ({GBP:"£",EUR:"€",USD:"$",AUD:"A$",CAD:"C$"})[c] || c;

  let state = loadAndMigrate();
  let pendingTracker = null;
  let selectedMood = 3;
  let deferredInstallPrompt = null;

  function inferCategory(t){
    if(t.category) return t.category;
    if(t.type==="money_spend" || t.type==="money_save") return "money";
    if(["water","fruit","veg"].includes(t.id)) return "health";
    if(t.group==="exercise") return "exercise";
    if(t.group==="hobby") return "hobby";
    if(t.type==="mood") return "wellbeing";
    return "other";
  }
  function inferInteraction(t){
    if(t.interaction) return t.interaction;
    if(["counter","money_spend","money_save","boolean"].includes(t.type)) return "quick";
    return "prompt";
  }
  function normalizeTracker(t){
    return {
      ...t,
      category: inferCategory(t),
      interaction: inferInteraction(t),
      target: (t.target===null || t.target==="" || t.target===undefined) ? null : Math.max(0,Number(t.target)||0),
      quick: t.quick!==false
    };
  }
  function defaultState(){ return {version:APP_VERSION,trackers:clone(DEFAULT_TRACKERS),entries:[],settings:clone(DEFAULT_SETTINGS)}; }
  function loadAndMigrate(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaultState();
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed.trackers)||!Array.isArray(parsed.entries)) throw new Error("Invalid data");
      parsed.trackers=parsed.trackers.map(normalizeTracker);
      parsed.settings={...clone(DEFAULT_SETTINGS),...(parsed.settings||{})};
      if(!Array.isArray(parsed.settings.summaryMetrics)) parsed.settings.summaryMetrics=clone(DEFAULT_SETTINGS.summaryMetrics);
      while(parsed.settings.summaryMetrics.length<4) parsed.settings.summaryMetrics.push(DEFAULT_SETTINGS.summaryMetrics[parsed.settings.summaryMetrics.length]);
      parsed.settings.summaryMetrics=parsed.settings.summaryMetrics.slice(0,4);
      parsed.version=APP_VERSION;
      return parsed;
    }catch(err){ return defaultState(); }
  }
  function save(){ state.version=APP_VERSION; localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); applyTheme(); renderAll(); }
  function safeText(v){ return String(v ?? ""); }
  function trackerById(id){ return state.trackers.find(t=>t.id===id); }
  function selectedDate(){ return $("#entryDate").value || isoToday(); }
  function entriesOn(date){ return state.entries.filter(e=>e.date===date); }
  function money(n){ return new Intl.NumberFormat(currencyLocale(state.settings.currency),{style:"currency",currency:state.settings.currency}).format(Number(n)||0); }
  function entryTracker(e){ return trackerById(e.trackerId); }
  function entryCategory(e){ return e.category || entryTracker(e)?.category || "other"; }
  function addEntry(entry){
    state.entries.push({id:uid("e"),createdAt:new Date().toISOString(),date:selectedDate(),category:entry.category||pendingTracker?.category||"other",...entry});
    save();
  }
  function trackerTotal(t,list){
    const own=list.filter(e=>e.trackerId===t.id);
    if(t.type==="mood") return own.length ? Number(own.at(-1).value)||0 : 0;
    if(t.type==="boolean") return own.length;
    return own.reduce((s,e)=>s+(Number(e.value)||0),0);
  }
  function entryValueLabel(e){
    if(e.kind==="money_spend") return `${money(e.value)} spent`;
    if(e.kind==="money_save") return `${money(e.value)} saved`;
    if(e.kind==="minutes") return `${e.value} min`;
    if(e.kind==="counter") return `+${e.value}${e.unit ? " "+e.unit : ""}`;
    if(e.kind==="mood") return `${e.value}/5`;
    if(e.kind==="boolean") return "Done";
    return safeText(e.value);
  }
  function calc(list){
    const out={spent:0,saved:0,exercise:0,hobby:0,learning:0,counters:{},moods:[],count:list.length,byTracker:{}};
    for(const e of list){
      const v=Number(e.value)||0, cat=entryCategory(e);
      if(e.kind==="money_spend") out.spent+=v;
      if(e.kind==="money_save") out.saved+=v;
      if(e.kind==="minutes"){
        if(cat==="exercise") out.exercise+=v;
        if(cat==="hobby") out.hobby+=v;
        if(cat==="learning") out.learning+=v;
      }
      if(e.kind==="counter") out.counters[e.trackerId]=(out.counters[e.trackerId]||0)+v;
      if(e.kind==="mood") out.moods.push(v);
      if(e.kind==="mood") out.byTracker[e.trackerId]=v;
      else out.byTracker[e.trackerId]=(out.byTracker[e.trackerId]||0)+v;
    }
    return out;
  }

  function applyTheme(){
    const pref=state.settings.theme;
    const dark=pref==="dark" || (pref==="system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme=dark?"dark":"light";
  }

  function renderAll(){ renderToday(); renderReview(); renderManager(); renderSettings(); renderStorage(); }

  function renderSummary(dayEntries){
    const host=$("#summaryRow"); host.innerHTML="";
    const metrics=state.settings.summaryMetrics || DEFAULT_SETTINGS.summaryMetrics;
    for(let i=0;i<4;i++){
      const key=metrics[i] || DEFAULT_SETTINGS.summaryMetrics[i];
      const item=summaryMetric(key,dayEntries);
      const card=document.createElement("article"); card.className="summary-card";
      card.innerHTML=`<span>${safeText(item.label)}</span><strong>${safeText(item.value)}</strong>`;
      host.appendChild(card);
    }
  }
  function summaryMetric(key,list){
    const c=calc(list);
    if(key==="spent") return {label:"Spent",value:money(c.spent)};
    if(key==="saved") return {label:"Saved",value:money(c.saved)};
    if(key==="exercise") return {label:"Exercise",value:`${Math.round(c.exercise)} min`};
    if(key==="logged") return {label:"Logged",value:String(c.count)};
    if(key==="mood"){
      const avg=c.moods.length?c.moods.reduce((a,b)=>a+b,0)/c.moods.length:0;
      return {label:"Mood",value:c.moods.length?`${avg.toFixed(1)} / 5`:"—"};
    }
    if(key==="hobby") return {label:"Hobbies",value:`${Math.round(c.hobby)} min`};
    if(key==="learning") return {label:"Learning",value:`${Math.round(c.learning)} min`};
    if(key.startsWith("tracker:")){
      const id=key.slice(8), t=trackerById(id);
      if(!t) return {label:"Tracker",value:"—"};
      const total=trackerTotal(t,list);
      if(t.type==="money_spend"||t.type==="money_save") return {label:t.name,value:money(total)};
      if(t.type==="minutes") return {label:t.name,value:`${total} min`};
      if(t.type==="mood") return {label:t.name,value:total?`${total}/5`:"—"};
      if(t.type==="boolean") return {label:t.name,value:total?"Done":"—"};
      return {label:t.name,value:`${total}${t.unit?" "+t.unit:""}`};
    }
    return {label:"Logged",value:String(c.count)};
  }

  function renderToday(){
    const dayEntries=entriesOn(selectedDate());
    renderSummary(dayEntries);
    $("#todayLabel").textContent=selectedDate()===isoToday()?"Today":formatDate(selectedDate());
    const host=$("#quickGrid"); host.innerHTML="";
    const quick=state.trackers.filter(t=>t.quick);
    if(!quick.length){ host.innerHTML='<article class="panel"><strong>No quick trackers yet.</strong><p class="subtle">Open Trackers and switch some on.</p></article>'; }
    else if(state.settings.groupToday){
      for(const cat of CATEGORY_ORDER){
        const items=quick.filter(t=>t.category===cat); if(!items.length) continue;
        const block=document.createElement("section"); block.className="category-block";
        block.innerHTML=`<div class="category-heading"><span class="category-dot"></span>${CATEGORY_LABELS[cat]}</div>`;
        const grid=document.createElement("div"); grid.className="tracker-grid";
        items.forEach(t=>grid.appendChild(trackerButton(t,dayEntries)));
        block.appendChild(grid); host.appendChild(block);
      }
    }else{
      const grid=document.createElement("div"); grid.className="tracker-grid";
      quick.forEach(t=>grid.appendChild(trackerButton(t,dayEntries))); host.appendChild(grid);
    }

    const list=$("#todayLog"); list.innerHTML="";
    const sorted=[...dayEntries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $("#logHint").textContent=sorted.length?`${sorted.length} entr${sorted.length===1?"y":"ies"} logged.`:"Nothing logged yet.";
    $("#undoBtn").disabled=!state.entries.length;
    for(const e of sorted){
      const row=document.createElement("div"), t=entryTracker(e); row.className="log-row";
      row.innerHTML=`<div class="log-main"><strong>${safeText(t?.icon||"")} ${safeText(e.label)}</strong><span>${formatTime(e.createdAt)}</span></div><div class="log-value">${safeText(entryValueLabel(e))}</div>`;
      list.appendChild(row);
    }
  }
  function trackerButton(t,dayEntries){
    const btn=document.createElement("button"); btn.type="button"; btn.className="tracker-button"; btn.dataset.id=t.id;
    const total=trackerTotal(t,dayEntries), meta=quickMeta(t,total);
    let progress="";
    if(state.settings.showTargets && t.target && t.target>0 && !["money_spend","money_save","mood"].includes(t.type)){
      const pct=Math.min(100,Math.round((total/t.target)*100));
      progress=`<div class="mini-progress" aria-label="${pct}% of target"><span style="width:${pct}%"></span></div>`;
    }
    btn.innerHTML=`<span class="tracker-icon">${safeText(t.icon||"•")}</span><span><span class="tracker-name">${safeText(t.name)}</span><span class="tracker-meta">${safeText(meta)}</span>${progress}</span>`;
    btn.addEventListener("click",()=>handleTrackerTap(t));
    return btn;
  }
  function quickMeta(t,total){
    const targetText=(state.settings.showTargets && t.target && !["money_spend","money_save","mood"].includes(t.type))?` / ${t.target}`:"";
    if(t.type==="counter") return total?`${total}${targetText} ${t.unit||""}`.trim():t.interaction==="quick"?`+${t.defaultAmount||1} ${t.unit||""}`.trim():`Log ${t.unit||"amount"}`;
    if(t.type==="minutes") return total?`${total}${targetText} min today`:t.interaction==="quick"?`+${t.defaultAmount||20} min`:`Enter minutes`;
    if(t.type==="money_spend") return t.interaction==="quick"?`${money(t.defaultAmount||0)} per tap`:`Enter spend`;
    if(t.type==="money_save") return t.interaction==="quick"?`${money(Math.max(0,(t.compareAmount||0)-(t.actualCost||0)))} saved`:`Enter saving`;
    if(t.type==="mood") return total?`Latest ${total}/5`:"1–5 check-in";
    if(t.type==="boolean") return total?"Done today":"Tap to log";
    return "Tap to log";
  }
  function handleTrackerTap(t){
    if(t.type==="mood" || t.interaction==="prompt"){ openLog(t); return; }
    let value=1;
    if(t.type==="counter"||t.type==="minutes"||t.type==="money_spend") value=Number(t.defaultAmount)||0;
    if(t.type==="money_save") value=Math.max(0,(Number(t.compareAmount)||0)-(Number(t.actualCost)||0));
    addEntry({trackerId:t.id,label:t.name,kind:t.type,value,unit:t.unit||"",category:t.category});
  }

  function openLog(t){
    pendingTracker=t; selectedMood=3;
    $("#dialogIcon").textContent=t.icon||"•"; $("#dialogTitle").textContent=t.name;
    const body=$("#dialogBody"); body.innerHTML="";
    if(t.type==="mood"){
      const wrap=document.createElement("div"); wrap.className="mood-grid";
      [["😞",1],["🙁",2],["😐",3],["🙂",4],["😄",5]].forEach(([face,n])=>{
        const b=document.createElement("button"); b.type="button"; b.className="mood-choice"+(n===3?" selected":""); b.textContent=face; b.setAttribute("aria-label",`Mood ${n} of 5`);
        b.addEventListener("click",()=>{selectedMood=n;[...wrap.children].forEach(x=>x.classList.remove("selected"));b.classList.add("selected")}); wrap.appendChild(b);
      }); body.appendChild(wrap);
    }else if(t.type==="boolean"){
      const p=document.createElement("p"); p.className="subtle"; p.textContent=`Log ${t.name} as done?`; body.appendChild(p);
    }else{
      const label=document.createElement("label"); let txt="Amount",val=t.defaultAmount??1,step="1",min="0";
      if(t.type==="minutes"){txt="Minutes";step="1";min="1";}
      if(t.type==="money_spend"){txt=`Amount spent (${currencySymbol(state.settings.currency)})`;step="0.01";}
      if(t.type==="money_save"){txt=`Amount saved (${currencySymbol(state.settings.currency)})`;val=Math.max(0,(t.compareAmount||0)-(t.actualCost||0));step="0.01";}
      if(t.type==="counter"){txt=t.unit?`Number of ${t.unit}`:"Amount";step="0.1";}
      label.textContent=txt;
      const input=document.createElement("input"); input.id="logAmount"; input.type="number"; input.min=min; input.step=step; input.value=String(val); input.inputMode="decimal";
      label.appendChild(input); body.appendChild(label);
    }
    $("#logDialog").showModal();
  }
  $("#logForm").addEventListener("submit",e=>{
    if(e.submitter?.value==="cancel"||!pendingTracker) return;
    e.preventDefault(); const t=pendingTracker; let value;
    if(t.type==="mood") value=selectedMood; else if(t.type==="boolean") value=1; else { value=Number($("#logAmount")?.value); if(!Number.isFinite(value)||value<0){alert("Please enter a valid amount.");return;} }
    addEntry({trackerId:t.id,label:t.name,kind:t.type,value,unit:t.unit||"",category:t.category}); pendingTracker=null; $("#logDialog").close();
  });

  $("#undoBtn").addEventListener("click",()=>{ if(!state.entries.length)return; state.entries.pop(); save(); });
  $("#entryDate").value=isoToday(); $("#entryDate").addEventListener("change",renderAll);
  $$(".tab").forEach(tab=>tab.addEventListener("click",()=>{ $$(".tab").forEach(x=>x.classList.toggle("active",x===tab)); $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${tab.dataset.view}`)); }));

  function startOfWeek(){
    const d=new Date(); d.setHours(0,0,0,0); const day=d.getDay();
    const offset=state.settings.weekStart==="sunday"?day:(day===0?6:day-1); d.setDate(d.getDate()-offset); return d;
  }
  function filteredEntries(){
    const p=$("#periodSelect").value;
    if(p==="all") return [...state.entries];
    let cutoff;
    if(p==="week") cutoff=startOfWeek(); else { const days=Number(p); cutoff=new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-(days-1)); }
    return state.entries.filter(e=>{const [y,m,d]=e.date.split("-").map(Number);return new Date(y,m-1,d)>=cutoff;});
  }
  function renderReview(){
    const list=filteredEntries(),c=calc(list);
    $("#reviewSpent").textContent=money(c.spent); $("#reviewSaved").textContent=money(c.saved); $("#reviewExercise").textContent=`${Math.round(c.exercise)} min`; $("#reviewGrowth").textContent=`${Math.round(c.learning+c.hobby)} min`;
    const total=c.spent+c.saved,pct=total?Math.round((c.saved/total)*100):0; $("#saveBar").style.width=`${Math.min(100,pct)}%`; $("#moneyInsight").textContent=total?`${pct}% of your tracked spend-or-save choices represent money kept rather than spent.`:"Start logging and your pattern will appear here.";
    const snap=$("#snapshot"); snap.innerHTML=""; const items=[];
    const trackerTotals={}; list.forEach(e=>{if(e.kind==="mood")return;trackerTotals[e.trackerId]=(trackerTotals[e.trackerId]||0)+(Number(e.value)||0)});
    for(const [id,value] of Object.entries(trackerTotals)){
      const t=trackerById(id); if(!t || ["money_spend","money_save"].includes(t.type)) continue;
      const display=t.type==="minutes"?`${value} min`:t.type==="boolean"?`${value} times`:`${value}${t.unit?" "+t.unit:""}`; items.push([`${t.icon||""} ${t.name}`,display]);
    }
    if(c.moods.length){const avg=c.moods.reduce((a,b)=>a+b,0)/c.moods.length;items.push(["🙂 Average mood",`${avg.toFixed(1)} / 5`]);}
    if(!items.length) snap.innerHTML='<p class="subtle">Nothing to summarise yet.</p>'; else items.slice(0,12).forEach(([k,v])=>{const el=document.createElement("div");el.className="snapshot-item";el.innerHTML=`<strong>${safeText(v)}</strong><span class="subtle">${safeText(k)}</span>`;snap.appendChild(el)});
    const hist=$("#historyList"); hist.innerHTML=""; const sorted=[...list].sort((a,b)=>(b.date+b.createdAt).localeCompare(a.date+a.createdAt)).slice(0,40);
    if(!sorted.length) hist.innerHTML='<p class="subtle">No entries yet.</p>'; else sorted.forEach(e=>{const t=entryTracker(e),row=document.createElement("div");row.className="log-row";row.innerHTML=`<div class="log-main"><strong>${safeText(t?.icon||"")} ${safeText(e.label)}</strong><span>${formatDate(e.date)}</span></div><div class="log-value">${safeText(entryValueLabel(e))}</div>`;hist.appendChild(row)});
  }
  $("#periodSelect").addEventListener("change",renderReview);

  function renderManager(){
    const host=$("#trackerManager"); host.innerHTML="";
    for(const cat of CATEGORY_ORDER){
      const items=state.trackers.map((t,i)=>({t,i})).filter(x=>x.t.category===cat); if(!items.length) continue;
      const head=document.createElement("div"); head.className="category-heading"; head.innerHTML=`<span class="category-dot"></span>${CATEGORY_LABELS[cat]}`; host.appendChild(head);
      items.forEach(({t},catIndex)=>{
        const row=document.createElement("div"); row.className="manager-row";
        row.innerHTML=`<div class="manager-title"><div class="manager-icon">${safeText(t.icon||"•")}</div><div><strong>${safeText(t.name)}</strong><span>${safeText(typeLabel(t))} · ${t.interaction==="quick"?"one tap":"asks each time"}${t.target?` · target ${t.target}${t.unit?" "+t.unit:""}`:""}${t.quick?" · on Today":" · hidden from Today"}</span></div></div>`;
        const actions=document.createElement("div"); actions.className="manager-actions";
        const up=actionButton("↑","Move up",()=>moveTrackerInCategory(t,-1)); up.disabled=catIndex===0;
        const down=actionButton("↓","Move down",()=>moveTrackerInCategory(t,1)); down.disabled=catIndex===items.length-1;
        const eye=actionButton(t.quick?"◉":"○",t.quick?"Hide from Today":"Show on Today",()=>{t.quick=!t.quick;save()});
        const edit=actionButton("✎","Edit",()=>openTrackerDialog(t)); const del=actionButton("×","Delete",()=>deleteTracker(t));
        actions.append(up,down,eye,edit,del); row.appendChild(actions); host.appendChild(row);
      });
    }
  }
  function actionButton(txt,label,fn){const b=document.createElement("button");b.type="button";b.className="icon-action";b.textContent=txt;b.title=label;b.setAttribute("aria-label",label);b.addEventListener("click",fn);return b}
  function moveTrackerInCategory(t,delta){
    const same=state.trackers.filter(x=>x.category===t.category), pos=same.findIndex(x=>x.id===t.id), other=same[pos+delta];
    if(!other)return; const i=state.trackers.findIndex(x=>x.id===t.id),j=state.trackers.findIndex(x=>x.id===other.id);
    [state.trackers[i],state.trackers[j]]=[state.trackers[j],state.trackers[i]]; save();
  }
  function deleteTracker(t){const used=state.entries.some(e=>e.trackerId===t.id),msg=used?`Delete "${t.name}"? Existing history will remain in exports, but the tracker will disappear from the app.`:`Delete "${t.name}"?`;if(confirm(msg)){state.trackers=state.trackers.filter(x=>x.id!==t.id);save()}}
  function typeLabel(t){return ({counter:"Counter",minutes:"Minutes",money_spend:"Money spent",money_save:"Money saved",mood:"Mood",boolean:"Done / not done"})[t.type]||t.type}

  $("#addTrackerBtn").addEventListener("click",()=>openTrackerDialog()); $("#trackerType").addEventListener("change",updateTrackerFields);
  function openTrackerDialog(t=null){
    $("#trackerDialogTitle").textContent=t?"Edit tracker":"Add tracker"; $("#trackerEditId").value=t?.id||""; $("#trackerName").value=t?.name||""; $("#trackerIcon").value=t?.icon||""; $("#trackerCategory").value=t?.category||"other"; $("#trackerType").value=t?.type||"counter"; $("#trackerInteraction").value=t?.interaction||"quick"; $("#trackerUnit").value=t?.unit||""; $("#trackerDefault").value=String(t?.defaultAmount??1); $("#trackerCompare").value=String(t?.compareAmount??0); $("#trackerActual").value=String(t?.actualCost??0); $("#trackerTarget").value=t?.target??""; $("#trackerQuick").checked=t?.quick??true; updateTrackerFields(); updateCurrencySymbols(); $("#trackerDialog").showModal();
  }
  function updateTrackerFields(){
    const type=$("#trackerType").value; $("#savingFields").classList.toggle("hidden",type!=="money_save"); $("#unitWrap").classList.toggle("hidden",["money_spend","money_save","mood","boolean"].includes(type)); $("#defaultWrap").classList.toggle("hidden",["money_save","mood","boolean"].includes(type)); $("#targetWrap").classList.toggle("hidden",["money_spend","money_save","mood"].includes(type));
    const forcedPrompt=type==="mood"; $("#interactionWrap").classList.toggle("hidden",forcedPrompt); if(forcedPrompt) $("#trackerInteraction").value="prompt";
  }
  $("#trackerForm").addEventListener("submit",e=>{
    if(e.submitter?.value==="cancel") return; e.preventDefault(); const name=$("#trackerName").value.trim(); if(!name){alert("Please give the tracker a name.");return;}
    const id=$("#trackerEditId").value,existing=id?trackerById(id):null,obj=existing||{id:uid("t")},type=$("#trackerType").value,targetRaw=$("#trackerTarget").value.trim();
    Object.assign(obj,{name,icon:$("#trackerIcon").value.trim()||"•",category:$("#trackerCategory").value,type,interaction:type==="mood"?"prompt":$("#trackerInteraction").value,unit:$("#trackerUnit").value.trim(),defaultAmount:Math.max(0,Number($("#trackerDefault").value)||0),compareAmount:Math.max(0,Number($("#trackerCompare").value)||0),actualCost:Math.max(0,Number($("#trackerActual").value)||0),target:targetRaw===""?null:Math.max(0,Number(targetRaw)||0),quick:$("#trackerQuick").checked});
    delete obj.group; if(!existing)state.trackers.push(obj); save(); $("#trackerDialog").close();
  });

  function summaryOptions(){
    const base=[{v:"spent",l:"Money spent"},{v:"saved",l:"Money saved"},{v:"exercise",l:"Exercise minutes"},{v:"logged",l:"Entries logged"},{v:"mood",l:"Average mood"},{v:"learning",l:"Learning minutes"},{v:"hobby",l:"Hobby minutes"}];
    state.trackers.forEach(t=>base.push({v:`tracker:${t.id}`,l:`${t.icon||""} ${t.name}`})); return base;
  }
  function renderSettings(){
    $("#currencySetting").value=state.settings.currency; $("#weekStartSetting").value=state.settings.weekStart; $("#themeSetting").value=state.settings.theme; $("#groupSetting").checked=!!state.settings.groupToday; $("#targetsSetting").checked=!!state.settings.showTargets; updateCurrencySymbols();
    const host=$("#summarySelectors"); host.innerHTML=""; const opts=summaryOptions();
    for(let i=0;i<4;i++){
      const label=document.createElement("label"); label.textContent=`Card ${i+1}`; const sel=document.createElement("select"); sel.dataset.summaryIndex=String(i);
      opts.forEach(o=>{const op=document.createElement("option");op.value=o.v;op.textContent=o.l;sel.appendChild(op)}); sel.value=state.settings.summaryMetrics[i]||DEFAULT_SETTINGS.summaryMetrics[i];
      if(![...sel.options].some(o=>o.value===sel.value)) sel.value=DEFAULT_SETTINGS.summaryMetrics[i];
      sel.addEventListener("change",()=>{state.settings.summaryMetrics[i]=sel.value;save()}); label.appendChild(sel); host.appendChild(label);
    }
  }
  $("#currencySetting").addEventListener("change",e=>{state.settings.currency=e.target.value;save()});
  $("#weekStartSetting").addEventListener("change",e=>{state.settings.weekStart=e.target.value;save()});
  $("#themeSetting").addEventListener("change",e=>{state.settings.theme=e.target.value;save()});
  $("#groupSetting").addEventListener("change",e=>{state.settings.groupToday=e.target.checked;save()});
  $("#targetsSetting").addEventListener("change",e=>{state.settings.showTargets=e.target.checked;save()});
  function updateCurrencySymbols(){$$(".currency-symbol").forEach(x=>x.textContent=currencySymbol(state.settings.currency));}
  if(window.matchMedia){window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(state.settings.theme==="system")applyTheme()});}

  function renderStorage(){const bytes=new Blob([JSON.stringify(state)]).size;$("#storageSummary").textContent=`${state.entries.length} entries and ${state.trackers.length} trackers stored locally. Approximate data size: ${formatBytes(bytes)}.`;}
  $("#backupBtn").addEventListener("click",()=>download(`life-tracker-backup-${isoToday()}.json`,JSON.stringify(state,null,2),"application/json"));
  $("#csvBtn").addEventListener("click",()=>{const rows=[["date","time","tracker","category","type","value","unit"]];[...state.entries].sort((a,b)=>(a.date+a.createdAt).localeCompare(b.date+b.createdAt)).forEach(e=>rows.push([e.date,e.createdAt,e.label,entryCategory(e),e.kind,e.value,e.unit||""]));download(`life-tracker-${isoToday()}.csv`,rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv;charset=utf-8")});
  $("#restoreInput").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.trackers)||!Array.isArray(data.entries))throw new Error();if(confirm("Replace the current local data with this backup?")){state={...data,trackers:data.trackers.map(normalizeTracker),settings:{...clone(DEFAULT_SETTINGS),...(data.settings||{})},version:APP_VERSION};save()}}catch{alert("That file does not look like a valid Life Tracker backup.");}e.target.value="";});
  $("#deleteAllBtn").addEventListener("click",()=>{if(confirm("Delete all local Life Tracker data on this device? This cannot be undone unless you have exported a backup.")){state=defaultState();save()}});

  function download(filename,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csvCell(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function formatBytes(n){if(n<1024)return `${n} bytes`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
  function formatDate(s){const [y,m,d]=s.split("-").map(Number);return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(y,m-1,d))}
  function formatTime(s){return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date(s))}

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("#installBtn").classList.remove("hidden")});
  $("#installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("#installBtn").classList.add("hidden")});
  window.addEventListener("appinstalled",()=>$("#installBtn").classList.add("hidden"));
  if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}

  applyTheme(); renderAll();
})();
