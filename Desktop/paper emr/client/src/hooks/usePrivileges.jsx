/**
 * usePrivileges Hook
 * 
 * Provides privilege checking functionality for components
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';

export const usePrivileges = () => {
  const { user } = useAuth();
  const [privileges, setPrivileges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadPrivileges();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const loadPrivileges = async () => {
    if (!user?.id) {
      setLoading(false);
      setPrivileges([]);
      return;
    }

    try {
      setLoading(true);
      const response = await usersAPI.getPrivileges(user.id);
      setPrivileges(response.data || []);
    } catch (error) {
      console.warn('Could not load privileges (non-critical):', error.message);
      // If user is admin, they have all privileges anyway
      // So we can safely return empty array - admin check works via role
      setPrivileges([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has a specific privilege
   */
  const hasPrivilege = (privilegeName) => {
    if (!user) return false;
    
    // Admin always has all privileges
    if (user.role === 'Admin') {
      return true;
    }

    return privileges.some(p => p.name === privilegeName);
  };

  /**
   * Check if user has any of the specified privileges
   */
  const hasAnyPrivilege = (...privilegeNames) => {
    return privilegeNames.some(name => hasPrivilege(name));
  };

  /**
   * Check if user has all of the specified privileges
   */
  const hasAllPrivileges = (...privilegeNames) => {
    return privilegeNames.every(name => hasPrivilege(name));
  };

  /**
   * Check if user is admin
   */
  const isAdmin = () => {
    return user?.role === 'Admin';
  };

  return {
    privileges,
    loading,
    hasPrivilege,
    hasAnyPrivilege,
    hasAllPrivileges,
    isAdmin,
    refreshPrivileges: loadPrivileges
  };
};

/**
 * Higher-order component to protect routes/components based on privileges
 */
export const withPrivilege = (Component, requiredPrivilege) => {
  return (props) => {
    const { hasPrivilege, loading } = usePrivileges();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!hasPrivilege(requiredPrivilege)) {
      return (
        <div className="p-8 text-center">
          <p className="text-red-600">You do not have permission to access this feature.</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

