-- ============================================
-- Phase 3-4: Data Extraction, ROB, Meta-Analysis
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- Data Extraction Tables
-- ============================================

-- Extraction sessions
CREATE TABLE IF NOT EXISTS extraction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT, -- For anonymous users
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_data JSONB NOT NULL, -- Store full template for reproducibility
  total_papers INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Papers in extraction session
CREATE TABLE IF NOT EXISTS extraction_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES extraction_sessions(id) ON DELETE CASCADE,
  external_id TEXT, -- Original paper ID
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  journal TEXT,
  doi TEXT,
  pmid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction data (one per paper per extractor)
CREATE TABLE IF NOT EXISTS extraction_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES extraction_sessions(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES extraction_papers(id) ON DELETE CASCADE,
  extractor_id TEXT NOT NULL, -- user_id or session_id
  data JSONB NOT NULL, -- Field values
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete', 'needs_review')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paper_id, extractor_id)
);

-- ============================================
-- Risk of Bias Tables
-- ============================================

-- ROB assessment sessions
CREATE TABLE IF NOT EXISTS rob_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  name TEXT NOT NULL,
  tool TEXT NOT NULL CHECK (tool IN ('rob2', 'robins_i', 'nos_cohort', 'nos_case_control')),
  total_studies INTEGER DEFAULT 0,
  assessed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Studies in ROB session
