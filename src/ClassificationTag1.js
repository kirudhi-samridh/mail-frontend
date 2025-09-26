import React from 'react';

const ClassificationTag = ({ classification }) => {
    if (!classification || !classification.category) {
        return null; // Don't render anything if no classification
    }

    const { category, confidenceScore } = classification;
    
    // Define colors for different categories
    const getTagStyle = (category) => {
        const styles = {
            'promotional': 'bg-purple-100 text-purple-800 border-purple-200',
            'transactional': 'bg-blue-100 text-blue-800 border-blue-200',
            'newsletter': 'bg-green-100 text-green-800 border-green-200',
            'personal': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'business': 'bg-gray-100 text-gray-800 border-gray-200',
            'spam': 'bg-red-100 text-red-800 border-red-200',
            'social': 'bg-pink-100 text-pink-800 border-pink-200',
            'finance': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'travel': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'shopping': 'bg-orange-100 text-orange-800 border-orange-200'
        };
        
        return styles[category.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const confidence = confidenceScore ? Math.round(confidenceScore * 100) : null;

    return (
        <span 
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTagStyle(category)}`}
            title={confidence ? `Confidence: ${confidence}%` : undefined}
        >
            {category}
            {confidence && confidence < 80 && (
                <span className="ml-1 text-xs opacity-70">
                    {confidence}%
                </span>
            )}
        </span>
    );
};

export default ClassificationTag; 