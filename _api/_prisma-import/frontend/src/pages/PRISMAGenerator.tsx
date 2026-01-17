import React, { useState, useRef, useCallback } from 'react';

// Types
interface PRISMAData {
  // Identification
  identification: {
    databases: DatabaseResult[];
    registers: RegisterResult[];
    otherMethods: OtherMethodResult[];
  };
  // Screening
  screening: {
    duplicatesRemoved: number;
    automationExcluded: number;
    recordsScreened: number;
    recordsExcluded: number;
  };
  // Retrieval
  retrieval: {
    soughtForRetrieval: number;
    notRetrieved: number;
  };
  // Eligibility
  eligibility: {
    assessed: number;
    excluded: ExclusionReason[];
  };
  // Included
  included: {
    newStudies: number;
    previousStudies: number;
    totalStudies: number;
    reportsOfNewStudies: number;
    reportsOfPreviousStudies: number;
    totalReports: number;
  };
}

interface DatabaseResult {
  name: string;
  count: number;
}

interface RegisterResult {
  name: string;
  count: number;
}

interface OtherMethodResult {
  name: string;
  count: number;
}

interface ExclusionReason {
  reason: string;
  count: number;
}

// Default empty PRISMA data
const defaultPRISMAData: PRISMAData = {
  identification: {
    databases: [
      { name: 'PubMed', count: 0 },
      { name: 'OpenAlex', count: 0 },
      { name: 'medRxiv', count: 0 },
    ],
    registers: [],
    otherMethods: [],
  },
  screening: {
    duplicatesRemoved: 0,
    automationExcluded: 0,
    recordsScreened: 0,
    recordsExcluded: 0,
  },
  retrieval: {
    soughtForRetrieval: 0,
    notRetrieved: 0,
  },
  eligibility: {
    assessed: 0,
    excluded: [
      { reason: 'Wrong population', count: 0 },
      { reason: 'Wrong intervention', count: 0 },
      { reason: 'Wrong outcomes', count: 0 },
      { reason: 'Wrong study design', count: 0 },
    ],
  },
  included: {
    newStudies: 0,
    previousStudies: 0,
    totalStudies: 0,
    reportsOfNewStudies: 0,
    reportsOfPreviousStudies: 0,
    totalReports: 0,
  },
};

