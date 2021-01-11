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
      _this.loadUI(data);
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

    $('.toggle-menu').on('click', function(){
      _this.toggleMenu();
    });

    $('.select-line').on('click', function(){
      _this.selectLine($(this));
    });

  };

  App.prototype.loadScene = function(data){
    var _this = this;
    var w = data.width;
    var h = data.height;
    var lines = data.lines;

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var elW = this.$el.width();
    var elH = this.$el.height();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor( 0x000000, 0.0 );
    renderer.setSize( elW, elH );
    this.el.appendChild( renderer.domElement );
    this.renderer = renderer;

    var cameraY = 4000;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 40, elW/elH, 1, 10000 );
    camera.position.set(0, cameraY, 0);
    camera.lookAt(0, 0, 0);
    this.scene = scene;
    this.camera = camera;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 100;
    controls.maxDistance = cameraY + 1000;
    controls.maxPolarAngle = Math.PI / 2;

    // create lights
    var light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );
    var lights = [];
    lights[ 0 ] = new THREE.PointLight( 0xffffff, 0.33, 0 );
    lights[ 1 ] = new THREE.PointLight( 0xffffff, 0.33, 0 );
    lights[ 2 ] = new THREE.PointLight( 0xffffff, 0.33, 0 );
    lights[ 3 ] = new THREE.PointLight( 0xffffff, 0.33, 0 );
    lights[ 0 ].position.set( -cameraY, cameraY, -cameraY );
    lights[ 1 ].position.set( cameraY, cameraY, cameraY );
    lights[ 2 ].position.set( -cameraY, cameraY, cameraY );
    lights[ 3 ].position.set( cameraY, cameraY, -cameraY );
    scene.add( lights[ 0 ] );
    scene.add( lights[ 1 ] );
    scene.add( lights[ 2 ] );
    scene.add( lights[ 3 ] );

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
    this.lines = lines;

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

  App.prototype.loadUI = function(data){
    var lines = data.lines;
    var $buttons = $('#buttons');

    var html = '';
    _.each(lines, function(line){
      var name = ''+line.id;
      var classNames = [];
      if (name.length > 1) classNames.push('small-text');
      if (name == 'N' || name == 'R' || name == 'Q' || name=='W') classNames.push('invert-text');
      classNames = classNames.join(' ');
      html += '<button class="select-line '+classNames+'" style="background: #'+line.color+'">'+name+'</button>';
    });
    $buttons.html(html);
  };

  App.prototype.onResize = function(){
    var w = this.$el.width();
    var h = this.$el.height();
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

  App.prototype.selectLine = function($button){
    var isSelected = $button.hasClass('selected');
    $('.select-line').removeClass('selected hidden');
    if (!isSelected) {
      $('.select-line').addClass('hidden');
      $button.addClass('selected');
    }
  };

  App.prototype.toggleMenu = function(){
    var $menu = $('.menu');
    var $link = $('.toggle-menu');
    var isActive = $menu.hasClass('active');

    if (isActive) {
      $menu.removeClass('active');
      $link.text('Show details & menu');
    } else {
      $menu.addClass('active');
      $link.text('Close panel');
    }
  };

  return App;

})();

$(function() {
  var app = new App({});
});
