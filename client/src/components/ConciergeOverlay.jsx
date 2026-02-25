import React, { useState, useEffect } from 'react';
import {
    Zap,
    X,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Search,
    Layout as LayoutIcon,
    History
} from 'lucide-react';

const TIPS = [
    {
        title: "The Speed Search",
        content: "Tap Cmd+K (or Ctrl+K) anywhere to instantly jump to any patient, MRN, or record.",
        icon: Search,
        color: "blue"
    },
    {
        title: "Side-by-Side Trends",
        content: "View labs and vitals while charting. Use the split-view icon in the bottom right corner.",
        icon: LayoutIcon,
        color: "emerald"
    },
    {
        title: "Auto-Drafting Snippets",
        content: "Type '/dx' followed by a keyword to instantly pull in complex assessment templates.",
        icon: Zap,
        color: "amber"
    },
    {
        title: "Timeline Scripter",
        content: "Drag clinical events directly into your note to automatically document time-stamped history.",
        icon: History,
        color: "rose"
    }
];

const ConciergeOverlay = ({ isOpen, onClose, leadName, onLaunch, isLaunching }) => {
    const [currentTip, setCurrentTip] = useState(0);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTip((prev) => (prev + 1) % TIPS.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const getCookie = (name) => {
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name + "=") === 0) {
                return c.substring(name.length + 1, c.length);
            }
        }
        return '';
    };

    const handleInquiry = async () => {
        if (!message || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const uuid = getCookie('pagemd_lead_id');
            const baseUrl = import.meta.env.VITE_API_URL || '/api';

            if (!uuid) {
                console.warn('[Concierge] No lead UUID found in cookies.');
                // We'll proceed without UUID, the backend might reject it but we want to log it
            }

            console.log(`[Concierge] Sending inquiry for ${uuid || 'no_uuid'} to ${baseUrl}`);
            const res = await fetch(`${baseUrl}/sales/concierge-inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, message })
            });

            if (res.ok) {
                setSubmitted(true);
                setMessage('');
            }
        } catch (error) {
            console.error('Failed to send inquiry:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLaunchClick = async () => {
        onLaunch(message.trim());
    };

    if (!isOpen) return null;

    const TipIcon = TIPS[currentTip].icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-50/40 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in border border-white/20">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid md:grid-cols-5 h-full">
                    {/* Left: Greeting & Inquiry */}
                    <div className="md:col-span-3 p-8 md:p-10 border-r border-gray-100">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold tracking-widest uppercase mb-6">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            Premium Concierge Access
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                            Welcome back, <br />
                            <span className="text-blue-600">{leadName?.split(' ')[0] || 'Doctor'}</span>
                        </h2>

                        <p className="text-gray-500 text-sm mb-8">
                            Launching your persistent sandbox. All your previous data and progress have been preserved.
                        </p>

                        {!submitted ? (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Quick Question for our Team?
                                </label>
                                <div className="relative">
                                    <textarea
                                        className="w-full h-24 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                                        placeholder="Need help with a specific feature? Ask here..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                    <button
                                        onClick={handleInquiry}
                                        disabled={isSubmitting || !message}
                                        className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl animate-fade-in">
                                <p className="text-emerald-700 text-sm font-bold flex items-center gap-2">
                                    <Zap className="w-4 h-4 fill-current text-emerald-500" />
                                    Question sent! We'll reach out shortly.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleLaunchClick}
                            disabled={isLaunching}
                            className="w-full mt-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 group disabled:opacity-70"
                        >
                            {isLaunching ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            )}
                            {isLaunching ? 'Waking up sandbox...' : 'Launch Sandbox (Fast Track)'}
                        </button>
                    </div>

                    {/* Right: Tips Carousel */}
                    <div className="md:col-span-2 bg-gray-50 p-8 flex flex-col justify-between">
                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-8">
                                Power User Tips
                            </div>

                            <div key={currentTip} className="animate-fade-in">
                                <div className={`w-12 h-12 rounded-2xl bg-${TIPS[currentTip].color}-100 text-${TIPS[currentTip].color}-600 flex items-center justify-center mb-6 shadow-sm border border-white`}>
                                    <TipIcon className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-900 mb-3">{TIPS[currentTip].title}</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {TIPS[currentTip].content}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-8">
                            <div className="flex gap-1.5">
                                {TIPS.map((_, i) => (
                                    <div key={i} className={`h-1 rounded-full transition-all ${i === currentTip ? 'w-6 bg-blue-600' : 'w-2 bg-gray-100'}`} />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentTip((prev) => (prev - 1 + TIPS.length) % TIPS.length)}
                                    className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                                </button>
                                <button
                                    onClick={() => setCurrentTip((prev) => (prev + 1) % TIPS.length)}
                                    className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConciergeOverlay;
