/* Trip assistant — in-page chat (NOLA "Ask" panel UX). Fully client-side.
   No external chat apps, no API keys. Matches intent/keywords to the site's venues.
   Reusable: edit #trip-assistant-config JSON; venues from config.venues,
   window.TRIP_ASSISTANT_VENUES, or host globals V/P. Optional cfg.llmEndpoint. */
(function () {
  "use strict";
  var el = document.getElementById("trip-assistant-config");
  if (!el) return;
  var cfg;
  try { cfg = JSON.parse(el.textContent); } catch (e) { console.warn("trip-assistant: bad config JSON"); return; }

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  var CAT_LABELS = cfg.categoryLabels || {
    eat: "Restaurant", cafe: "Coffee / café", well: "Wellness / longevity",
    wine: "Wine", juice: "Juice / market", out: "Outdoors / nature", photo: "Photo spot"
  };

  function host(name) {
    try { return Function("return typeof " + name + " !== 'undefined' ? " + name + " : null")(); }
    catch (e) { return null; }
  }

  var tripDays = cfg.days || host("DAYS") || [["Thu", ""], ["Fri", ""], ["Sat", ""], ["Sun", ""]];

  function venues() {
    if (cfg.venues && cfg.venues.length) return cfg.venues.slice();
    if (window.TRIP_ASSISTANT_VENUES && window.TRIP_ASSISTANT_VENUES.length) return window.TRIP_ASSISTANT_VENUES.slice();
    var list = [], Vref = host("V"), Pref = host("P");
    if (Vref && Vref.length) list = list.concat(Vref);
    if (Pref && Pref.length) {
      Pref.forEach(function (p) {
        if (p.v) return;
        list.push({
          id: p.id, c: "photo", n: p.n, hood: p.hood, a: p.a, t: "Free",
          h: null, hs: p.best ? "Best light: " + p.best : "", why: p.why,
          site: p.site, photo: 1, loc: p.loc || "", note: p.note || "", ph: ""
        });
      });
    }
    if (list.length) return list;
    return (window.TRIP_VENUES || []).map(function (v, i) {
      return { id: "tv-" + i, c: "", n: v.name, hood: v.area || "", a: v.address || "", t: "", h: null, hs: "", why: v.type || "", site: "", photo: 0 };
    });
  }

  function plain(s) { return String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function mapsUrl(v) {
    var m = host("maps");
    if (typeof m === "function" && v.h) return m(v);
    var pm = host("pmaps");
    if (typeof pm === "function" && (v.c === "photo" || !v.h)) return pm(v);
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(plain(v.n).replace(/ \(.*\)/, "") + " " + (v.a || ""));
  }
  function isSaved(id) {
    var s = host("saved");
    if (s && typeof s.has === "function") return s.has(id);
    try { return JSON.parse(localStorage.getItem(cfg.storageKey || "tampa-saved") || "[]").indexOf(id) > -1; }
    catch (e) { return false; }
  }
  function toggleSave(id) {
    var s = host("saved"), upd = host("updSaved");
    if (s && typeof s.has === "function") {
      if (s.has(id)) s.delete(id); else s.add(id);
      if (typeof upd === "function") upd();
      return s.has(id);
    }
    var key = cfg.storageKey || "tampa-saved", arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { arr = []; }
    var i = arr.indexOf(id);
    if (i > -1) arr.splice(i, 1); else arr.push(id);
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
    return arr.indexOf(id) > -1;
  }
  function openState(v, dayIdx) {
    var stFn = host("stateAt"), nowFn = host("nowInfo");
    if (typeof stFn === "function") {
      if (dayIdx == null) return stFn(v);
      var base = typeof nowFn === "function" ? nowFn() : { d: 0, min: 19 * 60 };
      return stFn(v, { d: dayIdx, min: base.min, real: false });
    }
    if (!v.h) return { s: "unknown" };
    var str = v.h[dayIdx != null ? dayIdx : 0] || "";
    if (/^\s*Closed/i.test(str)) return { s: "closed" };
    if (/open 24/i.test(str)) return { s: "open" };
    return { s: "unknown" };
  }
  function whenLab() {
    var fn = host("whenLabel");
    return typeof fn === "function" ? fn() : "now";
  }
  function distMiles(v) {
    var dFn = host("distOf");
    return typeof dFn === "function" ? dFn(v) : null;
  }
  function fmtDist(m) { return m < 0.15 ? "steps away" : m < 10 ? m.toFixed(1) + " mi" : Math.round(m) + " mi"; }
  function ensureLocate(cb) {
    if (host("LOC")) { cb(true); return; }
    var locFn = host("locate");
    if (typeof locFn === "function") { locFn(function () { cb(!!host("LOC")); }); return; }
    if (!navigator.geolocation) { cb(false); return; }
    navigator.geolocation.getCurrentPosition(function () { cb(true); }, function () { cb(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  function tierRank(t) {
    t = String(t || "").toLowerCase();
    if (!t || t.indexOf("free") === 0) return 0;
    if (t === "$" || /^\$(\s|\/|$)/.test(t)) return 1;
    if (t.indexOf("$$$$") === 0) return 4;
    if (t.indexOf("$$$") === 0) return 3;
    if (t.indexOf("$$") === 0) return 2;
    if (/^\d/.test(t) || /car|parking|ferry|entry/i.test(t)) return 1;
    return 2;
  }
  function openPlace(id) {
    if (open) hide();
    var sheet = (window.TAMPA && window.TAMPA.openSheet) || host("openSheet") || window.openSheet;
    if (typeof sheet === "function") { sheet(id); return; }
    var go = host("goVenue");
    if (typeof go === "function") { go(id); return; }
    var node = document.getElementById("v-" + id) || document.getElementById(id);
    if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  var INTENTS = [
    { id: "well", re: /\b(cold\s*plunge|sauna|cryo|float|nad\+?|iv\b|biohack|recovery|wellness|infrared|contrast|longevity)\b/i, cats: ["well"], boost: ["pause", "tbtw", "agerej"] },
    { id: "wine", re: /\b(natural\s*wine|organic\s*wine|wine\s*bar|\bwine\b|vino)\b/i, cats: ["wine"], boost: ["setima", "wineonwater", "cru", "jug", "hostess"] },
    { id: "photo", re: /\b(sunset|sunrise|photo|photograph|skyline|golden\s*hour|blue\s*hour|instagram|picture)\b/i, cats: ["out", "photo"], wantPhoto: true, boost: ["bayshore", "curtishixon", "riverwalk", "p-bayshore", "p-riverwalk", "p-pier"] },
    { id: "out", re: /\b(outdoors?|outside|hike|trail|beach|park|walk|run|kayak|paddle|manatee|calories?|burn|active|nature|riverwalk|bayshore)\b/i, cats: ["out"], boost: ["riverwalk", "bayshore", "hrsp", "honeymoon", "fortdesoto", "weedon"] },
    { id: "cafe", re: /\b(coffee|espresso|caf[eé]|latte|cappuccino)\b/i, cats: ["cafe"], boost: ["jetcity", "oxford"] },
    { id: "juice", re: /\b(juice|smoothie|a[cç]a[ií]|cold[- ]pressed)\b/i, cats: ["juice"], boost: ["cleanjuice", "heightsmarket", "sweetwater"] },
    { id: "eat", re: /\b(dinner|lunch|brunch|breakfast|eat|restaurant|food|hungry|meal|healthy\s*dinner|splurge|farm[- ]to[- ]table|seafood)\b/i, cats: ["eat"], boost: ["nakedfarmer", "rooster", "ulele", "elevage", "oxford", "lilac", "parkshore"] }
  ];

  function parseQuery(q) {
    q = (q || "").trim();
    var low = q.toLowerCase(), intent = null, i;
    for (i = 0; i < INTENTS.length; i++) if (INTENTS[i].re.test(q)) { intent = INTENTS[i]; break; }
    var openOnly = /\b(open\s*now|what'?s\s*open|open\s*tonight|right\s*now)\b/i.test(q);
    var near = /\b(near\s*me|nearby|closest|closer|around\s*here|walking\s*distance)\b/i.test(q);
    var cheaper = /\b(cheaper|cheap|budget|inexpensive|affordable|less\s*expensive)\b/i.test(q);
    var follow = null;
    if (/^\s*closer\b/i.test(q) || /\bcloser\s*(please|ones?)?\s*$/i.test(q)) { follow = "closer"; near = true; }
    if (/^\s*cheaper\b/i.test(q) || /\bcheaper\s*(please|ones?)?\s*$/i.test(q)) { follow = "cheaper"; cheaper = true; }
    if (/\btomorrow\b/i.test(q)) follow = follow || "tomorrow";
    var nowFn = host("nowInfo");
    var cur = typeof nowFn === "function" ? nowFn() : { d: 1, min: 19 * 60 };
    var day = null;
    if (/\btoday\b/i.test(q) || /\btonight\b/i.test(q)) day = cur.d;
    if (/\btomorrow\b/i.test(q)) day = Math.min((cur.d || 0) + 1, tripDays.length - 1);
    if (/\bthursday\b|\bthu\b/i.test(q)) day = 0;
    if (/\bfriday\b|\bfri\b/i.test(q)) day = 1;
    if (/\bsaturday\b|\bsat\b|halloween/i.test(q)) day = 2;
    if (/\bsunday\b|\bsun\b/i.test(q)) day = 3;
    if (/\btonight\b/i.test(q)) openOnly = true;
    var keywords = low.replace(/[^\w\s+]/g, " ").split(/\s+/).filter(function (w) {
      return w.length > 2 && !/^(the|and|for|with|that|this|near|me|now|what|where|something|please|our|are|was|can|you|any|all|how|who)$/.test(w);
    });
    return { raw: q, intent: intent, day: day, openOnly: openOnly, near: near, cheaper: cheaper, follow: follow, keywords: keywords, cur: cur };
  }

  var lastFilter = null;

  function scoreVenue(v, f) {
    var score = 0, why = [], cat = v.c || "";
    var blob = (plain(v.n) + " " + (v.hood || "") + " " + plain(v.why || "") + " " + (v.note || "") + " " + (CAT_LABELS[cat] || "") + " " + (v.loc || "")).toLowerCase();
    if (f.intent) {
      if (f.intent.cats.indexOf(cat) > -1 || (f.intent.wantPhoto && (v.photo || cat === "photo"))) {
        score += 40; why.push(CAT_LABELS[cat] || cat || "match");
      } else if (f.intent.wantPhoto && /sunset|skyline|photo|bay|river|beach/i.test(blob)) {
        score += 25; why.push("photo-friendly");
      } else score -= 15;
      if (f.intent.boost && f.intent.boost.indexOf(v.id) > -1) score += 12;
    }
    (f.keywords || []).forEach(function (kw) {
      if (blob.indexOf(kw) > -1) { score += 8; if (why.length < 3) why.push("mentions “" + kw + "”"); }
    });
    if (f.openOnly) {
      var stNow = openState(v);
      if (stNow.s === "open") { score += 30; why.push("open now"); }
      else if (stNow.s === "later") { score += 8; why.push("opens later"); }
      else if (stNow.s === "closed") score -= 40;
      else if (!v.h) score -= 5;
    } else if (f.day != null && v.h) {
      var hs = String(v.h[f.day] || "");
      if (/^\s*Closed/i.test(hs)) score -= 35;
      else if (!/^Not listed/i.test(hs)) {
        score += 10;
        why.push("open " + (tripDays[f.day] ? tripDays[f.day][0] : "that day"));
      }
    }
    if (f.cheaper) {
      var tr = tierRank(v.t);
      score += (4 - tr) * 8;
      if (tr <= 2) why.push(v.t || "budget-friendly");
    }
    if (v.loc) { score += 6; if (why.length < 4) why.push("local favorite"); }
    var ctx = ((cfg.context || "") + " " + (cfg.travelers || "")).toLowerCase();
    if (/health|organic|longevity|biohack/.test(ctx)) {
      if (cat === "well" || cat === "juice" || /organic|farm|healthy|vegan|gluten/i.test(blob)) score += 4;
    }
    if (/wine/.test(ctx) && cat === "wine") score += 4;
    if (/nature|beach|sunset|outdoor/.test(ctx) && (cat === "out" || v.photo)) score += 4;
    var d = distMiles(v);
    if (f.near && d != null) { score += Math.max(0, 35 - d * 8); why.push(fmtDist(d) + " away"); }
    var nameHit = plain(v.n).toLowerCase();
    (f.keywords || []).forEach(function (kw) { if (nameHit.indexOf(kw) > -1) score += 20; });
    return { score: score, why: why, dist: d };
  }

  function search(q, opts) {
    opts = opts || {};
    var f = parseQuery(q);
    if (opts.inherit && lastFilter) {
      if (f.follow || (!f.intent && (f.near || f.cheaper || f.day != null))) {
        if (!f.intent) f.intent = lastFilter.intent;
        if (f.day == null && lastFilter.day != null && f.follow !== "tomorrow") f.day = lastFilter.day;
        if (!f.openOnly) f.openOnly = lastFilter.openOnly;
        if (!f.keywords.length) f.keywords = lastFilter.keywords || [];
      }
    }
    if (f.follow === "tomorrow" && lastFilter && lastFilter.day != null) {
      f.day = Math.min(lastFilter.day + 1, tripDays.length - 1);
    }
    var ranked = venues().map(function (v) {
      var r = scoreVenue(v, f);
      return { v: v, score: r.score, why: r.why, dist: r.dist };
    }).filter(function (r) { return r.score >= 20; });
    ranked.sort(function (a, b) {
      if (f.near && a.dist != null && b.dist != null && Math.abs(a.dist - b.dist) > 0.05) return a.dist - b.dist;
      if (f.cheaper && tierRank(a.v.t) !== tierRank(b.v.t)) return tierRank(a.v.t) - tierRank(b.v.t);
      return b.score - a.score;
    });
    // No intent and no solid keyword hit → unknown (don't dump random local favorites)
    if (!f.intent && !f.openOnly && !f.near && !f.cheaper && f.day == null) {
      var strong = ranked.filter(function (r) { return r.score >= 28; });
      if (!strong.length) ranked = [];
      else ranked = strong;
    }
    lastFilter = f;
    return { filter: f, results: ranked.slice(0, 5) };
  }

  function whyLine(r, f) {
    var bits = r.why.filter(Boolean);
    if (!bits.length) bits.push(f.intent ? ("fits “" + f.intent.id + "”") : "matches your question");
    var seen = {}, out = [];
    bits.forEach(function (b) { var k = b.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(b); } });
    return out.slice(0, 3).join(" · ");
  }
  function hoursLine(v, f) {
    if (!v.h) return v.hs || "Hours not listed here";
    var d = f.day != null ? f.day : (f.cur && f.cur.d != null ? f.cur.d : 0);
    var dayLab = tripDays[d] ? (tripDays[d][0] + (tripDays[d][1] ? " " + tripDays[d][1] : "")) : "that day";
    if (f.openOnly) {
      var stNow = openState(v);
      var lab = stNow.s === "open" ? "Open now" : stNow.s === "later" ? "Opens later" : stNow.s === "closed" ? "Closed now" : "Check hours";
      return lab + " · " + (v.hs || v.h[d] || "");
    }
    return dayLab + ": " + (v.h[d] || v.hs || "");
  }
  function answerText(pack) {
    var f = pack.filter, n = pack.results.length;
    if (!n) {
      return "I only know the places on this site — I couldn’t match that. Try dinner, coffee, natural wine, cold plunge, outdoors, a sunset photo spot, or “what’s open now.”";
    }
    var intentLab = { well: "recovery / biohacking", out: "outdoors", photo: "photos / sunset", eat: "eating", wine: "wine", cafe: "coffee", juice: "juice" };
    var bits = ["Here are " + n + " picks"];
    if (f.intent) bits.push("for " + (intentLab[f.intent.id] || f.intent.id));
    if (f.openOnly) bits.push("open around " + whenLab());
    if (f.day != null && tripDays[f.day]) bits.push("on " + tripDays[f.day][0] + (tripDays[f.day][1] ? " " + tripDays[f.day][1] : ""));
    if (f.near) bits.push(host("LOC") ? "sorted by distance" : "(allow location and ask “closer” for distance)");
    if (f.cheaper) bits.push("leaning cheaper");
    bits.push("from this guide:");
    return bits.join(" ");
  }
  function maybeLlm(q, pack) {
    if (!cfg.llmEndpoint) return;
    try {
      fetch(cfg.llmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: q, city: cfg.city, dates: cfg.dates, context: cfg.context, travelers: cfg.travelers,
          results: pack.results.map(function (r) { return { id: r.v.id, name: plain(r.v.n), score: r.score, why: r.why }; })
        })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- UI (NOLA Ask-panel format) ---------- */
  var fab = document.createElement("button");
  fab.className = "ta-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Ask the trip assistant");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML = ICON_CHAT + '<span class="lbl">Ask</span>';

  var panel = document.createElement("section");
  panel.className = "ta-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask the trip assistant");
  var title = cfg.title || "Trip assistant";
  var subtitle = cfg.subtitle || ("Instant answers from this app’s places · " + (cfg.city || ""));
  var initial = (cfg.initial || title.charAt(0) || "T");
  panel.innerHTML =
    '<div class="ta-hd">' +
    '<span class="ta-avatar" aria-hidden="true">' + esc(initial) + "</span>" +
    "<div><b>" + esc(title) + "</b><small>" + esc(subtitle) + "</small></div>" +
    '<button class="ta-x" type="button" aria-label="Close">×</button></div>' +
    '<div class="ta-log" aria-live="polite"></div>' +
    '<div class="ta-sugg"></div>' +
    '<form class="ta-in">' +
    '<input id="ta-q" type="text" placeholder="Ask anything about the trip…" aria-label="Your question" autocomplete="off">' +
    '<button class="ta-send" type="submit" aria-label="Send">' + ICON_SEND + "</button></form>";

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector(".ta-log");
  var input = panel.querySelector("#ta-q");
  var sugg = panel.querySelector(".ta-sugg");
  (cfg.suggestions || []).forEach(function (s) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "ta-chip ta-sugg-chip"; b.textContent = s;
    b.onclick = function () { ask(s); };
    sugg.appendChild(b);
  });

  function scrollToMsgStart(d) {
    if (!d || !log) return;
    requestAnimationFrame(function () {
      var top = d.offsetTop - 6;
      log.scrollTop = Math.max(0, top);
    });
  }
  function addMsg(who, html, opts) {
    var d = document.createElement("div");
    d.className = "ta-msg " + who;
    d.innerHTML = html;
    log.appendChild(d);
    if (opts && opts.pinStart) scrollToMsgStart(d);
    else if (who === "me") scrollToMsgStart(d);
    else log.scrollTop = log.scrollHeight;
    return d;
  }

  function cardHtml(r, f) {
    var v = r.v, name = plain(v.n);
    var cat = CAT_LABELS[v.c] || (v.c === "photo" ? "Photo spot" : "Place");
    var sv = isSaved(v.id);
    return '<article class="ta-card" data-id="' + esc(v.id) + '">' +
      '<div class="ta-cat">' + esc(cat) + (v.hood ? " · " + esc(v.hood) : "") + (v.t ? " · " + esc(v.t) : "") + "</div>" +
      "<strong>" + esc(name) + "</strong>" +
      '<p class="ta-why"><b>Why it fits:</b> ' + esc(whyLine(r, f)) + "</p>" +
      (v.why ? (plain(v.why).length > 90
        ? '<details class="ta-more"><summary>More about this place</summary><p class="ta-blurb">' + esc(plain(v.why).slice(0, 160)) + (plain(v.why).length > 160 ? "…" : "") + "</p></details>"
        : '<p class="ta-blurb">' + esc(plain(v.why)) + "</p>") : "") +
      '<p class="ta-hours">' + esc(hoursLine(v, f)) + (r.dist != null ? " · " + fmtDist(r.dist) : "") + "</p>" +
      '<div class="ta-acts">' +
      '<a class="ta-act map" href="' + esc(mapsUrl(v)) + '" target="_blank" rel="noopener">Map</a>' +
      '<button type="button" class="ta-act open" data-taopen="' + esc(v.id) + '">Details</button>' +
      '<button type="button" class="ta-act save" data-save="' + esc(v.id) + '" aria-pressed="' + sv + '">' + (sv ? "♥ Saved" : "♡ Save") + "</button>" +
      "</div></article>";
  }

  function renderBot(pack) {
    var html = "<div>" + esc(answerText(pack)) + "</div>";
    if (pack.results.length) {
      html += '<div class="ta-chips">' + pack.results.map(function (r) {
        return '<button type="button" class="ta-chip" data-taopen="' + esc(r.v.id) + '">' + esc(plain(r.v.n).replace(/ · .*$/, "").slice(0, 42)) + "</button>";
      }).join("") + "</div>";
      html += '<div class="ta-cards">' + pack.results.map(function (r) { return cardHtml(r, pack.filter); }).join("") + "</div>";
      html += '<p class="ta-hint">Follow up with “closer”, “cheaper”, or “tomorrow”.</p>';
    }
    addMsg("bot", html, { pinStart: true });
  }

  function ask(q) {
    q = (q || input.value || "").trim();
    if (!q) return;
    input.value = "";
    if (sugg) sugg.hidden = true;
    addMsg("me", esc(q));
    var needsNear = /\b(near\s*me|nearby|closest|closer|around\s*here)\b/i.test(q) || /^\s*closer\b/i.test(q);
    function run() {
      var pack = search(q, { inherit: true });
      maybeLlm(q, pack);
      renderBot(pack);
    }
    if (needsNear && !host("LOC")) {
      addMsg("bot", "Looking up your location so I can sort by distance…");
      ensureLocate(function (ok) {
        if (!ok) addMsg("bot", "Couldn’t get location — showing best matches without distance. Allow location and ask “closer” again.");
        run();
      });
    } else run();
  }

  panel.querySelector(".ta-in").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  panel.addEventListener("click", function (e) {
    var open = e.target.closest("[data-taopen]");
    if (open) { openPlace(open.getAttribute("data-taopen")); return; }
    var save = e.target.closest("[data-save]");
    if (save) {
      var id = save.getAttribute("data-save");
      var on = toggleSave(id);
      panel.querySelectorAll('[data-save="' + id + '"]').forEach(function (x) {
        x.setAttribute("aria-pressed", on);
        x.textContent = on ? "♥ Saved" : "♡ Save";
      });
      document.querySelectorAll('.save[data-save="' + id + '"]').forEach(function (x) {
        x.setAttribute("aria-pressed", on);
        x.textContent = on ? "♥ Saved" : "♡ Save";
      });
    }
  });

  var open = false;
  function fitPanel() {
    if (!open || !panel || panel.hidden) return;
    if (window.innerWidth >= 1025 || !window.visualViewport) {
      panel.style.top = "";
      panel.style.height = "";
      panel.style.bottom = "";
      return;
    }
    var vv = window.visualViewport;
    var layoutH = window.innerHeight;
    var keyboardOpen = vv.height < layoutH - 80;
    if (keyboardOpen) {
      /* Fill the visual viewport so the input stays above the keyboard */
      panel.style.top = vv.offsetTop + "px";
      panel.style.height = Math.max(200, vv.height) + "px";
      panel.style.bottom = "auto";
    } else {
      panel.style.top = "";
      panel.style.height = "";
      panel.style.bottom = "";
    }
  }
  function show() {
    open = true;
    panel.hidden = false;
    document.documentElement.classList.add("ta-open");
    fab.classList.add("ta-fab-open");
    if (!log.childNodes.length) {
      addMsg("bot", "Hi — I know the places on this " + esc(cfg.city || "trip") + " guide. Ask about dinner, wine, recovery, outdoors, photos, or what’s open. Tap a suggestion or type your own.");
    }
    if (window.visualViewport) {
      visualViewport.addEventListener("resize", fitPanel);
      visualViewport.addEventListener("scroll", fitPanel);
    }
    fitPanel();
    setTimeout(function () { input.focus(); fitPanel(); }, 0);
  }
  function hide() {
    open = false;
    panel.hidden = true;
    document.documentElement.classList.remove("ta-open");
    fab.classList.remove("ta-fab-open");
    panel.style.top = "";
    panel.style.height = "";
    panel.style.bottom = "";
    if (window.visualViewport) {
      visualViewport.removeEventListener("resize", fitPanel);
      visualViewport.removeEventListener("scroll", fitPanel);
    }
    fab.focus();
  }
  function toggle() { if (open) hide(); else show(); }
  fab.onclick = toggle;
  panel.querySelector(".ta-x").onclick = hide;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) hide(); });
  /* Close assistant when tapping a bottom-nav tab so the tab works */
  document.addEventListener("click", function (e) {
    if (!open) return;
    var tab = e.target.closest(".tab[data-tab], #tabs [data-tab]");
    if (tab) hide();
  }, true);
  input.addEventListener("focus", function () { setTimeout(fitPanel, 300); });
  input.addEventListener("blur", function () { setTimeout(fitPanel, 200); });

  // Hide FAB while scrolling down (NOLA behavior)
  var lastY = window.scrollY, idle = null;
  window.addEventListener("scroll", function () {
    var y = window.scrollY, dy = y - lastY; lastY = y;
    if (open) return;
    if (dy > 6 && y > 120) fab.classList.add("fab-away");
    else if (dy < -6) fab.classList.remove("fab-away");
    clearTimeout(idle);
    idle = setTimeout(function () { fab.classList.remove("fab-away"); }, 900);
  }, { passive: true });

  window.TripAssistant = { ask: ask, search: search, config: cfg, open: show, close: hide };
})();
