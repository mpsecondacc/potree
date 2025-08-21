/**
 * ViewerSidebar - Original Potree sidebar adapted for multi-viewer
 * Based on the original Potree sidebar.js but adapted for ViewerManager integration
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../EventDispatcher.js";

export class ViewerSidebar extends EventDispatcher {
    
    constructor(viewer, viewerId, viewerManager) {
        super();
        
        this.viewer = viewer;
        this.viewerId = viewerId;
        this.viewerManager = viewerManager;
        
        this.isOpen = false;
        this.container = null;
        this.sidebarRoot = null;
        
        // Create sidebar using original Potree sidebar HTML structure
        this.initializeSidebar();
    }
    
    initializeSidebar() {
        // Create sidebar container
        this.container = document.createElement('div');
        this.container.className = 'viewer-sidebar';
        this.container.setAttribute('data-viewer-id', this.viewerId);
        
        // Use the original sidebar HTML from build/potree/sidebar.html
        this.container.innerHTML = `
            <div id="sidebar_root_${this.viewerId}" class="sidebar_root">
                <div id="sidebar_header_${this.viewerId}">
                    <span id="potree_branding_${this.viewerId}" class="potree_sidebar_brand">
                        <a href="http://potree.org" target="_blank">potree.org</a> 
                        <span style="margin: 0px 3px; color: #9AA1A4"> - </span> 
                        <a href="https://github.com/potree/potree" target="_blank">github</a>
                        <span style="margin: 0px 3px; color: #9AA1A4"> - </span> 
                        <a href="https://twitter.com/m_schuetz" target="_blank">twitter</a>
                        <span style="flex-grow: 1"></span>
                        <span id="potree_version_number_${this.viewerId}" style="color: #9AA1A4; font-size: 80%; font-weight: 100"></span>
                    </span>
                    <div id="potree_languages_${this.viewerId}" style="font-family:arial;"></div>
                </div>
                <div> 
                    <div id="potree_menu_${this.viewerId}" class="accordion">
                        
                        <!-- APPEARANCE -->
                        <h3 id="menu_appearance_${this.viewerId}"><span data-i18n="tb.rendering_opt"></span></h3>
                        <div>
                            <ul class="pv-menu-list">
                                <li><span data-i18n="appearance.nb_max_pts"></span>: <span id="lblPointBudget_${this.viewerId}"></span> <div id="sldPointBudget_${this.viewerId}"></div></li>
                                <li><span data-i18n="appearance.field_view"></span>: <span id="lblFOV_${this.viewerId}"></span><div id="sldFOV_${this.viewerId}"></div></li>

                                <div class="divider"><span>Eye-Dome-Lighting</span></div>

                                <li><label><input type="checkbox" id="chkEDLEnabled_${this.viewerId}"/><span data-i18n="appearance.edl_enable"></span></label></li>
                                <li><span data-i18n="appearance.edl_radius"></span>: <span id="lblEDLRadius_${this.viewerId}"></span><div id="sldEDLRadius_${this.viewerId}"></div></li>
                                <li><span data-i18n="appearance.edl_strength"></span>: <span id="lblEDLStrength_${this.viewerId}"></span><div id="sldEDLStrength_${this.viewerId}"></div></li>
                                <li><span data-i18n="appearance.edl_opacity"></span>: <span id="lblEDLOpacity_${this.viewerId}"></span><div id="sldEDLOpacity_${this.viewerId}"></div></li>
                                
                                <div class="divider"><span>Background</span></div>

                                <li>
                                    <selectgroup id="background_options_${this.viewerId}">
                                        <option id="background_options_skybox_${this.viewerId}" value="skybox">Skybox</option>
                                        <option id="background_options_gradient_${this.viewerId}" value="gradient">Gradient</option>
                                        <option id="background_options_black_${this.viewerId}" value="black">Black</option>
                                        <option id="background_options_white_${this.viewerId}" value="white">White</option>
                                        <option id="background_options_none_${this.viewerId}" value="null">None</option>
                                    </selectgroup>
                                </li>

                                <div class="divider"><span>Other</span></div>

                                <li>
                                    <selectgroup id="splat_quality_options_${this.viewerId}">
                                        <option id="splat_quality_options_standard_${this.viewerId}" value="standard">Standard</option>
                                        <option id="splat_quality_options_hq_${this.viewerId}" value="hq">High Quality</option>
                                    </selectgroup>
                                </li>
                                
                                <li><span data-i18n="appearance.min_node_size"></span>: <span id="lblMinNodeSize_${this.viewerId}"></span><div id="sldMinNodeSize_${this.viewerId}"></div></li>
                                <li><label><input id="show_bounding_box_${this.viewerId}" type="checkbox" /><span data-i18n="appearance.box"></span></label></li>
                                <li><label><input id="set_freeze_${this.viewerId}" type="checkbox" /><span data-i18n="appearance.freeze"></span></label></li>
                            </ul>
                        </div>
                        
                        <!-- TOOLS -->
                        <h3 id="menu_tools_${this.viewerId}"><span data-i18n="tb.tools_opt"></span></h3>
                        <div class="pv-menu-list">

                            <div class="divider"><span>Measurement</span></div>

                            <li id="tools_${this.viewerId}"></li>

                            <li>
                                <selectgroup id="measurement_options_show_${this.viewerId}">
                                    <option id="measurement_options_show_yes_${this.viewerId}" value="SHOW">Show</option>
                                    <option id="measurement_options_show_no_${this.viewerId}" value="HIDE">Hide</option>
                                </selectgroup>
                            </li>

                            <div class="divider"><span>Clipping</span></div>

                            <li id="clipping_tools_${this.viewerId}"></li>

                            <li>
                                <selectgroup id="cliptask_options_${this.viewerId}">
                                    <option id="cliptask_options_none_${this.viewerId}" value="NONE">None</option>
                                    <option id="cliptask_options_highlight_${this.viewerId}" value="HIGHLIGHT">Highlight</option>
                                    <option id="cliptask_options_show_inside_${this.viewerId}" value="SHOW_INSIDE">Inside</option>
                                    <option id="cliptask_options_show_outside_${this.viewerId}" value="SHOW_OUTSIDE">Outside</option>
                                </selectgroup>
                            </li>

                            <li>
                                <selectgroup id="clipmethod_options_${this.viewerId}">
                                    <option id="clipmethod_options_any_${this.viewerId}" value="INSIDE_ANY">Inside Any</option>
                                    <option id="clipmethod_options_all_${this.viewerId}" value="INSIDE_ALL">Inside All</option>
                                </selectgroup>
                            </li>
                            
                            <div class="divider"><span>Navigation</span></div>

                            <li id="navigation_${this.viewerId}"></li>

                            <li><span data-i18n="appearance.move_speed"></span>: <span id="lblMoveSpeed_${this.viewerId}"></span><div id="sldMoveSpeed_${this.viewerId}"></div></li>
                        </div>

                        <!-- SCENE -->
                        <h3 id="menu_scene_${this.viewerId}"><span data-i18n="tb.scene_opt"></span></h3>
                        <div class="pv-menu-list">

                            <div id="scene_export_${this.viewerId}"></div>

                            <div class="divider"><span>Objects</span></div>

                            <div id="scene_objects_${this.viewerId}"></div>

                            <div class="divider"><span>Properties</span></div>

                            <div id="scene_object_properties_${this.viewerId}"></div>
                        </div>

                        <!-- Classification -->
                        <h3 id="menu_filters_${this.viewerId}"><span data-i18n="tb.filters_opt"></span></h3>
                        <div>

                            <div class="divider"><span>Classification</span></div>

                            <ul id="classificationList_${this.viewerId}" class="pv-menu-list"></ul>

                            <div class="divider"><span>Returns</span></div>

                            <div id="return_filter_panel_${this.viewerId}">
                                <ul class="pv-menu-list">
                                    <li><span data-i18n="filters.return_number"></span>: <span id="lblReturnNumber_${this.viewerId}"></span> <div id="sldReturnNumber_${this.viewerId}"></div></li>
                                    <li><span data-i18n="filters.number_of_returns"></span>: <span id="lblNumberOfReturns_${this.viewerId}"></span> <div id="sldNumberOfReturns_${this.viewerId}"></div></li>
                                </ul>
                            </div>

                            <div class="divider"><span>Point Source ID</span></div>

                            <div>
                                <ul class="pv-menu-list" id="pointsourceid_filter_panel_${this.viewerId}"></ul>
                            </div>

                            <div class="divider"><span>GPS Time</span></div>

                            <div id="gpstime_filter_panel_${this.viewerId}">
                                <ul class="pv-menu-list">
                                    <div id="gpstime_multilevel_range_container_${this.viewerId}">
                                        <li>
                                            <span style="display: flex">
                                                <span>Time: </span>
                                                <input id="txtGpsTime_${this.viewerId}" type="text" style="margin: auto 10px"/>
                                                <input id="btnFindGpsTime_${this.viewerId}" type="button" value="find" />
                                            </span>
                                        </li>
                                    </div>
                                </ul>
                            </div>
                        </div>
                        
                        <!-- ABOUT -->
                        <h3 id="menu_about_${this.viewerId}"><span data-i18n="tb.about_opt"></span></h3>
                        <div>
                            <ul class="pv-menu-list">
                                <li><a href="http://potree.org" target="_blank">Potree</a> is a viewer for large point cloud / LIDAR data sets, developed at the Vienna University of Technology. 
                                <a href="https://github.com/potree/potree" target="_blank">(github)</a>
                                </li>
                                <li><b>Author: </b><a href="mailto:mschuetz@potree.org">Markus Sch&uuml;tz</a></li>
                                <li><b>License: </b><a target="_blank" href="https://github.com/potree/potree/blob/develop/LICENSE/">FreeBSD (2-clause BSD)</a></li>
                                <li><b>Dependency Licenses:</b> <a target="_blank" href="https://github.com/potree/potree/tree/develop/libs/">See github</a></li>
                            </ul>
                        </div>

                    </div>
                </div>
            </div>
        `;
        
        // Initialize the sidebar functionality
        this.initOriginalSidebar();
    }
    
    /**
     * Initialize original Potree sidebar functionality with viewer-specific IDs
     */
    initOriginalSidebar() {
        // This will implement the original sidebar functionality but adapted for multi-viewer
        // For now, just mark it as ready
        console.log(`Original sidebar initialized for viewer ${this.viewerId}`);
        
        // Add basic jQuery UI accordion functionality if available
        if (window.$ && window.$.fn.accordion) {
            $(`#potree_menu_${this.viewerId}`).accordion({
                heightStyle: "fill",
                collapsible: true,
                active: false
            });
        }
    }
    
    open() {
        this.isOpen = true;
        if (this.container) {
            this.container.style.display = 'block';
        }
        this.dispatchEvent({type: 'sidebar_opened', sidebar: this});
    }
    
    close() {
        this.isOpen = false;
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.dispatchEvent({type: 'sidebar_closed', sidebar: this});
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.viewer = null;
        this.viewerManager = null;
    }
}