// # WebRocket Client

if(typeof module != 'undefined') var WebSocket = require('websocket-client').WebSocket;

// ## Main WebRocket object
// `url` must be set within this format:
//
// _[ws || // wss]://[host]:[port]/[vhost]_
//
// eg:
//
//      var webrocket = new WebRocket("ws://localhost:8081/test");
var WebRocket = function WebRocket(url, options) {
  this.connection = new WebRocket.Connection(url);
};

// ## Methods
WebRocket.prototype = {
  constructor: WebRocket,

  // **channels**: Lists all available channels
  //
  //    webrocket.channels();
  channels: function() {
    return this.connection.channels.list;
  },

  // **subscribe**: Subscribes a given channel
  // Accepts two parameters:
  //
  //  * **channel**
  //  * _data_
  subscribe: function(channelName, data) {
    return this.connection.subscribe(channelName, data);
  },

  // **unsubscribe**: Unsubscribes a given channel
  // Accepts two parameters:
  //
  //  * **channel**
  //  * _data_
  unsubscribe: function(channelName, data) {
    this.connection.unsubscribe(channelName, data);
  },

  // **close**: Closes the current connection
  // Accepts one optional parameters which represents data to be sent.
  close: function(data) {
    this.connection.close(data);
  },

  // **broadcast**: Broadcasts a message to all the clients connected to the channel.
  //
  //  * **channel name**: will attempt connect if not already connected.
  //  * **event**: event to be sent, this must be the same as called in 'bind'.
  //  * _data_: data to be sent.
  //  * _trigger_: event triggered in the backend.
  broadcast: function(channelName, event, data, trigger) {
    var channel = this.connection.channels.find(channelName);

    if(trigger && !channel.authenticated) throw WebRocket.Error();
    channel.broadcast(event, data, trigger);
  },

  //
  authenticate: function(channelName, token) {
    var channel = this.connection.channels.find(channelName);

    if(token && !channel.authenticated) {
      channel.authenticate(token);
    }
  },

  // **bind**: binds functions to be called on given events for a given channel.
  //
  bind: function(channelName, event, fn) {
    var channel = this.connection.channels.find(channelName);

    channel.bind(event, fn);
  }
};

if(!!Object.__defineGetter__) {
  WebRocket.prototype.__defineGetter__('channels', function() {
    return this.connection.channels.list;
  });
}

// ## WebRocket.Connection
WebRocket.Connection = function WebRocketConnection(url) {
  var self = this;

  this.url = url;
  this.state = 'disconnected';
  this.socket = new WebSocket(url);
  this.channels = new WebRocket.Channels(this);
  this.handler = new WebRocket.Handler(this);

  this.socket.onmessage = function(message) { self.handler.message(message); };
  this.socket.onerror = function(message)   { self.handler.error(message); };
  this.socket.onclose = function(message)   { self.handler.close(message); };
  this.socket.onopen = function(message)    { self.handler.open(message); };
};

// ## Methods
WebRocket.Connection.prototype = {
  constructor: WebRocket.Connection,
  //
  send: function(msg) {
    this.socket.send(JSON.stringify(msg));
  },
  //
  subscribe: function(channelName, data) {
    var channel = this.channels.list.add(channelName);
    channel.subscribe(data);

    return channel;
  },

  //
  unsubscribe: function(channelName, data) {
    var channel = this.channels.list.find(channelName);
    channel.unsubscribe(data);

    return channel;
  },

  //
  close: function(data) {
    this.channels.list.each(function(channel) { channel.unsubscribe(); });
    this.send({ close: data });
  }
};

// ## WebRocket.Channels
WebRocket.Channels = function WebRocketChannels(connection) {
  this.connection = connection;
  this.list = new WebRocket.ChannelsList(this.connection);
};

// ## Methods
WebRocket.ChannelsList = function WebRocketChannelsList(connection) {
  this.connection = connection;
};

WebRocket.ChannelsList.prototype = new Array;

WebRocket.ChannelsList.prototype.constructor = WebRocket.ChannelsList;

WebRocket.ChannelsList.prototype.add = function(channelName) {
  if(!!this.find(channelName)) return false;
  var channel = new WebRocket.Channel(this.connection, channelName);
  this.push(channel);
  return channel;
};

