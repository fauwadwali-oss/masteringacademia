'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// Types
interface Paper {
    id: string;
    doi?: string;
    pmid?: string;
    title: string;
    abstract?: string;
    authors: { name: string; affiliation?: string }[];
    journal?: string;
    year?: number;
    url?: string;
    source: string;
    citationCount?: number;
}

interface ScreeningDecision {
    paperId: string;
    decision: 'include' | 'exclude' | 'maybe';
    reason?: string;
    notes?: string;
    decidedAt: string;
}

interface ScreeningSession {
    id: string;
    name: string;
    stage: 'title_abstract' | 'full_text';
    papers: Paper[];
    decisions: Record<string, ScreeningDecision>;
    createdAt: string;
    updatedAt: string;
}

interface ScreeningStats {
    total: number;
    pending: number;
    included: number;
    excluded: number;
    maybe: number;
}

// Exclusion reasons for quick selection
const EXCLUSION_REASONS = [
    { key: 'population', label: 'Wrong population' },
    { key: 'intervention', label: 'Wrong intervention' },
    { key: 'comparison', label: 'Wrong comparison' },
    { key: 'outcome', label: 'Wrong outcome' },
    { key: 'study_design', label: 'Wrong study design' },
    { key: 'duplicate', label: 'Duplicate' },
    { key: 'language', label: 'Language' },
    { key: 'no_full_text', label: 'No full text available' },
    { key: 'retracted', label: 'Retracted' },
    { key: 'other', label: 'Other' },
];

// API endpoint
const API_BASE = process.env.NEXT_PUBLIC_RESEARCH_API_URL || 'https://msdrills-research-api.fauwadwali.workers.dev';

