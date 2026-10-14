/*
 * NFL Season Dashboard
 * =====================
 * Shows every game of a chosen NFL season week-by-week (scores, results, TV, primetime games)
 * next to that season's division standings.
 *
 * Data source
 * -----------
 * ESPN's public (unofficial, no API key) NFL endpoints, documented at
 * https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c
 * ESPN sends the header `Access-Control-Allow-Origin: *`, which means the browser is allowed
 * to call it directly from our page. No backend or proxy server is needed.
 *
 * How the page works (big picture)
 * --------------------------------
 *   1. On page load we fill the Season dropdown and call loadSeason() for the current season.
 *   2. loadSeason() does two things at once:
 *        - loadStandings(): fetches the standings and draws the AFC/NFC tables on the right.
 *        - fetches Week 1's scoreboard. Every scoreboard response includes the season's
 *          full calendar, so we use it to build the Week dropdown (buildWeeks/populateWeeks).
 *   3. loadWeek() fetches the scoreboard for the selected week and renderGames() draws a
 *      Bootstrap card for each game.
 *   4. Event listeners at the bottom of the file re-run these steps when the user changes
 *      the season, the week, or the primetime switch.
 *
 * All HTML is built as template strings and inserted with innerHTML. Any text that comes from
 * the API is passed through escapeHTML() first (see that function for why).
 *
 * File layout: Config → Page elements → State → Helpers → Primetime → Season & week setup
 *              → Games → Standings → Events / startup
 */

// ---------- Config ----------

// Scoreboard: all games for one week. Query params: dates=<season year>, seasontype, week.
const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
// Standings: W/L records for a whole season. Query params: season=<year>, level=3 (see loadStandings).
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

// 2002 is the first season with the current 32-team, 8-division layout.
const FIRST_SEASON = 2002;

// ESPN's "seasontype" codes: 1 = preseason, 2 = regular season, 3 = postseason, 4 = offseason.
// They're strings because that's how ESPN returns them in the calendar data.
// We only show regular season and postseason games.
const REGULAR_SEASON = "2";
const POSTSEASON = "3";

// ---------- Page elements ----------
// Looked up once here so the rest of the code doesn't keep calling getElementById.
// The ids match the elements in nflAPI.html.

const seasonSelect = document.getElementById("seasonSelect");       // Season dropdown
const weekSelect = document.getElementById("weekSelect");           // Week dropdown
const prevWeekBtn = document.getElementById("prevWeek");            // "<" button
const nextWeekBtn = document.getElementById("nextWeek");            // ">" button
const primetimeToggle = document.getElementById("primetimeOnly");   // "Primetime games only" switch
const gamesEl = document.getElementById("games");                   // container the game cards go into
const gamesErrorEl = document.getElementById("gamesError");         // red alert shown if games fail to load
const weekTitleEl = document.getElementById("weekTitle");           // e.g. "2024 · Week 5"
const weekDatesEl = document.getElementById("weekDates");           // e.g. "Oct 2-8"
const weekSummaryEl = document.getElementById("weekSummary");       // the "16 games / 14 final / …" badges
const standingsErrorEl = document.getElementById("standingsError"); // red alert shown if standings fail

// ---------- State ----------
// Values that change while the page is being used.

// The weeks of the selected season, in dropdown order. Each entry looks like:
//   { seasonType: "2", week: "1", label: "Week 1", detail: "Sep 4-9", start: Date, end: Date }
// The Week dropdown's option values are indexes into this array.
let weeks = [];

// The raw ESPN "event" objects (one per game) for the week currently on screen, sorted by kickoff.
// Kept so the primetime switch can re-filter them without fetching again.
let currentEvents = [];

// Guards against out-of-order responses. Every season/week load bumps this number and remembers
// its own copy. When the response arrives, if the number has changed, the user has already
// picked something else, so the old response is thrown away instead of overwriting newer data.
// Example: click Week 3, then quickly Week 4. If Week 3's data arrives last it's ignored.
let requestId = 0;

