# Systematic Review Tools - Phase 6

Literature monitoring and citation discovery tools using OpenAlex API.

## Tools Included

### 1. Search Monitor (`SearchMonitorTool.tsx`)

Automated literature surveillance to track new publications.

**Features:**
- Save search queries with filters
- Set check frequency (daily/weekly/monthly)
- Track new vs previously seen papers
- In-app alerts for new findings
- Mark papers as read
- Export new results

**Workflow:**
```
1. Create saved search with query + filters
2. System runs initial search (establishes baseline)
3. Future checks compare against seen papers
4. New papers trigger alerts
5. Review and export findings
```

**Filters Available:**
- Year range (from/to)
- Open access only
- Publication type

**Alert System:**
- New paper count per search
- Total unread across all monitors
- Alert history with paper lists

---

### 2. Citation Chaining (`CitationChainingTool.tsx`)

Forward and backward citation exploration via OpenAlex.

**Citation Types:**

| Direction | Description | Use Case |
|-----------|-------------|----------|
| **Forward** | Papers that cite the seed | Find newer work building on it |
| **Backward** | Papers the seed cites | Find foundational literature |

**Features:**
- Search by title, keywords, or DOI
- View citation counts before selecting
- Chain through papers (snowball search)
- Breadcrumb navigation through chain history
- Select papers for export
- Load more with pagination
- Export to CSV

**Snowball Search:**
```
Seed Paper
    ├── Forward Citation A
    │       └── Chain → Forward Citation A1
    └── Backward Citation B
            └── Chain → Backward Citation B1
```

Click "Chain →" on any paper to explore its citations.

---

## Installation

### 1. Database Setup

```sql
-- Run in Supabase SQL Editor
-- supabase/phase6-schema.sql
```

### 2. Add Components

```
frontend/src/pages/
├── SearchMonitorTool.tsx
└── CitationChainingTool.tsx
```

### 3. Add Routes

```tsx
import SearchMonitorTool from './pages/SearchMonitorTool';
import CitationChainingTool from './pages/CitationChainingTool';

<Route path="/research/monitor" element={<SearchMonitorTool />} />
<Route path="/research/citations" element={<CitationChainingTool />} />
```

---

## OpenAlex API

Both tools use the OpenAlex API (free, no key required).

**Endpoints Used:**

| Endpoint | Purpose |
|----------|---------|
| `/works?search=` | Keyword search |
| `/works?filter=cites:` | Forward citations |
| `/works?filter=cited_by:` | Backward citations |
| `/works/{id}` | Single paper lookup |

**Rate Limits:**
- Polite pool: 10 req/sec (with mailto parameter)
- Standard: 100k req/day

**Data Available:**
- Title, authors, year
- DOI, journal
- Citation count
- Reference count
- Open access status
- Abstract (inverted index)

---

## Data Storage

### LocalStorage (Client-side)
- Saved searches
- Seen paper IDs
- Alert history
- Session persistence

### Supabase (Server-side)
- Long-term monitor storage
- Seen papers tracking
- Alert queue
- Citation session history

---

## Search Monitor Details

### Creating a Monitor

1. **Name**: Descriptive label (e.g., "CRISPR gene therapy")
2. **Query**: OpenAlex search syntax
   - Simple: `machine learning cancer`
   - Phrase: `"deep learning"`
   - Boolean: `COVID AND vaccine`
3. **Filters**: Narrow results
4. **Frequency**: How often to check

### How "New" Is Determined

Papers are marked new if their OpenAlex ID hasn't been seen before by that specific monitor. The first run establishes a baseline of existing papers.

### Background Checking (Server-side)

The schema includes queue tables for background job processing:

```sql
-- Get monitors due for check
SELECT * FROM get_monitors_due_for_check();

-- Schedule checks
SELECT schedule_monitor_checks();
```

Implement a cron job or Cloudflare Worker to process the queue.

---

## Citation Chaining Details

### Finding a Seed Paper

- **By DOI**: Paste `10.1234/example` directly
- **By Title**: Enter title keywords
- **By Topic**: General search terms

### Citation Counts

OpenAlex provides:
- `cited_by_count`: Forward citations
- `referenced_works_count`: Backward citations

### Chaining Strategy

**Depth-first**: Follow one paper's citations deeply
**Breadth-first**: Collect all level-1 citations first

The tool supports both via the "Chain →" button.

### Export Format

```csv
title,authors,year,journal,doi,citations,direction
"Paper Title","Smith, J; Doe, A",2023,"Nature","10.1234/...",150,forward
```

---

## Integration with Review Workflow

```
Phase 1: Search Monitor
         └── Alert: 15 new papers on "CRISPR therapy"
         └── Export new papers
                  ↓
Phase 2: Citation Chaining
         └── Select key paper from results
         └── Find 50 forward + 30 backward citations
         └── Export for screening
                  ↓
Phase 3: Screening Interface
         └── Import combined results
         └── Screen titles/abstracts
```

---

## Tips

### Search Monitor
- Start with broader queries, refine based on results
- Weekly frequency balances freshness vs noise
- Use year filters to focus on recent work
- Check total results before saving (avoid >10k)

### Citation Chaining
- Highly cited papers yield more forward citations
- Foundational papers have more backward citations
- Chain through reviews to find primary studies
- Export incrementally as you explore

---

## Troubleshooting

**No results from search:**
- Check query syntax
- Remove special characters
- Try broader terms

**Citation counts seem low:**
- OpenAlex updates weekly
- Very recent papers may not be indexed
- Some sources have limited coverage

**Slow loading:**
- OpenAlex has rate limits
- Large result sets paginate
- Consider filtering to reduce results

---

## Future Enhancements

- [ ] Email notifications (via Resend/SendGrid)
- [ ] Citation network visualization
- [ ] Co-citation analysis
- [ ] Bibliographic coupling
- [ ] Author network mapping
- [ ] RSS feed generation
- [ ] Slack/Discord webhooks
- [ ] ORCID integration

---

## References

- OpenAlex API: https://docs.openalex.org/
- OpenAlex Data: https://openalex.org/
- Citation chaining methodology: Wohlin, C. (2014)
