'use strict'

var http = require('http')
const express = require('express')
const socketIO = require('socket.io')
const path = require('path')
const bodyParser = require('body-parser')
const PORT = process.env.PORT || 3000
const app = express()
app.use(bodyParser.json({type: 'application/json'}))
var server = http.createServer(app)
server.listen(PORT, () => console.log(`Listening on ${ PORT }`))
const io = socketIO(server)
var queueArray = []
var robotConnected = false

// Triggered by a POST to /webhook 
app.post('/webhook', function (request, response) {
  console.log('Request headers: ' + JSON.stringify(request.headers))
  console.log('Request body: ' + JSON.stringify(request.body))
  console.log('')

  // An action is a string used to identify what tasks needs to be done
  // in fulfillment usally based on the corresponding intent.
  let action = request.body.result.action
  console.log('result action: ' + action)

  // Parameters are any entites that API.AI has extracted from the request.
  const parameters = request.body.result.parameters
  console.log('result parameters: ' + parameters)

  // Contexts are objects used to track and store conversation state and are identified by strings.
  const contexts = request.body.result.contexts
  console.log('result contexts: ' + contexts)
  console.log('')

  // Initialize JSON we will use to respond to API.AI.
  let responseJson = {}

  // A handler for each action defined in API.AI
  const actionHandlers = {

      // The default intent when a user invokes Fetchy
      // responseJson.speech is the text read to the user my Google Assistant
      // responseJson.displayText is the text displayed to the user on Google Assistant
      // response.json(responseJson) is the response sent to API.AI
      'input.welcome': () => {
          responseJson.speech = 'Hello! My name is Fetchy'
          responseJson.displayText = 'Hello! My name is Fetchy'
          response.json(responseJson)
      },
      // An intent to send Fetchy a request
      // Parameters from dialogflow are unpacked, and packed into a new object-
      // -to be sent back to Dialogflow, to Fetchy and put into the request queue (queueArray)
      // io.emit('request', responseJson); is used to send the request to Fetchy
      'bring.object': () => {
          let color = parameters['color']
          let object = parameters['object']
          if (object === 'cup') {
              responseJson.timestamp = new Date()
              responseJson.action = action
              responseJson.object = object
              responseJson.color = color
              responseJson.speech = `Bringing the ${ color } ${ object }.`
              responseJson.displayText = `Bringing the ${ color } ${ object }.`

              addToRequestQueue(responseJson)
              io.emit('request', responseJson)

          } else {
              console.log(`Unrecognised object in request: ${ object }`)
              responseJson.speech = `Unrecognised object: ${ object }. I can not perform the request`
              responseJson.displayText = `Unrecognised object: ${ object }. I can not perform the request`
          }

          response.json(responseJson)

      },
      // The default intent when an action has not been defined in the user input
      // This executes whenever a user makes a request or says something that dooesnt-
      // match a dialogflow intent
      'default': () => {
          responseJson.speech = 'Sorry, I dont understand what you said. Please repeat the request'
          responseJson.displayText = 'Sorry, I dont understand what you said. Please repeat the request'
          response.json(responseJson)

          // Optional: add rich messages for Google Assistant, Facebook and Slack defined below.
          // Uncomment next line to enable. See https://api.ai/docs/rich-messages for more.
          //responseJson.data = richResponses;

          // Optional: add outgoing context(s) for conversation branching and flow control.
          // Uncomment next 2 lines to enable. See https://api.ai/docs/contexts for more.
          //let outgoingContexts = [{"name":"weather", "lifespan":2, "parameters":{"city":"Rome"}}];
          //responseJson.contextOut = outgoingContexts;
      },
      // An intent to remove the first request in the request queue
      // queueArray contains an ordered list of requests for Fetchy to perform
      'cancel.request': () => {
           if (queueArray[0] == null) {
               console.log('No requests to abort')
               responseJson.speech = 'No requests to abort'
               responseJson.displayText = 'No requests to abort'
               response.json(responseJson)
           }
           else {
               responseJson.speech = 'I am aborting'
               responseJson.displayText = 'I am aborting'
               response.json(responseJson)
               abortRequest()
               io.emit('abort')
          }
      },
      // An intent to remove the all requests in the request queue
      'cancel.allrequests': () => {
          if (queueArray[0] == null) {
              console.log('No requests to abort')
              responseJson.speech = 'No requests to abort'
              responseJson.displayText = 'No requests to abort'
              response.json(responseJson)
            }
            else {
                responseJson.speech = 'I am aborting'
                responseJson.displayText = 'I am aborting'
                response.json(responseJson)
                abortAllRequests()
                io.emit('abort_all')
            }  
      }
  }

  // Checks if Fetchy is connected to the service
  // If Fetchy is not connected, the request will not be processed by the action handlers
  if (robotConnected == false) {
      console.log('Fetchy is not connected')
      console.log(' ')
      responseJson.speech = 'Fetchy is not connected or initialised, please connect Fetchy'
      responseJson.displayText = 'Fetchy is not connected or initialised, please connect Fetchy'
      response.json(responseJson)
  }
  else {
      // If the action is not handled by one of our defined action handlers
      // use the default action handler
      if (!actionHandlers[action]) {
          action = 'default'
        }
        // Matches the action to a action handler
        actionHandlers[action]()
    }

})

function addToRequestQueue (resp){
    resp = JSON.stringify(resp)
    console.log(`adding to request queue: ${ resp }`)
    queueArray = queueArray.concat(resp)
    console.log(`item added to queueArray: ${ queueArray }`)
    console.log('')
}

function abortRequest (){
    console.log(`removing request: ${ queueArray[0] }`)
    queueArray.shift()
    console.log(`current items in queueArray after abort: ${ queueArray }`)
    console.log('')
}

function abortAllRequests (){
    console.log('removing all requests')
    queueArray = []
    console.log(`current items in queueArray after abort all requests: ${ queueArray }`)
    console.log('')
}

function requestCompletion (){
    console.log(`Fetchy completed: ${ queueArray[0] }`)
    queueArray.shift()
    console.log('request removed')
    console.log(`current items in queueArray: ${ queueArray }`)
    console.log('')
  }

//io.on('connection', (socket) => {
io.on('connection', function(socket){
  console.log('Client connected')
  robotConnected = true

  socket.on('request_completed', () => {
      console.log('Fetchy completed a request'),
      requestCompletion()
      })
  socket.on('disconnect', () => {
      console.log('Client disconnected')
      robotConnected = false
    })
})