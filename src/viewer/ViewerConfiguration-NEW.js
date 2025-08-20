/**
 * ViewerConfiguration-NEW.js
 * Comprehensive configuration persistence system for multi-viewer setups
 * Handles saving/restoring complete viewer layouts, camera states, and viewer-specific settings
 */

export class ViewerConfiguration {
    constructor() {
        this.storageKey = 'potree-multiviewer-config';
        this.version = '1.0.0';
    }

    /**
     * Capture complete configuration state from MultiViewer instance
     * @param {MultiViewer} multiViewer - The MultiViewer instance to capture state from
     * @returns {Object} Complete configuration object
     */
    captureConfiguration(multiViewer) {
        if (!multiViewer || !multiViewer.manager) {
            throw new Error('ViewerConfiguration: Invalid MultiViewer instance');
        }

        const config = {
            version: this.version,
            timestamp: Date.now(),
            layout: this.captureLayout(multiViewer),
            viewers: this.captureViewers(multiViewer),
            sync: this.captureSyncState(multiViewer),
            metadata: this.captureMetadata(multiViewer)
        };

        console.log('ViewerConfiguration: Captured configuration with', Object.keys(config.viewers).length, 'viewers');
        return config;
    }

    /**
     * Capture layout configuration
     * @param {MultiViewer} multiViewer
     * @returns {Object} Layout configuration
     */
    captureLayout(multiViewer) {
        const layout = multiViewer.manager.layout; // Use manager.layout instead of multiViewer.layout
        const currentLayout = layout ? layout.currentLayout : '1x1';
        
        console.log(`ViewerConfiguration: Capturing layout - current: ${currentLayout}`);
        
        return {
            currentLayout: currentLayout,
            containerDimensions: this.captureContainerDimensions(multiViewer.container),
            gridConfig: layout ? layout.gridConfig : null
        };
    }

