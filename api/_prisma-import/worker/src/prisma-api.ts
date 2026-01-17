// PRISMA API Routes - Add to main worker/src/index.ts

import { createClient } from '@supabase/supabase-js';

// Types
interface PRISMAData {
  id?: string;
  project_id?: string;
  session_id: string;
  identification: {
    databases: Array<{ name: string; count: number }>;
    registers: Array<{ name: string; count: number }>;
    otherMethods: Array<{ name: string; count: number }>;
  };
  screening: {
    duplicatesRemoved: number;
    automationExcluded: number;
    recordsScreened: number;
    recordsExcluded: number;
  };
  retrieval: {
    soughtForRetrieval: number;
    notRetrieved: number;
  };
  eligibility: {
    assessed: number;
    excluded: Array<{ reason: string; count: number }>;
  };
  included: {
    newStudies: number;
    previousStudies: number;
    totalStudies: number;
    reportsOfNewStudies: number;
    reportsOfPreviousStudies: number;
    totalReports: number;
  };
  checklist?: PRISMAChecklist;
  created_at?: string;
  updated_at?: string;
}

interface PRISMAChecklist {
  title: { completed: boolean; location: string };
  abstract: { completed: boolean; location: string };
  introduction: {
    rationale: { completed: boolean; location: string };
    objectives: { completed: boolean; location: string };
  };
  methods: {
    eligibility: { completed: boolean; location: string };
    informationSources: { completed: boolean; location: string };
    searchStrategy: { completed: boolean; location: string };
    selectionProcess: { completed: boolean; location: string };
    dataCollection: { completed: boolean; location: string };
    dataItems: { completed: boolean; location: string };
    riskOfBias: { completed: boolean; location: string };
    effectMeasures: { completed: boolean; location: string };
    synthesisMethods: { completed: boolean; location: string };
    reportingBias: { completed: boolean; location: string };
    certaintyAssessment: { completed: boolean; location: string };
  };
  results: {
    studySelection: { completed: boolean; location: string };
    studyCharacteristics: { completed: boolean; location: string };
    riskOfBiasStudies: { completed: boolean; location: string };
    individualResults: { completed: boolean; location: string };
    synthesisResults: { completed: boolean; location: string };
    reportingBiases: { completed: boolean; location: string };
    certaintyEvidence: { completed: boolean; location: string };
  };
  discussion: {
    discussion: { completed: boolean; location: string };
  };
  other: {
    registration: { completed: boolean; location: string };
    support: { completed: boolean; location: string };
    competingInterests: { completed: boolean; location: string };
    availability: { completed: boolean; location: string };
  };
}

