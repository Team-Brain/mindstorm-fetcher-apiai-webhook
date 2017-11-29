'use strict';

var http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3000;

const app = express()
app.use(bodyParser.json({type: 'application/json'}));

var server = http.createServer(app);
server.listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

var queueArray = [];

app.post('/webhook', function (request, response) {
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  console.log('');

  // An action is a string used to identify what tasks needs to be done
  // in fulfillment usally based on the corresponding intent.
  // See https://api.ai/docs/actions-and-parameters for more.
  let action = request.body.result.action;
  console.log('result action: ' + action);

  // Parameters are any entites that API.AI has extracted from the request.
  // See https://api.ai/docs/actions-and-parameters for more.
  const parameters = request.body.result.parameters;
  console.log('result parameters: ' + parameters);

  // Contexts are objects used to track and store conversation state and are identified by strings.
  // See https://api.ai/docs/contexts for more.
  const contexts = request.body.result.contexts;
  console.log('result contexts: ' + contexts);
  console.log('');

  // Initialize JSON we will use to respond to API.AI.
  let responseJson = {};

  // Create a handler for each action defined in API.AI
  // and a default action handler for unknown actions
  const actionHandlers = {
      'input.welcome': () => {
          // The default welcome intent has been matched, Welcome the user.
          // Define the response users will hear
          //responseJson.speech = 'Hello! My name is Fetchy';
          responseJson.speech = 'Hello! My name is Fetchy';
          // Define the response users will see
          responseJson.displayText = 'Hello! My name is Fetchy';
          // Send the response to API.AI
          response.json(responseJson)
      },
      'cancel.request': () => {
          // The default welcome intent has been matched, Welcome the user.
          // Define the response users will hear
          responseJson.speech = 'I am aborting';
          // Define the response users will see
          responseJson.displayText = 'I am aborting';
          // Send the response to API.AI
          response.json(responseJson)
          io.emit('abort')
      },
      'bring.object': () => {
          let color = parameters['color'];
          let object = parameters['object'];
          if (object === 'cup') {
              responseJson.timestamp = new Date();
              responseJson.action = action;
              responseJson.object = object;
              responseJson.color = color;
              responseJson.speech = 'Bringing ' + color + ' ' + object + '.';
              responseJson.displayText = 'Bringing ' + color + ' ' + object + '.';
              // Notify connected sockets about new request
              io.emit('request', responseJson);
              requestQueue(responseJson)

          } else {
              responseJson.speech = 'Cant do';
              responseJson.displayText = 'Cant do';
          }

          // Send the response to API.AI
          response.json(responseJson);

      },
      'default': () => {
          // This is executed if the action hasn't been defined.
          // Add a new case with your action to respond to your users' intent!
          responseJson.speech = 'Sorry, I dont understand';
          responseJson.displayText = 'Sorry, I dont understand';

          // Optional: add rich messages for Google Assistant, Facebook and Slack defined below.
          // Uncomment next line to enable. See https://api.ai/docs/rich-messages for more.
          //responseJson.data = richResponses;

          // Optional: add outgoing context(s) for conversation branching and flow control.
          // Uncomment next 2 lines to enable. See https://api.ai/docs/contexts for more.
          //let outgoingContexts = [{"name":"weather", "lifespan":2, "parameters":{"city":"Rome"}}];
          //responseJson.contextOut = outgoingContexts;

          // Send the response to API.AI
          response.json(responseJson)
      }
  };

  function requestQueue (resp){
    console.log('executing request queue function');
    console.log('current items in queueArray: ' + queueArray);
    console.log('adding to queueArray: ' + resp);
    queueArray = queueArray.concat(resp);
    console.log('item added to queueArray: ' + queueArray);
    //reqQueue.shift()
    //console.log('reqQueue: ' + reqQueue);
    //return
  }

  // If the action is not handled by one of our defined action handlers
  // use the default action handler
  if (!actionHandlers[action]) {
      action = 'default';
  }

  // Map the action name to the correct action handler function and run the function
  actionHandlers[action]();
})

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});