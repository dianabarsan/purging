import * as getArgs from '../src/args.js';
import * as fetch from '../src/fetch.js';
import { getIdsToPurge } from '../src/get-ids-to-purge.js';

const url = getArgs.getUrl(process.argv);
fetch.init(url);

const file = getArgs.getFile(process.argv);
(async () => {
  await getIdsToPurge(file);
})();
