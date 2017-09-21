// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').ApiAiApp;
const functions = require('firebase-functions');

// [START YourAction]
exports.apiaiFetchyFulfillment = functions.https.onRequest((request, response) => {
    const app = new App({request, response});
    console.log('Request headers: ' + JSON.stringify(request.headers));
    console.log('Request body: ' + JSON.stringify(request.body));

    // An action is a string used to identify what tasks needs to be done
    // in fulfillment usally based on the corresponding intent.
    // See https://api.ai/docs/actions-and-parameters for more.
    let action = request.body.result.action;

    // Parameters are any entites that API.AI has extracted from the request.
    // See https://api.ai/docs/actions-and-parameters for more.
    const parameters = request.body.result.parameters;

    // Contexts are objects used to track and store conversation state and are identified by strings.
    // See https://api.ai/docs/contexts for more.
    const contexts = request.body.result.contexts;

    // Initialize JSON we will use to respond to API.AI.
    let responseJson = {};

    // Create a handler for each action defined in API.AI
    // and a default action handler for unknown actions
    const actionHandlers = {
        'input.welcome': () => {
            // The default welcome intent has been matched, Welcome the user.
            // Define the response users will hear
            responseJson.speech = 'Hello! My name is Fetchy';
            // Define the response users will see
            responseJson.displayText = 'Hello! My name is Fetchy';
            // Send the response to API.AI
            response.json(responseJson)
        },
        'bring.object': () => {
            if (parameters['object'] === 'cup') {
                responseJson.speech = 'No problem';
                responseJson.displayText = 'No problem';
            } else {
                responseJson.speech = 'Cant do';
                responseJson.displayText = 'Cant do';
            }
            // Send the response to API.AI
            response.json(responseJson)
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

    // If the action is not handled by one of our defined action handlers
    // use the default action handler
    if (!actionHandlers[action]) {
        action = 'default';
    }

    // Map the action name to the correct action handler function and run the function
    actionHandlers[action]();


});

// [END YourAction]