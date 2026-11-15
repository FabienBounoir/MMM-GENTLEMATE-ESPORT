/*
 * MagicMirror Module: MMM-GENTLEMATE-ESPORT
 * Author: FabienBounoir – License: MIT
 */

var NodeHelper = require("node_helper");
const https = require("https");
const os = require("os");

const SUPABASE_HOST = "gmrxbbhhyyrtmsftofdp.supabase.co";

module.exports = NodeHelper.create({
  accessToken: null,
  tokenExpiresAt: 0,

  // The QR code opens this page on the phone, and the mirror calls the webhook:
  // Home Assistant answers webhooks with an empty body that phones offer to download.
  start: function () {
    this.expressApp.get("/" + this.name + "/tv", (req, res) => this.sendToTv(req, res));
  },

  sendToTv: async function (req, res) {
    const lang = (global.config && global.config.language) || "en";
    let t;
    try { t = require("./translations/" + lang + ".json"); } catch (e) { t = require("./translations/en.json"); }
    let ok = false;
    if (this.webhook) {
      const stream = this.fullLink(req.query.url ? String(req.query.url) : "");
      try {
        ok = (await fetch(this.withStream(this.webhook, stream), { method: "POST" })).ok;
      } catch (e) {
        console.error("[MMM-GENTLEMATE-ESPORT] Webhook call failed:", e.message);
      }
    }
    res.status(ok ? 200 : 502).type("html").send(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#fff;font:600 22px system-ui;text-align:center">' +
      "<p>" + (ok ? "📺<br>" + t.TV_SENT : "⚠️<br>" + t.TV_FAILED) + "</p>"
    );
  },

  withStream: function (base, stream) {
    return stream ? base + (base.includes("?") ? "&" : "?") + "url=" + encodeURIComponent(stream) : base;
  },

  // The API stores links without scheme ("twitch.tv/nikof").
  fullLink: function (link) {
    return link && !/^https?:\/\//.test(link) ? "https://" + link : link;
  },

  // ponytail: first LAN IPv4 that isn't a docker bridge; add an option if the mirror is reached through another address.
  mirrorUrl: function () {
    const ip = Object.entries(os.networkInterfaces())
      .filter(([name]) => !/^(docker|br-|veth)/.test(name))
      .flatMap(([, addrs]) => addrs)
      .find((a) => a.family === "IPv4" && !a.internal);
    const c = global.config || {};
    return (c.useHttps ? "https" : "http") + "://" + (ip ? ip.address : "localhost") + ":" + (c.port || 8080);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GENTLEMATE_REQUEST_DATA") {
      this.fetchAll(payload);
    }
  },

  httpsRequest: function (options, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            const text = Buffer.concat(chunks).toString();
            resolve({ status: res.statusCode, data: JSON.parse(text) });
          } catch (e) {
            reject(new Error("JSON parse error: " + e.message));
          }
        });
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  },

  authenticate: async function (email, password, anonKey) {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const bodyStr = JSON.stringify({ email, password, gotrue_meta_security: {} });
    const options = {
      hostname: SUPABASE_HOST,
      port: 443,
      path: "/auth/v1/token?grant_type=password",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        apikey: anonKey
      },
    };

    const response = await this.httpsRequest(options, bodyStr);
    if (response.status !== 200 || !response.data.access_token) {
      throw new Error("Authentication failed (HTTP " + response.status + ")");
    }

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = now + response.data.expires_in * 1000;
    return this.accessToken;
  },

  supabaseGet: function (path, token, anonKey) {
    const options = {
      hostname: SUPABASE_HOST,
      port: 443,
      path,
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: "Bearer " + token,
        "accept-profile": "public",
        Accept: "application/json",
      },
    };
    return this.httpsRequest(options, null);
  },

  // QR codes (SVG data URIs) for the live matches: the stream link itself, or with a
  // Home Assistant webhook this module's /tv page on the mirror (?url=twitch.tv/...).
  // qrcode is only required when liveQr is on, so the module runs without npm install.
  qrCache: {},

  qrFor: async function (url) {
    if (!url) return null;
    if (!this.qrCache[url]) {
      try {
        // Q recovers 25% of the code: the 26px logo drawn in the middle stays well under (checked with jsQR on 8 links x 5 scales).
        const svg = await require("qrcode").toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "Q" });
        this.qrCache[url] = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"); // ponytail: never pruned, a handful of stream links
      } catch (e) {
        console.error("[MMM-GENTLEMATE-ESPORT] QR code unavailable (run npm install in the module folder):", e.message);
        return null;
      }
    }
    return this.qrCache[url];
  },

  liveQrs: async function (liveQr, webhook, matches) {
    this.webhook = webhook;
    const qrs = {};
    if (!liveQr) return qrs;
    const page = this.mirrorUrl() + "/" + this.name + "/tv";
    for (const m of matches.filter((m) => m.is_live)) {
      const link = m.twitch_live_link || "";
      // ponytail: "/" and ":" left unescaped, a shorter URL keeps the 84px QR code readable.
      const target = webhook ? (link ? page + "?url=" + encodeURIComponent(link).replace(/%2F/g, "/").replace(/%3A/g, ":") : page) : this.fullLink(link);
      if (target) qrs[m.id] = await this.qrFor(target);
    }
    return qrs;
  },

  fetchAll: async function (payload) {
    try {
      const { email, password, anonKey, pastDays } = payload;
      const token = await this.authenticate(email, password, anonKey);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (pastDays || 30));
      const matchPath =
        "/rest/v1/matches?select=*&or=(live_datetime.gt." +
        encodeURIComponent(cutoff.toISOString()) +
        ",live_datetime.is.null)&order=live_datetime.asc.nullslast";

      const [teamsRes, matchesRes, gamesRes] = await Promise.all([
        this.supabaseGet("/rest/v1/teams?select=*", token, anonKey),
        this.supabaseGet(matchPath, token, anonKey),
        this.supabaseGet("/rest/v1/games?select=*", token, anonKey),
      ]);
      console.log("[MMM-GENTLEMATE-ESPORT] Data fetched: " + teamsRes.data.length + " teams, " + matchesRes.data.length + " matches, " + (Array.isArray(gamesRes.data) ? gamesRes.data.length : 0) + " games");


      if (!Array.isArray(teamsRes.data)) throw new Error("Unexpected teams response");
      if (!Array.isArray(matchesRes.data)) throw new Error("Unexpected matches response");

      
      this.sendSocketNotification("GENTLEMATE_RECEIVE_DATA", {
        teams: teamsRes.data,
        matches: matchesRes.data,
        games: Array.isArray(gamesRes.data) ? gamesRes.data : [],
        qrs: await this.liveQrs(payload.liveQr, payload.homeAssistantWebhook, matchesRes.data),
      });
    } catch (err) {
      console.error("[MMM-GENTLEMATE-ESPORT]", err.message);
      this.sendSocketNotification("GENTLEMATE_RECEIVE_DATA", null);
    }
  },
});