//
WebRocket.ChannelsList.prototype.del = function(channelName) {
  var foundChannel = this.find(channelName);
  if(!!foundChannel) {
    if(foundChannel.state == 'subscribed') foundChannel.unsubscribe();
    this.each(function(channel, i) {
      if(channel == foundChannel) delete this[i];
    });
  }
};

//
WebRocket.ChannelsList.prototype.find = function(channelName) {
  var foundChannel = null;

  this.each(function(channel) {
    if(channel.name == channelName) foundChannel = channel;
  });
  return foundChannel;
};

//
WebRocket.ChannelsList.prototype.each = function(fn) {
  for(var i = 0; i < this.length; i++) fn(this[i], i);
};

// ## WebRocket.Channel
WebRocket.Channel = function WebRocketChannel(connection, name) {
  this.connection = connection;
  this.name = name;
  this.state = 'unsubscribed';
  this.authenticated = false;
  this.callbacks = {};
};

// ## Methods
WebRocket.Channel.prototype = {
  constructor: WebRocket.Channel,
  //
  subscribe: function(data) {
    var subscribeJson = { 'subscribe': { 'channel': this.name, 'data': data } };
    this.connection.send(subscribeJson);
  },

  //
  unsubscribe: function(data) {
    var unsubscribeJson = { 'unsubscribe': { 'channel': this.name, 'data': data } };
    this.connection.send(unsubscribeJson);
  },

  //
  authenticate: function(token) {
    var authJson = { auth: { token: token } };
    this.connection.send(authJson);
  },

  //
  broadcast: function(event, data, trigger) {
    var broadcastJson = { broadcast: { channel: this.name, event: event, data: data } };

    if(trigger) broadcastJson['trigger'] = trigger;

    this.connection.send(broadcastJson);
  },

  //
  bind: function(event, fn) {
    if(!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(fn);
  },

  //
  trigger: function(event, data) {
    if(this.callbacks[event]) {
      for(var callback in this.callbacks[event]) {
        this.callbacks[event][callback].call({}, data);
      }
    }
  }
};

// ## WebRocket.Handler
WebRocket.Handler = function WebRocketHandler(connection) {
  this.connection = connection;

  this.unpack = function(data) {
    return JSON.parse(data);
  };

  this.pack = function(data) {
    return JSON.stringify(data);
  };
};

// ## Methods
WebRocket.Handler.prototype = {
  constructor: WebRocket.Handler,
  //
  open: function(message) {
    this.connection.state = 'connecting';
  },

  //
  close: function(message) {
    this.connection.state = 'disconnected';
  },

  //
  error: function(message) {},

  //
  message: function(message) {
    var data = this.unpack(message.data);
    var channel = null;

    switch(true) {
      //
      case !!data.__connected:
        this.connection.state = 'connected';
        this.connection.sid = data.__connected.sid;
        break;

      //
      case !!data.__subscribed:
        var subscribedChannel = data.__subscribed.channel;
        channel = this.connection.channels.list.find(subscribedChannel);

        if(channel.state == 'unsubscribed') channel.state = 'subscribed';
        break;

      //
      case !!data.__unsubscribed:
        var unsubscribedChannel = data.__unsubscribed.channel;
        channel = this.connection.channels.list.find(unsubscribedChannel);

        if(channel.state == 'subscribed') channel.state = 'unsubscribed';
        break;

      //
      case !!data.__authenticated:
        console.log(data);
        break;

      //
      case !!data.__ping:
        this.connection.send({ pong: { sid: this.connection.sid } });
        break;

      //
      case !!data.__closed:
        this.connection.state = 'disconnected';
        break;

      //
      case !!data.__error:
        console.error(data);
        break;

      // Sent Event
      default:
        for(var event in data)
        var channelName = data[event].channel;

        channel = this.connection.channels.find(channelName);

        delete data[event].channel;

        if(channel) {
          var content = data[event];
          channel.trigger(event, content);
        }
        break;
    }
  }
};

// ## WebRocket.Error
WebRocket.Error = function WebRocketError() {};

if(typeof module != 'undefined') module.exports = WebRocket;
