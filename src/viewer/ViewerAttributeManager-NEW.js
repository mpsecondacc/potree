/**
 * ViewerAttributeManager-NEW.js
 * 
 * Manages viewer-specific attribute settings with localStorage persistence
 * Allows setting different visualization attributes per viewer and remembers them
 */

class ViewerAttributeManager {
    constructor() {
        this.STORAGE_KEY = 'potree_viewer_attributes';
        this.DEFAULT_ATTRIBUTES = [
            'intensity_gradient', // 1st viewer
            'classification',     // 2nd viewer  
            'rgba',              // 3rd viewer
            'intensity'          // 4th viewer
        ];
        
        // Load saved attributes from localStorage
        this.loadFromStorage();
    }
    
    /**
     * Load viewer attributes from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.viewerAttributes = stored ? JSON.parse(stored) : {};
            console.log('ViewerAttributeManager: Loaded attributes from storage:', this.viewerAttributes);
        } catch (error) {
            console.warn('ViewerAttributeManager: Failed to load from storage:', error);
            this.viewerAttributes = {};
        }
    }
    
    /**
     * Save viewer attributes to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.viewerAttributes));
            console.log('ViewerAttributeManager: Saved attributes to storage:', this.viewerAttributes);
        } catch (error) {
            console.error('ViewerAttributeManager: Failed to save to storage:', error);
        }
    }
    
    /**
     * Get the stored or default attribute for a viewer
     * @param {string} viewerId - Viewer ID
     * @param {number} viewerIndex - Index of viewer in creation order
     * @returns {string} Attribute name
     */
    getViewerAttribute(viewerId, viewerIndex = 0) {
        // Check if we have a stored preference for this viewer
        if (this.viewerAttributes[viewerId]) {
            return this.viewerAttributes[viewerId];
        }
        
        // Use default based on viewer index
        const defaultAttribute = this.DEFAULT_ATTRIBUTES[viewerIndex % this.DEFAULT_ATTRIBUTES.length];
        console.log(`ViewerAttributeManager: Using default attribute '${defaultAttribute}' for viewer '${viewerId}' (index ${viewerIndex})`);
        
        return defaultAttribute;
    }
    
    /**
     * Set and persist attribute for a viewer
     * @param {string} viewerId - Viewer ID
     * @param {string} attribute - Attribute name
     */
    setViewerAttribute(viewerId, attribute) {
        this.viewerAttributes[viewerId] = attribute;
        this.saveToStorage();
        console.log(`ViewerAttributeManager: Set viewer '${viewerId}' to attribute '${attribute}'`);
    }
    
    /**
     * Apply attribute to a point cloud material (safely deferred)
     * @param {string} viewerId - Viewer ID
     * @param {Object} material - Point cloud material
     * @param {number} viewerIndex - Index of viewer in creation order
     */
    applyViewerAttribute(viewerId, material, viewerIndex = 0) {
        // Defer to avoid interfering with point cloud loading
        setTimeout(() => {
            try {
                const targetAttribute = this.getViewerAttribute(viewerId, viewerIndex);
                
                // Apply the attribute if material is ready
                if (material && material.activeAttributeName !== undefined) {
                    material.activeAttributeName = targetAttribute;
                    console.log(`ViewerAttributeManager: ✓ Applied attribute '${targetAttribute}' to viewer '${viewerId}' (deferred)`);
                } else {
                    console.warn(`ViewerAttributeManager: Could not apply attribute to viewer '${viewerId}' - material not ready`);
                }
            } catch (error) {
                console.error(`ViewerAttributeManager: Error applying attribute to viewer '${viewerId}':`, error);
            }
        }, 150); // Slightly longer delay to ensure loading is complete
    }
    
    /**
     * Get all stored viewer attributes
     * @returns {Object} Map of viewerId -> attribute
     */
    getAllViewerAttributes() {
        return { ...this.viewerAttributes };
    }
    
    /**
     * Clear all stored viewer attributes
     */
    clearAllAttributes() {
        this.viewerAttributes = {};
        this.saveToStorage();
        console.log('ViewerAttributeManager: Cleared all stored attributes');
    }
    
    /**
     * Remove attribute for a specific viewer
     * @param {string} viewerId - Viewer ID
     */
    removeViewerAttribute(viewerId) {
        delete this.viewerAttributes[viewerId];
        this.saveToStorage();
        console.log(`ViewerAttributeManager: Removed attribute for viewer '${viewerId}'`);
    }
    
    /**
     * Get available attribute options
     * @returns {Array} List of available attributes
     */
    getAvailableAttributes() {
        return [
            'rgb',
            'rgba',
            'intensity',
            'intensity_gradient',
            'classification',
            'elevation',
            'elevation_gradient',
            'depth',
            'depth_gradient'
        ];
    }
}

// Make available globally for traditional script usage
if (typeof window !== 'undefined') {
    window.ViewerAttributeManager = ViewerAttributeManager;
}

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewerAttributeManager;
}