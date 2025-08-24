
import * as THREE from "../../libs/three.js/build/three.module.js";
import {Profile} from "./Profile.js";
import {Utils} from "../utils.js";
import { EventDispatcher } from "../EventDispatcher.js";
import {CameraMode} from "../defines.js";


export class ProfileTool extends EventDispatcher {
	constructor (viewer) {
		super();

		this.viewer = viewer;
		this.renderer = viewer.renderer;

		// 3-click profile creation state
		this.isCreatingProfile = false;
		this.creationState = 'WAITING_FIRST_CLICK'; // WAITING_FIRST_CLICK, WAITING_SECOND_CLICK, WAITING_DEPTH_CLICK
		this.currentProfile = null;
		this.startPoint = null;
		this.endPoint = null;
		this.previewLine = null;
		this.previewDepthBox = null;
		this.visualMarkers = [];
		this.instructionElement = null;

		this.addEventListener('start_inserting_profile', e => {
			this.viewer.dispatchEvent({
				type: 'cancel_insertions'
			});
		});

		this.scene = new THREE.Scene();
		this.scene.name = 'scene_profile';
		this.light = new THREE.PointLight(0xffffff, 1.0);
		this.scene.add(this.light);

		this.viewer.inputHandler.registerInteractiveScene(this.scene);

		this.onRemove = e => this.scene.remove(e.profile);
		this.onAdd = e => this.scene.add(e.profile);

		for(let profile of viewer.scene.profiles){
			this.onAdd({profile: profile});
		}

		viewer.addEventListener("update", this.update.bind(this));
		viewer.addEventListener("render.pass.perspective_overlay", this.render.bind(this));
		viewer.addEventListener("scene_changed", this.onSceneChange.bind(this));

		viewer.scene.addEventListener('profile_added', this.onAdd);
		viewer.scene.addEventListener('profile_removed', this.onRemove);
	}

	onSceneChange(e){
		if(e.oldScene){
			e.oldScene.removeEventListeners('profile_added', this.onAdd);
			e.oldScene.removeEventListeners('profile_removed', this.onRemove);
		}

		e.scene.addEventListener('profile_added', this.onAdd);
		e.scene.addEventListener('profile_removed', this.onRemove);
	}

	startInsertion (args = {}) {
		// Check if we're in the required camera mode and view
		if (!this.isValidViewForProfileCreation()) {
			this.showRequirementWarning();
			return null;
		}
		
		if (this.isCreatingProfile) {
			this.cancelInsertion();
		}

		this.isCreatingProfile = true;
		this.creationState = 'WAITING_FIRST_CLICK';
		this.currentProfile = new Profile();
		this.currentProfile.name = args.name || 'Profile';

		this.dispatchEvent({
			type: 'start_inserting_profile',
			profile: this.currentProfile
		});

		// Add profile to scene immediately so it appears in sidebar
		this.scene.add(this.currentProfile);
		this.viewer.scene.addProfile(this.currentProfile);

		// Create preview geometry
		this.createPreviewGeometry();

		// Bind event listeners for 3-click interaction
		this.bindCreationListeners();

		// Show user instructions
		this.showInstructions('Click on the point cloud to set the START point of your profile');

		return this.currentProfile;
	}

	isValidViewForProfileCreation() {
		// Check if camera is in orthographic mode
		const isOrthographic = this.viewer.scene.cameraMode === CameraMode.ORTHOGRAPHIC;
		
		// Check if we're in top view (pitch = -π/2, yaw = 0)
		const view = this.viewer.scene.view;
		const isTopView = Math.abs(view.pitch + Math.PI / 2) < 0.1 && Math.abs(view.yaw) < 0.1;
		
		return isOrthographic && isTopView;
	}

	showRequirementWarning() {
		this.showInstructions(`
			⚠️ Profile Tool Requirements:
			<br><br>
			• Camera must be in <strong>Orthographic</strong> mode
			<br>
			• View must be set to <strong>Top View</strong>
			<br><br>
			Please switch to orthographic camera and top view (press 'U' key) before using the profile tool.
		`, 5000);
	}

	cancelInsertion() {
		if (!this.isCreatingProfile) return;

		// Remove profile from scene if it was added during creation
		if (this.currentProfile) {
			this.scene.remove(this.currentProfile);
			this.viewer.scene.removeProfile(this.currentProfile);
			
		}

		this.isCreatingProfile = false;
		this.creationState = 'WAITING_FIRST_CLICK';
		this.unbindCreationListeners();
		this.clearPreviewGeometry();
		this.hideInstructions();
		this.currentProfile = null;
		this.startPoint = null;
		this.endPoint = null;

		
	}