    /**
     * Capture container dimensions
     * @param {HTMLElement} container
     * @returns {Object} Container dimensions
     */
    captureContainerDimensions(container) {
        if (!container) return null;
        
        const rect = container.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            clientWidth: container.clientWidth,
            clientHeight: container.clientHeight
        };
    }

    /**
     * Capture all viewer states
     * @param {MultiViewer} multiViewer
     * @returns {Object} Viewers configuration object
     */
    captureViewers(multiViewer) {
        const viewersConfig = {};
        const registry = multiViewer.manager.registry;
        
        // getAllViewers() returns an object, not a Map
        const allViewers = registry.getAllViewers();
        
        for (const [viewerId, viewer] of Object.entries(allViewers)) {
            // Get viewer info from registry to access config
            const viewerInfo = registry.getViewerInfo(viewerId);
            const config = viewerInfo ? viewerInfo.config : {};
            
            viewersConfig[viewerId] = this.captureViewerState(viewer, viewerId, config);
        }

        return viewersConfig;
    }

    /**
     * Capture individual viewer state
     * @param {Viewer} viewer - Potree viewer instance
     * @param {string} viewerId - Viewer identifier
     * @param {Object} config - Viewer configuration
     * @returns {Object} Viewer state configuration
     */
    captureViewerState(viewer, viewerId, config) {
        const viewerState = {
            id: viewerId,
            config: { ...config },
            camera: this.captureCameraState(viewer),
            pointClouds: this.capturePointClouds(viewer),
            materials: this.captureMaterialSettings(viewer),
            controls: this.captureControlSettings(viewer),
            ui: this.captureUISettings(viewer),
            isActive: config.isActive || false,
            container: this.captureViewerContainer(viewer)
        };

        return viewerState;
    }

    /**
     * Capture camera state from viewer
     * @param {Viewer} viewer
     * @returns {Object} Camera state
     */
    captureCameraState(viewer) {
        if (!viewer || !viewer.scene || !viewer.scene.view) {
            return null;
        }

        const view = viewer.scene.view;
        const position = view.position;
        const target = view.getPivot ? view.getPivot() : { x: 0, y: 0, z: 0 };
        
        return {
            position: { x: position.x, y: position.y, z: position.z },
            target: { x: target.x, y: target.y, z: target.z },
            fov: view.fov,
            radius: view.radius,
            projectionType: view.projectionType,
            navigationMode: view.navigationMode
        };
    }

    /**
     * Capture point cloud information
     * @param {Viewer} viewer
     * @returns {Array} Point cloud configurations
     */
    capturePointClouds(viewer) {
        const pointClouds = [];
        
        if (viewer.scene && viewer.scene.pointclouds) {
            viewer.scene.pointclouds.forEach(pc => {
                if (pc && pc.pcoGeometry) {
                    pointClouds.push({
                        url: pc.pcoGeometry.url,
                        name: pc.name || 'Unnamed',
                        visible: pc.visible,
                        position: pc.position ? { x: pc.position.x, y: pc.position.y, z: pc.position.z } : null,
                        rotation: pc.rotation ? { x: pc.rotation.x, y: pc.rotation.y, z: pc.rotation.z } : null,
                        scale: pc.scale ? { x: pc.scale.x, y: pc.scale.y, z: pc.scale.z } : null
                    });
                }
            });
        }

        return pointClouds;
    }

    /**
     * Capture material settings
     * @param {Viewer} viewer
     * @returns {Object} Material settings
     */
    captureMaterialSettings(viewer) {
        if (!viewer.scene || !viewer.scene.pointclouds || viewer.scene.pointclouds.length === 0) {
            return {};
        }

        const material = viewer.scene.pointclouds[0].material;
        if (!material) return {};

        return {
            size: material.size,
            pointSizeType: material.pointSizeType,
            pointColorType: material.pointColorType,
            pointShape: material.pointShape,
            opacity: material.opacity,
            activeAttributeName: material.activeAttributeName
        };
    }

    /**
     * Capture control settings
     * @param {Viewer} viewer
     * @returns {Object} Control settings
     */
    captureControlSettings(viewer) {
        if (!viewer.scene || !viewer.scene.view) return {};

        return {
            controlsEnabled: viewer.controls ? viewer.controls.enabled : true,
            navigationMode: viewer.scene.view.navigationMode,
            keyboardEnabled: viewer.keyboardEnabled || false
        };
    }

    /**
     * Capture UI settings
     * @param {Viewer} viewer
     * @returns {Object} UI settings
     */
    captureUISettings(viewer) {
        return {
            sidebarVisible: viewer.toggleSidebar ? true : false,
            minimapVisible: viewer.mapView ? viewer.mapView.visible : false
        };
    }

    /**
     * Capture viewer container information
     * @param {Viewer} viewer
     * @returns {Object} Container information
     */
    captureViewerContainer(viewer) {
        if (!viewer.renderArea) return null;

        const rect = viewer.renderArea.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top
        };
    }

    /**
     * Capture sync state
     * @param {MultiViewer} multiViewer
     * @returns {Object} Sync configuration
     */
    captureSyncState(multiViewer) {
        const sync = multiViewer.manager.sync;
        if (!sync) return { enabled: false };

        // Get active viewer ID from manager's activeViewerId property
        const activeViewerId = multiViewer.manager.activeViewerId || null;

        return {
            enabled: sync.isEnabled, // This is a property, not a method
            syncCamera: sync.syncCamera || false,
            syncMaterial: sync.syncMaterial || false,
            activeViewerId: activeViewerId
        };
    }

    /**
     * Capture metadata
     * @param {MultiViewer} multiViewer
     * @returns {Object} Metadata
     */
    captureMetadata(multiViewer) {
        return {
            viewerCount: multiViewer.getViewerCount(),
            createdAt: Date.now(),
            userAgent: navigator.userAgent,
            screenResolution: {
                width: screen.width,
                height: screen.height
            }
        };
    }

    /**
     * Restore complete configuration to MultiViewer instance
     * @param {MultiViewer} multiViewer - Target MultiViewer instance
     * @param {Object} config - Configuration object to restore
     * @returns {Promise<boolean>} Success status
     */
    async restoreConfiguration(multiViewer, config) {
        if (!config || !config.version) {
            throw new Error('ViewerConfiguration: Invalid configuration object');
        }

        if (!multiViewer || !multiViewer.manager) {
            throw new Error('ViewerConfiguration: Invalid MultiViewer instance');
        }

        console.log('ViewerConfiguration: Restoring configuration from', new Date(config.timestamp));

        try {
            console.log('ViewerConfiguration: Starting restoration process...');
            console.log('ViewerConfiguration: Config layout:', config.layout);
            console.log('ViewerConfiguration: Config viewers:', Object.keys(config.viewers));
            
            // Clear existing viewers first
            await this.clearMultiViewer(multiViewer);

            // Restore viewers first (they need to exist for layout to work)
            await this.restoreViewers(multiViewer, config.viewers);

            // Then restore layout (now that viewers exist)
            await this.restoreLayout(multiViewer, config.layout);

            // Finally restore sync state
            await this.restoreSyncState(multiViewer, config.sync);

            console.log('ViewerConfiguration: Successfully restored configuration with', Object.keys(config.viewers).length, 'viewers');
            return true;

        } catch (error) {
            console.error('ViewerConfiguration: Failed to restore configuration:', error);
            return false;
        }
    }

    /**
     * Clear existing MultiViewer state
     * @param {MultiViewer} multiViewer
     */
    async clearMultiViewer(multiViewer) {
        // Get all viewer IDs before clearing
        const viewerIds = Array.from(multiViewer.viewers.keys());
        
        // Remove all viewers
        for (const viewerId of viewerIds) {
            multiViewer.removeViewer(viewerId);
        }

        // Reset to default layout
        multiViewer.setLayout('1x1');
    }

    /**
     * Restore layout configuration
     * @param {MultiViewer} multiViewer
     * @param {Object} layoutConfig
     */
    async restoreLayout(multiViewer, layoutConfig) {
        if (!layoutConfig) return;

        // Set layout after viewers are restored
        if (layoutConfig.currentLayout) {
            console.log(`ViewerConfiguration: Restoring layout '${layoutConfig.currentLayout}' with ${multiViewer.getViewerCount()} viewers`);
            
            multiViewer.setLayout(layoutConfig.currentLayout);
            
            // Force a layout update to ensure proper dimensions
            if (multiViewer.manager && multiViewer.manager.layout) {
                multiViewer.manager.layout.updateLayout();
                console.log('ViewerConfiguration: Forced layout update after restoration');
            }
        }
    }

    /**
     * Restore all viewers
     * @param {MultiViewer} multiViewer
     * @param {Object} viewersConfig
     */
    async restoreViewers(multiViewer, viewersConfig) {
        if (!viewersConfig) return;

        // Restore viewers in order
        const viewerIds = Object.keys(viewersConfig);
        
        for (const viewerId of viewerIds) {
            const viewerConfig = viewersConfig[viewerId];
            try {
                await this.restoreViewer(multiViewer, viewerId, viewerConfig);
            } catch (error) {
                console.error(`ViewerConfiguration: Failed to restore viewer '${viewerId}':`, error);
            }
        }

        // Set active viewer
        const activeViewer = viewerIds.find(id => viewersConfig[id].isActive);
        if (activeViewer) {
            multiViewer.activateViewer(activeViewer);
        }
    }

    /**
     * Restore individual viewer
     * @param {MultiViewer} multiViewer
     * @param {string} viewerId
     * @param {Object} viewerConfig
     */
    async restoreViewer(multiViewer, viewerId, viewerConfig) {
        console.log(`ViewerConfiguration: Restoring viewer '${viewerId}' with config:`, viewerConfig.config);
        
        // Create viewer with restored config
        const viewer = await multiViewer.addViewer(viewerId, viewerConfig.config);
        if (!viewer) {
            throw new Error(`Failed to create viewer '${viewerId}'`);
        }

        console.log(`ViewerConfiguration: Successfully created viewer '${viewerId}'`);

        // Restore point clouds
        await this.restorePointClouds(viewer, viewerConfig.pointClouds);

        // Restore camera state
        await this.restoreCameraState(viewer, viewerConfig.camera);

        // Restore material settings
        this.restoreMaterialSettings(viewer, viewerConfig.materials);

        // Restore control settings
        this.restoreControlSettings(viewer, viewerConfig.controls);

        // Restore UI settings
        this.restoreUISettings(viewer, viewerConfig.ui);
        
        console.log(`ViewerConfiguration: Completed restoration for viewer '${viewerId}'`);
    }

    /**
     * Restore point clouds
     * @param {Viewer} viewer
     * @param {Array} pointClouds
     */
    async restorePointClouds(viewer, pointClouds) {
        if (!pointClouds || pointClouds.length === 0) return;

        for (const pcConfig of pointClouds) {
            try {
                console.log(`ViewerConfiguration: Attempting to restore point cloud '${pcConfig.name}' from ${pcConfig.url}`);
                
                // Skip point cloud restoration for now to avoid errors
                // The point cloud loading in configuration restore needs to be implemented properly
                // This is a temporary fix to prevent the configuration loading from failing
                console.warn(`ViewerConfiguration: Skipping point cloud restoration for '${pcConfig.name}' (not yet implemented)`);
                
            } catch (error) {
                console.error(`ViewerConfiguration: Failed to restore point cloud '${pcConfig.name}':`, error);
            }
        }

        // Don't call fitToScreen() if no point clouds were loaded
        console.log(`ViewerConfiguration: Point cloud restoration skipped for this release`);
    }

    /**
     * Restore camera state
     * @param {Viewer} viewer
     * @param {Object} cameraConfig
     */
    async restoreCameraState(viewer, cameraConfig) {
        if (!cameraConfig || !viewer.scene || !viewer.scene.view) return;

        const view = viewer.scene.view;

        // Restore camera properties
        if (cameraConfig.position) {
            view.position.set(cameraConfig.position.x, cameraConfig.position.y, cameraConfig.position.z);
        }

        if (cameraConfig.target) {
            view.lookAt(cameraConfig.target.x, cameraConfig.target.y, cameraConfig.target.z);
        }

        if (cameraConfig.fov !== undefined) {
            view.fov = cameraConfig.fov;
        }

        if (cameraConfig.radius !== undefined) {
            view.radius = cameraConfig.radius;
        }

        if (cameraConfig.projectionType !== undefined) {
            view.projectionType = cameraConfig.projectionType;
        }

        if (cameraConfig.navigationMode !== undefined) {
            view.navigationMode = cameraConfig.navigationMode;
        }
    }

    /**
     * Restore material settings
     * @param {Viewer} viewer
     * @param {Object} materialConfig
     */
    restoreMaterialSettings(viewer, materialConfig) {
        if (!materialConfig || !viewer.scene || !viewer.scene.pointclouds) return;

        viewer.scene.pointclouds.forEach(pc => {
            const material = pc.material;
            if (!material) return;

            if (materialConfig.size !== undefined) {
                material.size = materialConfig.size;
            }
            if (materialConfig.pointSizeType !== undefined) {
                material.pointSizeType = materialConfig.pointSizeType;
            }
            if (materialConfig.pointColorType !== undefined) {
                material.pointColorType = materialConfig.pointColorType;
            }
            if (materialConfig.pointShape !== undefined) {
                material.pointShape = materialConfig.pointShape;
            }
            if (materialConfig.opacity !== undefined) {
                material.opacity = materialConfig.opacity;
            }
            if (materialConfig.activeAttributeName !== undefined) {
                material.activeAttributeName = materialConfig.activeAttributeName;
            }
        });
    }

    /**
     * Restore control settings
     * @param {Viewer} viewer
     * @param {Object} controlConfig
     */
    restoreControlSettings(viewer, controlConfig) {
        if (!controlConfig) return;

        if (controlConfig.controlsEnabled !== undefined && viewer.controls) {
            viewer.controls.enabled = controlConfig.controlsEnabled;
        }

        if (controlConfig.navigationMode !== undefined && viewer.scene && viewer.scene.view) {
            viewer.scene.view.navigationMode = controlConfig.navigationMode;
        }

        if (controlConfig.keyboardEnabled !== undefined) {
            viewer.keyboardEnabled = controlConfig.keyboardEnabled;
        }
    }

    /**
     * Restore UI settings
     * @param {Viewer} viewer
     * @param {Object} uiConfig
     */
    restoreUISettings(viewer, uiConfig) {
        if (!uiConfig) return;

        // UI restoration would depend on specific UI elements available
        // This is a placeholder for future UI state restoration
    }

    /**
     * Restore sync state
     * @param {MultiViewer} multiViewer
     * @param {Object} syncConfig
     */
    async restoreSyncState(multiViewer, syncConfig) {
        if (!syncConfig || !multiViewer.manager.sync) return;

        const sync = multiViewer.manager.sync;

        // Set the sync enabled state directly on the property
        if (syncConfig.enabled !== undefined) {
            sync.isEnabled = syncConfig.enabled;
            console.log(`ViewerConfiguration: Restored sync enabled state: ${syncConfig.enabled}`);
        }

        if (syncConfig.syncCamera !== undefined) {
            sync.syncCamera = syncConfig.syncCamera;
        }

        if (syncConfig.syncMaterial !== undefined) {
            sync.syncMaterial = syncConfig.syncMaterial;
        }

        if (syncConfig.activeViewerId && multiViewer.hasViewer(syncConfig.activeViewerId)) {
            multiViewer.setActiveViewer(syncConfig.activeViewerId);
            console.log(`ViewerConfiguration: Restored active viewer: ${syncConfig.activeViewerId}`);
        }
    }

    /**
     * Save configuration to localStorage
     * @param {Object} config - Configuration object to save
     * @param {string} name - Optional name for the configuration
     */
    saveToStorage(config, name = 'default') {
        try {
            const storageKey = `${this.storageKey}-${name}`;
            const serializedConfig = JSON.stringify(config, null, 2);
            localStorage.setItem(storageKey, serializedConfig);
            console.log(`ViewerConfiguration: Saved configuration '${name}' to localStorage`);
            return true;
        } catch (error) {
            console.error('ViewerConfiguration: Failed to save to localStorage:', error);
            return false;
        }
    }

    /**
     * Load configuration from localStorage
     * @param {string} name - Name of the configuration to load
     * @returns {Object|null} Configuration object or null if not found
     */
    loadFromStorage(name = 'default') {
        try {
            const storageKey = `${this.storageKey}-${name}`;
            const serializedConfig = localStorage.getItem(storageKey);
            
            if (!serializedConfig) {
                console.warn(`ViewerConfiguration: No configuration '${name}' found in localStorage`);
                return null;
            }

            const config = JSON.parse(serializedConfig);
            console.log(`ViewerConfiguration: Loaded configuration '${name}' from localStorage`);
            return config;
        } catch (error) {
            console.error('ViewerConfiguration: Failed to load from localStorage:', error);
            return null;
        }
    }

    /**
     * List all saved configurations
     * @returns {Array} List of configuration names
     */
    listConfigurations() {
        const configurations = [];
        const keyPrefix = this.storageKey + '-';

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
                const name = key.substring(keyPrefix.length);
                configurations.push(name);
            }
        }

        return configurations;
    }

    /**
     * Delete configuration from localStorage
     * @param {string} name - Name of configuration to delete
     * @returns {boolean} Success status
     */
    deleteConfiguration(name) {
        try {
            const storageKey = `${this.storageKey}-${name}`;
            localStorage.removeItem(storageKey);
            console.log(`ViewerConfiguration: Deleted configuration '${name}'`);
            return true;
        } catch (error) {
            console.error('ViewerConfiguration: Failed to delete configuration:', error);
            return false;
        }
    }

    /**
     * Export configuration to JSON file
     * @param {Object} config - Configuration to export
     * @param {string} filename - Export filename
     */
    exportToFile(config, filename = 'potree-multiviewer-config.json') {
        try {
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            console.log(`ViewerConfiguration: Exported configuration to ${filename}`);
        } catch (error) {
            console.error('ViewerConfiguration: Failed to export configuration:', error);
        }
    }

    /**
     * Import configuration from file input
     * @param {File} file - JSON file to import
     * @returns {Promise<Object|null>} Parsed configuration or null on error
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    console.log('ViewerConfiguration: Successfully imported configuration from file');
                    resolve(config);
                } catch (error) {
                    console.error('ViewerConfiguration: Failed to parse imported file:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                console.error('ViewerConfiguration: Failed to read file');
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
}