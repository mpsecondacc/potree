/**
 * ViewerManager-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for multi-viewer functionality
 * 
 * Central manager for coordinating multiple Potree viewer instances.
 * Handles viewer lifecycle, layout management, and resource coordination.
 * 
 * Designed with future CAD features in mind:
 * - Layer system integration
 * - Selection management
 * - Drawing tools coordination
 * - Cross-viewer synchronization
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../EventDispatcher.js";
import { ViewerLayout } from "./ViewerLayout-NEW.js";
import { ViewerRegistry } from "./ViewerRegistry-NEW.js";
import { ViewerSync } from "./ViewerSync-NEW.js";
import { SharedResourceManager } from "./SharedResourceManager-NEW.js";
import { RenderOptimizer } from "./RenderOptimizer-NEW.js";
import { CrossViewerCommunication } from "./CrossViewerCommunication-NEW.js";
import { MultiViewerSidebar } from "./MultiViewerSidebar-NEW.js";

export class ViewerManager extends EventDispatcher {
    
    constructor(containerElement, options = {}) {
        super();
        
        this.containerElement = containerElement;
        this.options = {
            maxViewers: 5,
            defaultLayout: '1x1',
            enableSync: true,
            enableLayerSystem: true, // Future CAD features
            enableSelectionSystem: true,
            ...options
        };
        
        // Core components
        this.layout = new ViewerLayout(this);
        this.registry = new ViewerRegistry(this);
        this.sync = new ViewerSync(this);
        this.renderOptimizer = new RenderOptimizer(this);
        this.communication = new CrossViewerCommunication(this);
        
        // State management
        this.activeViewerId = null;
        this.isInitialized = false;
        this.resizeTimeout = null;
        // CRITICAL: DO NOT CHANGE THIS DEFAULT - Lock Focus must start OFF (false)
        // This ensures viewers work in hover-to-interact mode by default
        // Only toggle via toggleFocusLock() method when explicitly requested
        this.focusLockEnabled = false; // Default: hover-to-interact mode (OFF)
        
        // Future CAD systems (placeholder for now)
        this.layerManager = null;
        this.selectionManager = null;
        this.drawingManager = null;
        
        // Resource management
        this.sharedResources = new SharedResourceManager();
        
        // Sidebar management
        this.viewerSidebars = new Map(); // viewerId -> ViewerSidebar
        
        this.initialize();
    }
    
    /**
     * Initialize the multi-viewer system
     */
    initialize() {
        if (this.isInitialized) {
            console.warn('ViewerManager already initialized');
            return;
        }
        
        // Setup container
        this.setupContainer();
        
        // Initialize layout system
        this.layout.initialize();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Initialize with default layout
        this.setLayout(this.options.defaultLayout);
        
        // Start the unified render loop
        this.renderOptimizer.startRenderLoop();
        
        this.isInitialized = true;
        
        this.dispatchEvent({
            type: 'initialized',
            manager: this
        });
        
        console.log(`ViewerManager initialized with max ${this.options.maxViewers} viewers and unified render loop`);
    }
    
    /**
     * Setup the main container element
     */
    setupContainer() {
        if (!this.containerElement) {
            throw new Error('Container element is required for ViewerManager');
        }
        
        // Ensure container has proper styling for multi-viewer layout
        const container = this.containerElement;
        if (!container.style.position) {
            container.style.position = 'relative';
        }
        container.style.width = container.style.width || '100%';
        container.style.height = container.style.height || '100%';
        container.style.overflow = 'hidden';
        
        // Add CSS class for multi-viewer styling
        container.classList.add('potree-multi-viewer-container');
    }
    
    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Handle container click for viewer focus
        this.containerElement.addEventListener('click', (event) => {
            this.handleContainerClick(event);
        });
    }
    
    /**
     * Create a new viewer with specified ID and configuration -ss
     * @param {string} viewerId - Unique identifier for the viewer
     * @param {Object} config - Viewer configuration
     * @returns {Promise<Viewer>} The created viewer instance
     */
    async createViewer(viewerId, config = {}) {
        // Validate viewer limit
        if (this.registry.getViewerCount() >= this.options.maxViewers) {
            throw new Error(`Maximum number of viewers (${this.options.maxViewers}) reached`);
        }
        
        // Validate unique ID
        if (this.registry.hasViewer(viewerId)) {
            throw new Error(`Viewer with ID '${viewerId}' already exists`);
        }
        
        // Create viewer container element
        const viewerContainer = this.createViewerContainer(viewerId, config);
        
        // Viewer configuration with multi-viewer support
        const viewerConfig = {
            isMultiViewer: true,
            managerId: this.constructor.name,
            viewerId: viewerId,
            sharedResources: this.sharedResources,
            ...config
        };
        
        // Create the actual Potree viewer
        // Use the global Potree.Viewer which should be available
        if (!window.Potree || !window.Potree.Viewer) {
            throw new Error('Potree.Viewer not available. Make sure Potree is loaded.');
        }
        
        const viewer = new window.Potree.Viewer(viewerContainer, viewerConfig);
        
        // Register the viewer
        this.registry.registerViewer(viewerId, viewer, config);
        
        // Setup viewer for multi-viewer mode
        this.setupViewer(viewer, viewerId, config);
        
        // Update layout
        this.layout.updateLayout();
        
        // Set as active if it's the first viewer
        if (this.registry.getViewerCount() === 1) {
            this.setActiveViewer(viewerId);
        }
        
        // CRITICAL FIX: Ensure viewer is marked as ready for rendering
        // Give the DOM time to update, then force a layout update
        setTimeout(() => {
            this.activateViewer(viewerId);
            this.layout.updateLayout();
        }, 100);
        
        this.dispatchEvent({
            type: 'viewer_created',
            viewerId: viewerId,
            viewer: viewer,
            manager: this
        });
        
        console.log(`Created viewer '${viewerId}' (${this.registry.getViewerCount()}/${this.options.maxViewers})`);
        
        return viewer;
    }
    
    /**
     * Create DOM container for a viewer
     */
    createViewerContainer(viewerId, config) {
        const container = document.createElement('div');
        container.id = `potree-viewer-${viewerId}`;
        container.className = 'potree-viewer-container';
        container.style.position = 'absolute';
        container.style.border = '2px solid #888888';
        container.style.borderStyle = 'solid';
        container.style.boxSizing = 'border-box';
        container.style.boxShadow = 'none';
        container.style.outline = 'none';
        
        // Add viewer label
        const label = document.createElement('div');
        label.className = 'potree-viewer-label';
        label.textContent = config.name || viewerId;
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.color = '#fff';
        label.style.background = 'rgba(0,0,0,0.7)';
        label.style.padding = '2px 6px';
        label.style.fontSize = '12px';
        label.style.borderRadius = '3px';
        label.style.zIndex = '1000';
        label.style.pointerEvents = 'none';
        
        container.appendChild(label);
        this.containerElement.appendChild(container);
        
        return container;
    }
    
    /**
     * Setup viewer for multi-viewer operation
     */
    setupViewer(viewer, viewerId, config) {
        // Initialize isolated state first
        this.isolateViewerState(viewer, viewerId);
        
        // Update multi-viewer properties with sync settings
        viewer.multiViewerConfig.syncEnabled = config.syncEnabled === true;
        
        // Setup viewer events
        viewer.addEventListener('camera_changed', (event) => {
            // Always capture camera state when it changes
            this.captureCameraState(viewerId);
            
            if (viewer.multiViewerConfig.syncEnabled) {
                // Use new sync system for camera state synchronization
                const allViewers = Object.keys(this.registry.getAllViewers());
                const targetViewers = allViewers.filter(id => id !== viewerId);
                
                if (targetViewers.length > 0) {
                    this.synchronizeCameraStates(viewerId, targetViewers);
                }
                
                // Also call original sync system for backward compatibility
                this.sync.propagateCameraChange(viewerId, event);
            }
        });
        
        // Setup control isolation monitoring
        viewer.addEventListener('tool_changed', (event) => {
            // Ensure tool changes only affect this viewer
            if (viewer.multiViewerConfig.isolatedState) {
                viewer.multiViewerConfig.isolatedState.toolState.activeTool = event.tool;
            }
        });
        
        // Setup measurement isolation
        viewer.addEventListener('measurement_added', (event) => {
            if (viewer.multiViewerConfig.isolatedState) {
                viewer.multiViewerConfig.isolatedState.measurementState.measurements.push(event.measurement);
            }
        });
        
        // Disable GUI loading by default for multi-viewer mode
        // The main viewer or manager should handle UI
        if (config.loadGUI !== true) {
            // Override loadGUI to prevent automatic loading
            viewer.loadGUI = () => Promise.resolve();
        }
        
        // RENDER OPTIMIZATION: Register viewer with unified render optimizer
        // The RenderOptimizer will manage rendering for optimal performance
        this.renderOptimizer.registerViewer(viewerId, viewer);
        
        // SIDEBAR: Create viewer-specific sidebar (async)
        this.createViewerSidebar(viewerId, viewer).catch(error => {
            console.error(`Failed to create sidebar for viewer '${viewerId}':`, error);
        });
        
        // Initialize camera management after viewer is ready
        setTimeout(() => {
            this.initializeCameraManagement(viewer, viewerId);
            this.verifyControlIsolation(viewerId);
        }, 100);
    }
    
    /**
     * Mark viewer as having activity for optimization
     * @param {string} viewerId - The viewer ID
     */
    markViewerActivity(viewerId) {
        if (this.renderOptimizer) {
            this.renderOptimizer.markViewerActivity(viewerId);
        }
    }
    
    /**
     * Create viewer-specific sidebar
     * @param {string} viewerId - The viewer ID
     * @param {Viewer} viewer - The viewer instance
     */
    async createViewerSidebar(viewerId, viewer) {
        try {
            const sidebar = new MultiViewerSidebar(viewer, viewerId, this);
            
            // Initialize sidebar asynchronously (loads template, sets up DOM)
            await sidebar.init();
            
            this.viewerSidebars.set(viewerId, sidebar);
            
            console.log(`Created and initialized sidebar for viewer '${viewerId}' - Total sidebars: ${this.viewerSidebars.size}`);
            
        } catch (error) {
            console.error(`Failed to create sidebar for viewer '${viewerId}':`, error);
        }
    }
    
    /**
     * Cleanup viewer sidebar
     * @param {string} viewerId - The viewer ID
     */
    cleanupViewerSidebar(viewerId) {
        const sidebar = this.viewerSidebars.get(viewerId);
        if (sidebar) {
            try {
                sidebar.destroy();
                this.viewerSidebars.delete(viewerId);
                console.log(`Cleaned up sidebar for viewer '${viewerId}'`);
            } catch (error) {
                console.error(`Error cleaning up sidebar for viewer '${viewerId}':`, error);
            }
        }
    }
    
    /**
     * Remove a viewer
     */
    removeViewer(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            console.warn(`Viewer '${viewerId}' not found`);
            return false;
        }
        
        // RENDER OPTIMIZATION: Unregister from render optimizer first
        if (this.renderOptimizer) {
            this.renderOptimizer.unregisterViewer(viewerId);
        }
        
        // SIDEBAR: Cleanup viewer sidebar
        this.cleanupViewerSidebar(viewerId);
        
        // Cleanup viewer
        this.cleanupViewer(viewerId, viewer);
        
        // Unregister viewer
        this.registry.unregisterViewer(viewerId);
        
        // Update layout
        this.layout.updateLayout();
        
        // Handle active viewer change
        if (this.activeViewerId === viewerId) {
            const remainingViewers = this.registry.getAllViewers();
            if (remainingViewers.length > 0) {
                this.setActiveViewer(Object.keys(remainingViewers)[0]);
            } else {
                this.activeViewerId = null;
            }
        }
        
        this.dispatchEvent({
            type: 'viewer_removed',
            viewerId: viewerId,
            manager: this
        });
        
        console.log(`Removed viewer '${viewerId}'`);
        return true;
    }
    
    /**
     * Cleanup viewer resources
     */
    cleanupViewer(viewerId, viewer) {
        // Disable input events and cleanup handlers
        this.disableViewerInput(viewer, viewerId);
        
        // Disable controls
        this.disableViewerControls(viewer, viewerId);
        
        // Release shared resources for this viewer
        this.sharedResources.releaseViewerResources(viewerId);
        
        // Remove container
        const container = viewer.renderArea;
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        
        // Cleanup viewer resources
        // Note: This might need additional cleanup based on viewer implementation
        if (viewer.renderer) {
            viewer.renderer.dispose();
        }
        
        // Remove from sync system
        this.sync.removeViewer(viewerId);
        
        // Cleanup multi-viewer config
        if (viewer.multiViewerConfig) {
            viewer.multiViewerConfig.eventHandlers = {};
            viewer.multiViewerConfig.isActive = false;
            viewer.multiViewerConfig.receivesInput = false;
        }
    }
    
    /**
     * Set the layout pattern (1x1, 1x2, 2x1, 2x2, etc.)
     */
    setLayout(layoutPattern) {
        this.layout.setLayout(layoutPattern);
        
        this.dispatchEvent({
            type: 'layout_changed',
            layout: layoutPattern,
            manager: this
        });
    }
    
    /**
     * Get current layout pattern
     */
    getLayout() {
        return this.layout.getCurrentLayout();
    }
    
    /**
     * Set active viewer (receives input focus)
     */
    setActiveViewer(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            console.warn(`Cannot activate viewer '${viewerId}' - not found`);
            return false;
        }
        
        const previousViewerId = this.activeViewerId;
        
        // Deactivate current active viewer
        if (this.activeViewerId && this.activeViewerId !== viewerId) {
            this.deactivateViewer(this.activeViewerId);
        }
        
        // Activate new viewer
        this.activateViewerForInput(viewer, viewerId);
        this.activeViewerId = viewerId;
        
        console.log(`ViewerManager: Activated viewer '${viewerId}' (input focus)`);
        
        this.dispatchEvent({
            type: 'active_viewer_changed',
            previousViewerId: previousViewerId,
            activeViewerId: viewerId,
            manager: this
        });
        
        return true;
    }
    
    /**
     * Activate viewer for input handling
     * @param {Viewer} viewer - The viewer to activate
     * @param {string} viewerId - The viewer ID
     */
    activateViewerForInput(viewer, viewerId) {
        // Set multi-viewer state
        viewer.multiViewerConfig.isActive = true;
        viewer.multiViewerConfig.receivesInput = true;
        
        // Update visual state
        this.updateViewerVisualState(viewerId, true);
        
        // Enable input events on the viewer container
        this.enableViewerInput(viewer, viewerId);
        
        // Set canvas focus for keyboard events
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.tabIndex = 0;
            viewer.renderer.domElement.focus();
        }
        
        // Enable viewer controls if they exist
        this.enableViewerControls(viewer, viewerId);
    }
    
    /**
     * Deactivate viewer from input handling
     * @param {string} viewerId - The viewer ID to deactivate
     */
    deactivateViewer(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            return false;
        }
        
        // Set multi-viewer state
        viewer.multiViewerConfig.isActive = false;
        viewer.multiViewerConfig.receivesInput = false;
        
        // Update visual state
        this.updateViewerVisualState(viewerId, false);
        
        // Disable input events on the viewer container
        this.disableViewerInput(viewer, viewerId);
        
        // Remove canvas focus
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.tabIndex = -1;
            viewer.renderer.domElement.blur();
        }
        
        // Disable viewer controls
        this.disableViewerControls(viewer, viewerId);
        
        console.log(`ViewerManager: Deactivated viewer '${viewerId}' (input disabled)`);
        return true;
    }
    
    /**
     * Enable input event handling for a viewer
     * @param {Viewer} viewer - The viewer instance
     * @param {string} viewerId - The viewer ID
     */
    enableViewerInput(viewer, viewerId) {
        const container = viewer.renderArea;
        if (!container) return;
        
        // Remove any existing event listeners to prevent duplicates
        this.disableViewerInput(viewer, viewerId);
        
        // Store event handlers for cleanup
        if (!viewer.multiViewerConfig.eventHandlers) {
            viewer.multiViewerConfig.eventHandlers = {};
        }
        
        const handlers = viewer.multiViewerConfig.eventHandlers;
        
        // Create capturing event handlers that run before Potree's listeners
        handlers.mousedown = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mousedown');
        handlers.mousemove = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mousemove');
        handlers.mouseup = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mouseup');
        handlers.mouseenter = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mouseenter');
        handlers.wheel = (event) => this.handleViewerWheelEvent(event, viewer, viewerId);
        handlers.contextmenu = (event) => this.handleViewerContextMenu(event, viewer, viewerId);
        
        // Touch events for mobile
        handlers.touchstart = (event) => this.handleViewerTouchEvent(event, viewer, viewerId, 'touchstart');
        handlers.touchmove = (event) => this.handleViewerTouchEvent(event, viewer, viewerId, 'touchmove');
        handlers.touchend = (event) => this.handleViewerTouchEvent(event, viewer, viewerId, 'touchend');
        
        // Keyboard events
        handlers.keydown = (event) => this.handleViewerKeyEvent(event, viewer, viewerId, 'keydown');
        handlers.keyup = (event) => this.handleViewerKeyEvent(event, viewer, viewerId, 'keyup');
        
        // Add event listeners with capture=true to intercept before Potree
        container.addEventListener('mousedown', handlers.mousedown, { capture: true, passive: false });
        container.addEventListener('mousemove', handlers.mousemove, { capture: true, passive: false });
        container.addEventListener('mouseup', handlers.mouseup, { capture: true, passive: false });
        container.addEventListener('mouseenter', handlers.mouseenter, { capture: true, passive: false });
        container.addEventListener('wheel', handlers.wheel, { capture: true, passive: false });
        container.addEventListener('contextmenu', handlers.contextmenu, { capture: true, passive: false });
        container.addEventListener('touchstart', handlers.touchstart, { capture: true, passive: false });
        container.addEventListener('touchmove', handlers.touchmove, { capture: true, passive: false });
        container.addEventListener('touchend', handlers.touchend, { capture: true, passive: false });
        
        // Also add listeners on the canvas element directly
        if (viewer.renderer && viewer.renderer.domElement) {
            const canvas = viewer.renderer.domElement;
            
            // Store canvas handlers separately 
            handlers.canvasMousedown = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mousedown');
            handlers.canvasMousemove = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mousemove');
            handlers.canvasMouseup = (event) => this.handleViewerMouseEvent(event, viewer, viewerId, 'mouseup');
            handlers.canvasWheel = (event) => this.handleViewerWheelEvent(event, viewer, viewerId);
            
            canvas.addEventListener('mousedown', handlers.canvasMousedown, { capture: true, passive: false });
            canvas.addEventListener('mousemove', handlers.canvasMousemove, { capture: true, passive: false });
            canvas.addEventListener('mouseup', handlers.canvasMouseup, { capture: true, passive: false });
            canvas.addEventListener('wheel', handlers.canvasWheel, { capture: true, passive: false });
            
            // Keyboard events
            canvas.addEventListener('keydown', handlers.keydown, { capture: true, passive: false });
            canvas.addEventListener('keyup', handlers.keyup, { capture: true, passive: false });
        }
        
        // Enable pointer events on container and canvas
        container.style.pointerEvents = 'auto';
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.style.pointerEvents = 'auto';
        }
        
        console.log(`ViewerManager: Enabled input for viewer '${viewerId}' (with event capture)`);
    }
    
    /**
     * Disable input event handling for a viewer
     * @param {Viewer} viewer - The viewer instance  
     * @param {string} viewerId - The viewer ID
     */
    disableViewerInput(viewer, viewerId) {
        const container = viewer.renderArea;
        if (!container || !viewer.multiViewerConfig.eventHandlers) return;
        
        const handlers = viewer.multiViewerConfig.eventHandlers;
        
        // Remove container event listeners (with capture=true) except click for reactivation
        if (handlers.mousedown) container.removeEventListener('mousedown', handlers.mousedown, { capture: true });
        if (handlers.mousemove) container.removeEventListener('mousemove', handlers.mousemove, { capture: true });
        if (handlers.mouseup) container.removeEventListener('mouseup', handlers.mouseup, { capture: true });
        if (handlers.mouseenter) container.removeEventListener('mouseenter', handlers.mouseenter, { capture: true });
        if (handlers.wheel) container.removeEventListener('wheel', handlers.wheel, { capture: true });
        if (handlers.contextmenu) container.removeEventListener('contextmenu', handlers.contextmenu, { capture: true });
        if (handlers.touchstart) container.removeEventListener('touchstart', handlers.touchstart, { capture: true });
        if (handlers.touchmove) container.removeEventListener('touchmove', handlers.touchmove, { capture: true });
        if (handlers.touchend) container.removeEventListener('touchend', handlers.touchend, { capture: true });
        
        // Remove canvas event listeners
        if (viewer.renderer && viewer.renderer.domElement) {
            const canvas = viewer.renderer.domElement;
            
            if (handlers.canvasMousedown) canvas.removeEventListener('mousedown', handlers.canvasMousedown, { capture: true });
            if (handlers.canvasMousemove) canvas.removeEventListener('mousemove', handlers.canvasMousemove, { capture: true });
            if (handlers.canvasMouseup) canvas.removeEventListener('mouseup', handlers.canvasMouseup, { capture: true });
            if (handlers.canvasWheel) canvas.removeEventListener('wheel', handlers.canvasWheel, { capture: true });
            if (handlers.keydown) canvas.removeEventListener('keydown', handlers.keydown, { capture: true });
            if (handlers.keyup) canvas.removeEventListener('keyup', handlers.keyup, { capture: true });
        }
        
        // CRITICAL FIX: Don't block pointer events on container - we need click events for reactivation
        // Only block pointer events on the canvas to prevent Potree interaction
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.style.pointerEvents = 'none';
        }
        
        // Clear handlers but keep the container clickable
        viewer.multiViewerConfig.eventHandlers = {};
        
        console.log(`ViewerManager: Disabled input for viewer '${viewerId}' (canvas blocked, container clickable)`);
    }
    
    /**
     * Enable viewer controls (camera, tools, etc.)
     * @param {Viewer} viewer - The viewer instance
     * @param {string} viewerId - The viewer ID
     */
    enableViewerControls(viewer, viewerId) {
        // Enable camera controls if they exist
        if (viewer.controls) {
            viewer.controls.enabled = true;
            console.log(`ViewerManager: Enabled camera controls for viewer '${viewerId}'`);
        }
        
        // Enable navigation controls
        if (viewer.navigation) {
            if (viewer.navigation.enabled !== undefined) {
                viewer.navigation.enabled = true;
            }
            // Enable specific navigation modes
            if (viewer.navigation.orbit) viewer.navigation.orbit.enabled = true;
            if (viewer.navigation.fps) viewer.navigation.fps.enabled = true;
            if (viewer.navigation.earth) viewer.navigation.earth.enabled = true;
        }
        
        // Enable scene interaction
        if (viewer.scene) {
            if (viewer.scene.enableInteraction) {
                viewer.scene.enableInteraction();
            }
            
            // Enable specific scene tools
            if (viewer.scene.tools) {
                viewer.scene.tools.forEach(tool => {
                    if (tool.enabled !== undefined) {
                        tool.enabled = true;
                    }
                });
            }
            
            // Enable measurement tools
            if (viewer.scene.measurements) {
                viewer.scene.measurements.enabled = true;
            }
            
            // Enable annotation tools
            if (viewer.scene.annotations) {
                viewer.scene.annotations.enabled = true;
            }
        }
        
        // Enable viewer-specific tools and UI elements
        if (viewer.tools) {
            Object.values(viewer.tools).forEach(tool => {
                if (tool.enabled !== undefined) {
                    tool.enabled = true;
                }
            });
        }
        
        // Mark controls as enabled in multi-viewer config
        if (viewer.multiViewerConfig) {
            viewer.multiViewerConfig.controlsEnabled = true;
        }
        
        console.log(`ViewerManager: All controls enabled for viewer '${viewerId}'`);
    }
    
    /**
     * Disable viewer controls
     * @param {Viewer} viewer - The viewer instance
     * @param {string} viewerId - The viewer ID
     */
    disableViewerControls(viewer, viewerId) {
        // Disable camera controls
        if (viewer.controls) {
            viewer.controls.enabled = false;
            console.log(`ViewerManager: Disabled camera controls for viewer '${viewerId}'`);
        }
        
        // Disable navigation controls comprehensively
        if (viewer.navigation) {
            if (viewer.navigation.enabled !== undefined) {
                viewer.navigation.enabled = false;
            }
            // Disable specific navigation modes
            if (viewer.navigation.orbit) viewer.navigation.orbit.enabled = false;
            if (viewer.navigation.fps) viewer.navigation.fps.enabled = false;
            if (viewer.navigation.earth) viewer.navigation.earth.enabled = false;
        }
        
        // Disable scene interaction
        if (viewer.scene) {
            if (viewer.scene.disableInteraction) {
                viewer.scene.disableInteraction();
            }
            
            // Disable specific scene tools
            if (viewer.scene.tools) {
                viewer.scene.tools.forEach(tool => {
                    if (tool.enabled !== undefined) {
                        tool.enabled = false;
                    }
                });
            }
            
            // Disable measurement tools
            if (viewer.scene.measurements) {
                viewer.scene.measurements.enabled = false;
            }
            
            // Disable annotation tools
            if (viewer.scene.annotations) {
                viewer.scene.annotations.enabled = false;
            }
        }
        
        // Disable viewer-specific tools and UI elements
        if (viewer.tools) {
            Object.values(viewer.tools).forEach(tool => {
                if (tool.enabled !== undefined) {
                    tool.enabled = false;
                }
            });
        }
        
        // Mark controls as disabled in multi-viewer config
        if (viewer.multiViewerConfig) {
            viewer.multiViewerConfig.controlsEnabled = false;
        }
        
        console.log(`ViewerManager: All controls disabled for viewer '${viewerId}'`);
    }
    
    /**
     * Isolate viewer state to prevent cross-contamination
     * @param {Viewer} viewer - The viewer instance
     * @param {string} viewerId - The viewer ID
     */
    isolateViewerState(viewer, viewerId) {
        if (!viewer.multiViewerConfig) {
            viewer.multiViewerConfig = {
                id: viewerId,
                manager: this,
                isActive: false,
                receivesInput: false,
                syncEnabled: false,
                controlsEnabled: false,
                eventHandlers: {}
            };
        }
        
        // Create isolated state containers
        viewer.multiViewerConfig.isolatedState = {
            // Camera state isolation
            cameraState: {
                // Position and orientation
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                target: { x: 0, y: 0, z: 0 },
                
                // View parameters
                zoom: 1.0,
                fov: 60,
                near: 0.1,
                far: 1000,
                
                // Camera type and mode
                cameraType: 'perspective', // 'perspective' | 'orthographic'
                projectionMode: 'auto',
                
                // View controls
                yaw: 0,
                pitch: 0,
                radius: 100,
                
                // Bounds and limits
                minRadius: 1,
                maxRadius: 10000,
                
                // Animation state
                animating: false,
                animationTarget: null,
                
                // Last update timestamp
                lastUpdate: null
            },
            
            // Tool state isolation  
            toolState: {
                activeTool: null,
                toolSettings: new Map()
            },
            
            // Measurement state isolation
            measurementState: {
                measurements: [],
                activeMeasurement: null
            },
            
            // Selection state isolation
            selectionState: {
                selectedObjects: new Set(),
                selectionMode: 'single'
            },
            
            // UI state isolation
            uiState: {
                sidebarVisible: true,
                toolbarVisible: true,
                activeTab: null
            }
        };
        
        // Store reference to other viewers for isolation checks
        viewer.multiViewerConfig.otherViewers = () => {
            const allViewers = this.registry.getAllViewers();
            return Object.fromEntries(
                Object.entries(allViewers).filter(([id]) => id !== viewerId)
            );
        };
        
        console.log(`ViewerManager: Isolated state created for viewer '${viewerId}'`);
    }
    
    /**
     * Ensure viewer control isolation is maintained
     * @param {string} viewerId - The viewer ID to check
     * @returns {boolean} True if properly isolated
     */
    verifyControlIsolation(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            return false;
        }
        
        const config = viewer.multiViewerConfig;
        if (!config) {
            console.warn(`ViewerManager: No multi-viewer config found for '${viewerId}'`);
            return false;
        }
        
        // Verify control states match expected isolation
        const shouldBeEnabled = config.isActive && config.receivesInput;
        
        let isolationValid = true;
        const issues = [];
        
        // Check camera controls
        if (viewer.controls && viewer.controls.enabled !== shouldBeEnabled) {
            issues.push(`camera controls (expected: ${shouldBeEnabled}, actual: ${viewer.controls.enabled})`);
            isolationValid = false;
        }
        
        // Check navigation controls
        if (viewer.navigation && viewer.navigation.enabled !== undefined) {
            if (viewer.navigation.enabled !== shouldBeEnabled) {
                issues.push(`navigation controls (expected: ${shouldBeEnabled}, actual: ${viewer.navigation.enabled})`);
                isolationValid = false;
            }
        }
        
        // Check config state
        if (config.controlsEnabled !== shouldBeEnabled) {
            issues.push(`config controls (expected: ${shouldBeEnabled}, actual: ${config.controlsEnabled})`);
            isolationValid = false;
        }
        
        if (!isolationValid) {
            console.warn(`ViewerManager: Control isolation issues for '${viewerId}': ${issues.join(', ')}`);
        }
        
        return isolationValid;
    }
    
    /**
     * Initialize independent camera management for a viewer
     * @param {Viewer} viewer - The viewer instance
     * @param {string} viewerId - The viewer ID
     */
    initializeCameraManagement(viewer, viewerId) {
        if (!viewer.scene) {
            console.warn(`ViewerManager: No scene found for camera initialization in viewer '${viewerId}'`);
            return;
        }
        
        const cameraState = viewer.multiViewerConfig.isolatedState.cameraState;
        
        // Initialize camera state from current viewer camera
        if (viewer.scene.view) {
            const view = viewer.scene.view;
            
            // Copy current position
            if (view.position) {
                cameraState.position.x = view.position.x || 0;
                cameraState.position.y = view.position.y || 0;
                cameraState.position.z = view.position.z || 0;
            }
            
            // Copy view parameters
            cameraState.yaw = view.yaw || 0;
            cameraState.pitch = view.pitch || 0;
            cameraState.radius = view.radius || 100;
            
            // Set camera type based on active camera
            if (viewer.scene.cameraP && viewer.scene.getCamera && viewer.scene.getCamera() === viewer.scene.cameraP) {
                cameraState.cameraType = 'perspective';
                cameraState.fov = viewer.scene.cameraP.fov || 60;
            } else if (viewer.scene.cameraO) {
                cameraState.cameraType = 'orthographic';
            }
        }
        
        cameraState.lastUpdate = Date.now();
        
        console.log(`ViewerManager: Initialized camera management for viewer '${viewerId}' (${cameraState.cameraType})`);
    }
    
    /**
     * Capture current camera state for a viewer
     * @param {string} viewerId - The viewer ID
     * @returns {Object} Camera state snapshot
     */
    captureCameraState(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.scene || !viewer.scene.view) {
            return null;
        }
        
        const view = viewer.scene.view;
        const cameraState = viewer.multiViewerConfig.isolatedState.cameraState;
        
        // Update stored state with current values
        if (view.position) {
            cameraState.position.x = view.position.x;
            cameraState.position.y = view.position.y;
            cameraState.position.z = view.position.z;
        }
        
        cameraState.yaw = view.yaw;
        cameraState.pitch = view.pitch;
        cameraState.radius = view.radius;
        cameraState.lastUpdate = Date.now();
        
        // Capture current camera type and parameters
        try {
            let activeCamera = null;
            if (viewer.scene.getCamera && typeof viewer.scene.getCamera === 'function') {
                activeCamera = viewer.scene.getCamera();
            } else if (viewer.scene.cameraMode !== undefined) {
                // Fallback: determine camera based on cameraMode
                const CameraMode = window.Potree.CameraMode;
                if (viewer.scene.cameraMode === CameraMode.PERSPECTIVE) {
                    activeCamera = viewer.scene.cameraP;
                } else if (viewer.scene.cameraMode === CameraMode.ORTHOGRAPHIC) {
                    activeCamera = viewer.scene.cameraO;
                } else if (viewer.scene.cameraMode === CameraMode.VR) {
                    activeCamera = viewer.scene.cameraVR;
                }
            }
            
            if (activeCamera === viewer.scene.cameraP) {
                cameraState.cameraType = 'perspective';
                if (viewer.scene.cameraP.fov) cameraState.fov = viewer.scene.cameraP.fov;
                if (viewer.scene.cameraP.near) cameraState.near = viewer.scene.cameraP.near;
                if (viewer.scene.cameraP.far) cameraState.far = viewer.scene.cameraP.far;
            } else if (activeCamera === viewer.scene.cameraO) {
                cameraState.cameraType = 'orthographic';
            } else {
                // Default fallback
                cameraState.cameraType = 'perspective';
            }
        } catch (error) {
            console.warn(`ViewerManager: Could not determine camera type for viewer '${viewerId}':`, error);
            cameraState.cameraType = 'perspective'; // Default fallback
        }
        
        
        
        return { ...cameraState };
    }
    
    /**
     * Restore camera state for a viewer
     * @param {string} viewerId - The viewer ID
     * @param {Object} cameraState - Camera state to restore (optional, uses stored state if not provided)
     * @returns {boolean} Success status
     */
    restoreCameraState(viewerId, cameraState = null) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.scene || !viewer.scene.view) {
            return false;
        }
        
        const targetState = cameraState || viewer.multiViewerConfig.isolatedState.cameraState;
        const view = viewer.scene.view;
        
        try {
            // Restore position
            if (view.position && targetState.position) {
                view.position.set(
                    targetState.position.x,
                    targetState.position.y,
                    targetState.position.z
                );
            }
            
            // Restore view parameters
            if (typeof targetState.yaw === 'number') {
                view.yaw = targetState.yaw;
            }
            if (typeof targetState.pitch === 'number') {
                view.pitch = targetState.pitch;
            }
            if (typeof targetState.radius === 'number') {
                view.radius = Math.max(targetState.minRadius || 1, 
                                     Math.min(targetState.maxRadius || 10000, targetState.radius));
            }
            
            // Restore camera type if specified
            if (targetState.cameraType === 'perspective' && viewer.scene.cameraP) {
                if (viewer.scene.setCamera && typeof viewer.scene.setCamera === 'function') {
                    viewer.scene.setCamera(viewer.scene.cameraP);
                } else if (viewer.scene.cameraMode !== undefined) {
                    // Fallback: set camera mode directly
                    const CameraMode = window.Potree.CameraMode;
                    viewer.scene.cameraMode = CameraMode.PERSPECTIVE;
                }
                if (typeof targetState.fov === 'number') {
                    viewer.scene.cameraP.fov = targetState.fov;
                    viewer.scene.cameraP.updateProjectionMatrix();
                }
            } else if (targetState.cameraType === 'orthographic' && viewer.scene.cameraO) {
                if (viewer.scene.setCamera && typeof viewer.scene.setCamera === 'function') {
                    viewer.scene.setCamera(viewer.scene.cameraO);
                } else if (viewer.scene.cameraMode !== undefined) {
                    // Fallback: set camera mode directly
                    const CameraMode = window.Potree.CameraMode;
                    viewer.scene.cameraMode = CameraMode.ORTHOGRAPHIC;
                }
            }
            
            // Force view update
            if (view.update) {
                view.update();
            }
            
            console.log(`ViewerManager: Restored camera state for viewer '${viewerId}' (${targetState.cameraType})`);
            return true;
            
        } catch (error) {
            console.error(`ViewerManager: Failed to restore camera state for viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Set camera position for a specific viewer
     * @param {string} viewerId - The viewer ID
     * @param {Object} position - Position {x, y, z}
     * @param {Object} options - Additional options {target, animate}
     * @returns {boolean} Success status
     */
    setCameraPosition(viewerId, position, options = {}) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.scene || !viewer.scene.view) {
            return false;
        }
        
        const view = viewer.scene.view;
        const cameraState = viewer.multiViewerConfig.isolatedState.cameraState;
        
        try {
            if (options.animate && view.animateTo) {
                // Animate to new position
                cameraState.animating = true;
                cameraState.animationTarget = { ...position };
                
                view.animateTo(position, options.target || null, options.duration || 1000);
                
                setTimeout(() => {
                    cameraState.animating = false;
                    cameraState.animationTarget = null;
                }, options.duration || 1000);
                
            } else {
                // Immediate position change
                view.position.set(position.x, position.y, position.z);
                
                if (options.target && view.lookAt) {
                    view.lookAt(options.target);
                }
            }
            
            // Update stored state
            cameraState.position.x = position.x;
            cameraState.position.y = position.y;
            cameraState.position.z = position.z;
            cameraState.lastUpdate = Date.now();
            
            console.log(`ViewerManager: Set camera position for viewer '${viewerId}' to (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
            return true;
            
        } catch (error) {
            console.error(`ViewerManager: Failed to set camera position for viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Get camera position for a specific viewer
     * @param {string} viewerId - The viewer ID
     * @returns {Object|null} Position {x, y, z} or null if not available
     */
    getCameraPosition(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.scene || !viewer.scene.view || !viewer.scene.view.position) {
            return null;
        }
        
        const position = viewer.scene.view.position;
        return {
            x: position.x,
            y: position.y,
            z: position.z
        };
    }
    
    /**
     * Synchronize camera states between viewers (when sync is enabled)
     * @param {string} sourceViewerId - The viewer that initiated the change
     * @param {Array} targetViewerIds - Viewers to sync to
     * @returns {number} Number of viewers synchronized
     */
    synchronizeCameraStates(sourceViewerId, targetViewerIds) {
        const sourceState = this.captureCameraState(sourceViewerId);
        if (!sourceState) {
            return 0;
        }
        
        let syncedCount = 0;
        
        targetViewerIds.forEach(targetViewerId => {
            if (targetViewerId !== sourceViewerId) {
                const targetViewer = this.registry.getViewer(targetViewerId);
                if (targetViewer && targetViewer.multiViewerConfig.syncEnabled) {
                    if (this.restoreCameraState(targetViewerId, sourceState)) {
                        syncedCount++;
                    }
                }
            }
        });
        
        console.log(`ViewerManager: Synchronized camera state from '${sourceViewerId}' to ${syncedCount} viewers`);
        return syncedCount;
    }
    
    /**
     * Handle mouse events for active viewer
     */
    handleViewerMouseEvent(event, viewer, viewerId, eventType) {
        // Check if the event is from a sidebar control - if so, let it pass through unmodified
        if (this.isSidebarControlEvent(event)) {
            // Don't interfere with sidebar control events - allow default behavior
            // Explicitly allow the event to continue with default behavior
            return; // Early return without preventDefault/stopPropagation
        }
        
        // RENDER OPTIMIZATION: Mark viewer as having activity
        this.markViewerActivity(viewerId);
        
        // In focus lock mode, only process if this viewer is active
        if (this.focusLockEnabled) {
            if (!viewer.multiViewerConfig.isActive || !viewer.multiViewerConfig.receivesInput) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                console.log(`ViewerManager: [LOCKED] Blocked ${eventType} event on inactive viewer '${viewerId}'`);
                return false;
            }
        }
        // In hover mode, activate the viewer on mouse events
        else {
            // Auto-activate viewer on mouse interaction (hover mode)
            // Include mouseenter, mousemove, mousedown, mouseup for comprehensive hover detection
            if (eventType === 'mousedown' || eventType === 'mousemove' || eventType === 'mouseup' || 
                eventType === 'mouseenter' || eventType === 'wheel') {
                if (this.activeViewerId !== viewerId) {
                    this.setActiveViewer(viewerId);
                    console.log(`ViewerManager: [HOVER] Auto-activated viewer '${viewerId}' on ${eventType}`);
                }
            }
        }
        
        // Log active viewer events for debugging
        if (eventType === 'mousedown') {
            const mode = this.focusLockEnabled ? 'LOCKED' : 'HOVER';
            console.log(`ViewerManager: [${mode}] Processing ${eventType} event on viewer '${viewerId}'`);
        }
        
        // Let the viewer handle the event normally
        return true;
    }
    
    /**
     * Check if a mouse event is from a sidebar control element
     */
    isSidebarControlEvent(event) {
        if (!event || !event.target) return false;
        
        const target = event.target;
        
        // Check if the target is a sidebar control element
        // Look for specific sidebar control elements
        const sidebarSelectors = [
            'input[type="range"]',  // sliders
            'input[type="checkbox"]', // checkboxes
            'input[type="radio"]',   // radio buttons
            'select',               // dropdowns
            'button'                // buttons
        ];
        
        // Check if the target matches any sidebar control selector
        for (const selector of sidebarSelectors) {
            if (target.matches && target.matches(selector)) {
                // Also check if it's within a sidebar container
                const sidebarParent = target.closest('[data-viewer-sidebar]');
                if (sidebarParent) {
                    return true;
                }
            }
        }
        
        // Check if the target is within a sidebar container
        if (target.closest && target.closest('[data-viewer-sidebar]')) {
            return true;
        }
        
        // Check by ID patterns (for our specific sidebar controls)
        if (target.id && (
            target.id.includes('sldPointBudget-') ||
            target.id.includes('sldFOV-') ||
            target.id.includes('chkEDLEnabled-') ||
            target.id.includes('background_options-') ||
            target.id.includes('lblPointBudget-') ||
            target.id.includes('lblFOV-')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Handle wheel events for active viewer
     */
    handleViewerWheelEvent(event, viewer, viewerId) {
        // RENDER OPTIMIZATION: Mark viewer as having activity
        this.markViewerActivity(viewerId);
        
        // In focus lock mode, only process if this viewer is active
        if (this.focusLockEnabled) {
            if (!viewer.multiViewerConfig.isActive || !viewer.multiViewerConfig.receivesInput) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                console.log(`ViewerManager: [LOCKED] Blocked wheel event on inactive viewer '${viewerId}'`);
                return false;
            }
        }
        // In hover mode, activate the viewer on wheel events
        else {
            if (this.activeViewerId !== viewerId) {
                this.setActiveViewer(viewerId);
                console.log(`ViewerManager: [HOVER] Auto-activated viewer '${viewerId}' on wheel`);
            }
        }
        
        const mode = this.focusLockEnabled ? 'LOCKED' : 'HOVER';
        console.log(`ViewerManager: [${mode}] Processing wheel event on viewer '${viewerId}'`);
        // Let the viewer handle the event normally
        return true;
    }
    
    /**
     * Handle touch events for active viewer
     */
    handleViewerTouchEvent(event, viewer, viewerId, eventType) {
        // Only process if this viewer is active
        if (!viewer.multiViewerConfig.isActive || !viewer.multiViewerConfig.receivesInput) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        // Let the viewer handle the event normally
        return true;
    }
    
    /**
     * Handle keyboard events for active viewer
     */
    handleViewerKeyEvent(event, viewer, viewerId, eventType) {
        // RENDER OPTIMIZATION: Mark viewer as having activity
        this.markViewerActivity(viewerId);
        
        // Only process if this viewer is active
        if (!viewer.multiViewerConfig.isActive || !viewer.multiViewerConfig.receivesInput) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        // Let the viewer handle the event normally
        return true;
    }
    
    /**
     * Handle context menu for active viewer
     */
    handleViewerContextMenu(event, viewer, viewerId) {
        // Only process if this viewer is active
        if (!viewer.multiViewerConfig.isActive || !viewer.multiViewerConfig.receivesInput) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        // Let the viewer handle the event normally (or prevent if needed)
        // For now, prevent context menu to avoid browser menu
        event.preventDefault();
        return false;
    }
    
    /**
     * Update viewer visual state (active/inactive)
     */
    updateViewerVisualState(viewerId, isActive) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.renderArea) return;
        
        const container = viewer.renderArea;
        const label = container.querySelector('.potree-viewer-label');
        
        if (isActive) {
            // Active viewer: Bright blue glowing border
            container.style.borderColor = '#00aaff';
            container.style.borderWidth = '4px';
            container.style.borderStyle = 'solid';
            container.style.zIndex = '100';
            container.style.boxShadow = '0 0 15px rgba(0, 170, 255, 0.8), inset 0 0 5px rgba(0, 170, 255, 0.3)';
            container.style.outline = '2px solid rgba(0, 170, 255, 0.5)';
            container.style.outlineOffset = '2px';
            if (label) {
                label.style.background = 'rgba(0, 170, 255, 0.9)';
                label.style.color = '#ffffff';
                label.style.fontWeight = 'bold';
                label.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
            }
        } else {
            // Inactive viewer: Gray border, no glow
            container.style.borderColor = '#888888';
            container.style.borderWidth = '2px';
            container.style.borderStyle = 'solid';
            container.style.zIndex = '1';
            container.style.boxShadow = 'none';
            container.style.outline = 'none';
            container.style.outlineOffset = '0';
            if (label) {
                label.style.background = 'rgba(136, 136, 136, 0.8)';
                label.style.color = '#dddddd';
                label.style.fontWeight = 'normal';
                label.style.textShadow = 'none';
            }
        }
        
        console.log(`ViewerManager: Updated visual state for '${viewerId}' - ${isActive ? 'ACTIVE (blue glow)' : 'INACTIVE (gray)'}`);
    }
    
    /**
     * Activate viewer for rendering (ensures proper initialization)
     */
    activateViewer(viewerId) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            console.warn(`Cannot activate viewer '${viewerId}' - not found`);
            return false;
        }
        
        try {
            // Ensure viewer has proper dimensions
            if (viewer.renderArea) {
                const rect = viewer.renderArea.getBoundingClientRect();
                console.log(`Activating viewer '${viewerId}' with dimensions: ${rect.width}x${rect.height}`);
                
                // Force renderer resize if needed
                if (viewer.renderer && rect.width > 0 && rect.height > 0) {
                    viewer.renderer.setSize(rect.width, rect.height);
                }
                
                // Update camera aspect ratio
                if (viewer.scene && viewer.scene.cameraP) {
                    viewer.scene.cameraP.aspect = rect.width / rect.height;
                    viewer.scene.cameraP.updateProjectionMatrix();
                }
            }
            
            // Mark viewer as ready
            if (viewer.multiViewerConfig) {
                viewer.multiViewerConfig.isReady = true;
            }
            
            console.log(`Viewer '${viewerId}' activated and ready for rendering`);
            return true;
            
        } catch (error) {
            console.error(`Failed to activate viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Get the currently active viewer
     */
    getActiveViewer() {
        return this.activeViewerId ? this.registry.getViewer(this.activeViewerId) : null;
    }
    
    /**
     * Get viewer by ID
     */
    getViewer(viewerId) {
        return this.registry.getViewer(viewerId);
    }
    
    /**
     * Get all viewers
     */
    getAllViewers() {
        return this.registry.getAllViewers();
    }
    
    /**
     * Enable/disable synchronization between viewers
     */
    setSyncEnabled(viewerIds, options = {}) {
        return this.sync.setSyncEnabled(viewerIds, options);
    }
    
    /**
     * Handle container click for viewer focus
     */
    handleContainerClick(event) {
        // Find which viewer was clicked
        let target = event.target;
        let clickedViewerId = null;
        
        // Walk up the DOM to find the viewer container
        while (target && target !== this.containerElement) {
            if (target.classList.contains('potree-viewer-container')) {
                clickedViewerId = target.id.replace('potree-viewer-', '');
                break;
            }
            target = target.parentNode;
        }
        
        // If we found a viewer container, activate it
        if (clickedViewerId && this.registry.hasViewer(clickedViewerId)) {
            console.log(`ViewerManager: Container click detected on viewer '${clickedViewerId}'`);
            
            // CRITICAL: Deactivate all other viewers first
            const allViewers = this.registry.getAllViewers();
            Object.keys(allViewers).forEach(viewerId => {
                if (viewerId !== clickedViewerId) {
                    console.log(`ViewerManager: Deactivating viewer '${viewerId}' due to click on '${clickedViewerId}'`);
                    this.deactivateViewer(viewerId);
                }
            });
            
            // Then activate the clicked viewer
            this.setActiveViewer(clickedViewerId);
            
            // Prevent event from bubbling to avoid conflicts
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    /**
     * Handle window resize with throttling for better performance
     */
    handleResize() {
        // Throttle resize events to prevent excessive updates
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            this.performResize();
        }, 16); // ~60fps throttling
    }
    
    /**
     * Perform the actual resize operation
     */
    performResize() {
        try {
            console.log('ViewerManager: Handling window resize...');
            
            // Update layout which will trigger viewer resizing
            this.layout.updateLayout();
            
            // Ensure all viewers have proper rendering state after resize
            const allViewers = this.registry.getAllViewers();
            Object.entries(allViewers).forEach(([viewerId, viewer]) => {
                if (viewer && viewer.renderArea) {
                    // Trigger render update for each viewer
                    if (viewer.needsRedraw !== undefined) {
                        viewer.needsRedraw = true;
                    }
                    
                    // Reactivate viewer to ensure proper rendering dimensions
                    setTimeout(() => {
                        this.activateViewer(viewerId);
                    }, 50);
                }
            });
            
            this.dispatchEvent({
                type: 'resize_complete',
                timestamp: Date.now()
            });
            
            console.log('ViewerManager: Resize handling complete');
            
        } catch (error) {
            console.error('ViewerManager: Error during resize:', error);
        }
    }
    
    /**
     * Get shared resources manager
     */
    getSharedResources() {
        return this.sharedResources;
    }
    
    /**
     * Load point cloud into specific viewer using shared resources
     * @param {string} viewerId - Target viewer ID
     * @param {string} url - Point cloud URL
     * @param {string} name - Point cloud name
     * @returns {Promise<Object>} Point cloud instance
     */
    async loadPointCloudIntoViewer(viewerId, url, name) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer || !viewer.scene) {
            throw new Error(`Viewer '${viewerId}' not found or not ready`);
        }
        
        console.log(`ViewerManager: Loading point cloud '${name}' into viewer '${viewerId}' (shared)`);
        
        const sharedInstance = await this.sharedResources.loadSharedPointCloud(url, name, viewerId);
        
        // Add to viewer scene
        viewer.scene.addPointCloud(sharedInstance.pointcloud);
        
        // Apply default settings
        sharedInstance.pointcloud.position.z = 0;
        // CUSTOM - Set point size to 0.1 and minSize to 1.0 specifically for multi-viewer
        sharedInstance.pointcloud.material.size = 0.1;
        sharedInstance.pointcloud.material.uniforms.minSize.value = 1.0;
        sharedInstance.pointcloud.material.pointSizeType = window.Potree.PointSizeType.FIXED;
        
        // CUSTOM - Set viewer-specific default attributes
        // COMMENTED OUT FOR DEBUGGING: this.setViewerSpecificAttribute(viewerId, sharedInstance.pointcloud.material);
        
        // Auto-zoom to fit
        viewer.fitToScreen();
        
        console.log(`ViewerManager: ✓ Point cloud '${name}' loaded into viewer '${viewerId}'`);
        
        return sharedInstance;
    }
    
    /**
     * Load point cloud into multiple viewers efficiently
     * @param {Array} viewerIds - Array of viewer IDs
     * @param {string} url - Point cloud URL
     * @param {string} name - Point cloud name
     * @returns {Promise<Map>} viewerId -> point cloud instance
     */
    async loadPointCloudIntoMultipleViewers(viewerIds, url, name) {
        console.log(`ViewerManager: Loading point cloud '${name}' into ${viewerIds.length} viewers (shared)`);
        
        const results = await this.sharedResources.loadIntoMultipleViewers(url, name, viewerIds);
        
        // Add to each viewer's scene
        for (const [viewerId, sharedInstance] of results) {
            const viewer = this.registry.getViewer(viewerId);
            if (viewer && viewer.scene) {
                viewer.scene.addPointCloud(sharedInstance.pointcloud);
                
                // Apply default settings
                sharedInstance.pointcloud.position.z = 0;
                // CUSTOM - Set point size to 0.1 and minSize to 1.0 specifically for multi-viewer
                sharedInstance.pointcloud.material.size = 0.1;
                sharedInstance.pointcloud.material.uniforms.minSize.value = 1.0;
                sharedInstance.pointcloud.material.pointSizeType = window.Potree.PointSizeType.FIXED;
                
                // CUSTOM - Set viewer-specific default attributes
                // COMMENTED OUT FOR DEBUGGING: this.setViewerSpecificAttribute(viewerId, sharedInstance.pointcloud.material);
                
                // Auto-zoom to fit
                viewer.fitToScreen();
                
                console.log(`ViewerManager: ✓ Point cloud '${name}' added to viewer '${viewerId}'`);
            }
        }
        
        // Log memory efficiency
        const stats = this.sharedResources.getMemoryStats();
        console.log(`ViewerManager: Memory efficiency: ${stats.sharingEfficiency.toFixed(2)}x (${viewerIds.length} viewers sharing 1 dataset)`);
        
        return results;
    }
    
    /**
     * CUSTOM - Set viewer-specific default attributes
     * COMMENTED OUT FOR DEBUGGING POINT CLOUD LOADING ISSUES
     * 1st viewer: intensity gradient, 2nd: classification, 3rd: rgba, 4th: intensity
     * @param {string} viewerId - Viewer ID
     * @param {Object} material - Point cloud material
     */
    /*
    setViewerSpecificAttribute(viewerId, material) {
        // Get viewer order based on when they were created
        const viewerIds = this.registry.getViewerIds();
        const viewerIndex = viewerIds.indexOf(viewerId);
        
        // Default attribute mapping
        const attributeMap = [
            'intensity_gradient', // 1st viewer
            'classification',     // 2nd viewer  
            'rgba',              // 3rd viewer
            'intensity'          // 4th viewer
        ];
        
        // Use modulo to handle more than 4 viewers (cycles through the pattern)
        const targetAttribute = attributeMap[viewerIndex % attributeMap.length];
        
        // Set the attribute if it exists
        if (material.activeAttributeName !== undefined) {
            material.activeAttributeName = targetAttribute;
            console.log(`ViewerManager: Set viewer '${viewerId}' (index ${viewerIndex}) to attribute '${targetAttribute}'`);
        } else {
            console.warn(`ViewerManager: Could not set attribute for viewer '${viewerId}' - material.activeAttributeName is undefined`);
        }
    }
    */

    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        return this.sharedResources.getMemoryStats();
    }
    
    /**
     * Get rendering performance statistics
     * @returns {Object} Performance statistics from render optimizer
     */
    getRenderingStats() {
        if (!this.renderOptimizer) {
            return null;
        }
        return this.renderOptimizer.getPerformanceStats();
    }
    
    /**
     * Get detailed viewer performance metrics
     * @returns {Array} Viewer performance metrics
     */
    getViewerPerformanceMetrics() {
        if (!this.renderOptimizer) {
            return [];
        }
        return this.renderOptimizer.getViewerStats();
    }
    
    /**
     * Configure rendering optimization
     * @param {Object} config - Optimization configuration
     */
    configureRenderOptimization(config) {
        if (this.renderOptimizer) {
            this.renderOptimizer.configure(config);
        }
    }
    
    /**
     * Enable or disable adaptive rendering
     * @param {boolean} enabled - Whether to enable adaptive rendering
     */
    setAdaptiveRendering(enabled) {
        if (this.renderOptimizer) {
            this.renderOptimizer.setAdaptiveRendering(enabled);
        }
    }
    
    /**
     * Force render all viewers (bypass optimization)
     */
    forceRenderAll() {
        if (this.renderOptimizer) {
            this.renderOptimizer.forceRenderAll();
        }
    }
    
    /**
     * Get render optimizer instance
     * @returns {RenderOptimizer} The render optimizer instance
     */
    getRenderOptimizer() {
        return this.renderOptimizer;
    }
    
    /**
     * Get cross-viewer communication system
     * @returns {CrossViewerCommunication} The communication system instance
     */
    getCommunication() {
        return this.communication;
    }
    
    /**
     * Send message to viewers on a specific channel
     * @param {string} channel - Communication channel name
     * @param {Object} message - Message data
     * @param {string} fromViewerId - Optional sender viewer ID
     * @returns {boolean} Success status
     */
    sendMessage(channel, message, fromViewerId = null) {
        if (this.communication) {
            return this.communication.sendMessage(channel, message, fromViewerId);
        }
        return false;
    }
    
    /**
     * Subscribe viewer to communication channel
     * @param {string} viewerId - Viewer ID
     * @param {string} channel - Channel name
     */
    subscribeViewerToChannel(viewerId, channel) {
        if (this.communication) {
            this.communication.subscribeViewerToChannel(viewerId, channel);
        }
    }
    
    /**
     * Add shared geometry across all viewers
     * @param {Object} geometryData - Geometry data {type, coordinates, style}
     * @param {string} fromViewerId - Optional source viewer ID
     * @returns {string} Geometry ID
     */
    addSharedGeometry(geometryData, fromViewerId = null) {
        if (this.communication) {
            return this.communication.addSharedGeometry(geometryData, fromViewerId);
        }
        return null;
    }
    
    /**
     * Update shared geometry
     * @param {string} geometryId - Geometry ID to update
     * @param {Object} updates - Updates to apply
     * @param {string} fromViewerId - Optional source viewer ID
     * @returns {boolean} Success status
     */
    updateSharedGeometry(geometryId, updates, fromViewerId = null) {
        if (this.communication) {
            return this.communication.updateSharedGeometry(geometryId, updates, fromViewerId);
        }
        return false;
    }
    
    /**
     * Remove shared geometry
     * @param {string} geometryId - Geometry ID to remove
     * @param {string} fromViewerId - Optional source viewer ID
     * @returns {boolean} Success status
     */
    removeSharedGeometry(geometryId, fromViewerId = null) {
        if (this.communication) {
            return this.communication.removeSharedGeometry(geometryId, fromViewerId);
        }
        return false;
    }
    
    /**
     * Get shared state across all viewers
     * @returns {Object} Shared state object
     */
    getSharedState() {
        if (this.communication) {
            return this.communication.getSharedState();
        }
        return null;
    }
    
    /**
     * Get communication statistics
     * @returns {Object} Communication stats
     */
    getCommunicationStats() {
        if (this.communication) {
            return this.communication.getStats();
        }
        return null;
    }
    
    /**
     * Enable/disable cross-viewer communication
     * @param {boolean} enabled - Whether to enable communication
     */
    setCommunicationEnabled(enabled) {
        if (this.communication) {
            this.communication.setEnabled(enabled);
        }
    }
    
    /**
     * Destroy the manager and cleanup all resources
     */
    destroy() {
        // Remove all viewers
        const allViewers = Object.keys(this.registry.getAllViewers());
        allViewers.forEach(viewerId => {
            this.removeViewer(viewerId);
        });
        
        // Cleanup event handlers
        window.removeEventListener('resize', this.handleResize);
        
        // Clear any pending resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        // Cleanup components
        this.layout.destroy();
        this.registry.destroy();
        this.sync.destroy();
        
        // RENDER OPTIMIZATION: Destroy render optimizer
        if (this.renderOptimizer) {
            this.renderOptimizer.destroy();
            this.renderOptimizer = null;
        }
        
        // COMMUNICATION: Destroy cross-viewer communication
        if (this.communication) {
            this.communication.destroy();
            this.communication = null;
        }
        
        this.isInitialized = false;
        
        this.dispatchEvent({
            type: 'destroyed',
            manager: this
        });
    }
    
    /**
     * Enable or disable sync for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {boolean} enabled - Whether to enable sync
     * @returns {boolean} Success status
     */
    setViewerSyncEnabled(viewerId, enabled) {
        const viewer = this.registry.getViewer(viewerId);
        if (!viewer) {
            console.warn(`ViewerManager: Cannot set sync for viewer '${viewerId}' - not found`);
            return false;
        }
        
        if (!viewer.multiViewerConfig) {
            console.warn(`ViewerManager: Creating missing multiViewerConfig for viewer '${viewerId}'`);
            viewer.multiViewerConfig = {
                id: viewerId,
                managerId: this.id,
                isActive: false,
                syncEnabled: false,
                isolatedState: {
                    cameraState: {
                        position: { x: 0, y: 0, z: 0 },
                        yaw: 0,
                        pitch: 0,
                        radius: 100
                    }
                }
            };
        }
        
        viewer.multiViewerConfig.syncEnabled = enabled;
        console.log(`ViewerManager: Sync ${enabled ? 'enabled' : 'disabled'} for viewer '${viewerId}'`);
        return true;
    }
    
    /**
     * Toggle focus lock mode
     * @returns {boolean} New focus lock state
     */
    toggleFocusLock() {
        this.focusLockEnabled = !this.focusLockEnabled;
        
        console.log(`ViewerManager: Focus lock ${this.focusLockEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`ViewerManager: Mode: ${this.focusLockEnabled ? 'Click-to-focus' : 'Hover-to-interact'}`);
        
        this.dispatchEvent({
            type: 'focus_lock_changed',
            enabled: this.focusLockEnabled,
            mode: this.focusLockEnabled ? 'click-to-focus' : 'hover-to-interact'
        });
        
        return this.focusLockEnabled;
    }
    
    /**
     * Set focus lock mode
     * @param {boolean} enabled - Whether to enable focus lock
     * @returns {boolean} New focus lock state
     */
    setFocusLock(enabled) {
        if (this.focusLockEnabled === enabled) {
            return this.focusLockEnabled;
        }
        
        this.focusLockEnabled = enabled;
        
        console.log(`ViewerManager: Focus lock ${enabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`ViewerManager: Mode: ${enabled ? 'Click-to-focus' : 'Hover-to-interact'}`);
        
        this.dispatchEvent({
            type: 'focus_lock_changed',
            enabled: enabled,
            mode: enabled ? 'click-to-focus' : 'hover-to-interact'
        });
        
        return this.focusLockEnabled;
    }
    
    /**
     * Get current focus lock state
     * @returns {boolean} Whether focus lock is enabled
     */
    isFocusLocked() {
        return this.focusLockEnabled;
    }

    /**
     * Get manager status and statistics
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            viewerCount: this.registry.getViewerCount(),
            maxViewers: this.options.maxViewers,
            activeViewerId: this.activeViewerId,
            currentLayout: this.layout.getCurrentLayout(),
            syncEnabled: this.sync.isEnabled(),
            focusLockEnabled: this.focusLockEnabled
        };
    }
}

// Export for use in main Potree namespace
export { ViewerManager as MultiViewerManager };