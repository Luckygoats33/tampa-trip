# Tampa trip hub

Static GitHub Pages site (no build, no backend) for Sanni and her sister's Tampa trip, Oct 29 – Nov 1, 2026.

## "Ask the trip assistant" module

Same format/UX as the NOLA app’s **Ask** panel: a circular **Ask** FAB (bottom right; hides while you scroll down), a floating chat panel with dark header, message bubbles, suggestion chips, and a pill input + circular send button.

Fully **in-house** and client-side. The user types a question or taps a chip, taps Send, and gets ranked place cards from this site’s own data (intent/keyword + tags, neighborhood, price tier, open-now hours, optional distance) with a “why it fits” line, hours, Maps link, Details, and Save. Follow-ups: “closer”, “cheaper”, “tomorrow”. Unknowns get a graceful “I only know the places on this site” reply.

No ChatGPT / Grok / Claude handoff, no API keys, no backend.

Files: `trip-assistant.js`, `trip-assistant.css`, plus the config block in `index.html`.

### Reuse for another city
1. Copy `trip-assistant.js` / `trip-assistant.css` and wire them:
   ```html
   <link rel="stylesheet" href="trip-assistant.css">
   <script type="application/json" id="trip-assistant-config">{ ... }</script>
   <script src="trip-assistant.js" defer></script>
   ```
2. Edit the config:
   ```json
   {
     "city": "New Orleans, Louisiana",
     "dates": "Dates here",
     "travelers": "Who is going",
     "context": "Preferences",
     "title": "Trip assistant",
     "subtitle": "Instant answers from this app’s places",
     "initial": "N",
     "suggestions": [
       "cold plunge near me",
       "healthy dinner tonight",
       "organic wine",
       "sunset photo spot",
       "something outdoors that burns calories",
       "what's open now"
     ],
     "storageKey": "nola-saved",
     "llmEndpoint": null,
     "days": [["Thu","Oct 1"],["Fri","Oct 2"],["Sat","Oct 3"],["Sun","Oct 4"]],
     "venues": [{ "id":"p1","c":"eat","n":"Place","hood":"Area","a":"Address","t":"$$","h":["5–9pm","5–10pm","5–10pm","Closed"],"hs":"…","why":"…","site":"https://…","photo":0 }]
   }
   ```
   Category codes (`c`): `eat`, `cafe`, `well`, `wine`, `juice`, `out`, `photo`. Optional `categoryLabels` overrides.
3. Venues: put them in `venues`, or set `window.TRIP_ASSISTANT_VENUES` before load. Tampa reuses page globals `V` / `P` and host helpers (`isOpen`, `stateAt`, `maps`, `saved`, `locate`, `openSheet`, …).
4. Optional LLM hook: `"llmEndpoint": "https://your.example/assist"` POSTs `{ q, city, dates, context, travelers, results }` on each Ask. The UI does not wait; ranking stays client-side. Leave `null` for offline-only.
5. Bump the cache name in `sw.js` and keep the module files in the shell list.

Uses host CSS variables (`--surface`, `--ink`, `--teal`, …) so light/dark themes apply.

### Matching
Intent keywords (cold plunge → wellness, dinner → eat, organic wine → wine, sunset/photo → outdoors & photo spots, …), text match on name/`why`/notes, open-now/day filters, geolocation for “near me”/“closer”, cheaper `$` tiers, “tomorrow” day shift.

## NOLA-parity update (Oct 14, 2026)
Extra files: `tampa-features.js` / `.css`, `tampa-coords.js`. Leaflet + markercluster from cdnjs, OSM tiles.
Map, Journal, Help, Open-now, Near me, Surprise me, weather, Route-this-day, deep links, install button. Service worker cache `tampa-trip-v5`.

## Site structure
Bottom tab bar on phones (Home, Plan, Places, Map, Saved, Journal, Help). Places filters by type, local favorites, photo-worthy, neighborhood, day. Data in `V` and `P` in `index.html`.
