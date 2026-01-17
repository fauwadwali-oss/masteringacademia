-- MSDrills Research Tools - Supabase Schema
-- Systematic Review & Literature Search Database
-- Version: 1.0.0

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text matching

-- ============================================
-- ENUM TYPES
-- ============================================

-- Review types
CREATE TYPE review_type AS ENUM (
  'systematic_review',
  'scoping_review',
  'rapid_review',
  'meta_analysis',
  'literature_review'
);

-- Search status
CREATE TYPE search_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);

-- Screening decision
CREATE TYPE screening_decision AS ENUM (
  'pending',
  'include',
  'exclude',
  'maybe'
);

-- Paper source databases
CREATE TYPE paper_source AS ENUM (
  'pubmed',
  'openalex',
  'semantic_scholar',
  'medrxiv',
  'biorxiv',
  'europe_pmc',
  'core',
  'arxiv',
  'clinicaltrials',
  'doaj',
  'crossref',
  'manual'
);

-- ============================================
-- TABLES
-- ============================================

-- Projects table (optional - for logged-in users)
-- Public users get a session-based temporary project
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner (null for anonymous/public sessions)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous users
  
  -- Project details
  title TEXT NOT NULL,
  description TEXT,
  review_type review_type DEFAULT 'systematic_review',
  
  -- PICO framework
  pico_population TEXT,
  pico_intervention TEXT,
  pico_comparison TEXT,
  pico_outcome TEXT,
  
  -- Protocol info
  protocol_id TEXT, -- PROSPERO, OSF, etc.
  protocol_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT project_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Index for faster lookups
CREATE INDEX idx_projects_user ON research_projects(user_id);
CREATE INDEX idx_projects_session ON research_projects(session_id);

-- ============================================
-- Searches table - tracks each search execution
-- ============================================
CREATE TABLE research_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  
  -- Search details
  query_string TEXT NOT NULL,
  query_parsed JSONB, -- Structured query (boolean logic, filters)
  
  -- Databases searched
  databases paper_source[] NOT NULL DEFAULT '{pubmed}',
  
  -- Filters applied
  date_from DATE,
  date_to DATE,
  publication_types TEXT[],
  languages TEXT[],
  
  -- Results tracking
  status search_status DEFAULT 'pending',
  total_results INTEGER DEFAULT 0,
  results_per_database JSONB DEFAULT '{}', -- {"pubmed": 150, "openalex": 230}
  
  -- Execution details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- For reproducibility
  api_versions JSONB, -- Track API versions used
  search_hash TEXT, -- Hash of query + filters for dedup
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Version tracking (for search updates)
  version INTEGER DEFAULT 1,
  parent_search_id UUID REFERENCES research_searches(id)
);

CREATE INDEX idx_searches_project ON research_searches(project_id);
CREATE INDEX idx_searches_status ON research_searches(status);
CREATE INDEX idx_searches_hash ON research_searches(search_hash);

-- ============================================
-- Papers table - deduplicated paper repository
-- ============================================
CREATE TABLE research_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  
  -- Identifiers (for deduplication)
  doi TEXT,
  pmid TEXT,
  pmcid TEXT,
  arxiv_id TEXT,
  openalex_id TEXT,
  semantic_scholar_id TEXT,
  
  -- Core metadata
  title TEXT NOT NULL,
  title_normalized TEXT, -- Lowercase, no punctuation (for fuzzy matching)
  abstract TEXT,
  
  -- Authors
  authors JSONB, -- [{name: "Smith J", affiliation: "...", orcid: "..."}]
  first_author TEXT,
  
  -- Publication info
  journal TEXT,
  journal_abbrev TEXT,
  year INTEGER,
  month INTEGER,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  
  -- URLs
  url TEXT,
  pdf_url TEXT, -- From Unpaywall
  
  -- Classification
  publication_type TEXT, -- "journal-article", "preprint", etc.
  mesh_terms TEXT[],
  keywords TEXT[],
  
  -- Metrics
  citation_count INTEGER,
  
  -- Source tracking (PRISMA requirement)
  sources paper_source[] NOT NULL DEFAULT '{}',
  first_found_in paper_source,
  found_in_searches UUID[] DEFAULT '{}', -- Which searches found this paper
  
  -- Deduplication
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of UUID REFERENCES research_papers(id),
  duplicate_confidence FLOAT, -- 0-1 confidence score
  
  -- Quality score (for prioritization)
  quality_score FLOAT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB -- Original API response for debugging
);

