import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const KeyboardShortcutsContext = createContext();

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
};

export const KeyboardShortcutsProvider = ({ children }) => {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [shortcuts] = useState({
    // Global shortcuts
    'mod+k': { action: () => {}, description: 'Search patients', global: true },
    'mod+/': { action: () => setShowHelp(!showHelp), description: 'Show keyboard shortcuts', global: true },
    'mod+1': { action: () => navigate('/dashboard'), description: 'Go to Dashboard', global: true },
    'mod+2': { action: () => navigate('/schedule'), description: 'Go to Schedule', global: true },
    'mod+3': { action: () => navigate('/patients'), description: 'Go to Patients', global: true },
    'mod+4': { action: () => navigate('/tasks'), description: 'Go to In Basket', global: true },
    'mod+5': { action: () => navigate('/messages'), description: 'Go to Messages', global: true },
    'mod+6': { action: () => navigate('/analytics'), description: 'Go to Analytics', global: true },
    'mod+n': { action: () => navigate('/patients'), description: 'New Patient', global: true },
    'mod+s': { action: () => {}, description: 'Save (context-dependent)', global: false },
    'mod+enter': { action: () => {}, description: 'Sign Note (in visit)', global: false },
    'esc': { action: () => {}, description: 'Close modal/dialog', global: false },
  });

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
      if (shortcut && (shortcut.global || e.target.tagName === 'BODY' || e.target.tagName === 'DIV')) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return (
    <KeyboardShortcutsContext.Provider value={{ shortcuts, showHelp, setShowHelp }}>
      {children}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}
    </KeyboardShortcutsContext.Provider>
  );
};

const KeyboardShortcutsHelp = ({ onClose }) => {
  const shortcuts = [
    { combo: '⌘K / Ctrl+K', description: 'Search patients' },
    { combo: '⌘/ / Ctrl+/', description: 'Show keyboard shortcuts' },
    { combo: '⌘1-7 / Ctrl+1-7', description: 'Navigate to different sections' },
    { combo: '⌘N / Ctrl+N', description: 'New Patient' },
    { combo: '⌘S / Ctrl+S', description: 'Save (context-dependent)' },
    { combo: 'Esc', description: 'Close modal/dialog' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full animate-scale-in">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-semibold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded text-neutral-700 dark:text-neutral-300">
                  {shortcut.combo}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsContext;

