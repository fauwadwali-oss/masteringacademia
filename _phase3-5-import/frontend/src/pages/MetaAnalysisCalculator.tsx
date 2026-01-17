import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ============================================
// Types
// ============================================

type EffectMeasure = 'SMD' | 'MD' | 'OR' | 'RR' | 'RD' | 'HR';
type PoolingMethod = 'fixed' | 'random';

interface StudyData {
  id: string;
  name: string;
  year?: number;
  
  // Continuous data
  n1?: number; // intervention N
  mean1?: number;
  sd1?: number;
  n2?: number; // control N
  mean2?: number;
  sd2?: number;
  
  // Binary data
  events1?: number;
  total1?: number;
  events2?: number;
  total2?: number;
  
  // Pre-calculated
  effect?: number;
  se?: number;
  ci_lower?: number;
  ci_upper?: number;
  
  // For plotting
  weight?: number;
  pooled?: boolean;
}

interface PooledResult {
  effect: number;
  se: number;
  ci_lower: number;
  ci_upper: number;
  z: number;
  p: number;
  weights: number[];
  q: number; // Cochran's Q
  df: number;
  p_het: number;
  i2: number;
  tau2?: number; // For random effects
}

interface MetaSession {
  id: string;
  name: string;
  measure: EffectMeasure;
  method: PoolingMethod;
  studies: StudyData[];
  createdAt: string;
}

// ============================================
// Statistical Functions
// ============================================

// Standard normal distribution
const pnorm = (z: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 0.5 * (1.0 + sign * y);
};

