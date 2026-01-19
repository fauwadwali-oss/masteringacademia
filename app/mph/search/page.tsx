'use client';

import React from 'react';
import LiteratureSearchTool from '@/components/tools/LiteratureSearchTool';
import ResearchHeader from '@/components/ResearchHeader';

export default function LiteratureSearchPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <ResearchHeader currentPage="Literature Search" />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <LiteratureSearchTool />
      </main>
    </div>
  );
}
