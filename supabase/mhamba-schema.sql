-- MHA/MBA Literature Search Schema
-- Separate from MPH tables, using mhamba_ prefix

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- =============================================
-- JOURNAL RANKINGS TABLE
-- =============================================

create table if not exists mhamba_journal_rankings (
  id serial primary key,
  name text not null,
  name_normalized text not null,
  issn text,
  eissn text,
  publisher text,

  -- Rankings from multiple systems
  abs_rating text,           -- ABS Academic Journal Guide: 4*, 4, 3, 2, 1
  abdc_rating text,          -- ABDC: A*, A, B, C
  ft50 boolean default false, -- Financial Times 50
  scimago_quartile text,     -- Q1, Q2, Q3, Q4
  impact_factor numeric,
  h_index integer,

  -- Computed tier (1 = highest, 5 = lowest/unranked)
  tier integer default 5,

  -- Categories
  categories text[],         -- ['entrepreneurship', 'management', 'strategy']

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists mhamba_journal_name_normalized_idx on mhamba_journal_rankings(name_normalized);
create index if not exists mhamba_journal_tier_idx on mhamba_journal_rankings(tier);
create index if not exists mhamba_journal_categories_idx on mhamba_journal_rankings using gin(categories);

-- =============================================
-- PROJECTS TABLE
-- =============================================

create table if not exists mhamba_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  title text not null,
  description text,

  -- Research focus
  research_type text default 'literature_review', -- literature_review, case_study, market_research
  keywords text[],

  -- Status tracking
  status text default 'active', -- active, archived, completed

  -- Settings
  settings jsonb default '{}',

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists mhamba_projects_user_idx on mhamba_projects(user_id);
create index if not exists mhamba_projects_status_idx on mhamba_projects(status);

-- =============================================
-- PAPERS TABLE
-- =============================================

create table if not exists mhamba_papers (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references mhamba_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  -- Core metadata
  title text not null,
  title_normalized text,
  authors jsonb,              -- [{name, affiliation, orcid}]
  year integer,
  journal text,
  journal_normalized text,
  abstract text,
  citation_count integer,
  doi text,
  url text,
  pdf_url text,
  open_access boolean default false,

  -- Journal ranking (denormalized for fast sorting)
  journal_tier integer default 5,
  journal_abs_rating text,
  journal_impact_factor numeric,

  -- Source tracking
  sources text[],             -- ['openalex', 'crossref', 'semantic_scholar', 'google_scholar', 'ssrn']
  openalex_id text,
  semantic_scholar_id text,
  crossref_doi text,
  core_id text,
  ssrn_id text,
  google_scholar_id text,

  -- Organization
  search_query text,
  relevance_tags text[],      -- ['high_priority', 'methodology', 'theory']
  notes text,
  is_saved boolean default false,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Unique constraints for deduplication
create unique index if not exists mhamba_papers_doi_project_unique on mhamba_papers(doi, project_id) where doi is not null;
create unique index if not exists mhamba_papers_title_year_project_unique on mhamba_papers(title_normalized, year, project_id);

-- Indexes for common queries
create index if not exists mhamba_papers_project_idx on mhamba_papers(project_id);
create index if not exists mhamba_papers_user_idx on mhamba_papers(user_id);
create index if not exists mhamba_papers_tier_citations_idx on mhamba_papers(journal_tier asc, citation_count desc);
create index if not exists mhamba_papers_year_idx on mhamba_papers(year desc);
create index if not exists mhamba_papers_saved_idx on mhamba_papers(is_saved) where is_saved = true;
create index if not exists mhamba_papers_title_search_idx on mhamba_papers using gin(title gin_trgm_ops);

-- =============================================
-- SEARCH RUNS TABLE
-- =============================================

create table if not exists mhamba_search_runs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references mhamba_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  query text not null,
  sources text[],             -- Which sources were searched
  filters jsonb,              -- {yearMin, yearMax, openAccess, etc.}

  -- Results
  total_results integer default 0,
  deduplicated_count integer default 0,

  -- Status
  status text default 'pending', -- pending, running, completed, failed
  error_message text,

  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create index if not exists mhamba_search_runs_project_idx on mhamba_search_runs(project_id);
create index if not exists mhamba_search_runs_user_idx on mhamba_search_runs(user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to normalize text for matching
create or replace function mhamba_normalize_text(input_text text)
returns text as $$
begin
  if input_text is null then
    return null;
  end if;
  return lower(
    regexp_replace(
      regexp_replace(input_text, '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', ' ', 'g'
    )
  );
end;
$$ language plpgsql immutable;

-- Trigger to auto-normalize on insert/update
create or replace function mhamba_papers_normalize_trigger()
returns trigger as $$
begin
  new.title_normalized := mhamba_normalize_text(new.title);
  new.journal_normalized := mhamba_normalize_text(new.journal);

  -- Auto-lookup journal tier if journal exists
  if new.journal_normalized is not null then
    select tier, abs_rating, impact_factor
    into new.journal_tier, new.journal_abs_rating, new.journal_impact_factor
    from mhamba_journal_rankings
    where name_normalized = new.journal_normalized
    limit 1;
  end if;

  -- Default tier if not found
  if new.journal_tier is null then
    new.journal_tier := 5;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists mhamba_papers_before_insert on mhamba_papers;
create trigger mhamba_papers_before_insert
before insert or update on mhamba_papers
for each row execute function mhamba_papers_normalize_trigger();

-- Trigger to update updated_at
create or replace function mhamba_update_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mhamba_projects_updated_at on mhamba_projects;
create trigger mhamba_projects_updated_at
before update on mhamba_projects
for each row execute function mhamba_update_updated_at();

drop trigger if exists mhamba_papers_updated_at on mhamba_papers;
create trigger mhamba_papers_updated_at
before update on mhamba_papers
for each row execute function mhamba_update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table mhamba_projects enable row level security;
alter table mhamba_papers enable row level security;
alter table mhamba_search_runs enable row level security;

-- Projects policies
drop policy if exists "Users can view own projects" on mhamba_projects;
create policy "Users can view own projects" on mhamba_projects
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on mhamba_projects;
create policy "Users can insert own projects" on mhamba_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on mhamba_projects;
create policy "Users can update own projects" on mhamba_projects
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on mhamba_projects;
create policy "Users can delete own projects" on mhamba_projects
  for delete using (auth.uid() = user_id);

-- Papers policies
drop policy if exists "Users can view own papers" on mhamba_papers;
create policy "Users can view own papers" on mhamba_papers
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own papers" on mhamba_papers;
create policy "Users can insert own papers" on mhamba_papers
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own papers" on mhamba_papers;
create policy "Users can update own papers" on mhamba_papers
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own papers" on mhamba_papers;
create policy "Users can delete own papers" on mhamba_papers
  for delete using (auth.uid() = user_id);

-- Search runs policies
drop policy if exists "Users can view own search runs" on mhamba_search_runs;
create policy "Users can view own search runs" on mhamba_search_runs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own search runs" on mhamba_search_runs;
create policy "Users can insert own search runs" on mhamba_search_runs
  for insert with check (auth.uid() = user_id);

-- Journal rankings are public read
drop policy if exists "Anyone can view journal rankings" on mhamba_journal_rankings;
create policy "Anyone can view journal rankings" on mhamba_journal_rankings
  for select using (true);

-- =============================================
-- SEED JOURNAL RANKINGS DATA
-- =============================================

insert into mhamba_journal_rankings (name, name_normalized, abs_rating, abdc_rating, ft50, tier, categories) values
-- Tier 1: Elite (4*, A*, FT50)
('Academy of Management Journal', 'academy of management journal', '4*', 'A*', true, 1, '{"management"}'),
('Academy of Management Review', 'academy of management review', '4*', 'A*', true, 1, '{"management"}'),
('Administrative Science Quarterly', 'administrative science quarterly', '4*', 'A*', true, 1, '{"management"}'),
('Strategic Management Journal', 'strategic management journal', '4*', 'A*', true, 1, '{"strategy"}'),
('Journal of International Business Studies', 'journal of international business studies', '4*', 'A*', true, 1, '{"international business"}'),
('Organization Science', 'organization science', '4*', 'A*', true, 1, '{"management", "organization"}'),
('Management Science', 'management science', '4*', 'A*', true, 1, '{"management", "operations"}'),
('Journal of Management', 'journal of management', '4*', 'A*', false, 1, '{"management"}'),
('Journal of Finance', 'journal of finance', '4*', 'A*', true, 1, '{"finance"}'),
('Journal of Financial Economics', 'journal of financial economics', '4*', 'A*', true, 1, '{"finance"}'),
('Review of Financial Studies', 'review of financial studies', '4*', 'A*', true, 1, '{"finance"}'),
('Journal of Marketing', 'journal of marketing', '4*', 'A*', true, 1, '{"marketing"}'),
('Journal of Marketing Research', 'journal of marketing research', '4*', 'A*', true, 1, '{"marketing"}'),
('Journal of Consumer Research', 'journal of consumer research', '4*', 'A*', true, 1, '{"marketing", "consumer behavior"}'),
('MIS Quarterly', 'mis quarterly', '4*', 'A*', true, 1, '{"information systems"}'),
('Information Systems Research', 'information systems research', '4*', 'A*', true, 1, '{"information systems"}'),
('Journal of Operations Management', 'journal of operations management', '4*', 'A*', true, 1, '{"operations"}'),
('Production and Operations Management', 'production and operations management', '4*', 'A*', true, 1, '{"operations"}'),
('Journal of Accounting Research', 'journal of accounting research', '4*', 'A*', true, 1, '{"accounting"}'),
('Journal of Accounting and Economics', 'journal of accounting and economics', '4*', 'A*', true, 1, '{"accounting"}'),
('The Accounting Review', 'the accounting review', '4*', 'A*', true, 1, '{"accounting"}'),

-- Tier 2: Top Field Journals (4, A*)
('Journal of Business Venturing', 'journal of business venturing', '4', 'A*', false, 2, '{"entrepreneurship"}'),
('Entrepreneurship Theory and Practice', 'entrepreneurship theory and practice', '4', 'A*', false, 2, '{"entrepreneurship"}'),
('Strategic Entrepreneurship Journal', 'strategic entrepreneurship journal', '4', 'A*', false, 2, '{"entrepreneurship", "strategy"}'),
('Research Policy', 'research policy', '4', 'A*', false, 2, '{"innovation", "strategy"}'),
('Journal of Management Studies', 'journal of management studies', '4', 'A*', false, 2, '{"management"}'),
('Organization Studies', 'organization studies', '4', 'A*', false, 2, '{"organization"}'),
('Journal of Organizational Behavior', 'journal of organizational behavior', '4', 'A*', false, 2, '{"organization", "behavior"}'),
('Human Resource Management', 'human resource management', '4', 'A', false, 2, '{"hrm"}'),
('Journal of Applied Psychology', 'journal of applied psychology', '4', 'A*', false, 2, '{"psychology", "organizational behavior"}'),
('Personnel Psychology', 'personnel psychology', '4', 'A*', false, 2, '{"hrm", "psychology"}'),
('Journal of Business Ethics', 'journal of business ethics', '3', 'A', false, 2, '{"ethics", "csr"}'),
('California Management Review', 'california management review', '3', 'A', false, 2, '{"management", "strategy"}'),
('Harvard Business Review', 'harvard business review', '3', 'A', false, 2, '{"management", "practice"}'),
('MIT Sloan Management Review', 'mit sloan management review', '3', 'A', false, 2, '{"management", "practice"}'),
('Health Affairs', 'health affairs', '3', 'A', false, 2, '{"healthcare", "policy"}'),
('Health Care Management Review', 'health care management review', '2', 'A', false, 2, '{"healthcare", "management"}'),

-- Tier 3: High Quality (3, A)
('Small Business Economics', 'small business economics', '3', 'A', false, 3, '{"entrepreneurship", "economics"}'),
('Journal of Small Business Management', 'journal of small business management', '3', 'A', false, 3, '{"entrepreneurship", "small business"}'),
('International Small Business Journal', 'international small business journal', '3', 'A', false, 3, '{"entrepreneurship", "small business"}'),
('Group & Organization Management', 'group organization management', '3', 'A', false, 3, '{"teams", "organization"}'),
('Journal of Business Research', 'journal of business research', '3', 'A', false, 3, '{"business"}'),
('Long Range Planning', 'long range planning', '3', 'A', false, 3, '{"strategy"}'),
('British Journal of Management', 'british journal of management', '3', 'A', false, 3, '{"management"}'),
('Journal of World Business', 'journal of world business', '3', 'A', false, 3, '{"international business"}'),
('International Business Review', 'international business review', '3', 'A', false, 3, '{"international business"}'),
('Technovation', 'technovation', '3', 'A', false, 3, '{"innovation", "technology"}'),
('R&D Management', 'rd management', '3', 'A', false, 3, '{"innovation", "r&d"}'),
('Industrial Marketing Management', 'industrial marketing management', '3', 'A', false, 3, '{"marketing", "b2b"}'),
('European Management Journal', 'european management journal', '2', 'A', false, 3, '{"management"}'),
('Asia Pacific Journal of Management', 'asia pacific journal of management', '3', 'A', false, 3, '{"management", "asia"}'),
('Journal of Healthcare Management', 'journal of healthcare management', '2', 'B', false, 3, '{"healthcare", "management"}'),
('Medical Care Research and Review', 'medical care research and review', '2', 'A', false, 3, '{"healthcare", "research"}'),

-- Tier 4: Good Quality (2, B)
('International Entrepreneurship and Management Journal', 'international entrepreneurship and management journal', '2', 'A', false, 4, '{"entrepreneurship"}'),
('Management Decision', 'management decision', '2', 'B', false, 4, '{"management"}'),
('Journal of Management & Organization', 'journal of management organization', '2', 'A', false, 4, '{"management"}'),
('European Business Review', 'european business review', '2', 'B', false, 4, '{"business"}'),
('Journal of General Management', 'journal of general management', '2', 'B', false, 4, '{"management"}'),
('Team Performance Management', 'team performance management', '1', 'B', false, 4, '{"teams"}'),
('Journal of Applied Business Research', 'journal of applied business research', '1', 'B', false, 4, '{"business"}'),
('International Journal of Healthcare Management', 'international journal of healthcare management', '1', 'B', false, 4, '{"healthcare", "management"}'),
('Health Services Management Research', 'health services management research', '2', 'B', false, 4, '{"healthcare", "management"}'),

-- Tier 5: Emerging/Regional/Working Papers
('Journal of Entrepreneurship in Emerging Economies', 'journal of entrepreneurship in emerging economies', '1', 'B', false, 5, '{"entrepreneurship", "emerging markets"}'),
('Asia-Pacific Journal of Business Venturing and Entrepreneurship', 'asia pacific journal of business venturing and entrepreneurship', null, 'C', false, 5, '{"entrepreneurship", "asia"}'),
('Management and Sustainability: An Arab Review', 'management and sustainability an arab review', null, null, false, 5, '{"management", "sustainability", "mena"}'),
('SSRN Working Paper', 'ssrn working paper', null, null, false, 5, '{"preprint"}'),
('NBER Working Paper', 'nber working paper', null, null, false, 4, '{"preprint", "economics"}')
on conflict (name_normalized) do nothing;
