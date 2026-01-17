'use client';

export const runtime = 'edge';

import React from 'react';
import ProjectDetailPage from '@/components/dashboard/ProjectDetailPage';

export default function ProjectPage() {
    // Wrap in error boundary to catch any rendering errors
    try {
        return <ProjectDetailPage />;
    } catch (error) {
        console.error('Error rendering project page:', error);
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading project</h2>
                    <p className="text-gray-500 mb-4">Please try refreshing the page.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }
}
