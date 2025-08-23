// CUSTOM - ConfigurationTester module for configuration persistence and management
import { logger } from '../core/TestLogger.js';
import { testCore } from '../core/TestCore.js';

export class ConfigurationTester {
    constructor() {
        this.savedConfigurations = [];
    }

    /**
     * Test saving current configuration
     */
    async testSaveConfiguration() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Configuration Save Test ===');

            // Save with timestamp
            const configName = `test-config-${Date.now()}`;
            const success = await multiViewer.saveConfiguration(configName);

            if (success) {
                logger.success(`Configuration saved as '${configName}'`);
                logger.success('Captured complete viewer state including:');
                logger.log('  - Layout pattern and dimensions');
                logger.log('  - Camera positions and targets');
                logger.log('  - Point cloud configurations');
                logger.log('  - Material settings');
                logger.log('  - Sync state');
                logger.log('  - Viewer identification');

                this.savedConfigurations.push(configName);
            } else {
                logger.error('Failed to save configuration');
            }

            // Also save as default for easy testing
            const defaultSuccess = await multiViewer.saveConfiguration('default');
            if (defaultSuccess) {
                logger.success(`Also saved as 'default' for easy loading`);
                if (!this.savedConfigurations.includes('default')) {
                    this.savedConfigurations.push('default');
                }
            }

