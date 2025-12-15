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
                fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                px-12 py-8 rounded-2xl shadow-2xl
                transition-all duration-300 ease-out
                ${isCorrect ? 'bg-green-500' : 'bg-red-500'}
                animate-fadeIn z-50
            `}
        >
            <div className="text-center text-white">
                <div className="text-6xl mb-3">
                    {isCorrect ? '✓' : '✗'}
                </div>
                <div className="text-2xl font-bold">
                    {isCorrect ? 'Corretto!' : 'Riprova'}
                </div>
            </div>
        </div>
    );
}
