#!/usr/bin/env node

import * as getArgs from '../src/args.js';
import * as fetch from '../src/fetch.js';
import { getIds, output } from '../src/get-ids.js';

const url = getArgs.getUrl(process.argv);
fetch.init(url);

const inputFile = getArgs.getInputPath(process.argv);
const outputFile = getArgs.getOutputPath(process.argv);
(async () => {
  const results = await getIds(inputFile);
  await output(outputFile, results);
})();
