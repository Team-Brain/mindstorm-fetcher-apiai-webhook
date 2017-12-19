'use strict'

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const bodyParser = require('body-parser')
const path = require('path')
const crypto = require('crypto');

const PORT = process.env.PORT || 3000
const is_staging = process.env.ENV === 'STAGING'

app.use(bodyParser.json({ type: 'application/json' }))
http.listen(PORT, () => console.log(`Listening on ${PORT}`))

// Ordered list of requests for Fetchy to perform
var taskQueue = []

// Triggered by a POST to /webhook 
app.post('/api/v1/webhook', (request, response) => {

    console.log('Request body: ' + JSON.stringify(request.body))
    let action = request.body.result.action
    console.log('result action: ' + action)
    const parameters = request.body.result.parameters
    console.log('result parameters: ' + JSON.stringify(parameters))
    console.log('')

    // responseJSON is used to send back to dialogflow
    // requestJSON is used to send the request to the robot
    let responseJson = {}
    let requestJson = {}

    // A handler for each action defined in Dialogflow
    const actionHandlers = {

        // An intent to send send a response to Dialogflow, and put tasks into the taskQueue
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

                // unique id is created by stringifying the JSON object and hashing it
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
        // The default intent when an action has not been defined or understood in the user input
        'queue_contents': () => {
            var queueContentString = queueContents()
            responseJson.speech = `${queueContentString}`
            responseJson.displayText = `${queueContentString}`
            response.json(responseJson)
        },
        // The default intent when an action has not been defined or understood in the user input
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

                taskQueue = []
                console.log('removing all requests')
                console.log('')

                io.emit('abort')
            }
        }
    }

    if (!actionHandlers[action]) {
        action = 'default'
    }
    // Matches the action to a action handler
    actionHandlers[action]()

})

function queueContents() {
    var noOfTasks = taskQueue.length
    var contentString = `The queue contains ${noOfTasks} tasks, they are: `
    for (task in taskQueue) {
        contentString.concat(`${JSON.stringify(taskQueue.acion)} ${JSON.stringify(taskQueue.color)} ${JSON.stringify(taskQueue.object)}, `)
    }
    return contentString
}

function addToTaskQueue(request) {
    console.log(`adding task to task queue: ${JSON.stringify(request)}`)
    taskQueue.push(request)
    console.log(`current items in taskQueue after add: ${JSON.stringify(taskQueue)}`)
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
        ackFun()
        finishedTask(taskId)
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected')
    })
})