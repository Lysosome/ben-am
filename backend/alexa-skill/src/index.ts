import { SkillBuilders } from 'ask-sdk-core';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { PlayTodaysSongHandler } from './handlers/PlayTodaysSongHandler';
import { LeaveReviewIntentHandler, CaptureReviewIntentHandler, FallbackReviewHandler, NoReviewHandler } from './handlers/ReviewHandler';
import { SkipIntentHandler } from './handlers/SkipIntentHandler';
import { SessionEndedRequestHandler } from './handlers/SessionEndedRequestHandler';
import {
  AudioPlayerEventHandler,
  SystemExceptionHandler,
  PauseIntentHandler,
  ResumeIntentHandler,
  StopAndCancelIntentHandler,
  HelpIntentHandler
} from './handlers/BuiltInIntentHandlers';

/**
 * Main entry point for Ben AM Alexa Skill
 * 
 * Audio Flow:
 * 1. User triggers skill (LaunchRequest or PlayTodaysSongIntent)
 * 2. Skill fetches today's song from DynamoDB
 * 3. Skill plays combined audio via AudioPlayer (song + DJ message + optional review prompt)
 * 4. If review prompt was included, user can say "Alexa, leave a review" anytime after
 * 
 * Review Flow:
 * 1. User says "Alexa, leave a review" (LeaveReviewIntent - can be from idle)
 * 2. Skill asks "What's your one sentence review for [song] from [DJ]?"
 * 3. User speaks their review (CaptureReviewIntent with AMAZON.SearchQuery slot)
 * 4. Skill sends review text via email to the DJ
 */

// Error handler
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: any, error: Error) {
    const requestType = handlerInput.requestEnvelope.request.type;
    console.error(`Error handled for request type: ${requestType}`, error);
    return handlerInput.responseBuilder
      .speak('Sorry, there was an error. Please try again later.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

// Build and export the skill handler
export const handler = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PlayTodaysSongHandler,
    SkipIntentHandler,
    PauseIntentHandler,
    ResumeIntentHandler,
    StopAndCancelIntentHandler,
    HelpIntentHandler,
    LeaveReviewIntentHandler,
    CaptureReviewIntentHandler,
    FallbackReviewHandler,  // Must be after CaptureReviewIntentHandler to give it priority
    NoReviewHandler,
    AudioPlayerEventHandler,  // Handle AudioPlayer lifecycle events
    SystemExceptionHandler,   // Handle system exceptions
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
