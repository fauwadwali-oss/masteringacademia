'use client';
import React, { useState, useCallback, useMemo } from 'react';

// ============================================
// Types
// ============================================

type CertaintyLevel = 'high' | 'moderate' | 'low' | 'very_low';
type ConcernLevel = 'none' | 'serious' | 'very_serious';
type UpgradeLevel = 'none' | 'upgrade_1' | 'upgrade_2';
type StudyDesign = 'rct' | 'observational';

interface OutcomeData {
  id: string;
  name: string;
  importance: 'critical' | 'important' | 'not_important';

  // Study info
  studyDesign: StudyDesign;
  numberOfStudies: number;
  totalParticipants: number;

  // Effect data (from meta-analysis)
  effectMeasure: string; // e.g., "RR", "MD", "SMD"
  effectEstimate: number;
  ciLower: number;
  ciUpper: number;

  // Absolute effects (for binary outcomes)
  baselineRisk?: number; // per 1000
  absoluteEffectIntervention?: number;
  absoluteEffectControl?: number;

  // Heterogeneity (from meta-analysis)
  i2?: number;

  // Domains
  riskOfBias: {
    level: ConcernLevel;
    reason: string;
  };
  inconsistency: {
    level: ConcernLevel;
    reason: string;
  };
  indirectness: {
    level: ConcernLevel;
    reason: string;
  };
  imprecision: {
    level: ConcernLevel;
    reason: string;
  };
  publicationBias: {
    level: ConcernLevel;
    reason: string;
  };

  // Upgrades (observational only)
  largeEffect: UpgradeLevel;
  doseResponse: UpgradeLevel;
  plausibleConfounding: UpgradeLevel;

  // Overall
  overallCertainty: CertaintyLevel;
  footnotes: string[];
}

