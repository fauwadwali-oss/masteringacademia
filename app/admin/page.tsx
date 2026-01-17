'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Shield, AlertCircle, Lock, Crown } from 'lucide-react';
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '@/lib/admin';
import Footer from '@/components/Footer';

export default function AdminPage() {
    const router = useRouter();
    const { user, loading, signOut } = useAuth();

    useEffect(() => {
        if (!loading) {
            // If not logged in, redirect to login
            if (!user) {
                router.replace('/login');
                return;
            }

            // If logged in but not the super admin, show unauthorized
            if (!isSuperAdmin(user.email)) {
                // Don't redirect, just show unauthorized message
                return;
            }
        }
    }, [user, loading, router]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-4" />
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    // If not logged in, show nothing (redirect will happen)
    if (!user) {
        return null;
    }

    // If logged in but not super admin, show unauthorized
    if (!isSuperAdmin(user.email)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
                <div className="max-w-md w-full text-center">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                        <p className="text-slate-400 mb-6">
                            This admin portal is restricted to authorized personnel only.
                        </p>
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Admin access granted
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            {/* Navigation */}
            <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur fixed top-0 w-full z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-semibold text-white tracking-tight">Admin Portal</span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-full">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-medium text-amber-300">Super Admin</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/research"
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Research Tools →
                        </Link>
                        <span className="text-sm text-slate-400">{user.email}</span>
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="pt-24 pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Lock className="w-6 h-6 text-teal-400" />
                            <h1 className="text-3xl font-bold text-white">Super Admin Dashboard</h1>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg">
                                <Crown className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-300">Super Admin Access</span>
                            </div>
                            <span className="text-sm text-slate-500">•</span>
                            <span className="text-sm text-slate-400">{user.email}</span>
                        </div>
                        <p className="text-slate-400">
                            Full system access to manage settings, users, and content for MSDrills Research Tools
                        </p>
                    </div>

                    {/* Admin Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* User Management */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">User Management</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                View and manage user accounts, permissions, and activity
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                Manage Users →
                            </button>
                        </div>

                        {/* System Settings */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">System Settings</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Configure system-wide settings and preferences
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                Configure →
                            </button>
                        </div>

                        {/* Analytics */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Analytics</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                View usage statistics, user activity, and system metrics
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                View Analytics →
                            </button>
                        </div>

                        {/* Content Management */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Content Management</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Manage research content, projects, and data
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                Manage Content →
                            </button>
                        </div>

                        {/* Database */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Database</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Access database tools and run queries
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                Database Tools →
                            </button>
                        </div>

                        {/* Logs */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">System Logs</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                View system logs, errors, and audit trails
                            </p>
                            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                                View Logs →
                            </button>
                        </div>

                        {/* Old Admin Dashboard */}
                        <div className="bg-gradient-to-br from-violet-900/20 to-purple-900/20 border-2 border-violet-500/30 rounded-xl p-6 hover:border-violet-500/50 transition-colors">
                            <div className="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Legacy Admin Dashboard</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Access the original admin dashboard with all content creation tools (Image Library, History, etc.)
                            </p>
                            <p className="text-xs text-violet-300/70 mb-4">
                                Note: You'll need to sign in with Google separately for the legacy dashboard
                            </p>
                            <a 
                                href="https://msdrills.com/dashboard" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
                            >
                                Open Legacy Dashboard →
                            </a>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Quick Stats</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-2xl font-bold text-teal-400 mb-1">-</div>
                                <div className="text-sm text-slate-400">Total Users</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-teal-400 mb-1">-</div>
                                <div className="text-sm text-slate-400">Active Projects</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-teal-400 mb-1">-</div>
                                <div className="text-sm text-slate-400">Searches Today</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-teal-400 mb-1">-</div>
                                <div className="text-sm text-slate-400">System Status</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <Footer />
        </div>
    );
}

