import fs from 'node:fs';
import * as readline from 'readline';
import * as events from 'events';
import * as fetch from './fetch.js';

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

export const getIdsToPurge = async (filePath) => {
  const collection = {};
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  rl.on('line', async (line) => {
    const items = await getDocsToPurge(line);
    items.forEach(item => addToCollection(collection, item));
  });

  await events.once(rl, 'close');
  console.log("?????");
  console.log(JSON.stringify(collection, null, 2));
};
