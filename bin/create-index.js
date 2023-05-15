import * as fetch from '../src/fetch.js';
import * as getArgs from '../src/args.js';

const url = getArgs.getUrl(process.argv);
fetch.init(url);

(async () => {
  console.log('Creating mango index. This can take a long time');
  await fetch.createMangoIndex();
  await fetch.getTasks('random');
})();
