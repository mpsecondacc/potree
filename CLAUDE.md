# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Potree-based point cloud visualization project that extends the core Potree functionality with custom tools and multi-viewport capabilities. Potree is a WebGL-based renderer for large point clouds, and this project has been customized to include:

- Custom 3-click profile creation workflow
- Multi-viewport management system with resizable panels
- Enhanced profile visualization tools
- Integration with THREE.js for 3D rendering

## Development Commands

### Setup and Build
```bash
npm install                 # Install dependencies and automatically build
npm start                  # Start development server with auto-rebuild on port 1234
npm run build              # Create production build in ./build/potree
```

### Development Server
- `npm start` starts a development server at `http://localhost:1234`
- Auto-rebuilds on file changes using gulp watch
- Access examples at `http://localhost:1234/examples/`

### Testing Examples
- Main viewer: `http://localhost:1234/examples/viewer.html`
- Multi-viewport system: `http://localhost:1234/examples/multi_viewport.html`
- Classifications example: `http://localhost:1234/examples/classifications.html`

## Architecture Overview

### Core Components Structure

**Potree Viewer System:**
- `src/viewer/viewer.js` - Main Potree viewer class
- `src/viewer/Scene.js` - Scene management and point cloud handling
- `src/viewer/profile.js` - Profile window UI and visualization

**Custom Extensions:**
- `src/components/MultiViewportManager.js` - Multi-viewport layout system with 3 panels (main, profile, auxiliary)
- `src/utils/ProfileTool.js` - Custom 3-click profile creation tool
- `src/utils/Profile.js` - Profile geometry and data structures

**Resource Management:**
- `build/potree/resources/` - Icons, textures, and UI assets
- Resource paths must use `window.Potree.resourcePath` for proper loading

### Key Architectural Patterns

**Viewer Creation:**
- Always use `new Potree.Viewer(container)` not `new Viewer()`
- Main viewer requires full container structure with proper CSS setup

**Multi-Viewport System:**
- Each viewport is an independent Potree.Viewer instance
- Main viewport (2/3 width) preserves full functionality including sidebar
- Secondary viewports (1/3 width each) can be activated/paused independently
- Resizable borders with drag functionality

**Profile Tool Integration:**
- Custom 3-click workflow: start point → end point → depth specification
- Restricted to orthographic camera mode with top view
- State machine pattern: WAITING_FIRST_CLICK → WAITING_SECOND_CLICK → WAITING_DEPTH_CLICK
- Integrates with existing Potree sidebar and profile visualization

## Critical Implementation Details

### Viewer Initialization
```javascript
// Correct way to create viewers
const viewer = new Potree.Viewer(domElement);

// Set proper resource path before any imports
window.Potree = window.Potree || {};
window.Potree.resourcePath = new URL('../build/potree/resources', window.location.href).href;
```

### Point Cloud Loading
```javascript
// Use exact working coordinates for camera positioning
viewer.scene.view.position.set(694274.518, 3916261.987, 348.732);
viewer.scene.view.lookAt(694683.097, 3916386.916, 30.879);

// Material settings for visibility
material.size = 3;
material.pointSizeType = Potree.PointSizeType.FIXED;
```

### Resource Path Management
- Replace `exports.resourcePath` with `(window.Potree && window.Potree.resourcePath) || '../build/potree/resources'`
- Use absolute URLs when possible to avoid URL constructor errors
- Critical for icons, textures, and shader loading

## File Structure Conventions

**Source Organization:**
- `src/components/` - Reusable UI components
- `src/utils/` - Tools and utilities (ProfileTool, measurement tools)
- `src/viewer/` - Core viewer functionality and UI
- `src/materials/` - Shader materials and rendering
- `examples/` - Demo pages and test files

**Testing Structure:**
- `examples/test_*.html` - Test pages for component isolation
- `examples/multi_viewport.html` - Main multi-viewport implementation
- Use working examples like `classifications.html` as reference for point cloud loading

## Custom Tool Development

### ProfileTool Pattern
The ProfileTool implements a state machine for 3-click interaction:
1. Validates camera mode (orthographic + top view only)
2. Manages click states with visual feedback
3. Integrates with existing profile visualization system
4. Uses UUID generation for profile identification

### Multi-Viewport Integration
When adding new tools to the multi-viewport system:
1. Design for main viewport compatibility first
2. Consider secondary viewport activation behavior
3. Handle point cloud sharing between viewports
4. Implement proper cleanup on viewport pause/unpause

## Resource Dependencies

**Essential Libraries:**
- THREE.js (ES6 modules)
- jQuery + jQuery UI
- Potree core engine
- proj4 for coordinate transformations
- Spectrum for color picking
- JSTree for sidebar navigation

**Build Dependencies:**
- Gulp for build automation and development server
- Rollup for module bundling
- Various gulp plugins for asset processing

All examples require the full dependency stack - attempting to minimize dependencies often breaks functionality.

**NOTES**
- always write optimized code
- when having a to do list always stop after checking one off, i must allow you to proceed
- when writing code in the src/ files always leave a comment "CUSTOM" so i know if something was changed by you
- all new .js files in src/ directory need to have suffix "-NEW"
- all code must be written in components and written for future scalability
- keep in mind the security 
- performance is a key metric, do not write unoptimized code and always give suggestions if something gives better performance


● The implementation is now ready for testing. Both issues have been addressed:

  1. Earth Controls orthographic mode - Enhanced with proper camera mode detection and pivot
  indicator reset --> still zooming in and out behaviour
  2. Profile creation JSTree integration - Fixed to use the actual JSTree structure instead of
  custom DOM ---> profile now created under JSTree but show 2D profile is missing, whatever happens when clicking that button needs to be called so that the profile view shows up after drawing a profile