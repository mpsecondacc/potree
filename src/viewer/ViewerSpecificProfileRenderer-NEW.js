/**
 * ViewerSpecificProfileRenderer-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for viewer-specific profile rendering
 * 
 * Provides isolated profile rendering contexts for multi-viewer environments:
 * - Separate rendering contexts per viewer
 * - Independent material management
 * - Cross-viewer contamination prevention
 * - Performance-optimized rendering
 * - Resource cleanup and disposal
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../EventDispatcher.js";
import { Renderer } from "../PotreeRenderer.js";

export class ViewerSpecificProfileRenderer extends EventDispatcher {
    
    constructor(viewerId, profileWindow) {
        super();
        
        this.viewerId = viewerId;
        this.profileWindow = profileWindow;
        
        // Rendering components (isolated per viewer)
        this.renderer = null;
        this.pRenderer = null; // Potree renderer
        this.camera = null;
        this.profileScene = null;
        this.uiScene = null;
        
        // Rendering state
        this.isInitialized = false;
        this.isDisposed = false;
        this.lastRenderTime = 0;
        this.renderRequested = false;
        
        // Performance tracking
        this.stats = {
            renderCalls: 0,
            materialSyncs: 0,
            frameTime: 0,
            lastFPS: 0
        };
        
        // Configuration
        this.debugMode = false;
        this.enablePerformanceTracking = true;
        
        console.log(`[ViewerSpecificProfileRenderer] Created renderer for viewer '${viewerId}'`);
    }
    
    /**
     * Initialize the rendering context
     * @param {HTMLElement} canvas - Canvas element for rendering
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    initialize(canvas, width, height) {
        if (this.isInitialized) {
            console.warn(`[ViewerSpecificProfileRenderer] Renderer already initialized for viewer '${this.viewerId}'`);
            return false;
        }
        
        try {
            // Create THREE.js renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                alpha: true,
                premultipliedAlpha: false,
                antialias: true,
                preserveDrawingBuffer: false
            });
            
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setClearColor(0x000000, 0);
            
            // Create Potree renderer
            this.pRenderer = new Renderer(this.renderer);
            
            // Create camera (orthographic for profile view)
            this.camera = new THREE.OrthographicCamera(
                -width / 2, width / 2,
                height / 2, -height / 2,
                -1000, 1000
            );
            this.camera.position.set(0, 0, 10);
            this.camera.lookAt(0, 0, 0);
            
            // Create scenes
            this.profileScene = new THREE.Scene();
            this.profileScene.name = `ProfileScene_${this.viewerId}`;
            
            this.uiScene = new THREE.Scene();
            this.uiScene.name = `UIScene_${this.viewerId}`;
            
            // Setup pick sphere for point selection
            this.setupPickSphere();
            
            this.isInitialized = true;
            
            if (this.debugMode) {
                console.log(`[ViewerSpecificProfileRenderer] Initialized renderer for viewer '${this.viewerId}' (${width}x${height})`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[ViewerSpecificProfileRenderer] Failed to initialize renderer for viewer '${this.viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Setup pick sphere for point selection visualization
     */
    setupPickSphere() {
        const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.6
        });
        
        this.pickSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.pickSphere.visible = false;
        this.uiScene.add(this.pickSphere);
    }
    
    /**
     * Render the profile view
     * @param {Map} pointclouds - Map of point clouds to render
     * @param {Object} scaleX - X scale for pick sphere sizing
     * @param {boolean} forceRender - Force rendering even if not requested
     */
    render(pointclouds, scaleX = null, forceRender = false) {
        if (!this.isInitialized || this.isDisposed) {
            console.warn(`[ViewerSpecificProfileRenderer] Cannot render - renderer not initialized for viewer '${this.viewerId}'`);
            return false;
        }
        
        if (!forceRender && !this.renderRequested) {
            return false;
        }
        
        const startTime = this.enablePerformanceTracking ? performance.now() : 0;
        
        try {
            // Clear the canvas
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.clear(true, true, false);
            
            // Sync materials and render point clouds
            this.syncMaterials(pointclouds);
            
            // Render profile scene with point clouds
            this.pRenderer.render(this.profileScene, this.camera, null);
            
            // Update and render pick sphere
            if (scaleX && this.pickSphere) {
                this.updatePickSphere(scaleX);
            }
            
            // Render UI scene (pick sphere, etc.)
            this.renderer.render(this.uiScene, this.camera);
            
            // Update stats
            if (this.enablePerformanceTracking) {
                const endTime = performance.now();
                this.stats.frameTime = endTime - startTime;
                this.stats.renderCalls++;
                this.stats.lastFPS = 1000 / Math.max(this.stats.frameTime, 1);
                this.lastRenderTime = endTime;
            }
            
            this.renderRequested = false;
            
            // Dispatch render event
            this.dispatchEvent({
                type: 'render_complete',
                viewerId: this.viewerId,
                frameTime: this.stats.frameTime,
                pointCloudCount: pointclouds.size
            });
            
            return true;
            
        } catch (error) {
            console.error(`[ViewerSpecificProfileRenderer] Render error for viewer '${this.viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Sync materials with their source materials
     * @param {Map} pointclouds - Map of point clouds
     */
    syncMaterials(pointclouds) {
        if (!pointclouds || pointclouds.size === 0) {
            return;
        }
        
        for (const [sourcePointCloud, profileFakeOctree] of pointclouds) {
            const sourceMaterial = sourcePointCloud.material;
            const targetMaterial = profileFakeOctree.material;
            
            if (!sourceMaterial || !targetMaterial) {
                continue;
            }
            
            try {
                // Use ProfileMaterial's sync method if available
                if (targetMaterial.isProfileMaterial && typeof targetMaterial.syncWithSource === 'function') {
                    targetMaterial.syncWithSource();
                } else {
                    // Fallback to manual sync with size preservation
                    this.manualMaterialSync(sourceMaterial, targetMaterial);
                }
                
                this.stats.materialSyncs++;
                
            } catch (error) {
                console.error(`[ViewerSpecificProfileRenderer] Material sync error for viewer '${this.viewerId}':`, error);
            }
        }
    }
    
    /**
     * Manual material synchronization with size preservation
     * @param {PointCloudMaterial} source - Source material
     * @param {PointCloudMaterial} target - Target material
     */
    manualMaterialSync(source, target) {
        // Store original size
        const originalSize = target.size || source.size || 0.2;
        
        // Copy uniforms
        for (const name of Object.keys(target.uniforms)) {
            if (source.uniforms[name] !== undefined) {
                target.uniforms[name].value = source.uniforms[name].value;
            }
        }
        
        // Copy textures
        target.gradientTexture = source.gradientTexture;
        target.visibleNodesTexture = source.visibleNodesTexture;
        target.classificationTexture = source.classificationTexture;
        target.matcapTexture = source.matcapTexture;
        
        // Copy attributes and ranges
        target.activeAttributeName = source.activeAttributeName;
        target.ranges = source.ranges;
        
        // Restore original size
        target.size = originalSize;
    }
    
    /**
     * Update pick sphere for point selection
     * @param {Object} scaleX - X scale object
     */
    updatePickSphere(scaleX) {
        if (!this.pickSphere || !scaleX.invert) {
            return;
        }
        
        try {
            const radius = Math.abs(scaleX.invert(0) - scaleX.invert(5));
            
            if (radius === 0) {
                this.pickSphere.visible = false;
            } else {
                this.pickSphere.scale.set(radius, radius, radius);
                this.pickSphere.visible = true;
            }
            
        } catch (error) {
            if (this.debugMode) {
                console.warn(`[ViewerSpecificProfileRenderer] Pick sphere update error for viewer '${this.viewerId}':`, error);
            }
        }
    }
    
    /**
     * Request a render on the next animation frame
     */
    requestRender() {
        this.renderRequested = true;
        
        if (this.debugMode) {
            console.log(`[ViewerSpecificProfileRenderer] Render requested for viewer '${this.viewerId}'`);
        }
    }
    
    /**
     * Resize the renderer
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        if (!this.isInitialized || this.isDisposed) {
            return false;
        }
        
        try {
            // Update renderer size
            this.renderer.setSize(width, height);
            
            // Update camera
            this.camera.left = -width / 2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = -height / 2;
            this.camera.updateProjectionMatrix();
            
            // Request render
            this.requestRender();
            
            if (this.debugMode) {
                console.log(`[ViewerSpecificProfileRenderer] Resized renderer for viewer '${this.viewerId}' to ${width}x${height}`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[ViewerSpecificProfileRenderer] Resize error for viewer '${this.viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Add object to the profile scene
     * @param {THREE.Object3D} object - Object to add
     */
    addToProfileScene(object) {
        if (!this.isInitialized || this.isDisposed || !this.profileScene) {
            return false;
        }
        
        this.profileScene.add(object);
        this.requestRender();
        
        return true;
    }
    
    /**
     * Remove object from the profile scene
     * @param {THREE.Object3D} object - Object to remove
     */
    removeFromProfileScene(object) {
        if (!this.isInitialized || this.isDisposed || !this.profileScene) {
            return false;
        }
        
        this.profileScene.remove(object);
        this.requestRender();
        
        return true;
    }
    
    /**
     * Get renderer statistics
     */
    getStats() {
        return {
            ...this.stats,
            viewerId: this.viewerId,
            isInitialized: this.isInitialized,
            isDisposed: this.isDisposed,
            sceneObjects: this.profileScene ? this.profileScene.children.length : 0,
            uiObjects: this.uiScene ? this.uiScene.children.length : 0
        };
    }
    
    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[ViewerSpecificProfileRenderer] Debug mode: ${enabled} for viewer '${this.viewerId}'`);
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        if (this.isDisposed) {
            return;
        }
        
        console.log(`[ViewerSpecificProfileRenderer] Disposing renderer for viewer '${this.viewerId}'`);
        
        try {
            // Clean up scenes
            if (this.profileScene) {
                this.profileScene.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                this.profileScene.clear();
            }
            
            if (this.uiScene) {
                this.uiScene.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                this.uiScene.clear();
            }
            
            // Clean up renderer
            if (this.renderer) {
                this.renderer.dispose();
            }
            
            // Clear references
            this.renderer = null;
            this.pRenderer = null;
            this.camera = null;
            this.profileScene = null;
            this.uiScene = null;
            this.pickSphere = null;
            
            this.isDisposed = true;
            this.isInitialized = false;
            
            console.log(`[ViewerSpecificProfileRenderer] Disposed renderer for viewer '${this.viewerId}'`);
            
        } catch (error) {
            console.error(`[ViewerSpecificProfileRenderer] Disposal error for viewer '${this.viewerId}':`, error);
        }
    }
}