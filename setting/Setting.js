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
    "dojo/_base/lang",
    "dojo/on",
    "dojo/json",
    "dojo/Deferred",
    "dojo/dom-style",
    "dojo/dom-attr",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/form/Select",
    "jimu/dijit/Message",
    "jimu/BaseWidgetSetting",
    "jimu/dijit/SimpleTable",
    "jimu/SpatialReference/srUtils",
    './Edit',
    "esri/request"
  ],
  function(
    declare,
    lang,
    on,
    dojoJSON,
    Deferred,
    domStyle,
    domAttr,
    WidgetsInTemplateMixin,
    Select,
    Message,
    BaseWidgetSetting,
    Table,
    utils,
    Edit,
    esriRequest    
    ) {
    return declare([BaseWidgetSetting, WidgetsInTemplateMixin], {
      //these two properties is defined in the BaseWidget
      baseClass: 'jimu-widget-locatecoordinates-setting',

       // EVENT FUNCTION - Startup configure widget
      startup: function () {
        console.log('Configure locate coordinates widget started...');
        this.inherited(arguments);

          // Set the default configuration parameters from the config file
        this.setConfig(this.config);
        // Set loading image
        domAttr.set(this.checkImg, 'src', require.toUrl('jimu') + "/images/loading.gif");
        // Check the URLs
        this.own(on(this.geometryServiceURL, 'Change', lang.hitch(this, this.onUrlChange)));
        this.own(on(this.addressLocatorServiceURL, 'Change', lang.hitch(this, this.onUrlChange)));
      },

      // EVENT FUNCTION - When url is changed
      onUrlChange: function (newUrl) {
          if (newUrl) {
              // Show loading
              domStyle.set(this.checkProcess, "display", "");
              esriRequest({
                  url: newUrl,
                  content: {
                      f: "json"
                  },
                  handleAs: "json",
                  callbackParamName: "callback",
                  timeout: 60000,
                  load: lang.hitch(this, this.onUrlChangeSuccess),
                  error: lang.hitch(this, this.onUrlChangeError)
              });
          }
      },

      // EVENT FUNCTION - Url change success
      onUrlChangeSuccess: function () {
          // Hide loading
          domStyle.set(this.checkProcess, "display", "none");
      },

      // EVENT FUNCTION - Url change error
      onUrlChangeError: function (err) {
          // Hide loading
          domStyle.set(this.checkProcess, "display", "none");
          var popup = new Message({
              message: err.message,
              buttons: [{
                  label: this.nls.ok,
                  onClick: lang.hitch(this, function () {
                      popup.close();
                  })
              }]
          });
      },

      // FUNCTION - Set the default configuration parameters in the configure widget from the config file
      setConfig: function (config) {
        var mapFrame = this;
        this.config = config;

        // Set the geometry service URL
        this.geometryServiceURL.set('value', this.config.geometryServiceURL);

        // Set the address locator service URL
        this.addressLocatorServiceURL.set('value', this.config.addressLocatorServiceURL);

        // Setup the coordinates table
        var fields = [{
            name: 'label',
            title: this.nls.coordinateSystem,
            type: 'text',

            unique: false,
            editable: false
        }, {
            name: 'wkid',
            title: this.nls.spatialReference,
            type: 'text',
            unique: false,
            editable: false
        }, {
            name: 'xmin',
            title: "XMin",
            type: 'text',
            unique: false,
            editable: false
        }, {
            name: 'xmax',
            title: "XMax",
            type: 'text',
            unique: false,
            editable: false
        }, {
            name: 'ymin',
            title: "YMin",
            type: 'text',
            unique: false,
            editable: false
        }, {
            name: 'ymax',
            title: "YMax",
            type: 'text',
            unique: false,
            editable: false
        },
        {
            name: '',
            title: '',
            width: '100px',
            type: 'actions',
            actions: ['up', 'down', 'delete']
        }
        ];
        var args = {
            fields: fields,
            selectable: false
        };
        this.CoordTable = new Table(args);
        this.CoordTable.autoHeight = true;
        this.CoordTable.placeAt(this.coordSystemsTable);
        this.CoordTable.startup();

        // Load in coordinate systems and extents
        if (this.config.coordinateSystems.length > 0) {
            var json = [];
            var len = this.config.coordinateSystems.length;
            for (var a = 0; a < len; a++) {
                json.push({
                    label: this.config.coordinateSystems[a].label,
                    wkid: this.config.coordinateSystems[a].wkid,
                    xmin: this.config.coordinateSystems[a].xmin,
                    xmax: this.config.coordinateSystems[a].xmax,
                    ymin: this.config.coordinateSystems[a].ymin,
                    ymax: this.config.coordinateSystems[a].ymax
                });
            }
            this.CoordTable.addRows(json);
        }

          // Set the default map sheets checkbox
        this.mapSheetsCheckbox.set("checked", this.config.nzMapSheets);

        // EVENT - Checkbox change
        on(this.mapSheetsCheckbox, "change", setMapSheets);

        // FUNCTION - Setup the map sheets
        function setMapSheets() {
            if (mapFrame.mapSheetsCheckbox.checked === true) {
                // If tables already created
                if ((mapFrame.sheetsTable1) && (mapFrame.sheetsTable1)) {
                    // Show the map sheet tables
                    domStyle.set(mapFrame.mapSheetsTable1, "display", "block");
                    domStyle.set(mapFrame.mapSheetsTable2, "display", "block");
                // Otherwise create the tables
                }
                else {
                    // Setup map sheets table 1
                    var fields = [{
                        name: 'sheetID',
                        title: mapFrame.config.mapSheets1.name,
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'xmin',
                        title: "XMin",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'xmax',
                        title: "XMax",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'ymin',
                        title: "YMin",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'ymax',
                        title: "YMax",
                        type: 'text',
                        unique: false,
                        editable: false
                    },
                    {
                        name: '',
                        title: '',
                        width: '100px',
                        type: 'actions',
                        actions: ['up', 'down', 'delete']
                    }
                    ];
                    var args = {
                        fields: fields,
                        selectable: false
                    };
                    mapFrame.sheetsTable1 = new Table(args);
                    mapFrame.sheetsTable1.autoHeight = false;
                    mapFrame.sheetsTable1.placeAt(mapFrame.mapSheetsTable1);
                    mapFrame.sheetsTable1.startup();

                    // Load in map sheets
                    var json = [];
                    var len = mapFrame.config.mapSheets1.mapSheets.length;
                    for (var b = 0; b < len; b++) {
                        json.push({
                            sheetID: mapFrame.config.mapSheets1.mapSheets[b].sheetID,
                            xmin: mapFrame.config.mapSheets1.mapSheets[b].xmin,
                            xmax: mapFrame.config.mapSheets1.mapSheets[b].xmax,
                            ymin: mapFrame.config.mapSheets1.mapSheets[b].ymin,
                            ymax: mapFrame.config.mapSheets1.mapSheets[b].ymax
                        });
                    }
                    mapFrame.sheetsTable1.addRows(json);

                    // Setup map sheets table 2
                    var fields = [{
                        name: 'sheetID',
                        title: mapFrame.config.mapSheets2.name,
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'xmin',
                        title: "XMin",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'xmax',
                        title: "XMax",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'ymin',
                        title: "YMin",
                        type: 'text',
                        unique: false,
                        editable: false
                    }, {
                        name: 'ymax',
                        title: "YMax",
                        type: 'text',
                        unique: false,
                        editable: false
                    },
                    {
                        name: '',
                        title: '',
                        width: '100px',
                        type: 'actions',
                        actions: ['up', 'down', 'delete']
                    }
                    ];
                    var args = {
                        fields: fields,
                        selectable: false
                    };
                    mapFrame.sheetsTable2 = new Table(args);
                    mapFrame.sheetsTable2.autoHeight = false;
                    mapFrame.sheetsTable2.placeAt(mapFrame.mapSheetsTable2);
                    mapFrame.sheetsTable2.startup();

                    // Load in map sheets
                    var json = [];
                    var len = mapFrame.config.mapSheets2.mapSheets.length;
                    for (var c = 0; c < len; c++) {
                        json.push({
                            sheetID: mapFrame.config.mapSheets2.mapSheets[c].sheetID,
                            xmin: mapFrame.config.mapSheets2.mapSheets[c].xmin,
                            xmax: mapFrame.config.mapSheets2.mapSheets[c].xmax,
                            ymin: mapFrame.config.mapSheets2.mapSheets[c].ymin,
                            ymax: mapFrame.config.mapSheets2.mapSheets[c].ymax
                        });
                    }
                    mapFrame.sheetsTable2.addRows(json);
                }
            }
            // If not checked
            else {
                // Don't show the map sheet tables
                domStyle.set(mapFrame.mapSheetsTable1, "display", "none");
                domStyle.set(mapFrame.mapSheetsTable2, "display", "none");
            }
        }
      },

      // EVENT FUNCTION - Add coordinate system
      onAddCoordinateSystemClick: function () {
          this.popupState = "ADD";
          this.openEditCoordinateSystem(this.nls.addCoordinateLabel, {});
      },

      // EVENT FUNCTION - Edit coordinate system
      openEditCoordinateSystem: function (title) {
          this.edit = new Edit({
              nls: this.nls
          });

          this.popup = new Popup({
              titleLabel: title,
              autoHeight: true,
              content: this.edit,
              container: 'main-page',
              width: 640,
              height: 300,
              buttons: [{
                  label: this.nls.ok,
                  key: keys.ENTER,
                  disable: true,
                  onClick: lang.hitch(this, '_onEditOk')
              }, {
                  label: this.nls.cancel,
                  key: keys.ESCAPE
              }],
              onClose: lang.hitch(this, '_onEditClose')
          });
          html.addClass(this.popup.domNode, 'widget-setting-popup');
          this.edit.startup();
      },

      // FUNCTION - Get the configuration parameters from the configure widget and load into configuration file
      getConfig: function () {
        // Get geometry service URL
        this.config.geometryServiceURL = this.geometryServiceURL.get('value');
        // Get address locator URL
        this.config.addressLocatorServiceURL = this.addressLocatorServiceURL.get('value');

        // Get the coordinate systems
        var data = this.CoordTable.getData();
        var json = [];
        var len = data.length;
        for (var i = 0; i < len; i++) {
            json.push(data[i]);
        }
        this.config.coordinateSystems = json;

        // Get the map sheets checkbox
        this.config.nzMapSheets = this.mapSheetsCheckbox.checked;

        // Get the map sheets
        var data = this.sheetsTable1.getData();
        var json = [];
        var len = data.length;
        for (var a = 0; a < len; a++) {
            json.push(data[a]);
        }
        this.config.mapSheets1.mapSheets = json;
        var data = this.sheetsTable2.getData();
        var json = [];
        var len = data.length;
        for (var b = 0; b < len; b++) {
            json.push(data[b]);
        }
        this.config.mapSheets2.mapSheets = json;

        // Return the configuration parameters
		return this.config;
      }

    });
  });