// node test.js — checks the modern theme's view building without MagicMirror.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let def;
global.Module = { register: (name, d) => { def = d; } };
global.Log = { error: () => {} };
require("./MMM-GENTLEMATE-ESPORT.js");

const fr = JSON.parse(fs.readFileSync(path.join(__dirname, "translations/fr.json"), "utf8"));
const mod = Object.assign(Object.create(def), {
  config: Object.assign({}, def.defaults),
  data: { position: "top_left" },
  matches: [],
  translate: (k, vars) => (fr[k] || k).replace(/\{(\w+)\}/g, (_, v) => (vars || {})[v]),
  updateDom: () => {},
});

const at = (d, h, m) => new Date(2026, 10, d, h, m).toISOString();
const payload = {
  teams: [
    { id: 1, name: "Gentle Mates", white_logo_url: "gm.png" },
    { id: 2, name: "Geekay Esports", white_logo_url: "geekay.png" },
    { id: 3, name: "Dumornay Goat", white_logo_url: null },
    { id: 4, name: "Vitality", white_logo_url: "vita.png" },
    { id: 5, name: "?", white_logo_url: null },
  ],
  games: [{ id: 9, name: "Rocket League", short_name: "RL", colored_pictogram_url: "rl.svg" }],
  matches: [
    { id: "a", team_a_id: 1, team_b_id: 4, game_id: 9, live_datetime: at(9, 20, 13), result: "0-3", name: "Coupe de France - Group Stage" },
    { id: "b", team_a_id: 1, team_b_id: 3, game_id: 9, live_datetime: at(11, 21, 55), result: "3 - 0", name: "Coupe de France - Group Stage" },
    { id: "c", team_a_id: 1, team_b_id: 2, game_id: 9, live_datetime: at(12, 19, 30), result: null, name: "Coupe de France - Demi-Finale" },
    { id: "d", team_a_id: 1, team_b_id: 5, game_id: 9, live_datetime: at(12, 21, 30), result: null, name: "Coupe de France - Grande Finale" },
    { id: "e", team_a_id: 1, team_b_id: null, game_id: 9, live_datetime: at(14, 19, 0), result: null, name: "FNCS Reload - Heats Groupe 1" },
  ],
};

// ponytail: processData reads the wall clock, so the test pins it to the fixture's day.
const RealDate = Date, NOW = new RealDate(2026, 10, 12, 19, 5);
global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return +NOW; } };

mod.config.logoTheme = "white";
mod.processData(payload);
const v = mod.buildView(mod.matches, new Date(2026, 10, 12, 19, 5));

assert.strictEqual(v.layout, "column");
assert.strictEqual(v.next.title, "Geekay Esports");
assert.strictEqual(v.next.countdown, "dans 25 min");
assert.strictEqual(v.next.dayLabel, "Ce soir");
assert.strictEqual(v.next.sub, "Coupe de France · Demi-Finale");
assert.deepStrictEqual(v.rest.map((r) => [r.kind, r.title]), [["tbd", "À déterminer"], ["picto", "FNCS Reload"]]);
assert.strictEqual(v.rest[0].countdown, "dans 2 h 25");
assert.strictEqual(v.rest[1].sub, "Heats Groupe 1");
assert.deepStrictEqual(v.results.map((r) => [r.wl, r.score, r.kind, r.mono]), [["V", "3-0", "mono", "DG"], ["D", "0-3", "logo", "VI"]]);
assert.deepStrictEqual(v.listDays.map((d) => d.label), ["Lundi 09/11", "Mercredi 11/11", "Ce soir", "Samedi 14/11"]);

// Live QR: off by default, shown only while the next match is live.
assert.strictEqual(v.qr, null);
mod.qrs = { c: "data:qr" };
assert.strictEqual(mod.buildView(mod.matches, new Date(2026, 10, 12, 19, 5)).qr, null);
mod.matches[2].is_live = true;
assert.strictEqual(mod.buildView(mod.matches, new Date(2026, 10, 12, 19, 40)).qr, "data:qr");

for (const [pos, layout] of [["top_bar", "banner"], ["bottom_right", "column"], ["middle_center", "hero"], ["fullscreen_above", "hero"], ["top_center", "banner"]]) {
  mod.data.position = pos;
  assert.strictEqual(mod.pickLayout(), layout, pos);
}
mod.config.theme = "classic";
assert.strictEqual(mod.getTemplate(), "templates/MMM-GENTLEMATE-ESPORT.njk");

// node_helper builds the QR as an SVG data URI (needs npm install).
const Mod = require("module"), load = Mod._load;
Mod._load = (r, ...a) => (r === "node_helper" ? { create: (o) => o } : load(r, ...a));
const helper = require("./node_helper.js");
const live = [{ id: "c", is_live: true, twitch_live_link: "twitch.tv/nikof" }, { id: "d", is_live: false }];
const urls = [];
const qrFor = helper.qrFor;
helper.qrFor = (u) => { urls.push(u); return qrFor.call(helper, u); };
helper.name = "MMM-GENTLEMATE-ESPORT";
helper.mirrorUrl = () => "http://mirror:8080";
global.config = { language: "fr" };
const calls = [];
global.fetch = async (u, o) => { calls.push([u, o.method]); return { ok: true }; };
const res = { status(c) { this.code = c; return this; }, type() { return this; }, send(b) { this.body = b; } };
Promise.all([
  helper.liveQrs(false, "http://ha:8123/api/webhook/x", live),
  helper.liveQrs(true, "", live.concat({ id: "e", is_live: true })),
  helper.liveQrs(true, "http://ha:8123/api/webhook/x", live),
]).then(async ([off, direct, ha]) => {
  assert.deepStrictEqual(off, {});
  // Without Home Assistant: the stream itself, and no QR for a live match without a link.
  assert.deepStrictEqual(Object.keys(direct), ["c"]);
  assert.deepStrictEqual(Object.keys(ha), ["c"]);
  assert.deepStrictEqual(urls, ["https://twitch.tv/nikof", "http://mirror:8080/MMM-GENTLEMATE-ESPORT/tv?url=twitch.tv/nikof"]);
  assert.ok(ha.c.startsWith("data:image/svg+xml;base64,"));
  // The phone's page calls the webhook with the full stream link and answers HTML.
  await helper.sendToTv({ query: { url: "twitch.tv/nikof" } }, res);
  assert.deepStrictEqual(calls, [["http://ha:8123/api/webhook/x?url=https%3A%2F%2Ftwitch.tv%2Fnikof", "POST"]]);
  assert.strictEqual(res.code, 200);
  assert.ok(res.body.includes("Lancé sur la TV"));
  console.log("MMM-GENTLEMATE-ESPORT : OK");
});
