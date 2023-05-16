# Cold storage with `_purge`-ing

This script implements a solution for cold storage by using CouchDb `_purge`.
It takes a CSV or text file as an input. The file should have one document `_id` on each line. These documents should exist in the project's `medic` database.

One command will create a collection of document ids to be purged based on these rules:

- all leaf revisions of the document from `medic` database, including conflicted ones
- infodoc and outbound task from `medic-sentinel` db
- purged:doc entries from purging databases
- all tombstones
- if the document is a report, all tasks that have that document as a `source_id`

The collection of document ids is saved in a provided output path, in the format of one csv per database, each containing document ids to be purged from that database.
The list of ids to be purged can be inspected before proceeding to the actual purging command - which is destructive.

Another command will backup (create a copy of the document in a secondary database `medic-cold-storage`) and purge documents from the collection described above.

NB. The script uses a mango query (and a mango index) to get the list of tasks associated by `source_id` with a `data_record`. Depending on the size of the database, querying using this index for the first time can take a long time. The script has a command to create the index and make one query to speed up command execution.

NB. This script is tailored to the specific needs of Muso, and requirements are subject ot change.

## Installation

```
npm ci
```

## Usage

### create-index

Creates and queries Mango index used for `source_id` task searches.

Arguments:
##### `--url`
URL to API or CouchDb, including basic authentication

##### Example:
```shell
node ./bin/create-index.js --url=http://admin:pass@127.0.0.1:6984
```

### get-ids
Provided with a csv/text file containing list of document ids to be purged, outputs a collection of database-ids lists that can be inspected before the destructive operation of purging.

Arguments:
##### `--url`
URL to API or CouchDb, including basic authentication
#####  `--input`
csv or text document containing one document _id per line
##### `--output`
Path to a writable location. The action will create a new folder at the provided path. If the folder already exists, it should be empty.

##### Example:
```shell
node ./bin/get-ids.js --url=http://admin:pass@127.0.0.1:6984 --input=<path_to>/input.csv --output=<path_to>/out
```

Results:
```
- out
  - medic.csv
  - medic-sentinel.csv
  - medic-purged-role-xxxxx.csv
```

### purge
Provided with a collection of documents to purge generated by `get-ids`, saves a copy of every document in a separate database called `medic-cold-storage` and purges the document from the designated database.
The document saved in `medic-cold-storage` will use this `_id` format: `<database>:<doc._id>:<doc._rev>`.

Arguments:
##### `--url`
URL to API or CouchDb, including basic authentication
#####  `--input`
Path to the collection of documents generated by `get-ids` command.

##### Example:
```shell
node ./bin/purge.js --url=http://admin:pass@127.0.0.1:6984 --input=<path_to>/out
```
