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
      setConfig: function(config) {
        this.config = config;

        // Set the geometry service URL
        this.geometryServiceURL.set('value', this.config.geometryServiceURL);

        // Set the address locator service URL
        this.addressLocatorServiceURL.set('value', this.config.addressLocatorServiceURL);

        var fields = [{
            name: 'label',
            title: this.nls.coordinateSystem,
            type: 'text',
            unique: true,
            editable: false
        }, {
            name: 'wkid',
            title: this.nls.spatialReference,
            type: 'text',
            unique: true,
            editable: false
        }];
        var args = {
            fields: fields,
            selectable: false
        };
        this.CoordTable = new Table(args);
        this.CoordTable.placeAt(this.coordSystemsTable);
        this.CoordTable.startup();

        if (this.config.coordinateSystems.length > 0) {
            var json = [];
            var len = this.config.coordinateSystems.length;
            for (var i = 0; i < len; i++) {
                json.push({
                    label: this.config.coordinateSystems[i].label,
                    wkid: this.config.coordinateSystems[i].wkid
                });
            }
            this.CoordTable.addRows(json);
        }
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

        // Return the configuration parameters
		return this.config;
      }

    });
  });