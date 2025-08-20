/**
 * MultiViewer-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Main public API class for creating and managing multiple Potree viewers.
 * This is the primary interface that users will interact with to create
 * multi-viewer applications.
 * 
 * Features:
 * - Create up to 5 synchronized viewers
 * - Flexible layout management (1x1, 1x2, 2x1, 2x2, custom)
 * - Camera and material synchronization
 * - Resource sharing optimization
 * - Extensible for future CAD features (layers, selection, drawing)
 */

import { ViewerManager } from "./ViewerManager-NEW.js";
import { ViewerConfiguration } from "./ViewerConfiguration-NEW.js";
import { EventDispatcher } from "../EventDispatcher.js";

export class MultiViewer extends EventDispatcher {
    
    constructor(containerElement, options = {}) {
        super();
        
        this.options = {
            maxViewers: 5,
            defaultLayout: '1x1',
            enableSync: true,
            autoLoadGUI: true,
            enableLayerSystem: true, // Future CAD features
            enableSelectionSystem: true,
            enableDrawingTools: true,
            ...options
        };
        
        // Initialize the manager
        this.manager = new ViewerManager(containerElement, this.options);
        
        // Configuration persistence system
        this.configurationManager = new ViewerConfiguration();
        
        // State tracking
        this.isReady = false;
        this.viewers = new Map(); // viewerId -> viewer reference
        
        // Future CAD systems (placeholders)
        this.layerSystem = null;
        this.selectionSystem = null;
        this.drawingSystem = null;
        
        this.initialize();
    }
    
