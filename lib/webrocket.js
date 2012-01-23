// # WebRocket Client

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
    return this.connection.channels;
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
    if(trigger && !this.connection.authenticated) throw WebRocket.Error();
    var channel = this.connection.channels.find(channelName);

    channel.broadcast(event, data, trigger);
  },

  //
  authenticate: function(channelName, token) {
    var channel = this.connection.channels.find(channelName);

    if(token && !channel.authenticated) {
      channel.authenticate(token);
    }
  }
};

if(!!Object.__defineGetter__) {
  WebRocket.prototype.__defineGetter__('channels', function() {
    return this.connection.channels;
  });
}

// ## WebRocket.Connection
WebRocket.Connection = function WebRocketConnection(url) {
  var self = this;

  this.url = url;
  this.state = 'disconnected';
  this.authenticated = false;

  this.socket = new WebSocket(url);
  this.channels = new WebRocket.Channels(this);
  this.handler = new WebRocket.Handler(this);
  this.events = new WebRocket.Events;

  this.socket.onmessage = function(message) { self.handler.message(message); };
  this.socket.onerror = function(message)   { self.handler.error(message); };
  this.socket.onclose = function(message)   { self.handler.close(message); };
  this.socket.onopen = function(message)    { self.handler.open(message); };
};

// ## Methods
WebRocket.Connection.prototype = {
  constructor: WebRocket.Connection,

  // **send**: Sends data in JSON format through the websocket connection.
  send: function(msg) {
    this.socket.send(JSON.stringify(msg));
  },

  // **subscribe**: Adds and subscribes a channel.
  subscribe: function(channelName, data) {
    var channel = this.channels.find(channelName) || this.channels.add(channelName);
    channel.subscribe(data);

    return channel;
  },

  // **unsubscribe**: Unsubscribes a channel, but keeps it in the list.
  unsubscribe: function(channelName, data) {
    var channel = this.channels.find(channelName);
    channel.unsubscribe(data);

    return channel;
  },

  // **close**: Gracefully unsubscribe all the channels and closes the
  // connection
  close: function(data) {
    if(this.state == 'connected') {
      this.channels.each(function(channel) { channel.unsubscribe(); });
      this.send({ close: data });
    }
  },

  bind: function(event, fn) {
    this.events.bind(event, fn);
  },

  //
  authenticate: function(token) {
    if(!this.authenticated) {
      var authJson = { auth: { token: token } };
      this.send(authJson);
    }
  }

};

// ## WebRocket.Channels
// Represents the channels list. Inherits from Array
WebRocket.Channels = function WebRocketChannels(connection) {
  this.connection = connection;
};

WebRocket.Channels.prototype = new Array;

WebRocket.Channels.prototype.constructor = WebRocket.Channels;

// **add**: Adss and creates channel to the list.
WebRocket.Channels.prototype.add = function(channelName) {
  if(this.find(channelName)) return false;
  var channel = new WebRocket.Channel(this.connection, channelName);
  this.push(channel);
  return channel;
};

// **del**: Deletes a channel from the list.
WebRocket.Channels.prototype.del = function(channelName) {
  var foundChannel = this.find(channelName);
  if(!!foundChannel) {
    if(foundChannel.state == 'subscribed') foundChannel.unsubscribe();
    this.each(function(channel, i) {
      if(channel == foundChannel) delete this[i];
    });
  }
};

// **find**: Finds a channel from the list.
WebRocket.Channels.prototype.find = function(channelName) {
  var foundChannel = null;

  this.each(function(channel) {
    if(channel.name == channelName) foundChannel = channel;
  });
  return foundChannel;
};

// **each**: Goes through all the channels executing a fn(channel, index)
WebRocket.Channels.prototype.each = function(fn) {
  for(var i = 0; i < this.length; i++) fn(this[i], i);
};

WebRocket.Events = function WebRocketEvents() {
  this.callbacks = {};
}

