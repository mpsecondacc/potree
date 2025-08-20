/**
 * SharedResourceManager-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Manages shared resources between multiple viewers to prevent duplication:
 * - Point cloud data (geometry, textures, nodes)
 * - Materials (with per-viewer customization)
 * - Cached resources and loading states
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class SharedResourceManager extends EventDispatcher {
    
    constructor() {
        super();
        
        // Shared point cloud registry
        this.pointClouds = new Map(); // url -> SharedPointCloud
        this.loadingPromises = new Map(); // url -> Promise
        
        // Material instances per viewer
        this.viewerMaterials = new Map(); // viewerId -> Map(pointCloudId -> material)
        
        // Resource usage tracking
        this.usageCount = new Map(); // resourceId -> count
        this.memoryUsage = {
            pointCloudData: 0,
            materials: 0,
            textures: 0,
            total: 0
        };
    }
    
    /**
     * Load a point cloud with resource sharing
     * @param {string} url - Point cloud URL
     * @param {string} name - Point cloud name
     * @param {string} viewerId - Requesting viewer ID
     * @returns {Promise<Object>} Shared point cloud instance
     */
    async loadSharedPointCloud(url, name, viewerId) {
        const resourceId = `${url}:${name}`;
        
        // Check if already loading
        if (this.loadingPromises.has(resourceId)) {
            console.log(`SharedResourceManager: Waiting for existing load of '${name}'`);
            const sharedPC = await this.loadingPromises.get(resourceId);
            return this.createViewerInstance(sharedPC, viewerId);
        }
        
        // Check if already loaded
        if (this.pointClouds.has(resourceId)) {
            console.log(`SharedResourceManager: Reusing cached point cloud '${name}' for viewer '${viewerId}'`);
            const sharedPC = this.pointClouds.get(resourceId);
            this.incrementUsage(resourceId);
            return this.createViewerInstance(sharedPC, viewerId);
        }
        
        // Load point cloud for the first time
        console.log(`SharedResourceManager: Loading point cloud '${name}' for first time`);
        
        const loadPromise = this.loadPointCloudData(url, name);
        this.loadingPromises.set(resourceId, loadPromise);
        
        try {
            const sharedPC = await loadPromise;
            
            // Store in cache
            this.pointClouds.set(resourceId, sharedPC);
            this.loadingPromises.delete(resourceId);
            this.incrementUsage(resourceId);
            
            // Update memory usage stats
            this.updateMemoryUsage(sharedPC, 'add');
            
            console.log(`SharedResourceManager: ✓ Point cloud '${name}' loaded and cached`);
            
            this.dispatchEvent({
                type: 'pointcloud_loaded',
                resourceId: resourceId,
                name: name,
                viewerId: viewerId
            });
            
            return this.createViewerInstance(sharedPC, viewerId);
            
        } catch (error) {
            this.loadingPromises.delete(resourceId);
            console.error(`SharedResourceManager: Failed to load point cloud '${name}':`, error);
            throw error;
        }
    }
    
    /**
     * Load raw point cloud data using Potree
     */
    loadPointCloudData(url, name) {
        return new Promise((resolve, reject) => {
            if (typeof window.Potree === 'undefined' || !window.Potree.loadPointCloud) {
                reject(new Error('Potree.loadPointCloud not available'));
                return;
            }
            
            window.Potree.loadPointCloud(url, name, (e) => {
                if (e && e.pointcloud) {
                    const sharedPC = {
                        id: `${url}:${name}`,
                        url: url,
                        name: name,
                        pointcloud: e.pointcloud,
                        geometry: e.pointcloud.geometry,
                        pcoGeometry: e.pointcloud.pcoGeometry,
                        boundingBox: e.pointcloud.boundingBox,
                        loadTime: Date.now(),
                        originalMaterial: e.pointcloud.material
                    };
                    resolve(sharedPC);
                } else {
                    reject(new Error(`Failed to load point cloud: ${name}`));
                }
            });
        });
    }
    
    /**
     * Create a viewer-specific instance of a shared point cloud
     */
    createViewerInstance(sharedPC, viewerId) {
        // Create a more complete wrapper that preserves all point cloud functionality
        const originalPC = sharedPC.pointcloud;
        
        // Create a proper THREE.Object3D-like wrapper that delegates to the original
        const viewerPointCloud = Object.create(originalPC.constructor.prototype);
        
        // Copy all essential properties from the original point cloud
        Object.keys(originalPC).forEach(key => {
            if (key !== 'material') { // We'll create individual materials
                try {
                    viewerPointCloud[key] = originalPC[key];
                } catch (e) {
                    // Skip properties that can't be copied
                }
            }
        });
        
        // Essential THREE.js Object3D properties
        viewerPointCloud.geometry = originalPC.geometry;
        viewerPointCloud.pcoGeometry = originalPC.pcoGeometry;
        viewerPointCloud.boundingBox = originalPC.boundingBox;
        viewerPointCloud.visible = true;
        viewerPointCloud.matrixAutoUpdate = true;
        
        // Individual material per viewer
        viewerPointCloud.material = this.createViewerMaterial(sharedPC, viewerId);
        
        // Ensure position, rotation, scale are proper THREE.Vector3 objects
        if (originalPC.position) {
            viewerPointCloud.position = originalPC.position.clone();
        } else {
            // Create a basic position object if missing
            viewerPointCloud.position = { x: 0, y: 0, z: 0 };
            viewerPointCloud.position.set = function(x, y, z) { this.x = x; this.y = y; this.z = z; };
            viewerPointCloud.position.copy = function(v) { this.x = v.x; this.y = v.y; this.z = v.z; };
        }
        
        if (originalPC.rotation) {
            viewerPointCloud.rotation = originalPC.rotation.clone ? originalPC.rotation.clone() : originalPC.rotation;
        }
        
        if (originalPC.scale) {
            viewerPointCloud.scale = originalPC.scale.clone ? originalPC.scale.clone() : originalPC.scale;
        }
        
        // Copy essential methods from original, binding to original context
        const methodsToCopy = [
            'traverse', 'updateMatrix', 'updateMatrixWorld', 'getAttribute', 
            'getPosition', 'getColor', 'getClassification', 'raycast',
            'computeBoundingBox', 'computeBoundingSphere'
        ];
        
        methodsToCopy.forEach(methodName => {
            if (originalPC[methodName] && typeof originalPC[methodName] === 'function') {
                viewerPointCloud[methodName] = originalPC[methodName].bind(originalPC);
            }
        });
        
        // Essential matrix properties for THREE.js transformations
        if (originalPC.matrix) {
            viewerPointCloud.matrix = originalPC.matrix.clone();
        }
        if (originalPC.matrixWorld) {
            viewerPointCloud.matrixWorld = originalPC.matrixWorld.clone();
        }
        
        // Mark as shared resource instance
        viewerPointCloud._isSharedResourceInstance = true;
        viewerPointCloud._viewerId = viewerId;
        viewerPointCloud._sharedResourceId = sharedPC.id;
        
        // Store viewer material reference
        if (!this.viewerMaterials.has(viewerId)) {
            this.viewerMaterials.set(viewerId, new Map());
        }
        this.viewerMaterials.get(viewerId).set(sharedPC.id, viewerPointCloud.material);
        
        console.log(`SharedResourceManager: Created viewer instance for '${viewerId}' (shared geometry, individual transforms)`);
        
        return {
            pointcloud: viewerPointCloud,
            sharedResource: sharedPC,
            isShared: true,
            viewerId: viewerId
        };
    }
    
    /**
     * Create viewer-specific material instance
     */
    createViewerMaterial(sharedPC, viewerId) {
        const originalMaterial = sharedPC.originalMaterial;
        
        // Instead of cloning which may cause texture issues, create a reference to the original material
        // Point cloud materials are typically shared and shouldn't need individual instances
        // unless we need per-viewer customization
        const viewerMaterial = originalMaterial;
        
        // Add viewer identification without modifying the original
        const materialWrapper = {
            // Delegate all properties and methods to original material
            ...originalMaterial,
            
            // Override specific properties if needed for viewer identification
            _viewerId: viewerId,
            _sharedResourceId: sharedPC.id,
            _isSharedResource: true,
            _originalMaterial: originalMaterial
        };
        
        // Create a proxy to ensure all material methods work correctly
        return new Proxy(originalMaterial, {
            get(target, prop) {
                // Return viewer-specific properties if they exist
                if (prop === '_viewerId') return viewerId;
                if (prop === '_sharedResourceId') return sharedPC.id;
                if (prop === '_isSharedResource') return true;
                if (prop === '_originalMaterial') return originalMaterial;
                
                // Otherwise return the original material property
                return target[prop];
            },
            set(target, prop, value) {
                // Allow setting properties on the original material
                // This ensures texture updates and other modifications work
                target[prop] = value;
                return true;
            }
        });
    }
    
    /**
     * Release resources for a viewer
     * @param {string} viewerId - Viewer ID
     */
    releaseViewerResources(viewerId) {
        const viewerMaterials = this.viewerMaterials.get(viewerId);
        if (!viewerMaterials) return;
        
        console.log(`SharedResourceManager: Releasing resources for viewer '${viewerId}'`);
        
        // Decrement usage count for each resource
        for (const [resourceId, material] of viewerMaterials) {
            this.decrementUsage(resourceId);
            
            // Clean up material
            if (material.dispose) {
                material.dispose();
            }
        }
        
        // Remove viewer materials
        this.viewerMaterials.delete(viewerId);
        
        this.dispatchEvent({
            type: 'resources_released',
            viewerId: viewerId
        });
    }
    
    /**
     * Load point cloud into multiple viewers efficiently
     * @param {string} url - Point cloud URL  
     * @param {string} name - Point cloud name
     * @param {Array} viewerIds - Array of viewer IDs
     * @returns {Promise<Map>} viewerId -> viewer instance
     */
    async loadIntoMultipleViewers(url, name, viewerIds) {
        console.log(`SharedResourceManager: Loading '${name}' into ${viewerIds.length} viewers`);
        
        const results = new Map();
        
        // Load shared resource once
        const firstViewerInstance = await this.loadSharedPointCloud(url, name, viewerIds[0]);
        results.set(viewerIds[0], firstViewerInstance);
        
        // Create instances for remaining viewers (reusing loaded data)
        for (let i = 1; i < viewerIds.length; i++) {
            const viewerId = viewerIds[i];
            const viewerInstance = await this.loadSharedPointCloud(url, name, viewerId);
            results.set(viewerId, viewerInstance);
        }
        
        const resourceId = `${url}:${name}`;
        const sharedPC = this.pointClouds.get(resourceId);
        
        console.log(`SharedResourceManager: ✓ Point cloud '${name}' loaded into ${viewerIds.length} viewers`);
        console.log(`SharedResourceManager: Memory efficiency: 1 dataset → ${viewerIds.length} viewers`);
        
        return results;
    }
    
    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        return {
            ...this.memoryUsage,
            pointCloudCount: this.pointClouds.size,
            loadingCount: this.loadingPromises.size,
            viewerCount: this.viewerMaterials.size,
            sharingEfficiency: this.calculateSharingEfficiency()
        };
    }
    
    /**
     * Calculate sharing efficiency ratio
     */
    calculateSharingEfficiency() {
        let totalUsage = 0;
        for (const count of this.usageCount.values()) {
            totalUsage += count;
        }
        
        const uniqueResources = this.pointClouds.size;
        if (uniqueResources === 0) return 1.0;
        
        return totalUsage / uniqueResources; // Higher is better
    }
    
    /**
     * Usage counting helpers
     */
    incrementUsage(resourceId) {
        const current = this.usageCount.get(resourceId) || 0;
        this.usageCount.set(resourceId, current + 1);
    }
    
    decrementUsage(resourceId) {
        const current = this.usageCount.get(resourceId) || 0;
        const newCount = Math.max(0, current - 1);
        this.usageCount.set(resourceId, newCount);
        
        // Garbage collect unused resources
        if (newCount === 0) {
            this.garbageCollectResource(resourceId);
        }
    }
    
    /**
     * Remove unused resources from memory
     */
    garbageCollectResource(resourceId) {
        const sharedPC = this.pointClouds.get(resourceId);
        if (!sharedPC) return;
        
        console.log(`SharedResourceManager: Garbage collecting unused resource '${sharedPC.name}'`);
        
        // Update memory usage
        this.updateMemoryUsage(sharedPC, 'remove');
        
        // Clean up point cloud data
        if (sharedPC.pointcloud && sharedPC.pointcloud.dispose) {
            sharedPC.pointcloud.dispose();
        }
        
        // Remove from cache
        this.pointClouds.delete(resourceId);
        this.usageCount.delete(resourceId);
        
        this.dispatchEvent({
            type: 'resource_garbage_collected',
            resourceId: resourceId,
            name: sharedPC.name
        });
    }
    
    /**
     * Update memory usage statistics
     */
    updateMemoryUsage(sharedPC, operation) {
        // Estimate memory usage (simplified)
        const pointCloudSize = this.estimatePointCloudSize(sharedPC.pointcloud);
        
        if (operation === 'add') {
            this.memoryUsage.pointCloudData += pointCloudSize;
        } else if (operation === 'remove') {
            this.memoryUsage.pointCloudData = Math.max(0, this.memoryUsage.pointCloudData - pointCloudSize);
        }
        
        this.memoryUsage.total = this.memoryUsage.pointCloudData + this.memoryUsage.materials + this.memoryUsage.textures;
    }
    
    /**
     * Estimate point cloud memory usage
     */
    estimatePointCloudSize(pointcloud) {
        try {
            if (!pointcloud || !pointcloud.pcoGeometry) return 0;
            
            const numPoints = pointcloud.pcoGeometry.root.numPoints || 100000; // fallback estimate
            const bytesPerPoint = 12; // Rough estimate: position(12) + color(4) + classification(1) etc.
            
            return numPoints * bytesPerPoint;
        } catch (error) {
            return 1024 * 1024; // 1MB fallback
        }
    }
    
    /**
     * Clear all resources
     */
    destroy() {
        console.log('SharedResourceManager: Destroying all resources');
        
        // Release all viewer resources
        const viewerIds = Array.from(this.viewerMaterials.keys());
        for (const viewerId of viewerIds) {
            this.releaseViewerResources(viewerId);
        }
        
        // Clear point cloud cache
        for (const [resourceId, sharedPC] of this.pointClouds) {
            if (sharedPC.pointcloud && sharedPC.pointcloud.dispose) {
                sharedPC.pointcloud.dispose();
            }
        }
        
        this.pointClouds.clear();
        this.loadingPromises.clear();
        this.viewerMaterials.clear();
        this.usageCount.clear();
        
        this.memoryUsage = {
            pointCloudData: 0,
            materials: 0,
            textures: 0,
            total: 0
        };
        
        this.removeAllListeners();
    }
}