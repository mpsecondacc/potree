// CUSTOM - Main orchestration module for test-multi-viewer-NEW.html
// This module coordinates all the test modules and provides the global functions

// Core modules
import { logger, log } from './core/TestLogger.js';
import { uiManager, enableButton, disableButton } from './core/UIManager.js';
import { testCore } from './core/TestCore.js';

// MultiViewer modules
import { multiViewerTester } from './multiviewer/MultiViewerTester.js';
import { layoutTester } from './multiviewer/LayoutTester.js';

// Feature modules
import { performanceTester } from './features/PerformanceTester.js';
import { communicationTester } from './features/CommunicationTester.js';
import { materialTester } from './features/MaterialTester.js';
import { configurationTester } from './features/ConfigurationTester.js';
import { sidebarTester } from './features/SidebarTester.js';

/**
 * Initialize the test environment when the page loads
 */
async function initializeTestEnvironment() {
    try {
        await testCore.initialize();
        
        logger.log('Real implementation test environment ready.');
        logger.log('This will create actual Potree viewers with:');
        logger.log('- Real ViewerManager coordination');
        logger.log('- Actual DOM containers and positioning');
        logger.log('- Working layout management');  
        logger.log('- Proper resource management');
        logger.log('- Visual viewer indicators and labels');
        logger.log('');
        logger.log('Auto-initializing MultiViewer...');

        // Auto-initialize MultiViewer on page load with Layout 1 (single viewer)
        await testCreateMultiViewer();
        await setLayout(1);

    } catch (error) {
        logger.error(`Initialization failed: ${error.message}`);
        console.error('Init error:', error);
    }
}

// ==============================================================================
// Layout Control Functions for Clean CAD Interface
// ==============================================================================

window.setLayout = async function(layoutNumber) {
    try {
        // Update active layout icon
        document.querySelectorAll('.layout-icon').forEach(icon => icon.classList.remove('active'));
        document.getElementById(`layout${layoutNumber}`).classList.add('active');

        logger.log(`Setting layout ${layoutNumber}...`);

        switch (layoutNumber) {
            case 1:
                // Single viewer layout (1x1)
                await multiViewerTester.createViewers(1, [
                    { id: 'main', name: 'Main Viewer' }
                ]);
                break;
            case 2:
                // Two viewers side by side (1x2)
                await multiViewerTester.createViewers(2, [
                    { id: 'viewer1', name: 'Viewer 1' },
                    { id: 'viewer2', name: 'Viewer 2' }
                ]);
                break;
            case 3:
                // Three viewers: main + 2 side (main-dual)
                await multiViewerTester.createViewers(3, [
                    { id: 'main', name: 'Main Viewer' },
                    { id: 'top', name: 'Top View' },
                    { id: 'bottom', name: 'Bottom View' }
                ]);
                break;
            case 4:
                // Four viewers in 2x2 grid
                await multiViewerTester.createViewers(4, [
                    { id: 'viewer1', name: 'Viewer 1' },
                    { id: 'viewer2', name: 'Viewer 2' },
                    { id: 'viewer3', name: 'Viewer 3' },
                    { id: 'viewer4', name: 'Viewer 4' }
                ]);
                break;
            default:
                logger.error(`Unknown layout number: ${layoutNumber}`);
                return;
        }

        logger.success(`Layout ${layoutNumber} applied successfully`);

    } catch (error) {
        logger.error(`Error setting layout ${layoutNumber}: ${error.message}`);
    }
};

// ==============================================================================
// Global test functions (maintain backward compatibility with existing HTML)
// ==============================================================================

window.testCreateMultiViewer = async function() {
    try {
        logger.log('🚀 Auto-initializing MultiViewer on page load...');
        const multiViewer = await multiViewerTester.createMultiViewer();
        logger.success('✅ MultiViewer auto-initialized successfully');
        return multiViewer;
    } catch (error) {
        logger.error(`❌ Auto-initialization failed: ${error.message}`);
        console.error('Auto-init error:', error);
    }
};

