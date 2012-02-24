# WebRocket Client

The amazing WebRocket Client

## Working with channels

```javascript
var wr = new WebRocket('ws://localhost:8080/channel')
wr.connection.bind(':connected', function() {
  var channel = wr.subscribe('coolInfo');
  channel.broadcast('userInfo', {
    id: 1,
    name: 'Marty McFly'
  });
});
```

## Working with private channels

## Working with presence channels
