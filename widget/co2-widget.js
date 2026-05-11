(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var NS = 'http://www.w3.org/2000/svg';

  function dataBase() {
    return window.CO2_WIDGET_DATA_BASE || './data/';
  }

  function fetchJson(name) {
    return fetch(dataBase() + name, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Unable to load ' + name + ' (' + r.status + ')');
      return r.json();
    });
  }

  function fmtDate(row) {
    if (!row) return '';
    return MONTHS[row.month - 1] + ' ' + (row.day ? row.day + ', ' : '') + row.year;
  }

  function fmtMonth(row) {
    if (!row) return '';
    return MONTHS[row.month - 1] + ' ' + row.year;
  }

  function ppm(v) {
    return Number(v).toFixed(2);
  }

  function delta(v) {
    if (!Number.isFinite(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + ' ppm';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function pathFor(rows, x, y, field) {
    return rows.map(function (row, i) {
      var v = row[field];
      if (v === null || v === undefined || !Number.isFinite(v)) return '';
      return (i === 0 ? 'M' : 'L') + x(row.decimal).toFixed(2) + ' ' + y(v).toFixed(2);
    }).filter(Boolean).join(' ');
  }

  function nearestRow(rows, decimal) {
    var best = rows[0];
    var bestDiff = Infinity;
    rows.forEach(function (row) {
      var d = Math.abs(row.decimal - decimal);
      if (d < bestDiff) {
        best = row;
        bestDiff = d;
      }
    });
    return best;
  }

  function drawChart(root, monthlyRows, weeklyLatest) {
    var wrap = root.querySelector('.co2-chart-wrap');
    var tip = root.querySelector('.co2-tip');
    wrap.innerHTML = '';

    var width = 860;
    var height = 420;
    var pad = { top: 22, right: 34, bottom: 52, left: 62 };
    var values = [];

    monthlyRows.forEach(function (row) {
      values.push(row.average);
      if (row.trend) values.push(row.trend);
    });
    if (weeklyLatest && weeklyLatest.ppm) values.push(weeklyLatest.ppm);

    var xMin = Math.floor(monthlyRows[0].decimal);
    var xMax = Math.ceil(Math.max(monthlyRows[monthlyRows.length - 1].decimal, weeklyLatest ? weeklyLatest.decimal : 0));
    var yMin = Math.floor((Math.min.apply(null, values) - 4) / 10) * 10;
    var yMax = Math.ceil((Math.max.apply(null, values) + 4) / 10) * 10;
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;
    var x = function (v) { return pad.left + ((v - xMin) / (xMax - xMin)) * plotW; };
    var y = function (v) { return pad.top + (1 - ((v - yMin) / (yMax - yMin))) * plotH; };

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': 'Atmospheric CO2 at Mauna Loa Observatory'
    });

    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: width, height: height, fill: '#fff' }));

    for (var yt = Math.ceil(yMin / 20) * 20; yt <= yMax; yt += 20) {
      var gy = y(yt);
      svg.appendChild(svgEl('line', { x1: pad.left, y1: gy, x2: width - pad.right, y2: gy, stroke: '#e8e8e8', 'stroke-width': 1 }));
      var label = svgEl('text', { x: pad.left - 10, y: gy + 4, 'text-anchor': 'end', 'font-size': 13, fill: '#555' });
      label.textContent = yt;
      svg.appendChild(label);
    }

    for (var xt = 1960; xt <= xMax; xt += 10) {
      var gx = x(xt);
      svg.appendChild(svgEl('line', { x1: gx, y1: pad.top, x2: gx, y2: height - pad.bottom, stroke: '#efefef', 'stroke-width': 1 }));
      var xLabel = svgEl('text', { x: gx, y: height - 20, 'text-anchor': 'middle', 'font-size': 13, fill: '#555' });
      xLabel.textContent = xt;
      svg.appendChild(xLabel);
    }

    svg.appendChild(svgEl('line', { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, stroke: '#cfcfcf', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: pad.left, y1: pad.top, x2: pad.left, y2: height - pad.bottom, stroke: '#cfcfcf', 'stroke-width': 1 }));

    var yTitle = svgEl('text', { x: 18, y: height / 2, transform: 'rotate(-90 18 ' + height / 2 + ')', 'text-anchor': 'middle', 'font-size': 15, fill: '#111', 'font-weight': 700 });
    yTitle.textContent = 'CO2 mole fraction (ppm)';
    svg.appendChild(yTitle);

    var xTitle = svgEl('text', { x: width / 2, y: height - 4, 'text-anchor': 'middle', 'font-size': 15, fill: '#111', 'font-weight': 700 });
    xTitle.textContent = 'Year';
    svg.appendChild(xTitle);

    svg.appendChild(svgEl('path', {
      d: pathFor(monthlyRows, x, y, 'average'),
      fill: 'none',
      stroke: '#e51b1b',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

    svg.appendChild(svgEl('path', {
      d: pathFor(monthlyRows, x, y, 'trend'),
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

    if (weeklyLatest) {
      svg.appendChild(svgEl('circle', {
        cx: x(weeklyLatest.decimal),
        cy: y(weeklyLatest.ppm),
        r: 5.4,
        fill: '#1a1a6e',
        stroke: '#fff',
        'stroke-width': 2
      }));
    }

    var hit = svgEl('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: 'transparent' });
    svg.appendChild(hit);
    wrap.appendChild(svg);

    hit.addEventListener('mousemove', function (event) {
      var rect = svg.getBoundingClientRect();
      var px = ((event.clientX - rect.left) / rect.width) * width;
      var decimal = xMin + ((px - pad.left) / plotW) * (xMax - xMin);
      var row = nearestRow(monthlyRows, decimal);
      tip.innerHTML = '<strong>' + fmtMonth(row) + '</strong>' +
        'Monthly mean: ' + ppm(row.average) + ' ppm<br>' +
        'Seasonally adjusted: ' + (row.trend ? ppm(row.trend) + ' ppm' : '—');
      tip.style.display = 'block';
      tip.style.left = Math.min(event.clientX + 14, window.innerWidth - 230) + 'px';
      tip.style.top = Math.max(8, event.clientY - 48) + 'px';
    });
    hit.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
    });
  }

  function render(container, monthlyData, latestData) {
    var monthlyRows = monthlyData.rows || [];
    var latestWeekly = latestData.latest || null;
    var latestMonthly = monthlyRows[monthlyRows.length - 1];
    var yearAgo = latestWeekly && latestWeekly.oneYearAgo ? latestWeekly.ppm - latestWeekly.oneYearAgo : NaN;
    var tenYearAgo = latestWeekly && latestWeekly.tenYearsAgo ? latestWeekly.ppm - latestWeekly.tenYearsAgo : NaN;
    var monthlyYearAgo = monthlyRows.length > 12 ? latestMonthly.average - monthlyRows[monthlyRows.length - 13].average : NaN;
    var record = monthlyRows.reduce(function (best, row) { return row.average > best.average ? row : best; }, monthlyRows[0]);

    container.innerHTML =
      '<div class="co2-widget">' +
        '<div class="co2-card">' +
          '<div class="co2-head">' +
            '<div class="co2-head-main">' +
              '<div class="co2-eyebrow">Mauna Loa Observatory · Hawaii</div>' +
              '<div class="co2-title">Atmospheric CO₂</div>' +
              '<div class="co2-subtitle">Monthly Keeling Curve with latest weekly NOAA/GML reading.</div>' +
            '</div>' +
            '<div class="co2-hero-stat">' +
              '<div class="co2-hero-val">' + ppm(latestWeekly.ppm) + '</div>' +
              '<div class="co2-hero-unit">ppm · week of ' + fmtDate(latestWeekly) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="co2-band">' +
            statCell('1 year change', delta(yearAgo), latestWeekly.oneYearAgo ? 'vs same NOAA weekly comparison' : 'weekly comparison unavailable', yearAgo >= 0 ? 'warm' : 'cool') +
            statCell('10 year change', delta(tenYearAgo), latestWeekly.tenYearsAgo ? 'vs same NOAA weekly comparison' : 'weekly comparison unavailable', 'teal') +
            statCell('Latest monthly', ppm(latestMonthly.average) + ' ppm', fmtMonth(latestMonthly), '') +
            statCell('Monthly record', ppm(record.average) + ' ppm', fmtMonth(record), 'warm') +
          '</div>' +
          '<div class="co2-section">' +
            '<div class="co2-section-head">' +
              '<div class="co2-section-label">Atmospheric CO₂ at Mauna Loa Observatory</div>' +
              '<div class="co2-legend"><span><i class="red"></i>Monthly mean</span><span><i class="black"></i>Seasonally adjusted</span><span><i class="blue"></i>Latest weekly</span></div>' +
            '</div>' +
            '<div class="co2-chart-wrap"></div>' +
          '</div>' +
        '</div>' +
        '<div class="co2-foot">' +
          '<span>Updated data file: ' + new Date(monthlyData.generatedAt || latestData.generatedAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + '</span>' +
          '<span>Data from <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA Global Monitoring Laboratory</a></span>' +
        '</div>' +
        '<div class="co2-tip"></div>' +
      '</div>';

    drawChart(container, monthlyRows, latestWeekly);
  }

  function statCell(label, value, sub, cls) {
    return '<div class="co2-cell"><div class="co2-cell-label">' + label + '</div><div class="co2-cell-val ' + (cls || '') + '">' + value + '</div><div class="co2-cell-sub">' + sub + '</div></div>';
  }

  function renderError(container, error) {
    container.innerHTML = '<div class="co2-widget"><div class="co2-card"><div class="co2-err">Unable to load CO₂ data.<br><small>' + error.message + '</small></div></div></div>';
  }

  function injectStyle() {
    if (document.getElementById('co2-widget-style')) return;
    var style = document.createElement('style');
    style.id = 'co2-widget-style';
    style.textContent = [
      '.co2-widget *, .co2-widget *::before, .co2-widget *::after{box-sizing:border-box;margin:0;padding:0}',
      '.co2-widget{width:100%;font-family:inherit;color:#111}',
      '.co2-card{border:1px solid #d0d0d0;border-radius:10px;overflow:hidden;background:#fff}',
      '.co2-head{min-height:155px;padding:20px 24px;display:grid;grid-template-columns:minmax(0,1fr)240px;gap:18px;background:#f5f5f5;border-bottom:1px solid #d0d0d0}',
      '.co2-head-main{display:flex;flex-direction:column;justify-content:flex-start}',
      '.co2-eyebrow{font-size:.6em;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#111;opacity:.46;margin-bottom:7px}',
      '.co2-title{font-size:1.55em;line-height:1.05;font-weight:900;color:#1a1a6e;letter-spacing:0}',
      '.co2-subtitle{font-size:.68em;color:#555;opacity:.82;margin-top:6px;line-height:1.35}',
      '.co2-hero-stat{align-self:start;text-align:right;padding-top:4px}',
      '.co2-hero-val{font-size:2.55em;line-height:.95;font-weight:900;color:#1a1a6e;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.co2-hero-unit{font-size:.62em;color:#555;margin-top:5px;line-height:1.35}',
      '.co2-band{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e8e8e8}',
      '.co2-cell{padding:14px 16px;border-right:1px solid #e8e8e8;min-width:0}',
      '.co2-cell:last-child{border-right:none}',
      '.co2-cell-label{font-size:.56em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#111;opacity:.45;margin-bottom:4px}',
      '.co2-cell-val{font-size:1.22em;font-weight:900;line-height:1;color:#1a1a6e;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.co2-cell-val.warm{color:#b42318}',
      '.co2-cell-val.teal{color:#23606d}',
      '.co2-cell-val.cool{color:#1a6dd4}',
      '.co2-cell-sub{font-size:.6em;color:#777;margin-top:4px;line-height:1.35}',
      '.co2-section{padding:13px 24px 14px}',
      '.co2-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}',
      '.co2-section-label{font-size:.58em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#555}',
      '.co2-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:.58em;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#555}',
      '.co2-legend span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
      '.co2-legend i{display:inline-block;width:18px;height:3px;border-radius:2px;background:#111}',
      '.co2-legend i.red{background:#e51b1b}.co2-legend i.black{background:#111}.co2-legend i.blue{background:#1a1a6e;width:8px;height:8px;border-radius:50%}',
      '.co2-chart-wrap{position:relative;background:#fff;overflow:hidden}',
      '.co2-chart-wrap svg{display:block;width:100%;height:auto;min-height:290px}',
      '.co2-tip{position:fixed;z-index:9999;display:none;min-width:190px;max-width:230px;padding:9px 10px;border-radius:7px;background:#fff;color:#111;border:1px solid #cfcfcf;box-shadow:0 8px 22px rgba(0,0,0,.18);font-size:.72em;line-height:1.45;pointer-events:none}',
      '.co2-tip strong{display:block;font-size:1.08em;margin-bottom:2px;color:#1a1a6e}',
      '.co2-foot{display:flex;justify-content:space-between;gap:4px;flex-wrap:wrap;margin-top:8px;font-size:.62em;color:#555;opacity:.72}',
      '.co2-foot a{color:#1a1a6e;text-decoration:none;border-bottom:1px solid #1a1a6e}',
      '.co2-err{padding:2rem 1.5rem;text-align:center;color:#b42318;font-size:.82rem;line-height:1.55}',
      '@media(max-width:680px){.co2-head{grid-template-columns:1fr;min-height:unset;padding:18px 16px;gap:14px}.co2-hero-stat{text-align:left;align-self:auto}.co2-hero-val{font-size:2em}.co2-band{grid-template-columns:repeat(2,1fr)}.co2-cell:nth-child(2n){border-right:none}.co2-cell:nth-child(n+3){border-top:1px solid #e8e8e8}.co2-section{padding:16px 14px 18px}.co2-section-head{display:block}.co2-legend{margin-top:8px}.co2-chart-wrap svg{min-height:250px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.renderMaunaLoaCO2Widget = function (target) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;
    injectStyle();
    container.innerHTML = '<div class="co2-widget"><div class="co2-card"><div class="co2-err" style="color:#777"><span style="display:inline-block;width:18px;height:18px;border:2px solid #d0d0d0;border-top-color:#1a1a6e;border-radius:50%;animation:co2spin .65s linear infinite"></span><br>Loading CO₂ data...</div></div></div>';

    if (!document.getElementById('co2-spin-style')) {
      var spinStyle = document.createElement('style');
      spinStyle.id = 'co2-spin-style';
      spinStyle.textContent = '@keyframes co2spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(spinStyle);
    }

    Promise.all([
      fetchJson('co2-monthly.json'),
      fetchJson('co2-weekly-latest.json')
    ]).then(function (parts) {
      render(container, parts[0], parts[1]);
    }).catch(function (error) {
      renderError(container, error);
    });
  };
})();