// request URL → parsed JSON (see getJSON)
const cache = new Map();

// ---------- Helpers ----------

/**
 * Fetches a URL and returns the parsed JSON. Results are cached by URL for as long as
 * the page is open, so revisiting a week or season doesn't download it again.
 * Throws an Error if the request fails, which the callers catch and show to the user.
 */
async function getJSON(url) {
    // Cache hit: reuse the data we already downloaded for this exact URL.
    if (cache.has(url)) return cache.get(url);

    // Cache miss: request it from ESPN and fail loudly on HTTP errors (404, 500, …).
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();

    // Remember the result so later calls with the same URL skip the network.
    cache.set(url, data);
    return data;
}

/**
 * Builds the scoreboard URL for one week of one season.
 * Example: scoreboardUrl(2024, "2", 5) → …/scoreboard?dates=2024&seasontype=2&week=5
 * Used in more than one place, and getJSON's cache relies on the URL being spelled
 * exactly the same every time.
 */
function scoreboardUrl(season, seasonType, week) {
    return `${SCOREBOARD_URL}?dates=${season}&seasontype=${seasonType}&week=${week}`;
}

/**
 * Makes text safe to put inside HTML by replacing the five characters HTML treats specially.
 * We build markup with innerHTML, so without this a team name like "A<b>" would be read as
 * a tag. Escaping any API text we display is a good habit (it also blocks script injection).
 * `?? ""` turns null/undefined into an empty string instead of the word "undefined".
 */
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
}

/**
 * Returns the current NFL season's year.
 * The NFL season is named after the year it starts; Jan/Feb games (playoffs, Super Bowl)
 * belong to the previous season. getMonth() is 0-based, so `< 2` means January or February.
 */
function getCurrentSeason() {
    const today = new Date();
    return today.getMonth() < 2 ? today.getFullYear() - 1 : today.getFullYear();
}

/**
 * Returns an <img> tag for a team logo that looks good on our dark background.
 * ESPN hosts dark-background versions of most logos under /500-dark/.
 * Older franchises (e.g. the St. Louis Rams) don't have one, so if the dark image fails to
 * load, the inline `onerror` swaps in the normal logo. `this.onerror=null` stops it from
 * looping forever if the fallback image fails too.
 */
function logoImg(url, className) {
    const dark = url.includes("/500-dark/") ? url : url.replace("/500/", "/500-dark/");
    const fallback = url.replace("/500-dark/", "/500/");
    return `<img class="${className}" src="${escapeHTML(dark)}" alt=""
                 onerror="this.onerror=null;this.src='${escapeHTML(fallback)}'">`;
}

/** Bootstrap loading spinner with a caption, shown while data is being fetched. */
function spinner(text) {
    return `<div class="text-center py-5 text-body-secondary">
                <div class="spinner-border mb-2" role="status"></div>
                <div>${escapeHTML(text)}</div>
            </div>`;
}

// ---------- Primetime detection ----------
// ESPN doesn't mark games as "primetime", so we work it out from the kickoff time.

/**
 * Returns a label like "Sunday Night Football" if the game is a primetime game, or null if not.
 *
 * A game is primetime when it kicks off at 7 PM Eastern or later. We convert to Eastern time
 * (instead of using the viewer's own time zone) so the answer is the same for everyone.
 * Games with an unset kickoff (timeValid === false) are TBD and never primetime. ESPN gives
 * those a placeholder time that would otherwise look like a late-night game.
 *
 * @param event one game object from the scoreboard's `events` array
 */
