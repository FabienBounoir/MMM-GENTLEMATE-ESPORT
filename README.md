# MMM-GENTLEMATE-ESPORT

A [MagicMirror²](https://magicmirror.builders/) module for **Gentle Mates** esport matches: next match with countdown, live score, upcoming schedule and latest results, for Rocket League, Fortnite, Valorant and the other Gentle Mates rosters.

The layout adapts to where you put the module: a banner across the top, a column in a corner, or one big match in the middle of the mirror.

![Hero layout, live](screenshot/modern-live.png)

---

## Layouts

The default **modern** theme picks its layout from the module `position` (or force one with `layout`).

### Banner — `top_bar`, `bottom_bar`, `top_center`, `bottom_center`

The next match large on the left, the following ones beside it. They scroll slowly, right to left, only when they don't fit.

![Banner layout](screenshot/modern-banner.png)

### Column — `top_left`, `top_right`, `bottom_left`, `bottom_right`

<img src="screenshot/modern-column.png" width="380" align="right" alt="Column layout">

The next match with its countdown, then the upcoming matches grouped by day, then the latest results (W/L).

Opponents without a logo get their initials; tournaments without an opponent (FNCS…) show the event and the game pictogram; unknown opponents show "To be decided".

<br clear="right">

### Hero — `upper_third`, `middle_center`, `lower_third`, `fullscreen_*`

One match, big, with both logos, the countdown, and the two next matches underneath.

![Hero layout](screenshot/modern-hero.png)

When a match is live, the score takes the centre with a pulsing red **LIVE** marker (screenshot at the top).

### List — `layout: "list"`

A full-width agenda grouped by day: past results with W/L and score, then the upcoming matches with their countdown.

![List layout](screenshot/modern-list.png)

### Classic theme — `theme: "classic"`

The original design, kept unchanged: a scrolling banner (`displayMode: "banner"`) or a static list (`displayMode: "list"`).

![Classic banner](screenshot/classic-banner.png)

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/FabienBounoir/MMM-GENTLEMATE-ESPORT.git
```

No npm dependencies, only Node.js built-ins. The optional live QR code (`liveQr`) needs one: run `npm install` in the module folder to use it.

## Configuration

```js
{
  module: "MMM-GENTLEMATE-ESPORT",
  position: "top_bar",
  config: {
    email: "your@email.com",
    password: "yourPassword",
    logoTheme: "white",
    gameNameStyle: "full",
    excludeGames: ["TFT", "AOE"]
  }
}
```

The email and password are those of your Gentle Mates account (the data comes from the Gentle Mates Supabase backend). The session token is cached and only renewed when it expires.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `email` | `""` | Gentle Mates account e-mail |
| `password` | `""` | Gentle Mates account password |
| `theme` | `"modern"` | `"modern"` or `"classic"` (the original design) |
| `layout` | `"auto"` | Modern only: `"auto"` (from the position), `"banner"`, `"column"`, `"hero"` or `"list"` |
| `coloredPictos` | `true` | Modern only: game tags and pictograms in the game colour (`false` = white) |
| `scrollSpeed` | `25` | Modern banner only: scroll speed in px/s when the matches don't fit |
| `liveQr` | `false` | Modern only: while a match is live, a QR code of its stream (Twitch or YouTube) replaces the logo in the banner |
| `homeAssistantWebhook` | `""` | With `liveQr`: the QR code puts the stream on your TV through this Home Assistant webhook instead (see below) |
| `displayMode` | `"banner"` | Classic only: `"banner"` (scrolling) or `"list"` (static) |
| `logoTheme` | `"dark"` | `"dark"` or `"white"` team logos (`"white"` suits a mirror) |
| `gameNameStyle` | `"short"` | `"short"` (RL) or `"full"` (Rocket League) |
| `excludeGames` | `[]` | Games to hide, by `short_name` (see below) |
| `hideUnknownTeams` | `false` | Hide matches whose opponent is not known yet |
| `numberOfFutureMatches` | `10` | Max upcoming matches |
| `numberOfPastMatches` | `3` | Max past results |
| `pastDays` | `10` | How many days back to fetch results |
| `use24HourTime` | `true` | `false` for AM/PM |
| `updateInterval` | `5` | Refresh interval, in minutes |

### Filtering games

`excludeGames` takes the games' `short_name` (case-insensitive):

| Game | `short_name` |
|------|-------------|
| Rocket League | `RL` |
| Fortnite | `FT` |
| Valorant | `VCT` |
| Valorant Game Changers | `VCT GC` |
| Call of Duty | `CoD` |
| Warzone | `WZ` |
| Teamfight Tactics | `TFT` |
| Age of Empires | `AOE` |
| Fighting Games | `FGC` |

---

## Features

- Layout chosen from the position: banner, column, hero or list; classic theme kept as an option
- Game shown on every match, as a pill in the game's colour
- Countdown ("in 25 min"), Tonight / Tomorrow / weekday labels
- Live score with a pulsing red marker
- Latest results with win/loss
- Smooth, slow scrolling only when the matches don't fit, without jumps on refresh
- English, French and Spanish

## Test

```bash
node test.js
```

## License

MIT — FabienBounoir

### Live QR code

With `liveQr: true`, while a match is live the module shows a QR code of its stream (the Twitch or YouTube link from the Gentle Mates API): scan it to watch on your phone. In the banner it takes the place of the logo, with the logo in its middle.

#### Put the stream on the TV with Home Assistant

Add `homeAssistantWebhook` and the QR code puts the stream on your TV instead. It opens a small page served by the mirror (`http://<mirror IP>:8080/MMM-GENTLEMATE-ESPORT/tv`), which POSTs to the webhook with `?url=<stream link>`. Going through the mirror keeps the webhook id out of the QR code and avoids the "download file?" prompt phones show for Home Assistant's empty webhook answer. The mirror must be reachable from the phone (`address: "0.0.0.0"`, `ipWhitelist: []`).

```js
liveQr: true,
homeAssistantWebhook: "http://homeassistant.local:8123/api/webhook/<random id>"
```

Example automation for an Android TV (`androidtv_remote` integration opens the stream in the Twitch or YouTube app). Only Twitch and YouTube links are accepted, since anyone on the network can call the webhook:

```yaml
alias: Gentle Mates live on the TV
triggers:
  - trigger: webhook
    webhook_id: <random id>
    allowed_methods: [POST]
    local_only: true
variables:
  # Android TV opens https://twitch.tv links in the browser: use the app link instead.
  stream: >-
    {%- set u = trigger.query.get('url', '') %}
    {%- set tw = u | regex_findall('^https://(?:www\.)?twitch\.tv/([A-Za-z0-9_]+)/?$') -%}
    {%- if tw %}twitch://stream/{{ tw[0] | lower }}
    {%- elif u is match('^https://((www\.|m\.)?youtube\.com|youtu\.be)/[A-Za-z0-9_@./?=&%-]+$') %}{{ u }}
    {%- else %}twitch://stream/gentlemates{%- endif %}
actions:
  - if:
      - condition: state
        entity_id: remote.living_room_tv
        state: "off"
    then:
      - action: remote.turn_on
        target: { entity_id: remote.living_room_tv }
      - delay: { seconds: 8 }
  - action: remote.turn_on
    target: { entity_id: remote.living_room_tv }
    data: { activity: "{{ stream }}" }
mode: single
```
