'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <Link href="/select-program" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-teal-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">MA</span>
            </div>
            <span className="text-slate-400 text-sm">Mastering Academia</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="https://masteringseries.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              MasteringSeries
            </a>
            <a href="https://youtube.com/@MasteringPublicHealth" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              YouTube
            </a>
          </div>
          <div className="text-sm text-slate-500">Built for MPH, MHA & MBA students</div>
        </div>
        <div className="text-center pt-8 border-t border-slate-800/50">
          <p className="text-xs text-slate-500">© 2026 Nusrat Wali Ventures LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

