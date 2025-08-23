// CUSTOM - CommunicationTester module for cross-viewer communication and shared objects
import { logger } from '../core/TestLogger.js';
import { testCore } from '../core/TestCore.js';

export class CommunicationTester {
    constructor() {
        this.lastDrawnLineId = null;
    }

    /**
     * Test cross-viewer communication system
     */
    testCommunicationSystem() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Cross-Viewer Communication Test ===');

            // Test 1: Get communication system
            const communication = multiViewer.getCommunication();
            if (communication) {
                logger.success('Communication system available');
            } else {
                logger.error('Communication system not available');
                return;
            }

            // Test 2: Get communication stats
            const stats = multiViewer.getCommunicationStats();
            if (stats) {
                logger.log(`Communication enabled: ${stats.enabled}`);
                logger.log(`Registered viewers: ${stats.registeredViewers}`);
                logger.log(`Available channels: ${stats.channels}`);
                logger.log(`Shared geometry: ${stats.sharedGeometry}`);
                logger.log(`Shared annotations: ${stats.sharedAnnotations}`);
                logger.log(`Shared measurements: ${stats.sharedMeasurements}`);
            } else {
                logger.error('Could not get communication stats');
            }

            // Test 3: Test messaging system
            logger.log('\nTesting messaging system...');
            const messageSent = multiViewer.sendMessage('test', {
                type: 'hello',
                message: 'Test message from communication system'
            });
            logger.log(`Message sent: ${messageSent}`);

            // Test 4: Subscribe viewers to channels
            logger.log('\nTesting channel subscriptions...');
            const viewers = multiViewer.getAllViewers();
            Object.keys(viewers).forEach(viewerId => {
                multiViewer.subscribeViewerToChannel(viewerId, 'test');
                logger.success(`Subscribed viewer '${viewerId}' to 'test' channel`);
            });

            // Test 5: Get shared state
            logger.log('\nTesting shared state...');
            const sharedState = multiViewer.getSharedState();
            if (sharedState) {
                logger.log(`Shared state version: ${sharedState.version}`);
                logger.log(`Last modified: ${new Date(sharedState.lastModified).toLocaleString()}`);
                logger.log(`Active tool: ${sharedState.activeTool || 'none'}`);
            } else {
                logger.error('Could not get shared state');
            }