	createPreviewGeometry() {
		// Preview line geometry
		let lineGeometry = new THREE.BufferGeometry();
		let positions = new Float32Array(6); // 2 points * 3 coordinates
		lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		
		let lineMaterial = new THREE.LineBasicMaterial({
			color: 0xff0000,
			linewidth: 2,
			transparent: true,
			opacity: 0.8
		});
		
		this.previewLine = new THREE.Line(lineGeometry, lineMaterial);
		this.previewLine.visible = false;
		this.scene.add(this.previewLine);

		// Preview depth box geometry
		let boxGeometry = new THREE.BoxGeometry(1, 1, 1);
		let boxMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			transparent: true,
			opacity: 0.2,
			side: THREE.DoubleSide
		});
		
		this.previewDepthBox = new THREE.Mesh(boxGeometry, boxMaterial);
		this.previewDepthBox.visible = false;
		this.scene.add(this.previewDepthBox);
	}

	clearPreviewGeometry() {
		if (this.previewLine) {
			this.scene.remove(this.previewLine);
			this.previewLine = null;
		}
		if (this.previewDepthBox) {
			this.scene.remove(this.previewDepthBox);
			this.previewDepthBox = null;
		}
	}

	bindCreationListeners() {
		this.domElement = this.viewer.renderer.domElement;
		this.clickHandler = this.onProfileClick.bind(this);
		this.mouseMoveHandler = this.onProfileMouseMove.bind(this);
		this.cancelHandler = this.onProfileCancel.bind(this);

		this.domElement.addEventListener('click', this.clickHandler, false);
		this.domElement.addEventListener('mousemove', this.mouseMoveHandler, false);
		this.domElement.addEventListener('contextmenu', this.cancelHandler, false);
		this.viewer.addEventListener('cancel_insertions', this.cancelHandler);
	}

	unbindCreationListeners() {
		if (this.domElement && this.clickHandler) {
			this.domElement.removeEventListener('click', this.clickHandler, false);
			this.domElement.removeEventListener('mousemove', this.mouseMoveHandler, false);
			this.domElement.removeEventListener('contextmenu', this.cancelHandler, false);
			this.viewer.removeEventListener('cancel_insertions', this.cancelHandler);
		}
	}

	onProfileClick(event) {
		if (!this.isCreatingProfile) {
			
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		

		let intersection = this.getPointCloudIntersection(event);
		if (!intersection) {
			
			return;
		}

		
		switch (this.creationState) {
			case 'WAITING_FIRST_CLICK':
				this.handleFirstClick(intersection.location);
				break;
			case 'WAITING_SECOND_CLICK':
				this.handleSecondClick(intersection.location);
				break;
			case 'WAITING_DEPTH_CLICK':
				this.handleDepthClick(event);
				break;
		}
	}

	onProfileMouseMove(event) {
		if (!this.isCreatingProfile) return;

		let intersection = this.getPointCloudIntersection(event);
		if (!intersection) return;

		switch (this.creationState) {
			case 'WAITING_SECOND_CLICK':
				this.updateLinePreview(intersection.location);
				break;
			case 'WAITING_DEPTH_CLICK':
				this.updateDepthPreview(event);
				break;
		}
	}

	onProfileCancel(event) {
		event.preventDefault();
		this.cancelInsertion();
	}

	getPointCloudIntersection(event) {
		let rect = this.domElement.getBoundingClientRect();
		let mouse = new THREE.Vector2();
		
		// Mouse coordinates in pixel space (required by Utils.getMousePointCloudIntersection)
		mouse.x = event.clientX - rect.left;
		mouse.y = event.clientY - rect.top;

		
		if (this.viewer.scene.pointclouds.length === 0) {
			console.log('⚠️ ProfileTool: No point clouds available for intersection');
			return null;
		}

		let intersection = Utils.getMousePointCloudIntersection(
			mouse,
			this.viewer.scene.getActiveCamera(),
			this.viewer,
			this.viewer.scene.pointclouds
		);

		if (intersection) {
			
		} else {
			
		}

		return intersection;
	}

	handleFirstClick(point) {
		
		this.startPoint = point.clone();
		this.creationState = 'WAITING_SECOND_CLICK';
		this.previewLine.visible = true;
		this.updateLinePreview(point);
		
		// Add visual marker at start point
		this.addVisualMarker(point, 0x00ff00, 'START');
		
		this.showInstructions('Click on the point cloud to set the END point of your profile');
		
	}

	handleSecondClick(point) {
		
		this.endPoint = point.clone();
		this.creationState = 'WAITING_DEPTH_CLICK';
		this.updateLinePreview(this.endPoint);
		this.previewDepthBox.visible = true;
		
		// Add visual marker at end point
		this.addVisualMarker(point, 0xff0000, 'END');
		
		let distance = this.startPoint.distanceTo(this.endPoint);
		
		this.showInstructions('Move mouse perpendicular to the profile line and click to set the DEPTH/WIDTH');
		
	}

	handleDepthClick(event) {
		
		
		// Calculate depth based on orthogonal distance from profile line
		let mouse = new THREE.Vector2();
		let rect = this.domElement.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		let camera = this.viewer.scene.getActiveCamera();
		let raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, camera);

		// Project ray onto a plane at the profile line's average Z height
		let avgZ = (this.startPoint.z + this.endPoint.z) / 2;
		let plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -avgZ);
		let mouseWorldPos = new THREE.Vector3();
		raycaster.ray.intersectPlane(plane, mouseWorldPos);

		if (mouseWorldPos) {
			let depth = this.calculateProfileDepth(mouseWorldPos);
			
			this.finalizeProfile(depth);
		} else {
			
			this.showInstructions('Could not calculate depth. Try clicking closer to the profile line.');
		}
	}

	calculateProfileDepth(mouseWorldPos) {
		// Calculate perpendicular distance from mouse position to profile line
		let lineDir = new THREE.Vector3().subVectors(this.endPoint, this.startPoint).normalize();
		let lineCenter = new THREE.Vector3().addVectors(this.startPoint, this.endPoint).multiplyScalar(0.5);
		let mouseToCenter = new THREE.Vector3().subVectors(mouseWorldPos, lineCenter);
		
		// Project mouseToCenter onto the perpendicular plane
		let perpDir = new THREE.Vector3(-lineDir.y, lineDir.x, 0).normalize();
		let depth = Math.abs(mouseToCenter.dot(perpDir)) * 2; // *2 for full width
		
		return Math.max(depth, 1); // Minimum 1 meter depth
	}

	updateLinePreview(endPoint) {
		if (!this.previewLine || !this.startPoint) return;

		let positions = this.previewLine.geometry.attributes.position.array;
		positions[0] = this.startPoint.x;
		positions[1] = this.startPoint.y;
		positions[2] = this.startPoint.z;
		positions[3] = endPoint.x;
		positions[4] = endPoint.y;
		positions[5] = endPoint.z;
		
		this.previewLine.geometry.attributes.position.needsUpdate = true;
	}

	updateDepthPreview(event) {
		if (!this.previewDepthBox || !this.startPoint || !this.endPoint) return;

		let mouse = new THREE.Vector2();
		let rect = this.domElement.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		let camera = this.viewer.scene.getActiveCamera();
		let raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, camera);

		let avgZ = (this.startPoint.z + this.endPoint.z) / 2;
		let plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -avgZ);
		let mouseWorldPos = new THREE.Vector3();
		raycaster.ray.intersectPlane(plane, mouseWorldPos);

		if (mouseWorldPos) {
			let depth = this.calculateProfileDepth(mouseWorldPos);
			this.updateDepthBoxGeometry(depth);
		}
	}

	updateDepthBoxGeometry(depth) {
		let length = this.startPoint.distanceTo(this.endPoint);
		let center = new THREE.Vector3().addVectors(this.startPoint, this.endPoint).multiplyScalar(0.5);
		let direction = new THREE.Vector3().subVectors(this.endPoint, this.startPoint).normalize();

		this.previewDepthBox.scale.set(length, depth, 50); // 50m height for visibility
		this.previewDepthBox.position.copy(center);
		
		// Orient box along profile line
		let angle = Math.atan2(direction.y, direction.x);
		this.previewDepthBox.rotation.z = angle;
	}

	finalizeProfile(depth) {
		
		
		// Create final profile with calculated geometry
		this.currentProfile.addMarker(this.startPoint);
		this.currentProfile.addMarker(this.endPoint);
		this.currentProfile.setWidth(depth);

		
		// Profile is already in scene, no need to add it again

		// Clean up
		this.clearPreviewGeometry();
		this.clearVisualMarkers();
		this.unbindCreationListeners();
		this.hideInstructions();
		this.isCreatingProfile = false;
		this.creationState = 'WAITING_FIRST_CLICK';

		
		this.showInstructions('Profile created! Click "Show 2D Profile" in the sidebar to view.', 3000);

		// Automatically show profile window - CUSTOM: Added debugging
		console.log(`[DEBUG] ProfileTool.finalizeProfile - Checking ProfileWindow availability`);
		console.log(`[DEBUG] viewer.profileWindow: ${!!this.viewer.profileWindow}`);
		console.log(`[DEBUG] viewer.profileWindowController: ${!!this.viewer.profileWindowController}`);
		
		if (this.viewer.profileWindow && this.viewer.profileWindowController) {
			console.log(`[DEBUG] Calling profileWindow.show() and profileWindowController.setProfile()`);
			this.viewer.profileWindow.show();
			this.viewer.profileWindowController.setProfile(this.currentProfile);
		} else {
			console.error(`[DEBUG] ProfileWindow not available - profileWindow: ${!!this.viewer.profileWindow}, profileWindowController: ${!!this.viewer.profileWindowController}`);
		}

		let result = this.currentProfile;
		this.currentProfile = null;
		this.startPoint = null;
		this.endPoint = null;

		return result;
	}
	
	update(){
		let camera = this.viewer.scene.getActiveCamera();
		let profiles = this.viewer.scene.profiles;
		let renderAreaSize = this.viewer.renderer.getSize(new THREE.Vector2());
		let clientWidth = renderAreaSize.width;
		let clientHeight = renderAreaSize.height;

		this.light.position.copy(camera.position);

		// make size independant of distance
		for(let profile of profiles){
			for(let sphere of profile.spheres){				
				let distance = camera.position.distanceTo(sphere.getWorldPosition(new THREE.Vector3()));
				let pr = Utils.projectedRadius(1, camera, distance, clientWidth, clientHeight);
				let scale = (15 / pr);
				sphere.scale.set(scale, scale, scale);
			}
		}
	}

	render(){
		this.viewer.renderer.render(this.scene, this.viewer.scene.getActiveCamera());
	}

	// Visual indicators and user feedback methods
	addVisualMarker(position, color, label) {
		// Create sphere marker
		let sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
		let sphereMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			transparent: true,
			opacity: 0.8
		});
		let sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.position.copy(position);
		
		// Create text label
		let canvas = document.createElement('canvas');
		let context = canvas.getContext('2d');
		canvas.width = 128;
		canvas.height = 64;
		context.font = '24px Arial';
		context.fillStyle = '#ffffff';
		context.textAlign = 'center';
		context.fillText(label, 64, 32);
		
		let texture = new THREE.CanvasTexture(canvas);
		let spriteMaterial = new THREE.SpriteMaterial({ map: texture });
		let sprite = new THREE.Sprite(spriteMaterial);
		sprite.position.copy(position);
		sprite.position.z += 5; // Offset above sphere
		sprite.scale.set(10, 5, 1);
		
		this.scene.add(sphere);
		this.scene.add(sprite);
		
		this.visualMarkers.push({ sphere, sprite, label });
		
		
	}

	clearVisualMarkers() {
		this.visualMarkers.forEach(marker => {
			this.scene.remove(marker.sphere);
			this.scene.remove(marker.sprite);
		});
		this.visualMarkers = [];
		
	}

	showInstructions(text, timeout = null) {
		// Remove existing instruction
		this.hideInstructions();
		
		// Create instruction overlay
		this.instructionElement = $(`
			<div id="profile_instructions" style="
				position: fixed;
				top: 20px;
				left: 50%;
				transform: translateX(-50%);
				background: rgba(0, 0, 0, 0.8);
				color: white;
				padding: 15px 25px;
				border-radius: 5px;
				font-size: 16px;
				font-weight: bold;
				z-index: 10000;
				border: 2px solid #ff6600;
				box-shadow: 0 4px 8px rgba(0,0,0,0.3);
				max-width: 500px;
				text-align: center;
			">${text}</div>
		`);
		
		$('body').append(this.instructionElement);
		
		if (timeout) {
			setTimeout(() => {
				this.hideInstructions();
			}, timeout);
		}
		
		
	}

	hideInstructions() {
		if (this.instructionElement) {
			this.instructionElement.remove();
			this.instructionElement = null;
		}
	}

}
