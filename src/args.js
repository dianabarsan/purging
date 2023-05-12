import fs from 'node:fs';
const args = process.argv;

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

export const getFile = (args) => {
  const prefix = '--file=';
  const arg = args.find(arg => arg.startsWith(prefix));
  if (!arg) {
    throw new Error('--file argument is required.');
  }
  const filePath = arg.replace(prefix, '');
  if (!fs.existsSync(filePath)) {
    throw new Error('--file argument points to a file that does not exist.');
  }
  return filePath;
};

