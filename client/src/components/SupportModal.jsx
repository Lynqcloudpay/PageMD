import React, { useState } from 'react';
import api from '../services/api';
import './SupportModal.css';

const SupportModal = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        priority: 'medium'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Capture client state for context
            const clientState = {
                route: window.location.pathname,
                timestamp: new Date().toISOString(),
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                userAgent: navigator.userAgent
            };

            await api.post('/support/tickets', {
                ...formData,
                clientState
            });

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setFormData({ subject: '', description: '', priority: 'medium' });
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="support-modal-overlay" onClick={onClose}>
            <div className="support-modal" onClick={(e) => e.stopPropagation()}>
                <div className="support-modal-header">
                    <h2>Report an Issue</h2>
                    <button className="support-close-btn" onClick={onClose}>×</button>
                </div>

                {success ? (
                    <div className="support-success">
                        <div className="success-icon">✓</div>
                        <p>Ticket submitted successfully!</p>
                        <p className="success-sub">Our team will review your issue shortly.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="support-form">
                        <div className="form-group">
                            <label htmlFor="subject">Subject</label>
                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="Brief description of the issue"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="priority">Priority</label>
                            <select
                                id="priority"
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                            >
                                <option value="low">Low - Minor inconvenience</option>
                                <option value="medium">Medium - Affects workflow</option>
                                <option value="high">High - Blocking work</option>
                                <option value="critical">Critical - Patient safety concern</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Please describe what you were doing when the issue occurred..."
                                rows={5}
                                required
                            />
                        </div>

                        <div className="support-context-note">
                            <span className="info-icon">ℹ</span>
                            <span>System context and recent actions will be automatically included to help us diagnose the issue.</span>
                        </div>

                        {error && <div className="support-error">{error}</div>}

                        <div className="support-actions">
                            <button type="button" className="btn-cancel" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SupportModal;
