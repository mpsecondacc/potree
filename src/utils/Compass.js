
import * as THREE from "../../libs/three.js/build/three.module.js";

import {Utils} from "../utils.js";

export class Compass{

	constructor(viewer){
		this.viewer = viewer;

		this.visible = false;
		this.dom = this.createElement();

		viewer.addEventListener("update", () => {
			const direction = viewer.scene.view.direction.clone();
			direction.z = 0;
			direction.normalize();

			const camera = viewer.scene.getActiveCamera();

			const p1 = camera.getWorldPosition(new THREE.Vector3());
			const p2 = p1.clone().add(direction);

			// CUSTOM - Validate camera position and direction before computing azimuth
			const isValidVector = (vec) => Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z);
			
			if (!isValidVector(p1) || !isValidVector(p2) || !isValidVector(direction)) {
				console.warn('[Compass] Invalid camera position or direction detected, skipping compass update', {
					position: { x: p1.x, y: p1.y, z: p1.z },
					direction: { x: direction.x, y: direction.y, z: direction.z }
				});
				return; // Skip compass update for invalid coordinates
			}

			const projection = viewer.getProjection();
			const azimuth = Utils.computeAzimuth(p1, p2, projection);
			
			this.dom.css("transform", `rotateZ(${-azimuth}rad)`);
		});

		this.dom.click( () => {
			viewer.setTopView();
		});

		const renderArea = $(viewer.renderArea);
		renderArea.append(this.dom);

		this.setVisible(this.visible);
	}

	setVisible(visible){
		this.visible = visible;

		const value = visible ? "" : "none";
		this.dom.css("display", value);
	}

	isVisible(){
		return this.visible;
	}

	createElement(){
		const style = `style="position: absolute; top: 10px; right: 10px; z-index: 10000; width: 64px;"`;
		const img = $(`<img src="${Potree.resourcePath}/images/compas.svg" ${style} />`);

		return img;
	}

};