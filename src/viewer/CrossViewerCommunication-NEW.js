/**
 * CrossViewerCommunication-NEW.js
 * 
 * CUSTOM IMPLEMENTATION - Created for cross-viewer communication and CAD features
 * 
 * Provides a unified communication system for multi-viewer applications with:
 * - Shared 3D geometry and annotations across all viewers
 * - Cross-viewer synchronization of drawing tools and measurements
 * - Event-driven messaging between viewers
 * - Shared canvas state management for CAD features
 * - Coordinate space transformation between different viewer perspectives
 * 
 * Designed specifically for CAD use cases where drawing in one viewport 
 * (e.g., profile view) needs to be visible in all other viewports in 3D space.
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../EventDispatcher.js";

export class CrossViewerCommunication extends EventDispatcher {
    
    constructor(viewerManager) {
        super();
        
        this.viewerManager = viewerManager;
        this.isEnabled = true;
        
        // Shared state management
        this.sharedState = {
            // Shared 3D geometry (lines, shapes, annotations)
            geometry: new Map(), // geometryId -> SharedGeometry
            annotations: new Map(), // annotationId -> SharedAnnotation
            measurements: new Map(), // measurementId -> SharedMeasurement
            
            // Drawing state
            activeTool: null,
            activeDrawingSession: null,
            
            // CAD-specific state
            layers: new Map(), // layerId -> Layer
            activeLayers: new Set(),
            
            // Metadata
            version: 1,
            lastModified: Date.now()
        };
        
        // Message queues and channels
        this.messageChannels = new Map(); // channelName -> Set<viewerId>
        this.messageQueue = [];
        this.messageHistory = [];
        
        // Coordinate transformation managers
        this.coordinateTransforms = new Map(); // viewerId -> TransformManager
        
        // Viewers registry for communication
        this.communicatingViewers = new Map(); // viewerId -> ViewerCommInfo
        
        this.initialize();
    }
    
    /**
     * Initialize the communication system
     */
    initialize() {
        this.setupViewerTracking();
        this.setupCoordinateTransforms();
        this.setupDefaultChannels();
        
        console.log('CrossViewerCommunication initialized');
    }
    
    /**
     * Setup viewer tracking for communication
     */
    setupViewerTracking() {
        // Listen for viewer events
        this.viewerManager.addEventListener('viewer_created', (event) => {
            this.registerViewerForCommunication(event.viewerId, event.viewer);
        });
        
        this.viewerManager.addEventListener('viewer_removed', (event) => {
            this.unregisterViewerFromCommunication(event.viewerId);
        });
    }
    
    /**
     * Setup coordinate transformation managers
     */
    setupCoordinateTransforms() {
        // Initialize coordinate system managers for each viewer type
        this.transformationStrategies = {
            'orthographic': this.createOrthographicTransform,
            'perspective': this.createPerspectiveTransform,
            'profile': this.createProfileTransform,
            'section': this.createSectionTransform
        };
    }
    
    /**
     * Setup default communication channels
     */
    setupDefaultChannels() {
        this.createChannel('geometry', 'Shared 3D geometry and shapes');
        this.createChannel('annotations', 'Text annotations and labels');
        this.createChannel('measurements', 'Distance and area measurements');
        this.createChannel('drawing', 'Active drawing tools and sessions');
        this.createChannel('cad', 'CAD-specific operations');
        this.createChannel('sync', 'Camera and view synchronization');
        this.createChannel('selection', 'Object selection events');
    }
    
    /**
     * Register a viewer for communication
     */
    registerViewerForCommunication(viewerId, viewer) {
        const commInfo = {
            viewerId: viewerId,
            viewer: viewer,
            subscribedChannels: new Set(['geometry', 'annotations', 'measurements']),
            coordinateTransform: null,
            sharedObjects: new Map(), // objectId -> THREE.Object3D
            localState: {},
            lastSync: Date.now()
        };
        
        this.communicatingViewers.set(viewerId, commInfo);
        
        // Setup coordinate transformation
        this.setupViewerCoordinateTransform(viewerId, viewer);
        
        // Setup shared geometry container
        this.setupSharedGeometryContainer(viewerId, viewer);
        
        // Subscribe to default channels
        this.subscribeViewerToChannel(viewerId, 'geometry');
        this.subscribeViewerToChannel(viewerId, 'annotations');
        this.subscribeViewerToChannel(viewerId, 'measurements');
        
        console.log(`CrossViewerCommunication: Registered viewer '${viewerId}' for communication`);
        
        this.dispatchEvent({
            type: 'viewer_registered',
            viewerId: viewerId,
            viewer: viewer
        });
    }
    
    /**
     * Unregister a viewer from communication
     */
    unregisterViewerFromCommunication(viewerId) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo) return;
        
        // Clean up shared objects in this viewer
        this.cleanupViewerSharedObjects(viewerId);
        
        // Remove from all channels
        commInfo.subscribedChannels.forEach(channel => {
            this.unsubscribeViewerFromChannel(viewerId, channel);
        });
        
        // Remove coordinate transform
        this.coordinateTransforms.delete(viewerId);
        
        // Remove from registry
        this.communicatingViewers.delete(viewerId);
        
        console.log(`CrossViewerCommunication: Unregistered viewer '${viewerId}' from communication`);
        
        this.dispatchEvent({
            type: 'viewer_unregistered',
            viewerId: viewerId
        });
    }
    
    /**
     * Setup coordinate transformation for a viewer
     */
    setupViewerCoordinateTransform(viewerId, viewer) {
        // Determine viewer type and setup appropriate transform
        const viewerType = this.detectViewerType(viewer);
        
        const transform = {
            type: viewerType,
            strategy: this.transformationStrategies[viewerType] || this.transformationStrategies['perspective'],
            worldToLocal: new THREE.Matrix4(),
            localToWorld: new THREE.Matrix4(),
            viewerCamera: viewer.scene ? viewer.scene.getActiveCamera() : null,
            lastUpdate: Date.now()
        };
        
        this.coordinateTransforms.set(viewerId, transform);
        
        // Update the transformation matrices
        this.updateCoordinateTransform(viewerId);
    }
    
    /**
     * Detect viewer type for coordinate transformation
     */
    detectViewerType(viewer) {
        // For now, default to perspective
        // In future, this could analyze camera type, view settings, etc.
        if (viewer.scene && viewer.scene.getActiveCamera()) {
            const camera = viewer.scene.getActiveCamera();
            if (camera.isOrthographicCamera) {
                return 'orthographic';
            }
        }
        return 'perspective';
    }
    
    /**
     * Setup shared geometry container for a viewer
     */
    setupSharedGeometryContainer(viewerId, viewer) {
        if (!viewer.scene || !viewer.scene.scene) {
            console.warn(`Cannot setup shared geometry for viewer '${viewerId}' - no scene available`);
            return;
        }
        
        // Create a container for shared objects in this viewer
        const sharedContainer = new THREE.Group();
        sharedContainer.name = `SharedGeometry_${viewerId}`;
        viewer.scene.scene.add(sharedContainer);
        
        // Store reference in communication info
        const commInfo = this.communicatingViewers.get(viewerId);
        if (commInfo) {
            commInfo.sharedContainer = sharedContainer;
        }
        
        console.log(`CrossViewerCommunication: Setup shared geometry container for viewer '${viewerId}'`);
    }
    
    /**
     * Create a communication channel
     */
    createChannel(channelName, description = '') {
        if (!this.messageChannels.has(channelName)) {
            this.messageChannels.set(channelName, new Set());
            console.log(`CrossViewerCommunication: Created channel '${channelName}' - ${description}`);
        }
    }
    
    /**
     * Subscribe a viewer to a communication channel
     */
    subscribeViewerToChannel(viewerId, channelName) {
        if (!this.messageChannels.has(channelName)) {
            this.createChannel(channelName);
        }
        
        this.messageChannels.get(channelName).add(viewerId);
        
        const commInfo = this.communicatingViewers.get(viewerId);
        if (commInfo) {
            commInfo.subscribedChannels.add(channelName);
        }
        
        console.log(`CrossViewerCommunication: Subscribed viewer '${viewerId}' to channel '${channelName}'`);
    }
    
    /**
     * Unsubscribe a viewer from a communication channel
     */
    unsubscribeViewerFromChannel(viewerId, channelName) {
        if (this.messageChannels.has(channelName)) {
            this.messageChannels.get(channelName).delete(viewerId);
        }
        
        const commInfo = this.communicatingViewers.get(viewerId);
        if (commInfo) {
            commInfo.subscribedChannels.delete(channelName);
        }
        
        console.log(`CrossViewerCommunication: Unsubscribed viewer '${viewerId}' from channel '${channelName}'`);
    }
    
    /**
     * Send a message to a specific channel
     */
    sendMessage(channelName, message, fromViewerId = null) {
        if (!this.isEnabled || !this.messageChannels.has(channelName)) {
            return false;
        }
        
        const channelViewers = this.messageChannels.get(channelName);
        const messageId = this.generateMessageId();
        
        const fullMessage = {
            id: messageId,
            channel: channelName,
            from: fromViewerId,
            timestamp: Date.now(),
            data: message
        };
        
        // Send to all viewers in channel (except sender)
        let deliveredCount = 0;
        channelViewers.forEach(viewerId => {
            if (viewerId !== fromViewerId) {
                if (this.deliverMessageToViewer(viewerId, fullMessage)) {
                    deliveredCount++;
                }
            }
        });
        
        // Store in history
        this.messageHistory.push(fullMessage);
        
        // Limit history size
        if (this.messageHistory.length > 1000) {
            this.messageHistory.shift();
        }
        
        this.dispatchEvent({
            type: 'message_sent',
            message: fullMessage,
            deliveredTo: deliveredCount
        });
        
        return deliveredCount > 0;
    }
    
    /**
     * Deliver message to specific viewer
     */
    deliverMessageToViewer(viewerId, message) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo) return false;
        
        // Process message based on type
        this.processMessage(viewerId, message);
        
        return true;
    }
    
    /**
     * Process incoming message
     */
    processMessage(viewerId, message) {
        const { channel, data } = message;
        
        switch (channel) {
            case 'geometry':
                this.processGeometryMessage(viewerId, data);
                break;
            case 'annotations':
                this.processAnnotationMessage(viewerId, data);
                break;
            case 'measurements':
                this.processMeasurementMessage(viewerId, data);
                break;
            case 'drawing':
                this.processDrawingMessage(viewerId, data);
                break;
            case 'cad':
                this.processCADMessage(viewerId, data);
                break;
            case 'sync':
                this.processSyncMessage(viewerId, data);
                break;
            case 'selection':
                this.processSelectionMessage(viewerId, data);
                break;
        }
    }
    
    /**
     * Add shared geometry (line, shape, etc.) to all viewers
     */
    addSharedGeometry(geometryData, fromViewerId = null) {
        const geometryId = geometryData.id || this.generateId('geometry');
        
        // Store in shared state
        const sharedGeometry = {
            id: geometryId,
            type: geometryData.type, // 'line', 'polyline', 'circle', 'rectangle', etc.
            coordinates: geometryData.coordinates, // World coordinates
            properties: geometryData.properties || {},
            style: geometryData.style || this.getDefaultStyle(geometryData.type),
            createdBy: fromViewerId,
            createdAt: Date.now(),
            version: 1
        };
        
        this.sharedState.geometry.set(geometryId, sharedGeometry);
        this.sharedState.lastModified = Date.now();
        
        // Send to all viewers
        this.sendMessage('geometry', {
            action: 'add',
            geometry: sharedGeometry
        }, fromViewerId);
        
        return geometryId;
    }
    
    /**
     * Update shared geometry
     */
    updateSharedGeometry(geometryId, updates, fromViewerId = null) {
        const geometry = this.sharedState.geometry.get(geometryId);
        if (!geometry) return false;
        
        // Apply updates
        Object.assign(geometry, updates);
        geometry.version++;
        geometry.lastModified = Date.now();
        
        this.sharedState.lastModified = Date.now();
        
        // Send update to all viewers
        this.sendMessage('geometry', {
            action: 'update',
            geometryId: geometryId,
            updates: updates,
            geometry: geometry
        }, fromViewerId);
        
        return true;
    }
    
    /**
     * Remove shared geometry
     */
    removeSharedGeometry(geometryId, fromViewerId = null) {
        if (!this.sharedState.geometry.has(geometryId)) return false;
        
        const geometry = this.sharedState.geometry.get(geometryId);
        this.sharedState.geometry.delete(geometryId);
        this.sharedState.lastModified = Date.now();
        
        // Send removal to all viewers
        this.sendMessage('geometry', {
            action: 'remove',
            geometryId: geometryId,
            geometry: geometry
        }, fromViewerId);
        
        return true;
    }
    
    /**
     * Process geometry message
     */
    processGeometryMessage(viewerId, data) {
        const { action, geometry, geometryId, updates } = data;
        const commInfo = this.communicatingViewers.get(viewerId);
        
        if (!commInfo || !commInfo.sharedContainer) return;
        
        switch (action) {
            case 'add':
                this.addGeometryToViewer(viewerId, geometry);
                break;
            case 'update':
                this.updateGeometryInViewer(viewerId, geometryId, updates);
                break;
            case 'remove':
                this.removeGeometryFromViewer(viewerId, geometryId);
                break;
        }
    }
    
    /**
     * Add geometry to a specific viewer
     */
    addGeometryToViewer(viewerId, geometryData) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo || !commInfo.sharedContainer) return;
        
        // Transform coordinates to viewer's coordinate system
        const localCoordinates = this.transformCoordinatesToViewer(
            viewerId, geometryData.coordinates
        );
        
        // Create THREE.js object based on geometry type
        const threeObject = this.createThreeGeometry(geometryData, localCoordinates);
        if (!threeObject) return;
        
        // Add to viewer's shared container
        threeObject.userData.sharedGeometryId = geometryData.id;
        threeObject.userData.geometryType = geometryData.type;
        
        commInfo.sharedContainer.add(threeObject);
        commInfo.sharedObjects.set(geometryData.id, threeObject);
        
        console.log(`Added shared geometry '${geometryData.id}' (${geometryData.type}) to viewer '${viewerId}'`);
    }
    
    /**
     * Update geometry in a specific viewer
     */
    updateGeometryInViewer(viewerId, geometryId, updates) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo) return;
        
        const threeObject = commInfo.sharedObjects.get(geometryId);
        if (!threeObject) return;
        
        // Apply updates to the THREE.js object
        this.applyGeometryUpdates(threeObject, updates, viewerId);
        
        console.log(`Updated shared geometry '${geometryId}' in viewer '${viewerId}'`);
    }
    
    /**
     * Remove geometry from a specific viewer
     */
    removeGeometryFromViewer(viewerId, geometryId) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo) return;
        
        const threeObject = commInfo.sharedObjects.get(geometryId);
        if (threeObject) {
            commInfo.sharedContainer.remove(threeObject);
            commInfo.sharedObjects.delete(geometryId);
            
            // Dispose of geometry and materials
            this.disposeThreeObject(threeObject);
            
            console.log(`Removed shared geometry '${geometryId}' from viewer '${viewerId}'`);
        }
    }
    
    /**
     * Create THREE.js geometry object
     */
    createThreeGeometry(geometryData, coordinates) {
        const { type, style } = geometryData;
        
        switch (type) {
            case 'line':
                return this.createLineGeometry(coordinates, style);
            case 'polyline':
                return this.createPolylineGeometry(coordinates, style);
            case 'circle':
                return this.createCircleGeometry(coordinates, style);
            case 'rectangle':
                return this.createRectangleGeometry(coordinates, style);
            case 'point':
                return this.createPointGeometry(coordinates, style);
            default:
                console.warn(`Unknown geometry type: ${type}`);
                return null;
        }
    }
    
    /**
     * Create line geometry
     */
    createLineGeometry(coordinates, style) {
        if (coordinates.length < 2) return null;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(coordinates.length * 3);
        
        coordinates.forEach((coord, i) => {
            positions[i * 3] = coord.x || coord[0] || 0;
            positions[i * 3 + 1] = coord.y || coord[1] || 0;
            positions[i * 3 + 2] = coord.z || coord[2] || 0;
        });
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: style.color || 0xff0000,
            linewidth: style.lineWidth || 1,
            transparent: style.opacity < 1,
            opacity: style.opacity || 1
        });
        
        return new THREE.Line(geometry, material);
    }
    
    /**
     * Create polyline geometry
     */
    createPolylineGeometry(coordinates, style) {
        return this.createLineGeometry(coordinates, style);
    }
    
    /**
     * Create point geometry
     */
    createPointGeometry(coordinates, style) {
        if (coordinates.length < 1) return null;
        
        const coord = coordinates[0];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            coord.x || coord[0] || 0,
            coord.y || coord[1] || 0,
            coord.z || coord[2] || 0
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: style.color || 0xff0000,
            size: style.size || 5,
            transparent: style.opacity < 1,
            opacity: style.opacity || 1
        });
        
        return new THREE.Points(geometry, material);
    }
    
    /**
     * Transform coordinates to viewer's coordinate system
     */
    transformCoordinatesToViewer(viewerId, worldCoordinates) {
        const transform = this.coordinateTransforms.get(viewerId);
        if (!transform) return worldCoordinates;
        
        // For now, return world coordinates (no transformation)
        // In the future, this would apply viewer-specific coordinate transformations
        return worldCoordinates;
    }
    
    /**
     * Update coordinate transformation for a viewer
     */
    updateCoordinateTransform(viewerId) {
        const transform = this.coordinateTransforms.get(viewerId);
        const commInfo = this.communicatingViewers.get(viewerId);
        
        if (!transform || !commInfo) return;
        
        // Update transformation matrices based on viewer's camera
        if (commInfo.viewer.scene && commInfo.viewer.scene.getActiveCamera()) {
            const camera = commInfo.viewer.scene.getActiveCamera();
            
            // Update matrices
            transform.worldToLocal.copy(camera.matrixWorldInverse);
            transform.localToWorld.copy(camera.matrixWorld);
            transform.lastUpdate = Date.now();
        }
    }
    
    /**
     * Get default style for geometry type
     */
    getDefaultStyle(geometryType) {
        const styles = {
            'line': { color: 0xff0000, lineWidth: 2, opacity: 1 },
            'polyline': { color: 0x00ff00, lineWidth: 2, opacity: 1 },
            'circle': { color: 0x0000ff, lineWidth: 2, opacity: 0.8 },
            'rectangle': { color: 0xffff00, lineWidth: 2, opacity: 0.8 },
            'point': { color: 0xff00ff, size: 5, opacity: 1 }
        };
        
        return styles[geometryType] || styles['line'];
    }
    
    /**
     * Process other message types (stubs for future implementation)
     */
    processAnnotationMessage(viewerId, data) {
        console.log(`Processing annotation message for viewer '${viewerId}':`, data);
    }
    
    processMeasurementMessage(viewerId, data) {
        console.log(`Processing measurement message for viewer '${viewerId}':`, data);
    }
    
    processDrawingMessage(viewerId, data) {
        console.log(`Processing drawing message for viewer '${viewerId}':`, data);
    }
    
    processCADMessage(viewerId, data) {
        console.log(`Processing CAD message for viewer '${viewerId}':`, data);
    }
    
    processSyncMessage(viewerId, data) {
        console.log(`Processing sync message for viewer '${viewerId}':`, data);
    }
    
    processSelectionMessage(viewerId, data) {
        console.log(`Processing selection message for viewer '${viewerId}':`, data);
    }
    
    /**
     * Utility methods
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateId(prefix = 'obj') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    applyGeometryUpdates(threeObject, updates, viewerId) {
        // Apply style updates
        if (updates.style && threeObject.material) {
            if (updates.style.color !== undefined) {
                threeObject.material.color.setHex(updates.style.color);
            }
            if (updates.style.opacity !== undefined) {
                threeObject.material.opacity = updates.style.opacity;
                threeObject.material.transparent = updates.style.opacity < 1;
            }
        }
        
        // Apply coordinate updates
        if (updates.coordinates && threeObject.geometry) {
            const localCoordinates = this.transformCoordinatesToViewer(viewerId, updates.coordinates);
            // Update geometry positions
            // Implementation depends on geometry type
        }
    }
    
    disposeThreeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
    }
    
    cleanupViewerSharedObjects(viewerId) {
        const commInfo = this.communicatingViewers.get(viewerId);
        if (!commInfo) return;
        
        // Clean up shared objects
        commInfo.sharedObjects.forEach(object => {
            this.disposeThreeObject(object);
        });
        
        commInfo.sharedObjects.clear();
        
        // Remove shared container
        if (commInfo.sharedContainer && commInfo.sharedContainer.parent) {
            commInfo.sharedContainer.parent.remove(commInfo.sharedContainer);
        }
    }
    
    /**
     * Get communication statistics
     */
    getStats() {
        return {
            enabled: this.isEnabled,
            registeredViewers: this.communicatingViewers.size,
            channels: this.messageChannels.size,
            sharedGeometry: this.sharedState.geometry.size,
            sharedAnnotations: this.sharedState.annotations.size,
            sharedMeasurements: this.sharedState.measurements.size,
            messageHistory: this.messageHistory.length,
            lastModified: this.sharedState.lastModified
        };
    }
    
    /**
     * Enable/disable communication
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`CrossViewerCommunication: ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * Get shared state
     */
    getSharedState() {
        return {
            ...this.sharedState,
            // Don't expose the actual Maps, convert to objects
            geometry: Object.fromEntries(this.sharedState.geometry),
            annotations: Object.fromEntries(this.sharedState.annotations),
            measurements: Object.fromEntries(this.sharedState.measurements),
            layers: Object.fromEntries(this.sharedState.layers)
        };
    }
    
    /**
     * Clear all shared state
     */
    clearSharedState() {
        // Remove all shared objects from viewers
        this.communicatingViewers.forEach((commInfo, viewerId) => {
            this.cleanupViewerSharedObjects(viewerId);
        });
        
        // Clear shared state
        this.sharedState.geometry.clear();
        this.sharedState.annotations.clear();
        this.sharedState.measurements.clear();
        this.sharedState.layers.clear();
        this.sharedState.activeLayers.clear();
        
        this.sharedState.lastModified = Date.now();
        
        console.log('CrossViewerCommunication: Cleared all shared state');
    }
    
    /**
     * Destroy communication system
     */
    destroy() {
        // Clear shared state
        this.clearSharedState();
        
        // Unregister all viewers
        const viewerIds = Array.from(this.communicatingViewers.keys());
        viewerIds.forEach(viewerId => {
            this.unregisterViewerFromCommunication(viewerId);
        });
        
        // Clear channels
        this.messageChannels.clear();
        
        // Clear message history
        this.messageHistory.length = 0;
        
        // Remove event listeners
        this.removeAllListeners();
        
        this.isEnabled = false;
        
        console.log('CrossViewerCommunication: Destroyed');
    }
}