# Mauna Loa CO2 widget

A static, self-updating Keeling Curve-style widget for Mauna Loa CO2.

## What this includes

- `index.html` - local demo page.
- `co2-widget.html` - the Ghost-friendly embed snippet.
- `scripts/update-co2-data.mjs` - fetches NOAA data and writes hosted JSON/CSV files.
- `data/` - generated data files used by the widget.
- `.github/workflows/update-co2-data.yml` - optional scheduled GitHub Action.

## Data model

The widget uses monthly NOAA Mauna Loa data for the long historical curve and weekly NOAA Mauna Loa data for the freshest headline reading. That keeps the chart close to NOAA's classic Keeling Curve while still showing a current point of reference.

## Update locally

```bash
node scripts/update-co2-data.mjs
```

## Host with GitHub Pages

1. Put this folder in a GitHub repository.
2. Enable GitHub Pages for the repository.
3. Keep `.github/workflows/update-co2-data.yml` enabled.
4. In `co2-widget.html`, replace:

```js
var DATA_BASE = './data/';
```

with your published data URL, for example:

```js
var DATA_BASE = 'https://YOURNAME.github.io/YOURREPO/data/';
```

Then paste the contents of `co2-widget.html` into a Ghost HTML card.

## Sources

- NOAA/GML Mauna Loa CO2 monthly mean data: https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
- NOAA/GML Mauna Loa CO2 weekly mean data: https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_weekly_mlo.txt

