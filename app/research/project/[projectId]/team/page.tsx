'use client';

export const runtime = 'edge';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ProjectTeamPage() {
    const router = useRouter();
    const params = useParams();
    const projectId = params?.projectId;

    return (
        <div className="p-8">
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 mb-6 hover:text-gray-900"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
            </button>
            <h1 className="text-2xl font-bold mb-4">Project Team</h1>
            <p>Team management for project {projectId} will be implemented here.</p>
        </div>
    );
}
