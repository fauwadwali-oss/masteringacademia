'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminAuthCallbackPage() {
    const router = useRouter();

    // Redirect to unified auth callback
    useEffect(() => {
        // Preserve the hash and query params
        const hash = window.location.hash;
        const search = window.location.search;
        router.replace(`/auth/callback${search}${hash}`);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        </div>
    );
}