const ScreeningPage: React.FC = () => {
    // State
    const [session, setSession] = useState<ScreeningSession | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showExcludeModal, setShowExcludeModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customNotes, setCustomNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'include' | 'exclude' | 'maybe'>('pending');
    const [history, setHistory] = useState<{ index: number; decision: ScreeningDecision }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate stats
    const stats: ScreeningStats = session ? {
        total: session.papers.length,
        pending: session.papers.length - Object.keys(session.decisions).length,
        included: Object.values(session.decisions).filter(d => d.decision === 'include').length,
        excluded: Object.values(session.decisions).filter(d => d.decision === 'exclude').length,
        maybe: Object.values(session.decisions).filter(d => d.decision === 'maybe').length,
    } : { total: 0, pending: 0, included: 0, excluded: 0, maybe: 0 };

    // Filtered papers based on status
    const filteredPapers = session?.papers.filter(paper => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'pending') return !session.decisions[paper.id];
        const decision = session.decisions[paper.id];
        return decision?.decision === filterStatus;
    }) || [];

    // Current paper
    const currentPaper = filteredPapers[currentIndex];

    // Navigation
    const goToNext = useCallback(() => {
        if (currentIndex < filteredPapers.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, filteredPapers.length]);

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    // Make decision
    const makeDecision = useCallback(async (decision: 'include' | 'exclude' | 'maybe', reason?: string, notes?: string) => {
        if (!session || !currentPaper) return;

        const newDecision: ScreeningDecision = {
            paperId: currentPaper.id,
            decision,
            reason,
            notes,
            decidedAt: new Date().toISOString(),
        };

        // Save to history for undo
        setHistory(prev => [...prev, { index: currentIndex, decision: newDecision }]);

        // Update session locally immediately for UI
        setSession(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                decisions: {
                    ...prev.decisions,
                    [currentPaper.id]: newDecision,
                },
                updatedAt: new Date().toISOString(),
            };
        });

        // Auto-advance to next pending paper
        setTimeout(() => {
            if (filterStatus === 'pending') {
                // Stay at same index since current paper will be filtered out
                setCurrentIndex(prev => Math.min(prev, filteredPapers.length - 2));
            } else {
                goToNext();
            }
        }, 150);

        // Sync with backend API
        try {
            await fetch(`${API_BASE}/screening/decisions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: session.id,
                    paperId: currentPaper.id,
                    decision,
                    reason,
                    notes,
                    reviewerSession: 'local_user' // Simple local user for now
                }),
            });
        } catch (e) {
            console.error('Failed to sync decision', e);
        }

    }, [session, currentPaper, currentIndex, filterStatus, filteredPapers.length, goToNext]);

    // Quick include
    const handleInclude = useCallback(() => {
        makeDecision('include');
    }, [makeDecision]);

    // Quick maybe
    const handleMaybe = useCallback(() => {
        makeDecision('maybe');
    }, [makeDecision]);

    // Exclude with reason
    const handleExclude = useCallback(() => {
        if (selectedReason) {
            makeDecision('exclude', selectedReason, customNotes);
            setShowExcludeModal(false);
            setSelectedReason('');
            setCustomNotes('');
        } else {
            setShowExcludeModal(true);
        }
    }, [selectedReason, customNotes, makeDecision]);

    // Quick exclude with reason shortcut
    const handleQuickExclude = useCallback((reason: string) => {
        makeDecision('exclude', reason);
    }, [makeDecision]);

    // Undo last decision
    const handleUndo = useCallback(async () => {
        if (history.length === 0 || !session) return;

        const lastAction = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));

        // Remove decision locally
        setSession(prev => {
            if (!prev) return prev;
            const newDecisions = { ...prev.decisions };
            delete newDecisions[lastAction.decision.paperId];
            return {
                ...prev,
                decisions: newDecisions,
            };
        });

        // Go back to that paper
        setCurrentIndex(lastAction.index);

        // Sync undo with API
        try {
            await fetch(`${API_BASE}/screening/decisions`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.id,
                    paperId: lastAction.decision.paperId,
                    reviewerSession: 'local_user'
                })
            });
        } catch (e) { console.error('Failed to undo decision', e); }

    }, [history, session]);

    // Keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if in input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ignore if modal is open but allow Escape to close it
            if (showExcludeModal) {
                if (e.key === 'Escape') {
                    setShowExcludeModal(false);
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'i':
                    handleInclude();
                    break;
                case 'e':
                    setShowExcludeModal(true);
                    break;
                case 'm':
                    handleMaybe();
                    break;
                case 'j':
                case 'arrowdown':
                    goToNext();
                    break;
                case 'k':
                case 'arrowup':
                    goToPrevious();
                    break;
                case '1':
                    handleQuickExclude('population');
                    break;
                case '2':
                    handleQuickExclude('intervention');
                    break;
                case '3':
                    handleQuickExclude('comparison');
                    break;
                case '4':
                    handleQuickExclude('outcome');
                    break;
                case '5':
                    handleQuickExclude('study_design');
                    break;
                case 'u':
                    e.preventDefault();
                    handleUndo();
                    break;
                case '?':
                    setShowHelp(prev => !prev);
                    break;
                case 'escape':
                    setShowHelp(false);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleInclude, handleMaybe, handleQuickExclude, goToNext, goToPrevious, handleUndo, showExcludeModal]);

    // Import from file (CSV/RIS)
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);

        try {
            const text = await file.text();
            let papers: Paper[] = [];

            if (file.name.endsWith('.csv')) {
                papers = parseCSV(text);
            } else if (file.name.endsWith('.ris')) {
                papers = parseRIS(text);
            } else {
                throw new Error('Unsupported file format. Use CSV or RIS.');
            }

            if (papers.length === 0) {
                throw new Error('No papers found in file');
            }

            // 1. Create session object locally for immediate feedback
            const tempSessionId = 'temp_' + Math.random().toString(36).substring(2, 9);
            const newSession: ScreeningSession = {
                id: tempSessionId, // Will update with real ID from API
                name: file.name.replace(/\.(csv|ris)$/i, ''),
                stage: 'title_abstract',
                papers,
                decisions: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            setSession(newSession);
            setCurrentIndex(0);
            setFilterStatus('pending');

            // 2. Persist to API
            const response = await fetch(`${API_BASE}/screening/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSession.name,
                    stage: 'title_abstract',
                    papers: papers,
                    sessionId: 'local_user_session', // In a real app this would be more robust
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create session on server');

            // Update session with real ID
            setSession(prev => prev ? { ...prev, id: data.session.id } : null);

            // Save to localStorage as backup
            localStorage.setItem(`screening_last_session`, JSON.stringify({ ...newSession, id: data.session.id }));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import file');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Parse CSV
    const parseCSV = (text: string): Paper[] => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

        // Find column indexes
        const titleIndex = headers.findIndex(h => h === 'title');
        const abstractIndex = headers.findIndex(h => h === 'abstract');
        const authorsIndex = headers.findIndex(h => h === 'authors');
        const journalIndex = headers.findIndex(h => h === 'journal');
        const yearIndex = headers.findIndex(h => h === 'year');
        const doiIndex = headers.findIndex(h => h === 'doi');
        const pmidIndex = headers.findIndex(h => h === 'pmid');
        const sourceIndex = headers.findIndex(h => h === 'source');

        if (titleIndex === -1) {
            throw new Error('CSV must have a "title" column');
        }

        return lines.slice(1).map((line, idx) => {
            const values = parseCSVLine(line);
            return {
                id: `paper_${idx}_${Date.now()}`,
                title: values[titleIndex] || 'No title',
                abstract: abstractIndex >= 0 ? values[abstractIndex] : undefined,
                authors: authorsIndex >= 0 ? parseAuthors(values[authorsIndex]) : [],
                journal: journalIndex >= 0 ? values[journalIndex] : undefined,
                year: yearIndex >= 0 ? parseInt(values[yearIndex]) || undefined : undefined,
                doi: doiIndex >= 0 ? values[doiIndex] : undefined,
                pmid: pmidIndex >= 0 ? values[pmidIndex] : undefined,
                source: sourceIndex >= 0 ? values[sourceIndex] : 'import',
            };
        }).filter(p => p.title && p.title !== 'No title');
    };

    // Parse CSV line handling quoted values
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

            const lines = entry.split('\n');
            let title = '';
            let abstract = '';
            let journal = '';
            let year: number | undefined;
            let doi = '';
            let pmid = '';
            let source = 'ris';
            const authors: { name: string }[] = [];

            for (const line of lines) {
                const match = line.match(/^([A-Z]{2})\s*-\s*(.+)/);
                if (!match) continue;

                const [, tag, value] = match;
                switch (tag) {
                    case 'TI':
                    case 'T1':
                        title = value.trim();
                        break;
                    case 'AB':
                        abstract = value.trim();
                        break;
                    case 'JO':
                    case 'JF':
                    case 'T2':
                        journal = value.trim();
                        break;
                    case 'PY':
                    case 'Y1':
                        year = parseInt(value.match(/\d{4}/)?.[0] || '');
                        break;
                    case 'DO':
                        doi = value.trim();
                        break;
                    case 'AN':
                        if (/^\d+$/.test(value.trim())) {
                            pmid = value.trim();
                        }
                        break;
                    case 'AU':
                    case 'A1':
                        authors.push({ name: value.trim() });
                        break;
                    case 'N1':
                        if (value.toLowerCase().includes('source:')) {
                            source = value.replace(/source:/i, '').trim();
                        }
                        break;
                }
            }

            if (title) {
                papers.push({
                    id: `paper_${papers.length}_${Date.now()}`,
                    title,
                    abstract: abstract || undefined,
                    authors,
                    journal: journal || undefined,
                    year: year || undefined,
                    doi: doi || undefined,
                    pmid: pmid || undefined,
                    source,
                });
            }
        }

        return papers;
    };

    // Parse authors string
    const parseAuthors = (str: string): { name: string }[] => {
        if (!str) return [];
        return str.split(/[;,]/).map(name => ({ name: name.trim() })).filter(a => a.name);
    };

    // Export decisions
    const exportDecisions = (format: 'csv' | 'ris') => {
        if (!session) return;

        const decidedPapers = session.papers.filter(p => session.decisions[p.id]);

        if (format === 'csv') {
            const headers = ['title', 'abstract', 'authors', 'journal', 'year', 'doi', 'pmid', 'decision', 'exclusion_reason', 'notes'];
            const rows = decidedPapers.map(paper => {
                const decision = session.decisions[paper.id];
                return [
                    escapeCSV(paper.title),
                    escapeCSV(paper.abstract || ''),
                    escapeCSV(paper.authors.map(a => a.name).join('; ')),
                    escapeCSV(paper.journal || ''),
                    paper.year?.toString() || '',
                    escapeCSV(paper.doi || ''),
                    escapeCSV(paper.pmid || ''),
                    decision.decision,
                    escapeCSV(decision.reason || ''),
                    escapeCSV(decision.notes || ''),
                ].join(',');
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadFile(csv, `screening_${session.name}.csv`, 'text/csv');
        } else {
            // Export included papers as RIS
            const includedPapers = decidedPapers.filter(p => session.decisions[p.id].decision === 'include');
            const ris = includedPapers.map(paper => {
                const lines = ['TY  - JOUR', `TI  - ${paper.title}`];
                if (paper.abstract) lines.push(`AB  - ${paper.abstract}`);
                if (paper.journal) lines.push(`JO  - ${paper.journal}`);
                if (paper.year) lines.push(`PY  - ${paper.year}`);
                if (paper.doi) lines.push(`DO  - ${paper.doi}`);
                if (paper.pmid) lines.push(`AN  - ${paper.pmid}`);
                paper.authors.forEach(a => lines.push(`AU  - ${a.name}`));
                lines.push('ER  - ');
                return lines.join('\n');
            }).join('\n');

            downloadFile(ris, `included_${session.name}.ris`, 'application/x-research-info-systems');
        }
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

    // Load saved sessions on mount
    useEffect(() => {
        // Check for saved sessions
        const lastSession = localStorage.getItem('screening_last_session');
        if (lastSession) {
            try {
                setSession(JSON.parse(lastSession));
            } catch (e) {
                console.error("Error parsing saved session", e);
            }
        }
    }, []);

    // Reset index when filter changes
    useEffect(() => {
        setCurrentIndex(0);
    }, [filterStatus]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" ref={containerRef}>
            {/* Header */}
            <nav className="border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-40">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <a href="/research" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">MS</span>
                            </div>
                            <span className="text-white font-semibold">Homepage</span>
                        </a>
                        <span className="text-slate-500">/</span>
                        <span className="text-emerald-400">Screening</span>
                        {session && (
                            <>
                                <span className="text-slate-500">/</span>
                                <span className="text-slate-300">{session.name}</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowHelp(true)}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Keyboard shortcuts (?)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.54-.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                        <a href="/research" className="text-slate-400 hover:text-white text-sm">
                            ← All Tools
                        </a>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-6">
                {/* No session - Import screen */}
                {!session && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-3">Paper Screening</h1>
                        <p className="text-slate-400 text-center max-w-md mb-8">
                            Upload your search results to screen papers for inclusion in your systematic review.
                            Use keyboard shortcuts for fast screening.
                        </p>

                        <div className="flex flex-col gap-4 w-full max-w-sm">
                            <label className="relative cursor-pointer">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.ris"
                                    onChange={handleFileImport}
                                    className="hidden"
                                />
                                <div className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium text-center transition-colors">
                                    {isLoading ? 'Importing...' : 'Import CSV or RIS File'}
                                </div>
                            </label>

                            <p className="text-xs text-slate-500 text-center">
                                Export from Literature Search or import from Zotero/EndNote
                            </p>
                        </div>

                        {error && (
                            <div className="mt-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Keyboard shortcuts preview */}
                        <div className="mt-12 p-6 bg-slate-800/30 rounded-xl border border-slate-700/50 max-w-lg">
                            <h3 className="text-sm font-medium text-white mb-4">Keyboard Shortcuts</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">I</kbd>
                                    <span className="text-slate-400">Include</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">E</kbd>
                                    <span className="text-slate-400">Exclude</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">M</kbd>
                                    <span className="text-slate-400">Maybe</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">J/K</kbd>
                                    <span className="text-slate-400">Navigate</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">1-5</kbd>
                                    <span className="text-slate-400">Quick exclude</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">U</kbd>
                                    <span className="text-slate-400">Undo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Session active - Screening interface */}
                {session && (
                    <div className="flex gap-6">
                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                            {/* Stats bar */}
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-white">{stats.pending}</div>
                                            <div className="text-xs text-slate-400">Pending</div>
                                        </div>
                                        <div className="h-8 w-px bg-slate-700"></div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-emerald-400">{stats.included}</div>
                                            <div className="text-xs text-slate-400">Included</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-red-400">{stats.excluded}</div>
                                            <div className="text-xs text-slate-400">Excluded</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-amber-400">{stats.maybe}</div>
                                            <div className="text-xs text-slate-400">Maybe</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Filter */}
                                        <select
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value as any)}
                                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
                                        >
                                            <option value="pending">Pending ({stats.pending})</option>
                                            <option value="all">All ({stats.total})</option>
                                            <option value="include">Included ({stats.included})</option>
                                            <option value="exclude">Excluded ({stats.excluded})</option>
                                            <option value="maybe">Maybe ({stats.maybe})</option>
                                        </select>

                                        {/* View toggle */}
                                        <div className="flex bg-slate-700 rounded-lg p-1">
                                            <button
                                                onClick={() => setViewMode('card')}
                                                className={`p-2 rounded ${viewMode === 'card' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Export */}
                                        <div className="relative group">
                                            <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Export
                                            </button>
                                            <div className="absolute right-0 top-full mt-1 bg-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 w-48">
                                                <button
                                                    onClick={() => exportDecisions('csv')}
                                                    className="block w-full px-4 py-2 text-sm text-left text-white hover:bg-slate-600 rounded-t-lg"
                                                >
                                                    Export All (CSV)
                                                </button>
                                                <button
                                                    onClick={() => exportDecisions('ris')}
                                                    className="block w-full px-4 py-2 text-sm text-left text-white hover:bg-slate-600 rounded-b-lg"
                                                >
                                                    Export Included (RIS)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mt-4">
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                        <div
                                            className="bg-emerald-500 transition-all"
                                            style={{ width: `${(stats.included / stats.total) * 100}%` }}
                                        ></div>
                                        <div
                                            className="bg-red-500 transition-all"
                                            style={{ width: `${(stats.excluded / stats.total) * 100}%` }}
                                        ></div>
                                        <div
                                            className="bg-amber-500 transition-all"
                                            style={{ width: `${(stats.maybe / stats.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Card view */}
                            {viewMode === 'card' && currentPaper && (
                                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 min-h-[500px]">
                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
                                        <button
                                            onClick={goToPrevious}
                                            disabled={currentIndex === 0}
                                            className="hover:text-white disabled:opacity-50"
                                        >
                                            ← Previous (K)
                                        </button>
                                        <span>
                                            Paper {currentIndex + 1} of {filteredPapers.length}
                                        </span>
                                        <button
                                            onClick={goToNext}
                                            disabled={currentIndex === filteredPapers.length - 1}
                                            className="hover:text-white disabled:opacity-50"
                                        >
                                            Next (J) →
                                        </button>
                                    </div>

                                    <h2 className="text-xl font-bold text-white mb-3">{currentPaper.title}</h2>

                                    <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
                                        {currentPaper.journal && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                {currentPaper.journal} {currentPaper.year && `(${currentPaper.year})`}
                                            </span>
                                        )}
                                        {currentPaper.authors.length > 0 && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                                {currentPaper.authors.map(a => a.name).slice(0, 3).join(', ')}
                                                {currentPaper.authors.length > 3 && ' et al.'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="prose prose-invert max-w-none mb-8">
                                        <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                                            {currentPaper.abstract || 'No abstract available.'}
                                        </p>
                                    </div>

                                    {/* Decision buttons */}
                                    <div className="flex items-center gap-4 border-t border-slate-700/50 pt-6">
                                        <button
                                            onClick={() => makeDecision('exclude')}
                                            className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-medium transition-colors flex items-center justify-center gap-2 group"
                                        >
                                            <span className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center text-xs group-hover:bg-red-500/30">E</span>
                                            Exclude
                                        </button>
                                        <button
                                            onClick={() => makeDecision('maybe')}
                                            className="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-400 font-medium transition-colors flex items-center justify-center gap-2 group"
                                        >
                                            <span className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center text-xs group-hover:bg-amber-500/30">M</span>
                                            Maybe
                                        </button>
                                        <button
                                            onClick={() => makeDecision('include')}
                                            className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 font-medium transition-colors flex items-center justify-center gap-2 group"
                                        >
                                            <span className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-xs group-hover:bg-emerald-500/30">I</span>
                                            Include
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* List view */}
                            {viewMode === 'list' && (
                                <div className="space-y-4">
                                    {filteredPapers.map((paper) => (
                                        <div key={paper.id} className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
                                            <div className="flex justify-between gap-4">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-white mb-1">{paper.title}</h4>
                                                    <div className="text-sm text-slate-400 mb-2">
                                                        {paper.year} • {paper.journal}
                                                    </div>
                                                    <p className="text-sm text-slate-400 line-clamp-2">{paper.abstract}</p>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <div className={`text-xs font-bold uppercase text-center py-1 px-2 rounded ${session.decisions[paper.id]?.decision === 'include' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        session.decisions[paper.id]?.decision === 'exclude' ? 'bg-red-500/20 text-red-400' :
                                                            session.decisions[paper.id]?.decision === 'maybe' ? 'bg-amber-500/20 text-amber-400' :
                                                                'bg-slate-700 text-slate-400'
                                                        }`}>
                                                        {session.decisions[paper.id]?.decision || 'Pending'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {filteredPapers.length === 0 && (
                                <div className="text-center py-20 text-slate-500">
                                    No papers found with status "{filterStatus}"
                                </div>
                            )}
                        </div>

                        {/* Sidebar (Cheat sheet) */}
                        <div className={`w-64 space-y-4 transition-all ${showHelp ? 'opacity-100' : 'opacity-0 w-0 hidden xl:block xl:opacity-100 xl:w-64'}`}>
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 sticky top-24">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Shortcuts</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Include</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">I</kbd>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Exclude</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">E</kbd>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Maybe</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">M</kbd>
                                    </div>
                                    <div className="h-px bg-slate-700/50 my-2"></div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Next Paper</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">J</kbd>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Prev Paper</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">K</kbd>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Undo</span>
                                        <kbd className="px-1.5 bg-slate-700 rounded text-xs text-slate-300">U</kbd>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exclusion Reasons</h3>
                                    <div className="space-y-1 text-xs text-slate-400">
                                        {EXCLUSION_REASONS.slice(0, 5).map((r, i) => (
                                            <div key={r.key} className="flex justify-between">
                                                <span className="truncate pr-2" title={r.label}>{r.label}</span>
                                                <kbd className="px-1.5 bg-slate-700 rounded text-slate-300">{i + 1}</kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Exclude Modal */}
                {showExcludeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Exclude Paper</h3>

                            <div className="space-y-2 mb-4">
                                {EXCLUSION_REASONS.map(reason => (
                                    <button
                                        key={reason.key}
                                        onClick={() => setSelectedReason(reason.key)}
                                        className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${selectedReason === reason.key
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                            }`}
                                    >
                                        {reason.label}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={customNotes}
                                onChange={(e) => setCustomNotes(e.target.value)}
                                placeholder="Optional notes..."
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 h-20 mb-6"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExcludeModal(false)}
                                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExclude}
                                    disabled={!selectedReason}
                                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium"
                                >
                                    Confirm Exclude
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ScreeningPage;
