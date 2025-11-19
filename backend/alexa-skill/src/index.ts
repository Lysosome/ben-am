import { SkillBuilders } from 'ask-sdk-core';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { AudioPlayerEventHandler } from './handlers/AudioPlayerEventHandler';
import { PlayTodaysSongHandler } from './handlers/PlayTodaysSongHandler';
import { ReviewIntentHandler, CaptureReviewHandler, NoReviewHandler } from './handlers/ReviewHandler';

/**
 * Main entry point for Ben AM Alexa Skill
 * Handles wake-up music playback, DJ messages, and review capture
 */

// Error handler
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: any, error: Error) {
    console.error('Error handled:', error);
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
    AudioPlayerEventHandler,
    ReviewIntentHandler,
    CaptureReviewHandler,
    NoReviewHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
