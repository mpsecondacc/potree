import * as THREE from "../../libs/three.js/build/three.module.js";
import {CameraMode} from "../defines.js";
import {Viewer} from "../viewer/viewer.js";
import { EventDispatcher } from "../EventDispatcher.js";

export class MultiViewportManager extends EventDispatcher {
	constructor(domElement, args = {}) {
		super();

		console.log('MultiViewportManager constructor called with:', domElement);
		
		this.domElement = domElement;
		this.viewports = new Map();
		this.activeViewport = null;
		this.isResizing = false;
		this.resizeHandle = null;

		// Viewport configuration
		this.config = {
			viewport1: {
				id: 'main',
				name: 'Main View',
				position: { x: 0, y: 0, width: '66.666%', height: '100%' },
				cameraMode: CameraMode.ORTHOGRAPHIC,
				view: 'top',
				active: true,
				showPointClouds: true
			},
			viewport2: {
				id: 'profile',
				name: 'Profile View',
				position: { x: '66.666%', y: 0, width: '33.334%', height: '50%' },
				cameraMode: CameraMode.ORTHOGRAPHIC,
				view: 'front',
				active: false,
				showPointClouds: false
			},
			viewport3: {
				id: 'auxiliary',
				name: 'Auxiliary View',
				position: { x: '66.666%', y: '50%', width: '33.334%', height: '50%' },
				cameraMode: CameraMode.PERSPECTIVE,
				view: 'perspective',
				active: false,
				showPointClouds: false
			}
		};

		this.init();
	}

	init() {
		console.log('MultiViewportManager init() called');
		
		try {
			this.createViewportStructure();
			console.log('Viewport structure created');
			
			this.createViewportInstances();
			console.log('Viewport instances created');
			
			this.setupResizeHandles();
			console.log('Resize handles setup');
			
			this.setupViewportControls();
			console.log('Viewport controls setup');
			
			this.bindEvents();
			console.log('Events bound');
			
		} catch (error) {
			console.error('Error in MultiViewportManager init():', error);
		}
	}

	createViewportStructure() {
		// Clear existing content
		this.domElement.innerHTML = '';

		// Create main container with inline styles
		const container = document.createElement('div');
		container.style.cssText = `
			position: relative;
			width: 100%;
			height: 100%;
			background-color: #111827;
			display: flex;
			overflow: hidden;
		`;
		container.id = 'multi-viewport-container';

		// Create viewport containers
		Object.entries(this.config).forEach(([key, config]) => {
			const viewportContainer = this.createViewportContainer(config);
			container.appendChild(viewportContainer);
		});

		// Add resize handles
		const verticalHandle = this.createResizeHandle('vertical');
		const horizontalHandle = this.createResizeHandle('horizontal');
		
		container.appendChild(verticalHandle);
		container.appendChild(horizontalHandle);

		this.domElement.appendChild(container);
	}

	createViewportContainer(config) {
		const container = document.createElement('div');
		container.style.cssText = `
			position: absolute;
			border: 1px solid #374151;
			background-color: #000000;
			transition: all 0.2s;
			left: ${config.position.x};
			top: ${config.position.y};
			width: ${config.position.width};
			height: ${config.position.height};
			box-shadow: ${config.active ? '0 0 0 2px #3b82f6' : 'none'};
		`;
		container.id = `viewport-${config.id}`;

		// Create viewport header with controls
		const header = this.createViewportHeader(config);
		container.appendChild(header);

		// Create viewer container
		const viewerContainer = document.createElement('div');
		viewerContainer.style.cssText = `
			width: 100%;
			height: calc(100% - 32px);
			background-color: #000000;
			position: absolute;
			top: 32px;
			left: 0;
			right: 0;
			bottom: 0;
		`;
		viewerContainer.id = `viewer-${config.id}`;

		if (!config.active) {
			// Add paused overlay for inactive viewports
			const pausedOverlay = this.createPausedOverlay(config);
			viewerContainer.appendChild(pausedOverlay);
		}

		container.appendChild(viewerContainer);

		return container;
	}

	createViewportHeader(config) {
		const header = document.createElement('div');
		header.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 32px;
			background-color: #1f2937;
			border-bottom: 1px solid #374151;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 12px;
			font-size: 14px;
			color: white;
			z-index: 10;
		`;

		// Title
		const title = document.createElement('span');
		title.style.cssText = `
			font-weight: 500;
			color: #f3f4f6;
		`;
		title.textContent = config.name;

		// Controls container
		const controls = document.createElement('div');
		controls.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
		`;

		// Play/Pause button
		const playPauseBtn = this.createPlayPauseButton(config);
		controls.appendChild(playPauseBtn);

		// Camera mode indicator
		const cameraIndicator = this.createCameraIndicator(config);
		controls.appendChild(cameraIndicator);

		header.appendChild(title);
		header.appendChild(controls);

		return header;
	}

