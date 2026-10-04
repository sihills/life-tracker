(() => {
  "use strict";
  const STORAGE_KEY = "lifeTracker.v1";
  const DEFAULT_TRACKERS = [
    {id:"coffee_bought",name:"Coffee bought",icon:"☕",type:"money_spend",defaultAmount:3.80,unit:"",quick:true},
    {id:"coffee_home",name:"Coffee at home",icon:"🏠",type:"money_save",compareAmount:3.80,actualCost:0.30,unit:"",quick:true},
    {id:"food_out",name:"Food bought out",icon:"🥪",type:"money_spend",defaultAmount:8.00,unit:"",quick:true},
    {id:"food_home",name:"Food from home",icon:"🍱",type:"money_save",compareAmount:8.00,actualCost:2.50,unit:"",quick:true},
    {id:"water",name:"Water",icon:"💧",type:"counter",defaultAmount:1,unit:"glasses",quick:true},
    {id:"fruit",name:"Fruit",icon:"🍎",type:"counter",defaultAmount:1,unit:"portions",quick:true},
    {id:"veg",name:"Vegetables",icon:"🥦",type:"counter",defaultAmount:1,unit:"portions",quick:true},
    {id:"walk",name:"Walk",icon:"🚶",type:"minutes",defaultAmount:30,unit:"minutes",quick:true,group:"exercise"},
    {id:"run",name:"Run",icon:"🏃",type:"minutes",defaultAmount:30,unit:"minutes",quick:true,group:"exercise"},
    {id:"swim",name:"Swim",icon:"🏊",type:"minutes",defaultAmount:30,unit:"minutes",quick:true,group:"exercise"},
    {id:"cycle",name:"Cycle",icon:"🚲",type:"minutes",defaultAmount:30,unit:"minutes",quick:true,group:"exercise"},
    {id:"mood",name:"Mood",icon:"🙂",type:"mood",defaultAmount:3,unit:"",quick:true},
    {id:"read",name:"Read",icon:"📚",type:"minutes",defaultAmount:20,unit:"minutes",quick:true,group:"hobby"},
    {id:"guitar",name:"Play guitar",icon:"🎸",type:"minutes",defaultAmount:20,unit:"minutes",quick:true,group:"hobby"}
  ];

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clone = x => JSON.parse(JSON.stringify(x));
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const money = n => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(Number(n)||0);
  const uid = () => "t_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  let state = load();
  let pendingTracker = null;
  let selectedMood = 3;
  let deferredInstallPrompt = null;

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {version:1,trackers:clone(DEFAULT_TRACKERS),entries:[]};
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed.trackers) || !Array.isArray(parsed.entries)) throw new Error("Invalid data");
      return parsed;
    }catch(err){
      return {version:1,trackers:clone(DEFAULT_TRACKERS),entries:[]};
    }
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderAll(); }
  function safeText(v){ return String(v ?? ""); }
  function trackerById(id){ return state.trackers.find(t=>t.id===id); }
  function selectedDate(){ return $("#entryDate").value || isoToday(); }
  function entriesOn(date){ return state.entries.filter(e=>e.date===date); }
  function addEntry(entry){
    state.entries.push({
      id:"e_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      createdAt:new Date().toISOString(),
      date:selectedDate(),
      ...entry
    });
    save();
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
    const out={spent:0,saved:0,exercise:0,hobby:0,counters:{},moods:[],count:list.length};
    for(const e of list){
      if(e.kind==="money_spend") out.spent += Number(e.value)||0;
      if(e.kind==="money_save") out.saved += Number(e.value)||0;
      if(e.kind==="minutes"){
        const t=trackerById(e.trackerId);
        if(t?.group==="exercise") out.exercise += Number(e.value)||0;
        if(t?.group==="hobby") out.hobby += Number(e.value)||0;
      }
      if(e.kind==="counter"){
        out.counters[e.trackerId]=(out.counters[e.trackerId]||0)+(Number(e.value)||0);
      }
      if(e.kind==="mood") out.moods.push(Number(e.value)||0);
    }
    return out;
  }

  function renderAll(){
    renderToday();
    renderReview();
    renderManager();
    renderStorage();
  }

  function renderToday(){
    const dayEntries=entriesOn(selectedDate());
    const sums=calc(dayEntries);
    $("#todaySpent").textContent=money(sums.spent);
    $("#todaySaved").textContent=money(sums.saved);
    $("#todayExercise").textContent=`${Math.round(sums.exercise)} min`;
    $("#todayLogged").textContent=String(dayEntries.length);
    $("#todayLabel").textContent = selectedDate()===isoToday() ? "Today" : formatDate(selectedDate());

    const grid=$("#quickGrid");
    grid.innerHTML="";
    const quick=state.trackers.filter(t=>t.quick);
    if(!quick.length){
      grid.innerHTML='<article class="panel"><strong>No quick trackers yet.</strong><p class="subtle">Open Trackers and switch some on.</p></article>';
    } else {
      for(const t of quick){
        const btn=document.createElement("button");
        btn.type="button"; btn.className="tracker-button"; btn.dataset.id=t.id;
        const meta=quickMeta(t,dayEntries);
        btn.innerHTML=`<span class="tracker-icon">${safeText(t.icon||"•")}</span><span><span class="tracker-name">${safeText(t.name)}</span><span class="tracker-meta">${safeText(meta)}</span></span>`;
        btn.addEventListener("click",()=>openLog(t));
        grid.appendChild(btn);
      }
    }

    const list=$("#todayLog"); list.innerHTML="";
    const sorted=[...dayEntries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $("#logHint").textContent = sorted.length ? `${sorted.length} entr${sorted.length===1?"y":"ies"} logged.` : "Nothing logged yet.";
    $("#undoBtn").disabled=!state.entries.length;
    for(const e of sorted){
      const row=document.createElement("div"); row.className="log-row";
      const t=trackerById(e.trackerId);
      row.innerHTML=`<div class="log-main"><strong>${safeText(t?.icon||"")} ${safeText(e.label)}</strong><span>${formatTime(e.createdAt)}</span></div><div class="log-value">${safeText(entryValueLabel(e))}</div>`;
      list.appendChild(row);
    }
  }

  function quickMeta(t, dayEntries){
    const own=dayEntries.filter(e=>e.trackerId===t.id);
    if(t.type==="counter"){
      const total=own.reduce((s,e)=>s+Number(e.value||0),0);
      return total ? `${total} ${t.unit||""}`.trim() : `+${t.defaultAmount||1} ${t.unit||""}`.trim();
    }
    if(t.type==="minutes"){
      const total=own.reduce((s,e)=>s+Number(e.value||0),0);
      return total ? `${total} min today` : `${t.defaultAmount||20} min`;
    }
    if(t.type==="money_spend") return `${money(t.defaultAmount||0)} default`;
    if(t.type==="money_save") return `${money(Math.max(0,(t.compareAmount||0)-(t.actualCost||0)))} saved`;
    if(t.type==="mood"){
      const latest=own.at(-1);
      return latest ? `Latest ${latest.value}/5` : "1–5 check-in";
    }
    return own.length ? "Done today" : "Tap to log";
  }

  function openLog(t){
    pendingTracker=t; selectedMood=3;
    $("#dialogIcon").textContent=t.icon||"•";
    $("#dialogTitle").textContent=t.name;
    const body=$("#dialogBody"); body.innerHTML="";
    if(t.type==="mood"){
      const wrap=document.createElement("div"); wrap.className="mood-grid";
      const moods=[["😞",1],["🙁",2],["😐",3],["🙂",4],["😄",5]];
      for(const [face,n] of moods){
        const b=document.createElement("button"); b.type="button"; b.className="mood-choice"+(n===3?" selected":""); b.textContent=face; b.setAttribute("aria-label",`Mood ${n} of 5`);
        b.addEventListener("click",()=>{selectedMood=n;[...wrap.children].forEach(x=>x.classList.remove("selected"));b.classList.add("selected")});
        wrap.appendChild(b);
      }
      body.appendChild(wrap);
    } else if(t.type==="boolean"){
      const p=document.createElement("p"); p.className="subtle"; p.textContent=`Log ${t.name} as done?`; body.appendChild(p);
    } else {
      const label=document.createElement("label");
      let txt="Amount", val=t.defaultAmount??1, step="1", min="0";
      if(t.type==="minutes"){txt="Minutes";step="1";min="1";}
      if(t.type==="money_spend"){txt="Amount spent (£)";step="0.01";}
      if(t.type==="money_save"){txt="Amount saved (£)";val=Math.max(0,(t.compareAmount||0)-(t.actualCost||0));step="0.01";}
      if(t.type==="counter"){txt=t.unit?`Number of ${t.unit}`:"Amount";step="1";}
      label.textContent=txt;
      const input=document.createElement("input"); input.id="logAmount"; input.type="number"; input.min=min; input.step=step; input.value=String(val); input.inputMode="decimal";
      label.appendChild(input); body.appendChild(label);
    }
    $("#logDialog").showModal();
  }

  $("#logForm").addEventListener("submit",e=>{
    if(e.submitter?.value==="cancel" || !pendingTracker) return;
    e.preventDefault();
    const t=pendingTracker;
    let value;
    if(t.type==="mood") value=selectedMood;
    else if(t.type==="boolean") value=1;
    else {
      value=Number($("#logAmount")?.value);
      if(!Number.isFinite(value) || value<0){ alert("Please enter a valid amount."); return; }
    }
    addEntry({trackerId:t.id,label:t.name,kind:t.type,value,unit:t.unit||""});
    pendingTracker=null;
    $("#logDialog").close();
  });

  $("#undoBtn").addEventListener("click",()=>{
    if(!state.entries.length) return;
    state.entries.pop(); save();
  });

  $("#entryDate").value=isoToday();
  $("#entryDate").addEventListener("change",renderAll);

  $$(".tab").forEach(tab=>tab.addEventListener("click",()=>{
    $$(".tab").forEach(x=>x.classList.toggle("active",x===tab));
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${tab.dataset.view}`));
  }));

  function filteredEntries(){
    const p=$("#periodSelect").value;
    if(p==="all") return [...state.entries];
    const days=Number(p);
    const cutoff=new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-(days-1));
    return state.entries.filter(e=>{
      const [y,m,d]=e.date.split("-").map(Number);
      const dt=new Date(y,m-1,d);
      return dt>=cutoff;
    });
  }

  function renderReview(){
    const list=filteredEntries(), c=calc(list);
    $("#reviewSpent").textContent=money(c.spent);
    $("#reviewSaved").textContent=money(c.saved);
    $("#reviewExercise").textContent=`${Math.round(c.exercise)} min`;
    $("#reviewHobbies").textContent=`${Math.round(c.hobby)} min`;
    const total=c.spent+c.saved, pct=total?Math.round((c.saved/total)*100):0;
    $("#saveBar").style.width=`${Math.min(100,pct)}%`;
    $("#moneyInsight").textContent=total ? `${pct}% of your tracked spend-or-save choices represent money kept rather than spent.` : "Start logging and your pattern will appear here.";

    const snap=$("#snapshot"); snap.innerHTML="";
    const items=[];
    for(const [id,value] of Object.entries(c.counters)){
      const t=trackerById(id); if(t) items.push([`${t.icon||""} ${t.name}`,`${value} ${t.unit||""}`.trim()]);
    }
    if(c.moods.length){
      const avg=c.moods.reduce((a,b)=>a+b,0)/c.moods.length;
      items.push(["🙂 Average mood",`${avg.toFixed(1)} / 5`]);
    }
    if(c.exercise) items.push(["🏃 Exercise",`${Math.round(c.exercise)} minutes`]);
    if(c.hobby) items.push(["📚 Hobbies",`${Math.round(c.hobby)} minutes`]);
    if(!items.length) snap.innerHTML='<p class="subtle">Nothing to summarise yet.</p>';
    else for(const [k,v] of items){
      const el=document.createElement("div"); el.className="snapshot-item";
      el.innerHTML=`<strong>${safeText(v)}</strong><span class="subtle">${safeText(k)}</span>`; snap.appendChild(el);
    }

    const hist=$("#historyList"); hist.innerHTML="";
    const sorted=[...list].sort((a,b)=>(b.date+b.createdAt).localeCompare(a.date+a.createdAt)).slice(0,40);
    if(!sorted.length) hist.innerHTML='<p class="subtle">No entries yet.</p>';
    for(const e of sorted){
      const t=trackerById(e.trackerId), row=document.createElement("div"); row.className="log-row";
      row.innerHTML=`<div class="log-main"><strong>${safeText(t?.icon||"")} ${safeText(e.label)}</strong><span>${formatDate(e.date)}</span></div><div class="log-value">${safeText(entryValueLabel(e))}</div>`;
      hist.appendChild(row);
    }
  }
  $("#periodSelect").addEventListener("change",renderReview);

  function renderManager(){
    const host=$("#trackerManager"); host.innerHTML="";
    state.trackers.forEach((t,idx)=>{
      const row=document.createElement("div"); row.className="manager-row";
      row.innerHTML=`<div class="manager-title"><div class="manager-icon">${safeText(t.icon||"•")}</div><div><strong>${safeText(t.name)}</strong><span>${safeText(typeLabel(t))}${t.quick?" · on Today":" · hidden from Today"}</span></div></div>`;
      const actions=document.createElement("div"); actions.className="manager-actions";
      const up=actionButton("↑","Move up",()=>moveTracker(idx,-1)); up.disabled=idx===0;
      const down=actionButton("↓","Move down",()=>moveTracker(idx,1)); down.disabled=idx===state.trackers.length-1;
      const eye=actionButton(t.quick?"◉":"○",t.quick?"Hide from Today":"Show on Today",()=>{t.quick=!t.quick;save()});
      const edit=actionButton("✎","Edit",()=>openTrackerDialog(t));
      const del=actionButton("×","Delete",()=>deleteTracker(t));
      actions.append(up,down,eye,edit,del); row.appendChild(actions); host.appendChild(row);
    });
  }
  function actionButton(txt,label,fn){const b=document.createElement("button");b.type="button";b.className="icon-action";b.textContent=txt;b.title=label;b.setAttribute("aria-label",label);b.addEventListener("click",fn);return b}
  function moveTracker(i,delta){const j=i+delta;if(j<0||j>=state.trackers.length)return;[state.trackers[i],state.trackers[j]]=[state.trackers[j],state.trackers[i]];save()}
  function deleteTracker(t){
    const used=state.entries.some(e=>e.trackerId===t.id);
    const msg=used?`Delete "${t.name}"? Existing history will remain in exports but this tracker will no longer be editable.`:`Delete "${t.name}"?`;
    if(confirm(msg)){ state.trackers=state.trackers.filter(x=>x.id!==t.id); save(); }
  }
  function typeLabel(t){
    return ({counter:"Counter",minutes:"Minutes",money_spend:"Money spent",money_save:"Money saved",mood:"Mood",boolean:"Done / not done"})[t.type]||t.type;
  }

  $("#addTrackerBtn").addEventListener("click",()=>openTrackerDialog());
  $("#trackerType").addEventListener("change",updateTrackerFields);

  function openTrackerDialog(t=null){
    $("#trackerDialogTitle").textContent=t?"Edit tracker":"Add tracker";
    $("#trackerEditId").value=t?.id||"";
    $("#trackerName").value=t?.name||"";
    $("#trackerIcon").value=t?.icon||"";
    $("#trackerType").value=t?.type||"counter";
    $("#trackerUnit").value=t?.unit||"";
    $("#trackerDefault").value=String(t?.defaultAmount??1);
    $("#trackerCompare").value=String(t?.compareAmount??0);
    $("#trackerActual").value=String(t?.actualCost??0);
    $("#trackerQuick").checked=t?.quick??true;
    updateTrackerFields();
    $("#trackerDialog").showModal();
  }

  function updateTrackerFields(){
    const type=$("#trackerType").value;
    $("#savingFields").classList.toggle("hidden",type!=="money_save");
    $("#unitWrap").classList.toggle("hidden",["money_spend","money_save","mood","boolean"].includes(type));
    $("#defaultWrap").classList.toggle("hidden",["money_save","mood","boolean"].includes(type));
  }

  $("#trackerForm").addEventListener("submit",e=>{
    if(e.submitter?.value==="cancel") return;
    e.preventDefault();
    const name=$("#trackerName").value.trim();
    if(!name){ alert("Please give the tracker a name."); return; }
    const id=$("#trackerEditId").value;
    const existing=id?trackerById(id):null;
    const type=$("#trackerType").value;
    const obj=existing||{id:uid()};
    Object.assign(obj,{
      name, icon:$("#trackerIcon").value.trim()||"•", type,
      unit:$("#trackerUnit").value.trim(),
      defaultAmount:Math.max(0,Number($("#trackerDefault").value)||0),
      compareAmount:Math.max(0,Number($("#trackerCompare").value)||0),
      actualCost:Math.max(0,Number($("#trackerActual").value)||0),
      quick:$("#trackerQuick").checked,
      group: existing?.group || ""
    });
    if(!existing) state.trackers.push(obj);
    save(); $("#trackerDialog").close();
  });

  function renderStorage(){
    const bytes=new Blob([JSON.stringify(state)]).size;
    $("#storageSummary").textContent=`${state.entries.length} entries and ${state.trackers.length} trackers stored locally. Approximate data size: ${formatBytes(bytes)}.`;
  }

  $("#backupBtn").addEventListener("click",()=>{
    download(`life-tracker-backup-${isoToday()}.json`,JSON.stringify(state,null,2),"application/json");
  });

  $("#csvBtn").addEventListener("click",()=>{
    const rows=[["date","time","tracker","type","value","unit"]];
    [...state.entries].sort((a,b)=>(a.date+a.createdAt).localeCompare(b.date+b.createdAt)).forEach(e=>{
      rows.push([e.date,e.createdAt,e.label,e.kind,e.value,e.unit||""]);
    });
    const csv=rows.map(r=>r.map(csvCell).join(",")).join("\n");
    download(`life-tracker-${isoToday()}.csv`,csv,"text/csv;charset=utf-8");
  });

  $("#restoreInput").addEventListener("change",async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.trackers)||!Array.isArray(data.entries)) throw new Error();
      if(confirm("Replace the current local data with this backup?")){state=data;save();}
    }catch{alert("That file does not look like a valid Life Tracker backup.");}
    e.target.value="";
  });

  $("#deleteAllBtn").addEventListener("click",()=>{
    if(confirm("Delete all local Life Tracker data on this device? This cannot be undone unless you have exported a backup.")){
      state={version:1,trackers:clone(DEFAULT_TRACKERS),entries:[]}; save();
    }
  });

  function download(filename,text,type){
    const blob=new Blob([text],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvCell(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function formatBytes(n){if(n<1024)return `${n} bytes`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
  function formatDate(s){const [y,m,d]=s.split("-").map(Number);return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(y,m-1,d))}
  function formatTime(s){return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date(s))}

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault(); deferredInstallPrompt=e; $("#installBtn").classList.remove("hidden");
  });
  $("#installBtn").addEventListener("click",async()=>{
    if(!deferredInstallPrompt)return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null; $("#installBtn").classList.add("hidden");
  });
  window.addEventListener("appinstalled",()=>$("#installBtn").classList.add("hidden"));

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }

  renderAll();
})();