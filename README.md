# MMM-GENTLEMATE-ESPORT

A [MagicMirror²](https://magicmirror.builders/) module that displays **Gentlemate esport** matches as a scrolling banner or a static list.

Data is fetched from the Gentlemate Supabase backend and refreshed automatically.

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/FabienBounoir/MMM-GENTLEMATE-ESPORT.git
```

No external npm dependencies — only Node.js built-ins.

---

## Configuration

```js
{
  module: "MMM-GENTLEMATE-ESPORT",
  position: "bottom_bar",
  config: {
    email: "your@email.com",
    password: "yourPassword",
    anonKey: "your-supabase-anon-key",  // Supabase dashboard → Settings → API → anon public
  }
}
```

### All options

| Option | Default | Description |
|--------|---------|-------------|
| `email` | `""` | Supabase account e-mail |
| `password` | `""` | Supabase account password |
| `anonKey` | `""` | Supabase **anon/public** key |
| `updateInterval` | `5` | Refresh interval in minutes |
| `numberOfFutureMatches` | `10` | Max upcoming matches to display |
| `numberOfPastMatches` | `3` | Max past matches to display |
| `pastDays` | `30` | How many days back to fetch past matches |
| `use24HourTime` | `true` | `false` for AM/PM format |
| `logoTheme` | `"dark"` | `"dark"` or `"white"` logo variant |
| `displayMode` | `"banner"` | `"banner"` (horizontal scroll) or `"list"` (vertical static) |

---

## Features

- Two display modes: scrolling banner (`bottom_bar`) or static list (`top_right`, `bottom_right`)
- Game badge per match (logo + short name, coloured with the game's brand colour)
- Live match indicator (pulsing 🔴)
- Win/loss score colouring
- Featured match highlight
- JWT token caching — re-authenticates only on expiry
- Tri-lingual: English, French, Spanish

---

## License

MIT — Author: FabienBounoir
