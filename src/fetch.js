import fetch from 'node-fetch';
import { purgeDoc } from './purge-docs.js';

let serverUrl;
let purgeDbs;

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

const getUrl = (path, searchParams) => {
  const url = new URL(serverUrl.toString());

  url.pathname = path;

  const params = new URLSearchParams(url.search);
  searchParams && Object.entries(searchParams).forEach(([key, value]) => params.set(key, JSON.stringify(value)));
  url.search = params.toString();

  url.username = '';
  url.password = '';
  return url.toString();
};
export const request = async ({ url, json = true, ...moreOpts }) => {
  const opts = { ...moreOpts };
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = `Basic ${Buffer.from(serverUrl.username + ':' + serverUrl.password, 'binary').toString('base64')}`;
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

export const getPurgeDatabases = async () => {
  if (purgeDbs) {
    return purgeDbs;
  }
  purgeDbs = await request({
    url: getUrl('/_all_dbs', { start_key: `${MEDIC_DB_NAME}-purged-role-`, end_key: `${MEDIC_DB_NAME}-purged-role-\ufff0` }),
  });
  return purgeDbs;
};

export const purgeFromPurgeDbs = async (uuid) => {
  const dbs = await getPurgeDatabases();
  for (const db of dbs) {
    const doc = await getDoc(`purged:${uuid}`, db);
    if (doc) {
      await purgeDoc(doc, db);
    }
  }
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