	createPlayPauseButton(config) {
		const button = document.createElement('button');
		const activeColor = config.active ? '#16a34a' : '#4b5563';
		const textColor = config.active ? 'white' : '#d1d5db';
		
		button.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			background-color: ${activeColor};
			color: ${textColor};
			border: none;
			cursor: pointer;
			transition: background-color 0.15s;
		`;
		button.title = config.active ? 'Pause Viewport' : 'Activate Viewport';

		const icon = document.createElement('span');
		icon.style.cssText = `
			font-size: 12px;
			line-height: 1;
		`;
		icon.innerHTML = config.active ? '⏸' : '▶';

		button.appendChild(icon);

		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log(`Button clicked for viewport ${config.id}`);
			this.toggleViewport(config.id);
		});

		return button;
	}

	createCameraIndicator(config) {
		const indicator = document.createElement('span');
		indicator.style.cssText = `
			font-size: 12px;
			color: #9ca3af;
			font-family: monospace;
		`;
		indicator.textContent = config.cameraMode === CameraMode.ORTHOGRAPHIC ? 'ORTHO' : 'PERSP';
		return indicator;
	}

	createPausedOverlay(config) {
		const overlay = document.createElement('div');
		overlay.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: rgba(17, 24, 39, 0.8);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			color: white;
			z-index: 20;
		`;
		overlay.id = `overlay-${config.id}`;

		const icon = document.createElement('div');
		icon.style.cssText = `
			font-size: 64px;
			margin-bottom: 16px;
			color: #6b7280;
		`;
		icon.innerHTML = '⏸';

		const text = document.createElement('div');
		text.style.cssText = `
			font-size: 18px;
			font-weight: 500;
			color: #d1d5db;
			margin-bottom: 8px;
		`;
		text.textContent = 'Viewport Paused';

		const subtext = document.createElement('div');
		subtext.style.cssText = `
			font-size: 14px;
			color: #6b7280;
			text-align: center;
		`;
		subtext.textContent = 'Click the play button to activate';

		overlay.appendChild(icon);
		overlay.appendChild(text);
		overlay.appendChild(subtext);

		return overlay;
	}

	createResizeHandle(type) {
		const handle = document.createElement('div');
		const isVertical = type === 'vertical';
		
		handle.style.cssText = `
			position: absolute;
			background-color: #4b5563;
			transition: background-color 0.15s;
			z-index: 30;
			${isVertical ? 'width: 4px; height: 100%; cursor: col-resize;' : 'height: 4px; cursor: row-resize;'}
		`;
		handle.dataset.type = type;
		
		// Add hover effect
		handle.addEventListener('mouseenter', () => {
			handle.style.backgroundColor = '#3b82f6';
		});
		handle.addEventListener('mouseleave', () => {
			handle.style.backgroundColor = '#4b5563';
		});

		if (type === 'vertical') {
			handle.style.left = 'calc(66.666% - 2px)';
			handle.style.top = '0';
		} else {
			handle.style.left = '66.666%';
			handle.style.top = 'calc(50% - 2px)';
			handle.style.width = '33.334%';
		}

		return handle;
	}

	createViewportInstances() {
		Object.entries(this.config).forEach(([key, config]) => {
			if (config.active) {
				const viewerContainer = document.getElementById(`viewer-${config.id}`);
				
				// For main viewport, preserve full functionality including GUI
				const viewerArgs = config.id === 'main' ? {} : { 
					// Disable some features for secondary viewports
					enableGUI: false 
				};
				
				const viewer = new Potree.Viewer(viewerContainer, viewerArgs);

				// Configure camera mode and view
				this.configureViewer(viewer, config);

				this.viewports.set(config.id, {
					viewer: viewer,
					config: config,
					container: viewerContainer
				});

				if (!this.activeViewport) {
					this.activeViewport = config.id;
				}
			}
		});
	}

	configureViewer(viewer, config) {
		// Set camera mode first
		viewer.setCameraMode(config.cameraMode);

		// Set view orientation using the scene view instead of camera methods
		setTimeout(() => {
			try {
				if (viewer.scene && viewer.scene.view) {
					switch (config.view) {
						case 'top':
							viewer.scene.view.yaw = 0;
							viewer.scene.view.pitch = -Math.PI / 2; // Looking down
							console.log(`Top view set for ${config.id}`);
							break;
						case 'front':
							viewer.scene.view.yaw = 0;
							viewer.scene.view.pitch = 0; // Looking forward
							console.log(`Front view set for ${config.id}`);
							break;
						case 'perspective':
							// Keep default perspective view
							console.log(`Perspective view kept for ${config.id}`);
							break;
					}
					console.log(`View orientation set for ${config.id}: ${config.view}`);
				} else {
					console.warn(`Scene view not available for ${config.id}`);
				}
			} catch (error) {
				console.warn(`Failed to set view orientation for ${config.id}:`, error);
			}
		}, 200);
	}

