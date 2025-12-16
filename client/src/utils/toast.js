/**
 * Toast Notification Utility
 * 
 * Simple toast notification system for showing messages to users
 */

let toastContainer = null;
let toastQueue = [];

// Create toast container if it doesn't exist
function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-4 right-4 z-50 space-y-2';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Show a toast notification
export function showToast(message, type = 'info', duration = 4000) {
  ensureToastContainer();
  
  const toast = document.createElement('div');
  const bgColor = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }[type] || 'bg-gray-50 border-gray-200 text-gray-800';
  
  const icon = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }[type] || 'ℹ';
  
  toast.className = `${bgColor} border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-md animate-in slide-in-from-bottom-5 duration-300`;
  toast.innerHTML = `
    <span class="font-semibold">${icon}</span>
    <span class="flex-1 text-sm font-medium">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-current opacity-50 hover:opacity-100">✕</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
  
  return toast;
}

// Show error toast
export function showError(message, duration = 5000) {
  return showToast(message, 'error', duration);
}

// Show success toast
export function showSuccess(message, duration = 3000) {
  return showToast(message, 'success', duration);
}

// Show warning toast
export function showWarning(message, duration = 4000) {
  return showToast(message, 'warning', duration);
}

// Show info toast
export function showInfo(message, duration = 3000) {
  return showToast(message, 'info', duration);
}

