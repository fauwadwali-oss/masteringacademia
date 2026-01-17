-- ============================================
-- Systematic Review Dashboard Schema
-- Ties all 10 tools together with project-level navigation
-- ============================================

-- 1. CORE PROJECT TABLE
-- ============================================
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  
  -- PICO Framework
  pico_population TEXT,
  pico_intervention TEXT,
  pico_comparison TEXT,
  pico_outcome TEXT,
  
  -- Review type
  review_type TEXT DEFAULT 'systematic_review' 
    CHECK (review_type IN ('systematic_review', 'meta_analysis', 'scoping_review', 'rapid_review')),
  
  -- Status tracking
  status TEXT DEFAULT 'planning'
    CHECK (status IN ('planning', 'searching', 'screening', 'extraction', 'analysis', 'writing', 'complete', 'archived')),
  
  -- Settings
  settings JSONB DEFAULT '{
    "dual_screening": false,
    "dual_extraction": false,
    "blind_mode": true,
    "require_exclusion_reason": true
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. TEAM MEMBERS
-- ============================================
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  role TEXT DEFAULT 'reviewer'
    CHECK (role IN ('owner', 'reviewer', 'viewer')),
  
  -- Invitation tracking
  invited_by UUID REFERENCES auth.users,
  invited_email TEXT,
  invite_token UUID DEFAULT gen_random_uuid(),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  UNIQUE(project_id, user_id)
);

-- 3. ACTIVITY LOG
-- ============================================
CREATE TABLE project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users,
  
  action TEXT NOT NULL,
  entity_type TEXT, -- 'paper', 'search', 'extraction', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast activity queries
CREATE INDEX idx_activity_project ON project_activity(project_id, created_at DESC);

-- 4. PROJECT STATISTICS (Materialized for performance)
-- ============================================
CREATE TABLE project_stats (
  project_id UUID PRIMARY KEY REFERENCES research_projects ON DELETE CASCADE,
  
  -- Paper counts
  total_papers INT DEFAULT 0,
  unique_papers INT DEFAULT 0,
  duplicates_removed INT DEFAULT 0,
  
  -- Screening counts
  papers_screened INT DEFAULT 0,
  papers_included INT DEFAULT 0,
  papers_excluded INT DEFAULT 0,
  papers_maybe INT DEFAULT 0,
  screening_conflicts INT DEFAULT 0,
  conflicts_resolved INT DEFAULT 0,
  
  -- Full-text counts
  fulltext_retrieved INT DEFAULT 0,
  fulltext_included INT DEFAULT 0,
  fulltext_excluded INT DEFAULT 0,
  
  -- Extraction counts
  papers_extracted INT DEFAULT 0,
  
  -- Assessment counts
  rob_assessed INT DEFAULT 0,
  grade_assessed INT DEFAULT 0,
  
  -- Meta-analysis
  meta_analyses_run INT DEFAULT 0,
  
  -- Computed
  screening_progress DECIMAL(5,2) DEFAULT 0,
  extraction_progress DECIMAL(5,2) DEFAULT 0,
  overall_progress DECIMAL(5,2) DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LINK EXISTING TABLES TO PROJECTS
-- ============================================

-- Add project_id to all tool tables (run these ALTER statements)
-- Note: These assume the tables already exist from previous phases

-- research_searches
ALTER TABLE research_searches 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- research_papers
ALTER TABLE research_papers 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- screening_decisions
ALTER TABLE screening_decisions 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- extraction_forms
ALTER TABLE extraction_forms 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- extraction_data
ALTER TABLE extraction_data 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- rob_assessments
ALTER TABLE rob_assessments 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- meta_analyses
ALTER TABLE meta_analyses 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- grade_assessments
ALTER TABLE grade_assessments 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- search_monitors
ALTER TABLE search_monitors 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- citation_sessions
ALTER TABLE citation_sessions 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES research_projects ON DELETE CASCADE;

-- 6. INDEXES FOR PROJECT QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_searches_project ON research_searches(project_id);
CREATE INDEX IF NOT EXISTS idx_papers_project ON research_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_screening_project ON screening_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_extraction_project ON extraction_forms(project_id);
CREATE INDEX IF NOT EXISTS idx_rob_project ON rob_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_meta_project ON meta_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_grade_project ON grade_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_monitors_project ON search_monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_project ON citation_sessions(project_id);

-- 7. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stats ENABLE ROW LEVEL SECURITY;

-- Project owner has full access
CREATE POLICY "owner_full_access" ON research_projects
  FOR ALL USING (user_id = auth.uid());

-- Team members can view projects they belong to
CREATE POLICY "member_view_projects" ON research_projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Team members can view other members
CREATE POLICY "member_view_members" ON project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

-- Owner can manage members
CREATE POLICY "owner_manage_members" ON project_members
  FOR ALL USING (
    project_id IN (
      SELECT id FROM research_projects WHERE user_id = auth.uid()
    )
  );

-- Activity visible to all project members
CREATE POLICY "member_view_activity" ON project_activity
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT id FROM research_projects WHERE user_id = auth.uid()
    )
  );

