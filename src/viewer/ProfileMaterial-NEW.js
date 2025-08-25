/**
 * ProfileMaterial-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for enhanced profile material management
 * 
 * Extends PointCloudMaterial with profile-specific behavior to handle:
 * - Point size preservation from source materials
 * - Material synchronization in multi-viewer environments
 * - Profile-specific rendering optimizations
 * - Proper cleanup and disposal
 */

import { PointCloudMaterial } from "../materials/PointCloudMaterial.js";
import { PointSizeType } from "../defines.js";

export class ProfileMaterial extends PointCloudMaterial {
    
    constructor(sourceMaterial = null) {
        super();
        
        // Profile-specific properties
        this.isProfileMaterial = true;
        this.sourceMaterial = sourceMaterial;
        this.originalSize = null;
        this.preserveOriginalSize = true;
        
        // Initialize from source material if provided
        if (sourceMaterial) {
            this.initializeFromSource(sourceMaterial);
        }
        
        // Set profile-specific defaults
        this.pointSizeType = PointSizeType.FIXED;
    }
    
    /**
     * Initialize material properties from source material
     * @param {PointCloudMaterial} sourceMaterial - Source material to copy from
     */
    initializeFromSource(sourceMaterial) {
        this.sourceMaterial = sourceMaterial;
        
        // Store original size before any modifications
        this.originalSize = sourceMaterial.size || sourceMaterial.uniforms.size.value || 0.2;
        
        // Copy material properties using enhanced copy function
        this.copyFromSource(sourceMaterial, this.preserveOriginalSize);
        
        console.log(`[ProfileMaterial] Initialized from source - original size: ${this.originalSize}`);
    }
    
    /**
     * Enhanced material copying with size preservation
     * @param {PointCloudMaterial} source - Source material
     * @param {boolean} preserveSize - Whether to preserve original size
     */
    copyFromSource(source, preserveSize = true) {
        // Store size before copying uniforms
        const sizeToPreserve = preserveSize ? this.originalSize || source.size || source.uniforms.size.value || 0.2 : null;
        
        // Copy all uniforms
        for (let name of Object.keys(this.uniforms)) {
            if (source.uniforms[name] !== undefined) {
                this.uniforms[name].value = source.uniforms[name].value;
            }
        }
        
        // Copy textures
        this.gradientTexture = source.gradientTexture;
        this.visibleNodesTexture = source.visibleNodesTexture;
        this.classificationTexture = source.classificationTexture;
        this.matcapTexture = source.matcapTexture;
        
        // Copy attributes and ranges
        this.activeAttributeName = source.activeAttributeName;
        this.ranges = source.ranges;
        
        // Restore or set appropriate size
        if (preserveSize && sizeToPreserve !== null) {
            this.size = sizeToPreserve;
            console.log(`[ProfileMaterial] Preserved size: ${sizeToPreserve}`);
        } else if (!preserveSize) {
            // Use source size for synchronization scenarios
            this.size = source.size || source.uniforms.size.value || 0.2;
            console.log(`[ProfileMaterial] Using source size: ${this.size}`);
        }
    }
    
    /**
     * Sync with source material while preserving profile-specific properties
     */
    syncWithSource() {
        if (!this.sourceMaterial) {
            console.warn('[ProfileMaterial] No source material to sync with');
            return;
        }
        
        this.copyFromSource(this.sourceMaterial, this.preserveOriginalSize);
    }
    
    /**
     * Update source material reference
     * @param {PointCloudMaterial} newSource - New source material
     */
    updateSource(newSource) {
        if (newSource && newSource !== this.sourceMaterial) {
            this.sourceMaterial = newSource;
            this.syncWithSource();
            console.log('[ProfileMaterial] Updated source material reference');
        }
    }
    
    /**
     * Set point size with optional preservation mode
     * @param {number} size - New point size
     * @param {boolean} updateOriginal - Whether to update the stored original size
     */
    setSize(size, updateOriginal = false) {
        this.size = size;
        
        if (updateOriginal) {
            this.originalSize = size;
            console.log(`[ProfileMaterial] Updated original size to: ${size}`);
        }
    }
    
