// Custom hook for component-specific keyboard shortcuts
import { useEffect } from 'react';

export const useKeyboardShortcuts = (shortcuts, deps = []) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Build key combination string
      const parts = [];
      if (e.metaKey || e.ctrlKey) parts.push('mod');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      
      // Handle special keys
      let key = e.key.toLowerCase();
      if (key === ' ') key = 'space';
      if (key === '/') key = '/';
      if (key === 'escape') key = 'esc';
      if (key === 'enter') key = 'enter';
      
      parts.push(key);
      const combo = parts.join('+');
      
      // Find matching shortcut
      const shortcut = shortcuts[combo];
      if (shortcut) {
        // Check if we should prevent default
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, ...deps]);
};

export default useKeyboardShortcuts;














