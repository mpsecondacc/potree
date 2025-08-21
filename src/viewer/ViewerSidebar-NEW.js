/**
 * ViewerSidebar - Phase 1: Hamburger Button and Container
 * Implementing step-by-step sidebar functionality for multi-viewer
 */

import { EventDispatcher } from "../EventDispatcher.js";

export class ViewerSidebar extends EventDispatcher {
    
    constructor(viewer, viewerId, viewerManager) {
        super();
        
        this.viewer = viewer;
        this.viewerId = viewerId;
        this.viewerManager = viewerManager;
        
        this.isOpen = false;
        this.container = null;
        this.hamburgerButton = null;
        
        // Phase 1: Create hamburger button and basic sidebar container
        this.createHamburgerButton();
        this.createSidebarContainer();
        this.positionSidebar();
        
        console.log(`Phase 1 - Sidebar container created for viewer ${this.viewerId}`);
    }
    
    /**
     * Phase 1: Create hamburger button for sidebar toggle
     */
    createHamburgerButton() {
        this.hamburgerButton = document.createElement('div');
        this.hamburgerButton.className = 'hamburger-button';
        this.hamburgerButton.innerHTML = `
            <div class="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        // Add CSS styling - positioned in top-right
        this.hamburgerButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 4px;
            cursor: pointer;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
        `;
        
        // Style hamburger lines
        const icon = this.hamburgerButton.querySelector('.hamburger-icon');
        icon.style.cssText = `
            width: 18px;
            height: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        `;
        
        const spans = this.hamburgerButton.querySelectorAll('span');
        spans.forEach(span => {
            span.style.cssText = `
                width: 100%;
                height: 2px;
                background: white;
                display: block;
                transition: all 0.2s ease;
            `;
        });
        
        // Add hover effect
        this.hamburgerButton.addEventListener('mouseenter', () => {
            this.hamburgerButton.style.background = 'rgba(0, 0, 0, 0.9)';
        });
        
        this.hamburgerButton.addEventListener('mouseleave', () => {
            this.hamburgerButton.style.background = 'rgba(0, 0, 0, 0.7)';
        });
        
        // Add click handler
        this.hamburgerButton.addEventListener('click', () => {
            this.toggle();
        });
        
        // Add to viewer container
        const viewerContainer = this.viewer.renderer.domElement.parentElement;
        viewerContainer.appendChild(this.hamburgerButton);
        
        console.log(`Hamburger button created for viewer ${this.viewerId}`);
    }
    
