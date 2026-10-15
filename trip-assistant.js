/* Trip assistant module. No backend, no keys: builds a prompt and hands it to a chat app.
   Reusable: change only the JSON block <script type="application/json" id="trip-assistant-config">.
   Venues: config.venues = [{name, area, type, address}] OR leave out and the host page sets window.TRIP_VENUES. */
(function () {
  "use strict";
  var el = document.getElementById("trip-assistant-config");
  if (!el) return;
  var cfg;
  try { cfg = JSON.parse(el.textContent); } catch (e) { console.warn("trip-assistant: bad config JSON"); return; }
  var venues = cfg.venues || window.TRIP_VENUES || [];
  var MAXURL = cfg.maxUrlChars || 1800; // cap on the encoded prompt inside a link
  var APPS = [
    { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/?q=" },
    { id: "grok", label: "Grok", url: "https://grok.com/?q=" },
    { id: "claude", label: "Claude", url: "https://claude.ai/new?q=" }
  ].filter(function (a) { return !cfg.apps || cfg.apps.indexOf(a.id) > -1; });

  function header() {
    return "I'm planning a trip to " + cfg.city + ", " + cfg.dates + ". Travelers: " + cfg.travelers + ". " + cfg.context;
  }
  function venueLine(v, full) {
    if (!full) return v.name;
    return v.name + (v.type ? " (" + v.type + ")" : "") + (v.area ? ", " + v.area : "") + (v.address ? ", " + v.address : "");
  }
  function build(question, full, budget) {
    var q = (question || "").trim() || "What should we prioritize?";
    var pre = header() + "\n\nQuestion: " + q + "\n\nMy shortlist of places (prefer these, say if something else fits better): ";
    var post = "\n\nKeep it concise, practical, and mention reservations or hours I should check.";
    var list = venues.map(function (v) { return venueLine(v, full); });
    if (full) return { text: pre + list.join("; ") + post, cut: 0 };
    var n = list.length;
    function make(k) { return pre + list.slice(0, k).join(", ") + (k < list.length ? ", and " + (list.length - k) + " more" : "") + post; }
    while (n > 0 && encodeURIComponent(make(n)).length > budget) n--;
    return { text: make(n), cut: list.length - n };
  }

  var fab = document.createElement("button");
  fab.className = "ta-fab"; fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML = "<span aria-hidden='true'>✦</span> Ask the trip assistant";
  var back = document.createElement("div");
  back.className = "ta-back"; back.hidden = true;
  var chips = (cfg.suggestions || []).map(function (s) { return "<button type='button' class='ta-chip'></button>"; }).join("");
  back.innerHTML =
    "<div class='ta-sheet' role='dialog' aria-modal='true' aria-labelledby='ta-title'>" +
    "<div class='ta-head'><h2 id='ta-title'>Ask the trip assistant</h2><button type='button' class='ta-x' aria-label='Close'>✕</button></div>" +
    "<p class='ta-ctx'></p>" +
    "<div class='ta-chips'>" + chips + "</div>" +
    "<label class='small muted' for='ta-q'>Your question</label>" +
    "<textarea id='ta-q' class='ta-q' placeholder='e.g. Best spot for a Saturday splurge dinner?'></textarea>" +
    "<div class='ta-open'></div>" +
    "<button type='button' class='ta-copy'>Copy full prompt</button>" +
    "<p class='ta-msg' role='status' aria-live='polite'></p></div>";
  document.body.appendChild(fab); document.body.appendChild(back);

  var $ = function (s) { return back.querySelector(s); };
  var ta = $(".ta-q"), msg = $(".ta-msg"), open = $(".ta-open");
  $(".ta-ctx").textContent = cfg.city + " · " + cfg.dates + " · " + venues.length + " places from this guide are included in the prompt.";
  [].forEach.call(back.querySelectorAll(".ta-chip"), function (b, i) { b.textContent = cfg.suggestions[i]; b.onclick = function () { ta.value = cfg.suggestions[i]; refresh(); ta.focus(); }; });
  open.innerHTML = APPS.map(function (a) { return "<a target='_blank' rel='noopener noreferrer' data-app='" + a.id + "'>" + a.label + "</a>"; }).join("");
  open.style.gridTemplateColumns = "repeat(" + Math.max(APPS.length, 1) + ",1fr)";

  function refresh() {
    var r = build(ta.value, false, MAXURL - 60 - encodeURIComponent(ta.value).length * 0);
    var enc = encodeURIComponent(r.text);
    APPS.forEach(function (a) { open.querySelector("[data-app=" + a.id + "]").href = a.url + enc; });
    msg.textContent = r.cut ? "Link version lists " + (venues.length - r.cut) + " of " + venues.length + " places to stay short. “Copy full prompt” has all details." : "";
  }
  function show() { back.hidden = false; document.body.style.overflow = "hidden"; refresh(); setTimeout(function () { ta.focus(); }, 0); }
  function hide() { back.hidden = true; document.body.style.overflow = ""; fab.focus(); }
  fab.onclick = show;
  $(".ta-x").onclick = hide;
  back.addEventListener("click", function (e) { if (e.target === back) hide(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !back.hidden) hide(); });
  ta.addEventListener("input", refresh);
  $(".ta-copy").onclick = function () {
    var t = build(ta.value, true).text;
    function ok() { msg.textContent = "Copied. Paste it into any chat app."; }
    function fallback() { var x = document.createElement("textarea"); x.value = t; x.style.position = "fixed"; x.style.opacity = "0"; document.body.appendChild(x); x.select(); try { document.execCommand("copy"); ok(); } catch (e) { msg.textContent = "Copy failed. Long-press the question and copy manually."; } x.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fallback); else fallback();
  };
  window.TripAssistant = { buildPrompt: build, config: cfg };
})();
