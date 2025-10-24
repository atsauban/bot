// Mengimpor modul di bawah ini akan mendaftarkan command ke registry via side-effect
import './ping.js';
import './status.js';
import './stiker.js';
import './weather.js';
import './ascii.js';
import './game.js';
import './group.js';
import './reminder.js';
import './spam.js';
import './ai.js';
import './help.js';
import './numeric.js';

export { registerCommand, findCommand } from './registry.js';