    /**
     * Initialize the multi-viewer system
     */
    async initialize() {
        try {
            // Setup manager event forwarding
            this.setupManagerEvents();
            
            // Check if manager is already initialized (synchronous initialization)
            if (this.manager.isInitialized) {
                this.onManagerReady();
            } else {
                // Wait for manager to be ready
                this.manager.addEventListener('initialized', () => {
                    this.onManagerReady();
                });
            }
            
            return this;
            
        } catch (error) {
            console.error('MultiViewer initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Handle manager ready event
     */
    onManagerReady() {
        this.isReady = true;
        
        // Initialize future systems
        this.initializeFutureSystems();
        
        this.dispatchEvent({
            type: 'ready',
            multiViewer: this
        });
        
        console.log('MultiViewer ready');
    }
    
    /**
     * Setup event forwarding from manager
     */
    setupManagerEvents() {
        // Forward important events from manager
        const eventsToForward = [
            'viewer_created',
            'viewer_removed', 
            'layout_changed',
            'active_viewer_changed',
            'sync_enabled',
            'sync_disabled'
        ];
        
        eventsToForward.forEach(eventType => {
            this.manager.addEventListener(eventType, (event) => {
                this.dispatchEvent({
                    ...event,
                    multiViewer: this
                });
            });
        });
    }
    
    /**
     * Initialize future CAD systems
     */
    initializeFutureSystems() {
        if (this.options.enableLayerSystem) {
            // Placeholder for layer system
            this.layerSystem = {
                layers: new Map(),
                createLayer: (name, options) => {
                    console.log(`Layer system placeholder: createLayer('${name}')`);
                    return { name, options };
                }
            };
        }
        
        if (this.options.enableSelectionSystem) {
            // Placeholder for selection system
            this.selectionSystem = {
                selections: new Set(),
                setSelectionMode: (mode) => {
                    console.log(`Selection system placeholder: setSelectionMode('${mode}')`);
                }
            };
        }
        
        if (this.options.enableDrawingTools) {
            // Placeholder for drawing system
            this.drawingSystem = {
                tools: new Map(),
                activeTool: null,
                createPolylineTool: () => {
                    console.log('Drawing system placeholder: createPolylineTool()');
                }
            };
        }
    }
    
    /**
     * Create a new viewer
     * @param {string} viewerId - Unique identifier for the viewer
     * @param {Object} config - Viewer configuration
     * @returns {Promise<Viewer>} The created viewer instance
     */
    async createViewer(viewerId, config = {}) {
        if (!this.isReady) {
            throw new Error('MultiViewer not ready. Wait for "ready" event.');
        }
        
        try {
            const viewer = this.manager.createViewer(viewerId, config);
            this.viewers.set(viewerId, viewer);
            
            // Setup viewer for multi-viewer context
            await this.setupViewer(viewer, viewerId, config);
            
            console.log(`MultiViewer: Created viewer '${viewerId}'`);
            return viewer;
            
        } catch (error) {
            console.error(`Failed to create viewer '${viewerId}':`, error);
            throw error;
        }
    }
    
    /**
     * Setup individual viewer for multi-viewer operation
     */
    async setupViewer(viewer, viewerId, config) {
        // Load GUI for first viewer if enabled
        if (this.options.autoLoadGUI && this.viewers.size === 1) {
            try {
                await viewer.loadGUI();
                console.log(`GUI loaded for viewer '${viewerId}'`);
            } catch (error) {
                console.warn(`Failed to load GUI for viewer '${viewerId}':`, error);
            }
        }
        
        // Setup viewer-specific configuration
        viewer.multiViewer = this;
        viewer.multiViewerId = viewerId;
        
        // Future: Setup CAD integrations
        if (this.layerSystem) {
            viewer.layerManager = this.layerSystem;
        }
        
        if (this.selectionSystem) {
            viewer.selectionManager = this.selectionSystem;
        }
        
        if (this.drawingSystem) {
            viewer.drawingManager = this.drawingSystem;
        }
    }
    
    /**
     * Remove a viewer
     * @param {string} viewerId - ID of viewer to remove
     * @returns {boolean} Success status
     */
    removeViewer(viewerId) {
        try {
            const success = this.manager.removeViewer(viewerId);
            if (success) {
                this.viewers.delete(viewerId);
                console.log(`MultiViewer: Removed viewer '${viewerId}'`);
            }
            return success;
        } catch (error) {
            console.error(`Failed to remove viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Get viewer by ID
     * @param {string} viewerId
     * @returns {Viewer|null}
     */
    getViewer(viewerId) {
        return this.viewers.get(viewerId) || null;
    }
    
    /**
     * Get viewer by name
     * @param {string} name - Viewer name
     * @returns {Viewer|null}
     */
    getViewerByName(name) {
        return this.manager.registry.getViewerByName(name);
    }
    
    /**
     * Find viewers by name (supports partial matching)
     * @param {string} name - Name to search for
     * @param {boolean} exactMatch - Whether to do exact matching (default: false)
     * @returns {Array} Array of {id, name, viewer} objects
     */
    findViewersByName(name, exactMatch = false) {
        return this.manager.registry.findViewersByName(name, exactMatch);
    }
    
    /**
     * Find viewers by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} Array of matching viewer info objects
     */
    findViewersByCriteria(criteria) {
        return this.manager.registry.findViewersByCriteria(criteria);
    }
    
    /**
     * Rename a viewer
     * @param {string} viewerId - Viewer ID to rename
     * @param {string} newName - New name for the viewer
     * @returns {boolean} Success status
     */
    renameViewer(viewerId, newName) {
        return this.manager.registry.renameViewer(viewerId, newName);
    }
    
    /**
     * Get viewer ID by viewer instance
     * @param {Viewer} viewer - Viewer instance
     * @returns {string|null}
     */
    getViewerIdByInstance(viewer) {
        return this.manager.registry.getViewerIdByInstance(viewer);
    }
    
    /**
     * Check if viewer name is already in use
     * @param {string} name - Name to check
     * @param {string} excludeId - Optional viewer ID to exclude from check
     * @returns {boolean}
     */
    isViewerNameTaken(name, excludeId = null) {
        return this.manager.registry.isViewerNameTaken(name, excludeId);
    }
    
    /**
     * Generate unique viewer name
     * @param {string} baseName - Base name for the viewer
     * @returns {string}
     */
    generateUniqueViewerName(baseName = 'Viewer') {
        return this.manager.registry.generateUniqueViewerName(baseName);
    }
    
    /**
     * Generate unique viewer ID
     * @param {string} baseName - Base name for the ID
     * @returns {string}
     */
    generateUniqueViewerId(baseName = 'viewer') {
        return this.manager.registry.generateUniqueViewerId(baseName);
    }
    
    /**
     * Auto-assign descriptive names based on current layout
     */
    autoAssignNames() {
        const currentLayout = this.getLayout();
        this.manager.registry.autoAssignNames(currentLayout);
    }
    
    /**
     * Enable or disable camera synchronization for all viewers
     * @param {boolean} enabled - Whether to enable sync
     */
    setSyncEnabled(enabled) {
        let updatedCount = 0;
        
        // Update sync state via ViewerManager to ensure it uses the real viewer objects
        const allViewers = this.manager.registry.getAllViewers();
        
        Object.keys(allViewers).forEach(viewerId => {
            const success = this.manager.setViewerSyncEnabled(viewerId, enabled);
            if (success) {
                updatedCount++;
            }
        });
        
        console.log(`MultiViewer: Camera synchronization ${enabled ? 'enabled' : 'disabled'} for ${updatedCount} viewers`);
    }
    
    /**
     * Enable or disable camera synchronization for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {boolean} enabled - Whether to enable sync
     */
    setViewerSyncEnabled(viewerId, enabled) {
        const viewer = this.getViewer(viewerId);
        if (viewer && viewer.multiViewerConfig) {
            viewer.multiViewerConfig.syncEnabled = enabled;
            console.log(`MultiViewer: Camera synchronization ${enabled ? 'enabled' : 'disabled'} for viewer '${viewerId}'`);
            return true;
        }
        return false;
    }
    
    /**
     * Check if camera synchronization is enabled globally
     * @returns {boolean}
     */
    isSyncEnabled() {
        let enabledCount = 0;
        let totalCount = 0;
        
        this.viewers.forEach((viewer, viewerId) => {
            totalCount++;
            if (viewer.multiViewerConfig && viewer.multiViewerConfig.syncEnabled) {
                enabledCount++;
            }
        });
        
        console.log(`MultiViewer: Sync check - ${enabledCount}/${totalCount} viewers have sync enabled`);
        return enabledCount > 0;
    }
    
    /**
     * Dynamically add a new viewer at runtime
     * @param {string} viewerId - Unique ID for the new viewer
     * @param {Object} config - Viewer configuration
     * @returns {Promise<Viewer|null>} The created viewer instance
     */
    async addViewer(viewerId, config = {}) {
        if (this.viewers.has(viewerId)) {
            console.warn(`MultiViewer: Viewer '${viewerId}' already exists`);
            return null;
        }
        
        try {
            const viewer = await this.createViewer(viewerId, config);
            console.log(`MultiViewer: Dynamically added viewer '${viewerId}' (${this.viewers.size} total)`);
            return viewer;
        } catch (error) {
            console.error(`MultiViewer: Failed to add viewer '${viewerId}':`, error);
            return null;
        }
    }
    
    /**
     * Dynamically remove a viewer at runtime
     * @param {string} viewerId - ID of viewer to remove
     * @returns {boolean} Success status
     */
    removeViewer(viewerId) {
        if (!this.viewers.has(viewerId)) {
            console.warn(`MultiViewer: Viewer '${viewerId}' not found for removal`);
            return false;
        }
        
        try {
            // Remove from MultiViewer's viewer map
            this.viewers.delete(viewerId);
            
            // Remove from ViewerManager (handles cleanup)
            const success = this.manager.removeViewer(viewerId);
            
            if (success) {
                console.log(`MultiViewer: Dynamically removed viewer '${viewerId}' (${this.viewers.size} remaining)`);
                
                // Update layout if needed (check if layout exists)
                if (this.layout && typeof this.layout.updateLayout === 'function') {
                    this.layout.updateLayout();
                } else {
                    console.warn('MultiViewer: Layout system not available for update');
                }
                
                return true;
            } else {
                // Re-add to map if manager removal failed
                console.error(`MultiViewer: Failed to remove viewer '${viewerId}' from manager`);
                return false;
            }
        } catch (error) {
            console.error(`MultiViewer: Error removing viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Get list of all viewer IDs
     * @returns {Array<string>} Array of viewer IDs
     */
    getViewerIds() {
        return Array.from(this.viewers.keys());
    }
    
    /**
     * Get viewer count
     * @returns {number} Number of viewers
     */
    getViewerCount() {
        return this.viewers.size;
    }
    
    /**
     * Check if viewer exists
     * @param {string} viewerId - Viewer ID to check
     * @returns {boolean} Whether viewer exists
     */
    hasViewer(viewerId) {
        return this.viewers.has(viewerId);
    }
    
    /**
     * Get sync system (for testing and debugging)
     * @returns {ViewerSync}
     */
    get syncSystem() {
        return this.manager.sync;
    }
    
    /**
     * Get all viewers
     * @returns {Object} Map of viewerId -> Viewer
     */
    getAllViewers() {
        const result = {};
        this.viewers.forEach((viewer, viewerId) => {
            result[viewerId] = viewer;
        });
        return result;
    }
    
    /**
     * Get active viewer (receives input focus)
     * @returns {Viewer|null}
     */
    getActiveViewer() {
        return this.manager.getActiveViewer();
    }
    
    /**
     * Set active viewer
     * @param {string} viewerId
     * @returns {boolean} Success status
     */
    setActiveViewer(viewerId) {
        return this.manager.setActiveViewer(viewerId);
    }
    
    /**
     * Set layout pattern
     * @param {string} layoutPattern - Layout identifier (e.g., '2x2', 'main-profile')
     * @returns {boolean} Success status
     */
    setLayout(layoutPattern) {
        try {
            this.manager.setLayout(layoutPattern);
            return true;
        } catch (error) {
            console.error(`Failed to set layout '${layoutPattern}':`, error);
            return false;
        }
    }
    
    /**
     * Get current layout
     * @returns {string} Current layout pattern
     */
    getLayout() {
        return this.manager.getLayout();
    }
    
    /**
     * Get available layout patterns
     * @returns {Array} Array of layout names
     */
    getAvailableLayouts() {
        return this.manager.layout.getAvailableLayouts();
    }
    
    /**
     * Define custom layout pattern
     * @param {string} name - Layout name
     * @param {Object} definition - Layout definition
     */
    defineLayout(name, definition) {
        this.manager.layout.defineLayout(name, definition);
    }
    
    /**
     * Enable synchronization between viewers
     * @param {Array} viewerIds - Array of viewer IDs to sync
     * @param {Object} options - Sync options
     * @returns {string|null} Sync group ID
     */
    syncViewers(viewerIds, options = {}) {
        try {
            return this.manager.setSyncEnabled(viewerIds, options);
        } catch (error) {
            console.error('Failed to sync viewers:', error);
            return null;
        }
    }
    
    /**
     * Disable synchronization
     * @param {string|Array} groupIdOrViewers - Group ID or array of viewer IDs
     * @returns {boolean} Success status
     */
    unsyncViewers(groupIdOrViewers) {
        try {
            return this.manager.sync.setSyncDisabled(groupIdOrViewers);
        } catch (error) {
            console.error('Failed to unsync viewers:', error);
            return false;
        }
    }
    
    /**
     * Load point cloud in all viewers (or specified viewers)
     * @param {string} path - Path to point cloud
     * @param {string} name - Display name
     * @param {Array} viewerIds - Optional: specific viewers to load into
     * @returns {Promise} Promise that resolves when loading completes
     */
    async loadPointCloud(path, name, viewerIds = null) {
        try {
            const targetViewers = viewerIds || Array.from(this.viewers.keys());
            
            console.log(`MultiViewer: Loading point cloud '${name}' into ${targetViewers.length} viewers (shared resources)`);
            
            // Use shared resource loading
            const results = await this.manager.loadPointCloudIntoMultipleViewers(targetViewers, path, name);
            
            console.log(`MultiViewer: ✓ Point cloud '${name}' loaded with resource sharing`);
            console.log(`MultiViewer: ✓ Memory efficiency: 1 dataset → ${targetViewers.length} viewers`);
            
            return results;
            
        } catch (error) {
            console.error(`Failed to load point cloud '${name}':`, error);
            throw error;
        }
    }
    
    /**
     * Load point cloud into single viewer with resource sharing
     * @param {string} viewerId - Target viewer ID
     * @param {string} path - Path to point cloud
     * @param {string} name - Display name
     * @returns {Promise} Loading promise
     */
    async loadPointCloudIntoViewer(viewerId, path, name) {
        try {
            console.log(`MultiViewer: Loading point cloud '${name}' into viewer '${viewerId}' (shared)`);
            
            const result = await this.manager.loadPointCloudIntoViewer(viewerId, path, name);
            
            console.log(`MultiViewer: ✓ Point cloud '${name}' loaded into viewer '${viewerId}'`);
            return result;
            
        } catch (error) {
            console.error(`Failed to load point cloud '${name}' into viewer '${viewerId}':`, error);
            throw error;
        }
    }
    
    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        return this.manager.getMemoryStats();
    }
    
    /**
     * Set camera position for a specific viewer
     * @param {string} viewerId - The viewer ID
     * @param {Object} position - Position {x, y, z}
     * @param {Object} options - Additional options {target, animate, duration}
     * @returns {boolean} Success status
     */
    setCameraPosition(viewerId, position, options = {}) {
        return this.manager.setCameraPosition(viewerId, position, options);
    }
    
    /**
     * Get camera position for a specific viewer
     * @param {string} viewerId - The viewer ID
     * @returns {Object|null} Position {x, y, z} or null if not available
     */
    getCameraPosition(viewerId) {
        return this.manager.getCameraPosition(viewerId);
    }
    
    /**
     * Capture current camera state for a viewer
     * @param {string} viewerId - The viewer ID
     * @returns {Object} Camera state snapshot
     */
    captureCameraState(viewerId) {
        return this.manager.captureCameraState(viewerId);
    }
    
    /**
     * Restore camera state for a viewer
     * @param {string} viewerId - The viewer ID
     * @param {Object} cameraState - Camera state to restore (optional)
     * @returns {boolean} Success status
     */
    restoreCameraState(viewerId, cameraState = null) {
        return this.manager.restoreCameraState(viewerId, cameraState);
    }
    
    /**
     * Get all camera states for all viewers
     * @returns {Object} Map of viewerId -> camera state
     */
    getAllCameraStates() {
        const states = {};
        this.viewers.forEach((viewer, viewerId) => {
            states[viewerId] = this.manager.captureCameraState(viewerId);
        });
        return states;
    }
    
    /**
     * Set independent camera views (disable sync temporarily)
     * @param {Object} cameraStates - Map of viewerId -> camera state
     * @param {Object} options - Options {restoreSync}
     * @returns {Object} Results {success: boolean, applied: number}
     */
    setIndependentCameraViews(cameraStates, options = {}) {
        let appliedCount = 0;
        let hasErrors = false;
        
        // Temporarily disable sync
        const previousSyncStates = {};
        this.viewers.forEach((viewer, viewerId) => {
            previousSyncStates[viewerId] = viewer.multiViewerConfig.syncEnabled;
            viewer.multiViewerConfig.syncEnabled = false;
        });
        
        // Apply camera states
        for (const [viewerId, cameraState] of Object.entries(cameraStates)) {
            if (this.viewers.has(viewerId)) {
                if (this.manager.restoreCameraState(viewerId, cameraState)) {
                    appliedCount++;
                } else {
                    hasErrors = true;
                }
            }
        }
        
        // Restore sync if requested
        if (options.restoreSync !== false) {
            setTimeout(() => {
                this.viewers.forEach((viewer, viewerId) => {
                    viewer.multiViewerConfig.syncEnabled = previousSyncStates[viewerId];
                });
            }, 100);
        }
        
        console.log(`MultiViewer: Set independent camera views for ${appliedCount} viewers`);
        
        return {
            success: !hasErrors,
            applied: appliedCount,
            total: Object.keys(cameraStates).length
        };
    }
    
    /**
     * Get viewer names mapped to IDs
     * @returns {Object} Map of name -> viewerId
     */
    getViewerNameMap() {
        return this.manager.registry.getViewerNameMap();
    }
    
    /**
     * Get detailed viewer information for debugging
     * @returns {Array} Array of detailed viewer info
     */
    getDetailedViewerInfo() {
        return this.manager.registry.getDetailedViewerInfo();
    }
    
    /**
     * Get registry statistics including identification info
     * @returns {Object} Registry statistics
     */
    getRegistryStats() {
        return this.manager.registry.getStatistics();
    }
    
    /**
     * Get manager status and statistics
     * @returns {Object} Status information
     */
    getStatus() {
        const registryStats = this.getRegistryStats();
        
        return {
            ...this.manager.getStatus(),
            isReady: this.isReady,
            apiVersion: '1.0.0',
            features: {
                multiViewer: true,
                layerSystem: !!this.layerSystem,
                selectionSystem: !!this.selectionSystem,
                drawingSystem: !!this.drawingSystem,
                identification: true,
                naming: true,
                search: true
            },
            registry: {
                totalViewers: registryStats.totalViewers,
                activeViewers: registryStats.activeViewers,
                viewerNames: registryStats.nameList,
                viewerIds: registryStats.idList
            }
        };
    }
    
    /**
     * Save current configuration to storage
     * @param {string} name - Configuration name (default: 'default')
     * @returns {Promise<boolean>} Success status
     */
    async saveConfiguration(name = 'default') {
        try {
            const config = this.configurationManager.captureConfiguration(this);
            const success = this.configurationManager.saveToStorage(config, name);
            
            if (success) {
                console.log(`MultiViewer: Configuration '${name}' saved successfully`);
                this.dispatchEvent({
                    type: 'configuration_saved',
                    name: name,
                    config: config,
                    multiViewer: this
                });
            }
            
            return success;
        } catch (error) {
            console.error(`MultiViewer: Failed to save configuration '${name}':`, error);
            return false;
        }
    }

    /**
     * Load configuration from storage
     * @param {string} name - Configuration name to load
     * @returns {Promise<boolean>} Success status
     */
    async loadConfiguration(name = 'default') {
        try {
            const config = this.configurationManager.loadFromStorage(name);
            if (!config) {
                console.warn(`MultiViewer: Configuration '${name}' not found`);
                return false;
            }

            const success = await this.configurationManager.restoreConfiguration(this, config);
            
            if (success) {
                console.log(`MultiViewer: Configuration '${name}' loaded successfully`);
                this.dispatchEvent({
                    type: 'configuration_loaded',
                    name: name,
                    config: config,
                    multiViewer: this
                });
            }
            
            return success;
        } catch (error) {
            console.error(`MultiViewer: Failed to load configuration '${name}':`, error);
            return false;
        }
    }

    /**
     * Get current configuration as object
     * @returns {Object} Current configuration
     */
    captureConfiguration() {
        try {
            return this.configurationManager.captureConfiguration(this);
        } catch (error) {
            console.error('MultiViewer: Failed to capture configuration:', error);
            return null;
        }
    }

    /**
     * Restore configuration from object
     * @param {Object} config - Configuration object to restore
     * @returns {Promise<boolean>} Success status
     */
    async restoreConfiguration(config) {
        try {
            const success = await this.configurationManager.restoreConfiguration(this, config);
            
            if (success) {
                this.dispatchEvent({
                    type: 'configuration_restored',
                    config: config,
                    multiViewer: this
                });
            }
            
            return success;
        } catch (error) {
            console.error('MultiViewer: Failed to restore configuration:', error);
            return false;
        }
    }

    /**
     * List all saved configurations
     * @returns {Array<string>} Array of configuration names
     */
    listConfigurations() {
        return this.configurationManager.listConfigurations();
    }

    /**
     * Delete a saved configuration
     * @param {string} name - Configuration name to delete
     * @returns {boolean} Success status
     */
    deleteConfiguration(name) {
        const success = this.configurationManager.deleteConfiguration(name);
        
        if (success) {
            this.dispatchEvent({
                type: 'configuration_deleted',
                name: name,
                multiViewer: this
            });
        }
        
        return success;
    }

    /**
     * Export configuration to JSON file
     * @param {string} filename - Optional filename
     * @param {string} configName - Optional stored configuration name to export
     */
    async exportConfigurationToFile(filename = null, configName = null) {
        try {
            let config;
            
            if (configName) {
                config = this.configurationManager.loadFromStorage(configName);
                if (!config) {
                    throw new Error(`Configuration '${configName}' not found`);
                }
            } else {
                config = this.configurationManager.captureConfiguration(this);
            }
            
            const exportFilename = filename || `potree-multiviewer-${configName || 'current'}-${Date.now()}.json`;
            this.configurationManager.exportToFile(config, exportFilename);
            
            console.log(`MultiViewer: Configuration exported to ${exportFilename}`);
            
        } catch (error) {
            console.error('MultiViewer: Failed to export configuration:', error);
        }
    }

    /**
     * Import configuration from JSON file
     * @param {File} file - File object to import
     * @param {string} saveName - Optional name to save imported config
     * @returns {Promise<boolean>} Success status
     */
    async importConfigurationFromFile(file, saveName = null) {
        try {
            const config = await this.configurationManager.importFromFile(file);
            
            // Optionally save to storage
            if (saveName) {
                this.configurationManager.saveToStorage(config, saveName);
                console.log(`MultiViewer: Imported configuration saved as '${saveName}'`);
            }
            
            // Restore the configuration
            const success = await this.configurationManager.restoreConfiguration(this, config);
            
            if (success) {
                this.dispatchEvent({
                    type: 'configuration_imported',
                    filename: file.name,
                    saveName: saveName,
                    config: config,
                    multiViewer: this
                });
            }
            
            return success;
        } catch (error) {
            console.error('MultiViewer: Failed to import configuration:', error);
            return false;
        }
    }

    /**
     * Export complete configuration for persistence
     * @returns {Object} Serializable configuration
     */
    exportConfiguration() {
        const config = {
            version: '1.0.0',
            options: this.options,
            layout: this.manager.layout.exportConfiguration(),
            sync: this.manager.sync.exportConfiguration(),
            viewers: {}
        };
        
        // Export viewer-specific configurations
        this.viewers.forEach((viewer, viewerId) => {
            config.viewers[viewerId] = {
                // Add viewer-specific settings here
                camera: {}
            };
            
            // Safely extract camera data
            if (viewer.scene && viewer.scene.view) {
                const view = viewer.scene.view;
                config.viewers[viewerId].camera = {
                    position: view.position.toArray(),
                    yaw: view.yaw,
                    pitch: view.pitch,
                    radius: view.radius
                };
            }
            // Future: Add layer, selection, drawing configurations
        });
        
        return config;
    }
    
    /**
     * Import configuration from exported data
     * @param {Object} config - Previously exported configuration
     * @returns {Promise} Promise that resolves when import completes
     */
    async importConfiguration(config) {
        if (!config.version || config.version !== '1.0.0') {
            console.warn('Configuration version mismatch, import may fail');
        }
        
        try {
            // Import layout configuration
            if (config.layout) {
                this.manager.layout.importConfiguration(config.layout);
            }
            
            // Import sync configuration
            if (config.sync) {
                this.manager.sync.importConfiguration(config.sync);
            }
            
            // Import viewer-specific configurations
            if (config.viewers) {
                for (const [viewerId, viewerConfig] of Object.entries(config.viewers)) {
                    const viewer = this.getViewer(viewerId);
                    if (viewer && viewerConfig.camera && viewer.scene) {
                        const view = viewer.scene.view;
                        if (viewerConfig.camera.position) {
                            view.position.fromArray(viewerConfig.camera.position);
                        }
                        if (typeof viewerConfig.camera.yaw === 'number') {
                            view.yaw = viewerConfig.camera.yaw;
                        }
                        if (typeof viewerConfig.camera.pitch === 'number') {
                            view.pitch = viewerConfig.camera.pitch;
                        }
                        if (typeof viewerConfig.camera.radius === 'number') {
                            view.radius = viewerConfig.camera.radius;
                        }
                    }
                }
            }
            
            console.log('Configuration imported successfully');
            
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw error;
        }
    }
    
    /**
     * Future CAD Features - Get layer manager
     * @returns {Object} Layer manager instance
     */
    getLayerManager() {
        return this.layerSystem;
    }
    
    /**
     * Future CAD Features - Get selection manager
     * @returns {Object} Selection manager instance
     */
    getSelectionManager() {
        return this.selectionSystem;
    }
    
    /**
     * Future CAD Features - Get drawing manager
     * @returns {Object} Drawing manager instance
     */
    getDrawingManager() {
        return this.drawingSystem;
    }
    
    /**
     * Cleanup and destroy multi-viewer
     */
    destroy() {
        try {
            // Cleanup viewers
            this.viewers.clear();
            
            // Cleanup manager
            this.manager.destroy();
            
            // Cleanup future systems
            this.layerSystem = null;
            this.selectionSystem = null;
            this.drawingSystem = null;
            
            this.isReady = false;
            
            this.dispatchEvent({
                type: 'destroyed',
                multiViewer: this
            });
            
            console.log('MultiViewer destroyed');
            
        } catch (error) {
            console.error('Error during MultiViewer destruction:', error);
        }
    }
}

// Static factory method for easier instantiation
MultiViewer.create = async function(containerElement, options = {}) {
    const multiViewer = new MultiViewer(containerElement, options);
    await multiViewer.initialize();
    return multiViewer;
};