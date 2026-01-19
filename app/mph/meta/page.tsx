'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';

// ============================================
// Types
// ============================================

type EffectMeasure = 'MD' | 'SMD' | 'OR' | 'RR' | 'RD' | 'HR';
type PoolingMethod = 'fixed' | 'random';

interface StudyData {
    id: string;
    name: string;
    year?: number;
    // Continuous
    n1?: number;
    mean1?: number;
    sd1?: number;
    n2?: number;
    mean2?: number;
    sd2?: number;
    // Binary
    events1?: number;
    total1?: number;
    events2?: number;
    total2?: number;
    // Pre-calculated
    effect?: number;
    se?: number;
}

interface PooledResult {
    effect: number;
    se: number;
    ci_lower: number;
    ci_upper: number;
    z: number;
    p: number;
    weights: number[]; // percentages
    q: number;
    df: number;
    p_het: number;
    i2: number;
    tau2?: number;
}

// ============================================
// Statistical Functions
// ============================================

const pnorm = (z: number): number => {
    // Approximation of cumulative standard normal distribution
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c2 = 0.39894228;

    const a = Math.abs(z);
    const t = 1.0 / (1.0 + a * p);
    const b = c2 * Math.exp((-z * z) / 2.0);
    const n = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
    return 1.0 - b * n;
};

