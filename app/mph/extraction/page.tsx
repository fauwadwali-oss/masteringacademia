'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';

// ============================================
// Types
// ============================================

interface Paper {
    id: string;
    title: string;
    authors: string;
    year?: number;
    journal?: string;
    doi?: string;
}

interface FieldDefinition {
    id: string;
    name: string;
    type: 'text' | 'number' | 'select' | 'multiselect' | 'textarea' | 'boolean' | 'date';
    options?: string[]; // For select/multiselect
    required?: boolean;
    placeholder?: string;
    description?: string;
    category: string;
}

interface FormTemplate {
    id: string;
    name: string;
    description: string;
    fields: FieldDefinition[];
}

interface ExtractionData {
    paperId: string;
    data: Record<string, any>;
    extractedAt: string;
    extractedBy: string;
    notes?: string;
    status: 'pending' | 'in_progress' | 'complete' | 'needs_review';
}

interface ExtractionSession {
    id: string;
    name: string;
    template: FormTemplate;
    papers: Paper[];
    extractions: Record<string, ExtractionData>;
    createdAt: string;
    updatedAt: string;
}

// ============================================
// Pre-built Templates
// ============================================

const TEMPLATES: FormTemplate[] = [
    {
        id: 'pico_basic',
        name: 'PICO Basic',
        description: 'Population, Intervention, Comparison, Outcome extraction',
        fields: [
            // Study Identification
            { id: 'study_id', name: 'Study ID', type: 'text', category: 'Identification', required: true },
            { id: 'first_author', name: 'First Author', type: 'text', category: 'Identification' },
            { id: 'pub_year', name: 'Publication Year', type: 'number', category: 'Identification' },
            { id: 'country', name: 'Country', type: 'text', category: 'Identification' },

            // Study Design
            {
                id: 'study_design', name: 'Study Design', type: 'select', category: 'Methods',
                options: ['RCT', 'Quasi-experimental', 'Cohort', 'Case-control', 'Cross-sectional', 'Case series', 'Case report', 'Other']
            },
            { id: 'sample_size', name: 'Total Sample Size', type: 'number', category: 'Methods' },
            { id: 'followup_duration', name: 'Follow-up Duration', type: 'text', category: 'Methods', placeholder: 'e.g., 12 months' },

            // Population
            { id: 'population_desc', name: 'Population Description', type: 'textarea', category: 'Population' },
            { id: 'inclusion_criteria', name: 'Inclusion Criteria', type: 'textarea', category: 'Population' },
            { id: 'exclusion_criteria', name: 'Exclusion Criteria', type: 'textarea', category: 'Population' },
            { id: 'mean_age', name: 'Mean Age', type: 'number', category: 'Population' },
            { id: 'percent_female', name: '% Female', type: 'number', category: 'Population' },

            // Intervention
            { id: 'intervention_desc', name: 'Intervention Description', type: 'textarea', category: 'Intervention', required: true },
            { id: 'intervention_dose', name: 'Dose/Intensity', type: 'text', category: 'Intervention' },
            { id: 'intervention_duration', name: 'Duration', type: 'text', category: 'Intervention' },
            { id: 'intervention_frequency', name: 'Frequency', type: 'text', category: 'Intervention' },
            { id: 'intervention_n', name: 'N (Intervention)', type: 'number', category: 'Intervention' },

            // Comparison
            { id: 'comparison_desc', name: 'Comparison Description', type: 'textarea', category: 'Comparison' },
            {
                id: 'comparison_type', name: 'Comparison Type', type: 'select', category: 'Comparison',
                options: ['Placebo', 'No treatment', 'Usual care', 'Active comparator', 'Wait-list', 'Other']
            },
            { id: 'comparison_n', name: 'N (Comparison)', type: 'number', category: 'Comparison' },

            // Outcomes
            { id: 'primary_outcome', name: 'Primary Outcome', type: 'text', category: 'Outcomes', required: true },
            { id: 'primary_measure', name: 'Primary Outcome Measure', type: 'text', category: 'Outcomes' },
            { id: 'secondary_outcomes', name: 'Secondary Outcomes', type: 'textarea', category: 'Outcomes' },
            { id: 'outcome_timing', name: 'Outcome Assessment Timing', type: 'text', category: 'Outcomes' },
        ]
    },
    {
        id: 'effect_sizes',
        name: 'Effect Size Extraction',
        description: 'Numerical data for meta-analysis',
        fields: [
            { id: 'study_id', name: 'Study ID', type: 'text', category: 'Identification', required: true },
            { id: 'outcome_name', name: 'Outcome Name', type: 'text', category: 'Outcome', required: true },
            {
                id: 'outcome_type', name: 'Outcome Type', type: 'select', category: 'Outcome',
                options: ['Continuous', 'Binary/Dichotomous', 'Count/Rate', 'Time-to-event', 'Ordinal']
            },

            // Continuous outcomes
            { id: 'int_mean', name: 'Intervention Mean', type: 'number', category: 'Continuous Data' },
            { id: 'int_sd', name: 'Intervention SD', type: 'number', category: 'Continuous Data' },
            { id: 'int_n', name: 'Intervention N', type: 'number', category: 'Continuous Data' },
            { id: 'ctrl_mean', name: 'Control Mean', type: 'number', category: 'Continuous Data' },
            { id: 'ctrl_sd', name: 'Control SD', type: 'number', category: 'Continuous Data' },
            { id: 'ctrl_n', name: 'Control N', type: 'number', category: 'Continuous Data' },

            // Binary outcomes
            { id: 'int_events', name: 'Intervention Events', type: 'number', category: 'Binary Data' },
            { id: 'int_total', name: 'Intervention Total', type: 'number', category: 'Binary Data' },
            { id: 'ctrl_events', name: 'Control Events', type: 'number', category: 'Binary Data' },
            { id: 'ctrl_total', name: 'Control Total', type: 'number', category: 'Binary Data' },

            // Pre-calculated effects
            {
                id: 'effect_measure', name: 'Effect Measure', type: 'select', category: 'Reported Effect',
                options: ['Mean Difference', 'Standardized MD', 'Risk Ratio', 'Odds Ratio', 'Hazard Ratio', 'Risk Difference', 'Other']
            },
            { id: 'effect_estimate', name: 'Effect Estimate', type: 'number', category: 'Reported Effect' },
            { id: 'ci_lower', name: '95% CI Lower', type: 'number', category: 'Reported Effect' },
            { id: 'ci_upper', name: '95% CI Upper', type: 'number', category: 'Reported Effect' },
            { id: 'p_value', name: 'P-value', type: 'text', category: 'Reported Effect' },

            { id: 'notes', name: 'Notes', type: 'textarea', category: 'Notes' },
        ]
    },
    {
        id: 'rct_cochrane',
        name: 'RCT Extraction (Cochrane-style)',
        description: 'Comprehensive extraction for randomized controlled trials',
        fields: [
            // Methods
            { id: 'study_id', name: 'Study ID', type: 'text', category: 'Identification', required: true },
            { id: 'trial_registration', name: 'Trial Registration', type: 'text', category: 'Identification' },
            { id: 'funding_source', name: 'Funding Source', type: 'text', category: 'Identification' },
            { id: 'coi', name: 'Conflicts of Interest', type: 'textarea', category: 'Identification' },

            {
                id: 'design', name: 'Design', type: 'select', category: 'Methods',
                options: ['Parallel', 'Crossover', 'Cluster', 'Factorial', 'Other']
            },
            { id: 'randomization_method', name: 'Randomization Method', type: 'text', category: 'Methods' },
            { id: 'allocation_concealment', name: 'Allocation Concealment', type: 'text', category: 'Methods' },
            {
                id: 'blinding', name: 'Blinding', type: 'multiselect', category: 'Methods',
                options: ['Participants', 'Personnel', 'Outcome assessors', 'Analysts', 'None']
            },
            { id: 'itc_analysis', name: 'ITT Analysis', type: 'boolean', category: 'Methods' },

            // Participants
            { id: 'setting', name: 'Setting', type: 'text', category: 'Participants' },
            { id: 'n_randomized', name: 'N Randomized', type: 'number', category: 'Participants' },
            { id: 'n_analyzed', name: 'N Analyzed', type: 'number', category: 'Participants' },
            { id: 'attrition_rate', name: 'Attrition Rate (%)', type: 'number', category: 'Participants' },
            { id: 'baseline_char', name: 'Baseline Characteristics', type: 'textarea', category: 'Participants' },

            // Interventions
            { id: 'int_name', name: 'Intervention Name', type: 'text', category: 'Interventions', required: true },
            { id: 'int_details', name: 'Intervention Details', type: 'textarea', category: 'Interventions' },
            { id: 'ctrl_name', name: 'Control Name', type: 'text', category: 'Interventions' },
            { id: 'ctrl_details', name: 'Control Details', type: 'textarea', category: 'Interventions' },
            { id: 'cointerventions', name: 'Co-interventions', type: 'textarea', category: 'Interventions' },

            // Outcomes
            { id: 'outcomes_list', name: 'All Outcomes Measured', type: 'textarea', category: 'Outcomes' },
            { id: 'primary_outcome', name: 'Primary Outcome', type: 'text', category: 'Outcomes' },
            { id: 'outcome_def', name: 'Outcome Definition', type: 'textarea', category: 'Outcomes' },
            { id: 'measurement_tool', name: 'Measurement Tool', type: 'text', category: 'Outcomes' },
            { id: 'timepoints', name: 'Measurement Timepoints', type: 'text', category: 'Outcomes' },

            // Notes
            { id: 'key_conclusions', name: 'Key Conclusions', type: 'textarea', category: 'Notes' },
            { id: 'limitations', name: 'Study Limitations', type: 'textarea', category: 'Notes' },
            { id: 'extractor_notes', name: 'Extractor Notes', type: 'textarea', category: 'Notes' },
        ]
    },
    {
        id: 'observational',
        name: 'Observational Study',
        description: 'Extraction for cohort, case-control, and cross-sectional studies',
        fields: [
            { id: 'study_id', name: 'Study ID', type: 'text', category: 'Identification', required: true },
            {
                id: 'study_design', name: 'Study Design', type: 'select', category: 'Methods',
                options: ['Prospective cohort', 'Retrospective cohort', 'Case-control', 'Nested case-control', 'Cross-sectional', 'Other']
            },
            { id: 'data_source', name: 'Data Source', type: 'text', category: 'Methods' },
            { id: 'study_period', name: 'Study Period', type: 'text', category: 'Methods' },

            { id: 'exposure', name: 'Exposure/Risk Factor', type: 'textarea', category: 'Exposure', required: true },
            { id: 'exposure_assessment', name: 'Exposure Assessment Method', type: 'text', category: 'Exposure' },
            { id: 'exposed_n', name: 'N Exposed', type: 'number', category: 'Exposure' },
            { id: 'unexposed_n', name: 'N Unexposed', type: 'number', category: 'Exposure' },

            { id: 'outcome', name: 'Outcome', type: 'text', category: 'Outcome', required: true },
            { id: 'outcome_assessment', name: 'Outcome Assessment', type: 'text', category: 'Outcome' },

            { id: 'confounders', name: 'Confounders Adjusted', type: 'textarea', category: 'Analysis' },
            { id: 'analysis_method', name: 'Statistical Analysis', type: 'text', category: 'Analysis' },

            {
                id: 'effect_measure', name: 'Effect Measure', type: 'select', category: 'Results',
                options: ['Odds Ratio', 'Risk Ratio', 'Hazard Ratio', 'Incidence Rate Ratio', 'Mean Difference', 'Other']
            },
            { id: 'effect_estimate', name: 'Effect Estimate', type: 'number', category: 'Results' },
            { id: 'ci_lower', name: '95% CI Lower', type: 'number', category: 'Results' },
            { id: 'ci_upper', name: '95% CI Upper', type: 'number', category: 'Results' },
            { id: 'adjusted', name: 'Adjusted Estimate', type: 'boolean', category: 'Results' },

            { id: 'notes', name: 'Notes', type: 'textarea', category: 'Notes' },
        ]
    },
];

