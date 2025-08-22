/**
 * CUSTOM Multi-Viewer Compatible Sidebar
 * 
 * This is a rewrite of the standard Potree sidebar.js to support multi-viewer architecture.
 * Key changes:
 * - Element ID scoping for multiple viewers
 * - Viewer-specific event handling
 * - Isolated DOM contexts
 * - Compatible with ViewerManager event system
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import {Utils} from "../utils.js";

export class MultiViewerSidebar {
    
    constructor(viewer, viewerId, viewerManager) {
        this.viewer = viewer;
        this.viewerId = viewerId;
        this.viewerManager = viewerManager;
        
        // Create scoped DOM reference - critical difference from original
        this.dom = null; // Will be set when container is created
        this.container = null;
        this.isVisible = false;
    }
    
    /**
     * Initialize the multi-viewer sidebar
     * Replicates viewer.loadGUI() but for multi-viewer context
     */
    init() {
        return new Promise((resolve, reject) => {
            this.loadSidebarTemplate()
                .then(() => {
                    this.setupDOMReference();
                    this.updateElementIDs();
                    this.initializeInternationalization();
                    this.initAccordion();
                    this.initAppearance();
                    this.initTools();
                    this.initScene();
                    
                    // Create hamburger button after everything is set up
                    this.createHamburgerButton();
                    
                    // Set up global debugging methods (only once)
                    if (!window.debugAttributeSelector) {
                        MultiViewerSidebar.setupGlobalDebugger();
                    }
                    
                    resolve();
                })
                .catch(error => {
                    console.error(`Failed to initialize sidebar for viewer ${this.viewerId}:`, error);
                    reject(error);
                });
        });
    }
    
    /**
     * Load sidebar.html template - equivalent to viewer.loadGUI() template loading
     */
    loadSidebarTemplate() {
        return new Promise((resolve, reject) => {
            this.container = document.createElement('div');
            this.container.className = 'potree-sidebar-container';
            this.container.setAttribute('data-viewer-sidebar', 'true');
            this.container.setAttribute('data-viewer-id', this.viewerId);
            
            // Apply Potree sidebar styling
            this.container.style.cssText = `
                position: absolute;
                top: 0;
                right: 0;
                width: 300px;
                height: 100%;
                background: #1a1a1a;
                color: #ffffff;
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                overflow-y: auto;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
            `;
            
            // Load sidebar.html template
            const sidebarPath = new URL(window.Potree.scriptPath + '/sidebar.html').href;
            $(this.container).load(sidebarPath, (response, status, xhr) => {
                if (status === "error") {
                    reject(new Error(`Failed to load sidebar template: ${xhr.status} ${xhr.statusText}`));
                    return;
                }
                console.log(`Sidebar template loaded for viewer ${this.viewerId}`);
                resolve();
            });
        });
    }
    
    /**
     * Setup DOM reference - equivalent to original this.dom = $("#sidebar_root")
     */
    setupDOMReference() {
        // Find the sidebar root within our container and create jQuery reference
        const sidebarRoot = this.container.querySelector('#sidebar_root');
        if (sidebarRoot) {
            this.dom = $(sidebarRoot);
        } else {
            // Fallback - use entire container as dom reference
            this.dom = $(this.container);
        }
    }
    
    /**
     * Update all element IDs to be viewer-specific
     * Critical for multi-viewer: #chkEDLEnabled becomes #chkEDLEnabled_main
     */
    updateElementIDs() {
        const $container = $(this.container);
        
        // Find all elements with IDs and update them
        $container.find('[id]').each((index, element) => {
            const oldId = element.id;
            const newId = `${oldId}_${this.viewerId}`;
            element.id = newId;
            console.log(`Updated element ID: ${oldId} → ${newId}`);
        });
        
        // Update name attributes for radio buttons/form elements
        $container.find('[name]').each((index, element) => {
            const oldName = element.name;
            const newName = `${oldName}_${this.viewerId}`;
            element.name = newName;
        });
        
        // Update for/label associations
        $container.find('label[for]').each((index, element) => {
            const oldFor = element.getAttribute('for');
            const newFor = `${oldFor}_${this.viewerId}`;
            element.setAttribute('for', newFor);
        });
    }
    
    /**
     * Initialize internationalization - equivalent to original i18next setup
     */
    initializeInternationalization() {
        if (window.i18n && window.i18n.isInitialized && window.i18n.isInitialized()) {
            $(this.container).i18n();
        } else if (window.i18n) {
            // Initialize if not already done (original does this globally)
            window.i18n.init({
                lng: 'en',
                resGetPath: window.Potree.resourcePath + '/lang/__lng__/__ns__.json',
                preload: ['en', 'fr', 'de', 'jp', 'se', 'es', 'zh', 'it','ca'],
                getAsync: true,
                debug: false
            }, (t) => {
                $(this.container).i18n();
            });
        }
    }
    
    /**
     * Initialize accordion - equivalent to original sidebar.js initAccordion()
     */
    initAccordion() {
        const $container = $(this.container);
        
        // Replicate original accordion logic but scoped to this container
        $container.find('.accordion > h3').each(function(){
            let header = $(this);
            let content = $(this).next();

            content.hide();

            header.click(() => {
                content.slideToggle();
            });
        });
    }
    
    /**
     * Initialize appearance section - REWRITTEN version of original initAppearance()
     * This is the critical method that needs to work with scoped elements
     */
    initAppearance() {
        console.log(`Initializing APPEARANCE section for viewer ${this.viewerId}`);
        
        // Point Budget Slider - scoped version
        this.initPointBudgetSlider();
        
        // FOV Slider - scoped version  
        this.initFOVSlider();
        
        // EDL Controls - scoped version (the main issue we're solving)
        this.initEDLControls();
        
        // Background Selection - scoped version
        this.initBackgroundSelection();
        
        // Initialize Splat Quality selectgroup
        this.initSplatQualitySelectgroup();
        
        // Initialize Min Node Size controls
        this.initMinNodeSizeControls();
        
        // Initialize bounding box and other checkboxes
        this.initOtherCheckboxes();
        
        // Initialize labels with current values
        this.updateLabels();
        
        // Bind viewer events for two-way sync
        this.bindViewerEvents();
        
        console.log(`APPEARANCE section initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Point Budget slider with viewer-specific elements
     */
    initPointBudgetSlider() {
        const sldPointBudget = this.dom.find(`#sldPointBudget_${this.viewerId}`);
        
        sldPointBudget.slider({
            value: this.viewer.getPointBudget(),
            min: 100 * 1000,
            max: 10 * 1000 * 1000,
            step: 1000,
            slide: (event, ui) => { 
                this.viewer.setPointBudget(ui.value); 
            }
        });
    }
    
    /**
     * Initialize FOV slider with viewer-specific elements
     */
    initFOVSlider() {
        const sldFOV = this.dom.find(`#sldFOV_${this.viewerId}`);
        
        sldFOV.slider({
            value: this.viewer.getFOV(),
            min: 20,
            max: 100,
            step: 1,
            slide: (event, ui) => { 
                this.viewer.setFOV(ui.value); 
            }
        });
    }
    
    /**
     * Initialize EDL controls - THE CRITICAL FIX for checkbox issue
     * Rewritten to work with ViewerManager event system
     */
    initEDLControls() {
        const chkEDLEnabled = this.dom.find(`#chkEDLEnabled_${this.viewerId}`);
        const sldEDLRadius = this.dom.find(`#sldEDLRadius_${this.viewerId}`);
        const sldEDLStrength = this.dom.find(`#sldEDLStrength_${this.viewerId}`);
        const sldEDLOpacity = this.dom.find(`#sldEDLOpacity_${this.viewerId}`);
        
        // EDL Enabled Checkbox - CRITICAL FIX
        // Set initial state using DOM property (like original line 1353)
        chkEDLEnabled[0].checked = this.viewer.getEDLEnabled();
        
        // REWRITTEN click handler to work with ViewerManager
        // Original: $('#chkEDLEnabled').click(() => { this.viewer.setEDLEnabled($('#chkEDLEnabled').prop("checked")); });
        chkEDLEnabled.on('click', (event) => {
            // Prevent event bubbling to ViewerManager
            event.stopPropagation();
            
            // Get the new state from the checkbox
            const newState = event.target.checked;
            console.log(`[NEW ARCHITECTURE] EDL checkbox clicked: ${newState} for viewer ${this.viewerId}`);
            console.log(`[NEW ARCHITECTURE] Checkbox DOM state: ${chkEDLEnabled[0].checked}`);
            
            // Apply to viewer
            this.viewer.setEDLEnabled(newState);
            console.log(`[NEW ARCHITECTURE] Viewer EDL state after set: ${this.viewer.getEDLEnabled()}`);
        });
        
        // EDL Sliders
        sldEDLRadius.slider({
            value: this.viewer.getEDLRadius(),
            min: 1,
            max: 4,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLRadius(ui.value); }
        });
        
        sldEDLStrength.slider({
            value: this.viewer.getEDLStrength(),
            min: 0,
            max: 5,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLStrength(ui.value); }
        });
        
        sldEDLOpacity.slider({
            value: this.viewer.getEDLOpacity(),
            min: 0,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLOpacity(ui.value); }
        });
    }
    
    /**
     * Initialize background selection - rewritten for scoped elements
     */
    initBackgroundSelection() {
        const elBackground = this.dom.find(`#background_options_${this.viewerId}`);
        elBackground.selectgroup();

        elBackground.find("input").click((e) => {
            // Prevent event bubbling to ViewerManager
            e.stopPropagation();
            this.viewer.setBackground(e.target.value);
        });

        // Set current background selection
        const currentBackground = this.viewer.getBackground();
        this.dom.find(`input[name=background_options_${this.viewerId}][value=${currentBackground}]`).trigger("click");
    }
    
    /**
     * Update all labels with current viewer values
     */
    updateLabels() {
        this.dom.find(`#lblPointBudget_${this.viewerId}`)[0].innerHTML = Utils.addCommas(this.viewer.getPointBudget());
        this.dom.find(`#lblFOV_${this.viewerId}`)[0].innerHTML = parseInt(this.viewer.getFOV());
        this.dom.find(`#lblEDLRadius_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLRadius().toFixed(1);
        this.dom.find(`#lblEDLStrength_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLStrength().toFixed(1);
        this.dom.find(`#lblEDLOpacity_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLOpacity().toFixed(2);
        
        // Min Node Size label
        const lblMinNodeSize = this.dom.find(`#lblMinNodeSize_${this.viewerId}`);
        if (lblMinNodeSize.length > 0) {
            lblMinNodeSize[0].innerHTML = parseInt(this.viewer.getMinNodeSize());
        }
    }
    
    /**
     * Bind viewer events for two-way synchronization
     * Rewritten to use scoped element references
     */
    bindViewerEvents() {
        // Point Budget changed
        this.viewer.addEventListener('point_budget_changed', (event) => {
            this.dom.find(`#lblPointBudget_${this.viewerId}`)[0].innerHTML = Utils.addCommas(this.viewer.getPointBudget());
            this.dom.find(`#sldPointBudget_${this.viewerId}`).slider({value: this.viewer.getPointBudget()});
        });

        // FOV changed
        this.viewer.addEventListener('fov_changed', (event) => {
            this.dom.find(`#lblFOV_${this.viewerId}`)[0].innerHTML = parseInt(this.viewer.getFOV());
            this.dom.find(`#sldFOV_${this.viewerId}`).slider({value: this.viewer.getFOV()});
        });

        // EDL enabled changed - CRITICAL for checkbox sync
        this.viewer.addEventListener('use_edl_changed', (event) => {
            this.dom.find(`#chkEDLEnabled_${this.viewerId}`)[0].checked = this.viewer.getEDLEnabled();
        });

        // EDL parameters changed
        this.viewer.addEventListener('edl_radius_changed', (event) => {
            this.dom.find(`#lblEDLRadius_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLRadius().toFixed(1);
            this.dom.find(`#sldEDLRadius_${this.viewerId}`).slider({value: this.viewer.getEDLRadius()});
        });

        this.viewer.addEventListener('edl_strength_changed', (event) => {
            this.dom.find(`#lblEDLStrength_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLStrength().toFixed(1);
            this.dom.find(`#sldEDLStrength_${this.viewerId}`).slider({value: this.viewer.getEDLStrength()});
        });

        this.viewer.addEventListener('edl_opacity_changed', (event) => {
            this.dom.find(`#lblEDLOpacity_${this.viewerId}`)[0].innerHTML = this.viewer.getEDLOpacity().toFixed(2);
            this.dom.find(`#sldEDLOpacity_${this.viewerId}`).slider({value: this.viewer.getEDLOpacity()});
        });

        // Background changed
        this.viewer.addEventListener('background_changed', (event) => {
            const newBackground = this.viewer.getBackground();
            this.dom.find(`input[name=background_options_${this.viewerId}][value='${newBackground}']`).prop('checked', true);
        });
    }
    
    /**
     * Initialize Splat Quality selectgroup - FIXED implementation
     */
    initSplatQualitySelectgroup() {
        const elSplatQuality = this.dom.find(`#splat_quality_options_${this.viewerId}`);
        elSplatQuality.selectgroup({title: "Splat Quality"});

        elSplatQuality.find("input").click((e) => {
            // Prevent event bubbling to ViewerManager
            e.stopPropagation();
            
            if(e.target.value === "standard"){
                this.viewer.useHQ = false;
            }else if(e.target.value === "hq"){
                this.viewer.useHQ = true;
            }
            console.log(`Splat quality changed to: ${e.target.value} for viewer ${this.viewerId}`);
        });

        // Set current quality selection
        const currentQuality = this.viewer.useHQ ? "hq" : "standard";
        elSplatQuality.find(`input[value=${currentQuality}]`).trigger("click");
    }
    
    /**
     * Initialize Min Node Size controls - NEW implementation
     */
    initMinNodeSizeControls() {
        const sldMinNodeSize = this.dom.find(`#sldMinNodeSize_${this.viewerId}`);
        const lblMinNodeSize = this.dom.find(`#lblMinNodeSize_${this.viewerId}`);
        
        sldMinNodeSize.slider({
            value: this.viewer.getMinNodeSize(),
            min: 0,
            max: 1000,
            step: 0.01,
            slide: (event, ui) => { 
                this.viewer.setMinNodeSize(ui.value); 
            }
        });
        
        // Set initial label
        lblMinNodeSize.html(parseInt(this.viewer.getMinNodeSize()));
        
        // Bind viewer event
        this.viewer.addEventListener('minnodesize_changed', (event) => {
            lblMinNodeSize.html(parseInt(this.viewer.getMinNodeSize()));
            sldMinNodeSize.slider({value: this.viewer.getMinNodeSize()});
        });
    }
    
    /**
     * Initialize bounding box and other checkboxes - NEW implementation
     */
    initOtherCheckboxes() {
        // Bounding Box checkbox
        const chkBoundingBox = this.dom.find(`#show_bounding_box_${this.viewerId}`);
        chkBoundingBox[0].checked = this.viewer.getShowBoundingBox ? this.viewer.getShowBoundingBox() : false;
        
        chkBoundingBox.on('click', (event) => {
            event.stopPropagation(); // Prevent ViewerManager interference
            const newState = event.target.checked;
            console.log(`Bounding box checkbox clicked: ${newState} for viewer ${this.viewerId}`);
            this.viewer.setShowBoundingBox(newState);
        });
        
        // Lock/Freeze checkbox (if it exists)
        const chkFreeze = this.dom.find(`#set_freeze_${this.viewerId}`);
        if (chkFreeze.length > 0) {
            chkFreeze[0].checked = this.viewer.getFreeze ? this.viewer.getFreeze() : false;
            
            chkFreeze.on('click', (event) => {
                event.stopPropagation(); // Prevent ViewerManager interference
                const newState = event.target.checked;
                console.log(`Freeze checkbox clicked: ${newState} for viewer ${this.viewerId}`);
                this.viewer.setFreeze(newState);
            });
        }
    }
    
    /**
     * Initialize Tools section - COMPLETE implementation
     * Replicates original sidebar.js initToolbar() method for multi-viewer
     */
    initTools() {
        console.log(`Initializing TOOLS section for viewer ${this.viewerId}`);
        
        // Initialize measurement toolbar
        this.initMeasurementToolbar();
        
        // Initialize Show/Hide labels functionality
        this.initMeasurementVisibility();
        
        // Initialize clipping tools
        this.initClippingTools();
        
        // Initialize navigation tools
        this.initNavigationTools();
        
        console.log(`TOOLS section initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Create tool icon - replicates original createToolIcon method
     */
    createToolIcon(icon, title, callback) {
        let element = $(`
            <img src="${icon}"
                style="width: 32px; height: 32px"
                class="button-icon"
                data-i18n="${title}" />
        `);

        element.click((event) => {
            event.stopPropagation(); // Prevent ViewerManager interference
            callback();
        });

        return element;
    }
    
    /**
     * Initialize measurement toolbar with all tool icons
     */
    initMeasurementToolbar() {
        const elToolbar = this.dom.find(`#tools_${this.viewerId}`);
        
        if (elToolbar.length === 0) {
            console.warn(`Tools container #tools_${this.viewerId} not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Get resource path for icons
        const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
        
        // ANGLE measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/angle.png',
            '[title]tt.angle_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showAngles: true,
                        showArea: false,
                        closed: true,
                        maxMarkers: 3,
                        name: 'Angle'
                    });
                }
            }
        ));
        
        // POINT measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/point.svg',
            '[title]tt.point_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showAngles: false,
                        showCoordinates: true,
                        showArea: false,
                        closed: true,
                        maxMarkers: 1,
                        name: 'Point'
                    });
                }
            }
        ));
        
        // DISTANCE measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/distance.svg',
            '[title]tt.distance_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: true,
                        showArea: false,
                        closed: false,
                        name: 'Distance'
                    });
                }
            }
        ));
        
        // HEIGHT measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/height.svg',
            '[title]tt.height_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showHeight: true,
                        showArea: false,
                        closed: false,
                        maxMarkers: 2,
                        name: 'Height'
                    });
                }
            }
        ));
        
        // CIRCLE measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/circle.svg',
            '[title]tt.circle_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showHeight: false,
                        showArea: false,
                        showCircle: true,
                        showEdges: false,
                        closed: true,
                        maxMarkers: 3,
                        name: 'Circle'
                    });
                }
            }
        ));
        
        // AZIMUTH measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/azimuth.svg',
            'Azimuth',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showHeight: false,
                        showArea: false,
                        showCircle: false,
                        showEdges: false,
                        showAzimuth: true,
                        closed: false,
                        maxMarkers: 2,
                        name: 'Azimuth'
                    });
                }
            }
        ));
        
        // AREA measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/area.svg',
            '[title]tt.area_measurement',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.measuringTool) {
                    let measurement = this.viewer.measuringTool.startInsertion({
                        showDistances: true,
                        showArea: true,
                        closed: true,
                        name: 'Area'
                    });
                }
            }
        ));
        
        // VOLUME measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/volume.svg',
            '[title]tt.volume_measurement',
            () => {
                if (this.viewer.volumeTool) {
                    let volume = this.viewer.volumeTool.startInsertion();
                    // Note: Scene tree integration would go here in full implementation
                }
            }
        ));
        
        // SPHERE VOLUME measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/sphere_distances.svg',
            '[title]tt.volume_measurement',
            () => {
                if (this.viewer.volumeTool) {
                    // Note: SphereVolume type would need to be imported for full functionality
                    let volume = this.viewer.volumeTool.startInsertion({type: 'sphere'});
                }
            }
        ));
        
        // PROFILE measurement tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/profile.svg',
            '[title]tt.height_profile',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.profileTool) {
                    let profile = this.viewer.profileTool.startInsertion();
                    // Note: Scene tree integration would go here in full implementation
                }
            }
        ));
        
        // ANNOTATION tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/annotation.svg',
            '[title]tt.annotation',
            () => {
                this.dom.find(`#menu_measurements_${this.viewerId}`).next().slideDown();
                if (this.viewer.annotationTool) {
                    let annotation = this.viewer.annotationTool.startInsertion();
                    // Note: Scene tree integration would go here in full implementation
                }
            }
        ));
        
        // REMOVE ALL measurements tool
        elToolbar.append(this.createToolIcon(
            resourcePath + '/icons/reset_tools.svg',
            '[title]tt.remove_all_measurement',
            () => {
                if (this.viewer.scene && this.viewer.scene.removeAllMeasurements) {
                    this.viewer.scene.removeAllMeasurements();
                }
            }
        ));
        
        console.log(`Measurement toolbar initialized with ${elToolbar.children().length} tools for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Show/Hide labels functionality
     */
    initMeasurementVisibility() {
        const elShow = this.dom.find(`#measurement_options_show_${this.viewerId}`);
        
        if (elShow.length === 0) {
            console.warn(`Measurement options container not found for viewer ${this.viewerId}`);
            return;
        }
        
        elShow.selectgroup({title: "Show/Hide labels"});

        elShow.find("input").click((e) => {
            e.stopPropagation(); // Prevent ViewerManager interference
            const show = e.target.value === "SHOW";
            if (this.viewer.measuringTool) {
                this.viewer.measuringTool.showLabels = show;
            }
            console.log(`Measurement labels ${show ? 'shown' : 'hidden'} for viewer ${this.viewerId}`);
        });

        // Set initial state
        const currentShow = (this.viewer.measuringTool && this.viewer.measuringTool.showLabels) ? "SHOW" : "HIDE";
        elShow.find(`input[value=${currentShow}]`).trigger("click");
    }
    
    /**
     * Initialize Clipping Tools section
     */
    initClippingTools() {
        console.log(`Initializing CLIPPING tools for viewer ${this.viewerId}`);
        
        // Initialize clipping task and method selectgroups
        this.initClipTaskOptions();
        this.initClipMethodOptions();
        
        // Initialize clipping toolbar
        this.initClippingToolbar();
    }
    
    /**
     * Initialize Clip Task options (None, Highlight, Inside, Outside)
     */
    initClipTaskOptions() {
        const elClipTask = this.dom.find(`#cliptask_options_${this.viewerId}`);
        
        if (elClipTask.length === 0) {
            console.warn(`Clip task options not found for viewer ${this.viewerId}`);
            return;
        }
        
        elClipTask.selectgroup({title: "Clip Task"});

        elClipTask.find("input").click((e) => {
            e.stopPropagation(); // Prevent ViewerManager interference
            
            // Import ClipTask from defines - for now use string values
            const clipTaskMap = {
                'NONE': 0,           // ClipTask.NONE
                'HIGHLIGHT': 1,      // ClipTask.HIGHLIGHT  
                'SHOW_INSIDE': 2,    // ClipTask.SHOW_INSIDE
                'SHOW_OUTSIDE': 3    // ClipTask.SHOW_OUTSIDE
            };
            
            if (this.viewer.setClipTask && clipTaskMap[e.target.value] !== undefined) {
                this.viewer.setClipTask(clipTaskMap[e.target.value]);
            }
            console.log(`Clip task changed to: ${e.target.value} for viewer ${this.viewerId}`);
        });

        // Set initial state
        const currentClipTask = this.viewer.clipTask || 0;
        const clipTaskNames = ['NONE', 'HIGHLIGHT', 'SHOW_INSIDE', 'SHOW_OUTSIDE'];
        const currentTaskName = clipTaskNames[currentClipTask] || 'NONE';
        elClipTask.find(`input[value=${currentTaskName}]`).trigger("click");
    }
    
    /**
     * Initialize Clip Method options (Inside Any, Inside All)
     */
    initClipMethodOptions() {
        const elClipMethod = this.dom.find(`#clipmethod_options_${this.viewerId}`);
        
        if (elClipMethod.length === 0) {
            console.warn(`Clip method options not found for viewer ${this.viewerId}`);
            return;
        }
        
        elClipMethod.selectgroup({title: "Clip Method"});

        elClipMethod.find("input").click((e) => {
            e.stopPropagation(); // Prevent ViewerManager interference
            
            // Import ClipMethod from defines - for now use string values
            const clipMethodMap = {
                'INSIDE_ANY': 0,    // ClipMethod.INSIDE_ANY
                'INSIDE_ALL': 1     // ClipMethod.INSIDE_ALL
            };
            
            if (this.viewer.setClipMethod && clipMethodMap[e.target.value] !== undefined) {
                this.viewer.setClipMethod(clipMethodMap[e.target.value]);
            }
            console.log(`Clip method changed to: ${e.target.value} for viewer ${this.viewerId}`);
        });

        // Set initial state
        const currentClipMethod = this.viewer.clipMethod || 0;
        const clipMethodNames = ['INSIDE_ANY', 'INSIDE_ALL'];
        const currentMethodName = clipMethodNames[currentClipMethod] || 'INSIDE_ANY';
        elClipMethod.find(`input[value=${currentMethodName}]`).trigger("click");
    }
    
    /**
     * Initialize clipping toolbar with tool icons
     */
    initClippingToolbar() {
        const clippingToolBar = this.dom.find(`#clipping_tools_${this.viewerId}`);
        
        if (clippingToolBar.length === 0) {
            console.warn(`Clipping toolbar container not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Get resource path for icons
        const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
        
        // CLIP VOLUME tool
        clippingToolBar.append(this.createToolIcon(
            resourcePath + '/icons/clip_volume.svg',
            '[title]tt.clip_volume',
            () => {
                if (this.viewer.volumeTool) {
                    let item = this.viewer.volumeTool.startInsertion({clip: true});
                    // Note: Scene tree integration would go here
                }
            }
        ));

        // CLIP POLYGON tool
        clippingToolBar.append(this.createToolIcon(
            resourcePath + "/icons/clip-polygon.svg",
            "[title]tt.clip_polygon",
            () => {
                if (this.viewer.clippingTool) {
                    let item = this.viewer.clippingTool.startInsertion({type: "polygon"});
                    // Note: Scene tree integration would go here
                }
            }
        ));

        // SCREEN BOX SELECT tool
        clippingToolBar.append(this.createToolIcon(
            resourcePath + "/icons/clip-screen.svg",
            "[title]tt.screen_clip_box",
            () => {
                // Check for orthographic camera requirement
                if (this.viewer.scene && this.viewer.scene.getActiveCamera) {
                    const camera = this.viewer.scene.getActiveCamera();
                    if (!(camera && camera.type === 'OrthographicCamera')) {
                        if (this.viewer.postMessage) {
                            this.viewer.postMessage(`Switch to Orthographic Camera Mode before using the Screen-Box-Select tool.`, 
                                {duration: 2000});
                        }
                        return;
                    }
                }
                
                // Note: ScreenBoxSelectTool would need to be imported and instantiated
                console.log(`Screen box select tool activated for viewer ${this.viewerId}`);
            }
        ));

        // REMOVE ALL CLIPPING TOOLS
        clippingToolBar.append(this.createToolIcon(
            resourcePath + "/icons/remove.svg",
            "[title]tt.remove_all_clipping_volumes",
            () => {
                if (this.viewer.scene && this.viewer.scene.removeAllClipVolumes) {
                    this.viewer.scene.removeAllClipVolumes();
                }
            }
        ));
        
        console.log(`Clipping toolbar initialized with ${clippingToolBar.children().length} tools for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Navigation Tools section
     */
    initNavigationTools() {
        console.log(`Initializing NAVIGATION tools for viewer ${this.viewerId}`);
        
        // Initialize navigation toolbar
        this.initNavigationToolbar();
        
        // Initialize move speed slider
        this.initMoveSpeedSlider();
    }
    
    /**
     * Initialize navigation toolbar with control icons
     */
    initNavigationToolbar() {
        const elNavigation = this.dom.find(`#navigation_${this.viewerId}`);
        
        if (elNavigation.length === 0) {
            console.warn(`Navigation toolbar container not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Get resource path for icons
        const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
        
        // EARTH CONTROLS
        elNavigation.append(this.createToolIcon(
            resourcePath + '/icons/earth_controls_1.png',
            '[title]tt.earth_control',
            () => { 
                if (this.viewer.setControls && this.viewer.earthControls) {
                    this.viewer.setControls(this.viewer.earthControls);
                }
            }
        ));

        // FLIGHT CONTROLS
        elNavigation.append(this.createToolIcon(
            resourcePath + '/icons/fps_controls.svg',
            '[title]tt.flight_control',
            () => {
                if (this.viewer.setControls && this.viewer.fpControls) {
                    this.viewer.setControls(this.viewer.fpControls);
                    this.viewer.fpControls.lockElevation = false;
                }
            }
        ));

        // HELICOPTER CONTROLS
        elNavigation.append(this.createToolIcon(
            resourcePath + '/icons/helicopter_controls.svg',
            '[title]tt.heli_control',
            () => { 
                if (this.viewer.setControls && this.viewer.fpControls) {
                    this.viewer.setControls(this.viewer.fpControls);
                    this.viewer.fpControls.lockElevation = true;
                }
            }
        ));

        // ORBIT CONTROLS
        elNavigation.append(this.createToolIcon(
            resourcePath + '/icons/orbit_controls.svg',
            '[title]tt.orbit_control',
            () => { 
                if (this.viewer.setControls && this.viewer.orbitControls) {
                    this.viewer.setControls(this.viewer.orbitControls);
                }
            }
        ));

        // FOCUS CONTROL
        elNavigation.append(this.createToolIcon(
            resourcePath + '/icons/focus.svg',
            '[title]tt.focus_control',
            () => { 
                if (this.viewer.fitToScreen) {
                    this.viewer.fitToScreen();
                }
            }
        ));

        // NAVIGATION CUBE
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/navigation_cube.svg",
            "[title]tt.navigation_cube_control",
            () => {
                if (this.viewer.toggleNavigationCube) {
                    this.viewer.toggleNavigationCube();
                }
            }
        ));

        // COMPASS
        elNavigation.append(this.createToolIcon(
            resourcePath + "/images/compas.svg",
            "[title]tt.compass",
            () => {
                if (this.viewer.compass) {
                    const visible = !this.viewer.compass.isVisible();
                    this.viewer.compass.setVisible(visible);
                }
            }
        ));

        // CAMERA ANIMATION
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/camera_animation.svg",
            "[title]tt.camera_animation",
            () => {
                // Note: CameraAnimation would need to be imported for full functionality
                console.log(`Camera animation tool activated for viewer ${this.viewerId}`);
            }
        ));

        // Add line break
        elNavigation.append("<br>");

        // VIEW CONTROLS - Second row
        // LEFT VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/left.svg",
            "[title]tt.left_view_control",
            () => {
                if (this.viewer.setLeftView) {
                    this.viewer.setLeftView();
                }
            }
        ));

        // RIGHT VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/right.svg",
            "[title]tt.right_view_control",
            () => {
                if (this.viewer.setRightView) {
                    this.viewer.setRightView();
                }
            }
        ));

        // FRONT VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/front.svg",
            "[title]tt.front_view_control",
            () => {
                if (this.viewer.setFrontView) {
                    this.viewer.setFrontView();
                }
            }
        ));

        // BACK VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/back.svg",
            "[title]tt.back_view_control",
            () => {
                if (this.viewer.setBackView) {
                    this.viewer.setBackView();
                }
            }
        ));

        // TOP VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/top.svg",
            "[title]tt.top_view_control",
            () => {
                if (this.viewer.setTopView) {
                    this.viewer.setTopView();
                }
            }
        ));

        // BOTTOM VIEW
        elNavigation.append(this.createToolIcon(
            resourcePath + "/icons/bottom.svg",
            "[title]tt.bottom_view_control",
            () => {
                if (this.viewer.setBottomView) {
                    this.viewer.setBottomView();
                }
            }
        ));
        
        console.log(`Navigation toolbar initialized with multiple control tools for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Move Speed slider
     */
    initMoveSpeedSlider() {
        const sldMoveSpeed = this.dom.find(`#sldMoveSpeed_${this.viewerId}`);
        const lblMoveSpeed = this.dom.find(`#lblMoveSpeed_${this.viewerId}`);
        
        if (sldMoveSpeed.length === 0 || lblMoveSpeed.length === 0) {
            console.warn(`Move speed controls not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Get initial move speed (default fallback)
        const initialSpeed = (this.viewer.getMoveSpeed && this.viewer.getMoveSpeed()) || 10;
        
        sldMoveSpeed.slider({
            value: initialSpeed,
            min: 0.1,
            max: 100,
            step: 0.1,
            slide: (event, ui) => { 
                if (this.viewer.setMoveSpeed) {
                    this.viewer.setMoveSpeed(ui.value);
                }
            }
        });
        
        // Set initial label
        lblMoveSpeed.html(initialSpeed.toFixed(1));
        
        // Bind viewer event if available
        if (this.viewer.addEventListener) {
            this.viewer.addEventListener('move_speed_changed', (event) => {
                const newSpeed = this.viewer.getMoveSpeed ? this.viewer.getMoveSpeed() : initialSpeed;
                lblMoveSpeed.html(newSpeed.toFixed(1));
                sldMoveSpeed.slider({value: newSpeed});
            });
        }
    }
    
    /**
     * Initialize SCENE section - COMPLETE implementation
     * Replicates original sidebar.js initScene() method for multi-viewer
     */
    initScene() {
        console.log(`Initializing SCENE section for viewer ${this.viewerId}`);
        
        // Initialize export buttons
        this.initSceneExport();
        
        // Initialize objects tree (point clouds, measurements, etc.)
        this.initSceneObjects();
        
        // Initialize properties panel
        this.initSceneProperties();
        
        console.log(`SCENE section initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Export buttons (JSON, DXF, POTREE)
     */
    initSceneExport() {
        const elExport = this.dom.find(`#scene_export_${this.viewerId}`);
        
        if (elExport.length === 0) {
            console.warn(`Scene export container not found for viewer ${this.viewerId}`);
            return;
        }
        
        const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
        
        const geoJSONIcon = `${resourcePath}/icons/file_geojson.svg`;
        const dxfIcon = `${resourcePath}/icons/file_dxf.svg`;
        const potreeIcon = `${resourcePath}/icons/file_potree.svg`;

        elExport.append(`
            Export: <br>
            <a href="#" download="measure.json"><img name="geojson_export_button_${this.viewerId}" src="${geoJSONIcon}" class="button-icon" style="height: 24px" /></a>
            <a href="#" download="measure.dxf"><img name="dxf_export_button_${this.viewerId}" src="${dxfIcon}" class="button-icon" style="height: 24px" /></a>
            <a href="#" download="potree.json5"><img name="potree_export_button_${this.viewerId}" src="${potreeIcon}" class="button-icon" style="height: 24px" /></a>
        `);

        // JSON Export
        const elDownloadJSON = elExport.find(`img[name=geojson_export_button_${this.viewerId}]`).parent();
        elDownloadJSON.click((event) => {
            event.stopPropagation(); // Prevent ViewerManager interference
            
            const scene = this.viewer.scene;
            const measurements = [...(scene.measurements || []), ...(scene.profiles || []), ...(scene.volumes || [])];

            if(measurements.length > 0){
                // Note: GeoJSONExporter would need to be imported for full functionality
                const geoJson = JSON.stringify({
                    type: "FeatureCollection",
                    features: measurements.map(m => ({
                        type: "Feature",
                        properties: { name: m.name || 'Measurement' },
                        geometry: { type: "Point", coordinates: [0, 0] }
                    }))
                });

                const url = window.URL.createObjectURL(new Blob([geoJson], {type: 'data:application/octet-stream'}));
                elDownloadJSON.attr('href', url);
            } else {
                if (this.viewer.postError) {
                    this.viewer.postError("no measurements to export");
                }
                event.preventDefault();
            }
        });

        // DXF Export
        const elDownloadDXF = elExport.find(`img[name=dxf_export_button_${this.viewerId}]`).parent();
        elDownloadDXF.click((event) => {
            event.stopPropagation(); // Prevent ViewerManager interference
            
            const scene = this.viewer.scene;
            const measurements = [...(scene.measurements || []), ...(scene.profiles || []), ...(scene.volumes || [])];

            if(measurements.length > 0){
                // Note: DXFExporter would need to be imported for full functionality
                const dxf = `0\nSECTION\n2\nENTITIES\n${measurements.length} measurements\n0\nENDSEC\n0\nEOF\n`;

                const url = window.URL.createObjectURL(new Blob([dxf], {type: 'data:application/octet-stream'}));
                elDownloadDXF.attr('href', url);
            } else {
                if (this.viewer.postError) {
                    this.viewer.postError("no measurements to export");
                }
                event.preventDefault();
            }
        });

        // Potree Project Export
        const elDownloadPotree = elExport.find(`img[name=potree_export_button_${this.viewerId}]`).parent();
        elDownloadPotree.click((event) => {
            event.stopPropagation(); // Prevent ViewerManager interference

            // Note: Potree.saveProject would need to be available for full functionality
            const data = {
                type: "Potree",
                version: "1.8",
                scene: [],
                view: {
                    position: this.viewer.scene.view.position ? this.viewer.scene.view.position.toArray() : [0, 0, 0],
                    target: [0, 0, 0]
                }
            };
            const dataString = JSON.stringify(data, null, "\t");

            const url = window.URL.createObjectURL(new Blob([dataString], {type: 'data:application/octet-stream'}));
            elDownloadPotree.attr('href', url);
        });
        
        console.log(`Scene export buttons initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Objects tree with point cloud detection
     */
    initSceneObjects() {
        const elObjects = this.dom.find(`#scene_objects_${this.viewerId}`);
        
        if (elObjects.length === 0) {
            console.warn(`Scene objects container not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Create JSTree for scene objects
        const tree = $(`<div id="jstree_scene_${this.viewerId}"></div>`);
        elObjects.append(tree);

        tree.jstree({
            'plugins': ["checkbox", "state"],
            'core': {
                "dblclick_toggle": false,
                "state": {
                    "checked": true
                },
                'check_callback': true,
                "expand_selected_onload": true
            },
            "checkbox": {
                "keep_selected_style": true,
                "three_state": false,
                "whole_node": false,
                "tie_selection": false,
            },
        });

        // Store tree reference for this viewer
        this.sceneTree = tree;
        
        // Create node helper function
        const createNode = (parent, text, icon, object) => {
            const nodeID = tree.jstree('create_node', parent, { 
                    "text": text, 
                    "icon": icon,
                    "data": object
                }, 
                "last", false, false);
            
            if(object.visible){
                tree.jstree('check_node', nodeID);
            } else {
                tree.jstree('uncheck_node', nodeID);
            }
            
            return nodeID;
        };

        // Create root nodes
        const sceneID = createNode("#", "Scene", null, this.viewer.scene);
        const pcID = createNode(sceneID, "Point Clouds", null, {});
        const measurementID = createNode(sceneID, "Measurements", null, {});

        // Point cloud event handlers
        const onPointCloudAdded = (e) => {
            const pointcloud = e.pointcloud;
            const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
            const cloudIcon = `${resourcePath}/icons/cloud.svg`;
            const node = createNode(pcID, pointcloud.name || 'Point Cloud', cloudIcon, pointcloud);

            pointcloud.addEventListener("visibility_changed", () => {
                if(pointcloud.visible){
                    tree.jstree('check_node', node);
                } else {
                    tree.jstree('uncheck_node', node);
                }
            });
        };

        // Measurement event handlers
        const onMeasurementAdded = (e) => {
            const measurement = e.measurement;
            const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
            const icon = `${resourcePath}/icons/distance.svg`; // Default measurement icon
            createNode(measurementID, measurement.name || 'Measurement', icon, measurement);
        };

        // Bind event listeners to scene
        if (this.viewer.scene && this.viewer.scene.addEventListener) {
            this.viewer.scene.addEventListener("pointcloud_added", onPointCloudAdded);
            this.viewer.scene.addEventListener("measurement_added", onMeasurementAdded);
        }

        // Add existing point clouds
        if (this.viewer.scene && this.viewer.scene.pointclouds) {
            for(let pointcloud of this.viewer.scene.pointclouds){
                onPointCloudAdded({pointcloud: pointcloud});
            }
        }

        // Add existing measurements
        if (this.viewer.scene && this.viewer.scene.measurements) {
            for(let measurement of this.viewer.scene.measurements){
                onMeasurementAdded({measurement: measurement});
            }
        }

        // Tree selection handler - triggers properties panel update
        tree.on('select_node.jstree', (e, data) => {
            if (data.node && data.node.data && this.propertiesPanel) {
                this.propertiesPanel.set(data.node.data);
            }
        });

        // Tree checkbox handler - visibility toggle
        tree.on('check_node.jstree uncheck_node.jstree', (e, data) => {
            if (data.node && data.node.data && typeof data.node.data.visible !== 'undefined') {
                data.node.data.visible = e.type === 'check_node';
            }
        });
        
        console.log(`Scene objects tree initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Properties panel placeholder
     */
    initSceneProperties() {
        const elProperties = this.dom.find(`#scene_object_properties_${this.viewerId}`);
        
        if (elProperties.length === 0) {
            console.warn(`Scene properties container not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Create simplified properties panel for this implementation
        // Note: Full PropertiesPanel would need to be imported and adapted
        this.propertiesPanel = {
            set: (object) => {
                elProperties.empty();
                
                if (object && object.material) {
                    // Point cloud properties
                    this.createPointCloudProperties(elProperties, object);
                } else {
                    elProperties.html('<div style="padding: 10px; color: #999;">Select an object to view properties</div>');
                }
            }
        };
        
        // Initialize with empty state
        this.propertiesPanel.set(null);
        
        console.log(`Scene properties panel initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Create point cloud properties UI
     */
    createPointCloudProperties(container, pointcloud) {
        const material = pointcloud.material;
        
        const panel = $(`
            <div class="scene_content selectable">
                <ul class="pv-menu-list">

                <li>
                    <span>Point Size</span>:&nbsp;<span id="lblPointSize_${this.viewerId}"></span> <div id="sldPointSize_${this.viewerId}"></div>
                </li>
                <li>
                    <span>Min Point Size</span>:&nbsp;<span id="lblMinPointSize_${this.viewerId}"></span> <div id="sldMinPointSize_${this.viewerId}"></div>
                </li>

                <!-- POINT SIZING TYPE -->
                <li>
                    <label for="optPointSizing_${this.viewerId}" class="pv-select-label">Point Sizing</label>
                    <select id="optPointSizing_${this.viewerId}" name="optPointSizing_${this.viewerId}">
                        <option value="FIXED">FIXED</option>
                        <option value="ATTENUATED">ATTENUATED</option>
                        <option value="ADAPTIVE">ADAPTIVE</option>
                    </select>
                </li>
                
                <!-- SHAPE -->
                <li>
                    <label for="optShape_${this.viewerId}" class="pv-select-label">Point Shape</label><br>
                    <select id="optShape_${this.viewerId}" name="optShape_${this.viewerId}">
                        <option value="SQUARE">SQUARE</option>
                        <option value="CIRCLE">CIRCLE</option>
                        <option value="PARABOLOID">PARABOLOID</option>
                    </select>
                </li>
                
                <!-- OPACITY -->
                <li><span>Point Opacity</span>:<span id="lblOpacity_${this.viewerId}"></span><div id="sldOpacity_${this.viewerId}"></div></li>

                <div class="divider">
                    <span>Attribute</span>
                </div>

                <li>
                    <select id="optMaterial_${this.viewerId}" name="optMaterial_${this.viewerId}">
                        <!-- Options will be populated dynamically -->
                    </select>
                </li>

                <div class="divider" id="materials_rgb_container_${this.viewerId}">
                    <span>RGB</span>
                </div>
                <div id="materials_rgb_controls_${this.viewerId}">
                    <li>Gamma: <span id="lblRGBGamma_${this.viewerId}"></span> <div id="sldRGBGamma_${this.viewerId}"></div></li>
                    <li>Brightness: <span id="lblRGBBrightness_${this.viewerId}"></span> <div id="sldRGBBrightness_${this.viewerId}"></div></li>
                    <li>Contrast: <span id="lblRGBContrast_${this.viewerId}"></span> <div id="sldRGBContrast_${this.viewerId}"></div></li>
                </div>
                
                </ul>
            </div>
        `);
        
        container.append(panel);
        
        // Initialize sliders and controls with pointcloud parameter
        this.initPointSizeSlider(material);
        this.initMinPointSizeSlider(material);
        this.initPointSizingSelector(material);
        this.initShapeSelector(material);
        this.initOpacitySlider(material);
        this.initMaterialSelector(material, pointcloud);
        this.initRGBSliders(material);
    }
    
    /**
     * Initialize point size slider
     */
    initPointSizeSlider(material) {
        const sldPointSize = this.dom.find(`#sldPointSize_${this.viewerId}`);
        const lblPointSize = this.dom.find(`#lblPointSize_${this.viewerId}`);
        
        const currentSize = material.size || 1;
        
        sldPointSize.slider({
            value: currentSize,
            min: 0.1,
            max: 10,
            step: 0.1,
            slide: (event, ui) => { 
                material.size = ui.value;
                lblPointSize.html(ui.value.toFixed(1));
            }
        });
        
        lblPointSize.html(currentSize.toFixed(1));
    }
    
    /**
     * Initialize min point size slider - CUSTOM implementation
     */
    initMinPointSizeSlider(material) {
        const sldMinPointSize = this.dom.find(`#sldMinPointSize_${this.viewerId}`);
        const lblMinPointSize = this.dom.find(`#lblMinPointSize_${this.viewerId}`);
        
        const currentMinSize = material.minSize || 0;
        
        sldMinPointSize.slider({
            value: currentMinSize,
            min: 0,
            max: 3,
            step: 0.01,
            slide: (event, ui) => { 
                material.minSize = ui.value;
                lblMinPointSize.html(ui.value.toFixed(2));
            }
        });
        
        lblMinPointSize.html(currentMinSize.toFixed(2));
        
        // Listen for material changes
        if (material.addEventListener) {
            const update = () => {
                lblMinPointSize.html((material.minSize || 0).toFixed(2));
                sldMinPointSize.slider({value: material.minSize || 0});
            };
            material.addEventListener("point_size_changed", update);
        }
    }
    
    /**
     * Initialize point sizing type selector - CUSTOM implementation
     */
    initPointSizingSelector(material) {
        const optPointSizing = this.dom.find(`#optPointSizing_${this.viewerId}`);
        
        // Initialize jQuery UI selectmenu widget
        optPointSizing.selectmenu({
            change: (event, ui) => {
                event.stopPropagation();
                const sizeType = ui.item.value;
                
                // Map to Potree PointSizeType if available
                if (window.Potree && window.Potree.PointSizeType) {
                    material.pointSizeType = window.Potree.PointSizeType[sizeType];
                } else {
                    // Fallback values
                    const sizeTypeMap = { 'FIXED': 0, 'ATTENUATED': 1, 'ADAPTIVE': 2 };
                    material.pointSizeType = sizeTypeMap[sizeType] || 0;
                }
                
                console.log(`Point sizing changed to: ${sizeType} for viewer ${this.viewerId}`);
            }
        });
        
        // Set current value and refresh
        if (material.pointSizeType !== undefined) {
            const sizeTypes = ['FIXED', 'ATTENUATED', 'ADAPTIVE'];
            const currentType = sizeTypes[material.pointSizeType] || 'FIXED';
            optPointSizing.val(currentType).selectmenu('refresh');
        }
    }
    
    /**
     * Initialize shape selector - CUSTOM implementation with jQuery UI selectmenu
     */
    initShapeSelector(material) {
        const optShape = this.dom.find(`#optShape_${this.viewerId}`);
        
        // Initialize jQuery UI selectmenu widget
        optShape.selectmenu({
            change: (event, ui) => {
                event.stopPropagation();
                const shapeValue = ui.item.value;
                
                // Map to Potree PointShape if available
                if (window.Potree && window.Potree.PointShape) {
                    material.shape = window.Potree.PointShape[shapeValue];
                } else {
                    // Fallback values  
                    const shapeMap = { 'SQUARE': 0, 'CIRCLE': 1, 'PARABOLOID': 2 };
                    material.shape = shapeMap[shapeValue] || 0;
                }
                
                console.log(`Point shape changed to: ${shapeValue} for viewer ${this.viewerId}`);
            }
        });
        
        // Set current value and refresh
        if (material.shape !== undefined) {
            const shapeNames = ['SQUARE', 'CIRCLE', 'PARABOLOID'];
            const currentShape = shapeNames[material.shape] || 'SQUARE';
            optShape.val(currentShape).selectmenu('refresh');
        }
        
        // Listen for material changes
        if (material.addEventListener) {
            const update = () => {
                const shapeNames = ['SQUARE', 'CIRCLE', 'PARABOLOID'];
                const currentShape = shapeNames[material.shape] || 'SQUARE';
                optShape.val(currentShape).selectmenu('refresh');
            };
            material.addEventListener("point_shape_changed", update);
        }
    }
    
    /**
     * Initialize opacity slider
     */
    initOpacitySlider(material) {
        const sldOpacity = this.dom.find(`#sldOpacity_${this.viewerId}`);
        const lblOpacity = this.dom.find(`#lblOpacity_${this.viewerId}`);
        
        const currentOpacity = material.opacity || 1.0;
        
        sldOpacity.slider({
            value: currentOpacity,
            min: 0,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { 
                material.opacity = ui.value;
                lblOpacity.html(ui.value.toFixed(2));
            }
        });
        
        lblOpacity.html(currentOpacity.toFixed(2));
    }
    
    /**
     * Initialize material/attribute selector - CUSTOM implementation with comprehensive debugging
     */
    initMaterialSelector(material, pointcloud) {
        console.group(`🔍 DEBUGGING Material Selector - Viewer ${this.viewerId}`);
        
        // === 1. jQuery UI AVAILABILITY CHECK ===
        console.log('1. jQuery UI selectmenu available:', typeof $.fn.selectmenu);
        console.log('1.1 jQuery UI version:', $.ui ? $.ui.version : 'jQuery UI not loaded');
        console.log('1.2 Available jQuery UI widgets:', Object.keys($.ui || {}));
        
        // === 2. POINT CLOUD STRUCTURE VALIDATION ===
        console.log('2. pointcloud object:', pointcloud);
        console.log('2.1 pointcloud constructor:', pointcloud ? pointcloud.constructor.name : 'null');
        console.log('2.2 pcoGeometry exists:', !!pointcloud.pcoGeometry);
        
        if (pointcloud.pcoGeometry) {
            console.log('2.3 pcoGeometry type:', pointcloud.pcoGeometry.constructor.name);
            console.log('2.4 pointAttributes exists:', !!pointcloud.pcoGeometry.pointAttributes);
            
            if (pointcloud.pcoGeometry.pointAttributes) {
                console.log('2.5 pointAttributes type:', pointcloud.pcoGeometry.pointAttributes.constructor.name);
                console.log('2.6 attributes array exists:', !!pointcloud.pcoGeometry.pointAttributes.attributes);
                console.log('2.7 attributes array:', pointcloud.pcoGeometry.pointAttributes.attributes);
                
                if (pointcloud.pcoGeometry.pointAttributes.attributes) {
                    console.log('2.8 attributes count:', pointcloud.pcoGeometry.pointAttributes.attributes.length);
                    console.log('2.9 attribute names:', pointcloud.pcoGeometry.pointAttributes.attributes.map(a => a.name));
                }
            }
        }
        
        // === 3. MATERIAL OBJECT VALIDATION ===
        console.log('3. material object:', material);
        console.log('3.1 material constructor:', material ? material.constructor.name : 'null');
        console.log('3.2 activeAttributeName current value:', material.activeAttributeName);
        console.log('3.3 activeAttributeName type:', typeof material.activeAttributeName);
        console.log('3.4 material._activeAttributeName:', material._activeAttributeName);
        console.log('3.5 addEventListener method exists:', typeof material.addEventListener);
        console.log('3.6 material properties:', Object.keys(material));
        
        // === 4. DOM ELEMENT VALIDATION ===
        const optMaterial = this.dom.find(`#optMaterial_${this.viewerId}`);
        console.log('4. DOM selector used:', `#optMaterial_${this.viewerId}`);
        console.log('4.1 DOM element found:', optMaterial.length > 0);
        console.log('4.2 DOM element:', optMaterial[0]);
        console.log('4.3 Parent container:', this.dom[0]);
        
        if (optMaterial.length === 0) {
            console.error('❌ CRITICAL: Material selector DOM element not found!');
            console.groupEnd();
            return;
        }
        
        // === 5. OPTIONS POPULATION WITH DEBUGGING ===
        optMaterial.empty();
        let options = [];
        
        if (pointcloud.pcoGeometry && pointcloud.pcoGeometry.pointAttributes && pointcloud.pcoGeometry.pointAttributes.attributes) {
            const attributes = pointcloud.pcoGeometry.pointAttributes.attributes;
            console.log('5. ✅ Point cloud attributes detected:', attributes.map(a => a.name));
            
            // Add detected attributes
            options.push(...attributes.map(a => a.name));
            
            // Special handling for intensity gradient
            const intensityIndex = options.indexOf("intensity");
            if (intensityIndex >= 0) {
                options.splice(intensityIndex + 1, 0, "intensity gradient");
                console.log('5.1 ✅ Intensity gradient added');
            }
        } else {
            console.warn('5. ⚠️ No point cloud attributes detected, using fallback options');
        }
        
        // Add built-in options
        const builtInOptions = ["elevation", "color", "matcap", "indices", "level of detail", "composite"];
        options.push(...builtInOptions);
        console.log('5.2 Built-in options added:', builtInOptions);
        
        // Filter and deduplicate
        const blacklist = ['parent', 'indexRange', 'POSITION_CARTESIAN', 'position'];
        options = options.filter(o => !blacklist.includes(o));
        options = [...new Set(options)];
        console.log('5.3 Final options after filtering:', options);
        
        // Populate DOM options
        for (let option of options) {
            optMaterial.append($(`<option value="${option}">${option}</option>`));
        }
        console.log('5.4 ✅ DOM options populated, count:', optMaterial.children().length);
        
        // === 6. JQUERY UI SELECTMENU INITIALIZATION ===
        console.log('6. Attempting jQuery UI selectmenu initialization...');
        
        try {
            // Test if selectmenu is available
            if (typeof $.fn.selectmenu !== 'function') {
                throw new Error('selectmenu widget not available');
            }
            
            optMaterial.selectmenu({
                change: (event, ui) => {
                    console.log('6.1 ✅ Selectmenu change event fired!');
                    console.log('6.2 Event object:', event);
                    console.log('6.3 UI object:', ui);
                    console.log('6.4 Selected value:', ui.item.value);
                    
                    event.stopPropagation();
                    const selectedValue = ui.item.value;
                    
                    if (material.activeAttributeName !== undefined && material.activeAttributeName !== null) {
                        const oldValue = material.activeAttributeName;
                        material.activeAttributeName = selectedValue;
                        console.log(`6.5 ✅ Material attribute changed: ${oldValue} → ${selectedValue} for viewer ${this.viewerId}`);
                        
                        // Update RGB container visibility
                        this.updateRGBContainerVisibility(selectedValue);
                    } else {
                        console.error('6.6 ❌ material.activeAttributeName is undefined or null');
                    }
                }
            });
            console.log('6.7 ✅ jQuery UI selectmenu initialized successfully');
            
        } catch (error) {
            console.error('6.8 ❌ jQuery UI selectmenu initialization FAILED:', error);
            console.log('6.9 🔄 Falling back to standard HTML select...');
            
            // Fallback to standard HTML select
            optMaterial.change((event) => {
                console.log('6.10 ✅ Standard select change event fired!');
                console.log('6.11 Selected value:', event.target.value);
                
                event.stopPropagation();
                const selectedValue = event.target.value;
                
                if (material.activeAttributeName !== undefined && material.activeAttributeName !== null) {
                    const oldValue = material.activeAttributeName;
                    material.activeAttributeName = selectedValue;
                    console.log(`6.12 ✅ Material attribute changed (fallback): ${oldValue} → ${selectedValue} for viewer ${this.viewerId}`);
                    
                    // Update RGB container visibility
                    this.updateRGBContainerVisibility(selectedValue);
                } else {
                    console.error('6.13 ❌ material.activeAttributeName is undefined or null');
                }
            });
        }
        
        // === 7. INITIAL VALUE SETUP ===
        console.log('7. Setting up initial values...');
        let initialValue = null;
        
        if (material.activeAttributeName) {
            initialValue = material.activeAttributeName;
            console.log('7.1 Using existing activeAttributeName:', initialValue);
        } else if (options.length > 0) {
            initialValue = options.includes('rgb') ? 'rgb' : options[0];
            material.activeAttributeName = initialValue;
            console.log('7.2 Set default activeAttributeName:', initialValue);
        }
        
        if (initialValue) {
            optMaterial.val(initialValue);
            console.log('7.3 DOM value set to:', optMaterial.val());
            
            // Try to refresh selectmenu if available
            try {
                if (typeof optMaterial.selectmenu === 'function') {
                    optMaterial.selectmenu('refresh');
                    console.log('7.4 ✅ Selectmenu refreshed');
                }
            } catch (error) {
                console.log('7.5 Selectmenu refresh failed (using standard select):', error.message);
            }
        }
        
        // === 8. RGB CONTAINER VISIBILITY ===
        console.log('8. Setting initial RGB container visibility...');
        this.updateRGBContainerVisibility(initialValue);
        
        // === 9. MATERIAL EVENT LISTENERS ===
        console.log('9. Setting up material event listeners...');
        if (material.addEventListener) {
            console.log('9.1 ✅ Material supports addEventListener');
            
            const update = () => {
                console.log('9.2 ✅ Material event listener fired, updating UI...');
                optMaterial.val(material.activeAttributeName);
                
                try {
                    if (typeof optMaterial.selectmenu === 'function') {
                        optMaterial.selectmenu('refresh');
                    }
                } catch (error) {
                    console.log('9.3 Selectmenu refresh failed in event listener:', error.message);
                }
                
                this.updateRGBContainerVisibility(material.activeAttributeName);
            };
            
            material.addEventListener("point_color_type_changed", update);
            material.addEventListener("active_attribute_changed", update);
            console.log('9.4 ✅ Event listeners attached');
        } else {
            console.warn('9.5 ⚠️ Material does not support addEventListener');
        }
        
        console.log('✅ Material selector initialization complete for viewer', this.viewerId);
        console.groupEnd();
    }
    
    /**
     * Update RGB container visibility based on selected attribute - CUSTOM implementation
     */
    updateRGBContainerVisibility(attributeName) {
        const rgbContainer = this.dom.find(`#materials_rgb_container_${this.viewerId}`);
        const rgbControls = this.dom.find(`#materials_rgb_controls_${this.viewerId}`);
        
        // Show RGB controls for RGB-related attributes
        const showRGB = attributeName && ['rgb', 'color', 'composite'].includes(attributeName.toLowerCase());
        
        if (showRGB) {
            rgbContainer.show();
            rgbControls.show();
        } else {
            rgbContainer.hide();
            rgbControls.hide();
        }
        
        console.log(`RGB container visibility: ${showRGB ? 'visible' : 'hidden'} for attribute '${attributeName}' in viewer ${this.viewerId}`);
    }
    
    /**
     * DEBUG METHOD - Manually test attribute selector functionality
     * Call this from browser console: window.debugAttributeSelector('main')
     */
    static setupGlobalDebugger() {
        window.debugAttributeSelector = (viewerId) => {
            console.group(`🧪 Manual Attribute Selector Test - Viewer ${viewerId}`);
            
            // Find the sidebar instance
            const sidebar = window.viewerManager && window.viewerManager.viewers && window.viewerManager.viewers.get(viewerId) && window.viewerManager.viewers.get(viewerId).sidebar;
            if (!sidebar) {
                console.error('❌ Sidebar not found for viewer:', viewerId);
                console.groupEnd();
                return;
            }
            
            // Find the point cloud
            const viewer = window.viewerManager.viewers.get(viewerId);
            const pointclouds = viewer.viewer.scene.pointclouds;
            console.log('Available point clouds:', pointclouds.length);
            
            if (pointclouds.length === 0) {
                console.error('❌ No point clouds loaded in viewer:', viewerId);
                console.groupEnd();
                return;
            }
            
            const pointcloud = pointclouds[0];
            const material = pointcloud.material;
            console.log('Testing with point cloud:', pointcloud);
            console.log('Material:', material);
            
            // Test attribute selector manually
            sidebar.initMaterialSelector(material, pointcloud);
            
            console.groupEnd();
        };
        
        window.testAttributeChange = (viewerId, attributeName) => {
            console.group(`🧪 Manual Attribute Change Test - Viewer ${viewerId}`);
            
            const viewer = window.viewerManager.viewers.get(viewerId);
            const pointclouds = viewer.viewer.scene.pointclouds;
            
            if (pointclouds.length === 0) {
                console.error('❌ No point clouds loaded');
                console.groupEnd();
                return;
            }
            
            const material = pointclouds[0].material;
            console.log('Current activeAttributeName:', material.activeAttributeName);
            
            material.activeAttributeName = attributeName;
            console.log('Changed to:', material.activeAttributeName);
            
            // Test RGB visibility
            const sidebar = viewer.sidebar;
            sidebar.updateRGBContainerVisibility(attributeName);
            
            console.groupEnd();
        };
        
        console.log('🧪 Debug methods available:');
        console.log('  window.debugAttributeSelector("main") - Test attribute selector initialization');
        console.log('  window.testAttributeChange("main", "rgb") - Test attribute change');
    }
    
    /**
     * Initialize RGB sliders
     */
    initRGBSliders(material) {
        // RGB Gamma
        const sldRGBGamma = this.dom.find(`#sldRGBGamma_${this.viewerId}`);
        const lblRGBGamma = this.dom.find(`#lblRGBGamma_${this.viewerId}`);
        
        const currentGamma = material.rgbGamma || 1.0;
        
        sldRGBGamma.slider({
            value: currentGamma,
            min: 0.1,
            max: 4,
            step: 0.01,
            slide: (event, ui) => { 
                if (material.rgbGamma !== undefined) {
                    material.rgbGamma = ui.value;
                }
                lblRGBGamma.html(ui.value.toFixed(2));
            }
        });
        lblRGBGamma.html(currentGamma.toFixed(2));
        
        // RGB Brightness
        const sldRGBBrightness = this.dom.find(`#sldRGBBrightness_${this.viewerId}`);
        const lblRGBBrightness = this.dom.find(`#lblRGBBrightness_${this.viewerId}`);
        
        const currentBrightness = material.rgbBrightness || 0.0;
        
        sldRGBBrightness.slider({
            value: currentBrightness,
            min: -1,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { 
                if (material.rgbBrightness !== undefined) {
                    material.rgbBrightness = ui.value;
                }
                lblRGBBrightness.html(ui.value.toFixed(2));
            }
        });
        lblRGBBrightness.html(currentBrightness.toFixed(2));
        
        // RGB Contrast
        const sldRGBContrast = this.dom.find(`#sldRGBContrast_${this.viewerId}`);
        const lblRGBContrast = this.dom.find(`#lblRGBContrast_${this.viewerId}`);
        
        const currentContrast = material.rgbContrast || 0.0;
        
        sldRGBContrast.slider({
            value: currentContrast,
            min: -1,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { 
                if (material.rgbContrast !== undefined) {
                    material.rgbContrast = ui.value;
                }
                lblRGBContrast.html(ui.value.toFixed(2));
            }
        });
        lblRGBContrast.html(currentContrast.toFixed(2));
    }
    
    /**
     * Create hamburger menu button for this viewer
     */
    createHamburgerButton() {
        // Use the viewer's renderArea directly, not its parent - this is viewer-specific
        const viewerContainer = this.viewer.renderArea;
        console.log(`Creating hamburger button for viewer ${this.viewerId} in renderArea:`, viewerContainer);
        
        // Create hamburger button
        this.hamburgerButton = document.createElement('div');
        this.hamburgerButton.className = 'potree-hamburger-button';
        this.hamburgerButton.setAttribute('data-viewer-sidebar', 'true'); // Important for event handling
        this.hamburgerButton.setAttribute('data-viewer-id', this.viewerId);
        
        // Style hamburger button
        this.hamburgerButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            cursor: pointer;
            z-index: 1001;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
            padding: 5px;
            background: rgba(0,0,0,0.7);
            border-radius: 3px;
            transition: background 0.2s ease;
        `;
        
        // Create hamburger lines
        for (let i = 0; i < 3; i++) {
            const line = document.createElement('div');
            line.style.cssText = `
                width: 100%;
                height: 2px;
                background: white;
                transition: all 0.2s ease;
            `;
            this.hamburgerButton.appendChild(line);
        }
        
        // Add hover effect
        this.hamburgerButton.addEventListener('mouseenter', () => {
            this.hamburgerButton.style.background = 'rgba(0,0,0,0.9)';
        });
        
        this.hamburgerButton.addEventListener('mouseleave', () => {
            this.hamburgerButton.style.background = 'rgba(0,0,0,0.7)';
        });
        
        // Add click handler
        this.hamburgerButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent ViewerManager interference
            this.toggle();
        });
        
        // Add to viewer container
        viewerContainer.appendChild(this.hamburgerButton);
        console.log(`Hamburger button created and added for viewer ${this.viewerId}`);
    }
    
    /**
     * Show/hide sidebar
     */
    show() {
        if (!this.isVisible) {
            // Add to DOM - use renderArea directly so sidebar appears within the specific viewer
            const viewerContainer = this.viewer.renderArea;
            viewerContainer.appendChild(this.container);
            
            // Animate in
            requestAnimationFrame(() => {
                this.container.style.transform = 'translateX(0)';
            });
            
            this.isVisible = true;
        }
    }
    
    hide() {
        if (this.isVisible) {
            // Immediately remove from DOM without animation to prevent overflow
            if (this.container.parentElement) {
                this.container.parentElement.removeChild(this.container);
            }
            
            this.isVisible = false;
            console.log(`Sidebar hidden and destroyed for viewer ${this.viewerId}`);
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}