const pchisq = (chi: number, df: number): number => {
    // Wilson-Hilferty approximation for Chi-square p-value
    if (df <= 0) return 0;
    if (chi <= 0) return 0;

    // For small df, this approximation might be rough, but acceptable for tool
    // Better approximation:
    if (df === 1) return 2 * (1 - pnorm(Math.sqrt(chi)));

    const s = Math.pow(chi / df, 1 / 3);
    const z = (s - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
    return 1 - pnorm(z);
};

// Calculate effect size from raw data
const calculateEffect = (study: StudyData, measure: EffectMeasure): { effect: number; se: number; variance: number } | null => {
    // Continuous outcomes
    if (measure === 'MD' || measure === 'SMD') {
        if (!study.n1 || !study.n2 || study.mean1 === undefined || study.mean2 === undefined || !study.sd1 || !study.sd2) {
            // Try pre-calculated
            if (study.effect !== undefined && study.se !== undefined) {
                return { effect: study.effect, se: study.se, variance: study.se * study.se };
            }
            return null;
        }

        const md = study.mean1 - study.mean2;

        if (measure === 'MD') {
            const variance = (study.sd1 * study.sd1 / study.n1) + (study.sd2 * study.sd2 / study.n2);
            return { effect: md, se: Math.sqrt(variance), variance };
        }

        // SMD (Hedges' g)
        const pooledSD = Math.sqrt(
            ((study.n1 - 1) * study.sd1 * study.sd1 + (study.n2 - 1) * study.sd2 * study.sd2) /
            (study.n1 + study.n2 - 2)
        );
        const d = md / pooledSD;

        // Small sample correction (Hedges' g)
        const j = 1 - (3 / (4 * (study.n1 + study.n2 - 2) - 1));
        const g = d * j;

        const variance = ((study.n1 + study.n2) / (study.n1 * study.n2)) + (g * g / (2 * (study.n1 + study.n2)));
        return { effect: g, se: Math.sqrt(variance), variance };
    }

    // Binary outcomes
    if (measure === 'OR' || measure === 'RR' || measure === 'RD') {
        if (study.events1 === undefined || !study.total1 || study.events2 === undefined || !study.total2) {
            if (study.effect !== undefined && study.se !== undefined) {
                return { effect: study.effect, se: study.se, variance: study.se * study.se };
            }
            return null;
        }

        const a = study.events1!;
        const b = study.total1 - study.events1!;
        const c = study.events2!;
        const d = study.total2 - study.events2!;

        // Add 0.5 correction for zero cells
        const a2 = a === 0 || c === 0 ? a + 0.5 : a;
        const b2 = a === 0 || c === 0 ? b + 0.5 : b;
        const c2 = a === 0 || c === 0 ? c + 0.5 : c;
        const d2 = a === 0 || c === 0 ? d + 0.5 : d;

        if (measure === 'OR') {
            const or = (a2 * d2) / (b2 * c2);
            const logOR = Math.log(or);
            const variance = (1 / a2) + (1 / b2) + (1 / c2) + (1 / d2);
            return { effect: logOR, se: Math.sqrt(variance), variance };
        }

        if (measure === 'RR') {
            const p1 = a2 / (a2 + b2);
            const p2 = c2 / (c2 + d2);
            const rr = p1 / p2;
            const logRR = Math.log(rr);
            const variance = (1 / a2) - (1 / (a2 + b2)) + (1 / c2) - (1 / (c2 + d2));
            return { effect: logRR, se: Math.sqrt(variance), variance };
        }

        if (measure === 'RD') {
            const p1 = a / study.total1;
            const p2 = c / study.total2;
            const rd = p1 - p2;
            const variance = (p1 * (1 - p1) / study.total1) + (p2 * (1 - p2) / study.total2);
            return { effect: rd, se: Math.sqrt(variance), variance };
        }
    }

    // Pre-calculated (HR or any)
    if (study.effect !== undefined && study.se !== undefined) {
        return { effect: study.effect, se: study.se, variance: study.se * study.se };
    }

    return null;
};

// Pool studies using inverse variance method
const poolStudies = (studies: StudyData[], measure: EffectMeasure, method: PoolingMethod): PooledResult | null => {
    const effects: { effect: number; variance: number; weight: number }[] = [];

    for (const study of studies) {
        const result = calculateEffect(study, measure);
        if (result) {
            effects.push({
                effect: result.effect,
                variance: result.variance,
                weight: 1 / result.variance,
            });
        }
    }

    if (effects.length === 0) return null;

    // Fixed effect pooling
    const sumWeights = effects.reduce((sum, e) => sum + e.weight, 0);
    const fixedEffect = effects.reduce((sum, e) => sum + e.effect * e.weight, 0) / sumWeights;
    const fixedVariance = 1 / sumWeights;

    // Heterogeneity
    const q = effects.reduce((sum, e) => sum + e.weight * Math.pow(e.effect - fixedEffect, 2), 0);
    const df = effects.length - 1;
    const p_het = 1 - pchisq(q, df);

    // I² statistic
    const i2 = Math.max(0, ((q - df) / q) * 100);

    let pooledEffect = fixedEffect;
    let pooledVariance = fixedVariance;
    let tau2 = 0;
    const weights = effects.map(e => e.weight);

    if (method === 'random') {
        // DerSimonian-Laird tau² estimate
        const c = sumWeights - (effects.reduce((sum, e) => sum + e.weight * e.weight, 0) / sumWeights);
        tau2 = Math.max(0, (q - df) / c);

        // Random effects weights
        const reWeights = effects.map(e => 1 / (e.variance + tau2));
        const sumREWeights = reWeights.reduce((sum, w) => sum + w, 0);

        pooledEffect = reWeights.reduce((sum, w, i) => sum + effects[i].effect * w, 0) / sumREWeights;
        pooledVariance = 1 / sumREWeights;

        weights.length = 0;
        weights.push(...reWeights);
    }

    const se = Math.sqrt(pooledVariance);
    const z = pooledEffect / se;
    const p = 2 * (1 - pnorm(Math.abs(z)));

    return {
        effect: pooledEffect,
        se,
        ci_lower: pooledEffect - 1.96 * se,
        ci_upper: pooledEffect + 1.96 * se,
        z,
        p,
        weights: weights.map(w => (w / weights.reduce((s, x) => s + x, 0)) * 100),
        q,
        df,
        p_het,
        i2,
        tau2: method === 'random' ? tau2 : undefined,
    };
};

// ============================================
// Forest Plot Component
// ============================================

interface ForestPlotProps {
    studies: StudyData[];
    pooled: PooledResult | null;
    measure: EffectMeasure;
    method: PoolingMethod;
}

const ForestPlot: React.FC<ForestPlotProps> = ({ studies, pooled, measure, method }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    // Calculate effects for display
    const studyEffects = useMemo(() => {
        return studies.map(study => {
            const result = calculateEffect(study, measure);
            if (!result) return null;

            // Transform for display (exp for log measures)
            const isLogScale = ['OR', 'RR', 'HR'].includes(measure);
            const displayEffect = isLogScale ? Math.exp(result.effect) : result.effect;
            const displayLower = isLogScale ? Math.exp(result.effect - 1.96 * result.se) : result.effect - 1.96 * result.se;
            const displayUpper = isLogScale ? Math.exp(result.effect + 1.96 * result.se) : result.effect + 1.96 * result.se;

            return {
                study,
                effect: displayEffect,
                lower: displayLower,
                upper: displayUpper,
                weight: pooled?.weights[studies.indexOf(study)] || 0,
            };
        }).filter(Boolean) as { study: StudyData; effect: number; lower: number; upper: number; weight: number }[];
    }, [studies, pooled, measure]);

    // Pooled effect for display
    const pooledDisplay = useMemo(() => {
        if (!pooled) return null;
        const isLogScale = ['OR', 'RR', 'HR'].includes(measure);
        return {
            effect: isLogScale ? Math.exp(pooled.effect) : pooled.effect,
            lower: isLogScale ? Math.exp(pooled.ci_lower) : pooled.ci_lower,
            upper: isLogScale ? Math.exp(pooled.ci_upper) : pooled.ci_upper,
        };
    }, [pooled, measure]);

    // Scale calculations
    const allValues = [
        ...studyEffects.flatMap(e => [e.lower, e.upper]),
        pooledDisplay?.lower || 0,
        pooledDisplay?.upper || 0,
    ].filter(v => isFinite(v));

    const isLogScale = ['OR', 'RR', 'HR'].includes(measure);
    const nullValue = isLogScale ? 1 : 0;

    const minVal = Math.min(...allValues, nullValue);
    const maxVal = Math.max(...allValues, nullValue);
    const range = maxVal - minVal;
    const padding = range * 0.1;

    const xMin = minVal - padding;
    const xMax = maxVal + padding;

    // SVG dimensions
    const width = 800;
    const height = 80 + studyEffects.length * 30;
    const plotLeft = 200;
    const plotRight = width - 150;
    const plotWidth = plotRight - plotLeft;

    const xScale = (value: number) => plotLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;

    // Export SVG
    const exportSVG = () => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'forest_plot.svg';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Forest Plot</h3>
                <button
                    onClick={exportSVG}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export SVG
                </button>
            </div>

            <div className="bg-white rounded-xl p-4 overflow-x-auto">
                <svg ref={svgRef} width={width} height={height} className="text-slate-900">
                    {/* Background */}
                    <rect width={width} height={height} fill="white" />

                    {/* Headers */}
                    <text x={10} y={25} className="text-sm font-semibold" fill="#1e293b">Study</text>
                    <text x={plotLeft + plotWidth / 2} y={25} textAnchor="middle" className="text-sm font-semibold" fill="#1e293b">
                        {measure} (95% CI)
                    </text>
                    <text x={plotRight + 30} y={25} className="text-sm font-semibold" fill="#1e293b">Weight</text>
                    <text x={plotRight + 90} y={25} className="text-sm font-semibold" fill="#1e293b">{measure}</text>

                    {/* Null effect line */}
                    <line
                        x1={xScale(nullValue)}
                        y1={40}
                        x2={xScale(nullValue)}
                        y2={height - 30}
                        stroke="#94a3b8"
                        strokeDasharray="4,4"
                    />

                    {/* Study rows */}
                    {studyEffects.map((item, idx) => {
                        const y = 55 + idx * 30;
                        const boxSize = Math.sqrt(item.weight) * 1.5 + 4;

                        return (
                            <g key={item.study.id}>
                                {/* Study name */}
                                <text x={10} y={y + 5} className="text-xs" fill="#475569">
                                    {item.study.name} {item.study.year ? `(${item.study.year})` : ''}
                                </text>

                                {/* CI line */}
                                <line
                                    x1={xScale(item.lower)}
                                    y1={y}
                                    x2={xScale(item.upper)}
                                    y2={y}
                                    stroke="#0891b2"
                                    strokeWidth={2}
                                />

                                {/* Effect point (square) */}
                                <rect
                                    x={xScale(item.effect) - boxSize / 2}
                                    y={y - boxSize / 2}
                                    width={boxSize}
                                    height={boxSize}
                                    fill="#0891b2"
                                />

                                {/* Weight */}
                                <text x={plotRight + 30} y={y + 5} className="text-xs" fill="#475569">
                                    {item.weight.toFixed(1)}%
                                </text>

                                {/* Effect estimate */}
                                <text x={plotRight + 90} y={y + 5} className="text-xs" fill="#475569">
                                    {item.effect.toFixed(2)} [{item.lower.toFixed(2)}, {item.upper.toFixed(2)}]
                                </text>
                            </g>
                        );
                    })}

                    {/* Pooled effect */}
                    {pooledDisplay && (
                        <g>
                            <line
                                x1={plotLeft}
                                y1={height - 45}
                                x2={plotRight}
                                y2={height - 45}
                                stroke="#e2e8f0"
                            />

                            <text x={10} y={height - 20} className="text-xs font-semibold" fill="#1e293b">
                                {method === 'random' ? 'RE Model' : 'FE Model'}
                            </text>

                            {/* Diamond */}
                            <polygon
                                points={`
                    ${xScale(pooledDisplay.lower)},${height - 20}
                    ${xScale(pooledDisplay.effect)},${height - 28}
                    ${xScale(pooledDisplay.upper)},${height - 20}
                    ${xScale(pooledDisplay.effect)},${height - 12}
                  `}
                                fill="#0f766e"
                            />

                            <text x={plotRight + 30} y={height - 15} className="text-xs font-semibold" fill="#1e293b">
                                100%
                            </text>

                            <text x={plotRight + 90} y={height - 15} className="text-xs font-semibold" fill="#1e293b">
                                {pooledDisplay.effect.toFixed(2)} [{pooledDisplay.lower.toFixed(2)}, {pooledDisplay.upper.toFixed(2)}]
                            </text>
                        </g>
                    )}

                    {/* X-axis */}
                    <line x1={plotLeft} y1={height - 5} x2={plotRight} y2={height - 5} stroke="#94a3b8" />

                    {/* X-axis labels */}
                    {[xMin, nullValue, xMax].map((val, idx) => (
                        <g key={idx}>
                            <line x1={xScale(val)} y1={height - 5} x2={xScale(val)} y2={height} stroke="#94a3b8" />
                            <text x={xScale(val)} y={height + 12} textAnchor="middle" className="text-xs" fill="#64748b">
                                {val.toFixed(2)}
                            </text>
                        </g>
                    ))}

                    {/* Axis label */}
                    <text x={plotLeft + plotWidth / 2} y={height + 25} textAnchor="middle" className="text-xs" fill="#64748b">
                        {isLogScale ? `Favors Control ← → Favors Intervention` : `Favors Control ← → Favors Intervention`}
                    </text>
                </svg>
            </div>
        </div>
    );
};