// ============================================
// Field Categories
// ============================================

const getCategories = (fields: FieldDefinition[]): string[] => {
    const categories = new Set<string>();
    fields.forEach(f => categories.add(f.category));
    return Array.from(categories);
};

// ============================================
// Main Component
// ============================================

const DataExtractionTool: React.FC = () => {
    // State
    const [session, setSession] = useState<ExtractionSession | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
    const [currentPaperIndex, setCurrentPaperIndex] = useState(0);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
    const [customTemplate, setCustomTemplate] = useState<FormTemplate | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Current paper
    const currentPaper = session?.papers[currentPaperIndex];
    const currentExtraction = session?.extractions[currentPaper?.id || ''];

    // Categories for current template
    const categories = selectedTemplate ? getCategories(selectedTemplate.fields) : [];

    // Initialize active category
    useEffect(() => {
        if (categories.length > 0 && !activeCategory) {
            setActiveCategory(categories[0]);
        }
    }, [categories, activeCategory]);

    // Load existing extraction data when paper changes
    useEffect(() => {
        if (currentExtraction) {
            setFormData(currentExtraction.data);
        } else {
            setFormData({});
        }
    }, [currentPaperIndex, currentExtraction]);

    // Import papers from CSV/RIS
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            let papers: Paper[] = [];

            if (file.name.endsWith('.csv')) {
                papers = parseCSV(text);
            } else if (file.name.endsWith('.ris')) {
                papers = parseRIS(text);
            }

            if (papers.length === 0) {
                throw new Error('No papers found in file');
            }

            // Create session
            const newSession: ExtractionSession = {
                id: 'ext_' + Math.random().toString(36).substring(2, 15),
                name: file.name.replace(/\.(csv|ris)$/i, ''),
                template: selectedTemplate!,
                papers,
                extractions: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            setSession(newSession);
            setCurrentPaperIndex(0);
            setFormData({});

            // Save to localStorage
            localStorage.setItem(`extraction_${newSession.id}`, JSON.stringify(newSession));
        } catch (err) {
            console.error('Import error:', err);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Parse CSV
    const parseCSV = (text: string): Paper[] => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''));
        const titleIdx = headers.findIndex(h => h === 'title');
        const authorsIdx = headers.findIndex(h => h === 'authors' || h === 'author');
        const yearIdx = headers.findIndex(h => h === 'year');
        const journalIdx = headers.findIndex(h => h === 'journal');
        const doiIdx = headers.findIndex(h => h === 'doi');

        return lines.slice(1).map((line, idx) => {
            const values = parseCSVLine(line);
            return {
                id: `paper_${idx}`,
                title: values[titleIdx] || 'Untitled',
                authors: authorsIdx >= 0 ? values[authorsIdx] : '',
                year: yearIdx >= 0 ? parseInt(values[yearIdx]) : undefined,
                journal: journalIdx >= 0 ? values[journalIdx] : undefined,
                doi: doiIdx >= 0 ? values[doiIdx] : undefined,
            };
        }).filter(p => p.title !== 'Untitled');
    };

    const parseCSVLine = (line: string): string[] => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    };

    // Parse RIS
    const parseRIS = (text: string): Paper[] => {
        const papers: Paper[] = [];
        const entries = text.split(/\nER\s*-/);

        for (const entry of entries) {
            if (!entry.trim()) continue;

            let title = '', authors = '', journal = '', doi = '';
            let year: number | undefined;

            for (const line of entry.split('\n')) {
                const match = line.match(/^([A-Z]{2})\s*-\s*(.+)/);
                if (!match) continue;

                const [, tag, value] = match;
                switch (tag) {
                    case 'TI': case 'T1': title = value.trim(); break;
                    case 'AU': case 'A1': authors += (authors ? '; ' : '') + value.trim(); break;
                    case 'JO': case 'JF': journal = value.trim(); break;
                    case 'PY': case 'Y1': year = parseInt(value.match(/\d{4}/)?.[0] || ''); break;
                    case 'DO': doi = value.trim(); break;
                }
            }

            if (title) {
                papers.push({ id: `paper_${papers.length}`, title, authors, year, journal, doi });
            }
        }

        return papers;
    };

    // Save extraction
    const handleSave = useCallback((status: ExtractionData['status'] = 'in_progress') => {
        if (!session || !currentPaper) return;

        const extraction: ExtractionData = {
            paperId: currentPaper.id,
            data: formData,
            extractedAt: new Date().toISOString(),
            extractedBy: localStorage.getItem('msdrills_session_id') || 'anonymous',
            status,
        };

        const updatedSession = {
            ...session,
            extractions: {
                ...session.extractions,
                [currentPaper.id]: extraction,
            },
            updatedAt: new Date().toISOString(),
        };

        setSession(updatedSession);
        localStorage.setItem(`extraction_${session.id}`, JSON.stringify(updatedSession));
    }, [session, currentPaper, formData]);

    // Navigation
    const goToNext = useCallback(() => {
        if (session && currentPaperIndex < session.papers.length - 1) {
            handleSave();
            setCurrentPaperIndex(prev => prev + 1);
        }
    }, [session, currentPaperIndex, handleSave]);

    const goToPrevious = useCallback(() => {
        if (currentPaperIndex > 0) {
            handleSave();
            setCurrentPaperIndex(prev => prev - 1);
        }
    }, [currentPaperIndex, handleSave]);

    // Field change handler
    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    // Export to CSV
    const exportToCSV = () => {
        if (!session) return;

        const template = session.template;
        const headers = ['paper_id', 'paper_title', ...template.fields.map(f => f.id), 'status', 'extracted_at'];

        const rows = session.papers.map(paper => {
            const extraction = session.extractions[paper.id];
            const data = extraction?.data || {};

            return [
                paper.id,
                escapeCSV(paper.title),
                ...template.fields.map(f => escapeCSV(String(data[f.id] || ''))),
                extraction?.status || 'pending',
                extraction?.extractedAt || '',
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        downloadFile(csv, `extraction_${session.name}.csv`, 'text/csv');
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
        total: session.papers.length,
        complete: Object.values(session.extractions).filter(e => e.status === 'complete').length,
        inProgress: Object.values(session.extractions).filter(e => e.status === 'in_progress').length,
        pending: session.papers.length - Object.keys(session.extractions).length,
    } : null;

    // Filtered papers for search
    const filteredPapers = session?.papers.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.authors.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // Render field based on type
    const renderField = (field: FieldDefinition) => {
        const value = formData[field.id] ?? '';

        switch (field.type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value ? parseFloat(e.target.value) : '')}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                );

            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="">Select...</option>
                        {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case 'multiselect':
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                    <div className="space-y-2">
                        {field.options?.map(opt => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.includes(opt)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            handleFieldChange(field.id, [...selectedValues, opt]);
                                        } else {
                                            handleFieldChange(field.id, selectedValues.filter(v => v !== opt));
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className="text-slate-300 text-sm">{opt}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'boolean':
                return (
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={field.id}
                                checked={value === true}
                                onChange={() => handleFieldChange(field.id, true)}
                                className="w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={field.id}
                                checked={value === false}
                                onChange={() => handleFieldChange(field.id, false)}
                                className="w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">No</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={field.id}
                                checked={value === '' || value === undefined}
                                onChange={() => handleFieldChange(field.id, '')}
                                className="w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">N/A</span>
                        </label>
                    </div>
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                );

            default:
                return null;
        }
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
                        <span className="text-cyan-400">Data Extraction</span>
                    </div>
                    <a href="/mph" className="text-slate-400 hover:text-white text-sm">
                        ← All Tools
                    </a>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-6">
                {/* No session - Template selection */}
                {!session && (
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-white mb-2">Data Extraction</h1>
                            <p className="text-slate-400">
                                Extract study data using standardized forms for systematic reviews
                            </p>
                        </div>

                        {/* Template Selection */}
                        <div className="grid md:grid-cols-2 gap-4 mb-8">
                            {TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        setSelectedTemplate(template);
                                        setShowTemplateModal(true);
                                    }}
                                    className={`p-4 text-left rounded-xl border transition-all ${selectedTemplate?.id === template.id
                                        ? 'bg-cyan-500/10 border-cyan-500/50'
                                        : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                                        }`}
                                >
                                    <h3 className="text-white font-medium mb-1">{template.name}</h3>
                                    <p className="text-sm text-slate-400 mb-2">{template.description}</p>
                                    <p className="text-xs text-slate-500">{template.fields.length} fields</p>
                                </button>
                            ))}
                        </div>

                        {/* Selected template preview */}
                        {selectedTemplate && (
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium text-white">{selectedTemplate.name}</h3>
                                    <label className="cursor-pointer">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.ris"
                                            onChange={handleFileImport}
                                            className="hidden"
                                        />
                                        <span className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-medium inline-block transition-colors">
                                            Import Papers (CSV/RIS)
                                        </span>
                                    </label>
                                </div>

                                <div className="grid md:grid-cols-3 gap-4">
                                    {getCategories(selectedTemplate.fields).map(category => (
                                        <div key={category} className="p-3 bg-slate-900/50 rounded-lg">
                                            <h4 className="text-sm font-medium text-slate-300 mb-2">{category}</h4>
                                            <ul className="text-xs text-slate-500 space-y-1">
                                                {selectedTemplate.fields
                                                    .filter(f => f.category === category)
                                                    .slice(0, 4)
                                                    .map(f => (
                                                        <li key={f.id}>• {f.name}</li>
                                                    ))}
                                                {selectedTemplate.fields.filter(f => f.category === category).length > 4 && (
                                                    <li className="text-slate-600">
                                                        +{selectedTemplate.fields.filter(f => f.category === category).length - 4} more
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Active session - Extraction interface */}
                {session && (
                    <div className="flex gap-6">
                        {/* Sidebar - Paper list */}
                        <div className="w-72 flex-shrink-0">
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 sticky top-20">
                                {/* Stats */}
                                <div className="flex items-center justify-between mb-4 text-sm">
                                    <span className="text-slate-400">Progress</span>
                                    <span className="text-white">
                                        {stats?.complete}/{stats?.total} complete
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
                                    <div
                                        className="h-full bg-cyan-500 transition-all"
                                        style={{ width: `${((stats?.complete || 0) / (stats?.total || 1)) * 100}%` }}
                                    ></div>
                                </div>

                                {/* Search */}
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search papers..."
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-4"
                                />

                                {/* Paper list */}
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {filteredPapers.map((paper, idx) => {
                                        const extraction = session.extractions[paper.id];
                                        const isActive = session.papers.indexOf(paper) === currentPaperIndex;

                                        return (
                                            <button
                                                key={paper.id}
                                                onClick={() => {
                                                    handleSave();
                                                    setCurrentPaperIndex(session.papers.indexOf(paper));
                                                }}
                                                className={`w-full p-3 text-left rounded-lg transition-all ${isActive
                                                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                                                    : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm line-clamp-2 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                                            {paper.title}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {paper.authors?.split(';')[0]}{paper.year ? ` (${paper.year})` : ''}
                                                        </p>
                                                    </div>
                                                    {extraction && (
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${extraction.status === 'complete' ? 'bg-emerald-400' :
                                                            extraction.status === 'in_progress' ? 'bg-amber-400' :
                                                                'bg-slate-500'
                                                            }`}></span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Export button */}
                                <button
                                    onClick={exportToCSV}
                                    className="w-full mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export to CSV
                                </button>
                            </div>
                        </div>

                        {/* Main content - Extraction form */}
                        <div className="flex-1 min-w-0">
                            {currentPaper && (
                                <>
                                    {/* Paper header */}
                                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 mb-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h2 className="text-lg font-medium text-white mb-1">{currentPaper.title}</h2>
                                                <p className="text-sm text-slate-400">
                                                    {currentPaper.authors}{currentPaper.journal ? ` • ${currentPaper.journal}` : ''}{currentPaper.year ? ` (${currentPaper.year})` : ''}
                                                </p>
                                                {currentPaper.doi && (
                                                    <a
                                                        href={`https://doi.org/${currentPaper.doi}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-cyan-400 hover:text-cyan-300"
                                                    >
                                                        {currentPaper.doi}
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-500">
                                                    {currentPaperIndex + 1} of {session.papers.length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category tabs */}
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                        {categories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setActiveCategory(cat)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat
                                                    ? 'bg-cyan-500 text-white'
                                                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Form fields */}
                                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {selectedTemplate?.fields
                                                .filter(f => f.category === activeCategory)
                                                .map(field => (
                                                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                                            {field.name}
                                                            {field.required && <span className="text-red-400 ml-1">*</span>}
                                                        </label>
                                                        {field.description && (
                                                            <p className="text-xs text-slate-500 mb-2">{field.description}</p>
                                                        )}
                                                        {renderField(field)}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between mt-4">
                                        <button
                                            onClick={goToPrevious}
                                            disabled={currentPaperIndex === 0}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            Previous
                                        </button>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleSave('in_progress')}
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                                            >
                                                Save Draft
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleSave('complete');
                                                    goToNext();
                                                }}
                                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-medium"
                                            >
                                                Mark Complete & Next
                                            </button>
                                        </div>

                                        <button
                                            onClick={goToNext}
                                            disabled={currentPaperIndex >= session.papers.length - 1}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm flex items-center gap-2"
                                        >
                                            Next
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DataExtractionTool;
