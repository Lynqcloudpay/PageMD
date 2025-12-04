import React, { createContext, useContext, useState, useEffect } from 'react';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
    const [tasks, setTasks] = useState([]);

    // Calculate unread count
    const unreadCount = tasks.filter(t => t.status === 'unread').length;

    // Update tasks (called from TaskManager)
    const updateTasks = (newTasks) => {
        setTasks(newTasks);
    };

    return (
        <TaskContext.Provider value={{ tasks, unreadCount, updateTasks }}>
            {children}
        </TaskContext.Provider>
    );
};