	setupResizeHandles() {
		const handles = this.domElement.querySelectorAll('[data-type]');
		
		handles.forEach(handle => {
			handle.addEventListener('mousedown', (e) => {
				this.startResize(e, handle.dataset.type);
			});
		});

		document.addEventListener('mousemove', (e) => {
			if (this.isResizing) {
				this.handleResize(e);
			}
		});

		document.addEventListener('mouseup', () => {
			this.endResize();
		});
	}

	setupViewportControls() {
		// Add click handlers for viewport selection
		Object.keys(this.config).forEach(key => {
			const config = this.config[key];
			const container = document.getElementById(`viewport-${config.id}`);
			
			container.addEventListener('click', () => {
				this.setActiveViewport(config.id);
			});
		});
	}

	bindEvents() {
		// Window resize handler
		window.addEventListener('resize', () => {
			this.handleWindowResize();
		});

		// Keyboard shortcuts
		document.addEventListener('keydown', (e) => {
			this.handleKeyboard(e);
		});
	}

	startResize(e, type) {
		e.preventDefault();
		this.isResizing = true;
		this.resizeHandle = type;
		document.body.style.cursor = type === 'vertical' ? 'col-resize' : 'row-resize';
	}

	handleResize(e) {
		if (!this.isResizing) return;

		const containerRect = this.domElement.getBoundingClientRect();
		
		if (this.resizeHandle === 'vertical') {
			const newPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
			const clampedPercentage = Math.max(30, Math.min(80, newPercentage));
			
			this.updateVerticalSplit(clampedPercentage);
		} else if (this.resizeHandle === 'horizontal') {
			const relativeY = e.clientY - containerRect.top;
			const rightSideY = relativeY;
			const rightSideHeight = containerRect.height;
			const newPercentage = (rightSideY / rightSideHeight) * 100;
			const clampedPercentage = Math.max(20, Math.min(80, newPercentage));
			
			this.updateHorizontalSplit(clampedPercentage);
		}
	}

	endResize() {
		this.isResizing = false;
		this.resizeHandle = null;
		document.body.style.cursor = '';
		
		// Update viewer sizes after resize
		this.updateViewerSizes();
	}

	updateVerticalSplit(percentage) {
		const rightPercentage = 100 - percentage;
		
		// Update viewport 1 (main)
		const viewport1 = document.getElementById('viewport-main');
		viewport1.style.width = `${percentage}%`;
		
		// Update viewport 2 & 3
		const viewport2 = document.getElementById('viewport-profile');
		const viewport3 = document.getElementById('viewport-auxiliary');
		
		viewport2.style.left = `${percentage}%`;
		viewport2.style.width = `${rightPercentage}%`;
		
		viewport3.style.left = `${percentage}%`;
		viewport3.style.width = `${rightPercentage}%`;
		
		// Update resize handle position
		const verticalHandle = this.domElement.querySelector('[data-type="vertical"]');
		verticalHandle.style.left = `calc(${percentage}% - 2px)`;
		
		const horizontalHandle = this.domElement.querySelector('[data-type="horizontal"]');
		horizontalHandle.style.left = `${percentage}%`;
		horizontalHandle.style.width = `${rightPercentage}%`;
	}

	updateHorizontalSplit(percentage) {
		// Update viewport 2 height
		const viewport2 = document.getElementById('viewport-profile');
		viewport2.style.height = `${percentage}%`;
		
		// Update viewport 3 position and height
		const viewport3 = document.getElementById('viewport-auxiliary');
		viewport3.style.top = `${percentage}%`;
		viewport3.style.height = `${100 - percentage}%`;
		
		// Update resize handle position
		const horizontalHandle = this.domElement.querySelector('[data-type="horizontal"]');
		horizontalHandle.style.top = `calc(${percentage}% - 2px)`;
	}

	updateViewerSizes() {
		// Trigger resize event for all active viewers
		this.viewports.forEach((viewport) => {
			if (viewport.viewer) {
				// Force viewer to recalculate its size
				setTimeout(() => {
					if (viewport.viewer.renderer) {
						const container = viewport.container;
						const rect = container.getBoundingClientRect();
						viewport.viewer.renderer.setSize(rect.width, rect.height);
						
						// Update camera aspect ratio if needed
						const camera = viewport.viewer.scene.getActiveCamera();
						if (camera.isPerspectiveCamera) {
							camera.aspect = rect.width / rect.height;
							camera.updateProjectionMatrix();
						}
					}
				}, 10);
			}
		});
	}

