// CUSTOM - TestCore module for shared test functionality and state management
import { logger } from './TestLogger.js';
import { uiManager } from './UIManager.js';

export class TestCore {
    constructor() {
        this.multiViewer = null;
        this.testViewers = [];
        this.viewerAttributeManager = null;
        this.initialized = false;
    }

    /**
     * Initialize the test environment
     */
    async initialize() {
        if (this.initialized) return;

        logger.log('🚀 Initializing test environment...');

        // Initialize UI Manager
        uiManager.initialize();

        // Initialize ViewerAttributeManager
        if (window.ViewerAttributeManager) {
            this.viewerAttributeManager = new window.ViewerAttributeManager();
            window.viewerAttributeManager = this.viewerAttributeManager;
            logger.success('ViewerAttributeManager initialized');
        }

        // Check Potree availability
        this.checkPotreeAvailability();

        this.initialized = true;
        logger.success('Test environment initialized');
    }

    /**
     * Check if Potree is properly loaded
     */
    checkPotreeAvailability() {
        if (!window.Potree) {
            logger.error('Potree not available on window object');
            return false;
        }

        if (!window.Potree.Viewer) {
            logger.error('Potree.Viewer not available');
            return false;
        }

        const exportCount = Object.keys(window.Potree).length;
        logger.success(`Potree loaded with ${exportCount} exports`);
        return true;
    }

    /**
     * Get container element for viewers
     */
    getContainer() {
        const container = document.getElementById('viewer-container');
        if (!container) {
            logger.error('viewer-container element not found');
            return null;
        }
        return container;
    }

    /**
     * Set multiViewer instance
     */
    setMultiViewer(multiViewer) {
        this.multiViewer = multiViewer;
        logger.log('MultiViewer instance set in TestCore');
    }

    /**
     * Get multiViewer instance
     */
    getMultiViewer() {
        return this.multiViewer;
    }

    /**
     * Add viewer to test array
     */
    addTestViewer(viewer) {
        this.testViewers.push(viewer);
        logger.log(`Added test viewer (total: ${this.testViewers.length})`);
    }

    /**
     * Remove viewer from test array
     */
    removeTestViewer(viewerId) {
        const initialLength = this.testViewers.length;
        this.testViewers = this.testViewers.filter(viewer => 
            viewer.multiViewerConfig?.id !== viewerId
        );
        
        const removedCount = initialLength - this.testViewers.length;
        logger.log(`Removed ${removedCount} test viewer(s) (remaining: ${this.testViewers.length})`);
    }

    /**
     * Clear all test viewers
     */
    clearTestViewers() {
        this.testViewers = [];
        logger.log('Cleared all test viewers');
    }

    /**
     * Get test viewers
     */
    getTestViewers() {
        return this.testViewers;
    }

    /**
     * Update test viewer array from multiViewer
     */
    syncTestViewers() {
        if (!this.multiViewer) return;

        this.testViewers = [];
        const allViewers = this.multiViewer.getAllViewers();
        for (const viewerId in allViewers) {
            this.testViewers.push(allViewers[viewerId]);
        }
        
        logger.log(`Synced test viewers (${this.testViewers.length} viewers)`);
    }

    /**
     * Auto-load point cloud into viewers
     */
    async autoLoadPointCloud() {
        if (!this.multiViewer || this.testViewers.length === 0) {
            logger.warning('Skipping auto-load: No viewers available');
            return false;
        }

        try {
            // Use the same point cloud as in classifications.html example
            const pointCloudUrl = "http://5.9.65.151/mschuetz/potree/resources/pointclouds/opentopography/CA13_1.4/cloud.js";
            const pointCloudName = 'CA13';

            logger.log(`Loading point cloud: ${pointCloudName}`);
            logger.log('Using SharedResourceManager - 1 dataset shared across all viewers');

            // Use resource sharing to load point cloud into all viewers
            const results = await this.multiViewer.loadPointCloud(pointCloudUrl, pointCloudName);

            logger.success('Point cloud loaded successfully with resource sharing!');
            logger.success(`1 dataset shared across ${this.testViewers.length} viewers`);

            // Wait a moment for point clouds to be fully loaded and then connect sidebar controls
            setTimeout(() => {
                logger.log('Reconnecting sidebar controls to loaded point clouds...');
                this.reconnectSidebarControls();
            }, 1000);

            return true;

        } catch (error) {
            logger.warning(`Auto-load failed: ${error.message}`);
            logger.log('This is normal if the sample URL is not accessible');
            logger.log('You can still test other features');
            return false;
        }
    }

    /**
     * Reconnect sidebar controls after point cloud loading
     */
    reconnectSidebarControls() {
        try {
            // Get all viewer sidebars and refresh their connections
            const viewerIds = this.multiViewer.getViewerIds();
            viewerIds.forEach(viewerId => {
                const sidebar = this.multiViewer.getViewerSidebar(viewerId);
                if (sidebar && sidebar.connectAppearanceControls) {
                    logger.log(`Reconnecting controls for viewer ${viewerId}...`);
                    sidebar.connectAppearanceControls();
                }
            });
            logger.success('Sidebar controls reconnected to loaded point clouds');
        } catch (error) {
            logger.warning(`Error reconnecting sidebar controls: ${error.message}`);
        }
    }

    /**
     * Cleanup and reset test state
     */
    cleanup() {
        if (this.multiViewer) {
            try {
                this.multiViewer.destroy();
                logger.success('MultiViewer destroyed');
            } catch (error) {
                logger.error(`Error destroying MultiViewer: ${error.message}`);
            }
        }

        this.multiViewer = null;
        this.testViewers = [];
        
        // Reset UI buttons
        uiManager.resetAllButtons();
        
        logger.success('Test environment cleaned up');
    }

    /**
     * Get current test state
     */
    getState() {
        return {
            initialized: this.initialized,
            hasMultiViewer: !!this.multiViewer,
            viewerCount: this.testViewers.length,
            multiViewerReady: this.multiViewer?.isReady || false
        };
    }
}

// Global instance
export const testCore = new TestCore();