interface GRADESession {
  id: string;
  name: string;
  reviewQuestion: string;
  outcomes: OutcomeData[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Constants
// ============================================

const CERTAINTY_COLORS: Record<CertaintyLevel, { bg: string; text: string; symbol: string }> = {
  high: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', symbol: '⊕⊕⊕⊕' },
  moderate: { bg: 'bg-blue-500/20', text: 'text-blue-400', symbol: '⊕⊕⊕○' },
  low: { bg: 'bg-amber-500/20', text: 'text-amber-400', symbol: '⊕⊕○○' },
  very_low: { bg: 'bg-red-500/20', text: 'text-red-400', symbol: '⊕○○○' },
};

const CERTAINTY_LABELS: Record<CertaintyLevel, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  very_low: 'Very Low',
};

const CONCERN_LABELS: Record<ConcernLevel, string> = {
  none: 'Not serious',
  serious: 'Serious',
  very_serious: 'Very serious',
};

const DOMAIN_DESCRIPTIONS = {
  riskOfBias: 'Limitations in study design or execution (from ROB assessments)',
  inconsistency: 'Unexplained heterogeneity across studies (I², direction of effects)',
  indirectness: 'Differences in population, intervention, comparator, or outcomes',
  imprecision: 'Wide confidence intervals, small sample size, few events',
  publicationBias: 'Selective publication of studies (funnel plot asymmetry)',
};

// ============================================
// GRADE Calculation
// ============================================

const calculateCertainty = (outcome: OutcomeData): CertaintyLevel => {
  // Starting point
  let score = outcome.studyDesign === 'rct' ? 4 : 2; // High=4, Low=2

  // Downgrade for concerns
  const domains = ['riskOfBias', 'inconsistency', 'indirectness', 'imprecision', 'publicationBias'] as const;

  for (const domain of domains) {
    const level = outcome[domain].level;
    if (level === 'serious') score -= 1;
    if (level === 'very_serious') score -= 2;
  }

  // Upgrade for observational (only if starting from observational)
  if (outcome.studyDesign === 'observational') {
    if (outcome.largeEffect === 'upgrade_1') score += 1;
    if (outcome.largeEffect === 'upgrade_2') score += 2;
    if (outcome.doseResponse === 'upgrade_1') score += 1;
    if (outcome.plausibleConfounding === 'upgrade_1') score += 1;
  }

  // Clamp to valid range
  score = Math.max(1, Math.min(4, score));

  if (score >= 4) return 'high';
  if (score === 3) return 'moderate';
  if (score === 2) return 'low';
  return 'very_low';
};

// Auto-assess imprecision based on CI and sample size
const assessImprecision = (outcome: OutcomeData): ConcernLevel => {
  const ciWidth = outcome.ciUpper - outcome.ciLower;
  const effectMagnitude = Math.abs(outcome.effectEstimate);

  // For ratio measures (RR, OR, HR)
  if (['RR', 'OR', 'HR'].includes(outcome.effectMeasure)) {
    // Check if CI crosses 1 (null) and includes appreciable benefit/harm
    const crossesNull = outcome.ciLower < 1 && outcome.ciUpper > 1;
    const crossesBenefit = outcome.ciLower < 0.75; // 25% reduction threshold
    const crossesHarm = outcome.ciUpper > 1.25; // 25% increase threshold

    if (crossesNull && (crossesBenefit || crossesHarm)) return 'very_serious';
    if (crossesNull) return 'serious';
  }

  // For continuous measures
  if (['MD', 'SMD'].includes(outcome.effectMeasure)) {
    // Check if CI crosses 0 and is wide
    const crossesNull = outcome.ciLower < 0 && outcome.ciUpper > 0;
    if (crossesNull && ciWidth > effectMagnitude * 2) return 'very_serious';
    if (crossesNull) return 'serious';
  }

  // Sample size considerations
  if (outcome.totalParticipants < 100) return 'very_serious';
  if (outcome.totalParticipants < 300) return 'serious';

  return 'none';
};

// Auto-assess inconsistency based on I²
const assessInconsistency = (outcome: OutcomeData): ConcernLevel => {
  if (outcome.numberOfStudies === 1) return 'none'; // Can't assess with 1 study
  if (!outcome.i2) return 'none';

  if (outcome.i2 >= 75) return 'very_serious';
  if (outcome.i2 >= 50) return 'serious';
  return 'none';
};

// ============================================
// Main Component
// ============================================

const GRADEEvidenceTool: React.FC = () => {
  // State
  const [session, setSession] = useState<GRADESession | null>(null);
  const [currentOutcomeIndex, setCurrentOutcomeIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'assess' | 'table' | 'export'>('assess');
  const [showNewOutcomeModal, setShowNewOutcomeModal] = useState(false);

  // New outcome form state
  const [newOutcome, setNewOutcome] = useState<Partial<OutcomeData>>({
    importance: 'important',
    studyDesign: 'rct',
    effectMeasure: 'RR',
  });

  const currentOutcome = session?.outcomes[currentOutcomeIndex];

  // Create new session
  const createSession = (name: string, question: string) => {
    const newSession: GRADESession = {
      id: 'grade_' + Math.random().toString(36).substring(2, 15),
      name,
      reviewQuestion: question,
      outcomes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSession(newSession);
    localStorage.setItem(`grade_${newSession.id}`, JSON.stringify(newSession));
  };

  // Add outcome
  const addOutcome = useCallback(() => {
    if (!session || !newOutcome.name) return;

    const outcome: OutcomeData = {
      id: 'outcome_' + Math.random().toString(36).substring(2, 9),
      name: newOutcome.name || 'Untitled Outcome',
      importance: newOutcome.importance || 'important',
      studyDesign: newOutcome.studyDesign || 'rct',
      numberOfStudies: newOutcome.numberOfStudies || 0,
      totalParticipants: newOutcome.totalParticipants || 0,
      effectMeasure: newOutcome.effectMeasure || 'RR',
      effectEstimate: newOutcome.effectEstimate || 1,
      ciLower: newOutcome.ciLower || 0.5,
      ciUpper: newOutcome.ciUpper || 2,
      i2: newOutcome.i2,
      riskOfBias: { level: 'none', reason: '' },
      inconsistency: { level: assessInconsistency(newOutcome as OutcomeData), reason: '' },
      indirectness: { level: 'none', reason: '' },
      imprecision: { level: assessImprecision(newOutcome as OutcomeData), reason: '' },
      publicationBias: { level: 'none', reason: '' },
      largeEffect: 'none',
      doseResponse: 'none',
      plausibleConfounding: 'none',
      overallCertainty: 'high',
      footnotes: [],
    };

    // Calculate initial certainty
    outcome.overallCertainty = calculateCertainty(outcome);

    const updatedSession = {
      ...session,
      outcomes: [...session.outcomes, outcome],
      updatedAt: new Date().toISOString(),
    };

    setSession(updatedSession);
    setCurrentOutcomeIndex(updatedSession.outcomes.length - 1);
    localStorage.setItem(`grade_${session.id}`, JSON.stringify(updatedSession));

    setShowNewOutcomeModal(false);
    setNewOutcome({ importance: 'important', studyDesign: 'rct', effectMeasure: 'RR' });
  }, [session, newOutcome]);

  // Update outcome
  const updateOutcome = useCallback((field: keyof OutcomeData, value: any) => {
    if (!session || !currentOutcome) return;

    const updatedOutcome = { ...currentOutcome, [field]: value };

    // Recalculate certainty
    updatedOutcome.overallCertainty = calculateCertainty(updatedOutcome);

    const updatedOutcomes = [...session.outcomes];
    updatedOutcomes[currentOutcomeIndex] = updatedOutcome;

    const updatedSession = {
      ...session,
      outcomes: updatedOutcomes,
      updatedAt: new Date().toISOString(),
    };

    setSession(updatedSession);
    localStorage.setItem(`grade_${session.id}`, JSON.stringify(updatedSession));
  }, [session, currentOutcome, currentOutcomeIndex]);

  // Update domain
  const updateDomain = useCallback((
    domain: 'riskOfBias' | 'inconsistency' | 'indirectness' | 'imprecision' | 'publicationBias',
    field: 'level' | 'reason',
    value: any
  ) => {
    if (!currentOutcome) return;

    const updatedDomain = { ...currentOutcome[domain], [field]: value };
    updateOutcome(domain, updatedDomain);
  }, [currentOutcome, updateOutcome]);

  // Generate footnotes
  const generateFootnotes = useCallback(() => {
    if (!currentOutcome) return [];

    const footnotes: string[] = [];
    const domains = [
      { key: 'riskOfBias', label: 'Risk of bias' },
      { key: 'inconsistency', label: 'Inconsistency' },
      { key: 'indirectness', label: 'Indirectness' },
      { key: 'imprecision', label: 'Imprecision' },
      { key: 'publicationBias', label: 'Publication bias' },
    ] as const;

    for (const domain of domains) {
      const d = currentOutcome[domain.key];
      if (d.level !== 'none' && d.reason) {
        footnotes.push(`${domain.label}: ${d.reason}`);
      }
    }

    return footnotes;
  }, [currentOutcome]);

  // Export Summary of Findings table as HTML
  const exportSoFTable = () => {
    if (!session) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Summary of Findings - ${session.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { font-size: 18px; }
    h2 { font-size: 14px; color: #666; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .certainty-high { background: #d1fae5; }
    .certainty-moderate { background: #dbeafe; }
    .certainty-low { background: #fef3c7; }
    .certainty-very_low { background: #fee2e2; }
    .footnotes { margin-top: 20px; font-size: 11px; }
    .footnotes p { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Summary of Findings Table</h1>
  <h2>${session.reviewQuestion}</h2>
  
  <table>
    <thead>
      <tr>
        <th rowspan="2">Outcomes</th>
        <th colspan="2">Anticipated absolute effects* (95% CI)</th>
        <th rowspan="2">Relative effect<br>(95% CI)</th>
        <th rowspan="2">№ of participants<br>(studies)</th>
        <th rowspan="2">Certainty of evidence<br>(GRADE)</th>
        <th rowspan="2">Comments</th>
      </tr>
      <tr>
        <th>Risk with control</th>
        <th>Risk with intervention</th>
      </tr>
    </thead>
    <tbody>
      ${session.outcomes.map((o, idx) => `
        <tr>
          <td>
            <strong>${o.name}</strong>
            ${o.importance === 'critical' ? '<br><em>(critical)</em>' : ''}
          </td>
          <td>${o.absoluteEffectControl ? `${o.absoluteEffectControl} per 1,000` : '-'}</td>
          <td>${o.absoluteEffectIntervention ? `${o.absoluteEffectIntervention} per 1,000` : '-'}</td>
          <td>${o.effectMeasure} ${o.effectEstimate.toFixed(2)}<br>(${o.ciLower.toFixed(2)} to ${o.ciUpper.toFixed(2)})</td>
          <td>${o.totalParticipants}<br>(${o.numberOfStudies} ${o.studyDesign === 'rct' ? 'RCTs' : 'observational'})</td>
          <td class="certainty-${o.overallCertainty}">
            ${CERTAINTY_COLORS[o.overallCertainty].symbol}<br>
            ${CERTAINTY_LABELS[o.overallCertainty]}
          </td>
          <td>${generateOutcomeFootnotes(o).map((f, i) => `<sup>${i + 1}</sup>`).join('')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footnotes">
    <p><strong>GRADE Working Group grades of evidence</strong></p>
    <p><strong>High certainty:</strong> We are very confident that the true effect lies close to that of the estimate of the effect.</p>
    <p><strong>Moderate certainty:</strong> We are moderately confident in the effect estimate: the true effect is likely to be close to the estimate of the effect, but there is a possibility that it is substantially different.</p>
    <p><strong>Low certainty:</strong> Our confidence in the effect estimate is limited: the true effect may be substantially different from the estimate of the effect.</p>
    <p><strong>Very low certainty:</strong> We have very little confidence in the effect estimate: the true effect is likely to be substantially different from the estimate of effect.</p>
    
    <hr style="margin: 20px 0;">
    
    <p><strong>Explanations</strong></p>
    ${session.outcomes.map((o, idx) => {
      const footnotes = generateOutcomeFootnotes(o);
      if (footnotes.length === 0) return '';
      return `<p><strong>${o.name}:</strong> ${footnotes.map((f, i) => `<sup>${i + 1}</sup>${f}`).join('; ')}</p>`;
    }).join('')}
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SoF_${session.name.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateOutcomeFootnotes = (outcome: OutcomeData): string[] => {
    const footnotes: string[] = [];
    const domains = [
      { key: 'riskOfBias', label: 'Risk of bias' },
      { key: 'inconsistency', label: 'Inconsistency' },
      { key: 'indirectness', label: 'Indirectness' },
      { key: 'imprecision', label: 'Imprecision' },
      { key: 'publicationBias', label: 'Publication bias' },
    ] as const;

    for (const domain of domains) {
      const d = outcome[domain.key];
      if (d.level !== 'none') {
        footnotes.push(`Downgraded for ${d.level} ${domain.label.toLowerCase()}${d.reason ? `: ${d.reason}` : ''}`);
      }
    }

    return footnotes;
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!session) return;

    const headers = [
      'Outcome', 'Importance', 'Design', 'Studies', 'Participants',
      'Effect Measure', 'Effect', 'CI Lower', 'CI Upper', 'I²',
      'Risk of Bias', 'ROB Reason', 'Inconsistency', 'Inconsistency Reason',
      'Indirectness', 'Indirectness Reason', 'Imprecision', 'Imprecision Reason',
      'Publication Bias', 'Pub Bias Reason', 'Certainty'
    ];

    const rows = session.outcomes.map(o => [
      `"${o.name}"`,
      o.importance,
      o.studyDesign,
      o.numberOfStudies,
      o.totalParticipants,
      o.effectMeasure,
      o.effectEstimate,
      o.ciLower,
      o.ciUpper,
      o.i2 || '',
      o.riskOfBias.level,
      `"${o.riskOfBias.reason}"`,
      o.inconsistency.level,
      `"${o.inconsistency.reason}"`,
      o.indirectness.level,
      `"${o.indirectness.reason}"`,
      o.imprecision.level,
      `"${o.imprecision.reason}"`,
      o.publicationBias.level,
      `"${o.publicationBias.reason}"`,
      o.overallCertainty,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GRADE_${session.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render domain assessment row
  const renderDomainRow = (
    domain: 'riskOfBias' | 'inconsistency' | 'indirectness' | 'imprecision' | 'publicationBias',
    label: string
  ) => {
    if (!currentOutcome) return null;
    const d = currentOutcome[domain];

    return (
      <div className="p-4 bg-slate-900/30 rounded-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-white font-medium">{label}</h4>
            <p className="text-xs text-slate-500 mt-1">{DOMAIN_DESCRIPTIONS[domain]}</p>
          </div>
          <div className="flex gap-2">
            {(['none', 'serious', 'very_serious'] as ConcernLevel[]).map(level => (
              <button
                key={level}
                onClick={() => updateDomain(domain, 'level', level)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${d.level === level
                  ? level === 'none'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : level === 'serious'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
              >
                {CONCERN_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {d.level !== 'none' && (
          <textarea
            value={d.reason}
            onChange={(e) => updateDomain(domain, 'reason', e.target.value)}
            placeholder="Explain the reason for downgrading..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
          />
        )}
      </div>
    );
  };

  // Summary of Findings table view
  const renderSoFTable = () => {
    if (!session) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left p-3 font-medium" rowSpan={2}>Outcomes</th>
              <th className="text-center p-3 font-medium" colSpan={2}>Absolute effects (95% CI)</th>
              <th className="text-center p-3 font-medium" rowSpan={2}>Relative effect<br />(95% CI)</th>
              <th className="text-center p-3 font-medium" rowSpan={2}>Participants<br />(studies)</th>
              <th className="text-center p-3 font-medium" rowSpan={2}>Certainty</th>
            </tr>
            <tr className="text-slate-500 text-xs border-b border-slate-700">
              <th className="p-2">Control</th>
              <th className="p-2">Intervention</th>
            </tr>
          </thead>
          <tbody>
            {session.outcomes.map((outcome, idx) => (
              <tr key={outcome.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td className="p-3">
                  <div className="font-medium text-white">{outcome.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {outcome.importance === 'critical' && <span className="text-red-400">Critical</span>}
                    {outcome.importance === 'important' && <span className="text-amber-400">Important</span>}
                  </div>
                </td>
                <td className="p-3 text-center text-slate-300">
                  {outcome.absoluteEffectControl ? `${outcome.absoluteEffectControl}/1000` : '-'}
                </td>
                <td className="p-3 text-center text-slate-300">
                  {outcome.absoluteEffectIntervention ? `${outcome.absoluteEffectIntervention}/1000` : '-'}
                </td>
                <td className="p-3 text-center text-slate-300">
                  <div>{outcome.effectMeasure} {outcome.effectEstimate.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">
                    ({outcome.ciLower.toFixed(2)} to {outcome.ciUpper.toFixed(2)})
                  </div>
                </td>
                <td className="p-3 text-center text-slate-300">
                  <div>{outcome.totalParticipants}</div>
                  <div className="text-xs text-slate-500">
                    ({outcome.numberOfStudies} {outcome.studyDesign === 'rct' ? 'RCTs' : 'obs'})
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${CERTAINTY_COLORS[outcome.overallCertainty].bg}`}>
                    <span className="text-lg">{CERTAINTY_COLORS[outcome.overallCertainty].symbol}</span>
                    <span className={`text-sm font-medium ${CERTAINTY_COLORS[outcome.overallCertainty].text}`}>
                      {CERTAINTY_LABELS[outcome.overallCertainty]}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footnotes */}
        <div className="mt-6 p-4 bg-slate-900/30 rounded-lg">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Explanatory Footnotes</h4>
          {session.outcomes.map((outcome, idx) => {
            const footnotes = generateOutcomeFootnotes(outcome);
            if (footnotes.length === 0) return null;
            return (
              <div key={outcome.id} className="mb-2">
                <span className="text-slate-400 text-sm font-medium">{outcome.name}:</span>
                <span className="text-slate-500 text-sm ml-2">{footnotes.join('; ')}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/mph" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MS</span>
              </div>
              <span className="text-white font-semibold">Homepage</span>
            </a>
            <span className="text-slate-500">/</span>
            <span className="text-cyan-400">GRADE Evidence</span>
          </div>
          <a href="/mph" className="text-slate-400 hover:text-white text-sm">
            ← All Tools
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* No session - Setup */}
        {!session && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">GRADE Evidence Tables</h1>
              <p className="text-slate-400">
                Create Summary of Findings tables using the GRADE approach
              </p>
            </div>

            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Review Name
                  </label>
                  <input
                    type="text"
                    id="session-name"
                    placeholder="e.g., Interventions for chronic pain"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Review Question (PICO)
                  </label>
                  <textarea
                    id="session-question"
                    placeholder="e.g., In adults with chronic low back pain (P), does exercise therapy (I) compared to usual care (C) reduce pain intensity (O)?"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
                <button
                  onClick={() => {
                    const name = (document.getElementById('session-name') as HTMLInputElement)?.value;
                    const question = (document.getElementById('session-question') as HTMLTextAreaElement)?.value;
                    if (name) createSession(name, question || '');
                  }}
                  className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium"
                >
                  Create GRADE Table
                </button>
              </div>
            </div>

            {/* GRADE explanation */}
            <div className="mt-8 p-4 bg-slate-800/20 rounded-lg">
              <h3 className="text-sm font-medium text-slate-300 mb-2">About GRADE</h3>
              <p className="text-xs text-slate-500">
                GRADE (Grading of Recommendations Assessment, Development and Evaluation) is a systematic approach
                for rating the certainty of evidence. It assesses five domains: risk of bias, inconsistency,
                indirectness, imprecision, and publication bias. Evidence from RCTs starts at "high" certainty
                and can be downgraded, while observational evidence starts at "low" and can be upgraded.
              </p>
            </div>
          </div>
        )}

        {/* Active session */}
        {session && (
          <>
            {/* Session header */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-white">{session.name}</h2>
                  {session.reviewQuestion && (
                    <p className="text-sm text-slate-400 mt-1">{session.reviewQuestion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {session.outcomes.length} outcomes
                  </span>
                </div>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('assess')}
                  className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'assess' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                >
                  Assess
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'table' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                >
                  SoF Table
                </button>
                <button
                  onClick={() => setViewMode('export')}
                  className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'export' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                >
                  Export
                </button>
              </div>

              <button
                onClick={() => setShowNewOutcomeModal(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm"
              >
                + Add Outcome
              </button>
            </div>

            {/* Assessment view */}
            {viewMode === 'assess' && (
              <div className="flex gap-6">
                {/* Outcome sidebar */}
                <div className="w-64 flex-shrink-0">
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 sticky top-20">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Outcomes</h3>
                    <div className="space-y-2">
                      {session.outcomes.map((outcome, idx) => (
                        <button
                          key={outcome.id}
                          onClick={() => setCurrentOutcomeIndex(idx)}
                          className={`w-full p-3 text-left rounded-lg transition-all ${idx === currentOutcomeIndex
                            ? 'bg-cyan-500/20 border border-cyan-500/50'
                            : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm truncate ${idx === currentOutcomeIndex ? 'text-white' : 'text-slate-300'}`}>
                              {outcome.name}
                            </span>
                            <span className={`text-xs ${CERTAINTY_COLORS[outcome.overallCertainty].text}`}>
                              {CERTAINTY_COLORS[outcome.overallCertainty].symbol}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {session.outcomes.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No outcomes yet. Add your first outcome to begin.
                      </p>
                    )}
                  </div>
                </div>

                {/* Main assessment area */}
                <div className="flex-1 min-w-0">
                  {currentOutcome ? (
                    <div className="space-y-6">
                      {/* Outcome header */}
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-white">{currentOutcome.name}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                              <span>{currentOutcome.numberOfStudies} studies</span>
                              <span>{currentOutcome.totalParticipants} participants</span>
                              <span>{currentOutcome.studyDesign === 'rct' ? 'RCTs' : 'Observational'}</span>
                              <span>
                                {currentOutcome.effectMeasure} {currentOutcome.effectEstimate.toFixed(2)}
                                ({currentOutcome.ciLower.toFixed(2)}-{currentOutcome.ciUpper.toFixed(2)})
                              </span>
                              {currentOutcome.i2 !== undefined && <span>I²={currentOutcome.i2}%</span>}
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-lg ${CERTAINTY_COLORS[currentOutcome.overallCertainty].bg}`}>
                            <div className="text-lg">{CERTAINTY_COLORS[currentOutcome.overallCertainty].symbol}</div>
                            <div className={`text-sm font-medium ${CERTAINTY_COLORS[currentOutcome.overallCertainty].text}`}>
                              {CERTAINTY_LABELS[currentOutcome.overallCertainty]}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Starting point */}
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-medium">Starting Certainty</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              RCTs start at High, Observational studies start at Low
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateOutcome('studyDesign', 'rct')}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${currentOutcome.studyDesign === 'rct'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                : 'bg-slate-800 text-slate-400 border border-slate-600'
                                }`}
                            >
                              RCT (High)
                            </button>
                            <button
                              onClick={() => updateOutcome('studyDesign', 'observational')}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${currentOutcome.studyDesign === 'observational'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                                : 'bg-slate-800 text-slate-400 border border-slate-600'
                                }`}
                            >
                              Observational (Low)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Downgrade domains */}
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                        <h4 className="text-white font-medium mb-4">Factors that may decrease certainty</h4>
                        <div className="space-y-4">
                          {renderDomainRow('riskOfBias', 'Risk of Bias')}
                          {renderDomainRow('inconsistency', 'Inconsistency')}
                          {renderDomainRow('indirectness', 'Indirectness')}
                          {renderDomainRow('imprecision', 'Imprecision')}
                          {renderDomainRow('publicationBias', 'Publication Bias')}
                        </div>
                      </div>

                      {/* Upgrade factors (observational only) */}
                      {currentOutcome.studyDesign === 'observational' && (
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                          <h4 className="text-white font-medium mb-4">Factors that may increase certainty (observational only)</h4>
                          <div className="space-y-4">
                            {/* Large effect */}
                            <div className="p-4 bg-slate-900/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-white font-medium">Large Effect</h5>
                                  <p className="text-xs text-slate-500 mt-1">RR &gt;2 or &lt;0.5 (upgrade 1), RR &gt;5 or &lt;0.2 (upgrade 2)</p>
                                </div>
                                <div className="flex gap-2">
                                  {(['none', 'upgrade_1', 'upgrade_2'] as UpgradeLevel[]).map(level => (
                                    <button
                                      key={level}
                                      onClick={() => updateOutcome('largeEffect', level)}
                                      className={`px-3 py-1 rounded text-xs font-medium ${currentOutcome.largeEffect === level
                                        ? level === 'none'
                                          ? 'bg-slate-600 text-slate-300'
                                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                        : 'bg-slate-800 text-slate-400 border border-slate-600'
                                        }`}
                                    >
                                      {level === 'none' ? 'None' : level === 'upgrade_1' ? '+1' : '+2'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Dose-response */}
                            <div className="p-4 bg-slate-900/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-white font-medium">Dose-Response Gradient</h5>
                                  <p className="text-xs text-slate-500 mt-1">Evidence of a dose-response relationship</p>
                                </div>
                                <div className="flex gap-2">
                                  {(['none', 'upgrade_1'] as UpgradeLevel[]).map(level => (
                                    <button
                                      key={level}
                                      onClick={() => updateOutcome('doseResponse', level)}
                                      className={`px-3 py-1 rounded text-xs font-medium ${currentOutcome.doseResponse === level
                                        ? level === 'none'
                                          ? 'bg-slate-600 text-slate-300'
                                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                        : 'bg-slate-800 text-slate-400 border border-slate-600'
                                        }`}
                                    >
                                      {level === 'none' ? 'None' : '+1'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Plausible confounding */}
                            <div className="p-4 bg-slate-900/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-white font-medium">Plausible Confounding</h5>
                                  <p className="text-xs text-slate-500 mt-1">Residual confounding would reduce the effect</p>
                                </div>
                                <div className="flex gap-2">
                                  {(['none', 'upgrade_1'] as UpgradeLevel[]).map(level => (
                                    <button
                                      key={level}
                                      onClick={() => updateOutcome('plausibleConfounding', level)}
                                      className={`px-3 py-1 rounded text-xs font-medium ${currentOutcome.plausibleConfounding === level
                                        ? level === 'none'
                                          ? 'bg-slate-600 text-slate-300'
                                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                        : 'bg-slate-800 text-slate-400 border border-slate-600'
                                        }`}
                                    >
                                      {level === 'none' ? 'None' : '+1'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                      <p className="text-slate-400">
                        Add an outcome to begin GRADE assessment
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SoF Table view */}
            {viewMode === 'table' && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-medium text-white mb-4">Summary of Findings Table</h3>
                {session.outcomes.length > 0 ? (
                  renderSoFTable()
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    Add outcomes to generate the Summary of Findings table
                  </p>
                )}
              </div>
            )}

            {/* Export view */}
            {viewMode === 'export' && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Export Options</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={exportSoFTable}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-600 hover:border-cyan-500 transition-colors text-left"
                  >
                    <div className="text-white font-medium">Summary of Findings (HTML)</div>
                    <p className="text-sm text-slate-400 mt-1">
                      Publication-ready table with explanatory footnotes
                    </p>
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-600 hover:border-cyan-500 transition-colors text-left"
                  >
                    <div className="text-white font-medium">GRADE Data (CSV)</div>
                    <p className="text-sm text-slate-400 mt-1">
                      All domains and ratings for analysis
                    </p>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* New outcome modal */}
        {showNewOutcomeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-white mb-4">Add Outcome</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Outcome Name *
                  </label>
                  <input
                    type="text"
                    value={newOutcome.name || ''}
                    onChange={(e) => setNewOutcome(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Pain intensity at 12 weeks"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Importance
                    </label>
                    <select
                      value={newOutcome.importance}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, importance: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="critical">Critical</option>
                      <option value="important">Important</option>
                      <option value="not_important">Not important</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Study Design
                    </label>
                    <select
                      value={newOutcome.studyDesign}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, studyDesign: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="rct">RCT</option>
                      <option value="observational">Observational</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Number of Studies
                    </label>
                    <input
                      type="number"
                      value={newOutcome.numberOfStudies || ''}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, numberOfStudies: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Participants
                    </label>
                    <input
                      type="number"
                      value={newOutcome.totalParticipants || ''}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, totalParticipants: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Effect Measure
                  </label>
                  <select
                    value={newOutcome.effectMeasure}
                    onChange={(e) => setNewOutcome(prev => ({ ...prev, effectMeasure: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="RR">Risk Ratio (RR)</option>
                    <option value="OR">Odds Ratio (OR)</option>
                    <option value="HR">Hazard Ratio (HR)</option>
                    <option value="MD">Mean Difference (MD)</option>
                    <option value="SMD">Standardized Mean Difference (SMD)</option>
                    <option value="RD">Risk Difference (RD)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Effect Estimate
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newOutcome.effectEstimate ?? ''}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, effectEstimate: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      95% CI Lower
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newOutcome.ciLower ?? ''}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, ciLower: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      95% CI Upper
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newOutcome.ciUpper ?? ''}
                      onChange={(e) => setNewOutcome(prev => ({ ...prev, ciUpper: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    I² (%) - for auto-assessing inconsistency
                  </label>
                  <input
                    type="number"
                    value={newOutcome.i2 ?? ''}
                    onChange={(e) => setNewOutcome(prev => ({ ...prev, i2: parseFloat(e.target.value) }))}
                    placeholder="e.g., 45"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewOutcomeModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={addOutcome}
                  disabled={!newOutcome.name}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm"
                >
                  Add Outcome
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GRADEEvidenceTool;
