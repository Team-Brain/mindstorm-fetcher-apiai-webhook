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

const is_travis = process.env.TRAVIS === 'true'

// Ordered list of requests for Fetchy to perform
var taskQueue = []
// 
//var robotConnected = true
var robotConnected = false || is_travis
var performingRequest = false

// Triggered by a POST to /webhook 
app.post('/webhook', (request, response) => {
    //console.log('Request headers: ' + JSON.stringify(request.headers))
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
    //console.log('result contexts: ' + contexts)
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
        // -to be sent back to Dialogflow, to Fetchy and put into the request queue (taskQueue)
        // io.emit('task', responseJson)
        'bring_object': () => {
            console.log(`robot connected status: ${robotConnected}`)
            if (!robotConnected) {
                sendNotConnected()
                return
            }

            let color = parameters['color']
            let object = parameters['object']
            if (object === 'box') {
                responseJson.speech = `Bringing the ${color} ${object}.`
                responseJson.displayText = `Bringing the ${color} ${object}.`

                requestJson.action = action
                requestJson.color = color
                requestJson.object = object
                requestJson.timestamp = new Date()

                addToTaskQueue(requestJson)
                emitTask()

            } else {
                console.log(`Unrecognised object in request: ${object}`)
                responseJson.speech = `I do not understand your requested object. I can only fetch boxes`
                responseJson.displayText = `I do not understand your requested object. I can only fetch boxes`
            }

            response.json(responseJson)

        },
        // An intent to tell the user what he is capable of
        'abilities': () => {
            responseJson.speech = 'I can fetch you items, with the command, bring me my coloured object. for example. I can fetch a red box. you can abort my current request by saying, cancel my request, or you can abort all my request by saying, cancel all my requests. just please dont ask me about my purpose'
            responseJson.displayText = 'I can fetch you items, with the command, bring me my coloured object. for example. I can fetch a red box. you can abort my current request by saying, cancel my request, or you can abort all my request by saying, cancel all my requests. just please dont ask me about my purpose'
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
            if (taskQueue[0] == null) {
                console.log('No requests to abort')
                console.log(`Here is the task queue: ${taskQueue[0]}`)
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
            if (taskQueue[0] == null) {
                console.log('No requests to abort')
                responseJson.speech = 'No requests to abort'
                responseJson.displayText = 'No requests to abort'
                response.json(responseJson)
            }
            else {
                responseJson.speech = 'I am aborting all requests'
                responseJson.displayText = 'I am aborting all requests'
                response.json(responseJson)
                abortAllRequests()
                io.emit('abort')
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

function addToTaskQueue(request) {
    request = JSON.stringify(request)
    console.log(`adding to request queue: ${request}`)
    taskQueue = taskQueue.concat(request)
    console.log(`current items in taskQueue after add: ${taskQueue}`)
    console.log('')
}

// currently commented out
function abortRequest() {
    console.log(`removing request: ${taskQueue[0]}`)
    taskQueue.shift()
    console.log(`current items in taskQueue after abort: ${taskQueue}`)
    console.log('')
}

function abortAllRequests() {
    console.log('removing all requests')
    taskQueue = [taskQueue[0]]
    console.log(`current items in taskQueue after abort all requests: ${taskQueue}`)
    console.log('')
}

function finishedTask() {
    console.log(`Fetchy finished task: ${taskQueue[0]}`)
    taskQueue.shift()
    console.log('request removed')
    performingRequest = false
    console.log(`current items in taskQueue: ${taskQueue}`)
    emitTask()
    console.log('')
}

function emitTask() {
    if (performingRequest == false && taskQueue[0] != null) {
        io.emit('task', taskQueue[0])
        performingRequest == true
    }
}

io.on('connection', (socket) => {
    console.log('Client connected')
    console.log(`whats in socket: ${socket}`)
    robotConnected = true

    socket.on('task_finished', () => {
        console.log('Fetchy completed a request')
        finishedTask()
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected')
        taskQueue = []
        robotConnected = false
    })
})