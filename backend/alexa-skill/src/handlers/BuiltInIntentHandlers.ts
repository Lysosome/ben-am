import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';

/**
 * AudioPlayer Event Handlers
 * These handle AudioPlayer lifecycle events sent by Alexa when audio is playing
 */

/**
 * AudioPlayerEventHandler - Handles all AudioPlayer events
 * PlaybackStarted, PlaybackFinished, PlaybackStopped, PlaybackNearlyFinished, PlaybackFailed
 */
export const AudioPlayerEventHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  handle(handlerInput: HandlerInput): Response {
    const requestType = handlerInput.requestEnvelope.request.type;
    console.log(`AudioPlayer event: ${requestType}`);
    
    // For most AudioPlayer events, we just acknowledge them
    // No speech output is needed (and not allowed for some events)
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * SystemExceptionHandler - Handles System.ExceptionEncountered events
 */
export const SystemExceptionHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'System.ExceptionEncountered';
  },
  handle(handlerInput: HandlerInput): Response {
    const request = handlerInput.requestEnvelope.request as any;
    console.log('System.ExceptionEncountered:', JSON.stringify(request.error, null, 2));
    console.log('Cause:', JSON.stringify(request.cause, null, 2));
    
    // Cannot return a response with speech for this request type
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * PauseIntentHandler - Pauses audio playback
 */
export const PauseIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.PauseIntent';
  },
  handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .getResponse();
  },
};

/**
 * ResumeIntentHandler - Resumes audio playback
 * Note: Resume is limited because S3 pre-signed URLs expire
 */
export const ResumeIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.ResumeIntent';
  },
  handle(handlerInput: HandlerInput): Response {
    const context = handlerInput.requestEnvelope.context;
    const audioPlayer = context.AudioPlayer;
    
    if (audioPlayer && audioPlayer.token && audioPlayer.offsetInMilliseconds !== undefined) {
      // Resume is not fully supported due to S3 pre-signed URL limitations
      // User should restart the skill instead
      return handlerInput.responseBuilder
        .speak('Sorry, resume is not supported yet. Please say "Alexa, open Ben AM" to restart.')
        .withShouldEndSession(true)
        .getResponse();
    }
    
    return handlerInput.responseBuilder
      .speak('Nothing to resume.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

/**
 * StopAndCancelIntentHandler - Stops playback and ends session
 */
export const StopAndCancelIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && ((request as IntentRequest).intent.name === 'AMAZON.StopIntent'
        || (request as IntentRequest).intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .speak('Goodbye!')
      .addAudioPlayerStopDirective()
      .withShouldEndSession(true)
      .getResponse();
  },
};

/**
 * HelpIntentHandler - Provides help information
 */
export const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput: HandlerInput): Response {
    const speakOutput = 'Ben AM plays your daily wake-up song picked by your friends. ' +
      'You can say "skip" to jump to the DJ message, or "stop" to end. ' +
      'What would you like to do?';

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};
