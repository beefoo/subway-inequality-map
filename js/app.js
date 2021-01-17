'use strict';

var App = (function() {

  function App(config) {
    var defaults = {
      dataUrl: 'data/sceneData.json',
      introDuration: 3000,
      transitionDuration: 600,
      stationTransitionDuration: 3000,
      cameraDistance: 4000,
      inactiveLineOpacity: 0.2
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  var boroughs = {
    'Bx': 'Bronx',
    'Bk': 'Brooklyn',
    'M': 'Manhattan',
    'Q': 'Queens',
    'SI': 'Staten Island'
  };

  function ease(t){
    return (Math.sin((t+1.5)*Math.PI)+1.0) / 2.0;
  }

  function formatMoney(number) {
    return '$' + number.toLocaleString();
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
    this.$menu = $('#menu');
    this.$stations = $('#stations-container');
    this.el = this.$el[0];
    this.interacted = false;

    this.loadedLine = false;
    this.selectedLine = false;
    this.selectedStation = false;
    this.highlightedStationIndex = false;
    this.highlightedStation = false;
    this.isHighlighting = false;
    this.lineTransitioning = false;
    this.stationTransitioning = false;

    $.when(
      this.loadData()

    ).done(function(data){
      _this.loadUI(data);
      _this.loadScene(data);
    });
  };

  App.prototype.highlightStation = function($button){
    var line = ""+$button.attr('data-line');
    var stationIndex = parseInt($button.attr('data-index'));

    // already highlighted
    if (line === this.selectedLine && stationIndex === this.highlightedStationIndex) return;

    var station = this.lines[line].stations[stationIndex];
    if (!station) return;

    this.highlightStationOff();
    this.highlighter.position.copy(station.mesh.position);
    this.highlighter.visible = true;
    this.isHighlighting = true;
    this.highlightStartTime = new Date().getTime();
    this.highlightedStationIndex = stationIndex;
    this.highlightedStation = station;
    station.mesh.material.color.setHex(0xFCCC0A);
  };

  App.prototype.highlightStationOff = function(){
    if (this.highlightedStation === false) return;
    this.highlightedStation.mesh.material.color.set(this.highlightedStation.color);
    this.highlightedStation = false;
    this.highlightedStationIndex = false;
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

    $('.deselect-lines').on('click', function(){
      _this.selectLine(false);
    });

    $('body').on('click', '.select-station', function(e){
      _this.selectStation($(this));
    });

    $('body').on('mouseover', '.select-station', function(e){
      _this.highlightStation($(this));
    });

    $('#app canvas').one('click mousedown pointerdown touchstart', function(e){
      _this.interacted = true;
      $('.drag-icon').removeClass('active');
    });

  };

  App.prototype.loadScene = function(data){
    var _this = this;
    var w = data.width;
    var h = data.height;
    var lines = data.lines;

    this.mapWidth = w;
    this.mapHeight = h;
    this.x0 = -w * 0.5;
    this.x1 = w * 0.5;
    this.z0 = -h * 0.5;
    this.z1 = h * 0.5;

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var elW = this.$el.width();
    var elH = this.$el.height();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor( 0x000000, 0.0 );
    renderer.setSize( elW, elH );
    this.el.appendChild( renderer.domElement );
    this.renderer = renderer;

    var target = new THREE.Vector3(0, 0, 0);
    var cameraY = this.opt.cameraDistance;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 40, elW/elH, 1, cameraY + 6000 );
    camera.position.set(0, cameraY, 0);
    camera.lookAt(target);
    this.scene = scene;
    this.camera = camera;
    this.startingCameraPosition = camera.position.clone();

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target = target;
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
      lines[key].hasContinuousLineVersion = false;
      _.each(line.paths, function(path, i){
        var isContinuous = path.isContinuous;
        var points = _.map(path.points, function(p){
          return new THREE.Vector3(p[0], p[2], -p[1]);
        });
        var tubularSegments = points.length * 8;
        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeBufferGeometry(curve, tubularSegments, tubelarRadius, radialSegments, false);
        var tubeMat = new THREE.MeshPhongMaterial( { color: '#'+line.color, transparent: true } );
        var mesh = new THREE.Mesh( tubeGeo, tubeMat );
        var opacity = 1.0;
        if (isContinuous) {
          opacity = 0;
          mesh.material.opacity = 0;
          mesh.visible = false;
          lines[key].hasContinuousLineVersion = true;
        }
        lines[key].paths[i].mesh = mesh;
        lines[key].paths[i].opacity = opacity;
        lines[key].paths[i].targetOpacity = opacity;
        lineGroup.add(mesh);
      });
    });
    scene.add(lineGroup);

    // draw stations
    var stations = new THREE.Group();
    _.each(lines, function(line, key){
      _.each(line.stations, function(station, i){
        var geometry = new THREE.SphereBufferGeometry( 10, 32, 32 );
        var material = new THREE.MeshBasicMaterial( {color: '#'+line.textColor, transparent: true} );
        var sphere = new THREE.Mesh( geometry, material );
        var position = new THREE.Vector3(station.point[0], station.point[2], -station.point[1]);
        sphere.material.opacity = 0;
        sphere.visible = false;
        sphere.position.copy(position);
        stations.add( sphere );
        lines[key].stations[i].mesh = sphere;
        lines[key].stations[i].color = '#'+line.textColor;
      });
      lines[key].stationOpacity = 0;
      lines[key].targetStationOpacity = 0;
    });
    scene.add(stations);
    this.lines = lines;

    // create highlighter
    var hGeometry = new THREE.SphereBufferGeometry( 20, 32, 32 );
    var hMaterial = new THREE.MeshBasicMaterial( {color: 0xFCCC0A, transparent: true} );
    var highlighter = new THREE.Mesh( hGeometry, hMaterial );
    highlighter.material.opacity = 0;
    highlighter.visible = false;
    highlighter.renderOrder = 100; // always render last to retain transparency
    scene.add(highlighter);
    this.highlighter = highlighter;

    var loader = new THREE.TextureLoader();
    loader.load(
      'img/subway_base_map_texture.png',
      // onLoad callback
      function (mapTexture) {
        var mapGeometry = new THREE.PlaneBufferGeometry(w, h, 32);
        var mapMaterial = new THREE.MeshBasicMaterial( { map: mapTexture, side: THREE.DoubleSide, transparent: true } );
        var map = new THREE.Mesh(mapGeometry, mapMaterial);
        map.rotation.x = - Math.PI / 2;
        map.position.setY(-10);
        map.renderOrder = -1; // force render first so it doesn't clip the highlighter
        scene.add(map);
        _this.map = map;
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
      // if (name == 'N' || name == 'R' || name == 'Q' || name=='W') classNames.push('invert-text');
      classNames = classNames.join(' ');
      html += '<button class="select-line '+classNames+'" style="background: #'+line.color+'; color: #'+line.textColor+'">'+name+'</button>';
    });
    $buttons.html(html);
  };

  App.prototype.onIntroFinished = function(){
    $('.drag-icon').addClass('active');
    this.loadListeners();
    this.controls.enabled = true;
    // this.controls.autoRotate = true;
    // this.controls.autoRotateSpeed = 1.0;
    $('body').addClass('started');
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
    $('body').addClass('active');
    this.render();
  };

  App.prototype.render = function(){
    var _this = this;

    // intro animation
    if (!this.introFinished) {
      this.renderIntro();
    }

    // line selection transition
    if (this.lineTransitioning) {
      this.renderLineTransition();
    }

    // fly to station
    if (this.stationTransitioning) {
      this.renderStationTransition();
      this.controls.update();
    }

    // highlight animation
    if (this.isHighlighting) {
      this.renderHighlighter();
    }

    this.renderer.render( this.scene, this.camera );

    requestAnimationFrame(function(){
      _this.render();
    });
  };

  App.prototype.renderHighlighter = function(){
    var pulseDuration = 1000;
    var now = new Date().getTime();
    var delta = now - this.highlightStartTime;
    var progress = (delta % pulseDuration) / pulseDuration;
    var t = ease(progress);
    var opacity = lerp(0.6, 0, t);
    var scale = lerp(0, 4, t);
    this.highlighter.material.opacity = opacity;
    this.highlighter.scale.set( scale, scale, scale );
  };

  App.prototype.renderIntro = function(){
    var now = new Date().getTime();
    var t = norm(now, this.introStartTime, this.introEndTime);
    t = ease(t);
    if (t <= 0) t = 0.00001;

    var r = this.opt.cameraDistance;
    var pitch = lerp(Math.PI/2, Math.PI * 0.9, t);
    var yaw = lerp(0, Math.PI/4, t);

    // var z = r * Math.cos(rad);
    // var y = r * Math.sin(rad);

    var x = r * Math.sin(yaw) * Math.cos(pitch)
    var y = r * Math.sin(pitch)
    var z = r * Math.cos(yaw) * Math.cos(pitch)

    this.camera.position.set(x, y, -z);
    this.camera.lookAt(0, 0, 0);

    if (now >= this.introEndTime) {
      this.startingCameraPosition = this.camera.position.clone();
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
      _.each(line.paths, function(path, i){
        var lineNeedUpdate = (path.targetOpacity != path.opacity);
        if (lineNeedUpdate) {
          var lineOpacity = lerp(path.startOpacity, path.targetOpacity, t);
          _this.lines[lineName].paths[i].opacity = lineOpacity;
          var mesh = path.mesh;
          if (mesh.material.opacity != lineOpacity) {
            mesh.material.opacity = lineOpacity;
            mesh.material.needsUpdate = true;
          }
          if (lineOpacity <= 0) {
            mesh.visible = false;
          } else {
            mesh.visible = true;
          }
        }
      });

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

    // transition map
    var mapOpacity = lerp(this.mapOpacityStart, this.mapOpacityEnd, t);
    this.map.material.opacity = mapOpacity;

    if (t >= 1.0) {
      this.lineTransitioning = false;
    }
  };

  App.prototype.renderStations = function(line){
    if (line === this.loadedLine) return;

    this.loadedLine = line;

    this.$stations.empty();
    var lines = this.lines;
    var stations = lines[line].stations;

    var html = '<ul class="stations">';
    _.each(stations, function(station, i){
      if (i > 0) {
        var prev = stations[i-1];
        if (prev.borough != station.borough) {
          html += '<li class="borough">'+boroughs[prev.borough]+'</li>';
          html += '<li class="borough">'+boroughs[station.borough]+'</li>';
        }
      }
      html += '<li class="station">';
        html += '<div class="title">'
          html += '<button class="select-station" data-line="'+line+'" data-index="'+i+'">'+station.name+'</button>';
          html += '<div class="routes">'
            _.each(station.routes, function(route){
              var routeLine = lines[route];
              html += '<div class="route" style="background: #'+routeLine.color+'; color: #'+routeLine.textColor+';">'+route+'</div>'
            });
          html += '</div>';
        html += '</div>';
        html += '<div class="details">';
          html += '<p>Median household income: <strong>'+formatMoney(station.income)+'</strong></p>';
          html += '<p>Census tract: <strong>'+station.tract+'</strong></p>';
        html += '</div>';
      html += '</li>';
    });
    html += '</ul>';
    this.$stations.html(html);
  };

  App.prototype.renderStationTransition = function(){
    var now = new Date().getTime();
    var t = norm(now, this.stationTransitionStartTime, this.stationTransitionEndTime);
    var eased = ease(t);

    var newPosition = this.stationStartPosition.clone();
    newPosition.lerp(this.stationEndPosition, eased);

    var newLookAtPosition = this.stationStartLookAtPosition.clone();
    newLookAtPosition.lerp(this.stationEndLookAtPosition, eased);

    this.camera.position.copy(newPosition);
    this.controls.target.copy(newLookAtPosition);

    if (t >= 1.0) {
      this.stationTransitioning = false;
      this.controls.enabled = true;
    }
  };

  App.prototype.selectLine = function($button){
    if (this.lineTransitioning === true || this.stationTransitioning === true) return;

    var _this = this;
    var selectedLine = false;

    if ($button !== false) {
      var isSelected = $button.hasClass('selected');
      $('.select-line').removeClass('selected hidden');
      if (!isSelected) {
        $('.select-line').addClass('hidden');
        $button.addClass('selected');
        selectedLine = $button.text().trim();
      }
    } else {
      $('.select-line').removeClass('selected hidden');
    }
    this.selectedLine = selectedLine;
    this.selectedStation = false;

    this.highlighter.visible = false;
    this.isHighlighting = false;
    this.highlightStationOff();

    if (selectedLine===false) {
      this.$menu.removeClass('lines');
      this.selectStation(false);
    } else {
      this.$menu.addClass('lines');
      this.renderStations(selectedLine);
    }

    this.mapOpacityStart = 1.0;
    this.mapOpacityEnd = 0.4;
    if (selectedLine===false) {
      this.mapOpacityStart = 0.4;
      this.mapOpacityEnd = 1.0;
    }

    this.lineTransitionStartTime = new Date().getTime();
    this.lineTransitionEndTime = this.lineTransitionStartTime + this.opt.transitionDuration;
    this.lineTransitioning = true;
    var inactiveLineOpacity = this.opt.inactiveLineOpacity;
    _.each(this.lines, function(line, lineName){
      _.each(line.paths, function(path, i){
        var isSelected = (lineName === selectedLine);
        var targetOpacity = isSelected || selectedLine === false ? 1.0 : inactiveLineOpacity;
        if (line.hasContinuousLineVersion && !path.isContinuous) {
          targetOpacity = selectedLine === false ? 1.0 : inactiveLineOpacity;
          if (isSelected) targetOpacity = 0;
        } else if (path.isContinuous) {
          targetOpacity = isSelected ? 1.0 : 0;
        }
        _this.lines[lineName].paths[i].startOpacity = path.opacity;
        _this.lines[lineName].paths[i].targetOpacity = targetOpacity;
      });
      _this.lines[lineName].startStationOpacity = line.stationOpacity;
      _this.lines[lineName].targetStationOpacity = lineName === selectedLine ? 1.0 : 0;
    });
  };

  App.prototype.selectStation = function($button){
    if (this.lineTransitioning === true || this.stationTransitioning === true) return;

    var station = false;
    var stationIndex = false;
    $('.station').removeClass('selected');

    if ($button !== false) {
      var line = ""+$button.attr('data-line');
      stationIndex = parseInt($button.attr('data-index'));

      // already selected
      if (line === this.selectedLine && stationIndex === this.selectedStation) return;

      var station = this.lines[line].stations[stationIndex];
      $button.closest('.station').addClass('selected');
      this.highlightStation($button);
    } else {
      this.highlightStationOff();
    }

    this.selectedStation = stationIndex;
    var stationPosition = new THREE.Vector3(0, 0, 0);
    var targetCameraPosition = this.startingCameraPosition.clone();
    // targetCameraPosition = this.camera.position.clone();

    // determine what part of the map the station is on
    if (station !== false) {
      stationPosition = station.mesh.position;
      targetCameraPosition = stationPosition.clone();
      var nx = norm(stationPosition.x, this.x0, this.x1);
      var nz = norm(stationPosition.z, this.z0, this.z1);
      var threshold = 0.2;
      var thresholdInv = 1.0 - threshold;
      var cameraDistance = this.opt.cameraDistance * 0.25;
      // // north side
      // if (nz < threshold) {
      //   targetCameraPosition.add(new THREE.Vector3(0, 0, -cameraDistance));
      // // south side
      // } else if (nz > thresholdInv) {
      //   targetCameraPosition.add(new THREE.Vector3(0, 0, cameraDistance));
      // // west side
      // } else if (nx < 0.5) {
      //   targetCameraPosition.add(new THREE.Vector3(-cameraDistance, 0, 0));
      // // east side
      // } else {
      //   targetCameraPosition.add(new THREE.Vector3(cameraDistance, 0, 0));
      // }

      // south side
      if (nz > thresholdInv || nx > 0.5) {
        targetCameraPosition.add(new THREE.Vector3(0, 0, cameraDistance));
      // west side
      } else {
        targetCameraPosition.add(new THREE.Vector3(-cameraDistance, 0, 0));
      }

    }

    var startLookAtPosition = this.controls.target.clone();
    var targetLookAtPosition = stationPosition.clone();

    this.stationTransitionStartTime = new Date().getTime();
    this.stationTransitionEndTime = this.stationTransitionStartTime + this.opt.stationTransitionDuration;
    this.stationStartPosition = this.camera.position.clone();
    this.stationEndPosition = targetCameraPosition;
    this.stationStartLookAtPosition = startLookAtPosition;
    this.stationEndLookAtPosition = targetLookAtPosition;
    this.stationTransitioning = true;
    this.controls.enabled = false;
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