-- Stats visible to all project members
CREATE POLICY "member_view_stats" ON project_stats
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT id FROM research_projects WHERE user_id = auth.uid()
    )
  );

-- 8. FUNCTIONS: UPDATE PROJECT STATS
-- ============================================
CREATE OR REPLACE FUNCTION update_project_stats(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INT;
  v_unique INT;
  v_screened INT;
  v_included INT;
  v_excluded INT;
  v_maybe INT;
  v_extracted INT;
  v_rob INT;
  v_grade INT;
  v_meta INT;
BEGIN
  -- Count papers
  SELECT COUNT(*) INTO v_total 
  FROM research_papers WHERE project_id = p_project_id;
  
  SELECT COUNT(*) INTO v_unique 
  FROM research_papers WHERE project_id = p_project_id AND is_duplicate = false;
  
  -- Count screening decisions
  SELECT 
    COUNT(*) FILTER (WHERE decision IS NOT NULL),
    COUNT(*) FILTER (WHERE decision = 'include'),
    COUNT(*) FILTER (WHERE decision = 'exclude'),
    COUNT(*) FILTER (WHERE decision = 'maybe')
  INTO v_screened, v_included, v_excluded, v_maybe
  FROM screening_decisions WHERE project_id = p_project_id;
  
  -- Count extractions
  SELECT COUNT(DISTINCT paper_id) INTO v_extracted
  FROM extraction_data WHERE project_id = p_project_id;
  
  -- Count ROB assessments
  SELECT COUNT(DISTINCT paper_id) INTO v_rob
  FROM rob_assessments WHERE project_id = p_project_id;
  
  -- Count GRADE assessments
  SELECT COUNT(*) INTO v_grade
  FROM grade_assessments WHERE project_id = p_project_id;
  
  -- Count meta-analyses
  SELECT COUNT(*) INTO v_meta
  FROM meta_analyses WHERE project_id = p_project_id;
  
  -- Upsert stats
  INSERT INTO project_stats (
    project_id, total_papers, unique_papers, duplicates_removed,
    papers_screened, papers_included, papers_excluded, papers_maybe,
    papers_extracted, rob_assessed, grade_assessed, meta_analyses_run,
    screening_progress, extraction_progress, overall_progress,
    updated_at
  ) VALUES (
    p_project_id, v_total, v_unique, v_total - v_unique,
    v_screened, v_included, v_excluded, v_maybe,
    v_extracted, v_rob, v_grade, v_meta,
    CASE WHEN v_unique > 0 THEN (v_screened::DECIMAL / v_unique) * 100 ELSE 0 END,
    CASE WHEN v_included > 0 THEN (v_extracted::DECIMAL / v_included) * 100 ELSE 0 END,
    -- Overall progress weighted calculation
    (
      CASE WHEN v_total > 0 THEN 10 ELSE 0 END +  -- Has papers
      CASE WHEN v_unique < v_total THEN 10 ELSE 0 END +  -- Deduplicated
      CASE WHEN v_unique > 0 THEN (v_screened::DECIMAL / v_unique) * 30 ELSE 0 END +  -- Screening
      CASE WHEN v_included > 0 THEN (v_extracted::DECIMAL / v_included) * 20 ELSE 0 END +  -- Extraction
      CASE WHEN v_included > 0 THEN (v_rob::DECIMAL / v_included) * 10 ELSE 0 END +  -- ROB
      CASE WHEN v_meta > 0 THEN 10 ELSE 0 END +  -- Meta-analysis
      CASE WHEN v_grade > 0 THEN 10 ELSE 0 END  -- GRADE
    ),
    NOW()
  )
  ON CONFLICT (project_id) DO UPDATE SET
    total_papers = EXCLUDED.total_papers,
    unique_papers = EXCLUDED.unique_papers,
    duplicates_removed = EXCLUDED.duplicates_removed,
    papers_screened = EXCLUDED.papers_screened,
    papers_included = EXCLUDED.papers_included,
    papers_excluded = EXCLUDED.papers_excluded,
    papers_maybe = EXCLUDED.papers_maybe,
    papers_extracted = EXCLUDED.papers_extracted,
    rob_assessed = EXCLUDED.rob_assessed,
    grade_assessed = EXCLUDED.grade_assessed,
    meta_analyses_run = EXCLUDED.meta_analyses_run,
    screening_progress = EXCLUDED.screening_progress,
    extraction_progress = EXCLUDED.extraction_progress,
    overall_progress = EXCLUDED.overall_progress,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 9. TRIGGERS TO AUTO-UPDATE STATS
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_project_stats(OLD.project_id);
  ELSE
    PERFORM update_project_stats(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on key tables
CREATE TRIGGER update_stats_on_paper
  AFTER INSERT OR UPDATE OR DELETE ON research_papers
  FOR EACH ROW EXECUTE FUNCTION trigger_update_stats();

CREATE TRIGGER update_stats_on_screening
  AFTER INSERT OR UPDATE OR DELETE ON screening_decisions
  FOR EACH ROW EXECUTE FUNCTION trigger_update_stats();

CREATE TRIGGER update_stats_on_extraction
  AFTER INSERT OR UPDATE OR DELETE ON extraction_data
  FOR EACH ROW EXECUTE FUNCTION trigger_update_stats();

CREATE TRIGGER update_stats_on_rob
  AFTER INSERT OR UPDATE OR DELETE ON rob_assessments
  FOR EACH ROW EXECUTE FUNCTION trigger_update_stats();

-- 10. FUNCTION: LOG ACTIVITY
-- ============================================
CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_project_id, p_user_id, p_action, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 11. VIEW: PROJECT OVERVIEW
-- ============================================
CREATE OR REPLACE VIEW project_overview AS
SELECT 
  p.id,
  p.user_id,
  p.title,
  p.description,
  p.pico_population,
  p.pico_intervention,
  p.pico_comparison,
  p.pico_outcome,
  p.review_type,
  p.status,
  p.settings,
  p.created_at,
  p.updated_at,
  
  -- Stats
  COALESCE(s.total_papers, 0) as total_papers,
  COALESCE(s.unique_papers, 0) as unique_papers,
  COALESCE(s.papers_screened, 0) as papers_screened,
  COALESCE(s.papers_included, 0) as papers_included,
  COALESCE(s.papers_extracted, 0) as papers_extracted,
  COALESCE(s.rob_assessed, 0) as rob_assessed,
  COALESCE(s.overall_progress, 0) as overall_progress,
  
  -- Team count
  (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id AND pm.accepted_at IS NOT NULL) as team_count,
  
  -- Owner info
  (SELECT email FROM auth.users WHERE id = p.user_id) as owner_email

FROM research_projects p
LEFT JOIN project_stats s ON s.project_id = p.id;

-- 12. GRANT PERMISSIONS
-- ============================================
GRANT ALL ON research_projects TO authenticated;
GRANT ALL ON project_members TO authenticated;
GRANT ALL ON project_activity TO authenticated;
GRANT ALL ON project_stats TO authenticated;
GRANT SELECT ON project_overview TO authenticated; -- Grant access to the view
GRANT EXECUTE ON FUNCTION update_project_stats TO authenticated;
GRANT EXECUTE ON FUNCTION log_project_activity TO authenticated;
