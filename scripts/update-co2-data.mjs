import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

const NOAA_MONTHLY_URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv';
const NOAA_WEEKLY_URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_weekly_mlo.txt';

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'mauna-loa-co2-widget/1.0 (+https://gml.noaa.gov/ccgg/trends/)'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

function parseCsvLine(line) {
  const out = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === ',' && !quoted) {
      out.push(value.trim());
      value = '';
    } else {
      value += c;
    }
  }

  out.push(value.trim());
  return out;
}

function parseMonthlyCsv(text) {
  const rows = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const cols = parseCsvLine(line);
    if (!/^\d{4}$/.test(cols[0])) continue;

    const year = Number(cols[0]);
    const month = Number(cols[1]);
    const decimal = Number(cols[2]);
    const average = Number(cols[3]);
    const trend = Number(cols[4]);
    const days = Number(cols[5]);
    const stdev = Number(cols[6]);
    const uncertainty = Number(cols[7]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(average) || average < 300) continue;

    rows.push({
      year,
      month,
      decimal,
      average: round(average, 2),
      trend: Number.isFinite(trend) && trend > 0 ? round(trend, 2) : null,
      days: Number.isFinite(days) ? days : null,
      stdev: Number.isFinite(stdev) ? round(stdev, 2) : null,
      uncertainty: Number.isFinite(uncertainty) ? round(uncertainty, 2) : null
    });
  }

  return rows.sort((a, b) => a.decimal - b.decimal);
}

function parseWeeklyTxt(text) {
  const rows = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const cols = line.split(/\s+/);
    if (!/^\d{4}$/.test(cols[0]) || cols.length < 5) continue;

    const year = Number(cols[0]);
    const month = Number(cols[1]);
    const day = Number(cols[2]);
    const decimal = Number(cols[3]);
    const ppm = Number(cols[4]);
    const days = Number(cols[5]);
    const oneYearAgo = Number(cols[6]);
    const tenYearsAgo = Number(cols[7]);
    const since1800 = Number(cols[8]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(ppm) || ppm < 300) continue;

    rows.push({
      year,
      month,
      day,
      decimal,
      ppm: round(ppm, 2),
      days: Number.isFinite(days) ? days : null,
      oneYearAgo: Number.isFinite(oneYearAgo) && oneYearAgo > 300 ? round(oneYearAgo, 2) : null,
      tenYearsAgo: Number.isFinite(tenYearsAgo) && tenYearsAgo > 300 ? round(tenYearsAgo, 2) : null,
      since1800: Number.isFinite(since1800) ? round(since1800, 2) : null
    });
  }

  return rows.sort((a, b) => a.decimal - b.decimal);
}

function round(n, digits) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((key) => row[key] ?? '').join(','));
  }
  return `${lines.join('\n')}\n`;
}

function latestCompleteMonth(rows) {
  return rows[rows.length - 1] ?? null;
}

async function main() {
  const [monthlyText, weeklyText] = await Promise.all([
    fetchText(NOAA_MONTHLY_URL),
    fetchText(NOAA_WEEKLY_URL)
  ]);

  const monthly = parseMonthlyCsv(monthlyText);
  const weekly = parseWeeklyTxt(weeklyText);

  if (monthly.length < 700) {
    throw new Error(`Monthly parse produced too few rows: ${monthly.length}`);
  }
  if (weekly.length < 2000) {
    throw new Error(`Weekly parse produced too few rows: ${weekly.length}`);
  }

  const latestWeekly = weekly[weekly.length - 1];
  const latestMonthly = latestCompleteMonth(monthly);
  const generatedAt = new Date().toISOString();

  const metadata = {
    generatedAt,
    sources: {
      monthly: NOAA_MONTHLY_URL,
      weekly: NOAA_WEEKLY_URL
    },
    latestMonthly,
    latestWeekly,
    rowCounts: {
      monthly: monthly.length,
      weekly: weekly.length
    }
  };

  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'co2-monthly.json'), `${JSON.stringify({ generatedAt, source: NOAA_MONTHLY_URL, rows: monthly })}\n`);
  await writeFile(path.join(dataDir, 'co2-weekly-latest.json'), `${JSON.stringify({ generatedAt, source: NOAA_WEEKLY_URL, latest: latestWeekly, recent: weekly.slice(-60) })}\n`);
  await writeFile(path.join(dataDir, 'co2-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(path.join(dataDir, 'co2-monthly.csv'), toCsv(monthly, ['year', 'month', 'decimal', 'average', 'trend', 'days', 'stdev', 'uncertainty']));
  await writeFile(path.join(dataDir, 'co2-weekly-recent.csv'), toCsv(weekly.slice(-60), ['year', 'month', 'day', 'decimal', 'ppm', 'days', 'oneYearAgo', 'tenYearsAgo', 'since1800']));

  console.log(`Wrote ${monthly.length} monthly rows and latest weekly ${latestWeekly.ppm} ppm (${latestWeekly.year}-${String(latestWeekly.month).padStart(2, '0')}-${String(latestWeekly.day).padStart(2, '0')}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