window.testCreateViewers = async function() {
    try {
        return await multiViewerTester.createViewers(2);
    } catch (error) {
        logger.error(`Error creating viewers: ${error.message}`);
    }
};

window.testLayout1x2 = async function() {
    try {
        return await layoutTester.testLayoutMainDual(); // 3 viewers: main + 2 side
    } catch (error) {
        logger.error(`Error setting layout: ${error.message}`);
    }
};

window.testLayout2x2 = async function() {
    try {
        return await layoutTester.testLayout2x2();
    } catch (error) {
        logger.error(`Error setting 2x2 layout: ${error.message}`);
    }
};

window.testAddViewer = async function() {
    try {
        return await multiViewerTester.addViewer();
    } catch (error) {
        logger.error(`Error adding viewer: ${error.message}`);
    }
};

window.testRemoveViewer = function() {
    try {
        return multiViewerTester.removeViewer();
    } catch (error) {
        logger.error(`Error removing viewer: ${error.message}`);
    }
};

window.testDestroy = function() {
    try {
        // Cleanup all feature modules
        performanceTester.cleanup();
        communicationTester.cleanup();
        materialTester.clearResults();
        configurationTester.cleanup();
        sidebarTester.cleanup();
        
        // Destroy MultiViewer
        multiViewerTester.destroy();
        
        logger.success('All modules cleaned up successfully');
    } catch (error) {
        logger.error(`Error during cleanup: ${error.message}`);
    }
};

// Sync and focus functions
window.toggleSync = function() {
    const multiViewer = testCore.getMultiViewer();
    if (!multiViewer) {
        logger.error('MultiViewer not created yet');
        return;
    }

    try {
        logger.log('toggleSync called!');
        
        const syncEnabled = !multiViewer.getSyncEnabled?.() || false;
        console.log('Setting sync to:', syncEnabled);
        
        multiViewer.setSyncEnabled(syncEnabled);
        
        const toggleBtn = document.getElementById('toggleSyncBtn');
        if (toggleBtn) {
            toggleBtn.textContent = `Toggle Sync (${syncEnabled ? 'ON' : 'OFF'})`;
            toggleBtn.style.backgroundColor = syncEnabled ? '#4CAF50' : '#f44336';
        }
        
        logger.success(`Camera synchronization ${syncEnabled ? 'enabled' : 'disabled'}`);
        
        // Debug: check actual viewer sync states
        const allViewers = multiViewer.getAllViewers();
        Object.keys(allViewers).forEach(id => {
            const viewer = allViewers[id];
            const actualSyncState = viewer.multiViewerConfig?.syncEnabled;
            console.log(`Viewer '${id}' sync state:`, actualSyncState);
        });
        
    } catch (error) {
        logger.error(`Error toggling sync: ${error.message}`);
        console.error(error);
    }
};

// CUSTOM - Focus functionality commented out as requested
/*
window.toggleLockFocus = function() {
    const multiViewer = testCore.getMultiViewer();
    if (!multiViewer) {
        logger.error('MultiViewer not created yet');
        return;
    }
    
    try {
        logger.log('\n=== Focus Lock Toggle ===');
        
        const newState = multiViewer.toggleFocusLock();
        const mode = newState ? 'Click-to-focus (LOCKED)' : 'Hover-to-interact (UNLOCKED)';
        const btnText = newState ? 'Lock Focus (ON)' : 'Lock Focus (OFF)';
        
        logger.success(`Focus lock toggled: ${newState ? 'ENABLED' : 'DISABLED'}`);
        logger.success(`Mode: ${mode}`);
        logger.log('ℹ️ Behavior:');
        if (newState) {
            logger.log('  - Click inside a viewer to focus it');
            logger.log('  - Only focused viewer responds to mouse/keyboard input');
            logger.log('  - Other viewers are blocked from input');
        } else {
            logger.log('  - Simply hover over any viewer to interact');
            logger.log('  - No need to click to focus');
            logger.log('  - Viewers activate automatically on mouse movement');
        }
        
        // Update button text
        const button = document.getElementById('lockFocusBtn');
        if (button) {
            button.textContent = btnText;
        }
        
    } catch (error) {
        logger.error(`Error toggling focus lock: ${error.message}`);
    }
};
*/

