/* “AI” Insights Layer (prototype)
 * - Composite scoring
 * - Simple anomaly detection for share shifts
 * - Rule-based recommendations (“prescriptive” outputs)
 *
 * Swap this file for real ML/NLP + data pipelines later.
 */

(() => {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const round = (x, n = 3) => Number(x.toFixed(n));

  function zScoreLatest(values) {
    if (!values?.length || values.length < 6) return 0;
    const latest = values[values.length - 1];
    const hist = values.slice(0, -1);
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const variance = hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length;
    const sd = Math.sqrt(variance) || 1e-9;
    return (latest - mean) / sd;
  }

  function computeGeoScores(geoRows) {
    // Composite score: unmet need + penetration gap + access + infra
    // (weights reflect the provided description: attractiveness + unmet need)
    const wNeed = 0.34, wGap = 0.32, wAccess = 0.18, wInfra = 0.16;
    return geoRows.map((r) => {
      const score = clamp01(wNeed * r.patientNeed + wGap * r.penetrationGap + wAccess * r.access + wInfra * r.infra);
      const drivers = {
        patientNeed: r.patientNeed,
        penetrationGap: r.penetrationGap,
        access: r.access,
        infra: r.infra,
      };
      return { ...r, expansionScore: round(score), drivers };
    }).sort((a, b) => b.expansionScore - a.expansionScore);
  }

  function computeDiseaseScores(diseases) {
    // Composite prioritization:
    // - higher burden, unmet, market size, reimbursement, Lilly-fit are good
    // - lower competition intensity & lower regulatory complexity are good
    const wBurden = 0.18;
    const wUnmet = 0.20;
    const wMarket = 0.16;
    const wReimb = 0.12;
    const wFit = 0.14;
    const wLowComp = 0.10;
    const wLowReg = 0.10;

    return diseases.map((d) => {
      const score = clamp01(
        wBurden * d.burden +
        wUnmet * d.unmetNeed +
        wMarket * d.marketSize +
        wReimb * d.reimbursementPotential +
        wFit * d.lillyStrengthFit +
        wLowComp * (1 - d.competitionIntensity) +
        wLowReg * (1 - d.regulatoryComplexity)
      );

      const impact = clamp01(0.55 * d.burden + 0.45 * d.unmetNeed);
      const feasibility = clamp01(0.45 * d.lillyStrengthFit + 0.35 * d.reimbursementPotential + 0.20 * (1 - d.regulatoryComplexity));
      return {
        ...d,
        prioritizationScore: round(score),
        impact: round(impact),
        feasibility: round(feasibility),
      };
    }).sort((a, b) => b.prioritizationScore - a.prioritizationScore);
  }

  function computeCompetitiveAlerts(competition) {
    // Detect “share surges” when latest month z-score is high and delta is meaningful.
    const months = competition.months;
    const latestMonth = months[months.length - 1];

    // Build per-competitor series from normalized table
    const compNames = Object.keys(competition.normalized[0].shares).filter((k) => k !== "Others/LILLY");
    const byComp = compNames.map((name) => {
      const values = competition.normalized.map((row) => row.shares[name]);
      const delta = values[values.length - 1] - values[values.length - 2];
      const z = zScoreLatest(values);
      return { competitor: name, values, delta: round(delta, 3), z: round(z, 2) };
    });

    const surges = byComp
      .filter((c) => c.z >= 1.6 && c.delta >= 0.015) // tuned for synthetic data
      .sort((a, b) => b.z - a.z);

    const alerts = surges.map((s) => {
      const severity = s.z >= 2.2 ? "high" : "medium";
      const suggestion = severity === "high"
        ? "Launch targeted retention + payer messaging; consider tactical pricing defense in affected disease/region segments."
        : "Increase competitive monitoring; test localized creative + channel mix shifts; validate pipeline/launch drivers.";
      return {
        type: "Share Surge",
        competitor: s.competitor,
        month: latestMonth,
        delta: s.delta,
        z: s.z,
        severity,
        recommendation: suggestion,
      };
    });

    return { byComp, surges, alerts };
  }

  function computePolicyScores(policyItems) {
    // Risk score = impact * likelihood, adjusted for complexity (proxy for effort/lead time)
    return policyItems.map((p) => {
      const risk = clamp01((p.impact * p.likelihood) * (0.75 + 0.25 * p.complexity));
      const severity = risk >= 0.62 ? "high" : risk >= 0.42 ? "medium" : "low";
      return { ...p, risk: round(risk), severity };
    }).sort((a, b) => b.risk - a.risk);
  }

  function buildSoWhat({ geoScored, diseaseScored, compAlerts, policyScored }) {
    // Synthesize top actions. In a real system this would be an LLM + optimization layer.
    const topGeo = geoScored.slice(0, 5);
    const coldGeo = geoScored.slice(-4).reverse();
    const topDz = diseaseScored.slice(0, 5);
    const topPolicy = policyScored.slice(0, 4);
    const topComp = compAlerts.alerts.slice(0, 4);

    const actions = [];

    // Expansion actions
    topGeo.slice(0, 3).forEach((g, i) => {
      actions.push({
        id: "ACT-GEO-" + (i + 1),
        title: `Expand DTC activation in ${g.state} (high opportunity score)`,
        rationale: `High unmet need (${g.patientNeed}) + large penetration gap (${g.penetrationGap}); access=${g.access}, infra=${g.infra}.`,
        impact: round(0.55 + 0.35 * g.expansionScore, 2),
        urgency: round(0.50 + 0.40 * g.penetrationGap, 2),
        confidence: round(0.58 + 0.30 * g.expansionScore, 2),
        tags: ["Expansion", "Geo", g.expansionScore >= 0.7 ? "Hot zone" : "Growth"],
        evidence: [
          { source: "Geographic Heat Map", signal: "ExpansionScore", value: g.expansionScore, note: `Composite attractiveness + unmet need in ${g.state}.` },
        ],
        risks: [
          { risk: "Channel capacity", likelihood: 0.35, impact: 0.55, note: "May require fulfillment + care team scaling." },
        ],
      });
    });

    // Disease actions
    topDz.slice(0, 2).forEach((d, i) => {
      actions.push({
        id: "ACT-DZ-" + (i + 1),
        title: `Prioritize ${d.disease} (top composite score)`,
        rationale: `High impact (${d.impact}) and feasibility (${d.feasibility}); unmet need=${d.unmetNeed}, competition=${d.competitionIntensity}.`,
        impact: round(0.52 + 0.38 * d.prioritizationScore, 2),
        urgency: round(0.48 + 0.35 * d.literaturePulse, 2),
        confidence: round(0.56 + 0.30 * d.prioritizationScore, 2),
        tags: ["Disease", d.area, d.competitionIntensity >= 0.7 ? "Crowded" : "White space"],
        evidence: [
          { source: "Disease Prioritization Matrix", signal: "PrioritizationScore", value: d.prioritizationScore, note: "Multi-criteria weighted scoring." },
          { source: "NLP Pulse (simulated)", signal: "LiteraturePulse", value: d.literaturePulse, note: "Higher pulse suggests rising clinical + market attention." },
        ],
        risks: [
          { risk: "Regulatory complexity", likelihood: d.regulatoryComplexity, impact: 0.6, note: "May lengthen path-to-market / labeling flexibility." },
        ],
      });
    });

    // Competitive defense actions
    topComp.slice(0, 2).forEach((a, i) => {
      actions.push({
        id: "ACT-COMP-" + (i + 1),
        title: `Counter ${a.competitor} share surge (${a.month})`,
        rationale: `Detected anomalous share uptick (Δ=${a.delta}, z=${a.z}).`,
        impact: a.severity === "high" ? 0.78 : 0.66,
        urgency: a.severity === "high" ? 0.82 : 0.70,
        confidence: a.severity === "high" ? 0.70 : 0.62,
        tags: ["Competition", a.severity === "high" ? "High risk" : "Watch"],
        evidence: [
          { source: "Competitive Radar", signal: "ShareSurge", value: a.delta, note: a.recommendation },
        ],
        risks: [
          { risk: "Pricing constraints", likelihood: 0.45, impact: 0.62, note: "Counter-moves may be limited by contracting cycles." },
        ],
      });
    });

    // Policy readiness actions
    topPolicy.slice(0, 2).forEach((p, i) => {
      actions.push({
        id: "ACT-POL-" + (i + 1),
        title: `Prepare response for ${p.category} (${p.region})`,
        rationale: `Elevated risk score=${p.risk} with horizon=${p.horizon}; affects ${p.affected}.`,
        impact: round(0.55 + 0.35 * p.risk, 2),
        urgency: p.horizon === "Now" ? 0.82 : p.horizon === "0–3 months" ? 0.72 : 0.60,
        confidence: round(0.60 + 0.25 * p.likelihood, 2),
        tags: ["Policy", p.severity === "high" ? "High impact" : "Medium"],
        evidence: [
          { source: "Regulatory & Policy Watchtower", signal: "Risk", value: p.risk, note: p.summary },
        ],
        risks: [
          { risk: "Cross-functional dependencies", likelihood: 0.52, impact: 0.55, note: "Legal, privacy, market access, and product must align." },
        ],
      });
    });

    // Rank actions
    const ranked = actions.map((a) => {
      const priority = clamp01(0.45 * a.impact + 0.35 * a.urgency + 0.20 * a.confidence);
      return { ...a, priority: round(priority, 3) };
    }).sort((a, b) => b.priority - a.priority);

    // Scenario preview: cumulative impact if top N executed
    const topN = ranked.slice(0, 6);
    let cum = 0;
    const scenario = topN.map((a, idx) => {
      cum += a.impact * (0.35 + 0.65 * a.confidence); // proxy for realized value
      return { step: idx + 1, action: a.id, cumulativeValue: round(cum, 2) };
    });

    // Evidence rows for table
    const evidence = ranked.flatMap((a) =>
      a.evidence.map((e) => ({
        actionId: a.id,
        action: a.title,
        module: e.source,
        signal: e.signal,
        value: e.value,
        note: e.note,
      }))
    );

    // Risk bubbles
    const riskBubbles = ranked.flatMap((a) =>
      a.risks.map((r) => ({
        actionId: a.id,
        action: a.title,
        risk: r.risk,
        likelihood: r.likelihood,
        impact: r.impact,
        severity: round(r.likelihood * r.impact, 3),
        note: r.note,
      }))
    );

    return { rankedActions: ranked, scenario, evidence, riskBubbles, hotGeo: topGeo, coldGeo };
  }

  window.LILLYiInsights = {
    computeAll(data) {
      const geoScored = computeGeoScores(data.geo);
      const diseaseScored = computeDiseaseScores(data.diseases);
      const compAlerts = computeCompetitiveAlerts(data.competition);
      const policyScored = computePolicyScores(data.policy);
      const soWhat = buildSoWhat({ geoScored, diseaseScored, compAlerts, policyScored });

      return { geoScored, diseaseScored, compAlerts, policyScored, soWhat };
    },
  };
})();