            logger.success('Communication system test completed');

        } catch (error) {
            logger.error(`Communication system test failed: ${error.message}`);
        }
    }

    /**
     * Test shared geometry functionality
     */
    testSharedGeometry() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Shared Geometry Test ===');

            // Test different geometry types
            const geometryTests = [
                {
                    type: 'point',
                    coordinates: [{x: 694400, y: 3916300, z: 100}],
                    style: {color: 0xff0000, size: 10}
                },
                {
                    type: 'line',
                    coordinates: [
                        {x: 694300, y: 3916300, z: 100},
                        {x: 694500, y: 3916400, z: 150}
                    ],
                    style: {color: 0x00ff00, lineWidth: 3}
                },
                {
                    type: 'polyline',
                    coordinates: [
                        {x: 694300, y: 3916200, z: 80},
                        {x: 694400, y: 3916250, z: 90},
                        {x: 694500, y: 3916200, z: 100},
                        {x: 694600, y: 3916300, z: 110}
                    ],
                    style: {color: 0x0000ff, lineWidth: 2}
                }
            ];

            logger.log('Adding test geometries...');

            geometryTests.forEach((geometry, index) => {
                const geometryId = multiViewer.addSharedGeometry(geometry);
                if (geometryId) {
                    logger.success(`Added ${geometry.type} geometry: ${geometryId}`);
                } else {
                    logger.error(`Failed to add ${geometry.type} geometry`);
                }
            });

            // Test geometry update
            setTimeout(() => {
                logger.log('\nTesting geometry updates...');
                const sharedState = multiViewer.getSharedState();
                if (sharedState && sharedState.geometry) {
                    const geometryIds = Object.keys(sharedState.geometry);
                    if (geometryIds.length > 0) {
                        const updateSuccess = multiViewer.updateSharedGeometry(geometryIds[0], {
                            style: { color: 0xffff00, opacity: 0.8 }
                        });
                        logger.success(`Updated geometry style: ${updateSuccess}`);
                    }
                }
            }, 1000);

            logger.success('Shared geometry test initiated');

        } catch (error) {
            logger.error(`Shared geometry test failed: ${error.message}`);
        }
    }

    /**
     * Test drawing a shared line across all viewers
     */
    testDrawLine() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Draw Shared Line Test ===');
            logger.log('Drawing a line that should appear in all viewers...');

            // Create a simple line in 3D space
            const lineData = {
                type: 'line',
                coordinates: [
                    {x: 694400, y: 3916300, z: 50},  // Start point
                    {x: 694600, y: 3916400, z: 200}  // End point
                ],
                style: {
                    color: 0xff6600, // Orange
                    lineWidth: 4,
                    opacity: 1
                },
                properties: {
                    name: 'Test Line',
                    description: 'A test line drawn across all viewers',
                    creator: 'user'
                }
            };

            const geometryId = multiViewer.addSharedGeometry(lineData, 'manual_test');

            if (geometryId) {
                logger.success(`Drew shared line: ${geometryId}`);
                logger.success('Line should now be visible in all active viewers');
                logger.success('Line coordinates: (694400, 3916300, 50) to (694600, 3916400, 200)');

                // Store for later removal
                this.lastDrawnLineId = geometryId;

            } else {
                logger.error('Failed to draw shared line');
            }

        } catch (error) {
            logger.error(`Draw line test failed: ${error.message}`);
        }
    }

    /**
     * Clear all shared objects
     */
    testClearShared() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Clear Shared Objects Test ===');

            const sharedState = multiViewer.getSharedState();
            if (!sharedState || !sharedState.geometry) {
                logger.log('No shared geometry to clear');
                return;
            }

            const geometryIds = Object.keys(sharedState.geometry);
            logger.log(`Found ${geometryIds.length} shared geometries to clear`);

            let removedCount = 0;
            geometryIds.forEach(geometryId => {
                const success = multiViewer.removeSharedGeometry(geometryId, 'clear_test');
                if (success) {
                    removedCount++;
                    logger.success(`Removed geometry: ${geometryId}`);
                } else {
                    logger.error(`Failed to remove geometry: ${geometryId}`);
                }
            });

            logger.success(`Cleared ${removedCount}/${geometryIds.length} shared geometries`);

            // Clear stored reference
            if (this.lastDrawnLineId) {
                this.lastDrawnLineId = null;
            }

        } catch (error) {
            logger.error(`Clear shared objects test failed: ${error.message}`);
        }
    }

    /**
     * Get communication statistics
     */
    testCommStats() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return;
        }

        try {
            logger.log('\n=== Communication Statistics Test ===');

            const stats = multiViewer.getCommunicationStats();
            if (!stats) {
                logger.error('Communication statistics not available');
                return;
            }

            logger.log('Communication System Status:');
            logger.log(`  Enabled: ${stats.enabled}`);
            logger.log(`  Registered viewers: ${stats.registeredViewers}`);
            logger.log(`  Available channels: ${stats.channels}`);
            logger.log(`  Message history length: ${stats.messageHistory}`);
            logger.log(`  Last modified: ${new Date(stats.lastModified).toLocaleString()}`);

            logger.log('\nShared Objects:');
            logger.log(`  Geometry objects: ${stats.sharedGeometry}`);
            logger.log(`  Annotation objects: ${stats.sharedAnnotations}`);
            logger.log(`  Measurement objects: ${stats.sharedMeasurements}`);

            // Get detailed shared state
            const sharedState = multiViewer.getSharedState();
            if (sharedState) {
                logger.log('\nDetailed Shared State:');
                if (sharedState.geometry && Object.keys(sharedState.geometry).length > 0) {
                    logger.log('  Geometry objects:');
                    Object.entries(sharedState.geometry).forEach(([id, geom]) => {
                        logger.log(`    ${id}: ${geom.type} (${geom.coordinates.length} points) - ${geom.style.color.toString(16)}`);
                    });
                }

                if (sharedState.activeLayers && sharedState.activeLayers.length > 0) {
                    logger.log(`  Active layers: ${sharedState.activeLayers.join(', ')}`);
                }

                logger.log(`  Active tool: ${sharedState.activeTool || 'none'}`);
                logger.log(`  Active drawing session: ${sharedState.activeDrawingSession || 'none'}`);
            }

            logger.success('Communication statistics test completed');

        } catch (error) {
            logger.error(`Communication statistics test failed: ${error.message}`);
        }
    }

    /**
     * Test sending a custom message to all viewers
     */
    sendTestMessage(messageType = 'test', data = {}) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            const message = {
                type: messageType,
                timestamp: Date.now(),
                sender: 'CommunicationTester',
                ...data
            };

            const success = multiViewer.sendMessage('broadcast', message);
            if (success) {
                logger.success(`Sent ${messageType} message to all viewers`);
            } else {
                logger.error(`Failed to send ${messageType} message`);
            }

            return success;

        } catch (error) {
            logger.error(`Error sending message: ${error.message}`);
            return false;
        }
    }

    /**
     * Get current communication state summary
     */
    getCommunicationSummary() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return null;
        }

        try {
            const stats = multiViewer.getCommunicationStats();
            const sharedState = multiViewer.getSharedState();

            return {
                stats,
                sharedState,
                hasGeometry: sharedState?.geometry && Object.keys(sharedState.geometry).length > 0,
                geometryCount: sharedState?.geometry ? Object.keys(sharedState.geometry).length : 0,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error(`Error getting communication summary: ${error.message}`);
            return null;
        }
    }

    /**
     * Cleanup communication resources
     */
    cleanup() {
        // Clear any stored references
        this.lastDrawnLineId = null;
    }
}

// Global instance
export const communicationTester = new CommunicationTester();