function getPrimetimeLabel(event) {
    const competition = event.competitions[0];
    if (competition.timeValid === false) return null;

    // Intl.DateTimeFormat converts the UTC kickoff (event.date, e.g. "2025-09-05T00:20Z") to
    // New York time. formatToParts gives the pieces separately, so we can read the hour and
    // weekday without parsing a string. "h23" means a 0–23 hour clock, so 8 PM is 20.
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long",
        hour: "numeric",
        hourCycle: "h23"
    }).formatToParts(new Date(event.date));

    const hour = Number(parts.find(p => p.type === "hour").value);
    const weekday = parts.find(p => p.type === "weekday").value;
    if (hour < 19) return null;

    // The three regular primetime slots have well-known names. Anything else
    // (Friday international games, Saturday late-season games, holidays) gets a generic label.
    const names = {
        Thursday: "Thursday Night Football",
        Sunday: "Sunday Night Football",
        Monday: "Monday Night Football"
    };
    return names[weekday] || `${weekday} Night Football`;
}

/**
 * Returns the TV networks for a game as one string, e.g. "NBC / Peacock".
 * ESPN's shape is broadcasts: [{ market: "national", names: ["NBC", "Peacock"] }, …],
 * so flatMap collects every `names` list into one array. Empty string if none are listed.
 */
function getBroadcasts(competition) {
    return (competition.broadcasts || []).flatMap(b => b.names || []).join(" / ");
}

// ---------- Season & week setup ----------

/** Fills the Season dropdown from the current season back to FIRST_SEASON (newest first). */
function populateSeasons() {
    const current = getCurrentSeason();
    for (let year = current; year >= FIRST_SEASON; year--) {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year === current ? `${year} (current)` : year;
        seasonSelect.appendChild(option);
    }
    seasonSelect.value = current;
}

/**
 * Turns ESPN's season calendar into our `weeks` list.
 *
 * Every scoreboard response includes `leagues[0].calendar`, which looks roughly like:
 *   [ { label: "Preseason",      value: "1", entries: [ … ] },
 *     { label: "Regular Season", value: "2", entries: [ { label: "Week 1", value: "1",
 *                                                         detail: "Sep 4-9", startDate, endDate }, … ] },
 *     { label: "Postseason",     value: "3", entries: [ Wild Card, Divisional, …, Super Bowl ] },
 *     { label: "Off Season",     value: "4", entries: [ … ] } ]
 *
 * We keep only regular season + postseason, and skip the Pro Bowl (it isn't a real game
 * between two NFL teams).
 */
function buildWeeks(calendar) {
    const list = [];
    for (const type of calendar) {
        if (type.value !== REGULAR_SEASON && type.value !== POSTSEASON) continue;
        for (const entry of type.entries || []) {
            if (/pro bowl/i.test(entry.label)) continue;
            list.push({
                seasonType: type.value,
                week: entry.value,
                label: entry.label,
                detail: entry.detail,
                start: new Date(entry.startDate),
                end: new Date(entry.endDate)
            });
        }
    }
    return list;
}

/**
 * Rebuilds the Week dropdown from `weeks`, split into "Regular Season" and "Postseason"
 * groups (<optgroup> is the HTML element that draws those group headings).
 * Each option's value is its index in `weeks`, so weeks[Number(weekSelect.value)] is always
 * the selected week.
 */
function populateWeeks() {
    weekSelect.innerHTML = "";
    const groups = {
        [REGULAR_SEASON]: Object.assign(document.createElement("optgroup"), { label: "Regular Season" }),
        [POSTSEASON]: Object.assign(document.createElement("optgroup"), { label: "Postseason" })
    };
    weeks.forEach((w, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `${w.label} (${w.detail})`;
        groups[w.seasonType].appendChild(option);
    });
    // Only add a group if it has weeks in it (avoids an empty "Postseason" heading).
    Object.values(groups).forEach(g => { if (g.children.length) weekSelect.appendChild(g); });
}

/**
 * Picks which week to show first for the current season (returns an index into `weeks`):
 *   - during the season: the week happening right now
 *   - after the Super Bowl: Week 1
 *   - between weeks or before the season: the next upcoming week (or Week 1)
 * Only used for the current season; past seasons always open on Week 1 (see loadSeason).
 */
