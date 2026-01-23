// AI-Enhanced Comprehensive Literature Search
// This module provides deep analysis and synthesis of search results using LLMs

import { MhambaPaper, Author } from './types';

interface ComprehensiveSearchRequest {
  query: string;
  sources?: string[];
  maxResults?: number;
  targetJournals?: string[];
  timeFrame?: {
    from?: string;
    to?: string;
  };
  minCitations?: number;
  userId?: string;
  projectId?: string;
}

interface ComprehensiveSearchResponse {
  query: string;
  analysis: {
    summary: string;
    keyThemes: Theme[];
    researchGaps: ResearchGap[];
    suggestedQuestions: string[];
    methodologicalInsights: string[];
  };
  papers: MhambaPaper[];
  annotatedBibliography: AnnotatedEntry[];
  theoreticalFramework: string;
  stats: {
    totalPapers: number;
    journalDistribution: Record<string, number>;
    yearDistribution: Record<string, number>;
    avgCitations: number;
    topJournals: Array<{ journal: string; count: number; avgTier: number }>;
  };
}

interface Theme {
  title: string;
  description: string;
  paperCount: number;
  keyPapers: string[]; // DOIs or titles
}

interface ResearchGap {
  title: string;
  description: string;
  opportunity: string;
  relatedPapers: string[];
}

interface AnnotatedEntry {
  paper: MhambaPaper;
  annotation: {
    keyFindings: string[];
    methodology: string;
    theoreticalFramework: string;
    relevance: string;
    limitations: string;
  };
}

// LLM Integration
async function callLLM(
  prompt: string,
  systemPrompt: string,
  env: any
): Promise<string> {
  // Use Anthropic Claude or Google Gemini
  const apiKey = env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY;
  const provider = env.ANTHROPIC_API_KEY ? 'anthropic' : 'gemini';

  if (!apiKey) {
    throw new Error('No LLM API key configured');
  }

  if (provider === 'anthropic') {
    return await callClaude(prompt, systemPrompt, apiKey);
  } else {
    return await callGemini(prompt, systemPrompt, apiKey);
  }
}

async function callClaude(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0.7
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Query Expansion using LLM
async function expandQuery(query: string, env: any): Promise<string[]> {
  const systemPrompt = `You are an expert research librarian specializing in business and management literature. Your task is to expand search queries to capture all relevant research.`;

  const prompt = `Given this research query: "${query}"

Generate 5-7 expanded search queries that will help find all relevant academic literature. Include:
1. The original query
2. Queries with synonyms and related terms
3. Queries focusing on specific aspects or dimensions
4. Queries using common academic terminology

Return ONLY a JSON array of strings, nothing else. Example format:
["query 1", "query 2", "query 3"]`;

  const response = await callLLM(prompt, systemPrompt, env);
  
  // Parse JSON response
  try {
    const queries = JSON.parse(response.trim());
    return Array.isArray(queries) ? queries : [query];
  } catch (e) {
    console.error('Failed to parse expanded queries:', e);
    return [query];
  }
}

// Analyze and synthesize papers
async function analyzePapers(
  papers: MhambaPaper[],
  originalQuery: string,
  env: any
): Promise<{
  summary: string;
  keyThemes: Theme[];
  researchGaps: ResearchGap[];
  suggestedQuestions: string[];
  methodologicalInsights: string[];
}> {
  // Prepare paper summaries for LLM
  const paperSummaries = papers.slice(0, 50).map((p, idx) => {
    return `[${idx + 1}] ${p.title} (${p.year || 'N/A'})
Journal: ${p.journal || 'Unknown'} ${p.abs_rating ? `(ABS ${p.abs_rating})` : ''}
Citations: ${p.citation_count || 0}
Abstract: ${p.abstract?.substring(0, 500) || 'No abstract available'}...
`;
  }).join('\n\n');

  const systemPrompt = `You are an expert research analyst specializing in business and management literature. You provide comprehensive, evidence-based analysis of academic research.`;

  const prompt = `I conducted a literature search on: "${originalQuery}"

Here are the top ${Math.min(50, papers.length)} papers found:

${paperSummaries}

Please provide a comprehensive analysis in the following JSON format:
{
  "summary": "A 3-4 paragraph synthesis of the research landscape",
  "keyThemes": [
    {
      "title": "Theme title",
      "description": "Detailed description",
      "paperCount": 10,
      "keyPapers": ["Paper title 1", "Paper title 2"]
    }
  ],
  "researchGaps": [
    {
      "title": "Gap title",
      "description": "What's missing",
      "opportunity": "Research opportunity",
      "relatedPapers": ["Paper title"]
    }
  ],
  "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
  "methodologicalInsights": ["Insight 1", "Insight 2", "Insight 3"]
}

Focus on:
1. Major themes and patterns in the literature
2. Theoretical frameworks being used
3. Methodological approaches
4. Clear research gaps and opportunities
5. Future research directions

Return ONLY valid JSON, no additional text.`;

  const response = await callLLM(prompt, systemPrompt, env);
  
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (e) {
    console.error('Failed to parse analysis:', e);
    // Return default structure
    return {
      summary: 'Analysis failed. Please try again.',
      keyThemes: [],
      researchGaps: [],
      suggestedQuestions: [],
      methodologicalInsights: []
    };
  }
}

// Generate annotated bibliography
async function generateAnnotatedBibliography(
  papers: MhambaPaper[],
  env: any
): Promise<AnnotatedEntry[]> {
  const annotated: AnnotatedEntry[] = [];
  
  // Process top 10 papers in detail
  const topPapers = papers.slice(0, 10);
  
  for (const paper of topPapers) {
    const systemPrompt = `You are an expert research analyst. Create detailed, accurate annotations for academic papers.`;
    
    const prompt = `Create a detailed annotation for this paper:

Title: ${paper.title}
Authors: ${paper.authors.map(a => a.name).join(', ')}
Journal: ${paper.journal || 'Unknown'}
Year: ${paper.year || 'N/A'}
Abstract: ${paper.abstract || 'No abstract available'}

Provide a JSON response with:
{
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "methodology": "Description of research methodology",
  "theoreticalFramework": "Theoretical frameworks used",
  "relevance": "Why this paper is relevant to the research topic",
  "limitations": "Key limitations of the study"
}

Base your analysis ONLY on the information provided. Return ONLY valid JSON.`;

    try {
      const response = await callLLM(prompt, systemPrompt, env);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const annotation = JSON.parse(jsonMatch[0]);
        annotated.push({ paper, annotation });
      }
    } catch (e) {
      console.error(`Failed to annotate paper: ${paper.title}`, e);
      // Add basic annotation
      annotated.push({
        paper,
        annotation: {
          keyFindings: ['Analysis pending'],
          methodology: 'Not analyzed',
          theoreticalFramework: 'Not analyzed',
          relevance: 'Relevant to search query',
          limitations: 'Not analyzed'
        }
      });
    }
  }
  
  return annotated;
}

