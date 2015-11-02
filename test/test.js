var intelHex = require('../intelHex');
var assert = require('assert');
var fs = require('fs');
var bufferEqual = require('buffer-equal');

var TEST_ADDRESS = 0x80010000;

describe('hex2bin', function () {
	it('should decode test.hex and the result should match test.bin', function (done) {
		intelHex.readHexFile(
			'test/test.hex',
			function(progress) {
				process.stdout.write('\r          \r' + progress + '%');
			},
			function(error, address, buffer) {
				assert(!error, 'error: ' + error);
				assert.equal(address, TEST_ADDRESS, 'address mismatch');
				fs.readFile('test/test.bin', function(error, data) {
					assert(!error, 'file read error: ' + error);
					assert(bufferEqual(buffer, data), 'buffer mismatch');
					done();
				});
			}
		);
	});
});

describe('bin2hex', function () {
	it('should read test.bin and the result should match test.hex', function (done) {
		fs.readFile('test/test.bin', function(error, data) {
			intelHex.writeHexFile('test/test.out.hex', TEST_ADDRESS, data, function(error) {
				assert(!error, 'error: ' + error);
				fs.readFile('test/test.hex', function (error, hex1) {
					assert(!error, 'error: ' + error);
					fs.readFile('test/test.out.hex', function (error, hex2) {
						assert(!error, 'error: ' + error);
						assert(bufferEqual(hex1, hex2), 'hex file mismatch');
						done();
					});
				});
			});
		});
	});
});
