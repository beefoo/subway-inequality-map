'use strict';

var App = (function() {

  function App(config) {
    var defaults = {};
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  function roundToNearest(num, p){
    return Math.round((num + Number.EPSILON) * p) / p;
  }

  App.prototype.init = function(){
    var _this = this;

    $.when(
      $.getJSON('data/appRoutes.json'),
      _this.loadHeatmap()

    ).done(function(routeData, imageData){
      routeData = routeData[0];
      imageData = imageData[0];

      console.log('Loaded data.');
      _this.parseSvg(routeData);
    });
  };

  App.prototype.downloadJson = function(){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.jsonOut));
    var dlAnchorElem = document.getElementById('downloadAnchorElem');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", "scene.json");
    dlAnchorElem.click();
  };

  App.prototype.loadHeatmap = function(){
    var _this = this;
    var deferred = $.Deferred();
    var img = $('#heatmap')[0];
    var newImg = new Image;
    newImg.onload = function() {
      img.src = this.src;
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, img.width, img.height);
      _this.heatmapCtx = ctx;
      deferred.resolve(true);
    }
    newImg.src = 'img/heatmap.png';
    return deferred.promise();
  };

  App.prototype.loadScene = function(w, h, lines, stationCount){
    var _this = this;
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor( 0x000000, 0.0 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    $('#app')[0].appendChild( renderer.domElement );
    this.renderer = renderer;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 6000 );
    camera.position.set(0, 0, 4000);
    camera.lookAt(0, 0, 0);
    this.scene = scene;
    this.camera = camera;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 100;
    controls.maxDistance = 6000;

    var light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );
    var lights = [];
    lights[ 0 ] = new THREE.PointLight( 0xffffff, 0.667, 0 );
    lights[ 1 ] = new THREE.PointLight( 0xffffff, 0.667, 0 );
    lights[ 0 ].position.set( -4000, -4000, 4000 );
    lights[ 1 ].position.set( 4000, 4000, 4000 );
    scene.add( lights[ 0 ] );
    scene.add( lights[ 1 ] );

    var offsetX = -w / 2;
    var offsetY = -h / 2;

    var jsonOut = {
      lines: {},
      width: w,
      height: h
    };
    var lineGroup = new THREE.Group();
    var tubelarRadius = 4;
    var radialSegments = 16;
    _.each(lines, function(line, lineName){
      var jsonLine = {
        id: line.id,
        color: line.color,
        paths: [],
        stations: []
      }
      var samplePoints = [];
      _.each(line.paths, function(path){
        var points = _.map(path.points, function(p){
          return new THREE.Vector3(p[0]+offsetX, (h-p[1])+offsetY, p[2]);
        });
        var jsonPath = _.map(points, function(p){ return [roundToNearest(p.x, 100), roundToNearest(p.y, 100), roundToNearest(p.z, 100)]; });
        jsonLine.paths.push({isContinuous: path.isContinuous, points: jsonPath});
        var tubularSegments = points.length * 8;
        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeBufferGeometry(curve, tubularSegments, tubelarRadius, radialSegments, false);
        var tubeMat = new THREE.MeshPhongMaterial( { color: '#'+line.color } );
        var mesh = new THREE.Mesh( tubeGeo, tubeMat );
        lineGroup.add(mesh);
        if (path.isContinuous || !line.hasContinuousLineVersion) {
          samplePoints = samplePoints.concat(curve.getPoints(points.length*8));
        }
      });
      jsonOut.lines[line.id] = jsonLine;
      lines[lineName].samplePoints = samplePoints;
    });
    scene.add(lineGroup);
    // console.log(samplePoints)

    var stations = new THREE.Group();
    _.each(lines, function(line){
      _.each(line.stations, function(station){
        var geometry = new THREE.SphereBufferGeometry( 6, 32, 32 );
        var material = new THREE.MeshBasicMaterial( {color: 0xdddddd} );
        var sphere = new THREE.Mesh( geometry, material );
        var position = new THREE.Vector3(station.point[0]+offsetX, (h-station.point[1])+offsetY, station.point[2]);
        // find the closest point in the paths
        var closestPoint = _.min(line.samplePoints, function(p){ return position.distanceTo(p); });
        sphere.position.copy(closestPoint);
        stations.add( sphere );
        station.point = [roundToNearest(closestPoint.x, 100), roundToNearest(closestPoint.y, 100), roundToNearest(closestPoint.z, 100)];
        station = _.omit(station, 'ndistance', 'nincome');
        jsonOut.lines[line.id].stations.push(station);
      });
    });
    scene.add(stations);

    var loader = new THREE.TextureLoader();
    loader.load(
      'img/subway_base_map_texture.png',
      // onLoad callback
      function (mapTexture) {
        var mapTexture = new THREE.TextureLoader().load('img/subway_base_map_texture.png');
        var mapGeometry = new THREE.PlaneBufferGeometry(w, h, 32);
        var mapMaterial = new THREE.MeshBasicMaterial( { map: mapTexture, side: THREE.DoubleSide } );
        var map = new THREE.Mesh(mapGeometry, mapMaterial);
        map.position.setZ(-10);
        scene.add(map);

        _this.render();
      }
    );

    this.jsonOut = jsonOut;
    $('.download').on('click', function(e){
      _this.downloadJson();
    });
  };

  App.prototype.parseSvg = function(routeData){
    var svg = d3.select('svg');
    var paths = svg.selectAll('path');
    var lines = routeData['lines'];
    var width = routeData.width;
    var height = routeData.height;
    var maxZ = 1000;
    var heatmapCtx = this.heatmapCtx;
    paths = paths[0];
    console.log('Calculating paths...');
    _.each(paths, function(path){
      // retrieve line name
      var $path = $(path);
      var $parent = $path.closest('g');
      var id = $parent.attr('id');
      var parts = id.split('-');
      var lineName = parts[1];
      var isContinuous = (parts.length > 2);
      var lineData = lines[lineName];
      if (lineData === undefined){
        console.log('Could not find '+lineName+' in line data.')
        return;
      }
      var l = path.getTotalLength();
      var pointCount = Math.pow(l, 0.4); // lower this number for less points
      // console.log(pointCount);
      pointCount = Math.max(pointCount, 8);
      var points = [];
      for (var i=0; i<pointCount; i++){
        var t = 1.0 * i / (pointCount-1);
        var p = path.getPointAtLength(t * l);
        var zdata = heatmapCtx.getImageData(p.x, p.y, 1, 1).data;
        var z = zdata[0] / 255.0 * maxZ;
        points.push([p.x, p.y, z]);
      }

      var entry = {isContinuous: isContinuous, points: points};
      if (_.has(lineData, 'paths')) {
        lines[lineName].paths.push(entry);
      } else {
        lines[lineName].paths = [entry];
      }
    });

    _.each(lines, function(line, lineName){
      _.each(line.stations, function(station, i){
        var p = station.point;
        var zdata = heatmapCtx.getImageData(p[0], p[1], 1, 1).data;
        var z = zdata[0] / 255.0 * maxZ;
        lines[lineName].stations[i].point.push(z);
      });
      var continuousPaths = _.filter(lines.paths, function(path){ return path.isContinuous; });
      lines[lineName].hasContinuousLineVersion = (continuousPaths.length > 0);
    });

    console.log('Done calculating path.');
    this.loadScene(width, height, lines, routeData.stationCount);
  };

  App.prototype.render = function(){
    var _this = this;

    this.renderer.render( this.scene, this.camera );

    requestAnimationFrame(function(){
      _this.render();
    });
  };

  return App;

})();

$(function() {
  var app = new App({});
});