// Generate theoretical framework
async function generateTheoreticalFramework(
  papers: MhambaPaper[],
  analysis: any,
  env: any
): Promise<string> {
  const systemPrompt = `You are an expert in research methodology and theoretical frameworks. You help researchers understand and visualize theoretical relationships.`;

  const topPapers = papers.slice(0, 20).map(p => `- ${p.title} (${p.year})`).join('\n');

  const prompt = `Based on this literature analysis:

Key Themes:
${analysis.keyThemes.map((t: Theme) => `- ${t.title}: ${t.description}`).join('\n')}

Top Papers:
${topPapers}

Create a comprehensive theoretical framework description that:
1. Identifies the main theoretical perspectives
2. Shows relationships between key constructs
3. Highlights theoretical contributions
4. Suggests how theories can be integrated

Provide a detailed narrative (3-4 paragraphs) describing the theoretical landscape.`;

  const response = await callLLM(prompt, systemPrompt, env);
  return response.trim();
}

// Calculate statistics
function calculateStats(papers: MhambaPaper[]): any {
  const stats = {
    totalPapers: papers.length,
    journalDistribution: {} as Record<string, number>,
    yearDistribution: {} as Record<string, number>,
    avgCitations: 0,
    topJournals: [] as Array<{ journal: string; count: number; avgTier: number }>
  };

  let totalCitations = 0;
  const journalData = new Map<string, { count: number; tiers: number[] }>();

  for (const paper of papers) {
    // Journal distribution
    if (paper.journal) {
      stats.journalDistribution[paper.journal] = (stats.journalDistribution[paper.journal] || 0) + 1;
      
      if (!journalData.has(paper.journal)) {
        journalData.set(paper.journal, { count: 0, tiers: [] });
      }
      const jData = journalData.get(paper.journal)!;
      jData.count++;
      if (paper.journal_tier) {
        jData.tiers.push(paper.journal_tier);
      }
    }

    // Year distribution
    if (paper.year) {
      const yearStr = paper.year.toString();
      stats.yearDistribution[yearStr] = (stats.yearDistribution[yearStr] || 0) + 1;
    }

    // Citations
    if (paper.citation_count) {
      totalCitations += paper.citation_count;
    }
  }

  stats.avgCitations = papers.length > 0 ? Math.round(totalCitations / papers.length) : 0;

  // Top journals
  stats.topJournals = Array.from(journalData.entries())
    .map(([journal, data]) => ({
      journal,
      count: data.count,
      avgTier: data.tiers.length > 0 
        ? data.tiers.reduce((a, b) => a + b, 0) / data.tiers.length 
        : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return stats;
}

// Main comprehensive search handler
export async function handleComprehensiveSearch(
  request: ComprehensiveSearchRequest,
  papers: MhambaPaper[],
  env: any
): Promise<ComprehensiveSearchResponse> {
  console.log(`Starting comprehensive analysis for query: ${request.query}`);
  console.log(`Analyzing ${papers.length} papers`);

  // 1. Analyze papers
  const analysis = await analyzePapers(papers, request.query, env);

  // 2. Generate annotated bibliography (top 10 papers)
  const annotatedBibliography = await generateAnnotatedBibliography(papers, env);

  // 3. Generate theoretical framework
  const theoreticalFramework = await generateTheoreticalFramework(papers, analysis, env);

  // 4. Calculate statistics
  const stats = calculateStats(papers);

  return {
    query: request.query,
    analysis,
    papers,
    annotatedBibliography,
    theoreticalFramework,
    stats
  };
}

// Export query expansion function
export { expandQuery };
