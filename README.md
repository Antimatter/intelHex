# node-intelhex

An asynchronous, promise-based, reader/writer module for Intel Hex files for [node](http://nodejs.org).

  [![NPM Version][npm-image]][npm-url]
  [![NPM Downloads][downloads-image]][downloads-url]
  [![Linux Build][travis-image]][travis-url]
  [![Windows Build][appveyor-image]][appveyor-url]
  [![Test Coverage][coveralls-image]][coveralls-url]


# Installation
```bash
$ npm install node-intelhex
```
# Features
* Asynchronous using ES6 Promises
* High-level functions to transfer node Buffer objects to files and back
* Low-level functions to write/parse files a line at a time
# Usage
```js
const hex = require('node-intelhex');
```
## readFile(filename, options, callback~opt~)

Reads "filename" asynchronously, returns an object with a node Buffer along with the starting address.  If the file contains discontinuous data, gaps are filled with zeroes automatically.
```js
{
    data: Buffer,
    address: number
}
```

If no callback specified, returns a Promise

The "options" argument contains an object that can specify additional options:
```js
{
    progress: function,
    info: function
}
```
#### progress:
A callback to monitor progress.  Receives a number representing percentage complete.  Only called when percentage changes.
#### info:
A callback to receive informational messages during parsing.  Mostly for debug purposes.
### Example
```js
hex
    .readFile(
        'test/test.hex',
        {
            progress: percent => process.stdout.write('\r          \r' + percent + '%'),
            info: message => console.log('\r' + info + '\n')
        }
    )
    .then(result => {
//      {
//          address: <address of first byte in file>, 
//          buffer: <bytes read from file>
//      }
    })
    .catch(error => {
        // handle error
    });
```
## writeFile(filename, address, data, options, callback~opt~)

Writes the buffer in "data" to file "filename", with starting address "address".

Optional callback or Promise resolution on completion (after flushing).

The "options" argument contains an object that can specify additional options:
```js
{
    progress: function
}
```
#### progress:
A callback to monitor progress.  Receives a number representing percentage complete.  Only called when percentage changes.
### Example
```js
hex
    .writeFile('test/test.out.hex', address, data)
    .then(() => {
        // all done
    })
    .catch(error => {
        // handle error (mostly like from fs)
    });
```
## setLineBytes(num)
Set the number of bytes per line to num.  Default is 32.
## bufferReader(data)
Returns an object that takes a Buffer and starting address and produces Intel Hex lines one at a time until complete.
```js
// create reader
let br = hex.bufferReader(address, data);

// pull next record string
br.getNextRecord()

// end of buffer?
br.eof()

// length of buffer
br.length()

// num bytes read
br.bytesRead()

