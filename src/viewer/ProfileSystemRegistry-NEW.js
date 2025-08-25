/**
 * ProfileSystemRegistry-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for centralized profile system management
 * 
 * Manages profile materials, windows, and resources across single and multi-viewer environments:
 * - Profile material lifecycle management
 * - Viewer-specific profile isolation
 * - Material synchronization coordination
 * - Resource cleanup and disposal
 */

import { EventDispatcher } from "../EventDispatcher.js";
import { ProfileMaterial } from "./ProfileMaterial-NEW.js";

export class ProfileSystemRegistry extends EventDispatcher {
    
    constructor() {
        super();
        
        // Registry maps
        this.viewerProfiles = new Map(); // viewerId -> Map(profileId -> ProfileData)
        this.profileMaterials = new Map(); // profileId -> ProfileMaterial
        this.viewerMaterialMap = new Map(); // viewerId -> Map(pointCloudId -> ProfileMaterial)
        
        // System state
        this.globalSizePreservation = true;
        this.debugMode = false;
        
        // Performance tracking
        this.stats = {
            profilesCreated: 0,
            materialsCreated: 0,
            syncOperations: 0,
            disposalOperations: 0
        };
        
        console.log('[ProfileSystemRegistry] Initialized profile system registry');
    }
    
    /**
     * Register a profile for a specific viewer
     * @param {string} viewerId - Viewer ID
     * @param {Object} profile - Profile object
     * @param {PointCloudMaterial} sourceMaterial - Source material for profile
     * @returns {ProfileMaterial} Created profile material
     */
    registerProfile(viewerId, profile, sourceMaterial) {
        const profileId = profile.uuid || profile.id || `profile_${Date.now()}`;
        
        // Ensure viewer registry exists
        if (!this.viewerProfiles.has(viewerId)) {
            this.viewerProfiles.set(viewerId, new Map());
            this.viewerMaterialMap.set(viewerId, new Map());
        }
        
        // Create profile material
        const profileMaterial = new ProfileMaterial(sourceMaterial);
        profileMaterial.setSizePreservation(this.globalSizePreservation);
        
        // Register profile data
        const profileData = {
            id: profileId,
            profile: profile,
            material: profileMaterial,
            sourceMaterial: sourceMaterial,
            viewerId: viewerId,
            createdAt: Date.now(),
            lastSync: null
        };
        
        this.viewerProfiles.get(viewerId).set(profileId, profileData);
        this.profileMaterials.set(profileId, profileMaterial);
        this.viewerMaterialMap.get(viewerId).set(sourceMaterial.uuid || 'default', profileMaterial);
        
        // Update stats
        this.stats.profilesCreated++;
        this.stats.materialsCreated++;
        
        // Dispatch event
        this.dispatchEvent({
            type: 'profile_registered',
            viewerId: viewerId,
            profileId: profileId,
            profile: profile,
            material: profileMaterial
        });
        
        if (this.debugMode) {
            console.log(`[ProfileSystemRegistry] Registered profile '${profileId}' for viewer '${viewerId}' with size: ${profileMaterial.size}`);
        }
        
        return profileMaterial;
    }
    
    /**
     * Unregister a profile and clean up resources
     * @param {string} viewerId - Viewer ID
     * @param {string} profileId - Profile ID
     */
    unregisterProfile(viewerId, profileId) {
        const viewerProfiles = this.viewerProfiles.get(viewerId);
        if (!viewerProfiles || !viewerProfiles.has(profileId)) {
            console.warn(`[ProfileSystemRegistry] Profile '${profileId}' not found for viewer '${viewerId}'`);
            return false;
        }
        
        const profileData = viewerProfiles.get(profileId);
        
        // Clean up material
        if (profileData.material) {
            profileData.material.dispose();
        }
        
        // Remove from registries
        viewerProfiles.delete(profileId);
        this.profileMaterials.delete(profileId);
        
        // Remove from viewer material map
        const viewerMaterials = this.viewerMaterialMap.get(viewerId);
        if (viewerMaterials) {
            for (const [key, material] of viewerMaterials) {
                if (material === profileData.material) {
                    viewerMaterials.delete(key);
                    break;
                }
            }
        }
        
        // Update stats
        this.stats.disposalOperations++;
        
        // Dispatch event
        this.dispatchEvent({
            type: 'profile_unregistered',
            viewerId: viewerId,
            profileId: profileId
        });
        
        if (this.debugMode) {
            console.log(`[ProfileSystemRegistry] Unregistered profile '${profileId}' from viewer '${viewerId}'`);
        }
        
        return true;
    }
    
