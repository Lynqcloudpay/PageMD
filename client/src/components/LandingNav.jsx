import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LandingNav = ({ onGetDemo }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Features', path: '/features' },
        { name: 'Security', path: '/security' },
        { name: 'Pricing', path: '/pricing' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    const isActive = (path) => location.pathname === path;

    const handleGetDemo = (e) => {
        if (onGetDemo) {
            e.preventDefault();
            onGetDemo();
        }
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-slate-200/10 py-3' : 'bg-white border-b border-slate-50 py-5'
            }`}>
            <div className="max-w-7xl mx-auto px-8">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <img src="/logo.png" alt="PageMD Logo" className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-10">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`text-[10px] font-semibold uppercase tracking-wider transition-all ${isActive(link.path)
                                    ? 'text-sky-500'
                                    : 'text-slate-400 hover:text-slate-800'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    <div className="hidden lg:flex items-center gap-6">
                        <Link to="/login" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-800 transition-colors">
                            Sign In
                        </Link>
                        <Link
                            to="/contact"
                            onClick={handleGetDemo}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                            Get Started
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="lg:hidden p-2 text-slate-400 hover:text-sky-500 transition-colors"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className={`lg:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 transition-all duration-300 shadow-xl overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="px-6 py-8 flex flex-col gap-4">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`text-base font-medium transition-colors pb-1 border-b ${isActive(link.path)
                                ? 'text-sky-500 border-sky-50'
                                : 'text-slate-600 hover:text-sky-500 border-transparent'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="pt-2 mt-2 flex flex-col gap-3">
                        <Link to="/login" className="px-5 py-3 text-center text-slate-700 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50">
                            Sign In
                        </Link>
                        <Link
                            to="/contact"
                            onClick={handleGetDemo}
                            className="px-5 py-3 text-center bg-slate-800 text-white text-sm font-medium rounded-xl shadow-md"
                        >
                            Get Demo
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default LandingNav;
