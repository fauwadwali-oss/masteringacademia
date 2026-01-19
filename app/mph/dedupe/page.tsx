'use client';

import React, { useState, useCallback, useRef } from 'react';

// Types
interface Paper {
  id: string;
  doi?: string;
  pmid?: string;
  title: string;
  titleNormalized: string;
  abstract?: string;
  authors: string;
  journal?: string;
  year?: number;
  source: string;
  originalIndex: number;
}

interface DuplicateGroup {
  master: Paper;
  duplicates: Paper[];
  matchType: 'doi' | 'pmid' | 'title';
  similarity?: number;
}

interface DedupeStats {
  totalInput: number;
  uniqueOutput: number;
  duplicatesRemoved: number;
  byMatchType: {
    doi: number;
    pmid: number;
    title: number;
  };
  bySource: Record<string, { input: number; output: number }>;
}

// Similarity threshold for fuzzy title matching
const TITLE_SIMILARITY_THRESHOLD = 0.90;

const DeduplicationPage: React.FC = () => {
  // State
  const [papers, setPapers] = useState<Paper[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [uniquePapers, setUniquePapers] = useState<Paper[]>([]);
  const [stats, setStats] = useState<DedupeStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(TITLE_SIMILARITY_THRESHOLD);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize title for comparison
  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  };

  // Calculate Jaccard similarity between two strings
  const calculateSimilarity = (a: string, b: string): number => {
    const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  };

  // Parse CSV file
  const parseCSV = (text: string): Paper[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Find column indexes
    const titleIndex = headers.findIndex(h => h === 'title');
    const abstractIndex = headers.findIndex(h => h === 'abstract');
    const authorsIndex = headers.findIndex(h => h === 'authors' || h === 'author');
    const journalIndex = headers.findIndex(h => h === 'journal' || h === 'publication');
    const yearIndex = headers.findIndex(h => h === 'year' || h === 'publication_year');
    const doiIndex = headers.findIndex(h => h === 'doi');
    const pmidIndex = headers.findIndex(h => h === 'pmid');
    const sourceIndex = headers.findIndex(h => h === 'source' || h === 'database');

    if (titleIndex === -1) {
      throw new Error('CSV must have a "title" column');
    }

    return lines.slice(1).map((line, idx) => {
      const values = parseCSVLine(line);
      const title = values[titleIndex] || '';
      return {
        id: `paper_${idx}`,
        title,
        titleNormalized: normalizeTitle(title),
        abstract: abstractIndex >= 0 ? values[abstractIndex] : undefined,
        authors: authorsIndex >= 0 ? values[authorsIndex] : '',
        journal: journalIndex >= 0 ? values[journalIndex] : undefined,
        year: yearIndex >= 0 ? parseInt(values[yearIndex]) || undefined : undefined,
        doi: doiIndex >= 0 ? cleanDOI(values[doiIndex]) : undefined,
        pmid: pmidIndex >= 0 ? values[pmidIndex]?.replace(/\D/g, '') : undefined,
        source: sourceIndex >= 0 ? values[sourceIndex] : 'csv',
        originalIndex: idx,
      };
    }).filter(p => p.title);
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

  // Clean DOI format
  const cleanDOI = (doi: string): string | undefined => {
    if (!doi) return undefined;
    // Remove URL prefix if present
    const cleaned = doi.replace(/^https?:\/\/doi\.org\//i, '').trim();
    // Validate basic DOI format
    if (/^10\.\d{4,}\//.test(cleaned)) {
      return cleaned.toLowerCase();
    }
    return undefined;
  };

  // Parse RIS file
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
      let doi: string | undefined;
      let pmid: string | undefined;
      let source = 'ris';
      const authors: string[] = [];

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
            doi = cleanDOI(value.trim());
            break;
          case 'AN':
            if (/^\d+$/.test(value.trim())) {
              pmid = value.trim();
            }
            break;
          case 'AU':
          case 'A1':
            authors.push(value.trim());
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
          id: `paper_${papers.length}`,
          title,
          titleNormalized: normalizeTitle(title),
          abstract: abstract || undefined,
          authors: authors.join('; '),
          journal: journal || undefined,
          year: year || undefined,
          doi,
          pmid,
          source,
          originalIndex: papers.length,
        });
      }
    }

    return papers;
  };

  // Perform deduplication
  const deduplicate = useCallback((inputPapers: Paper[], threshold: number): {
    unique: Paper[];
    groups: DuplicateGroup[];
    stats: DedupeStats;
  } => {
    const unique: Paper[] = [];
    const groups: DuplicateGroup[] = [];
    const seen = {
      dois: new Map<string, Paper>(),
      pmids: new Map<string, Paper>(),
      titles: new Map<string, Paper>(),
    };
    const matchCounts = { doi: 0, pmid: 0, title: 0 };
    const sourceStats: Record<string, { input: number; output: number }> = {};

    // Count inputs by source
    for (const paper of inputPapers) {
      if (!sourceStats[paper.source]) {
        sourceStats[paper.source] = { input: 0, output: 0 };
      }
      sourceStats[paper.source].input++;
    }

    for (const paper of inputPapers) {
      let isDuplicate = false;
      let matchType: 'doi' | 'pmid' | 'title' = 'title';
      let masterPaper: Paper | undefined;
      let similarity: number | undefined;

      // Check DOI match (exact)
      if (paper.doi) {
        const existing = seen.dois.get(paper.doi);
        if (existing) {
          isDuplicate = true;
          matchType = 'doi';
          masterPaper = existing;
        } else {
          seen.dois.set(paper.doi, paper);
        }
      }

      // Check PMID match (exact)
      if (!isDuplicate && paper.pmid) {
        const existing = seen.pmids.get(paper.pmid);
        if (existing) {
          isDuplicate = true;
          matchType = 'pmid';
          masterPaper = existing;
        } else {
          seen.pmids.set(paper.pmid, paper);
        }
      }

      // Check title similarity (fuzzy)
      if (!isDuplicate && paper.titleNormalized) {
        for (const [existingTitle, existingPaper] of seen.titles) {
          const sim = calculateSimilarity(paper.titleNormalized, existingTitle);
          if (sim >= threshold) {
            isDuplicate = true;
            matchType = 'title';
            masterPaper = existingPaper;
            similarity = sim;
            break;
          }
        }
        if (!isDuplicate) {
          seen.titles.set(paper.titleNormalized, paper);
        }
      }

      if (isDuplicate && masterPaper) {
        matchCounts[matchType]++;

        // Find or create group
        let group = groups.find(g => g.master.id === masterPaper!.id);
        if (!group) {
          group = {
            master: masterPaper,
            duplicates: [],
            matchType,
            similarity,
          };
          groups.push(group);
        }
        group.duplicates.push(paper);
      } else {
        unique.push(paper);
        sourceStats[paper.source].output++;
      }
    }

    return {
      unique,
      groups,
      stats: {
        totalInput: inputPapers.length,
        uniqueOutput: unique.length,
        duplicatesRemoved: inputPapers.length - unique.length,
        byMatchType: matchCounts,
        bySource: sourceStats,
      },
    };
  }, []);

  // Handle file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setPapers([]);
    setDuplicateGroups([]);
    setUniquePapers([]);
    setStats(null);

    try {
      const text = await file.text();
      let parsed: Paper[] = [];

      if (file.name.endsWith('.csv')) {
        parsed = parseCSV(text);
      } else if (file.name.endsWith('.ris')) {
        parsed = parseRIS(text);
      } else {
        throw new Error('Unsupported file format. Use CSV or RIS.');
      }

      if (parsed.length === 0) {
        throw new Error('No papers found in file');
      }

      setPapers(parsed);

      // Run deduplication
      const result = deduplicate(parsed, similarityThreshold);
      setUniquePapers(result.unique);
      setDuplicateGroups(result.groups);
      setStats(result.stats);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Re-run deduplication with new threshold
  const handleThresholdChange = (newThreshold: number) => {
    setSimilarityThreshold(newThreshold);
    if (papers.length > 0) {
      setIsProcessing(true);
      setTimeout(() => {
        const result = deduplicate(papers, newThreshold);
        setUniquePapers(result.unique);
        setDuplicateGroups(result.groups);
        setStats(result.stats);
        setIsProcessing(false);
      }, 0);
    }
  };

  // Export functions
  const exportToCSV = () => {
    const headers = ['title', 'abstract', 'authors', 'journal', 'year', 'doi', 'pmid', 'source'];
    const rows = uniquePapers.map(paper => [
      escapeCSV(paper.title),
      escapeCSV(paper.abstract || ''),
      escapeCSV(paper.authors),
      escapeCSV(paper.journal || ''),
      paper.year?.toString() || '',
      escapeCSV(paper.doi || ''),
      escapeCSV(paper.pmid || ''),
      escapeCSV(paper.source),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, 'deduplicated_papers.csv', 'text/csv');
  };

  const exportToRIS = () => {
    const ris = uniquePapers.map(paper => {
      const lines = ['TY  - JOUR', `TI  - ${paper.title}`];
      if (paper.abstract) lines.push(`AB  - ${paper.abstract}`);
      if (paper.journal) lines.push(`JO  - ${paper.journal}`);
      if (paper.year) lines.push(`PY  - ${paper.year}`);
      if (paper.doi) lines.push(`DO  - ${paper.doi}`);
      if (paper.pmid) lines.push(`AN  - ${paper.pmid}`);
      if (paper.authors) {
        paper.authors.split(/[;,]/).forEach(author => {
          if (author.trim()) lines.push(`AU  - ${author.trim()}`);
        });
      }
      lines.push(`N1  - Source: ${paper.source}`);
      lines.push('ER  - ');
      return lines.join('\n');
    }).join('\n');

    downloadFile(ris, 'deduplicated_papers.ris', 'application/x-research-info-systems');
  };

  const exportDuplicateReport = () => {
    const headers = ['group', 'match_type', 'similarity', 'title', 'doi', 'pmid', 'source', 'status'];
    const rows: string[] = [];

    duplicateGroups.forEach((group, idx) => {
      // Master paper
      rows.push([
        (idx + 1).toString(),
        group.matchType,
        group.similarity?.toFixed(2) || '1.00',
        escapeCSV(group.master.title),
        escapeCSV(group.master.doi || ''),
        escapeCSV(group.master.pmid || ''),
        escapeCSV(group.master.source),
        'kept',
      ].join(','));

      // Duplicates
      group.duplicates.forEach(dup => {
        rows.push([
          (idx + 1).toString(),
          group.matchType,
          group.similarity?.toFixed(2) || '1.00',
          escapeCSV(dup.title),
          escapeCSV(dup.doi || ''),
          escapeCSV(dup.pmid || ''),
          escapeCSV(dup.source),
          'removed',
        ].join(','));
      });
    });

    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, 'duplicate_report.csv', 'text/csv');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/mph" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            <span className="text-white font-semibold text-lg">Homepage</span>
            <span className="text-slate-500">/</span>
            <span className="text-orange-400">Deduplication</span>
          </a>
          <a href="/mph" className="text-slate-400 hover:text-white text-sm">
            ← All Tools
          </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Paper Deduplication</h1>
              <p className="text-slate-400 text-sm">
                Remove duplicate papers from your search results using DOI, PMID, and fuzzy title matching
              </p>
            </div>

            {stats && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white"
                >
                  {showDuplicates ? 'Hide' : 'Show'} Duplicates ({stats.duplicatesRemoved})
                </button>
              </div>
            )}
          </div>

          {/* File Upload */}
          {!stats && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ris"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <span className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-white font-medium transition-colors inline-block">
                  {isProcessing ? 'Processing...' : 'Upload CSV or RIS File'}
                </span>
              </label>
              <p className="mt-3 text-sm text-slate-500">
                Supports exports from PubMed, Zotero, EndNote, ASReview
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="text-3xl font-bold text-white">{stats.totalInput.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Input Papers</div>
              </div>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="text-3xl font-bold text-orange-400">{stats.duplicatesRemoved.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Duplicates Found</div>
              </div>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="text-3xl font-bold text-emerald-400">{stats.uniqueOutput.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Unique Papers</div>
              </div>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="text-3xl font-bold text-violet-400">
                  {((stats.duplicatesRemoved / stats.totalInput) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-slate-400">Reduction</div>
              </div>
            </div>

            {/* Match Type Breakdown */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
              <h3 className="text-sm font-medium text-white mb-4">Duplicates by Match Type</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-slate-300">DOI: {stats.byMatchType.doi}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-slate-300">PMID: {stats.byMatchType.pmid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-slate-300">Title: {stats.byMatchType.title}</span>
                </div>
              </div>

              {/* Threshold slider */}
              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Title Similarity Threshold</label>
                  <span className="text-sm text-white font-mono">{(similarityThreshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="100"
                  value={similarityThreshold * 100}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>70% (more matches)</span>
                  <span>100% (exact only)</span>
                </div>
              </div>
            </div>

            {/* Source Breakdown */}
            {Object.keys(stats.bySource).length > 1 && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
                <h3 className="text-sm font-medium text-white mb-4">Papers by Source</h3>
                <div className="space-y-2">
                  {Object.entries(stats.bySource).map(([source, counts]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-slate-300 capitalize">{source}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">{counts.input} input</span>
                        <span className="text-emerald-400">{counts.output} unique</span>
                        <span className="text-orange-400">
                          -{counts.input - counts.output} removed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate Groups */}
            {showDuplicates && duplicateGroups.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
                <h3 className="text-sm font-medium text-white mb-4">
                  Duplicate Groups ({duplicateGroups.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {duplicateGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50"
                    >
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${group.matchType === 'doi' ? 'bg-blue-500/20 text-blue-400' :
                              group.matchType === 'pmid' ? 'bg-green-500/20 text-green-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                              {group.matchType.toUpperCase()}
                              {group.similarity && ` ${(group.similarity * 100).toFixed(0)}%`}
                            </span>
                            <span className="text-xs text-slate-500">
                              {group.duplicates.length + 1} papers
                            </span>
                          </div>
                          <h4 className="text-sm text-white line-clamp-1">{group.master.title}</h4>
                        </div>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${expandedGroup === idx ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {expandedGroup === idx && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">KEPT</span>
                            <span className="text-slate-400">{group.master.source}</span>
                            {group.master.doi && <span className="text-slate-500">DOI: {group.master.doi}</span>}
                          </div>
                          {group.duplicates.map((dup, dupIdx) => (
                            <div key={dupIdx} className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">REMOVED</span>
                              <span className="text-slate-400">{dup.source}</span>
                              {dup.doi && <span className="text-slate-500">DOI: {dup.doi}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Buttons */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-sm font-medium text-white mb-4">Export Results</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Unique Papers (CSV)
                </button>
                <button
                  onClick={exportToRIS}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Unique Papers (RIS)
                </button>
                <button
                  onClick={exportDuplicateReport}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Duplicate Report (CSV)
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <button
                  onClick={() => {
                    setPapers([]);
                    setUniquePapers([]);
                    setDuplicateGroups([]);
                    setStats(null);
                    setShowDuplicates(false);
                  }}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  ← Process another file
                </button>
              </div>
            </div>
          </>
        )}

        {/* How it works */}
        {!stats && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-medium text-white mb-4">How It Works</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                  <span className="text-blue-400 font-bold">1</span>
                </div>
                <h4 className="text-white font-medium mb-1">DOI Match</h4>
                <p className="text-sm text-slate-400">
                  Exact DOI matching catches identical papers across databases
                </p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                  <span className="text-green-400 font-bold">2</span>
                </div>
                <h4 className="text-white font-medium mb-1">PMID Match</h4>
                <p className="text-sm text-slate-400">
                  PubMed IDs identify the same paper even with DOI variations
                </p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mb-3">
                  <span className="text-orange-400 font-bold">3</span>
                </div>
                <h4 className="text-white font-medium mb-1">Title Similarity</h4>
                <p className="text-sm text-slate-400">
                  Jaccard similarity (90% default) catches near-identical titles
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DeduplicationPage;