-- Indexes for deduplication and search
CREATE INDEX idx_papers_project ON research_papers(project_id);
CREATE INDEX idx_papers_doi ON research_papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_papers_pmid ON research_papers(pmid) WHERE pmid IS NOT NULL;
CREATE INDEX idx_papers_title_trgm ON research_papers USING gin(title_normalized gin_trgm_ops);
CREATE INDEX idx_papers_year ON research_papers(year);
CREATE INDEX idx_papers_sources ON research_papers USING gin(sources);
CREATE INDEX idx_papers_duplicate ON research_papers(is_duplicate);

-- ============================================
-- Screening decisions table
-- ============================================
CREATE TABLE research_screening (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES research_papers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  
  -- Screening stage
  stage TEXT DEFAULT 'title_abstract', -- 'title_abstract', 'full_text'
  
  -- Decision
  decision screening_decision DEFAULT 'pending',
  
  -- Exclusion reason (if excluded)
  exclusion_reason TEXT,
  exclusion_category TEXT, -- "wrong_population", "wrong_intervention", etc.
  
  -- Reviewer info
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_session TEXT, -- For anonymous
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint using functional index (PostgreSQL supports this)
CREATE UNIQUE INDEX idx_screening_unique_decision 
  ON research_screening(paper_id, stage, COALESCE(reviewer_id::text, reviewer_session));

CREATE INDEX idx_screening_paper ON research_screening(paper_id);
CREATE INDEX idx_screening_project ON research_screening(project_id);
CREATE INDEX idx_screening_decision ON research_screening(decision);

-- ============================================
-- PRISMA tracking table
-- ============================================
CREATE TABLE research_prisma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  
  -- Identification
  database_results JSONB DEFAULT '{}', -- {"pubmed": 150, "openalex": 230}
  register_results JSONB DEFAULT '{}', -- Other sources
  total_identified INTEGER DEFAULT 0,
  
  -- Duplicates
  duplicates_removed INTEGER DEFAULT 0,
  records_after_dedup INTEGER DEFAULT 0,
  
  -- Screening
  records_screened INTEGER DEFAULT 0,
  records_excluded_screening INTEGER DEFAULT 0,
  
  -- Eligibility
  full_text_assessed INTEGER DEFAULT 0,
  full_text_excluded INTEGER DEFAULT 0,
  exclusion_reasons JSONB DEFAULT '{}', -- {"wrong_population": 5, "no_full_text": 3}
  
  -- Included
  studies_included INTEGER DEFAULT 0,
  studies_in_synthesis INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id)
);

CREATE INDEX idx_prisma_project ON research_prisma(project_id);

-- ============================================
-- Search history for reproducibility
-- ============================================
CREATE TABLE research_search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID REFERENCES research_searches(id) ON DELETE CASCADE,
  
  -- Snapshot data
  query_string TEXT NOT NULL,
  databases TEXT[] NOT NULL,
  filters JSONB,
  results_count JSONB, -- Per database counts
  total_count INTEGER,
  
  -- Execution context
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  api_responses JSONB, -- Store raw API responses for audit
  
  -- Generated report text (for Methods section)
  methods_text TEXT
);

