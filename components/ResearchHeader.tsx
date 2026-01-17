'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User, LogIn } from 'lucide-react';

interface ResearchHeaderProps {
  currentPage?: string;
  showBackToTools?: boolean;
}

export default function ResearchHeader({ currentPage, showBackToTools = true }: ResearchHeaderProps) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/research" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            <span className="text-white font-semibold">MSDrills</span>
          </Link>
          {currentPage && (
            <>
              <span className="text-slate-500">/</span>
              <span className="text-violet-400">{currentPage}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          ) : user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.email}</span>
                <span className="sm:hidden">{user.email?.split('@')[0]}</span>
              </div>
              <Link
                href="/research"
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <>
              {showBackToTools && (
                <Link href="/research" className="text-slate-400 hover:text-white text-sm">
                  ← All Tools
                </Link>
              )}
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