function getDefaultWeekIndex() {
    const now = new Date();
    const index = weeks.findIndex(w => now >= w.start && now <= w.end);
    if (index !== -1) return index;
    if (weeks.length && now > weeks[weeks.length - 1].end) return 0;
    const upcoming = weeks.findIndex(w => now < w.start);
    return upcoming > 0 ? upcoming : 0;
}

/**
 * Loads everything for a season: standings, the Week dropdown, and the first week's games.
 * Runs on page load and whenever the Season dropdown changes.
 */
async function loadSeason(season) {
    // Claim a new request number (see `requestId` in the State section).
    const id = ++requestId;

    // Reset the games area to a loading state while we wait.
    weeks = [];
    weekSelect.innerHTML = "<option>Loading…</option>";
    weekTitleEl.textContent = `${season} Season`;
    weekDatesEl.textContent = "";
    weekSummaryEl.innerHTML = "";
    gamesEl.innerHTML = spinner("Loading schedule…");
    gamesErrorEl.classList.add("d-none");

    // Not awaited on purpose: standings load in parallel with the schedule below.
    loadStandings(season);

    try {
        // Week 1's scoreboard also contains the season calendar we need for the dropdown.
        // loadWeek() will ask for this same URL again if Week 1 is shown; getJSON's cache
        // answers it without a second download.
        const data = await getJSON(scoreboardUrl(season, REGULAR_SEASON, 1));
        if (id !== requestId) return; // the user picked another season while we waited
        weeks = buildWeeks(data.leagues?.[0]?.calendar || []);
        if (!weeks.length) throw new Error("No schedule found for this season.");
        populateWeeks();
        weekSelect.value = season === getCurrentSeason() ? getDefaultWeekIndex() : 0;
        await loadWeek();
    } catch (error) {
        if (id !== requestId) return;
        showGamesError(`Could not load the ${season} schedule. ${error.message}`);
    }
}

// ---------- Games ----------
//
// Shape of the scoreboard data we use (trimmed down; ESPN sends much more):
//
//   data.events[] ─ one per game
//     .date                        kickoff time in UTC, e.g. "2025-09-07T17:00Z"
//     .competitions[0]             the game itself (always exactly one for NFL)
//        .timeValid                false when the kickoff time hasn't been set yet (TBD)
//        .neutralSite              true for international / neutral-site games
//        .status.type
//           .state                 "pre" (not started), "in" (live), or "post" (over)
//           .completed             true once the game is final
//           .shortDetail           "Final", "Final/OT", "Q3 4:12", …
//        .competitors[]            the two teams
//           .homeAway              "home" or "away"
//           .score                 a string, e.g. "24"
//           .winner                true/false once the game is over
//           .team                  { displayName, shortDisplayName, abbreviation, logo, … }
//           .records[]             records going into/after this game, e.g. { type: "total", summary: "3-1" }
//        .venue.fullName           stadium
//        .broadcasts[]             TV networks (see getBroadcasts)
//        .notes[0].headline        special notes, e.g. "NFL London Games" or "AFC Wild Card"

/**
 * Loads and draws the games for whichever week is selected in the Week dropdown.
 * Runs when the week changes and at the end of loadSeason().
 */