// Status and identification functions
window.testIdentification = function() {
    const multiViewer = testCore.getMultiViewer();
    if (!multiViewer) {
        logger.error('MultiViewer not created yet');
        return;
    }
    
    try {
        logger.log('Testing viewer identification and naming system...');
        
        // Test 1: Get current viewer information
        const registryStats = multiViewer.getRegistryStats();
        logger.log(`Current viewers: ${registryStats.totalViewers}`);
        logger.log(`Active viewers: ${registryStats.activeViewers}`);
        logger.log(`Viewer IDs: ${registryStats.idList.join(', ')}`);
        logger.log(`Viewer Names: ${registryStats.nameList.join(', ')}`);
        
        // Test 2: Get detailed viewer information
        const detailedInfo = multiViewer.getDetailedViewerInfo();
        logger.log('\nDetailed viewer information:');
        detailedInfo.forEach((info, index) => {
            logger.log(`  ${index + 1}. ID: '${info.id}', Name: '${info.name}', Active: ${info.isActive}`);
            logger.log(`     Created: ${new Date(info.createdAt).toLocaleString()}`);
            logger.log(`     Has Renderer: ${info.hasRenderer}, Has Scene: ${info.hasScene}`);
        });
        
        // Test 3: Auto-assign names based on layout
        logger.log('\nTesting auto-assignment of layout-based names...');
        multiViewer.autoAssignNames();
        
        // Show updated names
        const updatedStats = multiViewer.getRegistryStats();
        logger.log(`Updated viewer names: ${updatedStats.nameList.join(', ')}`);
        
        logger.success('✓ Identification and naming system test complete!');
        
    } catch (error) {
        logger.error(`Error testing identification: ${error.message}`);
        console.error(error);
    }
};

window.testStatus = function() {
    const multiViewer = testCore.getMultiViewer();
    if (!multiViewer) {
        logger.error('MultiViewer not created yet');
        return;
    }
    
    try {
        logger.log('Getting status information...');
        
        const status = multiViewer.getStatus();
        
        logger.success('✓ Status Information:');
        logger.log(`  - Ready: ${status.isReady}`);
        logger.log(`  - Viewer Count: ${status.viewerCount}/${status.maxViewers}`);
        logger.log(`  - Current Layout: ${status.currentLayout}`);
        logger.log(`  - Manager Initialized: ${status.isInitialized}`);
        logger.success('✓ Status system working');
        
        enableButton('destroyBtn');
        
    } catch (error) {
        logger.error(`Error getting status: ${error.message}`);
    }
};

// ==============================================================================
// Performance Testing Functions
// ==============================================================================

window.testRenderingPerformance = function() {
    try {
        performanceTester.testRenderingPerformance();
    } catch (error) {
        logger.error(`Error in performance test: ${error.message}`);
    }
};

window.startPerformanceMonitoring = function() {
    try {
        performanceTester.startPerformanceMonitoring();
    } catch (error) {
        logger.error(`Error starting performance monitoring: ${error.message}`);
    }
};

window.stopPerformanceMonitoring = function() {
    try {
        performanceTester.stopPerformanceMonitoring();
    } catch (error) {
        logger.error(`Error stopping performance monitoring: ${error.message}`);
    }
};

window.testForceRender = function() {
    try {
        performanceTester.testForceRender();
    } catch (error) {
        logger.error(`Error in force render test: ${error.message}`);
    }
};

// ==============================================================================
// Communication Testing Functions
// ==============================================================================

window.testCommunicationSystem = function() {
    try {
        communicationTester.testCommunicationSystem();
    } catch (error) {
        logger.error(`Error in communication test: ${error.message}`);
    }
};

window.testSharedGeometry = function() {
    try {
        communicationTester.testSharedGeometry();
    } catch (error) {
        logger.error(`Error in shared geometry test: ${error.message}`);
    }
};

