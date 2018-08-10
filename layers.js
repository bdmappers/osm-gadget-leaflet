'use strict';

// fix for https://github.com/MazeMap/Leaflet.LayerGroup.Collision/pull/3
L.GeoJSON.Collision.prototype.initialize = function(geojson, options) {
  L.GeoJSON.prototype.initialize.call(this, geojson, options);
  this._originalLayers = [];
  this._visibleLayers = [];
  this._staticLayers = [];
  this._rbush = [];
  this._cachedRelativeBoxes = [];
  this._margin = options.margin || 0;
  this._rbush = null;
};

L.TileLayer.Provider.providers.memomaps = {
  url: 'http://tile.memomaps.de/tilegen/{z}/{x}/{y}.png',
  options: {
    attribution: '{attribution.OpenStreetMap}'
  }
};

L.GeoJSON.WIWOSM = L.GeoJSON.extend({
  initialize: function(options) {
    L.GeoJSON.prototype.initialize.call(this, undefined, options);
  },

  options: {
    coordsToLatLng: function(coords) {
      // unproject EPSG:3857
      var pt = L.point(coords[0], coords[1]);
      var ll = L.Projection.SphericalMercator.unproject(pt);
      return ll;
    },

    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng);
    }
  },

  loadWIWOSM: function() {
    var me = this;
    if (!this.options.article || !this.options.lang) {
      return;
    } else if (typeof this.options.article === 'object') {
      this.clearLayers();
      this.options.article.map(loadArticle);
    } else {
      var doClear = true;
      loadArticle(this.options.article);
    }
    return this;

    function loadArticle(article) {
      var url = 'https://tools.wmflabs.org/wiwosm/osmjson/getGeoJSON.php';
      url += L.Util.getParamString({
        lang: me.options.lang,
        article: article
      });
      var xhr = new XMLHttpRequest();
      xhr.addEventListener('load', addData);
      xhr.open('GET', url);
      xhr.send();
    }

    function addData() {
      if (this.status !== 200 || !this.responseText) {
        return;
      }
      var geojson = JSON.parse(this.responseText);
      if (doClear) {
        me.clearLayers();
      }
      me.addData(geojson);
      me._map.fitBounds(me.getBounds());
    }
  }
});

L.GeoJSON.WikipediaMarks = L.LayerGroup.extend({
  initialize: function(options) {
    L.Util.setOptions(this, options);
    L.LayerGroup.prototype.initialize.call(this, []);
    new L.GeoJSON(undefined, {
      pointToLayer: this._makePointToLayer(true)
    }).addTo(this);
    new L.GeoJSON.Collision(undefined, {
      pointToLayer: this._makePointToLayer(false)
    }).addTo(this);
  },

  options: {
    lang: 'en',
    coats: 0,
    thumbs: 0
  },

  _makePointToLayer: function(icons) {
    return function(feature, latlng) {
      var icon = icons
        ? getIcon(feature.properties.feature)
        : getDivIcon(feature);
      var marker = L.marker(latlng, {
        icon: icon,
        zIndexOffset: icons ? 0 : 100
      });
      var popup = getPopupHtml(feature);
      if (popup) {
        marker.bindPopup(popup, {
          minWidth: 200
        });
        marker.on('click', function() {
          this.openPopup();
          this.openedViaMouseOver = false;
        });
        marker.on('mouseover', function() {
          this.openPopup();
          this.openedViaMouseOver = true;
        });
        marker.on('mouseout', function() {
          if (this.openedViaMouseOver) {
            this.closePopup();
          }
        });
      }
      return marker;

      function getPopupHtml(feature) {
        var html;
        if (feature.properties.title && feature.properties.wikipediaUrl) {
          html = L.Util.template(
            '<a href="{wikipediaUrl}">{title}</a>',
            feature.properties
          );
          if (feature.properties.thumbnail) {
            html =
              html +
              L.Util.template(
                '<p><img src="{thumbnail}"></p>',
                feature.properties
              );
          }
        }
        return html;
      }

      function getDivIcon(feature) {
        return L.divIcon({
          iconSize: '',
          iconAnchor: [-10, -5],
          html: feature.properties.title
        });
      }

      function getIcon(feature) {
        var customIcon = getIconForFeature(feature);
        if (customIcon) {
          return L.divIcon({
            className: customIcon,
            iconSize: [24, 24],
            iconAnchor: [12, -3]
          });
        }
        return new L.Icon.Default();
      }

      function getIconForFeature(feature) {
        var iconForFeature = {
          country: 'maki-icon circle',
          satellite: 'maki-icon rocket',
          state: 'maki-icon circle',
          adm1st: 'maki-icon circle',
          adm2nd: 'maki-icon circle',
          adm3rd: 'maki-icon circle',
          city: 'maki-icon circle',
          isle: 'maki-icon land-use',
          mountain: 'maki-icon triangle',
          river: 'maki-icon water',
          waterbody: 'maki-icon water',
          event: 'maki-icon theatre',
          forest: 'maki-icon park',
          glacier: 'maki-icon land-use',
          airport: 'maki-icon airport',
          railwaystation: 'maki-icon rail',
          edu: 'maki-icon college',
          pass: 'maki-icon golf',
          landmark: 'maki-icon marker'
        };
        return feature && iconForFeature[feature];
      }
    };
  },

  updateMarks: function() {
    if (!this._map) {
      return;
    }
    var url = 'https://tools.wmflabs.org/wp-world/marks-geojson.php';
    url += L.Util.getParamString({
      maxRows: 80,
      LANG: this.options.lang,
      coats: this.options.coats,
      thumbs: this.options.thumbs,
      bbox: this._map.getBounds().toBBoxString()
    });

    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', updateLayer.bind(this));
    xhr.open('GET', url);
    xhr.send();
    return this;

    function updateLayer() {
      if (this.status !== 200 || !this.responseText) {
        return;
      }
      var geojson = JSON.parse(this.responseText);
      this.invoke('clearLayers');
      this.invoke('addData', geojson);
    }
  }
});
