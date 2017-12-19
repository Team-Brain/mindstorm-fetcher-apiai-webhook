'use strict'

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const crypto = require('crypto');

const path = require('path')
const bodyParser = require('body-parser')

const PORT = process.env.PORT || 3000
const is_staging = process.env.ENV === 'STAGING'

app.use(bodyParser.json({ type: 'application/json' }))

http.listen(PORT, () => console.log(`Listening on ${PORT}`))

// Ordered list of requests for Fetchy to perform
var taskQueue = []

// Triggered by a POST to /webhook 
app.post('/api/v1/webhook', (request, response) => {
    //console.log('Request headers: ' + JSON.stringify(request.headers))
    //console.log('Request body: ' + JSON.stringify(request.body))
    //console.log('')

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

        // An intent to send Fetchy a request
        // The first if checks if the robot is connected and notifies the user if it is not connected
        // Parameters from dialogflow are unpacked, and packed into a new object-
        // -to be sent back to Dialogflow, to Fetchy and put into the request queue (taskQueue)
        // io.emit('task', responseJson)
        'bring_object': () => {
            let color = parameters['color']
            let object = parameters['object']
            if (object === 'box') {
                responseJson.speech = `Bringing the ${color} ${object}.`
                responseJson.displayText = `Bringing the ${color} ${object}.`

                requestJson.action = action
                requestJson.color = color
                requestJson.object = object
                requestJson.timestamp = new Date()

                var requestStringed = JSON.stringify(requestJson)
                var hash_id = crypto.createHash('md5').update(requestStringed).digest('hex');
                requestJson.id = hash_id

                addToTaskQueue(requestJson)
                emitTask()

            } else {
                console.log(`Unrecognised object in request: ${object}`)
                responseJson.speech = `I do not understand your requested object. I can only fetch boxes`
                responseJson.displayText = `I do not understand your requested object. I can only fetch boxes`
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
        },
        // An intent to remove the first request in the request queue
        'cancel_current': () => {

            if (taskQueue[0] == null) {
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

                console.log('removing all requests')
                taskQueue = []
                console.log(`current items in taskQueue after abort all requests: ${JSON.stringify(taskQueue)}`)
                console.log('')

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
    console.log(`adding to request queue: ${JSON.stringify(request)}`)
    taskQueue.push(request)
    console.log(`current items in taskQueue after add: ${JSON.stringify(taskQueue)}`)
    console.log('')
}

function finishedTask(taskId) {
    if (taskQueue.length != 0 && taskId == taskQueue[0].id) {
        console.log(`Fetchy finished task: ${JSON.stringify(taskQueue[0])}`)
        taskQueue.shift()
        console.log(`request removed, current items in taskQueue: ${JSON.stringify(taskQueue)}`)
        console.log('')
    } else {
        console.log('wtf just happened')
    }
    emitTask()
}

function emitTask() {
    if (taskQueue.length != 0) {
        io.emit('task', taskQueue[0])
    }
}

io.on('connection', (socket) => {
    console.log('Client connected')
    emitTask()

    socket.on('task_finished', (taskId, ackFun) => {
        console.log('Fetchy completed a request')
        finishedTask(taskId)
        ackFun()
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected')
    })
})