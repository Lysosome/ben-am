import { CharTransformer } from './types';
import { getRandomChar, getRandomFromSet } from './utils';

/**
 * Transform to a dot character
 */
export const dotTransformer: CharTransformer = () => '.';

/**
 * Transform to a random printable ASCII character
 */
export const randomCharTransformer: CharTransformer = () => getRandomChar();

/**
 * Transform to a random Matrix-style character
 */
export const matrixTransformer: CharTransformer = () =>
  getRandomFromSet('ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ');

/**
 * Transform to a specific character
 */
export const specificCharTransformer = (char: string): CharTransformer => () => char;

/**
 * Transform to a random character from a custom set
 */
export const customSetTransformer = (chars: string): CharTransformer => () =>
  getRandomFromSet(chars);

/**
 * No transformation (returns original)
 */
export const identityTransformer: CharTransformer = (original) => original.char;
