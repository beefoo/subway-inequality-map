'use strict';

var App = (function() {

  function App(config) {
    var defaults = {};
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  App.prototype.init = function(){
    var _this = this;
    $.getJSON('data/appRoutes.json', function(data){
      console.log('Loaded route data');
      _this.parseSvg(data);
    });
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

    var offsetX = -w / 2;
    var offsetY = -h / 2;

    // var stations = new THREE.Group();
    // _.each(lines, function(line){
    //   _.each(line.stations, function(station){
    //     var geometry = new THREE.SphereBufferGeometry( 10, 32, 32 );
    //     var material = new THREE.MeshBasicMaterial( {color: 0x000000} );
    //     var sphere = new THREE.Mesh( geometry, material );
    //     sphere.position.set(station.point[0]+offsetX, (h-station.point[1])+offsetY, 0);
    //     stations.add( sphere );
    //   });
    // });
    // scene.add(stations);

    var lineGroup = new THREE.Group();
    _.each(lines, function(line){
      _.each(line.paths, function(path){
        var points = _.map(path, function(p){
          return new THREE.Vector3(p[0]+offsetX, (h-p[1])+offsetY, p[2]);
        });
        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeBufferGeometry(curve, 64, 8, 8, false);
        var tubeMat = new THREE.MeshBasicMaterial( { color: '#'+line.color } );
        var mesh = new THREE.Mesh( tubeGeo, tubeMat );
        lineGroup.add(mesh);
      });
    });
    scene.add(lineGroup);

    var loader = new THREE.TextureLoader();
    loader.load(
      'img/subway_base_map_texture.png',
      // onLoad callback
      function (mapTexture) {
        var mapTexture = new THREE.TextureLoader().load('img/subway_base_map_texture.png');
        var mapGeometry = new THREE.PlaneBufferGeometry(w, h, 32);
        var mapMaterial = new THREE.MeshBasicMaterial( { map: mapTexture } );
        var map = new THREE.Mesh(mapGeometry, mapMaterial);
        scene.add(map);

        _this.render();
      }
    );
  };

  App.prototype.parseSvg = function(routeData){
    var svg = d3.select('svg');
    var paths = svg.selectAll('path');
    var lines = routeData['lines'];
    var width = routeData.width;
    var height = routeData.height;
    paths = paths[0];
    console.log('Calculating paths...');
    _.each(paths, function(path){
      // retrieve line name
      var $path = $(path);
      var $parent = $path.closest('g');
      var id = $parent.attr('id');
      var parts = id.split('-');
      var lineName = parts[1];
      var lineData = lines[lineName];
      if (lineData === undefined){
        console.log('Could not find '+lineName+' in line data.')
        return;
      }
      var l = path.getTotalLength();
      var pointCount = parseInt(l / 2);
      var points = [];
      for (var i=0; i<pointCount; i++){
        var t = 1.0 * i / (pointCount-1);
        var p = path.getPointAtLength(t * l);
        points.push([p.x, p.y, 0]);
      }

      if (_.has(lineData, 'paths')) {
        lines[lineName].paths.push(points);
      } else {
        lines[lineName].paths = [points];
      }
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
