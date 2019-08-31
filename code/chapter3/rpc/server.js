const net = require("net");

const PORT = 3000;
const HOST = "127.0.0.1";

// tcp服务端
const server = net.createServer(function(socket) {
  socket.on("data", function(data) {
    console.log("服务端：收到来自客户端的请求");
    console.log(data.toString());
    const buf = Buffer.alloc(1024 * 1024); // 分配一块 1M 的内存
    let offset = 0;

    // 开始编码
    offset = 0; // 重置偏移量
    buf[0] = 0;
    console.log("buf1", buf);
    buf.writeInt32BE(1000, 1);
    console.log("buf2", buf);
    buf[5] = 1; // codec => 1 代表是 JSON 序列化
    console.log("buf3", buf);
    offset += 10;
    const payload = "abc";
    const bodyLength = buf.write(payload, offset);
    buf.writeInt32BE(bodyLength, 6);
    offset += bodyLength;
    buf.slice(0, offset);
    // 给客户端返回数据
    console.log(buf);
    socket.write(buf);
  });

  socket.on("close", function() {
    console.log("服务端：客户端连接断开");
  });
  socket.on("error", () => {});
});
server.listen(PORT, HOST, function() {
  console.log("服务端：开始监听来自客户端的请求");
});
