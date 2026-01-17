import React, { useState, useCallback, useEffect, useMemo } from 'react';

// ============================================
// Types
// ============================================

type RiskLevel = 'low' | 'some_concerns' | 'high' | 'unclear' | 'na';

interface Study {
  id: string;
  name: string;
  year?: number;
  design?: string;
}

interface DomainAssessment {
  judgment: RiskLevel;
  support: string;
  signaling?: Record<string, string>; // For ROB 2 signaling questions
}

interface StudyAssessment {
  studyId: string;
  tool: string;
  domains: Record<string, DomainAssessment>;
  overall: RiskLevel;
  notes?: string;
  assessedAt: string;
  assessedBy: string;
}

interface AssessmentSession {
  id: string;
  name: string;
  tool: string;
  studies: Study[];
  assessments: Record<string, StudyAssessment>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ROB 2 Configuration (RCTs)
// ============================================

const ROB2_DOMAINS = [
  {
    id: 'randomization',
    name: 'Randomization process',
    shortName: 'D1',
    description: 'Bias arising from the randomization process',
    signaling: [
      { id: '1.1', question: 'Was the allocation sequence random?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '1.2', question: 'Was the allocation sequence concealed until participants were enrolled?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '1.3', question: 'Did baseline differences suggest a problem with randomization?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
    ]
  },
  {
    id: 'deviations',
    name: 'Deviations from interventions',
    shortName: 'D2',
    description: 'Bias due to deviations from intended interventions',
    signaling: [
      { id: '2.1', question: 'Were participants aware of their assigned intervention?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '2.2', question: 'Were carers/people delivering aware of assigned intervention?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '2.3', question: 'Were there deviations from intended intervention beyond what would be expected?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '2.4', question: 'Were deviations likely to have affected the outcome?', options: ['Y', 'PY', 'PN', 'N', 'NI', 'NA'] },
      { id: '2.5', question: 'Was an appropriate analysis used to estimate the effect?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
    ]
  },
  {
    id: 'missing',
    name: 'Missing outcome data',
    shortName: 'D3',
    description: 'Bias due to missing outcome data',
    signaling: [
      { id: '3.1', question: 'Were data available for all or nearly all participants randomized?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '3.2', question: 'Is there evidence that result was not biased by missing data?', options: ['Y', 'PY', 'PN', 'N', 'NI', 'NA'] },
      { id: '3.3', question: 'Could missingness depend on true value of outcome?', options: ['Y', 'PY', 'PN', 'N', 'NI', 'NA'] },
    ]
  },
  {
    id: 'measurement',
    name: 'Measurement of outcome',
    shortName: 'D4',
    description: 'Bias in measurement of the outcome',
    signaling: [
      { id: '4.1', question: 'Was the method of measuring the outcome inappropriate?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '4.2', question: 'Could measurement or ascertainment have differed between groups?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '4.3', question: 'Were outcome assessors aware of intervention received?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '4.4', question: 'Could assessment have been influenced by knowledge of intervention?', options: ['Y', 'PY', 'PN', 'N', 'NI', 'NA'] },
    ]
  },
  {
    id: 'reporting',
    name: 'Selection of reported result',
    shortName: 'D5',
    description: 'Bias in selection of the reported result',
    signaling: [
      { id: '5.1', question: 'Were data analyzed in accordance with a pre-specified plan?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '5.2', question: 'Is the numerical result likely to have been selected from multiple outcomes?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: '5.3', question: 'Is the numerical result likely to have been selected from multiple analyses?', options: ['Y', 'PY', 'PN', 'N', 'NI'] },
    ]
  },
];

// ============================================
// ROBINS-I Configuration (Non-randomized)
// ============================================

const ROBINS_I_DOMAINS = [
  {
    id: 'confounding',
    name: 'Confounding',
    shortName: 'D1',
    description: 'Bias due to confounding',
  },
  {
    id: 'selection',
    name: 'Selection of participants',
    shortName: 'D2',
    description: 'Bias in selection of participants into the study',
  },
  {
    id: 'classification',
    name: 'Classification of interventions',
    shortName: 'D3',
    description: 'Bias in classification of interventions',
  },
  {
    id: 'deviations',
    name: 'Deviations from interventions',
    shortName: 'D4',
    description: 'Bias due to deviations from intended interventions',
  },
  {
    id: 'missing',
    name: 'Missing data',
    shortName: 'D5',
    description: 'Bias due to missing data',
  },
  {
    id: 'measurement',
    name: 'Measurement of outcomes',
    shortName: 'D6',
    description: 'Bias in measurement of outcomes',
  },
  {
    id: 'reporting',
    name: 'Selection of reported result',
    shortName: 'D7',
    description: 'Bias in selection of the reported result',
  },
];

// ============================================
// Newcastle-Ottawa Scale (Cohort)
// ============================================

const NOS_COHORT_DOMAINS = [
  {
    id: 'selection',
    name: 'Selection',
    shortName: 'S',
    description: 'Selection of study groups',
    items: [
      { id: 's1', name: 'Representativeness of exposed cohort', maxStars: 1, 
        options: ['Truly representative (★)', 'Somewhat representative (★)', 'Selected group', 'No description'] },
      { id: 's2', name: 'Selection of non-exposed cohort', maxStars: 1,
        options: ['Drawn from same community (★)', 'Drawn from different source', 'No description'] },
      { id: 's3', name: 'Ascertainment of exposure', maxStars: 1,
        options: ['Secure record (★)', 'Structured interview (★)', 'Written self-report', 'No description'] },
      { id: 's4', name: 'Outcome not present at start', maxStars: 1,
        options: ['Yes (★)', 'No'] },
    ]
  },
  {
    id: 'comparability',
    name: 'Comparability',
    shortName: 'C',
    description: 'Comparability of cohorts',
    items: [
      { id: 'c1', name: 'Comparability based on design/analysis', maxStars: 2,
        options: ['Controls for most important factor (★)', 'Controls for additional factor (★)', 'No control'] },
    ]
  },
  {
    id: 'outcome',
    name: 'Outcome',
    shortName: 'O',
    description: 'Assessment of outcome',
    items: [
      { id: 'o1', name: 'Assessment of outcome', maxStars: 1,
        options: ['Independent blind assessment (★)', 'Record linkage (★)', 'Self-report', 'No description'] },
      { id: 'o2', name: 'Follow-up long enough', maxStars: 1,
        options: ['Yes (★)', 'No'] },
      { id: 'o3', name: 'Adequacy of follow-up', maxStars: 1,
        options: ['Complete follow-up (★)', '>80% followed, described (★)', 'Follow-up <80%, no description', 'No statement'] },
    ]
  },
];

const NOS_CASE_CONTROL_DOMAINS = [
  {
    id: 'selection',
    name: 'Selection',
    shortName: 'S',
    description: 'Selection of cases and controls',
    items: [
      { id: 's1', name: 'Case definition adequate', maxStars: 1,
        options: ['Yes, independent validation (★)', 'Yes, record linkage (★)', 'No description'] },
      { id: 's2', name: 'Representativeness of cases', maxStars: 1,
        options: ['Consecutive or obviously representative (★)', 'Potential for selection bias', 'No description'] },
      { id: 's3', name: 'Selection of controls', maxStars: 1,
        options: ['Community controls (★)', 'Hospital controls', 'No description'] },
      { id: 's4', name: 'Definition of controls', maxStars: 1,
        options: ['No history of disease (★)', 'No description of source'] },
    ]
  },
  {
    id: 'comparability',
    name: 'Comparability',
    shortName: 'C',
    description: 'Comparability of cases and controls',
    items: [
      { id: 'c1', name: 'Comparability based on design/analysis', maxStars: 2,
        options: ['Controls for most important factor (★)', 'Controls for additional factor (★)', 'No control'] },
    ]
  },
  {
    id: 'exposure',
    name: 'Exposure',
    shortName: 'E',
    description: 'Ascertainment of exposure',
    items: [
      { id: 'e1', name: 'Ascertainment of exposure', maxStars: 1,
        options: ['Secure record (★)', 'Structured interview (★)', 'Written self-report', 'No description'] },
      { id: 'e2', name: 'Same method for cases/controls', maxStars: 1,
        options: ['Yes (★)', 'No'] },
      { id: 'e3', name: 'Non-response rate', maxStars: 1,
        options: ['Same rate for both groups (★)', 'Non-respondents described', 'Rate different, no designation'] },
    ]
  },
];

// ============================================
// Risk Level Colors & Labels
// ============================================

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' },
  some_concerns: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50' },
  high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  unclear: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50' },
  na: { bg: 'bg-slate-700/20', text: 'text-slate-500', border: 'border-slate-600/50' },
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk',
  some_concerns: 'Some concerns',
  high: 'High risk',
  unclear: 'Unclear',
  na: 'N/A',
};

// ============================================
// Main Component
// ============================================

const RiskOfBiasTool: React.FC = () => {
  // State
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('rob2');
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0);
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [assessmentData, setAssessmentData] = useState<Record<string, DomainAssessment>>({});
  const [overallRisk, setOverallRisk] = useState<RiskLevel>('unclear');
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'assess' | 'summary' | 'traffic'>('assess');
  const [nosVariant, setNosVariant] = useState<'cohort' | 'case_control'>('cohort');

  // Get current domains based on tool
  const domains = useMemo(() => {
    switch (selectedTool) {
      case 'rob2': return ROB2_DOMAINS;
      case 'robins_i': return ROBINS_I_DOMAINS;
      case 'nos': return nosVariant === 'cohort' ? NOS_COHORT_DOMAINS : NOS_CASE_CONTROL_DOMAINS;
      default: return [];
    }
  }, [selectedTool, nosVariant]);

  const currentStudy = session?.studies[currentStudyIndex];
  const currentDomain = domains[currentDomainIndex];
  const currentAssessment = session?.assessments[currentStudy?.id || ''];

  // Load existing assessment when study changes
  useEffect(() => {
    if (currentAssessment) {
      setAssessmentData(currentAssessment.domains);
      setOverallRisk(currentAssessment.overall);
      setNotes(currentAssessment.notes || '');
    } else {
      setAssessmentData({});
      setOverallRisk('unclear');
      setNotes('');
    }
    setCurrentDomainIndex(0);
  }, [currentStudyIndex, currentAssessment]);

  // File import handler
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let studies: Study[] = [];

      // Simple CSV parsing for study list
      const lines = text.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const nameIdx = headers.findIndex(h => h === 'study' || h === 'name' || h === 'title');
      const yearIdx = headers.findIndex(h => h === 'year');

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values[nameIdx]) {
          studies.push({
            id: `study_${i}`,
            name: values[nameIdx],
            year: yearIdx >= 0 ? parseInt(values[yearIdx]) : undefined,
          });
        }
      }

      if (studies.length === 0) {
        throw new Error('No studies found');
      }

      const newSession: AssessmentSession = {
        id: 'rob_' + Math.random().toString(36).substring(2, 15),
        name: file.name.replace(/\.csv$/i, ''),
        tool: selectedTool,
        studies,
        assessments: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSession(newSession);
      setCurrentStudyIndex(0);
      localStorage.setItem(`rob_${newSession.id}`, JSON.stringify(newSession));
    } catch (err) {
      console.error('Import error:', err);
    }
  };

  // Save current assessment
  const saveAssessment = useCallback(() => {
    if (!session || !currentStudy) return;

    const assessment: StudyAssessment = {
      studyId: currentStudy.id,
      tool: selectedTool,
      domains: assessmentData,
      overall: overallRisk,
      notes,
      assessedAt: new Date().toISOString(),
      assessedBy: 'user',
    };

    const updatedSession = {
      ...session,
      assessments: {
        ...session.assessments,
        [currentStudy.id]: assessment,
      },
      updatedAt: new Date().toISOString(),
    };

    setSession(updatedSession);
    localStorage.setItem(`rob_${session.id}`, JSON.stringify(updatedSession));
  }, [session, currentStudy, selectedTool, assessmentData, overallRisk, notes]);

  // Domain judgment handler
  const handleDomainJudgment = (domainId: string, judgment: RiskLevel, support: string = '') => {
    setAssessmentData(prev => ({
      ...prev,
      [domainId]: {
        ...prev[domainId],
        judgment,
        support: support || prev[domainId]?.support || '',
      }
    }));
  };

  // Support text handler
  const handleSupportText = (domainId: string, support: string) => {
    setAssessmentData(prev => ({
      ...prev,
      [domainId]: {
        ...prev[domainId],
        support,
        judgment: prev[domainId]?.judgment || 'unclear',
      }
    }));
  };

  // Navigation
  const goToNextDomain = () => {
    if (currentDomainIndex < domains.length - 1) {
      setCurrentDomainIndex(prev => prev + 1);
    }
  };

  const goToPrevDomain = () => {
    if (currentDomainIndex > 0) {
      setCurrentDomainIndex(prev => prev - 1);
    }
  };

  const goToNextStudy = () => {
    if (session && currentStudyIndex < session.studies.length - 1) {
      saveAssessment();
      setCurrentStudyIndex(prev => prev + 1);
    }
  };

  // Calculate overall risk (algorithm based on tool)
  const calculateOverallRisk = useCallback((): RiskLevel => {
    const domainJudgments = domains.map(d => assessmentData[d.id]?.judgment || 'unclear');
    
    if (domainJudgments.some(j => j === 'high')) return 'high';
    if (domainJudgments.some(j => j === 'some_concerns')) return 'some_concerns';
    if (domainJudgments.every(j => j === 'low')) return 'low';
    return 'unclear';
  }, [domains, assessmentData]);

  // Auto-calculate overall when domains change
  useEffect(() => {
    const calculated = calculateOverallRisk();
    setOverallRisk(calculated);
  }, [calculateOverallRisk]);

  // Export to CSV
  const exportToCSV = () => {
    if (!session) return;

    const headers = ['study', 'tool', ...domains.map(d => d.id), ...domains.map(d => `${d.id}_support`), 'overall', 'notes'];
    
    const rows = session.studies.map(study => {
      const assessment = session.assessments[study.id];
      if (!assessment) {
        return [study.name, selectedTool, ...domains.map(() => ''), ...domains.map(() => ''), '', ''].join(',');
      }
      
      return [
        escapeCSV(study.name),
        selectedTool,
        ...domains.map(d => assessment.domains[d.id]?.judgment || ''),
        ...domains.map(d => escapeCSV(assessment.domains[d.id]?.support || '')),
        assessment.overall,
        escapeCSV(assessment.notes || ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, `rob_${session.name}.csv`, 'text/csv');
  };

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const stats = session ? {
    total: session.studies.length,
    assessed: Object.keys(session.assessments).length,
    lowRisk: Object.values(session.assessments).filter(a => a.overall === 'low').length,
    someConcerns: Object.values(session.assessments).filter(a => a.overall === 'some_concerns').length,
    highRisk: Object.values(session.assessments).filter(a => a.overall === 'high').length,
  } : null;

  // Render risk judgment selector
  const renderJudgmentSelector = (domainId: string) => {
    const current = assessmentData[domainId]?.judgment || 'unclear';
    const riskOptions: RiskLevel[] = selectedTool === 'nos' 
      ? ['low', 'high', 'unclear'] 
      : ['low', 'some_concerns', 'high', 'unclear'];

    return (
      <div className="flex gap-2 flex-wrap">
        {riskOptions.map(risk => (
          <button
            key={risk}
            onClick={() => handleDomainJudgment(domainId, risk)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              current === risk
                ? `${RISK_COLORS[risk].bg} ${RISK_COLORS[risk].border} ${RISK_COLORS[risk].text}`
                : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            {RISK_LABELS[risk]}
          </button>
        ))}
      </div>
    );
  };

  // Traffic light summary visualization
  const renderTrafficLight = () => {
    if (!session) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 text-slate-400 font-medium">Study</th>
              {domains.map(d => (
                <th key={d.id} className="p-2 text-slate-400 font-medium text-center" title={d.name}>
                  {d.shortName}
                </th>
              ))}
              <th className="p-2 text-slate-400 font-medium text-center">Overall</th>
            </tr>
          </thead>
          <tbody>
            {session.studies.map(study => {
              const assessment = session.assessments[study.id];
              return (
                <tr key={study.id} className="border-t border-slate-700/50">
                  <td className="p-2 text-white">{study.name}</td>
                  {domains.map(d => {
                    const judgment = assessment?.domains[d.id]?.judgment || 'unclear';
                    return (
                      <td key={d.id} className="p-2 text-center">
                        <span
                          className={`inline-block w-6 h-6 rounded-full ${
                            judgment === 'low' ? 'bg-emerald-500' :
                            judgment === 'some_concerns' ? 'bg-amber-500' :
                            judgment === 'high' ? 'bg-red-500' :
                            'bg-slate-600'
                          }`}
                          title={RISK_LABELS[judgment]}
                        />
                      </td>
                    );
                  })}
                  <td className="p-2 text-center">
                    <span
                      className={`inline-block w-6 h-6 rounded-full ${
                        assessment?.overall === 'low' ? 'bg-emerald-500' :
                        assessment?.overall === 'some_concerns' ? 'bg-amber-500' :
                        assessment?.overall === 'high' ? 'bg-red-500' :
                        'bg-slate-600'
                      }`}
                      title={RISK_LABELS[assessment?.overall || 'unclear']}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-700/50">
          <span className="text-sm text-slate-400">Legend:</span>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
            <span className="text-sm text-slate-300">Low risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-amber-500"></span>
            <span className="text-sm text-slate-300">Some concerns</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-red-500"></span>
            <span className="text-sm text-slate-300">High risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-600"></span>
            <span className="text-sm text-slate-300">Unclear</span>
          </div>
        </div>
      </div>
    );
  };

  // Summary statistics visualization
  const renderSummary = () => {
    if (!session || !stats) return null;

    // Domain-level summary
    const domainSummary = domains.map(domain => {
      const counts = {
        low: 0, some_concerns: 0, high: 0, unclear: 0
      };
      session.studies.forEach(study => {
        const judgment = session.assessments[study.id]?.domains[domain.id]?.judgment || 'unclear';
        counts[judgment as keyof typeof counts]++;
      });
      return { domain, counts };
    });

    return (
      <div className="space-y-6">
        {/* Overall summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.lowRisk}</div>
            <div className="text-sm text-emerald-300">Low Risk</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">{stats.someConcerns}</div>
            <div className="text-sm text-amber-300">Some Concerns</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-400">{stats.highRisk}</div>
            <div className="text-sm text-red-300">High Risk</div>
          </div>
          <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-400">{stats.total - stats.assessed}</div>
            <div className="text-sm text-slate-300">Not Assessed</div>
          </div>
        </div>

        {/* Domain bar chart */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Risk by Domain</h3>
          <div className="space-y-4">
            {domainSummary.map(({ domain, counts }) => {
              const total = stats.assessed || 1;
              return (
                <div key={domain.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{domain.name}</span>
                    <span className="text-xs text-slate-500">
                      {counts.low} low / {counts.some_concerns} concerns / {counts.high} high
                    </span>
                  </div>
                  <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(counts.low / total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${(counts.some_concerns / total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(counts.high / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
            <a href="/research" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MS</span>
              </div>
              <span className="text-white font-semibold">MSDrills</span>
            </a>
            <span className="text-slate-500">/</span>
            <span className="text-cyan-400">Risk of Bias</span>
          </div>
          <a href="/research" className="text-slate-400 hover:text-white text-sm">
            ← All Tools
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* No session - Tool selection */}
        {!session && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Risk of Bias Assessment</h1>
              <p className="text-slate-400">
                Assess methodological quality using standardized tools
              </p>
            </div>

            {/* Tool selection */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <button
                onClick={() => setSelectedTool('rob2')}
                className={`p-4 text-left rounded-xl border transition-all ${
                  selectedTool === 'rob2'
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <h3 className="text-white font-medium mb-1">ROB 2</h3>
                <p className="text-sm text-slate-400">Cochrane tool for RCTs</p>
                <p className="text-xs text-slate-500 mt-2">5 domains with signaling questions</p>
              </button>

              <button
                onClick={() => setSelectedTool('robins_i')}
                className={`p-4 text-left rounded-xl border transition-all ${
                  selectedTool === 'robins_i'
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <h3 className="text-white font-medium mb-1">ROBINS-I</h3>
                <p className="text-sm text-slate-400">Non-randomized studies</p>
                <p className="text-xs text-slate-500 mt-2">7 domains for interventions</p>
              </button>

              <button
                onClick={() => setSelectedTool('nos')}
                className={`p-4 text-left rounded-xl border transition-all ${
                  selectedTool === 'nos'
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <h3 className="text-white font-medium mb-1">Newcastle-Ottawa</h3>
                <p className="text-sm text-slate-400">Cohort & case-control</p>
                <p className="text-xs text-slate-500 mt-2">Star-based scoring (max 9)</p>
              </button>
            </div>

            {/* NOS variant selection */}
            {selectedTool === 'nos' && (
              <div className="flex justify-center gap-4 mb-6">
                <button
                  onClick={() => setNosVariant('cohort')}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    nosVariant === 'cohort'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Cohort Studies
                </button>
                <button
                  onClick={() => setNosVariant('case_control')}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    nosVariant === 'case_control'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Case-Control Studies
                </button>
              </div>
            )}

            {/* Import */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 text-center">
              <p className="text-slate-400 mb-4">
                Import a CSV with study names to begin assessment
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <span className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium inline-block transition-colors">
                  Import Studies (CSV)
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-3">
                CSV should have columns: study (or name/title), year (optional)
              </p>
            </div>
          </div>
        )}

        {/* Active session */}
        {session && (
          <>
            {/* View toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('assess')}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    viewMode === 'assess' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Assess
                </button>
                <button
                  onClick={() => setViewMode('traffic')}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    viewMode === 'traffic' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Traffic Light
                </button>
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    viewMode === 'summary' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Summary
                </button>
              </div>

              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>

            {/* Assessment view */}
            {viewMode === 'assess' && (
              <div className="flex gap-6">
                {/* Study sidebar */}
                <div className="w-64 flex-shrink-0">
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 sticky top-20">
                    <div className="text-sm text-slate-400 mb-2">
                      {stats?.assessed}/{stats?.total} assessed
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500"
                        style={{ width: `${((stats?.assessed || 0) / (stats?.total || 1)) * 100}%` }}
                      />
                    </div>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {session.studies.map((study, idx) => {
                        const assessment = session.assessments[study.id];
                        const isActive = idx === currentStudyIndex;

                        return (
                          <button
                            key={study.id}
                            onClick={() => {
                              saveAssessment();
                              setCurrentStudyIndex(idx);
                            }}
                            className={`w-full p-3 text-left rounded-lg transition-all ${
                              isActive
                                ? 'bg-cyan-500/20 border border-cyan-500/50'
                                : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                {study.name}
                              </span>
                              {assessment && (
                                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                  assessment.overall === 'low' ? 'bg-emerald-400' :
                                  assessment.overall === 'some_concerns' ? 'bg-amber-400' :
                                  assessment.overall === 'high' ? 'bg-red-400' :
                                  'bg-slate-500'
                                }`} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Main assessment area */}
                <div className="flex-1 min-w-0">
                  {currentStudy && (
                    <>
                      {/* Study header */}
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 mb-4">
                        <h2 className="text-lg font-medium text-white">{currentStudy.name}</h2>
                        {currentStudy.year && (
                          <p className="text-sm text-slate-400">{currentStudy.year}</p>
                        )}
                      </div>

                      {/* Domain tabs */}
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {domains.map((domain, idx) => {
                          const judgment = assessmentData[domain.id]?.judgment;
                          return (
                            <button
                              key={domain.id}
                              onClick={() => setCurrentDomainIndex(idx)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                                currentDomainIndex === idx
                                  ? 'bg-cyan-500 text-white'
                                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
                              }`}
                            >
                              {domain.shortName}
                              {judgment && (
                                <span className={`w-2 h-2 rounded-full ${
                                  judgment === 'low' ? 'bg-emerald-400' :
                                  judgment === 'some_concerns' ? 'bg-amber-400' :
                                  judgment === 'high' ? 'bg-red-400' :
                                  'bg-slate-500'
                                }`} />
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCurrentDomainIndex(-1)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            currentDomainIndex === -1
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-800/50 text-slate-400 hover:text-white'
                          }`}
                        >
                          Overall
                        </button>
                      </div>

                      {/* Domain assessment */}
                      {currentDomainIndex >= 0 && currentDomain && (
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                          <h3 className="text-lg font-medium text-white mb-1">{currentDomain.name}</h3>
                          <p className="text-sm text-slate-400 mb-6">{currentDomain.description}</p>

                          {/* ROB 2 signaling questions */}
                          {selectedTool === 'rob2' && 'signaling' in currentDomain && currentDomain.signaling && (
                            <div className="mb-6 space-y-4">
                              <h4 className="text-sm font-medium text-slate-300">Signaling Questions</h4>
                              {currentDomain.signaling.map((sq: any) => (
                                <div key={sq.id} className="p-3 bg-slate-900/50 rounded-lg">
                                  <p className="text-sm text-slate-300 mb-2">{sq.id}. {sq.question}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {sq.options.map((opt: string) => (
                                      <button
                                        key={opt}
                                        onClick={() => {
                                          setAssessmentData(prev => ({
                                            ...prev,
                                            [currentDomain.id]: {
                                              ...prev[currentDomain.id],
                                              signaling: {
                                                ...prev[currentDomain.id]?.signaling,
                                                [sq.id]: opt,
                                              },
                                              judgment: prev[currentDomain.id]?.judgment || 'unclear',
                                              support: prev[currentDomain.id]?.support || '',
                                            }
                                          }));
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-medium ${
                                          assessmentData[currentDomain.id]?.signaling?.[sq.id] === opt
                                            ? 'bg-cyan-500 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Judgment */}
                          <div className="mb-6">
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Risk of Bias Judgment</h4>
                            {renderJudgmentSelector(currentDomain.id)}
                          </div>

                          {/* Support */}
                          <div>
                            <h4 className="text-sm font-medium text-slate-300 mb-2">Support for Judgment</h4>
                            <textarea
                              value={assessmentData[currentDomain.id]?.support || ''}
                              onChange={(e) => handleSupportText(currentDomain.id, e.target.value)}
                              placeholder="Describe the rationale for your judgment..."
                              rows={3}
                              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                            />
                          </div>

                          {/* Navigation */}
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                            <button
                              onClick={goToPrevDomain}
                              disabled={currentDomainIndex === 0}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-white text-sm"
                            >
                              ← Previous Domain
                            </button>
                            <button
                              onClick={goToNextDomain}
                              disabled={currentDomainIndex >= domains.length - 1}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm"
                            >
                              Next Domain →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Overall judgment */}
                      {currentDomainIndex === -1 && (
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                          <h3 className="text-lg font-medium text-white mb-4">Overall Risk of Bias</h3>
                          
                          {/* Domain summary */}
                          <div className="grid grid-cols-5 gap-2 mb-6">
                            {domains.map(d => {
                              const judgment = assessmentData[d.id]?.judgment || 'unclear';
                              return (
                                <div key={d.id} className="text-center">
                                  <div
                                    className={`w-8 h-8 rounded-full mx-auto mb-1 ${
                                      judgment === 'low' ? 'bg-emerald-500' :
                                      judgment === 'some_concerns' ? 'bg-amber-500' :
                                      judgment === 'high' ? 'bg-red-500' :
                                      'bg-slate-600'
                                    }`}
                                  />
                                  <span className="text-xs text-slate-400">{d.shortName}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Overall selection */}
                          <div className="mb-6">
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Overall Judgment</h4>
                            <div className="flex gap-2 flex-wrap">
                              {(['low', 'some_concerns', 'high'] as RiskLevel[]).map(risk => (
                                <button
                                  key={risk}
                                  onClick={() => setOverallRisk(risk)}
                                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    overallRisk === risk
                                      ? `${RISK_COLORS[risk].bg} ${RISK_COLORS[risk].border} ${RISK_COLORS[risk].text}`
                                      : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500'
                                  }`}
                                >
                                  {RISK_LABELS[risk]}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Auto-calculated: {RISK_LABELS[calculateOverallRisk()]}
                            </p>
                          </div>

                          {/* Notes */}
                          <div className="mb-6">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">Additional Notes</h4>
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Any additional comments about this study..."
                              rows={3}
                              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                            />
                          </div>

                          {/* Save and next */}
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={saveAssessment}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                saveAssessment();
                                goToNextStudy();
                              }}
                              disabled={currentStudyIndex >= session.studies.length - 1}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
                            >
                              Save & Next Study
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Traffic light view */}
            {viewMode === 'traffic' && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-medium text-white mb-4">Traffic Light Summary</h3>
                {renderTrafficLight()}
              </div>
            )}

            {/* Summary view */}
            {viewMode === 'summary' && renderSummary()}
          </>
        )}
      </main>
    </div>
  );
};

export default RiskOfBiasTool;
