'use client';

interface FeedbackIndicatorProps {
    status: 'idle' | 'correct' | 'incorrect';
}

export default function FeedbackIndicator({ status }: FeedbackIndicatorProps) {
    if (status === 'idle') {
        return null;
    }

    const isCorrect = status === 'correct';

    return (
        <div
            className={`
                fixed top-24 left-1/2 transform -translate-x-1/2
                px-6 py-3 rounded-xl shadow-lg
                transition-all duration-200 ease-out
                ${isCorrect ? 'bg-green-500/90' : 'bg-red-500/90'}
                animate-fadeIn z-50 pointer-events-none
            `}
        >
            <div className="text-center text-white flex items-center gap-3">
                <span className="text-2xl font-bold">
                    {isCorrect ? '✓' : '✗'}
                </span>
                <span className="text-lg font-bold">
                    {isCorrect ? 'Corretto!' : 'Riprova'}
                </span>
            </div>
        </div>
    );
}
