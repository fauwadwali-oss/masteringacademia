'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2,
    BookOpen, Check, X, ShieldCheck
} from 'lucide-react';

interface PasswordStrength {
    score: number;
    label: string;
    color: string;
    checks: {
        length: boolean;
        uppercase: boolean;
        lowercase: boolean;
        number: boolean;
    };
}

function getPasswordStrength(password: string): PasswordStrength {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;

    const labels: Record<number, { label: string; color: string }> = {
        0: { label: 'Very weak', color: 'bg-red-500' },
        1: { label: 'Weak', color: 'bg-red-500' },
        2: { label: 'Fair', color: 'bg-orange-500' },
        3: { label: 'Good', color: 'bg-yellow-500' },
        4: { label: 'Strong', color: 'bg-green-500' }
    };

    return {
        score,
        ...labels[score],
        checks
    };
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-1.5 text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}>
            {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {label}
        </div>
    );
}

function ResetPasswordForm() {
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [validSession, setValidSession] = useState<boolean | null>(null);

    const passwordStrength = getPasswordStrength(password);
    const passwordsMatch = password === confirmPassword;

    // Check if we have a valid session from the reset link
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            // The reset link creates a temporary session
            if (session) {
                setValidSession(true);
            } else {
                // Check URL for error
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const error = hashParams.get('error_description');
                if (error) {
                    setError(decodeURIComponent(error));
                }
                setValidSession(false);
            }
        };

        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (!passwordsMatch) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                setError(error.message);
                return;
            }

            setSuccess(true);

            // Sign out after password change and redirect to login
            setTimeout(async () => {
                await supabase.auth.signOut();
                router.push('/login?message=password_reset_success');
            }, 3000);
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Loading state while checking session
    if (validSession === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Invalid or expired link
    if (validSession === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
                <header className="p-6">
                    <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                        <BookOpen className="w-8 h-8" />
                        <span className="text-xl font-bold">MasteringSeries</span>
                    </Link>
                </header>

                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="w-full max-w-md">
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or expired link</h1>
                            <p className="text-gray-500 mb-6">
                                {error || 'This password reset link is invalid or has expired. Please request a new one.'}
                            </p>
                            <Link
                                href="/forgot-password"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Request new link
                            </Link>
                        </div>
                    </div>
                </main>
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
                        {success ? (
                            /* Success State */
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h1>
                                <p className="text-gray-500 mb-4">
                                    Your password has been successfully changed.
                                </p>
                                <p className="text-sm text-gray-400">
                                    Redirecting to login...
                                </p>
                            </div>
                        ) : (
                            /* Form State */
                            <>
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
                                    <p className="text-gray-500 mt-2">
                                        Your new password must be different from previous ones.
                                    </p>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* New Password */}
                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                            New password
                                        </label>
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

                                        {/* Password Strength */}
                                        {password && (
                                            <div className="mt-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${passwordStrength.color} transition-all`}
                                                            style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500">{passwordStrength.label}</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-1 mt-2">
                                                    <PasswordCheck passed={passwordStrength.checks.length} label="8+ characters" />
                                                    <PasswordCheck passed={passwordStrength.checks.uppercase} label="Uppercase" />
                                                    <PasswordCheck passed={passwordStrength.checks.lowercase} label="Lowercase" />
                                                    <PasswordCheck passed={passwordStrength.checks.number} label="Number" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                            Confirm new password
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${confirmPassword && !passwordsMatch
                                                        ? 'border-red-300 focus:border-red-500'
                                                        : 'border-gray-300 focus:border-blue-500'
                                                    }`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {confirmPassword && !passwordsMatch && (
                                            <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                                        )}
                                        {confirmPassword && passwordsMatch && (
                                            <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                                                <Check className="w-4 h-4" />
                                                Passwords match
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !passwordsMatch || passwordStrength.score < 3}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            'Reset password'
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