    /**
     * Get profile material for a specific profile and viewer
     * @param {string} viewerId - Viewer ID
     * @param {string} profileId - Profile ID
     * @returns {ProfileMaterial|null} Profile material or null if not found
     */
    getProfileMaterial(viewerId, profileId) {
        const viewerProfiles = this.viewerProfiles.get(viewerId);
        if (!viewerProfiles || !viewerProfiles.has(profileId)) {
            return null;
        }
        
        return viewerProfiles.get(profileId).material;
    }
    
    /**
     * Sync all profile materials for a viewer with their source materials
     * @param {string} viewerId - Viewer ID
     * @param {boolean} preserveSize - Whether to preserve original sizes
     */
    syncViewerProfiles(viewerId, preserveSize = null) {
        const viewerProfiles = this.viewerProfiles.get(viewerId);
        if (!viewerProfiles) {
            if (this.debugMode) {
                console.log(`[ProfileSystemRegistry] No profiles found for viewer '${viewerId}'`);
            }
            return;
        }
        
        const usePreservation = preserveSize !== null ? preserveSize : this.globalSizePreservation;
        let syncCount = 0;
        
        for (const [profileId, profileData] of viewerProfiles) {
            if (profileData.material && profileData.sourceMaterial) {
                // Update preservation setting if needed
                profileData.material.setSizePreservation(usePreservation);
                
                // Sync with source
                profileData.material.syncWithSource();
                profileData.lastSync = Date.now();
                syncCount++;
            }
        }
        
        this.stats.syncOperations += syncCount;
        
        if (this.debugMode) {
            console.log(`[ProfileSystemRegistry] Synced ${syncCount} profile materials for viewer '${viewerId}' (preservation: ${usePreservation})`);
        }
        
        // Dispatch event
        this.dispatchEvent({
            type: 'profiles_synced',
            viewerId: viewerId,
            syncCount: syncCount,
            preserveSize: usePreservation
        });
    }
    
    /**
     * Sync all profiles across all viewers
     * @param {boolean} preserveSize - Whether to preserve original sizes
     */
    syncAllProfiles(preserveSize = null) {
        const usePreservation = preserveSize !== null ? preserveSize : this.globalSizePreservation;
        
        for (const viewerId of this.viewerProfiles.keys()) {
            this.syncViewerProfiles(viewerId, usePreservation);
        }
        
        if (this.debugMode) {
            console.log(`[ProfileSystemRegistry] Synced all profiles with preservation: ${usePreservation}`);
        }
    }
    
    /**
     * Update source material for all profiles using it
     * @param {PointCloudMaterial} oldMaterial - Old source material
     * @param {PointCloudMaterial} newMaterial - New source material
     */
    updateSourceMaterial(oldMaterial, newMaterial) {
        let updateCount = 0;
        
        for (const [viewerId, profiles] of this.viewerProfiles) {
            for (const [profileId, profileData] of profiles) {
                if (profileData.sourceMaterial === oldMaterial) {
                    profileData.sourceMaterial = newMaterial;
                    profileData.material.updateSource(newMaterial);
                    updateCount++;
                }
            }
        }
        
        if (this.debugMode && updateCount > 0) {
            console.log(`[ProfileSystemRegistry] Updated source material for ${updateCount} profiles`);
        }
        
        return updateCount;
    }
    
    /**
     * Set global size preservation mode
     * @param {boolean} preserve - Whether to preserve sizes globally
     */
    setGlobalSizePreservation(preserve) {
        this.globalSizePreservation = preserve;
        
        // Update all existing profile materials
        for (const profileMaterial of this.profileMaterials.values()) {
            profileMaterial.setSizePreservation(preserve);
        }
        
        console.log(`[ProfileSystemRegistry] Set global size preservation: ${preserve}`);
        
        // Dispatch event
        this.dispatchEvent({
            type: 'size_preservation_changed',
            globalPreservation: preserve
        });
    }
    
    /**
     * Clean up all profiles for a specific viewer
     * @param {string} viewerId - Viewer ID
     */
    cleanupViewer(viewerId) {
        const viewerProfiles = this.viewerProfiles.get(viewerId);
        if (!viewerProfiles) {
            return 0;
        }
        
        let cleanupCount = 0;
        const profileIds = Array.from(viewerProfiles.keys());
        
        for (const profileId of profileIds) {
            if (this.unregisterProfile(viewerId, profileId)) {
                cleanupCount++;
            }
        }
        
        // Remove viewer from registries
        this.viewerProfiles.delete(viewerId);
        this.viewerMaterialMap.delete(viewerId);
        
        if (this.debugMode) {
            console.log(`[ProfileSystemRegistry] Cleaned up ${cleanupCount} profiles for viewer '${viewerId}'`);
        }
        
        return cleanupCount;
    }
    
