'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';

// ============================================
// Types
// ============================================

type RiskLevel = 'low' | 'some_concerns' | 'high' | 'unclear';

interface SignalingQuestion {
    id: string;
    question: string;
    options: string[];
}

interface NosItem {
    id: string;
    name: string;
    maxStars: number;
    options: string[];
}

interface Domain {
    id: string;
    name: string;
    shortName: string;
    description: string;
    signaling?: SignalingQuestion[]; // Only for ROB 2
    items?: NosItem[]; // Only for NOS
}

interface Assessment {
    studyId: string;
    assessorId: string;
    tool: string;
    domains: Record<string, {
        judgment: RiskLevel;
        support: string;
        signaling?: Record<string, string>;
    }>;
    overall: RiskLevel;
    notes?: string;
    date: string;
}

interface Study {
    id: string;
    name: string;
    year?: number;
    design?: string;
}

interface RobSession {
    id: string;
    name: string;
    tool: 'rob2' | 'robins_i' | 'nos_cohort' | 'nos_case_control';
    studies: Study[];
    assessments: Record<string, Assessment>;
    createdAt: string;
    updatedAt: string;
}

// ============================================
// Constants
// ============================================

const RISK_LABELS: Record<RiskLevel, string> = {
    low: 'Low Risk',
    some_concerns: 'Some Concerns',
    high: 'High Risk',
    unclear: 'Unclear Risk' // For manual override or incomplete
};

const RISK_COLORS: Record<RiskLevel, { bg: string, text: string, border: string }> = {
    low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/50' },
    some_concerns: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/50' },
    high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/50' },
    unclear: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/50' }
};

// ============================================
// ROB 2 (RCTs)
// ============================================

