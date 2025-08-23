# Multi-Viewer HTML Test Suite

This directory contains the refactored ES6 module structure for the Potree multi-viewer testing system.

## Directory Structure

```
1 - multiViewer HTML/
├── test-multi-viewer-NEW.html    # Main test page
├── main.js                       # Main orchestration module
├── core/                         # Core functionality modules
│   ├── TestLogger.js            # Centralized logging system
│   ├── UIManager.js             # Button state and DOM management
│   └── TestCore.js              # Shared test state and utilities
├── multiviewer/                  # MultiViewer specific modules
│   ├── MultiViewerTester.js     # MultiViewer creation and management
│   └── LayoutTester.js          # Layout testing and validation
├── features/                     # Feature-specific test modules
│   ├── PerformanceTester.js     # Performance monitoring and optimization
│   ├── CommunicationTester.js   # Cross-viewer communication and shared objects
│   ├── MaterialTester.js        # Material cloning and isolation testing
│   ├── ConfigurationTester.js   # Configuration save/load/export/import
│   └── SidebarTester.js         # Sidebar management and testing
└── cad/                         # Future CAD functionality
    └── (To be created)
```

## Benefits of This Structure

### 1. **Modularity**
- Each module has a single responsibility
- Easy to locate and modify specific functionality
- Clear separation between core utilities and test features

### 2. **Next.js Ready**
- Uses ES6 modules (import/export)
- Tree-shakable imports
- Easy conversion to React components/hooks later

### 3. **Maintainability**
- ~2000 lines of code split into manageable ~200-300 line modules
- Clear dependencies between modules
- TypeScript conversion ready

### 4. **Scalability**
- Easy to add new test modules
- CAD functionality can be added in dedicated directory
- Performance optimizations through selective imports

## Usage

1. **Development Server**: 
   ```bash
   npm start
   # Then visit http://localhost:1234/1%20-%20multiViewer%20HTML/test-multi-viewer-NEW.html
   ```

2. **Auto-initialization**: The page automatically initializes the MultiViewer on load

3. **Module Access**: All modules are exposed globally for debugging:
   ```javascript
   // Access modules in browser console
   window.testModules.logger
   window.testModules.uiManager
   window.testModules.multiViewerTester
   window.testModules.layoutTester
   ```

## Migration Path to Next.js

1. **Phase 1**: Convert modules to React hooks
   - `TestLogger.js` → `useTestLogger()` hook
   - `UIManager.js` → `useUIManager()` hook
   - etc.

2. **Phase 2**: Create Next.js pages
   - `/multiviewer` → Main multi-viewer page
   - `/performance` → Performance testing page
   - `/cad` → CAD tools page

3. **Phase 3**: API integration
   - Configuration persistence through Next.js API routes
   - Server-side point cloud processing
   - Real-time collaboration features

## Feature Modules Overview

### Core Functionality
- **TestLogger.js**: Centralized logging with different levels (info, success, error, warning)
- **UIManager.js**: Button state management and DOM manipulation utilities
- **TestCore.js**: Shared test state, MultiViewer coordination, and utilities

### MultiViewer Testing
- **MultiViewerTester.js**: Create, manage, add/remove viewers dynamically
- **LayoutTester.js**: Test 1x2, main-dual, 2x2 layouts with validation

### Feature Testing  
- **PerformanceTester.js**: FPS monitoring, render optimization, memory tracking
- **CommunicationTester.js**: Shared geometry, cross-viewer messaging, object synchronization
- **MaterialTester.js**: Material isolation testing, cloning validation, comprehensive UI fixes
- **ConfigurationTester.js**: Save/load configurations, export/import JSON, validation
- **SidebarTester.js**: Sidebar management, API testing, point cloud integration

## Current Status

- ✅ Core modules implemented and tested
- ✅ MultiViewer modules implemented and tested
- ✅ All feature modules implemented (complete original functionality)
- ✅ Legacy compatibility maintained (all original functions work)
- ✅ ES6 modules with Next.js migration path ready
- ✅ Auto-initialization on page load
- ✅ Focus functionality UI controls removed as requested (core functionality preserved)
- ⏳ CAD modules - ready for implementation

## Adding New Features

To add a new feature module:

1. Create the module file in appropriate directory
2. Import and export it in `main.js`
3. Add global functions for backward compatibility
4. Update this README

Example:
```javascript
// features/NewFeatureTester.js
export class NewFeatureTester {
    // Implementation
}

// main.js
import { newFeatureTester } from './features/NewFeatureTester.js';
window.testNewFeature = function() {
    return newFeatureTester.runTest();
};
```