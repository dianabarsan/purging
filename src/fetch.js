import fetch from 'node-fetch';

let serverUrl;
let purgeDbs;
const PURGE_BATCH_SIZE = 100;
const COLD_STORAGE_DB = 'medic-cold-storage';

export const MEDIC_DB_NAME = 'medic';
export const SENTINEL_DB_NAME = `medic-sentinel`;
const NOT_FOUND_STATUS = 404;

export const init = (url) => {
  serverUrl = url;
  serverUrl.pathname = '/';
};

class HTTPResponseError extends Error {
  constructor(response, responseData) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`);
    this.response = responseData;
    this.status = response.status;
  }
}

const getResponseData = (response, json) => json ? response.json() : response.text();

const stringifyParam = (key, value) => {
  if (key.startsWith('start') || key.startsWith('end') || key.startsWith('doc_ids')) {
    return JSON.stringify(value);
  }
  return value;
};
const getUrl = (path, searchParams) => {
  const url = new URL(serverUrl.toString());

  url.pathname = path;

  const params = new URLSearchParams(url.search);
  searchParams && Object.entries(searchParams).forEach(([key, value]) => params.set(key, stringifyParam(key, value)));
  url.search = params.toString();

  url.username = '';
  url.password = '';
  return url.toString();
};
export const request = async ({ url, json = true, ...moreOpts }) => {
  const opts = { ...moreOpts };
  opts.headers = opts.headers || {};
  opts.headers.Authorization =
    `Basic ${Buffer.from(serverUrl.username + ':' + serverUrl.password, 'binary').toString('base64')}`;
  if (json) {
    opts.headers = {
      ...opts.headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (opts.body) {
      opts.body = JSON.stringify(opts.body);
    }
  }

  const response = await fetch(url, opts);
  if (!response.ok) {
    let responseData;
    try {
      responseData = await getResponseData(response, json);
    } catch (err) {
      responseData = response;
    }
    throw new HTTPResponseError(response, responseData);
  }

  return getResponseData(response, json);
};

export const getDoc = async (uuid, db = MEDIC_DB_NAME) => {
  try {
    return await request({ url: getUrl(`/${db}/${uuid}`)  });
  } catch (err) {
    if (err.status === NOT_FOUND_STATUS) {
      return;
    }
    throw err;
  }
};

export const getDocRevs = async (uuids, db) => {
  const url = getUrl(
    `/${db}/_changes`,
    { doc_ids: uuids, style: 'all_docs', filter: '_doc_ids', include_docs: 'true', attachments: 'true' }
  );
  const changes = await request({ url });
  const revs = {};
  const docs = {};
  changes.results.forEach(change => {
    revs[change.id] = change.changes.map(change => change.rev);
    docs[change.id] = change.changes.map(change => change.doc);
  });
  return { revs, docs };
};

export const getPurgeDatabases = async () => {
  if (purgeDbs) {
    return purgeDbs;
  }
  const query = { start_key: `${MEDIC_DB_NAME}-purged-role-`, end_key: `${MEDIC_DB_NAME}-purged-role-\ufff0` };
  purgeDbs = await request({ url: getUrl('/_all_dbs', query) });
  return purgeDbs;
};

export const getTombstones = async (uuid) => {
  const url = getUrl(`${MEDIC_DB_NAME}/_all_docs`, { start_key: `${uuid}_`, end_key: `${uuid}_/ufff0` });
  const response = await request({ url });
  return response.rows.map(row => row.id);
};

const createMangoIndex = async () => {
  const url= getUrl(`/${MEDIC_DB_NAME}/_index`);
  const body = {
    index: {
      fields: ['emission._id', 'type'],
    },
    name: 'task-by-source-index',
    type: 'json'
  };
  await request({ url, body, method: 'POST' });
};

export const getTasks = async (uuid) => {
  await createMangoIndex();
  const url = getUrl(`/${MEDIC_DB_NAME}/_find`);
  const body = {
    selector: {
      type: 'task',
      'emission.id': {
        '$gt': uuid,
        '$lt': `${uuid}\ufff0`,
      }
    }
  };
  const result = await request({ url, body, method: 'POST'});
  return result.docs;
};

const backupDocs = async (docs, database) => {
  const docsToSave = [];
  Object.values(docs).forEach((docs) => {
    docsToSave.push(...docs.map(doc => {
      doc._id = `${database}:${doc._id}:${doc._rev}`;
      delete doc._rev;
      return doc;
    }));
  });
  await request({
    url: getUrl(`/${COLD_STORAGE_DB}/_bulk_docs`),
    method: 'POST',
    body: { docs: docsToSave },
  });
};

export const purgeDocs = async (uuids, database) => {
  while (uuids.length) {
    const batch = uuids.splice(0, PURGE_BATCH_SIZE);
    const { revs, docs } = await getDocRevs(batch, database);

    await backupDocs(docs, database);

    const url = getUrl(`/${database}/_purge`);
    await request({ url, method: 'POST', body: revs });
  }
};
