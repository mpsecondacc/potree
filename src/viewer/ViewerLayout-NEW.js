/**
 * ViewerLayout-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Manages viewport layout and positioning for multiple viewers.
 * Supports various layout patterns (1x1, 1x2, 2x1, 2x2, etc.) with
 * responsive resizing and custom positioning.
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class ViewerLayout extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.currentLayout = '1x1';
        this.customPositions = new Map(); // viewerId -> {x, y, width, height}
        this.layoutDefinitions = new Map();
        
        this.containerBounds = { width: 0, height: 0 };
        this.viewerSpacing = 2; // Gap between viewers in pixels
        
        this.initializeLayoutDefinitions();
    }
    
    /**
     * Initialize predefined layout patterns
     */
    initializeLayoutDefinitions() {
        // Layout format: {rows, cols, positions: [{row, col, rowSpan?, colSpan?}]}
        
        this.layoutDefinitions.set('1x1', {
            rows: 1, cols: 1,
            positions: [
                { row: 0, col: 0, id: 'auto' }
            ]
        });
        
        this.layoutDefinitions.set('1x2', {
            rows: 1, cols: 2,
            positions: [
                { row: 0, col: 0, id: 'auto' },
                { row: 0, col: 1, id: 'auto' }
            ]
        });
        
        this.layoutDefinitions.set('2x1', {
            rows: 2, cols: 1,
            positions: [
                { row: 0, col: 0, id: 'auto' },
                { row: 1, col: 0, id: 'auto' }
            ]
        });
        
        this.layoutDefinitions.set('2x2', {
            rows: 2, cols: 2,
            positions: [
                { row: 0, col: 0, id: 'auto' },
                { row: 0, col: 1, id: 'auto' },
                { row: 1, col: 0, id: 'auto' },
                { row: 1, col: 1, id: 'auto' }
            ]
        });
        
        this.layoutDefinitions.set('1x3', {
            rows: 1, cols: 3,
            positions: [
                { row: 0, col: 0, id: 'auto' },
                { row: 0, col: 1, id: 'auto' },
                { row: 0, col: 2, id: 'auto' }
            ]
        });
        
        this.layoutDefinitions.set('3x1', {
            rows: 3, cols: 1,
            positions: [
                { row: 0, col: 0, id: 'auto' },
                { row: 1, col: 0, id: 'auto' },
                { row: 2, col: 0, id: 'auto' }
            ]
        });
        
        // Special layouts for specific use cases
        this.layoutDefinitions.set('main-profile', {
            rows: 1, cols: 3,
            positions: [
                { row: 0, col: 0, colSpan: 2, id: 'main' },    // Main viewer (2/3 width)
                { row: 0, col: 2, colSpan: 1, id: 'profile' }  // Profile viewer (1/3 width)
            ]
        });
        
        this.layoutDefinitions.set('main-dual', {
            rows: 2, cols: 2,
            positions: [
                { row: 0, col: 0, rowSpan: 2, id: 'main' },    // Main viewer (left half, full height)
                { row: 0, col: 1, id: 'top' },                 // Top right viewer
                { row: 1, col: 1, id: 'bottom' }               // Bottom right viewer
            ]
        });
    }
    
    /**
     * Initialize layout system
     */
    initialize() {
        this.updateContainerBounds();
        
        // Setup resize observer if available
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleContainerResize();
            });
            this.resizeObserver.observe(this.viewerManager.containerElement);
        }
    }
    
    /**
     * Set the current layout pattern
     * @param {string} layoutPattern - Layout identifier (e.g., '2x2', 'main-profile')
     */
    setLayout(layoutPattern) {
        if (!this.layoutDefinitions.has(layoutPattern)) {
            console.warn(`Unknown layout pattern: ${layoutPattern}`);
            return false;
        }
        
        const previousLayout = this.currentLayout;
        this.currentLayout = layoutPattern;
        
        this.updateLayout();
        
        this.dispatchEvent({
            type: 'layout_changed',
            previousLayout: previousLayout,
            currentLayout: layoutPattern
        });
        
        console.log(`Layout changed to: ${layoutPattern}`);
        return true;
    }
    
    /**
     * Get current layout pattern
     */
    getCurrentLayout() {
        return this.currentLayout;
    }
    
    /**
     * Update layout positions for all viewers
     */
    updateLayout() {
        this.updateContainerBounds();
        
        const layoutDef = this.layoutDefinitions.get(this.currentLayout);
        if (!layoutDef) {
            console.error(`Layout definition not found: ${this.currentLayout}`);
            return;
        }
        
        const viewers = this.viewerManager.registry.getAllViewers();
        const viewerIds = Object.keys(viewers);
        
        if (viewerIds.length === 0) {
            return; // No viewers to layout
        }
        
        // Clear layout assignment flags
        for (const viewerId of viewerIds) {
            const viewer = viewers[viewerId];
            if (viewer) {
                viewer._layoutAssigned = false;
            }
        }
        
        // Calculate grid dimensions
        const { cellWidth, cellHeight } = this.calculateGridDimensions(layoutDef);
        
        // Position viewers according to layout
        let positionIndex = 0;
        for (const position of layoutDef.positions) {
            if (positionIndex >= viewerIds.length) {
                break; // More positions than viewers
            }
            
            let viewerId;
            let viewer;
            
            if (position.id === 'auto') {
                // Auto-assign by index
                viewerId = viewerIds[positionIndex];
                viewer = viewers[viewerId];
            } else {
                // Try to find the specific viewer ID
                viewerId = position.id;
                viewer = viewers[viewerId];
                
                // If specific viewer not found, fall back to any available viewer
                if (!viewer || !viewer.renderArea) {
                    const availableViewers = viewerIds.filter(id => {
                        const v = viewers[id];
                        return v && v.renderArea && !v._layoutAssigned;
                    });
                    
                    if (availableViewers.length > 0) {
                        viewerId = availableViewers[0];
                        viewer = viewers[viewerId];
                        console.log(`Layout fallback: Using viewer '${viewerId}' for position '${position.id}'`);
                    }
                }
            }
            
            if (!viewer || !viewer.renderArea) {
                positionIndex++;
                continue;
            }
            
            // Mark viewer as assigned to prevent double-assignment
            viewer._layoutAssigned = true;
            
            // Calculate position and size
            const rowSpan = position.rowSpan || 1;
            const colSpan = position.colSpan || 1;
            
            const x = position.col * cellWidth + (position.col * this.viewerSpacing);
            const y = position.row * cellHeight + (position.row * this.viewerSpacing);
            const width = cellWidth * colSpan + ((colSpan - 1) * this.viewerSpacing);
            const height = cellHeight * rowSpan + ((rowSpan - 1) * this.viewerSpacing);
            
            // Apply positioning
            this.positionViewer(viewerId, { x, y, width, height });
            
            positionIndex++;
        }
        
        this.dispatchEvent({
            type: 'layout_updated',
            layout: this.currentLayout
        });
    }
    
    /**
     * Calculate grid cell dimensions based on layout
     */
    calculateGridDimensions(layoutDef) {
        const availableWidth = this.containerBounds.width - (this.viewerSpacing * (layoutDef.cols - 1));
        const availableHeight = this.containerBounds.height - (this.viewerSpacing * (layoutDef.rows - 1));
        
        const cellWidth = Math.floor(availableWidth / layoutDef.cols);
        const cellHeight = Math.floor(availableHeight / layoutDef.rows);
        
        return { cellWidth, cellHeight };
    }
    
    /**
     * Position a specific viewer
     * @param {string} viewerId
     * @param {Object} bounds - {x, y, width, height}
     */
    positionViewer(viewerId, bounds) {
        const viewer = this.viewerManager.registry.getViewer(viewerId);
        if (!viewer || !viewer.renderArea) {
            return;
        }
        
        const container = viewer.renderArea;
        
        // Ensure minimum dimensions to prevent rendering issues
        const minWidth = 100;
        const minHeight = 100;
        const adjustedBounds = {
            x: Math.max(0, bounds.x),
            y: Math.max(0, bounds.y),
            width: Math.max(minWidth, bounds.width),
            height: Math.max(minHeight, bounds.height)
        };
        
        // Apply positioning
        container.style.left = `${adjustedBounds.x}px`;
        container.style.top = `${adjustedBounds.y}px`;
        container.style.width = `${adjustedBounds.width}px`;
        container.style.height = `${adjustedBounds.height}px`;
        
        // Store position for reference
        this.customPositions.set(viewerId, adjustedBounds);
        
        // Enhanced viewer resize with better error handling
        this.resizeViewer(viewer, adjustedBounds, viewerId);
        
        this.dispatchEvent({
            type: 'viewer_positioned',
            viewerId: viewerId,
            bounds: adjustedBounds
        });
    }
    
    /**
     * Resize viewer with improved aspect ratio and performance handling
     * @param {Viewer} viewer - The viewer instance
     * @param {Object} bounds - New dimensions
     * @param {string} viewerId - Viewer ID for logging
     */
    resizeViewer(viewer, bounds, viewerId) {
        if (!viewer.renderer) {
            console.warn(`ViewerLayout: Cannot resize viewer '${viewerId}' - no renderer`);
            return;
        }
        
        // Use RAF for smooth resizing and better performance
        requestAnimationFrame(() => {
            try {
                const aspect = bounds.width / bounds.height;
                
                // Ensure aspect ratio is valid
                if (!isFinite(aspect) || aspect <= 0) {
                    console.warn(`ViewerLayout: Invalid aspect ratio for viewer '${viewerId}': ${aspect}`);
                    return;
                }
                
                // Update renderer size with device pixel ratio
                const pixelRatio = viewer.renderer.getPixelRatio() || 1;
                const renderWidth = bounds.width * pixelRatio;
                const renderHeight = bounds.height * pixelRatio;
                
                viewer.renderer.setSize(renderWidth, renderHeight, false);
                
                // Update canvas display size explicitly
                if (viewer.renderer.domElement) {
                    viewer.renderer.domElement.style.width = `${bounds.width}px`;
                    viewer.renderer.domElement.style.height = `${bounds.height}px`;
                }
                
                // Update perspective camera aspect ratio
                if (viewer.scene && viewer.scene.cameraP) {
                    viewer.scene.cameraP.aspect = aspect;
                    viewer.scene.cameraP.updateProjectionMatrix();
                }
                
                // Update orthographic camera with improved frustum calculation
                if (viewer.scene && viewer.scene.cameraO) {
                    const frustumScale = viewer.scene.view ? viewer.scene.view.radius : 1000;
                    const halfHeight = frustumScale / aspect;
                    
                    viewer.scene.cameraO.left = -frustumScale;
                    viewer.scene.cameraO.right = frustumScale;
                    viewer.scene.cameraO.top = halfHeight;
                    viewer.scene.cameraO.bottom = -halfHeight;
                    viewer.scene.cameraO.updateProjectionMatrix();
                }
                
                // Force a render update to ensure changes are applied
                if (viewer.needsRedraw !== undefined) {
                    viewer.needsRedraw = true;
                }
                
                // Notify viewer of resize for any internal handling
                if (viewer.onResize && typeof viewer.onResize === 'function') {
                    viewer.onResize(bounds.width, bounds.height);
                }
                
                console.log(`ViewerLayout: Resized viewer '${viewerId}' to ${bounds.width}x${bounds.height} (aspect: ${aspect.toFixed(3)})`);
                
            } catch (error) {
                console.error(`ViewerLayout: Error resizing viewer '${viewerId}':`, error);
            }
        });
    }
    
    /**
     * Set custom position for a viewer (overrides layout)
     * @param {string} viewerId
     * @param {Object} bounds - {x, y, width, height} in pixels
     */
    setCustomViewerPosition(viewerId, bounds) {
        this.positionViewer(viewerId, bounds);
        
        this.dispatchEvent({
            type: 'custom_position_set',
            viewerId: viewerId,
            bounds: bounds
        });
    }
    
    /**
     * Get viewer position bounds
     * @param {string} viewerId
     * @returns {Object|null} {x, y, width, height}
     */
    getViewerBounds(viewerId) {
        return this.customPositions.get(viewerId) || null;
    }
    
    /**
     * Update container bounds
     */
    updateContainerBounds() {
        const container = this.viewerManager.containerElement;
        this.containerBounds = {
            width: container.clientWidth,
            height: container.clientHeight
        };
    }
    
    /**
     * Handle container resize
     */
    handleContainerResize() {
        this.updateLayout();
        
        this.dispatchEvent({
            type: 'container_resized',
            bounds: this.containerBounds
        });
    }
    
    /**
     * Define a custom layout pattern
     * @param {string} name - Layout name
     * @param {Object} definition - Layout definition
     */
    defineLayout(name, definition) {
        // Validate layout definition
        if (!definition.rows || !definition.cols || !definition.positions) {
            throw new Error('Layout definition must include rows, cols, and positions');
        }
        
        this.layoutDefinitions.set(name, definition);
        
        this.dispatchEvent({
            type: 'layout_defined',
            name: name,
            definition: definition
        });
        
        console.log(`Custom layout '${name}' defined`);
    }
    
    /**
     * Get available layout patterns
     * @returns {Array} Array of layout names
     */
    getAvailableLayouts() {
        return Array.from(this.layoutDefinitions.keys());
    }
    
    /**
     * Get layout definition
     * @param {string} layoutName
     * @returns {Object|null}
     */
    getLayoutDefinition(layoutName) {
        return this.layoutDefinitions.get(layoutName) || null;
    }
    
    /**
     * Check if layout can accommodate number of viewers
     * @param {string} layoutName
     * @param {number} viewerCount
     * @returns {boolean}
     */
    canAccommodateViewers(layoutName, viewerCount) {
        const layoutDef = this.layoutDefinitions.get(layoutName);
        if (!layoutDef) {
            return false;
        }
        
        return layoutDef.positions.length >= viewerCount;
    }
    
    /**
     * Get optimal layout for viewer count
     * @param {number} viewerCount
     * @returns {string}
     */
    getOptimalLayout(viewerCount) {
        if (viewerCount <= 1) return '1x1';
        if (viewerCount === 2) return '1x2';
        if (viewerCount === 3) return '1x3';
        if (viewerCount === 4) return '2x2';
        if (viewerCount === 5) return '1x3'; // Will need custom handling for 5th viewer
        
        return '2x2'; // Default fallback
    }
    
    /**
     * Export layout configuration
     */
    exportConfiguration() {
        return {
            currentLayout: this.currentLayout,
            customPositions: Object.fromEntries(this.customPositions),
            viewerSpacing: this.viewerSpacing,
            containerBounds: this.containerBounds
        };
    }
    
    /**
     * Import layout configuration
     */
    importConfiguration(config) {
        if (config.currentLayout) {
            this.setLayout(config.currentLayout);
        }
        
        if (config.customPositions) {
            this.customPositions = new Map(Object.entries(config.customPositions));
        }
        
        if (config.viewerSpacing) {
            this.viewerSpacing = config.viewerSpacing;
        }
        
        this.updateLayout();
    }
    
    /**
     * Cleanup layout system
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        this.customPositions.clear();
        this.removeAllListeners();
    }
}