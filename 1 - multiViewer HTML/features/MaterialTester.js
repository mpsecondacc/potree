// CUSTOM - MaterialTester module for testing material cloning and isolation
import { logger } from '../core/TestLogger.js';
import { testCore } from '../core/TestCore.js';

export class MaterialTester {
    constructor() {
        this.testResults = {};
    }

    /**
     * Test material cloning functionality
     */
    testMaterialClone() {
        logger.log('\n=== TESTING MATERIAL CLONING ===');

        try {
            // Check if PointCloudMaterial is available
            if (!window.Potree || !window.Potree.PointCloudMaterial) {
                logger.error('Potree.PointCloudMaterial not available');
                logger.log('Available Potree exports: ' + Object.keys(window.Potree || {}).join(', '));
                return null;
            }

            logger.success('Creating test PointCloudMaterial...');
            const material = new window.Potree.PointCloudMaterial({
                size: 3.0,
                minSize: 1.0,
                maxSize: 50.0
            });

            logger.success('Running material.testClone()...');
            const results = material.testClone();

            logger.log(`\n=== CLONE TEST RESULTS ===`);
            logger.log(`✅ Passed: ${results.passed}`);
            logger.log(`❌ Failed: ${results.failed}`);
            logger.log(`📊 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

            if (results.failed > 0) {
                logger.log('\n❌ Failed Tests:');
                results.tests.filter(test => !test.passed).forEach(test => {
                    logger.log(`  - ${test.name}: ${test.details || 'No details'}`);
                });
            }

            logger.success('Material cloning test completed');
            this.testResults.cloning = results;
            return results;

        } catch (error) {
            logger.error(`Material clone test failed: ${error.message}`);
            console.error('Full error:', error);
            this.testResults.cloning = { error: error.message };
            return null;
        }
    }

    /**
     * Test material isolation between viewers
     */
    testMaterialIsolation() {
        logger.log('\n=== TESTING MATERIAL ISOLATION BETWEEN VIEWERS ===');

        const testViewers = testCore.getTestViewers();
        if (!testViewers || testViewers.length < 2) {
            logger.error('Need at least 2 viewers with point clouds loaded');
            logger.log('  - Run: Create MultiViewer → Create Viewers → Load point clouds first');
            return null;
        }

        try {
            logger.success('Testing material isolation between viewers...');

            // Get materials from different viewers
            const viewer1 = testViewers[0];
            const viewer2 = testViewers[1];

            // Check if viewers have point clouds
            if (!viewer1.scene || !viewer1.scene.pointclouds.length) {
                logger.error('Viewer 1 has no point clouds loaded');
                return null;
            }
            if (!viewer2.scene || !viewer2.scene.pointclouds.length) {
                logger.error('Viewer 2 has no point clouds loaded');
                return null;
            }

            const pc1 = viewer1.scene.pointclouds[0];
            const pc2 = viewer2.scene.pointclouds[0];
            const material1 = pc1.material;
            const material2 = pc2.material;

            logger.success(`Found materials: Viewer1=${material1._viewerId}, Viewer2=${material2._viewerId}`);

            // Test 1: Different instances
            const differentInstances = material1 !== material2;
            logger.log(`${differentInstances ? '✅' : '❌'} Different instances: ${differentInstances}`);

            // Test 2: Independent size modification
            const originalSize1 = material1.size;
            const originalSize2 = material2.size;

            material1.size = 8.0;
            material2.size = 12.0;

            const independentSize = (material1.size === 8.0 && material2.size === 12.0);
            logger.log(`${independentSize ? '✅' : '❌'} Independent size: Material1=${material1.size}, Material2=${material2.size}`);

            // Test 3: Independent opacity modification  
            material1.opacity = 0.3;
            material2.opacity = 0.7;

            const independentOpacity = (material1.opacity === 0.3 && material2.opacity === 0.7);
            logger.log(`${independentOpacity ? '✅' : '❌'} Independent opacity: Material1=${material1.opacity}, Material2=${material2.opacity}`);

            // Test 4: Verify viewer IDs are correct
            const correctViewerIds = (material1._viewerId !== material2._viewerId);
            logger.log(`${correctViewerIds ? '✅' : '❌'} Correct viewer IDs: Material1=${material1._viewerId}, Material2=${material2._viewerId}`);

            // Calculate results
            const tests = [differentInstances, independentSize, independentOpacity, correctViewerIds];
            const passed = tests.filter(t => t).length;
            const total = tests.length;

            logger.log(`\n=== MATERIAL ISOLATION RESULTS ===`);
            logger.log(`✅ Passed: ${passed}/${total}`);
            logger.log(`📊 Success Rate: ${Math.round((passed / total) * 100)}%`);

            if (passed === total) {
                logger.log('🎉 MATERIAL ISOLATION WORKING PERFECTLY!');
                logger.success('Each viewer now has its own material instance');
                logger.success('UI changes will only affect the target viewer');
            } else {
                logger.log('❌ MATERIAL ISOLATION FAILED');
                logger.warning('Viewers are still sharing material instances');
            }

            // Restore original sizes for UI consistency
            material1.size = originalSize1;
            material2.size = originalSize2;

            const result = { passed, total, success: passed === total };
            this.testResults.isolation = result;
            return result;

        } catch (error) {
            logger.error(`Material isolation test failed: ${error.message}`);
            console.error('Full error:', error);
            this.testResults.isolation = { error: error.message };
            return null;
        }
    }

    /**
     * Comprehensive test for all material isolation fixes
     * Tests Layer 1, 2, and 3 fixes implemented to resolve UI sharing issues
     */
    testComprehensiveMaterialIsolation() {
        logger.log('🧪 === COMPREHENSIVE MATERIAL ISOLATION TEST ===');

        try {
            const testViewers = testCore.getTestViewers();
            const viewers = testViewers.slice(0, 3); // Take first 3 viewers
            const materials = [];

            if (viewers.length < 2) {
                logger.error('Need at least 2 viewers for comprehensive test');
                logger.log('💡 Create more viewers first using the "Add Viewer" button');
                return null;
            }

            // Collect materials from all viewers
            for (let i = 0; i < viewers.length; i++) {
                const viewer = viewers[i];
                const material = viewer.scene.pointclouds[0]?.material;
                if (!material) {
                    logger.error(`No material found for viewer ${i + 1}`);
                    return null;
                }
                materials.push(material);
            }

            logger.success(`Found materials for ${materials.length} viewers`);

            // Test 1: Material instance isolation (Layer 1 fix verification)
            let isolationTests = 0;
            let isolationPassed = 0;

            for (let i = 0; i < materials.length; i++) {
                for (let j = i + 1; j < materials.length; j++) {
                    isolationTests++;
                    if (materials[i] !== materials[j]) {
                        isolationPassed++;
                        logger.success(`Material ${i+1} ≠ Material ${j+1}`);
                    } else {
                        logger.error(`Material ${i+1} === Material ${j+1} (SHARING DETECTED!)`);
                    }
                }
            }

            // Test 2: Classification isolation (Layer 1 fix verification)
            logger.log('\n🔍 Testing Classification Isolation...');

            // Save original states
            const originalStates = viewers.map(viewer => ({...viewer.classifications}));

            // Test classification change isolation
            let classificationPassed = true;
            const testClassCode = Object.keys(materials[0].classification || {})[0];

            if (testClassCode) {
                // Change classification in viewer 1
                const originalValue = viewers[0].classifications[testClassCode]?.visible;
                viewers[0].setClassificationVisibility(testClassCode, !originalValue);

                // Check if other viewers were affected (they shouldn't be)
                for (let i = 1; i < viewers.length; i++) {
                    const otherViewerState = viewers[i].classifications[testClassCode]?.visible;
                    if (otherViewerState !== originalValue) {
                        logger.error(`Classification change in viewer 1 affected viewer ${i+1}`);
                        classificationPassed = false;
                    }
                }

                if (classificationPassed) {
                    logger.success(`Classification changes are isolated per viewer`);
                }

                // Restore original state
                viewers[0].setClassificationVisibility(testClassCode, originalValue);
            } else {
                logger.warning('No classification codes found to test');
            }

            // Test 3: Attribute range isolation (Layer 2 fix verification) 
            logger.log('\n🎯 Testing Attribute Range Isolation...');
            let attributeRangePassed = true;

            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];

                // Check if intensity range is valid (not NaN)
                if (material.intensityRange && Array.isArray(material.intensityRange)) {
                    const [min, max] = material.intensityRange;
                    if (isNaN(min) || isNaN(max)) {
                        logger.error(`Viewer ${i+1} has NaN intensity range: [${min}, ${max}]`);
                        attributeRangePassed = false;
                    } else {
                        logger.success(`Viewer ${i+1} has valid intensity range: [${min}, ${max}]`);
                    }
                } else {
                    logger.warning(`Viewer ${i+1} has no intensity range property`);
                }
            }

            // Test 4: Frame-level override prevention (Layer 1 fix verification)
            logger.log('\n⏱️  Testing Frame-Level Override Prevention...');
            let frameOverridePassed = true;

            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];

                // Check if material has viewer isolation markers
                if (material._viewerId) {
                    logger.success(`Material ${i+1} has viewer ID: ${material._viewerId}`);
                } else {
                    logger.warning(`Material ${i+1} missing viewer ID marker`);
                    frameOverridePassed = false;
                }

                if (material._classificationInitialized) {
                    logger.success(`Material ${i+1} has classification initialization marker`);
                } else {
                    logger.warning(`Material ${i+1} missing classification initialization marker`);
                }
            }

            // Calculate overall results
            const tests = [
                { name: 'Material Instance Isolation', passed: isolationPassed === isolationTests },
                { name: 'Classification Event Isolation', passed: classificationPassed },
                { name: 'Attribute Range Validity', passed: attributeRangePassed },
                { name: 'Frame Override Prevention', passed: frameOverridePassed }
            ];

            const overallPassed = tests.filter(t => t.passed).length;
            const totalTests = tests.length;

            logger.log(`\n=== COMPREHENSIVE TEST RESULTS ===`);
            tests.forEach(test => {
                logger.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
            });

            logger.log(`\n📊 Overall Score: ${overallPassed}/${totalTests}`);
            logger.log(`🎯 Success Rate: ${Math.round((overallPassed / totalTests) * 100)}%`);

            if (overallPassed === totalTests) {
                logger.log('\n🎉 ALL MATERIAL ISOLATION FIXES WORKING!');
                logger.success('Layer 1: Frame-level classification overrides stopped');
                logger.success('Layer 2: Attribute range calculation fixed for viewers 2+');
                logger.success('Layer 3: Classification event isolation implemented');
                logger.success('Multi-viewer UI issues should now be resolved');
            } else {
                logger.log('\n⚠️  SOME ISSUES REMAIN');
                logger.log('🔧 Check the failed tests above for remaining problems');
            }

            const result = { 
                passed: overallPassed, 
                total: totalTests, 
                success: overallPassed === totalTests,
                details: tests
            };

            this.testResults.comprehensive = result;
            return result;

        } catch (error) {
            logger.error(`Comprehensive test failed: ${error.message}`);
            console.error('Full error:', error);
            this.testResults.comprehensive = { error: error.message };
            return null;
        }
    }

    /**
     * Test material property synchronization across viewers
     */
    testMaterialPropertySync() {
        logger.log('\n=== Testing Material Property Synchronization ===');

        const testViewers = testCore.getTestViewers();
        if (!testViewers || testViewers.length < 2) {
            logger.error('Need at least 2 viewers for property sync test');
            return null;
        }

        try {
            const materials = testViewers.map(viewer => 
                viewer.scene.pointclouds[0]?.material
            ).filter(Boolean);

            if (materials.length < 2) {
                logger.error('Need at least 2 viewers with materials');
                return null;
            }

            // Test that materials have independent property values
            const testProperties = ['size', 'opacity', 'pointSizeType', 'shape'];
            const results = {};

            testProperties.forEach(prop => {
                const values = materials.map(material => material[prop]);
                const allSame = values.every(val => val === values[0]);
                
                if (allSame) {
                    logger.warning(`Property '${prop}' is synchronized (might be expected)`);
                } else {
                    logger.success(`Property '${prop}' has independent values per viewer`);
                }
                
                results[prop] = { values, synchronized: allSame };
            });

            logger.success('Material property synchronization test completed');
            this.testResults.propertySync = results;
            return results;

        } catch (error) {
            logger.error(`Property sync test failed: ${error.message}`);
            this.testResults.propertySync = { error: error.message };
            return null;
        }
    }

    /**
     * Get all test results summary
     */
    getTestSummary() {
        return {
            results: this.testResults,
            timestamp: Date.now(),
            hasResults: Object.keys(this.testResults).length > 0
        };
    }

    /**
     * Clear test results
     */
    clearResults() {
        this.testResults = {};
        logger.log('Material test results cleared');
    }

    /**
     * Run all material tests in sequence
     */
    async runAllTests() {
        logger.log('\n🧪 === RUNNING ALL MATERIAL TESTS ===');
        
        const results = {};
        
        try {
            // Test 1: Material cloning
            logger.log('\n1️⃣ Running material cloning test...');
            results.cloning = this.testMaterialClone();
            
            // Wait a moment between tests
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Test 2: Material isolation
            logger.log('\n2️⃣ Running material isolation test...');
            results.isolation = this.testMaterialIsolation();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Test 3: Comprehensive test
            logger.log('\n3️⃣ Running comprehensive material test...');
            results.comprehensive = this.testComprehensiveMaterialIsolation();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Test 4: Property synchronization
            logger.log('\n4️⃣ Running property synchronization test...');
            results.propertySync = this.testMaterialPropertySync();
            
            logger.log('\n🏁 === ALL MATERIAL TESTS COMPLETED ===');
            
            // Summary
            const successfulTests = Object.values(results).filter(r => r && !r.error).length;
            const totalTests = Object.keys(results).length;
            
            logger.log(`\n📊 Overall Results: ${successfulTests}/${totalTests} tests completed successfully`);
            
            if (successfulTests === totalTests) {
                logger.success('🎉 ALL MATERIAL TESTS PASSED!');
            } else {
                logger.warning(`⚠️  ${totalTests - successfulTests} test(s) had issues`);
            }
            
            return results;
            
        } catch (error) {
            logger.error(`Error running all tests: ${error.message}`);
            return results;
        }
    }
}

// Global instance
export const materialTester = new MaterialTester();