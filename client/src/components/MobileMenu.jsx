import React, { useState } from 'react';
import { Menu, X, Calendar, Users, ClipboardList, MessageSquare, Video, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { can } = usePermissions();

  // Filter nav items based on permissions
  const allNavItems = [
    { path: '/schedule', icon: Calendar, label: 'Schedule', permission: 'schedule:view' },
    { path: '/patients', icon: Users, label: 'Patients', permission: 'patients:view_list' },
    { path: '/tasks', icon: ClipboardList, label: 'In Basket', permission: null }, // No permission check
    { path: '/messages', icon: MessageSquare, label: 'Messages', permission: null }, // No permission check
    { path: '/telehealth', icon: Video, label: 'Telehealth', permission: null }, // No permission check
  ];
  
  const navItems = allNavItems.filter(item => !item.permission || can(item.permission));

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <>
      {/* Mobile Menu Button - REMOVED per user request */}

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-800 rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 space-y-2">
              {user && (
                <div className="px-4 py-2">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                    {user.role || user.role_name || 'User'}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileMenu;
