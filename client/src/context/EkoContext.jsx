import React, { createContext, useContext, useState, useCallback } from 'react';

const EkoContext = createContext(null);

export function EkoProvider({ children }) {
    // conversations: { [key: string]: { messages, conversationId, patientName, proactiveGaps, lastActive } }
    const [conversations, setConversations] = useState({});
    const [activeKey, setActiveKey] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const getConversationKey = (patientId) => patientId || 'global';

    const getConversation = useCallback((key) => {
        return conversations[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null };
    }, [conversations]);

    const updateConversation = useCallback((key, updates) => {
        setConversations(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null }),
                ...updates,
                lastActive: Date.now()
            }
        }));
    }, []);

    const setMessages = useCallback((key, messagesOrUpdater) => {
        setConversations(prev => {
            const current = prev[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null };
            const newMessages = typeof messagesOrUpdater === 'function'
                ? messagesOrUpdater(current.messages)
                : messagesOrUpdater;
            return {
                ...prev,
                [key]: { ...current, messages: newMessages, lastActive: Date.now() }
            };
        });
    }, []);

    const closeConversation = useCallback((key) => {
        setConversations(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        // If the closed one was active, switch to another or null
        setActiveKey(prev => {
            if (prev === key) {
                const remaining = Object.keys(conversations).filter(k => k !== key);
                return remaining.length > 0 ? remaining[remaining.length - 1] : null;
            }
            return prev;
        });
    }, [conversations]);

    const clearConversation = useCallback((key) => {
        setConversations(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                messages: [],
                conversationId: null,
                lastActive: Date.now()
            }
        }));
    }, []);

    const openConversations = Object.keys(conversations).filter(
        k => conversations[k]?.messages?.length > 0 || conversations[k]?.conversationId
    );

    return (
        <EkoContext.Provider value={{
            conversations,
            activeKey,
            setActiveKey,
            isOpen,
            setIsOpen,
            getConversationKey,
            getConversation,
            updateConversation,
            setMessages,
            closeConversation,
            clearConversation,
            openConversations
        }}>
            {children}
        </EkoContext.Provider>
    );
}

export function useEko() {
    const ctx = useContext(EkoContext);
    if (!ctx) throw new Error('useEko must be used within EkoProvider');
    return ctx;
}

export default EkoContext;
