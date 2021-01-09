'use strict';

var App = (function() {

  function App(config) {
    var defaults = {};
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  App.prototype.init = function(){
    this.loadPanzoom();
  };

  App.prototype.loadPanzoom = function(){
    var el = $('#panzoom')[0];
    var panzoom = Panzoom(el, {
      maxScale: 5
    });
    el.parentElement.addEventListener('wheel', panzoom.zoomWithWheel)
  };

  return App;

})();

$(function() {
  var app = new App({});
});
