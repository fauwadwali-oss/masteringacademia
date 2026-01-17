# Systematic Review Tools - Phase 3 & 4

Advanced tools for data extraction, quality assessment, and meta-analysis.

## Tools Included

### Phase 3: Data Extraction & Quality Assessment

#### 1. Data Extraction Tool (`DataExtractionTool.tsx`)

Customizable forms for extracting study data from included papers.

**Pre-built Templates:**
- **PICO Basic** - Standard population, intervention, comparison, outcome extraction
- **Effect Size Extraction** - Numerical data for meta-analysis (means, SDs, events)
- **RCT Extraction (Cochrane-style)** - Comprehensive RCT data with methods details
- **Observational Study** - Cohort and case-control study extraction

**Features:**
- Tabbed category navigation (Identification, Methods, Population, etc.)
- Progress tracking sidebar
- Auto-save to localStorage
- CSV export with all extracted data
- Paper search within session
- Required field validation

**Field Types:**
- Text input
- Number input
- Textarea (multi-line)
- Select dropdown
- Multi-select checkboxes
- Boolean (Yes/No/N/A)
- Date picker

---

#### 2. Risk of Bias Tool (`RiskOfBiasTool.tsx`)

Quality assessment using standardized tools with traffic light visualization.

**Assessment Tools:**

| Tool | Use Case | Domains |
|------|----------|---------|
| **ROB 2** | Randomized controlled trials | 5 domains with signaling questions |
| **ROBINS-I** | Non-randomized intervention studies | 7 domains |
| **Newcastle-Ottawa Scale** | Cohort & case-control studies | Selection, Comparability, Outcome/Exposure |

**ROB 2 Domains:**
1. Randomization process
2. Deviations from interventions
3. Missing outcome data
4. Measurement of outcome
5. Selection of reported result

**Features:**
- Signaling questions for ROB 2
- Per-domain judgment with support text
- Auto-calculated overall risk
- Traffic light summary table
- Bar chart visualization by domain
- CSV export

---

### Phase 4: Synthesis & Analysis

#### 3. Meta-Analysis Calculator (`MetaAnalysisCalculator.tsx`)

Effect size calculation, pooling, and visualization.