    /**
     * Phase 2: Load sidebar.html template and create scoped container
     */
    createSidebarContainer() {
        this.container = document.createElement('div');
        this.container.className = 'viewer-sidebar';
        this.container.setAttribute('data-viewer-id', this.viewerId);
        
        // Phase 2: Container styling with proper Potree theme
        this.container.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 300px;
            height: 100%;
            background: #444;
            color: white;
            z-index: 999;
            overflow-y: auto;
            overflow-x: hidden;
            font-family: Arial, sans-serif;
            font-size: 12px;
            border-left: 1px solid #555;
        `;
        
        // Phase 2: Load sidebar template and scope IDs
        this.loadSidebarTemplate();
        
        console.log(`Phase 2 - Sidebar template loading initiated for viewer ${this.viewerId}`);
    }
    
    /**
     * Phase 2: Load sidebar.html template via AJAX and scope element IDs
     */
    loadSidebarTemplate() {
        const sidebarPath = new URL(window.Potree.scriptPath + '/sidebar.html').href;
        
        // Use jQuery to load the template
        const $container = $(this.container);
        $container.load(sidebarPath, (response, status, xhr) => {
            if (status === "error") {
                console.error(`Failed to load sidebar template: ${xhr.status} ${xhr.statusText}`);
                this.createFallbackContent();
                return;
            }
            
            console.log(`Sidebar template loaded for viewer ${this.viewerId}`);
            
            // Phase 2: Update element IDs for multi-viewer support
            this.updateElementIdsForViewer();
            
            // Phase 2: Initialize i18next and then APPEARANCE section
            this.initInternationalization(() => {
                this.initAppearanceSection();
            });
        });
    }
    
    /**
     * Phase 2: Update all element IDs to be viewer-specific
     */
    updateElementIdsForViewer() {
        const $container = $(this.container);
        
        // Find all elements with IDs and update them
        $container.find('[id]').each((index, element) => {
            const oldId = element.id;
            const newId = `${oldId}_${this.viewerId}`;
            element.id = newId;
            
            // Update any for attributes that reference the old ID
            $container.find(`[for="${oldId}"]`).attr('for', newId);
            
            // Update radio button name attributes for selectgroups
            if (element.tagName === 'INPUT' && element.type === 'radio') {
                if (element.name === oldId.replace(/_[^_]*$/, '')) {
                    element.name = newId.replace(/_[^_]*$/, '');
                }
            }
        });
        
        console.log(`Element IDs updated for viewer ${this.viewerId}`);
    }
    
    /**
     * Phase 2: Create fallback content if template loading fails
     */
    createFallbackContent() {
        this.container.innerHTML = `
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #fff; font-size: 14px;">
                    Viewer ${this.viewerId} - Sidebar
                </h3>
                <p style="margin: 0; color: #f88; font-size: 11px;">
                    Failed to load sidebar template
                </p>
            </div>
        `;
    }
    
    /**
     * Phase 2: Initialize i18next for text translations
     */
    initInternationalization(callback) {
        // Check if i18next is already initialized globally
        if (window.i18n && window.i18n.isInitialized && window.i18n.isInitialized()) {
            // Already initialized, just translate this container and continue
            $(this.container).i18n();
            callback();
            return;
        }
        
        // Initialize i18next if not already done
        if (window.i18n && !window.i18n.isInitialized) {
            window.i18n.init({
                lng: 'en',
                resGetPath: window.Potree.resourcePath + '/lang/__lng__/__ns__.json',
                preload: ['en', 'fr', 'de', 'jp', 'se', 'es', 'zh', 'it','ca'],
                getAsync: true,
                debug: false
            }, (t) => {
                // Translate this sidebar container
                $(this.container).i18n();
                console.log(`i18next initialized and applied to viewer ${this.viewerId}`);
                callback();
            });
        } else {
            // i18next not available, skip translation
            console.warn(`i18next not available for viewer ${this.viewerId}, continuing without translations`);
            callback();
        }
    }
    
    /**
     * Phase 2: Initialize APPEARANCE section with functional controls
     */
    initAppearanceSection() {
        const $container = $(this.container);
        
        // Initialize accordion functionality
        this.initAccordion();
        
        // Initialize Point Budget slider
        this.initPointBudgetSlider($container);
        
        // Initialize FOV slider
        this.initFOVSlider($container);
        
        // Initialize EDL controls
        this.initEDLControls($container);
        
        // Initialize Background selectgroup
        this.initBackgroundSelectgroup($container);
        
        // Initialize Splat Quality selectgroup
        this.initSplatQualitySelectgroup($container);
        
        // Initialize other controls
        this.initOtherControls($container);
        
        // Set version number
        $container.find(`#potree_version_number_${this.viewerId}`).html(
            window.Potree.version.major + "." + window.Potree.version.minor + window.Potree.version.suffix
        );
        
