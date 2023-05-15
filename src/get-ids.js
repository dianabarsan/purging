import fs from 'node:fs';
import * as readline from 'readline';
import * as fetch from './fetch.js';
import path from 'path';

export const getDocsToPurge = async (uuid) => {
  const docsToPurge = [];
  const doc = await fetch.getDoc(uuid);
  if (!doc) {
    return docsToPurge;
  }

  if (doc.type === 'tombstone') {
    uuid = uuid.split('____')[0];
  }

  const purgeDatabases = await fetch.getPurgeDatabases();
  docsToPurge.push(
    [fetch.MEDIC_DB_NAME, uuid],
    [fetch.SENTINEL_DB_NAME, `${uuid}-info`],
    ...purgeDatabases.map(db => [db, `purged:${uuid}`]),
    ...(await fetch.getTombstones(uuid)).map(id => [fetch.MEDIC_DB_NAME, id]),
  );

  if (doc.type === 'data_record') {
    const tasks = await fetch.getTasks(uuid);
    docsToPurge.push(...tasks.map(taskDoc => [fetch.MEDIC_DB_NAME, taskDoc._id]));
  }

  return docsToPurge;
};

const addToCollection = (collection, [database, uuid]) => {
  if (!collection[database]) {
    collection[database] = [];
  }
  collection[database].push(uuid);
};

const processLine = async (collection, line) => {
  const items = await getDocsToPurge(line);
  items.forEach(item => addToCollection(collection, item));
};

const readIdsFromFile = async (filePath, processLine) => {
  let promise = Promise.resolve();
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  rl.on('line', (line) => promise = promise.then(() => processLine(line)));

  await new Promise((resolve, reject) => {
    rl.on('error', reject);
    rl.on('close', () => promise.then(resolve));
  });
};

export const getIds = async (filePath) => {
  const collection = {};
  await readIdsFromFile(filePath, processLine.bind({}, collection));

  return collection;
};

export const output = async (filePath, collection) => {
  try {
    await fs.promises.mkdir(filePath);
  } catch (err) {
    await fs.promises.rm(filePath, { recursive: true });
    await fs.promises.mkdir(filePath);
  }
  for (const [database, docIds] of Object.entries(collection)) {
    await fs.promises.writeFile(path.join(filePath, database + '.csv'), docIds.join('\n'));
  }
};

export const input = async (filePath) => {
  const collection = {};
  for (const database of await fs.promises.readdir(filePath)) {
    const dbName = database.replace('.csv', '');
    collection[dbName] = [];
    const processLine = (line) => collection[dbName].push(line);
    await readIdsFromFile(path.join(filePath, database), processLine);
  }
  return collection;
};
