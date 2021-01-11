'use strict';

var App = (function() {

  function App(config) {
    var defaults = {
      dataUrl: 'data/sceneData.json',
      introDuration: 3000,
      transitionDuration: 1000,
      cameraDistance: 4000,
      inactiveLineOpacity: 0.2
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  function ease(t){
    return (Math.sin((t+1.5)*Math.PI)+1.0) / 2.0;
  }

  function lerp(a, b, t) {
    return (1.0*b - a) * t + a;
  }

  function norm(value, a, b){
    var denom = (b - a);
    var t = 0;
    if (denom > 0 || denom < 0) {
      t = (1.0 * value - a) / denom;
    }
    if (t < 0) t = 0;
    if (t > 1.0) t = 1.0;
    return t;
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

    $('.toggle-autorotation').on('click', function(){
      _this.toggleAutorotation();
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

    var cameraY = this.opt.cameraDistance;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 40, elW/elH, 1, cameraY + 6000 );
    camera.position.set(0, cameraY, 0);
    camera.lookAt(0, 0, 0);
    this.scene = scene;
    this.camera = camera;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 100;
    controls.maxDistance = cameraY + 1000;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enabled = false;
    this.controls = controls;

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
        lines[key].lineOpacity = 1.0;
        lines[key].targetLineOpacity = 1.0;
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
      lines[key].stationOpacity = 0;
      lines[key].targetStationOpacity = 0;
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
        _this.onSceneLoaded();
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

  App.prototype.onIntroFinished = function(){
    this.loadListeners();
    this.controls.enabled = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.0;
    this.$el.addClass('started');
  };

  App.prototype.onResize = function(){
    var w = this.$el.width();
    var h = this.$el.height();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  App.prototype.onSceneLoaded = function(){
    console.log('Scene loaded.');

    this.introStartTime = new Date().getTime() + 3000;
    this.introEndTime = this.introStartTime + this.opt.introDuration;
    this.introFinished = false;
    this.$el.addClass('active');
    this.render();
  };

  App.prototype.render = function(){
    var _this = this;

    // intro animation
    if (!this.introFinished) {
      this.renderIntro();
    } else {
      this.controls.update();
    }

    // line selection transition
    if (this.lineTransitioning) {
      this.renderLineTransition();
    }

    this.renderer.render( this.scene, this.camera );

    requestAnimationFrame(function(){
      _this.render();
    });
  };

  App.prototype.renderIntro = function(){
    var now = new Date().getTime();
    var t = norm(now, this.introStartTime, this.introEndTime);
    t = ease(t);
    if (t <= 0) t = 0.00001;

    var r = this.opt.cameraDistance;
    var rad = lerp(Math.PI/2, Math.PI * 0.8, t);
    var z = r * Math.cos(rad);
    var y = r * Math.sin(rad);
    this.camera.position.set(0, y, -z);
    this.camera.lookAt(0, 0, 0);

    if (now >= this.introEndTime) {
      this.introFinished = true;
      this.onIntroFinished();
    }
  };

  App.prototype.renderLineTransition = function(){
    var _this = this;
    var now = new Date().getTime();
    var t = norm(now, this.lineTransitionStartTime, this.lineTransitionEndTime);

    _.each(this.lines, function(line, lineName){

      // update lines
      var lineNeedUpdate = (line.targetLineOpacity != line.lineOpacity);
      if (lineNeedUpdate) {
        var lineOpacity = lerp(line.startLineOpacity, line.targetLineOpacity, t);
        _this.lines[lineName].lineOpacity = lineOpacity;
        // update line meshes
        _.each(line.pathMeshes, function(mesh){
          if (mesh.material.opacity != lineOpacity) {
            mesh.material.opacity = lineOpacity;
            mesh.material.needsUpdate = true;
          }
        });
      }

      // update stations
      var stationsNeedUpdate = (line.targetStationOpacity != line.stationOpacity);
      if (stationsNeedUpdate) {
        var stationOpacity = lerp(line.startStationOpacity, line.targetStationOpacity, t);
        _this.lines[lineName].stationOpacity = stationOpacity;
        _.each(line.stations, function(station, i){
          var mesh = station.mesh;
          if (mesh.material.opacity != stationOpacity) {
            mesh.material.opacity = stationOpacity;
            mesh.material.needsUpdate = true;
          }
          if (stationOpacity <= 0) {
            mesh.visible = false;
          } else {
            mesh.visible = true;
          }
        });
      }

    });

    if (t >= 1.0) {
      this.lineTransitioning = false;
    }
  };

  App.prototype.selectLine = function($button){
    if (this.lineTransitioning === true) return;

    var _this = this;
    var isSelected = $button.hasClass('selected');
    var selectedLine = false;
    $('.select-line').removeClass('selected hidden');
    if (!isSelected) {
      $('.select-line').addClass('hidden');
      $button.addClass('selected');
      selectedLine = $button.text().trim();
    }

    this.lineTransitionStartTime = new Date().getTime();
    this.lineTransitionEndTime = this.lineTransitionStartTime + this.opt.transitionDuration;
    this.lineTransitioning = true;
    var inactiveLineOpacity = this.opt.inactiveLineOpacity;
    _.each(this.lines, function(line, lineName){
      _this.lines[lineName].startLineOpacity = line.lineOpacity;
      _this.lines[lineName].startStationOpacity = line.stationOpacity;
      _this.lines[lineName].targetLineOpacity = lineName === selectedLine || selectedLine === false ? 1.0 : inactiveLineOpacity;
      _this.lines[lineName].targetStationOpacity = lineName === selectedLine || selectedLine === false ? 1.0 : 0;
    });
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

  App.prototype.toggleAutorotation = function(){
    var $button = $('.toggle-autorotation');
    var isActive = $button.hasClass('active');

    if (isActive) {
      $button.removeClass('active');
      this.controls.autoRotate = false;
      $button.text('Turn on auto-rotation');
    } else {
      $button.addClass('active');
      this.controls.autoRotate = true;
      $button.text('Turn off auto-rotation');
    }
  };

  return App;

})();

$(function() {
  var app = new App({});
});