// Main Component
const PRISMAGenerator: React.FC = () => {
  const [data, setData] = useState<PRISMAData>(defaultPRISMAData);
  const [activeTab, setActiveTab] = useState<'input' | 'preview'>('input');
  const [showPreviousStudies, setShowPreviousStudies] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate derived values
  const calculated = {
    totalFromDatabases: data.identification.databases.reduce((sum, db) => sum + db.count, 0),
    totalFromRegisters: data.identification.registers.reduce((sum, r) => sum + r.count, 0),
    totalFromOther: data.identification.otherMethods.reduce((sum, o) => sum + o.count, 0),
    totalIdentified: 0,
    recordsAfterDedup: 0,
    totalExcluded: data.eligibility.excluded.reduce((sum, e) => sum + e.count, 0),
  };
  calculated.totalIdentified = calculated.totalFromDatabases + calculated.totalFromRegisters + calculated.totalFromOther;
  calculated.recordsAfterDedup = calculated.totalIdentified - data.screening.duplicatesRemoved - data.screening.automationExcluded;

  // Update handlers
  const updateDatabase = (index: number, field: 'name' | 'count', value: string | number) => {
    setData(prev => {
      const newDatabases = [...prev.identification.databases];
      newDatabases[index] = { ...newDatabases[index], [field]: value };
      return { ...prev, identification: { ...prev.identification, databases: newDatabases } };
    });
  };

  const addDatabase = () => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        databases: [...prev.identification.databases, { name: '', count: 0 }],
      },
    }));
  };

  const removeDatabase = (index: number) => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        databases: prev.identification.databases.filter((_, i) => i !== index),
      },
    }));
  };

  const updateExclusionReason = (index: number, field: 'reason' | 'count', value: string | number) => {
    setData(prev => {
      const newExcluded = [...prev.eligibility.excluded];
      newExcluded[index] = { ...newExcluded[index], [field]: value };
      return { ...prev, eligibility: { ...prev.eligibility, excluded: newExcluded } };
    });
  };

  const addExclusionReason = () => {
    setData(prev => ({
      ...prev,
      eligibility: {
        ...prev.eligibility,
        excluded: [...prev.eligibility.excluded, { reason: '', count: 0 }],
      },
    }));
  };

  const removeExclusionReason = (index: number) => {
    setData(prev => ({
      ...prev,
      eligibility: {
        ...prev.eligibility,
        excluded: prev.eligibility.excluded.filter((_, i) => i !== index),
      },
    }));
  };

  // Export functions
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prisma_flowchart.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportPNG = useCallback(async () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Set canvas size (2x for better quality)
    canvas.width = 1200;
    canvas.height = 1600;
    
    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'prisma_flowchart.png';
      a.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  // Reset data
  const resetData = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      setData(defaultPRISMAData);
    }
  };

  // Import from search results (placeholder)
  const importFromSearch = () => {
    // This would connect to the Literature Search tool
    alert('This feature will import data from your Literature Search results automatically.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/research" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            <span className="text-white font-semibold text-lg">MSDrills</span>
            <span className="text-slate-500">/</span>
            <span className="text-violet-400">PRISMA Generator</span>
          </a>
          <a href="/research" className="text-slate-400 hover:text-white text-sm">
            ← All Tools
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title & Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">PRISMA 2020 Flow Diagram</h1>
            <p className="text-slate-400 text-sm mt-1">
              Generate publication-ready flow diagrams for systematic reviews
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={importFromSearch}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import from Search
            </button>
            <button
              onClick={resetData}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'input'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Edit Data
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'preview'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Preview & Export
          </button>
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          {activeTab === 'input' && (
            <div className="space-y-6">
              {/* Identification */}
              <div className="bg-slate-800/30 rounded-xl border border-blue-500/30 p-5">
                <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">1</span>
                  Identification
                </h2>

                {/* Databases */}
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-2">Records from Databases</label>
                  {data.identification.databases.map((db, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={db.name}
                        onChange={(e) => updateDatabase(index, 'name', e.target.value)}
                        placeholder="Database name"
                        className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                      />
                      <input
                        type="number"
                        value={db.count || ''}
                        onChange={(e) => updateDatabase(index, 'count', parseInt(e.target.value) || 0)}
                        placeholder="n"
                        className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm text-center"
                      />
                      <button
                        onClick={() => removeDatabase(index)}
                        className="px-2 py-2 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addDatabase}
                    className="text-sm text-violet-400 hover:text-violet-300"
                  >
                    + Add database
                  </button>
                </div>

                <div className="text-right text-sm text-slate-400">
                  Total from databases: <span className="text-blue-400 font-medium">{calculated.totalFromDatabases}</span>
                </div>
              </div>

              {/* Screening */}
              <div className="bg-slate-800/30 rounded-xl border border-green-500/30 p-5">
                <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs">2</span>
                  Screening
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Duplicates removed</label>
                    <input
                      type="number"
                      value={data.screening.duplicatesRemoved || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        screening: { ...prev.screening, duplicatesRemoved: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Automation excluded</label>
                    <input
                      type="number"
                      value={data.screening.automationExcluded || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        screening: { ...prev.screening, automationExcluded: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Records screened</label>
                    <input
                      type="number"
                      value={data.screening.recordsScreened || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        screening: { ...prev.screening, recordsScreened: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Records excluded</label>
                    <input
                      type="number"
                      value={data.screening.recordsExcluded || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        screening: { ...prev.screening, recordsExcluded: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Retrieval */}
              <div className="bg-slate-800/30 rounded-xl border border-yellow-500/30 p-5">
                <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs">3</span>
                  Retrieval
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Sought for retrieval</label>
                    <input
                      type="number"
                      value={data.retrieval.soughtForRetrieval || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        retrieval: { ...prev.retrieval, soughtForRetrieval: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Not retrieved</label>
                    <input
                      type="number"
                      value={data.retrieval.notRetrieved || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        retrieval: { ...prev.retrieval, notRetrieved: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Eligibility */}
              <div className="bg-slate-800/30 rounded-xl border border-orange-500/30 p-5">
                <h2 className="text-lg font-semibold text-orange-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">4</span>
                  Eligibility
                </h2>

                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-1">Full-text assessed</label>
                  <input
                    type="number"
                    value={data.eligibility.assessed || ''}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      eligibility: { ...prev.eligibility, assessed: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>

                <label className="block text-sm text-slate-400 mb-2">Exclusion Reasons</label>
                {data.eligibility.excluded.map((reason, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={reason.reason}
                      onChange={(e) => updateExclusionReason(index, 'reason', e.target.value)}
                      placeholder="Reason"
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                    <input
                      type="number"
                      value={reason.count || ''}
                      onChange={(e) => updateExclusionReason(index, 'count', parseInt(e.target.value) || 0)}
                      placeholder="n"
                      className="w-20 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm text-center"
                    />
                    <button
                      onClick={() => removeExclusionReason(index)}
                      className="px-2 py-2 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addExclusionReason}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  + Add reason
                </button>

                <div className="text-right text-sm text-slate-400 mt-2">
                  Total excluded: <span className="text-orange-400 font-medium">{calculated.totalExcluded}</span>
                </div>
              </div>

              {/* Included */}
              <div className="bg-slate-800/30 rounded-xl border border-violet-500/30 p-5">
                <h2 className="text-lg font-semibold text-violet-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs">5</span>
                  Included
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Studies included</label>
                    <input
                      type="number"
                      value={data.included.newStudies || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        included: { ...prev.included, newStudies: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Reports included</label>
                    <input
                      type="number"
                      value={data.included.reportsOfNewStudies || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        included: { ...prev.included, reportsOfNewStudies: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPreviousStudies}
                      onChange={(e) => setShowPreviousStudies(e.target.checked)}
                      className="rounded border-slate-600"
                    />
                    Include previous studies (for updated reviews)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Preview Panel - Always visible on desktop, tab on mobile */}
          <div className={`${activeTab === 'preview' || window.innerWidth >= 1024 ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Preview</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportSVG}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Export SVG
                  </button>
                  <button
                    onClick={exportPNG}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Export PNG
                  </button>
                </div>
              </div>

              {/* SVG Flow Diagram */}
              <div className="bg-white rounded-lg p-4 overflow-auto">
                <PRISMAFlowDiagram
                  ref={svgRef}
                  data={data}
                  calculated={calculated}
                  showPreviousStudies={showPreviousStudies}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PRISMA 2020 Reference */}
        <div className="mt-8 bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-white font-medium mb-2">PRISMA 2020 Reference</h3>
          <p className="text-sm text-slate-400">
            Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. 
            <a 
              href="https://doi.org/10.1136/bmj.n71" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 ml-1"
            >
              BMJ 2021;372:n71
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-slate-500">
          <span>MSDrills Research Tools • PRISMA 2020 Compliant</span>
          <a href="/research" className="text-violet-400 hover:text-violet-300">
            Back to Research Tools
          </a>
        </div>
      </footer>
    </div>
  );
};

// PRISMA Flow Diagram SVG Component
interface PRISMAFlowDiagramProps {
  data: PRISMAData;
  calculated: {
    totalFromDatabases: number;
    totalFromRegisters: number;
    totalFromOther: number;
    totalIdentified: number;
    recordsAfterDedup: number;
    totalExcluded: number;
  };
  showPreviousStudies: boolean;
}

const PRISMAFlowDiagram = React.forwardRef<SVGSVGElement, PRISMAFlowDiagramProps>(
  ({ data, calculated, showPreviousStudies }, ref) => {
    const width = 600;
    const height = 800;
    
    // Box dimensions
    const boxWidth = 180;
    const boxHeight = 60;
    const smallBoxWidth = 140;
    const smallBoxHeight = 50;
    
    // Colors
    const colors = {
      identification: '#3b82f6',
      screening: '#22c55e',
      eligibility: '#f59e0b',
      included: '#8b5cf6',
      excluded: '#ef4444',
      text: '#1f2937',
      border: '#e5e7eb',
      background: '#f9fafb',
    };

    // Format database list
    const databaseList = data.identification.databases
      .filter(db => db.name && db.count > 0)
      .map(db => `${db.name} (n = ${db.count})`)
      .join('\n');

    // Format exclusion reasons
    const exclusionList = data.eligibility.excluded
      .filter(e => e.reason && e.count > 0)
      .map(e => `${e.reason} (n = ${e.count})`)
      .join('\n');

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Background */}
        <rect width={width} height={height} fill="white" />

        {/* Title */}
        <text x={width / 2} y={30} textAnchor="middle" fontSize={16} fontWeight="bold" fill={colors.text}>
          PRISMA 2020 Flow Diagram
        </text>

        {/* IDENTIFICATION Section */}
        <g transform="translate(0, 50)">
          {/* Section Label */}
          <text x={20} y={20} fontSize={12} fontWeight="bold" fill={colors.identification}>
            Identification
          </text>

          {/* Records from databases */}
          <rect
            x={50}
            y={35}
            width={boxWidth}
            height={boxHeight + 20}
            fill={colors.background}
            stroke={colors.identification}
            strokeWidth={2}
            rx={4}
          />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Records identified from:
          </text>
          <text x={140} y={70} textAnchor="middle" fontSize={9} fill={colors.text}>
            Databases (n = {calculated.totalFromDatabases})
          </text>
          {data.identification.databases.slice(0, 3).map((db, i) => (
            <text key={i} x={140} y={82 + i * 10} textAnchor="middle" fontSize={8} fill="#6b7280">
              {db.name}: {db.count}
            </text>
          ))}

          {/* Records from registers (if any) */}
          {calculated.totalFromRegisters > 0 && (
            <>
              <rect
                x={370}
                y={35}
                width={boxWidth}
                height={boxHeight}
                fill={colors.background}
                stroke={colors.identification}
                strokeWidth={2}
                rx={4}
              />
              <text x={460} y={60} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
                Records from registers:
              </text>
              <text x={460} y={75} textAnchor="middle" fontSize={10} fill={colors.text}>
                (n = {calculated.totalFromRegisters})
              </text>
            </>
          )}
        </g>

        {/* Arrow down */}
        <line x1={140} y1={165} x2={140} y2={190} stroke={colors.text} strokeWidth={1.5} markerEnd="url(#arrowhead)" />

        {/* SCREENING Section */}
        <g transform="translate(0, 190)">
          {/* Section Label */}
          <text x={20} y={20} fontSize={12} fontWeight="bold" fill={colors.screening}>
            Screening
          </text>

          {/* Duplicates removed box */}
          <rect
            x={300}
            y={10}
            width={smallBoxWidth}
            height={smallBoxHeight}
            fill={colors.background}
            stroke={colors.excluded}
            strokeWidth={1.5}
            rx={4}
          />
          <text x={370} y={30} textAnchor="middle" fontSize={9} fill={colors.text}>
            Duplicates removed:
          </text>
          <text x={370} y={45} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            (n = {data.screening.duplicatesRemoved})
          </text>

          {/* Records after dedup */}
          <rect
            x={50}
            y={35}
            width={boxWidth}
            height={boxHeight}
            fill={colors.background}
            stroke={colors.screening}
            strokeWidth={2}
            rx={4}
          />
          <text x={140} y={60} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Records screened
          </text>
          <text x={140} y={78} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.screening.recordsScreened || calculated.recordsAfterDedup})
          </text>

          {/* Arrow to excluded */}
          <line x1={230} y1={65} x2={295} y2={35} stroke={colors.text} strokeWidth={1} />

          {/* Records excluded */}
          <rect
            x={300}
            y={70}
            width={smallBoxWidth}
            height={smallBoxHeight}
            fill={colors.background}
            stroke={colors.excluded}
            strokeWidth={1.5}
            rx={4}
          />
          <text x={370} y={90} textAnchor="middle" fontSize={9} fill={colors.text}>
            Records excluded:
          </text>
          <text x={370} y={105} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            (n = {data.screening.recordsExcluded})
          </text>

          {/* Arrow to excluded */}
          <line x1={230} y1={65} x2={295} y2={95} stroke={colors.text} strokeWidth={1} />
        </g>

        {/* Arrow down */}
        <line x1={140} y1={310} x2={140} y2={340} stroke={colors.text} strokeWidth={1.5} markerEnd="url(#arrowhead)" />

        {/* RETRIEVAL Section */}
        <g transform="translate(0, 340)">
          {/* Sought for retrieval */}
          <rect
            x={50}
            y={10}
            width={boxWidth}
            height={boxHeight}
            fill={colors.background}
            stroke={colors.eligibility}
            strokeWidth={2}
            rx={4}
          />
          <text x={140} y={35} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Reports sought for retrieval
          </text>
          <text x={140} y={53} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.retrieval.soughtForRetrieval})
          </text>

          {/* Not retrieved */}
          <rect
            x={300}
            y={10}
            width={smallBoxWidth}
            height={smallBoxHeight}
            fill={colors.background}
            stroke={colors.excluded}
            strokeWidth={1.5}
            rx={4}
          />
          <text x={370} y={30} textAnchor="middle" fontSize={9} fill={colors.text}>
            Reports not retrieved:
          </text>
          <text x={370} y={45} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            (n = {data.retrieval.notRetrieved})
          </text>

          {/* Arrow to not retrieved */}
          <line x1={230} y1={40} x2={295} y2={35} stroke={colors.text} strokeWidth={1} />
        </g>

        {/* Arrow down */}
        <line x1={140} y1={420} x2={140} y2={450} stroke={colors.text} strokeWidth={1.5} markerEnd="url(#arrowhead)" />

        {/* ELIGIBILITY Section */}
        <g transform="translate(0, 450)">
          {/* Section Label */}
          <text x={20} y={20} fontSize={12} fontWeight="bold" fill={colors.eligibility}>
            Eligibility
          </text>

          {/* Full-text assessed */}
          <rect
            x={50}
            y={30}
            width={boxWidth}
            height={boxHeight}
            fill={colors.background}
            stroke={colors.eligibility}
            strokeWidth={2}
            rx={4}
          />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Reports assessed for eligibility
          </text>
          <text x={140} y={73} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.eligibility.assessed})
          </text>

          {/* Excluded with reasons */}
          <rect
            x={300}
            y={10}
            width={smallBoxWidth + 40}
            height={boxHeight + 30}
            fill={colors.background}
            stroke={colors.excluded}
            strokeWidth={1.5}
            rx={4}
          />
          <text x={390} y={28} textAnchor="middle" fontSize={9} fill={colors.text}>
            Reports excluded (n = {calculated.totalExcluded}):
          </text>
          {data.eligibility.excluded.slice(0, 4).map((reason, i) => (
            <text key={i} x={390} y={42 + i * 12} textAnchor="middle" fontSize={8} fill="#6b7280">
              {reason.reason}: {reason.count}
            </text>
          ))}

          {/* Arrow to excluded */}
          <line x1={230} y1={60} x2={295} y2={50} stroke={colors.text} strokeWidth={1} />
        </g>

        {/* Arrow down */}
        <line x1={140} y1={560} x2={140} y2={590} stroke={colors.text} strokeWidth={1.5} markerEnd="url(#arrowhead)" />

        {/* INCLUDED Section */}
        <g transform="translate(0, 590)">
          {/* Section Label */}
          <text x={20} y={20} fontSize={12} fontWeight="bold" fill={colors.included}>
            Included
          </text>

          {/* Studies included */}
          <rect
            x={50}
            y={30}
            width={boxWidth}
            height={boxHeight + 20}
            fill={colors.background}
            stroke={colors.included}
            strokeWidth={2}
            rx={4}
          />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Studies included in review
          </text>
          <text x={140} y={73} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.included.newStudies})
          </text>
          <text x={140} y={90} textAnchor="middle" fontSize={9} fill="#6b7280">
            Reports: {data.included.reportsOfNewStudies}
          </text>
        </g>

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={colors.text} />
          </marker>
        </defs>

        {/* Footer */}
        <text x={width / 2} y={height - 20} textAnchor="middle" fontSize={8} fill="#9ca3af">
          Generated by MSDrills Research Tools • PRISMA 2020 Template
        </text>
      </svg>
    );
  }
);

PRISMAFlowDiagram.displayName = 'PRISMAFlowDiagram';

export default PRISMAGenerator;
