import Anthropic from '@anthropic-ai/sdk';

interface MphPaper {
  doi?: string;
  title: string;
  abstract?: string;
  authors: { name: string; affiliation?: string }[];
  journal?: string;
  journal_issn?: string;
  year?: number;
  url?: string;
  source: string;
  citation_count?: number;
  publication_type?: string;
  journal_tier?: number;
  abs_rating?: string;
  abdc_rating?: string;
  is_ft50?: boolean;
}

interface ComprehensiveSearchResult {
  query: string;
  overview: string;
  keyThemes: Array<{
    theme: string;
    description: string;
    paperCount: number;
  }>;
  researchGaps: Array<{
    gap: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  annotatedBibliography: Array<{
    paper: MphPaper;
    annotation: string;
    relevance: string;
    keyFindings: string[];
  }>;
  suggestedQuestions: string[];
  methodologicalInsights: string;
  statistics: {
    totalPapers: number;
    yearRange: { min: number; max: number };
    topJournals: Array<{ name: string; count: number }>;
    citationStats: { mean: number; median: number; max: number };
  };
}

export async function handleMphComprehensiveSearch(
  request: Request,
  env: any
): Promise<Response> {
  try {
    // Parse request
    const { query, sources, maxResults = 100 } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Perform standard search across all sources
    const searchResponse = await fetch(
      `${new URL(request.url).origin}/mph/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources, maxResults }),
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to perform initial search');
    }

    const searchData = await searchResponse.json();
    const papers: MphPaper[] = searchData.results.papers || [];

    if (papers.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No papers found for this query',
          query,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Prepare data for AI analysis
    const papersForAnalysis = papers.slice(0, 50).map((p) => ({
      title: p.title,
      abstract: p.abstract || 'No abstract available',
      authors: p.authors.map((a) => a.name).join(', '),
      journal: p.journal || 'Unknown',
      year: p.year || 'Unknown',
      citations: p.citation_count || 0,
      tier: p.journal_tier || 'Unranked',
    }));

    // Step 3: Use Claude Opus 4.5 for comprehensive analysis
    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });

    const analysisPrompt = `You are an expert public health researcher analyzing academic literature. I will provide you with a list of research papers on the topic: "${query}".

Your task is to provide a comprehensive analysis in the following JSON format:

{
  "overview": "A 3-4 sentence high-level summary of the research landscape on this topic",
  "keyThemes": [
    {
      "theme": "Theme name",
      "description": "2-3 sentence description of this theme",
      "paperCount": number of papers related to this theme
    }
  ],
  "researchGaps": [
    {
      "gap": "Gap title",
      "description": "2-3 sentence description of this research gap",
      "priority": "high" | "medium" | "low"
    }
  ],
  "annotatedBibliography": [
    {
      "paperIndex": index in the provided list (0-based),
      "annotation": "2-3 sentence annotation explaining the paper's contribution",
      "relevance": "Why this paper is important for this topic",
      "keyFindings": ["Finding 1", "Finding 2", "Finding 3"]
    }
  ],
  "suggestedQuestions": ["Research question 1", "Research question 2", ...],
  "methodologicalInsights": "2-3 sentences about common methodologies and approaches in this research area"
}

Here are the papers to analyze:

${JSON.stringify(papersForAnalysis, null, 2)}

Provide your analysis as valid JSON only, no additional text.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    });

    // Parse AI response
    const aiResponse = message.content[0].text;
    const analysis = JSON.parse(aiResponse);

    // Step 4: Calculate statistics
    const years = papers.map((p) => p.year).filter((y) => y) as number[];
    const citations = papers
      .map((p) => p.citation_count)
      .filter((c) => c !== undefined) as number[];
    const journalCounts: Record<string, number> = {};

    papers.forEach((p) => {
      if (p.journal) {
        journalCounts[p.journal] = (journalCounts[p.journal] || 0) + 1;
      }
    });

    const topJournals = Object.entries(journalCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const statistics = {
      totalPapers: papers.length,
      yearRange: {
        min: Math.min(...years),
        max: Math.max(...years),
      },
      topJournals,
      citationStats: {
        mean: citations.reduce((a, b) => a + b, 0) / citations.length,
        median:
          citations.sort((a, b) => a - b)[Math.floor(citations.length / 2)] ||
          0,
        max: Math.max(...citations),
      },
    };

    // Step 5: Enrich annotated bibliography with full paper data
    const enrichedBibliography = analysis.annotatedBibliography.map(
      (entry: any) => ({
        paper: papers[entry.paperIndex],
        annotation: entry.annotation,
        relevance: entry.relevance,
        keyFindings: entry.keyFindings,
      })
    );

    // Step 6: Construct final result
    const result: ComprehensiveSearchResult = {
      query,
      overview: analysis.overview,
      keyThemes: analysis.keyThemes,
      researchGaps: analysis.researchGaps,
      annotatedBibliography: enrichedBibliography,
      suggestedQuestions: analysis.suggestedQuestions,
      methodologicalInsights: analysis.methodologicalInsights,
      statistics,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('MPH Comprehensive Search Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to perform comprehensive search',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
