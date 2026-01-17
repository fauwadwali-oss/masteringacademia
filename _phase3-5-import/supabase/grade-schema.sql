-- ============================================
-- GRADE Evidence Tables Schema
-- Phase 5: Evidence Synthesis
-- ============================================

-- GRADE Sessions (one per systematic review)
CREATE TABLE IF NOT EXISTS grade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  review_question TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GRADE Outcomes (multiple per session)
CREATE TABLE IF NOT EXISTS grade_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES grade_sessions(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  importance TEXT CHECK (importance IN ('critical', 'important', 'not_important')) DEFAULT 'important',
  study_design TEXT CHECK (study_design IN ('rct', 'observational')) DEFAULT 'rct',
  
  -- Study data
  number_of_studies INTEGER DEFAULT 0,
  total_participants INTEGER DEFAULT 0,
  
  -- Effect data (from meta-analysis)
  effect_measure TEXT, -- RR, OR, HR, MD, SMD, RD
  effect_estimate NUMERIC,
  ci_lower NUMERIC,
  ci_upper NUMERIC,
  
  -- Heterogeneity
  i_squared NUMERIC,
  
  -- Absolute effects (for binary outcomes)
  baseline_risk NUMERIC, -- per 1000
  absolute_effect_intervention NUMERIC,
  absolute_effect_control NUMERIC,
  
  -- Five downgrade domains (JSONB for flexibility)
  risk_of_bias JSONB DEFAULT '{"level": "none", "reason": ""}',
  inconsistency JSONB DEFAULT '{"level": "none", "reason": ""}',
  indirectness JSONB DEFAULT '{"level": "none", "reason": ""}',
  imprecision JSONB DEFAULT '{"level": "none", "reason": ""}',
  publication_bias JSONB DEFAULT '{"level": "none", "reason": ""}',
  
  -- Three upgrade factors (observational only)
  large_effect TEXT CHECK (large_effect IN ('none', 'upgrade_1', 'upgrade_2')) DEFAULT 'none',
  dose_response TEXT CHECK (dose_response IN ('none', 'upgrade_1')) DEFAULT 'none',
  plausible_confounding TEXT CHECK (plausible_confounding IN ('none', 'upgrade_1')) DEFAULT 'none',
  
  -- Overall certainty (calculated)
  overall_certainty TEXT CHECK (overall_certainty IN ('high', 'moderate', 'low', 'very_low')),
  
  -- Footnotes
  footnotes TEXT[],
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grade_sessions_user ON grade_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_grade_outcomes_session ON grade_outcomes(session_id);

-- Function to calculate GRADE certainty
CREATE OR REPLACE FUNCTION calculate_grade_certainty(
  p_study_design TEXT,
  p_risk_of_bias JSONB,
  p_inconsistency JSONB,
  p_indirectness JSONB,
  p_imprecision JSONB,
  p_publication_bias JSONB,
  p_large_effect TEXT,
  p_dose_response TEXT,
  p_plausible_confounding TEXT
) RETURNS TEXT AS $$
DECLARE
  score INTEGER;
  domain_level TEXT;
BEGIN
  -- Starting score: RCT = 4 (High), Observational = 2 (Low)
  IF p_study_design = 'rct' THEN
    score := 4;
  ELSE
    score := 2;
  END IF;
  
  -- Downgrade for each domain
  -- Risk of bias
  domain_level := p_risk_of_bias->>'level';
  IF domain_level = 'serious' THEN score := score - 1;
  ELSIF domain_level = 'very_serious' THEN score := score - 2;
  END IF;
  
  -- Inconsistency
  domain_level := p_inconsistency->>'level';
  IF domain_level = 'serious' THEN score := score - 1;
  ELSIF domain_level = 'very_serious' THEN score := score - 2;
  END IF;
  
  -- Indirectness
  domain_level := p_indirectness->>'level';
  IF domain_level = 'serious' THEN score := score - 1;
  ELSIF domain_level = 'very_serious' THEN score := score - 2;
  END IF;
  
  -- Imprecision
  domain_level := p_imprecision->>'level';
  IF domain_level = 'serious' THEN score := score - 1;
  ELSIF domain_level = 'very_serious' THEN score := score - 2;
  END IF;
  
  -- Publication bias
  domain_level := p_publication_bias->>'level';
  IF domain_level = 'serious' THEN score := score - 1;
  ELSIF domain_level = 'very_serious' THEN score := score - 2;
  END IF;
  
  -- Upgrade for observational studies only
  IF p_study_design = 'observational' THEN
    IF p_large_effect = 'upgrade_1' THEN score := score + 1;
    ELSIF p_large_effect = 'upgrade_2' THEN score := score + 2;
    END IF;
    
    IF p_dose_response = 'upgrade_1' THEN score := score + 1; END IF;
    IF p_plausible_confounding = 'upgrade_1' THEN score := score + 1; END IF;
  END IF;
  
  -- Clamp to valid range (1-4)
  score := GREATEST(1, LEAST(4, score));
  
  -- Return certainty level
  CASE score
    WHEN 4 THEN RETURN 'high';
    WHEN 3 THEN RETURN 'moderate';
    WHEN 2 THEN RETURN 'low';
    ELSE RETURN 'very_low';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate certainty on insert/update
CREATE OR REPLACE FUNCTION update_grade_certainty()
RETURNS TRIGGER AS $$
BEGIN
  NEW.overall_certainty := calculate_grade_certainty(
    NEW.study_design,
    NEW.risk_of_bias,
    NEW.inconsistency,
    NEW.indirectness,
    NEW.imprecision,
    NEW.publication_bias,
    NEW.large_effect,
    NEW.dose_response,
    NEW.plausible_confounding
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grade_certainty
  BEFORE INSERT OR UPDATE ON grade_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_grade_certainty();

-- Update session timestamp when outcomes change
CREATE OR REPLACE FUNCTION update_grade_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE grade_sessions 
  SET updated_at = NOW() 
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grade_session_update
  AFTER INSERT OR UPDATE OR DELETE ON grade_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_grade_session_timestamp();

-- Summary function for GRADE session
CREATE OR REPLACE FUNCTION get_grade_summary(p_session_id UUID)
RETURNS TABLE (
  total_outcomes INTEGER,
  critical_outcomes INTEGER,
  high_certainty INTEGER,
  moderate_certainty INTEGER,
  low_certainty INTEGER,
  very_low_certainty INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_outcomes,
    COUNT(*) FILTER (WHERE importance = 'critical')::INTEGER as critical_outcomes,
    COUNT(*) FILTER (WHERE overall_certainty = 'high')::INTEGER as high_certainty,
    COUNT(*) FILTER (WHERE overall_certainty = 'moderate')::INTEGER as moderate_certainty,
    COUNT(*) FILTER (WHERE overall_certainty = 'low')::INTEGER as low_certainty,
    COUNT(*) FILTER (WHERE overall_certainty = 'very_low')::INTEGER as very_low_certainty
  FROM grade_outcomes
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE grade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_outcomes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY grade_sessions_user_policy ON grade_sessions
  FOR ALL USING (
    user_id = auth.uid() OR user_id IS NULL
  );

-- Users can access outcomes from their sessions
CREATE POLICY grade_outcomes_user_policy ON grade_outcomes
  FOR ALL USING (
    session_id IN (
      SELECT id FROM grade_sessions 
      WHERE user_id = auth.uid() OR user_id IS NULL
    )
  );

-- ============================================
-- Link GRADE to existing tools (optional)
-- ============================================

-- Link outcomes to meta-analysis results
ALTER TABLE grade_outcomes 
  ADD COLUMN IF NOT EXISTS meta_study_id UUID REFERENCES meta_studies(id) ON DELETE SET NULL;

-- Link outcomes to ROB assessments
ALTER TABLE grade_outcomes 
  ADD COLUMN IF NOT EXISTS rob_session_id UUID REFERENCES rob_sessions(id) ON DELETE SET NULL;

-- Function to auto-populate from meta-analysis
CREATE OR REPLACE FUNCTION populate_grade_from_meta(
  p_grade_session_id UUID,
  p_meta_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
  outcomes_created INTEGER := 0;
  meta_record RECORD;
BEGIN
  -- Get pooled results from meta-analysis session
  FOR meta_record IN 
    SELECT 
      ms.id,
      ms.study_name,
      ms.effect_size,
      ms.se,
      mr.pooled_effect,
      mr.pooled_ci_lower,
      mr.pooled_ci_upper,
      mr.i_squared,
      mr.effect_measure,
      mr.total_studies,
      mr.total_n
    FROM meta_studies ms
    JOIN meta_results mr ON ms.session_id = mr.session_id
    WHERE ms.session_id = p_meta_session_id
    LIMIT 1 -- Just get session-level pooled results
  LOOP
    INSERT INTO grade_outcomes (
      session_id,
      name,
      study_design,
      number_of_studies,
      total_participants,
      effect_measure,
      effect_estimate,
      ci_lower,
      ci_upper,
      i_squared
    ) VALUES (
      p_grade_session_id,
      meta_record.study_name,
      'rct', -- Default, can be changed
      meta_record.total_studies,
      meta_record.total_n,
      meta_record.effect_measure,
      meta_record.pooled_effect,
      meta_record.pooled_ci_lower,
      meta_record.pooled_ci_upper,
      meta_record.i_squared
    );
    outcomes_created := outcomes_created + 1;
  END LOOP;
  
  RETURN outcomes_created;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views for reporting
-- ============================================

-- Summary of Findings view
CREATE OR REPLACE VIEW grade_sof_view AS
SELECT
  gs.id as session_id,
  gs.name as review_name,
  gs.review_question,
  go.id as outcome_id,
  go.name as outcome_name,
  go.importance,
  go.study_design,
  go.number_of_studies,
  go.total_participants,
  go.effect_measure,
  go.effect_estimate,
  go.ci_lower,
  go.ci_upper,
  go.absolute_effect_control,
  go.absolute_effect_intervention,
  go.overall_certainty,
  -- Generate certainty symbol
  CASE go.overall_certainty
    WHEN 'high' THEN '⊕⊕⊕⊕'
    WHEN 'moderate' THEN '⊕⊕⊕○'
    WHEN 'low' THEN '⊕⊕○○'
    WHEN 'very_low' THEN '⊕○○○'
  END as certainty_symbol,
  -- Downgrade reasons
  CASE WHEN (go.risk_of_bias->>'level') != 'none' 
    THEN go.risk_of_bias->>'reason' END as rob_reason,
  CASE WHEN (go.inconsistency->>'level') != 'none' 
    THEN go.inconsistency->>'reason' END as inconsistency_reason,
  CASE WHEN (go.indirectness->>'level') != 'none' 
    THEN go.indirectness->>'reason' END as indirectness_reason,
  CASE WHEN (go.imprecision->>'level') != 'none' 
    THEN go.imprecision->>'reason' END as imprecision_reason,
  CASE WHEN (go.publication_bias->>'level') != 'none' 
    THEN go.publication_bias->>'reason' END as pub_bias_reason,
  go.sort_order
FROM grade_sessions gs
JOIN grade_outcomes go ON go.session_id = gs.id
ORDER BY gs.id, go.sort_order, go.created_at;

-- Domain-level breakdown view
CREATE OR REPLACE VIEW grade_domains_view AS
SELECT
  go.session_id,
  go.id as outcome_id,
  go.name as outcome_name,
  go.study_design,
  go.risk_of_bias->>'level' as rob_level,
  go.inconsistency->>'level' as inconsistency_level,
  go.indirectness->>'level' as indirectness_level,
  go.imprecision->>'level' as imprecision_level,
  go.publication_bias->>'level' as pub_bias_level,
  go.large_effect,
  go.dose_response,
  go.plausible_confounding,
  go.overall_certainty
FROM grade_outcomes go;
