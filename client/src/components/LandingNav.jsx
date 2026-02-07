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
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-white border-b border-gray-100 py-4'
            }`}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3">
                        <img src="/logo.png" alt="PageMD Logo" className="h-10 w-auto object-contain" />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`text-sm font-medium transition-colors ${isActive(link.path)
                                    ? 'text-blue-600 font-bold'
                                    : 'text-gray-600 hover:text-blue-600'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link to="/login" className="px-5 py-2.5 text-gray-700 text-sm font-semibold hover:text-blue-600 transition-colors">
                            Sign In
                        </Link>
                        <Link
                            to="/contact"
                            onClick={handleGetDemo}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            Get Demo
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className={`md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 transition-all duration-300 shadow-xl overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="px-6 py-8 flex flex-col gap-5">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`text-lg transition-colors pb-1 border-b ${isActive(link.path)
                                ? 'text-blue-600 font-bold border-blue-100 shadow-[0_1px_0_0_rgba(37,99,235,1)]'
                                : 'text-gray-600 hover:text-blue-600 border-transparent'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="pt-2 mt-2 flex flex-col gap-3">
                        <Link to="/login" className="px-5 py-3.5 text-center text-gray-700 text-base font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">
                            Sign In
                        </Link>
                        <Link
                            to="/contact"
                            onClick={handleGetDemo}
                            className="px-5 py-3.5 text-center bg-blue-600 text-white text-base font-semibold rounded-xl shadow-lg shadow-blue-200"
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
