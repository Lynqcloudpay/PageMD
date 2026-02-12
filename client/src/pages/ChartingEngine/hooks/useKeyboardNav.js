/**
 * useKeyboardNav.js
 * Keyboard navigation and shortcuts for the charting experience.
 * - Cmd/Ctrl+K → open command palette
 * - / (outside inputs) → open command palette
 * - F2 → jump to next [placeholder]
 * - Dot-phrase autocomplete (.htn, .dm2, etc.)
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { hpiDotPhrases } from '../../../data/hpiDotPhrases';

export function useKeyboardNav() {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [commandSearchQuery, setCommandSearchQuery] = useState('');
    const [autocompleteState, setAutocompleteState] = useState({
        show: false,
        suggestions: [],
        position: { top: 0, left: 0 },
        selectedIndex: 0,
        field: null,
        textareaRef: null,
        matchStart: 0,
        matchEnd: 0,
    });

    // ── Global Keyboard Shortcuts ─────────────────────────────────────────

    useEffect(() => {
        const handleKeyPress = (e) => {
            // Cmd/Ctrl+K → command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(true);
                return;
            }
            // / outside inputs → command palette
            if (
                e.key === '/' &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // ── F2: Jump to Next Placeholder ──────────────────────────────────────

    const handleF2Key = useCallback((e, textareaRef) => {
        if (e.key !== 'F2' || !textareaRef.current) return;
        e.preventDefault();

        const textarea = textareaRef.current;
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        const placeholderRegex = /\[([^\]]+)\]/g;

        let match;
        let found = false;

        // Find next placeholder after cursor
        while ((match = placeholderRegex.exec(text)) !== null) {
            if (match.index >= cursorPos) {
                textarea.setSelectionRange(match.index, match.index + match[0].length);
                found = true;
                break;
            }
        }

        // Wrap around to beginning
        if (!found) {
            placeholderRegex.lastIndex = 0;
            match = placeholderRegex.exec(text);
            if (match) {
                textarea.setSelectionRange(match.index, match.index + match[0].length);
            }
        }
    }, []);

    // ── Dot-Phrase Autocomplete Detection ─────────────────────────────────

    const handleDotPhraseAutocomplete = useCallback((value, field, textareaRef) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);

        // Only trigger if dot is at start of line/after whitespace with ≥1 letter after
        const dotPhraseMatch = textBeforeCursor.match(/(?:^|[\s\n])\.([a-z][a-z0-9_]*)$/i);

        if (dotPhraseMatch && dotPhraseMatch[1].length >= 1) {
            const partialPhrase = dotPhraseMatch[1].toLowerCase();
            const suggestions = Object.keys(hpiDotPhrases)
                .filter(key => {
                    const keyLower = key.toLowerCase().replace('.', '');
                    return keyLower.startsWith(partialPhrase) || keyLower.includes(partialPhrase);
                })
                .slice(0, 8)
                .map(key => ({ key, template: hpiDotPhrases[key], display: key }));

            if (suggestions.length > 0) {
                const lineHeight = 18;
                const lines = textBeforeCursor.split('\n');
                const currentLine = lines.length - 1;
                const top = (currentLine * lineHeight) + lineHeight + 2;
                const matchLen = dotPhraseMatch[0].startsWith('.')
                    ? dotPhraseMatch[0].length
                    : dotPhraseMatch[0].length - 1;

                setAutocompleteState({
                    show: true,
                    suggestions,
                    position: { top, left: 0 },
                    selectedIndex: 0,
                    field,
                    textareaRef,
                    matchStart: cursorPos - matchLen,
                    matchEnd: cursorPos,
                });
            } else {
                setAutocompleteState(prev => ({ ...prev, show: false }));
            }
        } else {
            setAutocompleteState(prev => ({ ...prev, show: false }));
        }
    }, []);

    // ── Insert Dot Phrase ─────────────────────────────────────────────────

    const insertDotPhrase = useCallback((phrase, updateField) => {
        if (!autocompleteState.textareaRef?.current) return;

        const textarea = autocompleteState.textareaRef.current;
        const template = hpiDotPhrases[phrase];
        if (!template) return;

        const currentValue = textarea.value;
        const before = currentValue.substring(0, autocompleteState.matchStart);
        const after = currentValue.substring(autocompleteState.matchEnd);
        const newValue = before + template + after;

        updateField(autocompleteState.field, newValue);

        setTimeout(() => {
            const newCursorPos = before.length + template.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);

        setAutocompleteState(prev => ({ ...prev, show: false }));
    }, [autocompleteState]);

    // ── Close Command Palette ─────────────────────────────────────────────

    const closeCommandPalette = useCallback(() => {
        setCommandPaletteOpen(false);
        setCommandSearchQuery('');
    }, []);

    return {
        // Command palette
        commandPaletteOpen,
        setCommandPaletteOpen,
        commandSearchQuery,
        setCommandSearchQuery,
        closeCommandPalette,
        // Autocomplete
        autocompleteState,
        setAutocompleteState,
        // Handlers
        handleF2Key,
        handleDotPhraseAutocomplete,
        insertDotPhrase,
    };
}

export default useKeyboardNav;
