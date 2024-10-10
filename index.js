const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require('fs');
// const { init: initDB, Counter } = require("./db");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 微信公众号的配置
const APP_ID = 'wx5aa52b8505779050'; // 微信公众号的AppID
const APP_SECRET = '7a1429ade7df13aa2fb94077fc469a93'; // 微信公众号的AppSecret

// // 首页
// app.get("/", async (req, res) => {
//   res.send('ffffffffff')
// });

// // 更新计数
// app.post("/api/count", async (req, res) => {
//   const { action } = req.body;
//   if (action === "inc") {
//     await Counter.create();
//   } else if (action === "clear") {
//     await Counter.destroy({
//       truncate: true,
//     });
//   }
//   res.send({
//     code: 0,
//     data: await Counter.count(),
//   });
// });

// // 获取计数
// app.get("/api/count", async (req, res) => {
//   const result = await Counter.count();
//   res.send({
//     code: 0,
//     data: result,
//   });
// });

// // 小程序调用，获取微信 Open ID
// app.get("/api/wx_openid", async (req, res) => {
//   if (req.headers["x-wx-source"]) {
//     res.send(req.headers["x-wx-openid"]);
//   }
// });

let cache = {
  jsapiTicket: null,
  accessToken: null,
  accessTokenExpiresAt: 0,
  jsapiTicketExpiresAt: 0
};

// 缓存文件路径
const cacheFilePath = path.join(__dirname, 'wechat_cache.json');

// 从文件读取缓存
function readCache() {
  try {
      const data = fs.readFileSync(cacheFilePath);
      cache = JSON.parse(data);
  } catch (error) {
      console.log('No cache file found, initializing cache.');
  }
}

// 将缓存写入文件
function writeCache() {
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache));
}

// 获取 jsapi_ticket
async function getJsapiTicket() {
  const currentTime = Date.now();
  if (cache.jsapiTicket && currentTime < cache.jsapiTicketExpiresAt) {
      return cache.jsapiTicket; // 返回缓存的 jsapi_ticket
  }
  try {
      // await getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi`;
      const response = await axios.get(url);
      
      if (response.data.ticket) {
          cache.jsapiTicket = response.data.ticket;
          // 设置提前 5 分钟过期时间
          cache.jsapiTicketExpiresAt = currentTime + (response.data.expires_in - 300) * 1000;
          writeCache(); // 将新的 jsapi_ticket 写入缓存文件
          console.log('Jsapi ticket obtained and cached:', cache.jsapiTicket);
      }
  } catch (error) {
      console.error('Error fetching jsapi_ticket:', error);
  }
}

// 生成签名
function generateSignature({ noncestr, jsapi_ticket, timestamp, url }) {
  const string = `jsapi_ticket=${jsapi_ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(string).digest('hex');
}

function getClientIp (req) {
  return req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress || '';
};

// 验签接口
app.get('/test', async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
  console.log('headers', req.headers);
	res.send('fffffffff')
});

app.post('/wechat-signature', async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	let ip = getClientIp(req).match(/\d+.\d+.\d+.\d+/);
	ip = ip ? ip.join('.') : null;
	console.log('来访者', ip);
    // const { url } = req.query;
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    try {
        // 检查并更新 jsapi_ticket
        await getJsapiTicket();

        const noncestr = Math.random().toString(36).substr(2, 15);
        const timestamp = Math.floor(Date.now() / 1000);
        // 生成签名
        const signature = generateSignature({
            noncestr,
            jsapi_ticket: cache.jsapiTicket,
            timestamp,
            url
        });
        res.json({
            appId: APP_ID,
            timestamp,
            nonceStr: noncestr,
            signature
        });
    } catch (error) {
        console.error('Error generating signature:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// 启动时从文件中加载缓存
readCache();

const port = process.env.PORT || 80;

async function bootstrap() {
  // await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
