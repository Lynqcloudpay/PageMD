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
  ToggleLeft, ToggleRight, Save, Loader2, AlertCircle, CheckCircle2,
  DollarSign, Database, Activity, Lock, Globe, Clock, Bell,
  Eye, EyeOff, Server, Zap, Upload
} from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNavigate } from 'react-router-dom';

const AdminSettings = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('practice');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Settings state
  const [practiceSettings, setPracticeSettings] = useState({});
  const [securitySettings, setSecuritySettings] = useState({});
  const [clinicalSettings, setClinicalSettings] = useState({});
  const [emailSettings, setEmailSettings] = useState({});
  const [featureFlags, setFeatureFlags] = useState([]);

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

  const tabs = [
    { id: 'practice', label: 'Practice', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'clinical', label: 'Clinical', icon: Stethoscope },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'billing', label: 'Billing', icon: DollarSign },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration & Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage practice configuration, users, and system settings</p>
        </div>
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${saveStatus.type === 'success'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'users') {
                  navigate('/users');
                  return;
                }
                setActiveTab(tab.id);
              }}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'practice' && (
            <PracticeSettingsTab
              settings={practiceSettings}
              setSettings={setPracticeSettings}
              onSave={handleSavePractice}
              saving={saving}
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
            <BillingSettingsTab />
          )}
        </div>
      </div>
    </div>
  );
};

