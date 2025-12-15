/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'note-correct': '#22c55e',     // Green for correct notes
                'note-wrong': '#ef4444',       // Red for wrong notes
                'note-preview': '#9ca3af',     // Gray for preview notes
                'staff-bg': '#fafafa',         // Light background for staff area
            },
        },
    },
    plugins: [],
}