// PRISMA API Handler
export async function handlePRISMARequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const url = new URL(request.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET /prisma/:id - Get PRISMA data
    if (request.method === 'GET' && path.match(/^\/prisma\/[\w-]+$/)) {
      const id = path.split('/')[2];
      
      const { data, error } = await supabase
        .from('research_prisma')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /prisma?session_id=xxx - Get all PRISMA for session
    if (request.method === 'GET' && path === '/prisma') {
      const sessionId = url.searchParams.get('session_id');
      
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('research_prisma')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /prisma - Create new PRISMA
    if (request.method === 'POST' && path === '/prisma') {
      const body: PRISMAData = await request.json();

      if (!body.session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('research_prisma')
        .insert({
          session_id: body.session_id,
          project_id: body.project_id,
          data: {
            identification: body.identification,
            screening: body.screening,
            retrieval: body.retrieval,
            eligibility: body.eligibility,
            included: body.included,
          },
          checklist: body.checklist,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /prisma/:id - Update PRISMA
    if (request.method === 'PUT' && path.match(/^\/prisma\/[\w-]+$/)) {
      const id = path.split('/')[2];
      const body: PRISMAData = await request.json();

      const { data, error } = await supabase
        .from('research_prisma')
        .update({
          data: {
            identification: body.identification,
            screening: body.screening,
            retrieval: body.retrieval,
            eligibility: body.eligibility,
            included: body.included,
          },
          checklist: body.checklist,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /prisma/export/docx - Export to Word
    if (request.method === 'POST' && path === '/prisma/export/docx') {
      const body: PRISMAData = await request.json();
      const docx = generatePRISMADocx(body);
      
      return new Response(docx, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="prisma_flowchart.docx"',
        },
      });
    }

    // POST /prisma/from-search - Generate PRISMA from search results
    if (request.method === 'POST' && path === '/prisma/from-search') {
      const body = await request.json();
      const { searchId, sessionId } = body;

      // Get search results
      const { data: searchData, error: searchError } = await supabase
        .from('research_searches')
        .select('*')
        .eq('id', searchId)
        .single();

      if (searchError) throw searchError;

      // Generate PRISMA data from search
      const prismaData = generatePRISMAFromSearch(searchData);

      // Save to database
      const { data, error } = await supabase
        .from('research_prisma')
        .insert({
          session_id: sessionId,
          project_id: searchData.project_id,
          search_id: searchId,
          data: prismaData,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PRISMA API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Generate PRISMA data from search results
function generatePRISMAFromSearch(searchData: any): any {
  const results = searchData.results || {};
  const perDatabase = results.perDatabase || [];

  return {
    identification: {
      databases: perDatabase.map((db: any) => ({
        name: db.database,
        count: db.totalAvailable || db.count,
      })),
      registers: [],
      otherMethods: [],
    },
    screening: {
      duplicatesRemoved: results.duplicatesRemoved || 0,
      automationExcluded: 0,
      recordsScreened: results.totalUnique || 0,
      recordsExcluded: 0,
    },
    retrieval: {
      soughtForRetrieval: 0,
      notRetrieved: 0,
    },
    eligibility: {
      assessed: 0,
      excluded: [],
    },
    included: {
      newStudies: 0,
      previousStudies: 0,
      totalStudies: 0,
      reportsOfNewStudies: 0,
      reportsOfPreviousStudies: 0,
      totalReports: 0,
    },
  };
}

// Generate Word document (simplified - returns XML for .docx)
function generatePRISMADocx(data: PRISMAData): string {
  // This is a simplified version - in production, use a library like docx
  // For now, return a basic XML structure that Word can open
  
  const totalDatabases = data.identification.databases.reduce((sum, db) => sum + db.count, 0);
  const totalExcluded = data.eligibility.excluded.reduce((sum, e) => sum + e.count, 0);

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        <w:t>PRISMA 2020 Flow Diagram</w:t>
      </w:r>
    </w:p>
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p><w:r><w:rPr><w:b/><w:color w:val="3B82F6"/></w:rPr>
      <w:t>IDENTIFICATION</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Records identified from databases (n = ${totalDatabases}):</w:t>
    </w:r></w:p>
    
    ${data.identification.databases.map(db => `
    <w:p><w:r>
      <w:t>    ${db.name}: ${db.count}</w:t>
    </w:r></w:p>
    `).join('')}
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p><w:r><w:rPr><w:b/><w:color w:val="22C55E"/></w:rPr>
      <w:t>SCREENING</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Duplicates removed: ${data.screening.duplicatesRemoved}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Records screened: ${data.screening.recordsScreened}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Records excluded: ${data.screening.recordsExcluded}</w:t>
    </w:r></w:p>
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p><w:r><w:rPr><w:b/><w:color w:val="F59E0B"/></w:rPr>
      <w:t>ELIGIBILITY</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Reports sought for retrieval: ${data.retrieval.soughtForRetrieval}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Reports not retrieved: ${data.retrieval.notRetrieved}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Reports assessed for eligibility: ${data.eligibility.assessed}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Reports excluded (n = ${totalExcluded}):</w:t>
    </w:r></w:p>
    
    ${data.eligibility.excluded.map(e => `
    <w:p><w:r>
      <w:t>    ${e.reason}: ${e.count}</w:t>
    </w:r></w:p>
    `).join('')}
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p><w:r><w:rPr><w:b/><w:color w:val="8B5CF6"/></w:rPr>
      <w:t>INCLUDED</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Studies included in review: ${data.included.newStudies}</w:t>
    </w:r></w:p>
    
    <w:p><w:r>
      <w:t>Reports of included studies: ${data.included.reportsOfNewStudies}</w:t>
    </w:r></w:p>
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="9CA3AF"/></w:rPr>
      <w:t>Generated by MSDrills Research Tools - PRISMA 2020 Template</w:t>
    </w:r></w:p>
    
  </w:body>
</w:wordDocument>`;

  return xml;
}

// Environment interface
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export { handlePRISMARequest };
