#!/usr/bin/env node

import * as getArgs from '../src/args.js';
import * as fetch from '../src/fetch.js';
import * as getIds from '../src/get-ids.js';

const url = getArgs.getUrl(process.argv);
fetch.init(url);

const inputPath = getArgs.getInputPath(process.argv);
(async () => {
  const idsToPurge = await getIds.input(inputPath);
  for (const [database, uuids] of Object.entries(idsToPurge)) {
    await fetch.purgeDocs(uuids, database);
  }
})();
