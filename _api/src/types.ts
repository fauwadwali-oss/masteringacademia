// Shared types for the API

export interface Author {
  name: string;
  affiliation?: string;
  orcid?: string;
}

export interface MhambaPaper {
  doi?: string;
  title: string;
  abstract?: string;
  authors: Author[];
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
  raw?: any;
}
