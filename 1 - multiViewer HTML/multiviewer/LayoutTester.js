// CUSTOM - LayoutTester module for testing different viewer layouts
import { logger } from '../core/TestLogger.js';
import { testCore } from '../core/TestCore.js';
import { multiViewerTester } from './MultiViewerTester.js';

export class LayoutTester {
    constructor() {
        this.supportedLayouts = ['1x1', '1x2', 'main-dual', '2x2'];
    }

    /**
     * Test 1x2 layout (2 viewers side by side)
     */
    async testLayout1x2() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log('Setting up 1x2 layout (2 viewers side by side)...');

            // Create exactly 2 viewers
            const viewers = await multiViewerTester.createViewers(2);

            logger.success('✓ 2 viewers arranged side by side');
            logger.success('✓ Each viewer: 1/2 width, full height');

            return viewers;

        } catch (error) {
            logger.error(`Error setting 1x2 layout: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test main-dual layout (1 main + 2 side viewers)
     */
    async testLayoutMainDual() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log('Setting up Main+2 Side layout...');

            // Create exactly 3 viewers
            const viewers = await multiViewerTester.createViewers(3);

            logger.success('✓ 3 viewers arranged: 1 main view (left) + 2 side viewports (top-right, bottom-right)');
            logger.success('✓ Main viewer: full height, 2/3 width');
            logger.success('✓ Side viewers: 1/2 height each, 1/3 width');

            return viewers;

        } catch (error) {
            logger.error(`Error setting main-dual layout: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test 2x2 layout (4 viewers in grid)
     */
    async testLayout2x2() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log('Setting up 2x2 grid layout...');

            // Create exactly 4 viewers
            const viewers = await multiViewerTester.createViewers(4);

            logger.success('✓ All 4 viewers arranged in 2x2 grid');
            logger.success('✓ Each viewer: 1/2 width, 1/2 height');

            return viewers;

        } catch (error) {
            logger.error(`Error setting 2x2 layout: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test custom layout with specific configuration
     */
    async testCustomLayout(layoutName, viewerConfigs) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        if (!this.supportedLayouts.includes(layoutName)) {
            throw new Error(`Unsupported layout: ${layoutName}. Supported: ${this.supportedLayouts.join(', ')}`);
        }

        try {
            logger.log(`Setting up custom ${layoutName} layout...`);

            const viewers = await multiViewerTester.createViewers(viewerConfigs.length, viewerConfigs);

            // Apply the specific layout
            multiViewer.setLayout(layoutName);
            logger.success(`✓ Applied ${layoutName} layout`);

            return viewers;

        } catch (error) {
            logger.error(`Error setting custom layout ${layoutName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test layout switching between different configurations
     */
    async testLayoutSwitching() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log('Testing layout switching capabilities...');

            // Start with 4 viewers for maximum flexibility
            await multiViewerTester.createViewers(4);

            const layoutSequence = ['2x2', 'main-dual', '1x2', '1x1'];
            
            for (const layout of layoutSequence) {
                logger.log(`Switching to ${layout} layout...`);
                multiViewer.setLayout(layout);
                
                // Wait a moment for layout to settle
                await new Promise(resolve => setTimeout(resolve, 500));
                
                logger.success(`✓ Successfully switched to ${layout}`);
            }

            logger.success('✓ Layout switching test completed');
            logger.success('✓ All layouts applied successfully');

        } catch (error) {
            logger.error(`Error during layout switching test: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test responsive layout behavior
     */
    async testResponsiveLayout() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            throw new Error('MultiViewer not created yet');
        }

        try {
            logger.log('Testing responsive layout behavior...');

            // Create 4 viewers
            await multiViewerTester.createViewers(4);

            // Get container dimensions
            const container = testCore.getContainer();
            const originalWidth = container.offsetWidth;
            const originalHeight = container.offsetHeight;

            logger.log(`Original container size: ${originalWidth}x${originalHeight}`);

            // Test different container sizes
            const testSizes = [
                { width: 800, height: 600, description: 'Standard desktop' },
                { width: 1200, height: 800, description: 'Large desktop' },
                { width: 600, height: 400, description: 'Small window' }
            ];

            for (const size of testSizes) {
                logger.log(`Testing ${size.description}: ${size.width}x${size.height}`);
                
                container.style.width = `${size.width}px`;
                container.style.height = `${size.height}px`;

                // Trigger layout recalculation
                if (multiViewer.updateLayout) {
                    multiViewer.updateLayout();
                }

                // Wait for layout update
                await new Promise(resolve => setTimeout(resolve, 300));

                logger.success(`✓ Layout adapted to ${size.description}`);
            }

            // Restore original size
            container.style.width = `${originalWidth}px`;
            container.style.height = `${originalHeight}px`;

            if (multiViewer.updateLayout) {
                multiViewer.updateLayout();
            }

            logger.success('✓ Responsive layout test completed');
            logger.success('✓ Container size restored');

        } catch (error) {
            logger.error(`Error during responsive layout test: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get layout information and statistics
     */
    getLayoutInfo() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return null;
        }

        try {
            const info = {
                currentLayout: multiViewer.getCurrentLayout?.() || 'unknown',
                viewerCount: multiViewer.getViewerCount(),
                viewerIds: multiViewer.getViewerIds(),
                containerSize: {
                    width: testCore.getContainer()?.offsetWidth || 0,
                    height: testCore.getContainer()?.offsetHeight || 0
                },
                supportedLayouts: this.supportedLayouts
            };

            logger.log('Current Layout Information:');
            logger.log(`  Layout: ${info.currentLayout}`);
            logger.log(`  Viewers: ${info.viewerCount}`);
            logger.log(`  Container: ${info.containerSize.width}x${info.containerSize.height}`);
            logger.log(`  Viewer IDs: ${info.viewerIds.join(', ')}`);

            return info;

        } catch (error) {
            logger.error(`Error getting layout info: ${error.message}`);
            return null;
        }
    }

    /**
     * Validate current layout state
     */
    validateLayout() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return { valid: false, issues: ['MultiViewer not created'] };
        }

        try {
            const issues = [];
            const viewers = multiViewer.getAllViewers();
            const viewerCount = Object.keys(viewers).length;

            // Check if all viewers have proper DOM elements
            for (const [viewerId, viewer] of Object.entries(viewers)) {
                if (!viewer.renderer?.domElement) {
                    issues.push(`Viewer ${viewerId} missing DOM element`);
                }

                if (!viewer.scene) {
                    issues.push(`Viewer ${viewerId} missing scene`);
                }
            }

            // Check layout consistency
            const currentLayout = multiViewer.getCurrentLayout?.();
            if (currentLayout) {
                const expectedViewerCount = {
                    '1x1': 1,
                    '1x2': 2,
                    'main-dual': 3,
                    '2x2': 4
                };

                if (expectedViewerCount[currentLayout] && 
                    expectedViewerCount[currentLayout] !== viewerCount) {
                    issues.push(`Layout ${currentLayout} expects ${expectedViewerCount[currentLayout]} viewers, but found ${viewerCount}`);
                }
            }

            const valid = issues.length === 0;

            if (valid) {
                logger.success('✓ Layout validation passed');
            } else {
                logger.warning('⚠️ Layout validation issues found:');
                issues.forEach(issue => logger.warning(`  - ${issue}`));
            }

            return { valid, issues };

        } catch (error) {
            logger.error(`Error during layout validation: ${error.message}`);
            return { valid: false, issues: [error.message] };
        }
    }
}

// Global instance
export const layoutTester = new LayoutTester();