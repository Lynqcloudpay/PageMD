import React from 'react';
import GridLayout from 'react-grid-layout';

const EditableModulesGrid = ({ 
    layout, 
    onLayoutChange, 
    children, 
    isEditMode,
    cols = 8,
    rowHeight = 50,
    width = 1200 
}) => {
    if (!isEditMode) {
        // When not in edit mode, render children in a normal grid
        return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                {children}
            </div>
        );
    }

    // When in edit mode, use GridLayout
    return (
        <div className="mb-6" style={{ height: 'auto', minHeight: '600px' }}>
            <GridLayout
                className="layout"
                layout={layout}
                cols={cols}
                rowHeight={rowHeight}
                width={width}
                isDraggable={true}
                isResizable={true}
                onLayoutChange={onLayoutChange}
                draggableHandle=".drag-handle"
                margin={[16, 16]}
                compactType="vertical"
            >
                {children}
            </GridLayout>
        </div>
    );
};

export default EditableModulesGrid;






