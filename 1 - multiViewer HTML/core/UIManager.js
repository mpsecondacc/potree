// CUSTOM - UIManager module for button states and DOM manipulation
import { logger } from './TestLogger.js';

export class UIManager {
    constructor() {
        this.buttons = new Map();
        this.initialized = false;
    }

    /**
     * Initialize UI manager and scan for buttons
     */
    initialize() {
        if (this.initialized) return;

        // Scan for all buttons with IDs
        const buttons = document.querySelectorAll('button[id]');
        buttons.forEach(button => {
            this.buttons.set(button.id, button);
        });

        logger.log(`UIManager initialized with ${this.buttons.size} buttons`);
        this.initialized = true;
    }

    /**
     * Enable a button by ID
     */
    enableButton(id) {
        const button = this.buttons.get(id);
        if (button) {
            button.disabled = false;
            logger.log(`✓ Enabled button: ${id}`);
        } else {
            logger.warning(`Button not found: ${id}`);
        }
    }

    /**
     * Disable a button by ID
     */
    disableButton(id) {
        const button = this.buttons.get(id);
        if (button) {
            button.disabled = true;
            logger.log(`✓ Disabled button: ${id}`);
        } else {
            logger.warning(`Button not found: ${id}`);
        }
    }

    /**
     * Update button text
     */
    updateButtonText(id, text) {
        const button = this.buttons.get(id);
        if (button) {
            button.textContent = text;
        }
    }

    /**
     * Update button style
     */
    updateButtonStyle(id, styles) {
        const button = this.buttons.get(id);
        if (button) {
            Object.assign(button.style, styles);
        }
    }

    /**
     * Enable multiple buttons
     */
    enableButtons(buttonIds) {
        buttonIds.forEach(id => this.enableButton(id));
    }

    /**
     * Disable multiple buttons
     */
    disableButtons(buttonIds) {
        buttonIds.forEach(id => this.disableButton(id));
    }

    /**
     * Get button states
     */
    getButtonStates() {
        const states = {};
        this.buttons.forEach((button, id) => {
            states[id] = {
                disabled: button.disabled,
                text: button.textContent,
                visible: !button.hidden
            };
        });
        return states;
    }

    /**
     * Show/hide button groups for different test phases
     */
    showMultiViewerButtons() {
        this.enableButtons([
            'createViewersBtn',
            'layout1x2Btn', 
            'layout2x2Btn'
        ]);
    }

    showViewerButtons() {
        this.enableButtons([
            'toggleSyncBtn',
            // CUSTOM - Focus functionality commented out as requested
            // 'lockFocusBtn',
            'addViewerBtn',
            'removeViewerBtn',
            'identificationBtn',
            'statusBtn'
        ]);
    }

    showPerformanceButtons() {
        this.enableButtons([
            'performanceBtn',
            'startMonitorBtn',
            'forceRenderBtn'
        ]);
    }

    showCommunicationButtons() {
        this.enableButtons([
            'commSystemBtn',
            'sharedGeomBtn',
            'drawLineBtn',
            'clearSharedBtn',
            'commStatsBtn'
        ]);
    }

    showConfigurationButtons() {
        this.enableButtons([
            'saveConfigBtn',
            'loadConfigBtn',
            'listConfigBtn',
            'exportConfigBtn',
            'importConfigBtn',
            'deleteConfigBtn'
        ]);
    }

    showSidebarButtons() {
        this.enableButtons([
            'openAllSidebarsBtn',
            'closeAllSidebarsBtn',
            'sidebarStatsBtn',
            'sidebarAPIBtn'
        ]);
    }

    resetAllButtons() {
        // Enable only create button
        this.disableButtons(Array.from(this.buttons.keys()));
        this.enableButton('createBtn');
    }
}

// Global instance
export const uiManager = new UIManager();

// Legacy global functions for backward compatibility
export function enableButton(id) {
    uiManager.enableButton(id);
}

export function disableButton(id) {
    uiManager.disableButton(id);
}