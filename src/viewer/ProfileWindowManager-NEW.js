/**
 * ProfileWindowManager-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for centralized profile window management
 * 
 * Manages profile windows across multiple viewers with proper isolation:
 * - Profile window lifecycle management
 * - Viewer-specific profile isolation
 * - Profile window state coordination
 * - Resource cleanup and disposal
 * - Event coordination between viewers
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class ProfileWindowManager extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.profileWindows = new Map(); // viewerId -> ProfileWindow
        this.profileWindowControllers = new Map(); // viewerId -> ProfileWindowController
        this.activeProfileWindows = new Set(); // Active window viewer IDs
        
        // Configuration
        this.allowMultipleWindows = true;
        this.windowZIndexBase = 10000;
        this.debugMode = false;
        
        // State tracking
        this.windowCounter = 0;
        this.sharedDOMCreated = false;
        
        // Performance stats
        this.stats = {
            windowsCreated: 0,
            windowsDestroyed: 0,
            domReusedCount: 0,
            conflictsResolved: 0
        };
        
        console.log('[ProfileWindowManager] Initialized profile window manager');
    }
    
    /**
     * Register a profile window for a viewer
     * @param {string} viewerId - Viewer ID
     * @param {ProfileWindow} profileWindow - Profile window instance
     * @param {ProfileWindowController} profileController - Profile controller instance
     */
    registerProfileWindow(viewerId, profileWindow, profileController) {
        if (this.profileWindows.has(viewerId)) {
            console.warn(`[ProfileWindowManager] Profile window already exists for viewer '${viewerId}'`);
            return false;
        }
        
        // Store references
        this.profileWindows.set(viewerId, profileWindow);
        this.profileWindowControllers.set(viewerId, profileController);
        
        // Setup window-specific properties
        this.setupWindowIsolation(viewerId, profileWindow);
        
        // Update stats
        this.stats.windowsCreated++;
        
        // Dispatch event
        this.dispatchEvent({
            type: 'profile_window_registered',
            viewerId: viewerId,
            profileWindow: profileWindow,
            profileController: profileController
        });
        
        if (this.debugMode) {
            console.log(`[ProfileWindowManager] Registered profile window for viewer '${viewerId}'`);
        }
        
        return true;
    }
    
    /**
     * Setup window isolation for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {ProfileWindow} profileWindow - Profile window instance
     */
    setupWindowIsolation(viewerId, profileWindow) {
        // Set viewer-specific properties
        profileWindow.viewerId = viewerId;
        profileWindow.windowIndex = this.windowCounter++;
        profileWindow.zIndexOffset = profileWindow.windowIndex * 10;
        
        // Setup isolated profile system registry
        if (profileWindow.profileSystemRegistry) {
            profileWindow.profileSystemRegistry.setDebugMode(this.debugMode);
        }
        
        // Override title to show viewer ID
        if (profileWindow.elRoot && profileWindow.elRoot.length > 0) {
            const titleElement = profileWindow.elRoot.find('#profile_window_title');
            if (titleElement.length > 0) {
                const originalTitle = titleElement.text() || 'Profile';
                titleElement.text(`${originalTitle} (${viewerId})`);
            }
        }
        
        if (this.debugMode) {
            console.log(`[ProfileWindowManager] Setup isolation for viewer '${viewerId}' with window index ${profileWindow.windowIndex}`);
        }
    }
    
    /**
     * Show profile window for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {Object} profile - Profile to display
     * @returns {boolean} Success status
     */
    showProfileWindow(viewerId, profile = null) {
        const profileWindow = this.profileWindows.get(viewerId);
        const profileController = this.profileWindowControllers.get(viewerId);
        
        if (!profileWindow || !profileController) {
            console.error(`[ProfileWindowManager] No profile window found for viewer '${viewerId}'`);
            return false;
        }
        
        try {
            // Handle conflicts if multiple windows are not allowed
            if (!this.allowMultipleWindows && this.activeProfileWindows.size > 0) {
                this.hideAllProfileWindows();
                this.stats.conflictsResolved++;
            }
            
            // Adjust z-index to bring window to front
            if (profileWindow.elRoot && profileWindow.elRoot.length > 0) {
                const newZIndex = this.windowZIndexBase + profileWindow.zIndexOffset + this.activeProfileWindows.size;
                profileWindow.elRoot.css('z-index', newZIndex);
            }
            
            // Show the window
            profileWindow.show();
            
            // Set profile if provided
            if (profile) {
                profileController.setProfile(profile);
            }
            
            // Track active state
            this.activeProfileWindows.add(viewerId);
            
            // Dispatch event
            this.dispatchEvent({
                type: 'profile_window_shown',
                viewerId: viewerId,
                profile: profile,
                windowCount: this.activeProfileWindows.size
            });
            
            if (this.debugMode) {
                console.log(`[ProfileWindowManager] Showed profile window for viewer '${viewerId}' (active: ${this.activeProfileWindows.size})`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[ProfileWindowManager] Error showing profile window for viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Hide profile window for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @returns {boolean} Success status
     */
    hideProfileWindow(viewerId) {
        const profileWindow = this.profileWindows.get(viewerId);
        
        if (!profileWindow) {
            console.warn(`[ProfileWindowManager] No profile window found for viewer '${viewerId}'`);
            return false;
        }
        
        try {
            // Hide the window
            profileWindow.hide();
            
            // Update active state
            this.activeProfileWindows.delete(viewerId);
            
            // Clean up profile resources for this viewer
            if (profileWindow.profileSystemRegistry) {
                profileWindow.profileSystemRegistry.cleanupViewer(viewerId);
            }
            
            // Dispatch event
            this.dispatchEvent({
                type: 'profile_window_hidden',
                viewerId: viewerId,
                windowCount: this.activeProfileWindows.size
            });
            
            if (this.debugMode) {
                console.log(`[ProfileWindowManager] Hidden profile window for viewer '${viewerId}' (active: ${this.activeProfileWindows.size})`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[ProfileWindowManager] Error hiding profile window for viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Hide all active profile windows
     */
    hideAllProfileWindows() {
        const activeViewers = Array.from(this.activeProfileWindows);
        let hiddenCount = 0;
        
        for (const viewerId of activeViewers) {
            if (this.hideProfileWindow(viewerId)) {
                hiddenCount++;
            }
        }
        
        if (this.debugMode && hiddenCount > 0) {
            console.log(`[ProfileWindowManager] Hidden ${hiddenCount} profile windows`);
        }
        
        return hiddenCount;
    }
    
    /**
     * Toggle profile window for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {Object} profile - Profile to display if showing
     * @returns {boolean} New visibility state
     */
    toggleProfileWindow(viewerId, profile = null) {
        const isActive = this.activeProfileWindows.has(viewerId);
        
        if (isActive) {
            this.hideProfileWindow(viewerId);
            return false;
        } else {
            this.showProfileWindow(viewerId, profile);
            return true;
        }
    }
    
    /**
     * Get profile window for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @returns {Object|null} Object containing profileWindow and profileController
     */
    getProfileWindow(viewerId) {
        const profileWindow = this.profileWindows.get(viewerId);
        const profileController = this.profileWindowControllers.get(viewerId);
        
        if (!profileWindow || !profileController) {
            return null;
        }
        
        return {
            profileWindow,
            profileController,
            isActive: this.activeProfileWindows.has(viewerId)
        };
    }
    
    /**
     * Unregister and cleanup profile window for a viewer
     * @param {string} viewerId - Viewer ID
     * @returns {boolean} Success status
     */
    unregisterProfileWindow(viewerId) {
        const profileWindow = this.profileWindows.get(viewerId);
        
        if (!profileWindow) {
            console.warn(`[ProfileWindowManager] No profile window to unregister for viewer '${viewerId}'`);
            return false;
        }
        
        try {
            // Hide window if active
            if (this.activeProfileWindows.has(viewerId)) {
                this.hideProfileWindow(viewerId);
            }
            
            // Clean up resources
            if (profileWindow.profileSystemRegistry) {
                profileWindow.profileSystemRegistry.dispose();
            }
            
            // Remove from registries
            this.profileWindows.delete(viewerId);
            this.profileWindowControllers.delete(viewerId);
            
            // Update stats
            this.stats.windowsDestroyed++;
            
            // Dispatch event
            this.dispatchEvent({
                type: 'profile_window_unregistered',
                viewerId: viewerId
            });
            
            if (this.debugMode) {
                console.log(`[ProfileWindowManager] Unregistered profile window for viewer '${viewerId}'`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[ProfileWindowManager] Error unregistering profile window for viewer '${viewerId}':`, error);
            return false;
        }
    }
    
    /**
     * Create shared DOM structure for profile windows
     * This allows multiple viewers to share the same DOM elements
     */
    createSharedProfileDOM() {
        if (this.sharedDOMCreated) {
            this.stats.domReusedCount++;
            if (this.debugMode) {
                console.log('[ProfileWindowManager] Reusing existing shared DOM structure');
            }
            return true;
        }
        
        try {
            // Check if profile window DOM already exists
            const existingProfileWindow = document.getElementById('profile_window');
            if (existingProfileWindow) {
                this.sharedDOMCreated = true;
                this.stats.domReusedCount++;
                return true;
            }
            
            // Create minimal profile window structure
            const profileWindow = document.createElement('div');
            profileWindow.id = 'profile_window';
            profileWindow.style.cssText = `
                position: absolute; 
                width: 84%; 
                left: 15%; 
                top: 55%; 
                height: 44%; 
                margin: 5px; 
                border: 1px solid black; 
                display: none; 
                box-sizing: border-box; 
                z-index: ${this.windowZIndexBase}; 
                background: white;
            `;
            
            // Create title bar
            const titlebar = document.createElement('div');
            titlebar.id = 'profile_titlebar';
            titlebar.className = 'pv-titlebar';
            titlebar.style.cssText = `
                display: flex; 
                position: absolute; 
                height: 30px; 
                width: 100%; 
                box-sizing: border-box; 
                background: #333; 
                color: white; 
                padding: 5px;
            `;
            titlebar.innerHTML = `
                <span id="profile_window_title">Profile</span>
                <span style="flex-grow: 1;"></span>
                <img id="closeProfileContainer" class="button-icon" style="width: 24px; height: 24px; cursor: pointer;">
            `;
            
            // Create content area
            const content = document.createElement('div');
            content.style.cssText = `
                position: absolute; 
                top: 30px; 
                width: 100%; 
                height: calc(100% - 30px); 
                box-sizing: border-box;
            `;
            content.className = 'pw_content';
            
            // Create main content span with proper styling - CUSTOM
            const mainSpan = document.createElement('span');
            mainSpan.className = 'pv-main-color';
            mainSpan.style.cssText = `
                height: 100%; 
                width: 100%; 
                padding: 5px; 
                display: flex; 
                flex-direction: column; 
                box-sizing: border-box;
            `;
            
            // Create top controls area - CUSTOM
            const controlsArea = document.createElement('div');
            controlsArea.style.cssText = `
                width: 100%; 
                color: #9d9d9d; 
                margin: 5px; 
                display: flex; 
                flex-direction: row; 
                box-sizing: border-box;
            `;
            controlsArea.innerHTML = `
                <span>Points: &nbsp;</span>
                <span id="profile_num_points">-</span>
                <span style="flex-grow: 1;"></span>
                <span>
                    <input id="potree_profile_rotate_amount" type="text" maxlength="4" value="10" style="
                        display: inline-block; width: 2.5em; vertical-align: top; 
                        background: white; margin: 2px;">
                    <img id="potree_profile_rotate_cw" class="text-icon"/>
                    <img id="potree_profile_rotate_ccw" class="text-icon"/>
                    <img id="potree_profile_move_forward" class="text-icon"/>
                    <img id="potree_profile_move_backward" class="text-icon"/>
                    <a id="potree_download_profile_dxf2D_link" href="#" download="profile_2D.dxf">
                        <img id="potree_download_dxf2D_icon" class="text-icon"/>
                    </a>
                    <a id="potree_download_profile_dxf3D_link" href="#" download="profile_3D.dxf">
                        <img id="potree_download_dxf3D_icon" class="text-icon"/>
                    </a>
                    <a id="potree_download_profile_ortho_link" href="#" download="profile.csv">
                        <img id="potree_download_csv_icon" class="text-icon"/>
                    </a>
                    <a id="potree_download_profile_link" href="#" download="profile.las">
                        <img id="potree_download_las_icon" class="text-icon"/>
                    </a>
                </span>
            `;
            
            // Create draw container with proper styling - CUSTOM
            const drawContainer = document.createElement('div');
            drawContainer.id = 'profile_draw_container';
            drawContainer.style.cssText = `
                width: 100%; 
                flex-grow: 1; 
                position: relative; 
                height: 100%; 
                box-sizing: border-box; 
                user-select: none;
            `;
            
            // Create black background div - CUSTOM
            const blackBackground = document.createElement('div');
            blackBackground.style.cssText = `
                position: absolute; 
                left: 41px; 
                top: 0; 
                bottom: 20px; 
                width: calc(100% - 41px); 
                height: calc(100% - 20px); 
                background-color: #000000;
            `;
            
            // Create SVG element with proper styling - CUSTOM
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'profileSVG';
            svg.style.cssText = `
                fill: #9d9d9d;
                position: absolute; 
                left: 0; right: 0; 
                top: 0; bottom: 0; 
                width: 100%; 
                height: 100%;
            `;
            
            // Create canvas container with proper positioning - CUSTOM
            const canvasContainer = document.createElement('div');
            canvasContainer.id = 'profileCanvasContainer';
            canvasContainer.style.cssText = `
                position: absolute; 
                left: 41px; 
                top: 0; 
                bottom: 20px; 
                width: calc(100% - 41px); 
                height: calc(100% - 20px);
            `;
            
            // Create selection properties display - CUSTOM
            const selectionProps = document.createElement('div');
            selectionProps.id = 'profileSelectionProperties';
            selectionProps.style.cssText = `
                position: absolute; 
                left: 50px; 
                top: 10px; 
                background-color: black;
                color: white;
                opacity: 0.7;
                padding: 5px;
                border: 1px solid white;
                user-select: text;
                display: none;
            `;
            selectionProps.innerHTML = 'position: -<br>rgb: - - -';
            
            // Assemble structure - CUSTOM
            drawContainer.appendChild(blackBackground);
            drawContainer.appendChild(svg);
            drawContainer.appendChild(canvasContainer);
            drawContainer.appendChild(selectionProps);
            
            mainSpan.appendChild(controlsArea);
            mainSpan.appendChild(drawContainer);
            content.appendChild(mainSpan);
            
            profileWindow.appendChild(titlebar);
            profileWindow.appendChild(content);
            document.body.appendChild(profileWindow);
            
            // CUSTOM - Initialize profile control icons after DOM creation
            this.initializeProfileIcons();
            
            this.sharedDOMCreated = true;
            
            if (this.debugMode) {
                console.log('[ProfileWindowManager] Created shared profile DOM structure');
            }
            
            return true;
            
        } catch (error) {
            console.error('[ProfileWindowManager] Error creating shared profile DOM:', error);
            return false;
        }
    }
    
    /**
     * Initialize profile control icons - CUSTOM
     */
    initializeProfileIcons() {
        const resourcePath = (window.Potree && window.Potree.resourcePath) || '../build/potree/resources';
        
        // Set icon sources for all profile controls
        const iconMap = {
            'potree_profile_rotate_cw': 'arrow_cw.svg',
            'potree_profile_rotate_ccw': 'arrow_ccw.svg',
            'potree_profile_move_forward': 'arrow_up.svg',
            'potree_profile_move_backward': 'arrow_down.svg',
            'potree_download_dxf2D_icon': 'file_dxf_2d.svg',
            'potree_download_dxf3D_icon': 'file_dxf_3d.svg',
            'potree_download_csv_icon': 'file_csv_2d.svg',
            'potree_download_las_icon': 'file_las_3d.svg',
            'closeProfileContainer': 'close.svg'
        };
        
        Object.entries(iconMap).forEach(([elementId, iconFile]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.src = `${resourcePath}/icons/${iconFile}`;
            }
        });
        
        if (this.debugMode) {
            console.log('[ProfileWindowManager] Profile control icons initialized');
        }
    }
    
    /**
     * Set multiple windows mode
     * @param {boolean} allow - Whether to allow multiple windows
     */
    setMultipleWindowsMode(allow) {
        this.allowMultipleWindows = allow;
        
        // If disabling multiple windows and multiple are active, hide all but the first
        if (!allow && this.activeProfileWindows.size > 1) {
            const activeViewers = Array.from(this.activeProfileWindows);
            for (let i = 1; i < activeViewers.length; i++) {
                this.hideProfileWindow(activeViewers[i]);
            }
            this.stats.conflictsResolved++;
        }
        
        if (this.debugMode) {
            console.log(`[ProfileWindowManager] Multiple windows mode: ${allow}`);
        }
    }
    
    /**
     * Get manager statistics
     */
    getStats() {
        return {
            ...this.stats,
            registeredWindows: this.profileWindows.size,
            activeWindows: this.activeProfileWindows.size,
            allowMultipleWindows: this.allowMultipleWindows,
            sharedDOMCreated: this.sharedDOMCreated
        };
    }
    
    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        // Apply to all registered profile windows
        for (const profileWindow of this.profileWindows.values()) {
            if (profileWindow.profileSystemRegistry) {
                profileWindow.profileSystemRegistry.setDebugMode(enabled);
            }
        }
        
        console.log(`[ProfileWindowManager] Debug mode: ${enabled}`);
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        console.log('[ProfileWindowManager] Disposing profile window manager');
        
        // Unregister all windows
        const viewerIds = Array.from(this.profileWindows.keys());
        for (const viewerId of viewerIds) {
            this.unregisterProfileWindow(viewerId);
        }
        
        // Clear all registries
        this.profileWindows.clear();
        this.profileWindowControllers.clear();
        this.activeProfileWindows.clear();
        
        console.log('[ProfileWindowManager] Profile window manager disposed');
    }
}