'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
    Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle,
    Loader2, ArrowRight, BookOpen
} from 'lucide-react';
import Footer from '@/components/Footer';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Check for messages from other pages
    useEffect(() => {
        const msg = searchParams.get('message');
        if (msg === 'password_reset') {
            setMessage('Password reset email sent. Check your inbox.');
        } else if (msg === 'email_verified') {
            setMessage('Email verified! You can now log in.');
        } else if (msg === 'signup_success') {
            setMessage('Account created! Please check your email to verify.');
        } else if (msg === 'password_reset_success') {
            setMessage('Password successfully reset. Please log in.');
        }
    }, [searchParams]);

    // Redirect if already logged in
    useEffect(() => {
        if (user && !authLoading && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;

            // Only redirect if we're on the login page
            if (currentPath === '/login') {
                const redirect = searchParams.get('redirect') || '/research';
                router.replace(redirect);
            }
        }
    }, [user, authLoading, router, searchParams]);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    setError('Invalid email or password. Please try again.');
                } else if (error.message.includes('Email not confirmed')) {
                    setError('Please verify your email before logging in. Check your inbox.');
                } else {
                    setError(error.message);
                }
                return;
            }

            // Redirect to research page
            const redirect = searchParams.get('redirect') || '/research';
            router.replace(redirect);
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } catch (err) {
            setError('Failed to connect with Google. Please try again.');
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
            {/* Header */}
            <header className="p-6">
                <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <BookOpen className="w-8 h-8" />
                    <span className="text-xl font-bold">MasteringSeries</span>
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                        {/* Title */}
                        <div className="text-center mb-8">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <BookOpen className="w-6 h-6 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">Mastering Academia</h1>
                            <p className="text-gray-500 mt-2">Sign in to access research tools</p>
                        </div>

                        {/* Success Message */}
                        {message && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-green-700">{message}</p>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Google Login */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="font-medium text-gray-700">Continue with Google</span>
                        </button>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-gray-500">or continue with email</span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                        Password
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !email || !password}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign in
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Sign Up Link */}
                        <p className="mt-6 text-center text-sm text-gray-500">
                            Don't have an account?{' '}
                            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                                Sign up for free
                            </Link>
                        </p>
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-center text-xs text-gray-400">
                        By signing in, you agree to our{' '}
                        <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>
                        {' '}and{' '}
                        <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
                    </p>
                </div>
            </main>
            
            {/* Footer Component */}
            <Footer />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <LoginForm />
        </Suspense>
    );
}
