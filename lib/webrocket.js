if(typeof module != 'undefined') var WebSocket = require('websocket-client').WebSocket;

var WebRocket = function(url, options) {
  this.connection = new WebRocket.Connection(url);
};

WebRocket.prototype = {
  channels: function() {
    return this.connection.channels;
  },

  subscribe: function(channel, data) {
    this.connection.subscribe(channel, data);
  },

  unsubscribe: function(channel, data) {
    this.connection.unsubscribe(channel, data);
  },

  close: function(data) {
    this.connection.close(data);
  },

  on: function(event, fn) {
  }
};

WebRocket.Connection = function(url) {
  var self = this;

  this.url = url;
  this.state = 'disconnected';
  this.socket = new WebSocket(url);
  this.channels = new WebRocket.Channels(this);;
  this.handler = new WebRocket.Handler(this);

  this.socket.onmessage = function(message) { self.handler.message(message); };

  this.socket.onerror = function() {
    throw new WebRocket.Error;
  };

  this.socket.onclose = function() {
  };

  this.socket.onopen = function() {
    self.state = 'connecting';
  };
};

WebRocket.Connection.prototype = {
  send: function(msg) {
    this.socket.send(JSON.stringify(msg));
  },

  subscribe: function(channel, data) {
    var webrocketChannel = this.channels.add(channel);

    webrocketChannel.subscribe(data);
  },

  unsubscribe: function(channelName, data) {
    var channel = this.channels.find(channelName);
    channel.unsubscribe(data);
  },

  close: function(data) {
    this.channels.each(function(channel) {
      channel.unsubscribe();
    });
    this.send({ close: data });
  },

  broadcast: function() {}
};

WebRocket.Channels = function(connection) {
  this.connection = connection;
  this.list = [];
};

WebRocket.Channels.prototype = {
  add: function(channelName) {
    if(!!this.find(channelName)) return;
    var channel = new WebRocket.Channel(this.connection, channelName);
    this.list.push(channel);
    return channel;
  },

  del: function(channelName) {
    var foundChannel = this.find(channelName);
    if(!!foundChannel) {
      if(foundChannel.state == 'subscribed') foundChannel.unsubscribe();
      this.each(function(channel, i) {
        if(channel == foundChannel) delete this.list[i];
      });
    }
  },

  find: function(channelName) {
    var foundChannel = null;

    this.each(function(channel) {
      if(channel.name == channelName) foundChannel = channel;
    });
    return foundChannel;
  },

  each: function(fn) {
    for(var i = 0; i < this.list.length; i++) {
      fn(this.list[i], i);
    }
  }
};

WebRocket.Channel = function(connection, name) {
  this.connection = connection;
  this.name = name;
  this.state = 'unsubscribed';
};

WebRocket.Channel.prototype = {
  subscribe: function(data) {
    var subscribeJson = { 'subscribe': { 'channel': this.name, 'data': data } };
    this.connection.send(subscribeJson);
  },

  unsubscribe: function(data) {
    var unsubscribeJson = { 'unsubscribe': { 'channel': this.name, 'data': data } };
    this.connection.send(unsubscribeJson);
  }
};

WebRocket.Handler = function(connection) {
  this.connection = connection;

  this.unpack = function(data) {
    return JSON.parse(data);
  };

  this.pack = function(data) {
    return JSON.stringify(data);
  }
};

WebRocket.Handler.prototype = {
  message: function(message) {
    var data = this.unpack(message.data);

    switch(true) {
      case !!data.__connected:
        this.connection.state = 'connected';
        this.connection.sid = data.__connected.sid;
        break;

      case !!data.__subscribed:
        var subscribedChannel = data.__subscribed.channel;
        var channel = this.connection.channels.find(subscribedChannel);

        if(channel.state == 'unsubscribed') channel.state = 'subscribed';
        break;

      case !!data.__unsubscribed:
        var unsubscribedChannel = data.__unsubscribed.channel;
        var channel = this.connection.channels.find(unsubscribedChannel);

        if(channel.state == 'subscribed') channel.state = 'unsubscribed';
        break;

      case !!data.__ping:
        this.connection.send({ pong: { sid: this.connection.sid } });
        break;

      case !!data.__closed:
        this.connection.state = 'disconnected';
        break;

      default:
        console.log(data);
    }
  }
};

WebRocket.Message = function(msg) {
  this.msg = msg;
};

WebRocket.Message.prototype = {
  toString: function() {
    return this.msg;
  }
};

WebRocket.Error = function() {};

if(typeof module != 'undefined') module.exports = WebRocket;