// ============================================
// Funnel Plot Component
// ============================================

interface FunnelPlotProps {
    studies: StudyData[];
    pooled: PooledResult | null;
    measure: EffectMeasure;
}

const FunnelPlot: React.FC<FunnelPlotProps> = ({ studies, pooled, measure }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const studyEffects = useMemo(() => {
        return studies.map(study => {
            const result = calculateEffect(study, measure);
            if (!result) return null;
            return { effect: result.effect, se: result.se };
        }).filter(Boolean) as { effect: number; se: number }[];
    }, [studies, measure]);

    if (!pooled || studyEffects.length < 3) {
        return (
            <div className="text-center py-8 text-slate-400">
                Need at least 3 studies for funnel plot
            </div>
        );
    }

    const maxSE = Math.max(...studyEffects.map(e => e.se));
    const minEffect = Math.min(...studyEffects.map(e => e.effect));
    const maxEffect = Math.max(...studyEffects.map(e => e.effect));
    const effectRange = maxEffect - minEffect;

    const width = 500;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const xScale = (val: number) => margin.left + ((val - minEffect + effectRange * 0.2) / (effectRange * 1.4)) * plotWidth;
    const yScale = (se: number) => margin.top + (se / (maxSE * 1.1)) * plotHeight;

    // Export
    const exportSVG = () => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'funnel_plot.svg';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Funnel Plot</h3>
                <button
                    onClick={exportSVG}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export SVG
                </button>
            </div>

            <div className="bg-white rounded-xl p-4">
                <svg ref={svgRef} width={width} height={height}>
                    <rect width={width} height={height} fill="white" />

                    {/* Funnel (pseudo-95% CI region) */}
                    <polygon
                        points={`
                ${xScale(pooled.effect)},${margin.top}
                ${xScale(pooled.effect - 1.96 * maxSE * 1.1)},${margin.top + plotHeight}
                ${xScale(pooled.effect + 1.96 * maxSE * 1.1)},${margin.top + plotHeight}
              `}
                        fill="#f1f5f9"
                        stroke="#cbd5e1"
                    />

                    {/* Pooled effect line */}
                    <line
                        x1={xScale(pooled.effect)}
                        y1={margin.top}
                        x2={xScale(pooled.effect)}
                        y2={margin.top + plotHeight}
                        stroke="#0891b2"
                        strokeDasharray="4,4"
                    />

                    {/* Study points */}
                    {studyEffects.map((e, idx) => (
                        <circle
                            key={idx}
                            cx={xScale(e.effect)}
                            cy={yScale(e.se)}
                            r={4}
                            fill="#0f766e"
                        />
                    ))}

                    {/* Y-axis */}
                    <line
                        x1={margin.left}
                        y1={margin.top}
                        x2={margin.left}
                        y2={margin.top + plotHeight}
                        stroke="#94a3b8"
                    />
                    <text
                        x={20}
                        y={margin.top + plotHeight / 2}
                        textAnchor="middle"
                        transform={`rotate(-90, 20, ${margin.top + plotHeight / 2})`}
                        className="text-xs"
                        fill="#64748b"
                    >
                        Standard Error
                    </text>

                    {/* X-axis */}
                    <line
                        x1={margin.left}
                        y1={margin.top + plotHeight}
                        x2={margin.left + plotWidth}
                        y2={margin.top + plotHeight}
                        stroke="#94a3b8"
                    />
                    <text
                        x={margin.left + plotWidth / 2}
                        y={height - 15}
                        textAnchor="middle"
                        className="text-xs"
                        fill="#64748b"
                    >
                        Effect Size ({measure})
                    </text>
                </svg>
            </div>
        </div>
    );
};

