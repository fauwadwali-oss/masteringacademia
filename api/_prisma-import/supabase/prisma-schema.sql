-- PRISMA Generator Database Schema
-- Add to your existing Supabase schema

-- ============================================
-- PRISMA Data Table (Enhanced)
-- ============================================

-- Drop if exists and recreate with full structure
DROP TABLE IF EXISTS research_prisma CASCADE;

CREATE TABLE research_prisma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous users
  project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  search_id UUID REFERENCES research_searches(id) ON DELETE SET NULL,
  
  -- PRISMA Flow Diagram Data (JSONB for flexibility)
  data JSONB NOT NULL DEFAULT '{
    "identification": {
      "databases": [],
      "registers": [],
      "otherMethods": []
    },
    "screening": {
      "duplicatesRemoved": 0,
      "automationExcluded": 0,
      "recordsScreened": 0,
      "recordsExcluded": 0
    },
    "retrieval": {
      "soughtForRetrieval": 0,
      "notRetrieved": 0
    },
    "eligibility": {
      "assessed": 0,
      "excluded": []
    },
    "included": {
      "newStudies": 0,
      "previousStudies": 0,
      "totalStudies": 0,
      "reportsOfNewStudies": 0,
      "reportsOfPreviousStudies": 0,
      "totalReports": 0
    }
  }'::jsonb,
  
  -- PRISMA 2020 Checklist (27 items)
  checklist JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  title TEXT,
  notes TEXT,
  
  -- Calculated totals (for quick queries)
  total_identified INTEGER GENERATED ALWAYS AS (
    (COALESCE((data->'identification'->'databases')::text, '[]')::jsonb->0->>'count')::integer +
    COALESCE((SELECT SUM((value->>'count')::integer) FROM jsonb_array_elements(data->'identification'->'databases')), 0)
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prisma_user_id ON research_prisma(user_id);
CREATE INDEX idx_prisma_session_id ON research_prisma(session_id);
CREATE INDEX idx_prisma_project_id ON research_prisma(project_id);
CREATE INDEX idx_prisma_search_id ON research_prisma(search_id);
CREATE INDEX idx_prisma_created_at ON research_prisma(created_at DESC);

-- RLS Policies
ALTER TABLE research_prisma ENABLE ROW LEVEL SECURITY;

-- Users can see their own PRISMA data
CREATE POLICY "Users can view own PRISMA"
  ON research_prisma FOR SELECT
  USING (
    auth.uid() = user_id 
    OR session_id = current_setting('app.session_id', true)
  );

-- Users can create PRISMA data
CREATE POLICY "Users can create PRISMA"
  ON research_prisma FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR session_id IS NOT NULL
  );

-- Users can update their own PRISMA data
CREATE POLICY "Users can update own PRISMA"
  ON research_prisma FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR session_id = current_setting('app.session_id', true)
  );

-- Users can delete their own PRISMA data
CREATE POLICY "Users can delete own PRISMA"
  ON research_prisma FOR DELETE
  USING (
    auth.uid() = user_id 
    OR session_id = current_setting('app.session_id', true)
  );

-- ============================================
-- PRISMA Checklist Items Reference Table
-- ============================================

