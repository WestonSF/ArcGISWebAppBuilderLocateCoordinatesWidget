define([
    'dojo/_base/declare',
    'dojo/dom',
    "dojo/on",
    'dojo/_base/lang',
    'dojo/_base/html',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/ProgressBar',
    'jimu/BaseWidget',
    'jimu/utils',
    'jimu/SpatialReference/utils',
    'jimu/dijit/SymbolChooser',
    'jimu/dijit/TabContainer',
    "esri/symbols/SimpleMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
	"esri/Color",
    "esri/tasks/locator",
    "esri/geometry/Point",
    "esri/tasks/GeometryService",
    "esri/SpatialReference",
    "esri/tasks/ProjectParameters",
	"esri/geometry/webMercatorUtils",
    "esri/InfoTemplate",
    "esri/graphic",
],
function (
    declare,
    dom,
    on,
    lang,
    html,
    WidgetsInTemplateMixin,
    ProgressBar,
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
    ProjectParameters,
    webMercatorUtils,
    InfoTemplate,
    Graphic
) {
    
    var mapClick;
    // Base widget
    return declare([BaseWidget, WidgetsInTemplateMixin], {
        baseClass: 'jimu-widget-locatecoordinates',
        tabContainer: null,

        // EVENT FUNCTION - Creation of widget
        postCreate: function () {
            console.log('Locate Coordinates widget created...');
            this.inherited(arguments);

            // Setup tabs
            var tabs = [];
            tabs.push({
                title: "Locate",
                content: this.locateTab
            });
            tabs.push({
                title: "Symbology",
                content: this.symbologyTab
            });
            this.selTab = "Locate";
            this.tabContainer = new TabContainer({
                tabs: tabs,
                selected: this.selTab
            }, this.locateCoordinatesTab);

            this.tabContainer.startup();
            utils.setVerticalCenter(this.tabContainer.domNode);

            // Load in coordinates to selection
            var len = this.config.coordinateSystems.length;
            for (var i = 0; i < len; i++) {
                console.log();
                var option = {
                    value: this.config.coordinateSystems[i].wkid,
                    label: this.config.coordinateSystems[i].label
                };
                this.coordSystemSelect.addOption(option);
            }
        },

        // EVENT FUNCTION - Startup widget
        startup: function () {
            console.log('Locate Coordinates widget started...');
            this.inherited(arguments);

            var mapFrame = this;
            var map = this.map;

            // Setup labels
            updateCoordinateLabels();

            // Get configurations
            // Get geometry service URL from settings
            var geometryService = new GeometryService(this.config.GeometryServiceURL);
            var geometryLocatorService = new GeometryService(this.config.GeometryServiceURL);
            // Get address locator URL from settings
            var locatorService = new Locator(this.config.AddressLocatorServiceURL);          
            locatorService.outSpatialReference = map.spatialReference;
            // EVENT - Coordinate system change
            on(this.coordSystemSelect, "change", updateCoordinateLabels);
            // EVENT - Project completed
            geometryService.on("project-complete", getPoint);
            // EVENT - Location to address complete
            locatorService.on("location-to-address-complete", goToPoint);

            // EVENT FUNCTION - Locate button click
            on(this.locateButton, 'click', lang.hitch(this, function (evt) {
                // Show loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'block');

                // Close info window
                map.infoWindow.hide();
                // Clear existing graphics
                map.graphics.clear();

                // Project point to map if needed
                if (this.coordSystemSelect.value != map.spatialReference.wkid) {
                    // Get X and Y coordinates from text box
                    xCoord = this.xCoordTextBox.value;
                    yCoord = this.yCoordTextBox.value;
                    // Create new point
                    var inputPoint = new Point([xCoord, yCoord], new SpatialReference({ wkid: this.coordSystemSelect.value }));

                    geometryService.project([inputPoint], map.spatialReference);
                }
                // Coordinate system is same as map
                else {
                    getPoint();
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
                    xCoord = mapFrame.xCoordTextBox.value;
                    yCoord = mapFrame.yCoordTextBox.value;
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
                // Close info window
                map.infoWindow.hide();
                // Clear existing graphics
                map.graphics.clear();
                mapFrame.xCoordTextBox.set('value', '');
                mapFrame.yCoordTextBox.set('value', '');
            }));

            // EVENT FUNCTION - Popup window closed
            map.infoWindow.on("hide", function () {

            });

            // FUNCTION - Go to the point
            function goToPoint(evt) {
                var content = "<b>X: " + (Math.round(point.x * 100) / 100) + "<br/>" + "Y: " + (Math.round(point.y * 100) / 100) + "</b>";
                // If address locator provided
                if (locatorService) {
                    var address = evt.address.address.Match_addr;
                    content += "<br/><br/>Closest address to this point: " + address;
                }

                // Add point to map
                var symbol = mapFrame.pointSymbolChooser.getSymbol();
                var graphic = new Graphic(point, symbol);
                map.graphics.add(graphic);

                // Zoom to point
                zoomExtent = map.extent.centerAt(point).expand(0.01);
                map.setExtent(zoomExtent);
                // Show popup
                map.infoWindow.setTitle("Location");
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
                // If geographic
                if (WKTCurrent.charAt(0) == 'G') {
                    // Update labels
                    dojo.byId("xCoordLabel").innerHTML = "Longitude (X):";
                    dojo.byId("yCoordLabel").innerHTML = "Latitude (Y):";
                    // If projected
                } else {
                    // Update labels
                    dojo.byId("xCoordLabel").innerHTML = "Easting (X):";
                    dojo.byId("yCoordLabel").innerHTML = "Northing (Y):";
                }
            }

            // EVENT FUNCTION - Project error
            geometryService.on("error", function (evt) {
                console.error(evt.error.message);

                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            });
            geometryLocatorService.on("error", function (evt) {
                console.error(evt.error.message);

                // Hide loading bar
                html.setStyle(mapFrame.progressBar.domNode, 'display', 'none');
            });

            // EVENT FUNCTION - Locator error
            locatorService.on("error", function (evt) {
                var content = "<b>X: " + (Math.round(point.x * 100) / 100) + "<br/>" + "Y: " + (Math.round(point.y * 100) / 100) + "</b>";
                // If address locator provided
                if (locatorService) {
                    content += "<br/><br/>No Address found";
                }

                // Add point to map
                var symbol = mapFrame.pointSymbolChooser.getSymbol();
                var graphic = new Graphic(point, symbol);
                map.graphics.add(graphic);

                // Zoom to point
                zoomExtent = map.extent.centerAt(point).expand(0.01);
                map.setExtent(zoomExtent);
                // Show popup
                map.infoWindow.setTitle("Location");
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
            console.log('onMinimize');
            // Close info window
            this.map.infoWindow.hide();
        },

        // EVENT FUNCTION - Maximise widget
        onMaximize: function () {
            console.log('onMaximize');
        },

        // EVENT FUNCTION - Sign in widget
        onSignIn: function (credential) {
            /* jshint unused:false*/
            console.log('onSignIn');
        },

        // EVENT FUNCTION - Sign out widget
        onSignOut: function () {
            console.log('onSignOut');
        }
    });
});