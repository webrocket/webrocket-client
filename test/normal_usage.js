var scenario = require('gerbil').scenario;
var smoking = require('smoking');
var WebRocket = require('../lib/webrocket');

scenario("WebRocket - Normal Usage", {
  '': function(g) {
    var webrocket = new WebRocket("ws://localhost:8080/test");
    g.assertEqual(webrocket.channels, []);
    g.setTimeout(function() {
      var channel = webrocket.subscribe('prueba');
      console.log(channel.state);
    }, 1000);
  }
});
