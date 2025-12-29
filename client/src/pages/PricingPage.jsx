import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X, HelpCircle, ArrowRight } from 'lucide-react';

const PricingPage = () => {
    const currentYear = new Date().getFullYear();

    const plans = [
        {
            name: 'Starter',
            description: 'For solo practitioners getting started',
            price: '$199',
            period: '/month',
            highlight: false,
            features: [
                { name: '1 Provider', included: true },
                { name: '2 Staff Users', included: true },
                { name: 'Unlimited Patients', included: true },
                { name: 'Clinical Charting', included: true },
                { name: 'Scheduling', included: true },
                { name: 'Superbills', included: true },
                { name: 'Patient Portal', included: true },
                { name: 'Email Support', included: true },
                { name: 'E-Prescribing (EPCS)', included: false },
                { name: 'Lab Integrations', included: false },
                { name: 'Analytics Dashboard', included: false },
                { name: 'Custom Integrations', included: false },
            ],
            cta: 'Start Free Trial',
            ctaStyle: 'border'
        },
        {
            name: 'Professional',
            description: 'For growing practices',
            price: '$399',
            period: '/month',
            highlight: true,
            features: [
                { name: 'Up to 5 Providers', included: true },
                { name: 'Unlimited Staff Users', included: true },
                { name: 'Unlimited Patients', included: true },
                { name: 'Clinical Charting', included: true },
                { name: 'Scheduling', included: true },
                { name: 'Superbills', included: true },
                { name: 'Patient Portal', included: true },
                { name: 'Priority Support', included: true },
                { name: 'E-Prescribing (EPCS)', included: true },
                { name: 'Lab Integrations', included: true },
                { name: 'Analytics Dashboard', included: true },
                { name: 'Custom Integrations', included: false },
            ],
            cta: 'Start Free Trial',
            ctaStyle: 'primary'
        },
        {
            name: 'Enterprise',
            description: 'For multi-location practices',
            price: 'Custom',
            period: '',
            highlight: false,
            features: [
                { name: 'Unlimited Providers', included: true },
                { name: 'Unlimited Staff Users', included: true },
                { name: 'Unlimited Patients', included: true },
                { name: 'Clinical Charting', included: true },
                { name: 'Scheduling', included: true },
                { name: 'Superbills', included: true },
                { name: 'Patient Portal', included: true },
                { name: 'Dedicated Account Manager', included: true },
                { name: 'E-Prescribing (EPCS)', included: true },
                { name: 'Lab Integrations', included: true },
                { name: 'Analytics Dashboard', included: true },
                { name: 'Custom Integrations', included: true },
            ],
            cta: 'Contact Sales',
            ctaStyle: 'border'
        }
    ];

    const faqs = [
        {
            question: 'What\'s included in the free trial?',
            answer: 'The 30-day free trial includes full access to all features in your chosen plan. No credit card required to start. You can upgrade, downgrade, or cancel anytime.'
        },
        {
            question: 'Can I change plans later?',
            answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. Upgrades can be applied immediately if needed.'
        },
        {
            question: 'Is there a setup fee?',
            answer: 'No setup fees for Starter or Professional plans. Enterprise plans may include implementation services with custom pricing based on your needs.'
        },
        {
            question: 'How does per-provider pricing work?',
            answer: 'Providers are licensed users who can document clinical notes and sign charts. Staff users (front desk, billing, MA) are included at no additional cost.'
        },
        {
            question: 'What if I need more than 5 providers?',
            answer: 'The Enterprise plan supports unlimited providers with volume-based pricing. Contact our sales team for a custom quote based on your practice size.'
        },
        {
            question: 'Is data migration included?',
            answer: 'We offer data migration assistance for all plans. The scope and timeline depend on your current system. Our team will work with you to ensure a smooth transition.'
        },
        {
            question: 'What\'s the contract length?',
            answer: 'Starter and Professional plans are month-to-month with no long-term commitment. Enterprise plans may include annual agreements with volume discounts.'
        },
        {
            question: 'Do you offer discounts for annual billing?',
            answer: 'Yes, annual billing saves you 2 months (17% discount). Contact us for annual pricing options.'
        }
    ];

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
                            <Link to="/pricing" className="text-sm font-medium text-blue-600">Pricing</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
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
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        No hidden fees. No per-claim charges. No surprise bills.
                        Choose the plan that fits your practice and start your free trial today.
                    </p>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">
                        {plans.map((plan, index) => (
                            <div
                                key={index}
                                className={`rounded-2xl p-8 ${plan.highlight ? 'bg-white border-2 border-blue-600 relative' : 'bg-white border border-gray-200'}`}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                                    <p className="text-gray-600 text-sm">{plan.description}</p>
                                </div>
                                <div className="mb-8">
                                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                    <span className="text-gray-600">{plan.period}</span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm">
                                            {feature.included ? (
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                            ) : (
                                                <X className="w-4 h-4 text-gray-300 shrink-0" />
                                            )}
                                            <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                                                {feature.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    className={`w-full py-3 font-medium rounded-lg transition-colors ${plan.ctaStyle === 'primary'
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {plan.cta}
                                </button>
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-gray-500 text-sm mt-8">
                        All plans include a 30-day free trial. No credit card required to start.
                    </p>
                </div>
            </section>

            {/* What's Included */}
            <section className="py-16 px-6 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
                        Every Plan Includes
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">HIPAA Compliance</h4>
                                <p className="text-sm text-gray-600">Enterprise-grade security and BAA included</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">Automatic Updates</h4>
                                <p className="text-sm text-gray-600">New features and improvements delivered automatically</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">Data Backup</h4>
                                <p className="text-sm text-gray-600">Continuous backups with point-in-time recovery</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">99.9% Uptime SLA</h4>
                                <p className="text-sm text-gray-600">Reliable access when you need it</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">Free Training</h4>
                                <p className="text-sm text-gray-600">Onboarding and training resources included</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">Data Export</h4>
                                <p className="text-sm text-gray-600">Your data is yours. Export anytime.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-6">
                        {faqs.map((faq, index) => (
                            <div key={index} className="border-b border-gray-100 pb-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-2">{faq.question}</h3>
                                <p className="text-gray-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-6 bg-blue-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Ready to Get Started?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Start your free 30-day trial today. No credit card required.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                            Start Free Trial
                        </button>
                        <Link to="/contact" className="px-8 py-4 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400 transition-colors flex items-center gap-2">
                            Talk to Sales
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-gray-900">
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

export default PricingPage;
