/* Tampa trip: features ported from the NOLA app (map, open-now, place sheet, journal, help, tour, weather,
   surprise me, near me, share, install). Loads after the main page script and extends its globals. */
(function(){
"use strict";
var COORD=window.TAMPA_COORD||{}, APPROX=window.TAMPA_APPROX||[];
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var plain=function(s){return String(s||"").replace(/&amp;/g,"&")};
var TZ="America/New_York";
var GLYPH={eat:"🍽",cafe:"☕",well:"✚",wine:"🍷",juice:"🥤",out:"🌿",photo:"📷",help:"⛑"};
var TYPEN=Object.assign({},CATN,{photo:"Photo spot",help:"Help & health"});
var NOTES_ORIG=VIEWS.notes;

/* ---------- help places (verified Oct 14, 2026 on the official pages linked in Help) ---------- */
var HELPP=[
 {id:"h-er",c:"help",n:"Tampa General Hospital · Emergency",hood:"Davis Islands",a:"1 Tampa General Circle, Tampa, FL 33606",ph:"(813) 844-7000",hs:"Emergency department open 24 hours, 7 days",why:"Level I trauma center and emergency department. Phone shown is the hospital switchboard. In an emergency call 911.",site:"https://www.tgh.org/institutes-and-services/emergency-services-institute",src:"tgh.org",kind:"Emergency room"},
 {id:"h-uc",c:"help",n:"TGH Urgent Care (Fast Track) · South Tampa",hood:"Gandy Blvd",a:"3301 W Gandy Blvd, Tampa, FL 33611",ph:"(813) 925-1903",hs:"Daily 8am–8pm, walk-ins welcome",why:"Walk-in urgent care for non-life-threatening problems (sprains, infections, strep, flu tests). Online check-in available.",site:"https://www.fasttrackurgentcare.com/locations-and-hours/south-tampa/",src:"fasttrackurgentcare.com",kind:"Urgent care"},
 {id:"h-cvs",c:"help",n:"CVS Pharmacy · S Howard Ave (24 hours)",hood:"Hyde Park / SoHo",a:"611 S Howard Ave, Tampa, FL 33606",ph:"(813) 259-9911",hs:"Store and pharmacy open 24 hours (pharmacy pauses 1:30–2:00pm); drive-thru",why:"Pharmacy open around the clock, close to Hyde Park and SoHo.",site:"https://www.cvs.com/store-locator/tampa-fl-pharmacies/611-s-howard-ave-tampa-fl-33606/storeid=3930",src:"cvs.com",kind:"24-hour pharmacy"}
];
HELPP.forEach(function(h,i){h.k=["er","uc","cvs"][i]});
var HCOORD={"h-er":COORD.er,"h-uc":COORD.uc,"h-cvs":COORD.cvs};
var TPA={id:"h-tpa",c:"help",n:"Tampa International Airport (TPA)",hood:"Airport",a:"4100 George J. Bean Pkwy, Tampa, FL 33607",ph:"",hs:"",why:"Ride-app pickup is at Red or Blue Express Curbside or the SkyCenter One remote curbside. See Help for details.",site:"https://www.tampaairport.com/ground-transportation",src:"tampaairport.com",kind:"Airport"};
HCOORD["h-tpa"]=COORD.tpa;
HELPP.push(TPA);

function item(id){return byId(id)||P.find(function(p){return p.id===id})||HELPP.find(function(h){return h.id===id})}
function coordOf(it){
  if(!it)return null;
  if(it.id&&HCOORD[it.id])return HCOORD[it.id];
  if(COORD[it.id])return COORD[it.id];
  if(it.v&&COORD[it.v])return COORD[it.v];
  return null;
}
function typeOf(it){return it.c||"photo"}
function isPhotoOnly(it){return !it.c&&String(it.id).indexOf("p-")===0}

/* ---------- Tampa time + hours ---------- */
function tampaParts(d){
  var f=new Intl.DateTimeFormat("en-US",{timeZone:TZ,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(d||new Date()),o={};
  f.forEach(function(p){o[p.type]=+p.value}); if(o.hour===24)o.hour=0; return o;
}
function tripDayIndex(o){ if(o.year!==2026)return -1; if(o.month===10&&o.day>=29)return o.day-29; if(o.month===11&&o.day===1)return 3; return -1; }
var WHEN=null; // {d,min} chosen by user
function nowInfo(){
  if(WHEN)return {d:WHEN.d,min:WHEN.min,real:false};
  var o=tampaParts(), d=tripDayIndex(o);
  if(d>=0)return {d:d,min:o.hour*60+o.minute,real:true};
  return {d:1,min:19*60,real:false};
}
var SUNRISE=[460,459,460,401], SUNSET=[1127,1126,1126,1065];
function toMin(tok,d,endMer,isEnd){
  tok=tok.toLowerCase().trim();
  if(tok==="sunset")return SUNSET[d]; if(tok==="sunrise")return SUNRISE[d];
  var m=tok.match(/^(\d{1,2})(?::(\d\d))?\s*(am|pm)?$/); if(!m)return null;
  var h=+m[1], mi=+(m[2]||0), mer=m[3]||endMer;
  if(mer==="pm"&&h<12)h+=12; if(mer==="am"&&h===12)h=0;
  var t=h*60+mi; if(isEnd&&t===0)t=1440; return t;
}
function ranges(str,d){
  str=String(str||"").replace(/\(.*?\)/g,"");
  if(/open 24/i.test(str))return [[0,1440]];
  var re=/(sunrise|\d{1,2}(?::\d\d)?\s*(?:am|pm)?)\s*[–-]\s*(sunset|\d{1,2}(?::\d\d)?\s*(?:am|pm))/gi,m,out=[];
  while((m=re.exec(str))){
    var endMer=(m[2].match(/am|pm/i)||[""])[0].toLowerCase();
    var e=toMin(m[2],d,"",true), s=toMin(m[1],d,endMer,false);
    if(s==null||e==null)continue;
    if(!/am|pm|sun/i.test(m[1])&&s>e)s=toMin(m[1],d,endMer==="pm"?"am":"pm",false);
    out.push([s,e]);
  }
  return out;
}
function stateAt(it,w){
  w=w||nowInfo();
  if(!it.h)return {s:"unknown"};
  var str=it.h[w.d]; if(/^\s*Closed/i.test(str))return {s:"closed"};
  var rs=ranges(str,w.d); if(!rs.length)return {s:"unknown"};
  var later=null;
  for(var i=0;i<rs.length;i++){ if(w.min>=rs[i][0]&&w.min<rs[i][1])return {s:"open"}; if(rs[i][0]>w.min&&(later==null||rs[i][0]<later))later=rs[i][0]; }
  return later!=null?{s:"later",at:later}:{s:"closed"};
}
function isOpen(it){return stateAt(it).s==="open"}
function fmtMin(m){var h=Math.floor(m/60)%24,mi=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+(mi?":"+("0"+mi).slice(-2):"")+ap}
function whenLabel(w){w=w||nowInfo();return DAYS[w.d][0]+" "+DAYS[w.d][1]+" · "+fmtMin(w.min)}
function pill(it){
  if(!it.h)return"";
  var st=stateAt(it),w=nowInfo(),lab=st.s==="open"?"Open":st.s==="later"?"Opens "+fmtMin(st.at):st.s==="closed"?"Closed":"Check hours";
  return '<span class="st '+st.s+'" title="'+esc(whenLabel(w)+(w.real?"":" (preview time)"))+'">'+lab+'</span>';
}

/* ---------- storage ---------- */
function load(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
var J=load("tampa-journal",{visits:{},notes:[]}); if(!J.visits)J.visits={}; if(!J.notes)J.notes=[];
function saveJ(){try{localStorage.setItem("tampa-journal",JSON.stringify(J))}catch(e){}}
S.openNow=false; S.near=false; S.view="places";
var LOC=null;

/* ---------- toast + copy ---------- */
function toast(msg){var t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},2600)}
function copy(txt,msg){
  var done=function(){toast(msg||"Copied")};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,function(){fallback()});else fallback();
  function fallback(){var a=document.createElement("textarea");a.value=txt;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();try{document.execCommand("copy")}catch(e){}a.remove();done()}
}

/* ---------- distance / locate ---------- */
function miles(a,b){var R=3958.8,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x))}
function distOf(it){var c=coordOf(it);if(!LOC||!c)return null;return miles([LOC.lat,LOC.lon],c)}
function fmtDist(m){return m<0.15?"steps away":m<10?m.toFixed(1)+" mi":Math.round(m)+" mi"}
function locate(cb){
  if(!navigator.geolocation){toast("This browser can't share location.");return}
  toast("Finding you…");
  navigator.geolocation.getCurrentPosition(function(p){LOC={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy};if(cb)cb();else refreshCurrent()},function(){toast("Location is off. Allow it in your browser settings to see what's near.")},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function refreshCurrent(){ if(cur==="map"){updateMarkers();updateMapList()} else if(cur==="places"){renderGrid();nearBadges()} else if(cur==="help"){show("help",{keep:true,noscroll:true})} }
function nearBadges(){
  if(!LOC)return;
  document.querySelectorAll("#grid .card[id^='v-']").forEach(function(c){var it=byId(c.id.slice(2)),d=it&&distOf(it);if(d!=null&&!c.querySelector(".dist")){var cat=c.querySelector(".cat");if(cat)cat.insertAdjacentHTML("beforeend",'<span class="badge ph dist">'+fmtDist(d)+'</span>')}});
}
function dirUrl(it){return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(plain(it.n).replace(/ \(.*\)/,"")+" "+it.a.replace(/\s*\(.*$/,""))}

/* ---------- place sheet ---------- */
var sheetRoot=document.createElement("div");sheetRoot.id="sheet-root";document.body.appendChild(sheetRoot);
var lastFocus=null;
function openSheet(id){
  var it=item(id);if(!it)return;
  try{if(window.TripAssistant&&typeof window.TripAssistant.close==="function")window.TripAssistant.close()}catch(e){}
  lastFocus=document.activeElement;
  var isV=!!it.h&&!!it.why&&!!it.hs, isH=it.c==="help", sv=saved.has(it.id), vis=!!J.visits[it.id], c=coordOf(it);
  var r=it.res==="must"?["Reserve ahead","res"]:it.res==="yes"?["Reservations recommended","res"]:it.res==="appt"?["Book / call ahead","appt"]:it.res==="maybe"?["Reservations available","opt"]:null;
  var cat=isH?(it.kind||"Help"):(it.c?CATN[it.c]:"Photo spot");
  var h='<div class="sh-top"><div><div class="eyebrow">'+esc(cat)+' · '+esc(it.hood)+'</div><h2 id="sheet-title">'+it.n+'</h2></div><button class="sh-x" data-closesheet="1" aria-label="Close">×</button></div>';
  h+='<div class="row">'+pill(it)+(it.t?'<span class="tier">'+it.t+'</span>':'')+(it.loc?'<span class="badge loc">★ Local favorite</span>':'')+(r?'<span class="flag '+r[1]+'">'+r[0]+'</span>':'')+'</div>';
  h+='<p class="why">'+it.why+'</p>';
  if(it.h)h+=hoursGrid(it);
  h+='<div class="meta">'+(it.best?'<div><b>Best light</b> '+it.best+'</div>':'')+'<div><b>Address</b> '+it.a+'</div>'+(it.ph?'<div><b>'+(it.ph.indexOf("@")>-1?"Email":"Phone")+'</b> '+it.ph+'</div>':'')+(it.hs?'<div><b>Hours</b> '+it.hs+'</div>':'')+(it.note?'<div>'+it.note+'</div>':'')+(it.loc?'<div class="src2">Local pick: '+it.loc+'</div>':'')+(APPROX.indexOf(it.id)>-1||APPROX.indexOf(it.v)>-1?'<div class="src2">Map pin is approximate (street level). Use Directions for the exact entrance.</div>':'')+'</div>';
  var tel=it.ph&&it.ph.indexOf("@")<0?it.ph.replace(/[^\d+]/g,""):"";
  h+='<div class="acts"><a class="btn solid" href="'+dirUrl(it)+'" target="_blank" rel="noopener">Directions</a>'+(tel?'<a class="btn" href="tel:'+tel+'">Call</a>':'')+(it.site?'<a class="btn" href="'+it.site+'" target="_blank" rel="noopener">Official page</a>':'')+'</div>';
  h+='<div class="acts">'+(isH?'':'<button class="save" data-save="'+it.id+'" aria-pressed="'+sv+'">'+(sv?"♥ Saved":"♡ Save")+'</button><button class="btn" data-visit="'+it.id+'" aria-pressed="'+vis+'">'+(vis?"✓ Visited (undo)":"Mark visited")+'</button>')+
     '<button class="btn" data-copylink="'+it.id+'">Copy link</button>'+(it.a?'<button class="btn" data-copyaddr="'+esc(it.a)+'">Copy address</button>':'')+(c&&cur!=="map"?'<button class="btn" data-onmap="'+it.id+'">Show on map</button>':'')+'</div>';
  if(it.src)h+='<div class="ver">✓ Verified Oct 14, 2026 · '+it.src+'</div>';
  sheetRoot.innerHTML='<div class="sh-back" data-closesheet="back"><div class="sh-box" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">'+h+'</div></div>';
  document.body.classList.add("sh-open");
  var b=sheetRoot.querySelector(".sh-box");b.focus();
  try{history.replaceState(null,"","?p="+encodeURIComponent(id)+(location.hash||""))}catch(e){}
}
function closeSheet(){
  if(!sheetRoot.firstChild)return;
  sheetRoot.innerHTML="";document.body.classList.remove("sh-open");
  try{var u=new URL(location.href);if(u.searchParams.has("p")){u.searchParams.delete("p");history.replaceState(null,"",u.pathname+u.search+u.hash)}}catch(e){}
  if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}
}
document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeSheet();endTour()}});

