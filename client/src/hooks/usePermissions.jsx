/**
 * usePermissions Hook
 * 
 * Provides permission checking functionality for React components
 * Uses permissions array from user context instead of role checks
 */

import { useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Check if user has a specific permission
 * @param {string} permissionKey - Permission key (e.g., 'patients:view_list')
 * @returns {boolean}
 */
export function usePermissions() {
  const { user } = useContext(AuthContext);

  /**
   * Check if user has a specific permission
   * @param {string} permissionKey - Permission key to check
   * @returns {boolean}
   */
  const can = useCallback((permissionKey) => {
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }
    return user.permissions.includes(permissionKey);
  }, [user]);

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean}
   */
  const canAny = useCallback((permissionKeys) => {
    if (!Array.isArray(permissionKeys)) return false;
    return permissionKeys.some(key => can(key));
  }, [can]);

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean}
   */
  const canAll = useCallback((permissionKeys) => {
    if (!Array.isArray(permissionKeys)) return false;
    return permissionKeys.every(key => can(key));
  }, [can]);

  /**
   * Get user's scope configuration
   * @returns {Object} { scheduleScope, patientScope }
   */
  const getScope = useCallback(() => {
    return user?.scope || { scheduleScope: 'CLINIC', patientScope: 'CLINIC' };
  }, [user]);

  return {
    can,
    canAny,
    canAll,
    getScope,
    permissions: user?.permissions || [],
    scope: user?.scope || { scheduleScope: 'CLINIC', patientScope: 'CLINIC' }
  };
}

/**
 * Higher-order component to conditionally render based on permissions
 * @param {string|string[]} permission - Permission key(s) required
 * @param {React.Component} Component - Component to render if permission granted
 * @param {React.Component} Fallback - Optional fallback component
 */
export function withPermission(permission, Component, Fallback = null) {
  return function PermissionWrapper(props) {
    const { can, canAny } = usePermissions();
    const hasPermission = Array.isArray(permission)
      ? canAny(permission)
      : can(permission);

    if (!hasPermission) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}




