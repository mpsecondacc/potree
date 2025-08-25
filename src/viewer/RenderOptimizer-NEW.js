/**
 * RenderOptimizer-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer rendering optimization
 * 
 * Optimizes rendering performance for multiple Potree viewers by:
 * - Unified render loop management
 * - Visibility-based selective rendering
 * - Frame rate adaptive rendering
 * - Resource sharing optimization
 * - Performance monitoring and metrics
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class RenderOptimizer extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.isRunning = false;
        this.renderLoopId = null;
        
        // Configuration
        this.config = {
            targetFPS: 60,
            minFPS: 30,
            maxFPS: 120,
            adaptiveRendering: true,
            visibilityBasedRendering: true,
            qualityLevelsEnabled: true,
            performanceMonitoring: true,
            idleTimeout: 2000, // ms before switching to idle mode
            lowPerformanceThreshold: 45, // FPS threshold for performance adjustments
        };
        
        // State tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.currentFPS = 60;
        this.averageFPS = 60;
        this.frameTime = 16.67; // ms per frame at 60 FPS
        
        // Performance metrics per viewer
        this.viewerMetrics = new Map(); // viewerId -> metrics
        
        // Render scheduling
        this.scheduledViewers = new Set(); // viewers that need rendering
        this.lastActivity = new Map(); // viewerId -> timestamp of last activity
        this.qualityLevel = 'high'; // high, medium, low
        
        // Optimization state
        this.isAdaptiveMode = false;
        this.renderBudget = 16.67; // ms budget per frame
        this.usedBudget = 0;
        
        this.initialize();
    }
    
    /**
     * Initialize the render optimizer
     */
    initialize() {
        this.setupPerformanceMonitoring();
        this.setupViewerTracking();
        console.log('RenderOptimizer initialized');
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Track browser performance
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                this.updateMemoryMetrics();
            }, 5000);
        }
        
        // Setup intersection observer for visibility detection
        if (this.config.visibilityBasedRendering) {
            this.setupIntersectionObserver();
        }
    }
    
    /**
     * Setup visibility detection for viewers
     */
    setupIntersectionObserver() {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const viewerId = entry.target.dataset.viewerId;
                if (viewerId) {
                    const metrics = this.getViewerMetrics(viewerId);
                    metrics.isVisible = entry.isIntersecting;
                    metrics.visibilityRatio = entry.intersectionRatio;
                    
                    // Schedule or unschedule based on visibility
                    if (entry.isIntersecting) {
                        this.scheduleViewerRender(viewerId);
                    } else {
                        this.unscheduleViewerRender(viewerId);
                    }
                }
            });
        }, {
            threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for quality adjustment
        });
    }
    
    /**
     * Setup viewer event tracking
     */
    setupViewerTracking() {
        // Listen for viewer manager events
        this.viewerManager.addEventListener('viewer_created', (event) => {
            this.registerViewer(event.viewerId, event.viewer);
        });
        
        this.viewerManager.addEventListener('viewer_removed', (event) => {
            this.unregisterViewer(event.viewerId);
        });
        
        this.viewerManager.addEventListener('active_viewer_changed', (event) => {
            this.onActiveViewerChanged(event.viewerId);
        });
    }
    
    /**
     * Register a viewer for optimization
     */
    registerViewer(viewerId, viewer) {
        const metrics = {
            viewer: viewer,
            viewerId: viewerId,
            isVisible: true,
            visibilityRatio: 1.0,
            lastRenderTime: 0,
            renderCount: 0,
            avgRenderTime: 0,
            frameSkipCount: 0,
            qualityLevel: 'high',
            isActive: false,
            lastActivityTime: Date.now(),
            needsRender: true
        };
        
        this.viewerMetrics.set(viewerId, metrics);
        this.scheduleViewerRender(viewerId);
        
        // Setup visibility tracking
        if (viewer.renderArea && this.intersectionObserver) {
            viewer.renderArea.dataset.viewerId = viewerId;
            this.intersectionObserver.observe(viewer.renderArea);
        }
        
        console.log(`RenderOptimizer: Registered viewer '${viewerId}'`);
    }
    
    /**
     * Unregister a viewer from optimization
     */
    unregisterViewer(viewerId) {
        const metrics = this.viewerMetrics.get(viewerId);
        if (metrics) {
            // Stop tracking visibility
            if (metrics.viewer.renderArea && this.intersectionObserver) {
                this.intersectionObserver.unobserve(metrics.viewer.renderArea);
            }
            
            this.viewerMetrics.delete(viewerId);
            this.unscheduleViewerRender(viewerId);
            
            console.log(`RenderOptimizer: Unregistered viewer '${viewerId}'`);
        }
    }
    
    /**
     * Get or create viewer metrics
     */
    getViewerMetrics(viewerId) {
        if (!this.viewerMetrics.has(viewerId)) {
            console.warn(`RenderOptimizer: Metrics not found for viewer '${viewerId}'`);
            return null;
        }
        return this.viewerMetrics.get(viewerId);
    }
    
    /**
     * Schedule a viewer for rendering
     */
    scheduleViewerRender(viewerId) {
        this.scheduledViewers.add(viewerId);
        const metrics = this.getViewerMetrics(viewerId);
        if (metrics) {
            metrics.needsRender = true;
        }
    }
    
    /**
     * Unschedule a viewer from rendering
     */
    unscheduleViewerRender(viewerId) {
        this.scheduledViewers.delete(viewerId);
        const metrics = this.getViewerMetrics(viewerId);
        if (metrics) {
            metrics.needsRender = false;
        }
    }
    
    /**
     * Handle active viewer change
     */
    onActiveViewerChanged(newActiveViewerId) {
        // Mark all viewers as inactive
        this.viewerMetrics.forEach((metrics) => {
            metrics.isActive = false;
        });
        
        // Mark new active viewer
        const activeMetrics = this.getViewerMetrics(newActiveViewerId);
        if (activeMetrics) {
            activeMetrics.isActive = true;
            activeMetrics.lastActivityTime = Date.now();
            this.scheduleViewerRender(newActiveViewerId);
        }
    }
    
    /**
     * Start the unified render loop
     */
    startRenderLoop() {
        if (this.isRunning) {
            console.warn('RenderOptimizer: Render loop already running');
            return;
        }
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.renderLoop();
        
        console.log('RenderOptimizer: Started unified render loop');
    }
    
    /**
     * Stop the render loop
     */
    stopRenderLoop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        if (this.renderLoopId) {
            cancelAnimationFrame(this.renderLoopId);
            this.renderLoopId = null;
        }
        
        console.log('RenderOptimizer: Stopped render loop');
    }
    
    /**
     * Main unified render loop
     */
    renderLoop() {
        if (!this.isRunning) {
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        // Calculate FPS and performance metrics
        this.updateFPSMetrics(currentTime, deltaTime);
        
        // Adaptive performance adjustment
        if (this.config.adaptiveRendering) {
            this.adjustRenderQuality();
        }
        
        // Reset budget tracking
        this.usedBudget = 0;
        const frameStartTime = performance.now();
        
        // Render scheduled viewers
        this.renderScheduledViewers(currentTime, deltaTime);
        
        // Update budget usage
        this.usedBudget = performance.now() - frameStartTime;
        
        // Update metrics
        this.updateRenderMetrics();
        
        this.lastFrameTime = currentTime;
        this.renderLoopId = requestAnimationFrame(() => this.renderLoop());
    }
    
    /**
     * Update FPS metrics
     */
    updateFPSMetrics(currentTime, deltaTime) {
        this.frameTime = deltaTime;
        this.currentFPS = 1000 / deltaTime;
        this.frameCount++;
        
        // Calculate rolling average FPS
        const alpha = 0.1; // smoothing factor
        this.averageFPS = (this.averageFPS * (1 - alpha)) + (this.currentFPS * alpha);
    }
    
    /**
     * Render all scheduled viewers with budget management
     */
    renderScheduledViewers(currentTime, deltaTime) {
        const renderBudgetPerViewer = this.renderBudget / Math.max(1, this.scheduledViewers.size);
        let totalRenderTime = 0;
        
        // Sort viewers by priority (active first, then by last activity)
        const sortedViewers = this.getSortedViewersForRendering();
        
        for (const viewerId of sortedViewers) {
            const renderStartTime = performance.now();
            
            // Check budget before rendering
            if (totalRenderTime > this.renderBudget * 0.9) {
                // Skip remaining viewers if budget exceeded
                const metrics = this.getViewerMetrics(viewerId);
                if (metrics) {
                    metrics.frameSkipCount++;
                }
                continue;
            }
            
            // Render the viewer
            const rendered = this.renderViewer(viewerId, currentTime, deltaTime);
            
            const renderTime = performance.now() - renderStartTime;
            totalRenderTime += renderTime;
            
            // Update viewer metrics
            this.updateViewerRenderMetrics(viewerId, renderTime, rendered);
            
            // Quality adjustment based on render time
            if (rendered && renderTime > renderBudgetPerViewer * 1.5) {
                this.adjustViewerQuality(viewerId, 'decrease');
            } else if (rendered && renderTime < renderBudgetPerViewer * 0.5) {
                this.adjustViewerQuality(viewerId, 'increase');
            }
        }
    }
    
    /**
     * Get viewers sorted by rendering priority
     */
    getSortedViewersForRendering() {
        const viewers = Array.from(this.scheduledViewers);
        
        return viewers.sort((a, b) => {
            const metricsA = this.getViewerMetrics(a);
            const metricsB = this.getViewerMetrics(b);
            
            if (!metricsA || !metricsB) return 0;
            
            // Active viewers first
            if (metricsA.isActive && !metricsB.isActive) return -1;
            if (!metricsA.isActive && metricsB.isActive) return 1;
            
            // Visible viewers next
            if (metricsA.isVisible && !metricsB.isVisible) return -1;
            if (!metricsA.isVisible && metricsB.isVisible) return 1;
            
            // Sort by visibility ratio (more visible first)
            if (metricsA.visibilityRatio !== metricsB.visibilityRatio) {
                return metricsB.visibilityRatio - metricsA.visibilityRatio;
            }
            
            // Sort by last activity (more recent first)
            return metricsB.lastActivityTime - metricsA.lastActivityTime;
        });
    }
    
    /**
     * Render a single viewer
     */
    renderViewer(viewerId, currentTime, deltaTime) {
        const metrics = this.getViewerMetrics(viewerId);
        if (!metrics || !metrics.viewer) {
            return false;
        }
        
        const viewer = metrics.viewer;
        
        // Skip if viewer is not visible or doesn't need rendering
        if (!metrics.isVisible && this.config.visibilityBasedRendering) {
            return false;
        }
        
        // Skip if viewer doesn't have necessary components
        if (!viewer.loop || typeof viewer.loop !== 'function') {
            return false;
        }
        
        // Skip if viewer area has no dimensions
        if (viewer.renderArea) {
            const rect = viewer.renderArea.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return false;
            }
        }
        
        // Perform the actual render
        try {
            viewer.loop(currentTime);
            metrics.lastRenderTime = currentTime;
            metrics.renderCount++;
            return true;
        } catch (error) {
            console.error(`RenderOptimizer: Error rendering viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Update viewer rendering metrics
     */
    updateViewerRenderMetrics(viewerId, renderTime, rendered) {
        const metrics = this.getViewerMetrics(viewerId);
        if (!metrics) return;
        
        if (rendered) {
            // Update rolling average render time
            const alpha = 0.2;
            metrics.avgRenderTime = (metrics.avgRenderTime * (1 - alpha)) + (renderTime * alpha);
        }
        
        // Update registry metadata
        if (this.viewerManager.registry) {
            this.viewerManager.registry.updateViewerMetadata(viewerId, {
                renderCount: metrics.renderCount,
                lastRenderTime: metrics.lastRenderTime
            });
        }
    }
    
    /**
     * Adjust render quality based on performance
     */
    adjustRenderQuality() {
        if (this.averageFPS < this.config.lowPerformanceThreshold) {
            // Performance is low, reduce quality
            if (this.qualityLevel !== 'low') {
                this.setGlobalQualityLevel('medium');
            } else if (this.qualityLevel === 'medium') {
                this.setGlobalQualityLevel('low');
            }
        } else if (this.averageFPS > this.config.targetFPS * 1.1) {
            // Performance is good, increase quality
            if (this.qualityLevel === 'low') {
                this.setGlobalQualityLevel('medium');
            } else if (this.qualityLevel === 'medium') {
                this.setGlobalQualityLevel('high');
            }
        }
    }
    
    /**
     * Set global quality level for all viewers
     */
    setGlobalQualityLevel(level) {
        if (this.qualityLevel === level) return;
        
        this.qualityLevel = level;
        
        // Apply quality settings to all viewers
        this.viewerMetrics.forEach((metrics, viewerId) => {
            this.applyQualitySettings(viewerId, level);
        });
        
        console.log(`RenderOptimizer: Set global quality level to '${level}' (FPS: ${this.averageFPS.toFixed(1)})`);
    }
    
    /**
     * Adjust quality for a specific viewer
     */
    adjustViewerQuality(viewerId, direction) {
        const metrics = this.getViewerMetrics(viewerId);
        if (!metrics) return;
        
        const qualityLevels = ['low', 'medium', 'high'];
        const currentIndex = qualityLevels.indexOf(metrics.qualityLevel);
        let newIndex = currentIndex;
        
        if (direction === 'increase' && currentIndex < qualityLevels.length - 1) {
            newIndex = currentIndex + 1;
        } else if (direction === 'decrease' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        }
        
        if (newIndex !== currentIndex) {
            metrics.qualityLevel = qualityLevels[newIndex];
            this.applyQualitySettings(viewerId, metrics.qualityLevel);
        }
    }
    
    /**
     * Apply quality settings to a viewer
     */
    applyQualitySettings(viewerId, qualityLevel) {
        const metrics = this.getViewerMetrics(viewerId);
        if (!metrics || !metrics.viewer) return;
        
        const viewer = metrics.viewer;
        
        // Adjust point cloud rendering settings
        if (viewer.scene && viewer.scene.pointclouds) {
            viewer.scene.pointclouds.forEach(pointcloud => {
                if (pointcloud.material) {
                    // CUSTOM - Skip materials that are being used by profile views to preserve original point sizes
                    if (pointcloud.material.isSourceForProfile) {
                        console.log('[RenderOptimizer] Skipping point size adjustment for profile source material');
                        return;
                    }
                    
                    switch (qualityLevel) {
                        case 'low':
                            pointcloud.material.size = Math.max(1, pointcloud.material.size * 0.7);
                            break;
                        case 'medium':
                            // Use default settings
                            break;
                        case 'high':
                            pointcloud.material.size = Math.min(10, pointcloud.material.size * 1.3);
                            break;
                    }
                }
            });
        }
        
        // Adjust LOD (Level of Detail) settings
        if (viewer.scene && viewer.scene.scene) {
            const targetBudget = qualityLevel === 'low' ? 0.5 : qualityLevel === 'medium' ? 1.0 : 2.0;
            if (viewer.scene.scene.pointBudget !== undefined) {
                viewer.scene.scene.pointBudget = targetBudget * 1000000; // 1M base budget
            }
        }
    }
    
    /**
     * Update memory metrics
     */
    updateMemoryMetrics() {
        if (!window.performance || !window.performance.memory) return;
        
        const memory = window.performance.memory;
        const memoryMB = {
            used: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
            total: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
            limit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024))
        };
        
        // Dispatch memory event
        this.dispatchEvent({
            type: 'memory_update',
            memory: memoryMB,
            optimizer: this
        });
        
        // Auto-adjust quality if memory usage is high
        if (memoryMB.used > memoryMB.limit * 0.8) {
            if (this.qualityLevel !== 'low') {
                this.setGlobalQualityLevel('low');
                console.warn('RenderOptimizer: Reduced quality due to high memory usage');
            }
        }
    }
    
    /**
     * Update general render metrics
     */
    updateRenderMetrics() {
        // Dispatch performance event every 60 frames
        if (this.frameCount % 60 === 0) {
            this.dispatchEvent({
                type: 'performance_update',
                fps: {
                    current: this.currentFPS,
                    average: this.averageFPS,
                    target: this.config.targetFPS
                },
                budget: {
                    allocated: this.renderBudget,
                    used: this.usedBudget,
                    utilization: (this.usedBudget / this.renderBudget) * 100
                },
                viewers: {
                    total: this.viewerMetrics.size,
                    active: Array.from(this.viewerMetrics.values()).filter(m => m.isActive).length,
                    visible: Array.from(this.viewerMetrics.values()).filter(m => m.isVisible).length,
                    scheduled: this.scheduledViewers.size
                },
                quality: {
                    global: this.qualityLevel,
                    adaptive: this.isAdaptiveMode
                },
                optimizer: this
            });
        }
    }
    
    /**
     * Mark viewer as having activity (user interaction)
     */
    markViewerActivity(viewerId) {
        const metrics = this.getViewerMetrics(viewerId);
        if (metrics) {
            metrics.lastActivityTime = Date.now();
            this.scheduleViewerRender(viewerId);
        }
    }
    
    /**
     * Get comprehensive performance statistics
     */
    getPerformanceStats() {
        const stats = {
            fps: {
                current: this.currentFPS,
                average: this.averageFPS,
                target: this.config.targetFPS,
                frameTime: this.frameTime
            },
            budget: {
                allocated: this.renderBudget,
                used: this.usedBudget,
                utilization: (this.usedBudget / this.renderBudget) * 100
            },
            viewers: {
                total: this.viewerMetrics.size,
                scheduled: this.scheduledViewers.size,
                visible: 0,
                active: 0
            },
            quality: {
                global: this.qualityLevel,
                adaptive: this.isAdaptiveMode
            },
            config: { ...this.config }
        };
        
        // Calculate viewer statistics
        this.viewerMetrics.forEach((metrics) => {
            if (metrics.isVisible) stats.viewers.visible++;
            if (metrics.isActive) stats.viewers.active++;
        });
        
        return stats;
    }
    
    /**
     * Get detailed viewer metrics
     */
    getViewerStats() {
        const viewerStats = [];
        
        this.viewerMetrics.forEach((metrics, viewerId) => {
            viewerStats.push({
                id: viewerId,
                isVisible: metrics.isVisible,
                isActive: metrics.isActive,
                visibilityRatio: metrics.visibilityRatio,
                renderCount: metrics.renderCount,
                avgRenderTime: metrics.avgRenderTime,
                frameSkipCount: metrics.frameSkipCount,
                qualityLevel: metrics.qualityLevel,
                lastActivityTime: metrics.lastActivityTime,
                needsRender: metrics.needsRender
            });
        });
        
        return viewerStats;
    }
    
    /**
     * Configure optimization settings
     */
    configure(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Recalculate render budget
        this.renderBudget = 1000 / this.config.targetFPS;
        
        console.log('RenderOptimizer: Configuration updated', this.config);
    }
    
    /**
     * Enable/disable adaptive rendering
     */
    setAdaptiveRendering(enabled) {
        this.config.adaptiveRendering = enabled;
        this.isAdaptiveMode = enabled;
        
        if (!enabled) {
            // Reset all viewers to high quality when disabling adaptive mode
            this.setGlobalQualityLevel('high');
        }
        
        console.log(`RenderOptimizer: Adaptive rendering ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Force render all viewers (bypass optimization)
     */
    forceRenderAll() {
        const currentTime = performance.now();
        
        this.viewerMetrics.forEach((metrics, viewerId) => {
            this.renderViewer(viewerId, currentTime, 0);
        });
    }
    
    /**
     * Cleanup and destroy optimizer
     */
    destroy() {
        this.stopRenderLoop();
        
        // Cleanup intersection observer
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        // Clear all metrics
        this.viewerMetrics.clear();
        this.scheduledViewers.clear();
        this.lastActivity.clear();
        
        // Remove event listeners
        this.removeAllListeners();
        
        console.log('RenderOptimizer: Destroyed');
    }
}