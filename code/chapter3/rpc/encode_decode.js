const buf = Buffer.alloc(1024 * 1024); // 分配一块 1M 的内存
let offset = 0;

// 开始编码
offset = 0; // 重置偏移量
buf[0] = 0;
buf.writeInt32BE(1000, 1);
buf[5] = 1; // codec => 1 代表是 JSON 序列化
offset += 10;

const payload = {
  service: "com.alipay.nodejs.HelloService:1.0",
  methodName: "plus",
  args: [1, 2]
};
const bodyLength = buf.write(JSON.stringify(payload), offset);
buf.writeInt32BE(bodyLength, 6);
offset += bodyLength;
buf.slice(0, offset);

console.log(buf);

// 解码，对报文进行拆分
const type = buf[0]; // => 0 (request)
const requestId = buf.readInt32BE(1); // => 1000
const codec = buf[5];
const deBodyLength = buf.readInt32BE(6);
const deBody = buf.slice(10, 10 + deBodyLength);
const dePayload = JSON.parse(deBody);

console.log(dePayload);