window.testDrawLine = function() {
    try {
        communicationTester.testDrawLine();
    } catch (error) {
        logger.error(`Error in draw line test: ${error.message}`);
    }
};

window.testClearShared = function() {
    try {
        communicationTester.testClearShared();
    } catch (error) {
        logger.error(`Error in clear shared test: ${error.message}`);
    }
};

window.testCommStats = function() {
    try {
        communicationTester.testCommStats();
    } catch (error) {
        logger.error(`Error in communication stats test: ${error.message}`);
    }
};

// ==============================================================================
// Configuration Testing Functions
// ==============================================================================

window.testSaveConfiguration = async function() {
    try {
        await configurationTester.testSaveConfiguration();
    } catch (error) {
        logger.error(`Error in save configuration test: ${error.message}`);
    }
};

window.testLoadConfiguration = async function() {
    try {
        await configurationTester.testLoadConfiguration();
    } catch (error) {
        logger.error(`Error in load configuration test: ${error.message}`);
    }
};

window.testListConfigurations = function() {
    try {
        configurationTester.testListConfigurations();
    } catch (error) {
        logger.error(`Error in list configurations test: ${error.message}`);
    }
};

window.testExportConfiguration = async function() {
    try {
        await configurationTester.testExportConfiguration();
    } catch (error) {
        logger.error(`Error in export configuration test: ${error.message}`);
    }
};

window.testImportConfiguration = async function(fileInput) {
    try {
        await configurationTester.testImportConfiguration(fileInput);
    } catch (error) {
        logger.error(`Error in import configuration test: ${error.message}`);
    }
};

window.testDeleteConfiguration = function() {
    try {
        configurationTester.testDeleteConfiguration();
    } catch (error) {
        logger.error(`Error in delete configuration test: ${error.message}`);
    }
};

// ==============================================================================
// Sidebar Testing Functions  
// ==============================================================================

window.testOpenAllSidebars = function() {
    try {
        sidebarTester.testOpenAllSidebars();
    } catch (error) {
        logger.error(`Error in open all sidebars test: ${error.message}`);
    }
};

window.testCloseAllSidebars = function() {
    try {
        sidebarTester.testCloseAllSidebars();
    } catch (error) {
        logger.error(`Error in close all sidebars test: ${error.message}`);
    }
};

window.testSidebarStats = function() {
    try {
        sidebarTester.testSidebarStats();
    } catch (error) {
        logger.error(`Error in sidebar stats test: ${error.message}`);
    }
};

window.testSidebarAPI = function() {
    try {
        sidebarTester.testSidebarAPI();
    } catch (error) {
        logger.error(`Error in sidebar API test: ${error.message}`);
    }
};

// ==============================================================================
// Material Testing Functions
// ==============================================================================

window.testMaterialClone = function() {
    try {
        return materialTester.testMaterialClone();
    } catch (error) {
        logger.error(`Error in material clone test: ${error.message}`);
        return null;
    }
};

window.testMaterialIsolation = function() {
    try {
        return materialTester.testMaterialIsolation();
    } catch (error) {
        logger.error(`Error in material isolation test: ${error.message}`);
        return null;
    }
};

window.testComprehensiveMaterialIsolation = function() {
    try {
        return materialTester.testComprehensiveMaterialIsolation();
    } catch (error) {
        logger.error(`Error in comprehensive material test: ${error.message}`);
        return null;
    }
};

// ==============================================================================
// Expose modules globally for debugging and advanced usage
// ==============================================================================
window.testModules = {
    logger,
    uiManager,
    testCore,
    multiViewerTester,
    layoutTester,
    performanceTester,
    communicationTester,
    materialTester,
    configurationTester,
    sidebarTester
};

// Legacy global functions
window.log = log;
window.enableButton = enableButton;
window.disableButton = disableButton;

// ==============================================================================
// Auto-initialize when DOM is ready
// ==============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTestEnvironment);
} else {
    // DOM already loaded
    setTimeout(initializeTestEnvironment, 0);
}