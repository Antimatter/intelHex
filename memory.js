function Memory() {

    const INCREMENT = 1024;

    let startAddress = Number.MAXVALUE;
    let endAddress = Number.MINVALUE;
    let buffer = null;

    this.write = (address, data) => {
        
        if (!buffer) {
            buffer = new Buffer(INCREMENT);
            startAddress = address;
            endAddress = address + data.length;
        }

        if (address < startAddress) {
            let newBuffer = new Buffer(startAddress - address + buffer.length);
            newBuffer.fill(0, 0, startAddress - address);
            buffer.copy(newBuffer, startAddress - address);
            buffer = newBuffer;
            startAddress = address;
        }

        while (address + data.length > startAddress + buffer.length) {
            let newBuffer = new Buffer(buffer.length + INCREMENT);
            buffer.copy(newBuffer);
            newBuffer.fill(0, buffer.length);
            buffer = newBuffer;
        }

        data.copy(buffer, address - startAddress);
        if (address + data.length > endAddress) {
            endAddress = address + data.length;
        }
    };

    this.getData = (address, length) => {
        if (!address) {
            address = startAddress;
        }
        if (!length) {
            length = endAddress - address;
        }
        if (address < startAddress || address + length > endAddress) {
            console.log('getData: out of bounds:', 'a:', address, 'l:', length, 'sa:', startAddress, 'ea:', endAddress);
        }
        return buffer.slice(address - startAddress, address - startAddress + length);
    };

    this.getAddress = () => startAddress;
    this.getLength = () => endAddress - startAddress;
}

module.exports = () => new Memory();
