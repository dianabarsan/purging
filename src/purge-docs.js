







export const purgeDoc = async (doc, db) => {
  const url = getUrl(`/${db}/_purge`);
  const body = { [doc._id]: [doc._rev] };
  await request({ url, body, method: 'POST' });

  await purgeInfoDoc(doc._id);
  await purgeFromPurgeDbs(doc._id);
  if (doc.type === 'data_record') {
    await purgeTasks(doc._id);
  }
};






