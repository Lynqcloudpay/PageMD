import React from 'react';
import { Mail, Phone, MessageSquare, AlertTriangle, FileText, ExternalLink } from 'lucide-react';

const SupportPage = () => {
    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
                <p className="text-gray-500 mt-1">Get help with your account, technical issues, or billing inquiries.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Options */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            Contact Support
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Email Support</h3>
                                    <p className="text-sm text-gray-500 mb-2">For general inquiries and non-urgent issues.</p>
                                    <a href="mailto:support@pagemd.com" className="text-blue-600 font-medium hover:underline">support@pagemd.com</a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Phone Support</h3>
                                    <p className="text-sm text-gray-500 mb-2">Available Mon-Fri, 9am - 5pm EST.</p>
                                    <a href="tel:+18005550123" className="text-blue-600 font-medium hover:underline">1-800-555-0123</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
                        <h2 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Account Restricted?
                        </h2>
                        <p className="text-blue-700 text-sm mb-4">
                            If your account is in <strong>Read-Only Mode</strong> or has been <strong>Suspended</strong>, it may be due to:
                        </p>
                        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1 mb-4">
                            <li>Outstanding billing invoices</li>
                            <li>Compliance or security verification pending</li>
                            <li>Administrative lock by platform support</li>
                        </ul>
                        <p className="text-blue-700 text-sm">
                            Please contact <a href="mailto:billing@pagemd.com" className="font-bold underline">billing@pagemd.com</a> to resolve access issues immediately.
                        </p>
                    </div>
                </div>

                {/* FAQs / Resources */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        Common Topics
                    </h2>
                    <div className="space-y-1">
                        {[
                            "Resetting your password",
                            "Updating billing information",
                            "Adding new users",
                            "Configuring e-Prescribing",
                            "Connecting with Labs",
                            "Exporting patient data"
                        ].map((topic, i) => (
                            <button key={i} className="w-full text-left p-3 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-blue-600 flex items-center justify-between group transition-colors">
                                <span className="text-sm font-medium">{topic}</span>
                                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">System Status</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            All systems operational
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
