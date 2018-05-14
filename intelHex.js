const fs = require('fs-extra');
const ap = require('async-promise-wrapper');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

//////////  Encoding functions //////////

let MAXLINEBYTES = 32;

module.exports.setLineBytes = function(mlb) {
    MAXLINEBYTES = mlb;
};

function _bufferReader(address, data) {
    let ptr = address;
    let len = data.length;
    let endPtr = address + len;
    let extended_linear_address = 0;
    let eof = false;

    this.length = () => {
        return data.length;
    };

    this.eof = () => {
        return eof;
    };

    const hexString = (d, n) => {
        let h = Math.round(d).toString(16);
        while (h.length < n) {
            h = '0' + h;
        }
        return h;
    };

    const toRecord = bytes => {
        let line = ':';
        let cc = 0;

        for (let i = 0; i < bytes.length; i++) {
            line += hexString(bytes[i], 2);
            cc = (cc + bytes[i]) % 256;
        }

        cc = (256 - cc) % 256;
        line += hexString(cc, 2);
        return line;
    };

    this.bytesRead = () => {
        return ptr;
    };

    this.getNextRecord = () => {
        if (ptr >= endPtr) {
            eof = true;
            return ':00000001FF';
        }

        if (
            ptr < extended_linear_address * 65536 ||
            ptr >= (extended_linear_address + 1) * 65536
        ) {
            extended_linear_address = Math.floor(ptr / 65536);
            return toRecord([
                2,
                0,
                0,
                4,
                extended_linear_address >> 8,
                extended_linear_address & 0xff
            ]);
        }

        let count = Math.min(MAXLINEBYTES, endPtr - ptr);
        let bytes = [];

        bytes.push(count); // count
        bytes.push((ptr % 0x10000) >> 8); // address high byte
        bytes.push((ptr % 0x10000) & 0xff); // address low byte
        bytes.push(0); // data record type

        for (var i = 0; i < count; i++) {
            // data
            bytes.push(data[ptr - address + i]);
        }

        ptr += count;

        return toRecord(bytes);
    };
}

module.exports.binaryBufferReader = data => new _bufferReader(0, data);

module.exports.binaryFileReader = path => {
    return fs.readFile(path).then(data => new _bufferReader(0, data));
};

module.exports.writeHexFile = function(path, address, data, progress) {
    let br = new _bufferReader(address, data);
    let stream = fs.createWriteStream(path);

    let totalSize = br.length;
    let lastPercent = -1;

    return ap
        .doWhilst(() => {
            stream.write(br.getNextRecord() + '\r\n');
            if (progress) {
                var percent = Math.floor(br.bytesRead() * 100 / totalSize);

                if (percent != lastPercent) {
                    progress(percent);
                    lastPercent = percent;
                }
            }
            return Promise.resolve();
        }, () => !br.eof())
        .then(() => {
            return new Promise(resolve => {
                stream.end(resolve);
            });
        });
};

//////////  Decoding functions //////////

const Memory = require('./memory');

