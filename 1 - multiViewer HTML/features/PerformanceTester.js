// CUSTOM - PerformanceTester module for performance monitoring and optimization
import { logger } from '../core/TestLogger.js';
import { uiManager } from '../core/UIManager.js';
import { testCore } from '../core/TestCore.js';

export class PerformanceTester {
    constructor() {
        this.performanceMonitorInterval = null;
    }

    /**
     * Test rendering performance and get statistics
     */
    testRenderingPerformance() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Rendering Performance Test ===');

            // Test 1: Get rendering statistics
            const renderStats = multiViewer.getRenderingStats();
            if (renderStats) {
                logger.log(`Current FPS: ${renderStats.fps.current.toFixed(1)}`);
                logger.log(`Average FPS: ${renderStats.fps.average.toFixed(1)}`);
                logger.log(`Target FPS: ${renderStats.fps.target}`);
                logger.log(`Frame time: ${renderStats.fps.frameTime.toFixed(2)}ms`);
                logger.log(`Render budget utilization: ${renderStats.budget.utilization.toFixed(1)}%`);
                logger.log(`Total viewers: ${renderStats.viewers.total}`);
                logger.log(`Visible viewers: ${renderStats.viewers.visible}`);
                logger.log(`Active viewers: ${renderStats.viewers.active}`);
                logger.log(`Scheduled viewers: ${renderStats.viewers.scheduled}`);
                logger.log(`Global quality level: ${renderStats.quality.global}`);
                logger.log(`Adaptive rendering: ${renderStats.quality.adaptive}`);
            } else {
                logger.error('Rendering statistics not available');
            }

            // Test 2: Get viewer performance metrics
            const viewerMetrics = multiViewer.getViewerPerformanceMetrics();
            if (viewerMetrics && viewerMetrics.length > 0) {
                logger.log('\nViewer Performance Metrics:');
                viewerMetrics.forEach(metrics => {
                    logger.log(`  ${metrics.id}:`);
                    logger.log(`    Visible: ${metrics.isVisible}`);
                    logger.log(`    Active: ${metrics.isActive}`);
                    logger.log(`    Visibility ratio: ${(metrics.visibilityRatio * 100).toFixed(1)}%`);
                    logger.log(`    Render count: ${metrics.renderCount}`);
                    logger.log(`    Avg render time: ${metrics.avgRenderTime.toFixed(2)}ms`);
                    logger.log(`    Frame skips: ${metrics.frameSkipCount}`);
                    logger.log(`    Quality level: ${metrics.qualityLevel}`);
                    logger.log(`    Needs render: ${metrics.needsRender}`);
                });
            } else {
                logger.log('No viewer performance metrics available');
            }

            // Test 3: Configure optimization settings
            logger.log('\nTesting optimization configuration...');
            multiViewer.configureRenderOptimization({
                targetFPS: 60,
                adaptiveRendering: true,
                visibilityBasedRendering: true
            });
            logger.success('Optimization settings configured');

            // Test 4: Test adaptive rendering toggle
            logger.log('\nTesting adaptive rendering controls...');
            const currentAdaptive = multiViewer.getRenderingStats()?.quality.adaptive;
            multiViewer.setAdaptiveRendering(!currentAdaptive);
            logger.success(`Adaptive rendering toggled to: ${!currentAdaptive}`);

            // Restore original state
            setTimeout(() => {
                multiViewer.setAdaptiveRendering(currentAdaptive);
                logger.success(`Adaptive rendering restored to: ${currentAdaptive}`);
            }, 1000);

            // Test 5: Memory monitoring (if available)
            if (window.performance && window.performance.memory) {
                const memory = window.performance.memory;
                const memoryMB = {
                    used: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
                    total: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
                    limit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024))
                };
                logger.log(`\nMemory Usage:`);
                logger.log(`  Used: ${memoryMB.used}MB`);
                logger.log(`  Total: ${memoryMB.total}MB`);
                logger.log(`  Limit: ${memoryMB.limit}MB`);
                logger.log(`  Utilization: ${((memoryMB.used / memoryMB.limit) * 100).toFixed(1)}%`);
            }

            logger.success('Performance monitoring test completed');

        } catch (error) {
            logger.error(`Performance monitoring test failed: ${error.message}`);
        }
    }

    /**
     * Start real-time performance monitoring
     */
    startPerformanceMonitoring() {
        if (this.performanceMonitorInterval) {
            logger.log('Performance monitoring already running');
            return;
        }

        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        logger.log('\n=== Starting Real-time Performance Monitoring ===');

        this.performanceMonitorInterval = setInterval(() => {
            const stats = multiViewer.getRenderingStats();
            if (stats) {
                // Clear previous monitoring output
                const existing = document.getElementById('performance-monitor');
                if (existing) existing.remove();

                // Create performance display
                const monitor = document.createElement('div');
                monitor.id = 'performance-monitor';
                monitor.style.cssText = `
                    position: fixed; top: 10px; right: 10px; 
                    background: rgba(0,0,0,0.8); color: white; 
                    padding: 10px; border-radius: 5px; font-family: monospace;
                    font-size: 12px; z-index: 10000; min-width: 200px;
                `;

                monitor.innerHTML = `
                    <strong>Performance Monitor</strong><br>
                    FPS: ${stats.fps.current.toFixed(1)} (avg: ${stats.fps.average.toFixed(1)})<br>
                    Frame: ${stats.fps.frameTime.toFixed(1)}ms<br>
                    Budget: ${stats.budget.utilization.toFixed(1)}%<br>
                    Quality: ${stats.quality.global}<br>
                    Viewers: ${stats.viewers.visible}/${stats.viewers.total}<br>
                    Adaptive: ${stats.quality.adaptive ? 'ON' : 'OFF'}
                `;

                document.body.appendChild(monitor);
            }
        }, 1000);

        // Update button states
        uiManager.disableButton('startMonitorBtn');
        uiManager.enableButton('stopMonitorBtn');

        logger.success('Real-time performance monitoring started (top-right corner)');
    }

    /**
     * Stop real-time performance monitoring
     */
    stopPerformanceMonitoring() {
        if (this.performanceMonitorInterval) {
            clearInterval(this.performanceMonitorInterval);
            this.performanceMonitorInterval = null;

            const existing = document.getElementById('performance-monitor');
            if (existing) existing.remove();

            // Update button states
            uiManager.enableButton('startMonitorBtn');
            uiManager.disableButton('stopMonitorBtn');

            logger.success('Performance monitoring stopped');
        } else {
            logger.log('Performance monitoring not running');
        }
    }

    /**
     * Force render all viewers (bypassing optimization)
     */
    testForceRender() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Force Render Test ===');
            logger.log('Forcing render of all viewers (bypassing optimization)...');
            multiViewer.forceRenderAll();
            logger.success('Force render completed');

        } catch (error) {
            logger.error(`Force render test failed: ${error.message}`);
        }
    }

    /**
     * Get performance statistics summary
     */
    getPerformanceStats() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return null;
        }

        try {
            const renderStats = multiViewer.getRenderingStats();
            const viewerMetrics = multiViewer.getViewerPerformanceMetrics();
            
            let memoryStats = null;
            if (window.performance && window.performance.memory) {
                const memory = window.performance.memory;
                memoryStats = {
                    used: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
                    total: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
                    limit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024))
                };
            }

            return {
                renderStats,
                viewerMetrics,
                memoryStats,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error(`Error getting performance stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Cleanup performance monitoring
     */
    cleanup() {
        this.stopPerformanceMonitoring();
    }
}

// Global instance
export const performanceTester = new PerformanceTester();