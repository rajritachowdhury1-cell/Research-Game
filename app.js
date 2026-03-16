(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function fmtDate(d) {
    try {
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(d);
    }
  }

  function chip(label, kind = "neutral") {
    const cls = kind === "good" ? "chip chip--good" : kind === "warn" ? "chip chip--warn" : kind === "bad" ? "chip chip--bad" : "chip";
    return `<span class="${cls}">${label}</span>`;
  }

  function tag(label, kind = "neutral") {
    const cls = kind === "good" ? "tag tag--good" : kind === "warn" ? "tag tag--warn" : kind === "bad" ? "tag tag--bad" : "tag";
    return `<span class="${cls}">${label}</span>`;
  }

  function renderList(el, items) {
    el.innerHTML = items.map((it) => {
      const chips = (it.chips || []).map((c) => chip(c.label, c.kind)).join("");
      return `
        <div class="listItem">
          <div class="listItem__top">
            <div>
              <div class="listItem__title">${it.title}</div>
              <div class="listItem__meta">${it.meta || ""}</div>
            </div>
            <div class="chipRow">${chips}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTable(el, columns, rows) {
    const head = columns.map((c) => `<th>${c.label}</th>`).join("");
    const body = rows.map((r) => {
      const tds = columns.map((c) => `<td>${c.render(r)}</td>`).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    el.innerHTML = `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function setKPIs(insights) {
    const hot = insights.geoScored.filter((g) => g.expansionScore >= 0.68).length;
    const dz = insights.diseaseScored.slice(0, 3).length;
    const surges = insights.compAlerts.alerts.length;
    const reg = insights.policyScored.filter((p) => p.severity !== "low").length;

    $("#kpiHotZones").textContent = String(hot);
    $("#kpiPriorityDiseases").textContent = String(dz);
    $("#kpiShareSurges").textContent = String(surges);
    $("#kpiRegAlerts").textContent = String(reg);
  }

  function plotGeoMap(geoScored) {
    const locs = geoScored.map((g) => g.state);
    const z = geoScored.map((g) => g.expansionScore);
    const text = geoScored.map((g) => `${g.state}<br>Expansion score: ${g.expansionScore}<br>Need: ${g.patientNeed} | Gap: ${g.penetrationGap}`);

    const trace = {
      type: "choropleth",
      locationmode: "USA-states",
      locations: locs,
      z,
      text,
      hoverinfo: "text",
      colorscale: [
        [0, "#0c142c"],
        [0.25, "#1b2a5a"],
        [0.5, "#2f56b6"],
        [0.75, "#5aa6ff"],
        [1, "#a6ffcf"],
      ],
      zmin: 0,
      zmax: 1,
      marker: { line: { color: "rgba(255,255,255,.18)", width: 0.7 } },
      colorbar: { title: "Expansion", tickformat: ".0%" },
    };

    const layout = {
      geo: {
        scope: "usa",
        bgcolor: "rgba(0,0,0,0)",
        lakecolor: "rgba(255,255,255,0.05)",
        showlakes: true,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 0, b: 0 },
      font: { color: "rgba(233,237,255,.92)" },
    };

    Plotly.newPlot("geoMap", [trace], layout, { displayModeBar: false, responsive: true });
  }

  function plotGeoDrivers(geoScored) {
    const top = geoScored.slice(0, 10).reverse();
    const states = top.map((g) => g.state);
    const need = top.map((g) => g.patientNeed);
    const gap = top.map((g) => g.penetrationGap);
    const access = top.map((g) => g.access);
    const infra = top.map((g) => g.infra);

    const traces = [
      { name: "Unmet need", x: need, y: states, type: "bar", orientation: "h", marker: { color: "#7aa8ff" } },
      { name: "Penetration gap", x: gap, y: states, type: "bar", orientation: "h", marker: { color: "#a6ffcf" } },
      { name: "Access", x: access, y: states, type: "bar", orientation: "h", marker: { color: "#ffcc66" } },
      { name: "Infrastructure", x: infra, y: states, type: "bar", orientation: "h", marker: { color: "#ff6b8a" } },
    ];

    const layout = {
      barmode: "stack",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 34, r: 10, t: 6, b: 26 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { range: [0, 3.2], tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)" },
      yaxis: { gridcolor: "rgba(255,255,255,.04)" },
      legend: { orientation: "h", x: 0, y: 1.15 },
    };
    Plotly.newPlot("geoDrivers", traces, layout, { displayModeBar: false, responsive: true });
  }

  function renderGeoRecommendations(soWhat) {
    const hot = soWhat.hotGeo.slice(0, 6);
    const cold = soWhat.coldGeo.slice(0, 4);
    const list = [];

    hot.forEach((g) => {
      list.push({
        title: `Hot zone: ${g.state} — expand activation`,
        meta: `Expansion score ${g.expansionScore}. Drivers: unmet need ${g.patientNeed}, gap ${g.penetrationGap}, access ${g.access}, infra ${g.infra}.`,
        chips: [
          { label: "Hot", kind: "good" },
          { label: `Score ${(g.expansionScore * 100).toFixed(0)}%`, kind: "good" },
          { label: "Resource allocation", kind: "neutral" },
        ],
      });
    });

    cold.forEach((g) => {
      list.push({
        title: `Cold zone: ${g.state} — investigate alternative strategy`,
        meta: `Lower composite score (${g.expansionScore}). Consider access barriers or limited infra.`,
        chips: [
          { label: "Cold", kind: "bad" },
          { label: `Score ${(g.expansionScore * 100).toFixed(0)}%`, kind: "bad" },
          { label: "Diagnose barriers", kind: "warn" },
        ],
      });
    });

    renderList($("#geoRecommendations"), list);

    const tags = [
      tag(`Hot zones ≥ 68%`, "good"),
      tag(`Cold zones ≤ 38%`, "bad"),
      tag(`Score = need + gap + access + infra`, "neutral"),
    ];
    $("#geoTags").innerHTML = tags.join("");
  }

  function plotDiseaseMatrix(diseaseScored) {
    const trace = {
      type: "scatter",
      mode: "markers+text",
      x: diseaseScored.map((d) => d.feasibility),
      y: diseaseScored.map((d) => d.impact),
      text: diseaseScored.map((d) => d.disease),
      textposition: "top center",
      hovertemplate:
        "<b>%{text}</b><br>Impact=%{y:.0%}<br>Feasibility=%{x:.0%}<br>Score=%{customdata[0]:.0%}<br>Unmet=%{customdata[1]:.0%}<br>Competition=%{customdata[2]:.0%}<extra></extra>",
      customdata: diseaseScored.map((d) => [d.prioritizationScore, d.unmetNeed, d.competitionIntensity]),
      marker: {
        size: diseaseScored.map((d) => 10 + 28 * d.unmetNeed),
        color: diseaseScored.map((d) => d.competitionIntensity),
        colorscale: [
          [0, "#a6ffcf"],
          [0.5, "#7aa8ff"],
          [1, "#ff6b8a"],
        ],
        cmin: 0,
        cmax: 1,
        line: { color: "rgba(255,255,255,.22)", width: 1 },
        colorbar: { title: "Competition", tickformat: ".0%" },
        opacity: 0.95,
      },
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 46, r: 10, t: 6, b: 40 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { title: "Feasibility", tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
      yaxis: { title: "Patient/Market Impact", tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
    };
    Plotly.newPlot("diseaseMatrix", [trace], layout, { displayModeBar: false, responsive: true });
  }

  function renderDiseaseRankTable(diseaseScored) {
    const top = diseaseScored.slice(0, 10);
    renderTable($("#diseaseRankTable"), [
      { label: "Rank", render: (_, idx) => `<span class="mono">${idx + 1}</span>` },
      { label: "Disease", render: (r) => `<b>${r.disease}</b><div class="rowHint">${r.area}</div>` },
      { label: "Score", render: (r) => `${(r.prioritizationScore * 100).toFixed(0)}%` },
      { label: "Why", render: (r) => {
        const why = [];
        if (r.unmetNeed >= 0.7) why.push("high unmet need");
        if (r.competitionIntensity <= 0.45) why.push("lower competition");
        if (r.lillyStrengthFit >= 0.65) why.push("strong Lilly fit");
        if (r.reimbursementPotential >= 0.6) why.push("good reimbursement");
        return why.length ? why.join(", ") : "balanced signals";
      }},
    ], top.map((r, i) => ({ ...r, _rank: i + 1 })));

    // Patch: renderTable expects (r) only; add idx support by closure
    // We'll re-render with manual loop for rank column
    const cols = [
      { label: "Rank", render: (r) => `<span class="mono">${r._rank}</span>` },
      { label: "Disease", render: (r) => `<b>${r.disease}</b><div class="rowHint">${r.area}</div>` },
      { label: "Score", render: (r) => `${(r.prioritizationScore * 100).toFixed(0)}%` },
      { label: "Why", render: (r) => {
        const why = [];
        if (r.unmetNeed >= 0.7) why.push("high unmet need");
        if (r.competitionIntensity <= 0.45) why.push("lower competition");
        if (r.lillyStrengthFit >= 0.65) why.push("strong Lilly fit");
        if (r.reimbursementPotential >= 0.6) why.push("good reimbursement");
        if (r.regulatoryComplexity >= 0.75) why.push("reg complexity risk");
        return why.length ? why.join(", ") : "balanced signals";
      }},
    ];
    renderTable($("#diseaseRankTable"), cols, top.map((r, i) => ({ ...r, _rank: i + 1 })));
  }

  function plotDiseaseSignals(diseaseScored) {
    const top = diseaseScored.slice(0, 8).reverse();
    const y = top.map((d) => d.disease);
    const lit = top.map((d) => d.literaturePulse);
    const reg = top.map((d) => d.regulatoryComplexity);
    const comp = top.map((d) => d.competitionIntensity);

    const traces = [
      { name: "Literature / trial pulse", x: lit, y, type: "bar", orientation: "h", marker: { color: "#7aa8ff" } },
      { name: "Regulatory complexity", x: reg, y, type: "bar", orientation: "h", marker: { color: "#ffcc66" } },
      { name: "Competition intensity", x: comp, y, type: "bar", orientation: "h", marker: { color: "#ff6b8a" } },
    ];
    const layout = {
      barmode: "group",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 140, r: 10, t: 6, b: 30 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
      yaxis: { gridcolor: "rgba(255,255,255,.04)" },
      legend: { orientation: "h", x: 0, y: 1.15 },
    };
    Plotly.newPlot("diseaseSignals", traces, layout, { displayModeBar: false, responsive: true });
  }

  function plotShareTrend(competition) {
    const months = competition.months;
    const keys = Object.keys(competition.normalized[0].shares);
    const traces = keys.map((k) => {
      const y = competition.normalized.map((row) => row.shares[k]);
      const isOthers = k === "Others/LILLY";
      return {
        type: "scatter",
        mode: "lines+markers",
        name: k,
        x: months,
        y,
        line: { width: isOthers ? 2 : 3, dash: isOthers ? "dot" : "solid" },
        marker: { size: isOthers ? 6 : 7 },
      };
    });

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 46, r: 10, t: 6, b: 40 },
      font: { color: "rgba(233,237,255,.92)" },
      yaxis: { tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
      xaxis: { gridcolor: "rgba(255,255,255,.04)" },
      legend: { orientation: "h", x: 0, y: 1.2 },
    };

    Plotly.newPlot("shareTrend", traces, layout, { displayModeBar: false, responsive: true });
  }

  function plotCompRadar(posture) {
    const axes = ["pipelineMomentum", "marketingSpendIndex", "pricingPressure", "partnershipActivity", "sentimentBuzz"];
    const labels = ["Pipeline", "Marketing", "Pricing pressure", "Partnerships", "Sentiment"];

    const traces = posture.map((p) => ({
      type: "scatterpolar",
      r: axes.map((a) => p[a]),
      theta: labels,
      fill: "toself",
      name: p.competitor,
      line: { color: p.color, width: 2 },
      opacity: 0.6,
    }));

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      polar: {
        bgcolor: "rgba(0,0,0,0)",
        radialaxis: { range: [0, 1], tickformat: ".0%", gridcolor: "rgba(255,255,255,.08)" },
        angularaxis: { gridcolor: "rgba(255,255,255,.06)" },
      },
      margin: { l: 10, r: 10, t: 10, b: 10 },
      font: { color: "rgba(233,237,255,.92)" },
      legend: { orientation: "h", x: 0, y: -0.12 },
    };
    Plotly.newPlot("compRadar", traces, layout, { displayModeBar: false, responsive: true });
  }

  function renderCompAlerts(compAlerts) {
    const list = compAlerts.alerts.length ? compAlerts.alerts : [{
      type: "No anomalies",
      competitor: "—",
      month: "—",
      delta: 0,
      z: 0,
      severity: "low",
      recommendation: "No statistically meaningful share surges detected in the latest month (demo). Continue monitoring.",
    }];

    renderList($("#compAlerts"), list.map((a) => ({
      title: a.type === "Share Surge"
        ? `${a.competitor}: share surge detected (${a.month})`
        : `Stable competitive landscape (demo)`,
      meta: a.type === "Share Surge"
        ? `Δ share ${(a.delta * 100).toFixed(1)} pts; z=${a.z}. Recommendation: ${a.recommendation}`
        : a.recommendation,
      chips: [
        { label: a.type, kind: a.type === "Share Surge" ? (a.severity === "high" ? "bad" : "warn") : "good" },
        { label: a.type === "Share Surge" ? (a.severity === "high" ? "High severity" : "Medium severity") : "Healthy", kind: a.type === "Share Surge" ? (a.severity === "high" ? "bad" : "warn") : "good" },
      ],
    })));
  }

  function renderPolicyTable(policyScored) {
    const cols = [
      { label: "ID", render: (r) => `<span class="mono">${r.id}</span>` },
      { label: "Category", render: (r) => `<b>${r.category}</b><div class="rowHint">${r.region} • ${r.horizon}</div>` },
      { label: "Risk", render: (r) => {
        const kind = r.severity === "high" ? "bad" : r.severity === "medium" ? "warn" : "good";
        return `${chip(`${(r.risk * 100).toFixed(0)}%`, kind)}<div class="rowHint">${r.affected}</div>`;
      }},
      { label: "Summary", render: (r) => `${r.summary}` },
    ];
    renderTable($("#policyTable"), cols, policyScored.slice(0, 10));
  }

  function renderPolicyInsights(policyScored) {
    const top = policyScored.slice(0, 6);
    renderList($("#policyInsights"), top.map((p) => {
      const kind = p.severity === "high" ? "bad" : p.severity === "medium" ? "warn" : "good";
      const rec = p.severity === "high"
        ? "Start compliance + market access impact assessment; define mitigation plan and stakeholder comms."
        : p.severity === "medium"
          ? "Add to watchlist; draft response options; validate timing with policy counsel."
          : "Monitor for updates.";
      return {
        title: `${p.category} — ${p.region}`,
        meta: `Risk ${(p.risk * 100).toFixed(0)}% (impact ${Math.round(p.impact * 100)}%, likelihood ${Math.round(p.likelihood * 100)}%). Suggested: ${rec}`,
        chips: [
          { label: p.severity.toUpperCase(), kind },
          { label: p.horizon, kind: p.horizon === "Now" ? "bad" : p.horizon === "0–3 months" ? "warn" : "neutral" },
        ],
      };
    }));
  }

  function plotPolicyHeat(policyScored) {
    const cats = Array.from(new Set(policyScored.map((p) => p.category)));
    const regs = Array.from(new Set(policyScored.map((p) => p.region)));
    const z = regs.map((r) => cats.map((c) => {
      const items = policyScored.filter((p) => p.region === r && p.category === c);
      if (!items.length) return 0;
      const avg = items.reduce((a, b) => a + b.risk, 0) / items.length;
      return avg;
    }));

    const trace = {
      type: "heatmap",
      x: cats,
      y: regs,
      z,
      colorscale: [
        [0, "#0c142c"],
        [0.35, "#1b2a5a"],
        [0.6, "#ffcc66"],
        [1, "#ff6b8a"],
      ],
      zmin: 0,
      zmax: 1,
      hovertemplate: "<b>%{y}</b><br>%{x}<br>Risk=%{z:.0%}<extra></extra>",
      colorbar: { title: "Risk", tickformat: ".0%" },
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 90, r: 10, t: 6, b: 80 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { tickangle: -20 },
      yaxis: { automargin: true },
    };
    Plotly.newPlot("policyHeat", [trace], layout, { displayModeBar: false, responsive: true });
  }

  function renderGeoStateTable(stateSignals, geoScored) {
    if (!stateSignals || !stateSignals.length) return;
    const byStateScore = new Map(geoScored.map((g) => [g.state, g.expansionScore]));
    const byStateNeedGap = new Map(geoScored.map((g) => [g.state, { need: g.patientNeed, gap: g.penetrationGap }]));

    const rows = stateSignals.slice().sort((a, b) => a.state.localeCompare(b.state)).map((row) => {
      const score = byStateScore.get(row.state) ?? 0;
      const ng = byStateNeedGap.get(row.state) ?? { need: 0, gap: 0 };
      return { ...row, expansionScore: score, need: ng.need, gap: ng.gap };
    });

    const cols = [
      { label: "State", render: (r) => `<span class="mono">${r.state}</span>` },
      { label: "Expansion score", render: (r) => `${(r.expansionScore * 100).toFixed(0)}%` },
      {
        label: "Patient need / gap",
        render: (r) =>
          `Need ${(r.need * 100).toFixed(0)}%<div class="rowHint">Penetration gap ${(r.gap * 100).toFixed(0)}%</div>`,
      },
      {
        label: "SALES_TRANSACTIONS (demo)",
        render: (r) => `$${r.salesRevenue.toFixed(1)}M<div class="rowHint">Revenue by product, geography, time</div>`,
      },
      {
        label: "CONSULTS (demo)",
        render: (r) =>
          `${(r.consultConversion * 100).toFixed(0)}% conv.<div class="rowHint">Condition mix & conversion rate</div>`,
      },
      {
        label: "IQVIA synthetic",
        render: (r) =>
          `Prev idx ${(r.iqviaPrevIndex * 100).toFixed(0)}%<div class="rowHint">LILLY share ${(r.lillyShare * 100).toFixed(0)}%</div>`,
      },
    ];

    renderTable($("#geoStateTable"), cols, rows);
  }

  function renderGeoDiseaseTable(geoDisease) {
    if (!geoDisease || !geoDisease.length) return;

    const byState = new Map();
    geoDisease.forEach((row) => {
      if (!byState.has(row.state)) byState.set(row.state, []);
      byState.get(row.state).push(row);
    });

    const rows = Array.from(byState.entries()).map(([state, items]) => {
      const sorted = items.slice().sort((a, b) => b.prevalenceIndex - a.prevalenceIndex);
      const top1 = sorted[0];
      const top2 = sorted[1];
      return {
        state,
        top1,
        top2,
      };
    }).sort((a, b) => a.state.localeCompare(b.state));

    const cols = [
      { label: "State", render: (r) => `<span class="mono">${r.state}</span>` },
      {
        label: "Most prevalent disease & therapy",
        render: (r) => r.top1
          ? `<b>${r.top1.disease}</b><div class="rowHint">${r.top1.area}</div><div class="rowHint">Therapy: ${r.top1.product}</div><div class="rowHint">Prevalence index ${(r.top1.prevalenceIndex * 100).toFixed(0)}%</div>`
          : "—",
      },
      {
        label: "Second disease (if any)",
        render: (r) => r.top2
          ? `<b>${r.top2.disease}</b><div class="rowHint">${r.top2.area}</div><div class="rowHint">Therapy: ${r.top2.product}</div><div class="rowHint">Prevalence index ${(r.top2.prevalenceIndex * 100).toFixed(0)}%</div>`
          : "<span class=\"rowHint\">None highlighted</span>",
      },
    ];

    renderTable($("#geoDiseaseTable"), cols, rows);
  }

  function renderSoWhat(soWhat) {
    const top = soWhat.rankedActions.slice(0, 8);
    renderList($("#actionsList"), top.map((a) => {
      const p = a.priority;
      const kind = p >= 0.74 ? "bad" : p >= 0.62 ? "warn" : "good";
      return {
        title: a.title,
        meta: `${a.rationale} (Priority ${(p * 100).toFixed(0)}%)`,
        chips: [
          { label: `Impact ${(a.impact * 100).toFixed(0)}%`, kind: "neutral" },
          { label: `Urgency ${(a.urgency * 100).toFixed(0)}%`, kind: a.urgency >= 0.78 ? "bad" : a.urgency >= 0.66 ? "warn" : "good" },
          { label: `Confidence ${(a.confidence * 100).toFixed(0)}%`, kind: a.confidence >= 0.7 ? "good" : "warn" },
          { label: `Priority ${(p * 100).toFixed(0)}%`, kind },
        ],
      };
    }));

    renderTable($("#evidenceTable"), [
      { label: "Action", render: (r) => `<b>${r.actionId}</b><div class="rowHint">${r.action}</div>` },
      { label: "Module", render: (r) => r.module },
      { label: "Signal", render: (r) => `${r.signal}<div class="rowHint">Value: <span class="mono">${r.value}</span></div>` },
      { label: "Interpretation", render: (r) => r.note },
    ], soWhat.evidence.slice(0, 14));
  }

  function plotScenario(scenario) {
    const trace = {
      type: "scatter",
      mode: "lines+markers",
      x: scenario.map((s) => s.step),
      y: scenario.map((s) => s.cumulativeValue),
      text: scenario.map((s) => s.action),
      hovertemplate: "Step %{x}<br>%{text}<br>Cumulative value=%{y}<extra></extra>",
      line: { color: "#a6ffcf", width: 3 },
      marker: { size: 8 },
    };
    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 46, r: 10, t: 6, b: 40 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { title: "Execution step", gridcolor: "rgba(255,255,255,.06)" },
      yaxis: { title: "Cumulative value (proxy)", gridcolor: "rgba(255,255,255,.06)" },
    };
    Plotly.newPlot("scenarioChart", [trace], layout, { displayModeBar: false, responsive: true });
  }

  function plotRiskBubbles(riskBubbles) {
    const trace = {
      type: "scatter",
      mode: "markers",
      x: riskBubbles.map((r) => r.likelihood),
      y: riskBubbles.map((r) => r.impact),
      text: riskBubbles.map((r) => `${r.actionId}: ${r.risk}`),
      hovertemplate: "<b>%{text}</b><br>Likelihood=%{x:.0%}<br>Impact=%{y:.0%}<br>Severity=%{marker.size:.0f}<br>%{customdata}<extra></extra>",
      customdata: riskBubbles.map((r) => r.note),
      marker: {
        size: riskBubbles.map((r) => 14 + 60 * r.severity),
        color: riskBubbles.map((r) => r.severity),
        colorscale: [
          [0, "#a6ffcf"],
          [0.55, "#ffcc66"],
          [1, "#ff6b8a"],
        ],
        cmin: 0,
        cmax: 1,
        line: { color: "rgba(255,255,255,.22)", width: 1 },
        opacity: 0.85,
        colorbar: { title: "Risk severity", tickformat: ".0%" },
      },
    };
    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 46, r: 10, t: 6, b: 40 },
      font: { color: "rgba(233,237,255,.92)" },
      xaxis: { title: "Likelihood", tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
      yaxis: { title: "Impact", tickformat: ".0%", gridcolor: "rgba(255,255,255,.06)", range: [0, 1] },
    };
    Plotly.newPlot("riskBubbles", [trace], layout, { displayModeBar: false, responsive: true });
  }

  function renderAll(state) {
    $("#asOf").textContent = fmtDate(state.data.asOf);
    setKPIs(state.insights);

    // So What
    renderSoWhat(state.insights.soWhat);
    plotScenario(state.insights.soWhat.scenario);
    plotRiskBubbles(state.insights.soWhat.riskBubbles);

    // Geo – state‑wise tables only (no heatmap)
    renderGeoStateTable(state.data.stateSignals, state.insights.geoScored);
    renderGeoDiseaseTable(state.data.geoDisease);

    // Disease
    plotDiseaseMatrix(state.insights.diseaseScored);
    renderDiseaseRankTable(state.insights.diseaseScored);
    plotDiseaseSignals(state.insights.diseaseScored);

    // Competition
    plotShareTrend(state.data.competition);
    plotCompRadar(state.data.competition.posture);
    renderCompAlerts(state.insights.compAlerts);

    // Policy
    renderPolicyTable(state.insights.policyScored);
    renderPolicyInsights(state.insights.policyScored);
    plotPolicyHeat(state.insights.policyScored);
  }

  function setActiveTab(tabKey) {
    $$(".tabBtn").forEach((b) => b.classList.toggle("isActive", b.dataset.tab === tabKey));
    $$(".tabPanel").forEach((p) => p.classList.remove("isActive"));

    const map = {
      soWhat: "#tab-soWhat",
      geo: "#tab-geo",
      disease: "#tab-disease",
      comp: "#tab-comp",
      policy: "#tab-policy",
    };
    const panel = $(map[tabKey]);
    if (panel) panel.classList.add("isActive");
  }

  function initTabs() {
    $$(".tabBtn").forEach((btn) => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });

    window.addEventListener("keydown", (e) => {
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const k = e.key;
      if (k === "1") setActiveTab("soWhat");
      if (k === "2") setActiveTab("geo");
      if (k === "3") setActiveTab("disease");
      if (k === "4") setActiveTab("comp");
      if (k === "5") setActiveTab("policy");
    });
  }

  function waitForDeps() {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const ok = Boolean(window.Plotly && window.LILLYiData && window.LILLYiInsights);
        if (ok) {
          clearInterval(t);
          resolve(true);
        }
        if (Date.now() - start > 10000) {
          clearInterval(t);
          resolve(false);
        }
      }, 50);
    });
  }

  async function boot() {
    initTabs();
    const ok = await waitForDeps();
    if (!ok) {
      alert("Prototype failed to load dependencies (Plotly/data/insights). Check internet access for CDN libraries.");
      return;
    }

    const state = { data: null, insights: null };

    const refresh = () => {
      state.data = window.LILLYiData.generateAll();
      state.insights = window.LILLYiInsights.computeAll(state.data);
      renderAll(state);
    };

    $("#regen").addEventListener("click", refresh);
    refresh();
  }

  window.addEventListener("DOMContentLoaded", boot);
})();