// ============================================
// Main Component
// ============================================

export default function MetaAnalysisPage() {
    const [studies, setStudies] = useState<StudyData[]>([]);
    const [measure, setMeasure] = useState<EffectMeasure>('SMD');
    const [method, setMethod] = useState<PoolingMethod>('random');
    const [showForest, setShowForest] = useState(true);
    const [dataMode, setDataMode] = useState<'continuous' | 'binary' | 'precalculated'>('continuous');

    // Calculate pooled result
    const pooled = useMemo(() => {
        if (studies.length < 2) return null;
        return poolStudies(studies, measure, method);
    }, [studies, measure, method]);

    // Add study
    const addStudy = () => {
        const id = 'study_' + Math.random().toString(36).substring(2, 9);
        setStudies(prev => [...prev, { id, name: `Study ${prev.length + 1}` }]);
    };

    // Update study
    const updateStudy = (id: string, field: keyof StudyData, value: any) => {
        setStudies(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    // Remove study
    const removeStudy = (id: string) => {
        setStudies(prev => prev.filter(s => s.id !== id));
    };

    // Import from CSV
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

        const imported: StudyData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const study: StudyData = {
                id: 'study_' + i,
                name: values[headers.indexOf('study')] || values[headers.indexOf('name')] || `Study ${i}`,
            };

            // Map columns
            const yearIdx = headers.indexOf('year');
            if (yearIdx >= 0 && values[yearIdx]) study.year = parseInt(values[yearIdx]);

            // Continuous
            ['n1', 'mean1', 'sd1', 'n2', 'mean2', 'sd2'].forEach(field => {
                const idx = headers.indexOf(field);
                if (idx >= 0 && values[idx]) (study as any)[field] = parseFloat(values[idx]);
            });

            // Binary
            ['events1', 'total1', 'events2', 'total2'].forEach(field => {
                const idx = headers.indexOf(field);
                if (idx >= 0 && values[idx]) (study as any)[field] = parseInt(values[idx]);
            });

            // Pre-calculated
            const effectIdx = headers.indexOf('effect') !== -1 ? headers.indexOf('effect') : headers.indexOf('yi');
            const seIdx = headers.indexOf('se') !== -1 ? headers.indexOf('se') : headers.indexOf('sei');
            if (effectIdx >= 0 && values[effectIdx]) study.effect = parseFloat(values[effectIdx]);
            if (seIdx >= 0 && values[seIdx]) study.se = parseFloat(values[seIdx]);

            imported.push(study);
        }

        setStudies(imported);
    };

    // Export results
    const exportResults = () => {
        if (!pooled) return;

        const isLog = ['OR', 'RR', 'HR'].includes(measure);
        const lines = [
            `Meta-Analysis Results`,
            ``,
            `Effect Measure: ${measure}`,
            `Method: ${method === 'random' ? 'Random Effects (DerSimonian-Laird)' : 'Fixed Effect (Inverse Variance)'}`,
            ``,
            `Pooled Effect: ${isLog ? Math.exp(pooled.effect).toFixed(3) : pooled.effect.toFixed(3)}`,
            `95% CI: [${isLog ? Math.exp(pooled.ci_lower).toFixed(3) : pooled.ci_lower.toFixed(3)}, ${isLog ? Math.exp(pooled.ci_upper).toFixed(3) : pooled.ci_upper.toFixed(3)}]`,
            `Z: ${pooled.z.toFixed(3)}`,
            `P-value: ${pooled.p < 0.001 ? '<0.001' : pooled.p.toFixed(3)}`,
            ``,
            `Heterogeneity:`,
            `Q: ${pooled.q.toFixed(2)} (df=${pooled.df}, p=${pooled.p_het < 0.001 ? '<0.001' : pooled.p_het.toFixed(3)})`,
            `I²: ${pooled.i2.toFixed(1)}%`,
            method === 'random' ? `τ²: ${pooled.tau2?.toFixed(4)}` : '',
            ``,
            `Studies: ${studies.length}`,
        ];

        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meta_analysis_results.txt';
        a.click();
        URL.revokeObjectURL(url);
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
                        <span className="text-cyan-400">Meta-Analysis</span>
                    </div>
                    <a href="/mph" className="text-slate-400 hover:text-white text-sm">
                        ← All Tools
                    </a>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Controls */}
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Effect measure */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Effect Measure</label>
                            <select
                                value={measure}
                                onChange={(e) => setMeasure(e.target.value as EffectMeasure)}
                                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                            >
                                <option value="SMD">SMD (Hedges' g)</option>
                                <option value="MD">Mean Difference</option>
                                <option value="OR">Odds Ratio</option>
                                <option value="RR">Risk Ratio</option>
                                <option value="RD">Risk Difference</option>
                                <option value="HR">Hazard Ratio</option>
                            </select>
                        </div>

                        {/* Method */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Model</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value as PoolingMethod)}
                                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                            >
                                <option value="random">Random Effects (DL)</option>
                                <option value="fixed">Fixed Effect (IV)</option>
                            </select>
                        </div>

                        {/* Data Type */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Data Type</label>
                            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                <button
                                    onClick={() => setDataMode('continuous')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${dataMode === 'continuous' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Continuous
                                </button>
                                <button
                                    onClick={() => setDataMode('binary')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${dataMode === 'binary' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Binary
                                </button>
                                <button
                                    onClick={() => setDataMode('precalculated')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${dataMode === 'precalculated' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Effect/SE
                                </button>
                            </div>
                        </div>

                        <div className="flex-1" />

                        {/* Actions */}
                        <div className="flex gap-2">
                            <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm cursor-pointer transition-colors">
                                <input type="file" onChange={handleImport} accept=".csv" className="hidden" />
                                Import CSV
                            </label>
                            <button
                                onClick={exportResults}
                                disabled={!pooled}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
                            >
                                Export Results
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Data Entry */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-medium">Study Data</h3>
                                <button onClick={addStudy} className="text-cyan-400 text-sm hover:text-cyan-300">
                                    + Add Study
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                {studies.map(study => (
                                    <div key={study.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <input
                                                value={study.name}
                                                onChange={(e) => updateStudy(study.id, 'name', e.target.value)}
                                                className="bg-transparent text-white text-sm font-medium focus:outline-none w-full"
                                                placeholder="Study Name"
                                            />
                                            <button onClick={() => removeStudy(study.id)} className="text-slate-500 hover:text-red-400">
                                                ✕
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="number"
                                                value={study.year || ''}
                                                onChange={(e) => updateStudy(study.id, 'year', parseFloat(e.target.value))}
                                                placeholder="Year"
                                                className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600"
                                            />
                                        </div>

                                        {dataMode === 'continuous' && (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-3 gap-1">
                                                    <span className="text-[10px] text-slate-500 col-span-3">Group 1 (N, Mean, SD)</span>
                                                    <input type="number" placeholder="N" value={study.n1 || ''} onChange={(e) => updateStudy(study.id, 'n1', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="Mean" value={study.mean1 || ''} onChange={(e) => updateStudy(study.id, 'mean1', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="SD" value={study.sd1 || ''} onChange={(e) => updateStudy(study.id, 'sd1', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <span className="text-[10px] text-slate-500 col-span-3">Group 2 (N, Mean, SD)</span>
                                                    <input type="number" placeholder="N" value={study.n2 || ''} onChange={(e) => updateStudy(study.id, 'n2', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="Mean" value={study.mean2 || ''} onChange={(e) => updateStudy(study.id, 'mean2', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="SD" value={study.sd2 || ''} onChange={(e) => updateStudy(study.id, 'sd2', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                            </div>
                                        )}

                                        {dataMode === 'binary' && (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-1">
                                                    <span className="text-[10px] text-slate-500 col-span-2">Group 1 (Events / Total)</span>
                                                    <input type="number" placeholder="Events" value={study.events1 || ''} onChange={(e) => updateStudy(study.id, 'events1', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="Total" value={study.total1 || ''} onChange={(e) => updateStudy(study.id, 'total1', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <span className="text-[10px] text-slate-500 col-span-2">Group 2 (Events / Total)</span>
                                                    <input type="number" placeholder="Events" value={study.events2 || ''} onChange={(e) => updateStudy(study.id, 'events2', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                    <input type="number" placeholder="Total" value={study.total2 || ''} onChange={(e) => updateStudy(study.id, 'total2', parseFloat(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                            </div>
                                        )}

                                        {dataMode === 'precalculated' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-500 block mb-1">Effect Size</span>
                                                    <input type="number" value={study.effect || ''} onChange={(e) => updateStudy(study.id, 'effect', parseFloat(e.target.value))} className="w-full bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 block mb-1">Standard Error</span>
                                                    <input type="number" value={study.se || ''} onChange={(e) => updateStudy(study.id, 'se', parseFloat(e.target.value))} className="w-full bg-slate-800 text-xs text-white p-1 rounded border border-slate-600" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {studies.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 text-sm">
                                        No studies added.<br />Add manually or import CSV.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Visualization & Results */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Results Text */}
                        {pooled && (
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-400 mb-2">Pooled Effect ({measure})</h3>
                                        <div className="text-3xl font-bold text-white mb-1">
                                            {['OR', 'RR', 'HR'].includes(measure) ? Math.exp(pooled.effect).toFixed(2) : pooled.effect.toFixed(2)}
                                        </div>
                                        <div className="text-sm text-slate-400">
                                            95% CI: [{['OR', 'RR', 'HR'].includes(measure) ? Math.exp(pooled.ci_lower).toFixed(2) : pooled.ci_lower.toFixed(2)},
                                            {['OR', 'RR', 'HR'].includes(measure) ? Math.exp(pooled.ci_upper).toFixed(2) : pooled.ci_upper.toFixed(2)}]
                                        </div>
                                        <div className="text-xs text-slate-500 mt-2">
                                            Z = {pooled.z.toFixed(2)}, p = {pooled.p < 0.001 ? '<0.001' : pooled.p.toFixed(3)}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-slate-400 mb-2">Heterogeneity</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xl font-bold text-white">{pooled.i2.toFixed(1)}%</div>
                                                <div className="text-xs text-slate-500">I² Statistic</div>
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-white">{pooled.p_het < 0.001 ? '<0.001' : pooled.p_het.toFixed(3)}</div>
                                                <div className="text-xs text-slate-500">P-value (Chi²)</div>
                                            </div>
                                        </div>
                                        {method === 'random' && (
                                            <div className="mt-2 text-xs text-slate-500">
                                                Est. Tau² = {pooled.tau2?.toFixed(3)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex border-b border-slate-700">
                            <button
                                onClick={() => setShowForest(true)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showForest ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                            >
                                Forest Plot
                            </button>
                            <button
                                onClick={() => setShowForest(false)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!showForest ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                            >
                                Funnel Plot
                            </button>
                        </div>

                        {/* Plot Area */}
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 min-h-[400px]">
                            {studies.length > 0 ? (
                                showForest ? (
                                    <ForestPlot studies={studies} pooled={pooled} measure={measure} method={method} />
                                ) : (
                                    <FunnelPlot studies={studies} pooled={pooled} measure={measure} />
                                )
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    Add studies to view plots
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
