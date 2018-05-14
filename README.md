# node-intelHex

An asynchronous, promise-based, reader/writer module for Intel Hex files

# Usage

```
const intelHex = require('node-intelhex');
```

## readHexFile(filename, progress, info);

Reads "filename" asynchronously, returns a promise that resolves when complete, or rejects if there's an error.

The optional progress callback takes a percentage as input.

The optional info callback receives interesting messages about what is encountered in the file.  Mostly for debug purposes.

```
intelHex
    .readHexFile(
        'test/test.hex',
        progress =>
            process.stdout.write('\r          \r' + progress + '%'),
        info => {
            console.log('\r' + info + '\n');
        }
    )
    .then(result => {
//      {
//          address: <address first byte in file>, 
//          buffer: <bytes read from file>
//      }
    })
    .catch(error => {
        // handle error
    });
```
## writeHexFile(filename, address, data, progress)

Writes the buffer in "data" to file "filename", with starting address "address".

Returns a promise that resolves on completion (after flushing) or rejects on error.

The optional progress callback takes a percentage as input.

```
intelHex
    .writeHexFile('test/test.out.hex', address, data)
    .then(() => {
        // all done
    })
    .catch(error => {
        // handle error (mostly like from fs)
    });
```

## setLineBytes(mlb)

Set the number of bytes per line to mlb.  Default is 32.

## binaryBufferReader(data)

Returns an object that produces intel hex lines one at a time until complete.

```
// create reader
let br = intelHex.binaryBufferReader(data);

// pull next record string
br.getNextRecord()

// end of buffer?
br.eof()

// length of buffer
br.length()

// num bytes read
br.bytesRead()

## binaryFileReader(filename)

shortcut to read a file into a buffer and create a binaryBufferReader from it

