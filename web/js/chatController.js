!function(exports) {
  'use strict';

  var debug = Utils.debug;

  var TIME_RESEND_CHAT = 60000;

  var _connectedEarlyThanMe = [];
  var _connectedAfterMe = {};
  var _historyChat = [];

  var _usrId;
  var _creationTime;
  var _myCreationTime;

  function loadChat(data) {
    if (data) {
      for (var i = 0, l = data.length; i < l; i++) {
        _historyChat.push(data[i]);
        ChatView.insertChatLine(data[i]);
      }
    }
  }

  function sendHistoryAck() {
    OTHelper.sendSignal({
      type: 'chatHistoryACK',
      data: _usrId
    });
  }

  function sendChat(aUser) {
    return OTHelper.sendSignal({
      type: 'chatHistory',
      to: aUser,
      data: JSON.stringify(_historyChat)
    });
  }

  function IMustSend() {
    return _connectedEarlyThanMe.length <= 0;
  }

  function sendHistory(evt) {
    var newUsr = JSON.parse(evt.connection.data).userName;
    var connectionNewUsr = evt.connection;
    var creationTime = evt.connection.creationTime;
    var connectionId = evt.connection.connectionId;

    if (creationTime < _myCreationTime) {
      _connectedEarlyThanMe.push(connectionId);
    }

    if (newUsr != _usrId && creationTime > _myCreationTime) {
      var send = function(aConnectionNewUsr) {
        if (IMustSend()) {
          sendChat(aConnectionNewUsr);
        }
      };

      send(connectionNewUsr);

      var intervalResendChat =
        window.setInterval(send.bind(undefined, connectionNewUsr),
                           TIME_RESEND_CHAT);
      _connectedAfterMe[connectionId] = { intervalId: intervalResendChat };
    }
  };


  var _chatHandlers = {
    'signal:chat': function(evt) {
      // A signal of the specified type was received from the session. The
      // SignalEvent class defines this event object. It includes the following
      // properties:
      // data — (String) The data string sent with the signal.
      // from — (Connection) The Connection corresponding to the client that
      //        sent with the signal.
      // type — (String) The type assigned to the signal (if there is one).
      // You can register for signals of a specfied type by adding an event
      // handler for the signal:type event (replacing type with the actual type
      // string to filter on). For example, the following code adds an event
      // handler for signals of type "foo":
      // session.on("signal:foo", function(event) {
      //   console.log("foo signal sent from connection " + event.from.id);
      //   console.log("Signal data: " + event.data);
      // });
      // You can register to receive all signals sent in the session, by adding
      // an event handler for the signal event.
      var data = JSON.parse(evt.data);
      _historyChat.push(data);
      ChatView.insertChatLine(data);
    },
    'signal:chatHistory': function(evt) {
      loadChat(JSON.parse(evt.data));
      sendHistoryAck();
      // FOLLOW-UP This event must have been an once event and don't need
      // to remove it
      OTHelper.removeListener(this, 'signal:chatHistory');
    },
    'signal:chatHistoryACK': function(evt) {
      var conn = _connectedAfterMe[evt.from.connectionId];
      if (conn) {
        window.clearInterval(conn.intervalId);
      }
    },
    'connectionCreated': function(evt) {
      // Dispatched when an new client (including your own) has connected to the
      // session, and for every client in the session when you first connect
      // Session object also dispatches a sessionConnected evt when your local
      // client connects
      if (evt.connection.data) {
        sendHistory(evt);
      }
    },
    'sessionConnected': function(evt) {
      _myCreationTime = evt.target.connection.creationTime;
    },
    'connectionDestroyed': function(evt) {
      // If connection destroyed belongs to someone older than me,
      // remove one element from connected early than me array
      // no matters who, it only care the length of this array,
      // when it's zero it's my turn to send history chat
      if (evt.connection.creationTime < _myCreationTime) {
        _connectedEarlyThanMe.pop();
      }
    }
  };

  function sendMsg(data) {
    return OTHelper.sendSignal({
      type: 'chat',
      data: JSON.stringify(data)
    });
  }

  function addHandlers(aAllHandlers) {
    if (!Array.isArray(aAllHandlers)) {
      aAllHandlers = [aAllHandlers];
    }
    aAllHandlers.push(_chatHandlers);
    return aAllHandlers;
  }

  function init(aRoomName, aUsrId, aGlobalHandlers) {
    return LazyLoader.dependencyLoad([
      '/js/components/chat.js',
      '/js/chatView.js'
    ]).then(function() {
      ChatView.init(aUsrId, aRoomName);
      _usrId = aUsrId;
      return addHandlers(aGlobalHandlers);
    });
  }

  exports.ChatController = {
    init: init,
    sendMsg: sendMsg
  };

}(this);