    /**
     * Get system statistics
     */
    getStats() {
        return {
            ...this.stats,
            viewersWithProfiles: this.viewerProfiles.size,
            totalProfiles: this.profileMaterials.size,
            globalSizePreservation: this.globalSizePreservation,
            debugMode: this.debugMode
        };
    }
    
    /**
     * Get debug information for a viewer
     * @param {string} viewerId - Viewer ID
     */
    getViewerDebugInfo(viewerId) {
        const viewerProfiles = this.viewerProfiles.get(viewerId);
        if (!viewerProfiles) {
            return { viewerId, profileCount: 0, profiles: [] };
        }
        
        const profiles = [];
        for (const [profileId, profileData] of viewerProfiles) {
            profiles.push({
                id: profileId,
                createdAt: profileData.createdAt,
                lastSync: profileData.lastSync,
                materialDebugInfo: profileData.material.getDebugInfo()
            });
        }
        
        return {
            viewerId,
            profileCount: profiles.length,
            profiles,
            hasViewerMaterials: this.viewerMaterialMap.has(viewerId)
        };
    }
    
    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[ProfileSystemRegistry] Debug mode: ${enabled}`);
    }
    
    /**
     * Complete cleanup of all resources
     */
    dispose() {
        console.log('[ProfileSystemRegistry] Disposing all profile resources');
        
        // Clean up all profiles
        const viewerIds = Array.from(this.viewerProfiles.keys());
        for (const viewerId of viewerIds) {
            this.cleanupViewer(viewerId);
        }
        
        // Clear all registries
        this.viewerProfiles.clear();
        this.profileMaterials.clear();
        this.viewerMaterialMap.clear();
        
        console.log('[ProfileSystemRegistry] Profile system registry disposed');
    }
    
    /**
     * Test the ProfileSystemRegistry functionality
     */
    static runTests() {
        console.log('=== ProfileSystemRegistry Tests ===');
        
        const tests = [];
        const addTest = (name, condition, details) => {
            const result = condition ? '✓ PASS' : '✗ FAIL';
            console.log(`${result}: ${name} ${details ? `(${details})` : ''}`);
            tests.push({ name, passed: condition, details });
        };
        
        try {
            const registry = new ProfileSystemRegistry();
            registry.setDebugMode(false); // Keep tests quiet
            
            // Mock objects
            const mockProfile = { uuid: 'test-profile-1', name: 'Test Profile' };
            const mockMaterial = { size: 1.0, uuid: 'test-material-1', dispose: () => {} };
            
            // Test 1: Basic registration
            const profileMaterial = registry.registerProfile('viewer1', mockProfile, mockMaterial);
            addTest('Profile registration', profileMaterial instanceof ProfileMaterial);
            addTest('Profile material has correct size', profileMaterial.size === 1.0, `Size: ${profileMaterial.size}`);
            
            // Test 2: Retrieval
            const retrieved = registry.getProfileMaterial('viewer1', mockProfile.uuid);
            addTest('Profile retrieval', retrieved === profileMaterial);
            
            // Test 3: Stats
            const stats = registry.getStats();
            addTest('Stats tracking', stats.profilesCreated === 1 && stats.materialsCreated === 1);
            
            // Test 4: Sync operations
            registry.syncViewerProfiles('viewer1');
            const statsAfterSync = registry.getStats();
            addTest('Sync operations tracked', statsAfterSync.syncOperations === 1);
            
            // Test 5: Size preservation
            registry.setGlobalSizePreservation(false);
            const debugInfo = registry.getViewerDebugInfo('viewer1');
            addTest('Size preservation setting', debugInfo.profiles[0].materialDebugInfo.preserveOriginalSize === false);
            
            // Test 6: Cleanup
            const cleanupCount = registry.cleanupViewer('viewer1');
            addTest('Viewer cleanup', cleanupCount === 1);
            addTest('Profile removed after cleanup', registry.getProfileMaterial('viewer1', mockProfile.uuid) === null);
            
            // Dispose
            registry.dispose();
            
        } catch (error) {
            console.error('ProfileSystemRegistry test failed:', error);
            addTest('Test execution', false, error.message);
        }
        
        const passed = tests.filter(t => t.passed).length;
        const total = tests.length;
        console.log(`=== ProfileSystemRegistry Tests Complete: ${passed}/${total} passed ===`);
        
        return { passed, total, tests };
    }
}