/* ---------- map ---------- */
var LMAP=null,mapEl=null,LCL=null,LME=null,tileOk=false,tileErr=0,noTiles=false,mapUnlocked=false;
var MAPCATS=[["all","All"],["eat","Eat"],["cafe","Coffee"],["well","Biohack"],["wine","Wine"],["juice","Juice"],["out","Outdoors"],["photo","Photo spots"],["help","Help"]];
var LVIEWS={all:["Everything","all"],dt:["Downtown & Water St",[[27.9470,-82.4580],14]],st:["South Tampa",[[27.9340,-82.4760],14]],sh:["Seminole Heights",[[27.9950,-82.4600],13]],ybor:["Ybor",[[27.9605,-82.4410],15]],pete:["St. Pete",[[27.7740,-82.6500],13]]};
S.mapCat="all";S.mapSaved=false;
function mapAvail(){return typeof L!=="undefined"&&!noTiles}
function mapItems(){
  var out=[];
  V.forEach(function(v){out.push(v)});
  P.forEach(function(p){if(!p.v)out.push(p)});
  HELPP.forEach(function(h){out.push(h)});
  return out.filter(function(it){
    if(!coordOf(it))return false;
    var t=typeOf(it);
    if(S.mapCat!=="all"&&t!==S.mapCat){ if(!(S.mapCat==="photo"&&(it.photo||it.v||P.some(function(p){return p.v===it.id}))))return false; }
    if(S.mapSaved&&!saved.has(it.id))return false;
    if(S.openNow&&it.h&&!isOpen(it))return false;
    if(S.openNow&&!it.h&&it.c!=="help"&&!(it.c==="out"))return false;
    return true;
  });
}
function pinIcon(it){
  var t=typeOf(it),sv=saved.has(it.id),vs=!!J.visits[it.id];
  return L.divIcon({className:"pinwrap",iconSize:[32,32],iconAnchor:[16,16],html:'<span class="pin t-'+t+(sv?' sv':'')+(vs?' vs':'')+'"><b class="pg">'+GLYPH[t]+'</b></span>'});
}
function ensureMap(slot){
  if(!mapEl){mapEl=document.createElement("div");mapEl.className="leafmap";mapEl.setAttribute("aria-label","Map of Tampa Bay places")}
  slot.appendChild(mapEl);
  if(!LMAP){
    LMAP=L.map(mapEl,{zoomControl:true,tap:true}).setView([27.9506,-82.4572],12);
    var tl=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(LMAP);
    tl.on("tileload",function(){tileOk=true});
    tl.on("tileerror",function(){tileErr++;if(!tileOk&&tileErr>=4&&!noTiles){noTiles=true;toast("Street tiles can't load here, so the list below is your map.");var m=document.getElementById("mapSlot");if(m)m.innerHTML='<div class="empty">Map tiles unavailable right now. Every place is still listed below with Directions.</div>'}});
    LCL=L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:34,spiderfyOnMaxZoom:true,iconCreateFunction:function(c){return L.divIcon({html:'<span>'+c.getChildCount()+'</span>',className:"clu",iconSize:[38,38]})}}):L.layerGroup();
    LCL.addTo(LMAP);LME=L.layerGroup().addTo(LMAP);
    LMAP.on("moveend",updateMapList);
  }
  applyDark();applyLock(slot);
  setTimeout(function(){LMAP.invalidateSize();if(!LMAP._fitted){fitAll();LMAP._fitted=true}else if(window._mapGo){var g=window._mapGo;window._mapGo=null;LMAP.setView(g[0],g[1])}updateMarkers();updateMapList()},40);
}
function isDarkNow(){return matchMedia("(prefers-color-scheme:dark)").matches}
function applyDark(){if(mapEl)mapEl.classList.toggle("dark",isDarkNow())}
new MutationObserver(applyDark).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
try{matchMedia("(prefers-color-scheme:dark)").addEventListener("change",applyDark)}catch(e){}
function isTouch(){return !!(window.matchMedia&&matchMedia("(pointer:coarse)").matches)}
function applyLock(slot){
  if(!LMAP||!isTouch())return;
  [LMAP.dragging,LMAP.touchZoom].forEach(function(h){if(h)mapUnlocked?h.enable():h.disable()});
  var b=slot.querySelector(".maplock");
  if(!b){b=document.createElement("button");b.className="maplock";b.setAttribute("data-maplock","1");slot.appendChild(b)}
  b.textContent=mapUnlocked?"Done moving the map":"Tap here to move the map";b.classList.toggle("on",mapUnlocked);
}
function updateMarkers(){
  if(!LMAP)return;
  LCL.clearLayers();
  mapItems().forEach(function(it){
    var mk=L.marker(coordOf(it),{icon:pinIcon(it),title:plain(it.n),keyboard:true,riseOnHover:true});
    mk.bindTooltip(plain(it.n),{direction:"top",offset:[0,-14]});
    mk.on("click",function(){openSheet(it.id)});
    LCL.addLayer(mk);
  });
  LME.clearLayers();
  if(LOC){L.circle([LOC.lat,LOC.lon],{radius:Math.min(LOC.acc||30,300),color:"#2B7BFF",weight:1,fillOpacity:.12}).addTo(LME);L.circleMarker([LOC.lat,LOC.lon],{radius:7,color:"#fff",weight:3,fillColor:"#2B7BFF",fillOpacity:1}).bindTooltip("You are here").addTo(LME)}
}
function fitAll(){var pts=mapItems().filter(function(i){return i.c!=="help"}).map(coordOf);if(pts.length)LMAP.fitBounds(pts,{padding:[24,24],maxZoom:13})}
function rowHtml(it){
  var d=distOf(it);
  return '<button class="mrow" data-sheet="'+it.id+'"><span class="pin t-'+typeOf(it)+' sm">'+GLYPH[typeOf(it)]+'</span><span class="mr-t"><b>'+it.n+'</b><i>'+esc(TYPEN[typeOf(it)])+' · '+esc(it.hood)+(d!=null?' · '+fmtDist(d):'')+'</i></span>'+pill(it)+'</button>';
}
function updateMapList(){
  var box=document.getElementById("maplist");if(!box||!LMAP)return;
  var b=LMAP.getBounds(),vis=mapItems().filter(function(i){return b.contains(coordOf(i))});
  vis.sort(function(a,c){var x=distOf(a),y=distOf(c);return x!=null&&y!=null?x-y:plain(a.n).localeCompare(plain(c.n))});
  var cnt=document.getElementById("maplistcount");if(cnt)cnt.textContent=vis.length;
  box.innerHTML=vis.length?vis.slice(0,40).map(rowHtml).join("")+(vis.length>40?'<p class="small muted">Zoom in to see the rest.</p>':''):'<div class="empty">No places in this part of the map. Zoom out or change the filters.</div>';
}
function whenBar(){
  if(!S.openNow)return"";
  var w=nowInfo();
  return '<div class="whenbar"><span class="small"><b>Open at</b> '+(w.real?"right now ("+whenLabel(w)+")":"a preview time, since the trip hasn't started")+'</span><select class="field" id="whenDay" aria-label="Day">'+DAYS.map(function(d,i){return '<option value="'+i+'"'+(i===w.d?' selected':'')+'>'+d[0]+' '+d[1]+'</option>'}).join("")+'</select><input class="field" id="whenTime" type="time" value="'+("0"+Math.floor(w.min/60)).slice(-2)+":"+("0"+w.min%60).slice(-2)+'" aria-label="Time">'+(w.real&&!WHEN?'':'<button class="btn" data-whenreset="1">Use real time</button>')+'</div>';
}
VIEWS.map=function(){
  var h='<div class="view"><div class="head"><span class="eyebrow">Tampa Bay</span><h2>Map</h2><p class="muted small">Every place on a real map. Tap a pin for the details card.</p></div>';
  h+='<div class="row hscroll"><button class="btn solid" data-locate="1">◎ Locate me</button>'+Object.keys(LVIEWS).map(function(k){return '<button class="chip" data-lview="'+k+'">'+esc(LVIEWS[k][0])+'</button>'}).join("")+'</div>';
  h+='<div class="row hscroll">'+MAPCATS.map(function(c){return '<button class="chip" data-mapcat="'+c[0]+'" aria-pressed="'+(S.mapCat===c[0])+'">'+(c[0]!=="all"?'<span class="gl">'+GLYPH[c[0]]+'</span> ':'')+c[1]+'</button>'}).join("")+'</div>';
  h+='<div class="row hscroll"><button class="chip" data-opennow="1" aria-pressed="'+S.openNow+'">Open now only</button><button class="chip" data-mapsaved="1" aria-pressed="'+S.mapSaved+'">♥ Saved only</button></div>'+whenBar();
  h+='<div class="legend">'+MAPCATS.slice(1).map(function(c){return '<span><i class="lg t-'+c[0]+'"></i>'+c[1]+'</span>'}).join("")+'<span><i class="lg you"></i>You</span></div>';
  if(mapAvail())h+='<div class="mapwrap"><div id="mapSlot" class="mapslot"></div></div>';
  else h+='<div class="empty">The map library could not load (offline?). The list below still works.</div>';
  h+='<div class="note"><div class="row" style="justify-content:space-between"><h3>Places in this view</h3><span class="count" id="maplistcount"></span></div><div id="maplist" class="mlist"></div></div>';
  if(!mapAvail()){var all=mapItems();h=h.replace('<div id="maplist" class="mlist"></div>','<div id="maplist" class="mlist">'+all.map(rowHtml).join("")+'</div>')}
  return h+'</div>';
};

