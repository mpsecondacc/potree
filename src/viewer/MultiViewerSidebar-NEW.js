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
import {ElevationGradientRepeat, CameraMode} from "../defines.js";

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
                    console.log(`About to initialize FILTERS for viewer ${this.viewerId}`);
                    this.initFilters();
                    
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

        // CUSTOM - Add Camera Projection Controls (Perspective/Orthographic)
        const elCameraProjection = $(`
            <selectgroup id="camera_projection_options_${this.viewerId}">
                <option id="camera_projection_options_perspective_${this.viewerId}" value="PERSPECTIVE">Perspective</option>
                <option id="camera_projection_options_orthigraphic_${this.viewerId}" value="ORTHOGRAPHIC">Orthographic</option>
            </selectgroup>
        `);
        
        elNavigation.append(elCameraProjection);
        elCameraProjection.selectgroup({title: "Camera Projection"});
        
        // Handle camera projection change
        elCameraProjection.find("input").click((e) => {
            console.log(`🎯 Camera projection button clicked: ${e.target.value} for viewer ${this.viewerId}`);
            console.log('🔍 Debug info:', {
                'viewer exists': !!this.viewer,
                'viewer.setCameraMode exists': !!(this.viewer && this.viewer.setCameraMode),
                'viewer.scene exists': !!(this.viewer && this.viewer.scene),
                'viewer.scene.pointclouds exists': !!(this.viewer && this.viewer.scene && this.viewer.scene.pointclouds),
                'pointclouds count': (this.viewer && this.viewer.scene && this.viewer.scene.pointclouds) ? this.viewer.scene.pointclouds.length : 0,
                'CameraMode[e.target.value]': CameraMode[e.target.value],
                'current cameraMode': (this.viewer && this.viewer.scene) ? this.viewer.scene.cameraMode : 'undefined'
            });
            
            if (this.viewer && this.viewer.setCameraMode && CameraMode[e.target.value] !== undefined) {
                console.log(`✅ Calling setCameraMode(${CameraMode[e.target.value]}) for viewer ${this.viewerId}`);
                this.viewer.setCameraMode(CameraMode[e.target.value]);
                
                // Verify the change took effect
                setTimeout(() => {
                    console.log(`🔄 After setCameraMode - current cameraMode: ${this.viewer.scene.cameraMode}`);
                }, 50);
            } else {
                console.error(`❌ Cannot call setCameraMode - missing dependencies for viewer ${this.viewerId}`);
            }
        });
        
        // Set initial camera projection state (with delay to ensure selectgroup is ready)
        setTimeout(() => {
            console.log(`🔧 Setting initial camera projection state for viewer ${this.viewerId}`);
            if (this.viewer.scene && this.viewer.scene.cameraMode !== undefined) {
                const cameraMode = Object.keys(CameraMode)
                    .filter(key => CameraMode[key] === this.viewer.scene.cameraMode);
                console.log(`📍 Initial cameraMode: ${this.viewer.scene.cameraMode}, matched key: ${cameraMode[0]}`);
                if (cameraMode.length > 0) {
                    const targetInput = elCameraProjection.find(`input[value=${cameraMode[0]}]`);
                    console.log(`🎛️ Found input element for ${cameraMode[0]}:`, targetInput.length > 0 ? 'YES' : 'NO');
                    if (targetInput.length > 0) {
                        targetInput.trigger("click");
                    }
                }
            } else {
                console.log(`⚠️ Cannot set initial state - viewer.scene.cameraMode is undefined for viewer ${this.viewerId}`);
            }
        }, 100);
        
        console.log(`Navigation toolbar initialized with multiple control tools for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize Move Speed slider - FIXED with exponential scaling like original sidebar.js
     */
    initMoveSpeedSlider() {
        const sldMoveSpeed = this.dom.find(`#sldMoveSpeed_${this.viewerId}`);
        const lblMoveSpeed = this.dom.find(`#lblMoveSpeed_${this.viewerId}`);
        
        if (sldMoveSpeed.length === 0 || lblMoveSpeed.length === 0) {
            console.warn(`Move speed controls not found for viewer ${this.viewerId}`);
            return;
        }
        
        // CUSTOM - Use same exponential scaling as original sidebar.js to fix earth controls bug
        const speedRange = new THREE.Vector2(1, 10 * 1000); // 1 to 10,000

        const toLinearSpeed = (value) => {
            return Math.pow(value, 4) * speedRange.y + speedRange.x; // Convert 0-1 slider position to 1-10000 speed
        };

        const toExpSpeed = (value) => {
            return Math.pow((value - speedRange.x) / speedRange.y, 1 / 4); // Convert 1-10000 speed to 0-1 slider position
        };
        
        // Get initial move speed (default fallback)
        const initialSpeed = (this.viewer.getMoveSpeed && this.viewer.getMoveSpeed()) || 10;
        
        sldMoveSpeed.slider({
            value: toExpSpeed(initialSpeed), // Convert speed to slider position using exponential scaling
            min: 0,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { 
                if (this.viewer.setMoveSpeed) {
                    this.viewer.setMoveSpeed(toLinearSpeed(ui.value)); // Convert slider position to speed using exponential scaling
                }
            }
        });
        
        // Set initial label
        lblMoveSpeed.html(initialSpeed.toFixed(1));
        
        // Bind viewer event if available - FIXED with exponential conversion
        if (this.viewer.addEventListener) {
            this.viewer.addEventListener('move_speed_changed', (event) => {
                const newSpeed = this.viewer.getMoveSpeed ? this.viewer.getMoveSpeed() : initialSpeed;
                lblMoveSpeed.html(newSpeed.toFixed(1));
                sldMoveSpeed.slider({value: toExpSpeed(newSpeed)}); // Convert speed back to slider position using exponential scaling
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
        
        // CUSTOM - Profile event handler for shared storage across all viewers
        const onProfileAdded = (e) => {
            console.log(`[DEBUG] onProfileAdded event triggered in viewer ${this.viewerId}`);
            console.log(`[DEBUG] Profile added:`, e.profile);
            console.log(`[DEBUG] Profile name: ${e.profile.name}, UUID: ${e.profile.uuid}`);
            
            // Share profile across all viewers using communication system
            this.shareProfileWithAllViewers(e.profile);
            
            // Create JSTree entry like original sidebar
            const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
            const icon = `${resourcePath}/icons/profile.svg`;
            const nodeId = createNode(measurementID, e.profile.name, icon, e.profile);
            console.log(`[DEBUG] Created JSTree node for profile: ${nodeId}`);
        };
        
        // CUSTOM - Profile removal event handler (following original sidebar.js pattern)
        const onProfileRemoved = (e) => {
            console.log(`[DEBUG] onProfileRemoved event triggered in viewer ${this.viewerId}`);
            console.log(`[DEBUG] Profile to remove:`, e.profile);
            console.log(`[DEBUG] Profile UUID: ${e.profile.uuid}`);
            
            // Remove from JSTree - Use the correct measurementID instead of hardcoded "measurements"
            console.log(`[DEBUG] Using measurementID: ${measurementID}`);
            const measurementsRoot = tree.jstree().get_json(measurementID);
            console.log(`[DEBUG] Measurements root:`, measurementsRoot);
            
            if (measurementsRoot && measurementsRoot.children) {
                const jsonNode = measurementsRoot.children.find(child => child.data.uuid === e.profile.uuid);
                console.log(`[DEBUG] Found JSTree node to delete:`, jsonNode);
                
                if (jsonNode) {
                    tree.jstree("delete_node", jsonNode.id);
                    console.log(`[DEBUG] Removed profile node from JSTree: ${e.profile.name}`);
                } else {
                    console.error(`[DEBUG] Could not find JSTree node for profile UUID: ${e.profile.uuid}`);
                }
            } else {
                console.error(`[DEBUG] No measurements root or children found in JSTree for measurementID: ${measurementID}`);
            }
        };
        
        // CUSTOM - Volume event handler for shared storage across all viewers  
        const onVolumeAdded = (e) => {
            console.log(`Volume added in viewer ${this.viewerId}:`, e.volume.name);
            
            // Share volume across all viewers using communication system
            this.shareVolumeWithAllViewers(e.volume);
            
            // Create JSTree entry like original sidebar
            const resourcePath = window.Potree.resourcePath || '../build/potree/resources';
            const icon = `${resourcePath}/icons/box.svg`;
            createNode(measurementID, e.volume.name, icon, e.volume);
        };

        // Bind event listeners to scene - CUSTOM: Added profile and volume events for shared storage
        if (this.viewer.scene && this.viewer.scene.addEventListener) {
            this.viewer.scene.addEventListener("pointcloud_added", onPointCloudAdded);
            this.viewer.scene.addEventListener("measurement_added", onMeasurementAdded);
            this.viewer.scene.addEventListener("profile_added", onProfileAdded);
            this.viewer.scene.addEventListener("profile_removed", onProfileRemoved);
            this.viewer.scene.addEventListener("volume_added", onVolumeAdded);
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
                } else if (object && object.constructor && object.constructor.name === 'Profile') {
                    // CUSTOM - Profile properties
                    this.createProfileProperties(elProperties, object);
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

                <!-- COMPOSITE WEIGHT CONTAINER -->
                <div id="materials_composite_weight_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Attribute Weights</span>
                    </div>
                    <li>RGB: <span id="lblWeightRGB_${this.viewerId}"></span> <div id="sldWeightRGB_${this.viewerId}"></div></li>
                    <li>Intensity: <span id="lblWeightIntensity_${this.viewerId}"></span> <div id="sldWeightIntensity_${this.viewerId}"></div></li>
                    <li>Elevation: <span id="lblWeightElevation_${this.viewerId}"></span> <div id="sldWeightElevation_${this.viewerId}"></div></li>
                    <li>Classification: <span id="lblWeightClassification_${this.viewerId}"></span> <div id="sldWeightClassification_${this.viewerId}"></div></li>
                    <li>Return Number: <span id="lblWeightReturnNumber_${this.viewerId}"></span> <div id="sldWeightReturnNumber_${this.viewerId}"></div></li>
                    <li>Source ID: <span id="lblWeightSourceID_${this.viewerId}"></span> <div id="sldWeightSourceID_${this.viewerId}"></div></li>
                </div>

                <!-- RGB CONTAINER -->
                <div id="materials_rgb_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>RGB</span>
                    </div>
                    <li>Gamma: <span id="lblRGBGamma_${this.viewerId}"></span> <div id="sldRGBGamma_${this.viewerId}"></div></li>
                    <li>Brightness: <span id="lblRGBBrightness_${this.viewerId}"></span> <div id="sldRGBBrightness_${this.viewerId}"></div></li>
                    <li>Contrast: <span id="lblRGBContrast_${this.viewerId}"></span> <div id="sldRGBContrast_${this.viewerId}"></div></li>
                </div>

                <!-- INTENSITY CONTAINER -->
                <div id="materials_intensity_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Intensity</span>
                    </div>
                    <li>Range: <span id="lblIntensityRange_${this.viewerId}"></span> <div id="sldIntensityRange_${this.viewerId}"></div></li>
                    <li>Gamma: <span id="lblIntensityGamma_${this.viewerId}"></span> <div id="sldIntensityGamma_${this.viewerId}"></div></li>
                    <li>Brightness: <span id="lblIntensityBrightness_${this.viewerId}"></span> <div id="sldIntensityBrightness_${this.viewerId}"></div></li>
                    <li>Contrast: <span id="lblIntensityContrast_${this.viewerId}"></span> <div id="sldIntensityContrast_${this.viewerId}"></div></li>
                </div>

                <!-- ELEVATION CONTAINER -->
                <div id="materials_elevation_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Elevation</span>
                    </div>
                    <li>Elevation Range: <span id="lblHeightRange_${this.viewerId}"></span> <div id="sldHeightRange_${this.viewerId}"></div></li>
                    <li>
                        <selectgroup id="gradient_repeat_option_${this.viewerId}">
                            <option id="gradient_repeat_clamp_${this.viewerId}" value="CLAMP">Clamp</option>
                            <option id="gradient_repeat_repeat_${this.viewerId}" value="REPEAT">Repeat</option>
                            <option id="gradient_repeat_mirrored_repeat_${this.viewerId}" value="MIRRORED_REPEAT">Mirrored Repeat</option>
                        </selectgroup>
                    </li>
                    <li>
                        <span>Gradient Scheme:</span>
                        <div id="elevation_gradient_scheme_selection_${this.viewerId}" class="gradient_scheme" style="display: flex; padding: 1em 0em"></div>
                    </li>
                </div>

                <!-- EXTRA ATTRIBUTE CONTAINER -->
                <div id="materials_extra_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Extra Attribute</span>
                    </div>
                    <li>Extra Range: <span id="lblExtraRange_${this.viewerId}"></span> <div id="sldExtraRange_${this.viewerId}"></div></li>
                    <li>
                        <selectgroup id="extra_gradient_repeat_option_${this.viewerId}">
                            <option id="extra_gradient_repeat_clamp_${this.viewerId}" value="CLAMP">Clamp</option>
                            <option id="extra_gradient_repeat_repeat_${this.viewerId}" value="REPEAT">Repeat</option>
                            <option id="extra_gradient_repeat_mirrored_repeat_${this.viewerId}" value="MIRRORED_REPEAT">Mirrored Repeat</option>
                        </selectgroup>
                    </li>
                    <li>
                        <span>Gradient Scheme:</span>
                        <div id="extra_gradient_scheme_selection_${this.viewerId}" class="gradient_scheme" style="display: flex; padding: 1em 0em"></div>
                    </li>
                </div>

                <!-- MATCAP CONTAINER -->
                <div id="materials_matcap_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>MATCAP</span>
                    </div>
                    <li>
                        <div id="matcap_scheme_selection_${this.viewerId}" style="display: flex; flex-wrap: wrap;"></div>
                    </li>
                </div>

                <!-- COLOR CONTAINER -->
                <div id="materials_color_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Color</span>
                    </div>
                    <li>
                        <input id="materials_color_picker_${this.viewerId}" type="color" />
                    </li>
                </div>

                <!-- INDEX CONTAINER -->
                <div id="materials_index_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Indices</span>
                    </div>
                </div>

                <!-- TRANSITION CONTAINER -->
                <div id="materials_transition_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>Transition</span>
                    </div>
                </div>

                <!-- GPS TIME CONTAINER -->
                <div id="materials_gpstime_container_${this.viewerId}" style="display: none;">
                    <div class="divider">
                        <span>GPS Time</span>
                    </div>
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
        
        // Initialize all conditional containers
        this.initCompositeWeightControls(material, pointcloud);
        this.initRGBControls(material);
        this.initIntensityControls(material, pointcloud);
        this.initElevationControls(material, pointcloud);
        this.initExtraControls(material, pointcloud);
        this.initMatcapControls(material);
        this.initColorControls(material);
        
        console.log(`✅ All point cloud property controls initialized for viewer ${this.viewerId}`);
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
                        
                        // Update material container visibility
                        this.updateMaterialContainerVisibility(selectedValue);
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
        this.updateMaterialContainerVisibility(initialValue);
        
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
                
                this.updateMaterialContainerVisibility(material.activeAttributeName);
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
     * Update all material container visibility based on selected attribute - CUSTOM implementation
     * Replicates the original PropertiesPanel conditional visibility system
     */
    updateMaterialContainerVisibility(attributeName) {
        console.log(`🎨 Updating material container visibility for attribute '${attributeName}' in viewer ${this.viewerId}`);
        
        // Get all material containers
        const containers = {
            weights: this.dom.find(`#materials_composite_weight_container_${this.viewerId}`),
            rgb: this.dom.find(`#materials_rgb_container_${this.viewerId}`),
            intensity: this.dom.find(`#materials_intensity_container_${this.viewerId}`),
            elevation: this.dom.find(`#materials_elevation_container_${this.viewerId}`),
            extra: this.dom.find(`#materials_extra_container_${this.viewerId}`),
            color: this.dom.find(`#materials_color_container_${this.viewerId}`),
            matcap: this.dom.find(`#materials_matcap_container_${this.viewerId}`),
            index: this.dom.find(`#materials_index_container_${this.viewerId}`),
            transition: this.dom.find(`#materials_transition_container_${this.viewerId}`),
            gpstime: this.dom.find(`#materials_gpstime_container_${this.viewerId}`)
        };
        
        // Hide all containers first
        Object.values(containers).forEach(container => container.hide());
        
        // Show containers based on selected attribute (matching original logic)
        const selectedValue = attributeName ? attributeName.toLowerCase() : '';
        
        if (selectedValue === 'composite') {
            containers.weights.show();
            containers.elevation.show();
            containers.rgb.show();
            containers.intensity.show();
            console.log('  ✅ Showing: weights, elevation, rgb, intensity (composite mode)');
        } else if (selectedValue === 'elevation') {
            containers.elevation.show();
            console.log('  ✅ Showing: elevation');
        } else if (selectedValue === 'rgb and elevation') {
            containers.rgb.show();
            containers.elevation.show();
            console.log('  ✅ Showing: rgb, elevation');
        } else if (selectedValue === 'rgba' || selectedValue === 'rgb') {
            containers.rgb.show();
            console.log('  ✅ Showing: rgb');
        } else if (selectedValue === 'color') {
            containers.color.show();
            console.log('  ✅ Showing: color picker');
        } else if (selectedValue === 'intensity') {
            containers.intensity.show();
            console.log('  ✅ Showing: intensity');
        } else if (selectedValue === 'intensity gradient') {
            containers.intensity.show();
            console.log('  ✅ Showing: intensity (gradient mode)');
        } else if (selectedValue === 'indices') {
            containers.index.show();
            console.log('  ✅ Showing: index');
        } else if (selectedValue === 'matcap') {
            containers.matcap.show();
            console.log('  ✅ Showing: matcap');
        } else if (selectedValue === 'level of detail') {
            // Level of detail typically doesn't have additional controls, but show extra container for consistency
            containers.extra.show();
            console.log('  ✅ Showing: extra container for level of detail');
        } else if (selectedValue === 'classification') {
            // Classification doesn't have additional controls in original
            console.log('  ✅ Classification selected (no additional controls)');
        } else if (selectedValue === 'gps-time') {
            containers.gpstime.show();
            console.log('  ✅ Showing: gps-time');
        } else if (selectedValue === 'number of returns') {
            console.log('  ✅ Number of returns selected (no additional controls)');
        } else if (selectedValue === 'return number') {
            console.log('  ✅ Return number selected (no additional controls)');
        } else if (['source id', 'point source id'].includes(selectedValue)) {
            console.log('  ✅ Source ID selected (no additional controls)');
        } else {
            // Default to extra container for unknown attributes
            containers.extra.show();
            console.log('  ✅ Showing: extra (default for unknown attribute)');
        }
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
            sidebar.updateMaterialContainerVisibility(attributeName);
            
            console.groupEnd();
        };
        
        console.log('🧪 Debug methods available:');
        console.log('  window.debugAttributeSelector("main") - Test attribute selector initialization');
        console.log('  window.testAttributeChange("main", "rgb") - Test attribute change');
    }
    
    /**
     * Initialize composite weight controls - CUSTOM implementation
     */
    initCompositeWeightControls(material, pointcloud) {
        console.log(`Initializing composite weight controls for viewer ${this.viewerId}`);
        
        const weights = ['RGB', 'Intensity', 'Elevation', 'Classification', 'ReturnNumber', 'SourceID'];
        
        weights.forEach(weight => {
            const slider = this.dom.find(`#sldWeight${weight}_${this.viewerId}`);
            const label = this.dom.find(`#lblWeight${weight}_${this.viewerId}`);
            
            if (slider.length > 0) {
                const currentValue = material[`weight${weight}`] || 1.0;
                
                slider.slider({
                    value: currentValue,
                    min: 0,
                    max: 1,
                    step: 0.01,
                    slide: (event, ui) => {
                        material[`weight${weight}`] = ui.value;
                        label.html(ui.value.toFixed(2));
                    }
                });
                
                label.html(currentValue.toFixed(2));
            }
        });
    }
    
    /**
     * Initialize RGB controls - CUSTOM implementation
     */
    initRGBControls(material) {
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
     * Initialize intensity controls - CUSTOM implementation
     */
    initIntensityControls(material, pointcloud) {
        console.log(`Initializing intensity controls for viewer ${this.viewerId}`);
        
        // CUSTOM - Get intensity range from viewer-specific material instead of shared geometry
        // This prevents NaN issues when multiple viewers use different attributes
        const sldIntensityRange = this.dom.find(`#sldIntensityRange_${this.viewerId}`);
        const lblIntensityRange = this.dom.find(`#lblIntensityRange_${this.viewerId}`);
        
        if (sldIntensityRange.length > 0) {
            let attributeMin = 0;
            let attributeMax = 65535;
            
            // Try to get range from material uniforms first (viewer-specific)
            if (material.uniforms && material.uniforms.intensityRange && material.uniforms.intensityRange.value) {
                [attributeMin, attributeMax] = material.uniforms.intensityRange.value;
            } else if (material.intensityRange && Array.isArray(material.intensityRange)) {
                // Fallback to material property
                [attributeMin, attributeMax] = material.intensityRange;
            } else {
                // Last resort: try to get from shared geometry (but log warning)
                const intensityAttribute = pointcloud.getAttribute ? pointcloud.getAttribute('intensity') : null;
                if (intensityAttribute && intensityAttribute.range) {
                    [attributeMin, attributeMax] = intensityAttribute.range;
                    console.warn(`Viewer ${this.viewerId}: Using shared geometry for intensity range - this may cause NaN issues`);
                }
            }
            
            // Initialize material intensity range if needed or invalid
            if (!material.intensityRange || 
                !Array.isArray(material.intensityRange) ||
                material.intensityRange[0] === Infinity || 
                material.intensityRange[1] === -Infinity ||
                material.intensityRange[0] >= material.intensityRange[1]) {
                material.intensityRange = [attributeMin, attributeMax];
            }
            
            // CUSTOM - Add validation and debugging for NaN issues
            console.log(`Intensity attribute range: [${attributeMin}, ${attributeMax}]`);
            console.log(`Material intensity range: [${material.intensityRange[0]}, ${material.intensityRange[1]}]`);
            
            // Validate final range values before using them
            if (isNaN(attributeMin) || isNaN(attributeMax) || attributeMin >= attributeMax) {
                console.error(`❌ Invalid attribute range for viewer ${this.viewerId}: [${attributeMin}, ${attributeMax}]`);
                console.warn(`🔧 Using fallback range [0, 65535] for viewer ${this.viewerId}`);
                attributeMin = 0;
                attributeMax = 65535;
                material.intensityRange = [attributeMin, attributeMax];
            }
            
            if (isNaN(material.intensityRange[0]) || isNaN(material.intensityRange[1])) {
                console.error(`❌ Material has NaN intensity range for viewer ${this.viewerId}: [${material.intensityRange[0]}, ${material.intensityRange[1]}]`);
                console.warn(`🔧 Fixing material intensity range for viewer ${this.viewerId}`);
                material.intensityRange = [attributeMin, attributeMax];
            }
            
            sldIntensityRange.slider({
                range: true,
                min: attributeMin,
                max: attributeMax,
                step: Math.max(1, Math.floor((attributeMax - attributeMin) / 1000)),
                values: material.intensityRange,
                slide: (event, ui) => {
                    material.intensityRange = ui.values;
                    lblIntensityRange.html(`${parseInt(ui.values[0])} to ${parseInt(ui.values[1])}`);
                    console.log(`Intensity range changed: [${ui.values[0]}, ${ui.values[1]}]`);
                }
            });
            
            lblIntensityRange.html(`${parseInt(material.intensityRange[0])} to ${parseInt(material.intensityRange[1])}`);
        } else {
            console.warn(`Intensity range slider element not found for viewer ${this.viewerId}`);
        }
        
        // Intensity Gamma, Brightness, Contrast
        const intensityControls = ['Gamma', 'Brightness', 'Contrast'];
        intensityControls.forEach(control => {
            const slider = this.dom.find(`#sldIntensity${control}_${this.viewerId}`);
            const label = this.dom.find(`#lblIntensity${control}_${this.viewerId}`);
            
            if (slider.length > 0) {
                const propertyName = `intensity${control}`;
                const currentValue = material[propertyName] || (control === 'Gamma' ? 1.0 : 0.0);
                const minVal = control === 'Gamma' ? 0.1 : -1;
                const maxVal = control === 'Gamma' ? 4 : 1;
                
                slider.slider({
                    value: currentValue,
                    min: minVal,
                    max: maxVal,
                    step: 0.01,
                    slide: (event, ui) => {
                        material[propertyName] = ui.value;
                        label.html(ui.value.toFixed(2));
                    }
                });
                
                label.html(currentValue.toFixed(2));
            }
        });
    }
    
    /**
     * Initialize elevation controls - CUSTOM implementation
     */
    initElevationControls(material, pointcloud) {
        console.log(`Initializing elevation controls for viewer ${this.viewerId}`);
        
        // CUSTOM - Exact copy of original updateHeightRange logic from PropertiesPanel.js
        let bMin, bMax;
        
        const aPosition = pointcloud.getAttribute("position");
        
        if (aPosition) {
            // For new format 2.0 and loader that contain precomputed min/max of attributes
            let min = aPosition.range[0][2];
            let max = aPosition.range[1][2];
            let width = max - min;
            
            bMin = min - 0.2 * width;
            bMax = max + 0.2 * width;
            console.log(`Position attribute range with padding: [${bMin.toFixed(2)}, ${bMax.toFixed(2)}] (original: [${min.toFixed(2)}, ${max.toFixed(2)}])`);
        } else {
            // Fallback: use first available bounding box
            let box = [pointcloud.getBoundingBoxWorld, () => pointcloud.boundingBox, () => pointcloud.pcoGeometry && pointcloud.pcoGeometry.boundingBox]
                .map(f => {
                    try { return f(); } catch (e) { return undefined; }
                })
                .find(v => v !== undefined);
            
            if (box) {
                pointcloud.updateMatrixWorld(true);
                // Note: Utils.computeTransformedBoundingBox would be needed here but not available
                // Using direct box values as fallback
                let bWidth = box.max.z - box.min.z;
                bMin = box.min.z - 0.2 * bWidth;
                bMax = box.max.z + 0.2 * bWidth;
                console.log(`Bounding box fallback range: [${bMin.toFixed(2)}, ${bMax.toFixed(2)}]`);
            } else {
                bMin = 0;
                bMax = 100;
                console.warn('No elevation bounds found, using default range');
            }
        }
        
        // Elevation Range Slider - CUSTOM using exact original logic
        const sldHeightRange = this.dom.find(`#sldHeightRange_${this.viewerId}`);
        const lblHeightRange = this.dom.find(`#lblHeightRange_${this.viewerId}`);
        
        if (sldHeightRange.length > 0) {
            // CUSTOM - The material already has correct elevation range, use it for bounds too
            let range = material.elevationRange;
            
            console.log(`🔍 ELEVATION SLIDER DEBUG:`);
            console.log(`  Original material.elevationRange:`, range);
            console.log(`  Calculated bounds [bMin, bMax]:`, [bMin, bMax]);
            
            if (!range || !Array.isArray(range) || range.length !== 2) {
                // Only use calculated bounds if material doesn't have valid range
                console.log(`  ⚠️ Material elevation range invalid, using calculated bounds`);
                range = [bMin, bMax];
                material.elevationRange = range;
            } else {
                // Material has valid range - use it for both bounds and values
                // Add some padding to bounds (like original does with 0.2 * width)
                const width = range[1] - range[0];
                bMin = range[0] - 0.2 * width;
                bMax = range[1] + 0.2 * width;
                console.log(`  ✅ Using material range with padding: bounds [${bMin.toFixed(2)}, ${bMax.toFixed(2)}]`);
            }
            
            console.log(`  Final range values:`, range);
            console.log(`  Final slider bounds:`, [bMin, bMax]);
            
            // Set label first
            lblHeightRange.html(`${range[0].toFixed(2)} to ${range[1].toFixed(2)}`);
            
            // Destroy any existing slider first
            if (sldHeightRange.hasClass('ui-slider')) {
                sldHeightRange.slider('destroy');
            }
            
            // Initialize slider with corrected bounds
            sldHeightRange.slider({
                range: true,
                min: bMin,
                max: bMax, 
                step: 0.01,
                values: range,
                slide: (event, ui) => {
                    material.elevationRange = ui.values;
                    lblHeightRange.html(`${ui.values[0].toFixed(2)} to ${ui.values[1].toFixed(2)}`);
                    console.log(`Elevation range changed: [${ui.values[0].toFixed(2)}, ${ui.values[1].toFixed(2)}]`);
                }
            });
            
            // Verify slider was set correctly
            const actualMin = sldHeightRange.slider('option', 'min');
            const actualMax = sldHeightRange.slider('option', 'max');
            const actualValues = sldHeightRange.slider('option', 'values');
            console.log(`  ✅ Slider initialized - min: ${actualMin}, max: ${actualMax}, values: [${actualValues}]`);
        }
        
        // Gradient Repeat Option (using selectgroup - button group)
        const gradientRepeat = this.dom.find(`#gradient_repeat_option_${this.viewerId}`);
        if (gradientRepeat.length > 0) {
            gradientRepeat.selectgroup({title: "Gradient"});
            
            gradientRepeat.find("input").click((event) => {
                event.stopPropagation();
                const value = event.target.value;
                
                // CUSTOM - Exact copy of original logic
                this.viewer.setElevationGradientRepeat(ElevationGradientRepeat[value]);
                console.log(`Elevation gradient repeat set to: ${value} (${ElevationGradientRepeat[value]}) for viewer ${this.viewerId}`);
            });
            
            // Set initial state - exact copy of original logic
            let current = Object.keys(ElevationGradientRepeat)
                .filter(key => ElevationGradientRepeat[key] === this.viewer.elevationGradientRepeat);
            if (current.length > 0) {
                gradientRepeat.find(`input[value=${current[0]}]`).trigger("click");
            }
        }
        
        // Initialize gradient scheme selection
        this.initGradientSchemeSelection('elevation', material);
    }
    
    /**
     * Initialize extra attribute controls - CUSTOM implementation
     */
    initExtraControls(material, pointcloud) {
        console.log(`Initializing extra attribute controls for viewer ${this.viewerId}`);
        
        // Extra Range
        const sldExtraRange = this.dom.find(`#sldExtraRange_${this.viewerId}`);
        const lblExtraRange = this.dom.find(`#lblExtraRange_${this.viewerId}`);
        
        if (sldExtraRange.length > 0) {
            const extraRange = material.extraRange || [0, 1];
            
            sldExtraRange.slider({
                range: true,
                values: extraRange,
                min: 0,
                max: 1,
                step: 0.01,
                slide: (event, ui) => {
                    const attributeName = material.activeAttributeName;
                    if (attributeName) {
                        material.setRange(attributeName, ui.values);
                        lblExtraRange.html(`[${ui.values[0].toFixed(2)}, ${ui.values[1].toFixed(2)}]`);
                    }
                }
            });
            
            lblExtraRange.html(`[${extraRange[0].toFixed(2)}, ${extraRange[1].toFixed(2)}]`);
        }
        
        // Extra Gradient Repeat Option (using selectgroup - button group)
        const extraGradientRepeat = this.dom.find(`#extra_gradient_repeat_option_${this.viewerId}`);
        if (extraGradientRepeat.length > 0) {
            extraGradientRepeat.selectgroup({title: "Gradient"});
            
            extraGradientRepeat.find("input").click((event) => {
                event.stopPropagation();
                const value = event.target.value;
                
                // CUSTOM - Exact copy of original logic
                this.viewer.setElevationGradientRepeat(ElevationGradientRepeat[value]);
                console.log(`Extra gradient repeat set to: ${value} (${ElevationGradientRepeat[value]}) for viewer ${this.viewerId}`);
            });
            
            // Set initial state - exact copy of original logic
            let current = Object.keys(ElevationGradientRepeat)
                .filter(key => ElevationGradientRepeat[key] === this.viewer.elevationGradientRepeat);
            if (current.length > 0) {
                extraGradientRepeat.find(`input[value=${current[0]}]`).trigger("click");
            }
        }
        
        // Initialize gradient scheme selection
        this.initGradientSchemeSelection('extra', material);
    }
    
    /**
     * Initialize matcap controls - CUSTOM implementation
     */
    initMatcapControls(material) {
        console.log(`Initializing matcap controls for viewer ${this.viewerId}`);
        
        const matcapContainer = this.dom.find(`#matcap_scheme_selection_${this.viewerId}`);
        
        // Note: Full matcap implementation would require loading matcap textures
        // This is a placeholder for the matcap selection UI
        if (matcapContainer.length > 0) {
            matcapContainer.html('<div>Matcap selection placeholder - requires matcap texture loading</div>');
        }
    }
    
    /**
     * Initialize color controls - CUSTOM implementation
     */
    initColorControls(material) {
        console.log(`Initializing color controls for viewer ${this.viewerId}`);
        
        const colorPicker = this.dom.find(`#materials_color_picker_${this.viewerId}`);
        
        if (colorPicker.length > 0) {
            // Check if Spectrum color picker is available, otherwise fall back to basic HTML color input
            if (typeof colorPicker.spectrum === 'function') {
                // CUSTOM - Use Spectrum color picker like original Potree implementation
                colorPicker.spectrum({
                    flat: true,
                    showInput: true,
                    preferredFormat: 'rgb',
                    cancelText: '',
                    chooseText: 'Apply',
                    color: material.color ? `#${material.color.getHexString()}` : '#ffffff',
                    move: (color) => {
                        const cRGB = color.toRgb();
                        const tc = new THREE.Color().setRGB(cRGB.r / 255, cRGB.g / 255, cRGB.b / 255);
                        material.color = tc;
                        console.log(`Color changed (move) to: rgb(${cRGB.r}, ${cRGB.g}, ${cRGB.b}) for viewer ${this.viewerId}`);
                    },
                    change: (color) => {
                        const cRGB = color.toRgb();
                        const tc = new THREE.Color().setRGB(cRGB.r / 255, cRGB.g / 255, cRGB.b / 255);
                        material.color = tc;
                        console.log(`Color changed (final) to: rgb(${cRGB.r}, ${cRGB.g}, ${cRGB.b}) for viewer ${this.viewerId}`);
                    }
                });
                
                // Listen for material color changes to update picker
                if (material.addEventListener) {
                    material.addEventListener("color_changed", () => {
                        colorPicker.spectrum('set', `#${material.color.getHexString()}`);
                    });
                }
            } else {
                // Fallback to basic HTML color input if Spectrum is not available
                console.warn('Spectrum color picker not available, using basic HTML color input');
                
                // Set initial color
                if (material.color && material.color.getHexString) {
                    colorPicker.val(`#${material.color.getHexString()}`);
                }
                
                colorPicker.on('change', (event) => {
                    const colorValue = event.target.value;
                    if (material.color && material.color.setHex) {
                        material.color.setHex(colorValue.replace('#', '0x'));
                        console.log(`Color changed to: ${colorValue} for viewer ${this.viewerId}`);
                    }
                });
            }
        } else {
            console.warn(`Color picker element not found for viewer ${this.viewerId}`);
        }
    }
    
    /**
     * Initialize gradient scheme selection for elevation or extra attributes - CUSTOM implementation
     */
    initGradientSchemeSelection(type, material) {
        const container = this.dom.find(`#${type}_gradient_scheme_selection_${this.viewerId}`);
        
        if (container.length > 0) {
            console.log(`Gradient scheme container found for ${type}, checking Potree.Gradients availability...`);
            console.log(`window.Potree:`, !!window.Potree);
            console.log(`window.Potree.Gradients:`, !!(window.Potree && window.Potree.Gradients));
            console.log(`Utils:`, Utils);
            console.log(`Utils.createSvgGradient:`, !!Utils.createSvgGradient);
            
            if (window.Potree && window.Potree.Gradients) {
                // CUSTOM - Exact copy of original gradient scheme logic
                const schemes = Object.keys(window.Potree.Gradients).map(name => ({
                    name: name, 
                    values: window.Potree.Gradients[name]
                }));
                
                console.log(`Found ${schemes.length} gradient schemes:`, schemes.map(s => s.name));
                
                container.empty(); // Clear any existing content
                
                for (let scheme of schemes) {
                    console.log(`Creating gradient ${scheme.name}:`, scheme.values);
                    
                    // Create scheme button - exact copy from original
                    const elScheme = $(`
                        <span style="flex-grow: 1; margin: 2px; border: 1px solid #ccc;">
                        </span>
                    `);
                    
                    try {
                        // Use the exact same Utils.createSvgGradient method as original
                        const svg = Utils.createSvgGradient(scheme.values);
                        svg.setAttributeNS(null, "class", "button-icon");
                        console.log(`SVG created successfully for ${scheme.name}:`, svg);
                        
                        elScheme.append($(svg));
                    } catch (error) {
                        console.error(`Error creating SVG for ${scheme.name}:`, error);
                        // Fallback: create a simple colored div
                        elScheme.append(`<div style="width: 64px; height: 16px; background: linear-gradient(to right, red, blue);">${scheme.name}</div>`);
                    }
                    
                    // Add click handler to apply gradient - exact copy from original
                    elScheme.click(() => {
                        material.gradient = window.Potree.Gradients[scheme.name];
                        console.log(`Applied gradient scheme '${scheme.name}' to ${type} for viewer ${this.viewerId}`);
                    });
                    
                    container.append(elScheme);
                }
                
                console.log(`Gradient scheme selection initialized for ${type} in viewer ${this.viewerId} with ${schemes.length} schemes`);
            } else {
                console.warn(`Potree.Gradients not available for ${type} in viewer ${this.viewerId}`);
                console.warn(`window.Potree:`, window.Potree);
                console.warn(`window.Potree.Gradients:`, window.Potree && window.Potree.Gradients);
            }
        } else {
            console.warn(`Gradient scheme container not found for ${type} in viewer ${this.viewerId}`);
        }
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
    
    /**
     * Initialize FILTERS section - COMPLETE implementation
     * Replicates original sidebar.js filter methods for multi-viewer
     */
    initFilters() {
        console.log(`Initializing FILTERS section for viewer ${this.viewerId}`);
        
        // Debug viewer state
        console.log(`Viewer object exists:`, !!this.viewer);
        console.log(`Viewer scene exists:`, !!this.viewer.scene);
        console.log(`Viewer point clouds:`, this.viewer.scene ? this.viewer.scene.pointclouds.length : 'N/A');
        
        // Initialize basic structure (return filters that don't depend on point cloud data)
        this.initReturnFilters();
        this.initGPSTimeFilters();
        
        // Initialize classification list (may be empty until point cloud is loaded)
        this.initClassificationList();
        
        // Set up event listener for when point clouds are added - CUSTOM
        if (this.viewer.scene) {
            this.viewer.scene.addEventListener("pointcloud_added", (e) => {
                console.log(`Point cloud added for viewer ${this.viewerId}, updating filters`);
                this.refreshFiltersForPointCloud();
            });
        }
        
        console.log(`FILTERS section initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Refresh filters when point cloud data is available - CUSTOM 
     */
    refreshFiltersForPointCloud() {
        console.log(`Refreshing filters after point cloud loaded for viewer ${this.viewerId}`);
        
        // Re-initialize classification list now that data is available
        this.initClassificationList();
        
        // Update any other filters that depend on point cloud data
        // (Return filters and GPS time may have ranges from the actual data)
        this.initReturnFilters();
        this.initGPSTimeFilters();
    }
    
    /**
     * Initialize classification list with checkboxes and color pickers - CUSTOM implementation
     */
    initClassificationList() {
        console.log(`Initializing classification list for viewer ${this.viewerId}`);
        
        // Debug DOM availability
        console.log(`DOM element available:`, this.dom.length > 0);
        console.log(`Looking for element:`, `#classificationList_${this.viewerId}`);
        
        const elClassificationList = this.dom.find(`#classificationList_${this.viewerId}`);
        console.log(`Classification list found:`, elClassificationList.length > 0);
        
        if (elClassificationList.length === 0) {
            console.warn(`Classification list container not found for viewer ${this.viewerId}`);
            // Debug all available elements in filters section
            const allFiltersElements = this.dom.find('[id*="classification"], [id*="Classification"]');
            console.log(`Available classification-related elements:`, allFiltersElements.length, allFiltersElements.get().map(el => el.id));
            return;
        }
        
        // Debug viewer classifications
        console.log(`Viewer classifications available:`, !!this.viewer.classifications);
        console.log(`Classifications object:`, this.viewer.classifications);
        const classKeys = this.viewer.classifications ? Object.keys(this.viewer.classifications) : [];
        console.log(`Classification keys:`, classKeys);
        console.log(`Number of classifications:`, classKeys.length);
        
        const addClassificationItem = (code, name) => {
            console.log(`Adding classification item: ${code} - ${name}`);
            const classification = this.viewer.classifications[code];
            if (!classification) {
                console.warn(`No classification found for code ${code}`);
                return;
            }
            
            const inputID = `chkClassification_${code}_${this.viewerId}`;
            const colorPickerID = `colorPickerClassification_${code}_${this.viewerId}`;
            
            const checked = classification.visible ? "checked" : "";
            console.log(`Classification ${code} visible:`, classification.visible);
            
            let element = $(`
                <li>
                    <label style="whitespace: nowrap; display: flex">
                        <input id="${inputID}" type="checkbox" ${checked}/>
                        <span style="flex-grow: 1; margin-left: 10px">${name}</span>
                        <input id="${colorPickerID}" class="color-input" />
                    </label>
                </li>
            `);
            
            let elInput = element.find(`#${inputID}`); // More specific - select by exact ID
            let elColorPicker = element.find(`#${colorPickerID}`); // More specific - select by exact ID
            
            console.log(`Binding click event for classification ${code}, checkbox ID: ${inputID}`);
            console.log(`Checkbox element found:`, elInput.length > 0);
            
            // Direct DOM event binding instead of jQuery to avoid event delegation issues - CUSTOM
            const checkbox = elInput[0]; // Get the actual DOM element
            if (checkbox) {
                console.log(`Binding direct event to DOM element:`, checkbox.id);
                checkbox.addEventListener('click', (event) => {
                    console.log(`=== Classification ${code} clicked via direct DOM event ===`);
                    console.log(`Event target ID:`, event.target.id);
                    console.log(`Expected ID:`, inputID);
                    console.log(`Checkbox state after click:`, event.target.checked);
                    console.log(`Classification code from closure:`, code);
                    
                    // Update the viewer state
                    this.viewer.setClassificationVisibility(code, event.target.checked);
                    console.log(`Viewer classification ${code} visible after change:`, this.viewer.classifications[code].visible);
                    
                    // Force visual state to match the checkbox state (in case something overrides it)
                    setTimeout(() => {
                        const currentState = event.target.checked;
                        const viewerState = this.viewer.classifications[code].visible;
                        console.log(`Post-click sync check: checkbox=${currentState}, viewer=${viewerState}`);
                        
                        if (currentState !== viewerState) {
                            console.log(`Forcing checkbox visual state to match viewer state: ${viewerState}`);
                            event.target.checked = viewerState;
                        }
                    }, 10); // Small delay to let any other handlers run first
                });
            } else {
                console.error(`Could not find checkbox DOM element for ${inputID}`);
            }
            
            // Color picker setup
            let defaultColor = classification.color.map(c => c * 255).join(", ");
            defaultColor = `rgb(${defaultColor})`;
            console.log(`Classification ${code} default color:`, defaultColor);
            
            if (typeof elColorPicker.spectrum === 'function') {
                elColorPicker.spectrum({
                    flat: false,
                    showInput: true,
                    color: defaultColor,
                    preferredFormat: 'rgb',
                    cancelText: '',
                    chooseText: 'Apply',
                    move: color => {
                        let rgb = color.toRgb();
                        const c = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
                        classification.color = c;
                    },
                    change: color => {
                        let rgb = color.toRgb();
                        const c = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
                        classification.color = c;
                    }
                });
            } else {
                // Fallback to basic color input if Spectrum not available
                elColorPicker.attr('type', 'color');
                elColorPicker.val(rgbToHex(defaultColor));
                elColorPicker.on('change', (event) => {
                    const hex = event.target.value;
                    const rgb = hexToRgb(hex);
                    const c = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
                    classification.color = c;
                });
            }
            
            elClassificationList.append(element);
            console.log(`Classification item ${code} added to DOM at position:`, elClassificationList.children().length);
            
            // Verify the element was added correctly
            const verifyElement = elClassificationList.find(`#${inputID}`);
            console.log(`Verification: Can find checkbox ${inputID}:`, verifyElement.length > 0);
        };
        
        const addToggleAllButton = () => {
            let element = $(`
                <li>
                    <label style="whitespace: nowrap">
                        <input id="chkToggleClassifications_${this.viewerId}" type="checkbox" checked/>
                        <span>show/hide all</span>
                    </label>
                </li>
            `);
            
            let elInput = element.find('input');
            
            elInput.click(event => {
                console.log(`Toggle all classifications clicked for viewer ${this.viewerId}`);
                event.stopPropagation(); // Prevent ViewerManager interference
                this.viewer.toggleAllClassificationsVisibility();
            });
            
            elClassificationList.append(element);
        };
        
        const addInvertButton = () => {
            let element = $(`
                <li>
                    <input type="button" value="invert" style="width: 100%; margin: 5px 0px"/>
                </li>
            `);
            
            let elInput = element.find('input');
            
            elInput.click(event => {
                console.log(`Invert classifications clicked for viewer ${this.viewerId}`);
                event.stopPropagation(); // Prevent ViewerManager interference
                const classifications = this.viewer.classifications;
                
                for (let key of Object.keys(classifications)) {
                    let value = classifications[key];
                    this.viewer.setClassificationVisibility(key, !value.visible);
                }
            });
            
            elClassificationList.append(element);
        };
        
        const populate = () => {
            console.log(`Populating classification list for viewer ${this.viewerId}`);
            
            // Clear existing content
            elClassificationList.empty();
            console.log(`Classification list cleared`);
            
            addToggleAllButton();
            console.log(`Toggle all button added`);
            
            const classKeys = Object.keys(this.viewer.classifications || {});
            console.log(`About to iterate over ${classKeys.length} classifications:`, classKeys);
            
            // Sort classification keys to ensure consistent ordering
            const sortedClassKeys = Object.keys(this.viewer.classifications).sort((a, b) => parseInt(a) - parseInt(b));
            console.log(`Sorted classification keys:`, sortedClassKeys);
            
            for (let classID of sortedClassKeys) {
                console.log(`Processing classification ID: ${classID}, name: ${this.viewer.classifications[classID].name}`);
                addClassificationItem(classID, this.viewer.classifications[classID].name);
            }
            
            addInvertButton();
            console.log(`Invert button added`);
            console.log(`Classification population complete`);
        };
        
        populate();
        
        // Event listeners for classification changes
        this.viewer.addEventListener("classifications_changed", (event) => {
            // CUSTOM - Only respond to events from our own viewer to prevent cross-contamination
            if (event.viewer !== this.viewer) {
                console.log(`Ignoring classifications_changed event from different viewer for ${this.viewerId}`);
                return;
            }
            elClassificationList.empty();
            populate();
        });
        
        this.viewer.addEventListener("classification_visibility_changed", (event) => {
            // CUSTOM - Only respond to events from our own viewer to prevent cross-contamination
            if (event.viewer !== this.viewer) {
                console.log(`Ignoring classification event from different viewer for ${this.viewerId}`);
                return;
            }
            
            console.log(`Classification visibility changed event triggered for viewer ${this.viewerId}`);
            
            // Re-enable automatic state updates but with better debugging
            for (const classID of Object.keys(this.viewer.classifications)) {
                const classValue = this.viewer.classifications[classID];
                let elItem = elClassificationList.find(`#chkClassification_${classID}_${this.viewerId}`);
                if (elItem.length > 0) {
                    const currentVisualState = elItem.prop("checked");
                    const shouldBeState = classValue.visible;
                    console.log(`Sync classification ${classID}: visual=${currentVisualState}, should be=${shouldBeState}`);
                    
                    if (currentVisualState !== shouldBeState) {
                        elItem.prop("checked", shouldBeState);
                        console.log(`Updated visual state for classification ${classID} to ${shouldBeState}`);
                    }
                } else {
                    console.warn(`Could not find checkbox for classification ${classID}`);
                }
            }
            
            // Update toggle button state
            let numVisible = 0;
            let numItems = 0;
            for (const key of Object.keys(this.viewer.classifications)) {
                if (this.viewer.classifications[key].visible) {
                    numVisible++;
                }
                numItems++;
            }
            const allVisible = numVisible === numItems;
            let elToggle = elClassificationList.find(`#chkToggleClassifications_${this.viewerId}`);
            elToggle.prop("checked", allVisible);
        });
    }
    
    /**
     * Initialize return filters (return number and number of returns) - CUSTOM implementation
     */
    initReturnFilters() {
        console.log(`Initializing return filters for viewer ${this.viewerId}`);
        
        // Debug DOM availability
        console.log(`Looking for return_filter_panel_${this.viewerId}`);
        const elReturnFilterPanel = this.dom.find(`#return_filter_panel_${this.viewerId}`);
        console.log(`Return filter panel found:`, elReturnFilterPanel.length > 0);
        
        if (elReturnFilterPanel.length === 0) {
            console.warn(`Return filter panel not found for viewer ${this.viewerId}`);
            // Debug available elements
            const returnElements = this.dom.find('[id*="return"], [id*="Return"]');
            console.log(`Available return-related elements:`, returnElements.length, returnElements.get().map(el => el.id));
            return;
        }
        
        // RETURN NUMBER
        const sldReturnNumber = elReturnFilterPanel.find(`#sldReturnNumber_${this.viewerId}`);
        const lblReturnNumber = elReturnFilterPanel.find(`#lblReturnNumber_${this.viewerId}`);
        
        if (sldReturnNumber.length > 0) {
            sldReturnNumber.slider({
                range: true,
                min: 0, max: 7, step: 1,
                values: [0, 7],
                slide: (event, ui) => {
                    this.viewer.setFilterReturnNumberRange(ui.values[0], ui.values[1]);
                }
            });
            
            const onReturnNumberChanged = (event) => {
                let [from, to] = this.viewer.filterReturnNumberRange;
                lblReturnNumber.html(`${from} to ${to}`);
                sldReturnNumber.slider({values: [from, to]});
            };
            
            this.viewer.addEventListener('filter_return_number_range_changed', onReturnNumberChanged);
            onReturnNumberChanged();
        }
        
        // NUMBER OF RETURNS
        const sldNumberOfReturns = elReturnFilterPanel.find(`#sldNumberOfReturns_${this.viewerId}`);
        const lblNumberOfReturns = elReturnFilterPanel.find(`#lblNumberOfReturns_${this.viewerId}`);
        
        if (sldNumberOfReturns.length > 0) {
            sldNumberOfReturns.slider({
                range: true,
                min: 0, max: 7, step: 1,
                values: [0, 7],
                slide: (event, ui) => {
                    this.viewer.setFilterNumberOfReturnsRange(ui.values[0], ui.values[1]);
                }
            });
            
            const onNumberOfReturnsChanged = (event) => {
                let [from, to] = this.viewer.filterNumberOfReturnsRange;
                lblNumberOfReturns.html(`${from} to ${to}`);
                sldNumberOfReturns.slider({values: [from, to]});
            };
            
            this.viewer.addEventListener('filter_number_of_returns_range_changed', onNumberOfReturnsChanged);
            onNumberOfReturnsChanged();
        }
    }
    
    
    /**
     * Initialize GPS time filters - CUSTOM implementation
     */
    initGPSTimeFilters() {
        console.log(`Initializing GPS time filters for viewer ${this.viewerId}`);
        
        const elGPSTimeFilterPanel = this.dom.find(`#gpstime_filter_panel_${this.viewerId}`);
        
        if (elGPSTimeFilterPanel.length === 0) {
            console.warn(`GPS time filter panel not found for viewer ${this.viewerId}`);
            return;
        }
        
        // Basic GPS time input functionality
        const txtGpsTime = elGPSTimeFilterPanel.find(`#txtGpsTime_${this.viewerId}`);
        const btnFindGpsTime = elGPSTimeFilterPanel.find(`#btnFindGpsTime_${this.viewerId}`);
        
        if (btnFindGpsTime.length > 0) {
            btnFindGpsTime.click(() => {
                const timeValue = txtGpsTime.val();
                if (timeValue && this.viewer.setFilterGPSTime) {
                    this.viewer.setFilterGPSTime(parseFloat(timeValue));
                    console.log(`GPS time filter set to: ${timeValue} for viewer ${this.viewerId}`);
                }
            });
        }
        
        console.log(`GPS time filters initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * CUSTOM - Share profile with all viewers using communication system
     */
    shareProfileWithAllViewers(profile) {
        try {
            // Get the ViewerManager from testCore
            const testCore = window.testModules && window.testModules.testCore;
            if (!testCore) {
                console.warn('testCore not available for profile sharing');
                return;
            }
            
            const multiViewer = testCore.getMultiViewer();
            if (!multiViewer) {
                console.warn('MultiViewer not available for profile sharing');
                return;
            }
            
            // Create shared profile data
            const sharedProfileData = {
                type: 'profile',
                uuid: profile.uuid,
                name: profile.name,
                points: profile.points ? profile.points.map(point => ({x: point.x, y: point.y, z: point.z})) : [],
                width: profile.width || 1,
                closed: profile.closed || false,
                createdBy: this.viewerId,
                timestamp: Date.now()
            };
            
            // Add to shared geometry system
            const geometryId = multiViewer.addSharedGeometry(sharedProfileData, `profile_${profile.uuid}`);
            
            if (geometryId) {
                console.log(`Shared profile ${profile.name} with ID: ${geometryId}`);
                
                // Send message to all viewers to update their sidebars
                multiViewer.sendMessage('profiles', {
                    type: 'profile_added',
                    profile: sharedProfileData,
                    geometryId: geometryId
                });
            }
            
        } catch (error) {
            console.error(`Error sharing profile: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Create profile entry in sidebar
     */
    createProfileEntry(profile) {
        try {
            const measurementsContainer = this.dom.find(`#measurements_container_${this.viewerId}`);
            if (measurementsContainer.length === 0) {
                console.warn(`Measurements container not found for viewer ${this.viewerId}`);
                return;
            }
            
            const profileElement = $(`
                <div class="measurement-entry profile-entry" data-profile-id="${profile.uuid}">
                    <div class="measurement-header profile-header">
                        <img src="${(window.Potree && window.Potree.resourcePath) || '../build/potree/resources'}/icons/profile.svg" class="measurement-icon profile-icon">
                        <span class="measurement-name profile-name">${profile.name}</span>
                        <div class="measurement-controls profile-controls">
                            <button class="show-2d-profile-btn" data-profile-uuid="${profile.uuid}" title="Show 2D Profile">📊</button>
                            <button class="delete-profile-btn" data-profile-uuid="${profile.uuid}" title="Delete Profile">×</button>
                        </div>
                    </div>
                    <div class="measurement-info profile-info">
                        <span>Points: ${profile.points ? profile.points.length : 0}</span>
                        <span>Width: ${profile.width ? profile.width.toFixed(2) : 0}m</span>
                        <span class="profile-creator">Created by: ${profile.createdBy || 'unknown'}</span>
                    </div>
                </div>
            `);
            
            // Add Show 2D Profile button handler
            profileElement.find('.show-2d-profile-btn').click((e) => {
                e.stopPropagation();
                this.show2DProfile(profile);
            });
            
            // Add delete button handler
            profileElement.find('.delete-profile-btn').click((e) => {
                e.stopPropagation();
                this.deleteProfile(profile);
            });
            
            measurementsContainer.append(profileElement);
            console.log(`Created profile entry for ${profile.name} in viewer ${this.viewerId}`);
            
        } catch (error) {
            console.error(`Error creating profile entry: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Show 2D Profile Window
     */
    show2DProfile(profile) {
        try {
            if (this.viewer.profileWindow && this.viewer.profileWindowController) {
                this.viewer.profileWindow.show();
                this.viewer.profileWindowController.setProfile(profile);
                console.log(`Opened 2D profile window for ${profile.name}`);
            } else {
                console.warn(`ProfileWindow not available for viewer ${this.viewerId} - this needs ProfileWindow initialization in ViewerManager`);
            }
        } catch (error) {
            console.error(`Error showing 2D profile: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Delete profile from all viewers
     */
    deleteProfile(profile) {
        try {
            // Remove from local scene
            if (this.viewer.scene && this.viewer.scene.removeProfile) {
                this.viewer.scene.removeProfile(profile);
            }
            
            // Remove from shared system
            const testCore = window.testModules && window.testModules.testCore;
            const multiViewer = testCore && testCore.getMultiViewer();
            if (multiViewer) {
                multiViewer.removeSharedGeometry(`profile_${profile.uuid}`, `delete_by_${this.viewerId}`);
                
                // Notify all viewers
                multiViewer.sendMessage('profiles', {
                    type: 'profile_removed',
                    profileUuid: profile.uuid,
                    removedBy: this.viewerId
                });
            }
            
            // Remove from sidebar
            this.dom.find(`[data-profile-id="${profile.uuid}"]`).remove();
            
            console.log(`Deleted profile ${profile.name}`);
            
        } catch (error) {
            console.error(`Error deleting profile: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Create volume entry in sidebar
     */
    createVolumeEntry(volume) {
        try {
            const measurementsContainer = this.dom.find(`#measurements_container_${this.viewerId}`);
            if (measurementsContainer.length === 0) {
                console.warn(`Measurements container not found for viewer ${this.viewerId}`);
                return;
            }
            
            const volumeElement = $(`
                <div class="measurement-entry volume-entry" data-volume-id="${volume.uuid}">
                    <div class="measurement-header volume-header">
                        <img src="${(window.Potree && window.Potree.resourcePath) || '../build/potree/resources'}/icons/volume.svg" class="measurement-icon volume-icon">
                        <span class="measurement-name volume-name">${volume.name}</span>
                        <div class="measurement-controls volume-controls">
                            <button class="delete-volume-btn" data-volume-uuid="${volume.uuid}" title="Delete Volume">×</button>
                        </div>
                    </div>
                    <div class="measurement-info volume-info">
                        <span class="volume-creator">Created by: ${volume.createdBy || 'unknown'}</span>
                    </div>
                </div>
            `);
            
            // Add delete button handler
            volumeElement.find('.delete-volume-btn').click((e) => {
                e.stopPropagation();
                this.deleteVolume(volume);
            });
            
            measurementsContainer.append(volumeElement);
            console.log(`Created volume entry for ${volume.name} in viewer ${this.viewerId}`);
            
        } catch (error) {
            console.error(`Error creating volume entry: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Delete volume from all viewers
     */
    deleteVolume(volume) {
        try {
            // Remove from local scene
            if (this.viewer.scene && this.viewer.scene.removeVolume) {
                this.viewer.scene.removeVolume(volume);
            }
            
            // Remove from shared system
            const testCore = window.testModules && window.testModules.testCore;
            const multiViewer = testCore && testCore.getMultiViewer();
            if (multiViewer) {
                multiViewer.removeSharedGeometry(`volume_${volume.uuid}`, `delete_by_${this.viewerId}`);
                
                // Notify all viewers
                multiViewer.sendMessage('volumes', {
                    type: 'volume_removed',
                    volumeUuid: volume.uuid,
                    removedBy: this.viewerId
                });
            }
            
            // Remove from sidebar
            this.dom.find(`[data-volume-id="${volume.uuid}"]`).remove();
            
            console.log(`Deleted volume ${volume.name}`);
            
        } catch (error) {
            console.error(`Error deleting volume: ${error.message}`);
        }
    }
    
    /**
     * CUSTOM - Create profile properties UI similar to original ProfilePanel
     */
    createProfileProperties(container, profile) {
        const panel = $(`
            <div class="measurement_content selectable">
                <h4>Profile Properties</h4>
                
                <div class="profile-info">
                    <div class="coordinates_table_container"></div>
                </div>
                
                <br>
                
                <span style="display:flex">
                    <span style="display:flex; align-items: center; padding-right: 10px">Width: </span>
                    <input id="sldProfileWidth_${this.viewerId}" name="sldProfileWidth" value="${profile.width || 5.06}" style="flex-grow: 1; width:100%">
                </span>
                
                <br><br>
                
                <input type="button" id="show_2d_profile_${this.viewerId}" value="Show 2D Profile" style="width: 100%; margin-bottom: 10px;" class="potree-button"/>
                
                <div style="display: flex; margin-top: 12px">
                    <span></span>
                    <span style="flex-grow: 1"></span>
                    <button id="remove_profile_${this.viewerId}" class="potree-button" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px;">Delete Profile</button>
                </div>
            </div>
        `);
        
        // Create coordinates table
        if (profile.points && profile.points.length > 0) {
            const coordsTable = this.createCoordinatesTable(profile.points);
            panel.find('.coordinates_table_container').append(coordsTable);
        }
        
        // Width spinner functionality
        const elWidthSlider = panel.find(`#sldProfileWidth_${this.viewerId}`);
        if (window.$ && window.$.fn.spinner) {
            elWidthSlider.spinner({
                min: 0, max: 10 * 1000 * 1000, step: 0.01,
                numberFormat: 'n',
                spin: (event, ui) => {
                    const value = elWidthSlider.spinner('value');
                    if (profile.setWidth) profile.setWidth(value);
                },
                change: (event, ui) => {
                    const value = elWidthSlider.spinner('value');
                    if (profile.setWidth) profile.setWidth(value);
                }
            });
            elWidthSlider.spinner('value', profile.width || 5.06);
            elWidthSlider.spinner('widget').css('width', '100%');
        }
        
        // Show 2D Profile button handler - CUSTOM (following original ProfilePanel pattern)
        panel.find(`#show_2d_profile_${this.viewerId}`).click(() => {
            console.log(`[DEBUG] Show 2D Profile button clicked for viewer ${this.viewerId}`);
            console.log(`[DEBUG] Profile object:`, profile);
            console.log(`[DEBUG] this.viewer.profileWindow: ${!!this.viewer.profileWindow}`);
            console.log(`[DEBUG] this.viewer.profileWindowController: ${!!this.viewer.profileWindowController}`);
            
            if (this.viewer.profileWindow && this.viewer.profileWindowController) {
                console.log(`[DEBUG] Calling profileWindow.show() and setProfile()`);
                this.viewer.profileWindow.show();
                this.viewer.profileWindowController.setProfile(profile);
                console.log(`Showing 2D profile window for profile: ${profile.name || profile.uuid}`);
            } else {
                console.error(`[ERROR] ProfileWindow not available for viewer ${this.viewerId} - profileWindow: ${!!this.viewer.profileWindow}, profileWindowController: ${!!this.viewer.profileWindowController}`);
            }
        });
        
        // Delete Profile button handler - CUSTOM (following original ProfilePanel pattern)
        panel.find(`#remove_profile_${this.viewerId}`).click(() => {
            console.log(`[DEBUG] Delete Profile button clicked for viewer ${this.viewerId}`);
            console.log(`[DEBUG] Profile to delete:`, profile);
            console.log(`[DEBUG] this.viewer.scene: ${!!this.viewer.scene}`);
            console.log(`[DEBUG] this.viewer.scene.removeProfile: ${!!(this.viewer.scene && this.viewer.scene.removeProfile)}`);
            
            if (this.viewer.scene && this.viewer.scene.removeProfile) {
                console.log(`[DEBUG] Calling viewer.scene.removeProfile()`);
                this.viewer.scene.removeProfile(profile);
                console.log(`Removed profile from scene: ${profile.name || profile.uuid}`);
                
                // Clear properties panel
                const elProperties = this.dom.find(`#scene_object_properties_${this.viewerId}`);
                elProperties.html('<div style="padding: 10px; color: #999;">Select an object to view properties</div>');
            } else {
                console.error(`[ERROR] Cannot remove profile - scene: ${!!this.viewer.scene}, removeProfile: ${!!(this.viewer.scene && this.viewer.scene.removeProfile)}`);
            }
        });
        
        container.append(panel);
    }
    
    /**
     * CUSTOM - Create coordinates table for measurements (copied from original MeasurePanel)
     */
    createCoordinatesTable(points) {
        const table = $(`
            <table class="measurement_coordinates">
                <tr>
                    <th></th>
                    <th>x</th>
                    <th>y</th>
                    <th>z</th>
                    <th>length</th>
                </tr>
            </table>
        `);
        
        let totalLength = 0;
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            let length = 0;
            
            if (i > 0) {
                const previous = points[i - 1];
                length = point.distanceTo(previous);
                totalLength += length;
            }
            
            const row = $(`
                <tr>
                    <td>${i}</td>
                    <td>${point.x.toFixed(3)}</td>
                    <td>${point.y.toFixed(3)}</td>
                    <td>${point.z.toFixed(3)}</td>
                    <td>${length.toFixed(3)}</td>
                </tr>
            `);
            
            table.append(row);
        }
        
        // Add total length row
        if (points.length > 1) {
            const totalRow = $(`
                <tr>
                    <td><b>Total</b></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td><b>${totalLength.toFixed(3)}</b></td>
                </tr>
            `);
            table.append(totalRow);
        }
        
        return table;
    }
}

// Helper functions for color conversion
function rgbToHex(rgb) {
    const result = rgb.match(/\d+/g);
    return result ? "#" + ((1 << 24) + (parseInt(result[0]) << 16) + (parseInt(result[1]) << 8) + parseInt(result[2])).toString(16).slice(1) : "#ffffff";
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}