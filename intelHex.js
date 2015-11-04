var fs = require('fs');

//////////  Encoding functions //////////

var MAXLINEBYTES = 32;

module.exports.setLineBytes = function(mlb) {
	MAXLINEBYTES = mlb;
};

function bufferReader(address, data) {

	var ptr = address;
	var len = data.length;
	var endPtr = address + len;
	var extended_linear_address = 0;
	var eof = false;

//	console.log('ptr =', ptr, 'endPtr =', endPtr, 'len =', len);

	this.length = function() { return data.length; };

	this.eof = function() {
		return eof;
	}

	function hexString(d, n) {
		var h = Math.round(d).toString(16);
		while (h.length < n) {
			h = '0' + h;
		}
		return h;
	}

	function toRecord(bytes) {
		var line = ":";
		var cc = 0;

		for (var i = 0; i < bytes.length; i++) {
			line += hexString(bytes[i], 2);
			cc = (cc + bytes[i]) % 256;
		}

		cc = (256 - cc) % 256;
		line += hexString(cc, 2);
		return line;
	}

	this.bytesRead = function() { return ptr; };

	this.getNextRecord = function() {
		if (ptr >= endPtr) {
			eof = true;
			return ":00000001FF";
		}

		if ((ptr < extended_linear_address * 65536) || (ptr >= (extended_linear_address + 1) * 65536)) {
			extended_linear_address = Math.floor(ptr / 65536);
//			console.log('ptr =', ptr.toString(16), 'extended_linear_address =', extended_linear_address.toString(16));
			return toRecord([2, 0, 0, 4, extended_linear_address >> 8, extended_linear_address & 0xff]);
		}

		var count = Math.min(MAXLINEBYTES, endPtr - ptr);

		var bytes = [];

		bytes.push(count); // count
		bytes.push((ptr % 0x10000) >> 8); // address high byte
		bytes.push((ptr % 0x10000) & 0xff); // address low byte
		bytes.push(0); // data record type

		for (var i = 0; i < count; i++) { // data
			bytes.push(data[ptr - address + i]);
		}

		ptr += count;

		return toRecord(bytes);
	}
}

module.exports.binaryBufferReader = function(data, callback) {
	callback(null, new bufferReader(0, data));
}

module.exports.binaryFileReader = function(path, callback) {

	fs.readFile(path, function(err, data) {
		if (err) {
			console.log('error opening', path, ':', err);
			callback(err, null);
		}
		else {
			var bfr = new bufferReader(0, data);
//			console.log('binary data length:', data.length);
			callback(null, bfr);
		}
	});
};

var async = require('async');

module.exports.writeHexFile = function(path, address, data, callback) {

	var br = new bufferReader(address, data);

	var stream = fs.createWriteStream(path);

	async.doWhilst(
		function(callback) {
			var line = br.getNextRecord().toString();
//			console.log(line);
			stream.write(line + '\r\n', callback);
		},

		function() { return !br.eof(); },

		function(err) {
			stream.end();
			callback(err);
		}
	);
};


//////////  Decoding functions //////////

var Memory = require('./memory');

function hexDecoder() {

	var mem = Memory();

	var position = {
		line: 1,
		column: 1
	};

	function hexDigit(c) {
		c = c.toLowerCase();

		if (c >= '0' && c <= '9') {
			return c.charCodeAt(0) - '0'.charCodeAt(0);
		}
		if (c >= 'a' && c <= 'f') {
			return 10 + c.charCodeAt(0) - 'a'.charCodeAt(0);
		}
		console.log('invalid hex digit', c, 'at line', position.line, 'column', position.column);
		return -1;
	}

	function recordReader(line) {
		var self = this;

		var checkSum = 0;
		var i = line.indexOf(':');
		if (i >= 0) {
			i = i + 1;
		}

		this.getByte = function() {
			var val = 0;
			position.column = i + 1;

			for (var j = 0; j < 2 && i < line.length; j++) {
				val = val * 16 + hexDigit(line[i++]);
			}
			checkSum = (checkSum + val) % 256;
			return val;
		}

		this.check = function() {
			var read = self.getByte();
			var match = checkSum === 0;
			if (!match) {
				console.log('checksum error at line', position.line, 'column', position.column);
			}
			return match;
		}
	}

	this.getBuffer = function(address, length) { return mem.getData(address, length); };
	this.getAddress = function() { return mem.getAddress(); };
	this.getLength = function() { return mem.getLength(); };

	var done = false;
	this.eof = function() { return done; };

	var happy = true;
	this.error = function() { return !happy; };

	var extended_segment_address = 0;
	var extended_linear_address = 0;

	this.decodeRecord = function(line) {

		if (line.indexOf(':') >= 0) {
			var hr = new recordReader(line);

			var byteCount = hr.getByte();
			var address = extended_linear_address + extended_segment_address + hr.getByte() * 256 + hr.getByte();
			var recordType = hr.getByte();

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
					extended_segment_address = ((hr.getByte() * 256) + hr.getByte()) * 16;
					happy = hr.check();
					console.log('\rextended_segment_address: 0x' + extended_segment_address.toString(16));
					break;

				case 4: // linear-base-address record
					extended_linear_address = ((hr.getByte() * 256) + hr.getByte()) * 65536;
					happy = hr.check();
					console.log('\rextended_linear_address: 0x' + extended_linear_address.toString(16));
					break;

				case 5: // start-linear-address
					start_linear_address = ((hr.getByte() * 256 + hr.getByte()) * 256 + hr.getByte()) * 256 + hr.getByte();
					happy = hr.check();
					console.log('\rstart_linear_address: 0x' + start_linear_address.toString(16));
					break;

				default:
					console.log('unhandled hex record type', recordType);
					happy = false;
					break;
			}

			position.line += 1;
		}
		else {
			console.log('\rdiscarding malformed record on line:', position.line);
		}

		return happy & !done;
	};
}

function binaryFileWriter(path, callback) {
	var hd = new hexDecoder();

	this.decodeRecord = hd.decodeRecord;
	this.eof = hd.eof;

	this.bytesWritten = function() { return hd.getLength() };

	this.close = function(callback) {
		fs.writeFile(path, hd.getBuffer(), callback);
	}

	if (callback) {
		callback(null, this);
	}
	else {
		return this;
	}
}

module.exports.binaryFileWriter = function(path, callback) {
	return new binaryFileWriter(path, callback);
};

var LBL = require('line-by-line');

module.exports.readHexFile = function(filename, progress, callback) {

	var hd = new hexDecoder();

    fs.stat(filename, function(err, stats) {

        var bytesRead = 0;
        var lastPercent = -1;

        var lr = new LBL(filename);

        lr.on('line', function (line) {
			if (progress) {
	            bytesRead += line.length + 2;
	            var percent = Math.floor(bytesRead * 100 / stats.size);

	            if (percent != lastPercent) {
	                progress(percent);
	                lastPercent = percent;
	            };
			}

			hd.decodeRecord(line);
        });

        lr.on('error', function(err) {
            console.log('error reading file:', err);
            callback(err);
        });

        lr.on('end', function() {
            callback(null, hd.getAddress(), hd.getBuffer());
        });
    });
};
