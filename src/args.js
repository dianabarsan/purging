import fs from 'node:fs';

export const getUrl = (args) => {
  const prefix = '--url=';
  const arg = args.find(arg => arg.startsWith(prefix));
  if (!arg) {
    throw new Error('--url argument is required.');
  }
  const urlString = arg.replace(prefix, '');
  try {
    return new URL(urlString);
  } catch (err) {
    throw new Error('--url argument is invalid');
  }
};

export const getInputPath = (args) => {
  const prefix = '--input=';
  const arg = args.find(arg => arg.startsWith(prefix));
  if (!arg) {
    throw new Error('--input argument is required.');
  }
  const filePath = arg.replace(prefix, '');
  if (!fs.existsSync(filePath)) {
    throw new Error('--input argument points to a file that does not exist.');
  }
  return filePath;
};

export const getOutputPath = (args) => {
  const prefix = '--output=';
  const arg = args.find(arg => arg.startsWith(prefix));
  if (!arg) {
    throw new Error('--output argument is required.');
  }
  const filePath = arg.replace(prefix, '');
  if (fs.existsSync(filePath) && fs.readdirSync(filePath).length) {
    throw new Error('--output argument location is not empty.');
  }
  return filePath;
};
