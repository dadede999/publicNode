const buf = Buffer.alloc(4);
num = "0x11";
buf.writeInt8(num, 0);
console.log(buf); //<Buffer 11 00 00 00>
buf.writeInt16BE(num, 0);
console.log(buf); //<Buffer 00 11 00 00>
buf.writeInt32BE(num, 0);
console.log(buf); //<Buffer 00 00 00 11>

buf.writeInt32LE(num, 0);
console.log(buf); //<Buffer 11 00 00 00>

// buf.writeUInt16BE(num, 0);
// console.log(buf); //buf.fill();

// buf.writeInt16LE(num, 0);
// console.log(buf); //buf.fill();

// buf.writeUInt16LE(num, 0);
// console.log(buf); //buf.fill();

// buf.writeUInt32BE(num, 0);
// console.log(buf); //buf.fill();

// buf.writeInt32LE(num, 0);
// console.log(buf); //buf.fill();

// buf.writeUInt32LE(num, 0);
// console.log(buf); //buf.fill();
