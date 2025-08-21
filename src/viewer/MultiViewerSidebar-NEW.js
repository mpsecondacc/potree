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
     * Placeholder methods for other sidebar sections
     */
    initTools() {
        // TODO: Implement tools section with scoped elements
    }
    
    initScene() {
        // TODO: Implement scene section with scoped elements  
    }
    
    /**
     * Create hamburger menu button for this viewer
     */
    createHamburgerButton() {
        const viewerContainer = this.viewer.renderArea.parentElement;
        
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
    }
    
    /**
     * Show/hide sidebar
     */
    show() {
        if (!this.isVisible) {
            // Add to DOM
            const viewerContainer = this.viewer.renderArea.parentElement;
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
            // Animate out
            this.container.style.transform = 'translateX(100%)';
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (this.container.parentElement) {
                    this.container.parentElement.removeChild(this.container);
                }
            }, 300);
            
            this.isVisible = false;
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