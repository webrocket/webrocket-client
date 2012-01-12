var scenario = require('gerbil').scenario;
var smoking = require('smoking');
var WebRocket = require('../lib/webrocket');

scenario('WebRocket Connection', {
  '': function(g) {
    var url = "ws://localhost:8080";
    var connection = new WebRocket.Connection(url);

    g.assertEqual(connection.state, 'disconnected');
  }
});