/* ---------- Places: Photos folded in as a segmented toggle ---------- */
function seg(active){return '<div class="seg" role="tablist"><button class="chip" data-tab="places" aria-pressed="'+(active==="places")+'">Places</button><button class="chip" data-tab="photos" aria-pressed="'+(active==="photos")+'">📷 Photo spots</button></div>'}
var placesO=VIEWS.places, photosO=VIEWS.photos;
VIEWS.places=function(){
  var h=placesO().replace('<div class="head">',seg("places")+'<div class="head">');
  h=h.replace('<div class="grid" id="grid">',whenBar()+'<div class="grid" id="grid">');
  h=h.replace('<span class="count" id="count">','<button class="chip" data-opennow="1" aria-pressed="'+S.openNow+'">Open now</button><button class="chip" data-near="1" aria-pressed="'+S.near+'">◎ Near me</button><span class="count" id="count">');
  return h;
};
VIEWS.photos=function(){return photosO().replace('<div class="head">',seg("photos")+'<div class="head">')};
/* hook the grid renderer: open-now filter and near-me sort */
var renderGridO=renderGrid;
renderGrid=function(){
  if(!S.openNow&&!S.near)return renderGridO();
  var q=S.q.trim().toLowerCase();
  var list=V.filter(function(v){return (S.cat==="all"||(S.cat==="loc"?v.loc:S.cat==="photo"?v.photo:v.c===S.cat))&&(!S.hood||v.hood===S.hood)&&(S.day===""||!/^Closed|Not listed/.test(v.h[+S.day]))&&(!q||(v.n+" "+v.hood+" "+v.why+" "+v.a+" "+CATN[v.c]).toLowerCase().indexOf(q)>-1)&&(!S.openNow||isOpen(v))});
  if(S.near&&LOC)list.sort(function(a,b){return (distOf(a)||99)-(distOf(b)||99)});
  document.getElementById("grid").innerHTML=list.length?list.map(card).join(""):'<div class="empty">'+(S.openNow?"Nothing in this list is open at "+whenLabel()+". Try another time or clear a filter.":"No places match. Try clearing a filter.")+'</div>';
  document.getElementById("count").textContent=list.length+" of "+V.length;
  nearBadges();
};
/* cards get Details / Visited */
var cardO=card, pcardO=pcard;
card=function(v){
  return cardO(v).replace('<button class="save"','<button class="btn" data-sheet="'+v.id+'">Details</button><button class="btn" data-visit="'+v.id+'" aria-pressed="'+!!J.visits[v.id]+'">'+(J.visits[v.id]?"✓ Visited":"Mark visited")+'</button><button class="save"').replace('<h3>'+v.n+'</h3></div>','<h3>'+v.n+'</h3>'+pill(v)+'</div>');
};
pcard=function(p,i){
  return pcardO(p,i).replace('<button class="save"','<button class="btn" data-sheet="'+p.id+'">Details</button><button class="btn" data-visit="'+p.id+'" aria-pressed="'+!!J.visits[p.id]+'">'+(J.visits[p.id]?"✓ Visited":"Mark visited")+'</button><button class="save"');
};
/* day cards: route link */
var dayCardO=dayCard;
dayCard=function(p){
  var ids=[];p.steps.forEach(function(s){if(s[2]&&ids.indexOf(s[2])<0)ids.push(s[2])});
  var vs=ids.map(byId).filter(Boolean);
  var route="";
  if(vs.length>1){
    var stop=function(v){return encodeURIComponent(plain(v.n).replace(/ \(.*\)/,"")+" "+v.a.replace(/\s*\(.*$/,""))};
    route="https://www.google.com/maps/dir/?api=1&origin="+stop(vs[0])+"&destination="+stop(vs[vs.length-1])+(vs.length>2?"&waypoints="+vs.slice(1,-1).map(stop).join("%7C"):"");
  }
  var extra='<div class="acts day-acts">'+(route?'<a class="btn solid" href="'+route+'" target="_blank" rel="noopener">Route this day in Google Maps</a>':'')+'<button class="btn" data-daymap="'+p.d+'">Show this day on the map</button></div>';
  return dayCardO(p).replace(/<\/ul><\/section>$/,'</ul>'+extra+'</section>');
};
var dayIds={};
function dayVenueIds(d){var p=PLAN.find(function(x){return x.d===d}),ids=[];p.steps.forEach(function(s){if(s[2]&&ids.indexOf(s[2])<0)ids.push(s[2])});return ids}

/* ---------- Home: greeting, weather, tools ---------- */
function countdown(){
  var o=tampaParts(),d=tripDayIndex(o);
  if(d>=0)return "Trip day "+(d+1)+" of 4 · "+DAYS[d][0]+" "+DAYS[d][1];
  var now=Date.UTC(o.year,o.month-1,o.day),start=Date.UTC(2026,9,29),diff=Math.round((start-now)/864e5);
  if(diff>0)return diff+" day"+(diff>1?"s":"")+" until Tampa";
  return "Hope Tampa was wonderful";
}
function greet(){var o=tampaParts(),h=o.hour;return (h<5?"Late night":h<12?"Good morning":h<17?"Good afternoon":"Good evening")+", Sanni and sister"}
var homeO=VIEWS.home;
VIEWS.home=function(){
  var h=homeO();
  var tools='<div class="note nowcard"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">Tampa time · '+new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short",hour:"numeric",minute:"2-digit"}).format(new Date())+'</div><h3>'+greet()+'</h3><div class="small muted">'+countdown()+'</div></div></div>'+
   '<div id="wx" class="wx"><span class="small muted">Loading Tampa weather…</span></div>'+
   '<div class="row"><button class="btn solid" data-surprise="1">✨ Surprise me</button><button class="btn" data-tab="map" data-near="map">◎ Near me</button><button class="btn" data-opennow="go">Open now</button><button class="btn" data-tab="journal">Journal</button><button class="btn" data-tour="1">Take the tour</button></div></div>';
  return h.replace('</section>','</section>'+tools).replace('<span class="fact">Highs about 79–86°F</span>','<span class="fact">Highs about 79–86°F</span>');
};
/* tiles that referenced the old Notes tab */
var WXCODE={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Cloudy",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Snow",73:"Snow",75:"Snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
var wxCache=null;
function loadWX(){
  var box=document.getElementById("wx");if(!box)return;
  if(wxCache)return paintWX(wxCache);
  fetch("https://api.open-meteo.com/v1/forecast?latitude=27.9506&longitude=-82.4572&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16")
   .then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){wxCache=j;paintWX(j)}).catch(function(){var b=document.getElementById("wx");if(b)b.innerHTML='<span class="small muted">Live weather needs a connection. October averages: highs about 86°F, lows about 69°F; November highs about 79°F.</span>'});
}
function paintWX(j){
  var box=document.getElementById("wx");if(!box)return;
  var h='<div class="wxnow"><b>'+Math.round(j.current.temperature_2m)+'°F</b> <span class="small muted">now in Tampa · '+(WXCODE[j.current.weather_code]||"")+'</span></div><div class="wxdays">';
  var dates=["2026-10-29","2026-10-30","2026-10-31","2026-11-01"],any=false;
  dates.forEach(function(dt,i){
    var ix=j.daily.time.indexOf(dt);
    if(ix<0||j.daily.temperature_2m_max[ix]==null)h+='<div><i>'+DAYS[i][0]+' '+DAYS[i][1]+'</i><span class="small muted">Forecast opens closer to the trip</span></div>';
    else{any=true;h+='<div><i>'+DAYS[i][0]+' '+DAYS[i][1]+'</i><b>'+Math.round(j.daily.temperature_2m_max[ix])+'°/'+Math.round(j.daily.temperature_2m_min[ix])+'°</b><span class="small muted">'+(WXCODE[j.daily.weather_code[ix]]||"")+' · '+(j.daily.precipitation_probability_max[ix]==null?"":j.daily.precipitation_probability_max[ix]+"% rain")+'</span></div>'}
  });
  box.innerHTML=h+'</div><div class="small muted">Forecast from Open-Meteo. Trip days appear once they are within its 16-day window.</div>';
}

