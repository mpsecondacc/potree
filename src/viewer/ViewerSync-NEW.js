/**
 * ViewerSync-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Manages synchronization between multiple viewers, including:
 * - Camera synchronization (position, rotation, zoom)
 * - Material and rendering settings sync
 * - Point cloud loading coordination
 * - Custom synchronization rules
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class ViewerSync extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.syncGroups = new Map(); // groupId -> SyncGroup
        this.viewerSyncState = new Map(); // viewerId -> sync settings
        
        this.isEnabled = true;
        this.isSyncInProgress = false; // Prevent sync loops
        
        this.defaultSyncOptions = {
            camera: {
                position: true,
                rotation: true,
                zoom: false,
                target: true
            },
            materials: {
                pointSize: true,
                colorMode: true,
                opacity: false,
                elevationRange: false
            },
            scene: {
                background: false,
                lighting: false,
                clipping: false
            },
            filters: {
                classification: false,
                intensity: false,
                returnNumber: false
            }
        };
    }
    
    /**
     * Enable/disable synchronization between specified viewers
     * @param {Array} viewerIds - Array of viewer IDs to sync
     * @param {Object} options - Sync options
     */
    setSyncEnabled(viewerIds, options = {}) {
        if (!Array.isArray(viewerIds) || viewerIds.length < 2) {
            console.warn('Sync requires at least 2 viewers');
            return false;
        }
        
        // Validate all viewers exist
        for (const viewerId of viewerIds) {
            if (!this.viewerManager.registry.hasViewer(viewerId)) {
                console.error(`Viewer '${viewerId}' not found for sync`);
                return false;
            }
        }
        
        const groupId = this.generateSyncGroupId(viewerIds);
        const syncOptions = this.mergeSyncOptions(options);
        
        const syncGroup = {
            id: groupId,
            viewerIds: [...viewerIds],
            options: syncOptions,
            enabled: true,
            lastSyncTime: Date.now()
        };
        
        this.syncGroups.set(groupId, syncGroup);
        
        // Update individual viewer sync states
        for (const viewerId of viewerIds) {
            this.viewerSyncState.set(viewerId, {
                groupId: groupId,
                enabled: true,
                options: syncOptions
            });
        }
        
        this.setupViewerSyncListeners(viewerIds);
        
        this.dispatchEvent({
            type: 'sync_enabled',
            groupId: groupId,
            viewerIds: viewerIds,
            options: syncOptions
        });
        
        console.log(`ViewerSync: Sync enabled for viewers: ${viewerIds.join(', ')}`);
        console.log(`ViewerSync: Group ID: ${groupId}`);
        console.log(`ViewerSync: Sync options:`, syncOptions);
        return groupId;
    }
    
    /**
     * Disable synchronization for a group or specific viewers
     * @param {string|Array} groupIdOrViewers - Group ID or array of viewer IDs
     */
    setSyncDisabled(groupIdOrViewers) {
        let groupId, viewerIds;
        
        if (typeof groupIdOrViewers === 'string') {
            // Disable by group ID
            groupId = groupIdOrViewers;
            const syncGroup = this.syncGroups.get(groupId);
            if (!syncGroup) {
                console.warn(`Sync group '${groupId}' not found`);
                return false;
            }
            viewerIds = syncGroup.viewerIds;
        } else if (Array.isArray(groupIdOrViewers)) {
            // Disable by viewer IDs
            viewerIds = groupIdOrViewers;
            groupId = this.findSyncGroupByViewers(viewerIds);
        }
        
        if (!groupId) {
            console.warn('Unable to find sync group to disable');
            return false;
        }
        
        // Remove sync group
        this.syncGroups.delete(groupId);
        
        // Update viewer sync states
        for (const viewerId of viewerIds) {
            this.viewerSyncState.delete(viewerId);
        }
        
        this.removeViewerSyncListeners(viewerIds);
        
        this.dispatchEvent({
            type: 'sync_disabled',
            groupId: groupId,
            viewerIds: viewerIds
        });
        
        console.log(`Sync disabled for group: ${groupId}`);
        return true;
    }
    
    /**
     * Setup event listeners for viewer synchronization
     */
    setupViewerSyncListeners(viewerIds) {
        for (const viewerId of viewerIds) {
            const viewer = this.viewerManager.registry.getViewer(viewerId);
            if (!viewer) continue;
            
            // Camera change synchronization
            const cameraChangeHandler = (event) => {
                this.handleCameraChange(viewerId, event);
            };
            
            viewer.addEventListener('camera_changed', cameraChangeHandler);
            
            // Store handler for cleanup
            if (!viewer._syncHandlers) {
                viewer._syncHandlers = new Map();
            }
            viewer._syncHandlers.set('camera_changed', cameraChangeHandler);
            
            // Material change synchronization
            const materialChangeHandler = (event) => {
                this.handleMaterialChange(viewerId, event);
            };
            
            // Note: May need to add material change events to base viewer
            // viewer.addEventListener('material_changed', materialChangeHandler);
            // viewer._syncHandlers.set('material_changed', materialChangeHandler);
        }
    }
    
    /**
     * Remove event listeners for viewer synchronization
     */
    removeViewerSyncListeners(viewerIds) {
        for (const viewerId of viewerIds) {
            const viewer = this.viewerManager.registry.getViewer(viewerId);
            if (!viewer || !viewer._syncHandlers) continue;
            
            // Remove camera change listener
            const cameraHandler = viewer._syncHandlers.get('camera_changed');
            if (cameraHandler) {
                viewer.removeEventListener('camera_changed', cameraHandler);
            }
            
            // Remove material change listener
            const materialHandler = viewer._syncHandlers.get('material_changed');
            if (materialHandler) {
                viewer.removeEventListener('material_changed', materialHandler);
            }
            
            viewer._syncHandlers.clear();
        }
    }
    
    /**
     * Handle camera change events
     */
    handleCameraChange(sourceViewerId, event) {
        console.log(`ViewerSync: Camera change event from viewer '${sourceViewerId}'`);
        
        if (!this.isEnabled || this.isSyncInProgress) {
            console.log(`ViewerSync: Sync disabled or in progress, skipping`);
            return;
        }
        
        const syncState = this.viewerSyncState.get(sourceViewerId);
        if (!syncState || !syncState.enabled) {
            console.log(`ViewerSync: No sync state or disabled for viewer '${sourceViewerId}'`);
            return;
        }
        
        const syncGroup = this.syncGroups.get(syncState.groupId);
        if (!syncGroup || !syncGroup.options.camera) {
            console.log(`ViewerSync: No sync group or camera sync disabled for viewer '${sourceViewerId}'`);
            return;
        }
        
        console.log(`ViewerSync: Propagating camera change from viewer '${sourceViewerId}'`);
        this.propagateCameraChange(sourceViewerId, event);
    }
    
    /**
     * Propagate camera changes to synchronized viewers
     */
    propagateCameraChange(sourceViewerId, event) {
        const syncState = this.viewerSyncState.get(sourceViewerId);
        if (!syncState) return;
        
        const syncGroup = this.syncGroups.get(syncState.groupId);
        if (!syncGroup) return;
        
        const sourceViewer = this.viewerManager.registry.getViewer(sourceViewerId);
        if (!sourceViewer || !sourceViewer.scene) return;
        
        this.isSyncInProgress = true;
        
        const cameraOptions = syncGroup.options.camera;
        const sourceView = sourceViewer.scene.view;
        
        // Sync to other viewers in the group
        for (const targetViewerId of syncGroup.viewerIds) {
            if (targetViewerId === sourceViewerId) continue;
            
            const targetViewer = this.viewerManager.registry.getViewer(targetViewerId);
            if (!targetViewer || !targetViewer.scene) continue;
            
            const targetView = targetViewer.scene.view;
            
            try {
                // Sync position
                if (cameraOptions.position) {
                    targetView.position.copy(sourceView.position);
                }
                
                // Sync rotation (yaw/pitch)
                if (cameraOptions.rotation) {
                    targetView.yaw = sourceView.yaw;
                    targetView.pitch = sourceView.pitch;
                }
                
                // Sync zoom/radius
                if (cameraOptions.zoom) {
                    targetView.radius = sourceView.radius;
                }
                
                // Sync look-at target
                if (cameraOptions.target) {
                    const pivot = sourceView.getPivot();
                    targetView.lookAt(pivot);
                }
                
            } catch (error) {
                console.error(`Error syncing camera to viewer '${targetViewerId}':`, error);
            }
        }
        
        this.isSyncInProgress = false;
        
        this.dispatchEvent({
            type: 'camera_synced',
            sourceViewerId: sourceViewerId,
            groupId: syncGroup.id,
            targetViewers: syncGroup.viewerIds.filter(id => id !== sourceViewerId)
        });
    }
    
    /**
     * Handle material change events
     */
    handleMaterialChange(sourceViewerId, event) {
        if (!this.isEnabled || this.isSyncInProgress) {
            return;
        }
        
        const syncState = this.viewerSyncState.get(sourceViewerId);
        if (!syncState || !syncState.enabled) {
            return;
        }
        
        const syncGroup = this.syncGroups.get(syncState.groupId);
        if (!syncGroup || !syncGroup.options.materials) {
            return;
        }
        
        this.propagateMaterialChange(sourceViewerId, event);
    }
    
    /**
     * Propagate material changes to synchronized viewers
     */
    propagateMaterialChange(sourceViewerId, event) {
        const syncState = this.viewerSyncState.get(sourceViewerId);
        if (!syncState) return;
        
        const syncGroup = this.syncGroups.get(syncState.groupId);
        if (!syncGroup) return;
        
        const sourceViewer = this.viewerManager.registry.getViewer(sourceViewerId);
        if (!sourceViewer || !sourceViewer.scene) return;
        
        this.isSyncInProgress = true;
        
        const materialOptions = syncGroup.options.materials;
        
        // Get source point cloud material properties
        const sourcePointClouds = sourceViewer.scene.pointclouds;
        if (sourcePointClouds.length === 0) {
            this.isSyncInProgress = false;
            return;
        }
        
        const sourceMaterial = sourcePointClouds[0].material;
        
        // Sync to other viewers in the group
        for (const targetViewerId of syncGroup.viewerIds) {
            if (targetViewerId === sourceViewerId) continue;
            
            const targetViewer = this.viewerManager.registry.getViewer(targetViewerId);
            if (!targetViewer || !targetViewer.scene) continue;
            
            const targetPointClouds = targetViewer.scene.pointclouds;
            
            for (const targetPointCloud of targetPointClouds) {
                const targetMaterial = targetPointCloud.material;
                
                try {
                    // Sync point size
                    if (materialOptions.pointSize) {
                        targetMaterial.size = sourceMaterial.size;
                    }
                    
                    // Sync color mode/attribute
                    if (materialOptions.colorMode) {
                        targetMaterial.activeAttributeName = sourceMaterial.activeAttributeName;
                    }
                    
                    // Sync opacity
                    if (materialOptions.opacity) {
                        targetMaterial.opacity = sourceMaterial.opacity;
                    }
                    
                    // Sync elevation range
                    if (materialOptions.elevationRange) {
                        targetMaterial.elevationRange = [...sourceMaterial.elevationRange];
                    }
                    
                } catch (error) {
                    console.error(`Error syncing material to viewer '${targetViewerId}':`, error);
                }
            }
        }
        
        this.isSyncInProgress = false;
        
        this.dispatchEvent({
            type: 'material_synced',
            sourceViewerId: sourceViewerId,
            groupId: syncGroup.id,
            targetViewers: syncGroup.viewerIds.filter(id => id !== sourceViewerId)
        });
    }
    
    /**
     * Manually sync all properties between viewers in a group
     */
    forceSyncGroup(groupId) {
        const syncGroup = this.syncGroups.get(groupId);
        if (!syncGroup) {
            console.warn(`Sync group '${groupId}' not found`);
            return false;
        }
        
        // Use first viewer as source
        const sourceViewerId = syncGroup.viewerIds[0];
        const sourceViewer = this.viewerManager.registry.getViewer(sourceViewerId);
        
        if (!sourceViewer) {
            console.error(`Source viewer '${sourceViewerId}' not found`);
            return false;
        }
        
        // Trigger sync events
        this.propagateCameraChange(sourceViewerId, { camera: sourceViewer.scene.getActiveCamera() });
        // this.propagateMaterialChange(sourceViewerId, { material: sourceViewer.scene.pointclouds[0]?.material });
        
        console.log(`Force sync completed for group: ${groupId}`);
        return true;
    }
    
    /**
     * Remove viewer from sync system
     */
    removeViewer(viewerId) {
        const syncState = this.viewerSyncState.get(viewerId);
        if (!syncState) return;
        
        const syncGroup = this.syncGroups.get(syncState.groupId);
        if (syncGroup) {
            const viewerIndex = syncGroup.viewerIds.indexOf(viewerId);
            if (viewerIndex !== -1) {
                syncGroup.viewerIds.splice(viewerIndex, 1);
                
                // Remove group if only one viewer remains
                if (syncGroup.viewerIds.length < 2) {
                    this.syncGroups.delete(syncState.groupId);
                }
            }
        }
        
        this.viewerSyncState.delete(viewerId);
        this.removeViewerSyncListeners([viewerId]);
    }
    
    /**
     * Generate unique sync group ID
     */
    generateSyncGroupId(viewerIds) {
        const sortedIds = [...viewerIds].sort();
        return `sync_${sortedIds.join('_')}_${Date.now()}`;
    }
    
    /**
     * Find sync group containing specific viewers
     */
    findSyncGroupByViewers(viewerIds) {
        for (const [groupId, syncGroup] of this.syncGroups.entries()) {
            const hasAllViewers = viewerIds.every(id => syncGroup.viewerIds.includes(id));
            if (hasAllViewers) {
                return groupId;
            }
        }
        return null;
    }
    
    /**
     * Merge sync options with defaults
     */
    mergeSyncOptions(options) {
        const merged = JSON.parse(JSON.stringify(this.defaultSyncOptions));
        
        if (options.camera) {
            Object.assign(merged.camera, options.camera);
        }
        if (options.materials) {
            Object.assign(merged.materials, options.materials);
        }
        if (options.scene) {
            Object.assign(merged.scene, options.scene);
        }
        if (options.filters) {
            Object.assign(merged.filters, options.filters);
        }
        
        return merged;
    }
    
    /**
     * Check if sync is enabled
     */
    getSyncEnabled() {
        return this.isEnabled;
    }
    
    /**
     * Get sync groups information
     */
    getSyncGroups() {
        return Array.from(this.syncGroups.values());
    }
    
    /**
     * Get viewer sync state
     */
    getViewerSyncState(viewerId) {
        return this.viewerSyncState.get(viewerId) || null;
    }
    
    /**
     * Export sync configuration
     */
    exportConfiguration() {
        const syncGroups = {};
        this.syncGroups.forEach((group, groupId) => {
            syncGroups[groupId] = {
                viewerIds: group.viewerIds,
                options: group.options,
                enabled: group.enabled
            };
        });
        
        return {
            isEnabled: this.isEnabled,
            syncGroups: syncGroups,
            defaultSyncOptions: this.defaultSyncOptions
        };
    }
    
    /**
     * Import sync configuration
     */
    importConfiguration(config) {
        if (typeof config.isEnabled === 'boolean') {
            this.isEnabled = config.isEnabled;
        }
        
        if (config.syncGroups) {
            // Clear existing groups
            this.syncGroups.clear();
            this.viewerSyncState.clear();
            
            // Recreate sync groups
            for (const [groupId, groupConfig] of Object.entries(config.syncGroups)) {
                if (groupConfig.enabled) {
                    this.setSyncEnabled(groupConfig.viewerIds, groupConfig.options);
                }
            }
        }
    }
    
    /**
     * Cleanup sync system
     */
    destroy() {
        // Disable all sync groups
        const groupIds = Array.from(this.syncGroups.keys());
        groupIds.forEach(groupId => {
            this.setSyncDisabled(groupId);
        });
        
        this.syncGroups.clear();
        this.viewerSyncState.clear();
        this.removeAllListeners();
    }
}