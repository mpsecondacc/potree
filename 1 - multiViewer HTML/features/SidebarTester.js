// CUSTOM - SidebarTester module for testing sidebar functionality and management
import { logger } from '../core/TestLogger.js';
import { testCore } from '../core/TestCore.js';

export class SidebarTester {
    constructor() {
        this.sidebarStates = new Map();
    }

    /**
     * Test opening all sidebars
     */
    testOpenAllSidebars() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Open All Sidebars Test ===');

            // Get actual viewer IDs from the multiViewer instead of using testViewers array
            const viewerIds = multiViewer.getViewerIds();
            logger.log(`Available viewer IDs: ${viewerIds.join(', ')}`);

            let openedCount = 0;
            viewerIds.forEach(viewerId => {
                try {
                    const opened = multiViewer.openViewerSidebar(viewerId);
                    if (opened) {
                        openedCount++;
                        logger.success(`Opened sidebar for viewer '${viewerId}'`);
                        this.sidebarStates.set(viewerId, true);
                    } else {
                        logger.log(`- Sidebar for viewer '${viewerId}' was already open`);
                        this.sidebarStates.set(viewerId, true);
                    }
                } catch (err) {
                    logger.error(`Failed to open sidebar for viewer '${viewerId}': ${err.message}`);
                    this.sidebarStates.set(viewerId, false);
                }
            });

