const net = require("net");

const PORT = 3000;
const HOST = "127.0.0.1";
const HEADER_LEN = 10; // 头部长度
let header;
// tcp客户端
const client = net.createConnection(PORT, HOST);

client.on("connect", function() {
  //console.log("客户端：已经与服务端建立连接");
});

client.on("readable", function() {
  if (!header) {
    header = client.read(HEADER_LEN);
  }
  if (!header) {
    return;
  }
  const bodyLength = header.readInt32BE(6);
  const body = client.read(bodyLength);
  if (!body) {
    return;
  }

  const packet = Buffer.concat([header, body], HEADER_LEN + bodyLength);
  console.log(packet);
  // console.log(header);
  console.log(body.toString());
});

client.on("close", function(data) {
  console.log("客户端：连接断开");
});

client.end("你好，我是客户端");
