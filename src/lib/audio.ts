
/**
 * Audio utility functions for playing sound effects in the app
 */

// Sound effect instances
export const wooshSound = typeof Audio !== 'undefined' ? new Audio('/sounds/woosh.mp3') : null;
export const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

/**
 * Play a sound effect
 * @param sound - HTMLAudioElement to play
 */
export const playSound = (sound: HTMLAudioElement | null): void => {
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(err => console.error('Error playing sound:', err));
  }
};
