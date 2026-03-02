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
  },

  requiresVersion: "2.1.0",
  matches: [],

  getTranslations: function () {
    return {
      en: "translations/en.json",
      fr: "translations/fr.json",
      es: "translations/es.json",
    };
  },

  getStyles: function () { return ["MMM-GENTLEMATE-ESPORT.css"]; },
  getTemplate: function () { return "templates/MMM-GENTLEMATE-ESPORT.njk"; },
  getTemplateData: function () { return { config: this.config, matches: this.matches }; },

  start: function () {
    this.getData();
    setInterval(() => this.getData(), this.config.updateInterval * 60 * 1000);
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