/**
 * ViewerRegistry-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Registry for tracking and managing multiple viewer instances.
 * Provides lookup, validation, and metadata management for viewers.
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class ViewerRegistry extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.viewers = new Map(); // viewerId -> ViewerInfo
        this.viewerOrder = []; // Track creation order
    }
    
    /**
     * Register a new viewer
     * @param {string} viewerId - Unique viewer identifier
     * @param {Viewer} viewer - Potree viewer instance
     * @param {Object} config - Viewer configuration
     */
    registerViewer(viewerId, viewer, config = {}) {
        if (this.viewers.has(viewerId)) {
            throw new Error(`Viewer '${viewerId}' is already registered`);
        }
        
        const viewerInfo = {
            id: viewerId,
            viewer: viewer,
            config: config,
            createdAt: Date.now(),
            name: config.name || viewerId,
            isActive: false,
            metadata: {
                // Future CAD features
                layers: new Set(),
                selections: new Set(),
                drawings: new Set(),
                // Performance tracking
                renderCount: 0,
                lastRenderTime: 0
            }
        };
        
        this.viewers.set(viewerId, viewerInfo);
        this.viewerOrder.push(viewerId);
        
        this.dispatchEvent({
            type: 'viewer_registered',
            viewerId: viewerId,
            viewerInfo: viewerInfo
        });
        
        console.log(`Registered viewer '${viewerId}' (${this.viewers.size} total)`);
    }
    
    /**
     * Unregister a viewer
     * @param {string} viewerId - Viewer to unregister
     */
    unregisterViewer(viewerId) {
        const viewerInfo = this.viewers.get(viewerId);
        if (!viewerInfo) {
            console.warn(`Viewer '${viewerId}' not found for unregistration`);
            return false;
        }
        
        // Remove from maps and arrays
        this.viewers.delete(viewerId);
        const orderIndex = this.viewerOrder.indexOf(viewerId);
        if (orderIndex !== -1) {
            this.viewerOrder.splice(orderIndex, 1);
        }
        
        this.dispatchEvent({
            type: 'viewer_unregistered',
            viewerId: viewerId,
            viewerInfo: viewerInfo
        });
        
        console.log(`Unregistered viewer '${viewerId}' (${this.viewers.size} remaining)`);
        return true;
    }
    
    /**
     * Check if viewer exists
     * @param {string} viewerId
     * @returns {boolean}
     */
    hasViewer(viewerId) {
        return this.viewers.has(viewerId);
    }
    
    /**
     * Get viewer instance
     * @param {string} viewerId
     * @returns {Viewer|null}
     */
    getViewer(viewerId) {
        const viewerInfo = this.viewers.get(viewerId);
        return viewerInfo ? viewerInfo.viewer : null;
    }
    
    /**
     * Get viewer info (includes metadata)
     * @param {string} viewerId
     * @returns {Object|null}
     */
    getViewerInfo(viewerId) {
        return this.viewers.get(viewerId) || null;
    }
    
    /**
     * Get all viewers as a map of id -> viewer instance
     * @returns {Object}
     */
    getAllViewers() {
        const result = {};
        this.viewers.forEach((viewerInfo, viewerId) => {
            result[viewerId] = viewerInfo.viewer;
        });
        return result;
    }
    
    /**
     * Get all viewer info objects
     * @returns {Array}
     */
    getAllViewerInfo() {
        return Array.from(this.viewers.values());
    }
    
    /**
     * Get viewers in creation order
     * @returns {Array} Array of viewer instances
     */
    getViewersInOrder() {
        return this.viewerOrder.map(id => this.getViewer(id)).filter(Boolean);
    }
    
    /**
     * Get viewer count
     * @returns {number}
     */
    getViewerCount() {
        return this.viewers.size;
    }
    
    /**
     * Find viewer by name
     * @param {string} name
     * @returns {Viewer|null}
     */
    getViewerByName(name) {
        for (const viewerInfo of this.viewers.values()) {
            if (viewerInfo.name === name) {
                return viewerInfo.viewer;
            }
        }
        return null;
    }
    
    /**
     * Get viewer ID by viewer instance
     * @param {Viewer} viewer
     * @returns {string|null}
     */
    getViewerIdByInstance(viewer) {
        for (const [viewerId, viewerInfo] of this.viewers.entries()) {
            if (viewerInfo.viewer === viewer) {
                return viewerId;
            }
        }
        return null;
    }
    
    /**
     * Find viewers by name (supports partial matching)
     * @param {string} name - Name to search for
     * @param {boolean} exactMatch - Whether to do exact matching (default: false)
     * @returns {Array} Array of {id, name, viewer} objects
     */
    findViewersByName(name, exactMatch = false) {
        const results = [];
        const searchName = exactMatch ? name : name.toLowerCase();
        
        for (const [viewerId, viewerInfo] of this.viewers.entries()) {
            const viewerName = exactMatch ? viewerInfo.name : viewerInfo.name.toLowerCase();
            
            if (exactMatch ? viewerName === searchName : viewerName.includes(searchName)) {
                results.push({
                    id: viewerId,
                    name: viewerInfo.name,
                    viewer: viewerInfo.viewer,
                    metadata: viewerInfo.metadata
                });
            }
        }
        
        return results;
    }
    
    /**
     * Find viewers by metadata criteria
     * @param {Object} criteria - Search criteria object
     * @returns {Array} Array of matching viewer info objects
     */
    findViewersByCriteria(criteria) {
        const results = [];
        
        for (const [viewerId, viewerInfo] of this.viewers.entries()) {
            let matches = true;
            
            // Check each criteria
            for (const [key, value] of Object.entries(criteria)) {
                if (key === 'isActive' && viewerInfo.isActive !== value) {
                    matches = false;
                    break;
                }
                if (key === 'hasLayers' && viewerInfo.metadata.layers.size === 0) {
                    matches = false;
                    break;
                }
                if (key === 'hasSelections' && viewerInfo.metadata.selections.size === 0) {
                    matches = false;
                    break;
                }
                if (key === 'hasDrawings' && viewerInfo.metadata.drawings.size === 0) {
                    matches = false;
                    break;
                }
                if (key === 'minRenderCount' && viewerInfo.metadata.renderCount < value) {
                    matches = false;
                    break;
                }
                if (key === 'createdAfter' && viewerInfo.createdAt < value) {
                    matches = false;
                    break;
                }
                if (key === 'createdBefore' && viewerInfo.createdAt > value) {
                    matches = false;
                    break;
                }
            }
            
            if (matches) {
                results.push({
                    id: viewerId,
                    name: viewerInfo.name,
                    viewer: viewerInfo.viewer,
                    info: viewerInfo
                });
            }
        }
        
        return results;
    }
    
    /**
     * Rename a viewer
     * @param {string} viewerId - Viewer ID to rename
     * @param {string} newName - New name for the viewer
     * @returns {boolean} Success status
     */
    renameViewer(viewerId, newName) {
        const viewerInfo = this.viewers.get(viewerId);
        if (!viewerInfo) {
            console.warn(`Cannot rename viewer '${viewerId}' - not found`);
            return false;
        }
        
        const oldName = viewerInfo.name;
        viewerInfo.name = newName;
        
        this.dispatchEvent({
            type: 'viewer_renamed',
            viewerId: viewerId,
            oldName: oldName,
            newName: newName
        });
        
        console.log(`Viewer '${viewerId}' renamed from '${oldName}' to '${newName}'`);
        return true;
    }
    
    /**
     * Get viewer names mapped to IDs
     * @returns {Object} Map of name -> viewerId
     */
    getViewerNameMap() {
        const nameMap = {};
        
        this.viewers.forEach((viewerInfo, viewerId) => {
            nameMap[viewerInfo.name] = viewerId;
        });
        
        return nameMap;
    }
    
    /**
     * Check if viewer name is already in use
     * @param {string} name - Name to check
     * @param {string} excludeId - Optional viewer ID to exclude from check
     * @returns {boolean}
     */
    isViewerNameTaken(name, excludeId = null) {
        for (const [viewerId, viewerInfo] of this.viewers.entries()) {
            if (viewerId !== excludeId && viewerInfo.name === name) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Generate unique viewer name
     * @param {string} baseName - Base name for the viewer
     * @returns {string}
     */
    generateUniqueViewerName(baseName = 'Viewer') {
        let counter = 1;
        let viewerName = baseName;
        
        while (this.isViewerNameTaken(viewerName)) {
            viewerName = `${baseName} ${counter}`;
            counter++;
        }
        
        return viewerName;
    }
    
    /**
     * Auto-assign descriptive names based on layout position
     * @param {string} layoutPattern - Current layout pattern
     */
    autoAssignNames(layoutPattern) {
        const viewers = this.getViewersInOrder();
        const namePatterns = {
            '1x1': ['Main View'],
            '1x2': ['Left View', 'Right View'],
            '2x1': ['Top View', 'Bottom View'],
            '2x2': ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'],
            '1x3': ['Left View', 'Center View', 'Right View'],
            '3x1': ['Top View', 'Middle View', 'Bottom View'],
            'main-profile': ['Main View', 'Profile View'],
            'main-dual': ['Main View', 'Top View', 'Bottom View']
        };
        
        const names = namePatterns[layoutPattern] || [];
        
        viewers.forEach((viewer, index) => {
            if (index < names.length) {
                const viewerId = this.getViewerIdByInstance(viewer);
                if (viewerId) {
                    this.renameViewer(viewerId, names[index]);
                }
            }
        });
        
        console.log(`Auto-assigned names for layout '${layoutPattern}'`);
    }
    
    /**
     * Update viewer metadata
     * @param {string} viewerId
     * @param {Object} metadata
     */
    updateViewerMetadata(viewerId, metadata) {
        const viewerInfo = this.viewers.get(viewerId);
        if (viewerInfo) {
            Object.assign(viewerInfo.metadata, metadata);
            
            this.dispatchEvent({
                type: 'viewer_metadata_updated',
                viewerId: viewerId,
                metadata: viewerInfo.metadata
            });
        }
    }
    
    /**
     * Set viewer active state
     * @param {string} viewerId
     * @param {boolean} isActive
     */
    setViewerActive(viewerId, isActive) {
        const viewerInfo = this.viewers.get(viewerId);
        if (viewerInfo) {
            viewerInfo.isActive = isActive;
            
            this.dispatchEvent({
                type: 'viewer_active_state_changed',
                viewerId: viewerId,
                isActive: isActive
            });
        }
    }
    
    /**
     * Get active viewer ID
     * @returns {string|null}
     */
    getActiveViewerId() {
        for (const [viewerId, viewerInfo] of this.viewers.entries()) {
            if (viewerInfo.isActive) {
                return viewerId;
            }
        }
        return null;
    }
    
    /**
     * Get active viewer instance
     * @returns {Viewer|null}
     */
    getActiveViewer() {
        const activeId = this.getActiveViewerId();
        return activeId ? this.getViewer(activeId) : null;
    }
    
    /**
     * Validate viewer ID format
     * @param {string} viewerId
     * @returns {boolean}
     */
    validateViewerId(viewerId) {
        if (typeof viewerId !== 'string' || viewerId.length === 0) {
            return false;
        }
        
        // Allow alphanumeric, underscore, dash
        return /^[a-zA-Z0-9_-]+$/.test(viewerId);
    }
    
    /**
     * Generate unique viewer ID
     * @param {string} baseName - Base name for the ID
     * @returns {string}
     */
    generateUniqueViewerId(baseName = 'viewer') {
        let counter = 1;
        let viewerId = baseName;
        
        while (this.hasViewer(viewerId)) {
            viewerId = `${baseName}_${counter}`;
            counter++;
        }
        
        return viewerId;
    }
    
    /**
     * Get registry statistics
     * @returns {Object}
     */
    getStatistics() {
        const stats = {
            totalViewers: this.viewers.size,
            activeViewers: 0,
            creationTimes: [],
            renderCounts: [],
            nameMap: {},
            idList: [],
            nameList: []
        };
        
        this.viewers.forEach((viewerInfo, viewerId) => {
            if (viewerInfo.isActive) {
                stats.activeViewers++;
            }
            stats.creationTimes.push(viewerInfo.createdAt);
            stats.renderCounts.push(viewerInfo.metadata.renderCount);
            stats.nameMap[viewerInfo.name] = viewerId;
            stats.idList.push(viewerId);
            stats.nameList.push(viewerInfo.name);
        });
        
        return stats;
    }
    
    /**
     * Get detailed viewer information for debugging
     * @returns {Array} Array of detailed viewer info
     */
    getDetailedViewerInfo() {
        const details = [];
        
        this.viewers.forEach((viewerInfo, viewerId) => {
            details.push({
                id: viewerId,
                name: viewerInfo.name,
                isActive: viewerInfo.isActive,
                createdAt: new Date(viewerInfo.createdAt).toISOString(),
                config: { ...viewerInfo.config },
                metadata: {
                    layers: viewerInfo.metadata.layers.size,
                    selections: viewerInfo.metadata.selections.size,
                    drawings: viewerInfo.metadata.drawings.size,
                    renderCount: viewerInfo.metadata.renderCount,
                    lastRenderTime: viewerInfo.metadata.lastRenderTime
                },
                hasViewer: !!viewerInfo.viewer,
                hasRenderer: !!(viewerInfo.viewer && viewerInfo.viewer.renderer),
                hasScene: !!(viewerInfo.viewer && viewerInfo.viewer.scene)
            });
        });
        
        return details;
    }
    
    /**
     * Export registry data for persistence
     * @returns {Object}
     */
    exportData() {
        const data = {
            viewers: [],
            viewerOrder: [...this.viewerOrder],
            exportedAt: Date.now()
        };
        
        this.viewers.forEach((viewerInfo, viewerId) => {
            data.viewers.push({
                id: viewerId,
                name: viewerInfo.name,
                config: viewerInfo.config,
                createdAt: viewerInfo.createdAt,
                metadata: {
                    // Export only serializable metadata
                    layers: Array.from(viewerInfo.metadata.layers),
                    selections: Array.from(viewerInfo.metadata.selections),
                    drawings: Array.from(viewerInfo.metadata.drawings)
                }
            });
        });
        
        return data;
    }
    
    /**
     * Clear all viewers from registry
     */
    clear() {
        const viewerIds = Array.from(this.viewers.keys());
        viewerIds.forEach(id => {
            this.unregisterViewer(id);
        });
    }
    
    /**
     * Cleanup registry resources
     */
    destroy() {
        this.clear();
        this.removeAllListeners();
    }
}