import React, { useState, useEffect } from 'react';
import {
    Activity, FileText, Stethoscope, Users,
    FlaskConical, ClipboardList, CheckCircle2
} from 'lucide-react';

const QuickNav = ({ sections }) => {
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '-10% 0px -40% 0px' }
        );

        sections.forEach((section) => {
            const el = document.getElementById(section.id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sections]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const icons = {
        vitals: Activity,
        hpi: FileText,
        'ros-pe': Stethoscope,
        pamfos: Users,
        results: FlaskConical,
        assessment: ClipboardList,
        plan: CheckCircle2,
    };

    return (
        <div className="vn-quick-bar mx-auto">
            {sections.map((section) => {
                const Icon = icons[section.id] || FileText;
                const isActive = activeSection === section.id;

                return (
                    <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`vn-quick-link flex items-center gap-2 ${isActive ? 'active' : ''}`}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{section.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default QuickNav;