async function loadWeek() {
    const id = ++requestId;
    const season = seasonSelect.value;
    const w = weeks[Number(weekSelect.value)];
    if (!w) return;

    updateWeekButtons();
    weekTitleEl.textContent = `${season} · ${w.label}`;
    weekDatesEl.textContent = w.detail;
    weekSummaryEl.innerHTML = "";
    gamesErrorEl.classList.add("d-none");
    gamesEl.innerHTML = spinner("Loading games…");

    try {
        const data = await getJSON(scoreboardUrl(season, w.seasonType, w.week));
        if (id !== requestId) return; // a newer week/season was picked while we waited
        // .slice() makes a copy first, so sorting doesn't reorder the cached data.
        currentEvents = (data.events || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        renderGames();
    } catch (error) {
        if (id !== requestId) return;
        showGamesError(`Could not load games for ${w.label}. ${error.message}`);
    }
}

/** Clears the games area and shows `message` in the red Bootstrap alert. */
function showGamesError(message) {
    gamesEl.innerHTML = "";
    gamesErrorEl.textContent = message;
    gamesErrorEl.classList.remove("d-none");
}

/** Disables "<" on the first week and ">" on the last week so they can't go out of range. */
function updateWeekButtons() {
    const index = Number(weekSelect.value);
    prevWeekBtn.disabled = index <= 0;
    nextWeekBtn.disabled = index >= weeks.length - 1;
}

/**
 * Draws the row of count badges above the games, e.g. "16 games · 14 final · 1 live · …".
 * Counts use all of the week's games, even when the primetime filter is on.
 */
function renderSummary() {
    const total = currentEvents.length;
    const final = currentEvents.filter(e => e.competitions[0].status.type.completed).length;
    const live = currentEvents.filter(e => e.competitions[0].status.type.state === "in").length;
    const primetime = currentEvents.filter(e => getPrimetimeLabel(e)).length;
    const upcoming = total - final - live;

    // The "live" and "TBD / upcoming" badges only appear when their count is above zero.
    weekSummaryEl.innerHTML = `
        <span class="badge text-bg-secondary">${total} games</span>
        <span class="badge text-bg-success">${final} final</span>
        ${live ? `<span class="badge text-bg-danger">${live} live</span>` : ""}
        ${upcoming ? `<span class="badge text-bg-warning">${upcoming} TBD / upcoming</span>` : ""}
        <span class="badge bg-primetime"><i class="bi bi-moon-stars-fill"></i> ${primetime} primetime</span>`;
}

/**
 * Draws all game cards for `currentEvents`, grouped under day headings ("SUNDAY, SEPTEMBER 7").
 * Also called on its own when the primetime switch is flipped: the data is already
 * loaded, so it only needs to redraw.
 */
function renderGames() {
    renderSummary();

    const events = primetimeToggle.checked
        ? currentEvents.filter(e => getPrimetimeLabel(e))
        : currentEvents;

    if (!events.length) {
        gamesEl.innerHTML = `<div class="alert alert-info">${
            primetimeToggle.checked ? "No primetime games this week." : "No games scheduled for this week."
        }</div>`;
        return;
    }

    // Group games by the day they are played (TBD games get their own group).
    // A Map keeps groups in insertion order, and the events are already sorted by kickoff,
    // so the days come out in date order. toLocaleDateString shows the date in the viewer's own format.
    const groups = new Map();
    for (const event of events) {
        const tbd = event.competitions[0].timeValid === false;
        const key = tbd
            ? "Date & Time TBD"
            : new Date(event.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
    }

    // For each day: a heading, then a Bootstrap grid of cards
    // (1 per row on phones, 2 per row from the "md" breakpoint up).
    gamesEl.innerHTML = [...groups].map(([day, dayEvents]) => `
        <h3 class="h6 text-uppercase text-body-secondary day-heading mt-3 mb-3">${escapeHTML(day)}</h3>
        <div class="row row-cols-1 row-cols-md-2 g-3 mb-2">
            ${dayEvents.map(renderGameCard).join("")}
        </div>`).join("");
}

/**
 * Returns the HTML for one game card:
 *   header: status badge (Final / LIVE / kickoff time / TBD) + primetime badge if it applies
 *   body:   away team, "@" (or "vs" at a neutral site), home team
 *   footer: special note (e.g. "NFL London Games"), result sentence, stadium, TV networks
 */
function renderGameCard(event) {
    const competition = event.competitions[0];
    const status = competition.status.type;
    const primetime = getPrimetimeLabel(event);
    const broadcasts = getBroadcasts(competition);
    const note = competition.notes?.[0]?.headline;
    const away = competition.competitors.find(c => c.homeAway === "away");
    const home = competition.competitors.find(c => c.homeAway === "home");
    const separator = competition.neutralSite ? "vs" : "@";

    // The "primetime" class adds the purple border (see nflAPI.css).
    return `
        <div class="col">
            <div class="card h-100 shadow-sm game-card ${primetime ? "primetime" : ""}">
                <div class="card-header d-flex justify-content-between align-items-center small bg-transparent">
                    ${renderStatusBadge(competition)}
                    ${primetime
                        ? `<span class="badge bg-primetime"><i class="bi bi-moon-stars-fill"></i> ${escapeHTML(primetime)}</span>`
                        : ""}
                </div>
                <div class="card-body py-2">
                    ${renderTeamRow(away, status)}
                    <div class="text-body-secondary small ps-5">${separator}</div>
                    ${renderTeamRow(home, status)}
                </div>
                <div class="card-footer small text-body-secondary bg-transparent">
                    ${note ? `<div class="fw-semibold text-body">${escapeHTML(note)}</div>` : ""}
                    <div>${renderResultText(competition, away, home)}</div>
                    <div class="d-flex justify-content-between flex-wrap gap-2 mt-1">
                        <span><i class="bi bi-geo-alt"></i> ${escapeHTML(competition.venue?.fullName || "Venue TBD")}</span>
                        ${broadcasts ? `<span><i class="bi bi-tv"></i> ${escapeHTML(broadcasts)}</span>` : ""}
                    </div>
                </div>
            </div>
        </div>`;
}

/**
 * Returns the colored badge in the top-left corner of a game card. The checks run in order
 * and the first match wins:
 *   live → red "LIVE · Q3 4:12"      final → green "Final" / "Final/OT"
 *   postponed/canceled → dark badge   no kickoff time yet → yellow "TBD"
 *   otherwise → the kickoff time in the viewer's time zone, e.g. "1:00 PM EDT"
 */
function renderStatusBadge(competition) {
    const status = competition.status.type;
    if (status.state === "in") {
        return `<span class="badge text-bg-danger"><i class="bi bi-broadcast"></i> LIVE · ${escapeHTML(status.shortDetail)}</span>`;
    }
    if (status.completed) {
        return `<span class="badge text-bg-success">${escapeHTML(status.shortDetail)}</span>`;
    }
    if (status.name === "STATUS_POSTPONED" || status.name === "STATUS_CANCELED") {
        return `<span class="badge text-bg-dark">${escapeHTML(status.description)}</span>`;
    }
    if (competition.timeValid === false) {
        return `<span class="badge text-bg-warning">TBD</span>`;
    }
    const kickoff = new Date(competition.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return `<span class="badge text-bg-secondary">${escapeHTML(kickoff)}</span>`;
}

/**
 * Returns one team's line on a game card: logo, name, record, and score.
 * After a final, the winner's row gets the "winner" class (bold name + green arrow) and the
 * loser's row gets "loser" (faded); both classes are styled in nflAPI.css. Before kickoff the
 * score shows "–", since ESPN reports "0" for games that haven't started.
 */
function renderTeamRow(competitor, status) {
    const team = competitor.team;
    const played = status.state !== "pre";
    const record = competitor.records?.find(r => r.type === "total")?.summary;
    let resultClass = "";
    if (status.completed && competitor.winner) resultClass = "winner";
    else if (status.completed && competitor.winner === false && played) resultClass = "loser";

    return `
        <div class="d-flex align-items-center gap-2 py-1 team-row ${resultClass}">
            ${team.logo ? logoImg(team.logo, "team-logo") : ""}
            <div class="flex-grow-1">
                <div class="team-name">${escapeHTML(team.displayName)}</div>
                ${record ? `<small class="text-body-secondary">${escapeHTML(record)}</small>` : ""}
            </div>
            ${competitor.winner ? `<i class="bi bi-caret-left-fill text-success"></i>` : ""}
            <div class="score">${played ? escapeHTML(competitor.score) : "–"}</div>
        </div>`;
}

/**
 * Returns the one-line result under the teams, e.g. "Result: Eagles beat Chiefs 40–22".
 * Unfinished games say "Result: TBD" (or "Game in progress" while live). Ties are possible
 * in the NFL regular season, so they get their own message.
 */
function renderResultText(competition, away, home) {
    const status = competition.status.type;
    if (!status.completed) {
        return status.state === "in" ? "Game in progress" : "Result: TBD";
    }
    // Scores come back as strings; convert them so we compare numbers, not text ("9" > "10" as text).
    const awayScore = Number(away.score);
    const homeScore = Number(home.score);
    if (awayScore === homeScore) {
        return `Result: Tie, ${awayScore}–${homeScore}`;
    }
    const [winner, loser] = awayScore > homeScore ? [away, home] : [home, away];
    return `Result: <span class="fw-semibold text-body">${escapeHTML(winner.team.shortDisplayName)}</span>
            beat ${escapeHTML(loser.team.shortDisplayName)} ${escapeHTML(winner.score)}–${escapeHTML(loser.score)}`;
}

// ---------- Standings ----------
//
// Shape of the standings data with level=3 (trimmed down):
//
//   data.children[]                        conferences: AFC, NFC
//     .abbreviation                        "AFC" / "NFC" (matches the tab ids conf-AFC / conf-NFC)
//     .children[]                          divisions: "AFC East", "AFC North", …
//        .name
//        .standings.entries[]              one per team
//           .team                          { abbreviation, displayName, logos[], … }
//           .stats[]                       a list like [{ name: "wins", value: 13, displayValue: "13" }, …]
//
// Without level=3 you only get the two conferences, not the divisions.

/**
 * Fetches the standings for `season` and draws one table per division into the AFC and NFC tabs.
 * Called once per season by loadSeason(); changing weeks doesn't reload it.
 */
async function loadStandings(season) {
    document.getElementById("standingsSeason").textContent = season;
    standingsErrorEl.classList.add("d-none");
    for (const conf of ["AFC", "NFC"]) {
        document.getElementById(`conf-${conf}`).innerHTML = spinner("Loading standings…");
    }

    try {
        // level=3 returns conference → division → teams.
        const data = await getJSON(`${STANDINGS_URL}?season=${season}&level=3`);
        // If the user switched seasons while this was loading, don't draw stale standings.
        if (seasonSelect.value !== String(season)) return;
        for (const conference of data.children || []) {
            const pane = document.getElementById(`conf-${conference.abbreviation}`);
            if (pane) pane.innerHTML = (conference.children || []).map(renderDivision).join("");
        }
    } catch (error) {
        if (seasonSelect.value !== String(season)) return;
        for (const conf of ["AFC", "NFC"]) document.getElementById(`conf-${conf}`).innerHTML = "";
        standingsErrorEl.textContent = `Could not load standings for ${season}. ${error.message}`;
        standingsErrorEl.classList.remove("d-none");
    }
}

/**
 * Turns a team's `stats` array into an object keyed by stat name, so we can write
 * stats.wins.value instead of searching the array every time.
 *   [{ name: "wins", value: 13 }, { name: "losses", value: 4 }] → { wins: {…}, losses: {…} }
 */
function statsFor(entry) {
    const stats = {};
    for (const s of entry.stats) stats[s.name] = s;
    return stats;
}

/**
 * Returns an HTML table for one division, teams sorted best-to-worst.
 * ESPN's order isn't always the ranking order, so we sort ourselves: win percentage, then
 * wins, then point differential. This is a simplification: the NFL's real tiebreakers
 * (head-to-head, division record, …) are much more involved. `?? 0` treats a missing stat as 0.
 */
function renderDivision(division) {
    const rows = division.standings.entries
        .map(entry => ({ team: entry.team, stats: statsFor(entry) }))
        .sort((a, b) =>
            (b.stats.winPercent?.value ?? 0) - (a.stats.winPercent?.value ?? 0) ||
            (b.stats.wins?.value ?? 0) - (a.stats.wins?.value ?? 0) ||
            (b.stats.pointDifferential?.value ?? 0) - (a.stats.pointDifferential?.value ?? 0));

    return `
        <table class="table table-sm table-hover align-middle mb-0">
            <thead>
                <tr><th colspan="7" class="division-heading">${escapeHTML(division.name)}</th></tr>
                <tr class="small text-body-secondary">
                    <th>Team</th><th class="text-center">W</th><th class="text-center">L</th><th class="text-center">T</th>
                    <th class="text-center">PCT</th><th class="text-center">DIFF</th><th class="text-center">STRK</th>
                </tr>
            </thead>
            <tbody>${rows.map(renderStandingRow).join("")}</tbody>
        </table>`;
}

/**
 * Returns one <tr> in a division table.
 *   - Seed badge: the team's playoff seed (1–7). Seeds above 7 mean out of the playoffs, so no badge.
 *   - Clincher: ESPN's letter code shown after the team, e.g. "-z" (explained in the panel footer).
 *   - Logo: prefers the version ESPN tags "dark" (made for dark backgrounds).
 *   - DIFF is colored green when positive and red when negative.
 * We show ESPN's `displayValue` for numbers since it's already formatted (".765", "+157", "W3").
 */
function renderStandingRow({ team, stats }) {
    const value = name => escapeHTML(stats[name]?.displayValue ?? "-");
    const seed = stats.playoffSeed?.value;
    const clincher = stats.clincher?.displayValue;
    const logo = team.logos?.find(l => l.rel.includes("dark"))?.href || team.logos?.[0]?.href;
    const diff = stats.pointDifferential?.value ?? 0;
    const diffClass = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "";

    return `
        <tr>
            <td class="text-nowrap">
                ${seed >= 1 && seed <= 7 ? `<span class="badge text-bg-primary seed-badge me-1" title="Playoff seed">${seed}</span>` : ""}
                ${logo ? logoImg(logo, "team-logo-sm me-1") : ""}
                <span title="${escapeHTML(team.displayName)}">${escapeHTML(team.abbreviation)}</span>
                ${clincher ? `<small class="text-body-secondary fw-semibold">-${escapeHTML(clincher)}</small>` : ""}
            </td>
            <td class="text-center">${value("wins")}</td>
            <td class="text-center">${value("losses")}</td>
            <td class="text-center">${value("ties")}</td>
            <td class="text-center">${value("winPercent")}</td>
            <td class="text-center ${diffClass}">${value("pointDifferential")}</td>
            <td class="text-center">${value("streak")}</td>
        </tr>`;
}

// ---------- Events / startup ----------
// Connect the controls to the functions above. The AFC/NFC tabs need no code here:
// Bootstrap's JS handles them through the data-bs-toggle attributes in the HTML.

// New season → reload everything (standings, week list, games).
seasonSelect.addEventListener("change", () => loadSeason(Number(seasonSelect.value)));

// New week → reload just the games.
weekSelect.addEventListener("change", loadWeek);

// Primetime switch → redraw the games already loaded (no new request).
primetimeToggle.addEventListener("change", renderGames);

// "<" and ">" step through the dropdown. Setting .value from code doesn't fire the
// "change" event, so we call loadWeek() ourselves.
prevWeekBtn.addEventListener("click", () => {
    weekSelect.value = Number(weekSelect.value) - 1;
    loadWeek();
});

nextWeekBtn.addEventListener("click", () => {
    weekSelect.value = Number(weekSelect.value) + 1;
    loadWeek();
});

// Startup: the <script> tag is at the end of <body>, so all the elements above already exist.
populateSeasons();
loadSeason(getCurrentSeason());
