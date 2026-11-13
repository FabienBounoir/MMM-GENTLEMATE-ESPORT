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

for (const [pos, layout] of [["top_bar", "banner"], ["bottom_right", "column"], ["middle_center", "hero"], ["fullscreen_above", "hero"], ["top_center", "banner"]]) {
  mod.data.position = pos;
  assert.strictEqual(mod.pickLayout(), layout, pos);
}
mod.config.theme = "classic";
assert.strictEqual(mod.getTemplate(), "templates/MMM-GENTLEMATE-ESPORT.njk");

console.log("MMM-GENTLEMATE-ESPORT : OK");
