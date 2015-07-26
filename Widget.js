///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    "dojo/_base/declare",
    "dojo/dom",
    'dojo/dom-style',
    'dojo/_base/html',
    "dojo/on",
    "dojo/_base/lang",
    "dojo/store/Memory",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/ProgressBar",
    "dijit/form/FilteringSelect",
    "jimu/BaseWidget",
    "jimu/utils",
    "jimu/SpatialReference/utils",
    "jimu/dijit/SymbolChooser",
    "jimu/dijit/TabContainer",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
	"esri/Color",
    "esri/tasks/locator",
    "esri/geometry/Point",
    "esri/tasks/GeometryService",
    "esri/SpatialReference",
    "esri/geometry/Extent",
    "esri/tasks/ProjectParameters",
	"esri/geometry/webMercatorUtils",
    "esri/InfoTemplate",
    "esri/graphic",
],
function (
    declare,
    dom,
    domStyle,
    html,
    on,
    lang,
    Memory,
    WidgetsInTemplateMixin,
    ProgressBar,
    FilteringSelect,
    BaseWidget,
    utils,
    Spatialutils,
    SymbolChooser,
    TabContainer,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    Color,
    Locator,
    Point,
    GeometryService,
    SpatialReference,
    Extent,
    ProjectParameters,
    webMercatorUtils,
    InfoTemplate,
    Graphic
) {
    // Base widget
    return declare([BaseWidget, WidgetsInTemplateMixin], {
        baseClass: 'jimu-widget-locatecoordinates',
        tabContainer: null,
        mapSheets1Data: [],
        mapSheets2Data: [],

        // EVENT FUNCTION - Creation of widget
        postCreate: function () {
            console.log('Locate Coordinates widget created...');
            this.inherited(arguments);

            // Setup tabs
            var tabs = [];
            tabs.push({
                title: this.nls.locate,
                content: this.locateTab
            });
            tabs.push({
                title: this.nls.symbology,
                content: this.symbologyTab
            });
            this.selTab = this.nls.locate;
            this.tabContainer = new TabContainer({
                tabs: tabs,
                selected: this.selTab
            }, this.locateCoordinatesTab);

            this.tabContainer.startup();
            utils.setVerticalCenter(this.tabContainer.domNode);

            // Load in coordinates to selection
            var len = this.config.coordinateSystems.length;
            for (var a = 0; a < len; a++) {
                var option = {
                    value: this.config.coordinateSystems[a].wkid,
                    label: this.config.coordinateSystems[a].label
                };
                this.coordSystemSelect.addOption(option);
            }

            // Load in map sheet labels
            if (this.config.nzMapSheets === true) {
                var option = {
                    value: this.config.mapSheets1.name,
                    label: this.config.mapSheets1.name
                };
                this.coordSystemSelect.addOption(option);

                var option = {
                    value: this.config.mapSheets2.name,
                    label: this.config.mapSheets2.name
                };
                this.coordSystemSelect.addOption(option);

                // Load the map sheet selection box
                this.mapSheetSelection = new FilteringSelect({
                    id: "sheetID",
                    searchAttr: "sheetID",
                    labelAttr: "sheetID"
                });
                this.mapSheetSelection.placeAt(this.mapSheetTextBox);
                this.mapSheetSelection.startup();
                // Load the map sheet selection data
                mapSheets1Data = this.config.mapSheets1.mapSheets;
                mapSheets2Data = this.config.mapSheets2.mapSheets;
            }
        },

        // EVENT FUNCTION - Startup widget
        startup: function () {
            console.log('Locate Coordinates widget started...');
            this.inherited(arguments);

            var mapFrame = this;
            var map = this.map;

            // Get configurations
            // Get geometry service URL from settings
            var geometryService = new GeometryService(this.config.geometryServiceURL);
            var geometryLocatorService = new GeometryService(this.config.geometryServiceURL);
            // Get address locator URL from settings
            var locatorService = new Locator(this.config.addressLocatorServiceURL);          
            locatorService.outSpatialReference = map.spatialReference;
            // EVENT - Coordinate system change
            on(this.coordSystemSelect, "change", updateCoordinateLabels);
            // EVENT - Project completed
            geometryService.on("project-complete", getPoint);
            // EVENT - Location to address complete
            locatorService.on("location-to-address-complete", goToPoint);

            // Setup labels
            updateCoordinateLabels();   

            // EVENT FUNCTION - Locate button click
            on(this.locateButton, 'click', lang.hitch(this, function (evt) {
                // Hide error message
                domStyle.set(mapFrame.errorText, 'display', 'none');
                mapFrame.errorText.innerHTML = "";

                // Close info window
                map.infoWindow.hide();
                // Clear existing graphics
                map.graphics.clear();

                // Get X and Y coordinates from text box
                xCoord = mapFrame.xCoordTextBox.get('value');
                yCoord = mapFrame.yCoordTextBox.get('value');

                // If valid input
                if ((xCoord) && (yCoord)) {
                    // If map sheet selected
                    if ((mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets1.name) || (mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets2.name)) {
                        // If valid input for map sheet
                        if (mapFrame.mapSheetSelection.get('value')) {
                            // Show loading bar
                            html.setStyle(mapFrame.progressBar.domNode, "display", "block");

                            // Close info window
                            map.infoWindow.hide();
                            // Clear existing graphics
                            map.graphics.clear();

                            console.log("Map sheet series selected - " + mapFrame.coordSystemSelect.value + "...");

                            goToMapSheet();
                        }
                        // Non valid input
                        else {
                            // Show error message
                            domStyle.set(mapFrame.errorText, 'display', 'block');
                            mapFrame.errorText.innerHTML = mapFrame.nls.errorMessageCoordinates;
                        }

                    }
                    // If coordinate system selected
                    else {
                        // Show loading bar
                        html.setStyle(mapFrame.progressBar.domNode, "display", "block");

                        // Close info window
                        map.infoWindow.hide();
                        // Clear existing graphics
                        map.graphics.clear();

                        // Project point to map if needed
                        if (mapFrame.coordSystemSelect.value != map.spatialReference.wkid) {
                            // Create new point
                            var inputPoint = new Point([xCoord, yCoord], new SpatialReference({ wkid: this.coordSystemSelect.value }));

                            geometryService.project([inputPoint], map.spatialReference);
                        }
                        // Coordinate system is same as map
                        else {
                            getPoint();
                        }
                    }
                }
                // Non valid input
                else {
                    // Show error message
                    domStyle.set(mapFrame.errorText, 'display', 'block');
                    mapFrame.errorText.innerHTML = mapFrame.nls.errorMessageCoordinates;
                }
            }));

            // EVENT FUNCTION - Get the point    
            function getPoint(evt) {
                // Get the point
                if (evt) {
                    // Get the projected point
                    point = evt.geometries[0];
                }
                else {
                    // Get X and Y coordinates from text box
                    xCoord = mapFrame.xCoordTextBox.get('value');
                    yCoord = mapFrame.yCoordTextBox.get('value');
                    point = new Point([xCoord, yCoord], new SpatialReference({ wkid: mapFrame.coordSystemSelect.value }));
                }

                // If address locator provided
                if (locatorService) {
                    var params = new ProjectParameters();
                    params.geometries = [point];
                    // Locate addresses within specified metres
                    locatorService.locationToAddress(point, 100);
                }
                else {
                    goToPoint(point);
                }
            }

            // EVENT FUNCTION - Clear button click
            on(this.clearButton, 'click', lang.hitch(this, function (evt) {
                // Hide error message
                domStyle.set(mapFrame.errorText, 'display', 'none');
                mapFrame.errorText.innerHTML = "";

                // Close info window
                map.infoWindow.hide();
                // Clear existing graphics
                map.graphics.clear();
                mapFrame.xCoordTextBox.set('value', '');
                mapFrame.yCoordTextBox.set('value', '');
                if (mapFrame.mapSheetSelection) {
                    mapFrame.mapSheetSelection.set('value', '');
                }
            }));

            // FUNCTION - Go to map sheet
            function goToMapSheet() {
                // Get which map sheet series data
                if (mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets2.name) {
                    mapSeries = mapFrame.config.mapSheets2;
                }
                else {
                    mapSeries = mapFrame.config.mapSheets1;
                }
                mapSheetSelected = mapFrame.mapSheetSelection._lastDisplayedValue;
                xCoord = mapFrame.xCoordTextBox.get('value');
                yCoord = mapFrame.yCoordTextBox.get('value');

                // Get the coordinates for the map sheet
                for (var mapSheet in mapSeries.mapSheets) {
                    // For the selected map sheet
                    if (mapSeries.mapSheets[mapSheet].sheetID == mapSheetSelected) {
                        console.log("Map sheet selected - " + mapSeries.mapSheets[mapSheet].sheetID) + "...";
                        // Coordinate boundaries for map sheet selected
                        xmin = mapSeries.mapSheets[mapSheet].xmin;
                        ymin = mapSeries.mapSheets[mapSheet].ymin;
                        xmax = mapSeries.mapSheets[mapSheet].xmax;
                        ymax = mapSeries.mapSheets[mapSheet].ymax;

                        // Convert the grid coordinates
                        xCoordConverted = xmin.substring(0, 2) + xCoord + "00"
                        yCoordConverted = ymin.substring(0, 2) + yCoord + "00"

                        // Validate coordinates
                        if ((parseFloat(xCoordConverted) > parseFloat(xmin)) && (parseFloat(xCoordConverted) < parseFloat(xmax)) && (parseFloat(yCoordConverted) > parseFloat(ymin)) && (parseFloat(yCoordConverted) < parseFloat(ymax))) {
                            point = new Point([xCoordConverted, yCoordConverted], new SpatialReference({ wkid: mapSeries.wkid }));

                            // Project point to map if needed
                            if (mapSeries.wkid != map.spatialReference.wkid) {
                                // Project point
                                geometryService.project([point], map.spatialReference);
                            }
                                // Coordinate system is same as map
                            else {
                                // If address locator provided
                                if (locatorService) {
                                    var params = new ProjectParameters();
                                    params.geometries = [point];
                                    // Locate addresses within specified metres
                                    locatorService.locationToAddress(point, 100);
                                }
                                else {
                                    goToPoint(point);
                                }
                            }
                        }
                        else {
                            // Show error message
                            domStyle.set(mapFrame.errorText, 'display', 'block');
                            mapFrame.errorText.innerHTML = mapFrame.nls.errorMessageCoordinates;
                        }
                    }
                }

                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            }

            // FUNCTION - Go to the point
            function goToPoint(evt) {
                var content = "<b>X: " + (Math.round(point.x * 100) / 100) + "<br/>" + "Y: " + (Math.round(point.y * 100) / 100) + "</b>";
                // If address locator provided
                if (locatorService) {
                    var address = evt.address.address.Match_addr;
                    content += "<br/><br/>" + mapFrame.nls.closestAddress + ": " + address;
                }

                // Add point to map
                var symbol = mapFrame.pointSymbolChooser.getSymbol();
                var graphic = new Graphic(point, symbol);
                map.graphics.add(graphic);

                // Zoom to point
                zoomExtent = map.extent.centerAt(point).expand(0.01);
                map.setExtent(zoomExtent);
                // Show popup
                map.infoWindow.setTitle(mapFrame.nls.location);
                map.infoWindow.setContent(content);
                map.infoWindow.show(point);

                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            };

            // FUNCTION - Update coordinates labels
            function updateCoordinateLabels() {
                // Get coordinate system type selected
                Spatialutils.loadResource();
                var WKTCurrent = Spatialutils.getCSStr(mapFrame.coordSystemSelect.value);
                // If WKT returned
                if (WKTCurrent) {
                    // If geographic
                    if (WKTCurrent.charAt(0) == 'G') {
                        // Update labels
                        mapFrame.xCoordLabel.innerHTML = mapFrame.nls.geographicXLabel + ":";
                        mapFrame.yCoordLabel.innerHTML = mapFrame.nls.geographicYLabel + ":";
                        // If projected
                    } else {
                        // Update labels
                        mapFrame.xCoordLabel.innerHTML = mapFrame.nls.projectedXLabel + ":";
                        mapFrame.yCoordLabel.innerHTML = mapFrame.nls.projectedYLabel + ":";
                    }
                }
                // Otherwise generic labels
                else {
                    // Update labels
                    mapFrame.xCoordLabel.innerHTML = "X:";
                    mapFrame.yCoordLabel.innerHTML = "Y:";
                }
                
                if (mapFrame.coordSystemSelect.value == "2193") {
                    mapFrame.helpText.innerHTML = mapFrame.nls.helpMessageNZTM;
                }
                if (mapFrame.coordSystemSelect.value == "27200") {
                    mapFrame.helpText.innerHTML = mapFrame.nls.helpMessageNZMG;
                }
                if (mapFrame.coordSystemSelect.value == "4326") {
                    mapFrame.helpText.innerHTML = mapFrame.nls.helpMessageWGS84;
                }
                if (mapFrame.coordSystemSelect.value == "NZTopo 50 Sheet") {
                    mapFrame.helpText.innerHTML = mapFrame.nls.helpMessageNZTopo50Sheet;
                }
                if (mapFrame.coordSystemSelect.value == "NZMS 260 Sheet") {
                    mapFrame.helpText.innerHTML = mapFrame.nls.helpMessageNZMS260Sheet;
                }


                // If map sheet is selected
                if ((mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets1.name) || (mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets2.name)) {
                    if (mapFrame.coordSystemSelect.value == mapFrame.config.mapSheets2.name) {
                        // Load the map sheets into memory
                        var mapSheetStore = new Memory({
                            data: mapSheets2Data
                        });
                    }
                    else {
                        // Load the map sheets into memory
                        var mapSheetStore = new Memory({
                            data: mapSheets1Data
                        });
                    }
                    mapFrame.mapSheetSelection.store = mapSheetStore;

                    // Show map sheet selection
                    domStyle.set(mapFrame.tableRow1, "display", "block");
                    domStyle.set(mapFrame.tableRow2, "display", "block");
                    domStyle.set(mapFrame.tableRow3, "display", "block");
                    domStyle.set(mapFrame.tableRow4, "display", "block");

                    // Set the constraints on input
                    mapFrame.xCoordTextBox.constraints.max = 999;
                    mapFrame.xCoordTextBox.constraints.min = 100;
                    mapFrame.yCoordTextBox.constraints.max = 999;
                    mapFrame.yCoordTextBox.constraints.min = 100;
                }
                else {
                    // Hide map sheet selection
                    domStyle.set(mapFrame.tableRow1, "display", "none");
                    domStyle.set(mapFrame.tableRow2, "display", "block");
                    domStyle.set(mapFrame.tableRow3, "display", "block");
                    domStyle.set(mapFrame.tableRow4, "display", "block");

                    // Set the constraints on input
                    mapFrame.xCoordTextBox.constraints.max = 9999999;
                    mapFrame.xCoordTextBox.constraints.min = -9999999;
                    mapFrame.yCoordTextBox.constraints.max = 9999999;
                    mapFrame.yCoordTextBox.constraints.min = -9999999;
                    mapFrame.xCoordTextBox.constraints.pattern = '0.##########';
                    mapFrame.yCoordTextBox.constraints.pattern = '0.##########';
                }
            }

            // EVENT FUNCTION - Project error
            geometryService.on("error", function (evt) {
                // Show error message
                domStyle.set(mapFrame.errorText, 'display', 'block');
                mapFrame.errorText.innerHTML = evt.error.message;
                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            });
            geometryLocatorService.on("error", function (evt) {
                // Show error message
                domStyle.set(mapFrame.errorText, 'display', 'block');
                mapFrame.errorText.innerHTML = evt.error.message;
                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            });

            // EVENT FUNCTION - Locator error
            locatorService.on("error", function (evt) {
                var content = "<b>X: " + (Math.round(point.x * 100) / 100) + "<br/>" + "Y: " + (Math.round(point.y * 100) / 100) + "</b>";
                // If address locator provided
                if (locatorService) {
                    content += "<br/><br/>" + mapFrame.nls.noAddress;
                }

                // Add point to map
                var symbol = mapFrame.pointSymbolChooser.getSymbol();
                var graphic = new Graphic(point, symbol);
                map.graphics.add(graphic);

                // Zoom to point
                zoomExtent = map.extent.centerAt(point).expand(0.01);
                map.setExtent(zoomExtent);
                // Show popup
                map.infoWindow.setTitle(mapFrame.nls.location);
                map.infoWindow.setContent(content);
                map.infoWindow.show(point);

                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            });
        },

        // EVENT FUNCTION - Open widget
        onOpen: function () {
            console.log('Locate Coordinates widget opened...');
            this.inherited(arguments);
        },

        // EVENT FUNCTION - Close widget
        onClose: function () {
            console.log('Locate Coordinates widget closed...');
            // Close info window
            this.map.infoWindow.hide();
        },

        // EVENT FUNCTION - Minimise widget
        onMinimize: function () {
            console.log('Locate Coordinates widget minimised...');
            // Close info window
            this.map.infoWindow.hide();
        }
    });
});