        console.log(`APPEARANCE section initialized for viewer ${this.viewerId}`);
    }
    
    /**
     * Initialize accordion functionality
     */
    initAccordion() {
        const $container = $(this.container);
        
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
     * Initialize Point Budget slider
     */
    initPointBudgetSlider($container) {
        const sldPointBudget = $container.find(`#sldPointBudget_${this.viewerId}`);
        const lblPointBudget = $container.find(`#lblPointBudget_${this.viewerId}`);
        
        sldPointBudget.slider({
            value: this.viewer.getPointBudget(),
            min: 100 * 1000,
            max: 10 * 1000 * 1000,
            step: 1000,
            slide: (event, ui) => { this.viewer.setPointBudget(ui.value); }
        });
        
        // Set initial label value
        lblPointBudget.html(this.addCommas(this.viewer.getPointBudget()));
        
        // Bind viewer events to update UI
        this.viewer.addEventListener('point_budget_changed', (event) => {
            lblPointBudget.html(this.addCommas(this.viewer.getPointBudget()));
            sldPointBudget.slider({value: this.viewer.getPointBudget()});
        });
    }
    
    /**
     * Initialize FOV slider
     */
    initFOVSlider($container) {
        const sldFOV = $container.find(`#sldFOV_${this.viewerId}`);
        const lblFOV = $container.find(`#lblFOV_${this.viewerId}`);
        
        sldFOV.slider({
            value: this.viewer.getFOV(),
            min: 20,
            max: 100,
            step: 1,
            slide: (event, ui) => { this.viewer.setFOV(ui.value); }
        });
        
        // Set initial label value
        lblFOV.html(parseInt(this.viewer.getFOV()));
        
        // Bind viewer events to update UI
        this.viewer.addEventListener('fov_changed', (event) => {
            lblFOV.html(parseInt(this.viewer.getFOV()));
            sldFOV.slider({value: this.viewer.getFOV()});
        });
    }
    
    /**
     * Initialize EDL (Eye-Dome Lighting) controls
     */
    initEDLControls($container) {
        const chkEDLEnabled = $container.find(`#chkEDLEnabled_${this.viewerId}`);
        const sldEDLRadius = $container.find(`#sldEDLRadius_${this.viewerId}`);
        const lblEDLRadius = $container.find(`#lblEDLRadius_${this.viewerId}`);
        const sldEDLStrength = $container.find(`#sldEDLStrength_${this.viewerId}`);
        const lblEDLStrength = $container.find(`#lblEDLStrength_${this.viewerId}`);
        const sldEDLOpacity = $container.find(`#sldEDLOpacity_${this.viewerId}`);
        const lblEDLOpacity = $container.find(`#lblEDLOpacity_${this.viewerId}`);
        
        // EDL Enabled checkbox
        chkEDLEnabled.prop('checked', this.viewer.getEDLEnabled());
        chkEDLEnabled.click(() => {
            this.viewer.setEDLEnabled(chkEDLEnabled.prop("checked"));
        });
        
        // EDL Radius slider
        sldEDLRadius.slider({
            value: this.viewer.getEDLRadius(),
            min: 1,
            max: 4,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLRadius(ui.value); }
        });
        lblEDLRadius.html(this.viewer.getEDLRadius().toFixed(1));
        
        // EDL Strength slider
        sldEDLStrength.slider({
            value: this.viewer.getEDLStrength(),
            min: 0,
            max: 5,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLStrength(ui.value); }
        });
        lblEDLStrength.html(this.viewer.getEDLStrength().toFixed(1));
        
        // EDL Opacity slider
        sldEDLOpacity.slider({
            value: this.viewer.getEDLOpacity(),
            min: 0,
            max: 1,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setEDLOpacity(ui.value); }
        });
        lblEDLOpacity.html(this.viewer.getEDLOpacity().toFixed(2));
        
        // Bind viewer events
        this.viewer.addEventListener('use_edl_changed', (event) => {
            chkEDLEnabled.prop('checked', this.viewer.getEDLEnabled());
        });
        
        this.viewer.addEventListener('edl_radius_changed', (event) => {
            lblEDLRadius.html(this.viewer.getEDLRadius().toFixed(1));
            sldEDLRadius.slider({value: this.viewer.getEDLRadius()});
        });
        
        this.viewer.addEventListener('edl_strength_changed', (event) => {
            lblEDLStrength.html(this.viewer.getEDLStrength().toFixed(1));
            sldEDLStrength.slider({value: this.viewer.getEDLStrength()});
        });
        
        this.viewer.addEventListener('edl_opacity_changed', (event) => {
            lblEDLOpacity.html(this.viewer.getEDLOpacity().toFixed(2));
            sldEDLOpacity.slider({value: this.viewer.getEDLOpacity()});
        });
    }
    
    /**
     * Initialize Background selectgroup
     */
    initBackgroundSelectgroup($container) {
        const elBackground = $container.find(`#background_options_${this.viewerId}`);
        elBackground.selectgroup();

        elBackground.find("input").click((e) => {
            this.viewer.setBackground(e.target.value);
        });

        // Set current background selection
        const currentBackground = this.viewer.getBackground();
        $container.find(`input[name=background_options_${this.viewerId}][value=${currentBackground}]`).trigger("click");
        
        // Bind viewer events
        this.viewer.addEventListener('background_changed', (event) => {
            $container.find(`input[name=background_options_${this.viewerId}][value='${this.viewer.getBackground()}']`).prop('checked', true);
        });
    }
    
    /**
     * Initialize Splat Quality selectgroup
     */
    initSplatQualitySelectgroup($container) {
        const elSplatQuality = $container.find(`#splat_quality_options_${this.viewerId}`);
        elSplatQuality.selectgroup({title: "Splat Quality"});

        elSplatQuality.find("input").click((e) => {
            if(e.target.value === "standard"){
                this.viewer.useHQ = false;
            }else if(e.target.value === "hq"){
                this.viewer.useHQ = true;
            }
        });

        // Set current quality selection
        const currentQuality = this.viewer.useHQ ? "hq" : "standard";
        $container.find(`input[name=splat_quality_options_${this.viewerId}][value=${currentQuality}]`).trigger("click");
    }
    
    /**
     * Initialize other controls (min node size, bounding box, freeze)
     */
    initOtherControls($container) {
        const sldMinNodeSize = $container.find(`#sldMinNodeSize_${this.viewerId}`);
        const lblMinNodeSize = $container.find(`#lblMinNodeSize_${this.viewerId}`);
        const chkBoundingBox = $container.find(`#show_bounding_box_${this.viewerId}`);
        const chkFreeze = $container.find(`#set_freeze_${this.viewerId}`);
        
        // Min Node Size slider
        sldMinNodeSize.slider({
            value: this.viewer.getMinNodeSize(),
            min: 0,
            max: 1000,
            step: 0.01,
            slide: (event, ui) => { this.viewer.setMinNodeSize(ui.value); }
        });
        lblMinNodeSize.html(parseInt(this.viewer.getMinNodeSize()));
        
        this.viewer.addEventListener('minnodesize_changed', (event) => {
            lblMinNodeSize.html(parseInt(this.viewer.getMinNodeSize()));
            sldMinNodeSize.slider({value: this.viewer.getMinNodeSize()});
        });
        
        // Bounding Box checkbox
        chkBoundingBox.click(() => {
            this.viewer.setShowBoundingBox(chkBoundingBox.prop("checked"));
        });
        
        // Freeze checkbox
        chkFreeze.click(() => {
            this.viewer.setFreeze(chkFreeze.prop("checked"));
        });
    }
    
    /**
     * Utility function to add commas to numbers
     */
    addCommas(nStr) {
        nStr += '';
        const x = nStr.split('.');
        let x1 = x[0];
        const x2 = x.length > 1 ? '.' + x[1] : '';
        const rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    }
    
    /**
     * Phase 1: Position sidebar relative to viewer bounds
     */
    positionSidebar() {
        const viewerContainer = this.viewer.renderer.domElement.parentElement;
        
        // Ensure viewer container has relative positioning and proper overflow
        if (getComputedStyle(viewerContainer).position === 'static') {
            viewerContainer.style.position = 'relative';
        }
        
        // Prevent sidebar overflow into other viewers
        viewerContainer.style.overflow = 'hidden';
        
        // Update positioning on window resize
        window.addEventListener('resize', () => {
            this.updatePosition();
        });
        
        console.log(`Sidebar positioned for viewer ${this.viewerId}`);
    }
    
    /**
     * Update sidebar position based on viewer container
     */
    updatePosition() {
        // Position is already handled by absolute positioning within viewer container
        // This method is for future positioning adjustments if needed
    }
    
    /**
     * Toggle sidebar open/close
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * Open the sidebar - add to DOM and show
     */
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        
        // Add sidebar to DOM
        const viewerContainer = this.viewer.renderer.domElement.parentElement;
        viewerContainer.appendChild(this.container);
        
        // Animate hamburger to X
        const spans = this.hamburgerButton.querySelectorAll('span');
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        
        this.dispatchEvent({type: 'sidebar_opened', sidebar: this});
        console.log(`Sidebar opened for viewer ${this.viewerId} - added to DOM`);
    }
    
    /**
     * Close the sidebar - completely remove from DOM
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Remove sidebar from DOM completely
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        
        // Reset hamburger icon
        const spans = this.hamburgerButton.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
        
        this.dispatchEvent({type: 'sidebar_closed', sidebar: this});
        console.log(`Sidebar closed for viewer ${this.viewerId} - removed from DOM`);
    }
    
    /**
     * Destroy sidebar and clean up
     */
    destroy() {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        
        if (this.hamburgerButton && this.hamburgerButton.parentElement) {
            this.hamburgerButton.parentElement.removeChild(this.hamburgerButton);
        }
        
        console.log(`Sidebar destroyed for viewer ${this.viewerId}`);
    }
}