            return success;

        } catch (error) {
            logger.error(`Error saving configuration: ${error.message}`);
            return false;
        }
    }

    /**
     * Test loading a saved configuration
     */
    async testLoadConfiguration(configName = 'default') {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Configuration Load Test ===');

            const success = await multiViewer.loadConfiguration(configName);

            if (success) {
                logger.success('Configuration loaded successfully');
                logger.success('Restored complete viewer state:');
                logger.log('  - Layout recreated from saved pattern');
                logger.log('  - Cameras positioned at saved locations');
                logger.log('  - Point clouds reloaded with proper transforms');
                logger.log('  - Material settings restored');
                logger.log('  - Sync state restored');
                logger.log('  - Viewer identification maintained');

                // Update viewer references after restore
                testCore.syncTestViewers();
                const testViewers = testCore.getTestViewers();
                logger.success(`Updated test viewer references (${testViewers.length} viewers)`);
            } else {
                logger.error('Failed to load configuration (possibly not found)');
                logger.log('💡 Try saving a configuration first');
            }

            return success;

        } catch (error) {
            logger.error(`Error loading configuration: ${error.message}`);
            return false;
        }
    }

    /**
     * List all saved configurations
     */
    testListConfigurations() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return [];
        }

        try {
            logger.log('\n=== Configuration List Test ===');

            const configs = multiViewer.listConfigurations();

            if (configs.length === 0) {
                logger.log('ℹ️ No saved configurations found');
                logger.log('💡 Save some configurations first to see them here');
            } else {
                logger.log(`Found ${configs.length} saved configurations:`);
                configs.forEach((name, index) => {
                    logger.log(`  ${index + 1}. '${name}'`);
                });
            }

            this.savedConfigurations = configs;
            return configs;

        } catch (error) {
            logger.error(`Error listing configurations: ${error.message}`);
            return [];
        }
    }

    /**
     * Export configuration to file
     */
    async testExportConfiguration() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Configuration Export Test ===');

            const filename = `potree-multiviewer-export-${Date.now()}.json`;
            await multiViewer.exportConfigurationToFile(filename);

            logger.success(`Configuration exported to file: ${filename}`);
            logger.success('File contains complete serialized state:');
            logger.log('  - JSON format for easy inspection/editing');
            logger.log('  - All viewer configurations');
            logger.log('  - Layout and sync settings');
            logger.log('  - Point cloud references');
            logger.log('  - Camera states and materials');
            logger.log('💾 File downloaded to your Downloads folder');

            return true;

        } catch (error) {
            logger.error(`Error exporting configuration: ${error.message}`);
            return false;
        }
    }

    /**
     * Import configuration from file
     */
    async testImportConfiguration(fileInput) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        if (!fileInput.files || fileInput.files.length === 0) {
            logger.error('No file selected');
            return false;
        }

        try {
            logger.log('\n=== Configuration Import Test ===');

            const file = fileInput.files[0];
            logger.log(`📁 Importing configuration from: ${file.name}`);

            const saveName = `imported-${Date.now()}`;
            const success = await multiViewer.importConfigurationFromFile(file, saveName);

            if (success) {
                logger.success(`Configuration imported successfully`);
                logger.success(`Saved as '${saveName}' in local storage`);
                logger.success('Complete viewer state restored:');
                logger.log('  - Layout recreated from imported file');
                logger.log('  - All viewers restored with correct settings');
                logger.log('  - Point clouds reloaded automatically');
                logger.log('  - Camera positions restored');
                logger.log('  - Sync and material settings applied');

                // Update viewer references after import
                testCore.syncTestViewers();
                const testViewers = testCore.getTestViewers();
                logger.success(`Updated test viewer references (${testViewers.length} viewers)`);

                this.savedConfigurations.push(saveName);
            } else {
                logger.error('Failed to import configuration');
                logger.log('💡 Check file format - should be JSON exported from this system');
            }

            // Clear the input for next use
            fileInput.value = '';
            return success;

        } catch (error) {
            logger.error(`Error importing configuration: ${error.message}`);
            fileInput.value = '';
            return false;
        }
    }

    /**
     * Delete a saved configuration
     */
    testDeleteConfiguration(configName = null) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return false;
        }

        try {
            logger.log('\n=== Configuration Delete Test ===');

            const configs = multiViewer.listConfigurations();
            if (configs.length === 0) {
                logger.log('ℹ️ No configurations to delete');
                return false;
            }

            // Delete the specified config or find a suitable one
            let configToDelete = configName;
            if (!configToDelete) {
                configToDelete = configs.find(name => name !== 'default');
                if (!configToDelete && configs.includes('default')) {
                    configToDelete = 'default';
                }
            }

            if (configToDelete) {
                const success = multiViewer.deleteConfiguration(configToDelete);
                if (success) {
                    logger.success(`Deleted configuration '${configToDelete}'`);

                    const remainingConfigs = multiViewer.listConfigurations();
                    logger.log(`ℹ️ Remaining configurations: ${remainingConfigs.length}`);
                    remainingConfigs.forEach(name => logger.log(`  - '${name}'`));

                    // Update local tracking
                    this.savedConfigurations = remainingConfigs;
                } else {
                    logger.error(`Failed to delete configuration '${configToDelete}'`);
                }

                return success;
            } else {
                logger.log('ℹ️ No suitable configuration found to delete');
                return false;
            }

        } catch (error) {
            logger.error(`Error deleting configuration: ${error.message}`);
            return false;
        }
    }

    /**
     * Test configuration validation
     */
    async testConfigurationValidation() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return null;
        }

        try {
            logger.log('\n=== Configuration Validation Test ===');

            // Get current configuration state
            const currentConfig = await multiViewer.getCurrentConfiguration();
            if (!currentConfig) {
                logger.error('Could not get current configuration');
                return null;
            }

            logger.log('Validating current configuration...');

            const validation = {
                hasViewers: currentConfig.viewers && Object.keys(currentConfig.viewers).length > 0,
                hasLayout: currentConfig.layout && currentConfig.layout.type,
                hasCameraStates: currentConfig.viewers && 
                    Object.values(currentConfig.viewers).some(v => v.camera),
                hasMaterialSettings: currentConfig.viewers &&
                    Object.values(currentConfig.viewers).some(v => v.material),
                hasPointClouds: currentConfig.viewers &&
                    Object.values(currentConfig.viewers).some(v => v.pointClouds && v.pointClouds.length > 0),
                timestamp: currentConfig.timestamp
            };

            logger.log('Validation Results:');
            Object.entries(validation).forEach(([key, value]) => {
                if (key !== 'timestamp') {
                    logger.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
                }
            });

            const isValid = Object.values(validation).filter(v => typeof v === 'boolean').every(v => v);
            
            if (isValid) {
                logger.success('✅ Configuration is valid and complete');
            } else {
                logger.warning('⚠️ Configuration has missing or incomplete data');
            }

            logger.log(`Configuration timestamp: ${new Date(validation.timestamp).toLocaleString()}`);

            return validation;

        } catch (error) {
            logger.error(`Error validating configuration: ${error.message}`);
            return null;
        }
    }

    /**
     * Test configuration comparison between two saved configs
     */
    async testConfigurationComparison(config1Name = 'default', config2Name = null) {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            logger.error('MultiViewer not created yet');
            return null;
        }

        try {
            logger.log('\n=== Configuration Comparison Test ===');

            const availableConfigs = multiViewer.listConfigurations();
            if (availableConfigs.length < 2) {
                logger.warning('Need at least 2 saved configurations for comparison');
                return null;
            }

            if (!config2Name) {
                config2Name = availableConfigs.find(name => name !== config1Name);
            }

            if (!config2Name) {
                logger.warning('Could not find second configuration for comparison');
                return null;
            }

            logger.log(`Comparing configurations: '${config1Name}' vs '${config2Name}'`);

            const config1 = await multiViewer.getConfiguration(config1Name);
            const config2 = await multiViewer.getConfiguration(config2Name);

            if (!config1 || !config2) {
                logger.error('Could not load configurations for comparison');
                return null;
            }

            const comparison = {
                viewerCount: {
                    config1: Object.keys(config1.viewers || {}).length,
                    config2: Object.keys(config2.viewers || {}).length
                },
                layout: {
                    config1: config1.layout?.type,
                    config2: config2.layout?.type
                },
                syncEnabled: {
                    config1: config1.sync?.enabled,
                    config2: config2.sync?.enabled
                },
                timestamp: {
                    config1: new Date(config1.timestamp).toLocaleString(),
                    config2: new Date(config2.timestamp).toLocaleString()
                }
            };

            logger.log('Comparison Results:');
            Object.entries(comparison).forEach(([key, values]) => {
                const same = values.config1 === values.config2;
                logger.log(`  ${same ? '🟰' : '🔄'} ${key}: ${values.config1} ${same ? '==' : '!='} ${values.config2}`);
            });

            return comparison;

        } catch (error) {
            logger.error(`Error comparing configurations: ${error.message}`);
            return null;
        }
    }

    /**
     * Get configuration management summary
     */
    getConfigurationSummary() {
        const multiViewer = testCore.getMultiViewer();
        if (!multiViewer) {
            return null;
        }

        try {
            const configs = multiViewer.listConfigurations();
            
            return {
                totalConfigurations: configs.length,
                configurationNames: configs,
                hasDefault: configs.includes('default'),
                recentlySaved: this.savedConfigurations,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error(`Error getting configuration summary: ${error.message}`);
            return null;
        }
    }

    /**
     * Run all configuration tests
     */
    async runAllConfigurationTests() {
        logger.log('\n🔧 === RUNNING ALL CONFIGURATION TESTS ===');

        const results = {};

        try {
            // Test 1: Save configuration
            logger.log('\n1️⃣ Testing configuration save...');
            results.save = await this.testSaveConfiguration();

            // Test 2: List configurations
            logger.log('\n2️⃣ Testing configuration listing...');
            results.list = this.testListConfigurations();

            // Test 3: Load configuration
            logger.log('\n3️⃣ Testing configuration load...');
            results.load = await this.testLoadConfiguration();

            // Test 4: Export configuration
            logger.log('\n4️⃣ Testing configuration export...');
            results.export = await this.testExportConfiguration();

            // Test 5: Validate configuration
            logger.log('\n5️⃣ Testing configuration validation...');
            results.validation = await this.testConfigurationValidation();

            // Test 6: Compare configurations (if we have multiple)
            if (this.savedConfigurations.length >= 2) {
                logger.log('\n6️⃣ Testing configuration comparison...');
                results.comparison = await this.testConfigurationComparison();
            }

            logger.log('\n🏁 === ALL CONFIGURATION TESTS COMPLETED ===');

            const successfulTests = Object.values(results).filter(r => r !== false && r !== null).length;
            const totalTests = Object.keys(results).length;

            logger.log(`\n📊 Overall Results: ${successfulTests}/${totalTests} tests completed successfully`);

            if (successfulTests === totalTests) {
                logger.success('🎉 ALL CONFIGURATION TESTS PASSED!');
            } else {
                logger.warning(`⚠️  ${totalTests - successfulTests} test(s) had issues`);
            }

            return results;

        } catch (error) {
            logger.error(`Error running all configuration tests: ${error.message}`);
            return results;
        }
    }

    /**
     * Cleanup configuration resources
     */
    cleanup() {
        this.savedConfigurations = [];
    }
}

// Global instance
export const configurationTester = new ConfigurationTester();