// Chi-squared p-value (approximation)
const pchisq = (x: number, df: number): number => {
  if (x < 0 || df < 1) return 0;
  
  // Incomplete gamma function approximation
  const k = df / 2;
  const x2 = x / 2;
  
  let sum = 0;
  let term = Math.exp(-x2);
  
  for (let i = 0; i < 200; i++) {
    term *= x2 / (k + i);
    sum += term;
    if (term < 1e-10) break;
  }
  
  return 1 - sum;
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
    if (!study.events1 === undefined || !study.total1 || study.events2 === undefined || !study.total2) {
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
      const variance = (1/a2) + (1/b2) + (1/c2) + (1/d2);
      return { effect: logOR, se: Math.sqrt(variance), variance };
    }
    
    if (measure === 'RR') {
      const p1 = a2 / (a2 + b2);
      const p2 = c2 / (c2 + d2);
      const rr = p1 / p2;
      const logRR = Math.log(rr);
      const variance = (1/a2) - (1/(a2+b2)) + (1/c2) - (1/(c2+d2));
      return { effect: logRR, se: Math.sqrt(variance), variance };
    }
    
    if (measure === 'RD') {
      const p1 = a / study.total1;
      const p2 = c / study.total2;
      const rd = p1 - p2;
      const variance = (p1 * (1-p1) / study.total1) + (p2 * (1-p2) / study.total2);
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
          <text x={plotLeft + plotWidth/2} y={25} textAnchor="middle" className="text-sm font-semibold" fill="#1e293b">
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
                  x={xScale(item.effect) - boxSize/2}
                  y={y - boxSize/2}
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
          <text x={plotLeft + plotWidth/2} y={height + 25} textAnchor="middle" className="text-xs" fill="#64748b">
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

const MetaAnalysisCalculator: React.FC = () => {
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
            <a href="/research" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MS</span>
              </div>
              <span className="text-white font-semibold">MSDrills</span>
            </a>
            <span className="text-slate-500">/</span>
            <span className="text-cyan-400">Meta-Analysis</span>
          </div>
          <a href="/research" className="text-slate-400 hover:text-white text-sm">
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
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
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
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
              >
                <option value="fixed">Fixed Effect</option>
                <option value="random">Random Effects</option>
              </select>
            </div>
            
            {/* Data mode */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Input</label>
              <select
                value={dataMode}
                onChange={(e) => setDataMode(e.target.value as typeof dataMode)}
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
              >
                <option value="continuous">Continuous (N, Mean, SD)</option>
                <option value="binary">Binary (Events, Total)</option>
                <option value="precalculated">Pre-calculated (Effect, SE)</option>
              </select>
            </div>
            
            <div className="flex-1"></div>
            
            {/* Import */}
            <label className="cursor-pointer">
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
              <span className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm inline-block">
                Import CSV
              </span>
            </label>
            
            {/* Export */}
            <button
              onClick={exportResults}
              disabled={!pooled}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm"
            >
              Export Results
            </button>
          </div>
        </div>
        
        {/* Data entry */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Study Data</h3>
            <button
              onClick={addStudy}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm"
            >
              + Add Study
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left p-2 font-medium">Study</th>
                  <th className="text-left p-2 font-medium">Year</th>
                  {dataMode === 'continuous' && (
                    <>
                      <th className="text-center p-2 font-medium" colSpan={3}>Intervention</th>
                      <th className="text-center p-2 font-medium" colSpan={3}>Control</th>
                    </>
                  )}
                  {dataMode === 'binary' && (
                    <>
                      <th className="text-center p-2 font-medium" colSpan={2}>Intervention</th>
                      <th className="text-center p-2 font-medium" colSpan={2}>Control</th>
                    </>
                  )}
                  {dataMode === 'precalculated' && (
                    <>
                      <th className="text-center p-2 font-medium">Effect</th>
                      <th className="text-center p-2 font-medium">SE</th>
                    </>
                  )}
                  <th className="p-2"></th>
                </tr>
                {dataMode === 'continuous' && (
                  <tr className="text-slate-500 text-xs">
                    <th></th>
                    <th></th>
                    <th className="p-1">N</th>
                    <th className="p-1">Mean</th>
                    <th className="p-1">SD</th>
                    <th className="p-1">N</th>
                    <th className="p-1">Mean</th>
                    <th className="p-1">SD</th>
                    <th></th>
                  </tr>
                )}
                {dataMode === 'binary' && (
                  <tr className="text-slate-500 text-xs">
                    <th></th>
                    <th></th>
                    <th className="p-1">Events</th>
                    <th className="p-1">Total</th>
                    <th className="p-1">Events</th>
                    <th className="p-1">Total</th>
                    <th></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {studies.map(study => (
                  <tr key={study.id} className="border-b border-slate-700/50">
                    <td className="p-2">
                      <input
                        type="text"
                        value={study.name}
                        onChange={(e) => updateStudy(study.id, 'name', e.target.value)}
                        className="w-32 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={study.year || ''}
                        onChange={(e) => updateStudy(study.id, 'year', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                      />
                    </td>
                    
                    {dataMode === 'continuous' && (
                      <>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.n1 || ''}
                            onChange={(e) => updateStudy(study.id, 'n1', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="N"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.mean1 ?? ''}
                            onChange={(e) => updateStudy(study.id, 'mean1', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="Mean"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.sd1 || ''}
                            onChange={(e) => updateStudy(study.id, 'sd1', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="SD"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.n2 || ''}
                            onChange={(e) => updateStudy(study.id, 'n2', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="N"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.mean2 ?? ''}
                            onChange={(e) => updateStudy(study.id, 'mean2', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="Mean"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.sd2 || ''}
                            onChange={(e) => updateStudy(study.id, 'sd2', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="SD"
                          />
                        </td>
                      </>
                    )}
                    
                    {dataMode === 'binary' && (
                      <>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.events1 ?? ''}
                            onChange={(e) => updateStudy(study.id, 'events1', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.total1 || ''}
                            onChange={(e) => updateStudy(study.id, 'total1', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.events2 ?? ''}
                            onChange={(e) => updateStudy(study.id, 'events2', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={study.total2 || ''}
                            onChange={(e) => updateStudy(study.id, 'total2', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                          />
                        </td>
                      </>
                    )}
                    
                    {dataMode === 'precalculated' && (
                      <>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.effect ?? ''}
                            onChange={(e) => updateStudy(study.id, 'effect', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder={['OR', 'RR', 'HR'].includes(measure) ? 'Log scale' : 'Effect'}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={study.se || ''}
                            onChange={(e) => updateStudy(study.id, 'se', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            placeholder="SE"
                          />
                        </td>
                      </>
                    )}
                    
                    <td className="p-2">
                      <button
                        onClick={() => removeStudy(study.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {studies.length === 0 && (
            <p className="text-center text-slate-400 py-8">
              Add studies or import a CSV to begin
            </p>
          )}
        </div>
        
        {/* Results */}
        {pooled && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Summary stats */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-lg font-medium text-white mb-4">Pooled Results</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Pooled {measure}</div>
                    <div className="text-xl font-bold text-cyan-400">
                      {['OR', 'RR', 'HR'].includes(measure) 
                        ? Math.exp(pooled.effect).toFixed(3) 
                        : pooled.effect.toFixed(3)}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">95% CI</div>
                    <div className="text-xl font-bold text-white">
                      [{['OR', 'RR', 'HR'].includes(measure) 
                        ? Math.exp(pooled.ci_lower).toFixed(2) 
                        : pooled.ci_lower.toFixed(2)}, {['OR', 'RR', 'HR'].includes(measure) 
                        ? Math.exp(pooled.ci_upper).toFixed(2) 
                        : pooled.ci_upper.toFixed(2)}]
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Z statistic</div>
                    <div className="text-lg text-white">{pooled.z.toFixed(3)}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">P-value</div>
                    <div className={`text-lg ${pooled.p < 0.05 ? 'text-emerald-400' : 'text-white'}`}>
                      {pooled.p < 0.001 ? '<0.001' : pooled.p.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Heterogeneity */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-lg font-medium text-white mb-4">Heterogeneity</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">I² (Inconsistency)</div>
                    <div className={`text-xl font-bold ${
                      pooled.i2 < 25 ? 'text-emerald-400' :
                      pooled.i2 < 50 ? 'text-amber-400' :
                      pooled.i2 < 75 ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {pooled.i2.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {pooled.i2 < 25 ? 'Low' : pooled.i2 < 50 ? 'Moderate' : pooled.i2 < 75 ? 'Substantial' : 'Considerable'}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Cochran's Q</div>
                    <div className="text-xl font-bold text-white">{pooled.q.toFixed(2)}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      df={pooled.df}, p={pooled.p_het < 0.001 ? '<0.001' : pooled.p_het.toFixed(3)}
                    </div>
                  </div>
                </div>
                
                {method === 'random' && pooled.tau2 !== undefined && (
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">τ² (Between-study variance)</div>
                    <div className="text-lg text-white">{pooled.tau2.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Plots */}
        {pooled && (
          <div className="space-y-6">
            {/* Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowForest(true)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  showForest ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                Forest Plot
              </button>
              <button
                onClick={() => setShowForest(false)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  !showForest ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                Funnel Plot
              </button>
            </div>
            
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              {showForest ? (
                <ForestPlot studies={studies} pooled={pooled} measure={measure} method={method} />
              ) : (
                <FunnelPlot studies={studies} pooled={pooled} measure={measure} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MetaAnalysisCalculator;