CREATE TABLE prisma_checklist_items (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Insert all 27 PRISMA 2020 items
INSERT INTO prisma_checklist_items (id, section, item_name, description, sort_order) VALUES
-- TITLE
('1', 'TITLE', 'Title', 'Identify the report as a systematic review.', 1),

-- ABSTRACT
('2', 'ABSTRACT', 'Abstract', 'See the PRISMA 2020 for Abstracts checklist.', 2),

-- INTRODUCTION
('3', 'INTRODUCTION', 'Rationale', 'Describe the rationale for the review in the context of existing knowledge.', 3),
('4', 'INTRODUCTION', 'Objectives', 'Provide an explicit statement of the objective(s) or question(s) the review addresses.', 4),

-- METHODS
('5', 'METHODS', 'Eligibility criteria', 'Specify the inclusion and exclusion criteria for the review and how studies were grouped for the syntheses.', 5),
('6', 'METHODS', 'Information sources', 'Specify all databases, registers, websites, organisations, reference lists and other sources searched or consulted to identify studies. Specify the date when each source was last searched or consulted.', 6),
('7', 'METHODS', 'Search strategy', 'Present the full search strategies for all databases, registers and websites, including any filters and limits used.', 7),
('8', 'METHODS', 'Selection process', 'Specify the methods used to decide whether a study met the inclusion criteria of the review, including how many reviewers screened each record and each report retrieved, whether they worked independently, and if applicable, details of automation tools used in the process.', 8),
('9', 'METHODS', 'Data collection process', 'Specify the methods used to collect data from reports, including how many reviewers collected data from each report, whether they worked independently, any processes for obtaining or confirming data from study investigators, and if applicable, details of automation tools used in the process.', 9),
('10a', 'METHODS', 'Data items - outcomes', 'List and define all outcomes for which data were sought. Specify whether all results that were compatible with each outcome domain in each study were sought, and if not, the methods used to decide which results to collect.', 10),
('10b', 'METHODS', 'Data items - other variables', 'List and define all other variables for which data were sought. Describe any assumptions made about any missing or unclear information.', 11),
('11', 'METHODS', 'Study risk of bias assessment', 'Specify the methods used to assess risk of bias in the included studies, including details of the tool(s) used, how many reviewers assessed each study and whether they worked independently, and if applicable, details of automation tools used in the process.', 12),
('12', 'METHODS', 'Effect measures', 'Specify for each outcome the effect measure(s) used in the synthesis or presentation of results.', 13),
('13a', 'METHODS', 'Synthesis methods - eligibility', 'Describe the processes used to decide which studies were eligible for each synthesis.', 14),
('13b', 'METHODS', 'Synthesis methods - data preparation', 'Describe any methods required to prepare the data for presentation or synthesis, such as handling of missing summary statistics, or data conversions.', 15),
('13c', 'METHODS', 'Synthesis methods - tabulation', 'Describe any methods used to tabulate or visually display results of individual studies and syntheses.', 16),
('13d', 'METHODS', 'Synthesis methods - synthesis', 'Describe any methods used to synthesize results and provide a rationale for the choice(s). If meta-analysis was performed, describe the model(s), method(s) to identify the presence and extent of statistical heterogeneity, and software package(s) used.', 17),
('13e', 'METHODS', 'Synthesis methods - heterogeneity', 'Describe any methods used to explore possible causes of heterogeneity among study results.', 18),
('13f', 'METHODS', 'Synthesis methods - sensitivity', 'Describe any sensitivity analyses conducted to assess robustness of the synthesized results.', 19),
('14', 'METHODS', 'Reporting bias assessment', 'Describe any methods used to assess risk of bias due to missing results in a synthesis.', 20),
('15', 'METHODS', 'Certainty assessment', 'Describe any methods used to assess certainty in the body of evidence for an outcome.', 21),

-- RESULTS
('16a', 'RESULTS', 'Study selection - flow', 'Describe the results of the search and selection process, from the number of records identified in the search to the number of studies included in the review, ideally using a flow diagram.', 22),
('16b', 'RESULTS', 'Study selection - exclusions', 'Cite studies that might appear to meet the inclusion criteria, but which were excluded, and explain why they were excluded.', 23),
('17', 'RESULTS', 'Study characteristics', 'Cite each included study and present its characteristics.', 24),
('18', 'RESULTS', 'Risk of bias in studies', 'Present assessments of risk of bias for each included study.', 25),
('19', 'RESULTS', 'Results of individual studies', 'For all outcomes, present, for each study: (a) summary statistics for each group and (b) an effect estimate and its precision, ideally using structured tables or plots.', 26),
('20a', 'RESULTS', 'Results of syntheses - characteristics', 'For each synthesis, briefly summarise the characteristics and risk of bias among contributing studies.', 27),
('20b', 'RESULTS', 'Results of syntheses - statistics', 'Present results of all statistical syntheses conducted. If meta-analysis was done, present for each the summary estimate and its precision and measures of statistical heterogeneity.', 28),
('20c', 'RESULTS', 'Results of syntheses - heterogeneity', 'Present results of all investigations of possible causes of heterogeneity among study results.', 29),
('20d', 'RESULTS', 'Results of syntheses - sensitivity', 'Present results of all sensitivity analyses conducted to assess the robustness of the synthesized results.', 30),
('21', 'RESULTS', 'Reporting biases', 'Present assessments of risk of bias due to missing results for each synthesis assessed.', 31),
('22', 'RESULTS', 'Certainty of evidence', 'Present assessments of certainty in the body of evidence for each outcome assessed.', 32),

-- DISCUSSION
('23a', 'DISCUSSION', 'Discussion - interpretation', 'Provide a general interpretation of the results in the context of other evidence.', 33),
('23b', 'DISCUSSION', 'Discussion - limitations evidence', 'Discuss any limitations of the evidence included in the review.', 34),
('23c', 'DISCUSSION', 'Discussion - limitations process', 'Discuss any limitations of the review processes used.', 35),
('23d', 'DISCUSSION', 'Discussion - implications', 'Discuss implications of the results for practice, policy, and future research.', 36),

-- OTHER INFORMATION
('24a', 'OTHER INFORMATION', 'Registration', 'Provide registration information for the review, including register name and registration number, or state that the review was not registered.', 37),
('24b', 'OTHER INFORMATION', 'Protocol', 'Indicate where the review protocol can be accessed, or state that a protocol was not prepared.', 38),
('24c', 'OTHER INFORMATION', 'Amendments', 'Describe and explain any amendments to information provided at registration or in the protocol.', 39),
('25', 'OTHER INFORMATION', 'Support', 'Describe sources of financial or non-financial support for the review, and the role of the funders or sponsors in the review.', 40),
('26', 'OTHER INFORMATION', 'Competing interests', 'Declare any competing interests of review authors.', 41),
('27', 'OTHER INFORMATION', 'Availability', 'Report which of the following are publicly available and where they can be found: template data collection forms; data extracted from included studies; data used for all analyses; analytic code; any other materials used in the review.', 42);

-- ============================================
-- Function: Calculate PRISMA totals
-- ============================================

CREATE OR REPLACE FUNCTION calculate_prisma_totals(prisma_data JSONB)
RETURNS JSONB AS $$
DECLARE
  total_databases INTEGER := 0;
  total_registers INTEGER := 0;
  total_other INTEGER := 0;
  total_identified INTEGER := 0;
  total_excluded INTEGER := 0;
  db_item JSONB;
  ex_item JSONB;
BEGIN
  -- Sum databases
  FOR db_item IN SELECT * FROM jsonb_array_elements(prisma_data->'identification'->'databases')
  LOOP
    total_databases := total_databases + COALESCE((db_item->>'count')::INTEGER, 0);
  END LOOP;
  
  -- Sum registers
  FOR db_item IN SELECT * FROM jsonb_array_elements(prisma_data->'identification'->'registers')
  LOOP
    total_registers := total_registers + COALESCE((db_item->>'count')::INTEGER, 0);
  END LOOP;
  
  -- Sum other methods
  FOR db_item IN SELECT * FROM jsonb_array_elements(prisma_data->'identification'->'otherMethods')
  LOOP
    total_other := total_other + COALESCE((db_item->>'count')::INTEGER, 0);
  END LOOP;
  
  total_identified := total_databases + total_registers + total_other;
  
  -- Sum exclusion reasons
  FOR ex_item IN SELECT * FROM jsonb_array_elements(prisma_data->'eligibility'->'excluded')
  LOOP
    total_excluded := total_excluded + COALESCE((ex_item->>'count')::INTEGER, 0);
  END LOOP;
  
  RETURN jsonb_build_object(
    'totalFromDatabases', total_databases,
    'totalFromRegisters', total_registers,
    'totalFromOther', total_other,
    'totalIdentified', total_identified,
    'totalExcluded', total_excluded,
    'recordsAfterDedup', total_identified - 
      COALESCE((prisma_data->'screening'->>'duplicatesRemoved')::INTEGER, 0) -
      COALESCE((prisma_data->'screening'->>'automationExcluded')::INTEGER, 0)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Trigger: Update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_prisma_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prisma_updated_at
  BEFORE UPDATE ON research_prisma
  FOR EACH ROW
  EXECUTE FUNCTION update_prisma_timestamp();

-- ============================================
-- View: PRISMA with calculated totals
-- ============================================

CREATE OR REPLACE VIEW prisma_with_totals AS
SELECT 
  p.*,
  calculate_prisma_totals(p.data) as calculated
FROM research_prisma p;

-- Grant access to view
GRANT SELECT ON prisma_with_totals TO authenticated;
GRANT SELECT ON prisma_with_totals TO anon;
