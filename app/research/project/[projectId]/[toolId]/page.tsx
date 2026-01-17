'use client';

export const runtime = 'edge';

import React from 'react';
import ToolWrapper from '@/components/dashboard/ToolWrapper';
import LiteratureSearchTool from '@/components/tools/LiteratureSearchTool';
import { useParams } from 'next/navigation';

export default function ToolPage() {
    const params = useParams();
    const toolId = params?.toolId as string;
    const projectId = params?.projectId as string;

    const renderTool = () => {
        switch (toolId) {
            case 'search':
                return <LiteratureSearchTool projectId={projectId} />;
            default:
                return (
                    <div className="text-center py-12">
                        <h2 className="text-xl font-semibold text-gray-900">Tool Not Found or Implementation Pending</h2>
                        <p className="text-gray-500 mt-2">The tool "{toolId}" is not yet available or configured.</p>
                    </div>
                );
        }
    };

    return (
        <ToolWrapper toolId={toolId}>
            {renderTool()}
        </ToolWrapper>
    );
}