            logger.success(`Opened ${openedCount} new sidebars (total attempts: ${viewerIds.length})`);
            return openedCount > 0;

        } catch (error) {
            logger.error(`Open all sidebars failed: ${error.message}`);
            console.error('Full error:', error);
            return false;
        }
    }

    /**
     * Test closing all sidebars
     */
    testCloseAllSidebars() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Close All Sidebars Test ===');

            const closedCount = multiViewer.closeAllSidebars();
            logger.success(`Closed ${closedCount} sidebars`);

            // Update local state tracking
            const viewerIds = multiViewer.getViewerIds();
            viewerIds.forEach(viewerId => {
                this.sidebarStates.set(viewerId, false);
            });

            return closedCount > 0;

        } catch (error) {
            logger.error(`Close all sidebars failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Test getting sidebar statistics
     */
    testSidebarStats() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return null;
        }

        try {
            logger.log('\n=== Sidebar Statistics Test ===');

            const stats = multiViewer.getSidebarStats();
            
            logger.log(`Total sidebars: ${stats.totalSidebars}`);
            logger.log(`Open sidebars: ${stats.openSidebars}`);
            logger.log(`Closed sidebars: ${stats.closedSidebars}`);
            logger.log('Sidebar states:');
            
            Object.entries(stats.sidebarStates).forEach(([viewerId, isOpen]) => {
                logger.log(`  ${viewerId}: ${isOpen ? 'open' : 'closed'}`);
                this.sidebarStates.set(viewerId, isOpen);
            });

            logger.success('Sidebar statistics retrieved successfully');
            return stats;

        } catch (error) {
            logger.error(`Sidebar stats failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Test sidebar API functionality
     */
    testSidebarAPI() {
        const multiViewer = testCore.getMultiViewer();
        const testViewers = testCore.getTestViewers();
        
        if (!multiViewer || testViewers.length === 0) {
            logger.error('Need viewers to test sidebar API');
            return null;
        }

        try {
            logger.log('\n=== Sidebar API Test ===');
            
            // Use the first available viewer
            const viewerIds = multiViewer.getViewerIds();
            const viewerId = viewerIds[0];

            logger.log(`Testing sidebar API with viewer '${viewerId}'...`);

            // Test getting sidebar instance
            const sidebar = multiViewer.getViewerSidebar(viewerId);
            if (sidebar) {
                logger.success(`Got sidebar instance for viewer '${viewerId}'`);
            } else {
                logger.error(`No sidebar found for viewer '${viewerId}'`);
                return null;
            }

            // Test checking if sidebar is open
            const initialState = multiViewer.isViewerSidebarOpen(viewerId);
            logger.log(`Initial sidebar state: ${initialState ? 'open' : 'closed'}`);

            // Test opening sidebar
            const openResult = multiViewer.openViewerSidebar(viewerId);
            logger.log(`Open sidebar result: ${openResult}`);

            // Verify it's open
            const afterOpenState = multiViewer.isViewerSidebarOpen(viewerId);
            logger.log(`After open state: ${afterOpenState ? 'open' : 'closed'}`);

            // Test closing sidebar
            const closeResult = multiViewer.closeViewerSidebar(viewerId);
            logger.log(`Close sidebar result: ${closeResult}`);

            // Verify it's closed
            const afterCloseState = multiViewer.isViewerSidebarOpen(viewerId);
            logger.log(`After close state: ${afterCloseState ? 'open' : 'closed'}`);

            logger.success('Sidebar API test completed');

            const results = {
                viewerId,
                hasSidebarInstance: !!sidebar,
                initialState,
                openResult,
                afterOpenState,
                closeResult,
                afterCloseState,
                apiWorking: openResult && closeResult
            };

            return results;

        } catch (error) {
            logger.error(`Sidebar API test failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Test individual sidebar toggle
     */
    testToggleSidebar(viewerId) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log(`\n=== Toggle Sidebar Test for '${viewerId}' ===`);

            const currentState = multiViewer.isViewerSidebarOpen(viewerId);
            logger.log(`Current state: ${currentState ? 'open' : 'closed'}`);

            let result;
            if (currentState) {
                result = multiViewer.closeViewerSidebar(viewerId);
                logger.log(`Closing sidebar: ${result}`);
            } else {
                result = multiViewer.openViewerSidebar(viewerId);
                logger.log(`Opening sidebar: ${result}`);
            }

            const newState = multiViewer.isViewerSidebarOpen(viewerId);
            logger.log(`New state: ${newState ? 'open' : 'closed'}`);

            this.sidebarStates.set(viewerId, newState);

            const success = result && (currentState !== newState);
            if (success) {
                logger.success(`Sidebar toggled successfully for '${viewerId}'`);
            } else {
                logger.warning(`Sidebar toggle may have failed for '${viewerId}'`);
            }

            return success;

        } catch (error) {
            logger.error(`Toggle sidebar test failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Test sidebar content and controls
     */
    testSidebarContent() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return null;
        }

        try {
            logger.log('\n=== Sidebar Content Test ===');

            const viewerIds = multiViewer.getViewerIds();
            const results = {};

            viewerIds.forEach(viewerId => {
                logger.log(`\nTesting sidebar content for viewer '${viewerId}'...`);

                const sidebar = multiViewer.getViewerSidebar(viewerId);
                if (!sidebar) {
                    logger.warning(`No sidebar found for viewer '${viewerId}'`);
                    results[viewerId] = { error: 'No sidebar found' };
                    return;
                }

                const contentInfo = {
                    hasElement: !!sidebar.elSidebar,
                    isVisible: sidebar.elSidebar ? !sidebar.elSidebar.hidden : false,
                    hasControls: !!sidebar.elContent,
                    hasSceneControls: !!sidebar.elScene,
                    hasAppearanceControls: !!sidebar.elAppearance,
                    hasNavigationControls: !!sidebar.elNavigation,
                    controlsConnected: !!sidebar.connectAppearanceControls
                };

                logger.log(`  Has element: ${contentInfo.hasElement}`);
                logger.log(`  Is visible: ${contentInfo.isVisible}`);
                logger.log(`  Has controls: ${contentInfo.hasControls}`);
                logger.log(`  Has scene controls: ${contentInfo.hasSceneControls}`);
                logger.log(`  Has appearance controls: ${contentInfo.hasAppearanceControls}`);
                logger.log(`  Has navigation controls: ${contentInfo.hasNavigationControls}`);
                logger.log(`  Controls connected: ${contentInfo.controlsConnected}`);

                results[viewerId] = contentInfo;
            });

            logger.success('Sidebar content test completed');
            return results;

        } catch (error) {
            logger.error(`Sidebar content test failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Test sidebar responsiveness to point cloud changes
     */
    testSidebarPointCloudIntegration() {
        const multiViewer = testCore.getMultiViewer();
        const testViewers = testCore.getTestViewers();
        
        if (!multiViewer || testViewers.length === 0) {
            logger.error('Need viewers with point clouds to test sidebar integration');
            return null;
        }

        try {
            logger.log('\n=== Sidebar Point Cloud Integration Test ===');

            const results = {};

            testViewers.forEach((viewer, index) => {
                const viewerId = viewer.multiViewerConfig?.id || `viewer${index}`;
                logger.log(`\nTesting point cloud integration for '${viewerId}'...`);

                const sidebar = multiViewer.getViewerSidebar(viewerId);
                if (!sidebar) {
                    results[viewerId] = { error: 'No sidebar found' };
                    return;
                }

                const hasPointClouds = viewer.scene && viewer.scene.pointclouds.length > 0;
                const pointCloudCount = hasPointClouds ? viewer.scene.pointclouds.length : 0;

                let materialControlsWorking = false;
                let classificationControlsWorking = false;

                if (hasPointClouds) {
                    // Test if material controls respond to point cloud
                    const material = viewer.scene.pointclouds[0].material;
                    materialControlsWorking = material && material.size !== undefined;

                    // Test if classification controls are available
                    classificationControlsWorking = material && material.classification !== undefined;
                }

                const integrationInfo = {
                    hasPointClouds,
                    pointCloudCount,
                    materialControlsWorking,
                    classificationControlsWorking,
                    sidebarConnected: hasPointClouds && materialControlsWorking
                };

                logger.log(`  Has point clouds: ${hasPointClouds} (${pointCloudCount})`);
                logger.log(`  Material controls: ${materialControlsWorking}`);
                logger.log(`  Classification controls: ${classificationControlsWorking}`);
                logger.log(`  Sidebar connected: ${integrationInfo.sidebarConnected}`);

                results[viewerId] = integrationInfo;
            });

            logger.success('Sidebar point cloud integration test completed');
            return results;

        } catch (error) {
            logger.error(`Sidebar integration test failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Get current sidebar states summary
     */
    getSidebarSummary() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return null;
        }

        try {
            const stats = multiViewer.getSidebarStats();
            
            return {
                officialStats: stats,
                localStates: Object.fromEntries(this.sidebarStates),
                viewerCount: multiViewer.getViewerIds().length,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error(`Error getting sidebar summary: ${error.message}`);
            return null;
        }
    }

    /**
     * Run all sidebar tests
     */
    async runAllSidebarTests() {
        logger.log('\n📋 === RUNNING ALL SIDEBAR TESTS ===');

        const results = {};

        try {
            // Test 1: Sidebar statistics
            logger.log('\n1️⃣ Testing sidebar statistics...');
            results.stats = this.testSidebarStats();

            await new Promise(resolve => setTimeout(resolve, 500));

            // Test 2: Open all sidebars
            logger.log('\n2️⃣ Testing open all sidebars...');
            results.openAll = this.testOpenAllSidebars();

            await new Promise(resolve => setTimeout(resolve, 500));

            // Test 3: Sidebar API
            logger.log('\n3️⃣ Testing sidebar API...');
            results.api = this.testSidebarAPI();

            await new Promise(resolve => setTimeout(resolve, 500));

            // Test 4: Sidebar content
            logger.log('\n4️⃣ Testing sidebar content...');
            results.content = this.testSidebarContent();

            await new Promise(resolve => setTimeout(resolve, 500));

            // Test 5: Point cloud integration
            logger.log('\n5️⃣ Testing point cloud integration...');
            results.integration = this.testSidebarPointCloudIntegration();

            await new Promise(resolve => setTimeout(resolve, 500));

            // Test 6: Close all sidebars
            logger.log('\n6️⃣ Testing close all sidebars...');
            results.closeAll = this.testCloseAllSidebars();

            logger.log('\n🏁 === ALL SIDEBAR TESTS COMPLETED ===');

            const successfulTests = Object.values(results).filter(r => r !== false && r !== null && !r.error).length;
            const totalTests = Object.keys(results).length;

            logger.log(`\n📊 Overall Results: ${successfulTests}/${totalTests} tests completed successfully`);

            if (successfulTests === totalTests) {
                logger.success('🎉 ALL SIDEBAR TESTS PASSED!');
            } else {
                logger.warning(`⚠️  ${totalTests - successfulTests} test(s) had issues`);
            }

            return results;

        } catch (error) {
            logger.error(`Error running all sidebar tests: ${error.message}`);
            return results;
        }
    }

    /**
     * Cleanup sidebar resources
     */
    cleanup() {
        this.sidebarStates.clear();
    }
}

// Global instance
export const sidebarTester = new SidebarTester();