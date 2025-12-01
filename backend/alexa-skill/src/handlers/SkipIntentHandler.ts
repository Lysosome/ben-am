import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';

/**
 * SkipIntentHandler - Handles "Alexa, skip" during playback
 * With SSML <audio> tags, we can't skip mid-playback, so this just ends the session
 */
export const SkipIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.NextIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    return handlerInput.responseBuilder
      .speak('Okay, stopping playback. Have a great day!')
      .withShouldEndSession(true)
      .getResponse();
  },
};