// Practice Settings Tab Component
const PracticeSettingsTab = ({ settings, setSettings, onSave, saving }) => {
  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Practice Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Practice Name *</label>
            <input
              type="text"
              value={settings.practice_name || ''}
              onChange={(e) => updateField('practice_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="My Practice"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Practice Type</label>
            <input
              type="text"
              value={settings.practice_type || ''}
              onChange={(e) => updateField('practice_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Family Medicine, Cardiology, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
            <input
              type="text"
              value={settings.tax_id || ''}
              onChange={(e) => updateField('tax_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="XX-XXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NPI (National Provider Identifier)</label>
            <input
              type="text"
              maxLength={10}
              value={settings.npi || ''}
              onChange={(e) => updateField('npi', e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="10 digits"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
            <input
              type="text"
              value={settings.address_line1 || ''}
              onChange={(e) => updateField('address_line1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={settings.address_line2 || ''}
              onChange={(e) => updateField('address_line2', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={settings.city || ''}
              onChange={(e) => updateField('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              maxLength={2}
              value={settings.state || ''}
              onChange={(e) => updateField('state', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="CA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
            <input
              type="text"
              value={settings.zip || ''}
              onChange={(e) => updateField('zip', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
            <input
              type="tel"
              value={settings.fax || ''}
              onChange={(e) => updateField('fax', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={settings.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Practice Branding</h2>
        <div className="flex items-start gap-8 px-4 py-2 bg-gray-50/50 rounded-xl border border-gray-100">
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">Practice Logo</label>
            <div className="relative group">
              <div className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-white group-hover:border-primary-500 transition-colors shadow-sm">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Practice Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Building2 className="w-10 h-10" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">No Logo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <button
                    type="button"
                    onClick={() => document.getElementById('logo-upload').click()}
                    className="p-2.5 bg-white rounded-full text-primary-600 hover:bg-primary-50 shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <input
                id="logo-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('logo', file);

                  try {
                    const response = await settingsAPI.uploadPracticeLogo(formData);
                    updateField('logo_url', response.data.logo_url);
                  } catch (error) {
                    console.error('Error uploading logo:', error);
                    alert('Failed to upload logo');
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">PNG, JPG or SVG (max 2MB)</p>
          </div>
          <div className="flex-1 pt-8">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Branding Guidelines</h4>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Your practice logo appears on all patient-facing documents and official visit notes.
              Upload a high-quality logo to ensure your clinical documentation looks professional.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-500">Transparent Background Preferred</span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-500">Square or Horizontal Layout</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Regional Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={settings.timezone || 'America/New_York'}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Phoenix">Arizona Time (MST)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select
              value={settings.date_format || 'MM/DD/YYYY'}
              onChange={(e) => updateField('date_format', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
            <select
              value={settings.time_format || '12h'}
              onChange={(e) => updateField('time_format', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="12h">12-hour (AM/PM)</option>
              <option value="24h">24-hour</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Password Policy</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Password Length</label>
            <input
              type="number"
              min={6}
              max={32}
              value={settings.password_min_length || 8}
              onChange={(e) => updateField('password_min_length', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Password Requirements</label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.password_require_uppercase ?? true}
                onChange={() => toggleField('password_require_uppercase')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Require uppercase letter (A-Z)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.password_require_lowercase ?? true}
                onChange={() => toggleField('password_require_lowercase')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Require lowercase letter (a-z)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.password_require_number ?? true}
                onChange={() => toggleField('password_require_number')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Require number (0-9)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.password_require_special ?? true}
                onChange={() => toggleField('password_require_special')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Require special character (!@#$%^&*)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Security</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
            <input
              type="number"
              min={5}
              max={480}
              value={settings.session_timeout_minutes || 30}
              onChange={(e) => updateField('session_timeout_minutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inactivity Timeout (minutes)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.inactivity_timeout_minutes || 15}
              onChange={(e) => updateField('inactivity_timeout_minutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Login Security</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
            <input
              type="number"
              min={3}
              max={10}
              value={settings.max_login_attempts || 5}
              onChange={(e) => updateField('max_login_attempts', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lockout Duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={settings.lockout_duration_minutes || 15}
              onChange={(e) => updateField('lockout_duration_minutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>

        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_2fa ?? false}
              onChange={() => toggleField('require_2fa')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Require 2FA for all users</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_2fa_for_admin ?? false}
              onChange={() => toggleField('require_2fa_for_admin')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Require 2FA for admin users</span>
          </label>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit & Logging</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audit Log Retention (days)</label>
          <input
            type="number"
            min={30}
            max={2555}
            value={settings.audit_log_retention_days || 365}
            onChange={(e) => updateField('audit_log_retention_days', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Recommended: 365 days (HIPAA minimum: 6 years for certain records)</p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit Requirements</h2>

        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_dx_on_visit ?? true}
              onChange={() => toggleField('require_dx_on_visit')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Require diagnosis on visit</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_vitals_on_visit ?? false}
              onChange={() => toggleField('require_vitals_on_visit')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Require vitals on visit</span>
          </label>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Visit Duration (minutes)</label>
          <input
            type="number"
            min={5}
            max={120}
            value={settings.default_visit_duration_minutes || 15}
            onChange={(e) => updateField('default_visit_duration_minutes', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinical Alerts</h2>

        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_clinical_alerts ?? true}
              onChange={() => toggleField('enable_clinical_alerts')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable clinical alerts</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_drug_interaction_check ?? true}
              onChange={() => toggleField('enable_drug_interaction_check')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable drug interaction checking</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_allergy_alerts ?? true}
              onChange={() => toggleField('enable_allergy_alerts')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable allergy alerts</span>
          </label>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Retention</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lab Results (days)</label>
            <input
              type="number"
              min={365}
              max={3650}
              value={settings.lab_result_retention_days || 2555}
              onChange={(e) => updateField('lab_result_retention_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imaging Results (days)</label>
            <input
              type="number"
              min={365}
              max={3650}
              value={settings.imaging_result_retention_days || 2555}
              onChange={(e) => updateField('imaging_result_retention_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documents (days)</label>
            <input
              type="number"
              min={365}
              max={3650}
              value={settings.document_retention_days || 2555}
              onChange={(e) => updateField('document_retention_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">HIPAA requires minimum 6 years (2190 days) retention for certain records</p>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Email Settings Tab Component
const EmailSettingsTab = ({ settings, setSettings, onSave, saving }) => {
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const toggleField = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SMTP Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input
              type="text"
              value={settings.smtp_host || ''}
              onChange={(e) => updateField('smtp_host', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
            <input
              type="number"
              value={settings.smtp_port || 587}
              onChange={(e) => updateField('smtp_port', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
            <input
              type="text"
              value={settings.smtp_username || ''}
              onChange={(e) => updateField('smtp_username', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={settings.smtp_password === '***hidden***' ? '' : (settings.smtp_password || '')}
                onChange={(e) => updateField('smtp_password', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={settings.smtp_password === '***hidden***' ? 'Password is set (enter new to change)' : ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.smtp_secure ?? true}
                onChange={() => toggleField('smtp_secure')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Use secure connection (TLS/SSL)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              value={settings.from_name || ''}
              onChange={(e) => updateField('from_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="My Practice"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input
              type="email"
              value={settings.from_email || ''}
              onChange={(e) => updateField('from_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Email</label>
            <input
              type="email"
              value={settings.reply_to_email || ''}
              onChange={(e) => updateField('reply_to_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Email Address</label>
            <input
              type="email"
              value={settings.test_email || ''}
              onChange={(e) => updateField('test_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="For testing email configuration"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled ?? false}
              onChange={() => toggleField('enabled')}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable email notifications</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Flags</h2>
        <p className="text-sm text-gray-600 mb-6">Enable or disable system features</p>

        {Object.keys(groupedFeatures).map(category => (
          <div key={category} className="mb-6">
            <h3 className="text-md font-medium text-gray-800 mb-3">{categoryLabels[category] || category}</h3>
            <div className="space-y-3">
              {groupedFeatures[category].map(feature => (
                <div key={feature.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{feature.description || feature.feature_key}</div>
                    {feature.requires_config && (
                      <div className="text-xs text-gray-500 mt-1">Requires additional configuration</div>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(feature.feature_key, !feature.enabled)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${feature.enabled
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    {feature.enabled ? (
                      <>
                        <ToggleRight className="w-5 h-5" />
                        <span>Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5" />
                        <span>Disabled</span>
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
  );
};

// Billing Settings Tab Component
const BillingSettingsTab = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Billing Configuration</h3>
            <p className="text-sm text-blue-700 mt-1">
              Billing configuration settings will be available here. This section will include fee schedule management,
              clearinghouse configuration, and claim submission settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;


