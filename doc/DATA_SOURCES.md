# データソース仕様書

## 概要
本アプリケーションで使用するデータソースとその取得方法について詳細を記載します。

## 1. データソース一覧

### 1.1 ゴールドETF価格データ

#### 主要取得対象銘柄
| 銘柄コード | 銘柄名 | Yahoo Financeシンボル |
|-----------|--------|---------------------|
| 1540 | 純金上場信託（現物国内保管型） | 1540.T |
| 1326 | SPDRゴールド・シェア | 1326.T |
| 1328 | 金価格連動型上場投資信託 | 1328.T |

#### データソースオプション

##### Option 1: Yahoo Finance API（推奨）
- **エンドポイント**: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- **更新頻度**: リアルタイム（取引時間中）
- **料金**: 無料
- **制限**: なし（合理的な使用範囲内）
- **CORS**: 制限あり（プロキシ必要）
- **取得可能データ**:
  - 現在価格
  - 前日終値
  - 出来高
  - 日中高値・安値

**実装例**:
```javascript
const url = `https://query1.finance.yahoo.com/v8/finance/chart/1540.T`;
// CORSプロキシ経由
const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
const response = await fetch(proxyUrl);
const data = await response.json();
const price = data.chart.result[0].meta.regularMarketPrice;
```

##### Option 2: Alpha Vantage
- **エンドポイント**: `https://www.alphavantage.co/query`
- **更新頻度**: 15分遅延
- **料金**: 無料プラン（5リクエスト/分、500リクエスト/日）
- **APIキー**: 必要（無料登録）
- **CORS**: 対応
- **取得可能データ**: OHLCV（始値・高値・安値・終値・出来高）

##### Option 3: 証券会社API
- **SBI証券API**: 個人投資家向け（要口座開設）
- **楽天証券API**: RSSツール経由
- **制限**: 口座開設が必要

### 1.2 USD/JPY為替レート

#### データソースオプション

##### Option 1: ExchangeRate-API（実装済み）
- **エンドポイント**: `https://api.exchangerate-api.com/v4/latest/USD`
- **更新頻度**: 1日1回
- **料金**: 無料
- **制限**: なし
- **CORS**: 対応
- **取得可能データ**: 各国通貨レート

**実装例**:
```javascript
const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
const data = await response.json();
const usdJpy = data.rates.JPY;
```

##### Option 2: Fixer.io
- **エンドポイント**: `https://api.fixer.io/latest`
- **更新頻度**: 1時間ごと（無料プラン）
- **料金**: 無料プラン（1000リクエスト/月）
- **APIキー**: 必要
- **CORS**: 対応

##### Option 3: CurrencyAPI
- **エンドポイント**: `https://api.currencyapi.com/v3/latest`
- **更新頻度**: 1日1回（無料プラン）
- **料金**: 無料プラン（300リクエスト/月）
- **APIキー**: 必要

##### Option 4: 日本銀行API
- **エンドポイント**: `https://www.boj.or.jp/statistics/market/forex/fxdaily/`
- **更新頻度**: 営業日1日1回
- **料金**: 無料
- **制限**: スクレイピング必要

### 1.3 ゴールドスポット価格

#### データソースオプション

##### Option 1: Metals-API（推奨）
- **エンドポイント**: `https://api.metals-api.com/v1/latest`
- **更新頻度**: 60分ごと（無料プラン）
- **料金**: 無料プラン（50リクエスト/月）
- **APIキー**: 必要（無料登録）
- **CORS**: 対応
- **取得可能データ**:
  - XAU/USD（金/米ドル）
  - その他貴金属価格

**実装例**:
```javascript
const API_KEY = 'YOUR_API_KEY';
const url = `https://api.metals-api.com/v1/latest?access_key=${API_KEY}&symbols=XAU`;
const response = await fetch(url);
const data = await response.json();
const goldPrice = 1 / data.rates.XAU; // レートは逆数で提供される
```

##### Option 2: GoldAPI.io
- **エンドポイント**: `https://www.goldapi.io/api/XAU/USD`
- **更新頻度**: リアルタイム
- **料金**: 無料プラン（10リクエスト/日）
- **APIキー**: 必要
- **制限**: レート制限厳しい

##### Option 3: Metals.live
- **エンドポイント**: `https://api.metals.live/v1/spot/gold`
- **更新頻度**: リアルタイム
- **料金**: 無料（制限あり）
- **CORS**: 制限あり

##### Option 4: Kitco
- **URL**: `https://www.kitco.com/market/`
- **更新頻度**: リアルタイム
- **料金**: 無料
- **制限**: スクレイピング必要、CORS制限

## 2. CORS対策

### 2.1 問題点
多くの金融APIはブラウザからの直接アクセスにCORS制限があります。

### 2.2 解決策

#### 開発環境
1. **CORSプロキシサービス**
   - `https://corsproxy.io/?{url}`
   - `https://cors-anywhere.herokuapp.com/{url}`
   - `https://api.allorigins.win/raw?url={url}`

2. **ブラウザ拡張機能**
   - CORS Unblock
   - Allow CORS

