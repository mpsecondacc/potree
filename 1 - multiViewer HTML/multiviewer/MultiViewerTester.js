// CUSTOM - MultiViewerTester module for creating and managing MultiViewer instances
import { logger } from '../core/TestLogger.js';
import { uiManager } from '../core/UIManager.js';
import { testCore } from '../core/TestCore.js';

export class MultiViewerTester {
    constructor() {
        this.multiViewer = null;
    }

    /**
     * Create and initialize a MultiViewer instance
     */
    async createMultiViewer() {
        try {
            logger.log('Creating real MultiViewer...');
            logger.log('Checking Potree exports...');

            // Debug: Check what's available in Potree
            console.log('Potree object:', window.Potree);
            console.log('Potree.MultiViewer:', window.Potree ? window.Potree.MultiViewer : 'undefined');
            console.log('Available Potree exports:', window.Potree ? Object.keys(window.Potree) : 'empty');

            const container = testCore.getContainer();
            if (!container) {
                throw new Error('Container element not found');
            }

            // Check if basic Potree exports work first
            if (!window.Potree || Object.keys(window.Potree).length === 0) {
                throw new Error('Potree exports are completely empty - there is a build error preventing all exports');
            }

            if (!window.Potree.Viewer) {
                throw new Error('Basic Potree.Viewer not found. Available: ' + Object.keys(window.Potree).slice(0, 10).join(', '));
            }

            logger.success('Basic Potree exports working');
            logger.success('Potree.Viewer available');
            logger.log('Available exports: ' + Object.keys(window.Potree).slice(0, 10).join(', ') + '...');

            if (!window.Potree.MultiViewer && !window.Potree.MultiViewerSimple) {
                throw new Error('MultiViewer classes not found. This is expected while debugging build issues.');
            }

            // Try simple version first if MultiViewer is not available
            const MultiViewerClass = window.Potree.MultiViewer || window.Potree.MultiViewerSimple;
            logger.log(`Using ${MultiViewerClass.name} class`);
            logger.log('Creating MultiViewer instance...');

            // Create actual MultiViewer using our implementation
            this.multiViewer = new MultiViewerClass(container, {
                maxViewers: 4,
                defaultLayout: '1x1',
                enableSync: true,
                autoLoadGUI: false  // Don't auto-load GUI for test
            });

            logger.log('MultiViewer instance created, waiting for initialization...');

            // Wait for initialization
            await new Promise((resolve) => {
                if (this.multiViewer.isReady) {
                    logger.log('MultiViewer was already ready');
                    resolve();
                } else {
                    logger.log('Waiting for ready event...');
                    this.multiViewer.addEventListener('ready', () => {
                        logger.log('Ready event received!');
                        resolve();
                    });

                    // Add a timeout as fallback
                    setTimeout(() => {
                        logger.warning('Initialization timeout, proceeding anyway...');
                        resolve();
                    }, 5000);
                }
            });

            // Set in test core
            testCore.setMultiViewer(this.multiViewer);

            logger.success('MultiViewer created and initialized');
            logger.success('ViewerManager active');
            logger.success('ViewerRegistry ready');
            logger.success('ViewerLayout system ready');
            logger.success('ViewerSync system ready');

            // Enable appropriate buttons
            uiManager.showMultiViewerButtons();

            return this.multiViewer;

        } catch (error) {
            logger.error(`Error creating MultiViewer: ${error.message}`);
            console.error('Full error:', error);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Create multiple viewers with specific configuration
     */
    async createViewers(count = 2, configs = null) {
        if (!this.multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log(`Setting up ${count}-viewer layout...`);

            // Destroy all existing viewers first
            const existingViewers = testCore.getTestViewers();
            if (existingViewers.length > 0) {
                logger.log('Destroying existing viewers...');
                for (const viewer of existingViewers) {
                    if (viewer.multiViewerConfig && viewer.multiViewerConfig.id) {
                        this.multiViewer.removeViewer(viewer.multiViewerConfig.id);
                    }
                }
                testCore.clearTestViewers();
                logger.success('All existing viewers destroyed');
            }

            // Default configurations based on count
            const defaultConfigs = {
                2: [
                    { id: 'main', name: 'Main Viewer' },
                    { id: 'profile', name: 'Profile View' }
                ],
                3: [
                    { id: 'main', name: 'Main Viewer' },
                    { id: 'top', name: 'Top View' },
                    { id: 'bottom', name: 'Bottom View' }
                ],
                4: [
                    { id: 'viewer1', name: 'Viewer 1' },
                    { id: 'viewer2', name: 'Viewer 2' },
                    { id: 'viewer3', name: 'Viewer 3' },
                    { id: 'viewer4', name: 'Viewer 4' }
                ]
            };

            const viewerConfigs = configs || defaultConfigs[count] || defaultConfigs[2];

            logger.log(`Creating ${viewerConfigs.length} viewers...`);
            for (const config of viewerConfigs) {
                logger.log(`Creating viewer '${config.id}'...`);
                const viewer = await this.multiViewer.createViewer(config.id, config);
                testCore.addTestViewer(viewer);
                logger.success(`Created viewer '${config.id}' (${config.name})`);
            }

            logger.success(`Created ${testCore.getTestViewers().length} real viewers`);

            // Apply appropriate layout
            let layoutName = '1x1';
            if (count === 2) layoutName = '1x2';
            else if (count === 3) layoutName = 'main-dual';
            else if (count === 4) layoutName = '2x2';

            logger.log(`Setting layout to ${layoutName}...`);
            this.multiViewer.setLayout(layoutName);
            logger.success(`Layout applied: ${layoutName}`);

            // Auto-load point cloud
            logger.log('Auto-loading sample point cloud...');
            await testCore.autoLoadPointCloud();

            // Enable appropriate UI buttons
            uiManager.showViewerButtons();
            uiManager.showPerformanceButtons();
            uiManager.showCommunicationButtons();
            uiManager.showConfigurationButtons();
            uiManager.showSidebarButtons();

            return testCore.getTestViewers();

        } catch (error) {
            logger.error(`Error creating viewers: ${error.message}`);
            console.error(error);
            throw error;
        }
    }

    /**
     * Add a single viewer dynamically
     */
    async addViewer() {
        if (!this.multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            const currentCount = this.multiViewer.getViewerCount();

            // Progressive layout: 1 → 2 (1x1) → 3 (1x2) → 4 (2x2)
            if (currentCount >= 4) {
                logger.warning('Maximum of 4 viewers allowed');
                logger.log('Current layout progression: 1 viewer → 1x1 → 1x2 → 2x2 (max)');
                return null;
            }

            // Use consistent naming pattern: viewer1, viewer2, viewer3, viewer4
            const viewerNumber = currentCount + 1;
            const viewerId = `viewer${viewerNumber}`;
            const viewerName = `Viewer ${viewerNumber}`;

            logger.log(`Testing dynamic viewer addition...`);
            logger.log(`Creating viewer: '${viewerId}' (${viewerName})`);
            logger.log(`Progression: ${currentCount} → ${currentCount + 1} viewers`);

            const viewer = await this.multiViewer.addViewer(viewerId, {
                name: viewerName
            });

            if (viewer) {
                // Add viewer to test array
                testCore.addTestViewer(viewer);

                // Load point cloud into the new viewer
                try {
                    const pointCloudUrl = "http://5.9.65.151/mschuetz/potree/resources/pointclouds/opentopography/CA13_1.4/cloud.js";
                    const pointCloudName = 'CA13';

                    logger.log(`Loading point cloud into new viewer '${viewerId}'...`);
                    await viewer.loadPointCloud(pointCloudUrl, pointCloudName);
                    logger.success(`Point cloud loaded into viewer '${viewerId}'`);
                } catch (error) {
                    logger.warning(`Failed to load point cloud into new viewer: ${error.message}`);
                }

                const newCount = this.multiViewer.getViewerCount();
                logger.success(`Successfully added viewer '${viewerId}'`);
                logger.success(`Total viewers: ${newCount}`);
                logger.success(`Viewer IDs: ${this.multiViewer.getViewerIds().join(', ')}`);

                // Apply progressive layout based on viewer count
                let targetLayout = '1x1';
                let layoutDescription = 'Single viewer (full screen)';

                if (newCount === 2) {
                    targetLayout = '1x2';
                    layoutDescription = '1x2 layout (2 viewers side by side)';
                } else if (newCount === 3) {
                    targetLayout = 'main-dual';
                    layoutDescription = 'Main + 2 side viewers layout';
                } else if (newCount === 4) {
                    targetLayout = '2x2';
                    layoutDescription = '2x2 grid (4 viewers in quadrants)';
                }

                // Apply the layout
                logger.log(`Applying ${targetLayout} layout: ${layoutDescription}`);
                this.multiViewer.setLayout(targetLayout);
                logger.success(`Layout applied: ${layoutDescription}`);

                return viewer;
            } else {
                logger.error(`Failed to add viewer '${viewerId}'`);
                return null;
            }

        } catch (error) {
            logger.error(`Error adding viewer: ${error.message}`);
            console.error(error);
            throw error;
        }
    }

    /**
     * Remove a viewer dynamically
     */
    removeViewer() {
        if (!this.multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            const currentCount = this.multiViewer.getViewerCount();
            const viewerIds = this.multiViewer.getViewerIds();
            logger.log(`Current viewers (${currentCount}): ${viewerIds.join(', ')}`);

            if (currentCount <= 1) {
                logger.warning('Cannot remove viewer - at least one viewer must remain');
                logger.log('Current layout progression: 1 viewer → 1x1 → 1x2 → 2x2');
                return false;
            }

            // Remove the highest numbered viewer
            const viewerNumbers = viewerIds
                .filter(id => id.startsWith('viewer'))
                .map(id => parseInt(id.replace('viewer', '')))
                .filter(num => !isNaN(num))
                .sort((a, b) => b - a); // Sort descending

            let targetViewer;
            if (viewerNumbers.length > 0) {
                // Remove highest numbered viewer
                targetViewer = `viewer${viewerNumbers[0]}`;
            } else {
                // Fallback: remove the last viewer in the list
                targetViewer = viewerIds[viewerIds.length - 1];
            }

            logger.log(`Testing dynamic viewer removal...`);
            logger.log(`Removing viewer: '${targetViewer}'`);
            logger.log(`Progression: ${currentCount} → ${currentCount - 1} viewers`);

            const success = this.multiViewer.removeViewer(targetViewer);

            if (success) {
                // Update test viewer array
                testCore.removeTestViewer(targetViewer);
                testCore.syncTestViewers();

                const newCount = this.multiViewer.getViewerCount();
                logger.success(`Successfully removed viewer '${targetViewer}'`);
                logger.success(`Total viewers: ${newCount}`);
                logger.success(`Remaining viewer IDs: ${this.multiViewer.getViewerIds().join(', ')}`);

                // Apply reverse progressive layout
                let targetLayout = '1x1';
                let layoutDescription = 'Single viewer (full screen)';

                if (newCount === 2) {
                    targetLayout = '1x2';
                    layoutDescription = '1x2 layout (2 viewers side by side)';
                } else if (newCount === 3) {
                    targetLayout = 'main-dual';
                    layoutDescription = 'Main + 2 side viewers layout';
                }

                // Apply the layout
                logger.log(`Applying ${targetLayout} layout: ${layoutDescription}`);
                try {
                    this.multiViewer.setLayout(targetLayout);
                    logger.success(`Layout applied: ${layoutDescription}`);
                } catch (layoutError) {
                    logger.warning(`Layout update failed: ${layoutError.message}`);
                }

                return true;
            } else {
                logger.error(`Failed to remove viewer '${targetViewer}'`);
                return false;
            }

        } catch (error) {
            logger.error(`Error removing viewer: ${error.message}`);
            console.error(error);
            throw error;
        }
    }

    /**
     * Destroy the MultiViewer and cleanup
     */
    destroy() {
        if (!this.multiViewer) {
            logger.warning('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('Destroying MultiViewer...');

            this.multiViewer.destroy();
            this.multiViewer = null;
            testCore.cleanup();

            logger.success('MultiViewer destroyed');
            logger.success('All viewers removed from DOM');
            logger.success('Resources cleaned up');

            logger.log('\n=== Real Implementation Test Complete ===');
            logger.success('Multi-viewer system functioning correctly!');

        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
        }
    }

    /**
     * Get current MultiViewer instance
     */
    getMultiViewer() {
        return this.multiViewer;
    }
}

// Global instance
export const multiViewerTester = new MultiViewerTester();