var intelHex = require('../intelHex');
var assert = require('assert');
var fs = require('fs-extra');
var bufferEqual = require('buffer-equal');

var TEST_ADDRESS = 0x80010000;

describe('hex2bin', function() {
    it('should decode test.hex and the result should match test.bin', function(done) {
        intelHex
            .readFile('test/test.hex', {
                progress: percent =>
                    process.stdout.write('\r          \r' + percent + '%'),
                info: message => {
                    console.log('\r' + message + '\n');
                }
            })
            .then(result => {
                assert.equal(result.address, TEST_ADDRESS, 'address mismatch');
                return fs.readFile('test/test.bin').then(data => {
                    assert(bufferEqual(result.data, data), 'buffer mismatch');
                    done();
                });
            })
            .catch(error => {
                assert(!error, 'error: ' + error);
            });
    });
});

describe('bin2hex', function() {
    it('should read test.bin and the result should match test.hex', function(done) {
        fs
            .readFile('test/test.bin')
            .then(data => {
                return intelHex
                    .writeFile('test/test.out.hex', TEST_ADDRESS, data, {
                        progress: percent =>
                            process.stdout.write(
                                '\r          \r' + percent + '%'
                            )
                    })
                    .then(() => {
                        return fs.readFile('test/test.hex').then(hex1 => {
                            return fs
                                .readFile('test/test.out.hex')
                                .then(hex2 => {
                                    assert(
                                        bufferEqual(hex1, hex2),
                                        'hex file mismatch'
                                    );
                                    done();
                                });
                        });
                    });
            })
            .catch(error => {
                assert(!error, 'error: ' + error);
            });
    });
});
