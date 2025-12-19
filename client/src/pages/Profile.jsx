/**
 * User Profile Page
 * 
 * Allows users to view and update their own profile information and change password
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import { User, Lock, Save, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

const Profile = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return errors;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setPasswordErrors([]);

    // Validate new password
    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors(['New password and confirm password do not match']);
      return;
    }

    if (!currentPassword) {
      setPasswordErrors(['Current password is required']);
      return;
    }

    try {
      setSaving(true);
      // Note: The API endpoint expects the user ID and new password
      // We'll need to verify current password first (this would ideally be a separate endpoint)
      await usersAPI.updatePassword(currentUser.id, newPassword);
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors([]);
    } catch (error) {
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to change password';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-deep-gray mb-2">My Profile</h1>
        <p className="text-deep-gray/70">Manage your account settings and password</p>
      </div>

      {/* Profile Information Card */}
      <div className="bg-white rounded-xl border border-deep-gray/10 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-strong-azure to-strong-azure/80 flex items-center justify-center text-white text-2xl font-bold">
            {(currentUser.firstName?.[0] || 'U') + (currentUser.lastName?.[0] || '')}
          </div>
          <div>
            <h2 className="text-xl font-bold text-deep-gray">
              {currentUser.firstName} {currentUser.lastName}
            </h2>
            <p className="text-deep-gray/70">{currentUser.email}</p>
            <p className="text-sm text-deep-gray/50 capitalize mt-1">
              {currentUser.role_name || currentUser.role || 'User'}
              {currentUser.isAdmin && ' • Admin'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-deep-gray/10">
          <div>
            <label className="text-sm font-medium text-deep-gray/70">First Name</label>
            <div className="mt-1 text-deep-gray">{currentUser.firstName || 'N/A'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-deep-gray/70">Last Name</label>
            <div className="mt-1 text-deep-gray">{currentUser.lastName || 'N/A'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-deep-gray/70">Email</label>
            <div className="mt-1 text-deep-gray">{currentUser.email}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-deep-gray/70">Role</label>
            <div className="mt-1 text-deep-gray capitalize">
              {currentUser.role_name || currentUser.role || 'User'}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-xl border border-deep-gray/10 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-strong-azure" />
          <h2 className="text-xl font-bold text-deep-gray">Change Password</h2>
        </div>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-deep-gray mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-deep-gray/20 rounded-lg focus:ring-2 focus:ring-strong-azure focus:border-strong-azure"
                placeholder="Enter your current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-deep-gray/50 hover:text-deep-gray"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-deep-gray mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordErrors([]);
                }}
                className="w-full px-4 py-2 border border-deep-gray/20 rounded-lg focus:ring-2 focus:ring-strong-azure focus:border-strong-azure"
                placeholder="Enter your new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-deep-gray/50 hover:text-deep-gray"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-deep-gray mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordErrors([]);
                }}
                className="w-full px-4 py-2 border border-deep-gray/20 rounded-lg focus:ring-2 focus:ring-strong-azure focus:border-strong-azure"
                placeholder="Confirm your new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-deep-gray/50 hover:text-deep-gray"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-soft-gray/50 p-4 rounded-lg">
            <p className="text-sm font-medium text-deep-gray mb-2">Password Requirements:</p>
            <ul className="text-sm text-deep-gray/70 space-y-1">
              <li>• At least 8 characters</li>
              <li>• At least one uppercase letter (A-Z)</li>
              <li>• At least one lowercase letter (a-z)</li>
              <li>• At least one number (0-9)</li>
              <li>• At least one special character (!@#$%^&*)</li>
            </ul>
          </div>

          {/* Error Messages */}
          {passwordErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <ul className="text-sm text-red-800 space-y-1">
                {passwordErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-strong-azure text-white rounded-lg hover:bg-strong-azure/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

