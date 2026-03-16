/* Synthetic demo data generator (client-side)
 * Replace with real data connectors later.
 */

(() => {
  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO",
    "MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
  ];

  const DISEASES = [
    { name: "Type 2 Diabetes", area: "Metabolic" },
    { name: "Obesity", area: "Metabolic" },
    { name: "Alzheimer’s disease", area: "Neuroscience" },
    { name: "Migraine", area: "Neuroscience" },
    { name: "Psoriasis", area: "Immunology" },
    { name: "Rheumatoid Arthritis", area: "Immunology" },
    { name: "Breast cancer (HR+)", area: "Oncology" },
    { name: "Lung cancer (NSCLC)", area: "Oncology" },
    { name: "Depression (MDD)", area: "Neuroscience" },
    { name: "Heart Failure", area: "Cardio" },
  ];

  // Simple product mapping so we can say "which medicine" per disease in each state.
  const PRODUCTS = [
    { disease: "Type 2 Diabetes", product: "GLP‑1 injectable (demo)" },
    { disease: "Obesity", product: "Weight‑management GLP‑1 (demo)" },
    { disease: "Alzheimer’s disease", product: "Amyloid‑targeting therapy (demo)" },
    { disease: "Migraine", product: "CGRP inhibitor (demo)" },
    { disease: "Psoriasis", product: "IL‑17 biologic (demo)" },
    { disease: "Rheumatoid Arthritis", product: "JAK inhibitor (demo)" },
    { disease: "Breast cancer (HR+)", product: "Endocrine + CDK4/6 combo (demo)" },
    { disease: "Lung cancer (NSCLC)", product: "Targeted TKI (demo)" },
    { disease: "Depression (MDD)", product: "Novel antidepressant (demo)" },
    { disease: "Heart Failure", product: "Cardio metabolic agent (demo)" },
  ];

  const COMPETITORS = [
    { name: "Competitor A", color: "#ff6b8a" },
    { name: "Competitor B", color: "#ffcc66" },
    { name: "Competitor C", color: "#7aa8ff" },
  ];

  const POLICY_CATEGORIES = [
    "Pricing & Rebate Reform",
    "Data Privacy & Consent",
    "Telehealth & DTC Fulfillment",
    "Reimbursement & Prior Auth",
    "IP / Exclusivity",
  ];

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const round = (x, n = 2) => Number(x.toFixed(n));

  function seededNoise(seedStr) {
    // Small deterministic-ish noise from string (not cryptographic).
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      const t = (h >>> 0) / 4294967295;
      return t;
    };
  }

  function generateGeo() {
    // For each state: demographics proxy, prevalence proxy, infrastructure, socioeconomics, penetration, accessibility
    const geo = US_STATES.map((s) => {
      const noise = seededNoise("geo:" + s);
      const pop = rand(0.2, 1.0) * (0.7 + 0.6 * noise());
      const prevalence = rand(0.2, 1.0) * (0.6 + 0.7 * noise());
      const infra = rand(0.2, 1.0) * (0.65 + 0.7 * noise());
      const socio = rand(0.2, 1.0) * (0.6 + 0.7 * noise());
      const penetration = rand(0.05, 0.85) * (0.6 + 0.7 * noise()); // current LILLY Direct penetration
      const access = rand(0.2, 1.0) * (0.6 + 0.7 * noise());

      return {
        state: s,
        patientNeed: round(clamp01(0.45 * prevalence + 0.25 * pop + 0.3 * (1 - socio))),
        infra: round(clamp01(infra)),
        access: round(clamp01(access)),
        penetration: round(clamp01(penetration)),
        // Penetration gap is opportunity signal (high gap = low current penetration)
        penetrationGap: round(clamp01(1 - penetration)),
      };
    });
    return geo;
  }

  function generateDiseases() {
    return DISEASES.map((d) => {
      const n = seededNoise("dz:" + d.name);
      const burden = clamp01(0.35 + 0.65 * n());
      const unmet = clamp01(0.25 + 0.75 * n());
      const competition = clamp01(0.2 + 0.8 * n());
      const regComplexity = clamp01(0.15 + 0.85 * n());
      const reimbursement = clamp01(0.2 + 0.8 * n());
      const lillyFit = clamp01(0.25 + 0.75 * n());
      const marketSize = clamp01(0.25 + 0.75 * n());
      const recentLitPulse = clamp01(0.1 + 0.9 * n()); // simulated “NLP literature + trials pulse”

      return {
        disease: d.name,
        area: d.area,
        burden: round(burden),
        unmetNeed: round(unmet),
        competitionIntensity: round(competition),
        regulatoryComplexity: round(regComplexity),
        reimbursementPotential: round(reimbursement),
        lillyStrengthFit: round(lillyFit),
        marketSize: round(marketSize),
        literaturePulse: round(recentLitPulse),
      };
    });
  }

  function generateCompetition() {
    // Monthly share by competitor + "LILLY Direct" baseline (synthetic)
    const months = Array.from({ length: 12 }, (_, i) => {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - (11 - i));
      return dt.toISOString().slice(0, 7);
    });

    const series = COMPETITORS.map((c) => {
      const n = seededNoise("comp:" + c.name);
      let base = 0.18 + 0.25 * n();
      const trend = (n() - 0.5) * 0.035;
      const shockMonth = Math.floor(n() * 12);
      const shock = (n() - 0.5) * 0.06;
      const values = months.map((_, idx) => {
        const localShock = idx === shockMonth ? shock : 0;
        base = clamp01(base + trend + localShock + (n() - 0.5) * 0.01);
        return round(base, 3);
      });
      return { competitor: c.name, color: c.color, months, values };
    });

    // Normalize each month to sum <= 0.85, reserve the rest for "Others/LILLY"
    const normalized = months.map((m, idx) => {
      const raw = series.map((s) => s.values[idx]);
      const sum = raw.reduce((a, b) => a + b, 0);
      const scale = sum > 0.85 ? 0.85 / sum : 1;
      const scaled = raw.map((v) => round(v * scale, 3));
      const others = round(1 - scaled.reduce((a, b) => a + b, 0), 3);
      return { month: m, shares: { ...Object.fromEntries(series.map((s, i) => [s.competitor, scaled[i]])), "Others/LILLY": others } };
    });

    // Posture metrics used in radar chart
    const posture = COMPETITORS.map((c) => {
      const n = seededNoise("posture:" + c.name);
      return {
        competitor: c.name,
        color: c.color,
        pipelineMomentum: round(clamp01(0.2 + 0.8 * n())),
        marketingSpendIndex: round(clamp01(0.2 + 0.8 * n())),
        pricingPressure: round(clamp01(0.2 + 0.8 * n())),
        partnershipActivity: round(clamp01(0.2 + 0.8 * n())),
        sentimentBuzz: round(clamp01(0.2 + 0.8 * n())),
      };
    });

    return { months, normalized, posture };
  }

  function generatePolicy() {
    const regions = ["US Federal", "EU", "UK", "CA", "AU", "JP"];
    const impacts = ["Market access", "Pricing", "DTC fulfillment", "Data handling", "Reimbursement"];
    const horizon = ["Now", "0–3 months", "3–6 months", "6–12 months"];

    const items = Array.from({ length: 10 }, (_, i) => {
      const category = pick(POLICY_CATEGORIES);
      const region = pick(regions);
      const n = seededNoise("pol:" + i + ":" + category + ":" + region);
      const likelihood = clamp01(0.15 + 0.85 * n());
      const impact = clamp01(0.15 + 0.85 * n());
      const complexity = clamp01(0.15 + 0.85 * n());

      return {
        id: "POL-" + String(100 + i),
        category,
        region,
        horizon: pick(horizon),
        affected: pick(impacts),
        likelihood: round(likelihood),
        impact: round(impact),
        complexity: round(complexity),
        summary: `Proposed update in ${category.toLowerCase()} with implications for ${pick(impacts).toLowerCase()}.`,
      };
    });

    return items;
  }

  window.LILLYiData = {
    generateAll() {
      const asOf = new Date();
      const geo = generateGeo();
      const diseases = generateDiseases();
      const competition = generateCompetition();
      const policy = generatePolicy();

      // State‑wise disease prevalence so we can answer:
      // "In this state, which diseases are prevalent and which medicine is linked?"
      const geoDisease = [];
      US_STATES.forEach((state) => {
        DISEASES.forEach((d) => {
          const noise = seededNoise("geoDisease:" + state + ":" + d.name);
          const prevalenceIndex = clamp01(0.2 + 0.8 * noise());
          const prod = PRODUCTS.find((p) => p.disease === d.name);
          geoDisease.push({
            state,
            disease: d.name,
            area: d.area,
            prevalenceIndex: round(prevalenceIndex),
            product: prod ? prod.product : "LILLY Direct therapy (demo)",
          });
        });
      });

      // Synthetic state‑level signals mirroring the source‑data slide
      const stateSignals = geo.map((g) => {
        const noise = seededNoise("stateSignals:" + g.state);
        const salesRevenue = round(20 + 180 * noise(), 1); // in millions
        const consultConversion = clamp01(0.25 + 0.5 * noise());
        const iqviaPrevIndex = clamp01(0.3 + 0.6 * noise());
        const lillyShare = clamp01(0.2 + 0.5 * noise());
        return {
          state: g.state,
          salesRevenue,          // SALES_TRANSACTIONS: revenue by state
          consultConversion,     // CONSULTS: conversion rate by region
          iqviaPrevIndex,        // IQVIA synthetic prevalence index proxy
          lillyShare,            // IQVIA / SALES: LILLY Direct share proxy
        };
      });

      return { asOf, geo, diseases, competition, policy, geoDisease, products: PRODUCTS, stateSignals };
    },
  };
})();

