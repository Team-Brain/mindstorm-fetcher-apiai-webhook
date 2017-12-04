'use strict'

const http = require('http')
const express = require('express')
const socketIO = require('socket.io')
const path = require('path')
const bodyParser = require('body-parser')
const PORT = process.env.PORT || 3000
const app = express()
app.use(bodyParser.json({ type: 'application/json' }))
const server = http.createServer(app)
server.listen(PORT, () => console.log(`Listening on ${PORT}`))
const io = socketIO(server)

// Ordered list of requests for Fetchy to perform
var requestQueue = []
// 
var robotConnected = true
//var robotConnected = false

// Triggered by a POST to /webhook 
app.post('/webhook', (request, response) => {
    console.log('Request headers: ' + JSON.stringify(request.headers))
    console.log('Request body: ' + JSON.stringify(request.body))
    console.log('')

    // An action is a string used to identify what tasks needs to be done
    // in fulfillment usally based on the corresponding intent.
    let action = request.body.result.action
    console.log('result action: ' + action)

    // Parameters are any entites that API.AI has extracted from the request.
    const parameters = request.body.result.parameters
    console.log('result parameters: ' + JSON.stringify(parameters))

    // Contexts are objects used to track and store conversation state and are identified by strings.
    const contexts = JSON.stringify(request.body.result.contexts)
    console.log('result contexts: ' + contexts)
    console.log('')

    // responseJSON is used to send back to dialogflow
    // requestJSON is used to send the request to the robot
    let responseJson = {}
    let requestJson = {}

    // A handler for each action defined in API.AI
    const actionHandlers = {

        // The default intent when a user invokes Fetchy
        'welcome': () => {
            responseJson.speech = 'Hello! My name is Fetchy'
            responseJson.displayText = 'Hello! My name is Fetchy'
            response.json(responseJson)
        },
        // An intent to send Fetchy a request
        // The first if checks if the robot is connected and notifies the user if it is not connected
        // Parameters from dialogflow are unpacked, and packed into a new object-
        // -to be sent back to Dialogflow, to Fetchy and put into the request queue (requestQueue)
        // io.emit('request', responseJson); is used to send the request to Fetchy , and by cups i actually mean boxes
        'bring_object': () => {
            if (!robotConnected) {
                sendNotConnected()
                return
            }

            let color = parameters['color']
            let object = parameters['object']
            if (object === 'cup') {
                responseJson.speech = `Bringing the ${color} ${object}.`
                responseJson.displayText = `Bringing the ${color} ${object}.`

                requestJson.action = action
                requestJson.color = color
                requestJson.object = object
                requestJson.timestamp = new Date()

                addToRequestQueue(requestJson)
                io.emit('task', requestJson)

            } else {
                console.log(`Unrecognised object in request: ${object}`)
                responseJson.speech = `I do not understand your requested object. I can only fetch cups, and by cups i actually mean boxes`
                responseJson.displayText = `I do not understand your requested object. I can only fetch cups, and by cups i actually mean boxes`
            }

            response.json(responseJson)

        },
        // An intent to tell the user what he is capable of
        'abilities': () => {
            responseJson.speech = 'I can fetch you items, for example. I can fetch a red box, or a black box, potentially even a green box. please do not ask me to fetch a blue box, my crappy sensor can not sense it'
            responseJson.displayText = 'I can fetch you items, for example. I can fetch a red box, or a black box, potentially even a green box. please do not ask me to fetch a blue box, my crappy sensor can not sense it'
            response.json(responseJson)
        },
        // An intent to tell the users his purpose
        'purpose': () => {
            responseJson.speech = 'I fetch coffee.... OH MY GOD'
            responseJson.displayText = 'I fetch coffee.... OH MY GOD'
            response.json(responseJson)
        },
        // The default intent when an action has not been defined in the user input
        // This executes whenever a user makes a request or says something that dooesnt-
        // match a dialogflow intent 
        'default': () => {
            responseJson.speech = 'Sorry, I dont understand what you said. Please repeat the request'
            responseJson.displayText = 'Sorry, I dont understand what you said. Please repeat the request'
            response.json(responseJson)
        },
        // An intent to remove the first request in the request queue
        'cancel_current': () => {
            if (!robotConnected) {
                sendNotConnected()
                return
            }
            if (requestQueue[0] == null) {
                console.log('No requests to abort')
                responseJson.speech = 'There are no requests to abort'
                responseJson.displayText = 'There are no requests to abort'
                response.json(responseJson)
            } else {
                //abortRequest()
                responseJson.speech = `I am aborting the current request`
                responseJson.displayText = `I am aborting the current request`
                response.json(responseJson)
                io.emit('abort')
            }
        },
        // An intent to remove the all requests in the request queue
        'cancel_all': () => {
            if (!robotConnected) {
                sendNotConnected()
                return
            }
            if (requestQueue[0] == null) {
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

    // If the action is not handled by one of our defined action handlers
    // use the default action handler
    if (!actionHandlers[action]) {
        action = 'default'
    }
    // Matches the action to a action handler
    actionHandlers[action]()

    function sendNotConnected() {
        let responseJson = {}
        console.log('Fetchy is not connected')
        console.log(' ')
        responseJson.speech = 'Fetchy is not connected or initialised, please connect Fetchy'
        responseJson.displayText = 'Fetchy is not connected or initialised, please connect Fetchy'
        response.json(responseJson)
    }

})

function addToRequestQueue(request) {
    request = JSON.stringify(request)
    console.log(`adding to request queue: ${request}`)
    requestQueue = requestQueue.concat(request)
    console.log(`current items in requestQueue after add: ${requestQueue}`)
    console.log('')
}

function abortRequest() {
    console.log(`removing request: ${requestQueue[0]}`)
    requestQueue.shift()
    console.log(`current items in requestQueue after abort: ${requestQueue}`)
    console.log('')
    return
}

function abortAllRequests() {
    console.log('removing all requests')
    requestQueue = []
    console.log(`current items in requestQueue after abort all requests: ${requestQueue}`)
    console.log('')
}

function finishedTask() {
    console.log(`Fetchy finished task: ${requestQueue[0]}`)
    requestQueue.shift()
    console.log('request removed')
    console.log(`current items in requestQueue: ${requestQueue}`)
    console.log('')
}


io.on('connection', (socket) => {
    console.log('Client connected')
    robotConnected = true

    socket.on('task_finished', () => {
        console.log('Fetchy completed a request')
        finishedTask()
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected')
        //robotConnected = false
    })
})