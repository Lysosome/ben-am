import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

/**
 * SessionEndedRequestHandler - Handles session end events
 * Required to avoid "Unable to find a suitable request handler" errors
 */
export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput: HandlerInput): Response {
    // Log the reason for session end (if available)
    const request = handlerInput.requestEnvelope.request as any;
    console.log('Session ended:', request.reason || 'Unknown reason');
    
    // Return empty response - SessionEndedRequest doesn't need a response
    return handlerInput.responseBuilder.getResponse();
  },
};