**Effect Measures:**
| Measure | Type | Use Case |
|---------|------|----------|
| SMD | Continuous | Standardized mean difference (Hedges' g) |
| MD | Continuous | Raw mean difference |
| OR | Binary | Odds ratio |
| RR | Binary | Risk ratio |
| RD | Binary | Risk difference |
| HR | Time-to-event | Hazard ratio (pre-calculated) |

**Data Input Modes:**
- **Continuous**: N, Mean, SD for each group
- **Binary**: Events, Total for each group
- **Pre-calculated**: Effect estimate and SE

**Statistical Methods:**
- **Fixed Effect**: Inverse variance weighting
- **Random Effects**: DerSimonian-Laird estimator

**Heterogeneity Statistics:**
- Cochran's Q (with p-value)
- I² (inconsistency index)
- τ² (between-study variance for random effects)

**Visualizations:**
- **Forest Plot**: Study effects with weights, pooled diamond
- **Funnel Plot**: SE vs effect for publication bias assessment

**Export:**
- Results summary (text)
- Forest plot (SVG)
- Funnel plot (SVG)

---

## Installation

### 1. Database Setup

Run the schema in Supabase SQL Editor:

```sql
-- Run supabase/phase3-schema.sql
```

### 2. Add React Components

Copy to your frontend:

```
frontend/src/pages/
├── DataExtractionTool.tsx
├── RiskOfBiasTool.tsx
└── MetaAnalysisCalculator.tsx
```

### 3. Add Routes

```tsx
// App.tsx or routes file
import DataExtractionTool from './pages/DataExtractionTool';
import RiskOfBiasTool from './pages/RiskOfBiasTool';
import MetaAnalysisCalculator from './pages/MetaAnalysisCalculator';

<Route path="/research/extraction" element={<DataExtractionTool />} />
<Route path="/research/rob" element={<RiskOfBiasTool />} />
<Route path="/research/meta" element={<MetaAnalysisCalculator />} />
```

### 4. Add Navigation Links

```tsx
// Research hub page
<a href="/research/extraction">Data Extraction</a>
<a href="/research/rob">Risk of Bias</a>
<a href="/research/meta">Meta-Analysis</a>
```

---

## Workflow Guide

### Complete Systematic Review Flow

```
1. Literature Search
   ↓
2. Deduplication Tool
   ↓
3. Screening Interface
   ↓ (export included papers)
4. Data Extraction Tool
   ↓
5. Risk of Bias Tool
   ↓
6. Meta-Analysis Calculator
   ↓
7. PRISMA Flow Generator
```

---

## Data Formats

### Data Extraction Import (CSV)

```csv
title,authors,year,journal,doi
"Effect of X on Y",Smith et al,2023,Lancet,10.1016/...
```

### ROB Import (CSV)

```csv
study,year
Smith 2023,2023
Jones 2022,2022
```

### Meta-Analysis Import (CSV)

**Continuous data:**
```csv
study,year,n1,mean1,sd1,n2,mean2,sd2
Smith 2023,2023,50,12.5,3.2,48,10.1,2.9
```

**Binary data:**
```csv
study,year,events1,total1,events2,total2
Smith 2023,2023,15,50,8,48
```

**Pre-calculated:**
```csv
study,year,effect,se
Smith 2023,2023,0.45,0.12
```

---

## Statistical Notes

### Effect Size Calculations

**Standardized Mean Difference (Hedges' g):**
```
d = (M1 - M2) / SDpooled
g = d × J   (small sample correction)
J = 1 - 3/(4(n1+n2-2) - 1)
```

**Odds Ratio:**
```
OR = (a×d) / (b×c)
SE(lnOR) = √(1/a + 1/b + 1/c + 1/d)
```

**Risk Ratio:**
```
RR = (a/(a+b)) / (c/(c+d))
SE(lnRR) = √(1/a - 1/(a+b) + 1/c - 1/(c+d))
```

### Heterogeneity

**Cochran's Q:**
```
Q = Σ wi(yi - ȳw)²
```

**I² Statistic:**
```
I² = max(0, (Q - df)/Q × 100%)
```

**Interpretation:**
- 0-25%: Low heterogeneity
- 25-50%: Moderate
- 50-75%: Substantial
- 75-100%: Considerable

### Random Effects (DerSimonian-Laird)

```
τ² = max(0, (Q - df) / C)
C = Σwi - (Σwi²/Σwi)

w*i = 1 / (vi + τ²)
```

---

## Export Formats

### Forest Plot SVG

Publication-ready vector graphic with:
- Study labels and years
- Effect points (size = weight)
- 95% CI lines
- Pooled diamond
- Null effect reference line
- Axis labels

### Funnel Plot SVG

- Study points (effect vs SE)
- Pooled effect vertical line
- Pseudo 95% CI funnel region

### ROB Traffic Light

CSV format compatible with:
- RevMan
- robvis R package
- Excel pivot tables

---

## Tips

### Data Extraction
- Use templates as starting points, customize for your review
- Complete one paper fully to test your template
- Export periodically as backup

### Risk of Bias
- Assess in random order to avoid anchoring
- Document all support statements
- Have second reviewer for at least 20%

### Meta-Analysis
- Check I² before interpreting pooled effect
- Consider sensitivity analyses for high-risk studies
- Inspect funnel plot asymmetry with 10+ studies

---

## Troubleshooting

**Forest plot looks wrong:**
- Check that effect is on log scale for OR/RR/HR
- Verify SE is standard error, not standard deviation

**Heterogeneity too high:**
- Consider subgroup analysis
- Check for outlier studies
- Use random effects model

**Import not working:**
- Ensure CSV headers match expected column names
- Check for special characters in study names
- Verify numbers don't contain commas

---

## Future Enhancements

- [ ] Subgroup analysis
- [ ] Sensitivity analysis (leave-one-out)
- [ ] Egger's test for publication bias
- [ ] Trim-and-fill analysis
- [ ] GRADE evidence tables
- [ ] Network meta-analysis
- [ ] Dual extraction with conflict detection
- [ ] PDF annotation integration

---

## References

- Cochrane Handbook for Systematic Reviews
- ROB 2: Sterne et al. BMJ 2019
- ROBINS-I: Sterne et al. BMJ 2016
- Newcastle-Ottawa Scale: Wells et al.
- Heterogeneity: Higgins et al. BMJ 2003