/* ---------- Surprise me ---------- */
var SUR={vibe:"any",d:null,t:"12:00",picks:[]};
function surpriseSheet(){
  var w=nowInfo();if(SUR.d==null){SUR.d=w.d;SUR.t=("0"+Math.floor(w.min/60)).slice(-2)+":"+("0"+w.min%60).slice(-2)}
  var vibes=[["any","Anything"],["eat","Eat"],["cafe","Coffee"],["well","Biohack"],["wine","Natural wine"],["juice","Juice"],["out","Outdoors"],["loc","Local favorites"],["photo","Photo-worthy"]];
  lastFocus=document.activeElement;
  var h='<div class="sh-top"><div><div class="eyebrow">Surprise me</div><h2 id="sheet-title">Pick a vibe, get a stop</h2></div><button class="sh-x" data-closesheet="1" aria-label="Close">×</button></div>'+
   '<div class="row">'+vibes.map(function(v){return '<button class="chip" data-svibe="'+v[0]+'" aria-pressed="'+(SUR.vibe===v[0])+'">'+v[1]+'</button>'}).join("")+'</div>'+
   '<div class="row"><select class="field" id="sDay">'+DAYS.map(function(d,i){return '<option value="'+i+'"'+(i===SUR.d?' selected':'')+'>'+d[0]+' '+d[1]+'</option>'}).join("")+'</select><input class="field" id="sTime" type="time" value="'+SUR.t+'"><button class="btn solid" data-sgo="1">Find our adventure</button></div>'+
   '<div id="sres">'+surpriseResults()+'</div>';
  sheetRoot.innerHTML='<div class="sh-back" data-closesheet="back"><div class="sh-box" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">'+h+'</div></div>';
  document.body.classList.add("sh-open");sheetRoot.querySelector(".sh-box").focus();
}
function surpriseSpin(){
  var tm=SUR.t.split(":"),w={d:SUR.d,min:(+tm[0])*60+(+tm[1])};
  var pool=V.filter(function(v){
    if(SUR.vibe==="loc"&&!v.loc)return false; if(SUR.vibe==="photo"&&!v.photo)return false;
    if(["eat","cafe","well","wine","juice","out"].indexOf(SUR.vibe)>-1&&v.c!==SUR.vibe)return false;
    return stateAt(v,w).s==="open";
  });
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=pool[i];pool[i]=pool[j];pool[j]=t}
  var picks=[],seen={};
  pool.forEach(function(v){if(picks.length<3&&(SUR.vibe!=="any"||!seen[v.c])){picks.push(v);seen[v.c]=1}});
  pool.forEach(function(v){if(picks.length<3&&picks.indexOf(v)<0)picks.push(v)});
  SUR.picks=picks;SUR.w=w;
}
function surpriseResults(){
  if(!SUR.picks.length)return '<p class="small muted">Choose a vibe, a day and a time. You get up to three places that are open then.</p>';
  var stops=SUR.picks.map(function(v){return encodeURIComponent(plain(v.n).replace(/ \(.*\)/,"")+" "+v.a.replace(/\s*\(.*$/,""))});
  var route="https://www.google.com/maps/dir/?api=1&destination="+stops[stops.length-1]+(stops.length>1?"&waypoints="+stops.slice(0,-1).join("%7C"):"");
  return '<div class="mlist">'+SUR.picks.map(rowHtml).join("")+'</div><div class="row"><button class="btn" data-sgo="1">Spin again</button><a class="btn solid" href="'+route+'" target="_blank" rel="noopener">Route in Google Maps</a></div>';
}

/* ---------- Journal (replaces NOLA's tattoo "Ink" tab) ---------- */
var PASS=[["eat","Eat"],["cafe","Coffee"],["well","Biohack"],["wine","Natural wine"],["juice","Juice"],["out","Outdoors"]];
function hearts(id,n){var s="";for(var i=1;i<=5;i++)s+='<button class="hrt" data-rate="'+id+'|'+i+'" aria-label="Rate '+i+' of 5" aria-pressed="'+(i<=n)+'">'+(i<=n?"♥":"♡")+'</button>';return '<span class="hearts">'+s+'</span>'}
VIEWS.journal=function(){
  var ids=Object.keys(J.visits).filter(function(i){return item(i)}),vcount=ids.length;
  var h='<div class="view"><div class="head"><span class="eyebrow">Our trip diary</span><h2>Journal</h2><p class="muted">Mark places visited, rate them, and keep trip notes. Everything stays on this device.</p></div>';
  h+='<div class="note"><h3>Passport</h3><div class="pass">'+PASS.map(function(p){var tot=V.filter(function(v){return v.c===p[0]}).length,got=V.filter(function(v){return v.c===p[0]&&J.visits[v.id]}).length;return '<div class="stamp'+(got?' got':'')+'"><span class="gl">'+GLYPH[p[0]]+'</span><b>'+got+'/'+tot+'</b><i>'+p[1]+'</i></div>'}).join("")+'</div></div>';
  h+='<div class="row"><button class="btn solid" data-share="1">Share recap</button><button class="btn" data-sendloc="1">Send my location</button><button class="btn" data-copynotes="1">Copy all notes</button></div>';
  h+='<div class="note"><h3>Visited ('+vcount+')</h3>';
  if(!vcount)h+='<div class="empty">Nothing yet. Tap <b>Mark visited</b> on any place card, in the map details or in Surprise me.</div>';
  ids.sort(function(a,b){return (J.visits[b].t||0)-(J.visits[a].t||0)}).forEach(function(id){
    var it=item(id),v=J.visits[id];
    h+='<div class="jrow"><div class="jr-h"><button class="lnk" data-sheet="'+id+'">'+it.n+'</button>'+hearts(id,v.r||0)+'<button class="btn sm" data-visit="'+id+'">Remove</button></div><textarea class="field jnote" data-vnote="'+id+'" rows="2" placeholder="What did you order? What would you do again?" aria-label="Note for '+esc(plain(it.n))+'">'+esc(v.n||"")+'</textarea></div>';
  });
  h+='</div>';
  h+='<div class="note"><h3>Trip notes</h3><div class="row"><select class="field" id="nDay">'+DAYS.map(function(d,i){var w=nowInfo();return '<option value="'+i+'"'+(i===w.d?' selected':'')+'>'+d[0]+' '+d[1]+'</option>'}).join("")+'</select></div><textarea class="field jnote" id="nText" rows="3" placeholder="Reminders, ideas, things to remember…" aria-label="New note"></textarea><div class="row"><button class="btn solid" data-addnote="1">Add note</button></div>';
  h+=J.notes.length?J.notes.slice().reverse().map(function(n){return '<div class="jrow"><div class="jr-h"><b>'+esc(DAYS[n.d]?DAYS[n.d][0]+" "+DAYS[n.d][1]:"")+'</b><button class="btn sm" data-delnote="'+n.t+'">Delete</button></div><p>'+esc(n.x).replace(/\n/g,"<br>")+'</p></div>'}).join(""):'<p class="small muted">No notes yet.</p>';
  return h+'</div></div>';
};
function recap(){
  var ids=Object.keys(J.visits).filter(item),l=["Our Tampa trip so far ("+ids.length+" place"+(ids.length===1?"":"s")+"):"];
  ids.forEach(function(i){var v=J.visits[i];l.push("- "+plain(item(i).n)+(v.r?" "+"♥".repeat(v.r):"")+(v.n?": "+v.n:""))});
  if(J.notes.length){l.push("");l.push("Notes:");J.notes.forEach(function(n){l.push("- "+(DAYS[n.d]?DAYS[n.d][0]+": ":"")+n.x)})}
  return l.join("\n");
}
function toggleVisit(id){
  if(J.visits[id])delete J.visits[id];else J.visits[id]={t:Date.now(),r:0,n:""};
  saveJ();
}

/* ---------- Help ---------- */
var HELPS=[
 ["emergency","Emergency numbers"],["medical","ER, urgent care & pharmacy"],["airport","Tampa airport (TPA)"],["rides","Rideshare & getting around"],["dates","Halloween & clock change"],["practical","Weather, reservations & neighborhoods"],["guide","How to use this app"],["fixes","Quick fixes"]
];
var GUIDE=[
 ["Start here",[["What this is","Your Tampa trip in one place: places, a real map, the day-by-day plan, saved spots, a journal, and practical help. Dates (Thu Oct 29 to Sun Nov 1, 2026) are built in."],["The 3-second version","Use the bar at the bottom to move around. Tap any place for its card: open or closed, hours, why it's worth it, and how to get there. Tap ♡ Save to keep it."],["Take the tour","Tap <b>Take the tour</b> at the top of this page or on Home. It walks through each tab; tap Next or × to stop."]]],
 ["The top of the screen",[["Open now","The pill at the top shows only what's open at the time you pick. On trip days it uses real Tampa time; before the trip it previews a Friday evening, and you can change the day and time."],["Light and dark","The app follows your phone's light/dark setting."],["Install app","If your browser offers it, <b>Install app</b> appears at the top and puts the trip on your home screen. On iPhone: Safari → Share → Add to Home Screen."],["Ask the trip assistant","The round Ask button at the bottom right opens an in-page chat that matches your question to places in this guide (same format as the NOLA app — no external chat apps)."]]],
 ["The bottom bar",[["Home","Greeting, countdown, Tampa weather, Surprise me, Near me and quick tiles."],["Plan","The four days with times, reservation flags and a <b>Route this day</b> link."],["Places","Search and filter every place; <b>Photo spots</b> is the toggle at the top."],["Map","Every place as a pin by type, plus ER, urgent care and a 24-hour pharmacy."],["Saved","Everything you hearted. The badge counts them."],["Journal","Mark places visited, rate them, keep notes, share a recap."],["Help","This page."]]],
 ["Places and details",[["Filters","Type chips, ★ Local favorites, Photo-worthy, neighborhood, and the day you want to go. <b>Open now</b> and <b>Near me</b> sit next to the search box."],["Details card","Tap <b>Details</b> on a card or a pin on the map. You get hours, Directions, Call, the official page, Save, Mark visited, Copy link and Copy address."],["Copy link","Copies a link that opens straight to that place."]]],
 ["Map",[["Moving the map","On phones the map is locked so the page scrolls. Tap <b>Tap here to move the map</b> to pan and zoom, then <b>Done moving the map</b>."],["Pins and filters","Pins are colored by type and group when zoomed out; tap a group to zoom in. Filter by type, Open now, or Saved only. Quick buttons jump to an area."],["Locate me","Allow location to see yourself on the map and sort the list by distance. Your location never leaves this device."]]],
 ["Journal, saving and sharing",[["Where things live","Saves, visits, ratings and notes stay on the phone or computer you made them on."],["Share recap","Sends your visited places, ratings and notes as text through your phone's share sheet (or copies it)."],["Send my location","Shares a map link of where you are, to whoever you choose."],["Offline","After the first visit the app opens with weak signal. Map tiles and live weather need a connection."]]]
];
function helpPlaceCard(h){
  var d=distOf(h);
  return '<div class="hp"><div class="hp-h"><b>'+h.n+'</b>'+(d!=null?'<span class="badge ph">'+fmtDist(d)+'</span>':'')+'</div><div class="small muted">'+esc(h.kind)+' · '+h.a+'</div><div class="small">'+esc(h.hs)+'</div><div class="acts"><a class="btn solid" href="'+dirUrl(h)+'" target="_blank" rel="noopener">Directions</a>'+(h.ph?'<a class="btn" href="tel:'+h.ph.replace(/[^\d]/g,"")+'">Call '+h.ph+'</a>':'')+'<a class="btn" href="'+h.site+'" target="_blank" rel="noopener">Official page</a><button class="btn" data-sheet="'+h.id+'">Details</button></div><div class="ver">✓ Verified Oct 14, 2026 · '+h.src+'</div></div>';
}
VIEWS.help=function(){
  var er=HELPP[0],uc=HELPP[1],cvs=HELPP[2];
  var h='<div class="view"><div class="head"><span class="eyebrow">Practical</span><h2>Help &amp; guide</h2><p class="muted small">Emergency numbers, health care, the airport, getting around, and how this app works.</p></div>';
  h+='<div class="alert warn"><b>In an emergency call <a href="tel:911">911</a>.</b> Everything below was checked on the official pages linked in each section on Oct 14, 2026. Hours can change around holidays: call to confirm.</div>';
  h+='<div class="row"><button class="btn solid" data-tour="1">Take the tour</button><button class="btn" data-nearest="1">◎ Nearest help to me</button><button class="btn" data-tab="map" data-mapcat-go="help">Help places on the map</button></div>';
  h+='<nav class="help-toc" aria-label="Help sections">'+HELPS.map(function(s){return '<a href="#help" data-helpjump="'+s[0]+'">'+s[1]+'</a>'}).join("")+'</nav>';
  h+='<section class="note help-sec" id="help-emergency"><h3>Emergency numbers</h3><div class="numgrid">'+
   '<a class="num big" href="tel:911"><b>911</b><span>Police, fire, medical</span></a>'+
   '<a class="num" href="tel:8132316130"><b>(813) 231-6130</b><span>Tampa Police non-emergency</span></a>'+
   '<a class="num" href="tel:18002221222"><b>1-800-222-1222</b><span>Poison Help, free, 24/7</span></a>'+
   '<a class="num" href="tel:988"><b>988</b><span>Suicide &amp; Crisis Lifeline, call or text, 24/7</span></a></div>'+
   '<p class="small muted">Sources: <a href="https://www.tampa.gov/police" target="_blank" rel="noopener">tampa.gov/police</a>, <a href="https://www.poison.org/need-immediate-assistance" target="_blank" rel="noopener">poison.org</a>, <a href="https://988lifeline.org/" target="_blank" rel="noopener">988lifeline.org</a>. Tampa Police says its online message form is not monitored 24/7, so call for anything urgent.</p></section>';
  h+='<section class="note help-sec" id="help-medical"><h3>ER, urgent care &amp; pharmacy</h3><p class="small muted">Closest to Hyde Park, SoHo and downtown, where most of the plan is. '+(LOC?'Distances are from your location.':'Tap “Nearest help to me” for distances.')+'</p>'+
   helpPlaceCard(er)+helpPlaceCard(uc)+helpPlaceCard(cvs)+
   '<div class="hp"><div class="hp-h"><b>CVS Pharmacy · W Hillsborough Ave (24 hours)</b></div><div class="small muted">24-hour pharmacy · 8603 W Hillsborough Ave, Tampa, FL 33615</div><div class="small">Store and pharmacy open 24 hours (pharmacy pauses 1:30–2:00pm); drive-thru · <a href="tel:8138824029">(813) 882-4029</a></div><div class="ver">✓ Verified Oct 14, 2026 · <a href="https://www.cvs.com/store-locator/tampa-fl-pharmacies/8603-west-hillsborough-ave-tampa-fl-33615/storeid=5783" target="_blank" rel="noopener">cvs.com</a></div></div>'+
   '<ul class="small"><li><b>Walgreens, 315 W Platt St</b> (<a href="tel:8132513939">813-251-3939</a>): the store is open 24 hours, but its pharmacy was closed overnight (opening at 8am) when checked, so use CVS for overnight prescriptions. <a href="https://www.walgreens.com/storelocator/24-hour-store/tampa-fl" target="_blank" rel="noopener">Walgreens locator</a></li><li>TGH Urgent Care also lists clinics at Downtown Channelside and Downtown at The Heights: see <a href="https://www.fasttrackurgentcare.com/urgent-care/" target="_blank" rel="noopener">fasttrackurgentcare.com</a> for addresses and hours.</li><li>Urgent care is for non-life-threatening problems. Chest pain, trouble breathing, stroke signs or serious injury: call 911.</li></ul></section>';
  h+='<section class="note help-sec" id="help-airport"><h3>Tampa International Airport (TPA)</h3><ul><li><b>Address:</b> 4100 George J. Bean Pkwy, Tampa, FL 33607, about five miles west of downtown Tampa.</li><li><b>Uber/Lyft pickup:</b> from Red Express Curbside, Blue Express Curbside, or the SkyCenter One remote curbside. A <b>$5.00 airport fee</b> is added to the fare. Your ride app shows the exact zone after you request.</li><li><b>Ground transportation exits:</b> Red side, the exit nearest Baggage Belt 9. Blue side, the exit nearest Baggage Belt 7.</li><li><b>Drop-offs:</b> any public access location (Ticketing, Baggage Claim) or the SkyCenter One remote curbside.</li><li>Taxis, shared rides and public transit are also listed by the airport.</li></ul><div class="acts"><a class="btn solid" href="'+dirUrl(TPA)+'" target="_blank" rel="noopener">Directions to TPA</a><a class="btn" href="https://www.tampaairport.com/ground-transportation" target="_blank" rel="noopener">Airport ground transportation</a><a class="btn" href="https://www.tampaairport.com/arriving-passenger-guide" target="_blank" rel="noopener">Arriving passenger guide</a></div><div class="ver">✓ Verified Oct 14, 2026 · tampaairport.com</div></section>';
  h+='<section class="note help-sec" id="help-rides"><h3>Rideshare &amp; getting around</h3><ul><li>Match the car, plate and driver name in the app before you get in, and never accept a trip from outside the app (Uber also advises this).</li><li>Sit behind the driver, share your trip status with each other, and ride home together.</li><li>Request from a clear, well-lit corner with an address you can name; on busy nights (Halloween) wait times and prices can jump, so schedule early or build in a buffer.</li><li>The TECO Line Streetcar is free and links Downtown, Channel District/Water Street and Ybor City (see Practical notes below).</li><li>Hyde Park, Seminole Heights and Ybor are not walkable to each other: plan a ride between neighborhoods.</li></ul></section>';
  h+='<section class="note help-sec" id="help-dates"><h3>Halloween (Sat Oct 31) &amp; clock change (Sun Nov 1)</h3><ul><li><b>Halloween is Saturday, Oct 31.</b> Book dinner early (Rooster &amp; the Till and Lilac fill up), expect crowds in nightlife areas after dark, and arrange rides in advance.</li><li><b>Clocks fall back at 2:00 a.m. on Sunday, Nov 1</b> (to 1:00 a.m.), so you gain an hour. Phones update on their own; set a manual alarm or check any hotel clock. <a href="https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst" target="_blank" rel="noopener">NIST</a></li><li>Sunset jumps to about 5:45pm on Sunday (our estimate from the Oct 31 value), so plan beach or St. Pete Pier sunsets earlier.</li></ul></section>';
  h+='<section class="help-sec" id="help-practical"><h3 class="sec-h">Weather, reservations &amp; neighborhoods</h3>'+NOTES_ORIG().replace('<div class="head"><h2>Practical notes</h2></div>','')+'</section>';
  h+='<section class="note help-sec" id="help-guide"><h3>How to use this app</h3>'+GUIDE.map(function(g){return '<h4>'+g[0]+'</h4><dl>'+g[1].map(function(q){return '<dt>'+q[0]+'</dt><dd>'+q[1]+'</dd>'}).join("")+'</dl>'}).join("")+'</section>';
  h+='<section class="note help-sec" id="help-fixes"><h3>Quick fixes</h3><dl><dt>A place looks closed but should be open</dt><dd>Hours come from each place\'s own site as checked Oct 14, 2026 and can change, especially on holidays. Tap Official page or call.</dd><dt>The map won\'t move</dt><dd>Tap <b>Tap here to move the map</b> first.</dd><dt>The app looks out of date</dt><dd>Close it and open it again with a connection; it updates itself.</dd><dt>Pins are slightly off</dt><dd>Pins come from OpenStreetMap address lookups. A few parks are placed at street level; Directions uses the address.</dd></dl></section></div>';
  return h;
};
VIEWS.notes=function(){return VIEWS.help()};

/* ---------- tour ---------- */
var TOUR=[
 ["home","Home","Your greeting, countdown, Tampa weather and shortcuts. <b>Surprise me</b> picks places that are open at the time you choose."],
 ["plan","Plan","Four days with times and reservation flags. <b>Route this day</b> opens every stop in Google Maps."],
 ["places","Places","Search and filter everything. Use <b>Open now</b> and <b>Near me</b>, or flip to <b>Photo spots</b>."],
 ["map","Map","Pins by type. Tap one for the card. Filters and quick area buttons are above the map."],
 ["saved","Saved","Everything you hearted lives here."],
 ["journal","Journal","Mark visited, rate places, keep notes and share a recap."],
 ["help","Help","Emergency numbers, the nearest ER, urgent care and pharmacy, airport and ride tips, and this guide."]
];
var tourI=-1,tourEl=null;
function tourShow(i){
  tourI=i;var s=TOUR[i];show(s[0],{keep:true,noscroll:false});
  if(!tourEl){tourEl=document.createElement("div");tourEl.className="tour";tourEl.setAttribute("role","dialog");tourEl.setAttribute("aria-label","App tour");document.body.appendChild(tourEl)}
  tourEl.innerHTML='<div class="eyebrow">Step '+(i+1)+' of '+TOUR.length+'</div><h3>'+s[1]+'</h3><p>'+s[2]+'</p><div class="row"><button class="btn" data-tourend="1">Stop</button>'+(i>0?'<button class="btn" data-tournav="-1">Back</button>':'')+'<button class="btn solid" data-tournav="1">'+(i===TOUR.length-1?"Done":"Next")+'</button></div>';
}
function endTour(){if(tourEl){tourEl.remove();tourEl=null}tourI=-1;try{localStorage.setItem("tampa-toured","1")}catch(e){}}

/* ---------- shell: tabs, show, header ---------- */
IC.map='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>';
IC.journal='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M10 8h5M10 12h5"/></svg>';
IC.help='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.300-2.500 4"/><path d="M12 17.200v.1"/></svg>';
TABS.splice(0,TABS.length,["home","Home"],["plan","Plan"],["places","Places"],["map","Map"],["saved","Saved"],["journal","Journal"],["help","Help"]);
renderTabs=function(){
  var n=saved.size,act=cur==="photos"?"places":cur;
  $("#tabs").innerHTML=TABS.map(function(t){return '<button class="tab" role="tab" data-tab="'+t[0]+'" aria-selected="'+(t[0]===act)+'" aria-label="'+t[1]+(t[0]==="saved"&&n?" ("+n+")":"")+'">'+IC[t[0]]+'<span>'+t[1]+'</span>'+(t[0]==="saved"&&n?'<span class="n">'+n+'</span>':'')+'</button>'}).join("");
};
var showO=show;
show=function(tab,opts){
  if(tab==="notes")tab="help";
  if(!VIEWS[tab])tab="home";
  closeSheet();
  showO(tab,opts);
  afterShow(tab,opts||{});
};
function afterShow(tab,opts){
  updatePill();
  if(tab==="map"){var s=document.getElementById("mapSlot");if(s&&mapAvail())ensureMap(s)}
  if(tab==="home")loadWX();
  if(tab==="places"&&S.near&&LOC)nearBadges();
  if(tab==="help"&&opts.helpjump){var e=document.getElementById("help-"+opts.helpjump);if(e)e.scrollIntoView({block:"start"})}
}
function updatePill(){
  var b=document.getElementById("openpill");if(!b)return;
  b.setAttribute("aria-pressed",S.openNow);b.classList.toggle("on",S.openNow);
  b.innerHTML='<span class="dot"></span><span class="ol">'+(S.openNow?"Open · "+whenLabel().replace(" · "," "):"Open now")+'</span>';
}
function setOpen(on){S.openNow=on!=null?on:!S.openNow;updatePill();var o={keep:true,noscroll:true};if(cur==="places"||cur==="map"||cur==="home")show(cur,o)}
function afterSavedChange(){if(cur==="map"&&LMAP)updateMarkers()}

/* ---------- events ---------- */
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-sheet],[data-taopen],[data-closesheet],[data-visit],[data-copylink],[data-copyaddr],[data-onmap],[data-locate],[data-lview],[data-mapcat],[data-mapsaved],[data-opennow],[data-whenreset],[data-near],[data-maplock],[data-daymap],[data-surprise],[data-svibe],[data-sgo],[data-rate],[data-addnote],[data-delnote],[data-share],[data-sendloc],[data-copynotes],[data-tour],[data-tournav],[data-tourend],[data-helpjump],[data-nearest],[data-mapcat-go],[data-save],#openpill,#installbtn");
  if(!t)return;
  var d=t.dataset;
  if(t.id==="openpill")return setOpen();
  if(t.id==="installbtn"){if(window._ip){window._ip.prompt();window._ip=null;t.hidden=true}return}
  if(d.closesheet){if(d.closesheet==="back"&&e.target!==t)return;return closeSheet()}
  if(d.sheet){e.preventDefault();return openSheet(d.sheet)}
  if(d.taopen){e.preventDefault();return openSheet(d.taopen)}
  if(d.save){setTimeout(afterSavedChange,0);return}
  if(d.visit){toggleVisit(d.visit);var on=!!J.visits[d.visit];
    if(cur==="journal")return show("journal",{keep:true,noscroll:true});
    t.setAttribute("aria-pressed",on);t.textContent=sheetRoot.firstChild?(on?"✓ Visited (undo)":"Mark visited"):(on?"✓ Visited":"Mark visited");toast(on?"Added to your journal":"Removed from your journal");if(cur==="map"&&LMAP)updateMarkers();return}
  if(d.copylink){var u=location.origin+location.pathname+"?p="+encodeURIComponent(d.copylink);return copy(u,"Link copied")}
  if(d.copyaddr)return copy(d.copyaddr,"Address copied");
  if(d.onmap){var it=item(d.onmap),c=coordOf(it);closeSheet();window._mapGo=[c,16];LMAP&&(LMAP._fitted=true);return show("map")}
  if(d.locate)return locate();
  if(d.lview){var g=LVIEWS[d.lview][1];if(g==="all"){S.mapCat="all";fitAll()}else LMAP.setView(g[0],g[1]);return}
  if(d.mapcat){S.mapCat=d.mapcat;if(cur==="map"){show("map",{keep:true,noscroll:true});if(LMAP)LMAP._fitted=false}return}
  if(d.mapcatGo){S.mapCat="help";return}
  if(d.mapsaved){S.mapSaved=!S.mapSaved;return show("map",{keep:true,noscroll:true})}
  if(d.opennow){if(d.opennow==="go"){S.openNow=true;return show("places")}return setOpen()}
  if(d.whenreset!==undefined){WHEN=null;return show(cur,{keep:true,noscroll:true})}
  if(d.near){
    if(d.near==="map"){setTimeout(function(){locate(function(){refreshCurrent()})},50);return}
    S.near=!S.near;if(S.near&&!LOC)return locate(function(){show("places",{keep:true,noscroll:true})});
    return show("places",{keep:true,noscroll:true});
  }
  if(d.maplock!==undefined){mapUnlocked=!mapUnlocked;return applyLock(t.parentElement)}
  if(d.daymap!==undefined){var ids=dayVenueIds(+d.daymap).filter(function(i){return COORD[i]});var pts=ids.map(function(i){return COORD[i]});S.mapCat="all";window._mapGo=null;show("map");setTimeout(function(){if(LMAP&&pts.length)LMAP.fitBounds(pts,{padding:[30,30],maxZoom:14})},120);return}
  if(d.surprise){return surpriseSheet()}
  if(d.svibe){SUR.vibe=d.svibe;SUR.picks=[];return surpriseSheet()}
  if(d.sgo){var dd=document.getElementById("sDay"),tt=document.getElementById("sTime");if(dd)SUR.d=+dd.value;if(tt&&tt.value)SUR.t=tt.value;surpriseSpin();var r=document.getElementById("sres");if(r)r.innerHTML=SUR.picks.length?surpriseResults():'<div class="empty">Nothing matches that vibe at that time. Try another time or vibe.</div>';return}
  if(d.rate){var p=d.rate.split("|");var v=J.visits[p[0]];if(v){v.r=(v.r===+p[1])?0:+p[1];saveJ();show("journal",{keep:true,noscroll:true})}return}
  if(d.addnote){var tx=document.getElementById("nText");if(tx&&tx.value.trim()){J.notes.push({t:Date.now(),d:+document.getElementById("nDay").value,x:tx.value.trim()});saveJ();show("journal",{keep:true,noscroll:true})}return}
  if(d.delnote){J.notes=J.notes.filter(function(n){return String(n.t)!==d.delnote});saveJ();return show("journal",{keep:true,noscroll:true})}
  if(d.share){var txt=recap();if(navigator.share)navigator.share({title:"Our Tampa trip",text:txt}).catch(function(){});else copy(txt,"Recap copied");return}
  if(d.copynotes!==undefined)return copy(recap(),"Notes copied");
  if(d.sendloc){return locate(function(){var u="https://www.google.com/maps?q="+LOC.lat.toFixed(5)+","+LOC.lon.toFixed(5);if(navigator.share)navigator.share({title:"My location",text:"I'm here:",url:u}).catch(function(){});else copy(u,"Location link copied")})}
  if(d.tour){return tourShow(0)}
  if(d.tournav){var n=tourI+(+d.tournav);if(n<0)return;if(n>=TOUR.length){endTour();return show("home")}return tourShow(n)}
  if(d.tourend!==undefined)return endTour();
  if(d.helpjump){e.preventDefault();var el=document.getElementById("help-"+d.helpjump);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(d.nearest){return locate(function(){show("help",{keep:true,noscroll:true});var el=document.getElementById("help-medical");if(el)el.scrollIntoView({behavior:"smooth"})})}
},true);
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.id==="whenDay"||t.id==="whenTime"){var w=nowInfo(),dd=document.getElementById("whenDay"),tm=document.getElementById("whenTime");var m=(tm.value||"19:00").split(":");WHEN={d:+dd.value,min:(+m[0])*60+(+m[1])};updatePill();show(cur,{keep:true,noscroll:true})}
  if(t.dataset&&t.dataset.vnote){var v=J.visits[t.dataset.vnote];if(v){v.n=t.value;saveJ()}}
});
/* back button closes the sheet */
window.addEventListener("popstate",function(){});
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window._ip=e;var b=document.getElementById("installbtn");if(b)b.hidden=false});

/* ---------- boot ---------- */
(function boot(){
  var tools=document.querySelector(".tools");
  if(tools&&!document.getElementById("openpill")){
    tools.insertAdjacentHTML("afterbegin",'<button class="pill openpill" id="openpill" type="button" aria-pressed="false" aria-label="Show only places open now"><span class="dot"></span><span class="ol">Open now</span></button><button class="pill" id="installbtn" type="button" hidden>Install</button>');
  }
  var u=new URL(location.href),p=u.searchParams.get("p");
  var h=location.hash.slice(1); if(h==="notes")h="help";
  renderTabs();show(VIEWS[h]?h:"home",{keep:true,noscroll:true});
  if(p&&item(p))openSheet(p);
  try{if(!localStorage.getItem("tampa-toured")&&!p&&!h){localStorage.setItem("tampa-toured","1");setTimeout(function(){toast("New here? Tap Help → Take the tour")},800)}}catch(e){}
})();
window.openSheet=openSheet;
window.TAMPA={openSheet:openSheet,closeSheet:closeSheet,stateAt:stateAt,ranges:ranges,coordOf:coordOf,locate:locate,LOC:function(){return LOC},distOf:distOf,nowInfo:nowInfo,whenLabel:whenLabel};
})();
