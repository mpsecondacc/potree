// CUSTOM - TestLogger module for centralized logging functionality
export class TestLogger {
    constructor() {
        this.logElement = null;
    }

    /**
     * Log a message with timestamp
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, success, error, warning)
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        // Console logging with appropriate method
        switch (level) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warning':
                console.warn(formattedMessage);
                break;
            case 'success':
                console.log(`✅ ${formattedMessage}`);
                break;
            default:
                console.log(formattedMessage);
        }
        
        // UI logging if log element exists
        if (this.logElement) {
            this.logElement.textContent += formattedMessage + '\n';
            this.logElement.scrollTop = this.logElement.scrollHeight;
        }
    }

    /**
     * Success message shorthand
     */
    success(message) {
        this.log(message, 'success');
    }

    /**
     * Error message shorthand
     */
    error(message) {
        this.log(message, 'error');
    }

    /**
     * Warning message shorthand
     */
    warning(message) {
        this.log(message, 'warning');
    }

    /**
     * Set DOM element for UI logging
     */
    setLogElement(element) {
        this.logElement = element;
    }

    /**
     * Clear logs
     */
    clear() {
        if (this.logElement) {
            this.logElement.textContent = '';
        }
        console.clear();
    }
}

// Create global instance for backward compatibility
export const logger = new TestLogger();

// Legacy global function for backward compatibility
export function log(message) {
    logger.log(message);
}