import React, { useState, useRef, useCallback, useEffect } from 'react';
import PRISMAChecklist, { ChecklistState } from '../components/PRISMAChecklist';

// Types
interface PRISMAData {
  identification: {
    databases: DatabaseResult[];
    registers: RegisterResult[];
    otherMethods: OtherMethodResult[];
  };
  screening: {
    duplicatesRemoved: number;
    automationExcluded: number;
    recordsScreened: number;
    recordsExcluded: number;
  };
  retrieval: {
    soughtForRetrieval: number;
    notRetrieved: number;
  };
  eligibility: {
    assessed: number;
    excluded: ExclusionReason[];
  };
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

// Session ID for anonymous users
const getSessionId = () => {
  let sessionId = localStorage.getItem('msdrills_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('msdrills_session_id', sessionId);
  }
  return sessionId;
};

// Main Component
const PRISMAGeneratorFull: React.FC = () => {
  const [data, setData] = useState<PRISMAData>(defaultPRISMAData);
  const [checklistState, setChecklistState] = useState<ChecklistState>({});
  const [activeTab, setActiveTab] = useState<'flowchart' | 'checklist'>('flowchart');
  const [activePanel, setActivePanel] = useState<'input' | 'preview'>('input');
  const [showPreviousStudies, setShowPreviousStudies] = useState(false);
  const [showRegisters, setShowRegisters] = useState(false);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // API URL
  const API_URL = import.meta.env.VITE_RESEARCH_API_URL || 'http://localhost:8787';

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

  // Load saved data from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      loadSavedPRISMA(id);
    }
  }, []);

  // Load saved PRISMA data
  const loadSavedPRISMA = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/prisma/${id}`);
      if (response.ok) {
        const saved = await response.json();
        if (saved.data) {
          setData(saved.data);
        }
        if (saved.checklist) {
          setChecklistState(saved.checklist);
        }
        setSavedId(id);
      }
    } catch (error) {
      console.error('Failed to load PRISMA:', error);
    }
  };

  // Save PRISMA data
  const savePRISMA = async () => {
    setIsSaving(true);
    try {
      const sessionId = getSessionId();
      const method = savedId ? 'PUT' : 'POST';
      const url = savedId ? `${API_URL}/prisma/${savedId}` : `${API_URL}/prisma`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ...data,
          checklist: checklistState,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSavedId(result.id);
        // Update URL with ID for sharing
        window.history.replaceState({}, '', `?id=${result.id}`);
        alert('Saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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

  const updateRegister = (index: number, field: 'name' | 'count', value: string | number) => {
    setData(prev => {
      const newRegisters = [...prev.identification.registers];
      newRegisters[index] = { ...newRegisters[index], [field]: value };
      return { ...prev, identification: { ...prev.identification, registers: newRegisters } };
    });
  };

  const addRegister = () => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        registers: [...prev.identification.registers, { name: '', count: 0 }],
      },
    }));
  };

  const removeRegister = (index: number) => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        registers: prev.identification.registers.filter((_, i) => i !== index),
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

  // Export SVG
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prisma_2020_flowchart.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Export PNG (high resolution)
  const exportPNG = useCallback(async () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // High resolution (3x for print quality)
    canvas.width = 1800;
    canvas.height = 2400;
    
    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'prisma_2020_flowchart.png';
      a.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  // Export Word document
  const exportWord = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/prisma/export/docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prisma_2020_flowchart.docx';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      // Fallback: Generate simple HTML that Word can open
      const html = generateWordHTML();
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prisma_2020_flowchart.doc';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [data, API_URL]);

  // Generate HTML for Word export
  const generateWordHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PRISMA 2020 Flow Diagram</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #1f2937; }
    .section { margin: 20px 0; padding: 15px; border: 2px solid; border-radius: 8px; }
    .identification { border-color: #3b82f6; }
    .screening { border-color: #22c55e; }
    .eligibility { border-color: #f59e0b; }
    .included { border-color: #8b5cf6; }
    .section-title { font-weight: bold; margin-bottom: 10px; }
    .identification .section-title { color: #3b82f6; }
    .screening .section-title { color: #22c55e; }
    .eligibility .section-title { color: #f59e0b; }
    .included .section-title { color: #8b5cf6; }
    .box { background: #f9fafb; padding: 10px; margin: 10px 0; border-radius: 4px; }
    .excluded { background: #fef2f2; border-left: 3px solid #ef4444; }
    .arrow { text-align: center; font-size: 24px; color: #6b7280; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <h1>PRISMA 2020 Flow Diagram</h1>
  
  <div class="section identification">
    <div class="section-title">IDENTIFICATION</div>
    <div class="box">
      <strong>Records identified from databases (n = ${calculated.totalFromDatabases}):</strong>
      <ul>
        ${data.identification.databases.map(db => `<li>${db.name}: ${db.count}</li>`).join('')}
      </ul>
    </div>
    ${calculated.totalFromRegisters > 0 ? `
    <div class="box">
      <strong>Records from registers (n = ${calculated.totalFromRegisters})</strong>
    </div>
    ` : ''}
  </div>
  
  <div class="arrow">↓</div>
  
  <div class="section screening">
    <div class="section-title">SCREENING</div>
    <div class="box">
      <strong>Records after duplicates removed:</strong> ${calculated.recordsAfterDedup}
    </div>
    <div class="box excluded">
      <strong>Duplicates removed:</strong> ${data.screening.duplicatesRemoved}<br>
      <strong>Marked as ineligible by automation:</strong> ${data.screening.automationExcluded}
    </div>
    <div class="box">
      <strong>Records screened:</strong> ${data.screening.recordsScreened}
    </div>
    <div class="box excluded">
      <strong>Records excluded:</strong> ${data.screening.recordsExcluded}
    </div>
  </div>
  
  <div class="arrow">↓</div>
  
  <div class="section eligibility">
    <div class="section-title">ELIGIBILITY</div>
    <div class="box">
      <strong>Reports sought for retrieval:</strong> ${data.retrieval.soughtForRetrieval}
    </div>
    <div class="box excluded">
      <strong>Reports not retrieved:</strong> ${data.retrieval.notRetrieved}
    </div>
    <div class="box">
      <strong>Reports assessed for eligibility:</strong> ${data.eligibility.assessed}
    </div>
    <div class="box excluded">
      <strong>Reports excluded (n = ${calculated.totalExcluded}):</strong>
      <ul>
        ${data.eligibility.excluded.filter(e => e.reason && e.count > 0).map(e => `<li>${e.reason}: ${e.count}</li>`).join('')}
      </ul>
    </div>
  </div>
  
  <div class="arrow">↓</div>
  
  <div class="section included">
    <div class="section-title">INCLUDED</div>
    <div class="box">
      <strong>Studies included in review:</strong> ${data.included.newStudies}<br>
      <strong>Reports of included studies:</strong> ${data.included.reportsOfNewStudies}
    </div>
  </div>
  
  <div class="footer">
    Generated by MSDrills Research Tools • PRISMA 2020 Template<br>
    Reference: Page MJ, et al. BMJ 2021;372:n71
  </div>
</body>
</html>`;
  };

  // Reset data
  const resetData = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      setData(defaultPRISMAData);
      setChecklistState({});
      setSavedId(null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  // Import from search results
  const importFromSearch = async () => {
    const searchId = prompt('Enter your search ID (from Literature Search tool):');
    if (!searchId) return;

    try {
      const sessionId = getSessionId();
      const response = await fetch(`${API_URL}/prisma/from-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchId, sessionId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setData(prev => ({
            ...prev,
            identification: result.data.identification,
            screening: {
              ...prev.screening,
              duplicatesRemoved: result.data.screening.duplicatesRemoved,
              recordsScreened: result.data.screening.recordsScreened,
            },
          }));
          setSavedId(result.id);
          alert('Search data imported successfully!');
        }
      } else {
        alert('Could not find search results. Make sure the search ID is correct.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import search data.');
    }
  };

  // Copy shareable link
  const copyShareLink = () => {
    if (savedId) {
      const url = `${window.location.origin}${window.location.pathname}?id=${savedId}`;
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } else {
      alert('Please save first to generate a shareable link.');
    }
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
          <div className="flex items-center gap-3">
            <button
              onClick={copyShareLink}
              className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Share Link
            </button>
            <a href="/research" className="text-slate-400 hover:text-white text-sm">
              ← All Tools
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">PRISMA 2020 Generator</h1>
            <p className="text-slate-400 text-sm mt-1">
              Create flow diagrams and track checklist compliance
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={importFromSearch}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import from Search
            </button>
            <button
              onClick={savePRISMA}
              disabled={isSaving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : savedId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetData}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('flowchart')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'flowchart'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Flow Diagram
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'checklist'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Checklist (27 items)
          </button>
        </div>

        {/* Flow Diagram Tab */}
        {activeTab === 'flowchart' && (
          <>
            {/* Sub-tabs for mobile */}
            <div className="flex gap-2 mb-6 lg:hidden">
              <button
                onClick={() => setActivePanel('input')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activePanel === 'input'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800/50 text-slate-400'
                }`}
              >
                Edit Data
              </button>
              <button
                onClick={() => setActivePanel('preview')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activePanel === 'preview'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800/50 text-slate-400'
                }`}
              >
                Preview
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Panel */}
              <div className={`space-y-6 ${activePanel === 'preview' ? 'hidden lg:block' : ''}`}>
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
                          title="Remove"
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

                  {/* Registers toggle */}
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRegisters}
                        onChange={(e) => setShowRegisters(e.target.checked)}
                        className="rounded border-slate-600"
                      />
                      Include registers (e.g., ClinicalTrials.gov, PROSPERO)
                    </label>
                  </div>

                  {showRegisters && (
                    <div className="mt-4">
                      <label className="block text-sm text-slate-400 mb-2">Records from Registers</label>
                      {data.identification.registers.map((reg, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={reg.name}
                            onChange={(e) => updateRegister(index, 'name', e.target.value)}
                            placeholder="Register name"
                            className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                          />
                          <input
                            type="number"
                            value={reg.count || ''}
                            onChange={(e) => updateRegister(index, 'count', parseInt(e.target.value) || 0)}
                            placeholder="n"
                            className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm text-center"
                          />
                          <button
                            onClick={() => removeRegister(index)}
                            className="px-2 py-2 text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addRegister}
                        className="text-sm text-violet-400 hover:text-violet-300"
                      >
                        + Add register
                      </button>
                    </div>
                  )}

                  <div className="text-right text-sm text-slate-400 mt-4">
                    Total identified: <span className="text-blue-400 font-medium">{calculated.totalIdentified}</span>
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
                        placeholder={String(calculated.recordsAfterDedup)}
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

                  {showPreviousStudies && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Previous studies</label>
                        <input
                          type="number"
                          value={data.included.previousStudies || ''}
                          onChange={(e) => setData(prev => ({
                            ...prev,
                            included: { ...prev.included, previousStudies: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Previous reports</label>
                        <input
                          type="number"
                          value={data.included.reportsOfPreviousStudies || ''}
                          onChange={(e) => setData(prev => ({
                            ...prev,
                            included: { ...prev.included, reportsOfPreviousStudies: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Panel */}
              <div className={`${activePanel === 'input' ? 'hidden lg:block' : ''}`}>
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 sticky top-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Preview</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={exportSVG}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        SVG
                      </button>
                      <button
                        onClick={exportPNG}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        onClick={exportWord}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Word
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
                      showRegisters={showRegisters}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Checklist Tab */}
        {activeTab === 'checklist' && (
          <PRISMAChecklist
            initialState={checklistState}
            onSave={setChecklistState}
          />
        )}

        {/* PRISMA 2020 Reference */}
        <div className="mt-8 bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-white font-medium mb-2">PRISMA 2020 Reference</h3>
          <p className="text-sm text-slate-400">
            Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews.{' '}
            <a 
              href="https://doi.org/10.1136/bmj.n71" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300"
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
  showRegisters: boolean;
}

const PRISMAFlowDiagram = React.forwardRef<SVGSVGElement, PRISMAFlowDiagramProps>(
  ({ data, calculated, showPreviousStudies, showRegisters }, ref) => {
    const width = 600;
    const height = 850;
    
    // Colors (PRISMA 2020 style)
    const colors = {
      identification: '#3b82f6',
      screening: '#22c55e',
      eligibility: '#f59e0b',
      included: '#8b5cf6',
      excluded: '#ef4444',
      text: '#1f2937',
      lightText: '#6b7280',
      border: '#e5e7eb',
      background: '#f9fafb',
    };

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
          <rect x={10} y={5} width={100} height={20} fill={colors.identification} rx={3} />
          <text x={60} y={19} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">
            Identification
          </text>

          {/* Records from databases box */}
          <rect x={40} y={35} width={200} height={80} fill={colors.background} stroke={colors.identification} strokeWidth={2} rx={4} />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Records identified from:
          </text>
          <text x={140} y={70} textAnchor="middle" fontSize={10} fill={colors.text}>
            Databases (n = {calculated.totalFromDatabases})
          </text>
          {data.identification.databases.slice(0, 3).map((db, i) => (
            db.name && db.count > 0 && (
              <text key={i} x={140} y={85 + i * 11} textAnchor="middle" fontSize={8} fill={colors.lightText}>
                {db.name}: {db.count}
              </text>
            )
          ))}

          {/* Registers box (if shown) */}
          {showRegisters && calculated.totalFromRegisters > 0 && (
            <>
              <rect x={360} y={35} width={200} height={80} fill={colors.background} stroke={colors.identification} strokeWidth={2} rx={4} />
              <text x={460} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
                Records from registers:
              </text>
              <text x={460} y={75} textAnchor="middle" fontSize={11} fill={colors.text}>
                (n = {calculated.totalFromRegisters})
              </text>
            </>
          )}
        </g>

        {/* Arrow down from identification */}
        <path d="M 140 175 L 140 200" stroke={colors.text} strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />

        {/* SCREENING Section */}
        <g transform="translate(0, 200)">
          {/* Section Label */}
          <rect x={10} y={5} width={80} height={20} fill={colors.screening} rx={3} />
          <text x={50} y={19} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">
            Screening
          </text>

          {/* Duplicates removed box (right side) */}
          <rect x={320} y={0} width={160} height={45} fill="#fef2f2" stroke={colors.excluded} strokeWidth={1.5} rx={4} />
          <text x={400} y={18} textAnchor="middle" fontSize={9} fill={colors.text}>
            Records removed before screening:
          </text>
          <text x={400} y={32} textAnchor="middle" fontSize={9} fill={colors.lightText}>
            Duplicates (n = {data.screening.duplicatesRemoved})
          </text>
          {data.screening.automationExcluded > 0 && (
            <text x={400} y={44} textAnchor="middle" fontSize={9} fill={colors.lightText}>
              Automation (n = {data.screening.automationExcluded})
            </text>
          )}

          {/* Arrow to duplicates */}
          <path d="M 240 40 L 315 25" stroke={colors.text} strokeWidth={1} fill="none" />

          {/* Records screened box */}
          <rect x={40} y={35} width={200} height={50} fill={colors.background} stroke={colors.screening} strokeWidth={2} rx={4} />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Records screened
          </text>
          <text x={140} y={72} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.screening.recordsScreened || calculated.recordsAfterDedup})
          </text>

          {/* Records excluded box */}
          <rect x={320} y={55} width={160} height={40} fill="#fef2f2" stroke={colors.excluded} strokeWidth={1.5} rx={4} />
          <text x={400} y={72} textAnchor="middle" fontSize={9} fill={colors.text}>
            Records excluded:
          </text>
          <text x={400} y={86} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            (n = {data.screening.recordsExcluded})
          </text>

          {/* Arrow to excluded */}
          <path d="M 240 60 L 315 75" stroke={colors.text} strokeWidth={1} fill="none" />
        </g>

        {/* Arrow down */}
        <path d="M 140 310 L 140 340" stroke={colors.text} strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />

        {/* RETRIEVAL Section */}
        <g transform="translate(0, 340)">
          {/* Sought for retrieval */}
          <rect x={40} y={10} width={200} height={50} fill={colors.background} stroke={colors.eligibility} strokeWidth={2} rx={4} />
          <text x={140} y={30} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Reports sought for retrieval
          </text>
          <text x={140} y={47} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.retrieval.soughtForRetrieval})
          </text>

          {/* Not retrieved box */}
          <rect x={320} y={10} width={160} height={40} fill="#fef2f2" stroke={colors.excluded} strokeWidth={1.5} rx={4} />
          <text x={400} y={27} textAnchor="middle" fontSize={9} fill={colors.text}>
            Reports not retrieved:
          </text>
          <text x={400} y={42} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            (n = {data.retrieval.notRetrieved})
          </text>

          {/* Arrow to not retrieved */}
          <path d="M 240 35 L 315 30" stroke={colors.text} strokeWidth={1} fill="none" />
        </g>

        {/* Arrow down */}
        <path d="M 140 410 L 140 440" stroke={colors.text} strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />

        {/* ELIGIBILITY Section */}
        <g transform="translate(0, 440)">
          {/* Section Label */}
          <rect x={10} y={5} width={70} height={20} fill={colors.eligibility} rx={3} />
          <text x={45} y={19} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">
            Eligibility
          </text>

          {/* Full-text assessed */}
          <rect x={40} y={35} width={200} height={50} fill={colors.background} stroke={colors.eligibility} strokeWidth={2} rx={4} />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Reports assessed for eligibility
          </text>
          <text x={140} y={72} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.eligibility.assessed})
          </text>

          {/* Excluded with reasons */}
          <rect x={300} y={20} width={190} height={80} fill="#fef2f2" stroke={colors.excluded} strokeWidth={1.5} rx={4} />
          <text x={395} y={38} textAnchor="middle" fontSize={9} fill={colors.text}>
            Reports excluded (n = {calculated.totalExcluded}):
          </text>
          {data.eligibility.excluded.slice(0, 4).map((reason, i) => (
            reason.reason && reason.count > 0 && (
              <text key={i} x={395} y={52 + i * 12} textAnchor="middle" fontSize={8} fill={colors.lightText}>
                {reason.reason}: {reason.count}
              </text>
            )
          ))}

          {/* Arrow to excluded */}
          <path d="M 240 60 L 295 60" stroke={colors.text} strokeWidth={1} fill="none" />
        </g>

        {/* Arrow down */}
        <path d="M 140 545 L 140 580" stroke={colors.text} strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />

        {/* INCLUDED Section */}
        <g transform="translate(0, 580)">
          {/* Section Label */}
          <rect x={10} y={5} width={70} height={20} fill={colors.included} rx={3} />
          <text x={45} y={19} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">
            Included
          </text>

          {/* Studies included */}
          <rect x={40} y={35} width={200} height={70} fill={colors.background} stroke={colors.included} strokeWidth={2} rx={4} />
          <text x={140} y={55} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors.text}>
            Studies included in review
          </text>
          <text x={140} y={73} textAnchor="middle" fontSize={11} fill={colors.text}>
            (n = {data.included.newStudies})
          </text>
          <text x={140} y={90} textAnchor="middle" fontSize={9} fill={colors.lightText}>
            Reports: {data.included.reportsOfNewStudies}
          </text>

          {/* Previous studies (if shown) */}
          {showPreviousStudies && data.included.previousStudies > 0 && (
            <>
              <rect x={300} y={35} width={180} height={70} fill={colors.background} stroke={colors.included} strokeWidth={1.5} rx={4} />
              <text x={390} y={55} textAnchor="middle" fontSize={9} fill={colors.text}>
                Previous studies:
              </text>
              <text x={390} y={73} textAnchor="middle" fontSize={11} fill={colors.text}>
                (n = {data.included.previousStudies})
              </text>
              <text x={390} y={90} textAnchor="middle" fontSize={9} fill={colors.lightText}>
                Reports: {data.included.reportsOfPreviousStudies}
              </text>
            </>
          )}
        </g>

        {/* Total box at bottom */}
        <g transform="translate(0, 700)">
          <rect x={40} y={10} width={520} height={40} fill={colors.background} stroke={colors.included} strokeWidth={2} rx={4} />
          <text x={300} y={35} textAnchor="middle" fontSize={12} fontWeight="bold" fill={colors.text}>
            Total studies = {data.included.newStudies + (showPreviousStudies ? data.included.previousStudies : 0)} | 
            Total reports = {data.included.reportsOfNewStudies + (showPreviousStudies ? data.included.reportsOfPreviousStudies : 0)}
          </text>
        </g>

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={colors.text} />
          </marker>
        </defs>

        {/* Footer */}
        <text x={width / 2} y={height - 25} textAnchor="middle" fontSize={8} fill="#9ca3af">
          Generated by MSDrills Research Tools
        </text>
        <text x={width / 2} y={height - 12} textAnchor="middle" fontSize={7} fill="#9ca3af">
          PRISMA 2020: Page MJ, et al. BMJ 2021;372:n71
        </text>
      </svg>
    );
  }
);

PRISMAFlowDiagram.displayName = 'PRISMAFlowDiagram';

export default PRISMAGeneratorFull;