CREATE INDEX idx_history_search ON research_search_history(search_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to normalize title for fuzzy matching
CREATE OR REPLACE FUNCTION normalize_title(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(title, '[^\w\s]', '', 'g'), -- Remove punctuation
      '\s+', ' ', 'g' -- Normalize whitespace
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-normalize titles
CREATE OR REPLACE FUNCTION update_normalized_title()
RETURNS TRIGGER AS $$
BEGIN
  NEW.title_normalized := normalize_title(NEW.title);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER papers_normalize_title
  BEFORE INSERT OR UPDATE OF title ON research_papers
  FOR EACH ROW
  EXECUTE FUNCTION update_normalized_title();

-- Function to calculate title similarity
CREATE OR REPLACE FUNCTION title_similarity(title1 TEXT, title2 TEXT)
RETURNS FLOAT AS $$
BEGIN
  RETURN similarity(normalize_title(title1), normalize_title(title2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find potential duplicates
CREATE OR REPLACE FUNCTION find_duplicates(
  p_project_id UUID,
  p_title TEXT,
  p_doi TEXT DEFAULT NULL,
  p_threshold FLOAT DEFAULT 0.9
)
RETURNS TABLE (
  paper_id UUID,
  match_type TEXT,
  confidence FLOAT
) AS $$
BEGIN
  -- First check DOI (exact match)
  IF p_doi IS NOT NULL THEN
    RETURN QUERY
    SELECT id, 'doi'::TEXT, 1.0::FLOAT
    FROM research_papers
    WHERE project_id = p_project_id
      AND doi = p_doi
      AND is_duplicate = FALSE
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  
  -- Then check title similarity
  RETURN QUERY
  SELECT 
    id,
    'title'::TEXT,
    title_similarity(title, p_title)::FLOAT
  FROM research_papers
  WHERE project_id = p_project_id
    AND is_duplicate = FALSE
    AND title_similarity(title, p_title) >= p_threshold
  ORDER BY title_similarity(title, p_title) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to update PRISMA counts
CREATE OR REPLACE FUNCTION update_prisma_counts(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_database_results JSONB;
  v_total_identified INTEGER;
  v_duplicates INTEGER;
  v_screening_excluded INTEGER;
  v_full_text_excluded INTEGER;
  v_included INTEGER;
BEGIN
  -- Count results per database
  SELECT jsonb_object_agg(source, count)
  INTO v_database_results
  FROM (
    SELECT unnest(sources) as source, COUNT(*) as count
    FROM research_papers
    WHERE project_id = p_project_id
    GROUP BY unnest(sources)
  ) counts;
  
  -- Total identified
  SELECT COUNT(*) INTO v_total_identified
  FROM research_papers WHERE project_id = p_project_id;
  
  -- Duplicates
  SELECT COUNT(*) INTO v_duplicates
  FROM research_papers 
  WHERE project_id = p_project_id AND is_duplicate = TRUE;
  
  -- Screening excluded
  SELECT COUNT(*) INTO v_screening_excluded
  FROM research_screening
  WHERE project_id = p_project_id 
    AND stage = 'title_abstract' 
    AND decision = 'exclude';
  
  -- Full text excluded
  SELECT COUNT(*) INTO v_full_text_excluded
  FROM research_screening
  WHERE project_id = p_project_id 
    AND stage = 'full_text' 
    AND decision = 'exclude';
  
  -- Included
  SELECT COUNT(*) INTO v_included
  FROM research_screening
  WHERE project_id = p_project_id 
    AND stage = 'full_text' 
    AND decision = 'include';
  
  -- Upsert PRISMA record
  INSERT INTO research_prisma (
    project_id,
    database_results,
    total_identified,
    duplicates_removed,
    records_after_dedup,
    records_screened,
    records_excluded_screening,
    full_text_assessed,
    full_text_excluded,
    studies_included,
    last_updated
  ) VALUES (
    p_project_id,
    COALESCE(v_database_results, '{}'::jsonb),
    v_total_identified,
    v_duplicates,
    v_total_identified - v_duplicates,
    v_total_identified - v_duplicates,
    v_screening_excluded,
    (v_total_identified - v_duplicates - v_screening_excluded),
    v_full_text_excluded,
    v_included,
    NOW()
  )
  ON CONFLICT (project_id) DO UPDATE SET
    database_results = EXCLUDED.database_results,
    total_identified = EXCLUDED.total_identified,
    duplicates_removed = EXCLUDED.duplicates_removed,
    records_after_dedup = EXCLUDED.records_after_dedup,
    records_screened = EXCLUDED.records_screened,
    records_excluded_screening = EXCLUDED.records_excluded_screening,
    full_text_assessed = EXCLUDED.full_text_assessed,
    full_text_excluded = EXCLUDED.full_text_excluded,
    studies_included = EXCLUDED.studies_included,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_screening ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_prisma ENABLE ROW LEVEL SECURITY;

-- Policies for projects
CREATE POLICY "Users can view own projects"
  ON research_projects FOR SELECT
  USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "Users can insert own projects"
  ON research_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "Users can update own projects"
  ON research_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON research_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for searches (same pattern)
CREATE POLICY "Users can manage searches in own projects"
  ON research_searches FOR ALL
  USING (
    project_id IN (
      SELECT id FROM research_projects 
      WHERE user_id = auth.uid() OR session_id IS NOT NULL
    )
  );

-- Policies for papers
CREATE POLICY "Users can manage papers in own projects"
  ON research_papers FOR ALL
  USING (
    project_id IN (
      SELECT id FROM research_projects 
      WHERE user_id = auth.uid() OR session_id IS NOT NULL
    )
  );

-- Policies for screening
CREATE POLICY "Users can manage screening in own projects"
  ON research_screening FOR ALL
  USING (
    project_id IN (
      SELECT id FROM research_projects 
      WHERE user_id = auth.uid() OR session_id IS NOT NULL
    )
  );

-- Policies for PRISMA
CREATE POLICY "Users can manage PRISMA in own projects"
  ON research_prisma FOR ALL
  USING (
    project_id IN (
      SELECT id FROM research_projects 
      WHERE user_id = auth.uid() OR session_id IS NOT NULL
    )
  );

-- ============================================
-- ANONYMOUS ACCESS FOR PUBLIC TOOL
-- ============================================

-- Allow anonymous insert for session-based projects
CREATE POLICY "Anonymous can create session projects"
  ON research_projects FOR INSERT
  WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);


-- ============================================
-- SCREENING TOOL SPECIFIC TABLES (Standalone Mode)
-- ============================================

CREATE TABLE IF NOT EXISTS screening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  stage TEXT DEFAULT 'title_abstract',
  total_papers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_session_id UUID REFERENCES screening_sessions(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  authors JSONB,
  journal TEXT,
  year INTEGER,
  doi TEXT,
  pmid TEXT,
  url TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_session_id UUID REFERENCES screening_sessions(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES screening_papers(id) ON DELETE CASCADE,
  decision TEXT CHECK (decision IN ('include', 'exclude', 'maybe')),
  exclusion_reason TEXT,
  notes TEXT,
  reviewer_session TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(screening_session_id, paper_id, reviewer_session)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_screening_papers_session ON screening_papers(screening_session_id);
CREATE INDEX IF NOT EXISTS idx_screening_decisions_session ON screening_decisions(screening_session_id);

-- RLS (Enable if needed, currently open for worker access)
ALTER TABLE screening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_decisions ENABLE ROW LEVEL SECURITY;

-- Allow public access (or restrict as needed for your auth setup)
CREATE POLICY "Public access" ON screening_sessions FOR ALL USING (true);
CREATE POLICY "Public access" ON screening_papers FOR ALL USING (true);
CREATE POLICY "Public access" ON screening_decisions FOR ALL USING (true);