    /**
     * Reset to original size
     */
    resetToOriginalSize() {
        if (this.originalSize !== null) {
            this.size = this.originalSize;
            console.log(`[ProfileMaterial] Reset to original size: ${this.originalSize}`);
        } else {
            console.warn('[ProfileMaterial] No original size stored');
        }
    }
    
    /**
     * Enable/disable size preservation
     * @param {boolean} preserve - Whether to preserve original size
     */
    setSizePreservation(preserve) {
        this.preserveOriginalSize = preserve;
        console.log(`[ProfileMaterial] Size preservation: ${preserve}`);
    }
    
    /**
     * Get current material state for debugging
     */
    getDebugInfo() {
        return {
            isProfileMaterial: this.isProfileMaterial,
            currentSize: this.size,
            originalSize: this.originalSize,
            preserveOriginalSize: this.preserveOriginalSize,
            hasSourceMaterial: !!this.sourceMaterial,
            activeAttributeName: this.activeAttributeName,
            pointSizeType: this.pointSizeType
        };
    }
    
    /**
     * Enhanced dispose with profile-specific cleanup
     */
    dispose() {
        // Clean up profile-specific references
        this.sourceMaterial = null;
        this.originalSize = null;
        
        // Call parent dispose
        super.dispose();
        
        console.log('[ProfileMaterial] Disposed profile material');
    }
    
    /**
     * Test the ProfileMaterial functionality
     */
    static runTests() {
        console.log('=== ProfileMaterial Tests ===');
        
        const tests = [];
        const addTest = (name, condition, details) => {
            const result = condition ? '✓ PASS' : '✗ FAIL';
            console.log(`${result}: ${name} ${details ? `(${details})` : ''}`);
            tests.push({ name, passed: condition, details });
        };
        
        try {
            // Test 1: Basic creation
            const profileMaterial = new ProfileMaterial();
            addTest('ProfileMaterial creation', profileMaterial instanceof ProfileMaterial);
            addTest('Profile flag set', profileMaterial.isProfileMaterial === true);
            
            // Test 2: Source material initialization
            const sourceMaterial = new PointCloudMaterial();
            sourceMaterial.size = 1.5;
            sourceMaterial.activeAttributeName = 'intensity';
            
            const profileWithSource = new ProfileMaterial(sourceMaterial);
            addTest('Source material initialization', profileWithSource.sourceMaterial === sourceMaterial);
            addTest('Original size stored', profileWithSource.originalSize === 1.5, `Original: ${profileWithSource.originalSize}`);
            addTest('Size preserved', profileWithSource.size === 1.5, `Size: ${profileWithSource.size}`);
            
            // Test 3: Size preservation during sync
            sourceMaterial.size = 3.0; // Change source size
            profileWithSource.syncWithSource();
            addTest('Size preservation during sync', profileWithSource.size === 1.5, `Size after sync: ${profileWithSource.size}`);
            
            // Test 4: Size preservation toggle
            profileWithSource.setSizePreservation(false);
            profileWithSource.syncWithSource();
            addTest('Size sync when preservation disabled', profileWithSource.size === 3.0, `Size: ${profileWithSource.size}`);
            
            // Test 5: Reset to original
            profileWithSource.resetToOriginalSize();
            addTest('Reset to original size', profileWithSource.size === 1.5, `Size: ${profileWithSource.size}`);
            
            // Clean up
            profileMaterial.dispose();
            profileWithSource.dispose();
            sourceMaterial.dispose();
            
        } catch (error) {
            console.error('ProfileMaterial test failed:', error);
            addTest('Test execution', false, error.message);
        }
        
        const passed = tests.filter(t => t.passed).length;
        const total = tests.length;
        console.log(`=== ProfileMaterial Tests Complete: ${passed}/${total} passed ===`);
        
        return { passed, total, tests };
    }
}