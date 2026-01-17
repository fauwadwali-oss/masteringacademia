'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';

type CallbackStatus = 'loading' | 'success' | 'error';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<CallbackStatus>('loading');
    const [message, setMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        try {
            // Check for error in URL hash (Supabase puts errors here)
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const error = hashParams.get('error');
            const errorDescription = hashParams.get('error_description');

            if (error) {
                setStatus('error');
                setErrorMessage(errorDescription || 'Authentication failed. Please try again.');
                return;
            }

            // Check for access token in hash (OAuth flow)
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');

            if (accessToken) {
                // Set the session
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || ''
                });

                if (sessionError) {
                    setStatus('error');
                    setErrorMessage(sessionError.message);
                    return;
                }

                // Handle different auth types
                if (type === 'signup') {
                    setStatus('success');
                    setMessage('Email verified successfully! Redirecting...');
                    setTimeout(() => router.replace('/research'), 2000);
                } else if (type === 'recovery') {
                    // Password recovery flow
                    setStatus('success');
                    setMessage('Verified! Redirecting to reset password...');
                    setTimeout(() => router.replace('/reset-password'), 1500);
                } else {
                    // Regular OAuth login
                    setStatus('success');
                    setMessage('Signed in successfully! Redirecting...');
                    setTimeout(() => router.replace('/research'), 1500);
                }
                return;
            }

            // Check for code in query params (PKCE flow)
            const code = searchParams.get('code');
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                if (exchangeError) {
                    setStatus('error');
                    setErrorMessage(exchangeError.message);
                    return;
                }

                setStatus('success');
                setMessage('Signed in successfully! Redirecting...');
                setTimeout(() => router.replace('/research'), 1500);
                return;
            }

            // Check for existing session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStatus('success');
                setMessage('Already signed in. Redirecting...');
                setTimeout(() => router.replace('/research'), 1000);
                return;
            }

            // No auth data found
            setStatus('error');
            setErrorMessage('No authentication data found. Please try signing in again.');
        } catch (err) {
            console.error('Auth callback error:', err);
            setStatus('error');
            setErrorMessage('An unexpected error occurred. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
            {/* Header */}
            <header className="p-6">
                <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <BookOpen className="w-8 h-8" />
                    <span className="text-xl font-bold">Mastering Academia</span>
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                        {status === 'loading' && (
                            <>
                                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                                    Completing sign in...
                                </h1>
                                <p className="text-gray-500">Please wait while we verify your account.</p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h1 className="text-xl font-semibold text-gray-900 mb-2">Success!</h1>
                                <p className="text-gray-500">{message}</p>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle className="w-8 h-8 text-red-600" />
                                </div>
                                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                                    Authentication Failed
                                </h1>
                                <p className="text-gray-500 mb-6">{errorMessage}</p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Link
                                        href="/login"
                                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Try Again
                                    </Link>
                                    <Link
                                        href="/signup"
                                        className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Create Account
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}

