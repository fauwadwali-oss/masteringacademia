'use client'

import React, { useState, useRef, useCallback } from 'react'

// Types
interface PRISMAData {
  identification: {
    databases: { name: string; count: number }[]
    registers: { name: string; count: number }[]
  }
  screening: {
    duplicatesRemoved: number
    automationExcluded: number
    recordsScreened: number
    recordsExcluded: number
  }
  retrieval: {
    soughtForRetrieval: number
    notRetrieved: number
  }
  eligibility: {
    assessed: number
    excluded: { reason: string; count: number }[]
  }
  included: {
    newStudies: number
    reportsOfNewStudies: number
  }
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
    reportsOfNewStudies: 0,
  },
}

export default function PRISMAGeneratorPage() {
  const [data, setData] = useState<PRISMAData>(defaultPRISMAData)
  const [activeTab, setActiveTab] = useState<'input' | 'preview'>('input')
  const svgRef = useRef<SVGSVGElement>(null)

  // Calculate derived values
  const calculated = {
    totalFromDatabases: data.identification.databases.reduce((sum, db) => sum + db.count, 0),
    totalFromRegisters: data.identification.registers.reduce((sum, r) => sum + r.count, 0),
    totalIdentified: 0,
    recordsAfterDedup: 0,
    totalExcluded: data.eligibility.excluded.reduce((sum, e) => sum + e.count, 0),
  }
  calculated.totalIdentified = calculated.totalFromDatabases + calculated.totalFromRegisters
  calculated.recordsAfterDedup = calculated.totalIdentified - data.screening.duplicatesRemoved - data.screening.automationExcluded

  // Update handlers
  const updateDatabase = (index: number, field: 'name' | 'count', value: string | number) => {
    setData(prev => {
      const newDatabases = [...prev.identification.databases]
      newDatabases[index] = { ...newDatabases[index], [field]: value }
      return { ...prev, identification: { ...prev.identification, databases: newDatabases } }
    })
  }

  const addDatabase = () => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        databases: [...prev.identification.databases, { name: '', count: 0 }],
      },
    }))
  }

  const removeDatabase = (index: number) => {
    setData(prev => ({
      ...prev,
      identification: {
        ...prev.identification,
        databases: prev.identification.databases.filter((_, i) => i !== index),
      },
    }))
  }

  const updateExclusionReason = (index: number, field: 'reason' | 'count', value: string | number) => {
    setData(prev => {
      const newExcluded = [...prev.eligibility.excluded]
      newExcluded[index] = { ...newExcluded[index], [field]: value }
      return { ...prev, eligibility: { ...prev.eligibility, excluded: newExcluded } }
    })
  }

  const addExclusionReason = () => {
    setData(prev => ({
      ...prev,
      eligibility: {
        ...prev.eligibility,
        excluded: [...prev.eligibility.excluded, { reason: '', count: 0 }],
      },
    }))
  }

  const removeExclusionReason = (index: number) => {
    setData(prev => ({
      ...prev,
      eligibility: {
        ...prev.eligibility,
        excluded: prev.eligibility.excluded.filter((_, i) => i !== index),
      },
    }))
  }

  // Export SVG
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'prisma_flowchart.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Export PNG
  const exportPNG = useCallback(async () => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    canvas.width = 1200
    canvas.height = 1600

    img.onload = () => {
      if (!ctx) return
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = 'prisma_flowchart.png'
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }, [])

  const resetData = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      setData(defaultPRISMAData)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/research" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            <span className="text-white font-semibold text-lg">Homepage</span>
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
          <button
            onClick={resetData}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'input'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
          >
            Edit Data
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'preview'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
          >
            Preview &amp; Export
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
                      <button onClick={() => removeDatabase(index)} className="px-2 py-2 text-red-400 hover:text-red-300">✕</button>
                    </div>
                  ))}
                  <button onClick={addDatabase} className="text-sm text-violet-400 hover:text-violet-300">+ Add database</button>
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
                    <button onClick={() => removeExclusionReason(index)} className="px-2 py-2 text-red-400 hover:text-red-300">✕</button>
                  </div>
                ))}
                <button onClick={addExclusionReason} className="text-sm text-violet-400 hover:text-violet-300">+ Add reason</button>

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
              </div>
            </div>
          )}

          {/* Preview Panel */}
          <div className={`${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
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
                <svg
                  ref={svgRef}
                  viewBox="0 0 600 700"
                  width="100%"
                  height="auto"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                  {/* Background */}
                  <rect width={600} height={700} fill="white" />

                  {/* Title */}
                  <text x={300} y={30} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#1f2937">
                    PRISMA 2020 Flow Diagram
                  </text>

                  {/* IDENTIFICATION */}
                  <text x={20} y={70} fontSize={12} fontWeight="bold" fill="#3b82f6">Identification</text>
                  <rect x={50} y={85} width={200} height={80} fill="#f9fafb" stroke="#3b82f6" strokeWidth={2} rx={4} />
                  <text x={150} y={105} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    Records from databases:
                  </text>
                  <text x={150} y={120} textAnchor="middle" fontSize={10} fill="#1f2937">
                    (n = {calculated.totalFromDatabases})
                  </text>
                  {data.identification.databases.slice(0, 3).map((db, i) => (
                    <text key={i} x={150} y={135 + i * 12} textAnchor="middle" fontSize={8} fill="#6b7280">
                      {db.name}: {db.count}
                    </text>
                  ))}

                  {/* Arrow */}
                  <line x1={150} y1={165} x2={150} y2={200} stroke="#1f2937" strokeWidth={1.5} />
                  <polygon points="145,195 155,195 150,205" fill="#1f2937" />

                  {/* SCREENING */}
                  <text x={20} y={220} fontSize={12} fontWeight="bold" fill="#22c55e">Screening</text>

                  {/* Duplicates removed */}
                  <rect x={300} y={205} width={150} height={45} fill="#f9fafb" stroke="#ef4444" strokeWidth={1.5} rx={4} />
                  <text x={375} y={225} textAnchor="middle" fontSize={9} fill="#1f2937">Duplicates removed:</text>
                  <text x={375} y={240} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    (n = {data.screening.duplicatesRemoved})
                  </text>
                  <line x1={250} y1={230} x2={300} y2={230} stroke="#1f2937" strokeWidth={1} />

                  {/* Records screened */}
                  <rect x={50} y={235} width={200} height={55} fill="#f9fafb" stroke="#22c55e" strokeWidth={2} rx={4} />
                  <text x={150} y={260} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    Records screened
                  </text>
                  <text x={150} y={278} textAnchor="middle" fontSize={11} fill="#1f2937">
                    (n = {data.screening.recordsScreened || calculated.recordsAfterDedup})
                  </text>

                  {/* Records excluded */}
                  <rect x={300} y={260} width={150} height={45} fill="#f9fafb" stroke="#ef4444" strokeWidth={1.5} rx={4} />
                  <text x={375} y={280} textAnchor="middle" fontSize={9} fill="#1f2937">Records excluded:</text>
                  <text x={375} y={295} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    (n = {data.screening.recordsExcluded})
                  </text>
                  <line x1={250} y1={280} x2={300} y2={280} stroke="#1f2937" strokeWidth={1} />

                  {/* Arrow */}
                  <line x1={150} y1={290} x2={150} y2={330} stroke="#1f2937" strokeWidth={1.5} />
                  <polygon points="145,325 155,325 150,335" fill="#1f2937" />

                  {/* RETRIEVAL */}
                  <text x={20} y={355} fontSize={12} fontWeight="bold" fill="#f59e0b">Retrieval</text>
                  <rect x={50} y={370} width={200} height={55} fill="#f9fafb" stroke="#f59e0b" strokeWidth={2} rx={4} />
                  <text x={150} y={395} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    Reports sought for retrieval
                  </text>
                  <text x={150} y={413} textAnchor="middle" fontSize={11} fill="#1f2937">
                    (n = {data.retrieval.soughtForRetrieval})
                  </text>

                  {/* Not retrieved */}
                  <rect x={300} y={375} width={150} height={45} fill="#f9fafb" stroke="#ef4444" strokeWidth={1.5} rx={4} />
                  <text x={375} y={395} textAnchor="middle" fontSize={9} fill="#1f2937">Reports not retrieved:</text>
                  <text x={375} y={410} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    (n = {data.retrieval.notRetrieved})
                  </text>
                  <line x1={250} y1={400} x2={300} y2={400} stroke="#1f2937" strokeWidth={1} />

                  {/* Arrow */}
                  <line x1={150} y1={425} x2={150} y2={460} stroke="#1f2937" strokeWidth={1.5} />
                  <polygon points="145,455 155,455 150,465" fill="#1f2937" />

                  {/* ELIGIBILITY */}
                  <text x={20} y={485} fontSize={12} fontWeight="bold" fill="#f97316">Eligibility</text>
                  <rect x={50} y={500} width={200} height={55} fill="#f9fafb" stroke="#f97316" strokeWidth={2} rx={4} />
                  <text x={150} y={525} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    Reports assessed for eligibility
                  </text>
                  <text x={150} y={543} textAnchor="middle" fontSize={11} fill="#1f2937">
                    (n = {data.eligibility.assessed})
                  </text>

                  {/* Excluded */}
                  <rect x={300} y={500} width={180} height={70} fill="#f9fafb" stroke="#ef4444" strokeWidth={1.5} rx={4} />
                  <text x={390} y={518} textAnchor="middle" fontSize={9} fill="#1f2937">
                    Reports excluded (n = {calculated.totalExcluded}):
                  </text>
                  {data.eligibility.excluded.slice(0, 3).map((e, i) => (
                    <text key={i} x={390} y={532 + i * 12} textAnchor="middle" fontSize={8} fill="#6b7280">
                      {e.reason}: {e.count}
                    </text>
                  ))}
                  <line x1={250} y1={530} x2={300} y2={530} stroke="#1f2937" strokeWidth={1} />

                  {/* Arrow */}
                  <line x1={150} y1={555} x2={150} y2={590} stroke="#1f2937" strokeWidth={1.5} />
                  <polygon points="145,585 155,585 150,595" fill="#1f2937" />

                  {/* INCLUDED */}
                  <text x={20} y={615} fontSize={12} fontWeight="bold" fill="#8b5cf6">Included</text>
                  <rect x={50} y={630} width={200} height={55} fill="#f9fafb" stroke="#8b5cf6" strokeWidth={2} rx={4} />
                  <text x={150} y={655} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1f2937">
                    Studies included in review
                  </text>
                  <text x={150} y={673} textAnchor="middle" fontSize={11} fill="#1f2937">
                    (n = {data.included.newStudies})
                  </text>

                  {/* Footer */}
                  <text x={300} y={695} textAnchor="middle" fontSize={8} fill="#9ca3af">
                    Generated by MSDrills Research Tools • PRISMA 2020 Template
                  </text>
                </svg>
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
  )
}
