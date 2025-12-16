import React from 'react';

interface ScoreStatsProps {
    perfect: number;
    good: number;
    miss: number;
    totalMatches?: number; // Optional, can be calculated or passed directly
}

export default function ScoreStats({ perfect, good, miss, totalMatches }: ScoreStatsProps) {
    const total = totalMatches ?? (perfect + good + miss);

    // Calculate precision: Perfect = 100%, Good = 50%, Miss = 0%
    // Or simple percentage of hits? 
    // User asked: "100% (se nota perfetta) e valuta tu..."
    // Let's weighted: ((Perfect * 1.0) + (Good * 0.5)) / Total * 100

    let precision = 0;
    if (total > 0) {
        const weightedScore = (perfect * 1.0) + (good * 0.5);
        precision = Math.round((weightedScore / total) * 100);
    }

    // Determine color based on precision
    let precisionColor = 'text-gray-600';
    if (total > 0) {
        if (precision >= 90) precisionColor = 'text-green-600';
        else if (precision >= 70) precisionColor = 'text-amber-600';
        else precisionColor = 'text-red-500';
    }

    return (
        <div className="flex flex-col items-center bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm px-4 py-2 text-sm font-medium">
            <div className="flex gap-4 mb-1">
                <span className="text-green-600">Perfette: <b>{perfect}</b></span>
                <span className="text-amber-600">Buone: <b>{good}</b></span>
                <span className="text-red-500">Sbagliate: <b>{miss}</b></span>
            </div>
            <div className="border-t border-gray-100 w-full pt-1 text-center">
                <span className="text-gray-500 mr-2">Precisione:</span>
                <span className={`font-bold text-lg ${precisionColor}`}>{precision}%</span>
            </div>
        </div>
    );
}
