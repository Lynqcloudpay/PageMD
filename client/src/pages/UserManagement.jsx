/**
 * User Management Page
 * 
 * Admin-only page for managing users, roles, and privileges
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Edit, Trash2, Shield, Lock, Unlock,
  Search, Filter, ChevronDown, CheckCircle2, XCircle, AlertCircle,
  Eye, EyeOff, Save, X, ChevronRight, ChevronLeft
} from 'lucide-react';
import { usersAPI, rolesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import Modal from '../components/ui/Modal';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      console.log('Loading roles...');
      const response = await rolesAPI.getAll();
      console.log('Roles API response:', response);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      // Handle different response formats
      let rolesData = [];
      if (Array.isArray(response.data)) {
        rolesData = response.data;
      } else if (response.data && Array.isArray(response.data.roles)) {
        rolesData = response.data.roles;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        rolesData = response.data.data;
      } else if (response && Array.isArray(response)) {
        // Sometimes axios returns the array directly
        rolesData = response;
      }
      console.log('Parsed roles data:', rolesData);
      console.log('Number of roles:', rolesData.length);
      setRoles(rolesData);
      if (rolesData.length === 0) {
        console.warn('⚠️ No roles found in database. Roles migration may have failed or roles table is empty.');
        console.warn('Please check:');
        console.warn('1. Server console for errors');
        console.warn('2. Database to verify roles exist');
        console.warn('3. That you are logged in as admin (roles endpoint requires admin)');
      } else {
        console.log('✅ Successfully loaded', rolesData.length, 'roles');
      }
    } catch (error) {
      console.error('❌ Error loading roles:', error);
      console.error('Error details:', error.response?.data || error.message);
      console.error('Status:', error.response?.status);
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Authentication/Authorization error - make sure you are logged in as admin');
      }
      setRoles([]);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await usersAPI.updateStatus(userId, { status: newStatus });
      loadUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update user status');
    }
  };

  const handleToggleAdmin = async (user) => {
    try {
      const isCurrentlyAdmin = user.is_admin === true;

      if (!isCurrentlyAdmin && !confirm(`Grant admin privileges to ${user.first_name} ${user.last_name}?\n\nThis will give them full system access while keeping their current role (${user.role_name}).`)) {
        return;
      }
      if (isCurrentlyAdmin && !confirm(`Remove admin privileges from ${user.first_name} ${user.last_name}?\n\nThey will keep their current role (${user.role_name}) but lose admin access.`)) {
        return;
      }

      await usersAPI.update(user.id, { isAdmin: !isCurrentlyAdmin });
      loadUsers();
      alert(isCurrentlyAdmin ? 'Admin privileges removed' : 'Admin privileges granted');
    } catch (error) {
      console.error('Error toggling admin:', error);
      alert(error.response?.data?.error || 'Failed to update admin privileges');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery ||
      `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role_id === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusBadge = (status) => {
    const config = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      suspended: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      inactive: { color: 'bg-gray-100 text-gray-800', icon: XCircle }
    };
    const { color, icon: Icon } = config[status] || config.inactive;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${color}`}>
        <Icon className="w-3 h-3" />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pl-6 pr-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage users, roles, and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-white rounded-lg flex items-center space-x-2 transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
        >
          <UserPlus className="w-5 h-5" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Roles</option>
            {roles && Array.isArray(roles) && roles.length > 0 ? (
              roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))
            ) : (
              <option value="" disabled>No roles available</option>
            )}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">{user.role_name || 'No role'}</span>
                        {user.is_admin && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={`${user.is_admin ? 'text-amber-600 hover:text-amber-900' : 'text-gray-400 hover:text-gray-600'}`}
                          title={user.is_admin ? 'Remove admin privileges' : 'Grant admin privileges'}
                        >
                          <Shield className={`w-4 h-4 ${user.is_admin ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.status === 'active' ? (
                          <button
                            onClick={() => handleStatusChange(user.id, 'suspended')}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Suspend user"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(user.id, 'active')}
                            className="text-green-600 hover:text-green-900"
                            title="Activate user"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={async () => {
                              if (confirm('⚠️ WARNING: This will permanently delete this user and cannot be undone.\n\nAre you sure you want to permanently delete this user?')) {
                                try {
                                  await usersAPI.delete(user.id);
                                  loadUsers();
                                  alert('User permanently deleted');
                                } catch (error) {
                                  console.error('Error deleting user:', error);
                                  const errorData = error.response?.data;

                                  // Handle 409 conflict - user has associated records
                                  if (error.response?.status === 409 && errorData?.details) {
                                    const { visits, signedNotes, messages } = errorData.details;
                                    const recordSummary = [
                                      visits > 0 ? `${visits} visit(s)` : null,
                                      signedNotes > 0 ? `${signedNotes} signed note(s)` : null,
                                      messages > 0 ? `${messages} message(s)` : null,
                                    ].filter(Boolean).join(', ');

                                    const shouldDeactivate = confirm(
                                      `Cannot delete user: They have ${recordSummary} that must be preserved for HIPAA compliance.\n\n` +
                                      `Would you like to DEACTIVATE this user instead?\n\n` +
                                      `(Deactivated users cannot log in but their records remain intact)`
                                    );

                                    if (shouldDeactivate) {
                                      try {
                                        await usersAPI.updateStatus(user.id, { status: 'inactive' });
                                        loadUsers();
                                        alert('User has been deactivated successfully');
                                      } catch (statusError) {
                                        alert('Failed to deactivate user: ' + (statusError.response?.data?.error || statusError.message));
                                      }
                                    }
                                  } else {
                                    alert(errorData?.error || 'Failed to delete user');
                                  }
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="Permanently delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            loadUsers();
          }}
          roles={roles}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            loadUsers();
          }}
          user={selectedUser}
          roles={roles}
        />
      )}
    </div>
  );
};

// Create User Modal Component - Comprehensive OpenEMR Style
const CreateUserModal = ({ isOpen, onClose, roles }) => {

  // Healthcare provider roles that need credentials
  const healthcareProviderRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant', 'Nurse', 'Medical Assistant'];
  const prescribingRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant'];

  const [formData, setFormData] = useState({
    // Basic Information
    firstName: '',
    lastName: '',
    middleName: '',
    title: '',
    email: '',
    username: '',

    // Contact Information
    phone: '',
    phoneMobile: '',
    extension: '',
    fax: '',

    // Account Settings
    roleId: '',
    status: 'active',
    password: '',
    confirmPassword: '',
    isAdmin: false, // Separate admin privileges flag

    // Healthcare Provider Credentials (conditional)
    credentials: '',
    npi: '',
    licenseNumber: '',
    licenseState: '',
    deaNumber: '',
    taxonomyCode: '',
    specialty: '',
    upin: '',

    // Additional Information
    facility: '',
    group: '',
    seeAuth: false,
    activeDirectory: false,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Determine role type (moved before step calculation)
  const selectedRole = roles?.find(r => r.id === formData.roleId);
  const isHealthcareProvider = selectedRole && healthcareProviderRoles.includes(selectedRole.name);
  const canPrescribe = selectedRole && prescribingRoles.includes(selectedRole.name);
  const adminRole = roles?.find(r => r.name === 'Admin');
  const isAdmin = selectedRole?.name === 'Admin';

  // Memoize steps to prevent infinite loops - only recalculate when role changes
  // Order: Basic Info -> Contact -> Account Settings (role selection) -> Credentials (if healthcare provider)
  const steps = useMemo(() => {
    const stepList = [
      { id: 1, name: 'Basic Info', key: 'basic' },
      { id: 2, name: 'Contact', key: 'contact' },
      { id: 3, name: 'Account Settings', key: 'settings' },
    ];

    // Add credentials step AFTER account settings if healthcare provider role is selected
    if (isHealthcareProvider && selectedRole) {
      stepList.push({ id: 4, name: 'Credentials', key: 'credentials' });
    }

    return stepList;
  }, [isHealthcareProvider, selectedRole]);

  const totalSteps = steps.length;
  const currentStepData = steps.find(s => s.id === currentStep);
  const activeTab = currentStepData?.key || 'basic';

  // Adjust current step if it's out of bounds (e.g., credentials step was removed)
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps]); // Only depend on totalSteps, not isHealthcareProvider or steps

  // Check if form has unsaved data
  const hasUnsavedData = () => {
    return !!(
      formData.firstName ||
      formData.lastName ||
      formData.email ||
      formData.username ||
      formData.password ||
      formData.phone ||
      formData.npi ||
      formData.licenseNumber ||
      formData.roleId
    );
  };

  const handleClose = () => {
    if (hasUnsavedData()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close? Your data will be lost.'
      );
      if (!confirmed) {
        return;
      }
    }
    // Reset form when closing
    setFormData({
      firstName: '', lastName: '', middleName: '', title: '', email: '', username: '',
      phone: '', phoneMobile: '', extension: '', fax: '',
      roleId: '', status: 'active', password: '', confirmPassword: '',
      credentials: '', npi: '', licenseNumber: '', licenseState: '', deaNumber: '',
      taxonomyCode: '', specialty: '', upin: '', facility: '', group: '',
      seeAuth: false, activeDirectory: false, notes: ''
    });
    setErrors({});
    setCurrentStep(1);
    onClose();
  };

  // Validate current step before proceeding
  const validateCurrentStep = () => {
    const newErrors = {};

    if (activeTab === 'basic') {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    } else if (activeTab === 'credentials' && isHealthcareProvider) {
      const role = roles.find(r => r.id === formData.roleId);
      if (role && role.name !== 'Medical Assistant' && !formData.credentials) {
        newErrors.credentials = 'Credentials are required';
      }
      if (!formData.npi) newErrors.npi = 'NPI is required';
      if (!formData.licenseNumber) newErrors.licenseNumber = 'License number is required';
      if (!formData.licenseState) newErrors.licenseState = 'License state is required';
      if (canPrescribe) {
        if (!formData.deaNumber) newErrors.deaNumber = 'DEA number is required';
        if (!formData.taxonomyCode) newErrors.taxonomyCode = 'Taxonomy code is required';
      }
      if ((role?.name === 'Physician' || role?.name === 'Nurse Practitioner') && !formData.specialty) {
        newErrors.specialty = 'Specialty is required';
      }
    } else if (activeTab === 'settings') {
      if (!formData.roleId) newErrors.roleId = 'Role is required';
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        // Comprehensive password validation
        if (formData.password.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(formData.password)) {
          newErrors.password = 'Password must contain at least one uppercase letter';
        } else if (!/[a-z]/.test(formData.password)) {
          newErrors.password = 'Password must contain at least one lowercase letter';
        } else if (!/[0-9]/.test(formData.password)) {
          newErrors.password = 'Password must contain at least one number';
        } else if (!/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(formData.password)) {
          newErrors.password = 'Password must contain at least one special character';
        }
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    const nextStep = currentStep + 1;

    // If we just completed Account Settings and selected a healthcare provider role,
    // and credentials step was just added, stay on current step until user clicks next again
    // (This handles the case where credentials step appears dynamically)
    if (nextStep <= totalSteps) {
      setCurrentStep(nextStep);
      setErrors({});
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.username && !formData.email) {
      setErrors({ username: 'Username or email is required' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    // Password validation (comprehensive)
    if (formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setErrors({ password: 'Password must contain at least one uppercase letter' });
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      setErrors({ password: 'Password must contain at least one lowercase letter' });
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setErrors({ password: 'Password must contain at least one number' });
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(formData.password)) {
      setErrors({ password: 'Password must contain at least one special character' });
      return;
    }

    // Healthcare provider validation
    if (isHealthcareProvider && selectedRole.name !== 'Medical Assistant') {
      if (!formData.credentials) {
        setErrors({ credentials: 'Credentials are required for healthcare providers' });
        return;
      }
    }

    setLoading(true);

    try {
      // Transform camelCase to snake_case for backend
      const submitData = {
        email: formData.email || formData.username + '@clinic.com',
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName,
        role_id: formData.roleId,
        status: formData.status,
        professional_type: selectedRole?.name || '',
        title: formData.title,
        phone: formData.phone,
        phone_mobile: formData.phoneMobile,
        extension: formData.extension,
        fax: formData.fax,
        notes: formData.notes,
        is_admin: formData.isAdmin || false
      };

      // Add healthcare provider fields
      if (isHealthcareProvider) {
        submitData.credentials = formData.credentials;
        submitData.npi = formData.npi;
        submitData.license_number = formData.licenseNumber;
        submitData.license_state = formData.licenseState;
        if (canPrescribe) {
          submitData.dea_number = formData.deaNumber;
          submitData.taxonomy_code = formData.taxonomyCode;
          submitData.upin = formData.upin;
        }
        if (selectedRole.name === 'Physician' || selectedRole.name === 'Nurse Practitioner') {
          submitData.specialty = formData.specialty;
        }
      }

      await usersAPI.create(submitData);
      onClose();
      // Reset form
      setFormData({
        firstName: '', lastName: '', middleName: '', title: '', email: '', username: '',
        phone: '', phoneMobile: '', extension: '', fax: '',
        roleId: '', status: 'active', password: '', confirmPassword: '',
        credentials: '', npi: '', licenseNumber: '', licenseState: '', deaNumber: '',
        taxonomyCode: '', specialty: '', upin: '', facility: '', group: '',
        seeAuth: false, activeDirectory: false, notes: ''
      });
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.errors) {
        setErrors(errorData.errors.reduce((acc, err) => {
          acc[err.param] = err.msg;
          return acc;
        }, {}));
      } else if (errorData?.error === 'Password validation failed' && errorData?.details) {
        // Handle password validation errors with details
        const passwordErrors = errorData.details.join('. ');
        setErrors({ password: passwordErrors });
      } else {
        setErrors({ general: errorData?.error || 'Failed to create user' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      preventOutsideClick={hasUnsavedData()}
      title="Add New User Account"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            <strong>Error:</strong> {errors.general}
          </div>
        )}

        {/* Step Indicator */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium text-sm ${currentStep > step.id
                      ? 'border-strong-azure text-white'
                      : currentStep === step.id
                        ? 'border-strong-azure text-strong-azure bg-strong-azure/10'
                        : 'border-gray-300 text-gray-400 bg-white'
                      }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
                      }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-strong-azure' : 'bg-gray-300'
                      }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="John"
                  />
                  {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="M"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Doe"
                  />
                  {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Dr., MD, RN, NP, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="john.doe@clinic.com"
                  />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="jdoe (optional, defaults to email)"
                />
                <p className="text-xs text-gray-500 mt-1">If not provided, email will be used as username</p>
              </div>
            </div>
          )}

          {/* Contact Information Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Primary)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    value={formData.phoneMobile}
                    onChange={(e) => setFormData({ ...formData, phoneMobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extension</label>
                  <input
                    type="text"
                    value={formData.extension}
                    onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="(555) 123-4568"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Additional notes or comments..."
                />
              </div>
            </div>
          )}

          {/* Account Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Admin Privileges Toggle - Always visible at the top */}
              {adminRole && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="adminPrivileges"
                      checked={isAdmin}
                      onChange={(e) => {
                        // Grant/revoke admin privileges WITHOUT changing the role
                        setFormData({
                          ...formData,
                          isAdmin: e.target.checked
                        });
                      }}
                      className="mt-1 h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <label htmlFor="adminPrivileges" className="block text-sm font-bold text-gray-900 cursor-pointer">
                        🔑 Grant Admin Privileges
                      </label>
                      <p className="text-xs text-gray-700 mt-1 font-medium">
                        Admin users have full system access including user management, settings, and all clinical features.
                        Only grant this to trusted personnel.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!adminRole && roles && roles.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    ⚠️ Admin role not found in roles list. Please ensure the Admin role exists in the database.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={(e) => {
                      const roleId = e.target.value;
                      const role = roles.find(r => r.id === roleId);
                      setFormData({
                        ...formData,
                        roleId,
                        professionalType: role?.name || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select role...</option>
                    {roles && Array.isArray(roles) && roles.length > 0 ? (
                      roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))
                    ) : (
                      <option value="" disabled>No roles available - please refresh</option>
                    )}
                  </select>
                  {errors.roleId && <p className="text-xs text-red-600 mt-1">{errors.roleId}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    User's professional role (e.g., Physician, Nurse, Front Desk). Admin privileges can be granted separately above.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Account status</p>
                </div>
              </div>

              {/* Professional Credentials - Show inline when healthcare provider role is selected */}
              {isHealthcareProvider && selectedRole && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Professional Credentials</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Required:</strong> Please provide all relevant professional credentials for {selectedRole.name}.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Credentials {selectedRole.name !== 'Medical Assistant' && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        required={selectedRole.name !== 'Medical Assistant'}
                        value={formData.credentials}
                        onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.credentials ? 'border-red-300' : 'border-gray-300'
                          }`}
                        placeholder="MD, DO, NP, PA-C, RN, LPN, CMA, etc."
                      />
                      <p className="text-xs text-gray-500 mt-1">Professional credentials/licenses</p>
                      {errors.credentials && <p className="text-xs text-red-600 mt-1">{errors.credentials}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NPI <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        required
                        value={formData.npi}
                        onChange={(e) => setFormData({ ...formData, npi: e.target.value.replace(/\D/g, '') })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.npi ? 'border-red-300' : 'border-gray-300'
                          }`}
                        placeholder="1234567890"
                      />
                      <p className="text-xs text-gray-500 mt-1">10-digit National Provider Identifier</p>
                      {errors.npi && <p className="text-xs text-red-600 mt-1">{errors.npi}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.licenseNumber ? 'border-red-300' : 'border-gray-300'
                          }`}
                        placeholder="Professional license number"
                      />
                      {errors.licenseNumber && <p className="text-xs text-red-600 mt-1">{errors.licenseNumber}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        required
                        value={formData.licenseState}
                        onChange={(e) => setFormData({ ...formData, licenseState: e.target.value.toUpperCase() })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.licenseState ? 'border-red-300' : 'border-gray-300'
                          }`}
                        placeholder="CA"
                      />
                      <p className="text-xs text-gray-500 mt-1">2-letter state abbreviation</p>
                      {errors.licenseState && <p className="text-xs text-red-600 mt-1">{errors.licenseState}</p>}
                    </div>
                  </div>

                  {/* Prescribing Provider Fields */}
                  {canPrescribe && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-900 mb-4">Prescribing Authority</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            DEA Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.deaNumber}
                            onChange={(e) => setFormData({ ...formData, deaNumber: e.target.value.toUpperCase() })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.deaNumber ? 'border-red-300' : 'border-gray-300'
                              }`}
                            placeholder="AB1234567"
                          />
                          <p className="text-xs text-gray-500 mt-1">Drug Enforcement Administration number</p>
                          {errors.deaNumber && <p className="text-xs text-red-600 mt-1">{errors.deaNumber}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Taxonomy Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            value={formData.taxonomyCode}
                            onChange={(e) => setFormData({ ...formData, taxonomyCode: e.target.value.slice(0, 10) })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.taxonomyCode ? 'border-red-300' : 'border-gray-300'
                              }`}
                            placeholder="207Q00000X"
                          />
                          <p className="text-xs text-gray-500 mt-1">NPI taxonomy code (10 characters max)</p>
                          {errors.taxonomyCode && <p className="text-xs text-red-600 mt-1">{errors.taxonomyCode}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">UPIN</label>
                          <input
                            type="text"
                            value={formData.upin}
                            onChange={(e) => setFormData({ ...formData, upin: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Unique Physician Identifier Number"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Specialty - For Physicians and NPs */}
                  {(selectedRole?.name === 'Physician' || selectedRole?.name === 'Nurse Practitioner') && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specialty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.specialty ? 'border-red-300' : 'border-gray-300'
                          }`}
                        placeholder="e.g., Family Medicine, Cardiology, Pediatrics, Internal Medicine"
                      />
                      <p className="text-xs text-gray-500 mt-1">Primary medical specialty</p>
                      {errors.specialty && <p className="text-xs text-red-600 mt-1">{errors.specialty}</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Password</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number, special character</p>
                    {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions - Step Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 flex items-center space-x-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 text-white rounded-lg flex items-center space-x-2 transition-all duration-200 hover:shadow-md"
                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-white rounded-lg disabled:opacity-50 flex items-center space-x-2 transition-all duration-200 hover:shadow-md"
                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating User...</span>
                  </>
                ) : (
                  <>
                    <span>Create User Account</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};

// Edit User Modal Component
const EditUserModal = ({ isOpen, onClose, user, roles }) => {
  // Healthcare provider roles that need credentials
  const healthcareProviderRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant', 'Nurse', 'Medical Assistant'];
  const prescribingRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant'];

  const [formData, setFormData] = useState({
    // Basic Information
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    middleName: user.middle_name || '',
    title: user.title || '',
    email: user.email || '',
    username: user.username || '',
    // Contact Information
    phone: user.phone || '',
    phoneMobile: user.phone_mobile || '',
    extension: user.extension || '',
    fax: user.fax || '',
    // Account Settings
    roleId: user.role_id || '',
    status: user.status || 'active',
    password: '',
    confirmPassword: '',
    isAdmin: user.is_admin || false, // Admin privileges flag
    // Healthcare Provider Credentials
    credentials: user.credentials || '',
    npi: user.npi || '',
    licenseNumber: user.license_number || '',
    licenseState: user.license_state || '',
    deaNumber: user.dea_number || '',
    taxonomyCode: user.taxonomy_code || '',
    specialty: user.specialty || '',
    upin: user.upin || '',
    facility: user.facility || '',
    notes: user.notes || ''
  });
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const selectedRole = roles.find(r => r.id === formData.roleId);
  const adminRole = roles.find(r => r.name === 'Admin');
  const isAdmin = formData.isAdmin === true || formData.isAdmin === 'true';
  const isHealthcareProvider = selectedRole && healthcareProviderRoles.includes(selectedRole.name);
  const canPrescribe = selectedRole && prescribingRoles.includes(selectedRole.name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    // Validate password if provided
    if (formData.password) {
      if (formData.password !== formData.confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' });
        setLoading(false);
        return;
      }
      if (formData.password.length < 8) {
        setErrors({ password: 'Password must be at least 8 characters' });
        setLoading(false);
        return;
      }
    }

    try {
      // Update user info
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        title: formData.title,
        email: formData.email,
        username: formData.username,
        phone: formData.phone,
        phoneMobile: formData.phoneMobile,
        extension: formData.extension,
        fax: formData.fax,
        roleId: formData.roleId,
        status: formData.status,
        credentials: formData.credentials,
        npi: formData.npi,
        licenseNumber: formData.licenseNumber,
        licenseState: formData.licenseState,
        deaNumber: formData.deaNumber,
        taxonomyCode: formData.taxonomyCode,
        specialty: formData.specialty,
        upin: formData.upin,
        facility: formData.facility,
        notes: formData.notes,
        professionalType: selectedRole?.name || '',
        isAdmin: formData.isAdmin || false
      };

      await usersAPI.update(user.id, updateData);

      // Update password separately if provided
      if (formData.password) {
        await usersAPI.updatePassword(user.id, formData.password);
      }

      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      const errorData = error.response?.data;
      if (errorData?.errors) {
        setErrors(errorData.errors.reduce((acc, err) => {
          acc[err.param] = err.msg;
          return acc;
        }, {}));
      } else if (errorData?.error === 'Password validation failed' && errorData?.details) {
        // Handle HIPAA password validation errors - show all requirements that failed
        setErrors({ password: errorData.details.join('. ') });
      } else {
        setErrors({ general: errorData?.error || 'Failed to update user' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            <strong>Error:</strong> {errors.general}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {['basic', 'contact', 'credentials', 'settings'].map((tab) => {
              const tabLabels = {
                basic: 'Basic Info',
                contact: 'Contact',
                credentials: isHealthcareProvider ? 'Credentials' : null,
                settings: 'Account Settings'
              };
              if (!tabLabels[tab] && tab === 'credentials') return null;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tabLabels[tab] || tab}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Contact Information Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Primary)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    value={formData.phoneMobile}
                    onChange={(e) => setFormData({ ...formData, phoneMobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extension</label>
                  <input
                    type="text"
                    value={formData.extension}
                    onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Credentials Tab */}
          {activeTab === 'credentials' && isHealthcareProvider && selectedRole && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800"><strong>Professional Credentials:</strong> Update credentials for {selectedRole.name}.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credentials</label>
                  <input
                    type="text"
                    value={formData.credentials}
                    onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NPI</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.npi}
                    onChange={(e) => setFormData({ ...formData, npi: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License State</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.licenseState}
                    onChange={(e) => setFormData({ ...formData, licenseState: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              {canPrescribe && (
                <div className="border-t border-gray-200 pt-4">
                  <h5 className="text-sm font-semibold text-gray-900 mb-4">Prescribing Authority</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DEA Number</label>
                      <input
                        type="text"
                        value={formData.deaNumber}
                        onChange={(e) => setFormData({ ...formData, deaNumber: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Taxonomy Code</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={formData.taxonomyCode}
                        onChange={(e) => setFormData({ ...formData, taxonomyCode: e.target.value.slice(0, 10) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="10 characters max"
                      />
                      <p className="text-xs text-gray-500 mt-1">NPI taxonomy code (10 characters max)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UPIN</label>
                      <input
                        type="text"
                        value={formData.upin}
                        onChange={(e) => setFormData({ ...formData, upin: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}
              {(selectedRole?.name === 'Physician' || selectedRole?.name === 'Nurse Practitioner') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Account Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="editAdminPrivileges"
                    checked={isAdmin}
                    onChange={(e) => {
                      // Grant/revoke admin privileges WITHOUT changing the role
                      setFormData({ ...formData, isAdmin: e.target.checked });
                    }}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label htmlFor="editAdminPrivileges" className="block text-sm font-semibold text-gray-900 cursor-pointer">
                      Grant Admin Privileges
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Admin users have full system access including user management, settings, and all clinical features.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">User's professional role. Admin privileges are granted separately above.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Change Password (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      minLength={12}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-300' : 'border-gray-300'
                        }`}
                      placeholder="Leave blank to keep current"
                    />
                    {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      minLength={12}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Confirm new password"
                    />
                    {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Min 12 chars, uppercase, lowercase, number, special character. Leave blank to keep current.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-all duration-200 hover:shadow-md"
            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserManagement;