CREATE TABLE IF NOT EXISTS rob_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES rob_sessions(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  year INTEGER,
  design TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROB assessments
CREATE TABLE IF NOT EXISTS rob_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES rob_sessions(id) ON DELETE CASCADE,
  study_id UUID REFERENCES rob_studies(id) ON DELETE CASCADE,
  assessor_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  domains JSONB NOT NULL, -- {domain_id: {judgment, support, signaling}}
  overall TEXT CHECK (overall IN ('low', 'some_concerns', 'high', 'unclear')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(study_id, assessor_id)
);

-- ============================================
-- Meta-Analysis Tables
-- ============================================

-- Meta-analysis sessions
CREATE TABLE IF NOT EXISTS meta_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  name TEXT NOT NULL,
  effect_measure TEXT NOT NULL CHECK (effect_measure IN ('SMD', 'MD', 'OR', 'RR', 'RD', 'HR')),
  pooling_method TEXT DEFAULT 'random' CHECK (pooling_method IN ('fixed', 'random')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Studies in meta-analysis
CREATE TABLE IF NOT EXISTS meta_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES meta_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER,
  
  -- Continuous data
  n1 NUMERIC,
  mean1 NUMERIC,
  sd1 NUMERIC,
  n2 NUMERIC,
  mean2 NUMERIC,
  sd2 NUMERIC,
  
  -- Binary data
  events1 INTEGER,
  total1 INTEGER,
  events2 INTEGER,
  total2 INTEGER,
  
  -- Pre-calculated
  effect NUMERIC,
  se NUMERIC,
  ci_lower NUMERIC,
  ci_upper NUMERIC,
  
  -- Subgroup/moderator
  subgroup TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meta-analysis results (cached calculations)
CREATE TABLE IF NOT EXISTS meta_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES meta_sessions(id) ON DELETE CASCADE,
  analysis_type TEXT DEFAULT 'main', -- 'main', 'subgroup:groupname', 'sensitivity:excludeX'
  
  -- Pooled effect
  pooled_effect NUMERIC NOT NULL,
  pooled_se NUMERIC NOT NULL,
  ci_lower NUMERIC NOT NULL,
  ci_upper NUMERIC NOT NULL,
  z_stat NUMERIC,
  p_value NUMERIC,
  
  -- Heterogeneity
  q_stat NUMERIC,
  q_df INTEGER,
  q_pvalue NUMERIC,
  i2 NUMERIC,
  tau2 NUMERIC,
  
  -- Study weights
  weights JSONB, -- {study_id: weight_percent}
  
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_extraction_sessions_user ON extraction_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_sessions_session ON extraction_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_extraction_papers_session ON extraction_papers(session_id);
CREATE INDEX IF NOT EXISTS idx_extraction_data_paper ON extraction_data(paper_id);
CREATE INDEX IF NOT EXISTS idx_extraction_data_session ON extraction_data(session_id);

CREATE INDEX IF NOT EXISTS idx_rob_sessions_user ON rob_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rob_sessions_session ON rob_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_rob_studies_session ON rob_studies(session_id);
CREATE INDEX IF NOT EXISTS idx_rob_assessments_study ON rob_assessments(study_id);

CREATE INDEX IF NOT EXISTS idx_meta_sessions_user ON meta_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_studies_session ON meta_studies(session_id);
CREATE INDEX IF NOT EXISTS idx_meta_results_session ON meta_results(session_id);

-- ============================================
-- Functions
-- ============================================

-- Get extraction progress
CREATE OR REPLACE FUNCTION get_extraction_progress(p_session_id UUID)
RETURNS TABLE(
  total INTEGER,
  pending INTEGER,
  in_progress INTEGER,
  complete INTEGER,
  needs_review INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM extraction_papers WHERE session_id = p_session_id) as total,
    (SELECT COUNT(*)::INTEGER FROM extraction_papers ep 
     LEFT JOIN extraction_data ed ON ep.id = ed.paper_id 
     WHERE ep.session_id = p_session_id AND ed.id IS NULL) as pending,
    (SELECT COUNT(*)::INTEGER FROM extraction_data WHERE session_id = p_session_id AND status = 'in_progress') as in_progress,
    (SELECT COUNT(*)::INTEGER FROM extraction_data WHERE session_id = p_session_id AND status = 'complete') as complete,
    (SELECT COUNT(*)::INTEGER FROM extraction_data WHERE session_id = p_session_id AND status = 'needs_review') as needs_review;
END;
$$ LANGUAGE plpgsql;

-- Get ROB summary by domain
CREATE OR REPLACE FUNCTION get_rob_summary(p_session_id UUID)
RETURNS TABLE(
  domain_id TEXT,
  low_count INTEGER,
  concerns_count INTEGER,
  high_count INTEGER,
  unclear_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.key as domain_id,
    COUNT(*) FILTER (WHERE d.value->>'judgment' = 'low')::INTEGER as low_count,
    COUNT(*) FILTER (WHERE d.value->>'judgment' = 'some_concerns')::INTEGER as concerns_count,
    COUNT(*) FILTER (WHERE d.value->>'judgment' = 'high')::INTEGER as high_count,
    COUNT(*) FILTER (WHERE d.value->>'judgment' = 'unclear')::INTEGER as unclear_count
  FROM rob_assessments ra,
       jsonb_each(ra.domains) d
  WHERE ra.session_id = p_session_id
  GROUP BY d.key
  ORDER BY d.key;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Update session timestamps
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extraction_sessions_updated
  BEFORE UPDATE ON extraction_sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_timestamp();

CREATE TRIGGER trg_rob_sessions_updated
  BEFORE UPDATE ON rob_sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_timestamp();

CREATE TRIGGER trg_meta_sessions_updated
  BEFORE UPDATE ON meta_sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_timestamp();

-- Update extraction count
CREATE OR REPLACE FUNCTION update_extraction_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE extraction_sessions
  SET completed_count = (
    SELECT COUNT(*) FROM extraction_data 
    WHERE session_id = NEW.session_id AND status = 'complete'
  )
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extraction_data_count
  AFTER INSERT OR UPDATE ON extraction_data
  FOR EACH ROW EXECUTE FUNCTION update_extraction_count();

-- Update ROB assessment count
CREATE OR REPLACE FUNCTION update_rob_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rob_sessions
  SET assessed_count = (
    SELECT COUNT(DISTINCT study_id) FROM rob_assessments 
    WHERE session_id = NEW.session_id AND overall IS NOT NULL
  )
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rob_assessment_count
  AFTER INSERT OR UPDATE ON rob_assessments
  FOR EACH ROW EXECUTE FUNCTION update_rob_count();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE extraction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rob_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rob_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rob_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_results ENABLE ROW LEVEL SECURITY;

-- Extraction policies
CREATE POLICY extraction_sessions_access ON extraction_sessions
  FOR ALL USING (
    user_id = auth.uid() OR 
    session_id = current_setting('app.session_id', true)
  );

CREATE POLICY extraction_papers_access ON extraction_papers
  FOR ALL USING (
    session_id IN (SELECT id FROM extraction_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );

CREATE POLICY extraction_data_access ON extraction_data
  FOR ALL USING (
    session_id IN (SELECT id FROM extraction_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );

-- ROB policies
CREATE POLICY rob_sessions_access ON rob_sessions
  FOR ALL USING (
    user_id = auth.uid() OR 
    session_id = current_setting('app.session_id', true)
  );

CREATE POLICY rob_studies_access ON rob_studies
  FOR ALL USING (
    session_id IN (SELECT id FROM rob_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );

CREATE POLICY rob_assessments_access ON rob_assessments
  FOR ALL USING (
    session_id IN (SELECT id FROM rob_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );

-- Meta-analysis policies
CREATE POLICY meta_sessions_access ON meta_sessions
  FOR ALL USING (
    user_id = auth.uid() OR 
    session_id = current_setting('app.session_id', true)
  );

CREATE POLICY meta_studies_access ON meta_studies
  FOR ALL USING (
    session_id IN (SELECT id FROM meta_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );

CREATE POLICY meta_results_access ON meta_results
  FOR ALL USING (
    session_id IN (SELECT id FROM meta_sessions WHERE user_id = auth.uid() OR session_id = current_setting('app.session_id', true))
  );
