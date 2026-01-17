'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
    User, Mail, Camera, Lock, Bell, Shield, Trash2,
    Save, Loader2, CheckCircle, AlertCircle, ArrowLeft,
    Eye, EyeOff, LogOut, ExternalLink, Check, X
} from 'lucide-react';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
}

interface NotificationSettings {
    email_updates: boolean;
    email_alerts: boolean;
    email_digest: 'daily' | 'weekly' | 'never';
}

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

function TabButton({
    active,
    onClick,
    icon: Icon,
    label
}: {
    active: boolean;
    onClick: () => void;
    icon: any;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Profile state
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Security state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Notification settings
    const [notifications, setNotifications] = useState<NotificationSettings>({
        email_updates: true,
        email_alerts: true,
        email_digest: 'weekly'
    });

    useEffect(() => {
        if (!user && !authLoading) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchProfile();
        }
    }, [user, authLoading, router]);

    const fetchProfile = async () => {
        try {
            // Get user metadata from auth
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (authUser) {
                setProfile({
                    id: authUser.id,
                    email: authUser.email || '',
                    full_name: authUser.user_metadata?.full_name || '',
                    avatar_url: authUser.user_metadata?.avatar_url || '',
                    created_at: authUser.created_at,
                    updated_at: authUser.updated_at || authUser.created_at
                });
                setFullName(authUser.user_metadata?.full_name || '');
                setAvatarUrl(authUser.user_metadata?.avatar_url || '');

                // Fetch notification settings if stored
                const { data: settings } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .single();

                if (settings?.notifications) {
                    setNotifications(settings.notifications);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName.trim(),
                    avatar_url: avatarUrl
                }
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setProfile(prev => prev ? { ...prev, full_name: fullName.trim() } : null);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please select an image file' });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Image must be less than 2MB' });
            return;
        }

        setUploadingAvatar(true);
        setMessage({ type: '', text: '' });

        try {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${user?.id}/avatar.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update user metadata
            const { error: updateError } = await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            });

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setMessage({ type: 'success', text: 'Avatar updated!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to upload avatar' });
        } finally {
            setUploadingAvatar(false);
        }
    };

    const passwordStrength = getPasswordStrength(newPassword);
    const passwordsMatch = newPassword === confirmPassword;

    const handleChangePassword = async () => {
        setMessage({ type: '', text: '' });

        if (newPassword.length < 8) {
            setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
            return;
        }

        if (!passwordsMatch) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to change password' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user?.id,
                    notifications,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Notification settings saved!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
        );

        if (!confirmed) return;

        const doubleConfirm = window.prompt(
            'Type "DELETE" to confirm account deletion:'
        );

        if (doubleConfirm !== 'DELETE') {
            setMessage({ type: 'error', text: 'Account deletion cancelled' });
            return;
        }

        setSaving(true);

        try {
            // Call edge function to delete user data
            const { error } = await supabase.functions.invoke('delete-account');

            if (error) throw error;

            await signOut();
            router.push('/');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to delete account' });
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (authLoading || loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Message */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}>
                        {message.type === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                            {message.text}
                        </p>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            <TabButton
                                active={activeTab === 'profile'}
                                onClick={() => setActiveTab('profile')}
                                icon={User}
                                label="Profile"
                            />
                            <TabButton
                                active={activeTab === 'security'}
                                onClick={() => setActiveTab('security')}
                                icon={Shield}
                                label="Security"
                            />
                            <TabButton
                                active={activeTab === 'notifications'}
                                onClick={() => setActiveTab('notifications')}
                                icon={Bell}
                                label="Notifications"
                            />
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                {/* Avatar */}
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="Avatar"
                                                className="w-24 h-24 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="text-2xl font-semibold text-blue-600">
                                                    {getInitials(fullName || profile?.email || 'U')}
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingAvatar}
                                            className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {uploadingAvatar ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                            ) : (
                                                <Camera className="w-4 h-4 text-gray-600" />
                                            )}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                            className="hidden"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">Profile Photo</h3>
                                        <p className="text-sm text-gray-500">
                                            JPG, PNG or GIF. Max 2MB.
                                        </p>
                                    </div>
                                </div>

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                {/* Email (read-only) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={profile?.email || ''}
                                            disabled
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                        />
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Contact support to change your email address.
                                    </p>
                                </div>

                                {/* Account Info */}
                                <div className="pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
                                    <p className="text-sm text-gray-500">
                                        Member since {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}
                                    </p>
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Save className="w-5 h-5" />
                                        )}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-1">Change Password</h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Update your password to keep your account secure.
                                    </p>

                                    <div className="space-y-4 max-w-md">
                                        {/* New Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type={showNewPassword ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>

                                            {/* Password Strength */}
                                            {newPassword && (
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Confirm New Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                        confirmPassword && !passwordsMatch
                                                            ? 'border-red-300 focus:border-red-500'
                                                            : confirmPassword && passwordsMatch
                                                            ? 'border-green-300 focus:border-green-500'
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
                                            onClick={handleChangePassword}
                                            disabled={saving || !newPassword || !confirmPassword || !passwordsMatch || passwordStrength.score < 3}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {saving ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                'Update Password'
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="pt-6 border-t border-gray-200">
                                    <h3 className="text-lg font-medium text-red-600 mb-1">Danger Zone</h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Permanently delete your account and all associated data.
                                    </p>
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-1">Email Notifications</h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Choose what emails you want to receive.
                                    </p>

                                    <div className="space-y-4">
                                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                                            <div>
                                                <span className="font-medium text-gray-900">Product Updates</span>
                                                <p className="text-sm text-gray-500">
                                                    News about new features and improvements
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={notifications.email_updates}
                                                onChange={(e) => setNotifications(prev => ({
                                                    ...prev,
                                                    email_updates: e.target.checked
                                                }))}
                                                className="w-5 h-5 text-blue-600 rounded border-gray-300"
                                            />
                                        </label>

                                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                                            <div>
                                                <span className="font-medium text-gray-900">Search Alerts</span>
                                                <p className="text-sm text-gray-500">
                                                    Notifications when new papers match your monitors
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={notifications.email_alerts}
                                                onChange={(e) => setNotifications(prev => ({
                                                    ...prev,
                                                    email_alerts: e.target.checked
                                                }))}
                                                className="w-5 h-5 text-blue-600 rounded border-gray-300"
                                            />
                                        </label>

                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-900">Email Digest</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mb-3">
                                                Summary of your project activity
                                            </p>
                                            <select
                                                value={notifications.email_digest}
                                                onChange={(e) => setNotifications(prev => ({
                                                    ...prev,
                                                    email_digest: e.target.value as any
                                                }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="never">Never</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-6">
                                        <button
                                            onClick={handleSaveNotifications}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {saving ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                            Save Preferences
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