	toggleViewport(viewportId) {
		console.log(`toggleViewport called for ${viewportId}`);
		const config = Object.values(this.config).find(c => c.id === viewportId);
		if (!config) {
			console.warn(`No config found for viewport ${viewportId}`);
			return;
		}

		console.log(`Current state for ${viewportId}: active=${config.active}`);
		if (config.active) {
			console.log(`Pausing viewport ${viewportId}`);
			this.pauseViewport(viewportId);
		} else {
			console.log(`Activating viewport ${viewportId}`);
			this.activateViewport(viewportId);
		}
	}

	activateViewport(viewportId) {
		const config = Object.values(this.config).find(c => c.id === viewportId);
		if (!config) return;

		config.active = true;

		// Remove paused overlay
		const overlay = document.getElementById(`overlay-${viewportId}`);
		if (overlay) {
			overlay.remove();
		}

		// Create viewer instance if it doesn't exist
		if (!this.viewports.has(viewportId)) {
			const viewerContainer = document.getElementById(`viewer-${viewportId}`);
			const viewer = new Potree.Viewer(viewerContainer);
			
			this.configureViewer(viewer, config);

			this.viewports.set(viewportId, {
				viewer: viewer,
				config: config,
				container: viewerContainer
			});
		}

		// Update UI
		this.updateViewportUI(viewportId);
		
		this.dispatchEvent({
			type: 'viewport_activated',
			viewportId: viewportId
		});
	}

	pauseViewport(viewportId) {
		const config = Object.values(this.config).find(c => c.id === viewportId);
		if (!config || viewportId === 'main') return; // Can't pause main viewport

		config.active = false;

		// Add paused overlay
		const viewerContainer = document.getElementById(`viewer-${viewportId}`);
		const overlay = this.createPausedOverlay(config);
		viewerContainer.appendChild(overlay);

		// Dispose of viewer resources
		const viewport = this.viewports.get(viewportId);
		if (viewport && viewport.viewer) {
			// Clean up viewer resources here if needed
			// viewport.viewer.dispose();
		}

		// Update UI
		this.updateViewportUI(viewportId);

		this.dispatchEvent({
			type: 'viewport_paused',
			viewportId: viewportId
		});
	}

	updateViewportUI(viewportId) {
		const config = Object.values(this.config).find(c => c.id === viewportId);
		const container = document.getElementById(`viewport-${viewportId}`);
		const button = container.querySelector('button');
		const icon = button.querySelector('span');

		// Update button appearance
		if (config.active) {
			button.style.backgroundColor = '#16a34a';
			button.style.color = 'white';
			button.title = 'Pause Viewport';
			icon.innerHTML = '⏸';
		} else {
			button.style.backgroundColor = '#4b5563';
			button.style.color = '#d1d5db';
			button.title = 'Activate Viewport';
			icon.innerHTML = '▶';
		}

		// Update container border
		if (config.active) {
			container.style.boxShadow = '0 0 0 2px #3b82f6';
		} else {
			container.style.boxShadow = 'none';
		}
	}

	setActiveViewport(viewportId) {
		// Remove active state from all viewports
		this.viewports.forEach((viewport, id) => {
			const container = document.getElementById(`viewport-${id}`);
			container.style.boxShadow = '0 0 0 2px #3b82f6'; // Blue for active viewports
		});

		// Set new active viewport
		this.activeViewport = viewportId;
		const container = document.getElementById(`viewport-${viewportId}`);
		container.style.boxShadow = '0 0 0 2px #eab308'; // Yellow for currently selected viewport

		this.dispatchEvent({
			type: 'active_viewport_changed',
			viewportId: viewportId
		});
	}

	handleWindowResize() {
		// Update all viewer sizes when window resizes
		this.updateViewerSizes();
	}

	handleKeyboard(e) {
		// Keyboard shortcuts for viewport management
		if (e.ctrlKey) {
			switch (e.key) {
				case '1':
					e.preventDefault();
					this.setActiveViewport('main');
					break;
				case '2':
					e.preventDefault();
					this.toggleViewport('profile');
					break;
				case '3':
					e.preventDefault();
					this.toggleViewport('auxiliary');
					break;
			}
		}
	}

	// Public API methods
	getActiveViewport() {
		return this.viewports.get(this.activeViewport);
	}

	getViewport(viewportId) {
		return this.viewports.get(viewportId);
	}

	getAllViewports() {
		return this.viewports;
	}

	loadPointCloudToViewport(pointcloud, viewportId) {
		const viewport = this.viewports.get(viewportId);
		if (viewport && viewport.viewer) {
			viewport.viewer.scene.addPointCloud(pointcloud);
		}
	}

	removePointCloudFromViewport(pointcloud, viewportId) {
		const viewport = this.viewports.get(viewportId);
		if (viewport && viewport.viewer) {
			viewport.viewer.scene.removePointCloud(pointcloud);
		}
	}
}