#### 本番環境
1. **サーバーサイドプロキシ**
```javascript
// Node.js/Express例
app.get('/api/forex', async (req, res) => {
  const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  const data = await response.json();
  res.json(data);
});
```

2. **サーバーレス関数**
```javascript
// Netlify Functions例
exports.handler = async (event, context) => {
  const response = await fetch('https://api.metals-api.com/v1/latest');
  const data = await response.json();
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};
```

3. **CDNエッジワーカー**
   - Cloudflare Workers
   - AWS Lambda@Edge

## 3. データ更新戦略

### 3.1 更新頻度の設計

| データ種別 | 推奨更新間隔 | 理由 |
|-----------|------------|------|
| ETF価格 | 5-15分 | 取引時間中の価格変動を反映 |
| 為替レート | 30-60分 | 変動が比較的緩やか |
| スポット価格 | 30分 | API制限とのバランス |

### 3.2 キャッシュ戦略

```javascript
class DataCache {
  constructor(ttl = 30 * 60 * 1000) { // 30分
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }
}
```

### 3.3 エラーハンドリング

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## 4. データ計算式

### 4.1 円建てゴールド価格の計算

```javascript
// 1トロイオンス = 31.1035グラム
const GRAMS_PER_TROY_OUNCE = 31.1035;

// ゴールド価格（円/グラム）の計算
function calculateGoldPriceJPY(spotPriceUSD, usdJpyRate) {
  // spotPriceUSD: USD/oz (1トロイオンスあたりのドル価格)
  // usdJpyRate: 1ドルあたりの円価格

  const priceJpyPerOz = spotPriceUSD * usdJpyRate; // 円/oz
  const priceJpyPerGram = priceJpyPerOz / GRAMS_PER_TROY_OUNCE; // 円/g

  return priceJpyPerGram;
}
```

### 4.2 変化率の計算

```javascript
function calculateChangePercent(current, previous) {
  const change = current - previous;
  const changePercent = (change / previous) * 100;
  return {
    absolute: change,
    percent: changePercent
  };
}
```

## 5. セキュリティ考慮事項

### 5.1 APIキーの管理

#### ❌ 悪い例（フロントエンド直書き）
```javascript
const API_KEY = 'abc123def456'; // 露出する
```

#### ✅ 良い例（環境変数 + サーバーサイド）
```javascript
// .env
METALS_API_KEY=abc123def456

// server.js
const API_KEY = process.env.METALS_API_KEY;
```

### 5.2 レート制限対策

```javascript
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(
      time => now - time < this.timeWindow
    );

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

// 使用例: 1分間に5リクエストまで
const limiter = new RateLimiter(5, 60000);
```

## 6. パフォーマンス最適化

### 6.1 並列データ取得

```javascript
async function fetchAllData() {
  const [etfData, forexData, goldData] = await Promise.all([
    fetchETFData(),
    fetchForexData(),
    fetchGoldPrice()
  ]);

  return { etfData, forexData, goldData };
}
```

### 6.2 遅延ローディング

```javascript
// 初期表示はキャッシュデータ、その後バックグラウンドで更新
function initializeApp() {
  // 1. ローカルストレージからキャッシュデータを表示
  displayCachedData();

  // 2. バックグラウンドで最新データを取得
  fetchLatestData().then(data => {
    updateDisplay(data);
    saveToCache(data);
  });
}
```

## 7. テスト用モックデータ

```javascript
const mockData = {
  etf: {
    "1540.T": { price: 7850, change: 25, changePercent: 0.32 },
    "1326.T": { price: 22450, change: -120, changePercent: -0.53 },
    "1328.T": { price: 6780, change: 45, changePercent: 0.67 }
  },
  forex: {
    usdJpy: 149.85,
    change: 0.42,
    changePercent: 0.28
  },
  gold: {
    spotUSD: 2648.50,
    change: 12.30,
    changePercent: 0.47
  }
};

// 開発環境でのみ使用
if (process.env.NODE_ENV === 'development') {
  window.mockData = mockData;
}
```

## 8. 監視とログ

### 8.1 API呼び出しログ

```javascript
class APILogger {
  constructor() {
    this.logs = [];
  }

  log(endpoint, status, responseTime) {
    const entry = {
      endpoint,
      status,
      responseTime,
      timestamp: new Date().toISOString()
    };

    this.logs.push(entry);
    console.log('API Call:', entry);

    // 分析用にローカルストレージに保存（最新100件）
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    localStorage.setItem('apiLogs', JSON.stringify(this.logs));
  }
}
```

## 9. 将来の拡張案

1. **WebSocket対応**
   - リアルタイム価格更新
   - サーバープッシュ通知

2. **チャート機能**
   - Chart.jsによる価格推移グラフ
   - テクニカル指標の表示

3. **アラート機能**
   - 価格閾値通知
   - 大幅変動アラート

4. **複数通貨対応**
   - EUR、GBPなどの追加
   - 通貨換算機能

5. **履歴データ**
   - 過去データの保存・表示
   - 統計分析機能