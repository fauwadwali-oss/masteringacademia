# Systematic Review Tools - Phase 3, 4 & 5

Advanced tools for data extraction, quality assessment, meta-analysis, and GRADE evidence synthesis.

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

---

#### 2. Risk of Bias Tool (`RiskOfBiasTool.tsx`)

Quality assessment using standardized tools with traffic light visualization.

**Assessment Tools:**

| Tool | Use Case | Domains |
|------|----------|---------|
| **ROB 2** | Randomized controlled trials | 5 domains with signaling questions |
| **ROBINS-I** | Non-randomized intervention studies | 7 domains |
| **Newcastle-Ottawa Scale** | Cohort & case-control studies | Selection, Comparability, Outcome/Exposure |

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

**Features:**
- Fixed Effect and Random Effects (DerSimonian-Laird)
- Cochran's Q, I², and τ² statistics
- Forest Plot (SVG export)
- Funnel Plot (SVG export)

---

### Phase 5: Evidence Synthesis

#### 4. GRADE Evidence Tables (`GRADEEvidenceTool.tsx`)

Create Summary of Findings tables using the GRADE methodology.

**GRADE Domains (Downgrade):**
| Domain | Description |
|--------|-------------|
| Risk of Bias | Limitations in study design or execution |
| Inconsistency | Unexplained heterogeneity (I², direction) |
| Indirectness | PICO differences from review question |
| Imprecision | Wide CIs, small samples, few events |
| Publication Bias | Selective reporting (funnel asymmetry) |

**Upgrade Factors (Observational only):**
| Factor | Criteria |
|--------|----------|
| Large Effect | RR >2/<0.5 (+1), RR >5/<0.2 (+2) |
| Dose-Response | Clear dose-response gradient (+1) |
| Plausible Confounding | Residual confounding would reduce effect (+1) |

**Certainty Levels:**
| Level | Symbol | Starting Point |
|-------|--------|----------------|
| High | ⊕⊕⊕⊕ | RCTs |
| Moderate | ⊕⊕⊕○ | RCTs with concerns |
| Low | ⊕⊕○○ | Observational / RCTs with serious concerns |
| Very Low | ⊕○○○ | Observational with concerns |

**Features:**
- Auto-assessment of imprecision based on CI width
- Auto-assessment of inconsistency from I²
- Structured footnote generation
- Summary of Findings table view
- HTML export (publication-ready)
- CSV export for analysis

---

## Installation

### 1. Database Setup

Run the schemas in Supabase SQL Editor:

```sql
-- Run in order:
-- supabase/phase3-schema.sql
-- supabase/grade-schema.sql
```

### 2. Add React Components

Copy to your frontend:

```
frontend/src/pages/
├── DataExtractionTool.tsx
├── RiskOfBiasTool.tsx
├── MetaAnalysisCalculator.tsx
└── GRADEEvidenceTool.tsx
```

### 3. Add Routes

```tsx
import DataExtractionTool from './pages/DataExtractionTool';
import RiskOfBiasTool from './pages/RiskOfBiasTool';
import MetaAnalysisCalculator from './pages/MetaAnalysisCalculator';
import GRADEEvidenceTool from './pages/GRADEEvidenceTool';

<Route path="/research/extraction" element={<DataExtractionTool />} />
<Route path="/research/rob" element={<RiskOfBiasTool />} />
<Route path="/research/meta" element={<MetaAnalysisCalculator />} />
<Route path="/research/grade" element={<GRADEEvidenceTool />} />
```

---

## Workflow

### Complete Systematic Review Flow

```
1. Literature Search
   ↓
2. Deduplication Tool
   ↓
3. Screening Interface
   ↓
4. Data Extraction Tool
   ↓
5. Risk of Bias Tool
   ↓
6. Meta-Analysis Calculator
   ↓
7. GRADE Evidence Tables
   ↓
8. PRISMA Flow Generator
```

### GRADE Workflow

```
1. Create session with PICO question
2. Add outcomes (from meta-analysis or manual)
3. Assess each domain (auto-fill where possible)
4. Document downgrade reasons
5. Review Summary of Findings table
6. Export HTML for publication
```

---

## GRADE Certainty Calculation

```
Starting certainty:
  RCT → High (4)
  Observational → Low (2)

Downgrade for each domain:
  Serious → -1
  Very serious → -2

Upgrade (observational only):
  Large effect → +1 or +2
  Dose-response → +1
  Plausible confounding → +1

Final score (clamped 1-4):
  4 → High
  3 → Moderate
  2 → Low
  1 → Very Low
```

---

## Export Formats

- **Forest Plot**: SVG vector graphic
- **Funnel Plot**: SVG vector graphic
- **ROB Traffic Light**: CSV (robvis compatible)
- **Summary of Findings**: HTML (Cochrane-style table)
- **GRADE Data**: CSV with all domains and ratings

---

## References

- Cochrane Handbook for Systematic Reviews
- ROB 2: Sterne et al. BMJ 2019
- ROBINS-I: Sterne et al. BMJ 2016
- Newcastle-Ottawa Scale: Wells et al.
- GRADE: Guyatt et al. BMJ 2008
- GRADE Handbook: https://gdt.gradepro.org/app/handbook/handbook.html