function _hexDecoder() {
    let mem = Memory();

    let position = {
        line: 1,
        column: 1
    };

    const hexDigit = c => {
        c = c.toLowerCase();

        if (c >= '0' && c <= '9') {
            return c.charCodeAt(0) - '0'.charCodeAt(0);
        }
        if (c >= 'a' && c <= 'f') {
            return 10 + c.charCodeAt(0) - 'a'.charCodeAt(0);
        }
        throw new Error(
            `invalid hex digit ${c} at line ${position.line}, column ${
                position.column
            }`
        );
    };

    const _recordReader = function(line) {
        let checkSum = 0;
        let i = line.indexOf(':');
        if (i >= 0) {
            i = i + 1;
        }

        this.getByte = () => {
            var val = 0;
            position.column = i + 1;

            for (var j = 0; j < 2 && i < line.length; j++) {
                val = val * 16 + hexDigit(line[i++]);
            }
            checkSum = (checkSum + val) % 256;
            return val;
        };

        this.check = () => {
            this.getByte();
            var match = checkSum === 0;
            return match;
        };
    };

    this.getBuffer = (address, length) => mem.getData(address, length);
    this.getAddress = () => mem.getAddress();
    this.getLength = () => mem.getLength();

    let done = false;
    this.eof = () => {
        return done;
    };

    let happy = true;
    this.error = () => {
        return !happy;
    };

    let extended_segment_address = 0;
    let extended_linear_address = 0;

    this.decodeRecord = line => {
        if (line.indexOf(':') >= 0) {
            let hr = new _recordReader(line);

            let byteCount = hr.getByte();
            let address =
                extended_linear_address +
                extended_segment_address +
                hr.getByte() * 256 +
                hr.getByte();
            let recordType = hr.getByte();

            switch (recordType) {
                case 0: // data record
                    var data = new Buffer(byteCount);
                    for (var i = 0; i < byteCount; i++) {
                        data[i] = hr.getByte();
                    }
                    mem.write(address, data);
                    happy = hr.check();
                    break;

                case 1: // end-of-file record
                    happy = hr.check();
                    done = true;
                    break;

                case 2: // extended-segment-address record
                    extended_segment_address =
                        (hr.getByte() * 256 + hr.getByte()) * 16;
                    happy = hr.check();
                    this.emit(
                        'info',
                        `extended_segment_address: 0x${extended_segment_address.toString(
                            16
                        )}`
                    );
                    break;

                case 4: // linear-base-address record
                    extended_linear_address =
                        (hr.getByte() * 256 + hr.getByte()) * 65536;
                    happy = hr.check();
                    this.emit(
                        'info',
                        `extended_linear_address: 0x${extended_linear_address.toString(
                            16
                        )}`
                    );
                    break;

                case 5: // start-linear-address
                    var start_linear_address =
                        ((hr.getByte() * 256 + hr.getByte()) * 256 +
                            hr.getByte()) *
                            256 +
                        hr.getByte();
                    happy = hr.check();
                    this.emit(
                        'info',
                        `start_linear_address: 0x${start_linear_address.toString(
                            16
                        )}`
                    );
                    break;

                default:
                    this.emit(
                        'info',
                        `unhandled hex record type ${recordType}`
                    );
                    happy = false;
                    break;
            }

            position.line += 1;
        } else {
            this.emit(
                'info',
                `discarding malformed record on line ${position.line}`
            );
        }

        return happy & !done;
    };
}

util.inherits(_hexDecoder, EventEmitter);

const _binaryFileWriter = function(path) {
    var hd = new _hexDecoder();

    this.decodeRecord = hd.decodeRecord;
    this.eof = hd.eof;

    this.bytesWritten = () => {
        return hd.getLength();
    };

    this.close = () => {
        return fs.writeFile(path, hd.getBuffer());
    };
};

module.exports.binaryFileWriter = path => {
    return new _binaryFileWriter(path);
};

const es = require('event-stream');

module.exports.readHexFile = function(filename, progress, info) {
    var hd = new _hexDecoder();
    if (info) hd.on('info', data => info(data));

    return fs.stat(filename).then(stats => {
        let bytesRead = 0;
        let lastPercent = -1;
        return new Promise((resolve, reject) => {
            fs
                .createReadStream(filename)
                .on('end', resolve)
                .on('error', reject)
                .pipe(es.split())
                .pipe(
                    es.map((data, callback) => {
                        let line = data.trim();
                        if (progress) {
                            bytesRead += line.length + 2;
                            var percent = Math.floor(
                                bytesRead * 100 / stats.size
                            );

                            if (percent != lastPercent) {
                                progress(percent);
                                lastPercent = percent;
                            }
                        }
                        hd.decodeRecord(line);
                        callback();
                    })
                );
        }).then(() => {
            return { address: hd.getAddress(), data: hd.getBuffer() };
        });
    });
};
