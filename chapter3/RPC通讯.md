# RPC

- 什么是 RPC
- RPC 原理
- RPC 实战

## 什么是 RPC

RPC （Remote Procedure Call） 即 远程过程调用。一句话，让本地能调用远程的函数或者方法。比如你是 node 服务，想调用 java 中某个方法 fn，就可以通过 rpc 模块调用到 fn 并获取返回值。设计一个机制让远程调用服务就像调本地服务一样简单，这就是 RPC 框架需要做的事情。

主流的 RPC 框架分为基于 HTTP 和基于 TCP 的两种。基于 HTTP 的 RPC 调用很简单，就和我们访问网页一样，只是它的返回结果更单一（JSON 或 XML）。它的优点在于实现简单，标准化和跨语言，比较适合对外提供 OpenAPI 的场景，而它的缺点是 HTTP 协议传输效率较低、短连接开销较大（HTTP 2.0 后有很大改进）。而基于 TCP 的 RPC 调用，由于 TCP 协议处于协议栈的下层，能够更加灵活地对协议字段进行定制，减少网络开销，提高性能，实现更大的吞吐量和并发数。但是需要更多地关注底层复杂的细节，跨语言和跨平台难度大，实现的代价更高，它比较适合内部系统之间追求极致性能的场景。

## RPC 原理

首先来看看一个 RPC 调用的基本流程，以便大家对它有宏观的认识，后面再逐一讨论其中的细节
![markdown](https://cdn.yuque.com/yuque/0/2018/png/88025/1528342678252-8cdab943-2583-4b5c-9f7e-559d05bcff61.png "markdown")

RPC 调用链文字描述：

1. 调用方（Client）通过本地的 RPC 代理（Proxy）调用相应的接口
2. 本地代理将 RPC 的服务名，方法名和参数等等信息转换成一个标准的 RPC Request 对象交给 RPC 框架
3. RPC 框架采用 RPC 协议（RPC Protocol）将 RPC Request 对象序列化成二进制形式，然后通过 TCP 通道传递给服务提供方 （Server）
4. 服务端（Server）收到二进制数据后，将它反序列化成 RPC Request 对象
5. 服务端（Server）根据 RPC Request 中的信息找到本地对应的方法，传入参数执行，得到结果，并将结果封装成 RPC Response 交给 RPC 框架
6. RPC 框架通过 RPC 协议（RPC Protocol）将 RPC Response 对象序列化成二进制形式，然后通过 TCP 通道传递给服务调用方（Client）
7. 调用方（Client）收到二进制数据后，将它反序列化成 RPC Response 对象，并且将结果通过本地代理（Proxy）返回给业务代码

可以看出有三个关键节点

> 1.  如何设计传输的数据格式，即报文的设计

2. 如何编解码，即对报文的操作
3. 如何传输报文

###报文协议设计以及处理报文
####1、报文协议
因为在 TCP 通道里传输的数据只能是二进制形式的，所以我们必须将数据结构或对象转换成二进制串传递给对方，这个过程就叫「序列化」。而相反，我们收到对方的二进制串后把它转换成数据结构或对象的过程叫「反序列化」。而序列化和反序列化的规则就叫「协议」。

下面我们来尝试设计一个 RPC 通讯协议。通常它由一个 Header 和一个 Payload（类似于 HTTP 的 Body）组成，合起来叫一个包（Packet）。之所有要有包，是因为二进制只完成 Stream 的传输，并不知道一次数据请求和响应的起始和结束，我们需要预先定义好包结构才能做解析。

协议设计就像把一个数据包按顺序切分成若干个单位长度的「小格子」，然后约定每个「小格子」里存储什么样的信息，一个「小格子」就是一个 Byte，它是协议设计的最小单位，1 Byte 是 8 Bit，可以描述 0 ~ 2^8 个字节数，具体使用多少个字节要看实际存储的信息。我们在收到一个数据包的时候首先确定它是请求还是响应，所以我们需要用一个 Byte 来标记包的类型，比如：0 表示请求，1 表示响应。知道包类型后，我们还需要将请求和它对应的响应关联起来，通常的做法是在请求前生成一个「唯一」的 ID，放到 Header 里传递给服务端，服务端在返回的响应头里也要包含同样的 ID，这个 ID 我们选择用一个 Int32 类型（4 Bytes）自增的数字表示。要能实现包的准确切割，我们需要明确包的长度，Header 长度通常是固定的，而 Payload 长度是变化的，所以要在 Header 留 4 个 Bytes（Int32） 记录 Payload 部分的长度。确定包长度后，我们就可以切分出一个个独立的包。Payload 部分编码规则由应用层协决定，不同的场景采用的协议可能是不一样的，那么接收端如何知道用什么协议去解码 Payload 部分呢？所以，在 Header 里面还需要一个 Byte 标记应用层协议的类型，我们称之为 Codec。现在来看看我们设计的协议长什么样：

```code
0      1      2      3      4      5      6      7      8      9     10
+------+------+------+------+------+------+------+------+------+------+
| type |          requestId        | codec|         bodyLength        |
+------+---------------------------+------+---------------------------+
|                  ...          payload                               |
|                                                     ...             |
+---------------------------------------------------------------------+
```

可以看出，这个报文协议格式已经可以用了，那么接下来需要考虑的是，我们怎么传输这个报文，能发送和接收正常，实现正常的通讯。

####2、处理报文
对上述报文进行编解码操作。

```javascript
const buf = Buffer.alloc(1024 * 1024); // 分配一块 1M 的内存
let offset = 0;

// 开始编码
offset = 0; // 重置偏移量
buf[0] = 0;
buf.writeInt32BE(1000, 1);
buf[5] = 1; // codec => 1 代表是 JSON 序列化
offset += 10;

const payload = {
  service: "com.nodejs.HelloService:1.0",
  methodName: "plus",
  args: [1, 2]
};
const bodyLength = buf.write(JSON.stringify(payload), offset);
buf.writeInt32BE(bodyLength, 6); //第二个参数是offset
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
```

####3、传输报文
由于网络数据并不是按照我们定义的协议包为单位传输的，有可能一次收到多个包，或者一个包分多次收到。那么收到数据后第一件事情应该是将它切分成一个一个完整的包。

```javascript
const net = require("net");
const socket = net.connect(12200, "127.0.0.1");
const HEADER_LEN = 10; // 头部长度
let header;

socket.on("readable", () => {
  if (!header) {
    header = socket.read(HEADER_LEN);
  }
  if (!header) {
    return;
  }
  const bodyLength = header.readInt32BE(6);
  const body = socket.read(bodyLength);
  if (!body) {
    return;
  }
  const packet = Buffer.concat([header, body], HEADER_LEN + bodyLength);
  // packet 的处理逻辑
  // ...
});
```

待续。。。

参考：
https://www.yuque.com/egg/nodejs/dklip5
https://www.yuque.com/egg/nodejs/cpn3uo
