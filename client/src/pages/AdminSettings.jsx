/**
 * Admin Settings Page
 * 
 * Comprehensive configuration page for administrators to manage:
 * - Practice Settings
 * - User Management (linked)
 * - System Configuration
 * - Security Settings
 * - Clinical Settings
 * - Email/SMTP Configuration
 * - Feature Flags
 * - Billing Configuration
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Building2, Users, Shield, Stethoscope, Mail,
  ToggleLeft, ToggleRight, Save, Loader2, AlertCircle, AlertTriangle, CheckCircle2, Check,
  DollarSign, Database, Activity, Lock, Globe, Clock, Bell,
  Eye, EyeOff, Server, Zap, Upload, ShieldCheck, Gift, ChevronRight, RefreshCw,
  CreditCard, FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsAPI, billingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNavigate, useLocation } from 'react-router-dom';
import ImageCropper from '../components/ImageCropper';
import FlagTypesSettings from '../components/FlagTypesSettings';
import GrowthRewardWidget from '../components/GrowthRewardWidget';
import UserManagement from './UserManagement';
import Compliance from './Compliance';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const AdminSettings = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'practice';
  });

  // Sync tab with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Settings state
  const [practiceSettings, setPracticeSettings] = useState({});
  const [securitySettings, setSecuritySettings] = useState({});
  const [clinicalSettings, setClinicalSettings] = useState({});
  const [emailSettings, setEmailSettings] = useState({});
  const [featureFlags, setFeatureFlags] = useState([]);

  // Logo cropping state
  const [showLogoCropper, setShowLogoCropper] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Check permissions and load settings
  useEffect(() => {
    if (user) {
      // Check for users:manage permission (admin permission)
      if (!can('users:manage')) {
        console.log('AdminSettings: User does not have users:manage permission');
        navigate('/dashboard');
        return;
      }

      // User has admin permissions, load settings
      console.log('AdminSettings: Using admin permissions to load settings');
      loadAllSettings();
    }
    // Dependency on user.id and permissions value prevents infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate, JSON.stringify(user?.permissions)]);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      const data = response.data;

      if (data.practice) setPracticeSettings(data.practice);
      if (data.security) setSecuritySettings(data.security);
      if (data.clinical) setClinicalSettings(data.clinical);
      if (data.email) setEmailSettings(data.email);
      if (data.features) setFeatureFlags(data.features);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePractice = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await settingsAPI.updatePractice(practiceSettings);
      setSaveStatus({ type: 'success', message: 'Practice settings saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await settingsAPI.updateSecurity(securitySettings);
      setSaveStatus({ type: 'success', message: 'Security settings saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClinical = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await settingsAPI.updateClinical(clinicalSettings);
      setSaveStatus({ type: 'success', message: 'Clinical settings saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await settingsAPI.updateEmail(emailSettings);
      setSaveStatus({ type: 'success', message: 'Email settings saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (featureKey, enabled) => {
    try {
      await settingsAPI.updateFeature(featureKey, { enabled });
      setFeatureFlags(flags =>
        flags.map(f => f.feature_key === featureKey ? { ...f, enabled } : f)
      );
    } catch (error) {
      console.error('Error toggling feature:', error);
      alert('Failed to update feature');
    }
  };

  const isSuperAdmin = user?.role_name === 'SuperAdmin' || user?.role === 'SuperAdmin';

  const tabs = [
    { id: 'practice', label: 'Practice', icon: Building2 },
    { id: 'rewards', label: 'Referrals/Reward', icon: Gift },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'clinical', label: 'Clinical', icon: Stethoscope },
    { id: 'flags', label: 'Patient Flags', icon: Shield },
    ...(isSuperAdmin ? [
      { id: 'email', label: 'Email', icon: Mail },
      { id: 'features', label: 'Features', icon: Zap }
    ] : []),
    { id: 'billing', label: 'Billing', icon: DollarSign },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="p-4 bg-indigo-50 rounded-2xl animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Systems...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-6 -mb-6 bg-slate-50/30">
      {/* Clinic Style Standard Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-sm border border-indigo-100/50">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Administration & Settings</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Practice Control Panel</span>
                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                <span className="text-[10px] font-medium text-slate-400">Manage clinical configuration, users, and security</span>
              </div>
            </div>
          </div>

          {/* Save Status - Positioned in Header if active */}
          {saveStatus && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold animate-in fade-in zoom-in duration-300",
              saveStatus.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
            )}>
              {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {saveStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Tab Nav - Glassmorphism */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 overflow-x-auto scroller-hidden">
        <div className="flex px-6 pt-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                navigate(`/admin-settings?tab=${tab.id}`, { replace: true });
                setActiveTab(tab.id);
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
                activeTab === tab.id
                  ? "text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          {activeTab === 'practice' && (
            <PracticeSettingsTab
              settings={practiceSettings}
              setSettings={setPracticeSettings}
              onSave={handleSavePractice}
              saving={saving}
              showLogoCropper={showLogoCropper}
              setShowLogoCropper={setShowLogoCropper}
              logoCropSrc={logoCropSrc}
              setLogoCropSrc={setLogoCropSrc}
              logoUploading={logoUploading}
              setLogoUploading={setLogoUploading}
              setSaveStatus={setSaveStatus}
            />
          )}

          {activeTab === 'security' && (
            <SecuritySettingsTab
              settings={securitySettings}
              setSettings={setSecuritySettings}
              onSave={handleSaveSecurity}
              saving={saving}
            />
          )}

          {activeTab === 'clinical' && (
            <ClinicalSettingsTab
              settings={clinicalSettings}
              setSettings={setClinicalSettings}
              onSave={handleSaveClinical}
              saving={saving}
            />
          )}

          {activeTab === 'flags' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <FlagTypesSettings />
            </div>
          )}

          {activeTab === 'email' && (
            <EmailSettingsTab
              settings={emailSettings}
              setSettings={setEmailSettings}
              onSave={handleSaveEmail}
              saving={saving}
            />
          )}

          {activeTab === 'features' && (
            <FeaturesTab
              features={featureFlags}
              onToggle={handleToggleFeature}
            />
          )}

          {activeTab === 'billing' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <BillingSettingsTab />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <UserManagement inline={true} />
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <Compliance inline={true} />
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <GrowthRewardWidget />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Practice Settings Tab Component
const PracticeSettingsTab = ({
  settings,
  setSettings,
  onSave,
  saving,
  showLogoCropper,
  setShowLogoCropper,
  logoCropSrc,
  setLogoCropSrc,
  logoUploading,
  setLogoUploading,
  setSaveStatus
}) => {
  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // Handle cropped logo upload
  const handleCroppedLogoUpload = async (croppedBlob) => {
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', croppedBlob, 'logo.png');

      await settingsAPI.uploadPracticeLogo(formData);
      // Refresh all settings to ensure everything is in sync
      const allRes = await settingsAPI.getAll();
      if (allRes.data.practice) setSettings(allRes.data.practice);
      setSaveStatus({ type: 'success', message: 'Logo uploaded successfully' });
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
    } finally {
      setLogoUploading(false);
      setShowLogoCropper(false);
      setLogoCropSrc(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Practice Info Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Practice Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Practice Name *</label>
            <input
              type="text"
              value={settings.practice_name || ''}
              onChange={(e) => updateField('practice_name', e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              placeholder="My Practice"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Practice Type</label>
            <input
              type="text"
              value={settings.practice_type || ''}
              onChange={(e) => updateField('practice_type', e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              placeholder="e.g. Family Medicine"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Tax ID</label>
              <input
                type="text"
                value={settings.tax_id || ''}
                onChange={(e) => updateField('tax_id', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
                placeholder="XX-XXXXXXX"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">NPI</label>
              <input
                type="text"
                maxLength={10}
                value={settings.npi || ''}
                onChange={(e) => updateField('npi', e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
                placeholder="10 digits"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Clinic Address</label>
            <div className="space-y-3">
              <input
                type="text"
                value={settings.address_line1 || ''}
                onChange={(e) => updateField('address_line1', e.target.value)}
                placeholder="Address Line 1"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              />
              <input
                type="text"
                value={settings.address_line2 || ''}
                onChange={(e) => updateField('address_line2', e.target.value)}
                placeholder="Address Line 2 (Optional)"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={settings.city || ''}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
                />
                <input
                  type="text"
                  maxLength={2}
                  value={settings.state || ''}
                  onChange={(e) => updateField('state', e.target.value.toUpperCase())}
                  placeholder="State"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
                />
                <input
                  type="text"
                  value={settings.zip || ''}
                  onChange={(e) => updateField('zip', e.target.value)}
                  placeholder="ZIP Code"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Phone</label>
              <input
                type="tel"
                value={settings.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Fax</label>
              <input
                type="tel"
                value={settings.fax || ''}
                onChange={(e) => updateField('fax', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Official Email</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
            />
          </div>
        </div>
      </div>

      {/* Branding Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Globe className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Practice Branding</h2>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-12">
          <div className="shrink-0">
            <div className="relative group">
              <div className="w-48 h-48 border border-slate-100 rounded-[2.5rem] flex items-center justify-center overflow-hidden bg-slate-50/50 group-hover:border-indigo-200 transition-all duration-300 shadow-inner">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-6 mix-blend-multiply" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-300">
                    <Building2 className="w-12 h-12 stroke-[1]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No Logo</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => document.getElementById('logo-upload').click()}
                    className="w-12 h-12 bg-white rounded-2xl text-indigo-600 shadow-xl flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300 hover:bg-slate-50 active:scale-90"
                    title="Upload New Logo"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>

                {logoUploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                )}
              </div>
              <input
                id="logo-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setLogoCropSrc(reader.result);
                    setShowLogoCropper(true);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <div className="flex-1 space-y-6 py-4">
            <div>
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-3">Logo Guidelines</h4>
              <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                Your practice logo defines your official documentation identity. It will appear on all patient notes, prescriptions, and portals.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                { icon: Check, label: "Transparent PNG preferred" },
                { icon: Check, label: "Square or Rectangle" },
                { icon: Check, label: "High Res (Min 400px)" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-slate-50/80 rounded-xl border border-slate-100">
                  <item.icon className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 divide-y divide-slate-100">
              <div className="py-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Practice Website</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Globe className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="url"
                    value={settings.website || ''}
                    onChange={(e) => updateField('website', e.target.value)}
                    className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
                    placeholder="https://yourpractice.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Regional & Systems</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Timezone</label>
            <select
              value={settings.timezone || 'America/New_York'}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Phoenix">Arizona Time (MST)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Date Format</label>
            <select
              value={settings.date_format || 'MM/DD/YYYY'}
              onChange={(e) => updateField('date_format', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY (USA)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Time Format</label>
            <select
              value={settings.time_format || '12h'}
              onChange={(e) => updateField('time_format', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="12h">12-hour (Standard)</option>
              <option value="24h">24-hour (Military)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Scheduling Start Time</label>
            <input
              type="time"
              value={settings.scheduling_start_time ? settings.scheduling_start_time.substring(0, 5) : '07:00'}
              onChange={(e) => updateField('scheduling_start_time', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm appearance-none cursor-pointer transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Scheduling End Time</label>
            <input
              type="time"
              value={settings.scheduling_end_time ? settings.scheduling_end_time.substring(0, 5) : '19:00'}
              onChange={(e) => updateField('scheduling_end_time', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm appearance-none cursor-pointer transition-all"
            />
          </div>
        </div>
      </div>

      {/* Floating Save Bar - Local to tab logic but visually follows PLAN.md */}
      <div className="sticky bottom-0 z-20 py-6 pr-6 pointer-events-none flex justify-end translate-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="pointer-events-auto group px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
          )}
          <span>{saving ? 'Synchronizing...' : 'Save All Changes'}</span>
        </button>
      </div>

      {showLogoCropper && (
        <ImageCropper
          image={logoCropSrc}
          onCropComplete={handleCroppedLogoUpload}
          onCancel={() => {
            setShowLogoCropper(false);
            setLogoCropSrc(null);
          }}
          title="Crop Practice Logo"
        />
      )}
    </div>
  );
};

// Security Settings Tab Component
const SecuritySettingsTab = ({ settings, setSettings, onSave, saving }) => {
  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const toggleField = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const sections = [
    {
      id: 'policy',
      title: 'Password Policy',
      icon: Lock,
      fields: [
        { id: 'password_min_length', label: 'Min Password Length', type: 'number', min: 6, max: 32 },
      ],
      checks: [
        { id: 'password_require_uppercase', label: 'Require uppercase letter (A-Z)' },
        { id: 'password_require_lowercase', label: 'Require lowercase letter (a-z)' },
        { id: 'password_require_number', label: 'Require number (0-9)' },
        { id: 'password_require_special', label: 'Require special character (!@#$%^&*)' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Policy Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Password Policy</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Min Length Requirement</label>
              <input
                type="number"
                min={6}
                max={32}
                value={settings.password_min_length || 8}
                onChange={(e) => updateField('password_min_length', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              />
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Complexity Rules</p>
              {[
                { id: 'password_require_uppercase', label: 'Uppercase Letters' },
                { id: 'password_require_lowercase', label: 'Lowercase Letters' },
                { id: 'password_require_number', label: 'Numbers (0-9)' },
                { id: 'password_require_special', label: 'Special Characters' }
              ].map(check => (
                <label key={check.id} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{check.label}</span>
                  <div
                    onClick={(e) => { e.preventDefault(); toggleField(check.id); }}
                    className={cn(
                      "w-10 h-6 rounded-full relative transition-all duration-300",
                      settings[check.id] ?? true ? "bg-indigo-600 shadow-lg shadow-indigo-100" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-sm",
                      settings[check.id] ?? true ? "left-5" : "left-1"
                    )} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Audit Trail Retention</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Clock className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="number"
                  min={30}
                  max={2555}
                  value={settings.audit_log_retention_days || 365}
                  onChange={(e) => updateField('audit_log_retention_days', parseInt(e.target.value))}
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 px-1 mt-2 font-medium">Industry standard is 365 days or greater.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Access Control</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Session Timeout</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={480}
                value={settings.session_timeout_minutes || 30}
                onChange={(e) => updateField('session_timeout_minutes', parseInt(e.target.value))}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Min</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Inactivity Lock</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={120}
                value={settings.inactivity_timeout_minutes || 15}
                onChange={(e) => updateField('inactivity_timeout_minutes', parseInt(e.target.value))}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Min</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Max Login Fails</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={3}
                max={10}
                value={settings.max_login_attempts || 5}
                onChange={(e) => updateField('max_login_attempts', parseInt(e.target.value))}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center font-bold text-rose-600"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Attempts</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/30">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800">Multi-Factor Authentication (MFA)</h3>
            </div>
            <div className="space-y-4">
              {[
                { id: 'require_2fa', label: 'Enforce MFA for all practice users' },
                { id: 'require_2fa_for_admin', label: 'Only require MFA for Administrator accounts' }
              ].map(check => (
                <label key={check.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={(e) => { e.preventDefault(); toggleField(check.id); }}
                    className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
                      settings[check.id] ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200 group-hover:border-indigo-300"
                    )}
                  >
                    {settings[check.id] && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{check.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 py-6 pr-6 pointer-events-none flex justify-end translate-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="pointer-events-auto group px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
          )}
          <span>{saving ? 'Synchronizing Security...' : 'Update Security Policy'}</span>
        </button>
      </div>
    </div>
  );
};

// Clinical Settings Tab Component
const ClinicalSettingsTab = ({ settings, setSettings, onSave, saving }) => {
  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const toggleField = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      {/* Visit Requirements Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Stethoscope className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Visit Requirements</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Mandatory Documentation</p>
            {[
              { id: 'require_dx_on_visit', label: 'Require diagnosis for visit sign-off' },
              { id: 'require_vitals_on_visit', label: 'Require vitals entry for checkout' }
            ].map(check => (
              <label key={check.id} className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={(e) => { e.preventDefault(); toggleField(check.id); }}
                  className={cn(
                    "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
                    settings[check.id] ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200 group-hover:border-indigo-300"
                  )}
                >
                  {settings[check.id] && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{check.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Default Visit Duration</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={settings.default_visit_duration_minutes || 15}
                  onChange={(e) => updateField('default_visit_duration_minutes', parseInt(e.target.value))}
                  className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Minutes</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Scheduling Density</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  disabled={!settings.max_appointments_per_slot && settings.max_appointments_per_slot !== 0}
                  value={settings.max_appointments_per_slot || ''}
                  onChange={(e) => updateField('max_appointments_per_slot', e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="∞"
                />
                <button
                  type="button"
                  onClick={() => updateField('max_appointments_per_slot', settings.max_appointments_per_slot ? null : 2)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                    !settings.max_appointments_per_slot ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {!settings.max_appointments_per_slot ? 'Set Cap' : 'Unlock Slot'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 px-1 mt-2 font-medium">
                {!settings.max_appointments_per_slot ? 'Unlimited appointments per time slot.' : `Restricted to ${settings.max_appointments_per_slot} patients per slot.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Alerts Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Bell className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Clinical Decision Support</h2>
        </div>

        <div className="space-y-4 max-w-lg">
          {[
            { id: 'enable_clinical_alerts', label: 'Enable clinical safety alerts (Gaps in care)' },
            { id: 'enable_drug_interaction_check', label: 'Surescripts Drug-Drug interaction checking' },
            { id: 'enable_allergy_alerts', label: 'Allergy contradiction warnings' }
          ].map(check => (
            <label key={check.id} className="flex items-center justify-between group p-4 rounded-2xl bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-indigo-50/30 transition-all">
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{check.label}</span>
              <div
                onClick={(e) => { e.preventDefault(); toggleField(check.id); }}
                className={cn(
                  "w-10 h-6 rounded-full relative transition-all duration-300",
                  settings[check.id] ?? true ? "bg-indigo-600 shadow-lg shadow-indigo-100" : "bg-slate-200"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-sm",
                  settings[check.id] ?? true ? "left-5" : "left-1"
                )} />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Data Retention Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Data Retention Policy</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: 'lab_result_retention_days', label: 'Lab Results' },
            { id: 'imaging_result_retention_days', label: 'Imaging Results' },
            { id: 'document_retention_days', label: 'Clinical Documents' }
          ].map(field => (
            <div key={field.id}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{field.label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={365}
                  max={3650}
                  value={settings[field.id] || 2555}
                  onChange={(e) => updateField(field.id, parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all text-center"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Days</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3 p-4 bg-rose-50/50 rounded-2xl border border-rose-100/30">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <p className="text-[10px] font-medium text-rose-600 leading-relaxed uppercase tracking-wide">
            HIPAA requires a minimum 6-year (2190 days) retention policy for most clinical records.
          </p>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 py-6 pr-6 pointer-events-none flex justify-end translate-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="pointer-events-auto group px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
          )}
          <span>{saving ? 'Synchronizing Clinical...' : 'Validate Clinical Policies'}</span>
        </button>
      </div>
    </div>
  );
};

// Email Settings Tab Component
const EmailSettingsTab = ({ settings, setSettings, onSave, saving }) => {
  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const toggleField = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Mail className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Email Notifications</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">From Name</label>
            <input
              type="text"
              value={settings.from_name || ''}
              onChange={(e) => updateField('from_name', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
              placeholder="My Practice"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">From Email</label>
            <input
              type="email"
              value={settings.from_email || ''}
              onChange={(e) => updateField('from_email', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Reply-To Address</label>
            <input
              type="email"
              value={settings.reply_to_email || ''}
              onChange={(e) => updateField('reply_to_email', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Sandbox Test Address</label>
            <input
              type="email"
              value={settings.test_email || ''}
              onChange={(e) => updateField('test_email', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm transition-all italic"
              placeholder="Internal testing only"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-50">
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div
              onClick={(e) => { e.preventDefault(); toggleField('enabled'); }}
              className={cn(
                "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
                settings.enabled ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200 group-hover:border-indigo-300"
              )}
            >
              {settings.enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-slate-600 font-bold group-hover:text-slate-900 transition-colors">Enable automatic email transmissions</span>
          </label>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 py-6 pr-6 pointer-events-none flex justify-end translate-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="pointer-events-auto group px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
          )}
          <span>{saving ? 'Validating SMTP...' : 'Update Communication Policy'}</span>
        </button>
      </div>
    </div>
  );
};

// Features Tab Component
const FeaturesTab = ({ features, onToggle }) => {
  const groupedFeatures = features.reduce((acc, feature) => {
    const category = feature.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {});

  const categoryLabels = {
    clinical: 'Clinical Features',
    billing: 'Billing Features',
    patient: 'Patient Features',
    reporting: 'Reporting & Analytics',
    communication: 'Communication',
    other: 'Other Features'
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Zap className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Feature Control Matrix</h2>
        </div>
        <p className="text-sm text-slate-500 max-w-xl">
          Toggle internal system flags to enable or disable modules. Changes are applied instantly across the entire clinic instance.
        </p>

        <div className="mt-8 space-y-10">
          {Object.keys(groupedFeatures).map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">{categoryLabels[category] || category}</h3>
                <div className="h-px bg-slate-100 w-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedFeatures[category].map(feature => (
                  <div key={feature.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex-1 pr-4">
                      <div className="text-sm font-bold text-slate-700 group-hover:text-indigo-900 transition-colors uppercase tracking-tight">{feature.description || feature.feature_key}</div>
                      {feature.requires_config && (
                        <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wide">Requires Configuration</div>
                      )}
                    </div>
                    <button
                      onClick={() => onToggle(feature.feature_key, !feature.enabled)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm",
                        feature.enabled
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-200"
                      )}
                    >
                      {feature.enabled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" />
                          <span>Inactive</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Billing Settings Tab Component
const BillingSettingsTab = () => {
  const [billingInfo, setBillingInfo] = useState(null);
  const [billingHistory, setBillingHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    fetchBillingStatus();
    fetchBillingHistory();
  }, []);

  const fetchBillingStatus = async () => {
    try {
      setLoading(true);
      const response = await billingAPI.stripe.getStatus();
      setBillingInfo(response.data);
    } catch (error) {
      console.error('Error fetching billing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const response = await billingAPI.stripe.getHistory();
      setBillingHistory(response.data);
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  const handleUpgrade = async () => {
    try {
      setRedirecting(true);
      const response = await billingAPI.stripe.createCheckoutSession();
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to initiate secure checkout. Please try again.');
    } finally {
      setRedirecting(false);
    }
  };

  const openPortal = async () => {
    try {
      setRedirecting(true);
      const response = await billingAPI.stripe.openPortal();
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
      </div>
    );
  }

  const billing = billingInfo?.billing || {};
  const status = billingInfo?.stripe_subscription_status || 'none';
  const hasSubscription = status === 'active' || billingInfo?.stripe_subscription_id;
  const isActive = status === 'active';
  const currentTierName = billing.tier || 'Trial';

  const ALL_TIERS = [
    { name: 'Solo', range: '1', rate: 399 },
    { name: 'Partner', range: '2–3', rate: 299 },
    { name: 'Professional', range: '4–5', rate: 249 },
    { name: 'Premier', range: '6–8', rate: 199 },
    { name: 'Elite', range: '9–10', rate: 149 },
    { name: 'Enterprise', range: '11+', rate: 99 },
  ];

  const invoices = billingHistory?.invoices || [];

  const statusPill = (s) => {
    if (s === 'paid') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (s === 'open') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (s === 'void' || s === 'uncollectible') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Dunning / Grace Period Banner */}
      {billingInfo?.billing_grace_phase > 0 && (
        <div className={cn(
          "p-4 rounded-xl border flex gap-3 items-start",
          billingInfo.billing_grace_phase === 1 ? "bg-amber-50 border-amber-100 text-amber-800" :
            billingInfo.billing_grace_phase === 2 ? "bg-orange-50 border-orange-100 text-orange-800" :
              "bg-red-50 border-red-100 text-red-800"
        )}>
          <div className="mt-0.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {billingInfo.billing_grace_phase === 1 && "Payment Grace Period Active"}
              {billingInfo.billing_grace_phase === 2 && "Account in Read-Only Mode"}
              {billingInfo.billing_grace_phase === 3 && "Account Strictly Locked"}
            </p>
            <p className="text-xs mt-1 leading-relaxed opacity-90">
              {billingInfo.billing_grace_phase === 1 && "We encountered an issue with your payment. Your services remain fully active until day 15."}
              {billingInfo.billing_grace_phase === 2 && "Modifications are disabled. You can still view patient charts and export data."}
              {billingInfo.billing_grace_phase === 3 && "Full lockout. Please update payment immediately to restore clinical services."}
            </p>
            <button
              onClick={openPortal}
              className="mt-3 px-3 py-1.5 bg-white border border-current rounded-lg text-[10px] font-bold uppercase transition-transform active:scale-95"
            >
              Update Payment Details
            </button>
          </div>
        </div>
      )}

      {/* Subscription Overview — Compact */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Subscription</h2>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors",
            billingInfo?.billing_grace_phase === 1 ? "bg-amber-50 text-amber-600 border-amber-100" :
              billingInfo?.billing_grace_phase === 2 ? "bg-orange-50 text-orange-600 border-orange-100" :
                (billingInfo?.billing_grace_phase === 3 || status === 'suspended') ? "bg-red-50 text-red-600 border-red-100" :
                  isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    "bg-slate-50 text-slate-500 border-slate-100"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              billingInfo?.billing_grace_phase === 1 ? "bg-amber-400" :
                billingInfo?.billing_grace_phase === 2 ? "bg-orange-400" :
                  (billingInfo?.billing_grace_phase === 3 || status === 'suspended') ? "bg-red-400" :
                    isActive ? "bg-emerald-400" :
                      "bg-slate-300"
            )} />
            {billingInfo?.billing_grace_phase === 1 ? 'Grace Period' :
              billingInfo?.billing_grace_phase === 2 ? 'Read-Only' :
                (billingInfo?.billing_grace_phase === 3 || status === 'suspended') ? 'Suspended' :
                  isActive ? 'Active' :
                    status === 'none' ? 'No Subscription' : status}
          </div>
        </div>

        {/* Summary Row */}
        <div className="flex items-end justify-between mb-4 pb-4 border-b border-slate-50">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Current Tier</p>
            <p className="text-lg font-semibold text-slate-800">{currentTierName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Monthly Total</p>
            <p className="text-lg font-semibold text-slate-800">${billing.monthlyTotal || 0}</p>
          </div>
        </div>

        {/* Billing Breakdown — Compact Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-slate-50/80 rounded-lg p-2.5 text-center">
            <p className="text-sm font-semibold text-slate-700">{billing.physicalSeats || 0}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Physical</p>
          </div>
          <div className="bg-slate-50/80 rounded-lg p-2.5 text-center">
            <p className="text-sm font-semibold text-teal-600">{billing.ghostSeats || 0}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Ghost</p>
          </div>
          <div className="bg-slate-50/80 rounded-lg p-2.5 text-center">
            <p className="text-sm font-semibold text-slate-700">{billing.totalSeats || 0}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Total</p>
          </div>
          <div className="bg-slate-50/80 rounded-lg p-2.5 text-center">
            <p className="text-sm font-semibold text-slate-700">${billing.virtualTotal || 0}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Virtual</p>
          </div>
          <div className="bg-slate-50/80 rounded-lg p-2.5 text-center">
            <p className="text-sm font-semibold text-slate-700">${billing.effectiveRate || 0}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Per MD</p>
          </div>
        </div>

        {/* Equation Summary */}
        <div className="bg-blue-50/50 border border-blue-100/40 rounded-lg px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-600 mb-4">
          <span>{billing.physicalSeats || 0} MDs × ${billing.effectiveRate || 0}/mo</span>
          <span className="font-semibold text-slate-800">${billing.monthlyTotal || 0}/mo</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasSubscription ? (
            <button
              onClick={openPortal}
              disabled={redirecting}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {redirecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Manage Billing
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={redirecting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {redirecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Setup Payment
            </button>
          )}
          {hasSubscription && (
            <button
              onClick={openPortal}
              disabled={redirecting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              View Invoices
            </button>
          )}
          {billingInfo?.current_period_end && (
            <span className="ml-auto text-[10px] text-slate-400">
              Renews {new Date(billingInfo.current_period_end).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Payment History */}
      {
        invoices.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Payment History</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500">
                      {inv.date ? new Date(inv.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-medium">{inv.description}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">${inv.amountDollars}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${statusPill(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv.invoiceUrl ? (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 text-[10px] font-medium hover:underline"
                        >
                          View →
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Pricing Tiers — Compact Strip */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Volume Pricing Tiers</h3>
        <div className="grid grid-cols-6 gap-2">
          {ALL_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "rounded-lg p-2.5 text-center border transition-all",
                currentTierName === tier.name
                  ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100"
                  : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
              )}
            >
              <p className={cn(
                "text-[10px] font-semibold uppercase tracking-wider mb-1",
                currentTierName === tier.name ? "text-blue-600" : "text-slate-500"
              )}>
                {tier.name}
              </p>
              <p className="text-sm font-semibold text-slate-800">${tier.rate}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{tier.range} MDs</p>
              {currentTierName === tier.name && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[7px] font-semibold uppercase">Current</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ACH Nudge */}
      {
        (billing.totalSeats || 0) > 5 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50/50 border border-amber-100/50 rounded-xl">
            <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-800">Consider ACH billing for {billing.totalSeats} seats</p>
              <p className="text-[11px] text-amber-600/70 mt-0.5 leading-relaxed">Eliminates credit card processing fees — ideal for larger practices.</p>
              <button className="mt-2 text-[10px] font-medium text-amber-700 underline decoration-amber-200 hover:decoration-amber-400 transition-all">
                Contact Treasury
              </button>
            </div>
          </div>
        )
      }

      {/* Policy Documentation */}
      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Grace Period & Termination Policy</h3>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">1. Duning Cycle (45 Days)</p>
              <ul className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
                <li><span className="text-slate-700 font-medium">Days 1-15 (Warning):</span> Full system access but banners are shown. Stripe smart-retries active.</li>
                <li><span className="text-slate-700 font-medium">Days 16-30 (Degraded):</span> Read-Only mode. View/Export charts only.</li>
                <li><span className="text-slate-700 font-medium">Days 31-45 (Locked):</span> Full lockout. HIPAA data retention active.</li>
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">2. Termination & Data Retention</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                After 45 days of non-payment, subscriptions are automatically canceled. However, per HIPAA compliance, clinical records are retained for a minimum of 90 days. An export-only portal remains accessible during this window.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-[10px] text-slate-400 italic">Effective Jan 1, 2026. Standard across all tiers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