const ROB2_DOMAINS: Domain[] = [
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
// ROBINS-I (Non-randomized)
// ============================================

const ROBINS_I_DOMAINS: Domain[] = [
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

const NOS_COHORT_DOMAINS: Domain[] = [
    {
        id: 'selection',
        name: 'Selection',
        shortName: 'S',
        description: 'Selection of study groups',
        items: [
            {
                id: 's1', name: 'Representativeness of exposed cohort', maxStars: 1,
                options: ['Truly representative (★)', 'Somewhat representative (★)', 'Selected group', 'No description']
            },
            {
                id: 's2', name: 'Selection of non-exposed cohort', maxStars: 1,
                options: ['Drawn from same community (★)', 'Drawn from different source', 'No description']
            },
            {
                id: 's3', name: 'Ascertainment of exposure', maxStars: 1,
                options: ['Secure record (★)', 'Structured interview (★)', 'Written self-report', 'No description']
            },
            {
                id: 's4', name: 'Outcome not present at start', maxStars: 1,
                options: ['Yes (★)', 'No']
            },
        ]
    },
    {
        id: 'comparability',
        name: 'Comparability',
        shortName: 'C',
        description: 'Comparability of cohorts',
        items: [
            {
                id: 'c1', name: 'Comparability based on design/analysis', maxStars: 2,
                options: ['Controls for most important factor (★)', 'Controls for additional factor (★)', 'No control']
            },
        ]
    },
    {
        id: 'outcome',
        name: 'Outcome',
        shortName: 'O',
        description: 'Assessment of outcome',
        items: [
            {
                id: 'o1', name: 'Assessment of outcome', maxStars: 1,
                options: ['Independent blind assessment (★)', 'Record linkage (★)', 'Self-report', 'No description']
            },
            {
                id: 'o2', name: 'Follow-up long enough', maxStars: 1,
                options: ['Yes (★)', 'No']
            },
            {
                id: 'o3', name: 'Adequacy of follow-up', maxStars: 1,
                options: ['Complete follow-up (★)', '>80% followed, described (★)', 'Follow-up <80%, no description', 'No statement']
            },
        ]
    },
];

// ============================================
// Newcastle-Ottawa Scale (Case-Control)
// ============================================

const NOS_CASE_CONTROL_DOMAINS: Domain[] = [
    {
        id: 'selection',
        name: 'Selection',
        shortName: 'S',
        description: 'Selection of cases and controls',
        items: [
            {
                id: 's1', name: 'Case definition adequate', maxStars: 1,
                options: ['Yes, independent validation (★)', 'Yes, record linkage (★)', 'No description']
            },
            {
                id: 's2', name: 'Representativeness of cases', maxStars: 1,
                options: ['Consecutive or obviously representative (★)', 'Potential for selection bias', 'No description']
            },
            {
                id: 's3', name: 'Selection of controls', maxStars: 1,
                options: ['Community controls (★)', 'Hospital controls', 'No description']
            },
            {
                id: 's4', name: 'Definition of controls', maxStars: 1,
                options: ['No history of disease (★)', 'No description of source']
            },
        ]
    },
    {
        id: 'comparability',
        name: 'Comparability',
        shortName: 'C',
        description: 'Comparability of cases and controls',
        items: [
            {
                id: 'c1', name: 'Comparability based on design/analysis', maxStars: 2,
                options: ['Controls for most important factor (★)', 'Controls for additional factor (★)', 'No control']
            },
        ]
    },
    {
        id: 'exposure',
        name: 'Exposure',
        shortName: 'E',
        description: 'Ascertainment of exposure',
        items: [
            {
                id: 'e1', name: 'Ascertainment of exposure', maxStars: 1,
                options: ['Secure record (★)', 'Structured interview (★)', 'Written self-report', 'No description']
            },
            {
                id: 'e2', name: 'Same method for cases/controls', maxStars: 1,
                options: ['Yes (★)', 'No']
            },
            {
                id: 'e3', name: 'Non-response rate', maxStars: 1,
                options: ['Same rate for both groups (★)', 'Non-respondents described', 'Rate different, no designation']
            },
        ]
    },
];

const TOOLS = {
    rob2: { name: 'RoB 2 (RCTs)', domains: ROB2_DOMAINS },
    robins_i: { name: 'ROBINS-I (Non-randomized)', domains: ROBINS_I_DOMAINS },
    nos_cohort: { name: 'NOS (Cohort)', domains: NOS_COHORT_DOMAINS },
    nos_case_control: { name: 'NOS (Case-Control)', domains: NOS_CASE_CONTROL_DOMAINS },
};

// ============================================
// Components
// ============================================

const RiskOfBiasTool: React.FC = () => {
    // State
    const [session, setSession] = useState<RobSession | null>(null);
    const [viewMode, setViewMode] = useState<'assess' | 'traffic' | 'summary'>('assess');
    const [currentStudyIndex, setCurrentStudyIndex] = useState(0);
    const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
    const [showConfigModal, setShowConfigModal] = useState(false);

    // Current edit state
    const [assessmentData, setAssessmentData] = useState<Assessment['domains']>({});
    const [overallRisk, setOverallRisk] = useState<RiskLevel>('unclear');
    const [notes, setNotes] = useState('');

    const currentStudy = session?.studies[currentStudyIndex];
    const selectedTool = session?.tool;
    const domains = selectedTool ? TOOLS[selectedTool].domains : [];
    const currentDomain = currentDomainIndex >= 0 ? domains[currentDomainIndex] : null;

    // Load assessment when study changes
    useEffect(() => {
        if (session && currentStudy) {
            const existing = session.assessments[currentStudy.id];
            if (existing) {
                setAssessmentData(existing.domains);
                setOverallRisk(existing.overall);
                setNotes(existing.notes || '');
            } else {
                setAssessmentData({});
                setOverallRisk('unclear');
                setNotes('');
            }
            setCurrentDomainIndex(0);
        }
    }, [currentStudyIndex, session]); // Verify deps

    // Calculate algorithmically
    const calculateOverallRisk = useCallback((): RiskLevel => {
        if (!selectedTool || Object.keys(assessmentData).length === 0) return 'unclear';

        const judgments = Object.values(assessmentData).map(d => d.judgment);

        if (judgments.includes('high')) return 'high';
        if (judgments.includes('some_concerns')) return 'some_concerns';
        if (judgments.every(j => j === 'low') && judgments.length === domains.length) return 'low';

        return 'unclear';
    }, [assessmentData, domains, selectedTool]);

    // Update overall when domains change (optional auto-suggest)
    useEffect(() => {
        // Only auto-update if not manually set? Or just provide suggestion
        // For now we just show suggestion in UI
    }, [assessmentData]);

    // File import for studies list
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.trim().split('\n');
            const studies: Study[] = lines.slice(1).map((line, idx) => {
                const [name, year] = line.split(',').map(s => s.trim().replace(/"/g, ''));
                return {
                    id: `study_${idx}`,
                    name: name || `Study ${idx + 1}`,
                    year: year ? parseInt(year) : undefined
                };
            }).filter(s => s.name);

            if (studies.length === 0) throw new Error('No studies found');

            // Default to ROB2 for now, user selects in modal actually
            // Here we assume session is created via modal
        } catch (err) {
            console.error('Import error:', err);
        }
    };

    const createSession = (tool: RobSession['tool'], name: string, importedStudies: Study[]) => {
        const newSession: RobSession = {
            id: 'rob_' + Math.random().toString(36).substring(2, 15),
            name,
            tool,
            studies: importedStudies,
            assessments: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setSession(newSession);
        localStorage.setItem(`rob_${newSession.id}`, JSON.stringify(newSession));
        setShowConfigModal(false);
    };

    const saveAssessment = useCallback(() => {
        if (!session || !currentStudy || !selectedTool) return;

        const assessment: Assessment = {
            studyId: currentStudy.id,
            assessorId: localStorage.getItem('msdrills_session_id') || 'anonymous', // todo
            tool: selectedTool,
            domains: assessmentData,
            overall: overallRisk, // User can override algo
            notes,
            date: new Date().toISOString(),
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

    const exportToCSV = () => {
        if (!session) return;

        const domains = TOOLS[session.tool].domains;
        const header = ['Study ID', 'Study Name', 'Year', ...domains.map(d => d.shortName), 'Overall', 'Notes'];

        const rows = session.studies.map(study => {
            const assessment = session.assessments[study.id];
            return [
                study.id,
                `"${study.name}"`,
                study.year || '',
                ...domains.map(d => assessment?.domains[d.id]?.judgment || 'not_assessed'),
                assessment?.overall || 'not_assessed',
                `"${assessment?.notes || ''}"`
            ].join(',');
        });

        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rob_results_${session.name}.csv`;
        a.click();
    };

    // Nav
    const goToNextStudy = () => {
        if (session && currentStudyIndex < session.studies.length - 1) {
            setCurrentStudyIndex(prev => prev + 1);
        }
    };

    // Domain nav
    const goToNextDomain = () => {
        if (currentDomainIndex < domains.length - 1) {
            setCurrentDomainIndex(prev => prev + 1);
        } else {
            setCurrentDomainIndex(-1); // Overall
        }
    };

    const goToPrevDomain = () => {
        if (currentDomainIndex > -1) {
            setCurrentDomainIndex(prev => prev - 1);
        }
    };

    const handleSupportText = (domainId: string, text: string) => {
        setAssessmentData(prev => ({
            ...prev,
            [domainId]: {
                ...prev[domainId],
                judgment: prev[domainId]?.judgment || 'unclear',
                support: text
            }
        }));
    };

    const renderJudgmentSelector = (domainId: string) => {
        const current = assessmentData[domainId]?.judgment;

        return (
            <div className="flex gap-2">
                {(['low', 'some_concerns', 'high'] as RiskLevel[]).map(risk => (
                    <button
                        key={risk}
                        onClick={() => setAssessmentData(prev => ({
                            ...prev,
                            [domainId]: {
                                ...prev[domainId],
                                judgment: risk,
                                support: prev[domainId]?.support || ''
                            }
                        }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${current === risk
                            ? `${RISK_COLORS[risk].bg} ${RISK_COLORS[risk].border} ${RISK_COLORS[risk].text}`
                            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                    >
                        {RISK_LABELS[risk]}
                    </button>
                ))}
            </div>
        );
    };

    const renderTrafficLight = () => {
        if (!session) return null;

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="p-2 text-slate-400 font-medium">Study</th>
                            {domains.map(d => (
                                <th key={d.id} className="p-2 text-center text-slate-400 font-medium w-24">
                                    {d.shortName}
                                </th>
                            ))}
                            <th className="p-2 text-center text-slate-400 font-medium w-24">Overall</th>
                        </tr>
                    </thead>
                    <tbody>
                        {session.studies.map(study => {
                            const assessment = session.assessments[study.id];
                            return (
                                <tr key={study.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    <td className="p-2 font-medium text-slate-300">{study.name}</td>
                                    {domains.map(d => {
                                        const judgment = assessment?.domains[d.id]?.judgment;
                                        return (
                                            <td key={d.id} className="p-2 text-center">
                                                <div className={`w-4 h-4 rounded-full mx-auto ${judgment === 'low' ? 'bg-emerald-500' :
                                                    judgment === 'some_concerns' ? 'bg-amber-500' :
                                                        judgment === 'high' ? 'bg-red-500' :
                                                            'bg-slate-700'
                                                    }`} title={judgment} />
                                            </td>
                                        );
                                    })}
                                    <td className="p-2 text-center">
                                        <div className={`w-4 h-4 rounded-full mx-auto ${assessment?.overall === 'low' ? 'bg-emerald-500' :
                                            assessment?.overall === 'some_concerns' ? 'bg-amber-500' :
                                                assessment?.overall === 'high' ? 'bg-red-500' :
                                                    'bg-slate-700'
                                            }`} title={assessment?.overall} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderSummary = () => {
        if (!session) return null;

        // Calculate percentages
        const summaryData = domains.map(d => {
            const counts = { low: 0, some_concerns: 0, high: 0, unclear: 0 };
            let total = 0;

            session.studies.forEach(s => {
                const j = session.assessments[s.id]?.domains[d.id]?.judgment || 'unclear';
                counts[j]++;
                total++;
            });

            return { domain: d, counts, total };
        });

        // Overall summary
        const overallCounts = { low: 0, some_concerns: 0, high: 0, unclear: 0 };
        session.studies.forEach(s => {
            const o = session.assessments[s.id]?.overall || 'unclear';
            overallCounts[o]++;
        });

        return (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Risk of Bias Summary</h3>

                <div className="space-y-6">
                    {summaryData.map(item => (
                        <div key={item.domain.id}>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-300">{item.domain.name}</span>
                            </div>
                            <div className="h-6 flex rounded-lg overflow-hidden">
                                {item.counts.low > 0 && (
                                    <div style={{ width: `${(item.counts.low / item.total) * 100}%` }} className="bg-emerald-500 flex items-center justify-center text-xs text-white  bg-opacity-80" title="Low Risk">
                                        {Math.round((item.counts.low / item.total) * 100)}%
                                    </div>
                                )}
                                {item.counts.some_concerns > 0 && (
                                    <div style={{ width: `${(item.counts.some_concerns / item.total) * 100}%` }} className="bg-amber-500 flex items-center justify-center text-xs text-white bg-opacity-80" title="Some Concerns">
                                        {Math.round((item.counts.some_concerns / item.total) * 100)}%
                                    </div>
                                )}
                                {item.counts.high > 0 && (
                                    <div style={{ width: `${(item.counts.high / item.total) * 100}%` }} className="bg-red-500 flex items-center justify-center text-xs text-white bg-opacity-80" title="High Risk">
                                        {Math.round((item.counts.high / item.total) * 100)}%
                                    </div>
                                )}
                                {item.counts.unclear > 0 && (
                                    <div style={{ width: `${(item.counts.unclear / item.total) * 100}%` }} className="bg-slate-600 flex items-center justify-center text-xs text-slate-300" title="Unclear">
                                        {item.counts.unclear}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Overall Bar */}
                    <div className="pt-4 border-t border-slate-700">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-white font-medium">Overall Risk of Bias</span>
                        </div>
                        <div className="h-8 flex rounded-lg overflow-hidden">
                            {overallCounts.low > 0 && (
                                <div style={{ width: `${(overallCounts.low / session.studies.length) * 100}%` }} className="bg-emerald-500 flex items-center justify-center text-xs text-white font-bold" title="Low Risk">
                                    {Math.round((overallCounts.low / session.studies.length) * 100)}%
                                </div>
                            )}
                            {overallCounts.some_concerns > 0 && (
                                <div style={{ width: `${(overallCounts.some_concerns / session.studies.length) * 100}%` }} className="bg-amber-500 flex items-center justify-center text-xs text-white font-bold" title="Some Concerns">
                                    {Math.round((overallCounts.some_concerns / session.studies.length) * 100)}%
                                </div>
                            )}
                            {overallCounts.high > 0 && (
                                <div style={{ width: `${(overallCounts.high / session.studies.length) * 100}%` }} className="bg-red-500 flex items-center justify-center text-xs text-white font-bold" title="High Risk">
                                    {Math.round((overallCounts.high / session.studies.length) * 100)}%
                                </div>
                            )}
                            {overallCounts.unclear > 0 && (
                                <div style={{ width: `${(overallCounts.unclear / session.studies.length) * 100}%` }} className="bg-slate-600 flex items-center justify-center text-xs text-slate-300" title="Unclear">
                                    {overallCounts.unclear}
                                </div>
                            )}
                        </div>
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
                        <a href="/mph" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">MS</span>
                            </div>
                            <span className="text-white font-semibold">Homepage</span>
                        </a>
                        <span className="text-slate-500">/</span>
                        <span className="text-cyan-400">Risk of Bias</span>
                    </div>
                    <a href="/mph" className="text-slate-400 hover:text-white text-sm">
                        ← All Tools
                    </a>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-6">
                {/* Landing / Config */}
                {!session && (
                    <div className="max-w-2xl mx-auto text-center pt-10">
                        <h1 className="text-3xl font-bold text-white mb-4">Risk of Bias Assessment</h1>
                        <p className="text-slate-400 mb-8">
                            Systematic assessment of study quality using standard tools (ROB 2, ROBINS-I, NOS)
                        </p>

                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8">
                            <button
                                onClick={() => setShowConfigModal(true)}
                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-medium shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
                            >
                                Start New Assessment
                            </button>

                            <div className="mt-8 grid grid-cols-2 gap-4 text-left">
                                {Object.values(TOOLS).map(t => (
                                    <div key={t.name} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                                        <h3 className="text-white font-medium text-sm">{t.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">{t.domains.length} domains</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for new session */}
                {showConfigModal && !session && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                            <h2 className="text-xl font-bold text-white mb-4">New Assessment Session</h2>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                createSession(
                                    fd.get('tool') as RobSession['tool'],
                                    fd.get('name') as string,
                                    [{ id: 'study_1', name: 'Example Study', year: 2023 }] // Todo: import logic
                                );
                            }}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Session Name</label>
                                        <input name="name" required className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white border border-slate-600 focus:border-cyan-500 outline-none" placeholder="e.g. My Review ROB" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Assessment Tool</label>
                                        <select name="tool" className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white border border-slate-600 focus:border-cyan-500 outline-none">
                                            <option value="rob2">RoB 2 (Randomized Trials)</option>
                                            <option value="robins_i">ROBINS-I (Non-randomized)</option>
                                            <option value="nos_cohort">Newcastle-Ottawa (Cohort)</option>
                                            <option value="nos_case_control">Newcastle-Ottawa (Case-Control)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Import Studies (Optional)</label>
                                        <input type="file" accept=".csv,.txt" onChange={handleFileImport} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600" />
                                        <p className="text-xs text-slate-500 mt-1">CSV format: Name, Year</p>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white">Start Assessment</button>
                                </div>
                            </form>
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
                                    className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'assess' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                                        }`}
                                >
                                    Assess
                                </button>
                                <button
                                    onClick={() => setViewMode('traffic')}
                                    className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'traffic' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                                        }`}
                                >
                                    Traffic Light
                                </button>
                                <button
                                    onClick={() => setViewMode('summary')}
                                    className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'summary' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
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
                                            {Object.keys(session.assessments).length}/{session.studies.length} assessed
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
                                                        className={`w-full p-3 text-left rounded-lg transition-all ${isActive
                                                            ? 'bg-cyan-500/20 border border-cyan-500/50'
                                                            : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                                                {study.name}
                                                            </span>
                                                            {assessment && (
                                                                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${assessment.overall === 'low' ? 'bg-emerald-400' :
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
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${currentDomainIndex === idx
                                                                ? 'bg-cyan-500 text-white'
                                                                : 'bg-slate-800/50 text-slate-400 hover:text-white'
                                                                }`}
                                                        >
                                                            {domain.shortName}
                                                            {judgment && (
                                                                <span className={`w-2 h-2 rounded-full ${judgment === 'low' ? 'bg-emerald-400' :
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
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${currentDomainIndex === -1
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
                                                                                className={`px-3 py-1 rounded text-xs font-medium ${assessmentData[currentDomain.id]?.signaling?.[sq.id] === opt
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
                                                                        className={`w-8 h-8 rounded-full mx-auto mb-1 ${judgment === 'low' ? 'bg-emerald-500' :
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
                                                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${overallRisk === risk
                                                                        ? `${RISK_COLORS[risk].bg} ${RISK_COLORS[risk].border} ${RISK_COLORS[risk].text}`
                                                                        : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500'
                                                                        }`}
                                                                >
                                                                    {RISK_LABELS[risk]}
                                                                </button>
                                                            ))}
                                                        </div>
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
