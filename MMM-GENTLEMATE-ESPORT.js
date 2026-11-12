/*
 * MagicMirror Module: MMM-GENTLEMATE-ESPORT
 * Author: FabienBounoir – License: MIT
 */
Module.register("MMM-GENTLEMATE-ESPORT", {
  defaults: {
    updateInterval: 5,           // minutes
    email: "",
    password: "",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcnhiYmhoeXlydG1zZnRvZmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc0MDAxNTEsImV4cCI6MjAyMjk3NjE1MX0.JYVVlCII2iL97cevWvQi0Hlz0Gt_nZjonb9ApnNDscc",                 // Supabase anon/public key
    numberOfFutureMatches: 10,
    numberOfPastMatches: 3,
    pastDays: 10,                // how many days back to fetch
    use24HourTime: true,
    logoTheme: "dark",           // "dark" | "white"
    displayMode: "banner",       // "banner" | "list"
    excludeGames: [],            // short_names to hide, e.g. ["TFT", "AOE"]
    hideUnknownTeams: false,     // hide matches where one or both teams are unknown
    gameNameStyle: "short",      // "short" | "full"
    theme: "modern",             // "modern" | "classic" (the original banner/list design)
    layout: "auto",              // modern only: "auto" | "banner" | "column" | "hero" | "list"
    coloredPictos: true,         // modern only: game pictograms and tags in the game colour (false = white)
    scrollSpeed: 25,             // modern banner: scroll speed in px/s when the matches don't fit
  },

  bannerScrolls: false,

  requiresVersion: "2.1.0",
  matches: [],

  getTranslations: function () {
    return {
      en: "translations/en.json",
      fr: "translations/fr.json",
      es: "translations/es.json",
    };
  },

  getStyles: function () { return ["MMM-GENTLEMATE-ESPORT.css", "MMM-GENTLEMATE-ESPORT-modern.css"]; },
  isModern: function () { return this.config.theme !== "classic"; },
  getTemplate: function () {
    return this.isModern() ? "templates/modern.njk" : "templates/MMM-GENTLEMATE-ESPORT.njk";
  },
  getTemplateData: function () {
    if (!this.isModern()) return { config: this.config, matches: this.matches };
    return { config: this.config, view: this.buildView(this.matches, new Date()) };
  },

  start: function () {
    this.getData();
    setInterval(() => this.getData(), this.config.updateInterval * 60 * 1000);
    // Modern theme shows "in 25 min" countdowns: re-render every minute.
    if (this.isModern()) setInterval(() => { if (this.matches.length) this.updateDom(0); }, 60 * 1000);
  },

  // ─── Modern theme ──────────────────────────────────────────────────────────

  // After each render: make the banner scroll only if its matches don't fit.
  notificationReceived: function (notification, payload, sender) {
    if (notification !== "MODULE_DOM_UPDATED" || !this.isModern()) return;
    const root = document.getElementById(this.identifier);
    const rest = root && root.querySelector(".gmm-banner-rest");
    const track = rest && rest.querySelector(".gmm-track");
    if (!track) return;
    // While scrolling the track holds the matches twice.
    const scrolls = track.scrollWidth / (this.bannerScrolls ? 2 : 1) > rest.clientWidth + 1;
    if (scrolls !== this.bannerScrolls) {
      this.bannerScrolls = scrolls;
      this.updateDom(0);
    }
  },

  pickLayout: function () {
    if (this.config.layout !== "auto") return this.config.layout;
    const pos = (this.data && this.data.position) || "";
    if (/_(left|right)$/.test(pos)) return "column";
    if (/^(upper_third|middle_center|lower_third|fullscreen)/.test(pos)) return "hero";
    return "banner";
  },

  pad: function (n) { return String(n).padStart(2, "0"); },

  // One match as the modern templates need it, relative to `now`.
  viewMatch: function (m, now) {
    const dt = m.live_datetime ? new Date(m.live_datetime) : null;
    const event = (m.name || "").split(/\s+-\s+/);
    const v = {
      live: !!m.is_live,
      time: dt ? m.displayHour + ":" + m.displayMinute + (m.displayPeriod ? " " + m.displayPeriod : "") : "--:--",
      sub: event.length > 1 ? event.join(" · ") : (m.name || (m.game ? m.game.name : "")),
      picto: m.game ? m.game.logo : null,
      gameName: m.game ? m.game.displayName : "",
      gameColor: m.game && this.config.coloredPictos ? m.game.color : null,
      dayKey: dt ? dt.toDateString() : "tbd",
      dayLabel: "–",
    };

    if (dt) {
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
      if (dt.toDateString() === now.toDateString()) v.dayLabel = this.translate(dt.getHours() >= 18 ? "TONIGHT" : "TODAY");
      else if (dt.toDateString() === tomorrow.toDateString()) v.dayLabel = this.translate("TOMORROW");
      else v.dayLabel = m.displayDay + " " + this.pad(dt.getDate()) + "/" + this.pad(dt.getMonth() + 1);

      const mins = Math.round((dt - now) / 60000);
      if (mins > 0 && mins < 24 * 60) {
        const h = Math.floor(mins / 60), mn = mins % 60;
        v.countdown = this.translate("IN", { time: h ? h + " h" + (mn ? " " + this.pad(mn) : "") : mn + " min" });
      }
    }

    // Opponent: a team, a team not known yet, or nobody (a tournament).
    if (!m.team_b_id) {
      v.kind = "picto";
      v.title = event[0] || (m.game ? m.game.name : "");
      v.sub = event.length > 1 ? event.slice(1).join(" · ") : (m.game ? m.game.name : "");
    } else if (m.teamB.unknown || m.teamB.name.trim() === "?") {
      v.kind = "tbd";
      v.title = this.translate("TBD");
    } else {
      v.kind = m.teamB.logo ? "logo" : "mono";
      v.title = m.teamB.name;
      v.logo = m.teamB.logo;
      const words = m.teamB.name.trim().split(/\s+/);
      v.mono = (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
    }
    v.us = m.teamA;

    if (m.scoreA !== null && m.scoreA !== undefined) {
      const a = Number(m.scoreA), b = Number(m.scoreB);
      v.score = a + "-" + b;
      v.win = a > b;
      v.wl = a === b ? "" : this.translate(a > b ? "WIN_SHORT" : "LOSS_SHORT");
    } else if (m.resultText) {
      v.score = m.resultText;
    }
    return v;
  },

  groupByDay: function (list) {
    const days = [];
    list.forEach((v) => {
      const last = days[days.length - 1];
      if (last && last.key === v.dayKey) last.matches.push(v);
      else days.push({ key: v.dayKey, label: v.dayLabel, matches: [v] });
    });
    return days;
  },

  buildView: function (matches, now) {
    const all = matches.map((m) => Object.assign(this.viewMatch(m, now), { _m: m }));
    // Upcoming: live, not played yet, or started less than 3 h ago without a result.
    const upcoming = all.filter((v) => {
      const m = v._m;
      if (m.is_live || !m.live_datetime) return true;
      return !m.result && new Date(m.live_datetime) > now - 3 * 3600 * 1000;
    });
    const results = all.filter((v) => upcoming.indexOf(v) === -1 && v.score).reverse();
    const next = upcoming[0] || null;
    const rest = upcoming.slice(1);
    // Scroll duration from a constant speed (item = 230px + 32px gap); the delay is
    // derived from the clock so re-rendering every minute doesn't restart the scroll.
    const scrollSeconds = Math.max(1, Math.round((rest.length * 262) / this.config.scrollSpeed));
    return {
      layout: this.pickLayout(),
      pictoFilter: this.config.coloredPictos ? "" : " gmm-white",
      scrolling: this.bannerScrolls,
      scrollSeconds,
      scrollDelay: -((now.getTime() / 1000) % scrollSeconds).toFixed(1),
      next,
      rest,
      restDays: this.groupByDay(rest),
      results,
      listDays: this.groupByDay(results.slice().reverse().concat(upcoming).map((v) => Object.assign(v, { past: upcoming.indexOf(v) === -1 }))),
    };
  },

  getData: function () {
    this.sendSocketNotification("GENTLEMATE_REQUEST_DATA", {
      email: this.config.email,
      password: this.config.password,
      anonKey: this.config.anonKey,
      pastDays: this.config.pastDays,
    });
  },

  enrichMatch: function (match, teamsMap, gamesMap) {
    const logoKey = this.config.logoTheme === "white" ? "white_logo_url" : "dark_logo_url";

    const teamA = teamsMap[match.team_a_id] || { name: "???", dark_logo_url: null, white_logo_url: null };
    const teamB = teamsMap[match.team_b_id] || { name: "???", dark_logo_url: null, white_logo_url: null };

    match.teamA = { name: teamA.name, logo: teamA[logoKey] || null, unknown: !teamsMap[match.team_a_id] };
    match.teamB = { name: teamB.name, logo: teamB[logoKey] || null, unknown: !teamsMap[match.team_b_id] };

    if (match.team_a_bis_id && teamsMap[match.team_a_bis_id]) {
      const t = teamsMap[match.team_a_bis_id];
      match.teamAbis = { name: t.name, logo: t[logoKey] || null };
    } else {
      match.teamAbis = null;
    }

    if (match.result) {
      const parts = match.result.split("-").map((s) => s.trim());
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        match.scoreA = parts[0];
        match.scoreB = parts[1];
        match.resultText = null;
      } else {
        match.scoreA = null;
        match.scoreB = null;
        match.resultText = match.result;
      }
    } else {
      match.scoreA = null;
      match.scoreB = null;
      match.resultText = null;
    }

    if (match.live_datetime) {
      const dt = new Date(match.live_datetime);
      const dayKeys = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");

      if (dt.toDateString() === today.toDateString()) {
        match.displayDay = this.translate("TODAY");
        match.displayDate = "";
      } else if (dt.toDateString() === tomorrow.toDateString()) {
        match.displayDay = this.translate("TOMORROW");
        match.displayDate = "";
      } else {
        match.displayDay = this.translate(dayKeys[dt.getDay()]);
        match.displayDate = dd + "/" + mm;
      }

      let hours = dt.getHours();
      const minutes = dt.getMinutes();

      if (!this.config.use24HourTime) {
        match.displayPeriod = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
      } else {
        match.displayPeriod = "";
      }

      match.displayHour = String(hours).padStart(2, "0");
      match.displayMinute = String(minutes).padStart(2, "0");
    } else {
      match.displayDay = "–";
      match.displayHour = "--";
      match.displayMinute = "--";
      match.displayPeriod = "";
    }

    const game = (gamesMap && match.game_id) ? gamesMap[match.game_id] : null;
    if (game) {
      const shortName = game.short_name || game.name;
      const fullName  = game.name || shortName;
      match.game = {
        name: fullName,
        shortName,
        displayName: this.config.gameNameStyle === "full" ? fullName : shortName,
        logo: game.colored_pictogram_url || game.dark_logo_url || null,
        color: game.primary_color || null,
      };
    } else {
      match.game = null;
    }

    return match;
  },

  processData: function (payload) {
    if (!payload || !payload.matches || !payload.teams) {
      Log.error(this.name + ": invalid payload received.");
      return;
    }

    const teamsMap = {};
    payload.teams.forEach((t) => { teamsMap[t.id] = t; });

    const gamesMap = {};
    (payload.games || []).forEach((g) => { gamesMap[g.id] = g; });

    const exclude = (this.config.excludeGames || []).map((s) => s.toLowerCase());
    const matches = exclude.length
      ? payload.matches.filter((m) => {
          const g = gamesMap[m.game_id];
          return !g || !exclude.includes((g.short_name || "").toLowerCase());
        })
      : payload.matches;

    const now = new Date();
    const past = [];
    const future = [];

    matches.forEach((m) => {
      if (!m.live_datetime) { future.push(m); return; }
      const dt = new Date(m.live_datetime);
      if (m.is_live) future.unshift(m);
      else if (dt < now) past.push(m);
      else future.push(m);
    });

    past.sort((a, b) => new Date(b.live_datetime) - new Date(a.live_datetime));
    const selectedPast = past.slice(0, this.config.numberOfPastMatches);

    future.sort((a, b) => {
      if (!a.live_datetime) return 1;
      if (!b.live_datetime) return -1;
      return new Date(a.live_datetime) - new Date(b.live_datetime);
    });
    const selectedFuture = future.slice(0, this.config.numberOfFutureMatches);

    const all = [...selectedPast.reverse(), ...selectedFuture];
    const enriched = all.map((m) => this.enrichMatch(m, teamsMap, gamesMap));
    this.matches = this.config.hideUnknownTeams
      ? enriched.filter((m) => !m.teamA.unknown && !m.teamB.unknown)
      : enriched;
    this.updateDom(500);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GENTLEMATE_RECEIVE_DATA") {
      this.processData(payload);
    }
  },

  stop: function () {},
});