WebRocket.Events.prototype = {
  // **bind**: Binds a function to a given event.
  bind: function(event, fn) {
    if(!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(fn);
  },

  // **trigger**: Triggers an event for this channel.
  trigger: function(event, data) {
    if(this.callbacks[event]) {
      for(var callback in this.callbacks[event]) {
        this.callbacks[event][callback].call({}, data);
      }
    }
  }
};

// ## WebRocket.Channel
// Channel instance.
WebRocket.Channel = function WebRocketChannel(connection, name) {
  this.connection = connection;
  this.name = name;
  this.state = 'unsubscribed';
  this.events = new WebRocket.Events;
};

// ## Methods
WebRocket.Channel.prototype = {
  constructor: WebRocket.Channel,

  // **subscribe**: Subscribes the channel and sends custom data.
  subscribe: function(data) {
    if(this.state == 'unsubscribed') {
      var subscribeJson = { 'subscribe': { 'channel': this.name, 'data': data } };
      this.connection.send(subscribeJson);
    }
  },

  // **unsubscribe**: Unsubscribes the channel and sends custom data.
  unsubscribe: function(data) {
    if(this.state == 'subscribed') {
      var unsubscribeJson = { 'unsubscribe': { 'channel': this.name, 'data': data } };
      this.connection.send(unsubscribeJson);
    }
  },

  // **broadcast**: Sends a broadcast to all the members of the channel for a
  // given `event` and custom `data`, can also trigger a backend event.
  broadcast: function(event, data, trigger) {
    var broadcastJson = { broadcast: { channel: this.name, event: event, data: data } };

    if(trigger) broadcastJson['trigger'] = trigger;

    this.connection.send(broadcastJson);
  },

  bind: function(event, fn) {
    this.events.bind(event, fn);
  }
};

WebRocket.Subscriber = function(channel, options) {
  this.channel = channel;
  this.sid = options.sid;
  this.data = options.data;
};

// ## WebRocket.Handler
// Handles incomming traffic.
WebRocket.Handler = function WebRocketHandler(connection) {
  this.connection = connection;

  // **unpack**: From JSON to object
  this.unpack = function(data) {
    return JSON.parse(data);
  };

  // **pack**: From object to JSON
  this.pack = function(data) {
    return JSON.stringify(data);
  };
};

// ## Methods
WebRocket.Handler.prototype = {
  constructor: WebRocket.Handler,

  // **open**:
  open: function(message) {
    this.connection.state = 'connecting';
  },

  // **close**:
  close: function(message) {
    this.connection.state = 'disconnected';
  },

  // **error**:
  error: function(message) {
    console.error(message);
  },

  // **message**:
  message: function(message) {
    var data = this.unpack(message.data);
    var channel = null;

    switch(true) {

      // _connected_
      case !!data.__connected:
        this.connection.state = 'connected';
        this.connection.sid = data.__connected.sid;
        this.connection.events.trigger(':connected');
        break;

      // _subscribed_
      case !!data.__subscribed:
        var subscribedChannel = data.__subscribed.channel;
        var subscribers = data.__subscribed.subscribers || [];

        channel = this.connection.channels.find(subscribedChannel);
        if(channel.state == 'unsubscribed') {
          channel.state = 'subscribed';
          if(subscribers.length) {
            for(var i; i < subscribers.length; i++) {
              var member = new WebRocket.Subscriber(channel, subscribers[i]);
              console.log(member);
            }
          }
          channel.events.trigger(':subscribed');
        }
        break;

      // _unsubscribed_
      case !!data.__unsubscribed:
        var unsubscribedChannel = data.__unsubscribed.channel;
        channel = this.connection.channels.find(unsubscribedChannel);

        if(channel.state == 'subscribed') {
          channel.state = 'unsubscribed';
          channel.events.trigger(':unsubscribed');
        }
        break;

      // _authenticated_
      case !!data.__authenticated:
        this.connection.authenticated = true;
        break;

      // _ping_
      case !!data.__ping:
        this.connection.send({ pong: { sid: this.connection.sid } });
        break;

      // _closed_
      case !!data.__closed:
        this.connection.state = 'disconnected';
        this.connection.events.trigger(':disconnected');
        break;

      // _error_
      case !!data.__error:
        var error = data.__error;
        console.error(data);
        throw new WebRocket.Error(error.status, error.code);
        break;

      case !!data.__memberJoined:
        break;

      case !!data.__memberLeft:
        break;

      // _custom event_
      default:
        for(var event in data)
        var channelName = data[event].channel;

        channel = this.connection.channels.find(channelName);

        delete data[event].channel;

        if(channel) {
          var content = data[event];
          console.warn(channel.events);
          channel.events.trigger(event, content);
        }
        break;
    }
  }
};

// ## WebRocket.Error
WebRocket.Error = function WebRocketError(status, code) {
  this.status = status;
  this.code = code;
};

if(typeof module != 'undefined') module.exports = WebRocket;
