# Tampa trip hub

Static GitHub Pages site (no build, no backend) for Sanni and her sister's Tampa trip, Oct 29 – Nov 1, 2026.

## "Ask the trip assistant" module

A floating button on every page opens a bottom sheet. The user types a question and taps ChatGPT, Grok or Claude; a new tab opens with a prefilled prompt containing the city, dates, travelers/context and the site's venue list. "Copy full prompt" gives the long version (full venue details) for pasting anywhere. No backend, no API keys.

Files: `trip-assistant.js`, `trip-assistant.css`, plus the config block in `index.html`.

### Reuse for another city (e.g. nola-trip)
1. Copy `trip-assistant.js` and `trip-assistant.css` into the repo and add to `index.html`:
   ```html
   <link rel="stylesheet" href="trip-assistant.css">
   <script type="application/json" id="trip-assistant-config">{ ...config... }</script>
   <script src="trip-assistant.js" defer></script>
   ```
2. Edit only the config:
   ```json
   {
     "city": "New Orleans, Louisiana",
     "dates": "Dates here",
     "travelers": "Who is going; interests",
     "context": "Dietary/wine/vibe preferences",
     "suggestions": ["Quick-tap question 1", "Question 2"],
     "apps": ["chatgpt", "grok", "claude"],
     "maxUrlChars": 1800,
     "venues": [{"name": "Place", "area": "Neighborhood", "type": "Restaurant", "address": "..."}]
   }
   ```
3. Venues: either list them in `venues`, or omit it and set `window.TRIP_VENUES = [{name, area, type, address}, ...]` from the page's own data before the module loads (Tampa does this from its `V` array, so the list never drifts).
4. Bump the cache name in `sw.js` and add the two module files to its shell list.

The module uses the host page's CSS variables (`--surface`, `--ink`, `--teal`, ...) with fallbacks, so it follows the site's light/dark theme.

### Link schemes (checked Oct 14, 2026)
- ChatGPT `https://chatgpt.com/?q=` prefills the composer; user presses send.
- Claude `https://claude.ai/new?q=` prefills a new chat; user presses send. Requires sign-in.
- Grok `https://grok.com/?q=` **submits immediately** on load.
Link prompts are capped (`maxUrlChars`, default 1800 encoded chars): the link version lists as many venue names as fit; the copy version is complete. If a provider drops its `?q=` support, remove it from `apps`.

## NOLA-parity update (Oct 14, 2026)
Extra files: `tampa-features.js` / `.css` (all new features, loaded after the main script), `tampa-coords.js` (venue coordinates from OpenStreetMap/Nominatim address lookups; parks are street-level and flagged approximate in the card). Leaflet + markercluster come from cdnjs, OSM tiles.
New: Map tab (pins by type, tap for details sheet, locate me, area jumps, open-now/saved filters, places-in-view list), Journal (replaces NOLA's tattoo "Ink": visited, ratings, notes, passport, share recap, send location), Help tab (911/TPD/Poison/988, ER, urgent care, 24h pharmacy, TPA, rides, Halloween + DST, practical notes, app guide, tour), Open-now pill with preview time, Near me, Surprise me, weather (Open-Meteo), Route-this-day, copy-link deep links (`?p=<id>`), install button. Photos is now a toggle inside Places; Notes moved into Help. Service worker cache `tampa-trip-v4`.

## Site structure (Oct 14, 2026 update)
- Bottom tab bar on phones (Home, Plan, Places, Photos, Saved, Notes), same pattern as the NOLA app; on desktop the same tabs sit in the header. Saved lives only in the tab bar (with a count badge).
- Places filters: type (Eat, Coffee, Biohack, Natural wine, Juice, Outdoors & nature), ★ Local favorites (each carries its source in `loc`), Photo-worthy, plus neighborhood and day.
- Photos tab: the Top 10 photo spots (`P` array) and sunrise/sunset table.
- Data lives in `V` (places) and `P` (photo spots) in `index.html`. Not pushed yet.
