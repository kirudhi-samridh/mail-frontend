// ClassificationTag.jsx

// A helper to map categories to Tailwind CSS colors
const categoryStyles = {
    "Official/Work": "bg-blue-100 text-blue-800",
    "Primary Conversation": "bg-orange-100 text-orange-800",
    "Transactional": "bg-green-100 text-green-800",
    "Promotions & Marketing": "bg-purple-100 text-purple-800",
    "Subscriptions & Newsletters": "bg-indigo-100 text-indigo-800",
    "Security Alert": "bg-red-100 text-red-800",
    "Financial / Bills": "bg-yellow-100 text-yellow-800",
    "Social & Notifications": "bg-pink-100 text-pink-800",
    "Other": "bg-gray-100 text-gray-800",
};

const ClassificationTag = ({ classification }) => {
    // Don't render a tag if there's no classification data
    if (!classification || !classification.category) {
        return null;
    }

    const { category } = classification;
    const style = categoryStyles[category] || categoryStyles["Other"];

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full classification-tag ${style}`}>
            {category}
        </span>
    );
};

export default ClassificationTag;