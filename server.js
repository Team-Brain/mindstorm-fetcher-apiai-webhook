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

// Ordered list of requests for the robot to perform
var taskQueue = []

app.post('/api/v1/webhook', (request, response) => {

    let action = request.body.result.action
    console.log('Request action: ' + action)
    const parameters = request.body.result.parameters

    // Response to Dialogflow
    let responseJson = {}
    // Task data to the robot
    let taskJson = {}

    const actionHandlers = {

        'bring_object': () => {
            let color = parameters['color']
            let object = parameters['object']
            if (object === 'box') {
                responseJson.speech = `Bringing the ${color} ${object}.`
                responseJson.displayText = `Bringing the ${color} ${object}.`

                taskJson.action = action
                taskJson.color = color
                taskJson.object = object
                taskJson.timestamp = new Date()

                // Generate unique id by hashing the object
                var requestStringed = JSON.stringify(taskJson)
                var hash_id = crypto.createHash('md5').update(requestStringed).digest('hex');
                taskJson.id = hash_id

                console.log(`Add task to task queue: ${JSON.stringify(taskJson)}`)
                taskQueue.push(taskJson)
                console.log(`Items in the queue: ${JSON.stringify(taskQueue)}`)
                
                emitTask()

            } else {
                console.log(`Unrecognised object in request: ${object}`)
                responseJson.speech = `I do not understand your requested object. I can only fetch boxes`
                responseJson.displayText = `I do not understand your requested object. I can only fetch boxes`
            }

            response.json(responseJson)

        },

        'queue_contents': () => {
            var queueContentString = queueContents()
            responseJson.speech = queueContentString
            responseJson.displayText = queueContentString
            response.json(responseJson)
        },

        'cancel_current': () => {
            if (taskQueue[0] == null) {
                console.log('No requests to abort')
                responseJson.speech = 'There are no requests to abort'
                responseJson.displayText = 'There are no requests to abort'
            } else {
                responseJson.speech = `I am aborting the current request`
                responseJson.displayText = `I am aborting the current request`
                io.emit('abort')
            }
            response.json(responseJson)
        },

        'cancel_all': () => {
            if (taskQueue[0] == null) {
                console.log('No requests to abort')
                responseJson.speech = 'No requests to abort'
                responseJson.displayText = 'No requests to abort'
            } else {
                responseJson.speech = 'I am aborting all requests'
                responseJson.displayText = 'I am aborting all requests'

                taskQueue = []
                io.emit('abort')
            }
            response.json(responseJson)            
        },

        'default': () => {
            responseJson.speech = 'Sorry, I dont understand what you said. Please repeat the request'
            responseJson.displayText = 'Sorry, I dont understand what you said. Please repeat the request'
            response.json(responseJson)
        }
    }

    if (!actionHandlers[action]) {
        action = 'default'
    }

    actionHandlers[action]()

})

function queueContents() {
    var noOfTasks = taskQueue.length
    if (noOfTasks > 0) {
        var contentString = `The number of tasks in the queue is ${noOfTasks}, the tasks are: `
        for (let index = 0; index < taskQueue.length; ++index) {
            let task = taskQueue[index];
            contentString = contentString.concat(`${task.color} ${task.object}, `)
        }
        return contentString
    }
    return "There are no requests in the queue"
}

function finishedTask(taskId) {
    if (taskQueue.length != 0 && taskId == taskQueue[0].id) {
        console.log(`Fetchy finished task: ${JSON.stringify(taskQueue[0])}`)
        taskQueue.shift()
        console.log(`Items in the taskQueue: ${JSON.stringify(taskQueue)}`)
    } else {
        console.log('Finished task ids do not match')
        // Ignore
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