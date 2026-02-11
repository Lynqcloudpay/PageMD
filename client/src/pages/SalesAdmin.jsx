import React, { useState, useEffect } from 'react';
import {
    Mail, Phone, Building2, Users, Calendar, Clock,
    CheckCircle2, XCircle, MessageSquare, RefreshCw,
    Search, Filter, ChevronDown, ArrowLeft, Inbox,
    TrendingUp, UserPlus, Eye, EyeOff, MoreVertical, Lock, LogOut,
    Settings, Key, Plus, User, Gift, Database, Shield,
    Send, History, Share2, X, ChevronRight, ChevronLeft, PhoneIncoming, CalendarCheck, Reply, XOctagon, Video, Zap, Star, Activity, CalendarDays, Archive,
    CalendarX2, Ban, Snowflake, AlertTriangle, CheckSquare, Trophy, HelpCircle, Timer, DollarSign, Wallet, CircleDashed, UserMinus, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    format,
    formatDistanceToNow,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    addMonths,
    subMonths,
    parseISO,
    isToday
} from 'date-fns';

const SalesAdmin = () => {
    // Auth State
    const [token, setToken] = useState(sessionStorage.getItem('salesToken'));
    const [currentUser, setCurrentUser] = useState(JSON.parse(sessionStorage.getItem('salesUser') || 'null'));

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    // Dashboard State
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('new');
    const [activeCategory, setActiveCategory] = useState('pending'); // 'pending', 'pipeline', 'completed', 'all'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [updating, setUpdating] = useState(false);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('password'); // password, users
    const [teamUsers, setTeamUsers] = useState([]);

    // Change Password Form
    const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
    const [passMsg, setPassMsg] = useState({ text: '', type: '' });

    // Create User Form
    const [userForm, setUserForm] = useState({ username: '', password: '', email: '' });
    const [userMsg, setUserMsg] = useState({ text: '', type: '' });

    // Profile Form
    const [profileForm, setProfileForm] = useState({ email: currentUser?.email || '', meetingLink: currentUser?.meeting_link || '' });
    const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
    const [profileLoading, setProfileLoading] = useState(false);

    // Onboard Clinic Modal State
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [onboardForm, setOnboardForm] = useState({
        displayName: '',
        slug: '',
        specialty: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: ''
    });
    const [onboardLoading, setOnboardLoading] = useState(false);
    const [onboardError, setOnboardError] = useState('');

    // Status Change Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [statusNote, setStatusNote] = useState('');
    const [statusNoteLoading, setStatusNoteLoading] = useState(false);

    // Logs & Activity State
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [newLogContent, setNewLogContent] = useState('');
    const [sendingLog, setSendingLog] = useState(false);
    const [logFilter, setLogFilter] = useState('all'); // 'all', 'user', 'team'
    const [pipelineUserFilter, setPipelineUserFilter] = useState('all'); // 'all', 'mine', or userId
    const logEndRef = React.useRef(null);

    // Demo Scheduling State
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [demoForm, setDemoForm] = useState({ date: '', time: '', notes: '' });
    const [demoLoading, setDemoLoading] = useState(false);

    // Lead Pool & Ownership State
    const [viewMode, setViewMode] = useState('pool'); // 'pool', 'personal', 'master'
    const [claimLoading, setClaimLoading] = useState(false);
    const [masterDemos, setMasterDemos] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all', 'mine'
    const [demoModalMonth, setDemoModalMonth] = useState(new Date());
    const [selectedDemo, setSelectedDemo] = useState(null);

    // Celebration State (for confetti on conversion)
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationData, setCelebrationData] = useState(null);

    // Dismiss Modal State
    const [showDismissModal, setShowDismissModal] = useState(false);
    const [dismissReason, setDismissReason] = useState('');
    const [dismissNotes, setDismissNotes] = useState('');
    const [dismissLoading, setDismissLoading] = useState(false);

    // Demo Outcome Modal State
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [outcomeCategory, setOutcomeCategory] = useState('undecided'); // 'converted', 'undecided', 'asking_time', 'not_interested', 'budget'
    const [outcomeNotes, setOutcomeNotes] = useState('');
    const [completeLoading, setCompleteLoading] = useState(false);

    // Reclaim Modal State
    const [showReclaimModal, setShowReclaimModal] = useState(false);
    const [reclaimNotes, setReclaimNotes] = useState('');
    const [reclaimLoading, setReclaimLoading] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState('pool'); // 'pool', 'original', 'assign'
    const [restoreSellerId, setRestoreSellerId] = useState('');

    // Salvage Sub-Category Filter
    const [salvageFilter, setSalvageFilter] = useState('all'); // 'all', 'cancelled', 'closed', 'dismissed', 'cold'

    const getEnhancedMeetingLink = (demo) => {
        if (!demo || !demo.meeting_link) return '';
        if (!demo.meeting_link.includes('meet.jit.si')) return demo.meeting_link;

        const inq = inquiries.find(i => i.id == demo.inquiry_id);
        if (!inq) return demo.meeting_link;

        const cleanMsg = (inq.message || '').replace(/\r?\n|\r/g, " ").trim();
        const subject = `Lead: ${inq.name} ${inq.practice_name ? `(${inq.practice_name})` : ''} | Msg: ${cleanMsg}`.trim();
        const truncated = subject.length > 180 ? subject.substring(0, 177) + '...' : subject;
        const config = `#config.subject=${encodeURIComponent(truncated)}&config.defaultLocalDisplayName=${encodeURIComponent(currentUser?.username || 'Seller')}`;
        return demo.meeting_link.split('#')[0] + config;
    };

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const isAdmin = currentUser?.username === 'admin' || currentUser?.role === 'sales_manager';

    // --- Authentication ---

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        try {
            const response = await fetch(`${baseUrl}/sales/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setToken(data.token);
            setCurrentUser(data.user);
            sessionStorage.setItem('salesToken', data.token);
            sessionStorage.setItem('salesUser', JSON.stringify(data.user));

        } catch (err) {
            setAuthError(err.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setCurrentUser(null);
        sessionStorage.removeItem('salesToken');
        sessionStorage.removeItem('salesUser');
    };

    const authenticatedFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const response = await fetch(baseUrl + url, { ...options, headers });
        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired');
        }
        return response;
    };

    // --- Data Fetching ---

    const fetchInquiries = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            setError(null);
            // Client-side filtering strategy: Fetch all, then filter in UI
            // This allows us to show counts for all categories simultaneously
            const response = await authenticatedFetch(`/sales/inquiries`);

            if (!response.ok) {
                throw new Error('Failed to fetch inquiries');
            }

            const data = await response.json();
            setInquiries(data.inquiries || []);
        } catch (err) {
            console.error('Error fetching inquiries:', err);
            setError(err.message);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchInquiries();
            fetchMasterSchedule(); // Ensure demos are loaded
            // Fetch team users for all logged-in users (needed for assignments)
            fetchTeamUsers();
            const interval = setInterval(() => {
                fetchInquiries(true);
                fetchMasterSchedule();
                if (selectedInquiry) {
                    fetchLogs(selectedInquiry.id);
                }
            }, 4000); // Poll frequently for live updates
            return () => clearInterval(interval);
        }
    }, [token]);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, logFilter, selectedInquiry]);

    /**
     * SYNC LOGIC: If the currently selected inquiry is no longer in the inquiries list 
     * (e.g. it was deleted by another user or via "Dead Lead"), auto-close the panel.
     */
    useEffect(() => {
        if (selectedInquiry && inquiries.length > 0) {
            const stillExists = inquiries.some(i => i.id === selectedInquiry.id);
            if (!stillExists) {
                console.log('[SALES] Selected inquiry no longer exists in current list, clearing selection...');
                setSelectedInquiry(null);
            }
        }
    }, [inquiries, selectedInquiry]);

    const fetchTeamUsers = async () => {
        try {
            const response = await authenticatedFetch('/sales/users');
            if (response.ok) {
                const data = await response.json();
                setTeamUsers(data.users || []);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMsg({ text: '', type: '' });

        try {
            const response = await authenticatedFetch('/sales/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify(profileForm)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setProfileMsg({ text: 'Profile updated successfully!', type: 'success' });

            // Update local state
            const updatedUser = { ...currentUser, email: profileForm.email, meeting_link: profileForm.meetingLink };
            setCurrentUser(updatedUser);
            sessionStorage.setItem('salesUser', JSON.stringify(updatedUser));

        } catch (err) {
            setProfileMsg({ text: err.message, type: 'error' });
        } finally {
            setProfileLoading(false);
        }
    };

    // --- Actions ---

    const activateReferral = async (id) => {
        try {
            setUpdating(true);
            const response = await authenticatedFetch(`/sales/inquiries/${id}/activate-referral`, {
                method: 'POST'
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            await fetchInquiries();
            if (selectedInquiry?.id === id) {
                setSelectedInquiry(prev => ({ ...prev, referral_activated: true }));
            }
        } catch (err) {
            console.error('Error activating referral:', err);
            alert(err.message);
        } finally {
            setUpdating(false);
        }
    };

    // Open onboard modal with pre-filled data from inquiry
    const openOnboardModal = (inquiry) => {
        const nameParts = (inquiry.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const slug = (inquiry.practice_name || inquiry.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+$/, '')
            .substring(0, 30);

        setOnboardForm({
            displayName: inquiry.practice_name || '',
            slug: slug,
            specialty: '',
            adminFirstName: firstName,
            adminLastName: lastName,
            adminEmail: inquiry.email || '',
            adminPassword: ''
        });
        setOnboardError('');
        setShowOnboardModal(true);
    };

    // Handle clinic onboarding
    const handleOnboard = async (e) => {
        e.preventDefault();
        setOnboardLoading(true);
        setOnboardError('');

        try {
            const response = await authenticatedFetch('/sales/onboard', {
                method: 'POST',
                body: JSON.stringify({
                    inquiryId: selectedInquiry?.id,
                    clinic: {
                        name: onboardForm.displayName,
                        displayName: onboardForm.displayName,
                        slug: onboardForm.slug,
                        specialty: onboardForm.specialty
                    },
                    adminUser: {
                        firstName: onboardForm.adminFirstName,
                        lastName: onboardForm.adminLastName,
                        email: onboardForm.adminEmail,
                        password: onboardForm.adminPassword
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            // Trigger celebration instead of alert!
            setCelebrationData({
                clinicName: onboardForm.displayName,
                message: data.message,
                referralActivated: data.referralActivated
            });
            setShowCelebration(true);

            setShowOnboardModal(false);
            await fetchInquiries();
            await fetchLogs(selectedInquiry?.id); // Refresh logs to show conversion log
            if (selectedInquiry) {
                setSelectedInquiry(prev => ({
                    ...prev,
                    status: 'converted',
                    referral_activated: data.referralActivated
                }));
            }
        } catch (err) {
            console.error('Onboarding error:', err);
            setOnboardError(err.message);
        } finally {
            setOnboardLoading(false);
        }
    };

    const updateInquiryStatus = async (id, newStatus, notes = null) => {
        try {
            setUpdating(true);
            const response = await authenticatedFetch(`/sales/inquiries/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus, notes: notes })
            });

            if (!response.ok) throw new Error('Failed to update');

            await fetchInquiries();
            await fetchMasterSchedule(); // Refresh calendar dots
            if (selectedInquiry?.id === id) {
                setSelectedInquiry(prev => ({ ...prev, status: newStatus, notes: notes || prev.notes }));
            }
        } catch (err) {
            console.error('Error updating inquiry:', err);
        } finally {
            setUpdating(false);
        }
    };

    // Open status change modal (for statuses requiring notes)
    const openStatusModal = (newStatus) => {
        if (selectedInquiry?.status === 'converted') {
            // Cannot change status once converted
            alert('This inquiry has been converted and cannot be changed.');
            return;
        }
        setPendingStatus(newStatus);
        setStatusNote('');
        setShowStatusModal(true);
    };

    // Submit status change with note
    const submitStatusChange = async () => {
        if (!statusNote.trim()) {
            alert('Please add a note before changing status.');
            return;
        }
        setStatusNoteLoading(true);
        await updateInquiryStatus(selectedInquiry.id, pendingStatus, statusNote);
        setStatusNoteLoading(false);
        setShowStatusModal(false);
        setPendingStatus(null);
        setStatusNote('');
    };

    // Get status note placeholder based on status
    const getStatusNotePlaceholder = (status) => {
        switch (status) {
            case 'contacted':
                return 'What was discussed? Any follow-up actions? Next call date?';
            case 'demo_scheduled':
                return 'When is the demo? Who will attend? Any special requirements?';
            case 'follow_up':
                return 'What needs to be followed up? When? Any blockers?';
            case 'closed':
                return 'Why was the deal not closed? Customer feedback? Reason for rejection?';
            default:
                return 'Add notes about this status change...';
        }
    };
    const handleClaimLead = async (inquiryId) => {
        try {
            setClaimLoading(true);
            const response = await authenticatedFetch(`/sales/inquiries/${inquiryId}/claim`, {
                method: 'POST'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to claim lead');
            }

            // Refresh inquiries
            await fetchInquiries();

            // Re-select to get updated state (the backend returns success, but we need the new list)
            // fetchInquiries will update the 'inquiries' state.
        } catch (err) {
            console.error('Claim error:', err);
            alert(err.message);
        } finally {
            setClaimLoading(false);
        }
    };

    const handleDismissLead = async () => {
        if (!selectedInquiry || !dismissReason || dismissNotes.length < 1) {
            alert('Please select a reason and provide a note');
            return;
        }

        try {
            setDismissLoading(true);
            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/dismiss`, {
                method: 'POST',
                body: JSON.stringify({ reason: dismissReason, notes: dismissNotes })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to dismiss lead');
            }

            // Reset modal state
            setShowDismissModal(false);
            setDismissReason('');
            setDismissNotes('');
            setSelectedInquiry(null);

            // Refresh inquiries
            await fetchInquiries();
        } catch (err) {
            console.error('Dismiss error:', err);
            alert(err.message);
        } finally {
            setDismissLoading(false);
        }
    };

    const handleCompleteDemo = async () => {
        if (!selectedDemo || !outcomeNotes.trim()) {
            alert('Please provide outcome notes');
            return;
        }

        try {
            setCompleteLoading(true);
            const response = await authenticatedFetch(`/sales/demos/${selectedDemo.id}/complete`, {
                method: 'POST',
                body: JSON.stringify({ category: outcomeCategory, notes: outcomeNotes })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to complete demo');
            }

            setShowCompleteModal(false);
            setOutcomeNotes('');
            setSelectedDemo(null);

            // Refresh
            await fetchInquiries();
            await fetchMasterSchedule();

        } catch (err) {
            console.error('Complete error:', err);
            alert(err.message);
        } finally {
            setCompleteLoading(false);
        }
    };

    const handleReclaimLead = async () => {
        if (!selectedInquiry || !reclaimNotes.trim()) return;

        try {
            setReclaimLoading(true);

            // Calculate the previous owner ID for 'original' target
            let previousOwnerId = null;
            if (restoreTarget === 'original') {
                // Priority: dismissed_by > last demo seller > claimed_by
                if (selectedInquiry.dismissed_by) {
                    previousOwnerId = selectedInquiry.dismissed_by;
                } else {
                    const lastDemo = masterDemos
                        .filter(d => d.inquiry_id === selectedInquiry.id)
                        .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0];
                    if (lastDemo?.seller_id) {
                        previousOwnerId = lastDemo.seller_id;
                    } else if (selectedInquiry.claimed_by) {
                        previousOwnerId = selectedInquiry.claimed_by;
                    }
                }
            }

            // When restoring to 'original', convert to 'assign' with explicit ID
            // This ensures the backend doesn't have to guess
            const effectiveTarget = (restoreTarget === 'original' && previousOwnerId) ? 'assign' : restoreTarget;
            const effectiveSellerId = restoreTarget === 'assign' ? restoreSellerId : previousOwnerId;

            const payload = {
                notes: reclaimNotes,
                target: effectiveTarget,
                sellerId: effectiveSellerId
            };
            console.log('Sending Reclaim Request:', payload);

            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/reclaim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to reclaim lead');
            }

            // Reset modal
            setShowReclaimModal(false);
            setReclaimNotes('');
            setRestoreTarget('pool');
            setRestoreSellerId('');

            // Refresh inquiries and schedule
            await fetchInquiries();
            await fetchMasterSchedule();

            // Move to appropriate view based on assignment
            if (restoreTarget === 'pool') {
                setViewMode('pool');
                setStatusFilter('verified');
            } else {
                setViewMode('personal');
                setPipelineUserFilter('all');
            }

            setSelectedInquiry(null);
        } catch (err) {
            console.error('Reclaim error:', err);
            alert(err.message);
        } finally {
            setReclaimLoading(false);
        }
    };

    const handleDeleteLead = async () => {
        if (!selectedInquiry) return;
        if (!window.confirm(`⚠️ PERMANENT DELETE: Are you sure you want to completely erase ${selectedInquiry.name} from the system? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete lead');
            }

            // Refresh & Close panel
            setSelectedInquiry(null);
            await fetchInquiries();
            await fetchMasterSchedule(); // Also refresh calendar dots
            alert('Lead permanently erased.');
        } catch (err) {
            console.error('Delete error:', err);
            alert(err.message);
        }
    };
    const fetchMasterSchedule = async () => {
        try {
            const response = await authenticatedFetch('/sales/master-schedule');
            if (response.ok) {
                const data = await response.json();
                setMasterDemos(data.demos);
            }
        } catch (err) {
            console.error('Failed to fetch master schedule:', err);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passForm.new !== passForm.confirm) {
            setPassMsg({ text: 'Passwords do not match', type: 'error' });
            return;
        }

        try {
            const response = await authenticatedFetch('/sales/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: passForm.current,
                    newPassword: passForm.new
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setPassMsg({ text: 'Password updated successfully', type: 'success' });
            setPassForm({ current: '', new: '', confirm: '' });
        } catch (err) {
            setPassMsg({ text: err.message, type: 'error' });
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await authenticatedFetch('/sales/auth/create-user', {
                method: 'POST',
                body: JSON.stringify(userForm)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setUserMsg({ text: 'User created successfully', type: 'success' });
            setUserForm({ username: '', password: '', email: '' });
            fetchTeamUsers();
        } catch (err) {
            setUserMsg({ text: err.message, type: 'error' });
        }
    };

    const fetchLogs = async (inquiryId) => {
        try {
            setLogsLoading(true);
            const response = await authenticatedFetch(`/sales/inquiries/${inquiryId}/logs`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleAddLog = async (e) => {
        e.preventDefault();
        if (!newLogContent.trim()) return;

        try {
            setSendingLog(true);
            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/logs`, {
                method: 'POST',
                body: JSON.stringify({ content: newLogContent, type: 'note' })
            });

            if (response.ok) {
                const data = await response.json();
                setLogs(prev => [...prev, { ...data.log, admin_name: currentUser.username }]);
                setNewLogContent('');
            }
        } catch (err) {
            console.error('Error adding log:', err);
            alert('Failed to add note');
        } finally {
            setSendingLog(false);
        }
    };

    const markLeadAsViewed = async (inquiryId) => {
        try {
            const response = await authenticatedFetch(`/sales/inquiries/${inquiryId}/view`, {
                method: 'POST'
            });
            if (response.ok) {
                // Locally update unread count and last_viewed_at to stop pulsing immediately
                setInquiries(prev => prev.map(inq =>
                    inq.id === inquiryId ? { ...inq, unread_count: 0, last_viewed_at: new Date().toISOString() } : inq
                ));
            }
        } catch (err) {
            console.error('Error marking as viewed:', err);
        }
    };

    const handleSelectInquiry = (inquiry) => {
        setSelectedInquiry(inquiry);
        // Always mark as viewed to update last_viewed_at and stop pulsing
        markLeadAsViewed(inquiry.id);
    };

    const handleDeleteDemo = async (demoId, requireConfirm = true) => {
        if (requireConfirm && !confirm('Are you sure you want to permanently remove this appointment?')) return;

        try {
            const response = await authenticatedFetch(`/sales/demos/${demoId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setMasterDemos(prev => prev.filter(d => d.id !== demoId));
                setSelectedDemo(null);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete');
            }
        } catch (err) {
            console.error('Error deleting demo:', err);
            alert('Failed to delete appointment');
        }
    };

    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const handleCancelDemo = async (demoId) => {
        if (!cancelReason.trim()) {
            alert('Please provide a reason for cancellation');
            return;
        }

        try {
            const response = await authenticatedFetch(`/sales/demos/${demoId}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: cancelReason })
            });

            if (response.ok) {
                alert('Appointment cancelled and moved to Salvage.');
                setShowDemoModal(false); // Close parent
                setSelectedDemo(null);
                setIsCancelling(false);
                setCancelReason('');
                setMasterDemos(prev => prev.filter(d => d.id !== demoId));
                // Fetch inquiries to update counts
                await fetchInquiries();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to cancel');
            }
        } catch (err) {
            console.error('Error cancelling demo:', err);
            alert('Failed to cancel appointment');
        }
    };

    const handleScheduleDemo = async (e) => {
        e.preventDefault();
        if (!demoForm.date || !demoForm.time) {
            alert('Please select date and time');
            return;
        }

        try {
            setDemoLoading(true);
            const dateTime = new Date(`${demoForm.date}T${demoForm.time}`);

            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/schedule-demo`, {
                method: 'POST',
                body: JSON.stringify({
                    date: dateTime.toISOString(),
                    notes: demoForm.notes
                })
            });

            if (!response.ok) throw new Error('Failed to schedule');

            alert('Demo scheduled and invite sent!');
            setShowDemoModal(false);
            setDemoForm({ date: '', time: '', notes: '' });
            await fetchLogs(selectedInquiry.id);
            // Update local inquiry status
            setSelectedInquiry(prev => ({ ...prev, status: 'demo_scheduled', demo_scheduled_at: dateTime.toISOString() }));
            // Update list
            setInquiries(prev => prev.map(i => i.id === selectedInquiry.id ? { ...i, status: 'demo_scheduled' } : i));

        } catch (err) {
            console.error('Error scheduling demo:', err);
            alert(err.message);
        } finally {
            setDemoLoading(false);
        }
    };


    useEffect(() => {
        if (showSettings && token) {
            fetchTeamUsers();
        }
    }, [showSettings, token]);

    useEffect(() => {
        if (selectedInquiry?.id) {
            fetchLogs(selectedInquiry.id);
        } else {
            setLogs([]);
        }
    }, [selectedInquiry?.id]);

    useEffect(() => {
        if (showDemoModal && masterDemos.length === 0) {
            fetchMasterSchedule();
        }
    }, [showDemoModal]);


    // --- Helpers ---

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700';
            case 'contacted': return 'bg-yellow-100 text-yellow-700';
            case 'demo_scheduled': return 'bg-indigo-100 text-indigo-700';
            case 'follow_up': return 'bg-orange-100 text-orange-700';
            case 'converted': return 'bg-emerald-100 text-emerald-700';
            case 'closed': return 'bg-slate-100 text-slate-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getInterestLabel = (interest) => {
        const labels = {
            'demo': 'Demo Request',
            'sandbox': 'Sandbox Access',
            'pricing': 'Pricing Info',
            'enterprise': 'Enterprise',
            'starter': 'Starter Plan',
            'professional': 'Professional Plan',
            'other': 'Other'
        };
        return labels[interest] || interest || 'General';
    };

    const filteredInquiries = inquiries.filter(inq => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            inq.name?.toLowerCase().includes(search) ||
            inq.email?.toLowerCase().includes(search) ||
            inq.practice_name?.toLowerCase().includes(search)
        );
    });

    // Stats - Only count non-dismissed leads for active dashboard numbers
    const activeInquiries = inquiries.filter(i => {
        const s = (i.status || 'new').toLowerCase().trim();
        return !i.dismissal_reason && s !== 'dismissed';
    });

    const stats = {
        total: activeInquiries.length,
        new: activeInquiries.filter(i => {
            const s = (i.status || 'new').toLowerCase().trim();
            return !['demo_scheduled', 'follow_up', 'converted', 'closed'].includes(s);
        }).length,
        contacted: activeInquiries.filter(i => (i.status || '').toLowerCase().trim() === 'contacted').length,
        converted: activeInquiries.filter(i => (i.status || '').toLowerCase().trim() === 'converted').length
    };


    // --- UI Render ---

    if (!token) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-2xl p-8">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">Sales Team Login</h1>
                            <p className="text-slate-500 mt-2">Sign in to manage inquiries</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            <div className="relative group">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                                        placeholder="Enter password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {authError && (
                                <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg flex items-center justify-center gap-2">
                                    <XCircle className="w-4 h-4" />
                                    {authError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {authLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                Sign In
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link to="/" className="text-sm text-slate-500 hover:text-blue-600">
                                ← Back to PageMD
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Check if lead has recent activity (within 15 minutes) - "HOT" lead
    const isHotLead = (inquiry) => {
        if (!inquiry.last_activity_at) return false;
        const lastActivity = new Date(inquiry.last_activity_at);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Pulse logic: MUST be recent activity AND never viewed since that activity
        const isRecent = lastActivity > oneWeekAgo;
        const isUnviewed = !inquiry.last_viewed_at || (new Date(inquiry.last_viewed_at) < lastActivity);

        return isRecent && isUnviewed;
    };

    return (
        <div className="min-h-screen bg-slate-50 relative font-figtree antialiased">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Sales Dashboard</h1>
                                <p className="text-sm text-slate-500">Welcome back, {currentUser?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setViewMode('master');
                                    fetchMasterSchedule();
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm ${viewMode === 'master'
                                    ? 'bg-slate-800 text-white shadow-inner scale-[0.98]'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <Calendar className={`w-4 h-4 ${viewMode === 'master' ? 'text-white' : 'text-slate-400'}`} />
                                <span className="font-bold">Schedule</span>
                            </button>
                            <button
                                onClick={() => {
                                    setViewMode('salvage');
                                    setSalvageFilter('all');
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm ${viewMode === 'salvage'
                                    ? 'bg-rose-600 text-white shadow-inner scale-[0.98]'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <Archive className={`w-4 h-4 ${viewMode === 'salvage' ? 'text-white' : 'text-slate-400'}`} />
                                <span className="font-bold">Salvage</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${viewMode === 'salvage' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                    {inquiries.filter(i => {
                                        const s = (i.status || '').toLowerCase().trim();
                                        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                                        const isCancelledAppt = i.demo_scheduled_at && ['closed', 'cancelled'].includes(s);
                                        const isClosedWonButNoDemo = s === 'closed' && !i.demo_scheduled_at && !i.dismissal_reason;
                                        const isManuallyDismissed = i.dismissal_reason || s === 'dismissed';
                                        const isColdLead = !['closed', 'converted', 'dismissed'].includes(s) && !i.dismissal_reason && (i.last_activity_at ? new Date(i.last_activity_at) : new Date(i.created_at)) < thirtyDaysAgo;
                                        return isCancelledAppt || isClosedWonButNoDemo || isManuallyDismissed || isColdLead;
                                    }).length}
                                </span>
                            </button>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                Settings
                            </button>
                            <button
                                onClick={fetchInquiries}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto px-8 py-10">
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                                <Inbox className="w-5 h-5 text-slate-400" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Volume</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800 tracking-tight">{stats.total}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Active inquiries</div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                <UserPlus className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">New Leads</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 tracking-tight">{stats.new}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Awaiting contact</div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition-colors">
                                <MessageSquare className="w-5 h-5 text-yellow-500" />
                            </div>
                            <span className="text-[9px] font-bold text-yellow-500 status-glow uppercase tracking-widest">Nurturing</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-600 tracking-tight">{stats.contacted}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">In discussion</div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                            </div>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Conversion</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-600 tracking-tight">{stats.converted}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Closed won</div>
                    </div>
                </div>

                {/* Header Stats & Global Filter are now redundant or moved to sidebar categories */}
                {/* We keep the stats cards for overall count but can hide the high-level filter if sidebar is preferred */}

                {/* Sidebar & Detail Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-[calc(100vh-260px)] min-h-[600px] pb-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full border-r border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 block">
                                Inquiry Categories
                            </span>

                            {/* View Toggles */}
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm mb-4">
                                <button
                                    onClick={() => {
                                        setViewMode('pool');
                                        setStatusFilter('verified'); // Default to verified leads
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'pool'
                                        ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                        }`}
                                >
                                    <Inbox className={`w-4 h-4 ${viewMode === 'pool' ? 'text-blue-600' : 'text-slate-300'}`} />
                                    Lead Pool
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${viewMode === 'pool' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {inquiries.filter(i => {
                                            if (i.is_claimed) return false;
                                            const s = (i.status || 'new').toLowerCase().trim();
                                            // Exclude dismissed from active pool
                                            if (i.dismissal_reason || s === 'dismissed') return false;
                                            // Only count VERIFIED leads in the top badge
                                            return s === 'verified';
                                        }).length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => {
                                        setViewMode('personal');
                                        setStatusFilter('new'); // Default to 'New' instead of 'All' in Pipeline
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'personal'
                                        ? 'bg-blue-600 text-white shadow-md transform scale-[1.02]'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                        }`}
                                >
                                    <Shield className={`w-4 h-4 ${viewMode === 'personal' ? 'text-white' : 'text-slate-300'}`} />
                                    {(currentUser?.username === 'admin' || currentUser?.role === 'sales_manager') ? 'Pipeline' : 'My Pipeline'}
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${viewMode === 'personal' ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>
                                        {inquiries.filter(i => {
                                            if (!i.is_claimed) return false;
                                            const s = (i.status || 'new').toLowerCase().trim();
                                            if (i.dismissal_reason || s === 'dismissed') return false;

                                            if (currentUser?.username === 'admin' || currentUser?.role === 'sales_manager') {
                                                if (pipelineUserFilter === 'mine') return i.claimed_by == currentUser?.id;
                                                if (pipelineUserFilter !== 'all') return i.claimed_by == pipelineUserFilter;
                                                return true; // All claimed
                                            }
                                            return i.claimed_by == currentUser?.id;
                                        }).length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => {
                                        setViewMode('master');
                                        fetchMasterSchedule();
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'master'
                                        ? 'bg-slate-800 text-white shadow-md transform scale-[1.02]'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                        }`}
                                >
                                    <Activity className={`w-4 h-4 ${viewMode === 'master' ? 'text-white' : 'text-slate-300'}`} />
                                    {(currentUser?.role === 'sales_manager' || currentUser?.username === 'admin') ? 'Team' : 'Schedule'}
                                </button>
                            </div>

                            {/* Pipeline Filter for Admins */}
                            {viewMode === 'personal' && (currentUser?.username === 'admin' || currentUser?.role === 'sales_manager') && (
                                <div className="mb-4">
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <select
                                            value={pipelineUserFilter}
                                            onChange={(e) => setPipelineUserFilter(e.target.value)}
                                            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wide focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 appearance-none shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                                        >
                                            <option value="all">Global View (All)</option>
                                            <option value="mine">My Pipeline Only</option>
                                            <option disabled className="bg-slate-50">──────────</option>
                                            {teamUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}'s Pipeline</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Lead Pool Sub-filters: Verified / Unverified */}
                            {viewMode === 'pool' && (
                                <div className="flex gap-2 mb-4">
                                    {(() => {
                                        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

                                        // Calculate verified and unverified counts
                                        const verifiedLeads = inquiries.filter(i => {
                                            if (i.is_claimed) return false;
                                            const s = (i.status || 'new').toLowerCase().trim();
                                            if (i.dismissal_reason || s === 'dismissed') return false;
                                            return s === 'verified' && !['demo_scheduled', 'follow_up', 'converted', 'closed'].includes(s);
                                        });
                                        const unverifiedLeads = inquiries.filter(i => {
                                            if (i.is_claimed) return false;
                                            const s = (i.status || 'new').toLowerCase().trim();
                                            if (i.dismissal_reason || s === 'dismissed') return false;
                                            return s !== 'verified' && !['demo_scheduled', 'follow_up', 'converted', 'closed', 'contacted'].includes(s);
                                        });

                                        // Check for recent activity (hot leads)
                                        const hasHotVerified = verifiedLeads.some(i => isHotLead(i));
                                        const hasHotUnverified = unverifiedLeads.some(i => isHotLead(i));

                                        return (
                                            <>
                                                <button
                                                    onClick={() => setStatusFilter('verified')}
                                                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between gap-2 border ${statusFilter === 'verified'
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                                                        }`}
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Verified
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusFilter === 'verified'
                                                        ? 'bg-emerald-500 text-white'
                                                        : hasHotVerified
                                                            ? 'bg-orange-500 text-white animate-pulse'
                                                            : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {verifiedLeads.length}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => setStatusFilter('unverified')}
                                                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between gap-2 border ${statusFilter === 'unverified'
                                                        ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                                                        : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:bg-amber-50'
                                                        }`}
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        Unverified
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusFilter === 'unverified'
                                                        ? 'bg-amber-500 text-white'
                                                        : hasHotUnverified
                                                            ? 'bg-orange-500 text-white animate-pulse'
                                                            : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {unverifiedLeads.length}
                                                    </span>
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Sub-filters for Pipeline */}
                            {viewMode === 'personal' && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {(() => {
                                        // Calculate counts for badges
                                        const counts = { all: 0, new: 0, contacted: 0, demo_scheduled: 0, converted: 0, closed: 0, cancelled: 0 };
                                        const hotCounts = { all: false, new: false, contacted: false, demo_scheduled: false, converted: false, closed: false, cancelled: false };
                                        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

                                        inquiries.forEach(i => {
                                            const s = (i.status || 'new').toLowerCase().trim();

                                            // Check visibility using identical logic to main filter
                                            let visible = true;
                                            if (i.dismissal_reason || s === 'dismissed') visible = false;
                                            else if (viewMode === 'pool') visible = !i.is_claimed;
                                            else if (viewMode === 'salvage') visible = false; // Handled by separate logic
                                            else if (viewMode === 'personal') {
                                                if (!i.is_claimed) visible = false;
                                                else if (isAdmin) {
                                                    if (pipelineUserFilter === 'mine') visible = i.claimed_by === currentUser?.id;
                                                    else if (pipelineUserFilter !== 'all') visible = i.claimed_by == pipelineUserFilter;
                                                } else {
                                                    visible = i.claimed_by === currentUser?.id;
                                                }
                                            }

                                            if (!visible) return;

                                            const isHot = isHotLead(i);

                                            counts.all++;
                                            if (isHot) hotCounts.all = true;

                                            const isSalvage = s === 'closed' && (i.notes || '').includes('SALVAGE');

                                            if (['demo_scheduled'].includes(s)) {
                                                counts.demo_scheduled++;
                                                if (isHot) hotCounts.demo_scheduled = true;
                                            }
                                            else if (['converted'].includes(s)) {
                                                counts.converted++;
                                                if (isHot) hotCounts.converted = true;
                                            }
                                            else if (isSalvage) {
                                                counts.cancelled++;
                                                if (isHot) hotCounts.cancelled = true;
                                            }
                                            else if (['closed'].includes(s)) {
                                                counts.closed++;
                                                if (isHot) hotCounts.closed = true;
                                            }
                                            else if (['contacted', 'follow_up'].includes(s)) {
                                                counts.contacted++;
                                                if (isHot) hotCounts.contacted = true;
                                            }
                                            else {
                                                counts.new++;
                                                if (isHot) hotCounts.new = true;
                                            }
                                        });

                                        const filters = [
                                            { id: 'all', label: 'All', icon: Zap },
                                            { id: 'new', label: 'New', icon: Star },
                                            { id: 'contacted', label: 'Discussions', icon: MessageSquare },
                                            { id: 'demo_scheduled', label: 'Demo', icon: Calendar },
                                            { id: 'converted', label: 'Converted', icon: CheckCircle2 },
                                            { id: 'closed', label: 'Closed', icon: XCircle },
                                        ];



                                        return filters.map(cat => {
                                            const isActive = statusFilter === (cat.id === 'all' ? '' : cat.id);
                                            const hasHotLead = hotCounts[cat.id];

                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setStatusFilter(cat.id === 'all' ? '' : cat.id)}
                                                    className={`px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between gap-1.5 border w-full ${isActive
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.02]'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {isActive && <cat.icon className="w-3 h-3 flex-shrink-0" />}
                                                        <span className="truncate">{cat.label}</span>
                                                    </div>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] min-w-[16px] text-center font-bold flex-shrink-0 ${isActive
                                                        ? 'bg-blue-500 text-white'
                                                        : hasHotLead
                                                            ? 'bg-orange-500 text-white animate-pulse'
                                                            : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {counts[cat.id]}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {/* Salvage Sub-Category Filter */}
                            {viewMode === 'salvage' && (
                                <div className="flex flex-wrap gap-2 mb-4 p-2 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">Recovery Categories</span>
                                    {(() => {
                                        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

                                        // Calculate salvage category counts
                                        const cancelledCount = inquiries.filter(i => {
                                            const s = (i.status || '').toLowerCase();
                                            return s === 'cancelled' && !i.dismissal_reason;
                                        }).length;

                                        const closedCount = inquiries.filter(i => {
                                            const s = (i.status || '').toLowerCase();
                                            return s === 'closed' && !i.dismissal_reason;
                                        }).length;

                                        const dismissedCount = inquiries.filter(i => i.dismissal_reason || i.status === 'dismissed').length;

                                        const coldCount = inquiries.filter(i => {
                                            const s = (i.status || '').toLowerCase();
                                            if (['closed', 'converted', 'dismissed'].includes(s)) return false;
                                            if (i.dismissal_reason) return false;
                                            const lastActivity = i.last_activity_at ? new Date(i.last_activity_at) : new Date(i.created_at);
                                            return lastActivity < thirtyDaysAgo;
                                        }).length;

                                        const categories = [
                                            { id: 'all', label: 'All Salvage', count: cancelledCount + closedCount + dismissedCount + coldCount, icon: Archive, color: 'slate' },
                                            { id: 'cancelled', label: 'Cancelled', count: cancelledCount, icon: CalendarX2, color: 'red' },
                                            { id: 'closed', label: 'Closed', count: closedCount, icon: XCircle, color: 'amber' },
                                            { id: 'dismissed', label: 'Dismissed', count: dismissedCount, icon: Ban, color: 'rose' },
                                            { id: 'cold', label: 'Cold', count: coldCount, icon: Snowflake, color: 'blue' },
                                        ];

                                        return categories.map(cat => {
                                            const hotCount = inquiries.filter(i => {
                                                // Re-use category logic to verify it belongs here
                                                let inCategory = false;
                                                const s = (i.status || '').toLowerCase();
                                                if (cat.id === 'all') {
                                                    const isCancelled = s === 'cancelled' && !i.dismissal_reason;
                                                    const isClosed = s === 'closed' && !i.dismissal_reason;
                                                    const isDismissed = i.dismissal_reason || s === 'dismissed';
                                                    const isCold = !['closed', 'converted', 'dismissed'].includes(s) && !i.dismissal_reason && (i.last_activity_at ? new Date(i.last_activity_at) : new Date(i.created_at)) < thirtyDaysAgo;
                                                    inCategory = isCancelled || isClosed || isDismissed || isCold;
                                                } else if (cat.id === 'cancelled') inCategory = s === 'cancelled' && !i.dismissal_reason;
                                                else if (cat.id === 'closed') inCategory = s === 'closed' && !i.dismissal_reason;
                                                else if (cat.id === 'dismissed') inCategory = i.dismissal_reason || s === 'dismissed';
                                                else if (cat.id === 'cold') {
                                                    inCategory = !['closed', 'converted', 'dismissed'].includes(s) && !i.dismissal_reason && (i.last_activity_at ? new Date(i.last_activity_at) : new Date(i.created_at)) < thirtyDaysAgo;
                                                }
                                                return inCategory && isHotLead(i);
                                            }).length;

                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setSalvageFilter(cat.id)}
                                                    className={`px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all flex items-center gap-1 border ${salvageFilter === cat.id
                                                        ? (cat.id === 'all' ? 'bg-slate-800 text-white border-slate-800' : `bg-${cat.color}-600 text-white border-${cat.color}-600`)
                                                        : `bg-white text-slate-500 border-slate-200 hover:border-${cat.color}-300`
                                                        }`}
                                                >
                                                    <cat.icon className="w-3 h-3" />
                                                    {cat.label}
                                                    <span className={`ml-1 px-1 py-0.5 rounded text-[8px] flex items-center gap-1 ${hotCount > 0
                                                        ? 'bg-orange-500 text-white animate-pulse'
                                                        : (salvageFilter === cat.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600')
                                                        }`}>
                                                        {cat.count}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search leads..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 transition-all text-xs font-medium outline-none"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                                Loading inquiries...
                            </div>
                        ) : error ? (
                            <div className="p-12 text-center text-red-500">
                                <XCircle className="w-8 h-8 mx-auto mb-3" />
                                <div className="font-medium mb-2">Error loading inquiries</div>
                                <p className="text-sm text-slate-500">{error}</p>
                                <button
                                    onClick={fetchInquiries}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : filteredInquiries.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <div className="font-medium">No inquiries yet</div>
                                <p className="text-sm mt-1">New leads will appear here when someone submits a form</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto bg-white">
                                {(() => {
                                    const categoryMap = {
                                        pending: ['new', 'contacted', 'pending_verification', 'verified', 'pending'],
                                        pipeline: ['demo_scheduled', 'follow_up'],
                                        converted: ['converted'],
                                        closed: ['closed']
                                    };

                                    const displayItems = filteredInquiries.filter(i => {

                                        const s = (i.status || 'new').toLowerCase().trim();
                                        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

                                        // 0. Salvage logic (Dedicated View)
                                        if (viewMode === 'salvage') {
                                            // Determine which sub-category this lead falls into
                                            const isCancelledStatus = s === 'cancelled' && !i.dismissal_reason;
                                            const isClosedStatus = s === 'closed' && !i.dismissal_reason;
                                            const isManuallyDismissed = i.dismissal_reason || s === 'dismissed';
                                            const isColdLead = !['closed', 'converted', 'dismissed'].includes(s) && !i.dismissal_reason && (i.last_activity_at ? new Date(i.last_activity_at) : new Date(i.created_at)) < thirtyDaysAgo;

                                            if (salvageFilter === 'all') return isCancelledStatus || isClosedStatus || isManuallyDismissed || isColdLead;
                                            if (salvageFilter === 'cancelled') return isCancelledStatus;
                                            if (salvageFilter === 'closed') return isClosedStatus;
                                            if (salvageFilter === 'dismissed') return isManuallyDismissed;
                                            if (salvageFilter === 'cold') return isColdLead;
                                            return false;
                                        }

                                        // 1. Exclude Salvage leads from non-salvage views
                                        if (i.dismissal_reason || s === 'dismissed') return false;

                                        // 2. View Mode Filter
                                        if (viewMode === 'pool' && i.is_claimed) return false;
                                        if (viewMode === 'master' && !isAdmin) {
                                            if (i.claimed_by !== currentUser?.id && i.seller_id !== currentUser?.id) return false;
                                        }
                                        if (viewMode === 'personal') {
                                            if (!i.is_claimed) return false;
                                            if (isAdmin) {
                                                if (pipelineUserFilter === 'mine' && i.claimed_by !== currentUser?.id) return false;
                                                if (pipelineUserFilter !== 'all' && pipelineUserFilter !== 'mine' && i.claimed_by != pipelineUserFilter) return false;
                                            } else {
                                                if (i.claimed_by !== currentUser?.id) return false;
                                            }
                                        }

                                        // 3. Status Category Filter
                                        if (!statusFilter) return true; // All

                                        // Lead Pool filters
                                        if (statusFilter === 'verified') return s === 'verified';
                                        if (statusFilter === 'unverified') {
                                            return s !== 'verified' && !['demo_scheduled', 'follow_up', 'converted', 'closed', 'contacted'].includes(s);
                                        }

                                        if (statusFilter === 'new') {
                                            return !['demo_scheduled', 'follow_up', 'converted', 'closed', 'contacted'].includes(s);
                                        }
                                        if (statusFilter === 'contacted') {
                                            return ['contacted', 'follow_up'].includes(s);
                                        }
                                        if (statusFilter === 'closed') {
                                            return s === 'closed';
                                        }
                                        return s === statusFilter;
                                    });


                                    if (displayItems.length === 0) {
                                        return (
                                            <div className="p-12 text-center text-slate-400">
                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Inbox className="w-6 h-6 text-slate-200" />
                                                </div>
                                                <p className="text-xs font-bold uppercase tracking-wider">No leads in this category</p>
                                            </div>
                                        );
                                    }

                                    // Priority-based sorting for "ALL" view
                                    // Order: New → Discussions/Follow-up → Demo → Converted → Closed
                                    const getStatusPriority = (status) => {
                                        const s = (status || 'new').toLowerCase().trim();
                                        if (['new', 'pending', 'pending_verification', 'verified'].includes(s)) return 1;
                                        if (['contacted', 'follow_up'].includes(s)) return 2;
                                        if (s === 'demo_scheduled') return 3;
                                        if (s === 'converted') return 4;
                                        if (s === 'closed') return 5;
                                        return 3; // Default to middle priority for unknown statuses
                                    };



                                    const sortedItems = [...displayItems].sort((a, b) => {
                                        // Hot leads ALWAYS float to the top
                                        const aHot = isHotLead(a);
                                        const bHot = isHotLead(b);
                                        if (aHot && !bHot) return -1;
                                        if (!aHot && bHot) return 1;

                                        // If neither or both are hot, apply status priority (only in ALL view)
                                        if (!statusFilter) {
                                            const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
                                            if (priorityDiff !== 0) return priorityDiff;
                                        }

                                        // Within same priority, sort by most recent activity
                                        return new Date(b.last_activity_at || b.created_at) - new Date(a.last_activity_at || a.created_at);
                                    });

                                    return (
                                        <div className="divide-y divide-slate-50">
                                            {sortedItems.map((inquiry) => {
                                                const isHot = isHotLead(inquiry);
                                                return (
                                                    <div
                                                        key={inquiry.id}
                                                        onClick={() => handleSelectInquiry(inquiry)}
                                                        className={`px-3 py-2 cursor-pointer transition-all border-l-4 flex items-center gap-3 ${selectedInquiry?.id === inquiry.id
                                                            ? 'bg-blue-50/60 border-l-blue-500'
                                                            : isHot
                                                                ? 'border-l-orange-500 bg-gradient-to-r from-orange-50 to-amber-50/50 hover:from-orange-100 hover:to-amber-100/50 animate-pulse'
                                                                : 'border-l-transparent hover:bg-slate-50/80'
                                                            }`}
                                                    >
                                                        {/* Name + Status */}
                                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                                            {/* Hot indicator dot */}
                                                            {isHot && (
                                                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping flex-shrink-0" title="Active now!" />
                                                            )}
                                                            <h3 className={`text-[13px] font-bold truncate ${isHot ? 'text-orange-700' : 'text-slate-800'}`}>{inquiry.name}</h3>
                                                            <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0 ${getStatusColor(inquiry.status)}`}>
                                                                {inquiry.status?.replace('_', ' ') || 'new'}
                                                            </span>
                                                            {inquiry.is_claimed && (
                                                                <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                                            )}
                                                            {inquiry.last_activity_at && (new Date(inquiry.last_activity_at) - new Date(inquiry.created_at) > 1000 * 60 * 5) && !isHot && (
                                                                <span className="text-[7px] px-1 py-0.5 rounded font-bold uppercase bg-rose-100 text-rose-500 flex-shrink-0">
                                                                    Return
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Practice/Email */}
                                                        <div className="hidden lg:block text-[10px] text-slate-400 truncate max-w-[120px]">
                                                            {inquiry.practice_name || inquiry.email}
                                                        </div>

                                                        {/* Referral */}
                                                        {(inquiry.referral_code || inquiry.referral_token) && (
                                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[7px] uppercase flex-shrink-0 flex items-center gap-1">
                                                                <Gift className="w-2 h-2" />
                                                                {inquiry.referrer_name ? inquiry.referrer_name.split(' ')[0] : 'REF'}
                                                            </span>
                                                        )}

                                                        {/* Date + Unread */}
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <span className="text-[9px] text-slate-300 font-medium">
                                                                {inquiry.created_at ? format(new Date(inquiry.created_at), 'M/d') : '-'}
                                                            </span>
                                                            {parseInt(inquiry.unread_count || 0) > 0 && (
                                                                <span className="w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
                                                                    {inquiry.unread_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col h-full shadow-sm">
                        {viewMode === 'master' ? (
                            <div className="flex flex-col h-full bg-slate-50/30 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                                            {(currentUser?.role === 'sales_manager' || currentUser?.username === 'admin')
                                                ? (scheduleFilter === 'all' ? 'Team Schedule' : 'My Schedule')
                                                : 'My Schedule'}
                                        </h2>
                                        <p className="text-xs text-slate-400 font-medium">
                                            {(currentUser?.role === 'sales_manager' || currentUser?.username === 'admin') && scheduleFilter === 'all'
                                                ? 'Control tower view of all upcoming team demos'
                                                : 'Your personal demo schedule and availability'
                                            }
                                        </p>
                                    </div>
                                    {(currentUser?.role === 'sales_manager' || currentUser?.username === 'admin') && (
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
                                            <button
                                                onClick={() => setScheduleFilter('all')}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${scheduleFilter === 'all'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                Team
                                            </button>
                                            <button
                                                onClick={() => setScheduleFilter('mine')}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${scheduleFilter === 'mine'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                My Demos
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 flex overflow-hidden">
                                    {/* Left Side: Calendar Grid */}
                                    <div className="w-[320px] bg-white border-r border-slate-100 flex flex-col shrink-0">
                                        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700">
                                                {format(currentMonth, 'MMMM yyyy')}
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"
                                                >
                                                    <ChevronDown className="w-4 h-4 rotate-90" />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-inner shrink-0">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                                <div key={day} className="bg-slate-50 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{day}</div>
                                            ))}
                                            {(() => {
                                                const start = startOfWeek(startOfMonth(currentMonth));
                                                const end = endOfWeek(endOfMonth(currentMonth));
                                                return eachDayOfInterval({ start, end }).map(day => {
                                                    const isSelected = isSameDay(day, selectedDate);
                                                    const isTodayDate = isToday(day);
                                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                                    const hasDemos = masterDemos.some(d =>
                                                        isSameDay(parseISO(d.scheduled_at), day) &&
                                                        (scheduleFilter === 'all' || d.seller_id === currentUser?.id) &&
                                                        d.status === 'scheduled' // ONLY show active/scheduled demos
                                                    );

                                                    return (
                                                        <button
                                                            key={day.toString()}
                                                            onClick={() => setSelectedDate(day)}
                                                            className={`
                                                                relative h-12 flex flex-col items-center justify-center bg-white text-[12px] font-bold transition-all
                                                                ${!isCurrentMonth ? 'text-slate-200' : 'text-slate-600'}
                                                                ${isSelected ? '!bg-blue-600 !text-white z-10 shadow-lg scale-[1.05] rounded-lg' : 'hover:bg-blue-50/50'}
                                                            `}
                                                        >
                                                            <span>{format(day, 'd')}</span>
                                                            {hasDemos && !isSelected && (
                                                                <div className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${isCurrentMonth ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                                            )}
                                                            {isTodayDate && !isSelected && (
                                                                <div className="absolute top-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                                            )}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        <div className="mt-auto p-4 bg-slate-50/50 rounded-b-2xl border-t border-slate-100">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Today</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Scheduled Demo</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Daily Schedule */}
                                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                                        <div className="mb-6 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800">
                                                    {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMM do')}
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                    Daily Breakdown
                                                </span>
                                            </div>
                                        </div>

                                        {(() => {
                                            const dayDemos = masterDemos
                                                .filter(d =>
                                                    isSameDay(parseISO(d.scheduled_at), selectedDate) &&
                                                    d.status === 'scheduled' && // ONLY show active/scheduled demos
                                                    (scheduleFilter === 'all' || d.seller_id === currentUser?.id)
                                                )
                                                .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

                                            if (dayDemos.length === 0) {
                                                return (
                                                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                                                            <Calendar className="w-8 h-8 text-slate-200" />
                                                        </div>
                                                        <p className="text-xs font-bold uppercase tracking-widest opacity-50">Availability Open</p>
                                                        <p className="text-[10px] mt-1">No demos scheduled for this date</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-3">
                                                    {dayDemos.map(demo => (
                                                        <div
                                                            key={demo.id}
                                                            onClick={() => setSelectedDemo(demo)}
                                                            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group cursor-pointer active:scale-[0.99]"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                                                                    <Clock className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-bold text-slate-800">{format(parseISO(demo.scheduled_at), 'h:mm a')}</span>
                                                                        <span className="text-xs text-slate-400">•</span>
                                                                        <span className="text-xs font-bold text-slate-600">{demo.lead_name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md">
                                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: demo.calendar_color }} />
                                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{demo.seller_name}</span>
                                                                        </div>
                                                                        {demo.status === 'confirmed' && (
                                                                            <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase">Confirmed</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const inq = inquiries.find(i => i.id === demo.inquiry_id);
                                                                        if (inq) {
                                                                            setSelectedInquiry(inq);
                                                                            setViewMode('personal');
                                                                        }
                                                                    }}
                                                                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                                                                    title="View Details"
                                                                >
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            selectedInquiry ? (
                                <>
                                    {/* Compact Header */}
                                    <div className="px-6 py-4 border-b border-slate-100 bg-white">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h2 className="text-lg font-bold text-slate-800 truncate tracking-tight">{selectedInquiry.name}</h2>
                                                    {selectedInquiry.referral_code && (
                                                        <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50 text-[10px] shadow-sm">
                                                            <Gift className="w-3 h-3" />
                                                            {selectedInquiry.referral_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                                    {selectedInquiry.practice_name && (
                                                        <span className="flex items-center gap-1 min-w-0 bg-slate-50 px-1.5 py-0.5 rounded">
                                                            <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                                            <span className="truncate">{selectedInquiry.practice_name}</span>
                                                        </span>
                                                    )}
                                                    {selectedInquiry.phone && (
                                                        <span className="flex items-center gap-1 min-w-0 bg-slate-50 px-1.5 py-0.5 rounded">
                                                            <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                                            <span className="truncate">{selectedInquiry.phone}</span>
                                                        </span>
                                                    )}
                                                    {selectedInquiry.referrer_name && (
                                                        <span className="flex items-center gap-1 min-w-0 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100/50">
                                                            <UserPlus className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                                            <span className="truncate">Ref: {selectedInquiry.referrer_name}</span>
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1 shrink-0 opacity-70">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        {format(new Date(selectedInquiry.created_at), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="relative group">
                                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 transition-colors group-focus-within:text-blue-500">
                                                        {selectedInquiry.status === 'converted' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Filter className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <select
                                                        value={selectedInquiry.status || 'new'}
                                                        onChange={(e) => {
                                                            const newValue = e.target.value;
                                                            if (newValue === 'closed' || newValue === 'cancelled') {
                                                                setShowDismissModal(true);
                                                                return;
                                                            }
                                                            updateInquiryStatus(selectedInquiry.id, newValue);
                                                        }}
                                                        disabled={updating || selectedInquiry.status === 'converted'}
                                                        className={`appearance-none pl-8 pr-8 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg border cursor-pointer focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm ${selectedInquiry.status === 'converted'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'}`}
                                                    >
                                                        <option value="new">New</option>
                                                        <option value="contacted">Contacted</option>
                                                        <option value="demo_scheduled">Demo Scheduled</option>
                                                        <option value="follow_up">Follow Up</option>
                                                        {selectedInquiry.status === 'converted' && <option value="converted">Converted</option>}
                                                        <option value="closed">Closed / Lost</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions Bar */}
                                        <div className="flex flex-wrap items-center gap-3">
                                            {(selectedInquiry.status === 'closed' || selectedInquiry.status === 'cancelled' || selectedInquiry.dismissal_reason) && (
                                                <button
                                                    onClick={() => {
                                                        const lastDemo = masterDemos.filter(d => d.inquiry_id === selectedInquiry.id).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0];
                                                        // Fix: proper parentheses for ternary - check if there's a previous owner, then set to 'original', else 'pool'
                                                        const hasPreviousOwner = selectedInquiry.claimed_by || lastDemo || selectedInquiry.dismissed_by;
                                                        setRestoreTarget(hasPreviousOwner ? 'original' : 'pool');
                                                        setShowReclaimModal(true);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 group"
                                                >
                                                    <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
                                                    Restore Lead
                                                </button>
                                            )}
                                            {selectedInquiry.status !== 'converted' && selectedInquiry.status !== 'closed' && selectedInquiry.status !== 'cancelled' && !selectedInquiry.dismissal_reason && (
                                                <>
                                                    {selectedInquiry.is_claimed ? (
                                                        <>
                                                            <button
                                                                onClick={() => setShowDemoModal(true)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-all shadow-md shadow-indigo-100 group"
                                                            >
                                                                <CalendarCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                Schedule Demo
                                                            </button>
                                                            <button
                                                                onClick={() => openOnboardModal(selectedInquiry)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 group"
                                                            >
                                                                <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                Onboard Lead
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleClaimLead(selectedInquiry.id)}
                                                            disabled={claimLoading}
                                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 group animate-in fade-in slide-in-from-bottom-2 duration-300"
                                                        >
                                                            {claimLoading ? (
                                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Lock className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                                    Claim Lead & Start Selling
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {selectedInquiry.status === 'converted' && (
                                                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Onboarded
                                                </div>
                                            )}

                                            {/* Reclaim button for dismissed/salvage leads */}
                                            {(selectedInquiry.status === 'dismissed' || selectedInquiry.dismissal_reason) && (
                                                <div className="flex gap-2 flex-1">
                                                    <button
                                                        onClick={() => setShowReclaimModal(true)}
                                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-md group"
                                                    >
                                                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                                        Send to Lead Pool
                                                    </button>
                                                    {(currentUser?.role === 'sales_manager' || currentUser?.username === 'admin') && (
                                                        <button
                                                            onClick={handleDeleteLead}
                                                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all shadow-md flex items-center gap-2"
                                                            title="Permanent Delete (Dead Lead)"
                                                        >
                                                            <XOctagon className="w-4 h-4" />
                                                            Dead Lead
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 ml-auto">
                                                {/* Dismiss button - only for unclaimed pool leads or owned leads */}
                                                {!selectedInquiry.is_claimed && selectedInquiry.status !== 'dismissed' && selectedInquiry.status !== 'converted' && (
                                                    <button
                                                        onClick={() => setShowDismissModal(true)}
                                                        className="p-2 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-100 transition-all shadow-sm"
                                                        title="Dismiss Lead"
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <a href={`mailto:${selectedInquiry.email}`} className="p-2 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-all shadow-sm" title={selectedInquiry.email}>
                                                    <Mail className="w-4 h-4" />
                                                </a>
                                                {selectedInquiry.phone && (
                                                    <a href={`tel:${selectedInquiry.phone}`} className="p-2 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-all shadow-sm" title={selectedInquiry.phone}>
                                                        <Phone className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Split Two-Column Layout */}
                                    <div className="flex-1 flex overflow-hidden bg-slate-50/50">

                                        {/* Column 1: Phone-Style Chat (Slimmer) */}
                                        <div className="w-[55%] flex flex-col border-r border-slate-200 bg-white h-full shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)] z-10">

                                            {/* Chat Header & Filters */}
                                            <div className="p-3 border-b border-slate-100 bg-white/95 backdrop-blur z-20 flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Chat</span>
                                                </div>
                                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                                    {[
                                                        { id: 'all', icon: History },
                                                        { id: 'user', icon: User },
                                                        { id: 'team', icon: Shield }
                                                    ].map((f) => (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => setLogFilter(f.id)}
                                                            className={`p-1.5 rounded-md transition-all ${logFilter === f.id
                                                                ? 'bg-white text-blue-600 shadow-sm'
                                                                : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                            title={f.id}
                                                        >
                                                            <f.icon className="w-3.5 h-3.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Scrollable Chat Area */}
                                            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-slate-50 relative">

                                                {/* Initial Inquiry Message Bubble */}
                                                {(logFilter === 'all' || logFilter === 'user') && selectedInquiry.message && (
                                                    <div className="flex flex-col items-start gap-1 max-w-[90%]">
                                                        <div className="flex items-center gap-1.5 px-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{selectedInquiry.name}</span>
                                                        </div>
                                                        <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white border border-slate-100 text-slate-600 text-xs shadow-sm shadow-slate-200/50 leading-relaxed">
                                                            {selectedInquiry.message}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Dynamic Logs */}
                                                {logsLoading ? (
                                                    <div className="flex flex-col items-center justify-center py-10 opacity-50">
                                                        <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mb-2" />
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Loading history...</span>
                                                    </div>
                                                ) : logs.length === 0 && !selectedInquiry.message ? (
                                                    <div className="py-12 text-center opacity-40">
                                                        <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No messages yet</p>
                                                    </div>
                                                ) : (
                                                    logs.filter(log => {
                                                        if (logFilter === 'all') return true;
                                                        const userTypes = ['user_inquiry', 'return_visit', 'demo_attempt', 'demo_response'];
                                                        const teamTypes = ['note', 'demo_scheduled', 'status_change', 'demo_cancelled_seller', 'demo_deleted', 'demo_complete'];
                                                        return logFilter === 'all' ? true : (logFilter === 'user' ? userTypes.includes(log.type) : teamTypes.includes(log.type));
                                                    }).map((log) => {
                                                        const isUser = ['user_inquiry', 'return_visit', 'demo_attempt', 'demo_response'].includes(log.type)
                                                            || (log.type === 'demo_status_change' && (log.metadata?.from === 'email_link' || log.content?.toLowerCase().includes('prospect')));
                                                        const isStatus = log.type === 'status_change';
                                                        const isCancellation = log.type === 'demo_cancelled_seller' || log.type === 'demo_deleted';

                                                        // Render Cancellation Logs as Status Badges
                                                        if (isCancellation) {
                                                            return (
                                                                <div key={log.id} className="flex justify-center py-2">
                                                                    <div className="bg-red-50/50 px-3 py-1 rounded-full border border-red-100 flex items-center gap-2 text-[9px] text-red-400">
                                                                        <span className="font-bold text-red-500">{log.admin_name || 'System'}</span>
                                                                        <span>{log.type === 'demo_deleted' ? 'deleted appointment' : 'cancelled appointment'}</span>
                                                                        <span className="font-bold text-red-600 border-l border-red-200 pl-2 ml-1">
                                                                            {log.content}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (isStatus) {
                                                            return (
                                                                <div key={log.id} className="flex justify-center py-2">
                                                                    <div className="bg-slate-100/50 px-3 py-1 rounded-full border border-slate-100 flex items-center gap-2 text-[9px] text-slate-400">
                                                                        <span className="font-bold text-slate-500">{log.admin_name}</span>
                                                                        <span>changed status to</span>
                                                                        <span className="font-bold uppercase text-blue-500">{log.content?.split('to ')[1] || log.content}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div key={log.id} className={`flex flex-col ${isUser ? 'items-start' : 'items-end'} gap-1 max-w-[90%] ${!isUser && 'ml-auto'}`}>
                                                                <div className={`p-3 rounded-2xl text-xs shadow-sm border ${isUser
                                                                    ? 'bg-white border-slate-100 text-slate-600 rounded-tl-sm'
                                                                    : 'bg-blue-600 border-blue-600 text-white rounded-tr-sm shadow-blue-500/20'
                                                                    }`}>
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="font-bold mb-0.5">{log.content}</div>
                                                                        {log.metadata?.notes && (
                                                                            <div className={`mt-1 pt-1 border-t ${isUser ? 'border-slate-100 text-slate-500' : 'border-blue-500/30 text-blue-50'} italic whitespace-pre-wrap`}>
                                                                                "{log.metadata.notes}"
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 px-1 opacity-60">
                                                                    {log.type === 'demo_scheduled' && <CalendarCheck className="w-3 h-3 text-indigo-500" />}
                                                                    <span className="text-[9px] font-bold text-slate-300 uppercase leading-none">
                                                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                                    </span>
                                                                    {!isUser && log.admin_name && (
                                                                        <span className="text-[9px] font-bold text-blue-400 uppercase leading-none border-l border-slate-200 pl-1.5 ml-0.5">
                                                                            — {log.admin_name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                <div ref={logEndRef} />
                                            </div>

                                            {/* Chat Input Area */}
                                            <div className="p-3 bg-white border-t border-slate-100 shrink-0 relative z-20">
                                                <form onSubmit={handleAddLog} className="relative flex items-end gap-2">
                                                    <textarea
                                                        value={newLogContent}
                                                        onChange={(e) => setNewLogContent(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleAddLog(e);
                                                            }
                                                        }}
                                                        placeholder="Type a message..."
                                                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white resize-none text-[13px] leading-relaxed transition-all placeholder:text-slate-400"
                                                        rows="1"
                                                        style={{ minHeight: '48px', maxHeight: '120px' }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={!newLogContent.trim() || sendingLog}
                                                        className="p-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 disabled:opacity-30 disabled:bg-slate-200 transition-all shadow-md shrink-0 mb-0.5"
                                                    >
                                                        {sendingLog ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    </button>
                                                </form>
                                            </div>
                                        </div>

                                        {/* Column 2: Upcoming Demos List */}
                                        <div className="flex-1 bg-slate-50/50 flex flex-col h-full border-l border-white/50 overflow-hidden">
                                            <div className="p-3 border-b border-slate-100 bg-white/50 backdrop-blur sticky top-0 shrink-0 z-10 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Calendar className="w-4 h-4" />
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Upcoming Demos</h3>
                                                </div>
                                                <button
                                                    onClick={() => setShowDemoModal(true)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="View Full Calendar"
                                                >
                                                    <CalendarDays className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                {(() => {
                                                    // Separate current lead's demo from others
                                                    const upcomingDemosForLead = masterDemos.filter(d =>
                                                        d.inquiry_id === selectedInquiry.id &&
                                                        d.status !== 'declined' &&
                                                        d.status !== 'cancelled' &&
                                                        d.status !== 'completed'
                                                    ).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

                                                    const currentLeadDemo = upcomingDemosForLead[0]; // Priority demo to show at top

                                                    const otherDemos = masterDemos
                                                        .filter(d =>
                                                            new Date(d.scheduled_at) > new Date() &&
                                                            d.status !== 'completed' &&
                                                            d.status !== 'declined' &&
                                                            d.status !== 'cancelled' &&
                                                            !upcomingDemosForLead.some(ud => ud.id === d.id) // Exclude demos already listed for the current lead
                                                        )
                                                        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

                                                    if (!currentLeadDemo && otherDemos.length === 0) {
                                                        return (
                                                            <div className="py-12 text-center opacity-40">
                                                                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No upcoming demos</p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <>
                                                            {/* Current Lead's Demo (Priority) */}
                                                            {currentLeadDemo && (() => {
                                                                const statusColor = currentLeadDemo.status === 'declined' ? 'red' : currentLeadDemo.status === 'confirmed' ? 'emerald' : 'amber';
                                                                const statusLabel = currentLeadDemo.status === 'declined' ? 'Cancelled' : currentLeadDemo.status === 'confirmed' ? 'Confirmed' : 'Pending';
                                                                const bgClass = currentLeadDemo.status === 'declined' ? 'bg-red-50/50 border-red-200' : currentLeadDemo.status === 'confirmed' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200';
                                                                const textClass = currentLeadDemo.status === 'declined' ? 'text-red-700' : currentLeadDemo.status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700';
                                                                const badgeClass = currentLeadDemo.status === 'declined' ? 'bg-red-600' : currentLeadDemo.status === 'confirmed' ? 'bg-emerald-600' : 'bg-amber-500';

                                                                return (
                                                                    <div
                                                                        onClick={() => setSelectedDemo(currentLeadDemo)}
                                                                        className={`${bgClass} p-3 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] relative overflow-hidden mb-4`}
                                                                    >
                                                                        <div className={`absolute top-0 right-0 px-2 py-0.5 ${badgeClass} text-[9px] font-bold text-white rounded-bl-lg uppercase tracking-wider`}>
                                                                            {statusLabel}
                                                                        </div>
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentLeadDemo.calendar_color }} />
                                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{currentLeadDemo.seller_name}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mb-1">
                                                                            <h4 className={`font-bold ${currentLeadDemo.status === 'declined' ? 'text-slate-500 line-through' : 'text-slate-800'} text-sm leading-tight group-hover:text-blue-600 transition-colors`}>
                                                                                {currentLeadDemo.lead_name}
                                                                            </h4>
                                                                            <p className="text-xs text-slate-500 font-medium">{currentLeadDemo.practice_name || 'Individual Practice'}</p>
                                                                        </div>
                                                                        <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${currentLeadDemo.status === 'declined' ? 'border-red-100' : currentLeadDemo.status === 'confirmed' ? 'border-emerald-100' : 'border-amber-100'}`}>
                                                                            <div className={`flex items-center gap-1.5 text-xs font-bold ${textClass}`}>
                                                                                <Calendar className="w-3.5 h-3.5" />
                                                                                {format(parseISO(currentLeadDemo.scheduled_at), 'MMM d')}
                                                                            </div>
                                                                            <div className={`flex items-center gap-1.5 text-xs font-bold ${textClass}`}>
                                                                                <Clock className="w-3.5 h-3.5" />
                                                                                {format(parseISO(currentLeadDemo.scheduled_at), 'h:mm a')}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Divider if both exist */}
                                                            {currentLeadDemo && otherDemos.length > 0 && (
                                                                <div className="flex items-center gap-2 py-2">
                                                                    <div className="h-px bg-slate-200 flex-1"></div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Others</span>
                                                                    <div className="h-px bg-slate-200 flex-1"></div>
                                                                </div>
                                                            )}

                                                            {/* Other Demos */}
                                                            {otherDemos.map((demo) => {
                                                                const statusLabel = demo.status === 'declined' ? 'Cancelled' : demo.status === 'confirmed' ? 'Confirmed' : 'Pending';
                                                                const borderClass = demo.status === 'declined' ? 'border-l-4 border-l-red-400' : demo.status === 'confirmed' ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-amber-400';

                                                                return (
                                                                    <div
                                                                        key={demo.id}
                                                                        onClick={() => setSelectedDemo(demo)}
                                                                        className={`bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] ${borderClass} ${demo.status === 'declined' ? 'opacity-70' : ''}`}
                                                                    >
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${demo.status === 'declined' ? 'bg-red-50 text-red-600' : demo.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                    {statusLabel}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mb-1">
                                                                            <h4 className={`font-bold ${demo.status === 'declined' ? 'text-slate-500 line-through' : 'text-slate-700'} text-sm leading-tight group-hover:text-blue-600 transition-colors`}>
                                                                                {demo.lead_name}
                                                                            </h4>
                                                                            <p className="text-xs text-slate-400">{demo.practice_name || 'Individual Practice'}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                                {format(parseISO(demo.scheduled_at), 'MMM d')}
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                                {format(parseISO(demo.scheduled_at), 'h:mm a')}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 p-20 text-center">
                                    <div className="w-24 h-24 bg-white rounded-[2.5rem] border border-slate-200 flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50 relative">
                                        <Inbox className="w-10 h-10 text-slate-200" />
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full border-4 border-white"></div>
                                    </div>
                                    <h3 className="font-bold text-xl text-slate-800 mb-4 uppercase tracking-tight">Select an Inquiry</h3>
                                    <p className="text-[15px] font-medium text-slate-400 max-w-[320px] leading-relaxed">
                                        Choose a lead from the list to manage their contact details, history, and conversion flow.
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {
                showSettings && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 h-full min-h-screen">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                <h2 className="text-xl font-bold text-slate-800">Settings & Team</h2>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                    <XCircle className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex border-b border-slate-100 shrink-0">
                                <button
                                    onClick={() => setSettingsTab('profile')}
                                    className={`flex-1 py-3 text-sm font-bold tracking-tight ${settingsTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <User className="w-4 h-4" />
                                        My Profile
                                    </div>
                                </button>
                                <button
                                    onClick={() => setSettingsTab('password')}
                                    className={`flex-1 py-3 text-sm font-bold tracking-tight ${settingsTab === 'password' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Key className="w-4 h-4" />
                                        Security
                                    </div>
                                </button>
                                {(currentUser?.username === 'admin' || currentUser?.role === 'sales_manager') && (
                                    <button
                                        onClick={() => setSettingsTab('users')}
                                        className={`flex-1 py-3 text-sm font-bold tracking-tight ${settingsTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Users className="w-4 h-4" />
                                            Team
                                        </div>
                                    </button>
                                )}
                            </div>

                            <div className="p-6 overflow-y-auto">
                                {settingsTab === 'profile' && (
                                    <form onSubmit={handleProfileUpdate} className="max-w-md mx-auto space-y-6">
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                                    <Video className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-900">Meeting Preferences</h4>
                                                    <p className="text-xs text-blue-700/70 mt-0.5 leading-relaxed">
                                                        Set your personal Jitsi or Zoom link here. If left blank, PageMD will generate a secure, one-time Jitsi room for every demo.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={profileForm.email}
                                                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-medium"
                                                    placeholder="your@email.com"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Personal Meeting Link (Optional)</label>
                                                <input
                                                    type="url"
                                                    value={profileForm.meetingLink}
                                                    onChange={(e) => setProfileForm({ ...profileForm, meetingLink: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-medium"
                                                    placeholder="https://meet.jit.si/your-name"
                                                />
                                            </div>
                                        </div>

                                        {profileMsg.text && (
                                            <div className={`text-xs font-bold p-4 rounded-xl flex items-center gap-2 ${profileMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                {profileMsg.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                                {profileMsg.text}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={profileLoading}
                                            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                                        >
                                            {profileLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                            Save Profile Changes
                                        </button>
                                    </form>
                                )}
                                {settingsTab === 'password' && (
                                    <form onSubmit={handleChangePassword} className="max-w-md mx-auto space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                            <input
                                                type="password"
                                                value={passForm.current}
                                                onChange={(e) => setPassForm({ ...passForm, current: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                            <input
                                                type="password"
                                                value={passForm.new}
                                                onChange={(e) => setPassForm({ ...passForm, new: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                                required
                                                minLength={8}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                            <input
                                                type="password"
                                                value={passForm.confirm}
                                                onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                                required
                                            />
                                        </div>

                                        {passMsg.text && (
                                            <div className={`text-sm p-3 rounded-lg ${passMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {passMsg.text}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                                        >
                                            Update Password
                                        </button>
                                    </form>
                                )}
                                {settingsTab === 'users' && (
                                    <div className="space-y-8">
                                        {/* Create User */}
                                        <div className="bg-slate-50 p-5 rounded-xl">
                                            <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                                                <UserPlus className="w-4 h-4" />
                                                Add New Team Member
                                            </h3>
                                            <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2 sm:col-span-1">
                                                    <input
                                                        type="text"
                                                        placeholder="Username"
                                                        value={userForm.username}
                                                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-2 sm:col-span-1">
                                                    <input
                                                        type="email"
                                                        placeholder="Email"
                                                        value={userForm.email}
                                                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2 mb-2">
                                                        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                                                        <p>An invitation will be sent to this email address to set up their password securely.</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <button
                                                        type="submit"
                                                        className="w-full py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 text-sm"
                                                    >
                                                        Create User & Send Invite
                                                    </button>
                                                </div>
                                                {userMsg.text && (
                                                    <div className={`col-span-2 text-sm p-2 rounded ${userMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {userMsg.text}
                                                    </div>
                                                )}
                                            </form>
                                        </div>

                                        {/* User List */}
                                        <div>
                                            <h3 className="font-medium text-slate-800 mb-4 text-sm uppercase tracking-wider text-slate-500">
                                                Existing Users
                                            </h3>
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="divide-y divide-slate-100">
                                                    {teamUsers.map(user => (
                                                        <div key={user.id} className="p-4 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                                    {user.username.substring(0, 2)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-slate-800">{user.username}</div>
                                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                                Last login: {user.last_login ? format(new Date(user.last_login), 'MMM d, h:mm a') : 'Never'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Onboard Clinic Modal */}
            {
                showOnboardModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 relative my-8 border border-slate-100">
                            <button
                                onClick={() => setShowOnboardModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                    <Database className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Onboard New Clinic</h2>
                                    <p className="text-slate-500 text-sm">
                                        {selectedInquiry?.referral_code
                                            ? `This will activate referral credit for code: ${selectedInquiry.referral_code}`
                                            : 'Create a new clinic with dedicated database'
                                        }
                                    </p>
                                </div>
                            </div>

                            {onboardError && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                                    {onboardError}
                                </div>
                            )}

                            <form onSubmit={handleOnboard} className="space-y-6">
                                {/* Clinic Details */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Building2 className="w-4 h-4" /> Clinic Details
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Heart Center of Nevada"
                                                value={onboardForm.displayName}
                                                onChange={e => setOnboardForm({ ...onboardForm, displayName: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Slug (Subdomain)</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. heart-center-nv"
                                                value={onboardForm.slug}
                                                onChange={e => setOnboardForm({
                                                    ...onboardForm,
                                                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                                })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Unique URL identifier</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Specialty</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Cardiology"
                                                value={onboardForm.specialty}
                                                onChange={e => setOnboardForm({ ...onboardForm, specialty: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Initial Admin User */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Shield className="w-4 h-4" /> Initial Admin User
                                    </h3>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={onboardForm.adminFirstName}
                                                    onChange={e => setOnboardForm({ ...onboardForm, adminFirstName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={onboardForm.adminLastName}
                                                    onChange={e => setOnboardForm({ ...onboardForm, adminLastName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admin Email</label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="admin@clinic.com"
                                                value={onboardForm.adminEmail}
                                                onChange={e => setOnboardForm({ ...onboardForm, adminEmail: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            />
                                        </div>

                                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800 flex items-start gap-3">
                                            <Shield className="w-5 h-5 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-semibold">Secure Invitation Flow</p>
                                                <p className="text-emerald-700/80">The clinic admin will receive a secure email invitation to set up their own password. This ensures compliance and security.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={onboardLoading}
                                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {onboardLoading ? (
                                            <><RefreshCw className="w-5 h-5 animate-spin" /> Provisioning...</>
                                        ) : (
                                            <>
                                                <Database className="w-5 h-5" />
                                                {selectedInquiry?.referral_code ? 'Create Clinic & Activate Referral' : 'Create Clinic'}
                                            </>
                                        )}
                                    </button>
                                    <p className="text-center text-[10px] text-slate-400 mt-3">
                                        This will create a new dedicated database schema and initial admin account.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Status Change Modal */}
            {
                showStatusModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 relative border border-slate-100">
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setPendingStatus(null);
                                    setStatusNote('');
                                }}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-5">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingStatus === 'closed' ? 'bg-red-100' : 'bg-blue-100'
                                    }`}>
                                    {pendingStatus === 'contacted' && <Phone className="w-5 h-5 text-blue-600" />}
                                    {pendingStatus === 'demo_scheduled' && <Calendar className="w-5 h-5 text-blue-600" />}
                                    {pendingStatus === 'follow_up' && <RefreshCw className="w-5 h-5 text-blue-600" />}
                                    {pendingStatus === 'closed' && <XCircle className="w-5 h-5 text-red-600" />}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {pendingStatus === 'contacted' && 'Log Contact'}
                                        {pendingStatus === 'demo_scheduled' && 'Schedule Demo'}
                                        {pendingStatus === 'follow_up' && 'Set Follow Up'}
                                        {pendingStatus === 'closed' && 'Close Inquiry'}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {selectedInquiry?.name} • {selectedInquiry?.email}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {pendingStatus === 'contacted' && 'Contact Notes *'}
                                    {pendingStatus === 'demo_scheduled' && 'Demo Details *'}
                                    {pendingStatus === 'follow_up' && 'Follow Up Notes *'}
                                    {pendingStatus === 'closed' && 'Reason for Closing *'}
                                </label>
                                <textarea
                                    value={statusNote}
                                    onChange={(e) => setStatusNote(e.target.value)}
                                    placeholder={getStatusNotePlaceholder(pendingStatus)}
                                    rows={5}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all resize-none"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowStatusModal(false);
                                        setPendingStatus(null);
                                        setStatusNote('');
                                    }}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitStatusChange}
                                    disabled={statusNoteLoading || !statusNote.trim()}
                                    className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${pendingStatus === 'closed'
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    {statusNoteLoading ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Save & Update Status
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Dismiss Lead Modal */}
            {showDismissModal && selectedInquiry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-amber-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">Dismiss Lead</h3>
                                        <p className="text-xs text-slate-500">{selectedInquiry.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowDismissModal(false);
                                        setDismissReason('');
                                        setDismissNotes('');
                                    }}
                                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'not_interested', label: 'Not Interested', icon: UserMinus, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                                    { id: 'bad_timing', label: 'Bad Timing', icon: Timer, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
                                    { id: 'budget', label: 'Budget', icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
                                    { id: 'spam', label: 'Spam/Fake', icon: Ban, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
                                    { id: 'competitor', label: 'Competitor', icon: Building2, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                                    { id: 'other', label: 'Other', icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setDismissReason(opt.id)}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${dismissReason === opt.id
                                            ? `${opt.bg} ${opt.border} ring-2 ring-rose-500/20 shadow-sm`
                                            : 'bg-white border-slate-50 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${dismissReason === opt.id ? 'bg-white' : 'bg-slate-50'}`}>
                                            <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                                        </div>
                                        <span className={`text-[12px] font-bold ${dismissReason === opt.id ? 'text-slate-800' : 'text-slate-500'}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Notes *
                                </label>
                                <textarea
                                    value={dismissNotes}
                                    onChange={(e) => setDismissNotes(e.target.value)}
                                    placeholder="Quick note on why..."
                                    rows={2}
                                    className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all ${dismissNotes.length === 0
                                        ? 'border-amber-300 bg-amber-50/50'
                                        : 'border-slate-200'
                                        }`}
                                />

                            </div>

                            {/* Badge showing if verified or not */}
                            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${selectedInquiry.email_verified || selectedInquiry.status === 'verified'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {selectedInquiry.email_verified || selectedInquiry.status === 'verified' ? '✓ Verified' : '⚠ Unverified'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    This lead will be moved to Salvage for potential recovery
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDismissModal(false);
                                    setDismissReason('');
                                    setDismissNotes('');
                                }}
                                className="flex-1 py-3 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDismissLead}
                                disabled={dismissLoading || !dismissReason || dismissNotes.length < 1}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {dismissLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Ban className="w-4 h-4" />
                                        Dismiss Lead
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reclaim Reason Modal */}
            {showReclaimModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl">
                                    <RefreshCw className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Restore Lead</h3>
                                    <p className="text-xs text-emerald-600 font-medium tracking-tight">Recovering lead from salvage</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowReclaimModal(false); setRestoreTarget('pool'); setRestoreSellerId(''); }} className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-emerald-600 shrink-0" />
                                <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                                    Document the reason for restoring this lead so the next owner has context.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Restoration Target</label>
                                <div className="space-y-2">
                                    {[
                                        { id: 'pool', label: 'Return to Lead Pool', desc: 'Allows anyone to claim' },
                                        {
                                            id: 'original', label: 'Return to Previous Owner', desc: (() => {
                                                const lastDemo = masterDemos.filter(d => d.inquiry_id === selectedInquiry.id).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0];
                                                const owner = selectedInquiry.claimed_by
                                                    ? teamUsers.find(u => u.id === selectedInquiry.claimed_by)?.username
                                                    : (lastDemo?.seller_name || (selectedInquiry.dismissed_by ? teamUsers.find(u => u.id === selectedInquiry.dismissed_by)?.username : null));
                                                return owner ? `Assign back to ${owner}` : 'Not available';
                                            })()
                                        },
                                        { id: 'assign', label: 'Assign to Specific Seller', desc: 'Pick a team member' }
                                    ].map(opt => {
                                        const isDisabled = opt.id === 'original' && !selectedInquiry.claimed_by && !masterDemos.some(d => d.inquiry_id === selectedInquiry.id) && !selectedInquiry.dismissed_by;
                                        return (
                                            <button
                                                key={opt.id}
                                                disabled={isDisabled}
                                                onClick={() => setRestoreTarget(opt.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : ''} ${restoreTarget === opt.id
                                                    ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10'
                                                    : 'bg-white border-slate-100 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${restoreTarget === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200'}`}>
                                                    {restoreTarget === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                                <div>
                                                    <div className={`text-xs font-bold ${restoreTarget === opt.id ? 'text-emerald-900' : 'text-slate-700'}`}>{opt.label}</div>
                                                    <div className="text-[10px] text-slate-400">{opt.desc}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {restoreTarget === 'assign' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Select Team Member</label>
                                    <select
                                        value={restoreSellerId}
                                        onChange={(e) => setRestoreSellerId(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold text-sm"
                                    >
                                        <option value="">Choose seller...</option>
                                        {teamUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Contextual Internal Note *
                                </label>
                                <textarea
                                    value={reclaimNotes}
                                    onChange={(e) => setReclaimNotes(e.target.value)}
                                    placeholder="Explain why this lead is being remanaged..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all resize-none font-medium text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReclaimModal(false);
                                    setRestoreTarget('pool');
                                    setRestoreSellerId('');
                                }}
                                className="flex-1 py-3 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 border border-slate-200 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReclaimLead}
                                disabled={reclaimLoading || !reclaimNotes.trim() || (restoreTarget === 'assign' && !restoreSellerId)}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                            >
                                {reclaimLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Database className="w-4 h-4" />
                                        Complete Restoration
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Demo Schedule Modal */}
            {
                showDemoModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col md:flex-row h-[600px]">
                            {/* Interactive Calendar Side */}
                            <div className="w-full md:w-1/2 border-r border-slate-100 bg-slate-50/50 p-6 flex flex-col">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-700">{format(demoModalMonth, 'MMMM yyyy')}</h3>
                                    <div className="flex gap-1">
                                        <button onClick={() => setDemoModalMonth(subMonths(demoModalMonth, 1))} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setDemoModalMonth(addMonths(demoModalMonth, 1))} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-inner shrink-0 mb-6 bg-white">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                        <div key={day} className="bg-slate-50 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{day}</div>
                                    ))}
                                    {(() => {
                                        const start = startOfWeek(startOfMonth(demoModalMonth));
                                        const end = endOfWeek(endOfMonth(demoModalMonth));
                                        return eachDayOfInterval({ start, end }).map(day => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const isSelected = demoForm.date === dateStr;
                                            const isTodayDate = isToday(day);
                                            const isCurrentMonth = isSameMonth(day, demoModalMonth);

                                            // Check for conflicts
                                            const dayDemos = masterDemos.filter(d => isSameDay(parseISO(d.scheduled_at), day));
                                            const hasDemos = dayDemos.length > 0;

                                            // Detailed conflict check? (maybe later)

                                            return (
                                                <button
                                                    key={day.toString()}
                                                    type="button"
                                                    onClick={() => setDemoForm({ ...demoForm, date: dateStr })}
                                                    className={`
                                                    relative h-12 flex flex-col items-center justify-center bg-white text-[12px] font-bold transition-all
                                                    ${!isCurrentMonth ? 'text-slate-200' : 'text-slate-600'}
                                                    ${isSelected ? '!bg-blue-600 !text-white z-10 shadow-lg scale-[1.05] rounded-lg' : 'hover:bg-blue-50/50'}
                                                `}
                                                >
                                                    <span>{format(day, 'd')}</span>
                                                    {hasDemos && !isSelected && (
                                                        <div className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${isCurrentMonth ? 'bg-blue-300' : 'bg-slate-300'}`} />
                                                    )}
                                                    {isTodayDate && !isSelected && (
                                                        <div className="absolute top-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                                    )}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                        {demoForm.date ? `Schedule for ${format(parseISO(demoForm.date), 'MMM do')}` : 'Select a date'}
                                    </h4>
                                    {demoForm.date ? (
                                        <div className="space-y-2">
                                            {masterDemos.filter(d => isSameDay(parseISO(d.scheduled_at), parseISO(demoForm.date))).length > 0 ? (
                                                masterDemos
                                                    .filter(d => isSameDay(parseISO(d.scheduled_at), parseISO(demoForm.date)))
                                                    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                                                    .map(demo => {
                                                        const isCancelled = demo.status === 'declined';
                                                        const isConfirmed = demo.status === 'confirmed';

                                                        // Status Color Logic
                                                        let barColor = '#f59e0b'; // Default/Pending (Amber)
                                                        if (isConfirmed) barColor = '#10b981'; // Emerald
                                                        if (isCancelled) barColor = '#ef4444'; // Red

                                                        return (
                                                            <div key={demo.id} className={`p-3 bg-white border border-slate-100 rounded-xl flex items-center gap-3 ${isCancelled ? 'opacity-60 bg-slate-50' : ''}`}>
                                                                <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                                                                <div className="min-w-0">
                                                                    <div className={`text-xs font-bold ${isCancelled ? 'text-slate-400 line-through decoration-slate-400' : 'text-slate-700'} flex items-center gap-2`}>
                                                                        {format(parseISO(demo.scheduled_at), 'h:mm a')}
                                                                        {isCancelled && (
                                                                            <span className="text-[9px] font-bold text-red-500 uppercase no-underline bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                                                                Cancelled
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 truncate">
                                                                        {demo.seller_name} w/ {demo.lead_name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                                                    No existing demos. Day is wide open.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-slate-400 text-xs italic">
                                            Click a date on the calendar to check availability.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Form Side */}
                            <div className="w-full md:w-1/2 flex flex-col h-full">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                                    <h3 className="text-lg font-bold text-slate-800">Schedule Demo</h3>
                                    <button onClick={() => setShowDemoModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleScheduleDemo} className="p-6 flex-1 flex flex-col overflow-y-auto">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6 shrink-0">
                                        <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                            <strong>Invite Notification:</strong> Scheduling this demo will automatically send a calendar invitation and email reminder to <strong>{selectedInquiry?.email}</strong>.
                                        </p>
                                    </div>

                                    <div className="space-y-5 flex-1">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={demoForm.date}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    onChange={(e) => setDemoForm({ ...demoForm, date: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                                                <input
                                                    type="time"
                                                    required
                                                    value={demoForm.time}
                                                    onChange={(e) => setDemoForm({ ...demoForm, time: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Additional Notes / Agenda</label>
                                            <textarea
                                                rows="4"
                                                value={demoForm.notes}
                                                onChange={(e) => setDemoForm({ ...demoForm, notes: e.target.value })}
                                                placeholder="e.g. Focus on billing integration..."
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 flex gap-3 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setShowDemoModal(false)}
                                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 hover:text-slate-800 transition-all text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={demoLoading}
                                            className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm flex items-center justify-center gap-2"
                                        >
                                            {demoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                                            Send Invitation
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Appointment Details Modal */}
            {
                selectedDemo && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                                        <Video className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 leading-tight">Appointment Details</h3>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {format(parseISO(selectedDemo.scheduled_at), 'MMMM do, yyyy')} • {format(parseISO(selectedDemo.scheduled_at), 'h:mm a')}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedDemo(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Actions Bar */}
                                {/* Actions Bar */}
                                <div className="flex gap-3">
                                    {selectedDemo.status === 'declined' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDemo(null);
                                                    const inq = inquiries.find(i => i.id === selectedDemo.inquiry_id);
                                                    if (inq) {
                                                        setSelectedInquiry(inq);
                                                        setShowDemoModal(true);
                                                    }
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-200"
                                            >
                                                <Calendar className="w-4 h-4" />
                                                Reschedule
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteDemo(selectedDemo.id, false);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Dismiss
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <a
                                                href={getEnhancedMeetingLink(selectedDemo)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-200"
                                            >
                                                <Video className="w-4 h-4" />
                                                Launch Meeting
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setShowCompleteModal(true)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-100"
                                            >
                                                <CheckSquare className="w-4 h-4" />
                                                Mark Done
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDemo(null);
                                                    const inq = inquiries.find(i => i.id === selectedDemo.inquiry_id);
                                                    if (inq) {
                                                        setSelectedInquiry(inq);
                                                        setViewMode('personal');
                                                    }
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                View Inquiry
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Status Banner */}
                                <div className={`p-4 rounded-xl border flex items-center gap-3 ${selectedDemo.status === 'confirmed'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                                    : selectedDemo.status === 'declined'
                                        ? 'bg-red-50 border-red-100 text-red-800'
                                        : 'bg-amber-50 border-amber-100 text-amber-800'
                                    }`}>
                                    {selectedDemo.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> : selectedDemo.status === 'declined' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-wide">Status: {selectedDemo.status === 'declined' ? 'Cancelled' : selectedDemo.status || 'Pending'}</p>
                                        <p className="text-xs opacity-80">
                                            {selectedDemo.status === 'confirmed'
                                                ? 'Lead has confirmed via email.'
                                                : selectedDemo.status === 'declined'
                                                    ? 'This appointment was cancelled.'
                                                    : 'Waiting for lead confirmation.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Lead Profile */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Lead Profile</h4>
                                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                                            <div className="font-bold text-slate-700">{selectedDemo.lead_name}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Practice</label>
                                            <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                {selectedDemo.practice_name || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contact</label>
                                            <div className="space-y-1">
                                                <div className="text-sm text-slate-600 flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="truncate max-w-[140px]" title={selectedDemo.lead_email}>{selectedDemo.lead_email}</span>
                                                </div>
                                                {selectedDemo.lead_phone && (
                                                    <div className="text-sm text-slate-600 flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                        {selectedDemo.lead_phone}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Details</label>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">
                                                    {selectedDemo.provider_count || '?'} Providers
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Source: {selectedDemo.source || 'Direct'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Internal Notes */}
                                {selectedDemo.notes && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Meeting Notes</h4>
                                        <div className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl text-sm text-slate-600 italic">
                                            "{selectedDemo.notes}"
                                        </div>
                                    </div>
                                )}

                                {/* Seller Info */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {selectedDemo.seller_name?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-700">{selectedDemo.seller_name}</div>
                                            <div className="text-slate-400">Host</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-300">
                                        ID: {selectedDemo.id}
                                    </div>
                                </div>

                                {/* Cancellation Section */}
                                {selectedDemo.status !== 'cancelled' && selectedDemo.status !== 'declined' && (
                                    <div className="pt-4 border-t border-slate-100">
                                        {!isCancelling ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsCancelling(true)}
                                                className="w-full py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Cancel Appointment
                                            </button>
                                        ) : (
                                            <div className="space-y-3 bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                                                <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest">Reason for Cancellation</h4>
                                                <textarea
                                                    value={cancelReason}
                                                    onChange={(e) => setCancelReason(e.target.value)}
                                                    placeholder="Why is this appointment being cancelled? (Required)"
                                                    className="w-full p-3 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white placeholder:text-red-300 text-red-900"
                                                    rows="3"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setIsCancelling(false); setCancelReason(''); }}
                                                        className="flex-1 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50"
                                                    >
                                                        Keep Appointment
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelDemo(selectedDemo.id)}
                                                        disabled={!cancelReason.trim()}
                                                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm hover:bg-red-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Confirm Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Complete Demo Outcome Modal */}
            {showCompleteModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Complete Appointment</h3>
                                    <p className="text-xs text-emerald-600 font-medium">Document the outcome of the demo</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCompleteModal(false)} className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'undecided', label: 'Undecided', icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
                                    { id: 'asking_time', label: 'Needs Time', icon: Timer, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
                                    { id: 'converted', label: 'Converted', icon: Trophy, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                                    { id: 'budget', label: 'Budget', icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
                                    { id: 'not_interested', label: 'Declined', icon: UserMinus, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setOutcomeCategory(opt.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${outcomeCategory === opt.id
                                            ? `${opt.bg} ${opt.border} ring-2 ring-emerald-500/20`
                                            : 'bg-white border-slate-100 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${outcomeCategory === opt.id ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
                                            <opt.icon className={`w-4 h-4 ${opt.color}`} />
                                        </div>
                                        <span className={`text-[13px] font-bold ${outcomeCategory === opt.id ? 'text-slate-800' : 'text-slate-500'}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Outcome Notes / Next Steps *</label>
                                <textarea
                                    value={outcomeNotes}
                                    onChange={(e) => setOutcomeNotes(e.target.value)}
                                    placeholder="What happened during the demo? What are the next steps?"
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none font-medium"
                                    autoFocus
                                />
                            </div>

                            {outcomeCategory === 'not_interested' && (
                                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                                    <p className="text-[11px] text-rose-700 leading-tight font-medium">
                                        Selecting "Not Interested" will move this lead to Salvage. Recovery team will monitor for return visits or demo usage.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setShowCompleteModal(false)}
                                className="flex-1 py-3 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCompleteDemo}
                                disabled={completeLoading || !outcomeNotes.trim()}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {completeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Finalize Appointment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🎉 Celebration Modal with Confetti */}
            {
                showCelebration && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowCelebration(false)}
                        />

                        {/* Confetti Canvas */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(100)].map((_, i) => {
                                const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
                                const color = colors[i % colors.length];
                                const left = Math.random() * 100;
                                const delay = Math.random() * 3;
                                const duration = 3 + Math.random() * 2;
                                const size = 6 + Math.random() * 8;
                                const rotation = Math.random() * 360;

                                return (
                                    <div
                                        key={i}
                                        className="absolute"
                                        style={{
                                            left: `${left}%`,
                                            top: '-20px',
                                            width: `${size}px`,
                                            height: `${size}px`,
                                            backgroundColor: color,
                                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                            transform: `rotate(${rotation}deg)`,
                                            animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
                                            opacity: 0
                                        }}
                                    />
                                );
                            })}
                        </div>

                        {/* Celebration Card */}
                        <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-4 text-center animate-in zoom-in-95 fade-in duration-500">
                            {/* Trophy Icon with Glow */}
                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-32 h-32 bg-emerald-400/20 rounded-full animate-ping" />
                                </div>
                                <div className="relative flex justify-center">
                                    <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl shadow-xl shadow-emerald-200 animate-bounce">
                                        <Trophy className="w-16 h-16 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Header */}
                            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
                                DEAL CLOSED!
                            </h2>

                            {/* Clinic Name */}
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg px-6 py-3 rounded-2xl shadow-lg mb-4 inline-block">
                                {celebrationData?.clinicName}
                            </div>

                            {/* Message */}
                            <p className="text-slate-600 mb-6">
                                {celebrationData?.message}
                            </p>

                            {/* Referral Bonus */}
                            {celebrationData?.referralActivated && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 animate-in slide-in-from-bottom-2 duration-700">
                                    <div className="flex items-center justify-center gap-2 text-purple-600 font-bold">
                                        <Gift className="w-5 h-5" />
                                        Referral Credit Activated!
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="flex items-center justify-center gap-6 mb-6">
                                <div className="text-center">
                                    <div className="text-2xl font-black text-emerald-600">+1</div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">Conversion</div>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="text-center">
                                    <div className="text-2xl font-black text-blue-600">💰</div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">Commission</div>
                                </div>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowCelebration(false)}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
                            >
                                Keep Crushing It!
                            </button>
                        </div>

                        {/* CSS for confetti animation */}
                        <style>{`
                        @keyframes confetti-fall {
                            0% {
                                opacity: 1;
                                transform: translateY(0) rotate(0deg) scale(1);
                            }
                            100% {
                                opacity: 0;
                                transform: translateY(100vh) rotate(720deg) scale(0.5);
                            }
                        }
                    `}</style>
                    </div>
                )
            }
        </div >
    );
};

export default SalesAdmin;
