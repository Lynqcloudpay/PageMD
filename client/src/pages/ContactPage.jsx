import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, Clock, MessageSquare } from 'lucide-react';

const ContactPage = () => {
    const currentYear = new Date().getFullYear();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        practice: '',
        providers: '',
        message: '',
        interest: 'demo'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle form submission
        alert('Thank you for your interest! Our team will contact you within 1 business day.');
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="PageMD" className="h-10 w-auto" />
                        </Link>
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Home</Link>
                            <Link to="/features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
                            <Link to="/contact" className="text-sm font-medium text-blue-600">Contact</Link>
                        </div>
                        <Link to="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-28 pb-16 px-6 bg-gradient-to-b from-gray-50 to-white">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                        Let's Talk About Your Practice
                    </h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        Schedule a demo, ask questions, or get help choosing the right plan.
                        Our team is here to help you succeed.
                    </p>
                </div>
            </section>

            {/* Contact Options */}
            <section className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Schedule a Demo</h3>
                            <p className="text-sm text-gray-600 mb-4">See PageMD in action with a personalized walkthrough.</p>
                            <span className="text-sm text-blue-600 font-medium">30-minute session</span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Email Us</h3>
                            <p className="text-sm text-gray-600 mb-4">Questions? Send us a message anytime.</p>
                            <a href="mailto:hello@pagemdemr.com" className="text-sm text-blue-600 font-medium">hello@pagemdemr.com</a>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Response Time</h3>
                            <p className="text-sm text-gray-600 mb-4">We respond to all inquiries promptly.</p>
                            <span className="text-sm text-blue-600 font-medium">Within 1 business day</span>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="grid lg:grid-cols-2 gap-16">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Dr. Jane Smith"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="jane@practice.com"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="(555) 123-4567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Practice Name</label>
                                        <input
                                            type="text"
                                            value={formData.practice}
                                            onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Smith Family Medicine"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Providers</label>
                                        <select
                                            value={formData.providers}
                                            onChange={(e) => setFormData({ ...formData, providers: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        >
                                            <option value="">Select...</option>
                                            <option value="1">1 (Solo Practice)</option>
                                            <option value="2-5">2-5 Providers</option>
                                            <option value="6-10">6-10 Providers</option>
                                            <option value="11+">11+ Providers</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">I'm interested in...</label>
                                        <select
                                            value={formData.interest}
                                            onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        >
                                            <option value="demo">Scheduling a Demo</option>
                                            <option value="pricing">Pricing Information</option>
                                            <option value="trial">Starting a Free Trial</option>
                                            <option value="enterprise">Enterprise Solutions</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                                    <textarea
                                        rows={4}
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                        placeholder="Tell us about your practice and what you're looking for..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    Send Message
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Why Choose PageMD?</h2>
                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">Built by a Physician</h3>
                                    <p className="text-gray-600 text-sm">
                                        PageMD was designed by a practicing physician who understands the daily
                                        frustrations of bloated, complicated EMR systems. Every feature is built
                                        for real clinical workflows.
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">No Long-Term Contracts</h3>
                                    <p className="text-gray-600 text-sm">
                                        We earn your business every month. No multi-year lock-ins, no early
                                        termination fees. Stay because you want to, not because you have to.
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">White-Glove Onboarding</h3>
                                    <p className="text-gray-600 text-sm">
                                        Our team handles data migration, staff training, and go-live support.
                                        We're with you every step of the way.
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">Responsive Support</h3>
                                    <p className="text-gray-600 text-sm">
                                        When you need help, you get a real person who understands healthcare.
                                        No ticket queues, no overseas call centers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-gray-900 mt-20">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="PageMD" className="h-8 w-auto brightness-0 invert" />
                    </div>
                    <div className="text-sm text-gray-500">© {currentYear} PageMD. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );
};

export default ContactPage;
