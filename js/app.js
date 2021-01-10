'use strict';

var App = (function() {

  function App(config) {
    var defaults = {
      dataUrl: 'data/sceneData.json'
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  App.prototype.init = function(){
    var _this = this;
    this.$el = $('#app');
    this.el = this.$el[0];

    $.when(
      this.loadData()

    ).done(function(data){

      _this.loadScene(data);
    });
  };

  App.prototype.loadData = function(){
    return $.getJSON(this.opt.dataUrl);
  };

  App.prototype.loadListeners = function(){
    var _this = this;

    $(window).on('resize', function(){
      _this.onResize();
    });
  };

  App.prototype.loadScene = function(data){
    var _this = this;
    var w = data.width;
    var h = data.height;
    var lines = data.lines;

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor( 0x000000, 0.0 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    this.el.appendChild( renderer.domElement );
    this.renderer = renderer;

    var cameraY = 4000;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 6000 );
    camera.position.set(0, cameraY, 0);
    camera.lookAt(0, 0, 0);
    this.scene = scene;
    this.camera = camera;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 100;
    controls.maxDistance = cameraY;

    // create lights
    var light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );
    var lights = [];
    lights[ 0 ] = new THREE.PointLight( 0xffffff, 0.667, 0 );
    lights[ 1 ] = new THREE.PointLight( 0xffffff, 0.667, 0 );
    lights[ 0 ].position.set( -cameraY, cameraY, -cameraY );
    lights[ 1 ].position.set( cameraY, cameraY, cameraY );
    scene.add( lights[ 0 ] );
    scene.add( lights[ 1 ] );

    // draw lines
    var lineGroup = new THREE.Group();
    var tubelarRadius = 4;
    var radialSegments = 16;
    _.each(lines, function(line, key){
      lines[key].pathMeshes = [];
      _.each(line.paths, function(path){
        var points = _.map(path, function(p){
          return new THREE.Vector3(p[0], p[2], -p[1]);
        });
        var tubularSegments = points.length * 8;
        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeBufferGeometry(curve, tubularSegments, tubelarRadius, radialSegments, false);
        var tubeMat = new THREE.MeshPhongMaterial( { color: '#'+line.color, transparent: true } );
        var mesh = new THREE.Mesh( tubeGeo, tubeMat );
        lines[key].pathMeshes.push(mesh);
        lineGroup.add(mesh);
      });
    });
    scene.add(lineGroup);

    // draw stations
    var stations = new THREE.Group();
    _.each(lines, function(line, key){
      _.each(line.stations, function(station, i){
        var geometry = new THREE.SphereBufferGeometry( 6, 32, 32 );
        var material = new THREE.MeshBasicMaterial( {color: 0xdddddd, transparent: true} );
        var sphere = new THREE.Mesh( geometry, material );
        var position = new THREE.Vector3(station.point[0], station.point[2], -station.point[1]);
        sphere.material.opacity = 0;
        sphere.visible = false;
        sphere.position.copy(position);
        stations.add( sphere );
        lines[key].stations[i].mesh = sphere;
      });
    });
    scene.add(stations);

    var loader = new THREE.TextureLoader();
    loader.load(
      'img/subway_base_map_texture.png',
      // onLoad callback
      function (mapTexture) {
        var mapGeometry = new THREE.PlaneBufferGeometry(w, h, 32);
        var mapMaterial = new THREE.MeshBasicMaterial( { map: mapTexture, side: THREE.DoubleSide } );
        var map = new THREE.Mesh(mapGeometry, mapMaterial);
        map.rotation.x = - Math.PI / 2;
        map.position.setY(-10);
        scene.add(map);
        _this.render();
        _this.loadListeners();
        _this.$el.addClass('active');
      }
    );
  };

  App.prototype.onResize = function(){
    var w = window.innerWidth;
    var h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
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
