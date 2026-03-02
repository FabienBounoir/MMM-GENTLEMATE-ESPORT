/*
 * MagicMirror Module: MMM-GENTLEMATE-ESPORT
 * Author: FabienBounoir – License: MIT
 */

var NodeHelper = require("node_helper");
const https = require("https");

const SUPABASE_HOST = "gmrxbbhhyyrtmsftofdp.supabase.co";

module.exports = NodeHelper.create({
  accessToken: null,
  tokenExpiresAt: 0,

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
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        apikey: anonKey,
        Authorization: "Bearer " + anonKey,
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
      rejectUnauthorized: false,
      headers: {
        apikey: anonKey,
        Authorization: "Bearer " + token,
        "accept-profile": "public",
        Accept: "application/json",
      },
    };
    return this.httpsRequest(options, null);
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

      if (!Array.isArray(teamsRes.data)) throw new Error("Unexpected teams response");
      if (!Array.isArray(matchesRes.data)) throw new Error("Unexpected matches response");

      this.sendSocketNotification("GENTLEMATE_RECEIVE_DATA", {
        teams: teamsRes.data,
        matches: matchesRes.data,
        games: Array.isArray(gamesRes.data) ? gamesRes.data : [],
      });
    } catch (err) {
      console.error("[MMM-GENTLEMATE-ESPORT]", err.message);
      this.sendSocketNotification("GENTLEMATE_RECEIVE_DATA", null);
    }
  },
});
